import "server-only";
import { prisma } from "./prisma";
export async function caseNamesFor(codes: (string | null | undefined)[]) {
  const list = [...new Set(codes.filter((c): c is string => !!c))];
  if (!list.length) return new Map<string, string>();
  return new Map((await prisma.case.findMany({ where: { code: { in: list } }, select: { code: true, name: true } })).map((c) => [c.code, c.name]));
}
