const { chromium } = require('playwright');
(async()=>{
  const out=process.argv[2]||require('os').tmpdir();
  const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message+' '+(e.stack||'').split('\n')[1]));p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
  const toast=async()=>{await p.waitForTimeout(250);return(await p.$eval('#toast',t=>t.innerText)).trim()};
  const S=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('mersal-social-v2')));
  const log=(...a)=>console.log(...a);
  await p.goto('file://'+require('path').resolve(__dirname,process.env.TARGET||'../index.html'));await p.waitForTimeout(600);
  await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForTimeout(500);
  await p.fill('#lg-name','منسقة الاختبار');await p.click('[data-act=login]');await p.waitForTimeout(300);

  // 1) quick decision with a NEW code creates the case + decision
  await p.click('#tabs button[data-v="cases"]');await p.click('[data-act=newDecision]');
  await p.fill('#df-code','5001');await p.dispatchEvent('#df-code','change');await p.fill('#df-name','حالة اختبار أولى');await p.dispatchEvent('#df-name','change');
  await p.fill('#df-issue','2026-10-05');await p.dispatchEvent('#df-issue','change');
  await p.fill('.lrow input[data-lf=amount]','1000');await p.dispatchEvent('.lrow input[data-lf=amount]','change');
  await p.fill('.lrow input[data-lf=months]','3');await p.dispatchEvent('.lrow input[data-lf=months]','change');
  await p.click('[data-act=saveDecision]');log('decision:',await toast());
  let st=await S();log('case created:',!!st.cases['5001'],'lines:',Object.values(st.lines).map(l=>l.startMonth+'..'+l.endMonth));
  // duplicate/overlap blocked
  await p.click('[data-act=newDecision]');await p.fill('#df-code','5001');await p.dispatchEvent('#df-code','change');
  await p.fill('#df-issue','2026-10-05');await p.dispatchEvent('#df-issue','change');
  await p.fill('.lrow input[data-lf=amount]','800');await p.dispatchEvent('.lrow input[data-lf=amount]','change');
  await p.click('[data-act=saveDecision]');log('overlap:',await toast());await p.click('[data-act=closeModal]');

  // 2) generate November entitlements → new case needs confirmation; send is blocked
  await p.selectOption('#monthSel','2026-11');
  await p.click('#tabs button[data-v="monthly"]');await p.click('[data-act=generate]');await p.waitForTimeout(400);log('generate:',await toast());
  st=await S();let e=Object.values(st.ents)[0];log('ent needsConfirm:',e.needsConfirm);
  await p.check(`[data-sel="${e.id}"]`);await p.waitForTimeout(150);
  log('send button disabled while unconfirmed:',await p.$eval('[data-act=bulkSend]',x=>x.disabled));
  // 3) confirmation call: requires receive method
  await p.click(`[data-act=confirm][data-v="${e.id}"]`);await p.selectOption('#cf-result','تم الرد وتحديث البيانات');
  await p.fill('#cf-phone','01012345678');await p.click('[data-act=saveConfirm]');log('confirm w/o method:',await toast());
  await p.selectOption('#cf-recvMethod','محفظة إلكترونية');await p.fill('#cf-recvPhone','01112345678');await p.click('[data-act=saveConfirm]');log('confirm:',await toast());
  st=await S();log('case confirmed:',st.cases['5001'].dataConfirmed,'change history entries:',Object.keys(st.changes).length);
  // 4) send in batch
  await p.check(`[data-sel="${e.id}"]`).catch(()=>{});await p.waitForTimeout(150);
  await p.click('[data-act=bulkSend]');log('send:',await toast());
  // 5) transfer validation then transfer
  await p.click(`[data-act=transfer][data-v="${e.id}"]`);await p.click('[data-act=saveTransfer]');log('transfer w/o ref:',await toast());
  await p.selectOption('#tr-method','محفظة إلكترونية');await p.fill('#tr-ref','TRX-777');await p.click('[data-act=saveTransfer]');log('transfer:',await toast());
  st=await S();e=st.ents[e.id];log('stage after transfer: transfer=',!!e.transfer,'followResult=',e.followResult);
  // 6) follow-up: 3 unanswered attempts
  await p.click('#tabs button[data-v="follow"]');await p.selectOption('#f-fuView','all');await p.waitForTimeout(200);
  for(let i=0;i<3;i++){await p.click(`[data-act=attempt][data-v="${e.id}"][data-a="0"]`);log('attempt',i+1,':',await toast())}
  st=await S();e=st.ents[e.id];log('after 3: followResult=',e.followResult,'noAnswer=',e.noAnswer,'staffDone=',e.staffDone);
  // 7) refund full
  await p.click('#tabs button[data-v="monthly"]');await p.waitForTimeout(150);
  await p.click(`[data-act=refund][data-v="${e.id}"]`);await p.selectOption('#rf-reason','عدم الاستلام خلال المدة');await p.click('[data-act=saveRefund]');log('refund:',await toast());
  st=await S();log('refund type:',Object.values(st.refunds)[0].type);
  // 8) December: entitlement on hold because November was not received
  await p.selectOption('#monthSel','2026-12');await p.click('[data-act=generate]');await p.waitForTimeout(300);
  st=await S();const dec=Object.values(st.ents).find(x=>x.month==='2026-12');
  const stage=await p.$eval('#dyn',d=>d.innerText.includes('معلّق على الشهر السابق'));log('Dec hold shown:',stage);
  await p.click(`[data-act=approve][data-v="${dec.id}"]`);await p.selectOption('#ap-how','carry');await p.fill('#ap-reason','تم التواصل');await p.click('[data-act=saveApprove]');log('approve:',await toast());
  st=await S();log('Dec amount after carry:',st.ents[dec.id].amount);
  // 9) January: no entitlement after decision end (Nov..Jan) → Feb nothing
  await p.selectOption('#monthSel','2027-02');await p.click('[data-act=generate]');log('after end:',await toast());
  // 10) renewal list (2 months before end Jan 2027 from Nov)
  await p.selectOption('#monthSel','2026-11');await p.click('#tabs button[data-v="renewal"]');await p.waitForTimeout(200);
  log('renewal list has 5001:',await p.$eval('#dyn',d=>d.innerText.includes('5001')));
  await p.click('[data-act=selRen]');await p.click('[data-act=renewSend]');await p.click('[data-act=renewDo]');log('renewal:',await toast());
  // 11) manual op, task assign, case edit history
  await p.click('#tabs button[data-v="ops"]');await p.fill('#op-code','5001');await p.fill('#op-result','تم');await p.click('[data-act=saveOp]');log('op:',await toast());
  st=await S();const lastOp=Object.values(st.ops).sort((a,b)=>b.createdAt-a.createdAt)[0];log('op has by+createdAt:',!!lastOp.by,!!lastOp.createdAt);
  await p.click('#tabs button[data-v="cases"]');await p.click('[data-act=caseFile][data-v="5001"]');await p.click('[data-act=editCase]');await p.selectOption('#c-governorate','الجيزة');await p.click('[data-act=saveCase]');log('edit:',await toast());
  st=await S();log('changes:',Object.values(st.changes).map(c=>c.diffs.map(d=>d.label+':'+d.old+'→'+d.new).join(',')));
  await p.click('[data-act=closeModal]').catch(()=>{});
  await p.click('#tabs button[data-v="reports"]');await p.waitForTimeout(200);
  await p.screenshot({path:out+'/report.png',fullPage:true});
  await p.setViewportSize({width:400,height:850});await p.click('#tabs button[data-v="monthly"]').catch(()=>{});await p.waitForTimeout(200);
  log('phone horizontal overflow:',await p.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1));
  log('ERRORS:',errs.length?errs.join('\n'):'none');
  await b.close();
})();
