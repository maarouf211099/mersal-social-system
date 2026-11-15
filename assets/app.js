/* نظام تشغيل الإدارة الاجتماعية — v2
   Compatible with v1 collections (cases, decisions, lines, ents, ops, audit).
   New collections: changes, refunds, tasks, batches, staff, config. */
(function(){
'use strict';

/* =====================================================================
   1) Reference data (defaults; editable from «الإعدادات»)
   ===================================================================== */
const DEFAULT_SERVICES=[
  {name:'كفالة شهرية',kind:'مالي',cycle:'شهري',follow:true},
  {name:'بدل حفاضات',kind:'مالي',cycle:'شهري',follow:true},
  {name:'كارت كازيون (الكارت الغذائي)',kind:'كارت',cycle:'شهري',follow:true},
  {name:'مساعدة عينية',kind:'عيني',cycle:'مرة واحدة',follow:false},
  {name:'أثاث',kind:'عيني',cycle:'مرة واحدة',follow:true},
  {name:'أجهزة كهربائية',kind:'عيني',cycle:'مرة واحدة',follow:true},
  {name:'مساعدات غذائية',kind:'عيني',cycle:'مرة واحدة',follow:false},
  {name:'تبرعات عينية',kind:'عيني',cycle:'مرة واحدة',follow:false},
  {name:'معرض الملابس',kind:'عيني',cycle:'مرة واحدة',follow:false},
  {name:'مساعدة موسمية',kind:'عيني',cycle:'مرة واحدة',follow:false},
  {name:'حفاضات (عيني)',kind:'عيني',cycle:'شهري',follow:false},
  {name:'فوط صحية',kind:'عيني',cycle:'شهري',follow:false},
  {name:'سكن / دار رعاية',kind:'خدمة',cycle:'تغطية طوال المدة',follow:false},
  {name:'التكفل بالعلاج الدوائي والفحوصات',kind:'خدمة',cycle:'تغطية طوال المدة',follow:false},
  {name:'متابعة / إعادة بحث / مناقشة',kind:'خدمة',cycle:'مرة واحدة',follow:false}
];
const KINDS=['مالي','كارت','عيني','خدمة'];
const CYCLES=['شهري','مرة واحدة','تغطية طوال المدة'];
const DEFAULT_CONFIG={renewLead:2,confirmDays:3,followDays:3,actionDays:5,taskDays:3,policy:'carry',assign:{},services:null};
const POLICIES={carry:'ترحيل المبلغ غير المستلم على الشهر التالي',extend:'تمديد مدة البند شهراً بدل الشهر غير المستلم',drop:'لا تعويض (يسقط الشهر)'};
const TEAMS=['ملف الحفاضات','ملف العيني','ملف المالي','ملف التواصل','عام'];
const ROLES=['مدير','مشرف','مالي','موظف','قراءة'];
const PERMS={
  'مدير':['*'],
  'مشرف':['case','decision','decision.stop','decision.override','generate','confirm','send','transfer','follow','refund','approve','assign','return','renewal','op','task','close'],
  'مالي':['case','generate','confirm','send','transfer','follow','refund','op','task','renewal'],
  'موظف':['case','decision','generate','confirm','send','follow','op','task','renewal'],
  'قراءة':[]
};
/* operation catalogue from v1 (name, team, weight, scope) + automatic workflow operations */
const TASKS=[
 ['سحب القرارات الإدارية وتسكينها','ملف الحفاضات',1,'حالة'],['التنسيق مع فريق التواصل لتوزيع مهام إبلاغ الحالات بالقرارات','ملف الحفاضات',2,'عامة'],['متابعة دورية لشيت القرارات','ملف الحفاضات',1,'حالة'],['استلام حالات تحتاج الي خدمة حفاضات من المتابعة','ملف الحفاضات',1,'حالة'],['تسجيل الحالات المنتهي قراراتها في شيت اعادة بحث او مناقشة','ملف الحفاضات',1,'حالة'],
 ['تنسيق مع إدارة PR','ملف العيني',2,'عامة'],['استلام تحويلات اودو','ملف العيني',1,'عامة'],['متابعة طلبات صرف','ملف العيني',2,'عامة'],['متابعة طلبات شراء','ملف العيني',2,'عامة'],['تجهيز حالات شراء','ملف العيني',1,'حالة'],['عمل طلب شراء','ملف العيني',1,'حالة'],['تجهيز طلب تشغيل','ملف العيني',1,'حالة'],['عمل طلب صرف','ملف العيني',1,'حالة'],['تنسيق مع ادارة الحركة عينية','ملف العيني',1,'عامة'],['تنسيق مع ادارة المشتريات','ملف العيني',1,'عامة'],['تسليم كروت كازيون','ملف العيني',0.2,'حالة'],['تسليم اثاث','ملف العيني',1,'حالة'],['تسليم مساعدات غذائية','ملف العيني',1,'حالة'],['مراجعة تسليمات كروت وتوثيقها بالشيت','ملف العيني',0.2,'حالة'],['مراجعة تسليمات اثاث وتوثيقها بالشيت','ملف العيني',1,'حالة'],['مراجعة تسليمات مساعدات غذائية وتوثيقها بالشيت','ملف العيني',0.2,'حالة'],['مراجعة استردادات كروت','ملف العيني',1,'حالة'],['تنسيق مع ادارة المخزن','ملف العيني',1,'عامة'],['تسليم مساعدة عينية','ملف العيني',1,'حالة'],['مراجعة تسليمات مساعدات عينية وتوثيقها بالشيت','ملف العيني',0.2,'حالة'],['متابعة جروب التبرعات','ملف العيني',1,'عامة'],['طباعة ايصالات اودو','ملف العيني',2,'عامة'],['اضافة اسعار منتجات عينية بالشيت','ملف العيني',1,'عامة'],['استلام تبرع عيني من الحركة وادراجه للادارة','ملف العيني',1,'عامة'],['استلام طلب شراء من الحركة وادراجه للادارة','ملف العيني',1,'عامة'],['مراجعة دورية لشيت الكروت الغذائية','ملف العيني',0.1,'عامة'],
 ['مراجعة حالات المالي','ملف المالي',0.2,'حالة'],['تسليم مساعدات مالية','ملف المالي',0.2,'حالة'],['تنفيذ قرار مالي طارئ','ملف المالي',2,'حالة'],['التنسيق مع ادارة الحسابات','ملف المالي',2,'عامة'],['تجهيز ايصالات المندوب','ملف المالي',1,'عامة'],['تجهيز طلب تشغيل بحالات المندوب','ملف المالي',1,'عامة'],['مراجعة استردادات مالية','ملف المالي',2,'عامة'],['تنسيق مع ادارة الحركة مالية','ملف المالي',2,'عامة'],['عمل اذن صرف','ملف المالي',1,'عامة'],
 ['مراجعة قبل ارسال طلب التشغيل','عام',2,'عامة'],['مراجعة قبل انشاء طلب الشراء','عام',2,'عامة'],['تجهيز الشيت الشهري للمتابعات الشهرية','عام',2,'عامة'],
 ['مكالمات معرض الملابس','ملف التواصل',1,'حالة'],['ارسال الحالة للمناقشة او البحث لخدمة جديدة','ملف التواصل',1,'حالة'],['استلام والرد علي استفسارات السيكوانس','ملف التواصل',1,'حالة'],['مكالمة متابعة صرف','ملف التواصل',1,'حالة'],['مكالمة تاكيد بيانات','ملف التواصل',2,'حالة'],['مكالمة متابعة استرداد','ملف التواصل',2,'حالة'],['استقبال حالة استفسار + تسليم فوط صحية','ملف التواصل',2,'حالة'],['استقبال حالة استفسار','ملف التواصل',2,'حالة'],['استقبال حالة استلام فوط','ملف التواصل',2,'حالة'],['تعليقات سيستم','ملف التواصل',0.5,'حالة'],['اضافة وتجهيز تعليقات','ملف التواصل',5,'عامة'],['رد علي ايميل','ملف التواصل',1,'حالة'],['ارسال ايميل','ملف التواصل',1,'حالة'],['الرد على الشكاوى عبر نظام أودو','ملف التواصل',2,'حالة'],['رد علي ايميل + مكالمة','ملف التواصل',2,'حالة'],['تسجيل بفورم المتابعة','ملف التواصل',1,'عامة'],['تسجيل بفورم غلق','ملف التواصل',1,'حالة'],['استلام بيانات الحالات','ملف التواصل',0.5,'عامة'],['مكالمات متابعة خدمة اثاث','ملف التواصل',1,'حالة'],['ارسال رسائل نصية للحالات','ملف التواصل',0.2,'حالة'],['التواصل مع ادارة it','ملف التواصل',2,'عامة'],['التواصل مع ادارة اللجنة','ملف التواصل',2,'عامة'],['تقارير','ملف التواصل',2,'عامة'],['تسليمات معرض الملابس','ملف التواصل',1,'حالة'],['التواصل مع الجودة','ملف التواصل',2,'عامة'],['التواصل مع ادارة المتابعة','ملف التواصل',2,'عامة'],['التنسيق مع الفروع للتسليمات','ملف التواصل',2,'عامة'],['مكالمات استلام الكاش المعادي','ملف التواصل',1,'حالة'],
 /* automatic (recorded by the system when the action is done in the workflow) */
 ['إرسال ضمن دفعة الصرف','ملف المالي',0.2,'حالة'],['تسجيل تحويل مالي','ملف المالي',0.2,'حالة'],['تسجيل استرداد','ملف المالي',1,'حالة'],['تسجيل قرار','ملف الحفاضات',1,'حالة'],['تحديث بيانات حالة','عام',0.5,'حالة'],['معالجة عدم صرف','ملف المالي',1,'حالة'],['توليد استحقاقات الشهر','عام',1,'عامة'],['إغلاق قرار','عام',0.2,'حالة']
].map(t=>({name:t[0],team:t[1],weight:t[2],scope:t[3]}));
const TASK_BY_NAME={};TASKS.forEach(t=>TASK_BY_NAME[t.name]=t);
const NATS=['مصري','سوداني','سوري','يمني','إريتري','جنوب سوداني','صومالي','إثيوبي','أخرى'];
const GOVS=['القاهرة','الجيزة','القليوبية','الإسكندرية','الشرقية','الدقهلية','الغربية','المنوفية','البحيرة','كفر الشيخ','دمياط','بورسعيد','الإسماعيلية','السويس','الفيوم','بني سويف','المنيا','أسيوط','سوهاج','قنا','الأقصر','أسوان','البحر الأحمر','مطروح','الوادي الجديد','شمال سيناء','جنوب سيناء'];
const RECV_METHODS=['محفظة إلكترونية','حوالة بريدية','حساب بنكي','كاش من الفرع','مندوب','إنستاباي'];
const NOTPAID_REASONS=['رقم المحفظة خطأ','لم يصل التحويل','تم سحب المبلغ من شخص آخر','الحالة مسافرة / غير متاحة','مشكلة في الكارت','المستفيد لم يذهب للاستلام','سبب آخر'];
const REFUND_REASONS=['رقم محفظة خطأ','عدم الاستلام خلال المدة','تحويل مكرر','وفاة / سفر المستفيد','إيقاف القرار','سبب آخر'];
const MN=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const CASE_FIELDS=[
  ['name','اسم الحالة'],['birth','تاريخ الميلاد'],['gender','النوع'],['nationality','الجنسية'],['familySize','عدد الأفراد'],
  ['governorate','المحافظة'],['address','العنوان'],['phone','هاتف'],['phone2','هاتف بديل'],['unhcr','رقم المفوضية'],
  ['recvMethod','طريقة الاستلام'],['recvName','اسم المستلم'],['recvPhone','رقم الاستلام / المحفظة'],['recvId','الرقم القومي / إثبات الشخصية'],['recvBranch','الفرع / مكتب البريد'],['notes','ملاحظات']
];

/* =====================================================================
   2) Helpers
   ===================================================================== */
const $=(s,r)=>(r||document).querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const fmtMonth=m=>{if(!m)return'—';const p=m.split('-');return MN[+p[1]-1]+' '+p[0]};
const toIdx=m=>{const p=m.split('-').map(Number);return p[0]*12+p[1]-1};
const fromIdx=i=>Math.floor(i/12)+'-'+pad(i%12+1);
const addMonths=(m,n)=>fromIdx(toIdx(m)+n);
const spanMonths=(s,e)=>toIdx(e)-toIdx(s)+1;
const isoOf=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const todayISO=()=>isoOf(new Date());
const fmtDate=iso=>{if(!iso)return'—';const p=String(iso).slice(0,10).split('-');return(+p[2])+'/'+(+p[1])+'/'+p[0]};
const fmtTs=ts=>{if(!ts)return'—';const d=new Date(ts);return d.getDate()+'/'+(d.getMonth()+1)+'/'+d.getFullYear()+' '+pad(d.getHours())+':'+pad(d.getMinutes())};
const tsMonth=ts=>ts?isoOf(new Date(ts)).slice(0,7):'';
const money=n=>Math.round(Number(n||0)).toLocaleString('en-US');
const DAY=864e5;
const curMonth=todayISO().slice(0,7);
const isoToTs=iso=>iso?new Date(iso+'T12:00:00').getTime():0;
function suggestStart(iso){if(!iso)return'';const p=iso.split('-').map(Number);return addMonths(p[0]+'-'+pad(p[1]),p[2]<=18?1:2)}
function monthOpts(val,from,to){
  let o='',found=false;
  for(let i=toIdx(from||'2024-01');i<=toIdx(to||'2030-12');i++){const m=fromIdx(i);if(m===val)found=true;o+='<option value="'+m+'"'+(m===val?' selected':'')+'>'+fmtMonth(m)+'</option>'}
  if(val&&!found)o+='<option value="'+val+'" selected>'+fmtMonth(val)+'</option>';
  return o;
}
const opt=(list,val,blank)=>(blank!=null?'<option value="">'+esc(blank)+'</option>':'')+list.map(v=>{const k=Array.isArray(v)?v[0]:v,l=Array.isArray(v)?v[1]:v;return'<option value="'+esc(k)+'"'+(String(val)===String(k)?' selected':'')+'>'+esc(l)+'</option>'}).join('');
const newId=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const sum=(arr,f)=>arr.reduce((s,x)=>s+(+f(x)||0),0);
const uniq=a=>[...new Set(a)];
const numSort=(a,b)=>String(a).localeCompare(String(b),'en',{numeric:true});

/* =====================================================================
   3) State
   ===================================================================== */
const COLS=['cases','decisions','lines','ents','ops','audit','changes','refunds','tasks','batches','staff','config'];
const S={};COLS.forEach(c=>S[c]={});
const loaded={};
let D={};
let CFG=Object.assign({},DEFAULT_CONFIG);
let SERVICES=DEFAULT_SERVICES.slice();
const F={casesQ:'',casesGov:'',casesNat:'',decStatus:'',decQ:'',decSvc:'',entKind:'مالي',entQ:'',entStage:'',fuView:'open',fuQ:'',fuKind:'',
  opTeam:'',opStatus:'',opQ:'',opBy:'',opMonth:'',taskView:'mine',taskQ:'',renView:'soon',rptStaff:'',rptSvc:'',rptDec:'',rptGov:'',rptNat:'',rptView:'month',
  audQ:'',refQ:'',refStatus:''};
let tab='dash',month=curMonth,shellTab=null;
let conn={mode:'none'},db=null,user=null,downloads=null,me={id:'',name:''},canWrite=null,isOwner=false;
const SEL=new Set();const names={};const askedNames=new Set();

const TABS=[
  ['dash','لوحة المتابعة'],['mytasks','مهامي'],['cases','الحالات'],['decisions','القرارات'],['monthly','دورة الصرف'],['follow','المتابعة'],
  ['refunds','الاستردادات'],['renewal','التجديد والانتهاء'],['tasks','توزيع المهام'],['ops','العمليات'],['reports','التقارير'],['audit','سجل التدقيق'],['settings','الإعدادات']
];

/* =====================================================================
   4) Derived data and business rules
   ===================================================================== */
function svc(n){return SERVICES.find(s=>s.name===n)||{name:n,kind:'مالي',cycle:'شهري',follow:true}}
function derive(){
  const arr=o=>Object.values(o);
  const c=S.config.main||{};
  CFG=Object.assign({},DEFAULT_CONFIG,c,{assign:Object.assign({},c.assign||{})});
  SERVICES=(c.services&&c.services.length)?c.services:DEFAULT_SERVICES.slice();
  D.cases=arr(S.cases);D.decs=arr(S.decisions);D.lines=arr(S.lines);D.ents=arr(S.ents);D.ops=arr(S.ops);
  D.audit=arr(S.audit).sort((a,b)=>b.ts-a.ts);D.changes=arr(S.changes).sort((a,b)=>b.ts-a.ts);
  D.refunds=arr(S.refunds);D.tasks=arr(S.tasks);D.batches=arr(S.batches);D.staff=arr(S.staff);
  D.decByCode={};D.linesByDec={};D.entsByCode={};D.refByEnt={};D.linesByCode={};
  D.decs.forEach(d=>{(D.decByCode[d.code]=D.decByCode[d.code]||[]).push(d)});
  D.lines.forEach(l=>{(D.linesByDec[l.decId]=D.linesByDec[l.decId]||[]).push(l);(D.linesByCode[l.code]=D.linesByCode[l.code]||[]).push(l)});
  D.ents.forEach(e=>{(D.entsByCode[e.code]=D.entsByCode[e.code]||[]).push(e)});
  D.refunds.forEach(r=>{(D.refByEnt[r.entId]=D.refByEnt[r.entId]||[]).push(r)});
  D.vtasks=buildTasks();
}
function decKind(d){
  const sib=(D.decByCode[d.code]||[]).slice().sort((a,b)=>(a.issueDate||'').localeCompare(b.issueDate||'')||(a.createdAt||0)-(b.createdAt||0));
  return sib.length&&sib[0].id===d.id?'جديد':'مجدد';
}
function decEnd(d){return(D.linesByDec[d.id]||[]).reduce((m,l)=>l.endMonth>m?l.endMonth:m,'')}
function decStart(d){return(D.linesByDec[d.id]||[]).reduce((m,l)=>(!m||l.startMonth<m)?l.startMonth:m,'')}
/* effective decision status: a running decision whose last month has passed is shown as ended */
function decStatus(d){
  if(d.status==='مستمر'){const e=decEnd(d);if(e&&e<curMonth)return'منتهي';}
  return d.status||'مستمر';
}
function decActiveIn(d,m){return d.status==='مستمر'&&(D.linesByDec[d.id]||[]).some(l=>l.startMonth<=m&&m<=l.endMonth)}
function caseName(c){return S.cases[c]?S.cases[c].name:'(كود غير مسجل)'}
function overlap(code,service,start,end,ignoreDec){
  for(const d of(D.decByCode[code]||[])){
    if(d.status!=='مستمر'||d.id===ignoreDec)continue;
    for(const l of(D.linesByDec[d.id]||[]))if(l.service===service&&!(end<l.startMonth||start>l.endMonth))return{dec:d,line:l};
  }
  return null;
}

/* ---- entitlement lifecycle ---- */
const STG={
  due:['مستحق للصرف',''],hold:['معلّق على الشهر السابق','warn'],needconf:['يحتاج تأكيد بيانات','warn'],conf:['تم تأكيد البيانات','pri'],
  sent:['تم الإرسال','info'],trans:['تم التحويل','info'],wait:['في انتظار المتابعة','info'],noans:['لم يتم الرد','bad'],
  recv:['تم الرد وتم الصرف','good'],deliv:['تم التسليم','good'],notpaid:['لم يتم الصرف','bad'],stuck:['متعثر','bad'],refund:['مسترد','warn'],stop:['موقوف','']
};
const FINAL=['recv','deliv'];
function attemptsOf(e){return(e.attempts||[]).filter(a=>!a.voided)}
function unanswered(e){return attemptsOf(e).filter(a=>!a.answered).length}
function refundSum(e){return sum(D.refByEnt[e.id]||[],r=>r.amount)}
/* amount actually transferred (v1 «تم إرسال الكفالة» counted as transferred at the entitlement value) */
function trAmount(e){
  if(e.transfer)return +e.transfer.amount||0;
  if(e.sent&&svc(e.service).kind==='مالي'&&e.legacy!==false&&!e.v2)return +e.amount||0;
  return 0;
}
function isTransferred(e){return !!e.transfer||(e.sent&&svc(e.service).kind==='مالي'&&!e.v2)}
function netReceived(e){const s=stageOf(e);if(s==='recv'||s==='deliv')return Math.max(0,(trAmount(e)||+e.amount||0)-refundSum(e));return 0}
function needsFollow(e){const s=svc(e.service);return s.kind==='مالي'||s.kind==='كارت'?true:!!s.follow}
function prevEnt(e){return S.ents[e.lineId+'_'+addMonths(e.month,-1)]}
function resolved(e){const s=stageOf(e);return FINAL.includes(s)||s==='stop'||!!e.settled}
function holdOf(e){
  if(e.holdApproved||e.sent)return false;
  const p=prevEnt(e);if(!p)return false;
  if((e.carried||[]).includes(p.month))return false; /* v1 carry-over already included it */
  return !resolved(p);
}
function stageOf(e){
  const s=svc(e.service);
  if(e.stopped)return'stop';
  const tr=trAmount(e);
  if(tr>0&&refundSum(e)>=tr)return'refund';
  if(e.followResult==='تم الصرف')return s.kind==='عيني'&&!needsFollow(e)?'deliv':'recv';
  if(e.followResult==='لم يتم الصرف'){
    const a=attemptsOf(e);
    if(e.noAnswer||(a.length>=3&&!a.some(x=>x.answered)))return'noans';
    return'notpaid';
  }
  if(e.stuck)return'stuck';
  if(e.sent){
    if(s.kind==='عيني'&&!needsFollow(e))return'deliv';
    if(unanswered(e))return'noans';
    if(s.kind==='مالي'){
      if(!e.transfer&&e.v2)return'sent';
      const t=e.transfer?isoToTs(e.transfer.date):e.sentAt;
      return(Date.now()-(t||0))>=CFG.followDays*DAY?'wait':(e.transfer?'trans':'wait');
    }
    return'wait';
  }
  if(holdOf(e))return'hold';
  if(e.needsConfirm)return e.confirmedAt?'conf':'needconf';
  return'due';
}
function stageLabel(k,e){if(k==='recv'&&e&&svc(e.service).kind==='عيني')return'تم الاستلام';return STG[k][0]}
function stagePill(e){const k=stageOf(e);return pill(stageLabel(k,e),STG[k][1])}
/* staff responsibility for the follow-up is met when answered or after 3 unanswered attempts */
function followDone(e){const a=attemptsOf(e);return !!e.followResult||a.some(x=>x.answered)||unanswered(e)>=3}
function canSend(e){const k=stageOf(e);return k==='due'||k==='conf'}
function canFollow(e){const k=stageOf(e);return['trans','wait','noans','sent'].includes(k)&&(k!=='sent')&&!followDone(e)}
function caseConfirmed(code){
  const c=S.cases[code];if(c&&c.dataConfirmed)return true;
  return(D.entsByCode[code]||[]).some(e=>FINAL.includes(stageOf(e)));
}
function entsOf(m){return D.ents.filter(e=>e.month===m)}

/* ---- tasks: virtual (from the workflow) + manual ---- */
function defAssignee(kind){return CFG.assign[kind]||''}
function buildTasks(){
  const out=[];const now=Date.now();
  D.ents.forEach(e=>{
    if(e.stopped)return;
    if(e.needsConfirm&&!e.confirmWith){
      const created=e.createdAt||isoToTs(e.month+'-01');
      out.push({id:'c:'+e.id,kind:'confirm',title:'مكالمة تأكيد بيانات',code:e.code,entId:e.id,month:e.month,assignee:e.confAssignee||defAssignee('confirm'),
        createdAt:created,due:created+CFG.confirmDays*DAY,completedAt:e.confirmedAt||0,completedBy:e.confirmedBy||'',
        status:e.confirmedAt?'مكتملة':(e.confStuck?'متعثرة':'جديدة'),result:e.confirmedAt?(e.confirmNote||'تم تأكيد البيانات'):(e.confStuck||''),returned:e.confReturned||0});
    }
    if(e.sent&&needsFollow(e)&&(svc(e.service).kind!=='مالي'||isTransferred(e))){
      const created=e.transfer?(e.transfer.at||isoToTs(e.transfer.date)):(e.sentAt||0);
      const a=attemptsOf(e);const done=followDone(e);
      const last=a.length?a[a.length-1]:null;
      out.push({id:'f:'+e.id,kind:'follow',title:'مكالمة متابعة صرف',code:e.code,entId:e.id,month:e.month,assignee:e.followAssignee||defAssignee('follow'),
        createdAt:created,due:created+CFG.followDays*DAY,completedAt:done?(e.followAt||(last&&last.at)||0):0,completedBy:done?(e.followBy||(last&&last.by)||''):'',
        status:done?'مكتملة':(a.length?'قيد التنفيذ':'جديدة'),result:done?(stageLabel(stageOf(e),e)+(unanswered(e)>=3&&!a.some(x=>x.answered)?' · اكتملت 3 محاولات':'')):(a.length?('محاولات '+a.length+'/3'):''),returned:e.followReturned||0});
    }
    if(e.notPaid&&e.notPaid.action){
      out.push({id:'a:'+e.id,kind:'action',title:'معالجة عدم صرف: '+e.notPaid.action,code:e.code,entId:e.id,month:e.month,assignee:e.actionAssignee||defAssignee('action'),
        createdAt:e.notPaid.at,due:e.notPaid.at+CFG.actionDays*DAY,completedAt:e.actionDone?e.actionDone.at:0,completedBy:e.actionDone?e.actionDone.by:'',
        status:e.actionDone?'مكتملة':'جديدة',result:e.actionDone?e.actionDone.result:'',returned:0});
    }
  });
  D.tasks.forEach(t=>out.push(Object.assign({kind:'manual'},t)));
  out.forEach(t=>{t.late=!t.completedAt&&t.status!=='متعثرة'&&t.due&&now>t.due;t.lateDone=!!(t.completedAt&&t.due&&t.completedAt>t.due);t.shown=t.late?'متأخرة':t.status});
  return out;
}

/* ---- permissions ---- */
function myRole(){
  if(conn.mode==='cloud'&&isOwner)return'مدير';
  const s=S.staff[me.id];
  if(s&&s.role)return s.role;
  if(!D.staff||!D.staff.length)return'مدير'; /* first user bootstraps the system */
  return'موظف';
}
function can(p){if(canWrite===false)return false;const r=PERMS[myRole()]||[];return r.includes('*')||r.includes(p)}
function nameOf(id){
  if(!id)return'—';
  const st=S.staff[id];
  if(id===me.id)return me.name||(st&&st.label)||'أنا';
  if(names[id])return names[id];
  if(st&&st.label)return st.label;
  return'مستخدم';
}
function staffIds(){
  const ids=new Set(D.staff.filter(s=>s.active!==false).map(s=>s.id));
  D.ops.forEach(o=>o.by&&ids.add(o.by));
  D.vtasks.forEach(t=>{t.assignee&&ids.add(t.assignee);t.completedBy&&ids.add(t.completedBy)});
  if(me.id)ids.add(me.id);
  return[...ids].filter(Boolean);
}
function staffOpts(val,blank){return opt(staffIds().map(i=>[i,nameOf(i)]),val,blank)}

/* =====================================================================
   5) Writes: serialized, audited, and every action records who & when
   ===================================================================== */
let queue=Promise.resolve();
function enqueue(fn){const p=queue.then(fn);queue=p.catch(()=>{});return p}
const setDoc=(col,id,data)=>enqueue(()=>db.collection(col).doc(id).set(data));
const updDoc=(col,id,data)=>enqueue(()=>db.collection(col).doc(id).update(data));
function logAudit(action,target,detail,extra){
  const id=newId('a');
  return setDoc('audit',id,Object.assign({id:id,ts:Date.now(),by:me.id,action:action,target:target||'',detail:detail||''},extra||{}));
}
/* operations log: one record per executed action (bulk actions store a count) */
function logOp(type,o){
  o=o||{};
  const t=TASK_BY_NAME[type]||{team:'عام',weight:1,scope:o.code?'حالة':'عامة'};
  const id=newId('o');
  return setDoc('ops',id,{id:id,type:type,team:t.team,weight:t.weight,scope:o.code?'حالة':'عامة',code:o.code||'',dept:o.dept||'',
    date:o.date||todayISO(),status:o.status||'تم',result:o.result||'',notes:o.notes||'',count:o.count||1,ref:o.ref||'',
    auto:true,by:me.id,createdAt:Date.now()});
}
function toast(msg){const t=$('#toast');t.innerHTML='<div>'+esc(msg)+'</div>';clearTimeout(toast.t);toast.t=setTimeout(()=>{t.innerHTML=''},4200)}
function errMsg(e){
  const c=e&&e.code;
  if(c==='invalid_argument')return'تعذر الحفظ. على الأرجح ليس لديك صلاحية الكتابة في هذه الصفحة.';
  if(c==='quota_exceeded')return'امتلأت سعة قاعدة البيانات. صدّري نسخة احتياطية ثم تواصلي مع المسؤول.';
  if(c==='resource_exhausted')return'عدد كبير من العمليات في وقت قصير. انتظري لحظات وأعيدي المحاولة.';
  return'تعذر الحفظ: '+((e&&e.message)||'خطأ غير معروف');
}
async function ensureStaff(){
  if(!me.id||S.staff[me.id])return;
  const first=!D.staff.length;
  await setDoc('staff',me.id,{id:me.id,role:first?'مدير':'موظف',team:'',active:true,label:conn.mode==='local'?(me.name||''):'',joinedAt:Date.now()});
}
async function guard(perm,fn){
  if(!db){toast('قاعدة البيانات غير متاحة في هذا العرض.');return false}
  if(!me.id){toast('سجّلي اسمك أولاً.');return false}
  if(perm&&!can(perm)){toast('هذا الإجراء غير متاح لدورك ('+myRole()+'). تواصلي مع المشرف.');return false}
  try{await ensureStaff();await fn();return true}catch(e){console.error(e);toast(errMsg(e));return false}
}

/* =====================================================================
   6) Workflow actions
   ===================================================================== */
async function generateMonth(){
  const todo=[];let skipped=0;
  D.decs.filter(d=>d.status==='مستمر').forEach(d=>{
    (D.linesByDec[d.id]||[]).forEach(l=>{
      const s=svc(l.service);
      if(s.kind==='خدمة'||s.cycle==='تغطية طوال المدة')return;
      const inRange=s.cycle==='مرة واحدة'?l.startMonth===month:(l.startMonth<=month&&month<=l.endMonth);
      if(!inRange){if(month>l.endMonth&&l.startMonth<=month)skipped++;return}
      const id=l.id+'_'+month;if(S.ents[id])return; /* one entitlement per line per month */
      todo.push({id:id,code:l.code,decId:l.decId,lineId:l.id,service:l.service,kind:s.kind,month:month,base:+l.amount,amount:+l.amount,carried:[],
        needsConfirm:!caseConfirmed(l.code),sent:false,attempts:[],followResult:null,v2:true,createdAt:Date.now(),createdBy:me.id});
    });
  });
  if(!todo.length)return toast('لا توجد استحقاقات جديدة لـ'+fmtMonth(month)+'. لا يُنشأ استحقاق بعد تاريخ نهاية القرار.');
  /* new cases in the same run: only the first entitlement of a code carries the confirmation task */
  const seen=new Set();todo.forEach(e=>{if(e.needsConfirm){if(seen.has(e.code))e.confirmWith=true;seen.add(e.code)}});
  toast('جارٍ توليد '+todo.length+' استحقاق…');
  const ok=await guard('generate',async()=>{
    for(const e of todo)await setDoc('ents',e.id,e);
    await logOp('توليد استحقاقات الشهر',{dept:fmtMonth(month),result:todo.length+' استحقاق',count:1});
    await logAudit('توليد استحقاقات',fmtMonth(month),todo.length+' استحقاق · '+todo.filter(e=>e.needsConfirm).length+' يحتاج تأكيد بيانات');
  });
  if(ok)toast('تم توليد '+todo.length+' استحقاق لـ'+fmtMonth(month)+'.');
}

/* confirmation call → updates MASTER (with change history) and marks the entitlement confirmed */
async function saveConfirm(entId){
  const e=S.ents[entId];const c=S.cases[e.code]||{};
  const g=id=>{const el=$('#'+id);return el?el.value.trim():''};
  const result=g('cf-result');
  if(!result)return toast('اختاري نتيجة المكالمة.');
  if(result==='لم يرد'){
    const n=(e.confTries||0)+1;
    const ok=await guard('confirm',async()=>{
      await updDoc('ents',entId,{confTries:n,confLastTry:Date.now(),confLastBy:me.id,confStuck:n>=3?'3 محاولات تأكيد بدون رد':''});
      await logOp('مكالمة تاكيد بيانات',{code:e.code,result:'لم يرد (محاولة '+n+')',status:n>=3?'تم':'جاري',ref:entId});
      await logAudit('مكالمة تأكيد بيانات',e.code,'لم يرد · محاولة '+n);
    });
    if(ok){closeModal();toast(n>=3?'3 محاولات بدون رد. المهمة متعثرة وتحتاج قرار المشرف.':'سُجلت المحاولة '+n+'.')}
    return;
  }
  const patch={};CASE_FIELDS.forEach(([f])=>{const el=$('#cf-'+f);if(el)patch[f]=el.value.trim()});
  if(!patch.phone&&!c.phone)return toast('رقم الهاتف مطلوب لتأكيد البيانات.');
  if(svc(e.service).kind==='مالي'&&!(patch.recvMethod||c.recvMethod))return toast('طريقة الاستلام مطلوبة قبل الإرسال للصرف.');
  if(svc(e.service).kind==='مالي'&&['محفظة إلكترونية','إنستاباي'].includes(patch.recvMethod||c.recvMethod)&&!(patch.recvPhone||c.recvPhone))return toast('رقم المحفظة مطلوب.');
  const sameCase=D.ents.filter(x=>x.code===e.code&&x.needsConfirm&&!x.confirmedAt);
  const ok=await guard('confirm',async()=>{
    await writeCaseChanges(e.code,patch,'مكالمة تأكيد بيانات');
    await updDoc('cases',e.code,{dataConfirmed:true,confirmedAt:Date.now(),confirmedBy:me.id});
    for(const x of sameCase)await updDoc('ents',x.id,{confirmedAt:Date.now(),confirmedBy:me.id,confirmNote:g('cf-note')||result,confStuck:''});
    await logOp('مكالمة تاكيد بيانات',{code:e.code,result:result,notes:g('cf-note'),ref:entId});
    await logAudit('تأكيد بيانات',e.code,result);
  });
  if(ok){closeModal();toast('تم تأكيد البيانات. الحالة جاهزة للإرسال.')}
}
async function writeCaseChanges(code,patch,source){
  const c=S.cases[code]||{};
  const diffs=[];
  Object.keys(patch).forEach(f=>{const o=c[f]==null?'':String(c[f]),n=patch[f]==null?'':String(patch[f]);if(o!==n)diffs.push({f:f,label:(CASE_FIELDS.find(x=>x[0]===f)||[f,f])[1],old:o,new:n})});
  if(!diffs.length)return 0;
  const upd={};diffs.forEach(d=>upd[d.f]=f2v(d.f,patch[d.f]));
  upd.updatedAt=Date.now();upd.updatedBy=me.id;
  await updDoc('cases',code,upd);
  const id=newId('h');
  await setDoc('changes',id,{id:id,code:code,ts:Date.now(),by:me.id,source:source||'تعديل بيانات',diffs:diffs});
  return diffs.length;
}
const f2v=(f,v)=>f==='familySize'?(+v||0):v;

/* send selected entitlements in one payment batch */
async function bulkSend(){
  const list=[...SEL].map(id=>S.ents[id]).filter(Boolean);
  const ok=list.filter(canSend),blocked=list.length-ok.length;
  if(!ok.length)return toast('لا يوجد في التحديد ما يمكن إرساله. الحالات الجديدة تحتاج تأكيد بيانات، والمعلّقة تحتاج تسوية الشهر السابق.');
  const kind=F.entKind;const bid='B-'+month+'-'+kind+'-'+Date.now().toString(36).slice(-4).toUpperCase();
  const total=sum(ok,e=>e.amount);
  const label=kind==='عيني'?'تسليم مساعدة عينية':(kind==='كارت'?'تسليم كروت كازيون':'إرسال ضمن دفعة الصرف');
  const done=await guard('send',async()=>{
    await setDoc('batches',bid,{id:bid,month:month,kind:kind,count:ok.length,total:total,by:me.id,createdAt:Date.now(),entIds:ok.map(e=>e.id)});
    for(const e of ok)await updDoc('ents',e.id,{sent:true,sentAt:Date.now(),sentBy:me.id,batchId:bid});
    await logOp(label,{dept:'دفعة '+bid,result:ok.length+' حالة · '+money(total)+' ج',count:ok.length,ref:bid});
    await logAudit(label,bid,ok.length+' استحقاق · '+money(total)+' جنيه'+(blocked?(' · تم تخطي '+blocked):''));
  });
  if(done){SEL.clear();toast('أُرسلت '+ok.length+' حالة في الدفعة '+bid+(blocked?(' · لم تُرسل '+blocked+' لأنها غير جاهزة'):'')+'.')}
}

/* transfer: amount, method, date, reference are all mandatory */
async function saveTransfer(ids,bulk){
  const g=id=>$('#'+id).value.trim();
  const method=g('tr-method'),date=g('tr-date'),ref=g('tr-ref');
  if(!method||!date||!ref)return toast('طريقة التحويل وتاريخه ورقم المرجع إلزامية.');
  const list=ids.map(id=>S.ents[id]).filter(e=>e&&e.sent&&!e.transfer&&svc(e.service).kind==='مالي'&&e.v2);
  if(!list.length)return toast('لا توجد استحقاقات مُرسلة بدون تحويل في التحديد.');
  let amountOne=null;
  if(!bulk){amountOne=+g('tr-amount');if(!(amountOne>0))return toast('اكتبي قيمة المبلغ المحول.')}
  /* the same reference cannot be reused for another case outside this batch */
  const clash=D.ents.find(x=>x.transfer&&x.transfer.ref===ref&&!ids.includes(x.id)&&(!bulk||x.transfer.batchRef!==ref));
  if(clash)return toast('رقم المرجع '+ref+' مستخدم من قبل للحالة '+clash.code+' ('+fmtMonth(clash.month)+'). راجعي الرقم.');
  const ok=await guard('transfer',async()=>{
    for(const e of list){
      const amt=bulk?+e.amount:amountOne;
      await updDoc('ents',e.id,{transfer:{amount:amt,method:method,date:date,ref:ref,batchRef:bulk?ref:'',by:me.id,at:Date.now()}});
    }
    await logOp('تسجيل تحويل مالي',{code:list.length===1?list[0].code:'',dept:list.length>1?('مرجع '+ref):'',result:list.length+' تحويل · '+money(bulk?sum(list,e=>e.amount):amountOne)+' ج · '+method,count:list.length,ref:ref,date:date});
    await logAudit('تسجيل تحويل',list.length===1?list[0].code:('مرجع '+ref),list.length+' تحويل · '+method+' · '+date);
  });
  if(ok){SEL.clear();closeModal();toast('سُجل التحويل لعدد '+list.length+'. التحويل وحده لا يعني الاستلام: تظهر الحالات الآن في المتابعة.')}
}

/* follow-up call result */
async function recordAttempt(id,a){
  const e=S.ents[id];if(!e)return;
  if(a==='notpaid')return openNotPaid(id);
  const a0=attemptsOf(e);
  if(a==='0'&&unanswered(e)>=3)return toast('اكتملت 3 محاولات بالفعل. يمكن فقط تسجيل رد متأخر.');
  const note=($('#fu-note-'+id)||{}).value||'';
  const attempts=a0.concat([{at:Date.now(),by:me.id,answered:a!=='0',result:a==='paid'?'تم الصرف':(a==='0'?'لم يرد':a),note:note}]);
  const patch={attempts:(e.attempts||[]).filter(x=>x.voided).concat(attempts)};let msg='';
  if(a==='paid'){patch.followResult='تم الصرف';patch.noAnswer=false;patch.followAt=Date.now();patch.followBy=me.id;msg='سُجل: رد وتم الصرف. اكتملت دورة الشهر لهذه الحالة.'}
  else if(attempts.filter(x=>!x.answered).length>=3){patch.followResult='لم يتم الصرف';patch.noAnswer=true;patch.staffDone=true;patch.followAt=Date.now();patch.followBy=me.id;msg='اكتملت 3 محاولات بدون رد. مسؤولية الموظف مستوفاة، والاستلام غير مكتمل.'}
  else msg='سُجلت المحاولة '+attempts.length+' من 3.';
  const ok=await guard('follow',async()=>{
    await updDoc('ents',id,patch);
    await logOp('مكالمة متابعة صرف',{code:e.code,result:a==='paid'?'رد · تم الصرف':'لم يرد ('+attempts.filter(x=>!x.answered).length+'/3)',notes:note,ref:id,status:'تم'});
    await logAudit('متابعة',e.code,e.service+' · '+fmtMonth(e.month)+' · '+msg);
  });
  if(ok)toast(msg);
}
function openNotPaid(id){
  const e=S.ents[id];
  openModal('<h2>رد · لم يتم الصرف <span class="muted num" style="font-size:15px">'+esc(e.code)+'</span></h2><p class="muted small">يجب تسجيل السبب والإجراء المطلوب لمعالجة المشكلة. يُنشأ تلقائياً مهمة معالجة.</p><div class="fgrid">'
   +'<label>السبب<select id="np-reason">'+opt(NOTPAID_REASONS,'','اختاري')+'</select></label>'
   +'<label>الإجراء المطلوب<input id="np-action" placeholder="مثال: تصحيح رقم المحفظة وإعادة التحويل"></label>'
   +'<label>مسند إلى<select id="np-assignee">'+staffOpts(defAssignee('action'),'غير مسندة')+'</select></label></div>'
   +'<label style="display:block;margin-top:10px"><span class="muted small">تفاصيل</span><textarea id="np-note"></textarea></label>'
   +'<div class="actions"><button class="btn primary" data-act="saveNotPaid" data-v="'+esc(id)+'">حفظ</button><button class="btn" data-act="closeModal">إلغاء</button></div>');
}
async function saveNotPaid(id){
  const e=S.ents[id];const r=$('#np-reason').value,act=$('#np-action').value.trim(),note=$('#np-note').value.trim();
  if(!r||!act)return toast('السبب والإجراء المطلوب إلزاميان.');
  const attempts=(e.attempts||[]).concat([{at:Date.now(),by:me.id,answered:true,result:'لم يتم الصرف',note:r+' · '+note}]);
  const ok=await guard('follow',async()=>{
    await updDoc('ents',id,{attempts:attempts,followResult:'لم يتم الصرف',noAnswer:false,followAt:Date.now(),followBy:me.id,notPaid:{reason:r,action:act,note:note,at:Date.now(),by:me.id},actionAssignee:$('#np-assignee').value});
    await logOp('مكالمة متابعة صرف',{code:e.code,result:'رد · لم يتم الصرف · '+r,notes:act,ref:id});
    await logAudit('متابعة',e.code,'لم يتم الصرف · '+r+' · الإجراء: '+act);
  });
  if(ok){closeModal();toast('سُجل عدم الصرف وأُنشئت مهمة المعالجة.')}
}
async function markStuck(id){
  const e=S.ents[id];const r=$('#sk-reason').value.trim();
  if(!r)return toast('اكتبي سبب التعثر.');
  const ok=await guard('follow',async()=>{await updDoc('ents',id,{stuck:{reason:r,at:Date.now(),by:me.id}});await logAudit('تعثر',e.code,r)});
  if(ok){closeModal();toast('سُجلت الحالة متعثرة.')}
}
async function unstick(id){
  const e=S.ents[id];
  const ok=await guard('follow',async()=>{await updDoc('ents',id,{stuck:null});await logAudit('إلغاء تعثر',e.code,'')});
  if(ok)toast('أُلغي التعثر.');
}
async function completeAction(id){
  const e=S.ents[id];const r=$('#ac-result').value.trim();
  if(!r)return toast('اكتبي ما تم تنفيذه.');
  const ok=await guard('task',async()=>{
    await updDoc('ents',id,{actionDone:{at:Date.now(),by:me.id,result:r}});
    await logOp('معالجة عدم صرف',{code:e.code,result:r,ref:id});
    await logAudit('معالجة عدم صرف',e.code,r);
  });
  if(ok){closeModal();toast('أُغلقت مهمة المعالجة.')}
}

/* approve inclusion of a held entitlement + apply the policy to the unreceived previous month */
async function approveHold(id){
  const e=S.ents[id];const p=prevEnt(e);
  const how=$('#ap-how').value,reason=$('#ap-reason').value.trim();
  if(!reason)return toast('اكتبي سبب الاعتماد.');
  const ok=await guard('approve',async()=>{
    const patch={holdApproved:{by:me.id,at:Date.now(),reason:reason,how:how}};
    if(p&&!resolved(p)){
      const unrec=Math.max(0,(+p.amount||0)-netReceived(p));
      if(how==='carry'&&unrec>0){patch.amount=(+e.amount||0)+unrec;patch.carriedFrom={id:p.id,month:p.month,amount:unrec}}
      if(how==='extend'){const l=S.lines[e.lineId];if(l){await updDoc('lines',l.id,{endMonth:addMonths(l.endMonth,1),extendedBy:(l.extendedBy||0)+1});await logAudit('تمديد بند',l.code,l.service+' حتى '+fmtMonth(addMonths(l.endMonth,1))+' بدل '+fmtMonth(p.month),{old:l.endMonth,new:addMonths(l.endMonth,1)})}}
      await updDoc('ents',p.id,{settled:{how:how,into:id,by:me.id,at:Date.now(),reason:reason}});
    }
    await updDoc('ents',id,patch);
    await logAudit('اعتماد إدراج',e.code,fmtMonth(e.month)+' · '+POLICIES[how]+' · '+reason);
  });
  if(ok){closeModal();toast('تم الاعتماد. يمكن إرسال الحالة الآن.')}
}

/* refunds */
async function saveRefund(entId){
  const e=S.ents[entId];const g=id=>$('#'+id).value.trim();
  const amt=+g('rf-amount'),date=g('rf-date'),reason=g('rf-reason'),settle=g('rf-settle'),how=g('rf-how');
  const tr=trAmount(e),prev=refundSum(e),max=tr-prev;
  if(!(amt>0))return toast('اكتبي قيمة المبلغ المسترد.');
  if(amt>max)return toast('المبلغ المسترد أكبر من المتبقي من التحويل ('+money(max)+' ج).');
  if(!date||!reason)return toast('تاريخ الاسترداد وسببه إلزاميان.');
  const id=newId('r');const full=(prev+amt)>=tr;
  const ok=await guard('refund',async()=>{
    await setDoc('refunds',id,{id:id,entId:entId,code:e.code,month:e.month,service:e.service,transferAmount:tr,amount:amt,date:date,reason:reason,
      ref:(e.transfer&&e.transfer.ref)||'',type:full?'كلي':'جزئي',settlement:settle||'معلقة',how:how||CFG.policy,note:g('rf-note'),by:me.id,createdAt:Date.now()});
    if(full&&how&&settle==='تمت التسوية')await updDoc('ents',entId,{settled:{how:how,by:me.id,at:Date.now(),reason:'استرداد كلي'}});
    await logOp('تسجيل استرداد',{code:e.code,result:(full?'كلي':'جزئي')+' · '+money(amt)+' ج · '+reason,ref:entId,date:date});
    await logAudit('استرداد',e.code,money(amt)+' ج من '+money(tr)+' · '+(full?'كلي':'جزئي')+' · '+reason);
  });
  if(ok){closeModal();toast('سُجل الاسترداد ('+(full?'كلي':'جزئي')+'). صافي المصروف تحدّث تلقائياً.')}
}
async function settleRefund(id){
  const r=S.refunds[id];const how=$('#rs-how').value;
  const ok=await guard('refund',async()=>{
    await updDoc('refunds',id,{settlement:'تمت التسوية',how:how,settledAt:Date.now(),settledBy:me.id});
    const e=S.ents[r.entId];if(e&&stageOf(e)==='refund')await updDoc('ents',e.id,{settled:{how:how,by:me.id,at:Date.now(),reason:'تسوية استرداد'}});
    await logAudit('تسوية استرداد',r.code,POLICIES[how]);
  });
  if(ok){closeModal();toast('تمت التسوية.')}
}

/* decisions: stop / close ended / renewal */
async function stopDecisions(ids,status,reason){
  const perm=status==='منتهي'?'close':'decision.stop';
  const ok=await guard(perm,async()=>{
    for(const id of ids){
      const d=S.decisions[id];
      await updDoc('decisions',id,{status:status,stopReason:reason,stopDate:todayISO(),stoppedBy:me.id});
      /* stop entitlements of later months that were not sent yet */
      for(const e of D.ents.filter(x=>x.decId===id&&!x.sent&&!x.stopped&&x.month>=curMonth))await updDoc('ents',e.id,{stopped:{at:Date.now(),by:me.id,reason:reason}});
      await logOp('إغلاق قرار',{code:d.code,result:status+' · '+reason});
    }
    await logAudit('تغيير حالة قرار',ids.length+' قرار',status+(reason?' · '+reason:''));
  });
  if(ok){closeModal();SEL.clear();toast('تم تحويل '+ids.length+' قرار إلى «'+status+'».')}
}
async function sendRenewal(ids){
  const note=($('#rn-note')||{}).value||'';
  const ok=await guard('renewal',async()=>{
    for(const id of ids){
      const d=S.decisions[id];
      await updDoc('decisions',id,{renewal:{status:'أُرسلت للتجديد',at:Date.now(),by:me.id,note:note}});
      await logOp('ارسال الحالة للمناقشة او البحث لخدمة جديدة',{code:d.code,result:'إرسال للتجديد · ينتهي '+fmtMonth(decEnd(d)),notes:note,ref:id});
    }
    await logAudit('إرسال للتجديد',ids.length+' قرار',note);
  });
  if(ok){closeModal();SEL.clear();toast('أُرسلت '+ids.length+' حالة للتجديد.')}
}
async function setRenewal(id,status){
  const d=S.decisions[id];
  const ok=await guard('renewal',async()=>{await updDoc('decisions',id,{renewal:Object.assign({},d.renewal||{},{status:status,doneAt:Date.now(),doneBy:me.id})});await logAudit('موقف التجديد',d.code,status)});
  if(ok)toast('سُجل: '+status);
}

/* tasks */
async function assignTasks(ids,uid){
  const ok=await guard('assign',async()=>{
    for(const tid of ids){
      const [k,id]=[tid.slice(0,1),tid.slice(2)];
      if(tid.indexOf(':')!==1){await updDoc('tasks',tid,{assignee:uid,assignedAt:Date.now(),assignedBy:me.id});continue}
      const f=k==='c'?'confAssignee':(k==='f'?'followAssignee':'actionAssignee');
      await updDoc('ents',id,{[f]:uid});
    }
    await logAudit('إسناد مهام',ids.length+' مهمة',nameOf(uid));
  });
  if(ok){SEL.clear();toast('أُسندت '+ids.length+' مهمة إلى '+nameOf(uid)+'.')}
}
async function saveTask(id){
  const g=x=>$('#'+x).value.trim();
  const title=g('tk-title'),code=g('tk-code');
  if(!title)return toast('اكتبي عنوان المهمة.');
  if(code&&!S.cases[code])return toast('كود الحالة غير مسجل.');
  const tid=id||newId('t');
  const data={title:title,type:g('tk-type'),code:code,assignee:g('tk-assignee'),due:isoToTs(g('tk-due'))||Date.now()+CFG.taskDays*DAY,notes:g('tk-notes')};
  const ok=await guard(id?'task':'task',async()=>{
    if(id)await updDoc('tasks',tid,data);
    else await setDoc('tasks',tid,Object.assign({id:tid,status:'جديدة',createdAt:Date.now(),createdBy:me.id,returned:0},data));
    await logAudit(id?'تعديل مهمة':'مهمة جديدة',code||title,nameOf(data.assignee));
  });
  if(ok){closeModal();toast('تم حفظ المهمة.')}
}
async function setTaskStatus(id,status){
  const t=S.tasks[id];const res=($('#tk-result')||{}).value;
  if(status==='مكتملة'&&!(res&&res.trim()))return toast('لا يمكن إغلاق المهمة بدون تسجيل نتيجة التنفيذ.');
  if(status==='متعثرة'&&!(res&&res.trim()))return toast('اكتبي سبب التعثر.');
  const patch={status:status};
  if(status==='قيد التنفيذ')patch.startedAt=Date.now();
  if(status==='مكتملة'){patch.completedAt=Date.now();patch.completedBy=me.id;patch.result=res.trim()}
  if(status==='متعثرة'){patch.result=res.trim()}
  const ok=await guard('task',async()=>{
    await updDoc('tasks',id,patch);
    if(status==='مكتملة'){const tt=TASK_BY_NAME[t.type];await logOp(tt?t.type:'مهمة يدوية',{code:t.code,dept:t.code?'':t.title,result:res.trim(),ref:id})}
    await logAudit('مهمة: '+status,t.code||t.title,res||'');
  });
  if(ok){closeModal();toast('تم: '+status)}
}
async function returnTask(tid){
  const note=$('#rt-note').value.trim();if(!note)return toast('اكتبي سبب الإرجاع للتصحيح.');
  const ok=await guard('return',async()=>{
    if(tid.indexOf(':')!==1){const t=S.tasks[tid];await updDoc('tasks',tid,{status:'قيد التنفيذ',completedAt:0,returned:(t.returned||0)+1,returnNote:note,returnedBy:me.id,returnedTo:t.completedBy||t.assignee});}
    else{
      const k=tid.slice(0,1),id=tid.slice(2);const e=S.ents[id];
      if(k==='c')await updDoc('ents',id,{confirmedAt:0,confReturned:(e.confReturned||0)+1,confReturnNote:note,confReturnedTo:e.confirmedBy||''});
      if(k==='f')await updDoc('ents',id,{followResult:null,noAnswer:false,staffDone:false,followReturned:(e.followReturned||0)+1,followReturnNote:note,followReturnedTo:e.followBy||'',attempts:attemptsOf(e).map(a=>Object.assign({},a,{voided:true}))});
    }
    await logAudit('إرجاع للتصحيح',tid,note);
  });
  if(ok){closeModal();toast('أُرجعت المهمة للتصحيح.')}
}
async function returnOp(id){
  const note=$('#ro-note').value.trim();if(!note)return toast('اكتبي سبب الإرجاع.');
  const o=S.ops[id];
  const ok=await guard('return',async()=>{await updDoc('ops',id,{returned:(o.returned||0)+1,returnNote:note,status:'جاري',returnedBy:me.id});await logAudit('إرجاع عملية للتصحيح',o.code||o.dept,o.type+' · '+note)});
  if(ok){closeModal();toast('أُرجعت العملية للتصحيح.')}
}

/* =====================================================================
   7) Metrics (shared by the dashboard and the reports — all from real records)
   ===================================================================== */
const MONEY_KINDS=['مالي'];
function caseOk(code,f){
  const c=S.cases[code]||{};
  if(f.gov&&c.governorate!==f.gov)return false;
  if(f.nat&&c.nationality!==f.nat)return false;
  return true;
}
function makeFilter(f){
  f=f||{};
  return{
    ent:e=>(!f.svc||e.service===f.svc)&&caseOk(e.code,f)&&(!f.dec||(S.decisions[e.decId]&&decStatus(S.decisions[e.decId])===f.dec))
      &&(!f.staff||e.sentBy===f.staff||(e.transfer&&e.transfer.by===f.staff)||attemptsOf(e).some(a=>a.by===f.staff)||e.confirmedBy===f.staff),
    op:o=>(!f.staff||o.by===f.staff)&&(!o.code||caseOk(o.code,f)),
    task:t=>(!f.staff||t.assignee===f.staff||t.completedBy===f.staff)&&(!t.code||caseOk(t.code,f)),
    dec:d=>caseOk(d.code,f)&&(!f.dec||decStatus(d)===f.dec)&&(!f.svc||(D.linesByDec[d.id]||[]).some(l=>l.service===f.svc))
  };
}
function metrics(m,f){
  const fl=makeFilter(f);
  const ents=entsOf(m).filter(fl.ent);
  const fin=ents.filter(e=>MONEY_KINDS.includes(svc(e.service).kind));
  const ops=D.ops.filter(o=>(o.date||'').slice(0,7)===m&&fl.op(o));
  const tasks=D.vtasks.filter(t=>tsMonth(t.createdAt)===m&&fl.task(t));
  const decs=D.decs.filter(fl.dec);
  const cnt=o=>+o.count||1;
  const stages={};ents.forEach(e=>{const k=stageOf(e);stages[k]=(stages[k]||0)+1});
  const refunds=D.refunds.filter(r=>r.month===m&&(!f||!f.svc||r.service===f.svc)&&caseOk(r.code,f||{}));
  const transferred=sum(fin,trAmount),refunded=sum(refunds,r=>r.amount);
  const reasons={};
  ents.forEach(e=>{if(e.notPaid)reasons[e.notPaid.reason]=(reasons[e.notPaid.reason]||0)+1;if(e.stuck)reasons['متعثر: '+e.stuck.reason]=(reasons['متعثر: '+e.stuck.reason]||0)+1;if(stageOf(e)==='noans')reasons['عدم الرد بعد 3 محاولات']=(reasons['عدم الرد بعد 3 محاولات']||0)+(unanswered(e)>=3?1:0)});
  refunds.forEach(r=>{reasons['استرداد: '+r.reason]=(reasons['استرداد: '+r.reason]||0)+1});
  Object.keys(reasons).forEach(k=>{if(!reasons[k])delete reasons[k]});
  const bySvc={};
  ents.forEach(e=>{const b=bySvc[e.service]=bySvc[e.service]||{n:0,sent:0,done:0,open:0,amount:0,kind:svc(e.service).kind};b.n++;b.amount+=+e.amount||0;if(e.sent)b.sent++;const k=stageOf(e);if(FINAL.includes(k))b.done++;else if(!['stop'].includes(k))b.open++});
  const final=ents.filter(e=>FINAL.includes(stageOf(e)));
  const notRecv=ents.filter(e=>['noans','notpaid','refund','stuck'].includes(stageOf(e)));
  return{
    m:m,ents:ents,fin:fin,ops:ops,tasks:tasks,stages:stages,refunds:refunds,reasons:reasons,bySvc:bySvc,
    opsTotal:sum(ops,cnt),opsDone:sum(ops.filter(o=>o.status==='تم'),cnt),opsOpen:sum(ops.filter(o=>o.status!=='تم'),cnt),
    tasksLate:tasks.filter(t=>t.late||t.lateDone).length,openLateNow:D.vtasks.filter(t=>t.late&&fl.task(t)).length,
    followOps:sum(ops.filter(o=>/متابعة/.test(o.type)),cnt),deliveryOps:sum(ops.filter(o=>/تسليم/.test(o.type)),cnt),
    due:sum(fin,e=>e.amount),transferred:transferred,transferredCases:uniq(fin.filter(e=>trAmount(e)>0).map(e=>e.code)).length,
    refunded:refunded,net:transferred-refunded,notRecvFin:uniq(fin.filter(e=>['noans','notpaid','refund','stuck'].includes(stageOf(e))).map(e=>e.code)).length,
    beneficiaries:uniq(final.map(e=>e.code)).length,received:final.length,notReceived:notRecv.length,
    activeCases:uniq(decs.filter(d=>decActiveIn(d,m)).map(d=>d.code)).length,
    newDecs:decs.filter(d=>(d.issueDate||'').slice(0,7)===m).length,
    endingDecs:decs.filter(d=>decEnd(d)===m).length,
    stoppedDecs:decs.filter(d=>['موقوف','مسحوب'].includes(d.status)&&(d.stopDate||'').slice(0,7)===m).length,
    stoppedTotal:decs.filter(d=>['موقوف','مسحوب'].includes(d.status)).length,
    referred:decs.filter(d=>d.renewal&&tsMonth(d.renewal.at)===m).length
  };
}
function staffStats(m,uid,f){
  const fl=makeFilter(Object.assign({},f||{},{staff:''}));
  const assigned=D.vtasks.filter(t=>t.assignee===uid&&tsMonth(t.createdAt)===m&&fl.task(t));
  const doneBy=D.vtasks.filter(t=>t.completedBy===uid&&tsMonth(t.completedAt)===m&&fl.task(t));
  const ops=D.ops.filter(o=>o.by===uid&&(o.date||'').slice(0,7)===m&&fl.op(o));
  const cnt=o=>+o.count||1;
  const times=doneBy.map(t=>t.completedAt-t.createdAt).filter(x=>x>=0);
  const returned=sum(ops,o=>o.returned||0)+D.tasks.filter(t=>t.returnedTo===uid&&tsMonth(t.createdAt)===m).length
    +D.ents.filter(e=>e.month===m&&(e.confReturnedTo===uid||e.followReturnedTo===uid)).length;
  return{
    uid:uid,assigned:assigned.length,assignedDone:assigned.filter(t=>t.completedAt).length,doneBy:doneBy.length,
    late:assigned.filter(t=>t.late||t.lateDone).length,returned:returned,
    avgMs:times.length?sum(times,x=>x)/times.length:null,
    ops:sum(ops,cnt),opsDone:sum(ops.filter(o=>o.status==='تم'),cnt),weight:Math.round(sum(ops,o=>(+o.weight||0)*cnt(o))*10)/10,
    byType:ops.reduce((a,o)=>{a[o.type]=(a[o.type]||0)+cnt(o);return a},{}),opsList:ops
  };
}
const pct=(a,b)=>b?Math.round(a/b*100)+'%':'—';
function fmtDur(ms){if(ms==null)return'—';const h=ms/36e5;return h<48?(Math.round(h*10)/10)+' ساعة':(Math.round(h/24*10)/10)+' يوم'}

/* =====================================================================
   8) Rendering
   ===================================================================== */
function tbl(heads,rows,emptyTitle,emptyText){
  if(!rows.length)return'<div class="empty"><b>'+esc(emptyTitle)+'</b>'+esc(emptyText||'')+'</div>';
  return'<div class="tw"><table><thead><tr>'+heads.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
}
const pill=(t,c)=>'<span class="pill '+(c||'')+'">'+esc(t)+'</span>';
const code=c=>'<a href="#" class="num" data-act="caseFile" data-v="'+esc(c)+'">'+esc(c)+'</a>';
const kpi=(v,l,cls,sub,act)=>'<div class="kpi '+(cls||'')+(act?' click" data-act="go" data-v="'+act:'')+'"><b>'+v+'</b><span>'+l+'</span>'+(sub?'<small>'+sub+'</small>':'')+'</div>';
const fsel=(id,label,list,val,blank)=>'<label>'+label+'<select id="f-'+id+'" data-f="'+id+'">'+opt(list,val,blank)+'</select></label>';
const finput=(id,label,ph)=>'<label>'+label+'<input id="f-'+id+'" data-f="'+id+'" value="'+esc(F[id])+'" placeholder="'+esc(ph||'')+'"></label>';
const W=p=>can(p)?'':' hidden';

const SHELL={
dash:()=>'<div id="dyn"></div>',
mytasks:()=>'<div id="dyn"></div>',
cases:()=>'<div class="bar">'+finput('casesQ','بحث بالكود أو الاسم أو الهاتف','كود، اسم، هاتف')+fsel('casesGov','المحافظة',GOVS,F.casesGov,'الكل')+fsel('casesNat','الجنسية',NATS,F.casesNat,'الكل')+'<span class="grow"></span><button class="btn primary"'+W('case')+' data-act="newCase">+ حالة جديدة</button><button class="btn primary"'+W('decision')+' data-act="newDecision">+ قرار جديد</button></div><div id="dyn"></div>',
decisions:()=>'<div class="bar">'+finput('decQ','بحث بالكود أو الاسم أو الرقم')+fsel('decStatus','حالة القرار',['مستمر','منتهي','موقوف','مسحوب'],F.decStatus,'الكل')+fsel('decSvc','الخدمة',SERVICES.map(s=>s.name),F.decSvc,'الكل')+'<span class="grow"></span><button class="btn primary"'+W('decision')+' data-act="newDecision">+ قرار جديد</button></div><div id="dyn"></div>',
monthly:()=>'<div class="bar"><div class="row" role="group" aria-label="نوع الخدمة">'+['مالي','كارت','عيني'].map(k=>'<button class="btn'+(F.entKind===k?' primary':'')+'" data-act="entKind" data-v="'+k+'">'+k+'</button>').join('')+'</div>'+finput('entQ','بحث','كود أو اسم')+fsel('entStage','المرحلة',Object.keys(STG).map(k=>[k,STG[k][0]]),F.entStage,'الكل')+'<span class="grow"></span><button class="btn"'+W('generate')+' data-act="generate">توليد استحقاقات الشهر</button></div><div id="bulkBar" class="bar"></div><div id="dyn"></div>',
follow:()=>'<div class="bar">'+fsel('fuView','العرض',[['open','متابعات مفتوحة'],['done','مكتملة'],['noans','لم يتم الرد'],['all','الكل']],F.fuView)+fsel('fuKind','النوع',['مالي','كارت','عيني'],F.fuKind,'الكل')+finput('fuQ','بحث','كود أو اسم')+'<span class="muted small">المالي يظهر هنا بعد تسجيل التحويل. مسؤولية الموظف تكتمل بالرد أو بعد 3 محاولات موثقة.</span></div><div id="dyn"></div>',
refunds:()=>'<div class="bar">'+finput('refQ','بحث','كود أو مرجع')+fsel('refStatus','التسوية',['معلقة','تمت التسوية'],F.refStatus,'الكل')+'<span class="muted small">يُسجل الاسترداد من ملف الاستحقاق (زر «استرداد» في دورة الصرف أو المتابعة).</span></div><div id="dyn"></div>',
renewal:()=>'<div class="bar"><div class="row">'+[['soon','تنتهي خلال '+CFG.renewLead+' شهر'],['sent','أُرسلت للتجديد'],['ended','انتهت وتنتظر الإغلاق']].map(v=>'<button class="btn'+(F.renView===v[0]?' primary':'')+'" data-act="renView" data-v="'+v[0]+'">'+v[1]+'</button>').join('')+'</div></div><div id="dyn"></div>',
tasks:()=>'<div class="bar"><div class="row">'+[['mine','مهامي'],['unassigned','غير مسندة'],['open','كل المفتوحة'],['late','المتأخرة'],['stuck','المتعثرة'],['done','المكتملة']].map(v=>'<button class="btn'+(F.taskView===v[0]?' primary':'')+'" data-act="taskView" data-v="'+v[0]+'">'+v[1]+'</button>').join('')+'</div>'+finput('taskQ','بحث','كود أو عنوان')+'<span class="grow"></span><button class="btn primary"'+W('task')+' data-act="newTask">+ مهمة</button></div><div id="assignBar" class="bar"></div><div id="dyn"></div>',
ops:()=>{
  const types=TASKS.map((t,i)=>'<option value="'+i+'">'+esc(t.name)+' · '+esc(t.team)+'</option>').join('');
  return'<div class="card"'+W('op')+' style="margin-bottom:16px"><h3>تسجيل عملية</h3><div class="fgrid"><label>نوع العملية<select id="op-type">'+types+'</select></label><label>تاريخ التنفيذ<input type="date" id="op-date" value="'+todayISO()+'"></label><label id="op-code-l">كود الحالة<input id="op-code" list="caseList" placeholder="كود الحالة"></label><label id="op-dept-l" hidden>الجهة أو الإدارة<input id="op-dept" placeholder="مثال: إدارة الحسابات"></label><label>حالة التنفيذ<select id="op-status"><option>تم</option><option>جاري</option><option>جديد</option></select></label><label>النتيجة<input id="op-result" placeholder="مثال: تم الرد وتأكيد العنوان"></label><label>عدد المرات<input id="op-count" type="number" min="1" value="1"></label><label>مرفق / رابط مستند<input id="op-attach" placeholder="رابط أو رقم مستند" dir="ltr"></label></div><label style="margin-top:12px;display:block"><span class="muted small">ملاحظات</span><textarea id="op-notes"></textarea></label><div class="actions"><span class="muted small" id="op-info"></span><span class="grow"></span><span class="muted small">يُسجَّل اسمك وتاريخ ووقت التسجيل تلقائياً.</span><button class="btn primary" data-act="saveOp">حفظ العملية</button></div></div>'
   +'<div class="bar">'+fsel('opMonth','الشهر',uniq(D.ops.map(o=>(o.date||'').slice(0,7)).filter(Boolean)).sort().reverse().map(m=>[m,fmtMonth(m)]),F.opMonth,'كل الشهور')+fsel('opTeam','الفريق',TEAMS,F.opTeam,'الكل')+fsel('opStatus','الحالة',['جديد','جاري','تم'],F.opStatus,'الكل')+'<label>الموظف<select id="f-opBy" data-f="opBy">'+staffOpts(F.opBy,'الكل')+'</select></label>'+finput('opQ','بحث','نوع أو كود')+'</div><div id="dyn"></div>';
},
reports:()=>'<div class="bar"><div class="row">'+[['month','التقرير الشهري'],['staff','تقارير الموظفين'],['ops','كل العمليات'],['compare','مقارنة الشهور']].map(v=>'<button class="btn'+(F.rptView===v[0]?' primary':'')+'" data-act="rptView" data-v="'+v[0]+'">'+v[1]+'</button>').join('')+'</div></div><div class="bar"><label>الموظف<select id="f-rptStaff" data-f="rptStaff">'+staffOpts(F.rptStaff,'الكل')+'</select></label>'+fsel('rptSvc','نوع الخدمة',SERVICES.map(s=>s.name),F.rptSvc,'الكل')+fsel('rptDec','حالة القرار',['مستمر','منتهي','موقوف','مسحوب'],F.rptDec,'الكل')+fsel('rptGov','المحافظة',GOVS,F.rptGov,'الكل')+fsel('rptNat','الجنسية',NATS,F.rptNat,'الكل')+'<span class="grow"></span><button class="btn" data-act="exportRpt">تصدير CSV</button><button class="btn" data-act="copyRpt">نسخ للإكسل</button>'+(conn.mode==='local'?'<button class="btn" data-act="print">طباعة</button>':'')+'</div><div id="dyn"></div>',
audit:()=>'<div class="bar">'+finput('audQ','بحث','مستخدم، إجراء، كود')+'</div><div id="dyn"></div>',
settings:()=>'<div id="dyn"></div>'
};
const MONTH_TABS=['dash','monthly','follow','reports','renewal','mytasks','refunds'];

function renderTabs(){
  const bad={};
  if(D.vtasks){bad.mytasks=D.vtasks.filter(t=>t.assignee===me.id&&!t.completedAt&&t.status!=='متعثرة').length;bad.tasks=D.vtasks.filter(t=>t.late).length;
    bad.renewal=renewalLists().soon.filter(d=>!d.renewal).length+renewalLists().ended.length;}
  $('#tabs').innerHTML=TABS.filter(t=>t[0]!=='settings'||can('*')||myRole()==='مشرف').map(t=>'<button role="tab" data-act="tab" data-v="'+t[0]+'" aria-selected="'+(tab===t[0])+'">'+t[1]+(bad[t[0]]?'<span class="badge">'+bad[t[0]]+'</span>':'')+'</button>').join('');
}
function render(){
  derive();
  const main=$('#main');
  if(!me.id&&conn.mode==='local'){main.innerHTML=loginView();$('#tabs').innerHTML='';$('#monthBar').hidden=true;return}
  renderTabs();
  if(shellTab!==tab){
    main.innerHTML=SHELL[tab]()+'<datalist id="caseList"></datalist>';
    shellTab=tab;
    if(tab==='ops')bindOpForm();
  }
  const dl=$('#caseList');if(dl)dl.innerHTML=D.cases.slice(0,3000).map(c=>'<option value="'+esc(c.code)+'">'+esc(c.name)+'</option>').join('');
  $('#monthBar').hidden=!MONTH_TABS.includes(tab);
  const dyn=$('#dyn');
  if(dyn)DYN[tab](dyn);
  if(tab==='monthly')renderBulkBar();
  if(tab==='tasks')renderAssignBar();
  $('#roleChip').textContent='الدور: '+myRole();
  resolveNames();
}
let rq=0;
function scheduleRender(){if(rq)return;rq=requestAnimationFrame(()=>{rq=0;render()})}

function loginView(){
  const known=D.staff.filter(s=>s.label).map(s=>s.label);
  return'<div class="login card"><div class="brand-login"><img src="'+esc(($('.brand img')||{}).src||'')+'" alt="مؤسسة مرسال"></div><h2>من يستخدم النظام الآن؟</h2><p class="muted small">في الوضع المحلي يُسجَّل اسمك على كل عملية تقومين بها. البيانات محفوظة في هذا المتصفح فقط.</p><label class="fgrid" style="display:block"><span class="muted small">الاسم</span><input id="lg-name" list="lgList" style="width:100%"><datalist id="lgList">'+known.map(n=>'<option value="'+esc(n)+'">').join('')+'</datalist></label><div class="actions"><button class="btn primary" data-act="login">دخول</button></div></div>';
}

const DYN={};
DYN.dash=function(el){
  const M=metrics(month,{});
  const ren=renewalLists();
  const pendingRef=D.refunds.filter(r=>r.settlement!=='تمت التسوية').length;
  let html='';
  if(!D.cases.length&&Object.keys(loaded).length){
    html+='<div class="empty" style="margin-bottom:16px"><b>لا توجد بيانات بعد</b>ابدئي بإضافة قرار جديد من تبويب «الحالات» (يُنشئ الحالة والقرار معاً)، ثم ولّدي استحقاقات الشهر من «دورة الصرف».'+(conn.mode==='local'?'<div style="margin-top:12px"><button class="btn" data-act="seed">تحميل بيانات تجريبية للتجربة</button></div>':'')+'</div>';
  }
  const alerts=[];
  if(M.stages.needconf)alerts.push(['warn',M.stages.needconf+' حالة جديدة تحتاج مكالمة تأكيد بيانات قبل الإرسال','monthly']);
  if(M.stages.hold)alerts.push(['warn',M.stages.hold+' استحقاق معلّق لأن الشهر السابق لم يُستلم. يحتاج اعتماد المشرف','monthly']);
  if(M.openLateNow)alerts.push(['bad',M.openLateNow+' مهمة متأخرة عن موعدها','tasks']);
  if(ren.soon.filter(d=>!d.renewal).length)alerts.push(['warn',ren.soon.filter(d=>!d.renewal).length+' قرار ينتهي خلال '+CFG.renewLead+' شهر ولم يُرسل للتجديد','renewal']);
  if(ren.ended.length)alerts.push(['bad',ren.ended.length+' قرار انتهت مدته وينتظر الإغلاق','renewal']);
  if(pendingRef)alerts.push(['warn',pendingRef+' استرداد لم تتم تسويته','refunds']);
  if(alerts.length)html+='<div class="alerts">'+alerts.map(a=>'<div class="banner '+a[0]+'"><span>'+esc(a[1])+'</span><button class="btn sm" data-act="go" data-v="'+a[2]+'">فتح</button></div>').join('')+'</div>';
  html+='<div class="sec-title"><h2>مؤشرات التشغيل</h2><span class="muted">'+fmtMonth(month)+' · من سجل العمليات الفعلي</span></div><div class="kpis compact">'
   +kpi(M.opsTotal,'إجمالي العمليات المنفذة','','','ops')+kpi(M.opsDone,'عمليات مكتملة','good')+kpi(M.opsOpen,'عمليات غير مكتملة',M.opsOpen?'warn':'')
   +kpi(M.openLateNow,'مهام متأخرة الآن',M.openLateNow?'bad':'','','tasks')+kpi(M.followOps,'عمليات متابعة')+kpi(M.deliveryOps,'عمليات تسليم')+'</div>';
  html+='<div class="sec-title"><h2>المؤشرات المالية</h2><span class="muted">الكفالات والمساعدات المالية · '+fmtMonth(month)+'</span></div><div class="kpis compact">'
   +kpi(money(M.due),'إجمالي المستحق (جنيه)')+kpi(money(M.transferred),'إجمالي المحوّل')+kpi(M.transferredCases,'حالات تم التحويل لها')
   +kpi(money(M.refunded),'إجمالي المسترد',M.refunded?'warn':'','','refunds')+kpi(money(M.net),'صافي المصروف','good')+kpi(M.notRecvFin,'حالات لم تستلم',M.notRecvFin?'bad':'','','follow')+'</div>';
  html+='<div class="sec-title"><h2>مؤشرات الخدمات</h2></div><div class="kpis compact">'
   +kpi(M.activeCases,'حالات نشطة')+kpi(M.newDecs,'قرارات جديدة')+kpi(M.endingDecs,'قرارات تنتهي هذا الشهر')+kpi(M.stoppedTotal,'قرارات متوقفة','',M.stoppedDecs+' هذا الشهر')+kpi(M.referred,'محالة للتجديد / إعادة البحث','','','renewal')+kpi(M.beneficiaries,'حالات استلمت الخدمة','good')+'</div>';
  const st=Object.keys(STG).filter(k=>M.stages[k]).map(k=>'<tr><td>'+pill(STG[k][0],STG[k][1])+'</td><td class="n">'+M.stages[k]+'</td></tr>').join('');
  const svcRows=Object.keys(M.bySvc).map(n=>{const b=M.bySvc[n];return'<tr><td>'+esc(n)+'</td><td class="n">'+b.n+'</td><td class="n">'+b.sent+'</td><td class="n">'+b.done+'</td><td class="n">'+b.open+'</td><td class="n">'+money(b.amount)+'</td></tr>'});
  html+='<div class="grid2" style="margin-top:8px"><div class="card"><h3>الخدمات المنفذة حسب النوع</h3>'+tbl(['الخدمة','الاستحقاقات','أُرسل','اكتمل للمستفيد','مفتوح','القيمة'],svcRows,'لا استحقاقات لهذا الشهر','ولّدي استحقاقات الشهر من «دورة الصرف».')+'</div>'
   +'<div class="card"><h3>موقف الاستحقاقات حسب المرحلة</h3>'+(st?'<div class="tw" style="border:0"><table style="min-width:0"><tbody>'+st+'</tbody></table></div>':'<p class="muted small">لا توجد استحقاقات.</p>')+'</div></div>';
  html+='<div class="sec-title"><h2>مؤشرات الموظفين</h2><span class="muted">المسند = مهام أُسندت للموظف · المنفذ = ما نفّذه فعلياً بنفسه</span></div>'+staffTable(month,{});
  html+='<div class="grid2" style="margin-top:16px">'+trendCard('صافي المصروف آخر 6 شهور',month,m=>metrics(m,{}).net,true)+trendCard('العمليات المنفذة آخر 6 شهور',month,m=>metrics(m,{}).opsTotal)+'</div>';
  el.innerHTML=html;
};
function staffTable(m,f){
  const ids=staffIds();
  const rows=ids.map(u=>staffStats(m,u,f)).filter(s=>s.assigned||s.doneBy||s.ops).sort((a,b)=>b.weight-a.weight);
  const maxW=Math.max(1,...rows.map(r=>r.weight));
  return tbl(['الموظف','مهام مسندة','المسند المكتمل','نسبة الإنجاز','نفّذ بنفسه','العمليات','نسبة العمليات المكتملة','متوسط زمن التنفيذ','متأخرة','أُرجعت للتصحيح','الإنتاجية (بالأوزان)'],
    rows.map(r=>'<tr><td><a href="#" data-act="staffRpt" data-v="'+esc(r.uid)+'">'+esc(nameOf(r.uid))+'</a></td><td class="n">'+r.assigned+'</td><td class="n">'+r.assignedDone+'</td><td class="n">'+pct(r.assignedDone,r.assigned)+'</td><td class="n">'+r.doneBy+'</td><td class="n">'+r.ops+'</td><td class="n">'+pct(r.opsDone,r.ops)+'</td><td class="n">'+fmtDur(r.avgMs)+'</td><td class="n">'+(r.late?'<span class="pill bad">'+r.late+'</span>':'0')+'</td><td class="n">'+(r.returned?'<span class="pill warn">'+r.returned+'</span>':'0')+'</td><td><div class="bars"><div class="b" style="grid-template-columns:1fr 44px"><div class="t"><i style="width:'+Math.round(r.weight/maxW*100)+'%"></i></div><span class="n">'+r.weight+'</span></div></div></td></tr>'),
    'لا يوجد نشاط للموظفين في '+fmtMonth(m),'يظهر هنا كل موظف أُسندت له مهمة أو سجّل عملية.');
}
function trendCard(title,m,fn,isMoney){
  const ms=[];for(let i=5;i>=0;i--)ms.push(addMonths(m,-i));
  const vals=ms.map(fn);const max=Math.max(1,...vals);
  return'<div class="card"><h3>'+esc(title)+'</h3><div class="trend" style="--n:6">'+ms.map((x,i)=>'<div class="'+(x===m?'cur':'')+'"><b>'+(isMoney?money(vals[i]):vals[i])+'</b><i style="height:'+Math.round(vals[i]/max*80)+'%"></i><span>'+MN[+x.split('-')[1]-1].slice(0,6)+'</span></div>').join('')+'</div></div>';
}

DYN.mytasks=function(el){
  const mine=D.vtasks.filter(t=>t.assignee===me.id);
  const open=mine.filter(t=>!t.completedAt).sort((a,b)=>(b.late-a.late)||(a.due-b.due));
  const st=staffStats(month,me.id,{});
  let html='<div class="kpis compact">'+kpi(open.length,'مهام مفتوحة لي')+kpi(open.filter(t=>t.late).length,'متأخرة',open.filter(t=>t.late).length?'bad':'')
    +kpi(st.doneBy,'نفّذتها في '+fmtMonth(month),'good')+kpi(st.ops,'عملياتي المسجلة')+kpi(fmtDur(st.avgMs),'متوسط زمن التنفيذ')+kpi(st.returned,'أُرجعت للتصحيح',st.returned?'warn':'')+'</div>';
  const unassigned=D.vtasks.filter(t=>!t.assignee&&!t.completedAt);
  if(unassigned.length)html+='<div class="banner"><span>'+unassigned.length+' مهمة غير مسندة لأحد. يمكنك تنفيذها مباشرة أو يسندها المشرف.</span><button class="btn sm" data-act="go" data-v="tasks" data-t="unassigned">عرض</button></div>';
  html+='<div class="sec-title"><h2>مطلوب مني</h2></div>'+taskTable(open,false,'لا توجد مهام مفتوحة لك','المهام تُنشأ تلقائياً من دورة الصرف أو يُسندها المشرف.');
  const done=mine.filter(t=>t.completedAt).sort((a,b)=>b.completedAt-a.completedAt).slice(0,30);
  html+='<div class="sec-title"><h2>آخر ما أنجزته</h2></div>'+taskTable(done,false,'لا يوجد','');
  el.innerHTML=html;
};
function taskTable(list,selectable,emptyT,emptyX){
  const kindName={confirm:'تأكيد بيانات',follow:'متابعة صرف',action:'معالجة',manual:'يدوية'};
  return tbl((selectable?['<input type="checkbox" data-tselall aria-label="تحديد الكل">']:[]).concat(['المهمة','الحالة','مسندة إلى','أُنشئت','الموعد النهائي','حالة المهمة','نفّذها','النتيجة','']),
    list.slice(0,500).map(t=>'<tr class="'+(t.late?'late':'')+'">'+(selectable?'<td><input type="checkbox" data-tsel="'+esc(t.id)+'"'+(SEL.has(t.id)?' checked':'')+' aria-label="تحديد"></td>':'')
      +'<td>'+esc(t.title)+'<div class="small muted">'+kindName[t.kind]+(t.month?' · '+fmtMonth(t.month):'')+'</div></td><td>'+(t.code?code(t.code)+'<div class="small muted">'+esc(caseName(t.code))+'</div>':'—')+'</td>'
      +'<td>'+(t.assignee?esc(nameOf(t.assignee)):'<span class="pill warn">غير مسندة</span>')+'</td><td class="n small">'+fmtTs(t.createdAt)+'</td><td class="n small">'+fmtTs(t.due)+'</td>'
      +'<td>'+pill(t.shown,t.shown==='مكتملة'?'good':(t.shown==='متأخرة'||t.shown==='متعثرة'?'bad':(t.shown==='قيد التنفيذ'?'info':'')))+(t.lateDone?'<div class="small muted">أُنجزت بعد الموعد</div>':'')+(t.returned?'<div class="small"><span class="pill warn">أُرجعت ×'+t.returned+'</span></div>':'')+'</td>'
      +'<td>'+(t.completedBy?esc(nameOf(t.completedBy))+(t.assignee&&t.completedBy!==t.assignee?'<div class="small muted">ليس المسند إليه</div>':''):'—')+'</td><td class="small">'+esc(t.result||'')+'</td>'
      +'<td><button class="btn sm" data-act="openTask" data-v="'+esc(t.id)+'">'+(t.completedAt?'عرض':'تنفيذ')+'</button></td></tr>'),emptyT,emptyX);
}

DYN.cases=function(el){
  const q=F.casesQ.trim();
  const list=D.cases.filter(c=>(!q||String(c.code).includes(q)||(c.name||'').includes(q)||(c.phone||'').includes(q)||(c.recvPhone||'').includes(q))&&(!F.casesGov||c.governorate===F.casesGov)&&(!F.casesNat||c.nationality===F.casesNat)).sort((a,b)=>numSort(a.code,b.code));
  const rows=list.slice(0,400).map(c=>{
    const ds=D.decByCode[c.code]||[];
    const missing=['phone','recvMethod','governorate'].filter(f=>!c[f]).length;
    return'<tr><td>'+code(c.code)+'</td><td>'+esc(c.name)+'</td><td>'+esc(c.nationality||'—')+'</td><td>'+esc(c.governorate||'—')+'</td><td class="n"><span class="num">'+esc(c.phone||'—')+'</span></td><td>'+esc(c.recvMethod||'—')+'</td><td class="n">'+ds.filter(d=>decStatus(d)==='مستمر').length+' / '+ds.length+'</td><td>'+(c.dataConfirmed?pill('مؤكدة','good'):pill(missing?'بيانات ناقصة':'غير مؤكدة','warn'))+'</td><td><button class="btn sm" data-act="caseFile" data-v="'+esc(c.code)+'">ملف الحالة</button></td></tr>';
  });
  el.innerHTML='<p class="muted small">'+list.length+' حالة'+(list.length>400?' · يُعرض أول 400، استخدمي البحث':'')+'</p>'+tbl(['الكود','الاسم','الجنسية','المحافظة','هاتف','طريقة الاستلام','قرارات (مستمرة / كلها)','البيانات',''],rows,D.cases.length?'لا نتائج':'لا توجد حالات بعد',D.cases.length?'جربي بحثاً آخر.':'اضغطي «قرار جديد» لتسجيل الحالة وقرارها معاً.');
};
function openCaseForm(c){
  const v=c||{};
  const f=(id,label,val,extra)=>'<label>'+label+'<input id="c-'+id+'" value="'+esc(val||'')+'"'+(extra||'')+'></label>';
  openModal('<h2>'+(c?'تعديل بيانات الحالة':'حالة جديدة')+'</h2><p class="muted small">'+(c?'كل تعديل يُحفظ في سجل التعديلات بالقيمة القديمة والجديدة واسمك وتاريخ التعديل. لا يؤثر على العمليات السابقة.':'الكود لا يتكرر. يمكن استكمال باقي البيانات لاحقاً.')+'</p>'
   +'<h3 style="margin:8px 0">البيانات الأساسية</h3><div class="fgrid">'
   +f('code','كود الحالة *',v.code,(c?' disabled':'')+' inputmode="numeric"')+f('name','اسم الحالة *',v.name)
   +'<label>تاريخ الميلاد<input type="date" id="c-birth" value="'+esc(v.birth||'')+'"></label>'
   +'<label>النوع<select id="c-gender">'+opt(['ذكر','أنثى'],v.gender,'—')+'</select></label>'
   +'<label>الجنسية<select id="c-nationality">'+opt(NATS,v.nationality,'—')+'</select></label>'
   +'<label>عدد الأفراد<input type="number" min="1" id="c-familySize" value="'+esc(v.familySize||'')+'"></label>'
   +'<label>المحافظة<select id="c-governorate">'+opt(GOVS,v.governorate,'—')+'</select></label>'
   +f('address','العنوان',v.address)+f('unhcr','رقم المفوضية',v.unhcr,' dir="ltr"')+'</div>'
   +'<h3 style="margin:14px 0 8px">بيانات التواصل والاستلام</h3><div class="fgrid">'
   +f('phone','هاتف',v.phone,' inputmode="tel" dir="ltr"')+f('phone2','هاتف بديل',v.phone2,' inputmode="tel" dir="ltr"')
   +'<label>طريقة الاستلام<select id="c-recvMethod">'+opt(RECV_METHODS,v.recvMethod,'—')+'</select></label>'
   +f('recvName','اسم المستلم',v.recvName)+f('recvPhone','رقم الاستلام / المحفظة',v.recvPhone,' dir="ltr"')+f('recvId','الرقم القومي / إثبات الشخصية',v.recvId,' dir="ltr"')+f('recvBranch','الفرع / مكتب البريد',v.recvBranch)+'</div>'
   +'<label style="display:block;margin-top:10px"><span class="muted small">ملاحظات</span><textarea id="c-notes">'+esc(v.notes||'')+'</textarea></label>'
   +'<div class="actions"><button class="btn primary" data-act="saveCase" data-v="'+esc(v.code||'')+'">حفظ</button><button class="btn" data-act="closeModal">إلغاء</button></div>');
}
async function saveCase(editing){
  const g=id=>{const el=$('#c-'+id);return el?el.value.trim():''};
  const cd=editing||g('code');
  if(!cd)return toast('اكتبي كود الحالة.');
  if(!g('name'))return toast('اكتبي اسم الحالة.');
  if(!editing&&S.cases[cd])return toast('هذا الكود مسجل من قبل. افتحي ملف الحالة وعدّلي بياناتها.');
  const patch={};CASE_FIELDS.forEach(([f])=>patch[f]=g(f));
  const dupPhone=patch.phone&&D.cases.find(x=>x.code!==cd&&x.phone===patch.phone);
  const ok=await guard('case',async()=>{
    if(editing){const n=await writeCaseChanges(cd,patch,'تعديل بيانات');if(n){await logOp('تحديث بيانات حالة',{code:cd,result:n+' حقل'});await logAudit('تعديل حالة',cd,n+' حقل')}}
    else{
      const data=Object.assign({id:cd,code:cd},patch,{familySize:+patch.familySize||0,createdAt:Date.now(),createdBy:me.id});
      await setDoc('cases',cd,data);await logAudit('تسجيل حالة',cd,data.name);
    }
  });
  if(ok){closeModal();toast('تم حفظ الحالة.'+(dupPhone?' تنبيه: نفس رقم الهاتف مسجل للحالة '+dupPhone.code+'.':''));if(editing)openCaseFile(cd)}
}
function openCaseFile(cd){
  const c=S.cases[cd];if(!c)return toast('الكود '+cd+' غير مسجل.');
  const ds=(D.decByCode[cd]||[]).slice().sort((a,b)=>(b.issueDate||'').localeCompare(a.issueDate||''));
  const ents=(D.entsByCode[cd]||[]).slice().sort((a,b)=>b.month.localeCompare(a.month));
  const ops=D.ops.filter(o=>o.code===cd).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const chg=D.changes.filter(x=>x.code===cd);
  const refs=D.refunds.filter(r=>r.code===cd);
  const totalTr=sum(ents,trAmount),totalRef=sum(refs,r=>r.amount);
  const kv=(l,v)=>'<div><span>'+l+'</span>'+(v||'—')+'</div>';
  const dec=ds.map(d=>'<div class="lrow"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><b>قرار '+esc(d.no||'')+'</b>'+pill(decKind(d),decKind(d)==='جديد'?'pri':'info')+pill(decStatus(d),decStatus(d)==='مستمر'?'good':(decStatus(d)==='منتهي'?'':'bad'))+'<span class="muted small">'+fmtDate(d.issueDate)+'</span>'+(d.renewal?pill(d.renewal.status,'info'):'')+'</div>'+(d.text?'<div class="small" style="margin:6px 0">'+esc(d.text)+'</div>':'')+(D.linesByDec[d.id]||[]).map(l=>'<div class="small">• '+esc(l.service)+' · '+money(l.amount)+' ج · '+fmtMonth(l.startMonth)+' ← '+fmtMonth(l.endMonth)+(l.extendedBy?' (مُدد '+l.extendedBy+')':'')+'</div>').join('')+(d.stopReason?'<div class="small muted">السبب: '+esc(d.stopReason)+'</div>':'')+'</div>').join('');
  const entRows=ents.map(e=>'<tr><td>'+fmtMonth(e.month)+'</td><td>'+esc(e.service)+'</td><td class="n">'+money(e.amount)+'</td><td>'+stagePill(e)+'</td><td class="small">'+(e.transfer?esc(e.transfer.method)+' · '+fmtDate(e.transfer.date)+' · <span class="num">'+esc(e.transfer.ref)+'</span>':(trAmount(e)?'محوّل (نظام سابق)':'—'))+'</td><td class="n">'+(refundSum(e)?money(refundSum(e)):'—')+'</td><td class="n">'+attemptsOf(e).length+'/3</td><td><button class="btn sm" data-act="entFile" data-v="'+esc(e.id)+'">تفاصيل</button></td></tr>');
  const opRows=ops.slice(0,100).map(o=>'<tr><td class="n small">'+fmtDate(o.date)+'</td><td>'+esc(o.type)+(o.result?'<div class="small muted">'+esc(o.result)+'</div>':'')+'</td><td>'+esc(nameOf(o.by))+'</td><td class="n small">'+fmtTs(o.createdAt)+'</td><td>'+pill(o.status,o.status==='تم'?'good':'')+'</td></tr>');
  const chgHtml=chg.map(x=>'<div class="chg"><b>'+fmtTs(x.ts)+' · '+esc(nameOf(x.by))+' · '+esc(x.source||'')+'</b><br>'+x.diffs.map(d=>esc(d.label)+': <del>'+esc(d.old||'فارغ')+'</del> ← <ins>'+esc(d.new||'فارغ')+'</ins>').join(' · ')+'</div>').join('');
  openModal('<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center"><h2>'+esc(c.name)+' <span class="muted num" style="font-size:15px">'+esc(c.code)+'</span> '+(c.dataConfirmed?pill('بيانات مؤكدة','good'):pill('بيانات غير مؤكدة','warn'))+'</h2><span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm"'+W('case')+' data-act="editCase" data-v="'+esc(cd)+'">تعديل البيانات</button><button class="btn sm primary"'+W('decision')+' data-act="newDecisionFor" data-v="'+esc(cd)+'">+ قرار</button><button class="btn sm"'+W('op')+' data-act="opFor" data-v="'+esc(cd)+'">+ عملية</button><button class="btn sm" data-act="closeModal">إغلاق</button></span></div>'
   +'<div class="kv" style="margin:10px 0 14px">'+kv('الجنسية',esc(c.nationality))+kv('النوع',esc(c.gender))+kv('الميلاد',c.birth?fmtDate(c.birth)+' ('+(new Date().getFullYear()-+c.birth.slice(0,4))+' سنة)':'')+kv('عدد الأفراد',c.familySize||'')+kv('المحافظة',esc(c.governorate))+kv('العنوان',esc(c.address))
   +kv('هاتف','<span class="num">'+esc(c.phone||'—')+'</span>'+(c.phone2?' / <span class="num">'+esc(c.phone2)+'</span>':''))+kv('رقم المفوضية','<span class="num">'+esc(c.unhcr||'—')+'</span>')+kv('طريقة الاستلام',esc(c.recvMethod))+kv('المستلم',esc(c.recvName))+kv('رقم الاستلام','<span class="num">'+esc(c.recvPhone||'—')+'</span>')+kv('إثبات الشخصية','<span class="num">'+esc(c.recvId||'—')+'</span>')+'</div>'
   +'<div class="kpis compact">'+kpi(ds.filter(d=>decStatus(d)==='مستمر').length,'قرارات مستمرة')+kpi(ents.length,'استحقاقات')+kpi(money(totalTr),'إجمالي المحوّل')+kpi(money(totalRef),'المسترد')+kpi(money(totalTr-totalRef),'صافي المصروف','good')+kpi(ops.length,'عمليات')+'</div>'
   +'<h3 style="margin:6px 0 8px">القرارات</h3>'+(dec||'<p class="muted small">لا توجد قرارات.</p>')
   +'<h3 style="margin:14px 0 8px">الاستحقاقات والصرف</h3>'+tbl(['الشهر','الخدمة','القيمة','الموقف','التحويل','مسترد','المتابعة',''],entRows,'لا توجد استحقاقات','')
   +'<h3 style="margin:14px 0 8px">العمليات على الحالة</h3>'+tbl(['تاريخ التنفيذ','العملية','المنفذ','وقت التسجيل','الحالة'],opRows,'لا توجد عمليات','')
   +'<h3 style="margin:14px 0 8px">سجل تعديل البيانات</h3>'+(chgHtml||'<p class="muted small">لم تُعدل البيانات منذ التسجيل.</p>'));
}

/* ---------- decision form (quick add: code + name + service + duration + start/end) ---------- */
let DF=null;
function newLine(start){return{service:SERVICES[0].name,amount:'',months:6,start:start||'',end:start?addMonths(start,5):'',note:'',tS:false,tE:false}}
function openDecisionForm(opts){
  opts=opts||{};
  const issue=todayISO(),st=suggestStart(issue);
  DF={code:opts.code||'',name:'',text:opts.text||'',donor:opts.donor||'',no:'',issue:issue,renew:!!opts.renew,from:opts.from||'',override:'',lines:[]};
  if(opts.lines&&opts.lines.length){
    const base=opts.startAfter?addMonths(opts.startAfter,1):st;
    DF.lines=opts.lines.map(l=>({service:l.service,amount:l.amount,months:l.months,start:base,end:addMonths(base,l.months-1),note:'',tS:!!opts.startAfter,tE:false}));
  }else DF.lines=[newLine(st)];
  drawDF();
}
function drawDF(){
  const c=S.cases[DF.code];
  openModal('<h2>'+(DF.renew?'تجديد قرار':'قرار جديد')+'</h2><p class="muted small">إذا كان الكود جديداً تُنشأ الحالة تلقائياً بالاسم، وتُستكمل باقي بياناتها لاحقاً من ملف الحالة.</p><div class="fgrid">'
   +'<label>كود الحالة *<input id="df-code" list="caseList" value="'+esc(DF.code)+'" inputmode="numeric"></label>'
   +'<label>اسم الحالة *<input id="df-name" value="'+esc(c?c.name:DF.name)+'"'+(c?' disabled':'')+'></label>'
   +'<label>تاريخ القرار<input type="date" id="df-issue" value="'+esc(DF.issue)+'"></label>'
   +'<label>رقم القرار<input id="df-no" value="'+esc(DF.no)+'" placeholder="تلقائي إذا تُرك فارغاً"></label>'
   +'<label>المتبرع<input id="df-donor" value="'+esc(DF.donor)+'"></label></div>'
   +'<p class="note small" id="df-sug" style="margin:12px 0"></p>'
   +'<label style="display:block;margin-bottom:12px"><span class="muted small">نص القرار (اختياري)</span><textarea id="df-text">'+esc(DF.text)+'</textarea></label>'
   +'<h3 style="margin-bottom:8px">الخدمات في القرار</h3><div id="df-lines"></div>'
   +'<button class="btn sm" data-act="addLine">+ إضافة خدمة</button><div id="df-ov"></div>'
   +'<div class="actions"><button class="btn primary" data-act="saveDecision">حفظ القرار</button><button class="btn" data-act="closeModal">إلغاء</button></div>');
  drawLines();
}
function drawLines(){
  const sug=suggestStart(DF.issue);
  $('#df-sug').textContent=DF.issue?'بداية الصرف المقترحة من تاريخ القرار: '+fmtMonth(sug)+' (دورة 19 إلى 18). لا يُنشأ أي استحقاق بعد شهر النهاية.':'';
  $('#df-lines').innerHTML=DF.lines.map((l,i)=>{
    const n=(l.start&&l.end)?spanMonths(l.start,l.end):0,mis=n!==+l.months,s=svc(l.service);
    const ov=DF.code&&l.start&&l.end?overlap(DF.code,l.service,l.start,l.end,null):null;
    return'<div class="lrow" data-i="'+i+'"><div class="fgrid">'
     +'<label>نوع الخدمة<select data-lf="service">'+opt(SERVICES.map(x=>x.name),l.service)+'</select></label>'
     +'<label>'+(s.kind==='مالي'?'القيمة الشهرية (جنيه)':'القيمة / التكلفة (جنيه)')+'<input type="number" min="0" data-lf="amount" value="'+esc(l.amount)+'"></label>'
     +'<label>مدة القرار (شهر)<input type="number" min="1" data-lf="months" value="'+esc(l.months)+'"></label>'
     +'<label>تاريخ البداية<select data-lf="start">'+monthOpts(l.start)+'</select></label>'
     +'<label>تاريخ النهاية<select data-lf="end">'+monthOpts(l.end)+'</select></label></div>'
     +(mis?'<div class="warnline">المدة المكتوبة '+l.months+' شهر والمحسوبة من التواريخ '+n+' شهر. اكتبي ملاحظة توضح السبب.</div><textarea data-lf="note" placeholder="سبب الاختلاف">'+esc(l.note)+'</textarea>':'<div class="okline">'+n+' شهر · '+esc(s.kind)+' · '+esc(s.cycle)+'</div>')
     +(ov?'<div class="warnline">تعارض: للحالة «'+esc(l.service)+'» ساري في قرار '+esc(ov.dec.no||'')+' ('+fmtMonth(ov.line.startMonth)+' ← '+fmtMonth(ov.line.endMonth)+').</div>':'')
     +'<div style="margin-top:8px"><button class="btn sm bad" data-act="rmLine" data-v="'+i+'">حذف</button></div></div>';
  }).join('');
  const anyOv=DF.code&&DF.lines.some(l=>l.start&&l.end&&overlap(DF.code,l.service,l.start,l.end,null));
  $('#df-ov').innerHTML=anyOv?(can('decision.override')?'<label style="display:block;margin-top:12px"><span class="muted small">مراجعة التعارض (مشرف): سبب اعتماد قرار متداخل</span><input id="df-override" style="width:100%" value="'+esc(DF.override)+'" placeholder="مثال: زيادة قيمة الكفالة بقرار لجنة"></label>':'<div class="banner bad">يوجد تعارض مع قرار ساري. أوقفي القرار القديم أولاً أو اطلبي مراجعة المشرف.</div>'):'';
}
function onLineChange(i,f,v){
  const l=DF.lines[i];
  if(f==='service'){l.service=v;if(svc(v).cycle==='مرة واحدة'){l.months=1;l.end=l.start}}
  else if(f==='amount'){l.amount=v;return}
  else if(f==='note'){l.note=v;return}
  else if(f==='months'){l.months=Math.max(1,+v||1);if(!l.tE&&l.start)l.end=addMonths(l.start,l.months-1)}
  else if(f==='start'){l.start=v;l.tS=true;if(!l.tE)l.end=addMonths(v,l.months-1)}
  else if(f==='end'){l.end=v;l.tE=true}
  clearTimeout(onLineChange.t);onLineChange.t=setTimeout(()=>{if(DF&&$('#df-lines'))drawLines()},0);
}
function nextDecNo(){
  const yy=todayISO().slice(2,4);let max=0;
  D.decs.forEach(d=>{const m=String(d.no||'').match(/(\d+)$/);if(m)max=Math.max(max,+m[1])});
  return'ق-'+pad(max+1);
}
async function saveDecision(){
  const g=id=>{const el=$('#'+id);return el?el.value.trim():''};
  DF.code=g('df-code');DF.text=g('df-text');DF.donor=g('df-donor');DF.issue=g('df-issue');DF.no=g('df-no');DF.override=g('df-override');
  const exists=!!S.cases[DF.code];const name=exists?S.cases[DF.code].name:g('df-name');
  if(!DF.code)return toast('اكتبي كود الحالة.');
  if(!exists&&!name)return toast('الكود جديد: اكتبي اسم الحالة لتسجيلها.');
  if(!DF.issue)return toast('اختاري تاريخ القرار.');
  if(!DF.lines.length)return toast('أضيفي خدمة واحدة على الأقل.');
  if(DF.no&&D.decs.some(d=>d.no===DF.no))return toast('رقم القرار '+DF.no+' مسجل من قبل.');
  const cleaned=[];
  for(let i=0;i<DF.lines.length;i++){
    const l=DF.lines[i];const n=spanMonths(l.start,l.end);
    if(!l.start||!l.end||n<1)return toast('الخدمة '+(i+1)+': تاريخ النهاية قبل البداية.');
    if(l.amount===''||isNaN(+l.amount))return toast('الخدمة '+(i+1)+': اكتبي القيمة (0 إذا لم تكن مالية).');
    if(n!==+l.months&&!l.note.trim())return toast('الخدمة '+(i+1)+': المدة تخالف التواريخ. اكتبي ملاحظة.');
    const ov=overlap(DF.code,l.service,l.start,l.end,null);
    if(ov&&!(can('decision.override')&&DF.override))return toast('الخدمة '+(i+1)+': تتعارض مع قرار '+(ov.dec.no||'')+'. أوقفيه أولاً أو اطلبي مراجعة المشرف.');
    if(DF.lines.some((x,j)=>j<i&&x.service===l.service&&!(l.end<x.start||l.start>x.end)))return toast('الخدمة '+(i+1)+' مكررة في نفس القرار.');
    cleaned.push(l);
  }
  const id=newId('d');const no=DF.no||nextDecNo();const savedCode0=DF.code;
  const ok=await guard('decision',async()=>{
    if(!exists){await setDoc('cases',DF.code,{id:DF.code,code:DF.code,name:name,createdAt:Date.now(),createdBy:me.id});await logAudit('تسجيل حالة',DF.code,name)}
    await setDoc('decisions',id,{id:id,no:no,code:DF.code,text:DF.text,donor:DF.donor,issueDate:DF.issue,status:'مستمر',renewOf:DF.from||'',override:DF.override||'',createdAt:Date.now(),createdBy:me.id});
    for(let i=0;i<cleaned.length;i++){
      const l=cleaned[i];const lid=id+'_'+(i+1);
      await setDoc('lines',lid,{id:lid,decId:id,code:DF.code,service:l.service,amount:+l.amount,months:+l.months,startMonth:l.start,endMonth:l.end,mismatchNote:l.note.trim()});
    }
    if(DF.from&&S.decisions[DF.from])await updDoc('decisions',DF.from,{renewal:Object.assign({},S.decisions[DF.from].renewal||{},{status:'تم التجديد',doneAt:Date.now(),doneBy:me.id,newDec:id})});
    await logOp('تسجيل قرار',{code:DF.code,result:no+' · '+cleaned.map(l=>l.service).join('، ')});
    await logAudit(DF.renew?'تجديد قرار':'قرار جديد',DF.code,no+' · '+cleaned.length+' خدمة'+(DF.override?' · اعتماد تعارض: '+DF.override:''));
  });
  const savedCode=savedCode0;
  if(ok){closeModal();toast('تم حفظ القرار '+no+(exists?'':' وتسجيل الحالة '+savedCode)+'.')}
}
function openStopForm(ids,status,label){
  openModal('<h2>'+label+'</h2><div class="fgrid"><label>الإجراء<select id="st-status">'+opt(['موقوف','مسحوب','منتهي'],status)+'</select></label></div><label style="display:block;margin-top:10px"><span class="muted small">السبب *</span><input id="st-reason" style="width:100%" placeholder="مثال: انتهاء المدة، عدم الرد لشهرين، سحب القرار"></label><p class="muted small">الاستحقاقات غير المرسلة من هذا الشهر وما بعده تتوقف تلقائياً. السجل التاريخي لا يُحذف.</p><div class="actions"><button class="btn primary" data-act="doStop" data-ids="'+ids.join(',')+'">تأكيد</button><button class="btn" data-act="closeModal">إلغاء</button></div>');
}

DYN.decisions=function(el){
  const q=F.decQ.trim();
  const list=D.decs.filter(d=>(!F.decStatus||decStatus(d)===F.decStatus)&&(!F.decSvc||(D.linesByDec[d.id]||[]).some(l=>l.service===F.decSvc))&&(!q||String(d.code).includes(q)||caseName(d.code).includes(q)||String(d.no||'').includes(q))).sort((a,b)=>(b.issueDate||'').localeCompare(a.issueDate||''));
  const rows=list.slice(0,400).map(d=>{
    const ls=(D.linesByDec[d.id]||[]).map(l=>'<div class="small">'+esc(l.service)+' · '+money(l.amount)+' ج · '+fmtMonth(l.startMonth)+' ← '+fmtMonth(l.endMonth)+' ('+spanMonths(l.startMonth,l.endMonth)+' شهر)</div>').join('');
    const st=decStatus(d);const end=decEnd(d);const left=end?toIdx(end)-toIdx(curMonth)+1:0;
    return'<tr><td class="n">'+esc(d.no||'')+'</td><td>'+code(d.code)+'<div class="small muted">'+esc(caseName(d.code))+'</div></td><td>'+pill(decKind(d),decKind(d)==='جديد'?'pri':'info')+'</td><td class="n">'+fmtDate(d.issueDate)+'<div class="small muted">سُجل: '+esc(nameOf(d.createdBy))+'</div></td><td>'+ls+'</td><td>'+fmtMonth(end)+(st==='مستمر'&&left>0&&left<=CFG.renewLead+1?'<div class="small"><span class="pill warn">متبقي '+left+' شهر</span></div>':'')+'</td><td>'+pill(st,st==='مستمر'?'good':(st==='منتهي'?'':'bad'))+(d.stopReason?'<div class="small muted">'+esc(d.stopReason)+'</div>':'')+(d.renewal?'<div class="small">'+pill(d.renewal.status,'info')+'</div>':'')+'</td><td style="white-space:nowrap"><button class="btn sm"'+W('decision')+' data-act="renew" data-v="'+d.id+'">تجديد</button> '+(d.status==='مستمر'?'<button class="btn sm bad"'+W('decision.stop')+' data-act="stopOne" data-v="'+d.id+'">إيقاف / سحب</button>':'')+'</td></tr>';
  });
  el.innerHTML=tbl(['رقم','الحالة','النوع','تاريخ القرار','الخدمات','النهاية','حالة القرار',''],rows,D.decs.length?'لا نتائج':'لا توجد قرارات بعد','أضيفي قراراً من زر «قرار جديد».');
};

/* ---------- monthly payment cycle ---------- */
function stepsLine(e){
  const s=svc(e.service);const k=stageOf(e);
  const steps=[];
  if(e.needsConfirm)steps.push(['تأكيد',!!e.confirmedAt]);
  steps.push([s.kind==='عيني'?'تسليم':'إرسال',!!e.sent]);
  if(s.kind==='مالي')steps.push(['تحويل',isTransferred(e)]);
  if(needsFollow(e))steps.push(['متابعة',followDone(e)]);
  const bad=['noans','notpaid','stuck','refund'].includes(k);
  let curSet=false;
  return'<div class="steps-line">'+steps.map(st=>{let c='';if(st[1])c='on';else if(!curSet){c=bad?'x':'cur';curSet=true}return'<span class="'+c+'">'+st[0]+'</span>'}).join('')+'</div>';
}
function entActions(e){
  const k=stageOf(e);const b=[];const s=svc(e.service);
  if(k==='needconf')b.push('<button class="btn sm"'+W('confirm')+' data-act="confirm" data-v="'+e.id+'">مكالمة تأكيد</button>');
  if(k==='hold')b.push('<button class="btn sm"'+W('approve')+' data-act="approve" data-v="'+e.id+'">اعتماد الإدراج</button>');
  if(s.kind==='مالي'&&e.sent&&!e.transfer&&e.v2&&!e.stopped)b.push('<button class="btn sm"'+W('transfer')+' data-act="transfer" data-v="'+e.id+'">تسجيل التحويل</button>');
  if(trAmount(e)>refundSum(e)&&!e.stopped)b.push('<button class="btn sm"'+W('refund')+' data-act="refund" data-v="'+e.id+'">استرداد</button>');
  b.push('<button class="btn sm" data-act="entFile" data-v="'+e.id+'">تفاصيل</button>');
  return b.join(' ');
}
DYN.monthly=function(el){
  const q=F.entQ.trim();
  const all=entsOf(month).filter(e=>(e.kind||svc(e.service).kind)===F.entKind||svc(e.service).kind===F.entKind);
  const list=all.filter(e=>(!F.entStage||stageOf(e)===F.entStage)&&(!q||String(e.code).includes(q)||caseName(e.code).includes(q))).sort((a,b)=>numSort(a.code,b.code));
  const allSel=list.length&&list.every(e=>SEL.has(e.id));
  const cnt={};all.forEach(e=>{const k=stageOf(e);cnt[k]=(cnt[k]||0)+1});
  const rows=list.slice(0,600).map(e=>{
    const car=(e.carried||[]).length?'<div class="small"><span class="pill warn">شامل متأخر '+e.carried.map(fmtMonth).join('، ')+'</span></div>':(e.carriedFrom?'<div class="small"><span class="pill warn">+'+money(e.carriedFrom.amount)+' مرحّل من '+fmtMonth(e.carriedFrom.month)+'</span></div>':'');
    return'<tr><td><input type="checkbox" data-sel="'+e.id+'" aria-label="تحديد"'+(SEL.has(e.id)?' checked':'')+'></td><td>'+code(e.code)+'<div class="small muted">'+esc(caseName(e.code))+'</div></td><td>'+esc(e.service)+'</td><td class="n">'+money(e.amount)+' ج'+car+'</td><td>'+stagePill(e)+stepsLine(e)+'</td><td class="small">'+(e.sentAt?fmtTs(e.sentAt)+'<div class="muted">'+esc(nameOf(e.sentBy))+'</div>':'—')+'</td><td class="small">'+(e.transfer?esc(e.transfer.method)+'<div class="muted num">'+esc(e.transfer.ref)+'</div>':'—')+'</td><td style="white-space:nowrap">'+entActions(e)+'</td></tr>';
  });
  const sumBar=Object.keys(STG).filter(k=>cnt[k]).map(k=>'<button class="btn sm'+(F.entStage===k?' primary':'')+'" data-act="stageF" data-v="'+k+'">'+esc(STG[k][0])+' <b class="num">'+cnt[k]+'</b></button>').join(' ');
  el.innerHTML='<div class="subtabs" style="margin-bottom:10px">'+sumBar+'</div><p class="muted small">'+fmtMonth(month)+' · '+F.entKind+' · '+list.length+' استحقاق · الإجمالي '+money(sum(list,e=>e.amount))+' جنيه</p>'
   +tbl(['<input type="checkbox" data-selall aria-label="تحديد الكل"'+(allSel?' checked':'')+'>','الحالة','الخدمة','القيمة','الموقف والمراحل','الإرسال','التحويل',''],rows,all.length?'لا استحقاقات بهذه الفلاتر':'لم تُولَّد استحقاقات '+fmtMonth(month),all.length?'غيّري الفلتر أو النوع.':'اضغطي «توليد استحقاقات الشهر» ليُنشأ استحقاق لكل خدمة سارية في هذا الشهر.');
};
function renderBulkBar(){
  const el=$('#bulkBar');if(!el)return;
  const sel=[...SEL].map(id=>S.ents[id]).filter(Boolean);
  const nSend=sel.filter(canSend).length,nTr=sel.filter(e=>svc(e.service).kind==='مالي'&&e.sent&&!e.transfer&&e.v2).length;
  const sendLabel=F.entKind==='عيني'?'تم التسليم':(F.entKind==='كارت'?'تم إرسال الكارت':'إرسال ضمن دفعة الصرف');
  el.innerHTML='<span class="muted small">المحدد: <b>'+sel.length+'</b></span>'
   +'<button class="btn good sm"'+W('send')+' data-act="bulkSend"'+(nSend?'':' disabled')+'>'+sendLabel+' ('+nSend+')</button>'
   +(F.entKind==='مالي'?'<button class="btn good sm"'+W('transfer')+' data-act="bulkTransfer"'+(nTr?'':' disabled')+'>تسجيل التحويل ('+nTr+')</button>':'')
   +'<button class="btn sm" data-act="clearSel"'+(sel.length?'':' disabled')+'>إلغاء التحديد</button>'
   +(sel.length&&nSend<sel.length&&sel.some(e=>['needconf','hold'].includes(stageOf(e)))?'<span class="small" style="color:var(--warn)">بعض المحدد غير جاهز للإرسال (يحتاج تأكيد بيانات أو اعتماد).</span>':'');
}
function openConfirm(id){
  const e=S.ents[id];const c=S.cases[e.code]||{};
  const f=(k,l,extra)=>'<label>'+l+'<input id="cf-'+k+'" value="'+esc(c[k]||'')+'"'+(extra||'')+'></label>';
  openModal('<h2>مكالمة تأكيد بيانات <span class="muted num" style="font-size:15px">'+esc(e.code)+'</span></h2><p class="muted small">'+esc(c.name||'')+' · '+esc(e.service)+' · '+fmtMonth(e.month)+(e.confTries?' · محاولات سابقة بدون رد: '+e.confTries:'')+'</p>'
   +'<div class="fgrid"><label>نتيجة المكالمة *<select id="cf-result">'+opt(['تم الرد وتأكيد البيانات','تم الرد وتحديث البيانات','لم يرد'],'','اختاري')+'</select></label></div>'
   +'<h3 style="margin:12px 0 8px">بيانات الاستلام (تُحدّث في ملف الحالة مع حفظ القيم القديمة)</h3><div class="fgrid">'
   +f('phone','هاتف *',' dir="ltr"')+f('phone2','هاتف بديل',' dir="ltr"')+'<label>طريقة الاستلام *<select id="cf-recvMethod">'+opt(RECV_METHODS,c.recvMethod,'—')+'</select></label>'
   +f('recvName','اسم المستلم')+f('recvPhone','رقم الاستلام / المحفظة',' dir="ltr"')+f('recvId','إثبات الشخصية',' dir="ltr"')+f('recvBranch','الفرع / مكتب البريد')
   +'<label>المحافظة<select id="cf-governorate">'+opt(GOVS,c.governorate,'—')+'</select></label>'+f('address','العنوان')+'</div>'
   +'<label style="display:block;margin-top:10px"><span class="muted small">ملاحظات المكالمة</span><textarea id="cf-note"></textarea></label>'
   +'<div class="actions"><button class="btn primary" data-act="saveConfirm" data-v="'+esc(id)+'">حفظ النتيجة</button><button class="btn" data-act="closeModal">إلغاء</button></div>');
}
function openTransfer(ids,bulk){
  const list=ids.map(id=>S.ents[id]).filter(e=>e&&svc(e.service).kind==='مالي'&&e.sent&&!e.transfer&&e.v2);
  if(!list.length)return toast('لا توجد استحقاقات مُرسلة تنتظر التحويل في التحديد.');
  const c=S.cases[list[0].code]||{};
  openModal('<h2>تسجيل التحويل المالي</h2><p class="muted small">'+(bulk?list.length+' حالة · الإجمالي '+money(sum(list,e=>e.amount))+' جنيه · كل حالة بقيمة استحقاقها':esc(list[0].code)+' · '+esc(caseName(list[0].code))+' · المستحق '+money(list[0].amount)+' جنيه')+'</p><div class="fgrid">'
   +(bulk?'':'<label>المبلغ المحوّل *<input type="number" id="tr-amount" value="'+esc(list[0].amount)+'"></label>')
   +'<label>طريقة التحويل *<select id="tr-method">'+opt(RECV_METHODS,bulk?'':c.recvMethod,'اختاري')+'</select></label>'
   +'<label>تاريخ التحويل *<input type="date" id="tr-date" value="'+todayISO()+'"></label>'
   +'<label>رقم المرجع *<input id="tr-ref" dir="ltr" placeholder="'+(bulk?'مرجع الدفعة / إذن الصرف':'رقم العملية')+'"></label></div>'
   +'<p class="note small" style="margin-top:12px">تسجيل التحويل لا يعني أن المستفيد استلم. الاستلام يُسجل من المتابعة.</p>'
   +'<div class="actions"><button class="btn primary" data-act="saveTransfer" data-ids="'+list.map(e=>e.id).join(',')+'" data-bulk="'+(bulk?1:0)+'">حفظ التحويل</button><button class="btn" data-act="closeModal">إلغاء</button></div>');
}
function openApprove(id){
  const e=S.ents[id];const p=prevEnt(e);
  const unrec=p?Math.max(0,(+p.amount||0)-netReceived(p)):0;
  openModal('<h2>اعتماد إدراج استحقاق معلّق</h2><p class="small">'+code(e.code)+' · '+esc(caseName(e.code))+' · '+esc(e.service)+' · '+fmtMonth(e.month)+'</p>'
   +(p?'<div class="banner warn">الشهر السابق ('+fmtMonth(p.month)+') موقفه: '+esc(stageLabel(stageOf(p),p))+' · غير مستلم: '+money(unrec)+' جنيه</div>':'')
   +'<div class="fgrid"><label>معالجة الشهر غير المستلم<select id="ap-how">'+opt(Object.keys(POLICIES).map(k=>[k,POLICIES[k]]),CFG.policy)+'</select></label></div>'
   +'<label style="display:block;margin-top:10px"><span class="muted small">سبب الاعتماد *</span><input id="ap-reason" style="width:100%" placeholder="مثال: تم التواصل وتأكيد الاستمرار"></label>'
   +'<div class="actions"><button class="btn primary" data-act="saveApprove" data-v="'+esc(id)+'">اعتماد</button><button class="btn" data-act="closeModal">إلغاء</button></div>');
}
function openRefund(id){
  const e=S.ents[id];const tr=trAmount(e),prev=refundSum(e);
  openModal('<h2>تسجيل استرداد</h2><p class="small">'+code(e.code)+' · '+esc(caseName(e.code))+' · '+esc(e.service)+' · شهر الاستحقاق '+fmtMonth(e.month)+'</p>'
   +'<div class="kv" style="margin:8px 0 12px"><div><span>المبلغ المحول</span>'+money(tr)+'</div><div><span>مسترد سابقاً</span>'+money(prev)+'</div><div><span>المتبقي القابل للاسترداد</span>'+money(tr-prev)+'</div><div><span>مرجع التحويل</span><span class="num">'+esc((e.transfer&&e.transfer.ref)||'—')+'</span></div></div>'
   +'<div class="fgrid"><label>المبلغ المسترد *<input type="number" id="rf-amount" value="'+esc(tr-prev)+'"></label><label>تاريخ الاسترداد *<input type="date" id="rf-date" value="'+todayISO()+'"></label>'
   +'<label>السبب *<select id="rf-reason">'+opt(REFUND_REASONS,'','اختاري')+'</select></label><label>حالة التسوية<select id="rf-settle">'+opt(['معلقة','تمت التسوية'],'معلقة')+'</select></label>'
   +'<label>معالجة الاستحقاق غير المستلم<select id="rf-how">'+opt(Object.keys(POLICIES).map(k=>[k,POLICIES[k]]),CFG.policy)+'</select></label></div>'
   +'<label style="display:block;margin-top:10px"><span class="muted small">ملاحظات</span><textarea id="rf-note"></textarea></label>'
   +'<p class="muted small">المبلغ المسترد لا يُحسب ضمن ما وصل للمستفيد. يتحدد تلقائياً إن كان كلياً أو جزئياً.</p>'
   +'<div class="actions"><button class="btn primary" data-act="saveRefund" data-v="'+esc(id)+'">حفظ</button><button class="btn" data-act="closeModal">إلغاء</button></div>');
}
function openEntFile(id){
  const e=S.ents[id];if(!e)return;const k=stageOf(e);
  const a=(e.attempts||[]).map((x,i)=>'<li><span class="d">'+fmtTs(x.at)+'</span>'+(x.voided?'<del>':'')+esc(x.result||(x.answered?'رد':'لم يرد'))+' · '+esc(nameOf(x.by))+(x.note?' · '+esc(x.note):'')+(x.voided?'</del> (أُرجعت للتصحيح)':'')+'</li>').join('');
  const refs=(D.refByEnt[id]||[]).map(r=>'<li><span class="d">'+fmtDate(r.date)+'</span>'+money(r.amount)+' ج · '+esc(r.type)+' · '+esc(r.reason)+' · '+esc(r.settlement)+' · '+esc(nameOf(r.by))+'</li>').join('');
  const ev=[];
  ev.push([e.createdAt,'توليد الاستحقاق',e.createdBy]);
  if(e.confirmedAt)ev.push([e.confirmedAt,'تأكيد البيانات · '+(e.confirmNote||''),e.confirmedBy]);
  if(e.holdApproved)ev.push([e.holdApproved.at,'اعتماد إدراج · '+POLICIES[e.holdApproved.how]+' · '+e.holdApproved.reason,e.holdApproved.by]);
  if(e.sentAt)ev.push([e.sentAt,'إرسال · دفعة '+(e.batchId||''),e.sentBy]);
  if(e.transfer)ev.push([e.transfer.at,'تحويل '+money(e.transfer.amount)+' ج · '+e.transfer.method+' · مرجع '+e.transfer.ref,e.transfer.by]);
  if(e.notPaid)ev.push([e.notPaid.at,'لم يتم الصرف · '+e.notPaid.reason+' · الإجراء: '+e.notPaid.action,e.notPaid.by]);
  if(e.actionDone)ev.push([e.actionDone.at,'تمت المعالجة · '+e.actionDone.result,e.actionDone.by]);
  if(e.stuck)ev.push([e.stuck.at,'تعثر · '+e.stuck.reason,e.stuck.by]);
  if(e.settled)ev.push([e.settled.at,'تسوية · '+POLICIES[e.settled.how],e.settled.by]);
  if(e.stopped)ev.push([e.stopped.at,'إيقاف · '+e.stopped.reason,e.stopped.by]);
  ev.sort((x,y)=>(x[0]||0)-(y[0]||0));
  const followBtns=(canFollow(e)||k==='noans'||(k==='trans'))&&!['recv','deliv','refund','stop'].includes(k)?
    '<div class="card" style="margin-top:12px"><h3>تسجيل نتيجة المتابعة</h3><input id="fu-note-'+esc(id)+'" placeholder="ملاحظة (اختياري)" style="width:100%;margin-bottom:8px"><div class="inline">'
    +(unanswered(e)<3&&!e.followResult?'<button class="btn"'+W('follow')+' data-act="attempt" data-v="'+esc(id)+'" data-a="0">لم يرد ('+unanswered(e)+'/3)</button>':'')
    +'<button class="btn good"'+W('follow')+' data-act="attempt" data-v="'+esc(id)+'" data-a="paid">'+(k==='noans'&&unanswered(e)>=3?'رد متأخر · ':'رد · ')+'تم الصرف</button>'
    +(!e.followResult?'<button class="btn bad"'+W('follow')+' data-act="attempt" data-v="'+esc(id)+'" data-a="notpaid">رد · لم يتم الصرف</button>':'')+'</div></div>':'';
  openModal('<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><h2>استحقاق '+fmtMonth(e.month)+' · '+esc(e.service)+'</h2><button class="btn sm" data-act="closeModal">إغلاق</button></div>'
   +'<p>'+code(e.code)+' · '+esc(caseName(e.code))+' · '+stagePill(e)+'</p>'+stepsLine(e)
   +'<div class="kv" style="margin:12px 0"><div><span>القيمة</span>'+money(e.amount)+' ج</div><div><span>المحوّل</span>'+money(trAmount(e))+'</div><div><span>المسترد</span>'+money(refundSum(e))+'</div><div><span>وصل للمستفيد</span>'+money(netReceived(e))+'</div><div><span>مسؤولية الموظف في المتابعة</span>'+(followDone(e)?'مستوفاة':'غير مستوفاة')+'</div></div>'
   +'<div class="inline">'+entActions(e).replace(/<button class="btn sm" data-act="entFile"[^>]*>تفاصيل<\/button>/,'')
   +(!e.stuck&&!FINAL.includes(k)&&k!=='stop'?'<button class="btn sm bad"'+W('follow')+' data-act="stuckForm" data-v="'+esc(id)+'">تسجيل تعثر</button>':'')+(e.stuck?'<button class="btn sm"'+W('follow')+' data-act="unstick" data-v="'+esc(id)+'">إلغاء التعثر</button>':'')+'</div>'
   +followBtns
   +'<div class="grid2" style="margin-top:14px"><div><h3 style="margin-bottom:8px">سجل الإجراءات</h3><ul class="tl">'+ev.map(x=>'<li><span class="d">'+fmtTs(x[0])+'</span>'+esc(x[1])+' · '+esc(nameOf(x[2]))+'</li>').join('')+'</ul></div>'
   +'<div><h3 style="margin-bottom:8px">محاولات الاتصال</h3>'+(a?'<ul class="tl">'+a+'</ul>':'<p class="muted small">لا توجد.</p>')+(refs?'<h3 style="margin:12px 0 8px">الاستردادات</h3><ul class="tl">'+refs+'</ul>':'')+'</div></div>');
}

/* ---------- follow-up ---------- */
DYN.follow=function(el){
  const q=F.fuQ.trim();
  const list=entsOf(month).filter(e=>{
    const s=svc(e.service);if(!e.sent||!needsFollow(e))return false;
    if(s.kind==='مالي'&&!isTransferred(e))return false;
    if(F.fuKind&&s.kind!==F.fuKind)return false;
    const k=stageOf(e);
    if(F.fuView==='open'&&(followDone(e)||k==='stop'))return false;
    if(F.fuView==='done'&&!followDone(e))return false;
    if(F.fuView==='noans'&&k!=='noans')return false;
    return !q||String(e.code).includes(q)||caseName(e.code).includes(q);
  }).sort((a,b)=>numSort(a.code,b.code));
  const rows=list.slice(0,600).map(e=>{
    const a=attemptsOf(e);const dn=followDone(e);const c=S.cases[e.code]||{};const last=a.length?a[a.length-1]:null;const k=stageOf(e);
    return'<tr><td>'+code(e.code)+'</td><td>'+esc(caseName(e.code))+'<div class="small muted"><span class="num">'+esc(c.phone||'')+'</span></div></td><td>'+esc(e.service)+'<div class="small muted">'+money(trAmount(e)||e.amount)+' ج'+(e.transfer?' · '+fmtDate(e.transfer.date):'')+'</div></td><td><span class="fu '+(dn?'done':'open')+'">'+a.length+'/3</span>'+(last?'<div class="small muted">'+fmtTs(last.at)+' · '+esc(nameOf(last.by))+'</div>':'')+'</td><td>'+stagePill(e)+(e.notPaid?'<div class="small muted">'+esc(e.notPaid.reason)+'</div>':'')+'</td><td style="white-space:nowrap">'
     +(!e.followResult&&k!=='refund'&&k!=='stop'?'<button class="btn sm"'+W('follow')+' data-act="attempt" data-v="'+e.id+'" data-a="0">لم يرد</button> <button class="btn sm good"'+W('follow')+' data-act="attempt" data-v="'+e.id+'" data-a="paid">رد · تم الصرف</button> <button class="btn sm bad"'+W('follow')+' data-act="attempt" data-v="'+e.id+'" data-a="notpaid">رد · لم يتم الصرف</button>':'')
     +(k==='noans'&&e.followResult?'<button class="btn sm good"'+W('follow')+' data-act="attempt" data-v="'+e.id+'" data-a="paid">رد متأخر · تم الصرف</button>':'')
     +' <button class="btn sm" data-act="entFile" data-v="'+e.id+'">تفاصيل</button></td></tr>';
  });
  el.innerHTML='<p class="muted small">'+list.length+' حالة</p>'+tbl(['الكود','الاسم','الخدمة','المحاولات','الموقف','تسجيل نتيجة الاتصال'],rows,'لا متابعات في هذا العرض','تظهر هنا الحالات بعد التحويل (المالي) أو الإرسال (الكروت).');
};

/* ---------- refunds ---------- */
DYN.refunds=function(el){
  const q=F.refQ.trim();
  const list=D.refunds.filter(r=>(!F.refStatus||r.settlement===F.refStatus)&&(!q||String(r.code).includes(q)||String(r.ref||'').includes(q)||caseName(r.code).includes(q))).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const mList=D.refunds.filter(r=>r.month===month);
  const trM=sum(entsOf(month),trAmount);
  el.innerHTML='<div class="kpis compact">'+kpi(money(sum(mList,r=>r.amount)),'مسترد من استحقاقات '+fmtMonth(month))+kpi(mList.filter(r=>r.type==='كلي').length,'استرداد كلي')+kpi(mList.filter(r=>r.type==='جزئي').length,'استرداد جزئي')+kpi(money(trM-sum(mList,r=>r.amount)),'صافي المصروف للشهر','good')+kpi(D.refunds.filter(r=>r.settlement!=='تمت التسوية').length,'معلقة التسوية (الكل)','warn')+kpi(money(sum(D.refunds,r=>r.amount)),'إجمالي المسترد (الكل)')+'</div>'
   +tbl(['الحالة','شهر الاستحقاق','الخدمة','المحوّل','المسترد','النوع','تاريخ الاسترداد','السبب','مرجع التحويل','سجّله','التسوية',''],list.slice(0,500).map(r=>'<tr><td>'+code(r.code)+'<div class="small muted">'+esc(caseName(r.code))+'</div></td><td>'+fmtMonth(r.month)+'</td><td class="small">'+esc(r.service||'')+'</td><td class="n">'+money(r.transferAmount)+'</td><td class="n">'+money(r.amount)+'</td><td>'+pill(r.type,r.type==='كلي'?'warn':'info')+'</td><td class="n">'+fmtDate(r.date)+'</td><td class="small">'+esc(r.reason)+'</td><td class="num small">'+esc(r.ref||'—')+'</td><td class="small">'+esc(nameOf(r.by))+'<div class="muted">'+fmtTs(r.createdAt)+'</div></td><td>'+pill(r.settlement,r.settlement==='تمت التسوية'?'good':'warn')+(r.how?'<div class="small muted">'+esc(POLICIES[r.how]||'')+'</div>':'')+'</td><td>'+(r.settlement!=='تمت التسوية'?'<button class="btn sm"'+W('refund')+' data-act="settleForm" data-v="'+r.id+'">تسوية</button>':'')+' <button class="btn sm" data-act="entFile" data-v="'+esc(r.entId)+'">الاستحقاق</button></td></tr>'),'لا توجد استردادات','سجلي الاسترداد من زر «استرداد» على الاستحقاق المحوّل.');
};

/* ---------- renewal & ended ---------- */
function renewalLists(){
  const soon=[],sent=[],ended=[];
  D.decs.forEach(d=>{
    if(d.status!=='مستمر')return;
    const end=decEnd(d);if(!end)return;
    if(end<curMonth){ended.push(d);return}
    const left=toIdx(end)-toIdx(month);
    if(left>=0&&left<=CFG.renewLead){soon.push(d)}
    if(d.renewal&&d.renewal.status==='أُرسلت للتجديد')sent.push(d);
  });
  return{soon:soon,sent:sent,ended:ended};
}
DYN.renewal=function(el){
  const L=renewalLists();const list=L[F.renView]||[];
  const hint={soon:'قرارات مستمرة آخر شهر فيها خلال '+CFG.renewLead+' شهر من '+fmtMonth(month)+'. أرسليها للتجديد أو إعادة البحث قبل انتهائها.',sent:'قرارات أُرسلت للتجديد ولم يُسجل قرار جديد لها بعد.',ended:'قرارات حالتها «مستمر» وانتهت كل خدماتها قبل '+fmtMonth(curMonth)+'. لا يُنشأ لها أي استحقاق، وتحتاج إغلاقاً رسمياً.'}[F.renView];
  const rows=list.sort((a,b)=>decEnd(a).localeCompare(decEnd(b))).map(d=>{
    const end=decEnd(d);const left=toIdx(end)-toIdx(month)+1;const c=S.cases[d.code]||{};
    return'<tr><td><input type="checkbox" data-sel2="'+d.id+'"'+(SEL.has(d.id)?' checked':'')+' aria-label="تحديد"></td><td class="n">'+esc(d.no||'')+'</td><td>'+code(d.code)+'<div class="small muted">'+esc(caseName(d.code))+'</div></td><td class="small"><span class="num">'+esc(c.phone||'')+'</span><div class="muted">'+esc(c.governorate||'')+'</div></td><td>'+(D.linesByDec[d.id]||[]).map(l=>'<div class="small">'+esc(l.service)+' · '+money(l.amount)+' ج · حتى '+fmtMonth(l.endMonth)+'</div>').join('')+'</td><td>'+fmtMonth(end)+(F.renView!=='ended'?'<div class="small"><span class="pill '+(left<=1?'bad':'warn')+'">متبقي '+left+' شهر</span></div>':'')+'</td><td>'+(d.renewal?pill(d.renewal.status,'info')+'<div class="small muted">'+fmtTs(d.renewal.at)+' · '+esc(nameOf(d.renewal.by))+'</div>':'<span class="muted small">لم يُرسل</span>')+'</td><td style="white-space:nowrap">'
      +(F.renView!=='ended'?'<button class="btn sm"'+W('decision')+' data-act="renew" data-v="'+d.id+'">تسجيل قرار التجديد</button> '+(d.renewal&&d.renewal.status==='أُرسلت للتجديد'?'<button class="btn sm"'+W('renewal')+' data-act="renewNo" data-v="'+d.id+'">لم يُجدد</button>':''):'')+'</td></tr>';
  });
  const acts=F.renView==='ended'?'<button class="btn primary sm"'+W('close')+' data-act="closeEnded">إغلاق المحدد كمنتهي</button>':'<button class="btn primary sm"'+W('renewal')+' data-act="renewSend">إرسال المحدد للتجديد</button>';
  el.innerHTML='<div class="card" style="margin-bottom:12px"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between"><div class="muted small">'+esc(hint)+'</div><span class="inline"><button class="btn sm" data-act="selRen">تحديد الكل</button>'+acts+'<button class="btn sm" data-act="copyRen">نسخ القائمة</button></span></div></div>'
   +tbl(['','رقم','الحالة','التواصل','الخدمات','آخر شهر','موقف التجديد',''],rows,'لا توجد قرارات في هذه القائمة','');
};

/* ---------- task distribution ---------- */
function taskList(){
  const q=F.taskQ.trim();
  return D.vtasks.filter(t=>{
    const v=F.taskView;
    if(v==='mine'&&!(t.assignee===me.id&&!t.completedAt))return false;
    if(v==='unassigned'&&(t.assignee||t.completedAt))return false;
    if(v==='open'&&t.completedAt)return false;
    if(v==='late'&&!t.late)return false;
    if(v==='stuck'&&t.status!=='متعثرة')return false;
    if(v==='done'&&!t.completedAt)return false;
    return !q||String(t.code||'').includes(q)||(t.title||'').includes(q)||(t.code&&caseName(t.code).includes(q));
  }).sort((a,b)=>F.taskView==='done'?b.completedAt-a.completedAt:((b.late-a.late)||(a.due-b.due)));
}
DYN.tasks=function(el){
  const list=taskList();
  const open=D.vtasks.filter(t=>!t.completedAt);
  const per={};open.forEach(t=>{const k=t.assignee||'';per[k]=per[k]||{n:0,late:0};per[k].n++;if(t.late)per[k].late++});
  const load=Object.keys(per).map(k=>'<span class="chip">'+(k?esc(nameOf(k)):'غير مسندة')+' · <b class="num">'+per[k].n+'</b>'+(per[k].late?' · <span style="color:var(--bad)">'+per[k].late+' متأخرة</span>':'')+'</span>').join('');
  el.innerHTML='<div class="chips" style="margin-bottom:12px"><span class="muted small">الحِمل الحالي:</span>'+(load||'<span class="muted small">لا مهام مفتوحة</span>')+'</div>'+taskTable(list,true,'لا مهام في هذا العرض','تُنشأ مهام تأكيد البيانات والمتابعة والمعالجة تلقائياً من دورة الصرف.');
};
function renderAssignBar(){
  const el=$('#assignBar');if(!el)return;
  const n=[...SEL].filter(id=>D.vtasks.some(t=>t.id===id)).length;
  el.innerHTML=can('assign')?'<span class="muted small">المحدد: <b>'+n+'</b></span><label class="inline small">إسناد إلى<select id="as-user">'+staffOpts('','اختاري موظفاً')+'</select></label><button class="btn sm primary" data-act="assign"'+(n?'':' disabled')+'>إسناد</button><button class="btn sm" data-act="clearSel"'+(n?'':' disabled')+'>إلغاء التحديد</button>':'<span class="muted small">الإسناد متاح للمشرف والمدير.</span>';
}
function openTask(tid){
  const t=D.vtasks.find(x=>x.id===tid);if(!t)return;
  if(t.kind==='confirm'&&!t.completedAt)return openConfirm(t.entId);
  if(t.kind==='follow'&&!t.completedAt)return openEntFile(t.entId);
  if(t.kind==='action'&&!t.completedAt){
    const e=S.ents[t.entId];
    return openModal('<h2>'+esc(t.title)+'</h2><p class="small">'+code(t.code)+' · '+esc(caseName(t.code))+' · '+fmtMonth(e.month)+' · السبب: '+esc(e.notPaid.reason)+'</p>'+(e.notPaid.note?'<p class="muted small">'+esc(e.notPaid.note)+'</p>':'')
      +'<label style="display:block"><span class="muted small">ما تم تنفيذه *</span><textarea id="ac-result"></textarea></label><div class="actions"><button class="btn primary" data-act="completeAction" data-v="'+esc(t.entId)+'">إغلاق المهمة</button><button class="btn" data-act="entFile" data-v="'+esc(t.entId)+'">الاستحقاق</button><button class="btn" data-act="closeModal">إلغاء</button></div>');
  }
  const m=S.tasks[tid];
  const ret=t.completedAt&&can('return')?'<div class="card" style="margin-top:12px"><h3>إرجاع للتصحيح</h3><input id="rt-note" style="width:100%" placeholder="ما الذي يحتاج تصحيحاً؟"><div class="actions"><button class="btn bad sm" data-act="returnTask" data-v="'+esc(tid)+'">إرجاع</button></div></div>':'';
  if(!m){
    return openModal('<h2>'+esc(t.title)+'</h2><p class="small">'+(t.code?code(t.code)+' · '+esc(caseName(t.code)):'')+'</p><div class="kv"><div><span>مسندة إلى</span>'+esc(nameOf(t.assignee))+'</div><div><span>نفّذها</span>'+esc(nameOf(t.completedBy))+'</div><div><span>أُنجزت</span>'+fmtTs(t.completedAt)+'</div><div><span>النتيجة</span>'+esc(t.result||'—')+'</div></div>'+ret+'<div class="actions"><button class="btn" data-act="entFile" data-v="'+esc(t.entId)+'">الاستحقاق</button><button class="btn" data-act="closeModal">إغلاق</button></div>');
  }
  openModal('<h2>'+esc(m.title)+'</h2><div class="kv" style="margin-bottom:12px"><div><span>النوع</span>'+esc(m.type||'—')+'</div><div><span>الحالة</span>'+(m.code?code(m.code):'—')+'</div><div><span>مسندة إلى</span>'+esc(nameOf(m.assignee))+'</div><div><span>أنشأها</span>'+esc(nameOf(m.createdBy))+' · '+fmtTs(m.createdAt)+'</div><div><span>الموعد النهائي</span>'+fmtTs(m.due)+'</div><div><span>الحالة</span>'+esc(t.shown)+'</div></div>'+(m.notes?'<p class="small">'+esc(m.notes)+'</p>':'')+(m.returnNote?'<div class="banner warn">أُرجعت للتصحيح: '+esc(m.returnNote)+'</div>':'')
    +(m.completedAt?'<p class="small">النتيجة: '+esc(m.result)+' · '+esc(nameOf(m.completedBy))+' · '+fmtTs(m.completedAt)+'</p>'+ret:'<label style="display:block"><span class="muted small">نتيجة التنفيذ (إلزامية للإغلاق)</span><textarea id="tk-result">'+esc(m.result||'')+'</textarea></label><div class="actions">'+(m.status==='جديدة'?'<button class="btn" data-act="taskStatus" data-v="'+esc(tid)+'" data-s="قيد التنفيذ">بدء التنفيذ</button>':'')+'<button class="btn primary" data-act="taskStatus" data-v="'+esc(tid)+'" data-s="مكتملة">إغلاق كمكتملة</button><button class="btn bad" data-act="taskStatus" data-v="'+esc(tid)+'" data-s="متعثرة">متعثرة</button><button class="btn" data-act="editTask" data-v="'+esc(tid)+'">تعديل</button></div>')
    +'<div class="actions"><button class="btn" data-act="closeModal">إغلاق</button></div>');
}
function openTaskForm(id,pre){
  const m=(id&&S.tasks[id])||pre||{};
  const types=TASKS.map(t=>t.name);
  openModal('<h2>'+(id?'تعديل مهمة':'مهمة جديدة')+'</h2><div class="fgrid"><label>العنوان *<input id="tk-title" value="'+esc(m.title||'')+'"></label><label>نوع العملية<select id="tk-type">'+opt(types,m.type,'—')+'</select></label><label>كود الحالة<input id="tk-code" list="caseList" value="'+esc(m.code||'')+'"></label><label>مسندة إلى<select id="tk-assignee">'+staffOpts(m.assignee||'','غير مسندة')+'</select></label><label>الموعد النهائي<input type="date" id="tk-due" value="'+esc(m.due?isoOf(new Date(m.due)):isoOf(new Date(Date.now()+CFG.taskDays*DAY)))+'"></label></div><label style="display:block;margin-top:10px"><span class="muted small">التفاصيل</span><textarea id="tk-notes">'+esc(m.notes||'')+'</textarea></label><div class="actions"><button class="btn primary" data-act="saveTask" data-v="'+esc(id||'')+'">حفظ</button><button class="btn" data-act="closeModal">إلغاء</button></div>');
}

/* ---------- operations log ---------- */
function opsFiltered(){
  const q=F.opQ.trim();
  return D.ops.filter(o=>(!F.opMonth||(o.date||'').slice(0,7)===F.opMonth)&&(!F.opTeam||o.team===F.opTeam)&&(!F.opStatus||o.status===F.opStatus)&&(!F.opBy||o.by===F.opBy)&&(!q||(o.type||'').includes(q)||String(o.code||'').includes(q)||(o.dept||'').includes(q))).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
}
DYN.ops=function(el){
  const list=opsFiltered();
  const rows=list.slice(0,500).map(o=>'<tr><td class="n small">'+fmtDate(o.date)+'</td><td>'+esc(o.type)+(o.auto?' <span class="pill">تلقائية</span>':'')+(o.result?'<div class="small">'+esc(o.result)+'</div>':'')+(o.notes?'<div class="small muted">'+esc(o.notes)+'</div>':'')+(o.attach?'<div class="small"><a href="'+esc(/^https?:/.test(o.attach)?o.attach:'#')+'" target="_blank" rel="noopener" class="num">'+esc(o.attach)+'</a></div>':'')+(o.returnNote?'<div class="small" style="color:var(--warn)">أُرجعت: '+esc(o.returnNote)+'</div>':'')+'</td><td class="small">'+esc(o.team)+'</td><td>'+(o.code?code(o.code)+'<div class="small muted">'+esc(caseName(o.code))+'</div>':esc(o.dept||'—'))+'</td><td>'+esc(nameOf(o.by))+'</td><td class="n small">'+fmtTs(o.createdAt)+'</td><td class="n">'+(o.count>1?o.count+' × ':'')+o.weight+'</td><td>'+(o.by===me.id||can('return')?'<select data-opstatus="'+o.id+'" aria-label="حالة العملية">'+opt(['جديد','جاري','تم'],o.status)+'</select>':pill(o.status,o.status==='تم'?'good':''))+'</td><td>'+(can('return')&&o.status==='تم'?'<button class="btn sm" data-act="returnOpForm" data-v="'+o.id+'">إرجاع</button>':'')+'</td></tr>');
  el.innerHTML='<p class="muted small">'+list.length+' عملية · الإجمالي بالأوزان '+Math.round(sum(list,o=>(+o.weight||0)*(+o.count||1))*10)/10+'</p>'+tbl(['تاريخ التنفيذ','العملية والنتيجة','الفريق','الحالة / الجهة','المنفذ','تاريخ ووقت التسجيل','الوزن','حالة التنفيذ',''],rows,D.ops.length?'لا نتائج':'لا توجد عمليات بعد','سجلي أول عملية من النموذج بالأعلى.');
};
function bindOpForm(){
  const sel=$('#op-type');if(!sel)return;
  const upd=()=>{const t=TASKS[+sel.value];$('#op-code-l').hidden=t.scope!=='حالة';$('#op-dept-l').hidden=t.scope==='حالة';$('#op-info').textContent='الفريق: '+t.team+' · التصنيف: '+t.scope+' · الوزن: '+t.weight};
  sel.addEventListener('change',upd);upd();
}
async function saveOp(){
  const t=TASKS[+$('#op-type').value];
  const cd=$('#op-code').value.trim(),dept=$('#op-dept').value.trim();
  if(t.scope==='حالة'&&!S.cases[cd])return toast('اكتبي كود حالة مسجل لهذه العملية.');
  if(t.scope==='عامة'&&!dept)return toast('اكتبي الجهة أو الإدارة.');
  const status=$('#op-status').value,result=$('#op-result').value.trim();
  if(status==='تم'&&!result)return toast('اكتبي نتيجة العملية قبل تسجيلها كمكتملة.');
  const id=newId('o');
  const ok=await guard('op',async()=>{
    await setDoc('ops',id,{id:id,type:t.name,team:t.team,weight:t.weight,scope:t.scope,code:t.scope==='حالة'?cd:'',dept:t.scope==='عامة'?dept:'',date:$('#op-date').value||todayISO(),status:status,result:result,count:Math.max(1,+$('#op-count').value||1),attach:$('#op-attach').value.trim(),notes:$('#op-notes').value.trim(),by:me.id,createdAt:Date.now()});
    await logAudit('عملية',t.scope==='حالة'?cd:dept,t.name);
  });
  if(ok){['op-code','op-dept','op-notes','op-result','op-attach'].forEach(i=>$('#'+i).value='');$('#op-count').value=1;toast('تم تسجيل العملية باسمك ووقت التسجيل.')}
}

/* ---------- reports ---------- */
function rptFilter(){return{staff:F.rptStaff,svc:F.rptSvc,dec:F.rptDec,gov:F.rptGov,nat:F.rptNat}}
let RPT_ROWS=[];
DYN.reports=function(el){
  const f=rptFilter();const v=F.rptView;
  if(v==='month')return reportMonth(el,f);
  if(v==='staff')return reportStaff(el,f);
  if(v==='ops')return reportOps(el,f);
  return reportCompare(el,f);
};
function reportMonth(el,f){
  const M=metrics(month,f);const P=metrics(addMonths(month,-1),f);
  const delta=(a,b,isM,inv)=>{const d=a-b;if(!b&&!a)return'';const good=inv?d<=0:d>=0;return'<small style="color:'+(d===0?'var(--muted)':(good?'var(--good)':'var(--bad)'))+'">'+(d>=0?'+':'')+(isM?money(d):d)+' عن '+fmtMonth(P.m)+'</small>'};
  const INV=['خدمات لم تُستلم','عمليات غير مكتملة','المسترد','حالات مالية لم تستلم'];
  const k=(v,l,prev,isM,cls)=>'<div class="kpi '+(cls||'')+'"><b>'+(isM?money(v):v)+'</b><span>'+l+'</span>'+delta(v,prev,isM,INV.includes(l))+'</div>';
  const svcRows=Object.keys(M.bySvc).map(n=>{const b=M.bySvc[n];return'<tr><td>'+esc(n)+'</td><td>'+esc(b.kind)+'</td><td class="n">'+b.n+'</td><td class="n">'+b.sent+'</td><td class="n">'+b.done+'</td><td class="n">'+b.open+'</td><td class="n">'+money(b.amount)+'</td></tr>'});
  const reasons=Object.keys(M.reasons).sort((a,b)=>M.reasons[b]-M.reasons[a]).map(r=>'<tr><td>'+esc(r)+'</td><td class="n">'+M.reasons[r]+'</td></tr>');
  const incomplete=M.ents.filter(e=>!FINAL.includes(stageOf(e))&&stageOf(e)!=='stop').sort((a,b)=>numSort(a.code,b.code));
  RPT_ROWS=[['الكود','الاسم','المحافظة','الجنسية','الخدمة','القيمة','الموقف','المحوّل','المسترد','وصل للمستفيد','محاولات المتابعة','أرسله','تاريخ الإرسال']].concat(M.ents.map(e=>{const c=S.cases[e.code]||{};return[e.code,c.name||'',c.governorate||'',c.nationality||'',e.service,e.amount,stageLabel(stageOf(e),e),trAmount(e),refundSum(e),netReceived(e),attemptsOf(e).length,nameOf(e.sentBy),e.sentAt?fmtTs(e.sentAt):'']}));
  el.innerHTML='<div class="rpt"><div class="sec-title"><h2>التقرير الشهري · '+fmtMonth(month)+'</h2><span class="muted">'+filterDesc(f)+' · أُنشئ '+fmtTs(Date.now())+' بواسطة '+esc(nameOf(me.id))+'</span></div>'
   +'<div class="kpis compact">'+k(M.opsTotal,'عمليات تمت خلال الشهر',P.opsTotal)+k(M.beneficiaries,'حالات مستفيدة (استلمت)',P.beneficiaries,false,'good')+k(M.ents.length,'خدمات مستحقة',P.ents.length)+k(M.received,'خدمات اكتملت للمستفيد',P.received)+k(M.notReceived,'خدمات لم تُستلم',P.notReceived,false,M.notReceived?'bad':'')+k(M.opsOpen,'عمليات غير مكتملة',P.opsOpen,false,M.opsOpen?'warn':'')+'</div>'
   +'<div class="kpis compact">'+k(M.due,'المستحق المالي',P.due,true)+k(M.transferred,'المحوّل',P.transferred,true)+k(M.refunded,'المسترد',P.refunded,true,M.refunded?'warn':'')+k(M.net,'صافي المصروف',P.net,true,'good')+k(M.transferredCases,'حالات تم التحويل لها',P.transferredCases)+k(M.notRecvFin,'حالات مالية لم تستلم',P.notRecvFin,false,M.notRecvFin?'bad':'')+'</div>'
   +'<div class="grid2"><div class="card"><h3>الخدمات المنفذة حسب النوع</h3>'+tbl(['الخدمة','الفئة','مستحق','أُرسل','اكتمل','مفتوح','القيمة'],svcRows,'لا يوجد','')+'</div><div class="card"><h3>أسباب التعثر وعدم الاستلام</h3>'+tbl(['السبب','العدد'],reasons,'لا توجد حالات تعثر','')+'</div></div>'
   +'<div class="card"><h3>تقرير الموظفين</h3>'+staffTable(month,f)+'</div>'
   +'<div class="card"><h3>العمليات غير المكتملة ('+incomplete.length+')</h3>'+tbl(['الحالة','الخدمة','الموقف','آخر إجراء'],incomplete.slice(0,200).map(e=>'<tr><td>'+code(e.code)+' '+esc(caseName(e.code))+'</td><td>'+esc(e.service)+'</td><td>'+stagePill(e)+'</td><td class="small">'+(attemptsOf(e).length?fmtTs(attemptsOf(e).slice(-1)[0].at):(e.sentAt?fmtTs(e.sentAt):'—'))+'</td></tr>'),'كل الخدمات مكتملة','')+'</div>'
   +'<div class="grid2">'+trendCard('صافي المصروف',month,m=>metrics(m,f).net,true)+trendCard('حالات مستفيدة',month,m=>metrics(m,f).beneficiaries)+'</div></div>';
}
function filterDesc(f){const p=[];if(f.staff)p.push('الموظف: '+nameOf(f.staff));if(f.svc)p.push(f.svc);if(f.dec)p.push('قرار '+f.dec);if(f.gov)p.push(f.gov);if(f.nat)p.push(f.nat);return p.length?p.join(' · '):'كل البيانات'}
function reportStaff(el,f){
  const ids=f.staff?[f.staff]:staffIds();
  const blocks=ids.map(u=>{
    const s=staffStats(month,u,f);if(!s.assigned&&!s.doneBy&&!s.ops)return'';
    const types=Object.keys(s.byType).sort((a,b)=>s.byType[b]-s.byType[a]).map(t=>'<tr><td>'+esc(t)+'</td><td class="n">'+s.byType[t]+'</td></tr>');
    const prev=staffStats(addMonths(month,-1),u,f);
    return'<div class="card"><div class="sec-title" style="margin-top:0"><h2>'+esc(nameOf(u))+'</h2><span class="muted">'+esc((S.staff[u]&&S.staff[u].role)||'')+' · '+fmtMonth(month)+'</span></div>'
     +'<div class="kpis compact">'+kpi(s.assigned,'مهام مسندة','',prev.assigned+' الشهر السابق')+kpi(pct(s.assignedDone,s.assigned),'نسبة الإنجاز')+kpi(s.doneBy,'نفّذ بنفسه','good',prev.doneBy+' الشهر السابق')+kpi(s.ops,'عمليات مسجلة','',prev.ops+' الشهر السابق')+kpi(pct(s.opsDone,s.ops),'عمليات مكتملة')+kpi(fmtDur(s.avgMs),'متوسط زمن التنفيذ')+kpi(s.late,'متأخرة',s.late?'bad':'')+kpi(s.returned,'أُرجعت للتصحيح',s.returned?'warn':'')+kpi(s.weight,'الإنتاجية بالأوزان','',prev.weight+' الشهر السابق')+'</div>'
     +'<div class="grid2"><div>'+tbl(['نوع العملية','العدد'],types,'لا عمليات','')+'</div><div>'+tbl(['التاريخ','العملية','الحالة','النتيجة'],s.opsList.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,40).map(o=>'<tr><td class="n small">'+fmtDate(o.date)+'</td><td class="small">'+esc(o.type)+(o.count>1?' ×'+o.count:'')+'</td><td class="small">'+(o.code?esc(o.code):esc(o.dept||''))+'</td><td class="small">'+esc(o.result||o.status)+'</td></tr>'),'لا عمليات','')+'</div></div></div>';
  }).join('');
  RPT_ROWS=[['الموظف','مهام مسندة','المسند المكتمل','نسبة الإنجاز','نفّذ بنفسه','العمليات','عمليات مكتملة','متوسط زمن التنفيذ','متأخرة','أُرجعت','الإنتاجية']].concat(ids.map(u=>{const s=staffStats(month,u,f);return[nameOf(u),s.assigned,s.assignedDone,pct(s.assignedDone,s.assigned),s.doneBy,s.ops,s.opsDone,fmtDur(s.avgMs),s.late,s.returned,s.weight]}));
  el.innerHTML='<div class="rpt"><div class="sec-title"><h2>تقارير الموظفين · '+fmtMonth(month)+'</h2><span class="muted">'+filterDesc(f)+'</span></div><div class="card"><h3>مقارنة الإنتاجية</h3>'+staffTable(month,f)+'</div>'+(blocks||'<div class="empty"><b>لا نشاط</b>لا توجد مهام أو عمليات في هذا الشهر.</div>')+'</div>';
}
function reportOps(el,f){
  const fl=makeFilter(f);
  const ops=D.ops.filter(o=>(o.date||'').slice(0,7)===month&&fl.op(o)).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const byType={};ops.forEach(o=>{const b=byType[o.type]=byType[o.type]||{n:0,done:0,w:0,team:o.team};b.n+=+o.count||1;if(o.status==='تم')b.done+=+o.count||1;b.w+=(+o.weight||0)*(+o.count||1)});
  RPT_ROWS=[['تاريخ التنفيذ','العملية','الفريق','الحالة','الجهة','النتيجة','الملاحظات','العدد','الوزن','حالة التنفيذ','المنفذ','تاريخ ووقت التسجيل']].concat(ops.map(o=>[o.date,o.type,o.team,o.code||'',o.dept||'',o.result||'',o.notes||'',o.count||1,o.weight,o.status,nameOf(o.by),fmtTs(o.createdAt)]));
  el.innerHTML='<div class="rpt"><div class="sec-title"><h2>كل العمليات · '+fmtMonth(month)+'</h2><span class="muted">'+filterDesc(f)+' · '+sum(ops,o=>+o.count||1)+' عملية</span></div>'
   +'<div class="card"><h3>ملخص حسب نوع العملية</h3>'+tbl(['نوع العملية','الفريق','العدد','المكتمل','الإنتاجية بالأوزان'],Object.keys(byType).sort((a,b)=>byType[b].n-byType[a].n).map(t=>'<tr><td>'+esc(t)+'</td><td class="small">'+esc(byType[t].team)+'</td><td class="n">'+byType[t].n+'</td><td class="n">'+byType[t].done+'</td><td class="n">'+Math.round(byType[t].w*10)/10+'</td></tr>'),'لا عمليات','')+'</div>'
   +'<div class="card"><h3>السجل التفصيلي</h3>'+tbl(['تاريخ التنفيذ','العملية','الحالة / الجهة','النتيجة','المنفذ','وقت التسجيل','الحالة'],ops.slice(0,800).map(o=>'<tr><td class="n small">'+fmtDate(o.date)+'</td><td class="small">'+esc(o.type)+(o.count>1?' ×'+o.count:'')+'</td><td class="small">'+(o.code?code(o.code):esc(o.dept||''))+'</td><td class="small">'+esc(o.result||'')+'</td><td class="small">'+esc(nameOf(o.by))+'</td><td class="n small">'+fmtTs(o.createdAt)+'</td><td>'+pill(o.status,o.status==='تم'?'good':'')+'</td></tr>'),'لا عمليات','')+'</div></div>';
}
function reportCompare(el,f){
  const ms=[];for(let i=5;i>=0;i--)ms.push(addMonths(month,-i));
  const Ms=ms.map(m=>metrics(m,f));
  const rowsDef=[['عمليات منفذة','opsTotal'],['عمليات غير مكتملة','opsOpen'],['خدمات مستحقة',x=>x.ents.length],['حالات مستفيدة','beneficiaries'],['خدمات لم تُستلم','notReceived'],['المستحق المالي','due',1],['المحوّل','transferred',1],['المسترد','refunded',1],['صافي المصروف','net',1],['حالات نشطة','activeCases'],['قرارات جديدة','newDecs'],['قرارات تنتهي','endingDecs'],['محالة للتجديد','referred']];
  const val=(M,d)=>typeof d[1]==='function'?d[1](M):M[d[1]];
  RPT_ROWS=[['المؤشر'].concat(ms.map(fmtMonth))].concat(rowsDef.map(d=>[d[0]].concat(Ms.map(M=>val(M,d)))));
  el.innerHTML='<div class="rpt"><div class="sec-title"><h2>مقارنة الشهور</h2><span class="muted">'+filterDesc(f)+'</span></div>'+tbl(['المؤشر'].concat(ms.map(m=>fmtMonth(m))),rowsDef.map(d=>'<tr><td>'+d[0]+'</td>'+Ms.map((M,i)=>{const v=val(M,d);const p=i?val(Ms[i-1],d):null;const arrow=p==null||p===v?'':(v>p?' <span style="color:var(--good)">▲</span>':' <span style="color:var(--bad)">▼</span>');return'<td class="n">'+(d[2]?money(v):v)+arrow+'</td>'}).join('')+'</tr>'),'','')
   +'<div class="grid3" style="margin-top:16px">'+trendCard('صافي المصروف',month,m=>metrics(m,f).net,true)+trendCard('حالات مستفيدة',month,m=>metrics(m,f).beneficiaries)+trendCard('عمليات منفذة',month,m=>metrics(m,f).opsTotal)+'</div></div>';
}
function toCSV(rows){return'﻿'+rows.map(r=>r.map(c=>{const s=String(c==null?'':c);return/[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}).join(',')).join('\r\n')}
async function saveFile(name,text,type){
  if(downloads){try{await downloads.save({filename:name,data:new Blob([text],{type:type||'text/csv;charset=utf-8'})});toast('تم تجهيز الملف.')}catch(e){toast('لم يتم حفظ الملف.')}return}
  try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:type||'text/csv;charset=utf-8'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}catch(e){toast('تعذر تنزيل الملف في هذا العرض. استخدمي «نسخ للإكسل».')}
}
async function copyRows(rows){
  const text=rows.map(r=>r.map(c=>String(c==null?'':c).replace(/\t|\n/g,' ')).join('\t')).join('\n');
  try{await navigator.clipboard.writeText(text);toast('نُسخ '+(rows.length-1)+' صف. الصقيه في إكسل.')}catch(e){openModal('<h2>انسخي يدوياً</h2><textarea style="min-height:300px" id="cpy">'+esc(text)+'</textarea><div class="actions"><button class="btn" data-act="closeModal">إغلاق</button></div>');const t=$('#cpy');t.focus();t.select()}
}

/* ---------- audit ---------- */
DYN.audit=function(el){
  const q=F.audQ.trim();
  const list=D.audit.filter(a=>!q||(a.action||'').includes(q)||String(a.target||'').includes(q)||(a.detail||'').includes(q)||nameOf(a.by).includes(q));
  const chg=D.changes.slice(0,100);
  el.innerHTML='<p class="muted small">سجل غير قابل للتعديل من الشاشات: لا يوجد في النظام زر لحذف أو تعديل أي سجل تدقيق أو عملية مالية. يُعرض آخر '+Math.min(list.length,1000)+' تسجيل.</p>'+tbl(['الوقت','المستخدم','الإجراء','العنصر','تفاصيل'],list.slice(0,1000).map(a=>'<tr><td class="n small" style="white-space:nowrap">'+fmtTs(a.ts)+'</td><td>'+esc(nameOf(a.by))+'</td><td>'+esc(a.action)+'</td><td>'+esc(a.target)+'</td><td class="small">'+esc(a.detail)+(a.old!=null?'<div class="chg"><del>'+esc(a.old)+'</del> ← <ins>'+esc(a.new)+'</ins></div>':'')+'</td></tr>'),'لا يوجد سجل بعد','سيظهر هنا كل ما يتم تسجيله أو تعديله.')
   +'<div class="sec-title"><h2>آخر تعديلات بيانات الحالات</h2></div>'+tbl(['الوقت','المستخدم','الحالة','المصدر','التعديل'],chg.map(x=>'<tr><td class="n small">'+fmtTs(x.ts)+'</td><td>'+esc(nameOf(x.by))+'</td><td>'+code(x.code)+'</td><td class="small">'+esc(x.source||'')+'</td><td class="chg">'+x.diffs.map(d=>esc(d.label)+': <del>'+esc(d.old||'فارغ')+'</del> ← <ins>'+esc(d.new||'فارغ')+'</ins>').join('<br>')+'</td></tr>'),'لا تعديلات','');
};

/* ---------- settings: rules, services, staff & roles, backup ---------- */
DYN.settings=function(el){
  const admin=can('*');
  const svcRows=SERVICES.map((s,i)=>'<tr><td>'+esc(s.name)+'</td><td>'+(admin?'<select data-svc="'+i+'" data-k="kind">'+opt(KINDS,s.kind)+'</select>':esc(s.kind))+'</td><td>'+(admin?'<select data-svc="'+i+'" data-k="cycle">'+opt(CYCLES,s.cycle)+'</select>':esc(s.cycle))+'</td><td>'+(admin?'<select data-svc="'+i+'" data-k="follow">'+opt([['1','نعم'],['0','لا']],s.follow?'1':'0')+'</select>':(s.follow?'نعم':'لا'))+'</td><td class="n">'+D.lines.filter(l=>l.service===s.name).length+'</td></tr>');
  const staffRows=D.staff.slice().sort((a,b)=>(a.joinedAt||0)-(b.joinedAt||0)).map(s=>'<tr><td>'+esc(nameOf(s.id))+(s.id===me.id?' <span class="pill pri">أنت</span>':'')+'</td><td>'+(admin?'<select data-staff="'+esc(s.id)+'" data-k="role">'+opt(ROLES,s.role)+'</select>':esc(s.role))+'</td><td>'+(admin?'<select data-staff="'+esc(s.id)+'" data-k="team">'+opt(TEAMS,s.team,'—')+'</select>':esc(s.team||'—'))+'</td><td>'+(admin?'<select data-staff="'+esc(s.id)+'" data-k="active">'+opt([['1','نشط'],['0','موقوف']],s.active===false?'0':'1')+'</select>':(s.active===false?'موقوف':'نشط'))+'</td><td class="small">'+fmtTs(s.joinedAt)+'</td></tr>');
  const permRows=ROLES.map(r=>'<tr><td><b>'+r+'</b></td><td class="small">'+({'مدير':'كل الصلاحيات، الإعدادات، المستخدمون، النسخ الاحتياطي','مشرف':'كل التشغيل + إسناد المهام، اعتماد الإدراج، إرجاع للتصحيح، إيقاف وإغلاق القرارات، مراجعة التعارض','مالي':'تسجيل التحويلات والاستردادات + التشغيل اليومي','موظف':'الحالات، القرارات، التأكيد، الإرسال، المتابعة، العمليات، المهام','قراءة':'عرض فقط'})[r]+'</td></tr>');
  const asg=k=>'<label>'+{confirm:'مكالمات تأكيد البيانات',follow:'مكالمات متابعة الصرف',action:'معالجة عدم الصرف'}[k]+'<select id="cfg-as-'+k+'"'+(admin?'':' disabled')+'>'+staffOpts(CFG.assign[k]||'','بدون (يسندها المشرف)')+'</select></label>';
  el.innerHTML='<div class="grid2"><div class="card"><h3>قواعد التشغيل</h3><div class="fgrid">'
   +'<label>التنبيه بالتجديد قبل النهاية (شهور)<input type="number" min="1" max="6" id="cfg-renewLead" value="'+CFG.renewLead+'"'+(admin?'':' disabled')+'></label>'
   +'<label>مهلة مكالمة التأكيد (أيام)<input type="number" min="1" id="cfg-confirmDays" value="'+CFG.confirmDays+'"'+(admin?'':' disabled')+'></label>'
   +'<label>بدء المتابعة بعد التحويل (أيام)<input type="number" min="0" id="cfg-followDays" value="'+CFG.followDays+'"'+(admin?'':' disabled')+'></label>'
   +'<label>مهلة معالجة عدم الصرف (أيام)<input type="number" min="1" id="cfg-actionDays" value="'+CFG.actionDays+'"'+(admin?'':' disabled')+'></label>'
   +'<label>مهلة المهام اليدوية (أيام)<input type="number" min="1" id="cfg-taskDays" value="'+CFG.taskDays+'"'+(admin?'':' disabled')+'></label>'
   +'<label>السياسة الافتراضية للشهر غير المستلم<select id="cfg-policy"'+(admin?'':' disabled')+'>'+opt(Object.keys(POLICIES).map(k=>[k,POLICIES[k]]),CFG.policy)+'</select></label></div>'
   +'<h3 style="margin:14px 0 8px">الإسناد التلقائي للمهام</h3><div class="fgrid">'+asg('confirm')+asg('follow')+asg('action')+'</div>'
   +(admin?'<div class="actions"><button class="btn primary" data-act="saveCfg">حفظ الإعدادات</button></div>':'')+'</div>'
   +'<div class="card"><h3>الأدوار والصلاحيات</h3>'+tbl(['الدور','الصلاحيات'],permRows,'','')+'<p class="muted small" style="margin-top:8px">الصلاحيات تُطبق في الشاشات. أول مستخدم يدخل النظام يصبح مديراً، وصاحب الصفحة مدير دائماً.</p></div></div>'
   +'<div class="sec-title"><h2>المستخدمون</h2></div>'+(admin?'<div class="bar"><label>إضافة موظف<input id="st-q" placeholder="'+(conn.mode==='cloud'?'ابحثي بالاسم أو الإيميل':'اسم الموظف')+'"></label><button class="btn" data-act="staffSearch">'+(conn.mode==='cloud'?'بحث':'إضافة')+'</button><span id="st-res" class="chips"></span></div>':'')
   +tbl(['الموظف','الدور','الفريق','الحالة','انضم'],staffRows,'لا يوجد مستخدمون بعد','يُسجل كل مستخدم تلقائياً عند أول عملية يقوم بها.')
   +'<div class="sec-title"><h2>أنواع الخدمات</h2><span class="muted">كل خدمة لها فئة ودورة. «متابعة بعد التسليم» تحدد هل تحتاج مكالمة متابعة لاعتبارها مستلمة.</span></div>'
   +tbl(['الخدمة','الفئة','الدورة','متابعة بعد التسليم','بنود مسجلة'],svcRows,'','')
   +(admin?'<div class="bar"><label>خدمة جديدة<input id="sv-name" placeholder="اسم الخدمة"></label><label>الفئة<select id="sv-kind">'+opt(KINDS,'عيني')+'</select></label><label>الدورة<select id="sv-cycle">'+opt(CYCLES,'مرة واحدة')+'</select></label><label>متابعة<select id="sv-follow">'+opt([['0','لا'],['1','نعم']],'0')+'</select></label><button class="btn" data-act="addSvc">إضافة</button></div><p class="muted small">لا يمكن حذف أو إعادة تسمية خدمة مستخدمة حتى لا تتأثر البيانات التاريخية.</p>':'')
   +'<div class="sec-title"><h2>النسخ الاحتياطي والبيانات</h2></div><div class="card"><div class="inline"><button class="btn" data-act="exportAll">تصدير نسخة كاملة (JSON)</button><button class="btn" data-act="exportCsvAll">تصدير الحالات والاستحقاقات والعمليات (CSV)</button>'
   +(conn.mode==='local'?'<label class="btn">استيراد نسخة<input type="file" id="imp-file" accept=".json" hidden></label><button class="btn" data-act="seed">تحميل بيانات تجريبية</button><button class="btn bad" data-act="wipe">مسح كل البيانات المحلية</button>':'')+'</div>'
   +'<p class="muted small" style="margin-top:8px">'+(conn.mode==='cloud'?'البيانات محفوظة في قاعدة بيانات الصفحة المشتركة. صدّري نسخة دورية واحتفظي بها في مكان آمن.':'الوضع المحلي: البيانات في هذا المتصفح فقط. صدّري نسخة بعد كل يوم عمل.')+'</p></div>';
};
async function saveCfg(){
  const g=id=>$('#cfg-'+id).value;
  const data={renewLead:Math.max(1,+g('renewLead')||2),confirmDays:Math.max(1,+g('confirmDays')||3),followDays:Math.max(0,+g('followDays')||0),actionDays:Math.max(1,+g('actionDays')||5),taskDays:Math.max(1,+g('taskDays')||3),policy:g('policy'),
    assign:{confirm:g('as-confirm'),follow:g('as-follow'),action:g('as-action')}};
  const old=S.config.main||{};
  const ok=await guard('*',async()=>{await setDoc('config','main',Object.assign({},old,data,{updatedAt:Date.now(),updatedBy:me.id}));await logAudit('تعديل الإعدادات','الإعدادات',JSON.stringify(data))});
  if(ok)toast('تم حفظ الإعدادات.');
}
async function saveServices(list,detail){
  const old=S.config.main||{};
  const ok=await guard('*',async()=>{await setDoc('config','main',Object.assign({},old,{services:list,updatedAt:Date.now(),updatedBy:me.id}));await logAudit('تعديل الخدمات','الخدمات',detail)});
  if(ok)toast('تم حفظ الخدمات.');
}
async function staffSearch(){
  const q=$('#st-q').value.trim();
  if(conn.mode!=='cloud'){
    if(!q)return toast('اكتبي اسم الموظف.');
    const id='u_'+q.replace(/\s+/g,'_');
    if(S.staff[id])return toast('الموظف مسجل بالفعل.');
    const ok=await guard('*',async()=>{await setDoc('staff',id,{id:id,role:'موظف',team:'',active:true,label:q,joinedAt:Date.now()});await logAudit('إضافة مستخدم',q,'موظف')});
    if(ok){toast('أُضيف '+q+'.')}return;
  }
  if(!user||!user.search)return toast('البحث عن الأشخاص غير متاح في هذا العرض.');
  try{
    const hits=await user.search(q);
    $('#st-res').innerHTML=(hits||[]).slice(0,8).map(h=>'<button class="chip" data-act="addStaff" data-v="'+esc(h.id)+'" data-n="'+esc(h.name||'')+'">+ '+esc(h.name||h.email||'شخص')+'</button>').join('')||'<span class="muted small">لا نتائج</span>';
  }catch(e){toast('تعذر البحث.')}
}

/* ---------- backup / export ---------- */
function exportAll(){
  const out={exportedAt:new Date().toISOString(),exportedBy:me.id,version:2};
  COLS.forEach(c=>out[c]=S[c]);
  saveFile('mersal-social-backup-'+todayISO()+'.json',JSON.stringify(out,null,1),'application/json');
  logAudit('تصدير نسخة احتياطية','الكل','').catch(()=>{});
}
function exportCsvAll(){
  const cases=[['الكود'].concat(CASE_FIELDS.map(f=>f[1])).concat(['مؤكدة'])].concat(D.cases.map(c=>[c.code].concat(CASE_FIELDS.map(f=>c[f[0]]||'')).concat([c.dataConfirmed?'نعم':'لا'])));
  const ents=[['الشهر','الكود','الاسم','الخدمة','القيمة','الموقف','المحوّل','طريقة التحويل','مرجع التحويل','تاريخ التحويل','المسترد','وصل للمستفيد','محاولات','الدفعة']].concat(D.ents.map(e=>[e.month,e.code,caseName(e.code),e.service,e.amount,stageLabel(stageOf(e),e),trAmount(e),e.transfer?e.transfer.method:'',e.transfer?e.transfer.ref:'',e.transfer?e.transfer.date:'',refundSum(e),netReceived(e),attemptsOf(e).length,e.batchId||'']));
  const ops=[['تاريخ التنفيذ','العملية','الفريق','الحالة','الجهة','النتيجة','العدد','الوزن','الحالة','المنفذ','وقت التسجيل']].concat(D.ops.map(o=>[o.date,o.type,o.team,o.code||'',o.dept||'',o.result||'',o.count||1,o.weight,o.status,nameOf(o.by),fmtTs(o.createdAt)]));
  saveFile('cases-'+todayISO()+'.csv',toCSV(cases));setTimeout(()=>saveFile('entitlements-'+todayISO()+'.csv',toCSV(ents)),600);setTimeout(()=>saveFile('operations-'+todayISO()+'.csv',toCSV(ops)),1200);
}

/* ---------- names ---------- */
async function resolveNames(){
  if(conn.mode!=='cloud'||!user||!user.profiles)return;
  const need=staffIds().concat(D.audit.slice(0,300).map(a=>a.by)).filter(i=>i&&i!==me.id&&!askedNames.has(i));
  if(!need.length)return;
  uniq(need).forEach(i=>askedNames.add(i));
  try{const ps=await user.profiles(uniq(need));let any=false;Object.keys(ps||{}).forEach(i=>{if(ps[i]&&ps[i].name){names[i]=ps[i].name;any=true}});if(any)scheduleRender()}catch(e){}
}

/* ---------- modal ---------- */
function openModal(html){const m=$('#modal');m.innerHTML='<div class="sheet" role="dialog" aria-modal="true">'+html+'</div>';m.hidden=false;const f=m.querySelector('input:not([disabled]),select,textarea');if(f)f.focus()}
function closeModal(){const m=$('#modal');m.hidden=true;m.innerHTML='';DF=null}

/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');
  if(e.target.id==='modal'){closeModal();return}
  if(!b)return;
  if(b.tagName==='A')e.preventDefault();
  const a=b.dataset.act,v=b.dataset.v;
  switch(a){
    case'tab':tab=v;SEL.clear();render();break;
    case'go':tab=v;if(b.dataset.t)F.taskView=b.dataset.t;SEL.clear();shellTab=null;closeModal();render();break;
    case'login':{const n=$('#lg-name').value.trim();if(!n)return toast('اكتبي اسمك.');me=user.signIn(n);shellTab=null;render();boot2();break}
    case'logout':user.signOut();me={id:'',name:''};shellTab=null;render();break;
    case'closeModal':closeModal();break;
    case'newCase':openCaseForm();break;
    case'saveCase':saveCase(v);break;
    case'editCase':openCaseForm(S.cases[v]);break;
    case'caseFile':openCaseFile(v);break;
    case'entFile':openEntFile(v);break;
    case'opFor':closeModal();tab='ops';shellTab=null;render();setTimeout(()=>{const i=$('#op-code');if(i){i.value=v;i.focus()}},50);break;
    case'newDecision':openDecisionForm();break;
    case'newDecisionFor':openDecisionForm({code:v});break;
    case'renew':{const d=S.decisions[v];closeModal();openDecisionForm({code:d.code,text:d.text,donor:d.donor,renew:true,from:d.id,startAfter:decEnd(d),lines:(D.linesByDec[d.id]||[]).map(l=>({service:l.service,amount:l.amount,months:+l.months||spanMonths(l.startMonth,l.endMonth)}))});break}
    case'addLine':DF.lines.push(newLine(suggestStart(DF.issue)));drawLines();break;
    case'rmLine':if(DF.lines.length>1){DF.lines.splice(+v,1);drawLines()}else toast('يجب أن تبقى خدمة واحدة على الأقل.');break;
    case'saveDecision':saveDecision();break;
    case'stopOne':openStopForm([v],'موقوف','إيقاف أو سحب قرار');break;
    case'doStop':{const ids=b.dataset.ids.split(',');const r=$('#st-reason').value.trim();if(!r)return toast('اكتبي السبب.');stopDecisions(ids,$('#st-status').value,r);break}
    case'entKind':F.entKind=v;F.entStage='';SEL.clear();shellTab=null;render();break;
    case'stageF':{F.entStage=F.entStage===v?'':v;const sf=$('#f-entStage');if(sf)sf.value=F.entStage;render();break}
    case'generate':generateMonth();break;
    case'bulkSend':bulkSend();break;
    case'bulkTransfer':openTransfer([...SEL],true);break;
    case'transfer':openTransfer([v],false);break;
    case'saveTransfer':saveTransfer(b.dataset.ids.split(','),b.dataset.bulk==='1');break;
    case'clearSel':SEL.clear();render();break;
    case'confirm':openConfirm(v);break;
    case'saveConfirm':saveConfirm(v);break;
    case'approve':openApprove(v);break;
    case'saveApprove':approveHold(v);break;
    case'attempt':recordAttempt(v,b.dataset.a).then(()=>{if(!$('#modal').hidden&&b.dataset.a!=='notpaid')openEntFile(v)});break;
    case'saveNotPaid':saveNotPaid(v);break;
    case'stuckForm':openModal('<h2>تسجيل تعثر</h2><label style="display:block"><span class="muted small">السبب *</span><input id="sk-reason" style="width:100%"></label><div class="actions"><button class="btn bad" data-act="saveStuck" data-v="'+esc(v)+'">حفظ</button><button class="btn" data-act="closeModal">إلغاء</button></div>');break;
    case'saveStuck':markStuck(v);break;
    case'unstick':unstick(v).then(()=>openEntFile(v));break;
    case'refund':openRefund(v);break;
    case'saveRefund':saveRefund(v);break;
    case'settleForm':openModal('<h2>تسوية استرداد</h2><div class="fgrid"><label>معالجة الاستحقاق<select id="rs-how">'+opt(Object.keys(POLICIES).map(k=>[k,POLICIES[k]]),(S.refunds[v]&&S.refunds[v].how)||CFG.policy)+'</select></label></div><div class="actions"><button class="btn primary" data-act="settle" data-v="'+esc(v)+'">تأكيد التسوية</button><button class="btn" data-act="closeModal">إلغاء</button></div>');break;
    case'settle':settleRefund(v);break;
    case'renView':F.renView=v;SEL.clear();shellTab=null;render();break;
    case'selRen':(renewalLists()[F.renView]||[]).forEach(d=>SEL.add(d.id));render();break;
    case'renewSend':{const ids=[...SEL].filter(id=>S.decisions[id]);if(!ids.length)return toast('حددي قراراً واحداً على الأقل.');openModal('<h2>إرسال '+ids.length+' حالة للتجديد</h2><label style="display:block"><span class="muted small">ملاحظة (مثال: أُرسلت لإدارة البحث)</span><input id="rn-note" style="width:100%"></label><div class="actions"><button class="btn primary" data-act="renewDo" data-ids="'+ids.join(',')+'">إرسال</button><button class="btn" data-act="closeModal">إلغاء</button></div>');break}
    case'renewDo':sendRenewal(b.dataset.ids.split(','));break;
    case'renewNo':setRenewal(v,'لم يُجدد');break;
    case'closeEnded':{const ids=[...SEL].filter(id=>S.decisions[id]);if(!ids.length)return toast('حددي قراراً واحداً على الأقل.');stopDecisions(ids,'منتهي','انتهاء المدة');break}
    case'copyRen':copyRows([['رقم القرار','الكود','الاسم','الهاتف','المحافظة','الخدمات','آخر شهر']].concat((renewalLists()[F.renView]||[]).map(d=>{const c=S.cases[d.code]||{};return[d.no,d.code,c.name||'',c.phone||'',c.governorate||'',(D.linesByDec[d.id]||[]).map(l=>l.service).join(' + '),fmtMonth(decEnd(d))]})));break;
    case'taskView':F.taskView=v;SEL.clear();shellTab=null;render();break;
    case'newTask':openTaskForm();break;
    case'editTask':openTaskForm(v);break;
    case'saveTask':saveTask(v);break;
    case'openTask':openTask(v);break;
    case'taskStatus':setTaskStatus(v,b.dataset.s);break;
    case'returnTask':returnTask(v);break;
    case'completeAction':completeAction(v);break;
    case'assign':{const u=$('#as-user').value;if(!u)return toast('اختاري الموظف.');assignTasks([...SEL].filter(id=>D.vtasks.some(t=>t.id===id)),u);break}
    case'saveOp':saveOp();break;
    case'returnOpForm':openModal('<h2>إرجاع العملية للتصحيح</h2><label style="display:block"><span class="muted small">السبب *</span><input id="ro-note" style="width:100%"></label><div class="actions"><button class="btn bad" data-act="returnOp" data-v="'+esc(v)+'">إرجاع</button><button class="btn" data-act="closeModal">إلغاء</button></div>');break;
    case'returnOp':returnOp(v);break;
    case'rptView':F.rptView=v;shellTab=null;render();break;
    case'staffRpt':tab='reports';F.rptView='staff';F.rptStaff=v;shellTab=null;render();break;
    case'exportRpt':saveFile('report-'+F.rptView+'-'+month+'.csv',toCSV(RPT_ROWS));break;
    case'copyRpt':copyRows(RPT_ROWS);break;
    case'print':window.print();break;
    case'saveCfg':saveCfg();break;
    case'addSvc':{const n=$('#sv-name').value.trim();if(!n)return toast('اكتبي اسم الخدمة.');if(SERVICES.some(s=>s.name===n))return toast('الخدمة موجودة.');saveServices(SERVICES.concat([{name:n,kind:$('#sv-kind').value,cycle:$('#sv-cycle').value,follow:$('#sv-follow').value==='1'}]),'إضافة '+n);break}
    case'staffSearch':staffSearch();break;
    case'addStaff':guard('*',async()=>{await setDoc('staff',v,{id:v,role:'موظف',team:'',active:true,label:'',joinedAt:Date.now()});await logAudit('إضافة مستخدم',b.dataset.n||v,'موظف')}).then(ok=>ok&&toast('أُضيف.'));break;
    case'exportAll':exportAll();break;
    case'exportCsvAll':exportCsvAll();break;
    case'seed':seedDemo();break;
    case'wipe':openModal('<h2>مسح كل البيانات المحلية؟</h2><p>لا يمكن التراجع. صدّري نسخة أولاً.</p><div class="actions"><button class="btn bad" data-act="wipeDo">مسح</button><button class="btn" data-act="closeModal">إلغاء</button></div>');break;
    case'wipeDo':db.clearAll();closeModal();toast('تم المسح.');break;
  }
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='monthSel'){month=t.value;SEL.clear();render();return}
  if(t.id==='imp-file'){const f=t.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const o=JSON.parse(r.result);const d={};COLS.forEach(c=>{if(o[c])d[c]=o[c]});db.importAll(d);toast('تم الاستيراد.')}catch(err){toast('الملف غير صالح.')}};r.readAsText(f);return}
  if(t.dataset.f){F[t.dataset.f]=t.value;render();return}
  if(t.dataset.sel){t.checked?SEL.add(t.dataset.sel):SEL.delete(t.dataset.sel);render();return}
  if(t.dataset.sel2){t.checked?SEL.add(t.dataset.sel2):SEL.delete(t.dataset.sel2);return}
  if(t.dataset.tsel){t.checked?SEL.add(t.dataset.tsel):SEL.delete(t.dataset.tsel);renderAssignBar();return}
  if(t.hasAttribute('data-tselall')){taskList().forEach(x=>t.checked?SEL.add(x.id):SEL.delete(x.id));render();return}
  if(t.hasAttribute('data-selall')){const q=F.entQ.trim();entsOf(month).filter(x=>svc(x.service).kind===F.entKind&&(!F.entStage||stageOf(x)===F.entStage)&&(!q||String(x.code).includes(q)||caseName(x.code).includes(q))).forEach(x=>t.checked?SEL.add(x.id):SEL.delete(x.id));render();return}
  if(t.dataset.opstatus){const id=t.dataset.opstatus;const o=S.ops[id];guard('op',async()=>{await updDoc('ops',id,{status:t.value,statusAt:Date.now(),statusBy:me.id});await logAudit('تحديث عملية',o.code||o.dept,o.type+' ← '+t.value,{old:o.status,new:t.value})});return}
  if(t.dataset.svc!=null){const i=+t.dataset.svc,k=t.dataset.k;const list=SERVICES.map(s=>Object.assign({},s));list[i][k]=k==='follow'?t.value==='1':t.value;saveServices(list,list[i].name+' · '+k+' ← '+t.value);return}
  if(t.dataset.staff){const id=t.dataset.staff,k=t.dataset.k;const s=S.staff[id];const val=k==='active'?t.value==='1':t.value;
    if(id===me.id&&k==='role'&&val!=='مدير'&&D.staff.filter(x=>x.role==='مدير').length<2)return toast('يجب أن يبقى مدير واحد على الأقل.');
    guard('*',async()=>{await updDoc('staff',id,{[k]:val});await logAudit('تعديل مستخدم',nameOf(id),k+' ← '+t.value,{old:String(s[k]),new:String(val)})});return}
  if(DF){
    if(t.id==='df-code'){DF.code=t.value.trim();const n=$('#df-name');const c=S.cases[DF.code];if(n){n.value=c?c.name:DF.name;n.disabled=!!c}drawLines();return}
    if(t.id==='df-name'){DF.name=t.value;return}
    if(t.id==='df-issue'){DF.issue=t.value;const st=suggestStart(DF.issue);DF.lines.forEach(l=>{if(!l.tS){l.start=st;if(!l.tE)l.end=addMonths(st,l.months-1)}});drawLines();return}
    if(t.id==='df-override'){DF.override=t.value;return}
    const row=t.closest('.lrow');if(row&&t.dataset.lf)onLineChange(+row.dataset.i,t.dataset.lf,t.value);
  }
});
document.addEventListener('input',e=>{const t=e.target;if(t.dataset&&t.dataset.f&&t.tagName==='INPUT'){F[t.dataset.f]=t.value;scheduleRender()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#modal').hidden)closeModal()});

/* =====================================================================
   9) Boot
   ===================================================================== */
function headerChips(){
  const m=$('#modeChip');
  if(conn.mode==='cloud'){m.textContent='قاعدة بيانات مشتركة';m.className='chip ok'}
  else if(conn.mode==='local'){m.textContent='وضع محلي · هذا المتصفح فقط';m.className='chip demo'}
  else{m.textContent='غير متصل';m.className='chip no'}
  $('#meChip').innerHTML=me.id?('أنت: '+esc(me.name||nameOf(me.id))+(conn.mode==='local'?' · <a href="#" data-act="logout">تغيير</a>':'')):'—';
  if(canWrite===false){$('#roleChip').className='chip no';document.documentElement.classList.add('ro')}
}
function subscribe(){
  const timer=setTimeout(()=>{if(Object.keys(loaded).length<COLS.length)$('#loadNote').innerHTML='<div class="notice">تعذر الوصول لكل البيانات حالياً، وقد تكون المعروضة غير محدّثة.</div>'},10000);
  COLS.forEach(col=>{
    const q=col==='audit'?db.collection(col).orderBy('ts','desc').limit(1000):db.collection(col);
    q.onSnapshot(snap=>{
      const m={};snap.docs.forEach(d=>{m[d.id]=Object.assign({},d.data(),{id:d.id})});
      S[col]=m;loaded[col]=true;
      if(Object.keys(loaded).length>=COLS.length){clearTimeout(timer);$('#loadNote').innerHTML=''}
      scheduleRender();
    },err=>{$('#loadNote').innerHTML='<div class="notice">تعذر قراءة '+esc(col)+' ('+esc(err&&err.code||'خطأ')+').</div>'});
  });
}
let subscribed=false;
function boot2(){headerChips();if(!subscribed&&db){subscribed=true;subscribe()}}
async function boot(){
  $('#monthSel').innerHTML=monthOpts(month,'2024-01','2030-12');
  render();
  conn=await window.MersalStore.connect();
  db=conn.db;user=conn.user;downloads=conn.downloads;
  if(conn.mode==='cloud'){
    const lim=(p,ms)=>Promise.race([p,new Promise(r=>setTimeout(()=>r(null),ms))]);
    try{const m=await lim(user.me(),6000);if(m)me={id:m.id||'',name:m.name||''}}catch(e){}
    try{canWrite=await lim(user.can('data.write'),6000)}catch(e){}
    try{isOwner=!!(await lim(user.isOwner(),6000))}catch(e){}
  }else if(conn.mode==='local'){
    me=await user.me();
  }else{
    $('#loadNote').innerHTML='<div class="notice">قاعدة البيانات غير متاحة في هذا العرض. افتحي الصفحة من رابطها بعد تسجيل الدخول.</div>';
  }
  headerChips();
  if(db){subscribed=true;subscribe()}
  render();
}

/* =====================================================================
   10) Demo data (local mode only) — clearly fictitious, for testing the cycle
   ===================================================================== */
function seedDemo(){
  if(conn.mode!=='local')return toast('البيانات التجريبية متاحة في الوضع المحلي فقط.');
  if(D.cases.length&&!confirmSeed){confirmSeed=true;return toast('توجد بيانات بالفعل. اضغطي مرة أخرى لاستبدالها ببيانات تجريبية.')}
  const out={};COLS.forEach(c=>out[c]={});
  let r=7;const rnd=()=>{r=(r*16807)%2147483647;return(r-1)/2147483646};const pick=a=>a[Math.floor(rnd()*a.length)];
  const now=Date.now();const M=curMonth;
  const staff=[['u_سارة_(تجريبي)','سارة (تجريبي)','مشرف','ملف التواصل'],['u_منى_(تجريبي)','منى (تجريبي)','موظف','ملف التواصل'],['u_أحمد_(تجريبي)','أحمد (تجريبي)','مالي','ملف المالي'],['u_هبة_(تجريبي)','هبة (تجريبي)','موظف','ملف العيني']];
  out.staff[me.id]={id:me.id,role:'مدير',team:'عام',active:true,label:me.name,joinedAt:now-200*DAY};
  staff.forEach(s=>out.staff[s[0]]={id:s[0],role:s[2],team:s[3],active:true,label:s[1],joinedAt:now-180*DAY});
  const sid=()=>pick(staff)[0];
  const first=['أمل','فاطمة','مريم','سعاد','هالة','نادية','زينب','رحاب','سامية','منال','عائشة','خديجة','إيمان','نجلاء','وفاء','حنان'];
  const last=['محمد','أحمد','إبراهيم','عبد الله','حسن','علي','عثمان','آدم','يوسف','صالح'];
  const tsIn=(m,day)=>new Date(m+'-'+pad(Math.min(28,Math.max(1,day)))+'T'+pad(9+Math.floor(rnd()*7))+':'+pad(Math.floor(rnd()*60))+':00').getTime();
  const op=(type,m,day,by,o)=>{const t=TASK_BY_NAME[type]||{team:'عام',weight:1};const id='o'+Object.keys(out.ops).length;const ts=tsIn(m,day);out.ops[id]=Object.assign({id:id,type:type,team:t.team,weight:t.weight,scope:o&&o.code?'حالة':'عامة',code:'',dept:'',date:isoOf(new Date(ts)),status:'تم',result:'',notes:'',count:1,auto:true,by:by,createdAt:ts},o||{});};
  for(let i=1;i<=28;i++){
    const code=String(90000+i);
    const nat=pick(['مصري','مصري','مصري','سوداني','سوري','يمني']);
    out.cases[code]={id:code,code:code,name:pick(first)+' '+pick(last)+' (تجريبي)',nationality:nat,gender:'أنثى',familySize:2+Math.floor(rnd()*5),governorate:pick(['القاهرة','الجيزة','القليوبية','الإسكندرية','الشرقية']),phone:'010'+String(10000000+Math.floor(rnd()*89999999)),recvMethod:i%7===0?'':pick(['محفظة إلكترونية','محفظة إلكترونية','حوالة بريدية','كاش من الفرع']),recvPhone:'011'+String(10000000+Math.floor(rnd()*89999999)),unhcr:nat==='مصري'?'':'555-'+(100000+i),dataConfirmed:i<=20,createdAt:now-150*DAY,createdBy:me.id};
    const start=addMonths(M,-(i%6)-(i>20?0:2));const months=[3,6,6,9,12][i%5];const end=addMonths(start,months-1);
    const did='d'+i;const dno='ق-'+pad(i);
    out.decisions[did]={id:did,no:dno,code:code,text:'قرار لجنة تجريبي',donor:'',issueDate:addMonths(start,-1)+'-10',status:'مستمر',createdAt:tsIn(addMonths(start,-1),10),createdBy:staff[0][0]};
    const svcName=i%9===0?'كارت كازيون (الكارت الغذائي)':(i%5===0?'بدل حفاضات':'كفالة شهرية');
    const amount=svcName==='كفالة شهرية'?pick([500,750,1000,1500]):(svcName==='بدل حفاضات'?400:600);
    const lid=did+'_1';
    out.lines[lid]={id:lid,decId:did,code:code,service:svcName,amount:amount,months:months,startMonth:start,endMonth:end,mismatchNote:''};
    op('تسجيل قرار',addMonths(start,-1),11,staff[0][0],{code:code,result:dno});
    if(i%8===0){const l2=did+'_2';out.lines[l2]={id:l2,decId:did,code:code,service:'أثاث',amount:3500,months:1,startMonth:start,endMonth:start,mismatchNote:''}}
    /* entitlements for past months and this month */
    for(let k=-3;k<=0;k++){
      const m=addMonths(M,k);if(m<start||m>end)continue;
      const lines=[out.lines[lid]].concat(out.lines[did+'_2']&&out.lines[did+'_2'].startMonth===m?[out.lines[did+'_2']]:[]);
      lines.forEach(l=>{
        const s=svc(l.service);const id=l.id+'_'+m;const isNew=m===start&&i>20;
        const e={id:id,code:code,decId:did,lineId:l.id,service:l.service,kind:s.kind,month:m,base:l.amount,amount:l.amount,carried:[],needsConfirm:isNew,sent:false,attempts:[],followResult:null,v2:true,createdAt:tsIn(m,1),createdBy:me.id};
        const past=k<0;const roll=rnd();
        if(isNew&&(past||roll<.5)){const by=staff[1][0];e.confirmedAt=tsIn(m,3);e.confirmedBy=by;e.confirmNote='تم الرد وتأكيد البيانات';op('مكالمة تاكيد بيانات',m,3,by,{code:code,result:'تم الرد وتأكيد البيانات'})}
        const ready=!isNew||e.confirmedAt;
        if(ready&&(past||roll<.75)){e.sent=true;e.sentAt=tsIn(m,5);e.sentBy=staff[2][0];e.batchId='B-'+m+'-'+s.kind}
        if(e.sent&&s.kind==='مالي'&&(past||roll<.6)){e.transfer={amount:l.amount,method:out.cases[code].recvMethod||'محفظة إلكترونية',date:m+'-08',ref:'TRX-'+m.replace('-','')+'-'+code,by:staff[2][0],at:tsIn(m,8)}}
        const canF=e.sent&&(s.kind!=='مالي'||e.transfer)&&needsFollow(e);
        if(canF&&(past||roll<.4)){
          const by=pick([staff[1][0],staff[3][0],staff[0][0]]);const x=rnd();
          if(x<.72){e.attempts=[{at:tsIn(m,12),by:by,answered:true,result:'تم الصرف'}];e.followResult='تم الصرف';e.followAt=tsIn(m,12);e.followBy=by;op('مكالمة متابعة صرف',m,12,by,{code:code,result:'رد · تم الصرف'})}
          else if(x<.86){e.attempts=[12,14,17].map(d=>({at:tsIn(m,d),by:by,answered:false,result:'لم يرد'}));e.followResult='لم يتم الصرف';e.noAnswer=true;e.staffDone=true;e.followAt=tsIn(m,17);e.followBy=by;[12,14,17].forEach(d=>op('مكالمة متابعة صرف',m,d,by,{code:code,result:'لم يرد'}))}
          else if(x<.95){e.attempts=[{at:tsIn(m,12),by:by,answered:true,result:'لم يتم الصرف'}];e.followResult='لم يتم الصرف';e.followAt=tsIn(m,12);e.followBy=by;e.notPaid={reason:'رقم المحفظة خطأ',action:'تصحيح رقم المحفظة وإعادة التحويل',note:'',at:tsIn(m,12),by:by};op('مكالمة متابعة صرف',m,12,by,{code:code,result:'رد · لم يتم الصرف'})}
          else{e.attempts=[{at:tsIn(m,12),by:by,answered:false,result:'لم يرد'}];op('مكالمة متابعة صرف',m,12,by,{code:code,result:'لم يرد'})}
        }else if(canF&&e.transfer)e.followAssignee=pick([staff[1][0],staff[3][0]]);
        if(e.needsConfirm&&!e.confirmedAt)e.confAssignee=staff[1][0];
        out.ents[id]=e;
      });
    }
  }
  /* batches, a refund, ops volume, manual tasks */
  Object.values(out.ents).forEach(e=>{if(e.batchId){const b=out.batches[e.batchId]=out.batches[e.batchId]||{id:e.batchId,month:e.month,kind:e.kind,count:0,total:0,by:e.sentBy,createdAt:e.sentAt,entIds:[]};b.count++;b.total+=e.amount;b.entIds.push(e.id)}});
  Object.values(out.batches).forEach(b=>op(b.kind==='عيني'?'تسليم مساعدة عينية':(b.kind==='كارت'?'تسليم كروت كازيون':'إرسال ضمن دفعة الصرف'),b.month,5,b.by,{dept:'دفعة '+b.id,count:b.count,result:b.count+' حالة'}));
  const np=Object.values(out.ents).find(e=>e.notPaid&&e.transfer);
  if(np){out.refunds.r1={id:'r1',entId:np.id,code:np.code,month:np.month,service:np.service,transferAmount:np.transfer.amount,amount:np.transfer.amount,date:np.month+'-20',reason:'رقم محفظة خطأ',ref:np.transfer.ref,type:'كلي',settlement:'معلقة',how:'carry',by:staff[2][0],createdAt:tsIn(np.month,20)};op('تسجيل استرداد',np.month,20,staff[2][0],{code:np.code,result:'كلي · رقم محفظة خطأ'})}
  for(let k=-3;k<=0;k++){const m=addMonths(M,k);for(let j=0;j<14;j++){const t=pick(TASKS.slice(0,70));op(t.name,m,1+Math.floor(rnd()*27),sid(),{code:t.scope==='حالة'?String(90001+Math.floor(rnd()*28)):'',dept:t.scope==='عامة'?pick(['إدارة الحسابات','إدارة الحركة','المخزن','لجنة القرارات']):'',status:rnd()<.85?'تم':'جاري',result:'تم',auto:false})}}
  out.tasks.t1={id:'t1',title:'مراجعة قبل إرسال طلب التشغيل',type:'مراجعة قبل ارسال طلب التشغيل',code:'',assignee:staff[0][0],status:'جديدة',createdAt:now-4*DAY,createdBy:me.id,due:now-1*DAY,notes:'دفعة هذا الشهر',returned:0};
  out.tasks.t2={id:'t2',title:'تجهيز الشيت الشهري للمتابعات',type:'تجهيز الشيت الشهري للمتابعات الشهرية',code:'',assignee:staff[1][0],status:'مكتملة',createdAt:now-6*DAY,createdBy:me.id,due:now-3*DAY,completedAt:now-4*DAY,completedBy:staff[1][0],result:'تم التجهيز',returned:0};
  out.audit.a0={id:'a0',ts:now,by:me.id,action:'تحميل بيانات تجريبية','target':'النظام',detail:'بيانات وهمية للتجربة فقط'};
  db.importAll(out);confirmSeed=false;toast('تم تحميل بيانات تجريبية (28 حالة وهمية).');
}
let confirmSeed=false;

boot();
})();
