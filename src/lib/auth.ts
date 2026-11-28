import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "./session";
import { headers } from "next/headers";
import { can, canSee, pageOfPath, type Perm, type UserPerms } from "./perms";

export type AppUser = { id: string; email: string; name: string; role: Role; team: string; mustChangePassword: boolean; perms: UserPerms };

// المستخدم بيتقري من الداتابيز في كل request — الإيقاف أو تغيير الدور بيسري فوراً
export const auth = cache(async (): Promise<AppUser | null> => {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const u = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!u || !u.isActive || u.sessionVersion !== claims.ver) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role, team: u.team, mustChangePassword: u.mustChangePassword, perms: (u.perms as UserPerms) ?? null };
});

export async function requirePageUser(opts: { allowMustChange?: boolean; perm?: Perm } = {}): Promise<AppUser> {
  const u = await auth();
  if (!u) redirect("/login");
  if (u.mustChangePassword && !opts.allowMustChange) redirect("/account?first=1");
  if (opts.perm && !can(u, opts.perm)) redirect("/?denied=1");
  // الصفحة نفسها: لو المدير قفلها عن الموظف ده
  const page = pageOfPath((await headers()).get("x-app-path") ?? "/");
  if (page && !canSee(u, page)) redirect("/?denied=1");
  return u;
}

export class ActionError extends Error {}

/** للـserver actions: يتحقق من الجلسة والصلاحية على السيرفر — مش على الشاشة */
export async function requireAction(perm?: Perm): Promise<AppUser> {
  const u = await auth();
  if (!u || u.mustChangePassword) throw new ActionError("انتهت الجلسة. سجّل الدخول مرة أخرى.");
  if (perm && !can(u, perm)) throw new ActionError("هذا الإجراء غير متاح لك. اطلب الصلاحية من مدير النظام.");
  return u;
}

function cookieOpts() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
}
export async function startSession(userId: string, ver: number) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(userId, ver), cookieOpts());
}
export async function endSession() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...cookieOpts(), maxAge: 0 });
}
