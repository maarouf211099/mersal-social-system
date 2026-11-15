import "server-only";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/** يسجل عملية في السجل الموحد باسم المنفذ ووقت التسجيل تلقائياً */
export async function logOp(tx: Tx, userId: string, type: string, o: {
  caseCode?: string | null; dept?: string; date?: Date; result?: string; notes?: string; count?: number; ref?: string; status?: "new" | "in_progress" | "done";
} = {}) {
  const t = await tx.opType.findUnique({ where: { name: type } });
  return tx.operation.create({
    data: {
      type, team: t?.team ?? "عام", weight: t?.weight ?? 1, caseCode: o.caseCode || null, dept: o.dept ?? "",
      date: o.date ?? new Date(), status: o.status ?? "done", result: o.result ?? "", notes: o.notes ?? "",
      count: o.count ?? 1, ref: o.ref ?? "", auto: true, userId,
    },
  });
}

export async function logAudit(tx: Tx, userId: string | null, action: string, target?: string | null, meta?: Record<string, unknown>) {
  return tx.auditLog.create({ data: { userId, action, target: target ?? null, meta: (meta ?? undefined) as any } });
}
