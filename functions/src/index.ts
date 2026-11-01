import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();
const db = getFirestore();
const REGION = "europe-west1";
const FIRST_WAVE_SIZE = 5;
const MAX_CANDIDATES = 50;

type Point = { latitude: number; longitude: number };
const validPoint = (p: any): p is Point => p && Number.isFinite(p.latitude) &&
  Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 &&
  Math.abs(p.longitude) <= 180;

function distanceKm(a: Point, b: Point): number {
  const rad = (n: number) => n * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Initial dispatch wave: choose up to five approved, online drivers in the
 * same city, ordered by their last reported location. Offers are stored in
 * Firestore so the driver app can listen to its own offer documents.
 * A trusted scheduled worker must open later waves when no driver accepts.
 */
async function createFirstDispatchWave(tripId: string, cityId: string, pickup: Point) {
  const candidates = await db.collection("drivers")
    .where("cityId", "==", cityId)
    .where("approvalStatus", "==", "approved")
    .where("availability", "==", "online")
    .limit(MAX_CANDIDATES)
    .get();

  const ranked = candidates.docs
    .map((doc) => {
      const data = doc.data();
      const location = data.location;
      if (!validPoint(location)) return null;
      return { id: doc.id, distanceKm: distanceKm(pickup, location as Point) };
    })
    .filter((item): item is { id: string; distanceKm: number } => item !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, FIRST_WAVE_SIZE);

  if (!ranked.length) {
    await db.collection("trips").doc(tripId).update({
      dispatchState: "no_eligible_drivers",
      dispatchWave: 0,
      updatedAt: FieldValue.serverTimestamp()
    });
    return { offeredDrivers: 0 };
  }

  const batch = db.batch();
  ranked.forEach((driver, index) => {
    const offerRef = db.collection("trips").doc(tripId).collection("offers").doc(driver.id);
    batch.create(offerRef, {
      driverId: driver.id,
      wave: 1,
      distanceKm: Math.round(driver.distanceKm * 100) / 100,
      position: index + 1,
      status: "pending",
      createdAt: FieldValue.serverTimestamp()
    });
  });
  batch.update(db.collection("trips").doc(tripId), {
    dispatchState: "offered",
    dispatchWave: 1,
    offeredDriverIds: ranked.map((d) => d.id),
    updatedAt: FieldValue.serverTimestamp()
  });
  await batch.commit();
  return { offeredDrivers: ranked.length };
}

/** The first valid acceptance wins; Firestore transaction prevents double assignment. */
export const acceptTrip = onCall({ region: REGION, enforceAppCheck: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  const driverId = request.auth.uid;
  const tripId = String(request.data?.tripId ?? "").trim();
  if (!tripId || tripId.length > 128) throw new HttpsError("invalid-argument", "رقم الرحلة غير صالح.");

  const tripRef = db.collection("trips").doc(tripId);
  const driverRef = db.collection("drivers").doc(driverId);
  const offerRef = tripRef.collection("offers").doc(driverId);

  return db.runTransaction(async (tx) => {
    const [tripSnap, driverSnap, offerSnap] = await Promise.all([
      tx.get(tripRef), tx.get(driverRef), tx.get(offerRef)
    ]);
    if (!tripSnap.exists) throw new HttpsError("not-found", "الرحلة غير موجودة.");
    if (!driverSnap.exists) throw new HttpsError("permission-denied", "ملف السائق غير موجود.");
    if (!offerSnap.exists || offerSnap.data()?.status !== "pending") {
      throw new HttpsError("permission-denied", "هذا الطلب غير موجّه إليك أو انتهت صلاحيته.");
    }

    const trip = tripSnap.data()!;
    const driver = driverSnap.data()!;
    if (driver.approvalStatus !== "approved") throw new HttpsError("permission-denied", "حساب السائق لم يعتمد بعد.");
    if (driver.availability !== "online") throw new HttpsError("failed-precondition", "يجب أن تكون متصلاً لاستلام الرحلة.");
    if (trip.status !== "searching" || trip.assignedDriverId) throw new HttpsError("already-exists", "تم قبول الرحلة أو لم تعد متاحة.");
    if (trip.cityId && driver.cityId !== trip.cityId) throw new HttpsError("permission-denied", "الرحلة خارج نطاق تشغيلك.");

    tx.update(tripRef, {
      status: "accepted", assignedDriverId: driverId,
      acceptedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    });
    tx.update(driverRef, { availability: "on_trip", currentTripId: tripId, updatedAt: FieldValue.serverTimestamp() });
    tx.update(offerRef, { status: "accepted", respondedAt: FieldValue.serverTimestamp() });
    tx.create(tripRef.collection("events").doc(), {
      type: "trip_accepted", actorId: driverId, createdAt: FieldValue.serverTimestamp()
    });
    return { tripId, status: "accepted" as const };
  });
});

/** Creates a trip, then sends its first nearest-driver offer wave. */
export const createTrip = onCall({ region: REGION, enforceAppCheck: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  const { pickup, destination, serviceType, cityId } = request.data ?? {};
  const allowedServices = ["city", "intercity", "private", "scheduled", "parcel"];
  if (!validPoint(pickup) || !validPoint(destination) ||
      !allowedServices.includes(serviceType) || typeof cityId !== "string" || !cityId.trim()) {
    throw new HttpsError("invalid-argument", "بيانات الرحلة غير مكتملة أو غير صحيحة.");
  }
  const userSnap = await db.collection("users").doc(request.auth.uid).get();
  if (!userSnap.exists) throw new HttpsError("failed-precondition", "أكمل ملف حسابك أولاً.");

  const tripRef = db.collection("trips").doc();
  await tripRef.create({
    customerId: request.auth.uid,
    pickup: { latitude: pickup.latitude, longitude: pickup.longitude },
    destination: { latitude: destination.latitude, longitude: destination.longitude },
    serviceType, cityId: cityId.trim(), status: "searching",
    dispatchState: "queued", dispatchWave: 0, offeredDriverIds: [],
    assignedDriverId: null, createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  try {
    const dispatch = await createFirstDispatchWave(tripRef.id, cityId.trim(), pickup);
    return { tripId: tripRef.id, status: "searching" as const, ...dispatch };
  } catch (error) {
    await tripRef.update({ dispatchState: "dispatch_error", updatedAt: FieldValue.serverTimestamp() });
    throw new HttpsError("internal", "تم تسجيل الرحلة لكن تعذر إرسال عروض السائقين حالياً.");
  }
});
