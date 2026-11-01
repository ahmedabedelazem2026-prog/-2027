"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { collection, doc, onSnapshot, type DocumentData } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebaseClient } from "@taxi-capital/firebase";

type DriverOffer = { tripId: string; serviceType?: string; cityId?: string; vehicleType?: string; pricingMode?: string; offeredFare?: number|null; pickupLabel?: string; destinationLabel?: string; pickup?: {latitude:number;longitude:number}; destination?: {latitude:number;longitude:number}; distanceKm?: number; status: string };
const serviceNames: Record<string,string> = {city:"داخل المدينة",intercity:"بين المدن",private:"مشوار خاص",scheduled:"حجز مسبق",parcel:"توصيل طرود"};

export default function Driver() {
  const [user,setUser] = useState<User|null>(null);
  const [driver,setDriver] = useState<DocumentData|null>(null);
  const [offers,setOffers] = useState<DriverOffer[]>([]);
  const [notice,setNotice] = useState("");
  const [busy,setBusy] = useState(false);
  useEffect(() => {
    let stopDriver: (()=>void)|undefined, stopOffers: (()=>void)|undefined;
    let client: ReturnType<typeof getFirebaseClient>;
    try { client = getFirebaseClient(); } catch { setNotice("لم يتم إعداد اتصال Firebase لهذه البوابة بعد."); return; }
    const stopAuth = onAuthStateChanged(client.auth, current => {
      stopDriver?.(); stopOffers?.(); setDriver(null); setOffers([]); setUser(current);
      if (!current) return;
      stopDriver = onSnapshot(doc(client.db,"drivers",current.uid), snap => setDriver(snap.exists()?snap.data():null), () => setNotice("تعذر قراءة ملف السائق. راجع صلاحيات Firestore."));
      stopOffers = onSnapshot(collection(client.db,"driverOffers",current.uid,"items"), snap => setOffers(snap.docs.map(d=>d.data() as DriverOffer).filter(o=>["pending","accepted"].includes(o.status))), () => setNotice("تعذر تحميل عروض الرحلات."));
    });
    return () => { stopAuth(); stopDriver?.(); stopOffers?.(); };
  },[]);
  const login = async () => {
    setBusy(true); setNotice("");
    try { const {auth,googleProvider}=getFirebaseClient(); await signInWithPopup(auth,googleProvider); }
    catch { setNotice("تعذر تسجيل الدخول. تأكد من تفعيل Google وإضافة نطاق الموقع في Firebase."); }
    finally { setBusy(false); }
  };
  const toggleAvailability = async () => {
    if (!driver) return;
    setBusy(true); setNotice("");
    try { const {functions}=getFirebaseClient(); await httpsCallable(functions,"setDriverAvailability")({availability:driver.availability==="online"?"offline":"online"}); setNotice("تم تحديث حالة الاتصال."); }
    catch (e) { setNotice(e instanceof Error?e.message:"تعذر تحديث حالة الاتصال. تأكد من إعداد App Check ونشر الوظائف."); }
    finally { setBusy(false); }
  };
  const start = async (tripId:string) => {
    setBusy(true); setNotice("");
    try { const {functions}=getFirebaseClient(); await httpsCallable(functions,"startTrip")({tripId}); setNotice("بدأت الرحلة."); }
    catch (e) { setNotice(e instanceof Error?e.message:"تعذر بدء الرحلة."); }
    finally { setBusy(false); }
  };
  const accept = async (tripId:string) => {
    setBusy(true); setNotice("");
    try { const {functions}=getFirebaseClient(); await httpsCallable(functions,"acceptTrip")({tripId}); setNotice("تم قبول الرحلة."); }
    catch (e) { setNotice(e instanceof Error?e.message:"تعذر قبول الرحلة."); }
    finally { setBusy(false); }
  };
  const logout = async () => { const {auth}=getFirebaseClient(); await signOut(auth); };
  return <main dir="rtl" style={{fontFamily:"Arial",minHeight:"100vh",background:"#f3f5f8",padding:24,color:"#10233f"}}>
    <header style={{background:"#0a1c37",color:"white",padding:24,borderRadius:18}}><small style={{color:"#d6ad62"}}>TAXI CAPITAL · DRIVER</small><h1>بوابة السائق</h1><p>استقبل الرحلات وأدر حالة اتصالك</p></header>
    <section style={{background:"white",padding:20,borderRadius:16,marginTop:18}}>
      {!user ? <><p>سجل الدخول بحساب Google المرتبط بملف السائق.</p><button disabled={busy} onClick={login}>الدخول بحساب Google</button></> : <>
        <p>الحساب: {user.displayName||user.email}</p><button onClick={logout}>تسجيل الخروج</button>
        {!driver ? <p>لا يوجد ملف سائق لهذا الحساب. اطلب من الإدارة تسجيلك واعتماد حسابك أولاً.</p> : <>
          <p>حالة الاعتماد: <b>{driver.approvalStatus==="approved"?"معتمد":driver.approvalStatus==="pending"?"قيد المراجعة":"غير معتمد"}</b></p>
          <p>حالة الاتصال: <b>{driver.availability==="online"?"متصل":driver.availability==="on_trip"?"في رحلة":"غير متصل"}</b></p>
          {driver.approvalStatus==="approved" && <button disabled={busy||driver.availability==="on_trip"} onClick={toggleAvailability}>{driver.availability==="online"?"إيقاف استقبال الرحلات":"بدء استقبال الرحلات"}</button>}
        </>}
      </>}
    </section>
    <section style={{marginTop:22}}><h2>عروض الرحلات</h2>{offers.length===0?<p>لا توجد عروض حالياً.</p>:offers.map(o=><article key={o.tripId} style={{background:"white",padding:18,borderRadius:14,marginBottom:12}}><b>{serviceNames[o.serviceType||""]||"طلب رحلة"}</b><p>السيارة: {o.vehicleType==="private"?"خاصة":"أجرة"} · التسعير: {o.pricingMode==="offer"?"عرض العميل":"سعر المنصة"} {o.offeredFare? "· "+o.offeredFare+" جنيه":""}</p><p>من: {o.pickupLabel||"الموقع على الخريطة"}</p><p>إلى: {o.destinationLabel||"الموقع على الخريطة"}</p><p>المدينة: {o.cityId||"—"} · المسافة التقريبية: {typeof o.distanceKm==="number"?o.distanceKm+" كم":"—"}</p><p>نقطة الانطلاق: {o.pickup?o.pickup.latitude.toFixed(4)+", "+o.pickup.longitude.toFixed(4):"—"}</p><p>الوجهة: {o.destination?o.destination.latitude.toFixed(4)+", "+o.destination.longitude.toFixed(4):"—"}</p><p>الحالة: {o.status==="accepted"?"مقبولة":o.status==="in_progress"?"قيد التنفيذ": "بانتظار الرد"}</p>{o.status==="pending"&&<button disabled={busy||driver?.approvalStatus!=="approved"||driver?.availability!=="online"} onClick={()=>accept(o.tripId)}>قبول الرحلة</button>}{o.status==="accepted"&&<button disabled={busy} onClick={()=>start(o.tripId)}>بدء الرحلة</button>}</article>)}</section>
    {notice&&<p role="status" style={{background:"#fff8e9",padding:12,borderRadius:10}}>{notice}</p>}
    <p style={{color:"#718096",fontSize:12,marginTop:24}}>تتطلب الوظائف المنشورة تفعيل Firebase App Check قبل التشغيل.</p>
  </main>;
}
