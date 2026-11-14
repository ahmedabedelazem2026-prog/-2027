"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import {
  collection, doc, getDoc, limit, onSnapshot, query, serverTimestamp,
  setDoc, updateDoc, type DocumentData
} from "firebase/firestore";
import { getFirebaseClient } from "@taxi-capital/firebase";

type Row = DocumentData & { id: string };
type Tab = "overview" | "drivers" | "trips" | "customers" | "fares" | "finance";
const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "نظرة عامة", icon: "⌂" },
  { id: "drivers", label: "السائقون", icon: "♙" },
  { id: "trips", label: "الرحلات", icon: "⌁" },
  { id: "customers", label: "العملاء", icon: "◎" },
  { id: "fares", label: "التعريفة", icon: "ج" },
  { id: "finance", label: "الحسابات", icon: "↗" }
];
const money = (value: unknown) => typeof value === "number" ? value.toLocaleString("ar-EG", { maximumFractionDigits: 2 }) + " ج.م" : "—";
const dateLabel = (value: any) => value?.toDate ? value.toDate().toLocaleString("ar-EG") : "—";
const statusLabel: Record<string,string> = {
  pending: "قيد المراجعة", approved: "معتمد", rejected: "مرفوض",
  online: "متصل", offline: "غير متصل", on_trip: "في رحلة",
  searching: "جارٍ البحث", accepted: "مقبولة", in_progress: "جارية",
  completed: "مكتملة", cancelled: "ملغاة", no_driver: "لا يوجد سائق"
};

