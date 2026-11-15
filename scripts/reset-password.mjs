// كلمة مرور مؤقتة جديدة لأي حساب — بيتشغّل على السيرفر بس (محتاج .env بتاع النشر)
//   node scripts/reset-password.mjs --dir D:\apis\mersal-social --email mahmoud.maarouf@mersal-ngo.org
// بيفعّل الحساب لو كان موقوف، وبيطلّعه من كل الأجهزة، وبيطلب تغيير كلمة المرور أول دخول، وبيتسجل في سجل التدقيق
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { parseEnv } from "./env-file.mjs";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith("--") ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const dir = path.resolve(args.dir || process.env.DEPLOY_DIR || "");
const email = String(args.email || "").trim().toLowerCase();
const die = (m) => { console.error(`✖ ${m}`); process.exit(1); };
if (!existsSync(path.join(dir, ".env"))) die("حدد فولدر النشر: --dir D:\\apis\\mersal-social");
if (!email) die("حدد الإيميل: --email name@mersal-ngo.org");
const env = parseEnv(readFileSync(path.join(dir, ".env"), "utf8"));
const prisma = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
try {
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u) {
    const all = await prisma.user.findMany({ where: { email: { not: { endsWith: "@legacy.local" } } }, select: { email: true } });
    die(`مفيش حساب بالإيميل ده. الحسابات الموجودة: ${all.map((x) => x.email).join("، ") || "لا يوجد"}`);
  }
  const abc = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pw = Array.from(randomBytes(12), (b) => abc[b % abc.length]).join("");
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(pw, 12), mustChangePassword: true, isActive: true, sessionVersion: { increment: 1 } } });
  await prisma.auditLog.create({ data: { userId: null, action: "password_reset", target: email, meta: { via: "server-script" } } });
  console.log(`\n✔ كلمة مرور مؤقتة جديدة لـ ${u.name} (${email}):\n\n    ${pw}\n\n  هتتطلب تغييرها أول دخول. لو ظهر «محاولات كثيرة غلط» استنى 10 دقايق.\n`);
} finally {
  await prisma.$disconnect();
}
