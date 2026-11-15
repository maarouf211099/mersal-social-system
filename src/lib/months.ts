// الشهور بصيغة YYYY-MM — حسابات بدون مكتبات
export const MONTH_NAMES = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const pad = (n: number) => String(n).padStart(2, "0");

export const toIdx = (m: string) => { const [y, mo] = m.split("-").map(Number); return y * 12 + mo - 1; };
export const fromIdx = (i: number) => `${Math.floor(i / 12)}-${pad((i % 12) + 1)}`;
export const addMonths = (m: string, n: number) => fromIdx(toIdx(m) + n);
export const spanMonths = (s: string, e: string) => toIdx(e) - toIdx(s) + 1;
export const isMonth = (m: unknown): m is string => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
export function fmtMonth(m: string | null | undefined) {
  if (!m || !isMonth(m)) return "—";
  const [y, mo] = m.split("-");
  return `${MONTH_NAMES[Number(mo) - 1]} ${y}`;
}

/** التاريخ الحالي بتوقيت القاهرة */
export function todayISO(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export const currentMonth = (d = new Date()) => todayISO(d).slice(0, 7);
export const monthOfDate = (d: Date) => todayISO(d).slice(0, 7);

/** القرار الصادر من 19 إلى 18 يبدأ صرفه أول الشهر التالي لشهر القطع */
export function suggestStart(issueISO: string) {
  const [y, m, d] = issueISO.split("-").map(Number);
  return addMonths(`${y}-${pad(m)}`, d <= 18 ? 1 : 2);
}

/** بداية ونهاية الشهر كتواريخ (للفلترة بـ createdAt) */
export function monthRange(m: string): { gte: Date; lt: Date } {
  const [y, mo] = m.split("-").map(Number);
  return { gte: new Date(Date.UTC(y, mo - 1, 1) - 2 * 3600e3), lt: new Date(Date.UTC(y, mo, 1) - 2 * 3600e3) };
}

export function monthOptions(around: string, back = 24, fwd = 12) {
  const out: string[] = [];
  for (let i = -back; i <= fwd; i++) out.push(addMonths(around, i));
  return out.reverse();
}
