"use client";
import { useEffect } from "react";

/** «/» من أي مكان بيفتح البحث السريع */
export function SearchKey() {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      const i = document.querySelector<HTMLInputElement>(".topbar .qsearch input");
      if (i && i.offsetParent) { e.preventDefault(); i.focus(); }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  return null;
}
