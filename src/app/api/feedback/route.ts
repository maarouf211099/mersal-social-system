import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** تقييم النظام اتشال — رسالة لسه مفتوحة في تبويب قديم ماتطلّعش خطأ لما تتبعت */
export async function POST() {
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
