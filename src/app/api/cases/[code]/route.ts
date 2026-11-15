import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recvMissing } from "@/lib/recv";

export const dynamic = "force-dynamic";

/** بيانات الحالة المسجلة (للعرض التلقائي في فورم القرار) — قراءة فقط */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const u = await auth();
  if (!u || u.mustChangePassword) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const code = decodeURIComponent((await params).code).trim();
  const c = await prisma.case.findUnique({ where: { code } });
  if (!c) return NextResponse.json({ found: false });
  return NextResponse.json({
    found: true, code: c.code, name: c.name, nationality: c.nationality, governorate: c.governorate, area: c.area, address: c.address,
    phone: c.phone, age: c.age, religion: c.religion, unhcr: c.unhcr, description: c.description,
    recvName: c.recvName, recvIdNo: c.recvIdNo, recvMethod: c.recvMethod, residencyStatus: c.residencyStatus, residencyExpiry: c.residencyExpiry,
    missing: recvMissing(c),
  }, { headers: { "Cache-Control": "no-store" } });
}
