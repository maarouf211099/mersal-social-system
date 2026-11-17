"use client";

import { useEffect } from "react";

// رسالة تقييم النظام: بتظهر مرة واحدة لكل مستخدم بعد الدخول (الكود في public/mersal-feedback.js).
// الرد بيتسجل في قاعدة النظام (POST /api/feedback). بعد UNTIL الرسالة مش بتظهر.
const UNTIL = "2026-11-30";

type Props = {
  system: string;
  name: string;
  user: string;
  /** المستخدم داخل ومش مطلوب منه يغيّر كلمة المرور */
  ready: boolean;
};

/** طلب على نفس السيرفر بالكوكي بتاعة الجلسة — ولو فشل نرجّع رسالة السيرفر بالعربي */
async function call(url: string, init?: RequestInit): Promise<unknown> {
  const r = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  let j: unknown = null;
  try { j = await r.json(); } catch {}
  if (!r.ok) {
    if (r.status === 401) throw new Error("انتهت الجلسة. سجّل الدخول مرة أخرى.");
    const msg = j && typeof j === "object" && typeof (j as { error?: unknown }).error === "string" ? (j as { error: string }).error : "";
    throw new Error(msg || "حصلت مشكلة في الاتصال بالسيرفر، جرّب تاني.");
  }
  return j;
}

export default function FeedbackPrompt({ system, name, user, ready }: Props) {
  useEffect(() => {
    const w = window as unknown as { MERSAL_FEEDBACK?: Record<string, unknown> };
    w.MERSAL_FEEDBACK = {
      system, name, until: UNTIL,
      ready: () => ready && !!user,
      user: () => user,
      submit: (data: unknown) => call("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      }),
      mine: async () => !!((await call("/api/feedback/mine")) as { submitted?: boolean } | null)?.submitted,
      // من غير canViewResults/results: النتائج المجمعة لكل الأنظمة في صفحة واحدة جوه سيستم الحالات
    };
    if (!document.getElementById("mfb-js")) {
      const s = document.createElement("script");
      s.id = "mfb-js";
      s.src = "/mersal-feedback.js";
      s.defer = true;
      document.body.appendChild(s);
    }
    // لما الصفحات دي تتقفل (خروج مثلاً) الرسالة ماتظهرش
    return () => { if (w.MERSAL_FEEDBACK) w.MERSAL_FEEDBACK = { ...w.MERSAL_FEEDBACK, ready: () => false }; };
  }, [system, name, user, ready]);
  return null;
}
