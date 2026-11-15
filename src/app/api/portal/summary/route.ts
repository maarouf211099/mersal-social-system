import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { portalSecret, verifyPortalToken } from "@/lib/portal-sso";
import { getSettings } from "@/lib/settings";
import { addMonths, currentMonth } from "@/lib/months";

export const dynamic = "force-dynamic";

/** أرقام إجمالية لكارت النظام في بوابة مرسال — بدون أي بيانات مستفيدين */
export async function GET(req: NextRequest) {
  if (!portalSecret()) return new NextResponse("Not found", { status: 404 });
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!(await verifyPortalToken(token, "summary"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const st = await getSettings();
  const cm = currentMonth();
  const [open, late, needConf, ends] = await Promise.all([
    prisma.task.count({ where: { status: { in: ["new", "in_progress"] } } }),
    prisma.task.count({ where: { status: { in: ["new", "in_progress"] }, dueAt: { lt: new Date() } } }),
    prisma.task.count({ where: { kind: "confirm", status: { in: ["new", "in_progress", "stuck"] } } }),
    prisma.decisionLine.groupBy({ by: ["decisionId"], where: { decision: { status: "active", renewalStatus: "none" } }, _max: { endMonth: true } }),
  ]);
  const renew = ends.filter((g) => g._max.endMonth! >= cm && g._max.endMonth! <= addMonths(cm, st.renewLead)).length;
  return NextResponse.json({
    items: [
      { label: "مهام مفتوحة", value: open, tone: "info" },
      { label: "متأخرة", value: late, tone: late ? "bad" : "ok" },
      { label: "تحتاج تأكيد بيانات", value: needConf, tone: needConf ? "warn" : "ok" },
      { label: `تنتهي خلال ${st.renewLead} شهر`, value: renew, tone: renew ? "warn" : "ok" },
    ],
    updatedAt: new Date().toISOString(),
  });
}
