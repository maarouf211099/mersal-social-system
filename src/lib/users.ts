import "server-only";
import { cache } from "react";
import { prisma } from "./prisma";

/** أسماء كل المستخدمين (عددهم صغير) — لعرض «مين عمل إيه» */
export const userNames = cache(async () => {
  const rows = await prisma.user.findMany({ select: { id: true, name: true, isActive: true, role: true, team: true }, orderBy: { name: "asc" } });
  const map = new Map(rows.map((r) => [r.id, r.name]));
  return { name: (id: string | null | undefined) => (id ? map.get(id) ?? "—" : "—"), all: rows, active: rows.filter((r) => r.isActive && r.role !== "viewer") };
});
