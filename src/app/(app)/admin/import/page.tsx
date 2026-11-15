import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { importData } from "@/actions/admin";
import { PageHead } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";

export default async function ImportPage() {
  await requirePageUser({ perm: "admin" });
  const count = await prisma.case.count();
  return (
    <>
      <PageHead title="استيراد بيانات النظام السابق" sub="ينقل الحالات والقرارات والاستحقاقات والتحويلات والمتابعات والاستردادات والعمليات من نسخة النظام السابق (صفحة HTML) إلى قاعدة البيانات." />
      <div className="card w-narrow">
        <ol className="muted" style={{ paddingInlineStart: 18, lineHeight: 2 }}>
          <li>من النظام السابق: «الإعدادات» ← «تصدير نسخة كاملة (JSON)».</li>
          <li>ارفع الملف هنا. الاستيراد كله في عملية واحدة: يا ينجح كله، يا مايتحفظش أي حاجة.</li>
          <li>الموظفون في النظام السابق يتسجلوا كحسابات موقوفة بأسمائهم، عشان تاريخ عملياتهم يفضل منسوب ليهم.</li>
        </ol>
        {count > 0 ? <div className="alert warn">قاعدة البيانات فيها {count} حالة بالفعل. الاستيراد متاح مرة واحدة على قاعدة فاضية فقط.</div> : (
          <ActionForm action={importData}>
            <label className="field"><span>ملف النسخة (JSON)</span><input type="file" name="file" accept=".json,application/json" required /></label>
            <div><Submit pendingText="جارٍ الاستيراد…">استيراد</Submit></div>
          </ActionForm>
        )}
      </div>
    </>
  );
}
