"use client";

import { useMemo, useState } from "react";

type NavItem = { id: string; icon: string; label: string; count?: string };\n\nconst navigation: { group: string; items: NavItem[] }[] = [
  { group: "الرئيسية", items: [{ id: "overview", icon: "▦", label: "نظرة عامة" }] },
  { group: "إدارة التشغيل", items: [
    { id: "trips", icon: "↗", label: "إدارة الرحلات", count: "12" },
    { id: "drivers", icon: "◉", label: "السائقون" },
    { id: "customers", icon: "♙", label: "العملاء" },
    { id: "map", icon: "⌖", label: "الخريطة المباشرة" }
  ]},
  { group: "الإدارة المالية", items: [
    { id: "finance", icon: "◈", label: "المالية والمدفوعات" },
    { id: "pricing", icon: "٪", label: "التسعير والعمولات" }
  ]},
  { group: "إدارة المنصة", items: [
    { id: "reports", icon: "▤", label: "التقارير والتحليلات" },
    { id: "support", icon: "✉", label: "الشكاوى والدعم" },
    { id: "settings", icon: "⚙", label: "إعدادات النظام" }
  ]}
];

const trips = [
  { id: "CT-2048", customer: "محمد إبراهيم", driver: "أحمد السيد", route: "وسط البلد ← المساعيد", service: "داخل المدينة", fare: "٤٦ ج.م", status: "مكتملة", tone: "done", time: "10:42 ص" },
  { id: "CT-2047", customer: "سارة محمود", driver: "محمود علي", route: "الريسة ← الجامعة", service: "داخل المدينة", fare: "٥٥ ج.م", status: "جاري البحث", tone: "search", time: "10:36 ص" },
  { id: "CT-2046", customer: "عمر حسن", driver: "—", route: "المساعيد ← ضاحية السلام", service: "داخل المدينة", fare: "٣٨ ج.م", status: "ملغاة", tone: "cancel", time: "10:18 ص" },
  { id: "CT-2045", customer: "منى خالد", driver: "إبراهيم عادل", route: "العريش ← الشيخ زويد", service: "بين المدن", fare: "٢٨٠ ج.م", status: "مكتملة", tone: "done", time: "09:54 ص" }
];

const stats = [
  { label: "الرحلات النشطة", value: "١٢", icon: "↗", color: "gold", foot: "٤ رحلات في مرحلة البحث" },
  { label: "السائقون المعتمدون", value: "٨٤", icon: "◉", color: "blue", foot: "٢٦ سائقًا متصلًا الآن" },
  { label: "طلبات اليوم", value: "١٢٨", icon: "♙", color: "green", foot: "زيادة ١٢٪ عن أمس" },
  { label: "إيرادات اليوم", value: "٦٬٤٨٠", icon: "◈", color: "purple", foot: "جنيه مصري · قيمة توضيحية" }
];

