"use client";

import { useMemo, useState } from "react";
import { createTask } from "@/actions/tasks";
import { ActionForm, Submit } from "./forms";

type Op = { name: string; team: string };
type Person = { id: string; name: string; team: string };

const PERIODS = [
  { v: "1", l: "خلال يوم" }, { v: "3", l: "خلال 3 أيام" }, { v: "7", l: "خلال أسبوع" },
  { v: "14", l: "خلال أسبوعين" }, { v: "30", l: "خلال شهر" }, { v: "date", l: "تاريخ محدد" },
];

/** إضافة مهمة: النوع من قائمة العمليات (متقسمة بالفريق) ← الموظف (واحد أو أكتر) ← المدة */
export function TaskForm({ ops, people, canAssign, me }: { ops: Op[]; people: Person[]; canAssign: boolean; me: { id: string; name: string } }) {
  const teams = useMemo(() => [...new Set(ops.map((o) => o.team))], [ops]);
  const [team, setTeam] = useState("");
  const [period, setPeriod] = useState("7");
  const [picked, setPicked] = useState<string[]>([]);
  const shown = ops.filter((o) => !team || o.team === team);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const sameTeam = people.filter((p) => team && p.team === team).map((p) => p.id);
  return (
    <ActionForm action={createTask} resetOnOk>
      <div className="fgrid">
        <label className="field"><span>الفريق</span>
          <select value={team} onChange={(e) => setTeam(e.target.value)}><option value="">كل الفرق</option>{teams.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
        <label className="field" style={{ gridColumn: "span 2" }}><span>نوع المهمة * <small className="muted">({shown.length} نوع)</small></span>
          <select name="opType" required defaultValue="">
            <option value="" disabled>اختار المهمة</option>
            {(team ? [team] : teams).map((t) => (
              <optgroup key={t} label={t}>{ops.filter((o) => o.team === t).map((o) => <option key={o.name} value={o.name}>{o.name}</option>)}</optgroup>
            ))}
          </select>
        </label>
        <label className="field"><span>المدة</span>
          <select name="period" value={period} onChange={(e) => setPeriod(e.target.value)}>{PERIODS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}</select>
        </label>
        {period === "date" && <label className="field"><span>الموعد النهائي *</span><input type="date" name="due" required /></label>}
        <label className="field"><span>كود الحالة (اختياري)</span><input name="caseCode" dir="ltr" inputMode="numeric" /></label>
      </div>

      {canAssign ? (
        <div className="field">
          <span>إسناد إلى * <small className="muted">(اختار موظف أو أكتر — كل واحد بتتعمله مهمة لوحده)</small></span>
          <div className="people">
            {people.map((p) => (
              <label key={p.id} className={`person${picked.includes(p.id) ? " on" : ""}`}>
                <input type="checkbox" name="assigneeId" value={p.id} checked={picked.includes(p.id)} onChange={() => toggle(p.id)} />
                <span>{p.name}</span>{p.team && <small>{p.team}</small>}
              </label>
            ))}
          </div>
          <div className="inline" style={{ marginTop: 6 }}>
            <button type="button" className="btn secondary small" onClick={() => setPicked(people.map((p) => p.id))}>تحديد الكل</button>
            {sameTeam.length > 0 && <button type="button" className="btn secondary small" onClick={() => setPicked(sameTeam)}>موظفين فريق {team}</button>}
            {picked.length > 0 && <button type="button" className="btn secondary small" onClick={() => setPicked([])}>إلغاء التحديد ({picked.length})</button>}
          </div>
        </div>
      ) : (
        <input type="hidden" name="assigneeId" value={me.id} />
      )}

      <label className="field"><span>عنوان إضافي / تفاصيل (اختياري)</span><input name="title" placeholder="لو فاضي هيتكتب نوع المهمة" /></label>
      <label className="field"><span>ملاحظات</span><textarea name="notes" /></label>
      <div><Submit>{canAssign && picked.length > 1 ? `إسناد المهمة لـ ${picked.length} موظفين` : "إنشاء المهمة"}</Submit></div>
    </ActionForm>
  );
}
