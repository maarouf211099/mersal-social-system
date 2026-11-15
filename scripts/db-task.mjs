// مهام قاعدة البيانات اللي setup-server بيشغّلها في عملية منفصلة
// (على ويندوز، لو السكريبت الرئيسي فتح Prisma بنفسه بيقفل ملف المحرك وبيفشل الـbuild بـ EPERM)
//   node scripts/db-task.mjs ensure-db <adminUrl>
import { PrismaClient } from "@prisma/client";

const [task, url] = process.argv.slice(2);
const p = new PrismaClient({ datasourceUrl: url });
try {
  if (task === "ensure-db") {
    const exists = await p.$queryRawUnsafe(`SELECT 1 FROM pg_database WHERE datname = 'mersal_social'`);
    if (exists.length) console.log("✓ موجودة قبل كده");
    else { await p.$executeRawUnsafe(`CREATE DATABASE mersal_social`); console.log("✓ اتعملت mersal_social"); }
  } else {
    console.error("مهمة غير معروفة"); process.exit(2);
  }
} catch (e) {
  console.error(`✖ ${e.message}`); process.exit(1);
} finally {
  await p.$disconnect();
}
