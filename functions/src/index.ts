import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();
const db = getFirestore();

/**
 * First accepted driver wins. The transaction re-checks trip and driver
 * state, so two simultaneous accept calls cannot assign the same trip twice.
 */
export const acceptTrip = onCall({ region: "europe-west1", enforceAppCheck: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  const driverId = request.auth.uid;
  const tripId = String(request.data?.tripId ?? "").trim();
  if (!tripId || tripId.length > 128) throw new HttpsError("invalid-argument", "رقم الرحلة غير صالح.");

  const tripRef = db.collection("trips").doc(tripId);
  const driverRef = db.collection("drivers").doc(driverId);

  return db.runTransaction(async (tx) => {
    const [tripSnap, driverSnap] = await Promise.all([tx.get(tripRef), tx.get(driverRef)]);
    if (!tripSnap.exists) throw new HttpsError("not-found", "الرحلة غير موجودة.");
    if (!driverSnap.exists) throw new HttpsError("permission-denied", "ملف السائق غير موجود.");

    const trip = tripSnap.data()!;
    const driver = driverSnap.data()!;
    if (driver.approvalStatus !== "approved") {
      throw new HttpsError("permission-denied", "حساب السائق لم يعتمد بعد.");
    }
    if (driver.availability !== "online") {
      throw new HttpsError("failed-precondition", "يجب أن تكون متصلاً لاستلام الرحلة.");
    }
    if (trip.status !== "searching" || trip.assignedDriverId) {
      throw new HttpsError("already-exists", "تم قبول الرحلة أو لم تعد متاحة.");
    }
    if (trip.cityId && driver.cityId !== trip.cityId) {
      throw new HttpsError("permission-denied", "الرحلة خارج نطاق تشغيلك.");
    }

    tx.update(tripRef, {
      status: "accepted",
      assignedDriverId: driverId,
      acceptedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.update(driverRef, {
      availability: "on_trip",
      currentTripId: tripId,
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.create(tripRef.collection("events").doc(), {
      type: "trip_accepted",
      actorId: driverId,
      createdAt: FieldValue.serverTimestamp()
    });
    return { tripId, status: "accepted" as const };
  });
});

/**
 * Minimal server-side trip creation. Dispatch fan-out is a separate
 * scheduled/queue worker and must not be implemented from the client.
 */
export const createTrip = onCall({ region: "europe-west1", enforceAppCheck: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
  const { pickup, destination, serviceType, cityId } = request.data ?? {};
  const validPoint = (p: any) => p && Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 &&
    Math.abs(p.longitude) <= 180;
  const allowedServices = ["city", "intercity", "private", "scheduled", "parcel"];
  if (!validPoint(pickup) || !validPoint(destination) ||
      !allowedServices.includes(serviceType) || typeof cityId !== "string" || !cityId.trim()) {
    throw new HttpsError("invalid-argument", "بيانات الرحلة غير مكتملة أو غير صحيحة.");
  }
  const userSnap = await db.collection("users").doc(request.auth.uid).get();
  if (!userSnap.exists) throw new HttpsError("failed-precondition", "أكمل ملف حسابك أولاً.");
  const ref = db.collection("trips").doc();
  await ref.create({
    customerId: request.auth.uid,
    pickup: { latitude: pickup.latitude, longitude: pickup.longitude },
    destination: { latitude: destination.latitude, longitude: destination.longitude },
    serviceType,
    cityId: cityId.trim(),
    status: "searching",
    assignedDriverId: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  return { tripId: ref.id, status: "searching" as const };
});