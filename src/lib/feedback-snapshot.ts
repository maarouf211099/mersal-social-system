// تصدير ردود تقييم النظام لملف JSON في فولدر مشترك على السيرفر — سيستم الحالات بيقرا ملفات الأنظمة السبعة
// ويعرضها في صفحة واحدة. من غير "server-only" عشان instrumentation (عند تشغيل السيرفر) يقدر يستخدمه.
//   الفولدر: FEEDBACK_SHARED_DIR، أو C:\ProgramData\mersal-feedback على Windows، أو <tmp>/mersal-feedback
//   الملف:   social.json — الكتابة على ملف .tmp وبعدين rename (عشان اللي بيقرا مايلاقيش ملف ناقص)
// أي فشل هنا بيتسجل تحذير بس — عمره ما يوقّف حفظ التقييم أو تشغيل النظام.
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { FEEDBACK_CAMPAIGN, FEEDBACK_SYSTEM, FEEDBACK_SYSTEM_NAME } from "./feedback.ts";

export type SnapshotRow = {
  createdAt: string; department: string; name: string | null;
  overall: number; ease: number | null; speed: number | null; value: number | null;
  problems: string; ideas: string;
};
export type Snapshot = { system: string; name: string; campaign: string; updatedAt: string; rows: SnapshotRow[] };

export function sharedDir(env: Record<string, string | undefined> = process.env, platform: NodeJS.Platform = process.platform): string {
  const v = (env.FEEDBACK_SHARED_DIR ?? "").trim();
  if (v) return v;
  return platform === "win32" ? "C:\\ProgramData\\mersal-feedback" : path.join(os.tmpdir(), "mersal-feedback");
}

/** نفس الحقول اللي GET /api/feedback بيرجعها — من غير أي معرّف للمستخدم */
export const SNAPSHOT_SELECT = {
  createdAt: true, department: true, name: true, overall: true, ease: true, speed: true, value: true, problems: true, ideas: true,
} as const;

export function buildSnapshot(rows: Array<Omit<SnapshotRow, "createdAt"> & { createdAt: Date | string }>, now = new Date()): Snapshot {
  return {
    system: FEEDBACK_SYSTEM, name: FEEDBACK_SYSTEM_NAME, campaign: FEEDBACK_CAMPAIGN, updatedAt: now.toISOString(),
    // صراحةً الحقول دي بس — حتى لو اتبعت صف فيه userId مايطلعش في الملف
    rows: rows.map((r) => ({
      createdAt: new Date(r.createdAt).toISOString(), department: r.department, name: r.name ?? null,
      overall: r.overall, ease: r.ease ?? null, speed: r.speed ?? null, value: r.value ?? null,
      problems: r.problems ?? "", ideas: r.ideas ?? "",
    })),
  };
}

/** كتابة ذرّية: <system>.json.tmp ← rename لـ <system>.json (مع إعادة محاولة لو الملف مفتوح للقراءة على Windows) */
export async function writeSnapshotFile(dir: string, snap: Snapshot): Promise<string> {
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${snap.system}.json`);
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(snap), "utf8");
  for (let i = 0; ; i++) {
    try { await rename(tmp, file); return file; } catch (e) {
      if (i >= 4) { await rm(tmp, { force: true }).catch(() => {}); throw e; }
      await new Promise((r) => setTimeout(r, 150 * (i + 1)));
    }
  }
}

// كتابة واحدة في نفس الوقت جوه العملية (طلبين في نفس اللحظة مايكتبوش على نفس الـ .tmp)
let chain: Promise<unknown> = Promise.resolve();

/** يقرا كل ردود الحملة من القاعدة ويكتب الملف. مابيرميش أخطاء أبداً */
export function exportFeedbackSnapshot(db: Pick<PrismaClient, "feedback">): Promise<void> {
  const job = chain.then(async () => {
    try {
      const rows = await db.feedback.findMany({ where: { campaign: FEEDBACK_CAMPAIGN }, orderBy: { createdAt: "desc" }, select: SNAPSHOT_SELECT });
      await writeSnapshotFile(sharedDir(), buildSnapshot(rows));
    } catch (e) {
      console.warn(`feedback snapshot: تعذّر تحديث ملف التقييم المشترك (${(e as Error)?.message ?? e})`);
    }
  });
  chain = job;
  return job;
}
