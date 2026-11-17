import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FEEDBACK_CAMPAIGN } from "@/lib/feedback";

export const dynamic = "force-dynamic";

/** هل المستخدم الحالي قيّم النظام قبل كده (من أي جهاز) */
export async function GET() {
  const u = await auth();
  if (!u || u.mustChangePassword) return NextResponse.json({ error: "انتهت الجلسة. سجّل الدخول مرة أخرى." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const row = await prisma.feedback.findUnique({
    where: { campaign_userId: { campaign: FEEDBACK_CAMPAIGN, userId: u.id } },
    select: { id: true },
  });
  return NextResponse.json({ submitted: !!row }, { headers: { "Cache-Control": "no-store" } });
}
