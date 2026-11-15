import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/perms";
import { userNames } from "@/lib/users";
import { getSettings } from "@/lib/settings";
import { POLICY_LABELS, REFUND_TYPE_LABELS, SETTLEMENT_LABELS } from "@/lib/constants";
import { fmtMonth } from "@/lib/months";
import { fmtDate, fmtTs, money } from "@/lib/format";
import { monthOf, monthOpts, one, type SP } from "@/lib/page";
import { settleRefund } from "@/actions/cycle";
import { Badge, CaseLink, Kpi, PageHead, Table } from "@/components/ui";
import { AutoSubmitSelect, MonthSelect } from "@/components/client";
import { ActionForm, Submit } from "@/components/forms";

export default async function RefundsPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePageUser();
  const sp = await searchParams;
  const m = monthOf(sp), q = one(sp.q).trim(), settle = one(sp.settle), all = one(sp.all) === "1";
  const st = await getSettings();
  const where: Prisma.RefundWhereInput = {
    ...(all ? {} : { month: m }), ...(settle ? { settlement: settle as any } : {}),
    ...(q ? { OR: [{ caseCode: { contains: q } }, { ref: { contains: q } }] } : {}),
  };
  const [rows, monthRows, transferred, pendingAll, names] = await Promise.all([
    prisma.refund.findMany({ where, orderBy: { createdAt: "desc" }, take: 500, include: { entitlement: { include: { case: { select: { name: true } }, line: { include: { service: true } } } } } }),
    prisma.refund.findMany({ where: { month: m } }),
    prisma.transfer.aggregate({ where: { entitlement: { month: m } }, _sum: { amount: true } }),
    prisma.refund.count({ where: { settlement: "pending" } }),
    userNames(),
  ]);
  const refunded = monthRows.reduce((s, r) => s + Number(r.amount), 0);
  const tr = Number(transferred._sum.amount ?? 0);
  return (
    <>
      <PageHead title="الاستردادات" sub="يُسجل الاسترداد من صفحة الاستحقاق المحوّل، ويُربط تلقائياً بالتحويل الأصلي ومرجعه."><MonthSelect value={m} options={monthOpts(m)} /></PageHead>
      <div className="kpis">
        <Kpi v={money(tr)} l={`المحوّل · ${fmtMonth(m)}`} />
        <Kpi v={money(refunded)} l="المسترد من استحقاقات الشهر" tone={refunded ? "warn" : ""} />
        <Kpi v={money(tr - refunded)} l="صافي المصروف" tone="ok" />
        <Kpi v={monthRows.filter((r) => r.type === "full").length} l="استرداد كلي" />
        <Kpi v={monthRows.filter((r) => r.type === "partial").length} l="استرداد جزئي" />
        <Kpi v={pendingAll} l="معلقة التسوية (كل الشهور)" tone={pendingAll ? "warn" : ""} href="/refunds?all=1&settle=pending" />
      </div>
      <form className="toolbar">
        <input type="hidden" name="m" value={m} />
        <label className="field grow"><span>بحث</span><input type="search" name="q" defaultValue={q} placeholder="كود أو مرجع تحويل" /></label>
        <label className="field"><span>التسوية</span><AutoSubmitSelect name="settle" defaultValue={settle}><option value="">الكل</option><option value="pending">معلقة</option><option value="settled">تمت التسوية</option></AutoSubmitSelect></label>
        <label className="field"><span>الفترة</span><AutoSubmitSelect name="all" defaultValue={all ? "1" : ""}><option value="">الشهر المختار</option><option value="1">كل الشهور</option></AutoSubmitSelect></label>
      </form>
      <div className="card">
        <Table heads={["الحالة", "شهر الاستحقاق", "المحوّل", "المسترد", "النوع", "التاريخ والسبب", "مرجع التحويل", "سجّله", "التسوية"]} empty="لا توجد استردادات.">
          {rows.map((r) => (
            <tr key={r.id}>
              <td><CaseLink code={r.caseCode} name={r.entitlement.case.name} /><span className="cell-sub">{r.entitlement.line.service.name}</span></td>
              <td><Link className="strong" href={`/cycle/${r.entitlementId}`}>{fmtMonth(r.month)}</Link></td>
              <td>{money(r.transferAmount)}</td><td>{money(r.amount)}</td>
              <td><Badge tone={r.type === "full" ? "warn" : "info"}>{REFUND_TYPE_LABELS[r.type]}</Badge></td>
              <td className="nowrap">{fmtDate(r.date)}<span className="cell-sub">{r.reason}</span></td>
              <td><span className="num">{r.ref || "—"}</span></td>
              <td className="nowrap">{names.name(r.userId)}<span className="cell-sub">{fmtTs(r.createdAt)}</span></td>
              <td>
                <Badge tone={r.settlement === "settled" ? "ok" : "warn"}>{SETTLEMENT_LABELS[r.settlement]}</Badge>
                {r.how && r.settlement === "settled" && <span className="cell-sub">{POLICY_LABELS[r.how]}</span>}
                {r.settlement === "pending" && can(u.role, "refund") && (
                  <ActionForm action={settleRefund} className="inline" feedbackTop={false}>
                    <input type="hidden" name="id" value={r.id} />
                    <select name="how" defaultValue={r.how ?? st.policy} style={{ width: 170 }}>{Object.entries(POLICY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    <Submit className="btn secondary small">تسوية</Submit>
                  </ActionForm>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </div>
    </>
  );
}
