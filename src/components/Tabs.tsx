"use client";

import { Children, useEffect, useState } from "react";

/** تابات داخل الصفحة (بدون تحميل): التاب المفتوح بيتحفظ في الرابط (#) عشان الرجوع والمشاركة */
export function Tabs({ tabs, children }: { tabs: { key: string; label: string; count?: number }[]; children: React.ReactNode }) {
  const panels = Children.toArray(children);
  const [cur, setCur] = useState(tabs[0]?.key);
  useEffect(() => {
    const h = decodeURIComponent(window.location.hash.slice(1));
    if (tabs.some((t) => t.key === h)) setCur(h);
  }, [tabs]);
  const pick = (k: string) => { setCur(k); history.replaceState(null, "", `#${k}`); };
  return (
    <>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={cur === t.key} aria-current={cur === t.key ? "page" : undefined} onClick={() => pick(t.key)}>
            {t.label}{t.count != null && <span className="tab-count">{t.count}</span>}
          </button>
        ))}
      </div>
      {panels.map((p, i) => <div key={tabs[i]?.key ?? i} role="tabpanel" className="tab-panel" hidden={tabs[i]?.key !== cur}>{p}</div>)}
    </>
  );
}
