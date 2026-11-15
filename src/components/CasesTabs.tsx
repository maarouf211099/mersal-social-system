import Link from "next/link";

/** الحالات والقرارات بند واحد بتابين */
export function CasesTabs({ current }: { current: "cases" | "decisions" }) {
  return (
    <div className="tabs" role="tablist">
      <Link role="tab" href="/cases" aria-current={current === "cases" ? "page" : undefined}>الحالات (كل البيانات)</Link>
      <Link role="tab" href="/decisions" aria-current={current === "decisions" ? "page" : undefined}>القرارات</Link>
    </div>
  );
}
