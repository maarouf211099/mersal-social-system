import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/perms";
import { loadEnt } from "@/lib/entitlements";
import { getSettings } from "@/lib/settings";
import { userNames } from "@/lib/users";
import { canFollow, followRequired } from "@/lib/stage";
import { NOTPAID_REASONS, POLICY_LABELS, RECV_METHODS, REFUND_REASONS, REFUND_TYPE_LABELS, SETTLEMENT_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";
import { addMonths, fmtMonth } from "@/lib/months";
import { fmtDate, fmtTs, money } from "@/lib/format";
import { approveHold, confirmData, followCall, followNotPaid, recordRefund, recordTransfer, resendCard, setStuck } from "@/actions/cycle";
import { correctTransfer } from "@/actions/corrections";
import { isoDate } from "@/lib/format";
import { CaseLink, PageHead, StageBadge } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { CaseFields } from "@/components/CaseFields";
import { Steps } from "@/components/Steps";
import { Attachments } from "@/components/Attachments";

export default async function EntitlementPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requirePageUser();
  const { id } = await params;
  const st = await getSettings();
  const e = await loadEnt(id, st.followDays);
  if (!e) notFound();
  const [c, attempts, refunds, tasks, prev, names, batch, files] = await Promise.all([
    prisma.case.findUniqueOrThrow({ where: { code: e.caseCode } }),
    prisma.contactAttempt.findMany({ where: { entitlementId: id }, orderBy: { createdAt: "asc" } }),
    prisma.refund.findMany({ where: { entitlementId: id }, orderBy: { createdAt: "asc" } }),
    prisma.task.findMany({ where: { entitlementId: id }, orderBy: { createdAt: "asc" } }),
    e.stage === "hold" ? prisma.entitlement.findUnique({ where: { lineId_month: { lineId: e.lineId, month: addMonths(e.month, -1) } } }) : null,
    userNames(),
    e.batchId ? prisma.paymentBatch.findUnique({ where: { id: e.batchId } }) : null,
    prisma.attachment.findMany({ where: { entitlementId: id }, orderBy: { createdAt: "desc" } }),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const policyOpts = Object.entries(POLICY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>);
  const late = e.stage === "noans" && e.followResult === "no_answer";
  const followOpen = canFollow(e.stage) && !e.followDone;

  const events: [Date | null, string, string | null][] = [
    [e.createdAt, "توليد الاستحقاق", e.createdById],
    [e.confirmedAt, `تأكيد البيانات · ${e.confirmNote}`, e.confirmedById],
    [e.holdApprovedAt, `اعتماد إدراج · ${e.holdApprovedHow ? POLICY_LABELS[e.holdApprovedHow] : ""} · ${e.holdApprovedReason}`, e.holdApprovedById],
    [e.sentAt, `إرسال · دفعة ${batch?.code ?? ""}`, e.sentById],
    [e.transfer?.createdAt ?? null, e.transfer ? `تحويل ${money(e.transfer.amount)} ج · ${e.transfer.method} · مرجع ${e.transfer.ref} · بتاريخ ${fmtDate(e.transfer.date)}` : "", e.transfer?.userId ?? null],
    [e.followAt, `نتيجة المتابعة: ${e.followResult === "received" ? "تم الصرف" : e.followResult === "no_answer" ? "3 محاولات بدون رد" : `لم يتم الصرف · ${e.notPaidReason} · الإجراء: ${e.notPaidAction}`}`, e.followById],
    [e.stuckAt, `تعثر · ${e.stuckReason}`, e.stuckById],
    [e.settledAt, `تسوية · ${e.settledHow ? POLICY_LABELS[e.settledHow] : ""} · ${e.settledNote}`, e.settledById],
    [e.stoppedAt, `إيقاف · ${e.stoppedReason}`, null],
  ];
  const timeline = events.filter((x): x is [Date, string, string | null] => !!x[0]).sort((a, b) => a[0].getTime() - b[0].getTime());

  return (
    <>
      <PageHead title={`استحقاق ${fmtMonth(e.month)} · ${e.serviceName}`} sub={<><CaseLink code={e.caseCode} name={c.name} /></>}>
        <Link className="btn secondary" href={`/cycle?m=${e.month}&kind=${e.kind}`}>رجوع لدورة الصرف</Link>
      </PageHead>
      <div className="card">
        <div className="inline"><StageBadge stage={e.stage} kind={e.kind} /><Steps e={e} /></div>
        <div className="kv" style={{ marginTop: 12 }}>
          <div><span>القيمة</span>{money(e.amountN)} ج{Number(e.carriedAmount) > 0 && ` (منها ${money(e.carriedAmount)} مرحّل)`}</div>
          <div><span>المحوّل</span>{money(e.transferred)}</div><div><span>المسترد</span>{money(e.refundTotal)}</div>
          <div><span>وصل للمستفيد</span>{money(e.received)}</div>
          <div><span>مسؤولية الموظف في المتابعة</span>{followRequired(e.kind, e.line.service.needsFollow) ? (e.followDone ? "مستوفاة" : "غير مستوفاة") : "لا تحتاج متابعة"}</div>
          <div><span>طريقة الاستلام</span>{c.recvMethod || "—"} <span className="num">{c.recvPhone}</span></div>
          <div><span>الهاتف</span><span className="num">{c.phone || "—"}</span></div>
        </div>
      </div>

      {/* ── الإجراء المطلوب حسب المرحلة ── */}
      {e.stage === "missing" && can(u, "confirm") && (
        <div className="card"><div className="card-title"><h2>مكالمة استكمال بيانات الاستلام</h2></div>
          {e.missing.length > 0 && <div className="alert warn">ناقص: <b>{e.missing.join("، ")}</b>. الحالة مش هتتبعت ولا هتنزل المتابعة لحد ما تكمل.</div>}
          <ActionForm action={confirmData}>
            <input type="hidden" name="entId" value={e.id} />
            <label className="field" style={{ maxWidth: 320 }}><span>نتيجة المكالمة *</span><select name="result" required defaultValue=""><option value="">اختار</option><option value="updated">تم الرد وتحديث / استكمال البيانات</option><option value="confirmed">تم الرد وتأكيد البيانات</option><option value="no_answer">لم يرد</option></select></label>
            <CaseFields c={c} part="receive" />
            <label className="field"><span>ملاحظات المكالمة</span><textarea name="note" /></label>
            <p className="muted">البيانات اللي تتعدل هنا تتحدث في ملف الحالة، والقيمة القديمة تتحفظ في سجل التعديلات. للمالي: الهاتف وطريقة الاستلام (ورقم المحفظة) إلزامية. لو اسم المستلم أو الرقم القومي أو موقف الإقامة لسه ناقص، الحالة هتفضل معلّمة «بيانات ناقصة» في الدفعة.</p>
            <div><Submit>حفظ النتيجة</Submit></div>
          </ActionForm>
        </div>
      )}
      {e.stage === "hold" && can(u, "approve") && (
        <div className="card"><div className="card-title"><h2>اعتماد إدراج استحقاق معلّق</h2></div>
          {prev && <div className="alert warn">الشهر السابق ({fmtMonth(prev.month)}) لم يُستلم بعد. <Link href={`/cycle/${prev.id}`}>فتح الشهر السابق</Link></div>}
          <ActionForm action={approveHold}>
            <input type="hidden" name="entId" value={e.id} />
            <div className="row">
              <label className="field"><span>معالجة الشهر غير المستلم</span><select name="how" defaultValue={st.policy}>{policyOpts}</select></label>
              <label className="field"><span>سبب الاعتماد *</span><input name="reason" required placeholder="مثال: تم التواصل وتأكيد الاستمرار" /></label>
            </div>
            <div><Submit>اعتماد</Submit></div>
          </ActionForm>
        </div>
      )}
      {e.kind === "financial" && e.sentAt && !e.transfer && !e.stoppedAt && can(u, "transfer") && (
        <div className="card"><div className="card-title"><h2>تسجيل التحويل</h2></div>
          <ActionForm action={recordTransfer}>
            <input type="hidden" name="ids" value={e.id} /><input type="hidden" name="bulk" value="0" />
            <div className="row">
              <label className="field"><span>المبلغ المحوّل *</span><input type="number" name="amount" defaultValue={e.amountN} min={1} /></label>
              <label className="field"><span>طريقة التحويل *</span><select name="method" defaultValue={c.recvMethod}><option value="">اختار</option>{RECV_METHODS.map((x) => <option key={x}>{x}</option>)}</select></label>
              <label className="field"><span>تاريخ التحويل *</span><input type="date" name="date" defaultValue={today} /></label>
              <label className="field"><span>رقم المرجع *</span><input name="ref" dir="ltr" required /></label>
            </div>
            <p className="muted">تسجيل التحويل لا يعني أن المستفيد استلم. الاستلام يُسجل من المتابعة.</p>
            <div><Submit>حفظ التحويل</Submit></div>
          </ActionForm>
        </div>
      )}
      {(followOpen || late) && can(u, "follow") && (
        <div className="grid2">
          <div className="card"><div className="card-title"><h2>تسجيل نتيجة المتابعة</h2><span className="muted">المحاولات بدون رد: {e.unanswered}/3</span></div>
            <ActionForm action={followCall}>
              <input type="hidden" name="entId" value={e.id} />
              <label className="field"><span>ملاحظة (اختياري)</span><input name="note" /></label>
              <div className="inline">
                {!late && e.unanswered < 3 && <Submit className="btn secondary" name="a" value="no_answer">لم يرد</Submit>}
                <Submit className="btn primary" name="a" value="paid">{late ? "رد متأخر · تم الصرف" : "رد · تم الصرف"}</Submit>
              </div>
            </ActionForm>
          </div>
          {!late && (
            <div className="card"><div className="card-title"><h2>رد · لم يتم الصرف</h2></div>
              <ActionForm action={followNotPaid}>
                <input type="hidden" name="entId" value={e.id} />
                <label className="field"><span>السبب *</span><select name="reason" required defaultValue=""><option value="">اختار</option>{NOTPAID_REASONS.map((x) => <option key={x}>{x}</option>)}</select></label>
                <label className="field"><span>الإجراء المطلوب *</span><input name="action" required placeholder="مثال: تصحيح رقم المحفظة وإعادة التحويل" /></label>
                <label className="field"><span>مسند إلى</span><select name="assignee" defaultValue={st.assign.action}><option value="">غير مسندة</option>{names.active.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
                <label className="field"><span>تفاصيل</span><textarea name="note" /></label>
                <div><Submit className="btn danger">حفظ (تُنشأ مهمة معالجة)</Submit></div>
              </ActionForm>
            </div>
          )}
        </div>
      )}
      {e.transferred > e.refundTotal && !e.stoppedAt && can(u, "refund") && (
        <details className="box" style={{ marginTop: 14 }}><summary>تسجيل استرداد (المتبقي القابل للاسترداد {money(e.transferred - e.refundTotal)} ج)</summary>
          <ActionForm action={recordRefund} className="stack" >
            <input type="hidden" name="entId" value={e.id} />
            <div className="row" style={{ marginTop: 10 }}>
              <label className="field"><span>المبلغ المسترد *</span><input type="number" name="amount" defaultValue={e.transferred - e.refundTotal} /></label>
              <label className="field"><span>تاريخ الاسترداد *</span><input type="date" name="date" defaultValue={today} /></label>
              <label className="field"><span>السبب *</span><select name="reason" defaultValue=""><option value="">اختار</option>{REFUND_REASONS.map((x) => <option key={x}>{x}</option>)}</select></label>
              <label className="field"><span>حالة التسوية</span><select name="settlement" defaultValue="pending"><option value="pending">معلقة</option><option value="settled">تمت التسوية</option></select></label>
              <label className="field"><span>معالجة الاستحقاق غير المستلم</span><select name="how" defaultValue={st.policy}>{policyOpts}</select></label>
            </div>
            <label className="field"><span>ملاحظات</span><input name="note" /></label>
            <p className="muted">مرجع التحويل الأصلي يُربط تلقائياً. المسترد لا يُحسب ضمن ما وصل للمستفيد، ويتحدد كلي أو جزئي تلقائياً.</p>
            <div><Submit>حفظ الاسترداد</Submit></div>
          </ActionForm>
        </details>
      )}
      {e.kind === "card" && e.sentAt && !["recv", "stop"].includes(e.stage) && can(u, "send") && (
        <details className="box" style={{ marginTop: 14 }}><summary>إعادة إرسال الكارت{e.resendCount ? ` (أُعيد ${e.resendCount} مرة)` : ""}</summary>
          <ActionForm action={resendCard} className="row">
            <input type="hidden" name="entId" value={e.id} />
            <label className="field"><span>السبب *</span><input name="reason" required placeholder="مثال: الكارت لم يُشحن" /></label>
            <div className="auto"><Submit className="btn secondary">إعادة الإرسال</Submit></div>
          </ActionForm>
        </details>
      )}
      {e.transfer && can(u, "approve") && (
        <details className="box" style={{ marginTop: 14 }}><summary>تصحيح بيانات التحويل (مشرف) — القيمة القديمة تُحفظ في سجل التدقيق</summary>
          <ActionForm action={correctTransfer}>
            <input type="hidden" name="entId" value={e.id} />
            <div className="row" style={{ marginTop: 10 }}>
              <label className="field"><span>المبلغ</span><input type="number" name="amount" defaultValue={Number(e.transfer.amount)} /></label>
              <label className="field"><span>الطريقة</span><select name="method" defaultValue={e.transfer.method}>{[...new Set([...RECV_METHODS, e.transfer.method])].map((x) => <option key={x}>{x}</option>)}</select></label>
              <label className="field"><span>التاريخ</span><input type="date" name="date" defaultValue={isoDate(e.transfer.date)} /></label>
              <label className="field"><span>المرجع</span><input name="ref" defaultValue={e.transfer.ref} dir="ltr" /></label>
            </div>
            <label className="field"><span>سبب التصحيح *</span><input name="reason" required /></label>
            <div><Submit className="btn secondary">حفظ التصحيح</Submit></div>
          </ActionForm>
        </details>
      )}
      {!["recv", "deliv", "stop"].includes(e.stage) && can(u, "follow") && (
        <details className="box" style={{ marginTop: 14 }}><summary>{e.stuckReason ? "إلغاء التعثر" : "تسجيل تعثر"}</summary>
          <ActionForm action={setStuck}>
            <input type="hidden" name="entId" value={e.id} />
            {e.stuckReason ? <><input type="hidden" name="clear" value="1" /><p className="muted">السبب الحالي: {e.stuckReason}</p><div><Submit className="btn secondary">إلغاء التعثر</Submit></div></>
              : <><label className="field"><span>السبب *</span><input name="reason" required /></label><div><Submit className="btn danger">تسجيل</Submit></div></>}
          </ActionForm>
        </details>
      )}

      <div className="grid2" style={{ marginTop: 14 }}>
        <div className="card"><div className="card-title"><h2>سجل الإجراءات</h2></div>
          <ul className="timeline">{timeline.map(([d, t, by], i) => <li key={i}><span className="t">{fmtTs(d)}</span>{t} · {names.name(by)}</li>)}</ul>
        </div>
        <div className="card"><div className="card-title"><h2>محاولات الاتصال</h2></div>
          {attempts.length ? <ul className="timeline">{attempts.map((a) => <li key={a.id}><span className="t">{fmtTs(a.createdAt)}</span>{a.voided ? <del>{a.result}</del> : a.result} · {a.kind === "confirm" ? "تأكيد" : "متابعة"} · {names.name(a.userId)}{a.note && ` · ${a.note}`}{a.voided && " (أُرجعت للتصحيح)"}</li>)}</ul> : <p className="muted">لا توجد.</p>}
          {refunds.length > 0 && <><div className="card-title" style={{ marginTop: 14 }}><h2>الاستردادات</h2></div>
            <ul className="timeline">{refunds.map((r) => <li key={r.id}><span className="t">{fmtDate(r.date)}</span>{money(r.amount)} ج · {REFUND_TYPE_LABELS[r.type]} · {r.reason} · {SETTLEMENT_LABELS[r.settlement]} · {names.name(r.userId)}</li>)}</ul></>}
          {tasks.length > 0 && <><div className="card-title" style={{ marginTop: 14 }}><h2>المهام</h2></div>
            <ul className="timeline">{tasks.map((t) => <li key={t.id}><Link href={`/tasks/${t.id}`}>{t.title}</Link> · {names.name(t.assigneeId)} · {t.status === "done" ? `نفّذها ${names.name(t.completedById)}` : TASK_STATUS_LABELS[t.status]}</li>)}</ul></>}
        </div>
      </div>
    <div style={{ marginTop: 14 }}><Attachments items={files} names={names} caseCode={e.caseCode} entitlementId={e.id} canAdd={can(u, "case")} /></div>
    </>
  );
}
