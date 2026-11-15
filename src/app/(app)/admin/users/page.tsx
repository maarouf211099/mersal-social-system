import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_DESC, ROLE_LABELS } from "@/lib/perms";
import { TEAMS } from "@/lib/constants";
import { fmtTs } from "@/lib/format";
import { createUser, resetPassword, updateUser } from "@/actions/admin";
import { Badge, PageHead, Table } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import type { Role } from "@prisma/client";

const ROLES = Object.keys(ROLE_LABELS) as Role[];

export default async function UsersPage() {
  const me = await requirePageUser({ perm: "admin" });
  const users = await prisma.user.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });
  return (
    <>
      <PageHead title="المستخدمون والصلاحيات" sub="الصلاحيات تُفحص على السيرفر في كل إجراء. الموظف اللي له حساب في بوابة مرسال بنفس الإيميل يدخل من البوابة مباشرة." />
      <div className="grid2">
        <div className="card"><div className="card-title"><h2>إضافة موظف</h2></div>
          <ActionForm action={createUser} resetOnOk>
            <label className="field"><span>الاسم</span><input name="name" required /></label>
            <label className="field"><span>الإيميل (نفس إيميل البوابة)</span><input type="email" name="email" required dir="ltr" /></label>
            <div className="row">
              <label className="field"><span>الدور</span><select name="role" defaultValue="staff">{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></label>
              <label className="field"><span>الفريق</span><select name="team" defaultValue=""><option value="">—</option>{TEAMS.map((t) => <option key={t}>{t}</option>)}</select></label>
            </div>
            <div><Submit>إضافة</Submit></div>
          </ActionForm>
        </div>
        <div className="card"><div className="card-title"><h2>الأدوار</h2></div>
          <Table heads={["الدور", "الصلاحيات"]} flat>{ROLES.map((r) => <tr key={r}><td><b>{ROLE_LABELS[r]}</b></td><td className="cell-sub">{ROLE_DESC[r]}</td></tr>)}</Table>
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <Table heads={["الموظف", "الدور / الفريق / الحالة", "آخر دخول", ""]}>
          {users.map((x) => (
            <tr key={x.id}>
              <td><b>{x.name}</b>{x.id === me.id && <> <Badge tone="info" plain>أنت</Badge></>}<span className="cell-sub num">{x.email}</span></td>
              <td>
                <ActionForm action={updateUser} className="inline" feedbackTop={false}>
                  <input type="hidden" name="id" value={x.id} />
                  <select name="role" defaultValue={x.role} style={{ width: 110 }}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
                  <select name="team" defaultValue={x.team} style={{ width: 130 }}><option value="">—</option>{[...new Set([...TEAMS, x.team].filter(Boolean))].map((t) => <option key={t}>{t}</option>)}</select>
                  <select name="active" defaultValue={x.isActive ? "1" : "0"} style={{ width: 90 }}><option value="1">نشط</option><option value="0">موقوف</option></select>
                  <Submit className="btn secondary small" pendingText="…">حفظ</Submit>
                </ActionForm>
              </td>
              <td className="nowrap">{fmtTs(x.lastLoginAt)}</td>
              <td><ActionForm action={resetPassword} className="inline" feedbackTop={false}><input type="hidden" name="id" value={x.id} /><Submit className="btn ghost small" pendingText="…">كلمة مرور مؤقتة</Submit></ActionForm></td>
            </tr>
          ))}
        </Table>
      </div>
    </>
  );
}
