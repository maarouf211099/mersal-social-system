import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * تقييم النظام اتشال. التبويبات اللي لسه فاتحة بالكود القديم بتسأل هنا كل شوية،
 * ولو الرد مش "submitted" بتعرض الرسالة — فبنرد دايماً إنه قيّم عشان تبطّل وتسجّل ده عند المستخدم.
 * الحملة كانت لحد 2026-11-30 — بعدها الكود القديم بيقف لوحده وينفع يتشال الملف ده.
 */
export async function GET() {
  return NextResponse.json({ ok: true, submitted: true, canViewResults: false }, { headers: { "Cache-Control": "no-store" } });
}
