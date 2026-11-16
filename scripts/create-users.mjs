// إنشاء حسابات كتير مرة واحدة — بيتشغّل على السيرفر بس (محتاج .env بتاع النشر)
//   node scripts/create-users.mjs --dir D:\apis\mersal-social --role staff --password "Mersal2026" "a@mersal-ngo.org=الاسم" "b@mersal-ngo.org=الاسم"
// - كل حساب بيطلب تغيير كلمة المرور أول دخول
// - لو الإيميل موجود قبل كده بيتخطاه (ومش بيغيّر كلمة مروره) إلا لو ضفت --reset
// - الاسم بعد «=» اختياري؛ لو مش موجود بيتعمل من الإيميل ويتعدل بعدين من «المستخدمون»
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { parseEnv } from "./env-file.mjs";

const argv = process.argv.slice(2);
const flags = {}, people = [];
for (let i = 0; i < argv.length; i++) {
  const x = argv[i];
  if (x === "--reset") flags.reset = true;
  else if (x.startsWith("--")) flags[x.slice(2)] = argv[++i];
  else people.push(x);
}
const ROLES = ["admin", "supervisor", "finance", "staff", "viewer"];
const dir = path.resolve(flags.dir || process.env.DEPLOY_DIR || "");
const role = flags.role || "staff";
const pw = String(flags.password || "");
const die = (m) => { console.error(`✖ ${m}`); process.exit(1); };
if (!existsSync(path.join(dir, ".env"))) die("حدد فولدر النشر: --dir D:\\apis\\mersal-social");
if (!ROLES.includes(role)) die(`الدور لازم يكون واحد من: ${ROLES.join(", ")}`);
if (pw.length < 8) die("كلمة المرور المؤقتة لازم 8 حروف على الأقل: --password \"...\"");
if (!people.length) die("اكتب الإيميلات بعد الأمر (email أو email=الاسم)");

const nameFrom = (email) => email.split("@")[0].split(/[._-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const list = people.map((p) => {
  const [e, ...n] = p.split("=");
  const email = e.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) die(`إيميل غير صحيح: ${e}`);
  return { email, name: n.join("=").trim() || nameFrom(email) };
});

const env = parseEnv(readFileSync(path.join(dir, ".env"), "utf8"));
const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
try {
  const hash = await bcrypt.hash(pw, 12);
  for (const { email, name } of list) {
    const old = await prisma.user.findUnique({ where: { email } });
    if (old && !flags.reset) { console.log(`• ${email}: موجود قبل كده (${old.name}) — اتخطّى`); continue; }
    if (old) {
      await prisma.user.update({ where: { id: old.id }, data: { passwordHash: hash, mustChangePassword: true, isActive: true, sessionVersion: { increment: 1 } } });
      await prisma.auditLog.create({ data: { userId: null, action: "password_reset", target: email, meta: { via: "create-users-script" } } });
      console.log(`↺ ${email}: اتعملها كلمة مرور مؤقتة جديدة`);
      continue;
    }
    await prisma.user.create({ data: { email, name, role, passwordHash: hash, mustChangePassword: true } });
    await prisma.auditLog.create({ data: { userId: null, action: "user_created", target: email, meta: { role, via: "create-users-script" } } });
    console.log(`✔ ${email}: ${name} (${role})`);
  }
  console.log("\nكل حساب هيطلب تغيير كلمة المرور أول دخول. الأسماء والأدوار تتعدل من «المستخدمون».");
} finally {
  await prisma.$disconnect();
}
