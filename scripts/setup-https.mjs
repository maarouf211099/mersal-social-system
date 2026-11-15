// دومين + HTTPS لنظام الإدارة الاجتماعية على Windows — بـ Caddy (شهادة Let's Encrypt مجانية وتجديد تلقائي)
//
//   node scripts/setup-https.mjs --domain social.mersal-ngo.info --email it@mersal-ngo.org --dir D:\apis\mersal-social
//   node scripts/setup-https.mjs --domain social.mersal-ngo.info --email it@mersal-ngo.org --dir D:\apis\mersal-social --lock
//
// قبل التشغيل: سجل DNS من نوع A للدومين ← IP السيرفر.
// بيعمل إيه:
//   1. يتأكد إن الدومين بيشاور على السيرفر ده
//   2. يتأكد إن بورت 80 و 443 فاضيين (أو ماسكهم Caddy اللي السكريبت ده ركّبه قبل كده) — مابيوقفش أي برنامج تاني
//   3. يسطّب Caddy في C:\caddy كخدمة Windows، ويضيف الدومين لـ Caddyfile (أنظمة تانية ممكن تتضاف بعدين لنفس الملف)
//   4. يفتح بورت 80 و 443 في الفايروول، ويستنى الشهادة لحد ما https://الدومين/api/health يرد
//   5. مع --lock: الكوكي يبقى HTTPS بس، والنظام يسمع على 127.0.0.1 بس، ويقفل بورت 3011 من بره، ويعيد النشر
// آمن يتشغل أكتر من مرة.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve4 } from "node:dns/promises";
import path from "node:path";
import { parseEnv } from "./env-file.mjs";

const CADDY_VERSION = "2.10.0";
const CADDY_DIR = "C:\\caddy";
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith("--") ? [...a, [x.slice(2), all[i + 1]?.startsWith("--") ? "1" : all[i + 1] ?? "1"]] : a), []));
const domain = String(args.domain || "").trim().toLowerCase();
const email = String(args.email || "").trim();
const deployDir = path.resolve(args.dir || process.env.DEPLOY_DIR || "");
const lock = !!args.lock;
const step = (n, m) => console.log(`\n━━━ ${n}. ${m}`);
const die = (m) => { console.error(`\n✖ ${m}\n`); process.exit(1); };
const ps = (cmd) => spawnSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd], { encoding: "utf8" });
const sh = (cmd, a) => spawnSync(cmd, a, { encoding: "utf8", shell: true });

if (process.platform !== "win32") die("السكريبت ده للسيرفر الويندوز بس.");
if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) die("حدد الدومين: --domain social.mersal-ngo.info");
if (!email.includes("@")) die("حدد إيميل لتنبيهات الشهادة: --email it@mersal-ngo.org");
if (!existsSync(path.join(deployDir, ".env"))) die("حدد فولدر النشر: --dir D:\\apis\\mersal-social");
const env = parseEnv(readFileSync(path.join(deployDir, ".env"), "utf8"));
const port = env.PORT || "3011";

step(1, `الدومين ${domain}`);
let publicIp = "";
try { publicIp = (await (await fetch("https://api.ipify.org")).text()).trim(); } catch {}
let ips = [];
try { ips = await resolve4(domain); } catch {}
if (!ips.length) die(`الدومين ${domain} مالوش سجل DNS. ضيف سجل A: ${domain.split(".")[0]} ← ${publicIp || "IP السيرفر"} واستنى دقايق وأعد الأمر.`);
if (publicIp && !ips.includes(publicIp)) die(`الدومين بيشاور على ${ips.join(", ")} والسيرفر ده ${publicIp}. صحح سجل الـ DNS.`);
console.log(`✓ ${domain} ← ${ips.join(", ")}`);

