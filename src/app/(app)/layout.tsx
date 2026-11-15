import { headers } from "next/headers";
import { Shell } from "@/components/Shell";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { addMonths, currentMonth } from "@/lib/months";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser({ allowMustChange: true });
  const current = (await headers()).get("x-app-path") ?? "/";
  const st = await getSettings();
  const now = new Date();
  const cm = currentMonth();
  const [my, late, soon] = await Promise.all([
    prisma.task.count({ where: { assigneeId: user.id, status: { in: ["new", "in_progress"] } } }),
    prisma.task.count({ where: { status: { in: ["new", "in_progress"] }, dueAt: { lt: now } } }),
    prisma.decisionLine.groupBy({ by: ["decisionId"], where: { decision: { status: "active", renewalStatus: "none" } }, _max: { endMonth: true } }),
  ]);
  const renew = soon.filter((g) => g._max.endMonth && g._max.endMonth >= cm && g._max.endMonth <= addMonths(cm, st.renewLead)).length;
  return <Shell user={user} current={current} counts={{ my, late, renew }}>{children}</Shell>;
}
