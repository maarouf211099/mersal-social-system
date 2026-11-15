import "server-only";
import { headers } from "next/headers";
import { prisma } from "./prisma";

export async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  } catch {
    return "local";
  }
}

/** سجل التدقيق — جدول append-only (trigger في القاعدة يمنع التعديل والحذف) */
export async function audit(userId: string | null, action: string, target?: string | null, meta?: Record<string, unknown>) {
  try {
    await prisma.auditLog.create({
      data: { userId, action, target: target ?? null, ip: await clientIp(), meta: (meta ?? undefined) as any },
    });
  } catch (e) {
    console.error("audit failed", e);
  }
}
