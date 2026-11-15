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
      <div className="grid2">
        <div className="card">
          <div className="card-title"><h2>رفع ملف</h2></div>
          <ActionForm action={importData}>
            <label className="field"><span>الملف (JSON)</span><input type="file" name="file" accept=".json,application/json" required /></label>
            <div><Submit pendingText="جارٍ الاستيراد… (ممكن ياخد دقيقة)">استيراد</Submit></div>
          </ActionForm>
          <p className="muted" style={{ marginTop: 10 }}>الاستيراد كله في عملية واحدة: يا ينجح كله، يا مايتحفظش أي حاجة.</p>
        </div>
        <div className="card">
          <div className="card-title"><h2>الملفات المقبولة</h2></div>
          <ol className="muted" style={{ paddingInlineStart: 18, lineHeight: 2, margin: 0 }}>
            <li><b>سجل القرارات (Excel منظّف)</b> — ملف <span className="num">decisions-import.json</span> الناتج من شيت القرارات السنوي. الحالات الجديدة تتسجل، والموجودة تتكمل خاناتها الفاضية بس، ورفعه مرتين ما بيكررش أي قرار.</li>
            <li><b>نسخة النظام السابق (صفحة HTML)</b> — من «الإعدادات ← تصدير نسخة كاملة». مرة واحدة على قاعدة فاضية ({count ? `فيها ${count} حالة دلوقتي` : "فاضية دلوقتي"}).</li>
          </ol>
        </div>
      </div>
    </>
  );
}
