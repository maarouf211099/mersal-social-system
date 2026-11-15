import "server-only";
import { prisma } from "./prisma";

const FIELDS = [["phone", "الهاتف"], ["unhcr", "رقم المفوضية"], ["recvIdNo", "الرقم القومي"], ["recvPhone", "رقم الاستلام / المحفظة"]] as const;

/** حالات تانية عندها نفس الهاتف / المفوضية / الرقم القومي / المحفظة — تنبيه بس، مش منع */
export async function findDuplicates(code: string, c: Partial<Record<(typeof FIELDS)[number][0], string | null>>) {
  const out: { field: string; codes: string[] }[] = [];
  for (const [k, label] of FIELDS) {
    const v = String(c[k] ?? "").trim();
    if (v.length < 5) continue;
    const others = await prisma.case.findMany({ where: { code: { not: code }, [k]: v }, select: { code: true }, take: 5 });
    if (others.length) out.push({ field: label, codes: others.map((o) => o.code) });
  }
  return out;
}
export const dupText = (d: { field: string; codes: string[] }[]) => d.length ? ` تنبيه تكرار: ${d.map((x) => `${x.field} مسجل للحالة ${x.codes.join("، ")}`).join(" · ")}.` : "";
