# النشر على السيرفر والربط ببوابة مرسال

## أول مرة
على السيرفر (PowerShell أو CMD):
```
git clone https://github.com/maarouf211099/mersal-social-system
cd mersal-social-system
node scripts/setup-server.mjs --dir D:\apis\mersal-social --admin-email mahmoud.maarouf@mersal-ngo.org
```
السكريبت:
1. يسطّب المكتبات.
2. ياخد بيانات PostgreSQL من بوابة مرسال الشغالة في pm2 (أو التذاكر). لو مش لاقيها: زوّد `--database-admin-url postgresql://USER:PASS@HOST:5432/postgres`.
3. يعمل قاعدة `mersal_social` (schema `social`) — منفصلة تماماً عن باقي الأنظمة.
4. يكتب `.env` بمفاتيح عشوائية. لو البوابة فيها `SSO_SECRET_SOCIAL` بياخده.
5. ينشر على بورت 3011 باسم `mersal-social` في pm2، ويطبع إيميل المدير وكلمة مرور مؤقتة **مرة واحدة**.

آمن يتشغل تاني: مابيكتبش فوق `.env` موجود، ومابيعملش مدير تاني، ومابيلمسش أي نظام تاني.

## التحديث التلقائي — GitHub Actions Self-hosted Runner
مع كل push على `main`: GitHub بيعمل الفحوصات (migrations، الأنواع، الاختبارات، البناء) على سيرفر GitHub، ولو نجحت، الـ runner اللي على الـ VPS بيشغّل `scripts/deploy.mjs` (migrations ← بناء ← نسخة جديدة ← إعادة تشغيل `mersal-social` في pm2 ← فحص `/api/health` ← رجوع للنسخة السابقة لو فشل).

إعداد مرة واحدة على الـ VPS:
1. المستودع لازم يفضل **Private** — الـ runner بيشغّل الكود على السيرفر.
2. GitHub ← المستودع ← Settings ← Actions ← Runners ← **New self-hosted runner** ← Windows x64، ونفّذ الأوامر اللي بتظهر في **فولدر جديد** (مثلاً `C:\actions-runner-social` — مش فولدر runner التذاكر).
   عند `config.cmd`: الاسم `mersal-social-vps`، وأضف الوسم (label) **`mersal-social`**، ووافق على التشغيل كـ service **بنفس اليوزر اللي مشغّل pm2**.
3. GitHub ← Settings ← Secrets and variables ← Actions ← **Variables** ← `DEPLOY_DIR` = `D:\apis\mersal-social`.
4. GitHub ← Actions ← CI & Deploy ← **Run workflow** (أو أي push على main).

التحديث اليدوي (لو الـ runner واقف):
```
cd mersal-social-system && git pull && set DEPLOY_DIR=D:\apis\mersal-social && node scripts/deploy.mjs
```

## دومين و HTTPS (social.mersal-ngo.info)
1. عند مزود الدومين `mersal-ngo.info`: سجل **A** باسم `social` ← `84.46.252.131`.
2. على السيرفر (PowerShell كـ Administrator):
   ```
   cd D:\src\mersal-social-system && git pull
   node scripts/setup-https.mjs --domain social.mersal-ngo.info --email EMAIL --dir D:\apis\mersal-social
   ```
   بيسطّب Caddy كخدمة، ويطلع شهادة Let's Encrypt ويجددها لوحده. لو بورت 80 أو 443 مستخدمين من برنامج تاني بيقف ويقول اسمه (مابيلمسش أي نظام).
3. بعد التأكد إن `https://social.mersal-ngo.info` شغال: نفس الأمر ومعاه `--lock` — الكوكي يبقى HTTPS بس، والنظام مايتفتحش غير من الدومين، وبورت 3011 يتقفل من بره.

## الربط ببوابة مرسال (الدخول الموحد)
النظام فيه المسارين اللي البوابة محتاجاهم (`/sso/callback` و `/api/portal/summary`) — شغالين بس لما `PORTAL_SSO_SECRET` يتحط.

1. اعمل مفتاح:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. في `.env` بتاع **البوابة**: `SSO_SECRET_SOCIAL=<المفتاح>`
3. في `.env` بتاع **الإدارة الاجتماعية**: `PORTAL_SSO_SECRET=<نفس المفتاح>`
4. في البوابة ← إعدادات الأنظمة: ضيف نظام بمفتاح `social`، الاسم «الإدارة الاجتماعية»، الرابط `http://<IP>:3011`.
   (لو شاشة البوابة مابتضيفش أنظمة جديدة: ضيف السطر ده لقائمة `SYSTEMS` في `scripts/seed.mjs` بتاع البوابة:
   `{ key: "social", name: "الإدارة الاجتماعية", icon: "🤲", color: "#009091", sort: 15, baseUrl: "http://<IP>:3011", description: "القرارات والصرف والمتابعة" }`
   وضيف `"social"` لقائمة `SYSTEMS` في `scripts/setup-server.mjs` بتاعها.)