step(2, "بورت 80 و 443");
const ns = sh("netstat", ["-ano", "-p", "TCP"]).stdout || "";
const owner = (p) => {
  const line = ns.split(/\r?\n/).find((l) => /LISTENING/.test(l) && new RegExp(`:${p}\\s`).test(l));
  if (!line) return null;
  const pid = line.trim().split(/\s+/).pop();
  const name = (sh("tasklist", ["/FI", `"PID eq ${pid}"`, "/FO", "CSV", "/NH"]).stdout || "").split(",")[0].replace(/"/g, "").trim();
  return { pid, name: name || "?" };
};
for (const p of [80, 443]) {
  const o = owner(p);
  if (o && !/^caddy/i.test(o.name)) die(`بورت ${p} مستخدم من برنامج تاني: ${o.name} (PID ${o.pid}). مابوقفش برامج تانية — ابعت الاسم ده وهنظبط الدومين على نفس البرنامج.`);
  console.log(o ? `✓ ${p}: Caddy (هيتضاف له الدومين)` : `✓ ${p}: فاضي`);
}

step(3, "Caddy");
mkdirSync(CADDY_DIR, { recursive: true });
const exe = path.join(CADDY_DIR, "caddy.exe");
if (!existsSync(exe)) {
  const zip = path.join(CADDY_DIR, "caddy.zip");
  const url = `https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/caddy_${CADDY_VERSION}_windows_amd64.zip`;
  console.log(`تحميل ${url}`);
  const r = ps(`$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri '${url}' -OutFile '${zip}'; Expand-Archive -Path '${zip}' -DestinationPath '${CADDY_DIR}' -Force; Remove-Item '${zip}'`);
  if (!existsSync(exe)) die(`فشل تحميل Caddy: ${r.stderr || r.stdout}`);
}
console.log(`✓ ${(sh(`"${exe}"`, ["version"]).stdout || "").trim()}`);

const cfgFile = path.join(CADDY_DIR, "Caddyfile");
let cfg = existsSync(cfgFile) ? readFileSync(cfgFile, "utf8") : `# اتعمل بـ scripts/setup-https.mjs — كل نظام له بلوك باسم الدومين بتاعه\n{\n\temail ${email}\n}\n`;
if (existsSync(cfgFile)) copyFileSync(cfgFile, `${cfgFile}.bak-${Date.now()}`);
const block = `\n# نظام الإدارة الاجتماعية\n${domain} {\n\tencode gzip\n\treverse_proxy 127.0.0.1:${port}\n}\n`;
const re = new RegExp(`\\n# نظام الإدارة الاجتماعية\\n${domain.replace(/\./g, "\\.")} \\{[\\s\\S]*?\\n\\}\\n`);
cfg = re.test(cfg) ? cfg.replace(re, block) : cfg + block;
writeFileSync(cfgFile, cfg);
const v = sh(`"${exe}"`, ["validate", "--config", `"${cfgFile}"`, "--adapter", "caddyfile"]);
if (v.status !== 0) die(`Caddyfile فيه خطأ:\n${v.stderr || v.stdout}`);
console.log(`✓ ${cfgFile}`);

const svc = sh("sc.exe", ["query", "caddy"]);
if (svc.status !== 0) {
  const c = sh("sc.exe", ["create", "caddy", "start=", "auto", "binPath=", `"${exe} run --config ${cfgFile} --adapter caddyfile"`, "DisplayName=", '"Caddy HTTPS"']);
  if (c.status !== 0) die(`فشل تسطيب خدمة Caddy: ${c.stdout || c.stderr}`);
  sh("sc.exe", ["failure", "caddy", "reset=", "86400", "actions=", "restart/5000/restart/5000/restart/5000"]);
  sh("sc.exe", ["start", "caddy"]);
  console.log("✓ خدمة caddy اتسطبت واشتغلت (بتقوم لوحدها مع السيرفر)");
} else {
  const r = sh(`"${exe}"`, ["reload", "--config", `"${cfgFile}"`, "--adapter", "caddyfile"]);
  if (r.status !== 0) { sh("sc.exe", ["stop", "caddy"]); sh("sc.exe", ["start", "caddy"]); }
  console.log("✓ Caddy اتحدّث بالدومين الجديد");
}
for (const p of [80, 443]) {
  sh("netsh", ["advfirewall", "firewall", "delete", "rule", `name="caddy-${p}"`]);
  sh("netsh", ["advfirewall", "firewall", "add", "rule", `name="caddy-${p}"`, "dir=in", "action=allow", "protocol=TCP", `localport=${p}`]);
}
console.log("✓ الفايروول: 80 و 443 مفتوحين");

step(4, "الشهادة");
let ok = false;
for (let i = 0; i < 40 && !ok; i++) {
  try { ok = (await fetch(`https://${domain}/api/health`)).ok; } catch {}
  if (!ok) await new Promise((r) => setTimeout(r, 3000));
}
if (!ok) die(`https://${domain} لسه مش بيرد. شوف سجل Caddy: Get-WinEvent -LogName Application -MaxEvents 30 | ? ProviderName -match caddy\nأشهر سبب: بورت 80 مقفول من فايروول مزود الـ VPS (لازم يبقى مفتوح عشان Let's Encrypt يتحقق).`);
console.log(`✓ https://${domain} شغال بشهادة صالحة`);

if (lock) {
  step(5, "قفل الوصول المباشر (HTTPS بس)");
  const file = path.join(deployDir, ".env");
  let text = readFileSync(file, "utf8");
  copyFileSync(file, `${file}.bak-${Date.now()}`);
  const set = (k, val) => { text = new RegExp(`^\\s*${k}\\s*=.*$`, "m").test(text) ? text.replace(new RegExp(`^\\s*${k}\\s*=.*$`, "m"), `${k}=${val}`) : text.replace(/\s*$/, `\n${k}=${val}\n`); };
  set("COOKIE_SECURE", "true");
  set("HOSTNAME", "127.0.0.1");
  writeFileSync(file, text);
  if (spawnSync("node", ["scripts/deploy.mjs"], { stdio: "inherit", shell: true, env: { ...process.env, DEPLOY_DIR: deployDir } }).status !== 0) die("فشل إعادة النشر — راجع الرسالة فوق. نسخة .env القديمة جنبه (.bak)");
  sh("netsh", ["advfirewall", "firewall", "delete", "rule", 'name="mersal-social"']);
  console.log(`✓ النظام بقى على https://${domain} بس، وبورت ${port} مقفول من بره`);
}

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✔ https://${domain}
${lock ? "" : `  الرابط القديم http://IP:${port} لسه شغال. لما تتأكد إن الدومين تمام، أعد الأمر ومعاه --lock\n`}  في بوابة مرسال: عدّل رابط نظام الإدارة الاجتماعية لـ https://${domain}
  Caddy بيجدد الشهادة لوحده. الإعدادات: ${cfgFile}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
