import { readFile } from "node:fs/promises";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storedPath } from "@/lib/files";

export const dynamic = "force-dynamic";

/** فتح مرفق — للمستخدمين المسجلين فقط */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await auth();
  if (!u || u.mustChangePassword) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const a = await prisma.attachment.findUnique({ where: { id: (await params).id } });
  if (!a) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const body = await readFile(storedPath(a.storedName));
    const inline = a.mime.startsWith("image/") || a.mime === "application/pdf";
    return new NextResponse(new Uint8Array(body), { headers: {
      "Content-Type": a.mime, "Content-Length": String(body.length), "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.name)}`,
    } });
  } catch {
    return NextResponse.json({ error: "الملف غير موجود على السيرفر" }, { status: 410 });
  }
}
