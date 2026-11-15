// الصلاحيات حسب الدور — تُفحص في كل server action على السيرفر
import type { Role } from "@prisma/client";

export type Perm =
  | "case" | "decision" | "decision.stop" | "decision.override" | "generate" | "confirm" | "send" | "transfer"
  | "follow" | "refund" | "approve" | "assign" | "return" | "renewal" | "op" | "task" | "close" | "admin";

const PERMS: Record<Role, Perm[] | "*"> = {
  admin: "*",
  supervisor: ["case", "decision", "decision.stop", "decision.override", "generate", "confirm", "send", "transfer", "follow", "refund", "approve", "assign", "return", "renewal", "op", "task", "close"],
  finance: ["case", "generate", "confirm", "send", "transfer", "follow", "refund", "op", "task", "renewal"],
  staff: ["case", "decision", "generate", "confirm", "send", "follow", "op", "task", "renewal"],
  viewer: [],
};

export function can(role: Role, p: Perm): boolean {
  const r = PERMS[role];
  return r === "*" || r.includes(p);
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "مدير", supervisor: "مشرف", finance: "مالي", staff: "موظف", viewer: "قراءة فقط",
};
export const ROLE_DESC: Record<Role, string> = {
  admin: "كل الصلاحيات، الإعدادات، المستخدمون",
  supervisor: "كل التشغيل + إسناد المهام، اعتماد الإدراج، الإرجاع للتصحيح، إيقاف وإغلاق القرارات، مراجعة التعارض",
  finance: "تسجيل التحويلات والاستردادات + التشغيل اليومي",
  staff: "الحالات، القرارات، التأكيد، الإرسال، المتابعة، العمليات، المهام",
  viewer: "عرض فقط",
};
