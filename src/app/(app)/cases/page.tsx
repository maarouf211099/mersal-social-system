import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/perms";
import { GOVS, NATS } from "@/lib/constants";
import { one, type SP } from "@/lib/page";
import { Badge, CaseLink, PageHead, Table } from "@/components/ui";
import { AutoSubmitSelect } from "@/components/client";
import { Icon } from "@/components/icons";

export default async function CasesPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePageUser();
  const sp = await searchParams;
  const q = one(sp.q).trim(), gov = one(sp.gov), nat = one(sp.nat), conf = one(sp.conf);
  const where: Prisma.CaseWhereInput = {
    ...(q ? { OR: [{ code: { contains: q } }, { name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { recvPhone: { contains: q } }, { unhcr: { contains: q } }] } : {}),
    ...(gov ? { governorate: gov } : {}), ...(nat ? { nationality: nat } : {}),
    ...(conf === "1" ? { dataConfirmed: true } : conf === "0" ? { dataConfirmed: false } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.case.count({ where }),
    prisma.case.findMany({ where, take: 300, orderBy: { code: "asc" }, include: { decisions: { select: { status: true } } } }),
  ]);
  return (
    <>
      <PageHead title="الحالات" sub={`${total} حالة · MASTER موحد لكل كود`}>
        {can(u.role, "case") && <Link className="btn secondary" href="/cases/new"><Icon.plus /> حالة جديدة</Link>}
        {can(u.role, "decision") && <Link className="btn primary" href="/decisions/new"><Icon.plus /> قرار جديد</Link>}
      </PageHead>
      <form className="toolbar">
        <label className="field grow"><span>بحث</span><input type="search" name="q" defaultValue={q} placeholder="كود، اسم، هاتف، رقم مفوضية" /></label>
        <label className="field"><span>المحافظة</span><AutoSubmitSelect name="gov" defaultValue={gov}><option value="">الكل</option>{GOVS.map((g) => <option key={g}>{g}</option>)}</AutoSubmitSelect></label>
        <label className="field"><span>الجنسية</span><AutoSubmitSelect name="nat" defaultValue={nat}><option value="">الكل</option>{NATS.map((g) => <option key={g}>{g}</option>)}</AutoSubmitSelect></label>
        <label className="field"><span>البيانات</span><AutoSubmitSelect name="conf" defaultValue={conf}><option value="">الكل</option><option value="1">مؤكدة</option><option value="0">غير مؤكدة</option></AutoSubmitSelect></label>
        <button className="btn secondary auto">بحث</button>
      </form>
      <div className="card">
        <Table heads={["الحالة", "الجنسية", "المحافظة", "هاتف", "طريقة الاستلام", "قرارات (مستمرة / الكل)", "البيانات"]} empty={total ? "لا نتائج" : "لا توجد حالات بعد. سجّل أول قرار من «قرار جديد» وهيتسجل الكود تلقائياً."}>
          {rows.map((c) => (
            <tr key={c.code}>
              <td><CaseLink code={c.code} name={c.name} /></td>
              <td>{c.nationality || "—"}</td><td>{c.governorate || "—"}</td>
              <td><span className="num">{c.phone || "—"}</span></td><td>{c.recvMethod || "—"}</td>
              <td>{c.decisions.filter((d) => d.status === "active").length} / {c.decisions.length}</td>
              <td>{c.dataConfirmed ? <Badge tone="ok">مؤكدة</Badge> : <Badge tone="warn">{!c.phone || !c.recvMethod ? "ناقصة" : "غير مؤكدة"}</Badge>}</td>
            </tr>
          ))}
        </Table>
        {total > 300 && <p className="muted" style={{ marginTop: 26 }}>يُعرض أول 300 — استخدم البحث.</p>}
      </div>
    </>
  );
}
