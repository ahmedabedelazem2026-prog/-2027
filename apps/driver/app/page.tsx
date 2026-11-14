"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { collection, doc, onSnapshot, type DocumentData } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebaseClient } from "@taxi-capital/firebase";

declare global { interface Window { google?: any } }
type Point = { latitude: number; longitude: number };
type DriverOffer = {
  tripId: string; serviceType?: string; cityId?: string; vehicleType?: string;
  pricingMode?: string; offeredFare?: number | null; pickupLabel?: string;
  destinationLabel?: string; pickup?: Point; destination?: Point;
  distanceKm?: number; status: string;
};
const serviceNames: Record<string,string> = {
  city:"داخل المدينة", intercity:"بين المدن", private:"مشوار خاص",
  scheduled:"حجز مسبق", parcel:"توصيل طرود"
};
const statusNames: Record<string,string> = {
  pending:"طلب جديد", accepted:"تم قبول الرحلة", in_progress:"الرحلة جارية",
  completed:"مكتملة", expired:"انتهى الطلب"
};
const HOME = { lat: 31.1321, lng: 33.8033 };
const money = (value: unknown) => typeof value === "number" ? value.toLocaleString("ar-EG") + " ج.م" : "—";

export default function Driver() {
  const [user,setUser] = useState<User|null>(null);
  const [driver,setDriver] = useState<DocumentData|null>(null);
  const [offers,setOffers] = useState<DriverOffer[]>([]);
  const [notice,setNotice] = useState("");
  const [busy,setBusy] = useState(false);
  const [mapReady,setMapReady] = useState(false);
  const mapDiv = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const pickupMarker = useRef<any>(null);
  const destinationMarker = useRef<any>(null);
  const driverMarker = useRef<any>(null);
  const directionsRenderer = useRef<any>(null);

  useEffect(() => {
    let stopDriver: (()=>void)|undefined, stopOffers: (()=>void)|undefined;
    let client: ReturnType<typeof getFirebaseClient>;
    try { client = getFirebaseClient(); } catch { setNotice("لم يتم إعداد اتصال Firebase لهذه البوابة بعد."); return; }
    const stopAuth = onAuthStateChanged(client.auth, current => {
      stopDriver?.(); stopOffers?.(); setDriver(null); setOffers([]); setUser(current);
      if (!current) return;
      stopDriver = onSnapshot(doc(client.db,"drivers",current.uid), snap => setDriver(snap.exists()?snap.data():null), () => setNotice("تعذر قراءة ملف السائق."));
      stopOffers = onSnapshot(collection(client.db,"driverOffers",current.uid,"items"), snap => {
        setOffers(snap.docs.map(d=>d.data() as DriverOffer).filter(o=>["pending","accepted","in_progress"].includes(o.status)));
      }, () => setNotice("تعذر تحميل عروض الرحلات."));
    });
    return () => { stopAuth(); stopDriver?.(); stopOffers?.(); };
  },[]);

  const mapLoaded = () => {
    if (!window.google || !mapDiv.current || map.current) return;
    const g = window.google.maps;
    map.current = new g.Map(mapDiv.current, {
      center: HOME, zoom: 13, mapTypeControl: false, streetViewControl: false,
      fullscreenControl: true, zoomControl: true, gestureHandling: "greedy"
    });
    directionsRenderer.current = new g.DirectionsRenderer({ map: map.current, suppressMarkers: true, polylineOptions: { strokeColor: "#c69b55", strokeWeight: 5 } });
    setMapReady(true);
  };

  const activeOffer = offers.find(o => ["accepted","in_progress"].includes(o.status));
  useEffect(() => {
    if (!mapReady || !window.google || !map.current) return;
    const g = window.google.maps;
    if (activeOffer?.pickup && activeOffer?.destination) {
      const from = { lat: activeOffer.pickup.latitude, lng: activeOffer.pickup.longitude };
      const to = { lat: activeOffer.destination.latitude, lng: activeOffer.destination.longitude };
      if (!pickupMarker.current) pickupMarker.current = new g.Marker({ map: map.current, position: from, label: "ب" });
      else pickupMarker.current.setPosition(from);
      if (!destinationMarker.current) destinationMarker.current = new g.Marker({ map: map.current, position: to, label: "و" });
      else destinationMarker.current.setPosition(to);
      const bounds = new g.LatLngBounds(); bounds.extend(from); bounds.extend(to); map.current.fitBounds(bounds, 70);
      new g.DirectionsService().route({ origin: from, destination: to, travelMode: g.TravelMode.DRIVING }, (result: any, status: string) => {
        if (status === "OK" && result) directionsRenderer.current?.setDirections(result);
      });
    } else if (driver?.location && Number.isFinite(driver.location.latitude) && Number.isFinite(driver.location.longitude)) {
      map.current.setCenter({ lat: driver.location.latitude, lng: driver.location.longitude });
    }
  },[mapReady,activeOffer?.tripId,activeOffer?.status,driver?.location?.latitude,driver?.location?.longitude]);

  useEffect(() => {
    if (!user || driver?.approvalStatus !== "approved" || !["online","on_trip"].includes(driver?.availability)) return;
    if (!navigator.geolocation) { setNotice("المتصفح لا يدعم تحديد الموقع."); return; }
    let lastSent = 0;
    const watchId = navigator.geolocation.watchPosition(position => {
      const now = Date.now();
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      if (map.current && window.google) {
        const pos = { lat: point.latitude, lng: point.longitude };
        if (!driverMarker.current) driverMarker.current = new window.google.maps.Marker({ map: map.current, position: pos, title: "موقع السائق", icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#15385c", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 3 } });
        else driverMarker.current.setPosition(pos);
      }
      if (now - lastSent < 15000) return;
      lastSent = now;
      httpsCallable(getFirebaseClient().functions,"updateDriverLocation")({ location: point }).catch(() => {
        setNotice("تعذر تحديث موقعك. تأكد من اتصال الإنترنت وصلاحية الموقع.");
      });
    }, () => setNotice("اسمح للمتصفح بالوصول إلى الموقع أثناء استقبال الرحلات."), {
      enableHighAccuracy: true, maximumAge: 10000, timeout: 15000
    });
    return () => navigator.geolocation.clearWatch(watchId);
  },[user,driver?.approvalStatus,driver?.availability,mapReady]);

  const login = async () => {
    setBusy(true); setNotice("");
    try { const {auth,googleProvider}=getFirebaseClient(); await signInWithPopup(auth,googleProvider); }
    catch { setNotice("تعذر تسجيل الدخول. تأكد من تفعيل Google وإضافة نطاق الموقع في Firebase."); }
    finally { setBusy(false); }
  };
  const toggleAvailability = async () => {
    if (!driver) return;
    setBusy(true); setNotice("");
    try {
      const {functions}=getFirebaseClient();
      await httpsCallable(functions,"setDriverAvailability")({availability:driver.availability==="online"?"offline":"online"});
      setNotice("تم تحديث حالة الاتصال.");
    } catch (e) { setNotice(e instanceof Error?e.message:"تعذر تحديث حالة الاتصال. تأكد من إعداد App Check ونشر الوظائف."); }
    finally { setBusy(false); }
  };
  const accept = async (tripId:string) => {
    setBusy(true); setNotice("");
    try { await httpsCallable(getFirebaseClient().functions,"acceptTrip")({tripId}); setNotice("تم قبول الرحلة. أصبحت الرحلة مسندة إليك."); }
    catch (e) { setNotice(e instanceof Error?e.message:"تعذر قبول الرحلة."); }
    finally { setBusy(false); }
  };
  const start = async (tripId:string) => {
    setBusy(true); setNotice("");
    try { await httpsCallable(getFirebaseClient().functions,"startTrip")({tripId}); setNotice("بدأت الرحلة."); }
    catch (e) { setNotice(e instanceof Error?e.message:"تعذر بدء الرحلة."); }
    finally { setBusy(false); }
  };
  const complete = async (tripId:string) => {
    setBusy(true); setNotice("");
    try {
      const result:any = await httpsCallable(getFirebaseClient().functions,"completeTrip")({tripId});
      setNotice(`اكتملت الرحلة. الإجمالي: ${result.data.totalFare} جنيه.`);
    } catch (e) { setNotice(e instanceof Error?e.message:"تعذر إنهاء الرحلة."); }
    finally { setBusy(false); }
  };

  return <main className="driver-app" dir="rtl">
    <Script src={"https://maps.googleapis.com/maps/api/js?key="+(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY||"")+"&language=ar&region=EG"} strategy="afterInteractive" onLoad={mapLoaded} onError={()=>setNotice("تعذر تحميل الخريطة. راجع إعداد Google Maps API.")}/>
    <header className="driver-header"><div className="brand">ت</div><div className="brand-copy"><b>تاكسي العاصمة</b><small>بوابة السائق · العريش وشمال سيناء</small></div><div className="header-spacer"/>{user&&<div className="user-chip">{user.displayName||user.email}</div>}</header>
    <div className="driver-layout">
      <section className="main-column">
        <div className="welcome"><div><small>CAPITAL TAXI · DRIVER</small><h1>طريقك يبدأ من هنا</h1><p>تابع الطلبات، استقبل رحلاتك، وابدأ يومك بثقة.</p></div><div className="welcome-symbol">⌖</div></div>
        <div className="map-panel"><div className="map-heading"><div><b>خريطة التشغيل</b><small>موقعك والرحلة النشطة</small></div><span className={driver?.availability==="online"?"live":"idle"}>{driver?.availability==="online"?"متصل الآن":"غير متصل"}</span></div><div ref={mapDiv} className="driver-map"/>{!mapReady&&<div className="map-loading">جارٍ تحميل خريطة العريش…</div>}</div>
        <section className="offers-section"><div className="section-heading"><div><h2>طلبات الرحلات</h2><p>تظهر لك الطلبات الموجهة إلى حسابك فقط.</p></div><span className="count">{offers.length} طلب</span></div>
          {offers.length===0?<div className="empty-state"><div>⌁</div><b>لا توجد طلبات حالياً</b><p>عند تفعيل استقبال الرحلات ستظهر الطلبات القريبة هنا.</p></div>:offers.map(o=><article className="offer-card" key={o.tripId}>
            <div className="offer-top"><div><span className="service-tag">{serviceNames[o.serviceType||""]||"طلب رحلة"}</span><b>{statusNames[o.status]||o.status}</b></div><small>#{o.tripId.slice(0,8)}</small></div>
            <div className="route-points"><div className="route-point"><i className="point-start"/> <div><small>نقطة الانطلاق</small><b>{o.pickupLabel||"الموقع على الخريطة"}</b></div></div><div className="route-point"><i className="point-end"/> <div><small>الوجهة</small><b>{o.destinationLabel||"الموقع على الخريطة"}</b></div></div></div>
            <div className="offer-meta"><span>{o.vehicleType==="private"?"سيارة خاصة":"تاكسي"}</span><span>{o.distanceKm?o.distanceKm.toFixed(1)+" كم":"المسافة قيد التحديد"}</span><b>{o.pricingMode==="offer"&&o.offeredFare?money(o.offeredFare):"تسعير المنصة"}</b></div>
            <div className="offer-actions">{o.status==="pending"&&<button className="primary" disabled={busy||driver?.approvalStatus!=="approved"||driver?.availability!=="online"} onClick={()=>accept(o.tripId)}>قبول الرحلة</button>}{o.status==="accepted"&&<button className="primary" disabled={busy} onClick={()=>start(o.tripId)}>بدء الرحلة</button>}{o.status==="in_progress"&&<button className="finish" disabled={busy} onClick={()=>complete(o.tripId)}>إنهاء الرحلة وتسجيل الحساب</button>}</div>
          </article>)}
        </section>
      </section>
      <aside className="driver-side">
        <section className="profile-card"><div className="profile-top"><div className="profile-avatar">{(user?.displayName||"س").slice(0,1)}</div><div><b>{user?.displayName||"حساب السائق"}</b><small>{user?.email||"سجّل الدخول للمتابعة"}</small></div></div>
          {!user?<button className="primary full" disabled={busy} onClick={login}>{busy?"جارٍ الدخول…":"الدخول بحساب Google"}</button>:<><div className="driver-divider"/><div className="detail-row"><span>حالة الاعتماد</span><b className={driver?.approvalStatus==="approved"?"approved":""}>{driver?.approvalStatus==="approved"?"معتمد":driver?.approvalStatus==="pending"?"قيد المراجعة":driver?"غير معتمد":"لا يوجد ملف سائق"}</b></div><div className="detail-row"><span>حالة الاتصال</span><b>{driver?.availability==="online"?"متصل":driver?.availability==="on_trip"?"في رحلة":"غير متصل"}</b></div>{driver?.approvalStatus==="approved"&&<button className={driver.availability==="online"?"offline-button":"primary full"} disabled={busy||driver.availability==="on_trip"} onClick={toggleAvailability}>{driver.availability==="online"?"إيقاف استقبال الرحلات":"بدء استقبال الرحلات"}</button>}<button className="logout" onClick={()=>signOut(getFirebaseClient().auth)}>تسجيل الخروج</button></>}
        </section>
        <section className="tips-card"><b>إرشادات التشغيل</b><p>فعّل الموقع الجغرافي واسمح للمتصفح بتحديثه أثناء اتصالك حتى تصلك الطلبات الأقرب.</p><p>قبول أول سائق للطلب يثبت الرحلة على حسابه وينهي عروض بقية السائقين.</p></section>
        <div className="side-footer">تاكسي العاصمة · راحتك وأمانك أولويتنا</div>
      </aside>
    </div>
    {notice&&<div className="toast" role="status">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
    <style jsx global>{`
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');
*{box-sizing:border-box}body{margin:0;background:#f1f4f8;color:#182b43;font-family:Cairo,Arial,sans-serif}button{font:inherit;cursor:pointer}.driver-app{min-height:100vh}.driver-header{height:76px;background:#091c36;color:white;display:flex;align-items:center;padding:0 5vw;gap:12px;box-shadow:0 4px 18px #091c361c}.brand{width:45px;height:45px;border-radius:14px;background:#193554;color:#e2c184;display:grid;place-items:center;font-size:27px;font-weight:900}.brand-copy b,.brand-copy small{display:block}.brand-copy b{font-size:15px}.brand-copy small{font-size:9px;color:#9eafc2}.header-spacer{flex:1}.user-chip{font-size:10px;color:#d8c18f;background:#ffffff12;padding:8px 12px;border-radius:20px}.driver-layout{width:min(1320px,94%);margin:25px auto;display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:20px}.main-column{min-width:0}.welcome{background:linear-gradient(115deg,#0b203c,#1c4265);color:#fff;border-radius:18px;padding:24px 28px;display:flex;justify-content:space-between;align-items:center}.welcome small{color:#dfc183;font-size:9px;font-weight:900;letter-spacing:1.5px}.welcome h1{font-size:24px;margin:5px 0}.welcome p{font-size:11px;color:#b7c6d5;margin:0}.welcome-symbol{font-size:55px;color:#dfc183;opacity:.8}.map-panel,.profile-card,.tips-card,.offer-card{background:#fff;border:1px solid #e7ecf1;border-radius:16px;box-shadow:0 5px 20px #122b4508}.map-panel{margin-top:16px;overflow:hidden;position:relative}.map-heading{padding:14px 18px;display:flex;justify-content:space-between;align-items:center}.map-heading b,.map-heading small{display:block}.map-heading b{font-size:12px}.map-heading small{font-size:9px;color:#93a0af}.live,.idle{font-size:9px;border-radius:20px;padding:5px 10px;background:#e7f5ed;color:#287b58}.idle{background:#f0f2f5;color:#7c8795}.driver-map{height:340px;width:100%;background:#e6edf1}.map-loading{position:absolute;top:55px;inset-inline:0;height:340px;display:grid;place-items:center;background:#e8eef1;color:#65788d;font-size:12px;pointer-events:none}.offers-section{margin-top:23px}.section-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.section-heading h2{font-size:17px;margin:0}.section-heading p{font-size:10px;color:#8996a5;margin:2px 0}.count{background:#e8edf2;border-radius:20px;padding:5px 10px;font-size:9px;color:#52647a}.empty-state{text-align:center;background:#fff;border:1px dashed #dce3ea;border-radius:15px;padding:35px 15px;color:#8795a5}.empty-state div{font-size:28px;color:#bd995b}.empty-state b{display:block;color:#344860;font-size:12px}.empty-state p{font-size:10px}.offer-card{padding:17px;margin-bottom:12px}.offer-top{display:flex;justify-content:space-between;align-items:center}.offer-top>div{display:flex;align-items:center;gap:9px}.offer-top b{font-size:10px}.offer-top>small{font-size:9px;color:#9aa5b1}.service-tag{background:#f7f0e4;color:#98723b;border-radius:6px;padding:5px 8px;font-size:9px}.route-points{margin:17px 0 12px;padding-right:5px;display:grid;gap:13px}.route-point{display:flex;align-items:center;gap:10px}.route-point i{width:9px;height:9px;border-radius:50%;flex-shrink:0}.point-start{background:#2c9b71}.point-end{background:#c08b45}.route-point small,.route-point b{display:block}.route-point small{font-size:8px;color:#97a2af}.route-point b{font-size:10px;color:#35475d}.offer-meta{display:flex;gap:15px;align-items:center;border-top:1px solid #eef1f4;padding-top:12px;font-size:9px;color:#8491a0}.offer-meta b{margin-right:auto;color:#9b753e}.offer-actions{display:flex;gap:8px;margin-top:13px}.primary,.finish,.offline-button{border:0;border-radius:9px;padding:10px 15px;font-size:10px;font-weight:800}.primary{background:#0c2543;color:#fff}.primary:disabled,.finish:disabled{opacity:.55;cursor:not-allowed}.finish{background:#e9f4ee;color:#247550}.full{width:100%;margin-top:15px}.driver-side{display:grid;align-content:start;gap:14px}.profile-card{padding:19px}.profile-top{display:flex;align-items:center;gap:11px}.profile-avatar{width:42px;height:42px;border-radius:14px;background:#f2eadb;color:#94713c;display:grid;place-items:center;font-size:18px;font-weight:900}.profile-top b,.profile-top small{display:block}.profile-top b{font-size:11px}.profile-top small{font-size:8px;color:#929eab;margin-top:3px;max-width:190px;overflow:hidden;text-overflow:ellipsis}.driver-divider{height:1px;background:#edf0f3;margin:16px 0}.detail-row{display:flex;justify-content:space-between;align-items:center;margin:12px 0;font-size:9px;color:#7d8a99}.detail-row b{color:#34485f}.detail-row b.approved{color:#27835e}.offline-button{width:100%;margin-top:12px;background:#fff1f0;color:#a34d45;border:1px solid #f0d5d2}.logout{display:block;margin:13px auto 0;border:0;background:transparent;color:#9a6d45;font-size:9px}.tips-card{padding:18px}.tips-card b{font-size:11px;color:#20364f}.tips-card p{font-size:9px;line-height:1.9;color:#8190a1;margin-bottom:0}.side-footer{text-align:center;color:#9aa5b1;font-size:8px;padding:10px}.toast{position:fixed;bottom:18px;left:18px;right:18px;max-width:520px;margin:auto;background:#fff8e9;border:1px solid #ecdcb9;color:#785b2c;padding:12px 15px;border-radius:11px;box-shadow:0 8px 30px #0002;font-size:10px;display:flex;justify-content:space-between;gap:12px;z-index:5}.toast button{border:0;background:transparent;color:inherit;font-size:18px}
@media(max-width:850px){.driver-layout{grid-template-columns:1fr}.driver-side{grid-row:1}.driver-header{padding:0 15px}.driver-layout{width:calc(100% - 24px);margin:12px auto}.driver-map{height:280px}.map-loading{height:280px}.welcome{padding:19px}.welcome h1{font-size:20px}}
`}</style>
  </main>;
}
