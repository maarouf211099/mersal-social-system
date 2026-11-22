import "server-only";
import { prisma } from "./prisma";
import { loadEnts, type Ent } from "./entitlements";
import { getSettings } from "./settings";
import { monthWithDeferred } from "./cycle-list";

export type DataRow = { code: string; name: string; phone: string; missing: string[]; stage: "missing" | "needconf"; ents: Ent[]; tries: number; lastTry: Date | null; assignee: string | null; taskId: string | null };

/** «استكمال البيانات»: حالات عندها استحقاق (الشهر أو مؤجل) وبيانات استلامها ناقصة أو محتاجة تأكيد */
export async function dataList(m: string): Promise<DataRow[]> {
  const st = await getSettings();
  const ents = (await loadEnts(monthWithDeferred(m), st.followDays)).filter((e) => e.stage === "missing" || e.stage === "needconf");
  const byCase = new Map<string, Ent[]>();
  ents.forEach((e) => byCase.set(e.caseCode, [...(byCase.get(e.caseCode) ?? []), e]));
  const codes = [...byCase.keys()];
  if (!codes.length) return [];
  const [attempts, tasks] = await Promise.all([
    prisma.contactAttempt.findMany({ where: { kind: "confirm", voided: false, entitlement: { caseCode: { in: codes } }, createdAt: { gte: new Date(Date.now() - 120 * 864e5) } }, select: { answered: true, createdAt: true, entitlement: { select: { caseCode: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.task.findMany({ where: { kind: "confirm", caseCode: { in: codes }, status: { in: ["new", "in_progress", "stuck"] } }, select: { id: true, caseCode: true, assigneeId: true } }),
  ]);
  return codes.map((code) => {
    const list = byCase.get(code)!;
    const e = list[0];
    let tries = 0, done = false, lastTry: Date | null = null;
    for (const a of attempts) {
      if (a.entitlement.caseCode !== code) continue;
      lastTry ??= a.createdAt;
      if (done) continue;
      if (a.answered) done = true; else tries++;
    }
    const t = tasks.find((x) => x.caseCode === code);
    return { code, name: e.case.name, phone: e.case.phone, missing: e.missing, stage: list.some((x) => x.stage === "missing") ? "missing" : "needconf", ents: list, tries, lastTry, assignee: t?.assigneeId ?? null, taskId: t?.id ?? null } as DataRow;
  }).sort((a, b) => a.code.localeCompare(b.code));
}
