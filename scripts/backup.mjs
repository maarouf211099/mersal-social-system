// نسخة احتياطية لقاعدة الإدارة الاجتماعية + المرفقات — بتتشغل يدوي أو من Task Scheduler يومياً
//   set DEPLOY_DIR=D:\apis\mersal-social && node scripts/backup.mjs
//   node scripts/backup.mjs --dir D:\apis\mersal-social --keep 30
// محتاج pg_dump (بييجي مع PostgreSQL). لو مش في الـPATH: set PG_BIN=C:\Program Files\PostgreSQL\16\bin
// بيقرا بس — مابيعدّلش أي داتا
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "./env-file.mjs";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith("--") ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const deployDir = path.resolve(args.dir || process.env.DEPLOY_DIR || "");
const keep = Math.max(3, Number(args.keep || 30));
const die = (m) => { console.error(`✖ ${m}`); process.exit(1); };
if (!existsSync(path.join(deployDir, ".env"))) die("حدد فولدر النشر: --dir أو DEPLOY_DIR");
const env = parseEnv(readFileSync(path.join(deployDir, ".env"), "utf8"));
const url = new URL(env.DATABASE_URL);
const schema = url.searchParams.get("schema") || "social";
url.search = "";
const out = path.join(deployDir, "backups");
mkdirSync(out, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
const file = path.join(out, `mersal_social_${stamp}.dump`);
const pgDump = process.env.PG_BIN ? path.join(process.env.PG_BIN, "pg_dump") : "pg_dump";
const r = spawnSync(pgDump, ["-Fc", "-n", schema, "-f", file, url.toString()], { stdio: "inherit", shell: process.platform === "win32" });
if (r.status !== 0 || !existsSync(file) || statSync(file).size === 0) die("فشل pg_dump — تأكد إنه متسطب أو حط PG_BIN");
// المرفقات
const uploads = env.UPLOAD_DIR || path.join(deployDir, "uploads");
if (existsSync(uploads)) cpSync(uploads, path.join(out, `uploads_${stamp}`), { recursive: true });
// الاحتفاظ بآخر N نسخة
const old = readdirSync(out).filter((n) => /^(mersal_social_|uploads_)\d{12}/.test(n)).sort();
const stamps = [...new Set(old.map((n) => n.match(/\d{12}/)[0]))].sort();
for (const s of stamps.slice(0, -keep)) for (const n of old.filter((x) => x.includes(s))) rmSync(path.join(out, n), { recursive: true, force: true });
console.log(`✔ نسخة احتياطية: ${file} (${Math.round(statSync(file).size / 1024)} ك.ب) · محفوظ آخر ${keep}`);
console.log("الاسترجاع (على قاعدة فاضية): pg_restore -d <DATABASE_URL بدون ?schema> " + file);