export default function Admin() {
  const [user, setUser] = useState<User | null>(null);
  const [access, setAccess] = useState<"loading" | "signed_out" | "denied" | "ready">("loading");
  const [tab, setTab] = useState<Tab>("overview");
  const [drivers, setDrivers] = useState<Row[]>([]);
  const [trips, setTrips] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [fares, setFares] = useState<Row[]>([]);
  const [ledger, setLedger] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [fareForm, setFareForm] = useState({ cityId: "alarish", serviceType: "city", baseFare: "15", perKm: "5", minimumFare: "25", commission: "10" });

  useEffect(() => {
    let stops: (() => void)[] = [];
    let alive = true;
    const client = getFirebaseClient();
    const stopAuth = onAuthStateChanged(client.auth, async (current) => {
      stops.forEach((stop) => stop());
      stops = [];
      if (!alive) return;
      setUser(current);
      setNotice("");
      if (!current) { setAccess("signed_out"); return; }
      setAccess("loading");
      try {
        const profile = await getDoc(doc(client.db, "users", current.uid));
        if (!alive) return;
        if (!profile.exists() || profile.data().role !== "admin") {
          setAccess("denied");
          return;
        }
        setAccess("ready");
        const sources: [string, (rows: Row[]) => void][] = [
          ["drivers", setDrivers], ["trips", setTrips], ["users", setCustomers],
          ["fareConfigs", setFares], ["financialLedger", setLedger]
        ];
        for (const [name, setter] of sources) {
          const stop = onSnapshot(query(collection(client.db, name), limit(100)),
            (snapshot) => setter(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
            () => setNotice("تعذر تحميل بعض بيانات الإدارة. راجع صلاحيات قاعدة البيانات."));
          stops.push(stop);
        }
      } catch {
        if (alive) { setAccess("denied"); setNotice("تعذر التحقق من صلاحية الإدارة."); }
      }
    });
    return () => { alive = false; stopAuth(); stops.forEach((stop) => stop()); };
  }, []);

  const filteredDrivers = useMemo(() => drivers.filter((d) => {
    const value = [d.name, d.fullName, d.phone, d.email, d.id].join(" ").toLowerCase();
    return value.includes(search.toLowerCase());
  }), [drivers, search]);
  const filteredTrips = useMemo(() => trips.filter((t) => {
    const value = [t.id, t.pickupLabel, t.destinationLabel, t.customerId, t.assignedDriverId].join(" ").toLowerCase();
    return value.includes(search.toLowerCase());
  }), [trips, search]);
  const activeTrips = trips.filter((t) => ["searching", "accepted", "in_progress"].includes(t.status)).length;
  const pendingDrivers = drivers.filter((d) => d.approvalStatus === "pending").length;
  const completedTrips = trips.filter((t) => t.status === "completed").length;
  const revenue = ledger.reduce((sum, item) => sum + (typeof item.commission === "number" ? item.commission : 0), 0);

  const approveDriver = async (driverId: string) => {
    setBusy(true); setNotice("");
    try {
      await updateDoc(doc(getFirebaseClient().db, "drivers", driverId), { approvalStatus: "approved", updatedAt: serverTimestamp() });
      setNotice("تم اعتماد السائق بنجاح.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "تعذر اعتماد السائق."); }
    finally { setBusy(false); }
  };

  const saveFare = async (event: FormEvent) => {
    event.preventDefault();
    const values = [fareForm.baseFare, fareForm.perKm, fareForm.minimumFare, fareForm.commission].map(Number);
    if (!fareForm.cityId.trim() || values.some((v) => !Number.isFinite(v) || v < 0) || values[3] > 100) {
      setNotice("راجع قيم التعريفة والعمولة؛ العمولة يجب أن تكون بين 0 و100%.");
      return;
    }
    setBusy(true); setNotice("");
    try {
      const [baseFare, perKm, minimumFare, commission] = values;
      const id = fareForm.cityId.trim() + "__" + fareForm.serviceType;
      await setDoc(doc(getFirebaseClient().db, "fareConfigs", id), {
        cityId: fareForm.cityId.trim(), serviceType: fareForm.serviceType,
        baseFare, perKm, minimumFare, commissionRate: commission / 100,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setNotice("تم حفظ التعريفة. ستُستخدم في احتساب الرحلات المكتملة.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "تعذر حفظ التعريفة."); }
    finally { setBusy(false); }
  };

  if (access === "loading") return <main className="gate" dir="rtl"><div className="gate-card"><div className="brand">ت</div><h1>مركز تحكم تاكسي العاصمة</h1><p>جارٍ التحقق من صلاحية الدخول…</p></div><Styles /></main>;
  if (access === "signed_out") return <main className="gate" dir="rtl"><div className="gate-card"><div className="brand">ت</div><small className="eyebrow">CAPITAL TAXI · CONTROL CENTER</small><h1>إدارة التشغيل من مكان واحد</h1><p>سجّل الدخول بحساب الإدارة المعتمد للوصول إلى بيانات المنصة.</p><button className="primary" onClick={async () => { setBusy(true); try { const c = getFirebaseClient(); await signInWithPopup(c.auth, c.googleProvider); } catch { setNotice("تعذر تسجيل الدخول بحساب Google."); } finally { setBusy(false); } }} disabled={busy}>{busy ? "جارٍ الدخول…" : "الدخول بحساب Google"}</button>{notice && <p className="notice">{notice}</p>}</div><Styles /></main>;
  if (access === "denied") return <main className="gate" dir="rtl"><div className="gate-card"><div className="brand">ت</div><h1>هذا الحساب غير مخوّل للإدارة</h1><p>يلزم أن يكون الحقل role في users/{user?.uid} مساويًا admin. لم يتم منح أي صلاحية تلقائيًا.</p><button className="secondary" onClick={() => signOut(getFirebaseClient().auth)}>تسجيل الخروج</button>{notice && <p className="notice">{notice}</p>}</div><Styles /></main>;

  return <main className="admin-shell" dir="rtl">
    <aside className="sidebar"><div className="side-brand"><div className="brand">ت</div><div><b>تاكسي العاصمة</b><small>لوحة التحكم المركزية</small></div></div><div className="side-caption">إدارة المنصة</div><nav>{tabs.map((item) => <button key={item.id} className={tab === item.id ? "nav-item active" : "nav-item"} onClick={() => { setTab(item.id); setSearch(""); }}><span>{item.icon}</span>{item.label}{item.id === "drivers" && pendingDrivers > 0 && <i>{pendingDrivers}</i>}</button>)}</nav><div className="side-bottom"><span className="online-dot"/> النظام متصل بقاعدة البيانات <button onClick={() => signOut(getFirebaseClient().auth)}>تسجيل الخروج</button></div></aside>
    <section className="workspace"><header className="topbar"><div><small>شمال سيناء · العريش</small><h1>{tabs.find((item) => item.id === tab)?.label}</h1></div><div className="profile"><div className="avatar">{(user?.displayName || "م").slice(0,1)}</div><div><b>{user?.displayName || "مدير النظام"}</b><small>{user?.email}</small></div></div></header>
      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}
      {tab === "overview" && <><div className="welcome"><div><small>لوحة قيادة التشغيل</small><h2>أهلاً بك في تاكسي العاصمة</h2><p>متابعة مباشرة لمؤشرات التشغيل والرحلات والسائقين.</p></div><div className="welcome-mark">CAPITAL<br/>TAXI</div></div><div className="stats"><Stat label="الرحلات النشطة" value={activeTrips} detail="بحث أو قبول أو تنفيذ" icon="⌁"/><Stat label="السائقون المعتمدون" value={drivers.filter((d) => d.approvalStatus === "approved").length} detail="حسابات جاهزة للتشغيل" icon="♙"/><Stat label="طلبات اعتماد السائقين" value={pendingDrivers} detail="تحتاج مراجعة الإدارة" icon="◎"/><Stat label="الرحلات المكتملة" value={completedTrips} detail="ضمن آخر 100 سجل" icon="✓"/></div><div className="content-grid"><section className="panel"><PanelTitle title="أحدث الرحلات" action="عرض الكل" onAction={() => setTab("trips")}/><div className="table-wrap"><table><thead><tr><th>رقم الرحلة</th><th>الحالة</th><th>الخدمة</th><th>التاريخ</th></tr></thead><tbody>{trips.slice(0,6).map((t) => <tr key={t.id}><td className="mono">{t.id.slice(0,9)}</td><td><Status value={t.status}/></td><td>{t.serviceType || "—"}</td><td>{dateLabel(t.createdAt)}</td></tr>)}{trips.length === 0 && <Empty cols={4}/>}</tbody></table></div></section><section className="panel"><PanelTitle title="طلبات السائقين" action="مراجعة الطلبات" onAction={() => setTab("drivers")}/>{drivers.filter((d) => d.approvalStatus === "pending").slice(0,5).map((d) => <div className="driver-mini" key={d.id}><div className="avatar">{(d.name || d.fullName || "س").slice(0,1)}</div><div className="grow"><b>{d.name || d.fullName || "سائق جديد"}</b><small>{d.phone || d.email || d.id}</small></div><button className="tiny-primary" disabled={busy} onClick={() => approveDriver(d.id)}>اعتماد</button></div>)}{pendingDrivers === 0 && <p className="muted">لا توجد طلبات اعتماد معلّقة.</p>}<div className="finance-highlight"><small>إجمالي العمولات المسجلة</small><b>{money(revenue)}</b><span>من سجلات دفتر الحسابات المتاحة</span></div></section></div></>}
      {tab === "drivers" && <section className="panel"><PanelTitle title="إدارة السائقين" subtitle={"إجمالي السجلات: " + drivers.length}/><Search value={search} onChange={setSearch} placeholder="ابحث بالاسم أو الهاتف أو البريد…"/><div className="table-wrap"><table><thead><tr><th>السائق</th><th>الهاتف</th><th>الاعتماد</th><th>الاتصال</th><th>المدينة</th><th>الإجراء</th></tr></thead><tbody>{filteredDrivers.map((d) => <tr key={d.id}><td><b>{d.name || d.fullName || "—"}</b><small className="subline">{d.id}</small></td><td>{d.phone || d.email || "—"}</td><td><Status value={d.approvalStatus}/></td><td><Status value={d.availability}/></td><td>{d.cityId || "—"}</td><td>{d.approvalStatus === "pending" ? <button className="tiny-primary" disabled={busy} onClick={() => approveDriver(d.id)}>اعتماد السائق</button> : "—"}</td></tr>)}{filteredDrivers.length === 0 && <Empty cols={6}/>}</tbody></table></div></section>}
      {tab === "trips" && <section className="panel"><PanelTitle title="متابعة الرحلات" subtitle={"السجلات المحمّلة: " + trips.length}/><Search value={search} onChange={setSearch} placeholder="ابحث برقم الرحلة أو العميل أو السائق…"/><div className="table-wrap"><table><thead><tr><th>الرحلة</th><th>الانطلاق</th><th>الوصول</th><th>الحالة</th><th>السعر</th><th>التاريخ</th></tr></thead><tbody>{filteredTrips.map((t) => <tr key={t.id}><td className="mono">{t.id.slice(0,10)}</td><td>{t.pickupLabel || "—"}</td><td>{t.destinationLabel || "—"}</td><td><Status value={t.status}/></td><td>{money(t.totalFare)}</td><td>{dateLabel(t.createdAt)}</td></tr>)}{filteredTrips.length === 0 && <Empty cols={6}/>}</tbody></table></div></section>}
      {tab === "customers" && <section className="panel"><PanelTitle title="العملاء" subtitle={"السجلات المحمّلة: " + customers.filter((c) => c.role !== "admin").length}/><Search value={search} onChange={setSearch} placeholder="ابحث بالاسم أو البريد أو رقم الحساب…"/><div className="table-wrap"><table><thead><tr><th>العميل</th><th>البريد</th><th>رقم الهاتف</th><th>تاريخ التسجيل</th></tr></thead><tbody>{customers.filter((c) => c.role !== "admin" && [c.name,c.fullName,c.email,c.phone,c.id].join(" ").toLowerCase().includes(search.toLowerCase())).map((c) => <tr key={c.id}><td><b>{c.name || c.fullName || "عميل"}</b><small className="subline">{c.id}</small></td><td>{c.email || "—"}</td><td>{c.phone || "—"}</td><td>{dateLabel(c.createdAt)}</td></tr>)}{customers.filter((c) => c.role !== "admin").length === 0 && <Empty cols={4}/>}</tbody></table></div></section>}
      {tab === "fares" && <div className="content-grid"><section className="panel"><PanelTitle title="إعداد تعريفة جديدة أو تعديلها" subtitle="التغييرات تحفظ في fareConfigs وتُقرأ عند إكمال الرحلة."/><form className="fare-form" onSubmit={saveFare}><label>المدينة / رمز التشغيل<input value={fareForm.cityId} onChange={(e) => setFareForm({...fareForm,cityId:e.target.value})} required/></label><label>نوع الخدمة<select value={fareForm.serviceType} onChange={(e) => setFareForm({...fareForm,serviceType:e.target.value})}><option value="city">داخل المدينة</option><option value="intercity">بين المدن</option><option value="private">مشوار خاص</option><option value="scheduled">حجز مسبق</option><option value="parcel">توصيل طرود</option></select></label><label>فتح العداد / السعر الأساسي<input type="number" min="0" step="0.01" value={fareForm.baseFare} onChange={(e) => setFareForm({...fareForm,baseFare:e.target.value})}/></label><label>سعر الكيلومتر<input type="number" min="0" step="0.01" value={fareForm.perKm} onChange={(e) => setFareForm({...fareForm,perKm:e.target.value})}/></label><label>الحد الأدنى للرحلة<input type="number" min="0" step="0.01" value={fareForm.minimumFare} onChange={(e) => setFareForm({...fareForm,minimumFare:e.target.value})}/></label><label>عمولة المنصة (%)<input type="number" min="0" max="100" step="0.1" value={fareForm.commission} onChange={(e) => setFareForm({...fareForm,commission:e.target.value})}/></label><button className="primary" disabled={busy}>{busy ? "جارٍ الحفظ…" : "حفظ التعريفة"}</button></form></section><section className="panel"><PanelTitle title="التعريفات الحالية"/>{fares.map((f) => <div className="fare-row" key={f.id}><div className="grow"><b>{f.cityId} · {f.serviceType}</b><small>أساسي {money(f.baseFare)} · الكيلومتر {money(f.perKm)}</small></div><b>{typeof f.commissionRate === "number" ? (f.commissionRate * 100) + "%" : "—"}</b></div>)}{fares.length === 0 && <p className="muted">لا توجد تعريفات مسجلة حتى الآن.</p>}</section></div>}
      {tab === "finance" && <section className="panel"><PanelTitle title="دفتر الحسابات" subtitle="سجلات مالية للقراءة فقط من لوحة الإدارة."/><div className="finance-summary"><div><small>إجمالي العمولات في السجلات المحمّلة</small><b>{money(revenue)}</b></div><div><small>عدد القيود</small><b>{ledger.length}</b></div></div><div className="table-wrap"><table><thead><tr><th>رقم الرحلة</th><th>السائق</th><th>قيمة الرحلة</th><th>العمولة</th><th>صافي السائق</th><th>الحالة</th></tr></thead><tbody>{ledger.map((item) => <tr key={item.id}><td className="mono">{String(item.tripId || item.id).slice(0,10)}</td><td className="mono">{item.driverId || "—"}</td><td>{money(item.totalFare)}</td><td>{money(item.commission)}</td><td>{money(item.driverNet)}</td><td><Status value={item.status}/></td></tr>)}{ledger.length === 0 && <Empty cols={6}/>}</tbody></table></div></section>}
      <footer className="footer">تاكسي العاصمة · لوحة الإدارة · البيانات المعروضة حتى آخر تحديث من Firebase</footer>
    </section><Styles />
  </main>;
}

function Stat({label,value,detail,icon}:{label:string;value:number;detail:string;icon:string}) { return <article className="stat"><div className="stat-icon">{icon}</div><small>{label}</small><strong>{value.toLocaleString("ar-EG")}</strong><span>{detail}</span></article>; }
function PanelTitle({title,subtitle,action,onAction}:{title:string;subtitle?:string;action?:string;onAction?:()=>void}) { return <div className="panel-title"><div><h3>{title}</h3>{subtitle && <small>{subtitle}</small>}</div>{action && <button className="text-button" onClick={onAction}>{action} ←</button>}</div>; }
function Search({value,onChange,placeholder}:{value:string;onChange:(value:string)=>void;placeholder:string}) { return <div className="search-box"><span>⌕</span><input value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder}/></div>; }
function Status({value}:{value?:string}) { const label=value ? statusLabel[value] || value : "—"; return <span className={"status " + (["approved","online","completed"].includes(value||"")?"good":["pending","searching","accepted","in_progress"].includes(value||"")?"warm":["rejected","cancelled","offline","no_driver"].includes(value||"")?"muted-status":"")}>{label}</span>; }
function Empty({cols}:{cols:number}) { return <tr><td colSpan={cols} className="empty">لا توجد بيانات لعرضها</td></tr>; }
function Styles() { return <style jsx global>{`
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');
*{box-sizing:border-box}body{margin:0;font-family:Cairo,Arial,sans-serif;background:#f3f5f8;color:#17283e}button,input,select{font:inherit}button{cursor:pointer}.gate{min-height:100vh;display:grid;place-items:center;padding:22px;background:radial-gradient(circle at 15% 10%,#193a61,#07172e 60%)}.gate-card{width:min(440px,100%);background:#fff;border-radius:24px;padding:38px;box-shadow:0 24px 80px #0004;text-align:center}.brand{width:54px;height:54px;border-radius:16px;background:#0a1d38;color:#dfbd7b;display:grid;place-items:center;font-size:30px;font-weight:900;margin-bottom:18px}.gate-card .brand{margin:0 auto 22px}.eyebrow{color:#ad8749;font-weight:900;letter-spacing:1px}.gate-card h1{font-size:25px;color:#0a1d38;margin:10px 0}.gate-card p{font-size:13px;line-height:2;color:#718096;margin:10px 0 22px}.primary,.secondary{border:0;border-radius:11px;padding:12px 18px;font-weight:800}.primary{background:#0a1d38;color:#fff}.secondary{background:#edf1f5;color:#273a52}.gate-card .primary{width:100%;margin-top:10px}.admin-shell{min-height:100vh;display:flex;background:#f3f5f8}.sidebar{width:250px;background:#091b34;color:#fff;display:flex;flex-direction:column;padding:24px 15px;flex-shrink:0}.side-brand{display:flex;align-items:center;gap:12px;padding:2px 8px 30px}.side-brand .brand{margin:0;width:44px;height:44px;background:#142b49;color:#e2c181}.side-brand b,.side-brand small{display:block}.side-brand b{font-size:14px}.side-brand small{font-size:10px;color:#9eacbf;margin-top:3px}.side-caption{font-size:10px;color:#8192a8;padding:0 12px 10px}.sidebar nav{display:grid;gap:5px}.nav-item{display:flex;align-items:center;gap:12px;border:0;background:transparent;color:#c2ccda;text-align:right;padding:12px;border-radius:10px;font-size:12px}.nav-item>span{font-size:18px;width:22px;text-align:center}.nav-item.active{background:#183452;color:#f0d49b}.nav-item i{font-style:normal;margin-right:auto;background:#c89e59;color:#101f34;border-radius:20px;padding:1px 7px;font-size:10px}.side-bottom{margin-top:auto;padding:18px 8px 0;border-top:1px solid #203550;color:#9cacc0;font-size:10px;line-height:2}.online-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#59c59a;margin-left:6px}.side-bottom button{display:block;border:0;background:transparent;color:#e0c182;padding:10px 0 0;font-size:11px}.workspace{min-width:0;flex:1;padding:28px 32px}.topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px}.topbar small{color:#a17d42;font-size:10px;font-weight:800}.topbar h1{font-size:24px;margin:3px 0;color:#10243f}.profile{display:flex;align-items:center;gap:10px}.profile b,.profile small{display:block}.profile b{font-size:11px}.profile small{font-size:9px;color:#8794a5}.avatar{width:36px;height:36px;border-radius:12px;background:#e9dfcc;color:#745a30;display:grid;place-items:center;font-weight:900}.welcome{background:linear-gradient(110deg,#0a1d38,#173a5c);border-radius:18px;padding:25px 28px;color:#fff;display:flex;justify-content:space-between;align-items:center;overflow:hidden}.welcome small{color:#e0c184;font-size:10px}.welcome h2{font-size:22px;margin:5px 0}.welcome p{font-size:11px;color:#b8c5d4;margin:0}.welcome-mark{font-size:22px;line-height:1.2;font-weight:900;letter-spacing:2px;color:#dfc184;opacity:.75;text-align:left}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;margin:17px 0}.stat,.panel{background:#fff;border:1px solid #e9edf2;border-radius:15px}.stat{padding:17px;display:grid;gap:5px}.stat-icon{width:32px;height:32px;border-radius:10px;background:#f6f0e5;color:#9b773e;display:grid;place-items:center;font-size:17px;margin-bottom:4px}.stat small{font-size:10px;color:#7c8999}.stat strong{font-size:25px;color:#10243f}.stat span{font-size:9px;color:#a0aab6}.content-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(280px,1fr);gap:15px}.panel{padding:20px;margin-bottom:16px;min-width:0}.panel-title{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:17px}.panel-title h3{font-size:14px;margin:0;color:#152943}.panel-title small{font-size:10px;color:#98a3b0}.text-button{border:0;background:transparent;color:#98733a;font-size:10px;font-weight:800}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;white-space:nowrap}th{text-align:right;font-size:9px;color:#96a1ae;background:#f8f9fb;padding:11px 10px;font-weight:700}td{padding:12px 10px;border-bottom:1px solid #f0f2f5;font-size:10px;color:#425269}td b{color:#1b2c42}.mono{font-family:monospace;font-size:9px}.subline{display:block;color:#a1aab5;font-size:8px;margin-top:3px}.status{display:inline-block;border-radius:20px;padding:4px 8px;background:#eef1f4;color:#68788b;font-size:9px}.status.good{background:#e8f6ef;color:#26815b}.status.warm{background:#fff4df;color:#a4772e}.status.muted-status{background:#f0f1f3;color:#858d98}.driver-mini{display:flex;align-items:center;gap:9px;padding:10px 0;border-bottom:1px solid #f0f2f5}.driver-mini .avatar{width:31px;height:31px}.grow{flex:1;min-width:0}.driver-mini b,.driver-mini small{display:block}.driver-mini b{font-size:10px}.driver-mini small{font-size:8px;color:#9aa5b2}.tiny-primary{border:0;background:#102744;color:#fff;border-radius:8px;padding:7px 10px;font-size:9px;font-weight:800}.finance-highlight{margin-top:17px;padding:15px;border-radius:12px;background:#f8f4ec;display:grid;gap:4px}.finance-highlight small,.finance-highlight span{font-size:9px;color:#8b7b60}.finance-highlight b{font-size:22px;color:#122743}.muted{color:#99a3af;font-size:11px}.search-box{display:flex;align-items:center;gap:8px;background:#f8fafc;border:1px solid #e8edf2;border-radius:10px;padding:0 12px;margin-bottom:15px}.search-box span{font-size:20px;color:#a48a5e}.search-box input{width:100%;border:0;outline:0;background:transparent;padding:11px 0;font-size:11px}.empty{text-align:center;color:#9ca7b4;padding:28px}.fare-form{display:grid;grid-template-columns:1fr 1fr;gap:13px}.fare-form label{display:grid;gap:6px;font-size:10px;color:#5e6e81;font-weight:700}.fare-form input,.fare-form select{width:100%;border:1px solid #e2e8ef;border-radius:9px;background:#fbfcfd;padding:10px;color:#243750;font-size:11px;outline:0}.fare-form button{grid-column:1/-1}.fare-row{display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid #eff1f4}.fare-row b{font-size:11px}.fare-row small{display:block;color:#8995a3;font-size:9px;margin-top:4px}.finance-summary{display:flex;gap:12px;margin-bottom:18px}.finance-summary>div{flex:1;background:#f7f8fa;padding:15px;border-radius:10px}.finance-summary small,.finance-summary b{display:block}.finance-summary small{font-size:9px;color:#8c98a7}.finance-summary b{font-size:19px;color:#122743;margin-top:5px}.notice{display:flex;justify-content:space-between;align-items:center;background:#fff7e8;color:#80612e;border:1px solid #f0dfbd;border-radius:10px;padding:10px 13px;margin-bottom:14px;font-size:10px}.notice button{border:0;background:transparent;color:inherit;font-size:18px}.footer{text-align:center;padding:22px;color:#a0aab6;font-size:9px}.gate-card .notice{display:block}
@media(max-width:1050px){.sidebar{width:215px}.workspace{padding:22px}.stats{grid-template-columns:repeat(2,1fr)}.content-grid{grid-template-columns:1fr}}
@media(max-width:700px){.admin-shell{display:block}.sidebar{width:100%;padding:12px}.side-brand{padding:0 6px 12px}.sidebar nav{display:flex;overflow:auto}.nav-item{white-space:nowrap;padding:9px}.side-caption,.side-bottom{display:none}.workspace{padding:16px}.topbar{align-items:flex-start}.profile small{max-width:120px;overflow:hidden;text-overflow:ellipsis}.welcome{padding:19px}.welcome-mark{font-size:16px}.stats{gap:8px}.stat{padding:12px}.stat strong{font-size:21px}.panel{padding:14px}.fare-form{grid-template-columns:1fr}.fare-form button{grid-column:auto}}
`}</style>; }
