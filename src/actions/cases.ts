"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fail, run, str, type State } from "@/lib/action";
import { AUTO_OPS } from "@/lib/constants";
import { applyCaseChanges, readCaseFields } from "@/lib/case-changes";
import { logAudit, logOp } from "@/lib/ops";

export async function createCase(_p: State, f: FormData): Promise<State> {
  let code = "";
  const r = await run("case", async (u) => {
    code = str(f, "code");
    const data = await readCaseFields(f);
    if (!code) fail("اكتب كود الحالة.");
    if (!data.name) fail("اكتب اسم الحالة.");
    if (await prisma.case.findUnique({ where: { code } })) fail(`الكود ${code} مسجل من قبل. افتح ملف الحالة وعدّل بياناتها.`);
    await prisma.$transaction(async (tx) => {
      await tx.case.create({ data: { code, ...(data as any), createdById: u.id, updatedById: u.id } });
      await logAudit(tx, u.id, "case_created", code, { name: data.name });
    });
  });
  if (r?.ok) redirect(`/cases/${encodeURIComponent(code)}`);
  return r;
}

export async function updateCase(_p: State, f: FormData): Promise<State> {
  const code = str(f, "code");
  const r = await run("case", async (u) => {
    const data = await readCaseFields(f);
    if (!data.name) fail("اسم الحالة مطلوب.");
    const n = await prisma.$transaction(async (tx) => {
      const n = await applyCaseChanges(tx, code, data, u.id, "تعديل بيانات");
      if (n) {
        await logOp(tx, u.id, AUTO_OPS.caseUpdate, { caseCode: code, result: `${n} حقل` });
        await logAudit(tx, u.id, "case_updated", code, { fields: n });
      }
      return n;
    });
    return n ? `تم حفظ ${n} تعديل في سجل التعديلات.` : "لا توجد تعديلات.";
  });
  if (r?.ok) redirect(`/cases/${encodeURIComponent(code)}?saved=1`);
  return r;
}
