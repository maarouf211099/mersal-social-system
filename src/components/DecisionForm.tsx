"use client";

import { useMemo, useState } from "react";
import { createDecision } from "@/actions/decisions";
import { ActionForm, Submit } from "./forms";

type Svc = { id: string; name: string; kind: string; cycle: string };
type Running = { serviceId: string; start: string; end: string; no: string };
type Line = { svc: string; amount: string; months: number; start: string; end: string; note: string; touchedEnd: boolean };

const MN = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const toIdx = (m: string) => { const [y, mo] = m.split("-").map(Number); return y * 12 + mo - 1; };
const fromIdx = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
const add = (m: string, n: number) => fromIdx(toIdx(m) + n);
const span = (s: string, e: string) => toIdx(e) - toIdx(s) + 1;
const fmt = (m: string) => (m ? `${MN[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}` : "—");
const suggest = (iso: string) => { if (!iso) return ""; const [y, m, d] = iso.split("-").map(Number); return add(`${y}-${String(m).padStart(2, "0")}`, d <= 18 ? 1 : 2); };

export function DecisionForm({ services, cases, init, canOverride }: {
  services: Svc[]; cases: { code: string; name: string; running: Running[] }[];
  init: { code?: string; renewOf?: string; donor?: string; text?: string; startAfter?: string; lines?: { svc: string; amount: string; months: number }[] };
  canOverride: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [code, setCode] = useState(init.code ?? "");
  const [issue, setIssue] = useState(today);
  const base = init.startAfter ? add(init.startAfter, 1) : suggest(today);
  const mk = (svc: string, amount: string, months: number, start = base): Line => ({ svc, amount, months, start, end: add(start, months - 1), note: "", touchedEnd: false });
  const [lines, setLines] = useState<Line[]>(init.lines?.length ? init.lines.map((l) => mk(l.svc, l.amount, l.months)) : [mk(services[0]?.id ?? "", "", 6)]);
  const found = cases.find((c) => c.code === code.trim());
  const set = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, j) => {
    if (j !== i) return l;
    const n = { ...l, ...p };
    const s = services.find((x) => x.id === n.svc);
    if (p.svc && s?.cycle === "once") { n.months = 1; n.end = n.start; }
    if ((p.months || p.start) && !n.touchedEnd) n.end = add(n.start, Math.max(1, n.months) - 1);
    return n;
  }));
  const months = useMemo(() => { const out: string[] = []; const c = suggest(today); for (let i = -24; i <= 36; i++) out.push(add(c, i)); return out; }, [today]);
  const conflicts = lines.map((l) => found?.running.find((r) => r.serviceId === l.svc && !(l.end < r.start || l.start > r.end)));
  return (
    <ActionForm action={createDecision}>
      <input type="hidden" name="renewOf" value={init.renewOf ?? ""} />
      <div className="fgrid">
        <label className="field"><span>كود الحالة *</span><input name="code" list="caseCodes" value={code} onChange={(e) => setCode(e.target.value)} required dir="ltr" inputMode="numeric" /></label>
        <label className="field"><span>اسم الحالة {found ? "" : "*"}</span>{found ? <input value={found.name} disabled /> : <input name="name" placeholder="كود جديد: اكتب الاسم لتسجيل الحالة" />}</label>
        <label className="field"><span>تاريخ القرار</span><input type="date" name="issueDate" value={issue} onChange={(e) => {
          setIssue(e.target.value); const s = suggest(e.target.value);
          if (s && !init.startAfter) setLines((ls) => ls.map((l) => ({ ...l, start: s, end: l.touchedEnd ? l.end : add(s, l.months - 1) })));
        }} /></label>
        <label className="field"><span>رقم القرار</span><input name="no" placeholder="تلقائي لو فاضي" /></label>
        <label className="field"><span>المتبرع</span><input name="donor" defaultValue={init.donor} /></label>
      </div>
      <datalist id="caseCodes">{cases.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</datalist>
      <div className="alert">بداية الصرف المقترحة من تاريخ القرار: <b>{fmt(suggest(issue))}</b> (القرار من 19 إلى 18 يبدأ صرفه أول الشهر التالي). لا يُنشأ أي استحقاق بعد شهر النهاية.</div>
      <label className="field"><span>نص القرار (اختياري)</span><textarea name="text" defaultValue={init.text} /></label>
      <h3 className="section-title" style={{ margin: "6px 0 0" }}><span>الخدمات في القرار</span></h3>
      {lines.map((l, i) => {
        const n = span(l.start, l.end), mis = n !== l.months, s = services.find((x) => x.id === l.svc);
        return (
          <div className="line-box stack-sm" key={i}>
            <div className="fgrid">
              <label className="field"><span>نوع الخدمة</span><select name="svc" value={l.svc} onChange={(e) => set(i, { svc: e.target.value })}>{services.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
              <label className="field"><span>{s?.kind === "financial" ? "القيمة الشهرية (جنيه)" : "القيمة / التكلفة (جنيه)"}</span><input type="number" min={0} name="amount" value={l.amount} onChange={(e) => set(i, { amount: e.target.value })} required /></label>
              <label className="field"><span>مدة القرار (شهر)</span><input type="number" min={1} name="months" value={l.months} onChange={(e) => set(i, { months: Math.max(1, Number(e.target.value) || 1) })} /></label>
              <label className="field"><span>من شهر</span><select name="start" value={l.start} onChange={(e) => set(i, { start: e.target.value })}>{months.map((m) => <option key={m} value={m}>{fmt(m)}</option>)}</select></label>
              <label className="field"><span>إلى شهر</span><select name="end" value={l.end} onChange={(e) => set(i, { end: e.target.value, touchedEnd: true })}>{months.map((m) => <option key={m} value={m}>{fmt(m)}</option>)}</select></label>
            </div>
            {mis ? <><div className="muted" style={{ color: "var(--bad)" }}>المدة المكتوبة {l.months} شهر والمحسوبة من التواريخ {n} شهر. اكتب ملاحظة توضح السبب.</div><textarea name="note" value={l.note} onChange={(e) => set(i, { note: e.target.value })} placeholder="سبب الاختلاف" /></>
              : <><input type="hidden" name="note" value="" /><div className="muted">{n} شهر</div></>}
            {conflicts[i] && <div className="alert bad" style={{ margin: 0 }}>تعارض: الخدمة سارية للحالة في قرار {conflicts[i]!.no} ({fmt(conflicts[i]!.start)} ← {fmt(conflicts[i]!.end)}).</div>}
            {lines.length > 1 && <div><button type="button" className="btn danger small" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>حذف الخدمة</button></div>}
          </div>
        );
      })}
      <div><button type="button" className="btn secondary small" onClick={() => setLines((ls) => [...ls, mk(services[0]?.id ?? "", "", 6, suggest(issue))])}>+ إضافة خدمة</button></div>
      {conflicts.some(Boolean) && (canOverride
        ? <label className="field"><span>مراجعة التعارض (مشرف): سبب اعتماد قرار متداخل</span><input name="override" placeholder="مثال: زيادة قيمة الكفالة بقرار لجنة" /></label>
        : <div className="alert warn">يوجد تعارض مع قرار ساري. أوقف القرار القديم أولاً أو اطلب مراجعة المشرف.</div>)}
      <div><Submit>حفظ القرار</Submit></div>
    </ActionForm>
  );
}
