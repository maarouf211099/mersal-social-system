"use client";
// مكوّنات صغيرة تفاعلية: اختيار الشهر، تحديد الكل، تأكيد قبل التنفيذ
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function MonthSelect({ value, options }: { value: string; options: { v: string; l: string }[] }) {
  const router = useRouter(); const sp = useSearchParams(); const path = usePathname();
  return (
    <label className="field" style={{ minWidth: 160 }}><span>الشهر</span>
      <select value={value} onChange={(e) => { const q = new URLSearchParams(sp.toString()); q.set("m", e.target.value); router.push(`${path}?${q}`); }}>
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  );
}

/** يحدد أو يلغي كل checkboxes باسم معيّن داخل نفس الفورم */
export function SelectAll({ name, label = "تحديد الكل" }: { name: string; label?: string }) {
  return (
    <input type="checkbox" aria-label={label} title={label}
      onChange={(e) => { e.currentTarget.form?.querySelectorAll<HTMLInputElement>(`input[type=checkbox][name="${name}"]`).forEach((c) => (c.checked = e.currentTarget.checked)); }} />
  );
}

/** فلاتر GET تتطبق فوراً عند التغيير */
export function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
