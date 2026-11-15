import Link from "next/link";
import type { StaffRow } from "@/lib/metrics";
import { fmtDur, pct } from "@/lib/format";
import { Badge, Table } from "./ui";

export function StaffTable({ rows, names, m }: { rows: StaffRow[]; names: { name: (id?: string | null) => string }; m: string }) {
  const max = Math.max(1, ...rows.map((r) => r.weight));
  return (
    <Table heads={["الموظف", "مهام مسندة", "المسند المكتمل", "نسبة الإنجاز", "نفّذ بنفسه", "العمليات", "المكتمل منها", "متوسط زمن التنفيذ", "متأخرة", "أُرجعت للتصحيح", "الإنتاجية (بالأوزان)"]} empty="لا يوجد نشاط للموظفين في هذا الشهر.">
      {rows.map((r) => (
        <tr key={r.uid}>
          <td><Link className="strong" href={`/reports?view=staff&staff=${r.uid}&m=${m}`}>{names.name(r.uid)}</Link></td>
          <td>{r.assigned}</td><td>{r.assignedDone}</td><td>{pct(r.assignedDone, r.assigned)}</td><td>{r.doneBy}</td>
          <td>{r.ops}</td><td>{pct(r.opsDone, r.ops)}</td><td className="nowrap">{fmtDur(r.avgMs)}</td>
          <td>{r.late ? <Badge tone="bad">{r.late}</Badge> : 0}</td><td>{r.returned ? <Badge tone="warn">{r.returned}</Badge> : 0}</td>
          <td><div className="bar-cell"><div className="track"><i style={{ width: `${Math.round((r.weight / max) * 100)}%` }} /></div><b>{r.weight}</b></div></td>
        </tr>
      ))}
    </Table>
  );
}
