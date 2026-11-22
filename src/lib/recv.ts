/** إقامات ليها تاريخ انتهاء لازم يتسجل */
export const RESIDENCY_WITH_EXPIRY = ["لها إقامة", "فيزا"];

type RecvCase = { phone: string; recvName: string; recvIdNo: string; residencyStatus: string; residencyExpiry: string };

/**
 * بيانات الاستلام اللي بتتحدد في المكالمة ومطلوبة قبل الإرسال والمتابعة والاستلام:
 * رقم الهاتف، اسم المستلم، الرقم القومي، موقف الإقامة، وتاريخ انتهاء الإقامة (لو «لها إقامة» أو «فيزا»).
 * البيانات الأولية (العنوان، المنطقة…) مش بتخلي الحالة ناقصة.
 */
export function recvMissing(c: RecvCase): string[] {
  const out: string[] = [];
  if (!c.phone.trim()) out.push("رقم الهاتف");
  if (!c.recvName.trim()) out.push("اسم المستلم");
  if (!c.recvIdNo.trim()) out.push("الرقم القومي");
  if (!c.residencyStatus.trim()) out.push("موقف الإقامة");
  else if (RESIDENCY_WITH_EXPIRY.includes(c.residencyStatus) && !c.residencyExpiry.trim()) out.push("تاريخ انتهاء الإقامة");
  return out;
}

/** شرط Prisma للحالات الناقصة (نفس القاعدة تقريباً — للفلترة في قاعدة البيانات) */
export const RECV_MISSING_WHERE = {
  OR: [
    { phone: "" }, { recvName: "" }, { recvIdNo: "" }, { residencyStatus: "" },
    { residencyStatus: { in: RESIDENCY_WITH_EXPIRY }, residencyExpiry: "" },
  ],
};
