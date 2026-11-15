#!/usr/bin/env bash
# تصفير قاعدة التطوير المحلية فقط (ممنوع على السيرفر) — للاختبارات
set -e
case "$DATABASE_URL" in *localhost*|*127.0.0.1*) ;; *) echo "✖ مسموح على قاعدة محلية فقط"; exit 1;; esac
psql "${DATABASE_URL%%\?*}" -c 'DROP SCHEMA IF EXISTS social CASCADE;' >/dev/null
npx prisma migrate deploy >/dev/null && node scripts/seed.mjs
