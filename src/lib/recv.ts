import { WALLET_METHODS } from "./constants";

/** إقامات ليها تاريخ انتهاء لازم يتسجل */
export const RESIDENCY_WITH_EXPIRY = ["لها إقامة", "فيزا"];

type RecvCase = { recvName: string; recvIdNo: string; recvMethod: string; recvPhone: string; residencyStatus: string; residencyExpiry: string };

/**
 * بيانات الاستلام اللي بتتحدد في المكالمة ومطلوبة في الدفعة.
 * البيانات الأولية (العنوان، المنطقة…) مش بتخلي الحالة ناقصة.
 */
export function recvMissing(c: RecvCase): string[] {
  const out: string[] = [];
  if (!c.recvName.trim()) out.push("اسم المستلم");
  if (!c.recvIdNo.trim()) out.push("الرقم القومي");
  if (!c.recvMethod.trim()) out.push("طريقة الاستلام");
  else if (WALLET_METHODS.includes(c.recvMethod) && !c.recvPhone.trim()) out.push("رقم المحفظة");
  if (!c.residencyStatus.trim()) out.push("موقف الإقامة");
  else if (RESIDENCY_WITH_EXPIRY.includes(c.residencyStatus) && !c.residencyExpiry.trim()) out.push("تاريخ انتهاء الإقامة");
  return out;
}

/** شرط Prisma للحالات الناقصة (نفس القاعدة تقريباً — للفلترة في قاعدة البيانات) */
export const RECV_MISSING_WHERE = {
  OR: [
    { recvName: "" }, { recvIdNo: "" }, { recvMethod: "" }, { residencyStatus: "" },
    { recvMethod: { in: WALLET_METHODS }, recvPhone: "" },
    { residencyStatus: { in: RESIDENCY_WITH_EXPIRY }, residencyExpiry: "" },
  ],
};
