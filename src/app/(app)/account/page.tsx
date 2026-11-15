import { requirePageUser } from "@/lib/auth";
import { ActionForm, Submit } from "@/components/forms";
import { changePassword } from "@/actions/auth";
import { PageHead } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/perms";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ first?: string }> }) {
  const u = await requirePageUser({ allowMustChange: true });
  const { first } = await searchParams;
  return (
    <>
      <PageHead title="حسابي" sub={`${u.name} · ${u.email} · ${ROLE_LABELS[u.role]}`} />
      <div className="card w-narrow">
        <div className="card-title"><h2>تغيير كلمة المرور</h2></div>
        {(first || u.mustChangePassword) && <div className="alert warn">أول دخول: غيّر كلمة المرور المؤقتة عشان تكمل.</div>}
        <ActionForm action={changePassword as any}>
          <label className="field"><span>كلمة المرور الحالية</span><input type="password" name="current" required dir="ltr" autoComplete="current-password" /></label>
          <label className="field"><span>الجديدة (10 حروف على الأقل)</span><input type="password" name="next" required dir="ltr" autoComplete="new-password" /></label>
          <label className="field"><span>تأكيد الجديدة</span><input type="password" name="confirm" required dir="ltr" autoComplete="new-password" /></label>
          <Submit>حفظ</Submit>
        </ActionForm>
      </div>
    </>
  );
}
