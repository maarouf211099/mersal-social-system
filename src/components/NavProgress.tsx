"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** شريط تقدم رفيع أعلى الصفحة أثناء التنقل */
export function NavProgress() {
  const path = usePathname();
  const sp = useSearchParams();
  const [p, setP] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };

  useEffect(() => {
    const start = () => {
      stop();
      setP(0.12);
      timer.current = setInterval(() => setP((x) => (x < 0.9 ? x + (0.9 - x) * 0.12 : x)), 200);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target || a.hasAttribute("download") || !a.href) return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
      if (u.pathname === location.pathname && u.search === location.search) return;
      start();
    };
    const onSubmit = (e: SubmitEvent) => {
      const f = e.target as HTMLFormElement;
      if ((f.getAttribute("method") || "get").toLowerCase() === "get" && !f.hasAttribute("action")) start();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => { document.removeEventListener("click", onClick, true); document.removeEventListener("submit", onSubmit, true); stop(); };
  }, []);

  useEffect(() => {
    if (!timer.current) return;
    stop();
    setP(1);
    const t = setTimeout(() => setP(0), 350);
    return () => clearTimeout(t);
  }, [path, sp]);

  return <div className="nav-progress" aria-hidden><i style={{ transform: `scaleX(${p})`, opacity: p > 0 && p < 1 ? 1 : p === 1 ? 0.9 : 0 }} /></div>;
}
