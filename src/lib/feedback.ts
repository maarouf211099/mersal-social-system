// تقييم النظام — التحقق من الرد وصلاحية عرض النتائج (منطق خالص من غير قاعدة، عشان يتختبر)

export const FEEDBACK_CAMPAIGN = "eval-2026-11";
/** الشخص الوحيد اللي يشوف النتائج: الجزء اللي قبل @ في إيميله (مش الإيميل كامل) */
export const DEFAULT_RESULTS_USER = "mahmoud.maarouf";

export type FeedbackInput = {
  overall: number;
  ease: number | null;
  speed: number | null;
  value: number | null;
  problems: string;
  ideas: string;
  department: string;
  name: string | null;
};

type Parsed = { ok: true; data: FeedbackInput } | { ok: false; error: string };

const SCORE_LABELS = { ease: "سهولة الاستخدام", speed: "السرعة والثبات", value: "تسهيل الشغل" } as const;

const isScore = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;

function optText(v: unknown): string | null | undefined {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") return undefined;
  return v.trim();
}

export function parseFeedback(body: unknown): Parsed {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "بيانات التقييم مش مظبوطة." };
  const b = body as Record<string, unknown>;

  if (!isScore(b.overall)) return { ok: false, error: "من فضلك اختار التقييم العام (من 1 لـ 5 نجوم)." };
  const scores = { ease: null, speed: null, value: null } as Record<keyof typeof SCORE_LABELS, number | null>;
  for (const k of Object.keys(SCORE_LABELS) as (keyof typeof SCORE_LABELS)[]) {
    const v = b[k];
    if (v === undefined || v === null) continue;
    if (!isScore(v)) return { ok: false, error: `تقييم «${SCORE_LABELS[k]}» لازم يكون من 1 لـ 5.` };
    scores[k] = v;
  }

  if (typeof b.department !== "string" || !b.department.trim()) return { ok: false, error: "من فضلك اكتب الإدارة أو القسم." };
  const department = b.department.trim();
  if (department.length > 120) return { ok: false, error: "اسم الإدارة أو القسم طويل (الحد 120 حرف)." };

  const name = optText(b.name);
  if (name === undefined) return { ok: false, error: "الاسم مش مظبوط." };
  if (name && name.length > 120) return { ok: false, error: "الاسم طويل (الحد 120 حرف)." };

  const problems = optText(b.problems);
  const ideas = optText(b.ideas);
  if (problems === undefined || ideas === undefined) return { ok: false, error: "الملاحظات لازم تكون نص." };
  if ((problems ?? "").length > 2000) return { ok: false, error: "خانة المشاكل والأخطاء طويلة (الحد 2000 حرف)." };
  if ((ideas ?? "").length > 2000) return { ok: false, error: "خانة الإضافات والتعديلات طويلة (الحد 2000 حرف)." };

  return {
    ok: true,
    data: { overall: b.overall, ...scores, problems: problems ?? "", ideas: ideas ?? "", department, name: name || null },
  };
}

/**
 * النتائج لشخص واحد بس: المستخدم اللي الجزء اللي قبل @ في إيميله = FEEDBACK_RESULTS_USER
 * (من غير فرق بين الحروف الكبيرة والصغيرة). النظام ده بيعرّف المستخدمين بالإيميل، مفيش username.
 */
export function canViewFeedbackResults(email: string | null | undefined, allowed?: string | null): boolean {
  const want = (allowed ?? "").trim().toLowerCase() || DEFAULT_RESULTS_USER;
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  if (want.includes("@")) return e === want; // لو اتحط الإيميل كامل في الإعداد
  const at = e.lastIndexOf("@");
  const local = at === -1 ? e : e.slice(0, at);
  return local === want;
}
