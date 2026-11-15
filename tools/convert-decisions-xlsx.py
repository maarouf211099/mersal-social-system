"""
تحويل شيت القرارات السنوي (master) لملف رفع منظّف + تقرير مراجعة.

  python3 tools/convert-decisions-xlsx.py <الملف.xlsx> <فولدر-المخرجات>

المخرجات:
  decisions-import.json  — يترفع من النظام: «استيراد البيانات» ← «سجل القرارات (Excel منظّف)»
  review-report.xlsx     — كل مشكلة برقم الصف في الإكسيل الأصلي وإزاي اتعاملت معاها

⚠️ الملفات دي فيها بيانات مستفيدين — ماتترفعش على GitHub.
"""
import collections
import datetime as dt
import difflib
import hashlib
import json
import re
import sys

import openpyxl

SRC, OUT = sys.argv[1], sys.argv[2]
TODAY = dt.date.today()

# ───────── قواعد التوحيد ─────────
SERVICES = {
    "كارت سند": ("كارت سند", "card", "monthly", True),
    "بدل حفاضات": ("بدل حفاضات", "financial", "monthly", True),
    "شهري": ("كفالة شهرية", "financial", "monthly", True),
    "فوط صحيه": ("فوط صحية", "in_kind", "monthly", False),
    "شهري فلسطيني": ("كفالة شهرية (فلسطيني)", "financial", "monthly", True),
    "كفاله ايجاريه": ("كفالة إيجارية", "financial", "monthly", True),
    "بدل انتقالات": ("بدل انتقالات", "financial", "monthly", True),
    "كارت فلسطيني": ("كارت (فلسطيني)", "card", "monthly", True),
    "عيني تبرع": ("تبرعات عينية", "in_kind", "once", False),
    "كفاله دراسيه": ("كفالة دراسية", "financial", "monthly", True),
    "مره واحده": ("مساعدة مالية مرة واحدة", "financial", "once", True),
    "بدل حفاضات فلسطيني": ("بدل حفاضات (فلسطيني)", "financial", "monthly", True),
    "دار رعايه": ("سكن / دار رعاية", "service", "coverage", False),
    "كفالة دعم فلسطيني": ("كفالة دعم (فلسطيني)", "financial", "monthly", True),
}
# موقف الخدمة → (حالة القرار، سبب، تحتاج لتبرع)
STATUS = {
    "مستمره": ("active", "", False),
    "مستمره فوط": ("active", "", False),
    "مستمره+تحتاج لتبرع": ("active", "", True),
    "تحتاج الي تبرع": ("active", "", True),
    "تمت": ("ended", "تمت", False),
    "متوقفه": ("stopped", "متوقفة", False),
    "غلق": ("stopped", "غلق", False),
    "استبعاد": ("withdrawn", "استبعاد", False),
}
GOVS = ["القاهرة", "الجيزة", "القليوبية", "الإسكندرية", "الشرقية", "الدقهلية", "الغربية", "المنوفية", "البحيرة", "كفر الشيخ", "دمياط", "بورسعيد",
        "الإسماعيلية", "السويس", "الفيوم", "بني سويف", "المنيا", "أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان", "البحر الأحمر", "مطروح",
        "الوادي الجديد", "شمال سيناء", "جنوب سيناء"]
GOV_ALIASES = {"حلوان": ("القاهرة", "حلوان"), "الزقازيق": ("الشرقية", "الزقازيق")}
NAT = {"مصرى": "مصري", "مصري": "مصري", "سوداني": "سوداني", "سودانى": "سوداني", "سواني": "سوداني", "فلسطيني": "فلسطيني", "فلسطينى": "فلسطيني",
       "اريتري": "إريتري", "إريتريا": "إريتري", "إريترى": "إريتري", "ااريتريا": "إريتري", "يمني": "يمني", "سوري": "سوري", "سورى": "سوري",
       "اثيوبي": "إثيوبي", "صومالي": "صومالي", "عراقي": "عراقي", "تشادي": "تشادي", "جنوب افريقي": "جنوب أفريقي", "نيجيري": "نيجيري",
       "افريقي وسطي": "أفريقي وسطى", "بوروندي": "بوروندي", "اردني": "أردني", "سورينامي": "سورينامي", "جيبوتي": "جيبوتي", "غيني": "غيني"}
