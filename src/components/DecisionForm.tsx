"use client";

import { useEffect, useMemo, useState } from "react";
import { createDecision } from "@/actions/decisions";
import { ActionForm, Submit } from "./forms";

type Svc = { id: string; name: string; kind: string; cycle: string };
type Running = { serviceId: string; start: string; end: string; no: string; beneficiary: string };
type Line = { svc: string; amount: string; months: number; start: string; end: string; note: string; touchedEnd: boolean; beneficiary: string };

const MN = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const toIdx = (m: string) => { const [y, mo] = m.split("-").map(Number); return y * 12 + mo - 1; };
const fromIdx = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
const add = (m: string, n: number) => fromIdx(toIdx(m) + n);
const span = (s: string, e: string) => toIdx(e) - toIdx(s) + 1;
const fmt = (m: string) => (m ? `${MN[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}` : "—");
const suggest = (iso: string) => { if (!iso) return ""; const [y, m, d] = iso.split("-").map(Number); return add(`${y}-${String(m).padStart(2, "0")}`, d <= 18 ? 1 : 2); };

export function DecisionForm({ services, cases, init, canOverride }: {
  services: Svc[]; cases: { code: string; name: string; running: Running[]; beneficiaries: string[] }[];
  init: { code?: string; renewOf?: string; donor?: string; text?: string; startAfter?: string; lines?: { svc: string; amount: string; months: number; beneficiary?: string }[] };
  canOverride: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [code, setCode] = useState(init.code ?? "");
  const [issue, setIssue] = useState(today);
  const base = init.startAfter ? add(init.startAfter, 1) : suggest(today);
  const mk = (svc: string, amount: string, months: number, start = base, beneficiary = ""): Line => ({ svc, amount, months, start, end: add(start, months - 1), note: "", touchedEnd: false, beneficiary });
  const [lines, setLines] = useState<Line[]>(init.lines?.length ? init.lines.map((l) => mk(l.svc, l.amount, l.months, base, l.beneficiary ?? "")) : [mk(services[0]?.id ?? "", "", 6)]);
  const found = cases.find((c) => c.code === code.trim());
  const info = useCaseInfo(found?.code);
  const set = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, j) => {
    if (j !== i) return l;
    const n = { ...l, ...p };
    const s = services.find((x) => x.id === n.svc);
    if (p.svc && s?.cycle === "once") { n.months = 1; n.end = n.start; }
    if ((p.months || p.start) && !n.touchedEnd) n.end = add(n.start, Math.max(1, n.months) - 1);
    return n;
  }));
  const months = useMemo(() => { const out: string[] = []; const c = suggest(today); for (let i = -24; i <= 36; i++) out.push(add(c, i)); return out; }, [today]);
  const conflicts = lines.map((l) => found?.running.find((r) => r.serviceId === l.svc && r.beneficiary === l.beneficiary.trim() && !(l.end < r.start || l.start > r.end)));
  return (
    <ActionForm action={createDecision}>
      <input type="hidden" name="renewOf" value={init.renewOf ?? ""} />
      <div className="fgrid">
        <label className="field"><span>كود الحالة *</span><input name="code" list="caseCodes" value={code} onChange={(e) => setCode(e.target.value)} required dir="ltr" inputMode="numeric" /></label>
        <label className="field"><span>اسم الحالة {found ? "" : "*"}</span>{found ? <input key="found" value={found.name} disabled readOnly /> : <input key="new" name="name" placeholder="كود جديد: اكتب الاسم لتسجيل الحالة" />}</label>
        <label className="field"><span>تاريخ القرار</span><input type="date" name="issueDate" value={issue} onChange={(e) => {
          setIssue(e.target.value); const s = suggest(e.target.value);
          if (s && !init.startAfter) setLines((ls) => ls.map((l) => ({ ...l, start: s, end: l.touchedEnd ? l.end : add(s, l.months - 1) })));
        }} /></label>
        <label className="field"><span>رقم القرار</span><input name="no" placeholder="تلقائي لو فاضي" /></label>
        <label className="field"><span>المتبرع</span><input name="donor" defaultValue={init.donor} /></label>
      </div>
      {found && <CaseInfo info={info} />}
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
              <label className="field"><span>المستفيد (لو غير صاحب الملف)</span><input name="beneficiary" list={`bens-${i}`} value={l.beneficiary} onChange={(e) => set(i, { beneficiary: e.target.value })} placeholder="مثال: اسم الطفل" /><datalist id={`bens-${i}`}>{(found?.beneficiaries ?? []).map((b) => <option key={b} value={b} />)}</datalist></label>
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

type Info = { name: string; nationality: string; governorate: string; area: string; address: string; phone: string; age: number | null; unhcr: string; recvName: string; recvIdNo: string; recvMethod: string; residencyStatus: string; residencyExpiry: string; missing: string[] };

/** البيانات الأولية بتتجاب من السيستم أول ما الكود يتكتب */
function useCaseInfo(code?: string) {
  const [info, setInfo] = useState<Info | null | "loading">(null);
  useEffect(() => {
    if (!code) { setInfo(null); return; }
    let live = true;
    setInfo("loading");
    fetch(`/api/cases/${encodeURIComponent(code)}`).then((r) => r.json()).then((j) => { if (live) setInfo(j.found ? j : null); }).catch(() => live && setInfo(null));
    return () => { live = false; };
  }, [code]);
  return info;
}

function CaseInfo({ info }: { info: Info | null | "loading" }) {
  if (info === "loading") return <div className="case-info loading">جارٍ تحميل بيانات الحالة…</div>;
  if (!info) return null;
  const v = (x: React.ReactNode) => x || <span className="muted">—</span>;
  return (
    <div className="case-info">
      <div className="ci-head"><b>بيانات الحالة من السيستم</b><span className={`badge ${info.missing.length ? "warn" : "ok"}`}>{info.missing.length ? `بيانات الاستلام ناقصة: ${info.missing.join("، ")}` : "بيانات الاستلام مكتملة"}</span></div>
      <div className="kv">
        <div><span>الاسم</span>{info.name}</div>
        <div><span>الجنسية</span>{v(info.nationality)}</div>
        <div><span>المحافظة / المنطقة</span>{v([info.governorate, info.area].filter(Boolean).join(" · "))}</div>
        <div><span>الهاتف</span>{v(<span className="num">{info.phone}</span>)}</div>
        <div><span>السن</span>{v(info.age)}</div>
        <div><span>اسم المستلم</span>{v(info.recvName)}</div>
        <div><span>الرقم القومي</span>{v(<span className="num">{info.recvIdNo}</span>)}</div>
        <div><span>طريقة الاستلام</span>{v(info.recvMethod)}</div>
        <div><span>موقف الإقامة</span>{v([info.residencyStatus, info.residencyExpiry && `حتى ${info.residencyExpiry}`].filter(Boolean).join(" · "))}</div>
      </div>
      <p className="muted">بيانات الاستلام (المستلم، الرقم القومي، طريقة الاستلام، الإقامة) بتتأكد في مكالمة التأكيد قبل الصرف.</p>
    </div>
  );
}
