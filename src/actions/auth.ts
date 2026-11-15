"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth, endSession, startSession } from "@/lib/auth";
import { audit, clientIp } from "@/lib/audit";
import { clear, fail, isBlocked } from "@/lib/ratelimit";

const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.Xn0bFqKqvYc6Gq0m3rJ1vVb3n8xW";

export async function login(_prev: { error?: string; email?: string } | undefined, form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "");
  if (!email || !password) return { error: "اكتب الإيميل وكلمة المرور.", email };
  const key = `${email}|${await clientIp()}`;
  if (isBlocked(key)) return { error: "محاولات كثيرة غلط. استنى 10 دقايق وجرّب تاني.", email };
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.isActive) {
    fail(key);
    await audit(user?.id ?? null, "login_failed", email);
    return { error: "الإيميل أو كلمة المرور غير صحيحة.", email };
  }
  clear(key);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await startSession(user.id, user.sessionVersion);
  await audit(user.id, "login");
  const safe = /^\/(?![\/\\])/.test(next) && !next.includes("\\");
  redirect(user.mustChangePassword ? "/account?first=1" : safe ? next : "/");
}

export async function logout() {
  const u = await auth();
  if (u) await audit(u.id, "logout");
  await endSession();
  redirect("/login");
}

export async function changePassword(_prev: { error?: string } | undefined, form: FormData) {
  const u = await auth();
  if (!u) redirect("/login");
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < 10) return { error: "كلمة المرور الجديدة لازم تكون 10 حروف على الأقل." };
  if (next !== String(form.get("confirm") ?? "")) return { error: "التأكيد مش مطابق." };
  const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
  if (!(await bcrypt.compare(current, row.passwordHash))) return { error: "كلمة المرور الحالية غلط." };
  if (await bcrypt.compare(next, row.passwordHash)) return { error: "اختار كلمة مرور مختلفة عن الحالية." };
  const updated = await prisma.user.update({
    where: { id: u.id },
    data: { passwordHash: await bcrypt.hash(next, 12), mustChangePassword: false, sessionVersion: { increment: 1 } },
  });
  await startSession(u.id, updated.sessionVersion);
  await audit(u.id, "password_changed");
  redirect("/");
}
