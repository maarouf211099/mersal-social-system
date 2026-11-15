import "server-only";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { ActionError, requireAction, type AppUser } from "./auth";
import type { Perm } from "./perms";

export type State = { error?: string; ok?: string; tempPassword?: string } | undefined;
export const fail = (msg: string): never => { throw new ActionError(msg); };

/** غلاف موحد لكل الإجراءات: يتحقق من الصلاحية على السيرفر، ويرجع رسالة واضحة بدل الخطأ التقني */
export async function run(perm: Perm | undefined, fn: (u: AppUser) => Promise<string | void>): Promise<State> {
  try {
    const u = await requireAction(perm);
    const ok = await fn(u);
    revalidatePath("/", "layout");
    return { ok: ok || "تم الحفظ." };
  } catch (e) {
    if (e instanceof ActionError) return { error: e.message };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "السجل موجود من قبل (تكرار غير مسموح)." };
    if (e && typeof e === "object" && "digest" in e && String((e as any).digest).startsWith("NEXT_REDIRECT")) throw e;
    console.error(e);
    return { error: "حصل خطأ غير متوقع ولم يُحفظ شيء. جرّب مرة أخرى." };
  }
}

export const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
export const strs = (f: FormData, k: string) => f.getAll(k).map((v) => String(v).trim()).filter(Boolean);
export const num = (f: FormData, k: string) => { const v = str(f, k); return v === "" ? NaN : Number(v); };
export function dateOf(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return isNaN(d.getTime()) ? null : d;
}
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);
