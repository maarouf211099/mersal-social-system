"use server";

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, num, run, str, type State } from "@/lib/action";
import { ActionError, requireAction } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getSettings } from "@/lib/settings";
import { importV1 } from "@/lib/import-v1";

const ROLES: Role[] = ["admin", "supervisor", "finance", "staff", "viewer"];
function tempPassword() {
  const abc = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(12), (b) => abc[b % abc.length]).join("");
}

export async function createUser(_p: State, f: FormData): Promise<State> {
  let pw = "";
  const r = await run("admin", async (u) => {
    const email = str(f, "email").toLowerCase(), name = str(f, "name"), role = str(f, "role") as Role;
    if (!/^[^@\s]+@[^@\s]+$/.test(email)) fail("اكتب إيميل صحيح.");
    if (!name) fail("اكتب الاسم.");
    if (!ROLES.includes(role)) fail("اختار الدور.");
    if (await prisma.user.findUnique({ where: { email } })) fail("الإيميل مسجل من قبل.");
    pw = tempPassword();
    await prisma.user.create({ data: { email, name, role, team: str(f, "team"), passwordHash: await bcrypt.hash(pw, 12), mustChangePassword: true } });
    await prisma.auditLog.create({ data: { userId: u.id, action: "user_created", target: email, meta: { role } } });
    return `تمت إضافة ${name}. لو بيدخل من بوابة مرسال بنفس الإيميل مش محتاج كلمة المرور.`;
  });
  return r?.ok ? { ...r, tempPassword: pw } : r;
}

export async function updateUser(_p: State, f: FormData): Promise<State> {
  return run("admin", async (u) => {
    const id = str(f, "id"), role = str(f, "role") as Role, team = str(f, "team"), active = str(f, "active") === "1", name = str(f, "name");
    if (!ROLES.includes(role)) fail("اختار الدور.");
    const old = await prisma.user.findUniqueOrThrow({ where: { id } });
    if (id === u.id && (role !== "admin" || !active)) fail("لا يمكنك إلغاء صلاحية المدير عن نفسك أو إيقاف حسابك.");
    await prisma.user.update({ where: { id }, data: { role, team, isActive: active, name: name || old.name, ...(old.isActive && !active ? { sessionVersion: { increment: 1 } } : {}) } });
    await prisma.auditLog.create({ data: { userId: u.id, action: "user_updated", target: old.email, meta: { old: { role: old.role, team: old.team, active: old.isActive }, new: { role, team, active } } } });
    return "تم حفظ المستخدم.";
  });
}

export async function resetPassword(_p: State, f: FormData): Promise<State> {
  let pw = "";
  const r = await run("admin", async (u) => {
    const id = str(f, "id");
    pw = tempPassword();
    const t = await prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(pw, 12), mustChangePassword: true, sessionVersion: { increment: 1 } } });
    await prisma.auditLog.create({ data: { userId: u.id, action: "password_reset", target: t.email } });
    return `كلمة مرور مؤقتة جديدة لـ ${t.name}:`;
  });
  return r?.ok ? { ...r, tempPassword: pw } : r;
}

export async function saveSettings(_p: State, f: FormData): Promise<State> {
  return run("admin", async (u) => {
    const old = await getSettings();
    const n = (k: string, min: number, max: number, d: number) => { const v = Math.floor(num(f, k)); return v >= min && v <= max ? v : d; };
    const policy = str(f, "policy");
    const value = {
      renewLead: n("renewLead", 1, 6, 2), confirmDays: n("confirmDays", 1, 60, 3), followDays: n("followDays", 0, 60, 3),
      actionDays: n("actionDays", 1, 60, 5), taskDays: n("taskDays", 1, 60, 3),
      policy: (["carry", "extend", "drop"].includes(policy) ? policy : "carry") as "carry",
      assign: { confirm: str(f, "assignConfirm"), follow: str(f, "assignFollow"), action: str(f, "assignAction") },
    };
    await prisma.setting.upsert({ where: { key: "main" }, create: { key: "main", value, updatedById: u.id }, update: { value, updatedById: u.id } });
    await prisma.auditLog.create({ data: { userId: u.id, action: "settings_updated", target: "الإعدادات", meta: { old, new: value } } });
    return "تم حفظ الإعدادات.";
  });
}

export async function saveService(_p: State, f: FormData): Promise<State> {
  return run("admin", async (u) => {
    const id = str(f, "id"), name = str(f, "name");
    const kind = str(f, "kind") as any, cycle = str(f, "cycle") as any, needsFollow = str(f, "needsFollow") === "1", isActive = str(f, "isActive") !== "0";
    if (!["financial", "card", "in_kind", "service"].includes(kind) || !["monthly", "once", "coverage"].includes(cycle)) fail("اختار الفئة والدورة.");
    if (id) {
      const old = await prisma.service.findUniqueOrThrow({ where: { id } });
      await prisma.service.update({ where: { id }, data: { kind, cycle, needsFollow, isActive } }); // الاسم لا يتغير حفاظاً على التاريخ
      await prisma.auditLog.create({ data: { userId: u.id, action: "service_updated", target: old.name, meta: { old, new: { kind, cycle, needsFollow, isActive } } } });
    } else {
      if (!name) fail("اكتب اسم الخدمة.");
      await prisma.service.create({ data: { name, kind, cycle, needsFollow, sort: 1000 } });
      await prisma.auditLog.create({ data: { userId: u.id, action: "service_created", target: name } });
    }
    return "تم حفظ الخدمة.";
  });
}

export async function saveOpType(_p: State, f: FormData): Promise<State> {
  return run("admin", async (u) => {
    const id = str(f, "id"), name = str(f, "name"), team = str(f, "team"), weight = num(f, "weight"), scope = str(f, "scope") === "general" ? "general" : "case";
    if (!(weight > 0)) fail("الوزن لازم يكون أكبر من صفر.");
    if (id) await prisma.opType.update({ where: { id }, data: { team, weight, isActive: str(f, "isActive") !== "0" } });
    else { if (!name) fail("اكتب اسم العملية."); await prisma.opType.create({ data: { name, team: team || "عام", weight, scope, sort: 2000 } }); }
    await prisma.auditLog.create({ data: { userId: u.id, action: "optype_saved", target: name || id, meta: { team, weight } } });
    return "تم الحفظ.";
  });
}

export async function importData(_p: State, f: FormData): Promise<State> {
  try {
    const u = await requireAction("admin");
    const file = f.get("file");
    if (!(file instanceof File) || !file.size) return { error: "اختار ملف النسخة الاحتياطية (JSON)." };
    let data: any;
    try { data = JSON.parse(await file.text()); } catch { return { error: "الملف غير صالح (ليس JSON)." }; }
    const res = await importV1(data, u.id);
    revalidatePath("/", "layout");
    return { ok: res };
  } catch (e) {
    if (e instanceof ActionError) return { error: e.message };
    console.error(e);
    return { error: `فشل الاستيراد ولم يُحفظ شيء: ${(e as Error).message}` };
  }
}
