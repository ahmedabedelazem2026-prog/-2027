"use client";

import { useState } from "react";
import { signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseClient } from "@taxi-capital/firebase";

const services = [
  ["🚕", "داخل المدينة", "مشاويرك اليومية", "city"],
  ["🛣️", "بين المدن", "رحلات شمال سيناء والمحافظات", "intercity"],
  ["⭐", "مشوار خاص", "سيارة لمشوارك الخاص", "private"],
  ["🗓️", "حجز مسبق", "حدد موعد رحلتك", "scheduled"],
] as const;

export default function Home() {
  const [service, setService] = useState("city");
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [notice, setNotice] = useState("");
  const [account, setAccount] = useState<{ name: string; email: string } | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    try {
      const { auth, db, googleProvider } = getFirebaseClient();
      const result = await signInWithPopup(auth, googleProvider);
      const userRef = doc(db, "users", result.user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, { role: "customer", displayName: result.user.displayName ?? "", email: result.user.email ?? "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
      setAccount({ name: result.user.displayName ?? "عميل تاكسي العاصمة", email: result.user.email ?? "" });
      setNotice("تم تسجيل الدخول بنجاح. تفعيل الحجز الفعلي يتطلب إعداد خدمات الرحلات والموقع.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر تسجيل الدخول.";
      setNotice(message.includes("Firebase is not configured") ? "لم يتم إعداد بيانات مشروع Firebase للموقع بعد." : "تعذر تسجيل الدخول. تأكد من تفعيل Google Sign-in في Firebase وأن النطاق مسموح.");
    } finally {
      setAuthBusy(false);
    }
  };
  const handleSignOut = async () => {
    try { const { auth } = getFirebaseClient(); await signOut(auth); setAccount(null); setNotice("تم تسجيل الخروج."); }
    catch { setNotice("تعذر تسجيل الخروج حالياً."); }
  };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pickup.trim() || !destination.trim()) {
      setNotice("من فضلك اكتب مكان الانطلاق والوجهة.");
      return;
    }
    setNotice(account ? "تم التحقق من بيانات الرحلة. ربط الموقع الجغرافي وإرسال الطلب للسائقين هو الجزء التالي قبل تفعيل الحجز." : "سجل الدخول بحساب Google أولاً. إرسال الطلب الفعلي لم يُفعّل بعد.");
  };

  return <main className="shell">
    <nav><b className="logo">ت</b><strong>تاكسي العاصمة</strong><span>خدمتك تبدأ من هنا</span><div className="account">{account ? <><span>{account.name}</span><button type="button" onClick={handleSignOut}>خروج</button></> : <button type="button" onClick={handleGoogleSignIn} disabled={authBusy}>{authBusy ? "جارٍ الدخول..." : "الدخول بحساب Google"}</button>}</div></nav>
    <section className="hero">
      <div><small>مشوارك علينا</small><h1>مشوارك القادم<br/><i>أسهل معانا</i></h1>
        <p>اطلب رحلتك بسهولة، وسيصل طلبك إلى السائقين المتاحين بالقرب منك بعد تفعيل النظام.</p>
        <a href="#booking">اطلب رحلتك الآن ←</a>
        <label>العريش · الشيخ زويد · رفح · جميع مدن شمال سيناء</label>
      </div>
      <div className="visual"><div className="rings"></div><div className="car"><div className="window"></div><b>CAPITAL TAXI</b><div className="wheel left"></div><div className="wheel right"></div></div><span className="pin">⌖ رحلتك تبدأ من موقعك</span></div>
    </section>
    <section id="services"><small>خدماتنا</small><h2>اختار نوع رحلتك</h2>
      <div className="grid">{services.map(s=><button type="button" className={service===s[3]?"service selected":"service"} key={s[3]} onClick={()=>setService(s[3])}><em>{s[0]}</em><h3>{s[1]}</h3><p>{s[2]}</p></button>)}</div>
    </section>
    <section id="booking" className="booking"><div><small>حجز الرحلة</small><h2>إلى أين تذهب اليوم؟</h2><p>حدد نقطة الانطلاق والوجهة ونوع الخدمة.</p></div>
      <form onSubmit={submit}>
        <label>مكان الانطلاق<input value={pickup} onChange={e=>setPickup(e.target.value)} placeholder="مثال: شارع 23 يوليو - العريش" /></label>
        <label>الوجهة<input value={destination} onChange={e=>setDestination(e.target.value)} placeholder="اكتب المكان الذي تريد الوصول إليه" /></label>
        <button className="submit" type="submit">متابعة طلب الرحلة</button>
        {notice && <p className="notice" role="status">{notice}</p>}
        <small className="disclaimer">نسخة الواجهة قيد التطوير ولم يتم تفعيل إرسال الطلبات بعد.</small>
      </form>
    </section>
    <footer>© {new Date().getFullYear()} تاكسي العاصمة · جميع الحقوق محفوظة</footer>
  </main>;
}
