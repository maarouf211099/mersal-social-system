import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildSnapshot, exportFeedbackSnapshot, sharedDir, writeSnapshotFile } from "./feedback-snapshot.ts";

test("فولدر الملف المشترك: من الإعداد، أو الافتراضي حسب نظام التشغيل", () => {
  assert.equal(sharedDir({ FEEDBACK_SHARED_DIR: " D:\\x " }, "win32"), "D:\\x");
  assert.equal(sharedDir({}, "win32"), "C:\\ProgramData\\mersal-feedback");
  assert.equal(sharedDir({}, "linux"), path.join(os.tmpdir(), "mersal-feedback"));
});

test("الملف فيه الحقول المسموحة بس — من غير معرّف المستخدم", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "fb-snap-"));
  try {
    const rows = [{ id: "row1", userId: "user-secret-id", campaign: "eval-2026-11", createdAt: new Date("2026-11-17T10:00:00Z"), department: "ملف المالي", name: null, overall: 4, ease: 5, speed: null, value: 3, problems: "", ideas: "فكرة" }];
    const file = await writeSnapshotFile(dir, buildSnapshot(rows as any, new Date("2026-11-17T11:00:00Z")));
    assert.equal(path.basename(file), "social.json");
    assert.deepEqual(await readdir(dir), ["social.json"]); // الـ .tmp اتشال
    const text = await readFile(file, "utf8");
    assert.ok(!text.includes("user-secret-id") && !text.includes("userId") && !text.includes("row1"));
    const j = JSON.parse(text);
    assert.equal(j.system, "social"); assert.equal(j.name, "نظام الإدارة الاجتماعية"); assert.equal(j.campaign, "eval-2026-11");
    assert.equal(j.updatedAt, "2026-11-17T11:00:00.000Z");
    assert.deepEqual(j.rows, [{ createdAt: "2026-11-17T10:00:00.000Z", department: "ملف المالي", name: null, overall: 4, ease: 5, speed: null, value: 3, problems: "", ideas: "فكرة" }]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("فشل القاعدة أو الكتابة مايرميش خطأ", async () => {
  const bad = { feedback: { findMany: async () => { throw new Error("db down"); } } } as any;
  const warn = console.warn; console.warn = () => {};
  try { await exportFeedbackSnapshot(bad); } finally { console.warn = warn; }
});
