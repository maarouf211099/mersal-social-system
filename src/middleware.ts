import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC = ["/login", "/api/health", "/sso/callback", "/api/portal/summary"];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  // فحص سريع للتوقيع — الفحص الكامل (موقوف؟ الدور؟) في auth() من الداتابيز
  const claims = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (claims) {
    const h = new Headers(req.headers);
    h.set("x-app-path", pathname);
    return NextResponse.next({ request: { headers: h } });
  }
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|svg|ico)$).*)"] };
