import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { exportRows, toCSV } from "@/lib/reports";
import { currentMonth, isMonth } from "@/lib/months";

export const dynamic = "force-dynamic";

/** تصدير CSV للقراءة فقط — لا يغيّر أي بيانات */
export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const u = await auth();
  if (!u || u.mustChangePassword) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { kind } = await params;
  const p = req.nextUrl.searchParams;
  const m = isMonth(p.get("m")) ? p.get("m")! : currentMonth();
  const f = { staff: p.get("staff") || undefined, svc: p.get("svc") || undefined, dec: p.get("dec") || undefined, gov: p.get("gov") || undefined, nat: p.get("nat") || undefined };
  try {
    const { name, rows } = await exportRows(kind, m, f, Object.fromEntries(p.entries()));
    await audit(u.id, "export", kind, { m, rows: rows.length - 1 });
    return new NextResponse(toCSV(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}.csv` } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
