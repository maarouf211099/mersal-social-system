/* Storage adapter.
   - Inside claude.ai (artifact): uses the shared `db` and `user` capabilities.
   - Anywhere else (GitHub Pages, local file): a localStorage store with the same API,
     so the app can be tested and demoed without a server. Data then lives in this browser only. */
(function(){
'use strict';

const LS_KEY='mersal-social-v2';
const LS_USER='mersal-social-v2-user';

function readLS(){try{return JSON.parse(localStorage.getItem(LS_KEY)||'{}')||{}}catch(e){return{}}}
function writeLS(d){try{localStorage.setItem(LS_KEY,JSON.stringify(d));return true}catch(e){return false}}

/* Minimal Firestore-like local store: collection(c).doc(id).set/update/get/delete, collection(c).onSnapshot */
function LocalDB(){
  let data=readLS();
  const subs={};
  function emit(col){
    const docs=Object.entries(data[col]||{}).map(([id,v])=>({id:id,data:()=>JSON.parse(JSON.stringify(v))}));
    (subs[col]||[]).forEach(fn=>{try{fn({docs:docs,metadata:{fromCache:false}})}catch(e){console.error(e)}});
  }
  function save(col){
    if(!writeLS(data)){const e=new Error('امتلأت مساحة التخزين في المتصفح. صدّري نسخة احتياطية واحذفي بيانات قديمة.');e.code='quota_exceeded';throw e}
    emit(col);
  }
  window.addEventListener('storage',ev=>{if(ev.key===LS_KEY){data=readLS();Object.keys(subs).forEach(emit)}});
  function merge(a,b){
    const out=Object.assign({},a);
    Object.keys(b).forEach(k=>{
      const v=b[k];
      if(v&&typeof v==='object'&&!Array.isArray(v)&&out[k]&&typeof out[k]==='object'&&!Array.isArray(out[k]))out[k]=merge(out[k],v);
      else out[k]=v;
    });
    return out;
  }
  function docRef(col,id){
    return{
      id:id,
      async get(){const v=(data[col]||{})[id];return{id:id,exists:!!v,data:()=>v?JSON.parse(JSON.stringify(v)):undefined}},
      async set(v){data[col]=data[col]||{};data[col][id]=JSON.parse(JSON.stringify(v));save(col)},
      async update(v){
        data[col]=data[col]||{};
        if(!data[col][id]){const e=new Error('المستند غير موجود');e.code='invalid_argument';throw e}
        data[col][id]=merge(data[col][id],JSON.parse(JSON.stringify(v)));save(col);
      },
      async delete(){if(data[col])delete data[col][id];save(col)}
    };
  }
  function colRef(col){
    const q={
      doc:id=>docRef(col,id),
      orderBy:()=>q,limit:()=>q,where:()=>q,
      onSnapshot(fn){(subs[col]=subs[col]||[]).push(fn);setTimeout(()=>emit(col),0);return()=>{subs[col]=subs[col].filter(f=>f!==fn)}},
      async get(){const docs=Object.entries(data[col]||{}).map(([id,v])=>({id:id,data:()=>v}));return{docs:docs}}
    };
    return q;
  }
  return{
    local:true,
    collection:colRef,
    exportAll:()=>JSON.parse(JSON.stringify(data)),
    importAll(obj){data=obj||{};writeLS(data);Object.keys(data).forEach(emit);Object.keys(subs).forEach(emit)},
    clearAll(){data={};writeLS(data);Object.keys(subs).forEach(emit)}
  };
}

/* Local "user": the person picks or types their name once on this device. */
function LocalUser(){
  let cur=null;try{cur=JSON.parse(localStorage.getItem(LS_USER)||'null')}catch(e){}
  return{
    local:true,
    async me(){return cur||{id:'',name:''}},
    async can(){return true},
    isOwner(){return false},
    async profiles(ids){const o={};ids.forEach(i=>o[i]={name:''});return o},
    signIn(name){
      const id='u_'+name.trim().replace(/\s+/g,'_');
      cur={id:id,name:name.trim()};
      try{localStorage.setItem(LS_USER,JSON.stringify(cur))}catch(e){}
      return cur;
    },
    signOut(){cur=null;try{localStorage.removeItem(LS_USER)}catch(e){}}
  };
}

window.MersalStore={
  async connect(){
    const c=window.claude;
    const lim=(p,ms)=>Promise.race([p,new Promise(r=>setTimeout(()=>r(null),ms))]);
    if(c&&c.use){
      let user=null,db=null;
      try{user=await lim(c.use('user'),10000)}catch(e){}
      try{db=await lim(c.use('db'),10000)}catch(e){}
      let downloads=null;try{downloads=await lim(c.use('downloads'),5000)}catch(e){}
      if(db)return{mode:'cloud',db:db,user:user,downloads:downloads};
      return{mode:'none',db:null,user:user,downloads:downloads};
    }
    return{mode:'local',db:LocalDB(),user:LocalUser(),downloads:null};
  }
};
})();
