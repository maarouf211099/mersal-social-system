// قوائم مرجعية — العربية في الشاشات، والقيم الإنجليزية في القاعدة
export const NATS = ["مصري", "سوداني", "فلسطيني", "سوري", "يمني", "إريتري", "إثيوبي", "صومالي", "جنوب سوداني", "عراقي", "تشادي", "أردني", "نيجيري", "بوروندي", "جيبوتي", "غيني", "جنوب أفريقي", "أفريقي وسطى", "سورينامي", "أخرى"];
export const GOVS = ["القاهرة", "الجيزة", "القليوبية", "الإسكندرية", "الشرقية", "الدقهلية", "الغربية", "المنوفية", "البحيرة", "كفر الشيخ", "دمياط", "بورسعيد", "الإسماعيلية", "السويس", "الفيوم", "بني سويف", "المنيا", "أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان", "البحر الأحمر", "مطروح", "الوادي الجديد", "شمال سيناء", "جنوب سيناء"];
export const RECV_METHODS = ["البريد", "بريد مندوب", "SMS", "المعادي", "فيزا", "مندوب مالي", "مندوب حفاضات", "إسكندرية", "مندوب إسكندرية", "محفظة إلكترونية", "إنستاباي", "حوالة بريدية", "حساب بنكي", "كاش من الفرع", "مندوب"];
export const WALLET_METHODS = ["محفظة إلكترونية", "إنستاباي", "SMS"];
export const RELIGIONS = ["مسلم", "مسيحي", "غير مسلم"];
export const RESIDENCY = ["مصري", "لها إقامة", "بدون إقامة", "فيزا", "دار رعاية", "استثناء من الإقامة", "فوق 60 عام"];
export const NOTPAID_REASONS = ["رقم المحفظة خطأ", "لم يصل التحويل", "تم سحب المبلغ من شخص آخر", "الحالة مسافرة / غير متاحة", "مشكلة في الكارت", "المستفيد لم يذهب للاستلام", "سبب آخر"];
export const REFUND_REASONS = ["رقم محفظة خطأ", "عدم الاستلام خلال المدة", "تحويل مكرر", "وفاة / سفر المستفيد", "إيقاف القرار", "سبب آخر"];
export const TEAMS = ["ملف الحفاضات", "ملف العيني", "ملف المالي", "ملف التواصل", "عام"];

export const KIND_LABELS = { financial: "مالي", card: "كارت", in_kind: "عيني", service: "خدمة" } as const;
export const CYCLE_LABELS = { monthly: "شهري", once: "مرة واحدة", coverage: "تغطية طوال المدة" } as const;
export const POLICY_LABELS = { carry: "ترحيل المبلغ غير المستلم على الشهر التالي", extend: "تمديد مدة الخدمة شهراً بدل الشهر غير المستلم", drop: "لا تعويض (يسقط الشهر)" } as const;
export const DEC_STATUS_LABELS = { active: "مستمر", stopped: "موقوف", withdrawn: "مسحوب", ended: "منتهي" } as const;
export const RENEWAL_LABELS = { none: "لم يُرسل", sent: "أُرسلت للتجديد", renewed: "تم التجديد", not_renewed: "لم يُجدد" } as const;
export const TASK_STATUS_LABELS = { new: "جديدة", in_progress: "قيد التنفيذ", done: "مكتملة", stuck: "متعثرة", cancelled: "ملغاة" } as const;
export const TASK_KIND_LABELS = { confirm: "تأكيد بيانات", follow: "متابعة صرف", action: "معالجة", manual: "يدوية" } as const;
export const OP_STATUS_LABELS = { new: "جديد", in_progress: "جاري", done: "تم" } as const;
export const REFUND_TYPE_LABELS = { full: "كلي", partial: "جزئي" } as const;
export const SETTLEMENT_LABELS = { pending: "معلقة", settled: "تمت التسوية" } as const;

export const CASE_FIELDS: [string, string][] = [
  ["name", "اسم الحالة"], ["birthDate", "تاريخ الميلاد"], ["gender", "النوع"], ["nationality", "الجنسية"], ["familySize", "عدد الأفراد"],
  ["governorate", "المحافظة"], ["area", "المنطقة"], ["address", "العنوان"], ["age", "السن"], ["religion", "الديانة"], ["description", "وصف الحالة"],
  ["residencyStatus", "موقف الإقامة"], ["residencyExpiry", "انتهاء الإقامة"], ["idExpiry", "انتهاء الرقم القومي"], ["phone", "هاتف"], ["phone2", "هاتف بديل"], ["unhcr", "رقم المفوضية"],
  ["recvMethod", "طريقة الاستلام"], ["recvName", "اسم المستلم"], ["recvPhone", "رقم الاستلام / المحفظة"], ["recvIdNo", "الرقم القومي / إثبات الشخصية"],
  ["recvBranch", "الفرع / مكتب البريد"], ["notes", "ملاحظات"],
];

// عمليات يسجلها النظام تلقائياً مع كل خطوة في دورة العمل
export const AUTO_OPS = {
  decision: "تسجيل قرار",
  caseUpdate: "تحديث بيانات حالة",
  generate: "توليد استحقاقات الشهر",
  confirm: "مكالمة تاكيد بيانات",
  send: "إرسال ضمن دفعة الصرف",
  sendCard: "تسليم كروت كازيون",
  sendInKind: "تسليم مساعدة عينية",
  serviceDone: "تنفيذ خدمة",
  resendCard: "إعادة إرسال كارت",
  correction: "تصحيح بيانات مالية",
  transfer: "تسجيل تحويل مالي",
  follow: "مكالمة متابعة صرف",
  refund: "تسجيل استرداد",
  action: "معالجة عدم صرف",
  renewal: "ارسال الحالة للمناقشة او البحث لخدمة جديدة",
  closeDecision: "إغلاق قرار",
  manualTask: "مهمة يدوية",
} as const;
