import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTION_LABELS, PAGES, ROLE_LABELS, canSee, can, type UserPerms } from "@/lib/perms";
import { saveUserPerms } from "@/actions/admin";
import { Badge, PageHead } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { Icon } from "@/components/icons";
import { SelectAll } from "@/components/client";

/** صلاحيات موظف: يشوف إيه ويعدّل إيه */
export default async function UserPermsPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser({ perm: "admin" });
  const { id } = await params;
  const x = await prisma.user.findUnique({ where: { id } });
  if (!x) notFound();
  const subject = { role: x.role, perms: (x.perms as UserPerms) ?? null };
  const custom = !!subject.perms;
  return (
    <>
      <Link href="/admin/users" className="crumb"><Icon.back /> المستخدمون</Link>
      <PageHead title={`صلاحيات ${x.name}`} sub={<>{x.email} · الدور: <b>{ROLE_LABELS[x.role]}</b> · {custom ? <Badge tone="warn">صلاحيات مخصصة</Badge> : <Badge tone="info">صلاحيات الدور الافتراضية</Badge>}</>} />
      {x.role === "admin" ? (
        <div className="alert"><Icon.shield /><span>المدير عنده كل الصلاحيات دايماً. لو عايز تحدد صلاحياته غيّر دوره الأول من «المستخدمون».</span></div>
      ) : (
        <ActionForm action={saveUserPerms}>
          <input type="hidden" name="id" value={x.id} />
          <div className="grid2">
            <div className="card">
              <div className="card-title"><Icon.search /><h2>يشوف (الصفحات)</h2><label className="check"><SelectAll name="page" /> الكل</label></div>
              <p className="muted" style={{ marginBottom: 12 }}>الصفحة اللي مش متعلّم عليها بتختفي من القائمة، ولو حد فتح رابطها بيرجع للوحة المتابعة. لوحة المتابعة ومهامي وحسابي مفتوحين للكل.</p>
              <div className="perm-list">
                {PAGES.map((p) => <label key={p.key} className="check"><input type="checkbox" name="page" value={p.key} defaultChecked={canSee(subject, p.key)} /> {p.label}</label>)}
              </div>
            </div>
            <div className="card">
              <div className="card-title"><Icon.key /><h2>يعدّل (الإجراءات)</h2><label className="check"><SelectAll name="action" /> الكل</label></div>
              <p className="muted" style={{ marginBottom: 12 }}>من غير الإجراء، الزراير بتاعته مش بتظهر، والسيرفر بيرفضه لو اتبعت.</p>
              <div className="perm-list">
                {ACTION_LABELS.map(([k, l]) => <label key={k} className="check"><input type="checkbox" name="action" value={k} defaultChecked={can(subject, k)} /> {l}</label>)}
              </div>
            </div>
          </div>
          <div className="inline">
            <Submit>حفظ الصلاحيات</Submit>
            {custom && <Submit className="btn secondary" name="reset" value="1">رجوع لصلاحيات الدور</Submit>}
          </div>
        </ActionForm>
      )}
    </>
  );
}
