import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFeedback, canViewFeedbackResults, isResultsUser } from "./feedback.ts";

const ok = { overall: 4, ease: 5, speed: null, value: 3, problems: " بطء ", ideas: "", department: " الإدارة الاجتماعية ", name: "" };

test("تقييم صحيح يتنضف ويتقبل", () => {
  const p = parseFeedback(ok);
  assert.equal(p.ok, true);
  if (!p.ok) return;
  assert.deepEqual(p.data, { overall: 4, ease: 5, speed: null, value: 3, problems: "بطء", ideas: "", department: "الإدارة الاجتماعية", name: null });
});
test("التقييم العام إجباري ورقم صحيح من 1 لـ 5", () => {
  for (const overall of [undefined, null, 0, 6, 3.5, "4", NaN]) assert.equal(parseFeedback({ ...ok, overall }).ok, false);
  for (const overall of [1, 5]) assert.equal(parseFeedback({ ...ok, overall }).ok, true);
});
test("باقي الدرجات اختيارية لكن من 1 لـ 5 لو موجودة", () => {
  assert.equal(parseFeedback({ ...ok, ease: undefined, speed: undefined, value: undefined }).ok, true);
  for (const ease of [0, 7, 2.5, "3"]) assert.equal(parseFeedback({ ...ok, ease }).ok, false);
});
test("الإدارة إجبارية وبحد 120، والاسم 120، والملاحظات 2000", () => {
  assert.equal(parseFeedback({ ...ok, department: "   " }).ok, false);
  assert.equal(parseFeedback({ ...ok, department: 5 }).ok, false);
  assert.equal(parseFeedback({ ...ok, department: "x".repeat(121) }).ok, false);
  assert.equal(parseFeedback({ ...ok, department: "x".repeat(120) }).ok, true);
  assert.equal(parseFeedback({ ...ok, name: "x".repeat(121) }).ok, false);
  assert.equal(parseFeedback({ ...ok, problems: "x".repeat(2001) }).ok, false);
  assert.equal(parseFeedback({ ...ok, ideas: "x".repeat(2001) }).ok, false);
  assert.equal(parseFeedback({ ...ok, ideas: ["x"] }).ok, false);
  assert.equal(parseFeedback(null).ok, false);
  assert.equal(parseFeedback([ok]).ok, false);
});
test("رسائل الخطأ بالعربي", () => {
  const p = parseFeedback({ ...ok, department: "" });
  assert.equal(p.ok, false);
  if (!p.ok) assert.match(p.error, /الإدارة/);
});
test("الشخص المحدد يتعرف من الجزء اللي قبل @ في الإيميل", () => {
  assert.equal(isResultsUser("Mahmoud.Maarouf@example.org"), true);
  assert.equal(isResultsUser("mahmoud.maarouf@other.test", ""), true);
  assert.equal(isResultsUser("admin@example.org"), false);
  assert.equal(isResultsUser("mahmoud.maarouf2@example.org"), false);
  assert.equal(isResultsUser("x.mahmoud.maarouf@example.org"), false);
  assert.equal(isResultsUser(""), false);
  assert.equal(isResultsUser(null), false);
  assert.equal(isResultsUser("someone@example.org", "Someone"), true);
  assert.equal(isResultsUser("mahmoud.maarouf@example.org", "someone"), false);
  assert.equal(isResultsUser("a@x.test", "a@x.test"), true);
  assert.equal(isResultsUser("a@y.test", "a@x.test"), false);
});
test("النتائج للمدير (admin) + الشخص المحدد بس", () => {
  assert.equal(canViewFeedbackResults({ email: "boss@example.org", role: "admin" }), true);
  for (const role of ["supervisor", "finance", "staff", "viewer", "ADMIN", ""]) {
    assert.equal(canViewFeedbackResults({ email: "x@example.org", role }), false, role);
  }
  assert.equal(canViewFeedbackResults({ email: "mahmoud.maarouf@example.org", role: "viewer" }), true);
  assert.equal(canViewFeedbackResults({ email: "mahmoud.maarouf@example.org", role: "staff" }, "someone"), false);
  assert.equal(canViewFeedbackResults(null), false);
});
