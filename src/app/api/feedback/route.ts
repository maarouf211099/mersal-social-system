import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { FEEDBACK_CAMPAIGN, parseFeedback } from "@/lib/feedback";
import { isFeedbackViewer } from "@/lib/feedback-access";
import { exportFeedbackSnapshot, SNAPSHOT_SELECT } from "@/lib/feedback-snapshot";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const err = (error: string, status: number) => NextResponse.json({ error }, { status, headers: NO_STORE });
const SESSION_ENDED = "انتهت الجلسة. سجّل الدخول مرة أخرى.";

/** تسجيل تقييم المستخدم الحالي — رد واحد لكل مستخدم في الحملة (لو بعت تاني بيتحدّث) */
export async function POST(req: NextRequest) {
  const u = await auth();
  if (!u || u.mustChangePassword) return err(SESSION_ENDED, 401);
  // JSON بس — فورم من موقع تاني ماينفعش يبعت الطلب ده
  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) return err("طريقة الإرسال مش مظبوطة.", 415);
  let body: unknown;
  try { body = await req.json(); } catch { return err("بيانات التقييم مش مظبوطة.", 400); }
  const p = parseFeedback(body);
  if (!p.ok) return err(p.error, 400);

  const where = { campaign_userId: { campaign: FEEDBACK_CAMPAIGN, userId: u.id } };
  try {
    try {
      await prisma.feedback.upsert({ where, create: { campaign: FEEDBACK_CAMPAIGN, userId: u.id, ...p.data }, update: p.data });
    } catch (e) {
      // طلبين في نفس اللحظة: التاني يلاقي الصف اتعمل — نحدّثه
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      await prisma.feedback.update({ where, data: p.data });
    }
  } catch (e) {
    console.error("feedback save failed", e);
    return err("حصلت مشكلة في حفظ التقييم، جرّب تاني.", 500);
  }
  await audit(u.id, "feedback_submitted", FEEDBACK_CAMPAIGN);
  // تحديث الملف المشترك لصفحة النتائج المجمعة في سيستم الحالات — أي فشل بيتسجل تحذير بس
  await exportFeedbackSnapshot(prisma);
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

/** كل الردود — للمدير (admin) والشخص المحدد في FEEDBACK_RESULTS_USER. من غير أي معرّف للمستخدم */
export async function GET() {
  const u = await auth();
  if (!u || u.mustChangePassword) return err(SESSION_ENDED, 401);
  if (!isFeedbackViewer(u)) return err("نتائج التقييم متاحة للمدير بس.", 403);
  const rows = await prisma.feedback.findMany({
    where: { campaign: FEEDBACK_CAMPAIGN },
    orderBy: { createdAt: "desc" },
    select: SNAPSHOT_SELECT,
  });
  await audit(u.id, "feedback_results_viewed", FEEDBACK_CAMPAIGN, { rows: rows.length });
  return NextResponse.json(rows, { headers: NO_STORE });
}
