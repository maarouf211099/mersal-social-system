import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import { ActionError } from "./auth";

// المرفقات تتحفظ على السيرفر في UPLOAD_DIR (خارج فولدر النسخة عشان ماتضيعش مع التحديث)
export const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", txt: "text/plain",
};
export const ACCEPT = Object.keys(ALLOWED).map((e) => `.${e}`).join(",");
export const uploadDir = () => path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));

/** يحفظ الملف ويرجع بيانات سجل المرفق (لو مفيش ملف يرجع null) */
export async function storeUpload(tx: Prisma.TransactionClient, file: FormDataEntryValue | null, link: { caseCode?: string | null; operationId?: string; entitlementId?: string; note?: string }, userId: string) {
  if (!(file instanceof File) || !file.size) return null;
  if (file.size > MAX_BYTES) throw new ActionError("حجم الملف أكبر من 10 ميجا.");
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED[ext]) throw new ActionError("نوع الملف غير مسموح. المسموح: PDF، صور، Word، Excel.");
  const storedName = `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.${ext}`;
  const dir = path.join(uploadDir(), storedName.slice(0, 4));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storedName), Buffer.from(await file.arrayBuffer()));
  return tx.attachment.create({ data: { name: file.name.slice(0, 200), mime: ALLOWED[ext], size: file.size, storedName, note: link.note ?? "", caseCode: link.caseCode || null, operationId: link.operationId, entitlementId: link.entitlementId, userId } });
}
export const storedPath = (storedName: string) => path.join(uploadDir(), storedName.slice(0, 4), storedName);