5. انشر الاتنين تاني، وفي البوابة اختار الموظفين اللي يدخلوا النظام.
6. الموظف لازم يكون له حساب في الإدارة الاجتماعية **بنفس الإيميل** (الإدارة ← المستخدمون) — الحساب هو اللي بيحدد دوره وصلاحياته.

اختبار بعد الربط (نفس اختبارات البوابة): الدخول من البوابة يفتح على طول · فتح رابط التذكرة مرة تانية يرجع `?sso=invalid` · موظف مالوش حساب يرجع `?sso=nouser` · `/api/portal/summary` من غير توكن يرجع 401.

## نسيان كلمة المرور (على السيرفر)
```
cd D:\src\mersal-social-system && git pull && node scripts/reset-password.mjs --dir D:\apis\mersal-social --email الإيميل
```
بيطبع كلمة مرور مؤقتة جديدة، ويفعّل الحساب لو كان موقوف، ويتسجل في سجل التدقيق. للموظفين العاديين: المدير يقدر يعمل ده من شاشة «المستخدمون».

## النسخ الاحتياطي
```
set DEPLOY_DIR=D:\apis\mersal-social && node scripts/backup.mjs
```
بياخد نسخة من القاعدة (pg_dump) والمرفقات في `D:\apis\mersal-social\backups`، ويحتفظ بآخر 30 نسخة. لو `pg_dump` مش في الـPATH: `set PG_BIN=C:\Program Files\PostgreSQL\16\bin`.

جدولته يومياً (CMD كمسؤول):
```
schtasks /create /tn "mersal-social-backup" /sc daily /st 23:30 /tr "cmd /c cd /d D:\path\mersal-social-system && set DEPLOY_DIR=D:\apis\mersal-social && node scripts/backup.mjs"
```
انسخ فولدر `backups` لمكان تاني (درايف خارجي أو سيرفر تاني) بشكل دوري.

## المرفقات
بتتحفظ في `D:\apis\mersal-social\uploads` (خارج فولدر النسخ، فمابتضيعش مع التحديث). لتغيير المكان: `UPLOAD_DIR=...` في `.env`.

## رفع شيت القرارات السنوي (Excel)
1. التنظيف (على أي جهاز عليه Python 3 و openpyxl):
   ```
   python tools/convert-decisions-xlsx.py "شيت القرارات.xlsx" فولدر-المخرجات
   ```
   بيطلّع `decisions-import.json` (للرفع) و `review-report.xlsx` (كل مشكلة برقم الصف في الإكسيل وإزاي اتعاملت معاها).
2. الرفع: «استيراد البيانات» ← اختيار `decisions-import.json` ← «استيراد».
   - الحالات الجديدة تتسجل، والموجودة تتكمل خاناتها الفاضية بس.
   - رفع نفس الملف تاني ما بيكررش ولا قرار (كل قرار له مفتاح ثابت).
   - الموقف: مستمره/مستمره فوط ← مستمر · مستمره+تحتاج لتبرع وتحتاج الي تبرع ← مستمر بعلامة «تحتاج لتبرع» · تمت ← منتهي · متوقفه/غلق ← موقوف · استبعاد ← مسحوب.
3. **ملفات البيانات دي ماتترفعش على GitHub أبداً.**

## نقل البيانات من النظام السابق (صفحة HTML)
من النظام السابق: الإعدادات ← تصدير نسخة كاملة (JSON). وفي النظام الجديد: الإدارة ← استيراد البيانات. بيشتغل مرة واحدة على قاعدة فاضية، في عملية واحدة (يا ينجح كله يا مايتحفظش حاجة).

## إنشاء حسابات كتير مرة واحدة
```powershell
cd D:\src\mersal-social-system; git pull
node scripts/create-users.mjs --dir D:\apis\mersal-social --role staff --password "كلمة-مؤقتة" "a@mersal-ngo.org=الاسم" "b@mersal-ngo.org=الاسم"
```
- كل حساب بيطلب تغيير كلمة المرور أول دخول. الإيميل الموجود قبل كده بيتخطاه (ضيف `--reset` لو عايز تعمله كلمة مؤقتة جديدة).
- الأدوار: `staff` موظف · `supervisor` مشرف · `finance` مالية · `viewer` اطلاع · `admin` مدير.
