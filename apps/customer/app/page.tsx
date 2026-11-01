"use client";

import { useState } from "react";

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
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pickup.trim() || !destination.trim()) {
      setNotice("من فضلك اكتب مكان الانطلاق والوجهة.");
      return;
    }
    setNotice("واجهة الحجز جاهزة. إرسال الطلب الفعلي سيتاح بعد ربط Firebase وتسجيل الدخول.");
  };

  return <main className="shell">
    <nav><b className="logo">ت</b><strong>تاكسي العاصمة</strong><span>خدمتك تبدأ من هنا</span></nav>
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
