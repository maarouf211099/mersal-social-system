"use server";

import { prisma } from "@/lib/prisma";
import { fail, run, str, type State } from "@/lib/action";
import { logAudit } from "@/lib/ops";
import { storeUpload } from "@/lib/files";

export async function uploadAttachment(_p: State, f: FormData): Promise<State> {
  return run("case", async (u) => {
    const caseCode = str(f, "caseCode") || null, entitlementId = str(f, "entitlementId") || undefined;
    if (!caseCode && !entitlementId) fail("المرفق لازم يتربط بحالة أو استحقاق.");
    const file = f.get("file");
    if (!(file instanceof File) || !file.size) fail("اختار الملف.");
    await prisma.$transaction(async (tx) => {
      const a = await storeUpload(tx, file, { caseCode, entitlementId, note: str(f, "note") }, u.id);
      await logAudit(tx, u.id, "attachment_added", caseCode, { name: a?.name, entitlementId });
    });
    return "تم رفع المرفق.";
  });
}
