import { PrismaClient } from "@prisma/client";
import { exportFeedbackSnapshot } from "./lib/feedback-snapshot";

/** عند تشغيل السيرفر: تصدير ردود تقييم النظام الموجودة للملف المشترك (سيستم الحالات بيقراه) */
export function onServerStart() {
  if (process.env.NEXT_PHASE === "phase-production-build" || !process.env.DATABASE_URL) return; // مش وقت البناء
  const db = new PrismaClient();
  // في الخلفية — مايأخرش تشغيل النظام، وأي فشل مجرد تحذير
  void exportFeedbackSnapshot(db).finally(() => db.$disconnect().catch(() => {}));
}
