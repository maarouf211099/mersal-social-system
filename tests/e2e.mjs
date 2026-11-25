// اختبار الدورة الكاملة في متصفح حقيقي على قاعدة اختبار فاضية
//   BASE_URL=http://localhost:3011 ADMIN_EMAIL=... ADMIN_PASSWORD=... node tests/e2e.mjs
// ⚠️ لا يُشغَّل على قاعدة الإنتاج — بيضيف حالات وقرارات تجريبية
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright"); // npm i -D playwright

const BASE = process.env.BASE_URL || "http://localhost:3011";
const EMAIL = process.env.ADMIN_EMAIL || "admin@mersal-ngo.org";
const PW = process.env.ADMIN_PASSWORD || "Admin12345!";
const NEW_PW = process.env.ADMIN_NEW_PASSWORD || "Admin-Strong-2026";
const SHOTS = process.env.SHOTS || "";
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✔" : "✖"} ${msg}`); if (!cond) failures++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "ar-EG", timezoneId: "Africa/Cairo" });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(`${e.message.slice(0, process.env.FULLERR ? 900 : 60)} @ ${p.url().replace(BASE, "")}`));
if (process.env.FULLERR) p.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE:", m.text().slice(0, 1500)); });
const go = async (path) => { await p.waitForLoadState("networkidle").catch(() => {}); return p.goto(BASE + path, { waitUntil: "networkidle" }); };
const alertText = async () => { await p.waitForSelector(".alert.ok, .alert.bad", { timeout: 15000 }); return (await p.locator(".alert.ok, .alert.bad").last().innerText()).trim(); };
const fb = () => p.evaluate(() => [...document.querySelectorAll(".alert.ok, .alert.bad")].map((x) => x.textContent).join("|"));
/** يضغط الزرار ويستنى رسالة جديدة (مش الرسالة القديمة اللي كانت ظاهرة) */
const submit = async (text) => {
  const before = await fb();
  await p.getByRole("button", { name: text, exact: true }).first().click();
  await p.waitForFunction((b) => { const t = [...document.querySelectorAll(".alert.ok, .alert.bad")].map((x) => x.textContent).join("|"); return t && t !== b; }, before, { timeout: 20000 }).catch(() => {});
  await p.waitForLoadState("networkidle"); // ما نسيبش الصفحة وتحديثها لسه شغال (يمنع أخطاء hydration وهمية)
  return alertText();
};
const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
const addM = (m, n) => { const [y, mo] = m.split("-").map(Number); const i = y * 12 + mo - 1 + n; return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`; };
const prevDay5 = `${addM(month, -1)}-05`; // قرار بتاريخ 5 الشهر اللي فات → يبدأ الشهر الحالي

// ── الدخول وتغيير كلمة المرور المؤقتة
await go("/login");
await p.getByLabel("الإيميل").fill(EMAIL);
await p.getByLabel("كلمة المرور").fill(PW);
await p.getByRole("button", { name: "دخول" }).click();
await p.waitForURL((u) => !u.pathname.startsWith("/login"));
await p.waitForLoadState("networkidle");
if (p.url().includes("/account")) {
  await p.getByLabel("كلمة المرور الحالية").fill(PW);
  await p.getByLabel("الجديدة (10 حروف على الأقل)").fill(NEW_PW);
  await p.getByLabel("تأكيد الجديدة").fill(NEW_PW);
  await p.getByRole("button", { name: "حفظ" }).click();
  await p.waitForURL(BASE + "/");
}
ok(p.url() === BASE + "/", "الدخول وتغيير كلمة المرور المؤقتة");

// ── قرار جديد بكود جديد → يسجل الحالة والقرار
await go("/decisions/new");
await p.getByLabel("كود الحالة *").fill("5001");
await p.locator('input[name="name"]').fill("حالة اختبار أولى");
await p.getByLabel("تاريخ القرار").fill(prevDay5);
await p.locator('input[name="amount"]').fill("1000");
await p.locator('input[name="months"]').fill("3");
await p.getByRole("button", { name: "حفظ القرار" }).click();
await p.waitForURL(/\/cases\/5001/);
ok(p.url().includes("/cases/5001"), "قرار جديد بكود جديد سجّل الحالة وفتح ملفها");

// ── قرار متعارض لنفس الخدمة → مرفوض
await go("/decisions/new?code=5001");
await p.getByLabel("تاريخ القرار").fill(prevDay5);
await p.locator('input[name="amount"]').fill("800");
ok((await submit("حفظ القرار")).includes("سارية للحالة"), "منع قرار متعارض لنفس الخدمة");

// ── توليد الشهر → الحالة الجديدة تحتاج تأكيد ولا تُرسل
await go(`/cycle?m=${month}`);
await p.getByRole("button", { name: /^توليد استحقاقات/ }).click();
ok((await alertText()).includes("تم توليد 1"), "توليد استحقاقات الشهر");
await go(`/cycle?m=${month}`);
ok(await p.locator("text=بيانات استلام ناقصة").count() > 0, "الحالة الجديدة: بيانات استلام ناقصة");
ok(await p.getByRole("button", { name: "إرسال المحدد ضمن دفعة" }).isDisabled(), "الإرسال والبيانات ناقصة غير متاح");
await go(`/data?m=${month}`);
ok(await p.locator("td", { hasText: "5001" }).count() > 0, "الحالة نزلت «استكمال البيانات»");

// ── مكالمة التأكيد: بدون طريقة استلام مرفوضة، ثم كاملة
await p.locator("a[href^='/cycle/c']").first().click();
await p.waitForURL(/\/cycle\/c/); await p.waitForLoadState("networkidle");
const entUrl = p.url();
await p.getByLabel("نتيجة المكالمة *").selectOption("updated");
await p.getByLabel("هاتف", { exact: true }).fill("01012345678");
ok((await submit("حفظ النتيجة")).includes("لسه ناقص"), "استكمال جزئي: بيتحفظ والحالة تفضل ناقصة");
await p.goto(entUrl, { waitUntil: "networkidle" });
await p.getByLabel("نتيجة المكالمة *").selectOption("updated");
await p.getByLabel("اسم المستلم").fill("مستلم اختبار");
await p.getByLabel("الرقم القومي / إثبات الشخصية").fill("29001011234567");
await p.getByLabel("موقف الإقامة").selectOption("مصري");
ok((await submit("حفظ النتيجة")).includes("طريقة الاستلام"), "المالي: طريقة الاستلام مطلوبة قبل الإرسال");
await p.getByLabel("طريقة الاستلام").selectOption("محفظة إلكترونية");
await p.getByLabel("رقم الاستلام / المحفظة").fill("01112345678");
ok((await submit("حفظ النتيجة")).includes("اكتملت بيانات الاستلام"), "اكتمال البيانات وتحديث MASTER");

// ── الإرسال في دفعة ثم التحويل
await go(`/cycle?m=${month}`);
await p.locator('input[name="ids"]').first().check();
ok((await submit("إرسال المحدد ضمن دفعة")).includes("أُرسلت 1"), "الإرسال ضمن دفعة");
await go(`/cycle?m=${month}`);
await p.locator("summary", { hasText: "تسجيل التحويل للمحدد" }).click();
await p.locator('input[name="ids"]').first().check();
ok((await submit("حفظ التحويل")).includes("إلزامية"), "التحويل بدون طريقة/مرجع مرفوض");
await p.goto(entUrl, { waitUntil: "networkidle" });
await p.getByLabel("طريقة التحويل *").selectOption("محفظة إلكترونية");
await p.getByLabel("رقم المرجع *").fill("TRX-777");
ok((await submit("حفظ التحويل")).includes("لا يعني الاستلام"), "تسجيل التحويل (لا يعني الاستلام)");

// ── المتابعة: 3 محاولات بدون رد
for (let i = 1; i <= 3; i++) {
  await p.goto(entUrl, { waitUntil: "networkidle" });
  const msg = await submit("لم يرد");
  ok(i < 3 ? msg.includes(`المحاولة ${i}`) : msg.includes("مسؤولية الموظف مستوفاة"), `محاولة متابعة ${i}`);
}

// ── استرداد كامل
await p.goto(entUrl, { waitUntil: "networkidle" });
await p.locator("summary", { hasText: "تسجيل استرداد" }).click();
await p.locator("details[open] select[name=reason]").selectOption("عدم الاستلام خلال المدة");
ok((await submit("حفظ الاسترداد")).includes("كلي"), "الاسترداد الكلي");

// ── الشهر التالي: مش متعلّق على السابق، وبيتشغّل عليه عادي
const next = addM(month, 1);
await go(`/cycle?m=${next}`);
await p.getByRole("button", { name: /^توليد استحقاقات/ }).click(); await p.waitForSelector(".alert.ok"); await p.waitForLoadState("networkidle");
await go(`/cycle?m=${next}`);
ok(await p.locator("text=معلّق على الشهر السابق").count() === 0 && await p.locator("text=مستحق للصرف").count() > 0, "الشهر التالي جاهز للإرسال (مفيش تعليق)");

// ── لا استحقاق بعد نهاية القرار
await go(`/cycle?m=${addM(month, 3)}`);
await p.getByRole("button", { name: /^توليد استحقاقات/ }).click();
ok((await alertText()).includes("لا يُنشأ استحقاق بعد"), "لا استحقاقات بعد نهاية القرار");

// ── التجديد قبل الانتهاء بشهرين
await go(`/renewal?m=${month}`);
ok(await p.locator("text=5001").count() > 0, "القرار يظهر في قائمة التجديد قبل نهايته بشهرين");
await p.locator('input[name="ids"]').first().check();
ok((await submit("إرسال المحدد للتجديد")).includes("أُرسلت 1"), "الإرسال للتجديد");

// ── عملية يدوية بالمنفذ ووقت التسجيل
await go(`/ops?code=5001`);
const optVal = await p.locator('select[name="typeId"] option', { hasText: "مكالمات معرض الملابس" }).first().getAttribute("value");
await p.locator('select[name="typeId"]').selectOption(optVal);
await p.getByLabel("النتيجة").fill("تم الحجز");
ok((await submit("حفظ العملية")).includes("باسمك"), "تسجيل عملية يدوية");
await go(`/ops`);
ok(await p.locator("td", { hasText: "مكالمات معرض الملابس" }).count() > 0, "العملية ظاهرة في السجل باسم المنفذ ووقت التسجيل");

// ── تعديل بيانات الحالة يحفظ القديم والجديد
await go("/cases/5001/edit");
await p.getByLabel("المحافظة").selectOption("الجيزة");
await p.getByRole("button", { name: "حفظ التعديلات" }).click();
await p.waitForURL(/\/cases\/5001\?saved/);
ok((await p.locator(".chg").first().innerText()).includes("الجيزة"), "سجل تعديل البيانات بالقيمة الجديدة");

// ── التقارير والتصدير والتدقيق
for (const v of ["month", "staff", "ops", "compare"]) { await go(`/reports?view=${v}&m=${month}`); ok(await p.locator(".page-head h1").innerText() === "التقارير", `تقرير: ${v}`); }
const csv = await p.request.get(`${BASE}/api/export/month?m=${month}`);
ok(csv.status() === 200 && (await csv.text()).includes("5001"), "تصدير CSV");
await go("/audit"); ok(await p.locator("td", { hasText: "تسجيل تحويل" }).count() > 0, "سجل التدقيق");
if (SHOTS) { await go(`/?m=${month}`); await p.screenshot({ path: `${SHOTS}/dashboard.png`, fullPage: true }); await go(`/cycle?m=${next}`); await p.screenshot({ path: `${SHOTS}/cycle.png` }); }

// ── الإضافات: عدم الرد لشهرين، تصحيح التحويل، المرفقات، الخدمات غير الشهرية، إعادة إرسال الكارت
const nextEnt = await (async () => { await go(`/cycle?m=${next}`); return p.locator("a[href^='/cycle/c']").first().getAttribute("href"); })();
await p.locator('input[name="ids"]').first().check();
await submit("إرسال المحدد ضمن دفعة");
await go(nextEnt);
await p.getByLabel("طريقة التحويل *").selectOption("محفظة إلكترونية"); await p.getByLabel("رقم المرجع *").fill("TRX-778");
await submit("حفظ التحويل");
for (let i = 1; i <= 3; i++) { await go(nextEnt); await submit("لم يرد"); }
await go("/renewal?view=noreply");
ok(await p.locator("td", { hasText: "5001" }).count() > 0, "قائمة عدم الرد لشهرين متتاليين");
// ── قائمة الغلق: شهرين ورا بعض بدون رد → غلق الخدمة بسبب + شيت للإيميل
await go("/closing");
ok(await p.locator("td", { hasText: "5001" }).count() > 0, "الخدمة نزلت «قائمة الغلق»");
const clx = await p.request.get(BASE + "/api/export/closing?format=xlsx");
ok(clx.status() === 200 && (await clx.body())[0] === 0x50, "شيت المرشحة للغلق Excel");
await p.locator('input[name="ids"]').first().check();
ok((await submit("غلق الخدمة للمحدد")).includes("اتقفلت 1"), "غلق الخدمة بسبب");
await go(`/closing?view=closed&m=${month}`);
ok(await p.locator("td", { hasText: "5001" }).count() > 0, "الخدمة ظاهرة في «اتقفلت» للإثبات");
await p.goto(entUrl, { waitUntil: "networkidle" });
await p.locator("summary", { hasText: "تصحيح بيانات التحويل" }).click();
await p.locator('details[open] input[name="ref"]').fill("TRX-777-A");
await p.locator('details[open] input[name="reason"]').fill("خطأ في رقم المرجع");
ok((await submit("حفظ التصحيح")).includes("تم تصحيح التحويل"), "تصحيح التحويل (مشرف) مع حفظ القديم");
await go("/cases/5001#files");
const pdf = { name: "receipt.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%test\n") };
await p.locator('input[type="file"][name="file"]').setInputFiles(pdf);
await p.locator('input[name="note"]').last().fill("إيصال استلام");
ok((await submit("رفع")).includes("تم رفع المرفق"), "رفع مرفق على ملف الحالة");
const href = await p.locator("a[href^='/api/files/']").first().getAttribute("href");
ok((await p.request.get(BASE + href)).status() === 200, "فتح المرفق");
ok((await (await ctx.browser().newContext()).request.get(BASE + href)).status() === 401, "المرفق لا يفتح بدون دخول");
// خدمة سكن (تغطية) + كارت لنفس الحالة المؤكدة
await go("/decisions/new?code=5001");
await p.getByLabel("تاريخ القرار").fill(prevDay5);
const svcVal = async (name) => p.locator('select[name="svc"] option', { hasText: name }).first().getAttribute("value");
await p.locator('select[name="svc"]').selectOption(await svcVal("سكن / دار رعاية"));
await p.locator('input[name="amount"]').fill("2500"); await p.locator('input[name="months"]').fill("3");
await p.getByRole("button", { name: "+ إضافة خدمة" }).click();
await p.locator('select[name="svc"]').nth(1).selectOption(await svcVal("كارت كازيون"));
await p.locator('input[name="amount"]').nth(1).fill("600"); await p.locator('input[name="months"]').nth(1).fill("3");
await p.getByRole("button", { name: "حفظ القرار" }).click(); await p.waitForURL(/cases\/5001\?saved/);
await go(`/cycle?m=${month}`);
await p.getByRole("button", { name: /^توليد استحقاقات/ }).click(); await p.waitForSelector(".alert.ok"); await p.waitForLoadState("networkidle");
await go(`/cycle?m=${next}&kind=service`);
ok(await p.locator("text=مؤجل من").count() > 0, "الشهر اللي ما اتبعتش بيظهر مؤجل في دفعة الشهر اللي بعده");
await go(`/cycle?m=${month}&kind=service`);
await p.locator('input[name="ids"]').first().check();
ok((await submit("تم التنفيذ للمحدد")).includes("نزلت المتابعة"), "تنفيذ خدمة (سكن) ونزولها المتابعة");
await go(`/follow?m=${month}`);
ok(await p.locator("td", { hasText: "سكن" }).count() > 0, "أي خدمة اتبعتت ظاهرة في المتابعة");
await go(`/cycle?m=${month}&kind=card`);
await p.locator('input[name="ids"]').first().check();
await submit("تم إرسال الكارت للمحدد");
await go(`/cycle?m=${month}&kind=card`);
await p.locator("a[href^='/cycle/c']").first().click(); await p.waitForURL(/\/cycle\/c/); await p.waitForLoadState("networkidle");
await p.locator("summary", { hasText: "إعادة إرسال الكارت" }).click();
await p.locator('details[open] input[name="reason"]').fill("الكارت لم يُشحن");
ok((await submit("إعادة الإرسال")).includes("تمت إعادة إرسال الكارت"), "إعادة إرسال الكارت");

// ── موظف بدور «موظف» لا يقدر يسجل تحويل ولا يفتح الإدارة
await go("/admin/users");
await p.getByLabel("الاسم").fill("موظف اختبار");
await p.locator('input[name="email"]').fill("staff.test@mersal-ngo.org");
await p.getByRole("button", { name: "إضافة" }).click();
await p.waitForSelector(".secret code");
const tmp = (await p.locator(".secret code").innerText()).trim();
const ctx2 = await browser.newContext({ viewport: { width: 400, height: 860 } });
const s = await ctx2.newPage();
await s.goto(BASE + "/login"); await s.getByLabel("الإيميل").fill("staff.test@mersal-ngo.org"); await s.getByLabel("كلمة المرور").fill(tmp);
await s.getByRole("button", { name: "دخول" }).click(); await s.waitForURL(/account/); await s.waitForLoadState("networkidle");
await s.getByLabel("كلمة المرور الحالية").fill(tmp); await s.getByLabel("الجديدة (10 حروف على الأقل)").fill("Staff-Strong-2026"); await s.getByLabel("تأكيد الجديدة").fill("Staff-Strong-2026");
await s.getByRole("button", { name: "حفظ" }).click(); await s.waitForURL(BASE + "/");
await s.goto(BASE + "/admin/users"); await s.waitForURL(/denied/, { timeout: 8000 }).catch(() => {}); ok(s.url().includes("denied") && await s.locator("text=المستخدمون").locator("xpath=ancestor::table").count() === 0, "الموظف لا يفتح إدارة المستخدمين");
await s.goto(BASE + `/cycle?m=${month}`, { waitUntil: "networkidle" });
ok(await s.locator("summary", { hasText: "تسجيل التحويل" }).count() === 0, "الموظف لا يرى تسجيل التحويل");
ok(await s.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "عرض الموبايل بدون تمرير أفقي");

// ── الحالات والقرارات (بند واحد) + أعمدة الدفعة + Excel
await go("/cases?q=5001");
ok(await p.locator("table.grouped th", { hasText: "البداية" }).count() === 1 && await p.locator("table.grouped th", { hasText: "نص القرار" }).count() === 1, "الحالات: البداية والنهاية ونص القرار ظاهرين");
ok(await p.locator(".tabs a", { hasText: "القرارات" }).count() === 1, "الحالات والقرارات بتابين");
for (const fl of ["start", "end", "res", "recv"]) ok(await p.locator(`form.filters select[name="${fl}"]`).count() === 1, `فلتر الحالات: ${fl}`);
await go(`/cases?end=${addM(month, 2)}`);
ok(await p.locator("table.grouped tbody").count() > 0, "فلتر نهاية القرار بيرجع الحالة");
const cx = await p.request.get(BASE + "/api/export/cases?format=xlsx");
const cxb = await cx.body();
ok(cx.status() === 200 && cxb[0] === 0x50 && cxb[1] === 0x4b, "تصدير Excel للحالات والقرارات بكل البيانات");
await go(`/renewal?view=ending&m=${addM(month, 2)}`);
ok(await p.locator("td", { hasText: "5001" }).count() > 0 && await p.getByRole("button", { name: "إغلاق المحدد كمنتهي" }).count() === 1, "قائمة القرارات اللي بتنتهي في الشهر");
await go(`/cycle?m=${month}`);
const heads = await p.locator(".card table th").allInnerTexts();
ok(["الكود", "الاسم", "رقم الهاتف", "اسم المستلم", "الرقم القومي", "موقف الإقامة", "انتهاء الإقامة", "الخدمة", "التكلفة", "القرار", "بداية القرار", "نهاية القرار"].every((h) => heads.some((x) => x.trim() === h)), "دورة الصرف: كل الأعمدة المطلوبة");
const xl = await p.request.get(BASE + `/api/export/cycle?m=${month}&kind=financial&format=xlsx`);
const xb = await xl.body();
ok(xl.status() === 200 && xb[0] === 0x50 && xb[1] === 0x4b && (xl.headers()["content-type"] || "").includes("spreadsheetml"), "تصدير Excel للدفعة");
const bHref = await p.locator("a", { hasText: "Excel الدفعة" }).first().getAttribute("href").catch(() => null);
ok(!!bHref && (await p.request.get(BASE + bHref)).status() === 200, "تنزيل شيت دفعة مرسلة");
await go("/decisions/new");
await p.locator('input[name="code"]').fill("5001");
await p.waitForSelector(".case-info .kv", { timeout: 10000 }).catch(() => {});
ok(await p.locator(".case-info", { hasText: "بيانات الحالة من السيستم" }).count() === 1, "فورم القرار يجيب بيانات الحالة من السيستم");

// ── دليل العمل: نافذة منبثقة فيها دورة الحالة
await go("/");
await p.locator(".side nav a", { hasText: "دليل العمل" }).click();
ok(await p.locator("dialog.guide-modal[open] .gm-flow li").count() === 6, "دليل العمل بيفتح نافذة فيها دورة الحالة (6 مراحل)");
await p.keyboard.press("Escape");

// ── إضافة مهمة من الأنواع وإسنادها لأكتر من موظف بمدة
await go("/tasks");
const nOps = await p.locator('details.new-task select[name="opType"] option:not([disabled])').count();
ok(nOps >= 60, `أنواع المهام ظاهرة في الاختيارات (${nOps})`);
await p.locator('details.new-task select[name="opType"]').selectOption({ index: 3 });
await p.locator('details.new-task select[name="period"]').selectOption("30");
const people = p.locator("details.new-task .person");
const nPeople = Math.min(2, await people.count());
for (let i = 0; i < nPeople; i++) await people.nth(i).click();
ok((await submit(nPeople > 1 ? `إسناد المهمة لـ ${nPeople} موظفين` : "إنشاء المهمة")).includes(nPeople > 1 ? `لـ ${nPeople} موظفين` : "تم إنشاء المهمة"), "إسناد مهمة من نوع محدد لموظفين بمدة شهر");

ok(errors.length === 0, `أخطاء المتصفح: ${errors.length ? errors.join(" | ") : "لا يوجد"}`);
await browser.close();
console.log(failures ? `\n✖ ${failures} فشل` : "\n✔ كل الاختبارات نجحت");
process.exit(failures ? 1 : 0);
