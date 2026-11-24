import Link from "next/link";
import { logout } from "@/actions/auth";
import type { AppUser } from "@/lib/auth";
import { can } from "@/lib/perms";
import { ROLE_LABELS } from "@/lib/perms";
import { Icon, Logo } from "./icons";
import { Toaster } from "./forms";
import { Suspense } from "react";
import { NavProgress } from "./NavProgress";
import { SearchKey } from "./SearchKey";
import { GuideModal } from "./GuideModal";

type NavItem = { href: string; label: string; icon: (p: React.SVGProps<SVGSVGElement>) => React.JSX.Element; count?: number };

export function Shell({ user, current, counts, children }: { user: AppUser; current: string; counts: { my: number; late: number; renew: number; data?: number }; children: React.ReactNode }) {
  const initial = user.name.trim().charAt(0) || "م";
  const groups: { label?: string; items: NavItem[] }[] = [
    { items: [
      { href: "/", label: "لوحة المتابعة", icon: Icon.home },
      { href: "/my", label: "مهامي", icon: Icon.inbox, count: counts.my },
    ] },
    { label: "الحالات والصرف", items: [
      { href: "/cases", label: "الحالات والقرارات", icon: Icon.folder },
      { href: "/data", label: "استكمال البيانات", icon: Icon.user, count: counts.data },
      { href: "/cycle", label: "دورة الصرف", icon: Icon.wallet },
      { href: "/follow", label: "المتابعة", icon: Icon.phone },
      { href: "/closing", label: "قائمة الغلق", icon: Icon.alert },
      { href: "/refunds", label: "الاستردادات", icon: Icon.undo },
      { href: "/renewal", label: "التجديد والانتهاء", icon: Icon.refresh, count: counts.renew },
    ] },
    { label: "الفريق والتقارير", items: [
      { href: "/tasks", label: "توزيع المهام", icon: Icon.tasks, count: counts.late },
      { href: "/ops", label: "العمليات", icon: Icon.activity },
      { href: "/reports", label: "التقارير", icon: Icon.chart },
    ] },
    ...(user.role === "admin" || user.role === "supervisor" ? [{ label: "الإدارة", items: [
      { href: "/audit", label: "سجل التدقيق", icon: Icon.list },
      ...(can(user.role, "admin") ? [
        { href: "/admin/users", label: "المستخدمون", icon: Icon.users },
        { href: "/admin/settings", label: "الإعدادات", icon: Icon.settings },
        { href: "/admin/import", label: "استيراد البيانات", icon: Icon.upload },
      ] : []),
    ] }] : []),
  ];
  const under = (href: string) => current === href || current.startsWith(href + "/");
  const active = (href: string) => (href === "/" ? current === "/" : under(href) || (href === "/cases" && under("/decisions")));
  const link = (n: NavItem) => (
    <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}>
      <n.icon /> {n.label}{!!n.count && <span className="count">{n.count}</span>}
    </Link>
  );
  const today = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { timeZone: "Africa/Cairo", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  return (
    <div className="shell">
      <Suspense fallback={null}><NavProgress /></Suspense>
      <aside className="side" id="side">
        <a href="#" className="icon-btn side-close" aria-label="إغلاق القائمة"><Icon.x /></a>
        <Link href="/" className="logo" aria-label="الإدارة الاجتماعية"><Logo height={42} /></Link>
        <div className="sys-title">نظام الإدارة الاجتماعية</div>
        <nav aria-label="القائمة">
          {groups.map((g, i) => <div key={i} style={{ display: "contents" }}>{g.label && <div className="nav-label">{g.label}</div>}{g.items.map(link)}{i === 0 && <GuideModal />}</div>)}
        </nav>
        <div className="side-foot">
          <div className="me">
            <div className="avatar" aria-hidden>{initial}</div>
            <div style={{ minWidth: 0 }}>
              <Link href="/account" className="n">{user.name}</Link>
              <div className="e">{ROLE_LABELS[user.role]}</div>
            </div>
            <form action={logout}><button className="icon-btn" title="خروج" aria-label="خروج"><Icon.logout /></button></form>
          </div>
        </div>
      </aside>
      <a href="#" className="scrim" aria-label="إغلاق القائمة" tabIndex={-1} />
      <div className="main">
        <header className="topbar">
          <a href="#side" className="icon-btn menu-btn" aria-label="القائمة"><Icon.menu /></a>
          <Link href="/" className="mobile-logo" aria-label="الإدارة الاجتماعية"><Logo height={32} /></Link>
          <form action="/cases" className="qsearch" role="search">
            <Icon.search />
            <input type="search" name="q" placeholder="ابحث بالكود أو الاسم أو الهاتف أو رقم القرار…" aria-label="بحث سريع" />
            <kbd>/</kbd>
          </form>
          <SearchKey />
          <span className="spacer" />
          <span className="today"><Icon.calendar />{today}</span>
          <Link href="/my" className="icon-btn bell" title={`مهامي المفتوحة: ${counts.my}`} aria-label={`مهامي المفتوحة: ${counts.my}`}><Icon.bell />{counts.my > 0 && <span className="dot">{counts.my > 99 ? "99+" : counts.my}</span>}</Link>
          {can(user.role, "decision") && <Link className="btn primary small" href="/decisions/new" title="تسجيل كود وقرار" aria-label="تسجيل كود وقرار"><Icon.plus /> <span className="lbl">تسجيل كود وقرار</span></Link>}
        </header>
        <main className="content">{children}</main>
        <Toaster />
      </div>
    </div>
  );
}
