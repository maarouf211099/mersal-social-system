// Edge-safe (بيستخدمه الـmiddleware) — من غير Prisma
import { SignJWT, jwtVerify } from "jose";

// اسم كوكي خاص بالبوابة — مايتكررش مع البوابة أو أي نظام تاني على نفس السيرفر
export const SESSION_COOKIE = "mersal_social_session";
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 ساعة

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("لازم AUTH_SECRET يكون 32 حرف على الأقل في .env");
  return new TextEncoder().encode(s);
}

export type SessionClaims = { sub: string; ver: number };

export async function signSession(userId: string, ver: number): Promise<string> {
  return new SignJWT({ ver })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { sub: payload.sub, ver: Number(payload.ver ?? 0) };
  } catch {
    return null;
  }
}
