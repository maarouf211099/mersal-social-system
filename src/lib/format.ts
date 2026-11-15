// تنسيق الأرقام والتواريخ (توقيت القاهرة)
export const money = (n: number | string | { toString(): string } | null | undefined) =>
  Math.round(Number(n ?? 0)).toLocaleString("en-US");
const dtf = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", day: "numeric", month: "numeric", year: "numeric" });
const dtt = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
export const fmtDate = (d: Date | null | undefined) => (d ? dtf.format(d) : "—");
export const fmtTs = (d: Date | null | undefined) => (d ? dtt.format(d).replace(",", "") : "—");
export const isoDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
export const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
export function fmtDur(ms: number | null) {
  if (ms == null) return "—";
  const h = ms / 36e5;
  return h < 48 ? `${Math.round(h * 10) / 10} ساعة` : `${Math.round((h / 24) * 10) / 10} يوم`;
}
export const age = (d: Date | null | undefined) => (d ? Math.floor((Date.now() - d.getTime()) / (365.25 * 864e5)) : null);
