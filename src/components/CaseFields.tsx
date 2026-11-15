import type { Case } from "@prisma/client";
import { GOVS, NATS, RECV_METHODS, RELIGIONS, RESIDENCY } from "@/lib/constants";
import { isoDate } from "@/lib/format";

const Sel = ({ name, label, list, v }: { name: string; label: string; list: string[]; v?: string }) => (
  <label className="field"><span>{label}</span>
    <select name={name} defaultValue={v ?? ""}><option value="">—</option>{list.map((x) => <option key={x}>{x}</option>)}</select>
  </label>
);
const Inp = ({ name, label, v, type = "text", ltr }: { name: string; label: string; v?: string | number | null; type?: string; ltr?: boolean }) => (
  <label className="field"><span>{label}</span><input type={type} name={name} defaultValue={v ?? ""} dir={ltr ? "ltr" : undefined} /></label>
);

/** حقول بيانات الحالة — part: basic | receive | all */
export function CaseFields({ c, part = "all", withCode }: { c?: Partial<Case>; part?: "basic" | "receive" | "all"; withCode?: boolean }) {
  return (
    <>
      {(part === "basic" || part === "all") && (
        <>
          <h3 className="section-title" style={{ marginTop: 4 }}><span>البيانات الأساسية</span></h3>
          <div className="fgrid">
            {withCode && <label className="field"><span>كود الحالة *</span><input name="code" required inputMode="numeric" dir="ltr" /></label>}
            <label className="field"><span>اسم الحالة *</span><input name="name" required defaultValue={c?.name ?? ""} /></label>
            <Inp name="birthDate" label="تاريخ الميلاد" type="date" v={isoDate(c?.birthDate ?? null)} />
            <Sel name="gender" label="النوع" list={["ذكر", "أنثى"]} v={c?.gender} />
            <Sel name="nationality" label="الجنسية" list={[...new Set([...NATS, c?.nationality ?? ""].filter(Boolean))]} v={c?.nationality} />
            <Inp name="age" label="السن (لو تاريخ الميلاد مش معروف)" type="number" v={c?.age} />
            <Sel name="religion" label="الديانة" list={RELIGIONS} v={c?.religion} />
            <Inp name="familySize" label="عدد الأفراد" type="number" v={c?.familySize} />
            <Sel name="governorate" label="المحافظة" list={GOVS} v={c?.governorate} />
            <Inp name="area" label="المنطقة" v={c?.area} />
            <Inp name="address" label="العنوان" v={c?.address} />
            <Inp name="unhcr" label="رقم المفوضية" v={c?.unhcr} ltr />
            <Sel name="residencyStatus" label="موقف الإقامة" list={[...new Set([...RESIDENCY, c?.residencyStatus ?? ""].filter(Boolean))]} v={c?.residencyStatus} />
            <Inp name="residencyExpiry" label="انتهاء الإقامة" v={c?.residencyExpiry} ltr />
          </div>
          <label className="field" style={{ marginTop: 12 }}><span>وصف الحالة</span><textarea name="description" defaultValue={c?.description ?? ""} /></label>
        </>
      )}
      {(part === "receive" || part === "all") && (
        <>
          <h3 className="section-title"><span>التواصل والاستلام</span></h3>
          <div className="fgrid">
            <Inp name="phone" label="هاتف" v={c?.phone} type="tel" ltr />
            <Inp name="phone2" label="هاتف بديل" v={c?.phone2} type="tel" ltr />
            <Sel name="recvMethod" label="طريقة الاستلام" list={[...new Set([...RECV_METHODS, c?.recvMethod ?? ""].filter(Boolean))]} v={c?.recvMethod} />
            <Inp name="recvName" label="اسم المستلم" v={c?.recvName} />
            <Inp name="recvPhone" label="رقم الاستلام / المحفظة" v={c?.recvPhone} ltr />
            <Inp name="recvIdNo" label="الرقم القومي / إثبات الشخصية" v={c?.recvIdNo} ltr />
            <Inp name="idExpiry" label="انتهاء الرقم القومي" v={c?.idExpiry} ltr />
            <Inp name="recvBranch" label="الفرع / مكتب البريد" v={c?.recvBranch} />
          </div>
        </>
      )}
      {part === "all" && <label className="field" style={{ marginTop: 12 }}><span>ملاحظات</span><textarea name="notes" defaultValue={c?.notes ?? ""} /></label>}
    </>
  );
}
