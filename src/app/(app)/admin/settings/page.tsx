import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { userNames } from "@/lib/users";
import { CYCLE_LABELS, KIND_LABELS, POLICY_LABELS, TEAMS } from "@/lib/constants";
import { saveOpType, saveService, saveSettings } from "@/actions/admin";
import { PageHead, Table } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";

export default async function SettingsPage() {
  await requirePageUser({ perm: "admin" });
  const [st, services, opTypes, names, used] = await Promise.all([
    getSettings(), prisma.service.findMany({ orderBy: { sort: "asc" } }), prisma.opType.findMany({ orderBy: [{ team: "asc" }, { sort: "asc" }] }), userNames(),
    prisma.decisionLine.groupBy({ by: ["serviceId"], _count: true }),
  ]);
  const people = (name: string, v: string) => <select name={name} defaultValue={v}><option value="">بدون (يسندها المشرف)</option>{names.active.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>;
  const kindOpts = Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>);
  const cycleOpts = Object.entries(CYCLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>);
  return (
    <>
      <PageHead title="الإعدادات" sub="كل تعديل هنا يُسجَّل في سجل التدقيق بالقيمة القديمة والجديدة." />
      <div className="card"><div className="card-title"><h2>قواعد التشغيل</h2></div>
        <ActionForm action={saveSettings}>
          <div className="fgrid">
            <label className="field"><span>التنبيه بالتجديد قبل نهاية القرار (شهور)</span><input type="number" name="renewLead" min={1} max={6} defaultValue={st.renewLead} /></label>
            <label className="field"><span>مهلة مكالمة التأكيد (أيام)</span><input type="number" name="confirmDays" min={1} defaultValue={st.confirmDays} /></label>
            <label className="field"><span>بدء المتابعة بعد التحويل (أيام)</span><input type="number" name="followDays" min={0} defaultValue={st.followDays} /></label>
            <label className="field"><span>مهلة معالجة عدم الصرف (أيام)</span><input type="number" name="actionDays" min={1} defaultValue={st.actionDays} /></label>
            <label className="field"><span>مهلة المهام اليدوية (أيام)</span><input type="number" name="taskDays" min={1} defaultValue={st.taskDays} /></label>
            <label className="field"><span>السياسة الافتراضية للشهر غير المستلم</span><select name="policy" defaultValue={st.policy}>{Object.entries(POLICY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          </div>
          <h3 className="section-title"><span>الإسناد التلقائي للمهام</span></h3>
          <div className="fgrid">
            <label className="field"><span>مكالمات تأكيد البيانات</span>{people("assignConfirm", st.assign.confirm)}</label>
            <label className="field"><span>مكالمات متابعة الصرف</span>{people("assignFollow", st.assign.follow)}</label>
            <label className="field"><span>معالجة عدم الصرف</span>{people("assignAction", st.assign.action)}</label>
          </div>
          <div><Submit>حفظ الإعدادات</Submit></div>
        </ActionForm>
      </div>

      <div className="section-title"><h2>أنواع الخدمات</h2><span className="muted">«متابعة بعد التسليم» تحدد هل الخدمة تحتاج مكالمة متابعة لاعتبارها مستلمة. اسم الخدمة المستخدمة لا يتغير حفاظاً على التاريخ.</span></div>
      <div className="card">
        <Table heads={["الخدمة", "الإعداد", "قرارات مسجلة"]}>
          {services.map((s) => (
            <tr key={s.id}><td>{s.name}</td>
              <td><ActionForm action={saveService} className="inline" feedbackTop={false}>
                <input type="hidden" name="id" value={s.id} />
                <select name="kind" defaultValue={s.kind} style={{ width: 90 }}>{kindOpts}</select>
                <select name="cycle" defaultValue={s.cycle} style={{ width: 140 }}>{cycleOpts}</select>
                <select name="needsFollow" defaultValue={s.needsFollow ? "1" : "0"} style={{ width: 130 }}><option value="1">تحتاج متابعة</option><option value="0">بدون متابعة</option></select>
                <select name="isActive" defaultValue={s.isActive ? "1" : "0"} style={{ width: 90 }}><option value="1">مفعلة</option><option value="0">موقوفة</option></select>
                <Submit className="btn secondary small" pendingText="…">حفظ</Submit>
              </ActionForm></td>
              <td>{used.find((x) => x.serviceId === s.id)?._count ?? 0}</td>
            </tr>
          ))}
        </Table>
        <ActionForm action={saveService} className="row" resetOnOk>
          <label className="field"><span>خدمة جديدة</span><input name="name" /></label>
          <label className="field"><span>الفئة</span><select name="kind" defaultValue="in_kind">{kindOpts}</select></label>
          <label className="field"><span>الدورة</span><select name="cycle" defaultValue="once">{cycleOpts}</select></label>
          <label className="field"><span>متابعة</span><select name="needsFollow" defaultValue="0"><option value="1">تحتاج متابعة</option><option value="0">بدون متابعة</option></select></label>
          <div className="auto"><Submit className="btn secondary">إضافة</Submit></div>
        </ActionForm>
      </div>

      <div className="section-title"><h2>أنواع العمليات وأوزانها</h2><span className="muted">الوزن يُستخدم في حساب الإنتاجية.</span></div>
      <div className="card">
        <details><summary className="muted" style={{ cursor: "pointer" }}>عرض {opTypes.length} نوع عملية</summary>
          <Table heads={["العملية", "النطاق", "الفريق / الوزن"]}>
            {opTypes.map((o) => (
              <tr key={o.id}><td>{o.name}{o.auto && <span className="cell-sub">يسجلها النظام تلقائياً</span>}</td><td>{o.scope === "case" ? "حالة" : "عامة"}</td>
                <td><ActionForm action={saveOpType} className="inline" feedbackTop={false}>
                  <input type="hidden" name="id" value={o.id} />
                  <select name="team" defaultValue={o.team} style={{ width: 130 }}>{[...new Set([...TEAMS, o.team])].map((t) => <option key={t}>{t}</option>)}</select>
                  <input type="number" step="0.1" name="weight" defaultValue={Number(o.weight)} style={{ width: 80 }} />
                  <select name="isActive" defaultValue={o.isActive ? "1" : "0"} style={{ width: 90 }}><option value="1">مفعلة</option><option value="0">موقوفة</option></select>
                  <Submit className="btn secondary small" pendingText="…">حفظ</Submit>
                </ActionForm></td></tr>
            ))}
          </Table>
        </details>
        <ActionForm action={saveOpType} className="row" resetOnOk>
          <label className="field"><span>عملية جديدة</span><input name="name" /></label>
          <label className="field"><span>الفريق</span><select name="team">{TEAMS.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="field"><span>الوزن</span><input type="number" step="0.1" name="weight" defaultValue={1} /></label>
          <label className="field"><span>النطاق</span><select name="scope"><option value="case">حالة</option><option value="general">عامة</option></select></label>
          <div className="auto"><Submit className="btn secondary">إضافة</Submit></div>
        </ActionForm>
      </div>
    </>
  );
}
