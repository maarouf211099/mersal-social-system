import Link from "next/link";
import { logout } from "@/actions/auth";
import type { AppUser } from "@/lib/auth";
import { can } from "@/lib/perms";
import { ROLE_LABELS } from "@/lib/perms";
import { Icon, Logo } from "./icons";
import { Toaster } from "./forms";
import { Suspense } from "react";
import { NavProgress } from "./NavProgress";

type NavItem = { href: string; label: string; icon: (p: React.SVGProps<SVGSVGElement>) => React.JSX.Element; count?: number };

export function Shell({ user, current, counts, children }: { user: AppUser; current: string; counts: { my: number; late: number; renew: number; data?: number }; children: React.ReactNode }) {
  const initial = user.name.trim().charAt(0) || "م";
  const main: NavItem[] = [
    { href: "/", label: "لوحة المتابعة", icon: Icon.home },
    { href: "/my", label: "مهامي", icon: Icon.inbox, count: counts.my },
    { href: "/cases", label: "الحالات والقرارات", icon: Icon.folder },
    { href: "/data", label: "استكمال البيانات", icon: Icon.user, count: counts.data },
    { href: "/cycle", label: "دورة الصرف", icon: Icon.wallet },
    { href: "/follow", label: "المتابعة", icon: Icon.phone },
    { href: "/closing", label: "قائمة الغلق", icon: Icon.alert },
    { href: "/refunds", label: "الاستردادات", icon: Icon.undo },
    { href: "/renewal", label: "التجديد والانتهاء", icon: Icon.refresh, count: counts.renew },
    { href: "/tasks", label: "توزيع المهام", icon: Icon.tasks, count: counts.late },
    { href: "/ops", label: "العمليات", icon: Icon.activity },
    { href: "/reports", label: "التقارير", icon: Icon.chart },
  ];
  const admin: NavItem[] = [
    { href: "/audit", label: "سجل التدقيق", icon: Icon.list },
    ...(can(user.role, "admin") ? [
      { href: "/admin/users", label: "المستخدمون", icon: Icon.users },
      { href: "/admin/settings", label: "الإعدادات", icon: Icon.settings },
      { href: "/admin/import", label: "استيراد البيانات", icon: Icon.upload },
    ] : []),
  ];
  const under = (href: string) => current === href || current.startsWith(href + "/");
  const active = (href: string) => (href === "/" ? current === "/" : under(href) || (href === "/cases" && under("/decisions")));
  const link = (n: NavItem) => (
    <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}>
      <n.icon /> {n.label}{!!n.count && <span className="count">{n.count}</span>}
    </Link>
  );
  return (
    <div className="shell">
      <Suspense fallback={null}><NavProgress /></Suspense>
      <aside className="side" id="side">
        <Link href="/" className="logo" aria-label="الإدارة الاجتماعية"><Logo height={40} /></Link>
        <div className="sys-title">نظام الإدارة الاجتماعية</div>
        <nav aria-label="القائمة">
          {main.map(link)}
          {(user.role === "admin" || user.role === "supervisor") && <><div className="nav-label">الإدارة</div>{admin.map(link)}</>}
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
      <div style={{ minWidth: 0 }}>
        <div className="mobile-bar">
          <a href="#side" className="icon-btn" style={{ color: "var(--text)" }} aria-label="القائمة"><Icon.menu /></a>
          <Link href="/" aria-label="الإدارة الاجتماعية"><Logo height={34} /></Link>
          <span className="spacer" />
          <form action={logout}><button className="btn secondary small">خروج</button></form>
        </div>
        <main className="content">{children}</main>
        <Toaster />
      </div>
    </div>
  );
}
