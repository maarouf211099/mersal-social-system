import Link from "next/link";
import { STAGES, type Stage } from "@/lib/stage";

export function Badge({ tone = "", children, plain }: { tone?: string; children: React.ReactNode; plain?: boolean }) {
  return <span className={`badge ${tone}${plain ? " plain" : ""}`}>{children}</span>;
}
export function StageBadge({ stage, kind }: { stage: Stage; kind?: string }) {
  const s = STAGES[stage];
  const label = stage === "recv" && kind === "in_kind" ? "تم الاستلام" : stage === "deliv" && kind === "service" ? "تم التنفيذ" : s.label;
  return <Badge tone={s.tone}>{label}</Badge>;
}
export function Kpi({ v, l, tone = "", s, href, sTone }: { v: React.ReactNode; l: string; tone?: string; s?: React.ReactNode; href?: string; sTone?: string }) {
  const body = <><div className="v">{v}</div><div className="l">{l}</div>{s != null && <div className={`s ${sTone ?? ""}`}>{s}</div>}</>;
  return <div className={`kpi ${tone}`}>{href ? <Link href={href}>{body}</Link> : body}</div>;
}
export function PageHead({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div><h1>{title}</h1>{sub && <div className="sub">{sub}</div>}</div>
      <span className="spacer" />
      {children}
    </div>
  );
}
export function Table({ heads, children, empty, flat }: { heads: React.ReactNode[]; children: React.ReactNode; empty?: string; flat?: boolean }) {
  const has = Array.isArray(children) ? children.length > 0 : !!children;
  if (!has) return <div className="empty">{empty ?? "لا توجد بيانات"}</div>;
  return (
    <div className={`table-wrap${flat ? " flat" : ""}`}>
      <table><thead><tr>{heads.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table>
    </div>
  );
}
export function Seg({ items, current }: { items: { href: string; label: string; key: string }[]; current: string }) {
  return <div className="seg">{items.map((i) => <Link key={i.key} href={i.href} aria-current={i.key === current ? "page" : undefined}>{i.label}</Link>)}</div>;
}
export const CaseLink = ({ code, name }: { code: string; name?: string }) => (
  <Link href={`/cases/${encodeURIComponent(code)}`} className="strong"><span className="num">{code}</span>{name && <span className="cell-sub">{name}</span>}</Link>
);
export function Trend({ months, values, fmt }: { months: { m: string; label: string }[]; values: number[]; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="trend">
      {months.map((m, i) => (
        <div key={m.m} className={i === months.length - 1 ? "cur" : ""}>
          <b>{fmt ? fmt(values[i]) : values[i]}</b><i style={{ height: `${Math.round((values[i] / max) * 80)}%` }} /><span>{m.label}</span>
        </div>
      ))}
    </div>
  );
}