function Dashboard() {
  const [active, setActive] = useState("overview");
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState("");
  const filteredTrips = useMemo(() => trips.filter((trip) =>
    [trip.id, trip.customer, trip.driver, trip.route].join(" ").toLowerCase().includes(query.toLowerCase())
  ), [query]);

  const activeLabel = navigation.flatMap((group) => group.items).find((item) => item.id === active)?.label || "نظرة عامة";
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  return (
    <div className="admin-shell" dir="rtl">
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">ت</div>
          <div><div className="brand-name">تاكسي العاصمة</div><div className="brand-sub">CAPITAL TAXI · ADMIN</div></div>
        </div>
        {navigation.map((group) => (
          <div key={group.group}>
            <div className="nav-label">{group.group}</div>
            <div className="nav-list">
              {group.items.map((item) => (
                <button key={item.id} className={`nav-item ${active === item.id ? "active" : ""}`}
                  onClick={() => { setActive(item.id); setMobileOpen(false); }}>
                  <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
                  {item.count && <span style={{ marginRight: "auto", fontSize: 9, color: "#e5c987" }}>{item.count}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="sidebar-bottom">
          <div className="support-card">
            <strong>مركز المساعدة</strong>
            <p>هل تحتاج إلى مساعدة في إدارة المنصة؟ فريق الدعم جاهز لمساعدتك.</p>
            <button onClick={() => { setActive("support"); notify("تم فتح قسم الشكاوى والدعم"); }}>التواصل مع الدعم</button>
          </div>
          <div style={{ color: "#70869d", fontSize: 9, textAlign: "center" }}>CAPITAL TAXI · VERSION 1.0</div>
        </div>
      </aside>

      <main className="admin-main">
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <button className="icon-button mobile-menu" aria-label="فتح القائمة" onClick={() => setMobileOpen(!mobileOpen)}>☰</button>
            <div><div className="crumb">لوحة التحكم / {activeLabel}</div><h1 className="page-title">{activeLabel}</h1></div>
          </div>
          <div className="top-actions">
            <button className="icon-button" aria-label="الإشعارات" onClick={() => notify("لا توجد إشعارات جديدة")}>♧<i className="notification-dot" /></button>
            <div className="profile"><div className="avatar">م</div><div><strong>مدير النظام</strong><small>صلاحية الإدارة</small></div><span style={{ color: "#8794a5", fontSize: 11 }}>⌄</span></div>
          </div>
        </header>

        {active === "overview" ? (
          <>
            <section className="welcome">
              <div className="welcome-copy"><div className="welcome-kicker">CAPITAL TAXI · CONTROL CENTER</div><h2>مرحبًا بك في مركز إدارة تاكسي العاصمة</h2><p>تابع عمليات التشغيل وأداء المنصة من مكان واحد.</p></div>
              <div className="welcome-date">◷ &nbsp; السبت، ١٤ نوفمبر ٢٠٢٦</div>
            </section>
            <div className="demo-note">ⓘ هذه واجهة عرض أولية ببيانات تجريبية للتصميم فقط؛ لم يتم ربطها بقاعدة بيانات الإنتاج أو عرض أرقام تشغيل حقيقية.</div>

            <div className="section-head"><h3>ملخص التشغيل</h3><span>نظرة عامة على مؤشرات المنصة</span></div>
            <section className="stats-grid">
              {stats.map((stat) => <article className="stat-card" key={stat.label}>
                <div className="stat-top"><span className={`stat-icon ${stat.color}`}>{stat.icon}</span><span style={{ color: "#a5afbb", fontSize: 10 }}>•••</span></div>
                <div className="stat-label">{stat.label}</div><div className="stat-value">{stat.value}</div><div className="stat-foot">{stat.foot}</div>
              </article>)}
            </section>

            <section className="content-grid">
              <article className="panel">
                <div className="panel-title"><h3>حركة الرحلات خلال الأسبوع</h3><div className="chart-legend"><span><i className="legend-dot" /> هذا الأسبوع</span><span><i className="legend-dot blue" /> الأسبوع السابق</span></div></div>
                <div className="chart">
                  {[42,58,48,76,62,88,70].map((height, i) => <div className="chart-group" key={i}><div className="bar" style={{ height: `${height}%` }} /><div className="bar alt" style={{ height: `${Math.max(20,height-22)}%` }} /></div>)}
                </div>
                <div className="chart-labels"><span>السبت</span><span>الأحد</span><span>الاثنين</span><span>الثلاثاء</span><span>الأربعاء</span><span>الخميس</span><span>الجمعة</span></div>
              </article>
              <article className="panel">
                <div className="panel-title"><h3>آخر النشاطات</h3><button onClick={() => setActive("trips")}>عرض الكل ←</button></div>
                <div className="activity-list">
                  <div className="activity"><span className="activity-icon">✓</span><div><strong>اكتمال رحلة CT-2048</strong><p>تم إنهاء الرحلة بنجاح</p></div><time>10:42</time></div>
                  <div className="activity"><span className="activity-icon">♙</span><div><strong>طلب انضمام سائق جديد</strong><p>طلب بانتظار المراجعة</p></div><time>10:31</time></div>
                  <div className="activity"><span className="activity-icon">↗</span><div><strong>طلب رحلة جديد</strong><p>من الريسة إلى الجامعة</p></div><time>10:18</time></div>
                  <div className="activity"><span className="activity-icon">◈</span><div><strong>تحديث ملخص الإيرادات</strong><p>بيانات تجريبية للعرض</p></div><time>09:50</time></div>
                </div>
              </article>
            </section>

            <section className="panel table-panel">
              <div className="panel-title"><h3>أحدث الرحلات</h3><button onClick={() => setActive("trips")}>الانتقال إلى الرحلات ←</button></div>
              <div className="table-wrap"><table><thead><tr><th>رقم الرحلة</th><th>العميل</th><th>السائق</th><th>المسار</th><th>الأجرة</th><th>الحالة</th><th>الوقت</th></tr></thead>
                <tbody>{trips.slice(0,3).map((trip) => <tr key={trip.id}><td>{trip.id}</td><td><div className="person"><span className="person-avatar">ع</span><strong>{trip.customer}</strong></div></td><td>{trip.driver}</td><td>{trip.route}</td><td>{trip.fare}</td><td><span className={`status ${trip.tone}`}>{trip.status}</span></td><td>{trip.time}</td></tr>)}</tbody>
              </table></div>
            </section>

            <div className="section-head"><h3>الوصول السريع</h3><span>اختصارات لأقسام الإدارة</span></div>
            <section className="quick-grid">
              {[["↗","متابعة الرحلات","trips"],["◉","إدارة السائقين","drivers"],["◈","المالية","finance"],["⚙","إعدادات المنصة","settings"]].map(([icon,label,id]) => <button className="quick-action" key={id} onClick={() => setActive(id)}><span>{icon}</span><strong>{label}</strong></button>)}
            </section>
          </>
        ) : active === "trips" ? (
          <section className="panel">
            <div className="panel-title"><div><h3>سجل الرحلات</h3><span style={{ color: "#8b98a7", fontSize: 10 }}>عرض تجريبي غير متصل بقاعدة البيانات</span></div><input className="search-box" placeholder="ابحث برقم الرحلة أو الاسم أو المسار..." value={query} onChange={(e) => setQuery(e.target.value)} /></div>
            <div className="table-wrap"><table><thead><tr><th>رقم الرحلة</th><th>العميل</th><th>السائق</th><th>المسار</th><th>الخدمة</th><th>الأجرة</th><th>الحالة</th><th>الوقت</th></tr></thead><tbody>
              {filteredTrips.map((trip) => <tr key={trip.id}><td>{trip.id}</td><td>{trip.customer}</td><td>{trip.driver}</td><td>{trip.route}</td><td>{trip.service}</td><td>{trip.fare}</td><td><span className={`status ${trip.tone}`}>{trip.status}</span></td><td>{trip.time}</td></tr>)}
            </tbody></table>{filteredTrips.length === 0 && <div className="empty-state"><b>لا توجد نتائج مطابقة</b>جرّب البحث بكلمة أخرى.</div>}</div>
          </section>
        ) : (
          <section className="panel">
            <div className="empty-state"><div style={{ fontSize: 35, marginBottom: 12 }}>{navigation.flatMap((group) => group.items).find((item) => item.id === active)?.icon}</div><b>{activeLabel}</b>تم تجهيز مكان هذا القسم ضمن هيكل لوحة الإدارة. سيتم تفعيله وربطه بالبيانات والصلاحيات بعد استكمال واجهات الخادم الآمنة.</div>
            <div className="demo-note">هذا القسم غير متصل ببيانات حقيقية، ولا ينفذ أي تغييرات على حسابات العملاء أو السائقين أو الرحلات.</div>
          </section>
        )}
        <footer style={{ textAlign: "center", color: "#9aa5b2", fontSize: 9, padding: "25px 0 0" }}>© 2026 تاكسي العاصمة · جميع الحقوق محفوظة</footer>
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

export default function AdminPage() {
  return <Dashboard />;
}
