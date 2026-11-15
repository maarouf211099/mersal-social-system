import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateCase } from "@/actions/cases";
import { ActionForm, Submit } from "@/components/forms";
import { CaseFields } from "@/components/CaseFields";
import { PageHead } from "@/components/ui";

export default async function EditCasePage({ params }: { params: Promise<{ code: string }> }) {
  await requirePageUser({ perm: "case" });
  const code = decodeURIComponent((await params).code);
  const c = await prisma.case.findUnique({ where: { code } });
  if (!c) notFound();
  return (
    <>
      <PageHead title={`تعديل بيانات ${c.name}`} sub="كل تعديل يُحفظ في سجل التعديلات بالقيمة القديمة والجديدة واسمك ووقت التعديل. لا يؤثر على العمليات السابقة.">
        <Link className="btn secondary" href={`/cases/${encodeURIComponent(code)}`}>رجوع لملف الحالة</Link>
      </PageHead>
      <div className="card">
        <ActionForm action={updateCase}>
          <input type="hidden" name="code" value={code} />
          <CaseFields c={c} />
          <div><Submit>حفظ التعديلات</Submit></div>
        </ActionForm>
      </div>
    </>
  );
}
