import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { startSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { portalSecret, verifyPortalToken } from "@/lib/portal-sso";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!portalSecret()) return new NextResponse("Not found", { status: 404 });
  const url = req.nextUrl.clone();
  const toLogin = (code: string) => { url.pathname = "/login"; url.search = `?sso=${code}`; return NextResponse.redirect(url); };
  const p = await verifyPortalToken(req.nextUrl.searchParams.get("ticket") ?? "", "sso");
  if (!p?.jti) return toLogin("invalid");
  // التذكرة تُستخدم مرة واحدة فقط (جدول مشترك بين كل العمليات)
  await prisma.ssoJti.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 10 * 60_000) } } });
  try { await prisma.ssoJti.create({ data: { jti: p.jti } }); } catch { return toLogin("invalid"); }
  const ident = String(p.lu || p.email || "").trim().toLowerCase();
  const user = ident ? await prisma.user.findFirst({ where: { email: ident, isActive: true } }) : null;
  if (!user) return toLogin("nouser");
  await startSession(user.id, user.sessionVersion);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit(user.id, "login", "portal");
  const next = req.nextUrl.searchParams.get("next") ?? "";
  url.pathname = /^\/(?![\/\\])/.test(next) && !next.includes("\\") ? next.split("?")[0] : "/";
  url.search = "";
  return NextResponse.redirect(url);
}
