import "server-only";
import type { Prisma } from "@prisma/client";
import { str, dateOf } from "./action";
import { CASE_FIELDS } from "./constants";
import { isoDate } from "./format";

const TEXT_FIELDS = ["name", "gender", "nationality", "governorate", "address", "phone", "phone2", "unhcr", "recvMethod", "recvName", "recvPhone", "recvIdNo", "recvBranch", "notes"] as const;

/** يقرأ حقول الحالة من الفورم (الحقول غير الموجودة في الفورم لا تُلمس) */
export function readCaseFields(f: FormData) {
  const out: Record<string, string | number | Date | null> = {};
  for (const k of TEXT_FIELDS) if (f.has(k)) out[k] = str(f, k);
  if (f.has("birthDate")) out.birthDate = dateOf(str(f, "birthDate"));
  if (f.has("familySize")) { const n = Number(str(f, "familySize")); out.familySize = n > 0 ? Math.floor(n) : null; }
  return out;
}

const show = (v: unknown) => (v instanceof Date ? isoDate(v) : v == null ? "" : String(v));

/** يحدّث بيانات الحالة ويحفظ القيمة القديمة والجديدة لكل حقل اتغير */
export async function applyCaseChanges(tx: Prisma.TransactionClient, code: string, patch: Record<string, unknown>, userId: string, source: string) {
  const c = await tx.case.findUniqueOrThrow({ where: { code } });
  const diffs = Object.entries(patch)
    .filter(([k, v]) => show((c as any)[k]) !== show(v))
    .map(([k, v]) => ({ field: k, label: CASE_FIELDS.find((x) => x[0] === k)?.[1] ?? k, old: show((c as any)[k]), new: show(v) }));
  if (!diffs.length) return 0;
  await tx.case.update({ where: { code }, data: { ...(Object.fromEntries(diffs.map((d) => [d.field, patch[d.field]])) as any), updatedById: userId } });
  await tx.caseChange.create({ data: { caseCode: code, userId, source, diffs } });
  return diffs.length;
}