RECV = {"البريد": "البريد", "بريد": "البريد", "sms": "SMS", "بريد مندوب": "بريد مندوب", "المعادي": "المعادي", "فيزا": "فيزا",
        "مندوب مالي": "مندوب مالي", "مندوب حفاضات": "مندوب حفاضات", "اسكندريه": "إسكندرية", "مندوب اسكندريه": "مندوب إسكندرية"}
RESID = {"مصري": "مصري", "بدون اقامه": "بدون إقامة", "بدون اقامة": "بدون إقامة", "لها اقامه": "لها إقامة", "لها اقامة": "لها إقامة",
         "فيزا": "فيزا", "دار رعايه": "دار رعاية", "استثناء من الاقامة": "استثناء من الإقامة", "ليس اقامه": "بدون إقامة"}

issues = []  # (رقم الصف، الكود، النوع، التفاصيل، المعالجة)
def issue(row, code, kind, detail, action):
    issues.append((row, code, kind, detail, action))

def s(v):
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    t = str(v).replace("‏", "").replace("‬", "").replace("⁩", "").replace("‎", "").strip()
    return "" if t in ("#VALUE!", "#REF!", "#N/A", "#NUM!", "0") and not isinstance(v, int) else t

def ar_norm(t):
    t = re.sub(r"[\s.]+", "", t)
    t = re.sub("[إأآ]", "ا", t)
    t = re.sub("ى", "ي", t)
    t = re.sub("ه$", "ة", t)
    return t.replace("اا", "ا")

GOV_N = {ar_norm(g): g for g in GOVS}
GOV_N.update({ar_norm(g)[2:]: g for g in GOVS if g.startswith("ال")})
def gov(raw, row, code):
    t = s(raw)
    if not t:
        return "", ""
    if t in GOV_ALIASES:
        return GOV_ALIASES[t]
    n = ar_norm(t)
    n2 = n[2:] if n.startswith("ال") else n
    for cand in (n, n2):
        if cand in GOV_N:
            return GOV_N[cand], ""
    m = difflib.get_close_matches(n, list(GOV_N), n=1, cutoff=0.8)
    if m:
        return GOV_N[m[0]], ""
    issue(row, code, "محافظة غير معروفة", t[:80], "اتسابت فاضية")
    return "", ""

def phone(raw, row, code):
    t = re.sub(r"\D", "", s(raw))
    if not t:
        return ""
    if len(t) == 12 and t.startswith("20"):
        return "0" + t[2:]
    if len(t) == 13 and t.startswith("200"):
        return t[2:]
    if len(t) == 14 and t.startswith("0020"):
        return "0" + t[4:]
    if len(t) == 10 and t.startswith("1"):
        return "0" + t
    if len(t) == 11 and t.startswith("01"):
        return t
    issue(row, code, "رقم هاتف غير مكتمل", s(raw), "اتحفظ زي ما هو")
    return t

def ident(raw):
    t = s(raw).replace(" ", "")
    if not t:
        return "", ""
    if re.fullmatch(r"\d{3}-\d{2}[-cC]\d+", t):
        return "", t.upper()          # رقم مفوضية
    return t, ""                      # رقم قومي / باسبور / غيره

def as_date(v):
    if isinstance(v, dt.datetime):
        return v.date()
    t = s(v)
    m = re.fullmatch(r"(\d{1,2})[-/\\](\d{1,2})[-/\\](\d{4})", t)
    if m:
        d, mo, y = map(int, m.groups())
        if 1900 <= y <= TODAY.year + 1:
            try:
                return dt.date(y, mo, d)
            except ValueError:
                return None
    return None

