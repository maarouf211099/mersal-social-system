// الصلاحيات: افتراضي حسب الدور، والمدير يقدر يحدد لكل موظف يشوف إيه ويعدّل إيه — وكله بيتفحص على السيرفر
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

/** الإجراءات اللي ممكن تتدّي لموظف (المدير بس هو اللي بيدير المستخدمين والإعدادات) */
export const ACTION_LABELS: [Perm, string][] = [
  ["decision", "تسجيل كود وقرار"],
  ["case", "تعديل بيانات الحالات والمرفقات"],
  ["confirm", "استكمال بيانات الاستلام (المكالمة)"],
  ["generate", "توليد استحقاقات الشهر"],
  ["send", "الإرسال في الدفعة / التسليم / التنفيذ"],
  ["transfer", "تسجيل التحويل المالي"],
  ["follow", "تسجيل المتابعة والاستلام"],
  ["refund", "تسجيل وتسوية الاسترداد"],
  ["renewal", "الإرسال للتجديد"],
  ["close", "إغلاق القرارات كمنتهية"],
  ["decision.stop", "إيقاف / سحب القرارات وغلق الخدمات"],
  ["decision.override", "اعتماد قرار متداخل"],
  ["approve", "التصحيحات والاعتمادات (مشرف)"],
  ["assign", "إسناد المهام للموظفين"],
  ["return", "إرجاع للتصحيح"],
  ["task", "إضافة مهام"],
  ["op", "تسجيل عمليات يدوية"],
];

/** الصفحات اللي ممكن تتقفل عن موظف (لوحة المتابعة ومهامي وحسابي مفتوحين للكل) */
export const PAGES: { key: string; label: string; paths: string[] }[] = [
  { key: "cases", label: "الحالات والقرارات", paths: ["/cases", "/decisions"] },
  { key: "data", label: "استكمال البيانات", paths: ["/data"] },
  { key: "cycle", label: "دورة الصرف", paths: ["/cycle"] },
  { key: "follow", label: "المتابعة", paths: ["/follow"] },
  { key: "closing", label: "قائمة الغلق", paths: ["/closing"] },
  { key: "refunds", label: "الاستردادات", paths: ["/refunds"] },
  { key: "renewal", label: "التجديد والانتهاء", paths: ["/renewal"] },
  { key: "tasks", label: "توزيع المهام", paths: ["/tasks"] },
  { key: "ops", label: "العمليات", paths: ["/ops"] },
  { key: "reports", label: "التقارير", paths: ["/reports"] },
  { key: "audit", label: "سجل التدقيق", paths: ["/audit"] },
];

export type UserPerms = { pages?: string[]; actions?: string[] } | null;
type Subject = Role | { role: Role; perms?: UserPerms };

const roleOf = (s: Subject) => (typeof s === "string" ? s : s.role);
const permsOf = (s: Subject): UserPerms => (typeof s === "string" ? null : s.perms ?? null);

export const roleActions = (role: Role): Perm[] => { const r = PERMS[role]; return r === "*" ? ACTION_LABELS.map(([p]) => p) : r; };
export const rolePages = (role: Role): string[] => PAGES.filter((p) => p.key !== "audit" || role === "admin" || role === "supervisor").map((p) => p.key);

/** يقدر يعمل الإجراء؟ (الدور، أو صلاحيات الموظف المخصصة لو المدير حددها) */
export function can(s: Subject, p: Perm): boolean {
  const role = roleOf(s);
  if (role === "admin") return true;
  if (p === "admin") return false;
  const custom = permsOf(s)?.actions;
  if (custom) return custom.includes(p);
  const r = PERMS[role];
  return r === "*" || r.includes(p);
}

/** يقدر يشوف الصفحة؟ */
export function canSee(s: Subject, pageKey: string): boolean {
  const role = roleOf(s);
  if (role === "admin") return true;
  const custom = permsOf(s)?.pages;
  return custom ? custom.includes(pageKey) : rolePages(role).includes(pageKey);
}

/** الصفحة اللي المسار ده تبعها (أو null لو مفتوحة للكل) */
export function pageOfPath(path: string): string | null {
  const hit = PAGES.find((p) => p.paths.some((x) => path === x || path.startsWith(x + "/")));
  return hit?.key ?? null;
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "مدير", supervisor: "مشرف", finance: "مالي", staff: "موظف", viewer: "قراءة فقط",
};
export const ROLE_DESC: Record<Role, string> = {
  admin: "كل الصلاحيات، الإعدادات، المستخدمون",
  supervisor: "كل التشغيل + إسناد المهام، الاعتمادات، الإرجاع للتصحيح، إيقاف وإغلاق القرارات، مراجعة التعارض",
  finance: "تسجيل التحويلات والاستردادات + التشغيل اليومي",
  staff: "الحالات، القرارات، استكمال البيانات، الإرسال، المتابعة، العمليات، المهام",
  viewer: "عرض فقط",
};
