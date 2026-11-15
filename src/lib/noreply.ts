import "server-only";
import { prisma } from "./prisma";

/** قرارات مستمرة آخر نتيجتين متابعة لنفس الخدمة فيها «لم يتم الرد» (عدم رد لشهرين متتاليين) */
export async function noReplyDecisionIds(): Promise<Set<string>> {
  const rows = await prisma.entitlement.findMany({
    where: { line: { decision: { status: "active" } }, followResult: { not: "none" } },
    select: { lineId: true, decisionId: true, followResult: true }, orderBy: { month: "desc" },
  });
  const byLine = new Map<string, typeof rows>();
  rows.forEach((e) => byLine.set(e.lineId, [...(byLine.get(e.lineId) ?? []), e]));
  return new Set([...byLine.values()].filter((l) => l.length >= 2 && l[0].followResult === "no_answer" && l[1].followResult === "no_answer").map((l) => l[0].decisionId));
}
