// نشر نظام الإدارة الاجتماعية على السيرفر — Windows و Linux
// بيستخدمه الـ GitHub Actions self-hosted runner أو setup-server.mjs أو يدوي:
//   set DEPLOY_DIR=D:\apis\mersal-social && node scripts/deploy.mjs
//
//   1. يقرا الإعدادات من DEPLOY_DIR/.env (مش في الريبو)
//   2. prisma migrate deploy (schema "social" بس) + seed (مابيعدّلش أي حاجة موجودة)
//   3. next build ونسخ النسخة لفولدر release جديد
//   4. إعادة تشغيل عملية pm2 "mersal-social" بس
//   5. health check — لو فشل بيرجع للنسخة اللي قبلها
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "./env-file.mjs";

const APP = "mersal-social";
const KEEP_RELEASES = 3;
const root = process.cwd();
const isWin = process.platform === "win32";

function die(msg) { console.error(`\n✖ ${msg}\n`); process.exit(1); }
function run(cmd, args, env) {
  console.log(`\n$ ${cmd} ${args.join(" ")}`);
  return spawnSync(cmd, args, { stdio: "inherit", env, cwd: root, shell: isWin }).status === 0;
}

const deployDir = process.env.DEPLOY_DIR;
if (!deployDir) die("لازم تحدد DEPLOY_DIR (فولدر النشر على السيرفر)");
const envFile = path.join(deployDir, ".env");
if (!existsSync(envFile)) die(`مفيش ملف إعدادات في ${envFile} — شغّل node scripts/setup-server.mjs الأول`);

const appEnv = parseEnv(readFileSync(envFile, "utf8"));
for (const k of ["DATABASE_URL", "AUTH_SECRET"]) if (!appEnv[k]) die(`${k} مش موجود في ${envFile}`);
if (!/[?&]schema=social\b/.test(appEnv.DATABASE_URL)) die("DATABASE_URL لازم يكون فيه ?schema=social");
appEnv.PORT ||= "3011";
appEnv.HOSTNAME ||= "0.0.0.0";
appEnv.NODE_ENV = "production";
const env = { ...process.env, ...appEnv, NEXT_TELEMETRY_DISABLED: "1" };

if (spawnSync("pm2", ["-v"], { shell: isWin, encoding: "utf8" }).status !== 0) die("pm2 مش متسطب: npm install -g pm2");

if (!run("npx", ["prisma", "migrate", "deploy"], env)) die("فشل تطبيق الـ migrations — النسخة الشغالة زي ما هي");
if (!run("node", ["scripts/seed.mjs"], env)) die("فشل الـ seed — النسخة الشغالة زي ما هي");
if (!run("npm", ["run", "build"], env)) die("فشل البناء — النسخة الشغالة زي ما هي");

// server.js المفروض يكون في .next/standalone مباشرة — لو Next حطه في فولدر فرعي ندوّر عليه
function findServerJs(dir, depth = 0) {
  if (existsSync(path.join(dir, "server.js"))) return dir;
  if (depth >= 3) return null;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const sub = path.join(dir, name);
    if (statSync(sub).isDirectory()) { const hit = findServerJs(sub, depth + 1); if (hit) return hit; }
  }
  return null;
}
const standalone = path.join(root, ".next", "standalone");
const appRoot = findServerJs(standalone);
if (!appRoot) die("مش لاقي server.js جوه .next/standalone — البناء طلع ناقص");
if (appRoot !== standalone) console.log(`ℹ Next حط النسخة في فولدر فرعي: ${path.relative(standalone, appRoot)}`);

const releases = path.join(deployDir, "releases");
mkdirSync(releases, { recursive: true });
const sha = (process.env.GITHUB_SHA || "manual").slice(0, 7);
const id = `${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}-${sha}`;
const rel = path.join(releases, id);
cpSync(appRoot, rel, { recursive: true });
// node_modules اللي Next بيحطها على مستوى الـroot لازم تتنقل مع التطبيق
if (appRoot !== standalone && existsSync(path.join(standalone, "node_modules")) && !existsSync(path.join(rel, "node_modules"))) {
  cpSync(path.join(standalone, "node_modules"), path.join(rel, "node_modules"), { recursive: true });
}
cpSync(path.join(root, ".next", "static"), path.join(rel, ".next", "static"), { recursive: true });
if (existsSync(path.join(root, "public"))) cpSync(path.join(root, "public"), path.join(rel, "public"), { recursive: true });
rmSync(path.join(rel, ".env"), { force: true }); // الإعدادات بتيجي من pm2 بس

const current = path.join(deployDir, "current-release.txt");
const previous = existsSync(current) ? readFileSync(current, "utf8").trim() : null;

function startRelease(releaseId) {
  const dir = path.join(releases, releaseId);
  const eco = { apps: [{
    name: APP, script: path.join(dir, "server.js"), cwd: dir, env: appEnv,
    instances: 1, exec_mode: "fork", max_memory_restart: "500M", autorestart: true,
  }] };
  const ecoFile = path.join(deployDir, "ecosystem.config.json");
  writeFileSync(ecoFile, JSON.stringify(eco, null, 2));
  run("pm2", ["delete", APP], process.env); // أول مرة هيقول مش موجود — عادي
  return run("pm2", ["start", ecoFile], process.env);
}

async function healthy(port) {
  for (let i = 0; i < 30; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

if (!startRelease(id) || !(await healthy(appEnv.PORT))) {
  console.error("\n✖ النسخة الجديدة ماشتغلتش — آخر السجل:");
  run("pm2", ["logs", APP, "--lines", "40", "--nostream"], process.env);
  if (previous && existsSync(path.join(releases, previous))) {
    console.error(`↩ رجوع للنسخة السابقة ${previous}`);
    startRelease(previous);
    run("pm2", ["save"], process.env);
  }
  process.exit(1);
}
writeFileSync(current, id);
run("pm2", ["save"], process.env);
for (const old of readdirSync(releases).sort().slice(0, -KEEP_RELEASES)) {
  if (old !== id && old !== previous) rmSync(path.join(releases, old), { recursive: true, force: true });
}
console.log(`\n✔ نظام الإدارة الاجتماعية اتنشر: ${id} على البورت ${appEnv.PORT}\n`);
