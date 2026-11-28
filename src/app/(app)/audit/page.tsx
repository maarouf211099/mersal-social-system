import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userNames } from "@/lib/users";
import { fmtTs } from "@/lib/format";
import { one, type SP } from "@/lib/page";
import { PageHead, Table } from "@/components/ui";
import { AutoSubmitSelect } from "@/components/client";
import { redirect } from "next/navigation";

const LABELS: Record<string, string> = {
  login: "دخول", login_failed: "محاولة دخول فاشلة", logout: "خروج", password_changed: "تغيير كلمة المرور", password_reset: "إعادة تعيين كلمة المرور",
  case_created: "تسجيل حالة", case_updated: "تعديل بيانات حالة", decision_created: "قرار جديد", decision_renewed: "تجديد قرار", decision_status: "تغيير حالة قرار",
  month_generated: "توليد استحقاقات", confirm_no_answer: "تأكيد بيانات: لم يرد", data_confirmed: "تأكيد بيانات", hold_approved: "اعتماد إدراج",
  batch_sent: "إرسال دفعة", transfer: "تسجيل تحويل", follow_call: "مكالمة متابعة", follow_not_paid: "لم يتم الصرف", stuck: "تعثر", unstuck: "إلغاء تعثر",
  refund: "استرداد", refund_settled: "تسوية استرداد", line_extended: "تمديد خدمة", action_done: "معالجة عدم صرف", renewal_sent: "إرسال للتجديد", renewal_not_renewed: "لم يُجدد",
  task_created: "مهمة جديدة", task_status: "تحديث مهمة", tasks_assigned: "إسناد مهام", task_returned: "إرجاع مهمة للتصحيح", operation: "تسجيل عملية",
  operation_status: "تحديث عملية", operation_returned: "إرجاع عملية", user_created: "إضافة مستخدم", user_updated: "تعديل مستخدم", settings_updated: "تعديل الإعدادات",
  line_corrected: "تصحيح خدمة في قرار", decision_corrected: "تصحيح بيانات قرار", transfer_corrected: "تصحيح تحويل", card_resent: "إعادة إرسال كارت", attachment_added: "رفع مرفق",
  import_decisions_sheet: "استيراد شيت القرارات", donation_flag: "علامة تحتاج لتبرع",
  service_created: "إضافة خدمة", service_updated: "تعديل خدمة", optype_saved: "نوع عملية", export: "تصدير", import_v1: "استيراد النظام السابق",
  feedback_submitted: "تقييم النظام", feedback_results_viewed: "عرض نتائج تقييم النظام",
};

export default async function AuditPage({ searchParams }: { searchParams: SP }) {
  const u = await requirePageUser();
  void u; // الوصول بيتحدد من صلاحية صفحة «سجل التدقيق» (افتراضياً المدير والمشرف)
  const sp = await searchParams;
  const q = one(sp.q).trim(), who = one(sp.who), act = one(sp.act);
  const [rows, names] = await Promise.all([
    prisma.auditLog.findMany({ where: { ...(who ? { userId: who } : {}), ...(act ? { action: act } : {}), ...(q ? { OR: [{ target: { contains: q } }, { action: { contains: q } }] } : {}) }, orderBy: { createdAt: "desc" }, take: 1000 }),
    userNames(),
  ]);
  return (
    <>
      <PageHead title="سجل التدقيق" sub="سجل لا يمكن تعديله أو حذفه — محمي على مستوى قاعدة البيانات. يُعرض آخر 1000 تسجيل." />
      <form className="toolbar">
        <label className="field grow"><span>بحث</span><input type="search" name="q" defaultValue={q} placeholder="كود أو عنصر" /></label>
        <label className="field"><span>المستخدم</span><AutoSubmitSelect name="who" defaultValue={who}><option value="">الكل</option>{names.all.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</AutoSubmitSelect></label>
        <label className="field"><span>الإجراء</span><AutoSubmitSelect name="act" defaultValue={act}><option value="">الكل</option>{Object.entries(LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</AutoSubmitSelect></label>
      </form>
      <div className="card">
        <Table heads={["الوقت", "المستخدم", "الإجراء", "العنصر", "التفاصيل", "IP"]} empty="لا يوجد سجل.">
          {rows.map((a) => (
            <tr key={String(a.id)}>
              <td className="nowrap">{fmtTs(a.createdAt)}</td><td>{names.name(a.userId)}</td><td>{LABELS[a.action] ?? a.action}</td><td>{a.target}</td>
              <td className="cell-sub" style={{ maxWidth: 420, wordBreak: "break-word" }}>{a.meta ? JSON.stringify(a.meta) : ""}</td><td className="cell-sub num">{a.ip}</td>
            </tr>
          ))}
        </Table>
      </div>
    </>
  );
}
