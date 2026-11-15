import "server-only";
import { prisma } from "./prisma";

export type Policy = "carry" | "extend" | "drop";
export type Settings = {
  renewLead: number; confirmDays: number; followDays: number; actionDays: number; taskDays: number;
  policy: Policy; assign: { confirm: string; follow: string; action: string };
};
export const DEFAULT_SETTINGS: Settings = {
  renewLead: 2, confirmDays: 3, followDays: 3, actionDays: 5, taskDays: 3, policy: "carry",
  assign: { confirm: "", follow: "", action: "" },
};

export async function getSettings(): Promise<Settings> {
  const row = await prisma.setting.findUnique({ where: { key: "main" } });
  const v = (row?.value ?? {}) as Partial<Settings>;
  return { ...DEFAULT_SETTINGS, ...v, assign: { ...DEFAULT_SETTINGS.assign, ...(v.assign ?? {}) } };
}
