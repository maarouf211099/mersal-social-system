// مرحلة الاستحقاق — تُحسب من البيانات ولا تُخزّن، فلا يمكن أن تتناقض معها
export type Stage =
  | "due" | "hold" | "needconf" | "conf" | "sent" | "trans" | "wait" | "noans"
  | "recv" | "deliv" | "notpaid" | "stuck" | "refund" | "stop";

export const STAGES: Record<Stage, { label: string; tone: "" | "ok" | "warn" | "bad" | "info" }> = {
  due: { label: "مستحق للصرف", tone: "" },
  hold: { label: "معلّق على الشهر السابق", tone: "warn" },
  needconf: { label: "يحتاج تأكيد بيانات", tone: "warn" },
  conf: { label: "تم تأكيد البيانات", tone: "info" },
  sent: { label: "تم الإرسال", tone: "info" },
  trans: { label: "تم التحويل", tone: "info" },
  wait: { label: "في انتظار المتابعة", tone: "info" },
  noans: { label: "لم يتم الرد", tone: "bad" },
  recv: { label: "تم الرد وتم الصرف", tone: "ok" },
  deliv: { label: "تم التسليم", tone: "ok" },
  notpaid: { label: "لم يتم الصرف", tone: "bad" },
  stuck: { label: "متعثر", tone: "bad" },
  refund: { label: "مسترد", tone: "warn" },
  stop: { label: "موقوف", tone: "" },
};
export const FINAL: Stage[] = ["recv", "deliv"];
export const NOT_RECEIVED: Stage[] = ["noans", "notpaid", "refund", "stuck"];

export type Kind = "financial" | "card" | "in_kind" | "service";

export type StageInput = {
  kind: Kind;
  needsFollow: boolean;
  amount: number;
  needsConfirm: boolean;
  confirmedAt: Date | null;
  holdApprovedAt: Date | null;
  sentAt: Date | null;
  legacySent: boolean;
  followResult: "none" | "received" | "not_received" | "no_answer";
  stuckReason: string;
  stoppedAt: Date | null;
  transfer: { amount: number; date: Date } | null;
  refundTotal: number;
  unanswered: number; // محاولات متابعة بدون رد (غير الملغاة)
  prevResolved: boolean | null; // الشهر السابق لنفس الخدمة: null = لا يوجد
  followDays: number;
  now?: Date;
};

/** هل الخدمة تحتاج متابعة قبل اعتبارها مستلمة */
export const followRequired = (kind: Kind, needsFollow: boolean) => kind === "financial" || kind === "card" || needsFollow;

/** المبلغ المحوّل فعلاً (المستورد من النظام السابق كـ«تم الإرسال» يُحسب بقيمة الاستحقاق) */
export function transferredAmount(e: Pick<StageInput, "transfer" | "legacySent" | "kind" | "amount">) {
  if (e.transfer) return e.transfer.amount;
  if (e.legacySent && e.kind === "financial") return e.amount;
  return 0;
}

export function stageOf(e: StageInput): Stage {
  const now = e.now ?? new Date();
  if (e.stoppedAt) return "stop";
  const tr = transferredAmount(e);
  if (tr > 0 && e.refundTotal >= tr) return "refund";
  const follow = followRequired(e.kind, e.needsFollow);
  if (e.followResult === "received") return e.kind === "in_kind" && !follow ? "deliv" : "recv";
  if (e.followResult === "no_answer") return "noans";
  if (e.followResult === "not_received") return "notpaid";
  if (e.stuckReason) return "stuck";
  if (e.sentAt || e.legacySent) {
    if (!follow) return "deliv";
    if (e.unanswered > 0) return "noans";
    if (e.kind === "financial") {
      if (!e.transfer && !e.legacySent) return "sent";
      if (!e.transfer) return "wait";
      return now.getTime() - e.transfer.date.getTime() >= e.followDays * 864e5 ? "wait" : "trans";
    }
    return "wait";
  }
  if (!e.holdApprovedAt && e.prevResolved === false) return "hold";
  if (e.needsConfirm) return e.confirmedAt ? "conf" : "needconf";
  return "due";
}

/** الشهر «مُنتهٍ» لأغراض إدراج الشهر التالي: استُلم، أو أُوقف، أو تمت تسويته */
export const isResolved = (s: Stage, settled: boolean) => FINAL.includes(s) || s === "stop" || settled;
export const canSend = (s: Stage) => s === "due" || s === "conf";
export const canFollow = (s: Stage) => s === "trans" || s === "wait" || s === "noans";

/** المبلغ الذي وصل للمستفيد فعلاً */
export function netReceived(s: Stage, transferred: number, amount: number, refundTotal: number) {
  return FINAL.includes(s) ? Math.max(0, (transferred || amount) - refundTotal) : 0;
}
