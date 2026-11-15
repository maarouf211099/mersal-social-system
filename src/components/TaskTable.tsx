import Link from "next/link";
import type { Task } from "@prisma/client";
import { TASK_KIND_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";
import { fmtTs } from "@/lib/format";
import { Badge, CaseLink, Table } from "./ui";
import { SelectAll } from "./client";

export function TaskTable({ rows, names, caseNames, selectable, empty }: { rows: Task[]; names: { name: (id?: string | null) => string }; caseNames: Map<string, string>; selectable?: boolean; empty: string }) {
  const now = Date.now();
  return (
    <Table heads={[...(selectable ? [<SelectAll key="a" name="ids" />] : []), "المهمة", "الحالة", "مسندة إلى", "أُنشئت", "الموعد", "الحالة", "نفّذها", "النتيجة"]} empty={empty}>
      {rows.map((t) => {
        const late = ["new", "in_progress"].includes(t.status) && t.dueAt.getTime() < now;
        const lateDone = t.completedAt && t.completedAt > t.dueAt;
        const shown = late ? "متأخرة" : TASK_STATUS_LABELS[t.status as keyof typeof TASK_STATUS_LABELS] ?? "ملغاة";
        const tone = t.status === "done" ? "ok" : late || t.status === "stuck" ? "bad" : t.status === "in_progress" ? "info" : t.status === "cancelled" ? "" : "";
        return (
          <tr key={t.id} className={late ? "late" : ""}>
            {selectable && <td><input type="checkbox" name="ids" value={t.id} aria-label="تحديد" /></td>}
            <td><Link className="strong" href={`/tasks/${t.id}`}>{t.title}</Link><span className="cell-sub">{TASK_KIND_LABELS[t.kind]}</span></td>
            <td>{t.caseCode ? <CaseLink code={t.caseCode} name={caseNames.get(t.caseCode)} /> : "—"}</td>
            <td>{t.assigneeId ? names.name(t.assigneeId) : <Badge tone="warn">غير مسندة</Badge>}</td>
            <td className="nowrap">{fmtTs(t.createdAt)}</td>
            <td className="nowrap">{fmtTs(t.dueAt)}</td>
            <td><Badge tone={tone}>{t.status === "cancelled" ? "ملغاة" : shown}</Badge>{lateDone && <span className="cell-sub">بعد الموعد</span>}{t.returnedCount > 0 && <span className="cell-sub"><Badge tone="warn">أُرجعت ×{t.returnedCount}</Badge></span>}</td>
            <td>{t.completedById ? <>{names.name(t.completedById)}{t.assigneeId && t.completedById !== t.assigneeId && <span className="cell-sub">ليس المسند إليه</span>}</> : "—"}</td>
            <td className="cell-sub" style={{ maxWidth: 260 }}>{t.result}</td>
          </tr>
        );
      })}
    </Table>
  );
}