def ymd(d):
    return d.isoformat() if d else ""

def month(d):
    return d.strftime("%Y-%m")

def span(a, b):
    return (int(b[:4]) * 12 + int(b[5:])) - (int(a[:4]) * 12 + int(a[5:])) + 1

# ───────── القراءة ─────────
wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
ws = wb.worksheets[0]
rows = []
for i, r in enumerate(ws.iter_rows(values_only=True), start=1):
    if i == 1:
        continue
    if r and r[0] not in (None, ""):
        rows.append((i, r))

by_code = collections.defaultdict(list)
for i, r in rows:
    code = re.sub(r"\s+", "", s(r[0]))
    if not re.fullmatch(r"\d+", code):
        issue(i, code, "كود غير صالح", s(r[0]), "الصف اتشال")
        continue
    by_code[code].append((i, r))

cases, decisions, used_services = [], [], {}
dec_seq = 0
skipped_rows = 0
for code, items in by_code.items():
    items.sort(key=lambda x: (x[1][17] or dt.datetime.min))
    names = collections.Counter(s(r[1]) for _, r in items if s(r[1]))
    latest = items[-1][1]
    # بيانات الحالة: آخر قيمة مش فاضية
    def last(idx, fn=s):
        for _, r in reversed(items):
            v = fn(r[idx])
            if v:
                return v
        return ""
    row0 = items[-1][0]
    recv_name = last(22)
    if len(names) == 1:
        case_name = next(iter(names))
    else:
        case_name = recv_name or s(latest[1])
        issue(row0, code, "أكثر من مستفيد على نفس الكود", " · ".join(names), f"الملف باسم «{case_name}» وكل خدمة باسم مستفيدها")
    gv, area_from_gov = "", ""
    for i, r in reversed(items):
        if s(r[10]):
            gv, area_from_gov = gov(r[10], i, code)
            if gv:
                break
    nat_raw = last(7)
    nat = NAT.get(nat_raw, "")
    if nat_raw and not nat:
        issue(row0, code, "جنسية غير معروفة", nat_raw, "اتسابت فاضية")
    rel = last(8)
    rel = rel if rel in ("مسلم", "غير مسلم", "مسيحي") else ""
    method_raw = last(21)
    method = RECV.get(method_raw.lower().replace("  ", " ").strip(), RECV.get(method_raw.strip(), ""))
    if method_raw and not method:
        issue(row0, code, "طريقة استلام غير معروفة", method_raw, "اتسابت فاضية")
    nid, unhcr = "", ""
    for _, r in reversed(items):
        a, b = ident(r[23])
        nid, unhcr = nid or a, unhcr or b
    ph = ""
    for i, r in reversed(items):
        if s(r[24]):
            ph = phone(r[24], i, code)
            break
    age = 0
    for _, r in reversed(items):
        if isinstance(r[2], int) and 0 < r[2] < 120:
            age = r[2]
            break
    birth = ""
    for _, r in reversed(items):
        d = as_date(r[3])
        if d and d.year > 1900:
            birth = ymd(d)
            break
    res_raw = last(26)
    res = RESID.get(res_raw, "فوق 60 عام" if "60" in res_raw else "")
    desc = last(6)
    served = any(STATUS.get(s(r[30]), ("",))[0] in ("active", "ended", "stopped") for _, r in items)
    cases.append({
        "code": code, "name": case_name, "age": age or None, "birthDate": birth, "nationality": nat, "religion": rel,
        "governorate": gv, "address": last(11), "area": last(12) or area_from_gov, "description": desc,
        "phone": ph, "unhcr": unhcr, "recvMethod": method, "recvName": recv_name, "recvPhone": ph if method == "SMS" else "",
        "recvIdNo": nid or unhcr, "idExpiry": ymd(as_date(latest[25])) or s(latest[25]), "residencyStatus": res,
        "residencyExpiry": ymd(as_date(latest[27])) or s(latest[27]), "dataConfirmed": served,
    })

    # القرارات: الصفوف اللي ليها نفس النص وتاريخ البداية والموقف = قرار واحد بأكثر من خدمة
    groups = collections.OrderedDict()
    for i, r in items:
        st_raw = s(r[30])
        svc_raw = s(r[28])
        if svc_raw not in SERVICES:
            issue(i, code, "نوع خدمة فاضي/غير معروف", svc_raw or "فاضي", "الصف اتشال")
            skipped_rows += 1
            continue
        if st_raw not in STATUS:
            issue(i, code, "موقف غير معروف", st_raw or "فاضي", "الصف اتشال")
            skipped_rows += 1
            continue
        if not isinstance(r[17], dt.datetime) or not isinstance(r[18], dt.datetime):
            issue(i, code, "تاريخ بداية/نهاية ناقص", f"{s(r[17])} / {s(r[18])}", "الصف اتشال")
            skipped_rows += 1
            continue
        key = (s(r[15]), month(r[17]), st_raw, s(r[14]))
        groups.setdefault(key, []).append((i, r))
    for (text, _start, st_raw, issue_raw), grp in groups.items():
        status, reason, needs_donation = STATUS[st_raw]
        r0 = grp[0][1]
        start = month(r0[17])
        iss = as_date(r0[14])
        text_out = text
        if not iss:
            if issue_raw:
                text_out = (text + f"\n(مرجع السحب: {issue_raw})").strip()
            iss = r0[17].date()
        dec_seq += 1
        lines = []
        for i, r in grp:
            svc_name, kind, cycle, follow = SERVICES[s(r[28])]
            used_services[svc_name] = (kind, cycle, follow)
            st, en = month(r[17]), month(r[18])
            if en < st:
                issue(i, code, "النهاية قبل البداية", f"{st} → {en}", "النهاية = البداية")
                en = st
            n = span(st, en)
            written = r[16] if isinstance(r[16], int) and r[16] > 0 else 0
            note_bits = []
            if written and written != n:
                note_bits.append(f"المدة المكتوبة {written} شهر والمحسوبة من التواريخ {n}")
            amt = r[29] if isinstance(r[29], (int, float)) else None
            if amt is None:
                amt = 0
                if kind in ("financial", "card") and status == "active":
                    issue(i, code, "قيمة ناقصة لخدمة مستمرة", svc_name, "القيمة = 0 — لازم تتعدل قبل الصرف")
            beneficiary = s(r[1])
            extra = []
            if s(r[34]):
                extra.append(f"تفصيل العيني: {s(r[34])}")
            if s(r[37]):
                extra.append(s(r[37]))
            c36 = s(r[38])
            if c36:
                # كلمة واحدة قصيرة = اسم الموظفة المسؤولة، غير كده ملاحظة
                extra.append(f"المسؤول: {c36}" if re.fullmatch(r"[\u0600-\u06FF]{2,6}", c36) else c36)
            cat = s(r[4])
            cat = "مرضية" if cat in ("مرضيه", "مرضية") else "عادية" if cat in ("عاديه", "عادية") else ""
            lines.append({
                "service": svc_name, "beneficiary": "" if beneficiary == case_name else beneficiary, "amount": amt,
                "months": written or n, "start": st, "end": en, "mismatchNote": " · ".join(note_bits), "category": cat,
                "note": " · ".join(extra), "row": i,
            })
        decisions.append({
            # مفتاح ثابت من محتوى القرار: إعادة الرفع ما بتكررش القرارات
            "key": "xlsx:" + hashlib.md5("|".join([code, start, text, st_raw, issue_raw] + sorted(l["service"] + "/" + l["beneficiary"] + "/" + l["end"] for l in lines)).encode()).hexdigest()[:20],
            "no": f"ق-{dec_seq:05d}", "code": code, "issueDate": ymd(iss), "text": text_out, "donor": s(r0[13]),
            "status": status, "stopReason": reason, "needsDonation": needs_donation, "sourceStatus": st_raw, "lines": lines,
        })

