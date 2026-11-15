import type { Attachment } from "@prisma/client";
import { uploadAttachment } from "@/actions/files";
import { ACCEPT } from "@/lib/files";
import { fmtTs } from "@/lib/format";
import { ActionForm, Submit } from "./forms";
import { Icon } from "./icons";

export function Attachments({ items, names, caseCode, entitlementId, canAdd }: {
  items: Attachment[]; names: { name: (id?: string | null) => string }; caseCode?: string; entitlementId?: string; canAdd: boolean;
}) {
  return (
    <div className="card">
      <div className="card-title"><h2>المرفقات والمستندات</h2><span className="muted">{items.length}</span></div>
      {items.length ? (
        <ul className="timeline">
          {items.map((a) => (
            <li key={a.id}><span className="t">{fmtTs(a.createdAt)} · {names.name(a.userId)}</span>
              <a className="strong" href={`/api/files/${a.id}`} target="_blank" rel="noopener noreferrer"><Icon.file style={{ width: 14, height: 14, verticalAlign: -2 }} /> {a.name}</a>
              <span className="muted"> · {Math.ceil(a.size / 1024)} ك.ب{a.note ? ` · ${a.note}` : ""}</span>
            </li>
          ))}
        </ul>
      ) : <p className="muted">لا توجد مرفقات.</p>}
      {canAdd && (
        <ActionForm action={uploadAttachment} className="row" resetOnOk>
          {caseCode && <input type="hidden" name="caseCode" value={caseCode} />}
          {entitlementId && <input type="hidden" name="entitlementId" value={entitlementId} />}
          <label className="field"><span>ملف (PDF، صورة، Word، Excel — حتى 10 ميجا)</span><input type="file" name="file" accept={ACCEPT} required /></label>
          <label className="field"><span>وصف</span><input name="note" placeholder="مثال: إيصال استلام" /></label>
          <div className="auto"><Submit className="btn secondary">رفع</Submit></div>
        </ActionForm>
      )}
    </div>
  );
}
