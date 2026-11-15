// تجهيز نظام الإدارة الاجتماعية على السيرفر — أمر واحد، وآمن يتشغل أكتر من مرة
//
//   node scripts/setup-server.mjs
//   node scripts/setup-server.mjs --dir D:\apis\mersal-social --admin-email you@mersal-ngo.org
//
// بيعمل إيه بالترتيب:
//   1. npm ci + prisma generate
//   2. يلاقي بيانات PostgreSQL من بوابة مرسال (أو التذاكر) في pm2 — أو من --database-admin-url
//   3. يعمل قاعدة mersal_social لو مش موجودة
//   4. يكتب .env بمفاتيح عشوائية (لو موجود مابيلمسوش)
//      لو البوابة فيها SSO_SECRET_SOCIAL بياخده عشان الدخول من البوابة يشتغل على طول
//   5. ينشر النظام (scripts/deploy.mjs) على بورت 3011
//
// مابيمسحش أي داتا، ومابيلمسش أي نظام تاني.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "./env-file.mjs";

const root = process.cwd();
const isWin = process.platform === "win32";
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const deployDir = path.resolve(args.dir || process.env.DEPLOY_DIR || path.join(root, "..", "mersal-social-deploy"));
const adminEmail = (args["admin-email"] || "admin@mersal-ngo.org").trim().toLowerCase();

const step = (n, msg) => console.log(`\n━━━ ${n}. ${msg}`);
function die(msg) { console.error(`\n✖ ${msg}\n`); process.exit(1); }
const sh = (cmd, a, opts = {}) => spawnSync(cmd, a, { stdio: "inherit", shell: isWin, cwd: root, ...opts });
const secret = () => randomBytes(32).toString("hex");
function password() {
  const abc = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(14), (b) => abc[b % abc.length]).join("");
}

step(1, "تسطيب المكتبات");
if (sh("npm", ["ci", "--no-audit", "--no-fund"]).status !== 0) die("فشل npm ci");
if (sh("npx", ["prisma", "generate"]).status !== 0) die("فشل prisma generate");

step(2, "بيانات PostgreSQL");
let baseUrl = args["database-admin-url"] || "";
let portalEnv = {};
const jl = spawnSync("pm2", ["jlist"], { shell: isWin, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
if (jl.status !== 0) die("pm2 مش متسطب أو مش شغال: npm install -g pm2");
let procs = [];
const jsonStart = jl.stdout.search(/^\[(\{|\])/m);
try { procs = JSON.parse(jl.stdout.slice(jsonStart)); } catch { procs = []; }
const deployDirOf = (name) => {
  const pr = procs.find((x) => x.name === name);
  const cwd = pr?.pm2_env?.pm_cwd || "";
  return path.basename(path.dirname(cwd)) === "releases" ? path.dirname(path.dirname(cwd)) : null;
};
const portalDir = args["portal-dir"] ? path.resolve(args["portal-dir"]) : deployDirOf("mersal-portal");
if (portalDir && existsSync(path.join(portalDir, ".env"))) {
  portalEnv = parseEnv(readFileSync(path.join(portalDir, ".env"), "utf8"));
  baseUrl ||= portalEnv.DATABASE_URL || "";
  console.log(`✓ بوابة مرسال: ${portalDir}`);
}
if (!baseUrl) {
  const tDir = deployDirOf("mersal-tickets");
  if (tDir && existsSync(path.join(tDir, ".env"))) baseUrl = parseEnv(readFileSync(path.join(tDir, ".env"), "utf8")).DATABASE_URL || "";
}
if (!baseUrl) die("مش لاقي بيانات PostgreSQL — شغّل الأمر تاني ومعاه: --database-admin-url postgresql://USER:PASS@HOST:5432/postgres");

step(3, "قاعدة بيانات الإدارة الاجتماعية");
const appUrl = new URL(baseUrl); appUrl.pathname = "/mersal_social"; appUrl.search = "?schema=social";
const adminUrl = new URL(baseUrl); adminUrl.search = "";
if (sh("node", ["scripts/db-task.mjs", "ensure-db", adminUrl.toString()]).status !== 0) die("مش قادر أعمل القاعدة");

step(4, "ملف الإعدادات");
mkdirSync(deployDir, { recursive: true });
const envFile = path.join(deployDir, ".env");
let adminPassword = null;
if (existsSync(envFile)) {
  console.log(`✓ موجود قبل كده (مالمستوش): ${envFile}`);
} else {
  adminPassword = password();
  const sso = portalEnv.SSO_SECRET_SOCIAL || "";
  writeFileSync(envFile, [
    "# اتعمل بـ scripts/setup-server.mjs — ماترفعوش على GitHub",
    `DATABASE_URL="${appUrl.toString()}"`,
    `AUTH_SECRET="${secret()}"`,
    "PORT=3011",
    "COOKIE_SECURE=false",
    'COOKIE_DOMAIN=""',
    `# الدخول من بوابة مرسال: نفس قيمة SSO_SECRET_SOCIAL في .env البوابة`,
    `PORTAL_SSO_SECRET="${sso}"`,
    `DEFAULT_ADMIN_EMAIL="${adminEmail}"`,
    `DEFAULT_ADMIN_PASSWORD="${adminPassword}"`,
    'DEFAULT_ADMIN_NAME="مدير الإدارة الاجتماعية"',
    "",
  ].join("\n"), { mode: 0o600 });
  console.log(`✓ اتكتب: ${envFile}${sso ? " (مربوط بالبوابة)" : ""}`);
}
const env = parseEnv(readFileSync(envFile, "utf8"));

step(5, "نشر النظام");
if (sh("node", ["scripts/deploy.mjs"], { env: { ...process.env, DEPLOY_DIR: deployDir } }).status !== 0) die("فشل النشر");

const port = env.PORT || 3011;
console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✔ نظام الإدارة الاجتماعية شغال: http://<IP السيرفر>:${port}
${adminPassword ? `
  الإيميل:      ${adminEmail}
  كلمة المرور:  ${adminPassword}
  (مؤقتة — هتتطلب تغييرها أول دخول. احفظها دلوقتي، مش هتظهر تاني)
` : "  (حساب المدير اتعمل قبل كده)"}
  الإعدادات: ${envFile}
${env.PORTAL_SSO_SECRET ? "  ✓ الدخول من بوابة مرسال مفعّل" : `  للدخول من بوابة مرسال: في .env البوابة ضيف SSO_SECRET_SOCIAL=<مفتاح 64 حرف>
  وحط نفس القيمة في PORTAL_SSO_SECRET هنا، وضيف النظام في البوابة (مفتاحه social، الرابط http://<IP>:${port})
  ثم انشر الاتنين تاني. التفاصيل في docs/07-deploy.md`}
  لو البورت مقفول في الفايروول:
  netsh advfirewall firewall add rule name="mersal-social" dir=in action=allow protocol=TCP localport=${port}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
