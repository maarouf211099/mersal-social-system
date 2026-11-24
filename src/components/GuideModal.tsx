"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Icon } from "./icons";

const FLOW: { t: string; who: string; d: string; href: string; icon: keyof typeof Icon }[] = [
  { t: "تسجيل كود وقرار", who: "ملف القرارات", d: "الكود + الخدمات + القيمة + المدة. لو الكود جديد بيتسجل مع القرار.", href: "/decisions/new", icon: "file" },
  { t: "توليد استحقاقات الشهر", who: "المشرف / المالي", d: "مرة كل شهر من «دورة الصرف». كل خدمة مرة واحدة في الشهر.", href: "/cycle", icon: "wallet" },
  { t: "استكمال البيانات", who: "فريق البيانات", d: "أي حالة ناقصها الهاتف أو اسم المستلم أو الرقم القومي أو موقف الإقامة بتنزل هنا. مكالمة واستكمال.", href: "/data", icon: "user" },
  { t: "الإرسال في الدفعة", who: "الملف المسؤول", d: "اللي بياناته كاملة بس، والمؤجل من الشهر اللي فات معاه. وتنزيل شيت الدفعة Excel للحسابات.", href: "/cycle", icon: "upload" },
  { t: "المتابعة", who: "فريق المتابعة", d: "أي خدمة اتبعتت بتنزل هنا فوراً: اتصال وتأكيد الاستلام (3 محاولات).", href: "/follow", icon: "phone" },
  { t: "تم الاستلام", who: "الشهر اتقفل", d: "الحالة مكتملة العمليات في الشهر. لو شهرين ورا بعض ما اتوصلناش للحالة ← «قائمة الغلق».", href: "/follow?view=done", icon: "check" },
];

/** «دليل العمل» في نافذة منبثقة: دورة الحالة بس */
export function GuideModal() {
  const ref = useRef<HTMLDialogElement>(null);
  const open = () => ref.current?.showModal();
  const close = () => ref.current?.close();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    // الضغط برا النافذة بيقفلها
    const onClick = (e: MouseEvent) => { if (e.target === d) d.close(); };
    d.addEventListener("click", onClick);
    return () => d.removeEventListener("click", onClick);
  }, []);
  return (
    <>
      <a href="#guide" onClick={(e) => { e.preventDefault(); open(); }}><Icon.compass /> دليل العمل</a>
      <dialog ref={ref} className="guide-modal" aria-labelledby="guide-title">
        <div className="gm-head">
          <div>
            <h2 id="guide-title">دليل العمل · دورة الحالة</h2>
            <p>كل شهر الحالة بتمشي في المراحل دي بالترتيب — وكل مرحلة بتسلّم للي بعدها.</p>
          </div>
          <button type="button" className="icon-btn" onClick={close} aria-label="إغلاق"><Icon.x /></button>
        </div>
        <ol className="gm-flow">
          {FLOW.map((f, i) => {
            const I = Icon[f.icon];
            return (
              <li key={f.t}>
                <span className="gm-i"><I /><em>{i + 1}</em></span>
                <div className="gm-body">
                  <div className="gm-title"><b>{f.t}</b><small>{f.who}</small></div>
                  <p>{f.d}</p>
                </div>
                <Link href={f.href} className="btn secondary small" onClick={close}>فتح</Link>
              </li>
            );
          })}
        </ol>
        <div className="gm-foot">البيانات الناقصة بتقفل الإرسال والمتابعة والاستلام لحد ما تكمل · كل عملية متسجلة باسم اللي عملها ووقتها</div>
      </dialog>
    </>
  );
}
