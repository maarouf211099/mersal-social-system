import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { addMonths } from "./months";
import { recvMissing } from "./recv";
import { isResolved, netReceived, stageOf, transferredAmount, type Kind, type Stage } from "./stage";

export const ENT_INCLUDE = {
  line: { include: { service: true, decision: { select: { id: true, no: true, status: true, text: true, issueDate: true } } } },
  case: { select: { code: true, name: true, phone: true, governorate: true, nationality: true, recvMethod: true, recvPhone: true, recvName: true, recvIdNo: true, residencyStatus: true, residencyExpiry: true, dataConfirmed: true } },
  transfer: true,
  refunds: { select: { amount: true, settlement: true } },
  attempts: { where: { kind: "follow", voided: false }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.EntitlementInclude;

type Raw = Prisma.EntitlementGetPayload<{ include: typeof ENT_INCLUDE }>;
export type Ent = Raw & {
  stage: Stage; kind: Kind; serviceName: string; amountN: number; transferred: number; refundTotal: number; received: number;
  unanswered: number; followDone: boolean; settled: boolean; missing: string[];
};

function enrich(e: Raw, prevResolved: boolean | null, followDays: number): Ent {
  const kind = e.line.service.kind as Kind;
  const amountN = Number(e.amount);
  const refundTotal = e.refunds.reduce((s, r) => s + Number(r.amount), 0);
  const unanswered = e.attempts.filter((a) => !a.answered).length;
  const transfer = e.transfer ? { amount: Number(e.transfer.amount), date: e.transfer.date } : null;
  const stage = stageOf({
    kind, needsFollow: e.line.service.needsFollow, amount: amountN, needsConfirm: e.needsConfirm, confirmedAt: e.confirmedAt,
    holdApprovedAt: e.holdApprovedAt, sentAt: e.sentAt, legacySent: e.legacySent, followResult: e.followResult,
    stuckReason: e.stuckReason, stoppedAt: e.stoppedAt, transfer, refundTotal, unanswered, prevResolved, followDays,
    missing: recvMissing(e.case).length > 0,
  });
  const transferred = transferredAmount({ transfer, legacySent: e.legacySent, kind, amount: amountN });
  return {
    ...e, stage, kind, serviceName: e.line.service.name, amountN, transferred, refundTotal,
    received: netReceived(stage, transferred, amountN, refundTotal), unanswered,
    followDone: e.followResult !== "none" || e.attempts.some((a) => a.answered) || unanswered >= 3,
    settled: !!e.settledHow, missing: recvMissing(e.case),
  };
}

/** يحمّل الاستحقاقات ويحسب مرحلة كل واحد (بما فيها التعليق على الشهر السابق) */
export async function loadEnts(where: Prisma.EntitlementWhereInput, followDays: number, orderBy: Prisma.EntitlementOrderByWithRelationInput[] = [{ caseCode: "asc" }]): Promise<Ent[]> {
  const rows = await prisma.entitlement.findMany({ where, include: ENT_INCLUDE, orderBy });
  if (!rows.length) return [];
  const prevKeys = rows.filter((r) => !r.sentAt && !r.holdApprovedAt).map((r) => ({ lineId: r.lineId, month: addMonths(r.month, -1) }));
  const prevMap = new Map<string, boolean>();
  if (prevKeys.length) {
    const byMonth = new Map<string, string[]>();
    prevKeys.forEach((k) => byMonth.set(k.month, [...(byMonth.get(k.month) ?? []), k.lineId]));
    const prev = await prisma.entitlement.findMany({ where: { OR: [...byMonth].map(([month, ids]) => ({ month, lineId: { in: ids } })) }, include: ENT_INCLUDE });
    for (const p of prev) {
      const pe = enrich(p, null, followDays);
      prevMap.set(`${p.lineId}|${p.month}`, isResolved(pe.stage, pe.settled));
    }
  }
  return rows.map((r) => enrich(r, prevMap.has(`${r.lineId}|${addMonths(r.month, -1)}`) ? prevMap.get(`${r.lineId}|${addMonths(r.month, -1)}`)! : null, followDays));
}

export async function loadEnt(id: string, followDays: number) {
  const r = await loadEnts({ id }, followDays);
  return r[0] ?? null;
}
