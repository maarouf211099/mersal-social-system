import type { Ent } from "@/lib/entitlements";
import { followRequired } from "@/lib/stage";

/** خطوات دورة الاستحقاق: تم (أخضر) · الحالية · متعثرة (أحمر) */
export function Steps({ e }: { e: Ent }) {
  const steps: [string, boolean][] = [];
  if (e.needsConfirm) steps.push(["تأكيد", !!e.confirmedAt]);
  steps.push([e.kind === "in_kind" ? "تسليم" : "إرسال", !!e.sentAt || e.legacySent]);
  if (e.kind === "financial") steps.push(["تحويل", !!e.transfer || e.legacySent]);
  if (followRequired(e.kind, e.line.service.needsFollow)) steps.push(["متابعة", e.followDone]);
  const bad = ["noans", "notpaid", "stuck", "refund"].includes(e.stage);
  let cur = false;
  return (
    <div className="steps">
      {steps.map(([l, done]) => { let c = ""; if (done) c = "on"; else if (!cur) { c = bad ? "x" : "cur"; cur = true; } return <span key={l} className={c}>{l}</span>; })}
    </div>
  );
}
