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

## التحديث
```
cd mersal-social-system && git pull && set DEPLOY_DIR=D:\apis\mersal-social && node scripts/deploy.mjs
```
بيطبق الـ migrations الجديدة، يبني، ينشر في فولدر release جديد، ويتأكد من `/api/health`. لو النسخة الجديدة ماشتغلتش **بيرجع للنسخة السابقة لوحده**.

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

## نقل البيانات من النظام السابق (صفحة HTML)
من النظام السابق: الإعدادات ← تصدير نسخة كاملة (JSON). وفي النظام الجديد: الإدارة ← استيراد البيانات. بيشتغل مرة واحدة على قاعدة فاضية، في عملية واحدة (يا ينجح كله يا مايتحفظش حاجة).
