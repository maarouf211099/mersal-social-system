import { requirePageUser } from "@/lib/auth";
import { createCase } from "@/actions/cases";
import { ActionForm, Submit } from "@/components/forms";
import { CaseFields } from "@/components/CaseFields";
import { PageHead } from "@/components/ui";

export default async function NewCasePage() {
  await requirePageUser({ perm: "case" });
  return (
    <>
      <PageHead title="حالة جديدة" sub="الكود لا يتكرر. الكود والاسم كفاية للبدء، والباقي يُستكمل لاحقاً." />
      <div className="card">
        <ActionForm action={createCase}>
          <CaseFields withCode />
          <div><Submit>حفظ الحالة</Submit></div>
        </ActionForm>
      </div>
    </>
  );
}
