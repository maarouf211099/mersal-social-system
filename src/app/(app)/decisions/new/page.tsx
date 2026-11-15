import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/perms";
import { one, type SP } from "@/lib/page";
import { PageHead } from "@/components/ui";
import { DecisionForm } from "@/components/DecisionForm";

export default async function NewDecisionPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePageUser({ perm: "decision" });
  const sp = await searchParams;
  const renewId = one(sp.renew);
  const [services, cases, lines] = await Promise.all([
    prisma.service.findMany({ where: { isActive: true }, orderBy: { sort: "asc" } }),
    prisma.case.findMany({ select: { code: true, name: true }, orderBy: { code: "asc" } }),
    prisma.decisionLine.findMany({ where: { decision: { status: "active" } }, select: { caseCode: true, serviceId: true, startMonth: true, endMonth: true, decision: { select: { no: true } } } }),
  ]);
  const running = new Map<string, { serviceId: string; start: string; end: string; no: string }[]>();
  lines.forEach((l) => running.set(l.caseCode, [...(running.get(l.caseCode) ?? []), { serviceId: l.serviceId, start: l.startMonth, end: l.endMonth, no: l.decision.no }]));
  let init: Parameters<typeof DecisionForm>[0]["init"] = { code: one(sp.code) };
  if (renewId) {
    const d = await prisma.decision.findUnique({ where: { id: renewId }, include: { lines: true } });
    if (d) init = { code: d.caseCode, renewOf: d.id, donor: d.donor, text: d.text, startAfter: d.lines.reduce((m, l) => (l.endMonth > m ? l.endMonth : m), ""), lines: d.lines.map((l) => ({ svc: l.serviceId, amount: String(l.amount), months: l.months })) };
  }
  return (
    <>
      <PageHead title={renewId ? "تجديد قرار" : "قرار جديد"} sub="إذا كان الكود جديداً تُسجَّل الحالة تلقائياً بالاسم، وتُستكمل باقي بياناتها لاحقاً من ملف الحالة." />
      <div className="card">
        <DecisionForm services={services.map((s) => ({ id: s.id, name: s.name, kind: s.kind, cycle: s.cycle }))}
          cases={cases.map((c) => ({ ...c, running: running.get(c.code) ?? [] }))} init={init} canOverride={can(u.role, "decision.override")} />
      </div>
    </>
  );
}
