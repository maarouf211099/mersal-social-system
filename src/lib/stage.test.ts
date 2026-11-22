import { test } from "node:test";
import assert from "node:assert/strict";
import { stageOf, type StageInput, isResolved, canSend, canFollow } from "./stage.ts";
import { addMonths, spanMonths, suggestStart, fmtMonth } from "./months.ts";

const base: StageInput = {
  kind: "financial", needsFollow: true, amount: 1000, needsConfirm: false, confirmedAt: null, holdApprovedAt: null,
  sentAt: null, legacySent: false, followResult: "none", stuckReason: "", stoppedAt: null, transfer: null,
  refundTotal: 0, unanswered: 0, prevResolved: null, followDays: 3, now: new Date("2026-11-20T10:00:00Z"),
};
const d = (s: string) => new Date(s);

test("حالة جديدة تحتاج تأكيد ولا يمكن إرسالها", () => {
  const s = stageOf({ ...base, needsConfirm: true });
  assert.equal(s, "needconf"); assert.equal(canSend(s), false);
  assert.equal(stageOf({ ...base, needsConfirm: true, confirmedAt: d("2026-11-02") }), "conf");
});
test("الشهر المؤجل مش بيعلّق الشهر الجديد — الاتنين يتشغّل عليهم عادي", () => {
  assert.equal(stageOf({ ...base, prevResolved: false }), "due");
  assert.equal(stageOf({ ...base, prevResolved: true }), "due");
});
test("بيانات الاستلام الناقصة بتقفل الإرسال والمتابعة", () => {
  const s = stageOf({ ...base, missing: true });
  assert.equal(s, "missing"); assert.equal(canSend(s), false); assert.equal(canFollow(s), false);
  assert.equal(stageOf({ ...base, missing: true, sentAt: d("2026-11-05") }), "missing");
  assert.equal(stageOf({ ...base, missing: true, needsConfirm: true }), "missing");
  assert.equal(stageOf({ ...base, missing: true, followResult: "received", sentAt: d("2026-11-05") }), "recv");
});
test("المتابعة بتبدأ أول ما الخدمة تتبعت", () => {
  assert.equal(canFollow(stageOf({ ...base, sentAt: d("2026-11-05") })), true);
  assert.equal(stageOf({ ...base, sentAt: d("2026-11-05"), unanswered: 1 }), "noans");
});
test("الإرسال ثم التحويل لا يعني الاستلام", () => {
  assert.equal(stageOf({ ...base, sentAt: d("2026-11-05") }), "sent");
  assert.equal(stageOf({ ...base, sentAt: d("2026-11-05"), transfer: { amount: 1000, date: d("2026-11-19") } }), "trans");
  assert.equal(stageOf({ ...base, sentAt: d("2026-11-05"), transfer: { amount: 1000, date: d("2026-11-10") } }), "wait");
});
test("المتابعة: عدم الرد، الرد بالصرف، الرد بعدم الصرف", () => {
  const t = { ...base, sentAt: d("2026-11-05"), transfer: { amount: 1000, date: d("2026-11-10") } };
  assert.equal(stageOf({ ...t, unanswered: 2 }), "noans");
  assert.equal(stageOf({ ...t, followResult: "no_answer", unanswered: 3 }), "noans");
  assert.equal(stageOf({ ...t, followResult: "received" }), "recv");
  assert.equal(stageOf({ ...t, followResult: "not_received" }), "notpaid");
});
test("الاسترداد الكلي يجعل الاستحقاق مسترداً", () => {
  const t = { ...base, sentAt: d("2026-11-05"), transfer: { amount: 1000, date: d("2026-11-10") } };
  assert.equal(stageOf({ ...t, refundTotal: 1000 }), "refund");
  assert.equal(stageOf({ ...t, refundTotal: 400 }), "wait");
});
test("العيني بدون متابعة: التسليم = استلام", () => {
  assert.equal(stageOf({ ...base, kind: "in_kind", needsFollow: false, sentAt: d("2026-11-05") }), "deliv");
  assert.equal(stageOf({ ...base, kind: "in_kind", needsFollow: true, sentAt: d("2026-11-05") }), "wait");
});
test("الإيقاف يسبق أي حالة", () => {
  assert.equal(stageOf({ ...base, stoppedAt: d("2026-11-01"), needsConfirm: true }), "stop");
  assert.equal(isResolved("stop", false), true);
  assert.equal(isResolved("noans", true), true);
  assert.equal(isResolved("noans", false), false);
});
test("الشهور", () => {
  assert.equal(addMonths("2026-11", 3), "2027-02");
  assert.equal(spanMonths("2026-11", "2027-01"), 3);
  assert.equal(suggestStart("2026-10-18"), "2026-11");
  assert.equal(suggestStart("2026-10-19"), "2026-12");
  assert.equal(fmtMonth("2026-11"), "نوفمبر 2026");
});
