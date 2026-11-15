import "server-only";
import { jwtVerify } from "jose";

// الدخول من بوابة مرسال — docs/SSO في ريبو البوابة. مفتاح النظام في البوابة: social
export const SSO_AUD = "social";
export function portalSecret(): Uint8Array | null {
  const s = process.env.PORTAL_SSO_SECRET;
  return s && s.length >= 32 ? new TextEncoder().encode(s) : null;
}
export async function verifyPortalToken(token: string, typ: "sso" | "summary") {
  const secret = portalSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"], issuer: "mersal-portal", audience: SSO_AUD, maxTokenAge: "65s" });
    if (payload.typ !== typ) return null;
    return payload as { sub: string; jti?: string; email?: string; name?: string; lu?: string | null };
  } catch {
    return null;
  }
}
