import { currentMonth, isMonth, monthOptions, fmtMonth } from "./months";

export type SP = Promise<Record<string, string | string[] | undefined>>;
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
export function monthOf(sp: Record<string, string | string[] | undefined>) {
  const m = one(sp.m);
  return isMonth(m) ? m : currentMonth();
}
export const monthOpts = (m: string) => monthOptions(currentMonth(), 30, 14).concat(monthOptions(m, 0, 0)).filter((v, i, a) => a.indexOf(v) === i).map((v) => ({ v, l: fmtMonth(v) }));
export function qs(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
  const s = q.toString();
  return s ? `?${s}` : "";
}
