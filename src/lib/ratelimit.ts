// حماية بسيطة من تخمين كلمة المرور: 8 محاولات غلط كل 10 دقايق لكل إيميل/IP
const attempts = new Map<string, { n: number; until: number }>();
const WINDOW_MS = 10 * 60_000;
const MAX = 8;

export function isBlocked(key: string): boolean {
  const a = attempts.get(key);
  return !!a && a.until > Date.now() && a.n >= MAX;
}
export function fail(key: string) {
  const now = Date.now();
  const a = attempts.get(key);
  attempts.set(key, { n: (a && a.until > now ? a.n : 0) + 1, until: now + WINDOW_MS });
}
export function clear(key: string) {
  attempts.delete(key);
}
