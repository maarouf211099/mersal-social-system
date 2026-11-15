# تنفيذ نفس التصميم على Power Platform

التصميم مستقل عن المنصة. لو قررت الإدارة النقل إلى Microsoft 365، هذا هو التحويل المباشر.

## Dataverse (يُفضَّل على Microsoft Lists)

Lists تصلح لعدد صغير من الحالات، لكن العلاقات المتعددة (حالة ← قرار ← بند ← استحقاق ← استرداد) والصلاحيات على مستوى السجل وسجل التدقيق المدمج تجعل Dataverse الخيار الأصح.

| الجدول في هذا النظام | جدول Dataverse | ملاحظات |
|---|---|---|
| cases | `ms_case` | المفتاح البديل: كود الحالة (Alternate Key يمنع التكرار) |
| changes | Dataverse Auditing | تفعيل التدقيق على `ms_case` يحفظ القديم والجديد تلقائياً |
| decisions / lines | `ms_decision` / `ms_decisionline` | Lookup للحالة وللقرار |
| ents | `ms_entitlement` | مفتاح بديل مركب (line + month) يمنع التكرار · المرحلة Choice تُحدَّث بـ Power Automate |
| attempts | `ms_contactattempt` | جدول منفصل بدل مصفوفة |
| batches | `ms_paymentbatch` | |
| refunds | `ms_refund` | Lookup للاستحقاق |
| ops | `ms_operation` | Created By / Created On تلقائية |
| tasks | Dataverse Tasks أو `ms_task` | Owner = مسندة إلى |
| staff / roles | Security Roles + Teams | صلاحيات حقيقية على مستوى الخادم |
| config | Environment Variables + `ms_service` | |

## Power Automate

| التدفق | التشغيل |
|---|---|
| توليد الاستحقاقات | مجدول يوم 1 من كل شهر، أو زر |
| إنشاء مهمة تأكيد / متابعة / معالجة | عند إنشاء أو تعديل الاستحقاق |
| تنبيه التجديد | مجدول أسبوعياً: القرارات التي `endMonth - 2 ≤ الشهر الحالي` |
| إغلاق القرارات المنتهية | مجدول شهرياً |
| تقرير شهري بالبريد | مجدول أول كل شهر (تصدير Power BI) |

## Power BI — أمثلة مقاييس DAX

```DAX
المحوّل = SUM(ms_entitlement[transfer_amount])
المسترد = SUM(ms_refund[amount])
صافي المصروف = [المحوّل] - [المسترد]
حالات لم تستلم =
  CALCULATE(DISTINCTCOUNT(ms_entitlement[case]),
    ms_entitlement[stage] IN {"لم يتم الرد","لم يتم الصرف","مسترد","متعثر"})
نسبة الإنجاز =
  DIVIDE(CALCULATE(COUNTROWS(ms_task), ms_task[status] = "مكتملة"), COUNTROWS(ms_task))
متوسط زمن التنفيذ (ساعات) =
  AVERAGEX(FILTER(ms_task, NOT ISBLANK(ms_task[completedon])),
    DATEDIFF(ms_task[createdon], ms_task[completedon], HOUR))
```

## Power Apps

نفس الشاشات الحالية: لوحة، مهامي، الحالات + ملف الحالة، القرارات، دورة الصرف، المتابعة، الاستردادات، التجديد، توزيع المهام، العمليات. يمكن تصدير بيانات النظام الحالي (JSON / CSV من «الإعدادات») واستيرادها في Dataverse.