# تعارض: خدمات مستمرة لنفس الكود ونفس الخدمة ونفس المستفيد ومتداخلة
act = collections.defaultdict(list)
for d in decisions:
    if d["status"] != "active":
        continue
    for l in d["lines"]:
        act[(d["code"], l["service"], l["beneficiary"])].append((l["start"], l["end"], d["no"], l["row"]))
for (code, svc, ben), v in act.items():
    v.sort()
    for a, b in zip(v, v[1:]):
        if b[0] <= a[1]:
            issue(b[3], code, "قرارين مستمرين متداخلين", f"{svc}{' · ' + ben if ben else ''}: {a[2]} ({a[0]}←{a[1]}) و {b[2]} ({b[0]}←{b[1]})", "اترفعوا الاتنين — راجع وأوقف القديم")

services_out = [{"name": k, "kind": v[0], "cycle": v[1], "needsFollow": v[2]} for k, v in used_services.items()]
out = {"format": "mersal-social-decisions/1", "generatedAt": dt.datetime.now().isoformat(timespec="seconds"),
       "services": services_out, "cases": cases, "decisions": decisions}
with open(f"{OUT}/decisions-import.json", "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

# ───────── تقرير المراجعة ─────────
st_count = collections.Counter(d["status"] for d in decisions)
ln_count = collections.Counter(d["sourceStatus"] for d in decisions for _ in d["lines"])
svc_count = collections.Counter(l["service"] for d in decisions for l in d["lines"])
rep = openpyxl.Workbook()
w = rep.active
w.title = "ملخص"
w.sheet_view.rightToLeft = True
summary = [
    ("صفوف بيانات في الشيت", len(rows)), ("أكواد (حالات)", len(cases)), ("قرارات", len(decisions)),
    ("خدمات داخل القرارات", sum(len(d["lines"]) for d in decisions)), ("صفوف اتشالت", skipped_rows),
    ("حالات بياناتها مؤكدة (اتخدمت قبل كده)", sum(1 for c in cases if c["dataConfirmed"])),
    ("قرارات مستمرة", st_count["active"]), ("منها «تحتاج لتبرع»", sum(1 for d in decisions if d["needsDonation"])),
    ("قرارات منتهية (تمت)", st_count["ended"]), ("قرارات موقوفة (متوقفة/غلق)", st_count["stopped"]), ("قرارات مسحوبة (استبعاد)", st_count["withdrawn"]),
    ("", ""), ("الخدمة", "عدد"),
] + sorted(svc_count.items(), key=lambda x: -x[1]) + [("", ""), ("الموقف في الشيت", "عدد الخدمات")] + sorted(ln_count.items(), key=lambda x: -x[1]) \
  + [("", ""), ("نوع المشكلة", "عدد")] + collections.Counter(x[2] for x in issues).most_common()
for row in summary:
    w.append(list(row))
w.column_dimensions["A"].width = 44
w2 = rep.create_sheet("المشاكل")
w2.sheet_view.rightToLeft = True
w2.append(["رقم الصف في الإكسيل", "الكود", "نوع المشكلة", "التفاصيل", "اتعاملت معاها إزاي"])
for x in sorted(issues, key=lambda x: (x[2], x[0])):
    w2.append(list(x))
for col, wd in zip("ABCDE", (14, 10, 30, 70, 45)):
    w2.column_dimensions[col].width = wd
w2.auto_filter.ref = f"A1:E{len(issues) + 1}"
rep.save(f"{OUT}/review-report.xlsx")
print(json.dumps({"rows": len(rows), "cases": len(cases), "decisions": len(decisions),
                  "lines": sum(len(d["lines"]) for d in decisions), "skipped": skipped_rows,
                  "issues": dict(collections.Counter(x[2] for x in issues)), "services": dict(svc_count), "status": dict(st_count)}, ensure_ascii=False, indent=1))
