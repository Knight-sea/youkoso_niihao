/* ================================================================
   Cote-OS v5.3  ·  app.js
   ─────────────────────────────────────────────────────────────────
   Changes from v5.2:
   • Taskbar fix: pure flex 3-zone (left flex:1 | center flex:0 |
     right flex:1). No position:absolute. Buttons always hittable.
   • Theme Engine: Classic / Light / Dark via CSS custom properties
     on <html data-theme>. Saved to localStorage. Flyout in gear
     tray drops down vertically below the 🎨 button.
   • s-card v5.3: 3:2 column ratio. Name font 1.62rem (1.5× boost).
     White "PP"/"PRP" unit text retained.
   • Profile sidebar: student name 1.86rem (2.0× boost).
   • History page kept (separate view via gear menu).
   • ID logic: prefix = 7+(6-grade)+(year-1); seq reset per grade.
   • Bulk Delete, fmtPP K/M/B/T, navigateReplace for randomise.
   ================================================================ */
'use strict';

/* ──────────────────────────────────────────────────────────────────
   CONSTANTS
────────────────────────────────────────────────────────────────── */
const GRADES      = [1, 2, 3, 4, 5, 6];
const CLASS_IDS   = [0, 1, 2, 3, 4];
const RANK_LABELS = ['A', 'B', 'C', 'D', 'E'];
const STATS_KEYS  = ['language', 'reasoning', 'memory', 'thinking', 'physical', 'mental'];
const MONTHS_JP   = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const HISTORY_MAX = 60;
const NUM_SLOTS   = 5;
const TOP_N       = 100;
const APP_VER     = '5.3';
const THEME_KEY   = 'CoteOS_theme';

const slotKey = n => `CoteOS_v3_Slot${n}`;

const JP = {
  language:'言語力', reasoning:'推論力', memory:'記憶力',
  thinking:'思考力', physical:'身体能力', mental:'精神力',
  name:'氏名', gender:'性別', dob:'生年月日',
  grade:'学年', cls:'クラス',
  pp:'プライベートポイント', protect:'プロテクトポイント',
  specialAbility:'特殊能力',
  active:'在籍', expelled:'退学', graduate:'卒業生', incoming:'入学予定',
  male:'男', female:'女',
  expel:'退学処分', reinstate:'復帰',
  graduates:'卒業生', incoming2:'入学予定',
  ranking:'ランキング',
  history:'月次履歴',
  gradeN: g => `${g}年生`,
  clsDef: (g, r) => `${g}年${r}組`,
};

/* ──────────────────────────────────────────────────────────────────
   RANDOMISER DATA
────────────────────────────────────────────────────────────────── */
const SURNAMES = [
  "佐藤","鈴木","高橋","田中","渡辺","伊藤","山本","中村","小林","加藤",
  "吉田","山田","佐々木","山口","松本","井上","木村","林","斎藤","清水",
  "山崎","池田","橋本","阿部","森","石川","前田","藤田","小川","岡田",
  "後藤","長谷川","石井","村上","近藤","坂本","遠藤","青木","藤井","西村",
  "福田","太田","三浦","岡本","松田","中島","中川","原田","小野","竹内",
  "金子","和田","中野","原","藤原","村田","上田","横山","宮崎","谷口",
  "大野","高木","宮本","久保","松井","内田","工藤","野口","杉山","吉川",
  "菊地","千葉","桐島","大塚","平野","市川","成田","須藤","杉本","片山",
  "土屋","川口","米田","菅原","服部","河野","中山","石田","丸山","松尾",
  "今井","河合","藤本","田村","安藤","永田","古川","石原","長田","武田",
  "岩田","水野","沢田","中井","福島","辻","大西","浜田","西田","松岡",
  "北村","相沢","桑原","黒田","新井","宮田","山内","堀","野田","菅野",
  "川上","榎本","大島","飯田","岸","南","上野","泉","田口","高田",
];
const MALE_NAMES = [
  "蒼","湊","蓮","陽翔","律","悠真","暖","颯","樹","翔",
  "大和","悠人","凛","碧","陽太","隼人","琉生","晴翔","光","仁",
  "誠","剛","健太","雄大","勇気","拓海","直樹","慎也","雅人","洸",
  "陸斗","智也","昴","俊介","亮太","大輝","海斗","悠斗","孝太","渉",
  "将吾","龍之介","一輝","駿","瑛太","翼","颯太","響","唯斗","修平",
  "蒼太","空","煌","幹太","優斗","航平","弦","航","昂","豪",
  "侑","凌","奏","大樹","和樹","宗一郎","快","遼","涼太","康平",
  "義人","竜馬","壮真","晃","桜介","玲央","彪","隆司","雄斗","聡",
  "昇太","芯","烈","稜","廉","遥人","晴人","波瑠","勝","徹",
  "泰輝","真尋","善","悠雅","克哉","光輝","心音","歩夢","朋也","晴",
  "優也","陽一","稜真","陽平","凱","寛大","堅太","達也","聖也","柊",
  "真斗","千尋","鷹","奏太","葵","光太郎","澪斗","虎太郎","司","朔",
];
const FEMALE_NAMES = [
  "陽葵","凛","結菜","杏","莉子","美咲","葵","愛","心春","桜",
  "咲良","琴音","七海","芽依","彩花","結衣","梨花","菜々","遥","優花",
  "日向","夏希","明日香","絵里","奈々","千夏","楓","瑠璃","優奈","美羽",
  "麻衣","沙耶","瑛梨","真央","あかり","紬","詩","澪","柚希","佳奈",
  "恵美","由奈","萌","依子","千尋","花音","渚","晴菜","彩乃","奈緒",
  "あんな","理沙","美月","侑奈","柚葉","茜","朱莉","涼花","恋","紅葉",
  "愛菜","夢","晴香","芹奈","里桜","早希","珠希","亜美","初音","鈴",
  "音羽","空","光","那奈","妃菜","桃花","蓮花","藍","真緒","希実",
  "優希","心愛","瑚子","碧","芙美","蒼葉","莉緒","依里","梢","芽生",
  "千紘","乃愛","玲奈","ひより","実来","真彩","花恋","朝日奈","みう","奈央",
  "栞奈","悠里","光莉","美結","りん","詩乃","萌々","菊乃","波奈","颯香",
  "椎奈","絢音","珊瑚","麗那","このは","倖","妃奈","帆夏","乙葉","琴葉",
];
const CLASS_STAT_CFG = {
  0:{ avg:[6,8],  rare:[4,12], focus:['reasoning','memory','thinking'] },
  1:{ avg:[5,7],  rare:[4,10], focus:['language','memory'] },
  2:{ avg:[4,6],  rare:[2,10], focus:['physical','mental'] },
  3:{ avg:[5,5],  rare:[3,8],  focus:['physical','mental'] },
  4:{ avg:[1,6],  rare:[7,13], focus:[] },
};
const PP_RANGE = {
  0:[50000,100000], 1:[30000,80000], 2:[20000,60000],
  3:[10000,50000],  4:[0,50000],
};

function rndInt(lo,hi){ return Math.floor(Math.random()*(hi-lo+1))+lo; }
function rndPick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function genStat(cid,key){
  const cfg=CLASS_STAT_CFG[cid]; const rare=Math.random()<0.20;
  const [lo,hi]=rare?cfg.rare:cfg.avg; let v=lo===hi?lo:rndInt(lo,hi);
  if(cfg.focus.includes(key)) v=Math.min(15,v+1); return v;
}
function genDOB(grade,sysYear){
  let y=2010+(6-grade)+(sysYear-1); const m=rndInt(1,12),d=rndInt(1,28);
  if(m<=3) y+=1;
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function genStudentName(gender){
  return rndPick(SURNAMES)+rndPick(gender==='M'?MALE_NAMES:FEMALE_NAMES);
}

/* ──────────────────────────────────────────────────────────────────
   RUNTIME STATE
────────────────────────────────────────────────────────────────── */
let currentSlot = 1;
let state       = null;
let navStack    = [];
let selectMode  = false;
let selectedIds = new Set();

function newState(){
  return { year:1, month:4, students:[], classes:[], history:[], nextId:1 };
}

/* ──────────────────────────────────────────────────────────────────
   THEME ENGINE
────────────────────────────────────────────────────────────────── */
const THEMES = ['classic','light','dark'];

function applyTheme(name){
  if(!THEMES.includes(name)) name='classic';
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem(THEME_KEY, name);
  // Update active marker on flyout options
  document.querySelectorAll('.tf-opt').forEach(b=>{
    b.classList.toggle('active', b.dataset.theme===name);
  });
}

function loadTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved||'classic');
}

/* ──────────────────────────────────────────────────────────────────
   STUDENT ID  — v5.1+ precise logic
   Prefix = 7+(6-grade)+(state.year-1), padded 3 digits
   Sequence resets to 0001 per grade in initial generation
────────────────────────────────────────────────────────────────── */
function gradePrefix(grade){
  if(typeof grade!=='number'||grade<1||grade>6) return '000';
  return String(7+(6-grade)+(state.year-1)).padStart(3,'0');
}
function genStudentId(grade){
  const seq=String(state.nextId).padStart(4,'0'); state.nextId++;
  return gradePrefix(grade)+seq;
}

/* ──────────────────────────────────────────────────────────────────
   UTILITIES
────────────────────────────────────────────────────────────────── */
function esc(s){
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escA(s){ return String(s??'').replace(/"/g,'&quot;'); }

function toast(msg,cls='',ms=2800){
  const el=document.getElementById('toast'); if(!el) return;
  el.textContent=msg; el.className=cls?`on ${cls}`:'on';
  clearTimeout(toast._t); toast._t=setTimeout(()=>{ el.className=''; },ms);
}
function fmtDate(y,m){ return `Year ${y} · ${MONTHS_JP[m-1]}`; }

function fmtPP(v){
  const a=Math.abs(v);
  if(a>=1e12) return (v/1e12).toFixed(1)+'T';
  if(a>=1e9)  return (v/1e9).toFixed(1)+'B';
  if(a>=1e6)  return (v/1e6).toFixed(1)+'M';
  if(a>=1e3)  return (v/1e3).toFixed(1)+'K';
  return String(v);
}
function ppCol(v){ return v>0?'pos':v<0?'neg':'neu'; }

/* ──────────────────────────────────────────────────────────────────
   CLASS HELPERS
────────────────────────────────────────────────────────────────── */
function getCls(grade,classId){ return state.classes.find(c=>c.grade===grade&&c.classId===classId); }
function getStudentsOf(grade,classId){ return state.students.filter(s=>s.grade===grade&&s.classId===classId); }
function getRanked(grade){
  return [...state.classes.filter(c=>c.grade===grade)]
    .sort((a,b)=>b.classPoints!==a.classPoints?b.classPoints-a.classPoints:a.classId-b.classId);
}
function rankOf(grade,classId){
  const i=getRanked(grade).findIndex(c=>c.classId===classId);
  return i>=0?RANK_LABELS[i]:'?';
}
function clsName(grade,classId){
  const c=getCls(grade,classId); return c?.customName||JP.clsDef(grade,rankOf(grade,classId));
}

/* ──────────────────────────────────────────────────────────────────
   BLANK DATA GENERATORS
────────────────────────────────────────────────────────────────── */
function blankStudent(grade,classId){
  const stats=Object.fromEntries(STATS_KEYS.map(k=>[k,1]));
  return { id:genStudentId(grade), name:'', gender:'M', dob:'', grade, classId, stats,
           specialAbility:'', privatePoints:0, protectPoints:0, contracts:[], isExpelled:false };
}
function blankClass(grade,classId){ return { grade,classId,classPoints:0,customName:'' }; }

function generateInitialData(){
  Object.assign(state,{students:[],classes:[],nextId:1,year:1,month:4,history:[]});
  GRADES.forEach(g=>CLASS_IDS.forEach(c=>state.classes.push(blankClass(g,c))));
  GRADES.forEach(g=>{
    state.nextId=1;  // reset sequence per grade → 0001..0200 each
    CLASS_IDS.forEach(c=>{
      for(let i=0;i<40;i++) state.students.push(blankStudent(g,c));
    });
  });
  state.nextId=10000; // sentinel
}

/* ──────────────────────────────────────────────────────────────────
   GRADE RANDOMISER
────────────────────────────────────────────────────────────────── */
function randomizeGrade(grade){
  const sts=state.students.filter(s=>s.grade===grade&&!s.isExpelled);
  const byClass={}; CLASS_IDS.forEach(cid=>{byClass[cid]=[];});
  sts.forEach(s=>{ if(byClass[s.classId]!==undefined) byClass[s.classId].push(s); });
  CLASS_IDS.forEach(cid=>{
    const grp=byClass[cid],n=grp.length,half=Math.floor(n/2);
    const gend=Array(half).fill('M').concat(Array(n-half).fill('F'));
    for(let i=gend.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[gend[i],gend[j]]=[gend[j],gend[i]];}
    grp.forEach((s,idx)=>{
      const gender=gend[idx]||'M';
      s.name=genStudentName(gender); s.gender=gender; s.dob=genDOB(grade,state.year);
      const [lo,hi]=PP_RANGE[cid]||[0,50000]; s.privatePoints=rndInt(lo,hi);
      STATS_KEYS.forEach(k=>{s.stats[k]=genStat(cid,k);}); s.specialAbility='';
    });
  });
}

/* ──────────────────────────────────────────────────────────────────
   PP RANKING
────────────────────────────────────────────────────────────────── */
function computeRanking(){
  const sorted=[...state.students].sort((a,b)=>
    b.privatePoints!==a.privatePoints?b.privatePoints-a.privatePoints:(a.id<b.id?-1:1));
  const out=[];
  for(let i=0;i<sorted.length&&out.length<TOP_N;i++){
    const rank=(i>0&&sorted[i].privatePoints===sorted[i-1].privatePoints)?out[out.length-1].rank:i+1;
    out.push({rank,student:sorted[i]});
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────────
   PERSISTENCE
────────────────────────────────────────────────────────────────── */
function saveState(silent=false){
  try{
    localStorage.setItem(slotKey(currentSlot),JSON.stringify(state));
    updateSlotButtons();
    if(!silent) toast(`✓ スロット${currentSlot}にセーブしました`,'ok');
  } catch(e){ toast('✗ セーブ失敗: '+e.message,'err'); }
}
function loadSlot(n){
  const raw=localStorage.getItem(slotKey(n)); if(!raw) return false;
  try{ state=JSON.parse(raw); return true; }
  catch(e){ console.warn('loadSlot',n,e); return false; }
}
function slotHasData(n){ return !!localStorage.getItem(slotKey(n)); }
function switchSlot(n){
  if(n===currentSlot) return;
  saveState(true); state=null; currentSlot=n; selectMode=false; selectedIds=new Set(); navStack=[];
  if(!loadSlot(n)){ state=newState(); generateInitialData(); saveState(true); }
  updateSlotButtons(); updateDateDisplay(); navigate('home',{},true);
  toast(`スロット${n}に切り替えました`);
}
function resetSlot(){
  localStorage.removeItem(slotKey(currentSlot));
  state=newState(); generateInitialData(); saveState(true);
}
function updateSlotButtons(){
  document.querySelectorAll('.sl').forEach(b=>{
    const n=+b.dataset.slot;
    b.classList.toggle('active',n===currentSlot);
    b.classList.toggle('has-data',slotHasData(n));
  });
  const chip=document.getElementById('slot-chip');
  if(chip) chip.textContent=`スロット ${currentSlot}`;
}

/* ──────────────────────────────────────────────────────────────────
   EXPORT
────────────────────────────────────────────────────────────────── */
function exportAllSlots(){
  saveState(true);
  const slots={};
  for(let n=1;n<=NUM_SLOTS;n++){
    const raw=localStorage.getItem(slotKey(n)); if(!raw){slots[n]=null;continue;}
    try{slots[n]=serializeSlot(JSON.parse(raw));}catch(e){slots[n]=null;}
  }
  const payload={app:'Cote-OS',version:APP_VER,exportedAt:new Date().toISOString(),
    description:'Cote-OS バックアップ。各フィールドを直接編集して読み込み可能。',slots};
  const stamp=datestamp();
  const blob=new Blob(['\uFEFF'+JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=Object.assign(document.createElement('a'),{href:url,download:`cote_os_backup_${stamp}.json`});
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),15000);
  toast(`✓ 書き出し完了 — cote_os_backup_${stamp}.json`,'io',3500);
}
function serializeSlot(s){
  return {
    year:s.year,month:s.month,nextId:s.nextId,
    classes:s.classes.map(c=>({grade:c.grade,classId:c.classId,classPoints:c.classPoints,customName:c.customName||''})),
    students:s.students.map(st=>({
      id:st.id,name:st.name,gender:st.gender,dateOfBirth:st.dob,
      grade:st.grade,classId:st.classId,privatePoints:st.privatePoints,protectPoints:st.protectPoints,
      status:st.isExpelled?'expelled':st.grade==='Graduate'?'graduate':st.grade==='Incoming'?'incoming':'active',
      specialAbility:st.specialAbility,
      stats:Object.fromEntries(STATS_KEYS.map(k=>[k,st.stats[k]])),
      contracts:st.contracts.map(c=>({targetId:c.targetId,monthlyAmount:c.amount})),
    })),
    historySnapshots:s.history.map(h=>({year:h.year,month:h.month,
      classPoints:h.classPoints,studentPP:h.studentPP,studentGrades:h.studentGrades})),
  };
}

/* ──────────────────────────────────────────────────────────────────
   IMPORT
────────────────────────────────────────────────────────────────── */
function triggerImportDialog(){
  openModal(`
    <div class="m-title">↑ データ読み込み</div>
    <div class="m-body">
      <div class="import-info">
        <strong style="color:var(--io)">読み込み先：</strong> スロット 1〜5 すべてが上書きされます。<br>
        対象ファイル：<code>cote_os_backup_*.json</code><br>
        ※ JSON を手動編集してから読み込むことも可能です。
      </div>
      <p>既存データはすべて置き換えられます。<br>続行しますか？</p>
      <div class="btn-row">
        <button class="btn btn-io" onclick="pickFile()">ファイルを選択</button>
        <button class="btn" onclick="closeModal()">キャンセル</button>
      </div>
    </div>
  `);
}
window.pickFile=function(){ closeModal(); document.getElementById('file-pick').click(); };

function onFilePicked(file){
  if(!file) return;
  if(file.type&&!file.type.includes('json')&&!file.name.endsWith('.json')){ toast('✗ .json ファイルを選択してください','err'); return; }
  if(file.size>50*1024*1024){ toast('✗ ファイルが大きすぎます (上限 50 MB)','err'); return; }
  const reader=new FileReader();
  reader.onload=e=>{ try{ validateAndImport(JSON.parse(e.target.result.replace(/^\uFEFF/,''))); }
    catch(err){ toast('✗ JSON 解析失敗: '+err.message,'err',4500); } };
  reader.onerror=()=>toast('✗ ファイルの読み込みに失敗しました','err');
  reader.readAsText(file,'utf-8');
}
function validateAndImport(parsed){
  if(!parsed?.slots||typeof parsed.slots!=='object'){ toast('✗ 無効なファイル形式です','err'); return; }
  let restored=0;
  for(let n=1;n<=NUM_SLOTS;n++){
    const raw=parsed.slots[n]??parsed.slots[String(n)];
    if(!raw){ localStorage.removeItem(slotKey(n)); continue; }
    try{ const ss=deserializeSlot(raw); repairIntegrity(ss); localStorage.setItem(slotKey(n),JSON.stringify(ss)); restored++; }
    catch(e){ console.warn('import slot',n,e); }
  }
  state=null; selectMode=false; selectedIds=new Set(); navStack=[];
  if(!loadSlot(currentSlot)){ state=newState(); generateInitialData(); saveState(true); }
  updateSlotButtons(); updateDateDisplay(); navigate('home',{},true);
  toast(`✓ 読み込み完了 — ${restored}スロットを復元しました`,'io',3500);
}
function deserializeSlot(obj){
  const s=newState();
  s.year=typeof obj.year==='number'&&obj.year>=1?obj.year:1;
  s.month=typeof obj.month==='number'&&obj.month>=1?obj.month:4;
  s.nextId=typeof obj.nextId==='number'&&obj.nextId>=1?obj.nextId:1;
  s.classes=(obj.classes||[]).map(c=>({grade:c.grade,classId:typeof c.classId==='number'?c.classId:0,
    classPoints:typeof c.classPoints==='number'?c.classPoints:0,customName:String(c.customName||'')}));
  s.students=(obj.students||[]).map(st=>{
    const expelled=st.isExpelled===true||st.status==='expelled';
    let grade=st.grade; if(typeof grade==='string'&&/^\d+$/.test(grade)) grade=+grade;
    return { id:String(st.id||''),name:String(st.name||''),gender:st.gender==='F'?'F':'M',
      dob:String(st.dateOfBirth||st.dob||''),grade,classId:typeof st.classId==='number'?st.classId:0,
      privatePoints:typeof st.privatePoints==='number'?st.privatePoints:0,
      protectPoints:typeof st.protectPoints==='number'?st.protectPoints:0,
      isExpelled:expelled,specialAbility:String(st.specialAbility||''),
      stats:Object.fromEntries(STATS_KEYS.map(k=>[k,clampStat(st.stats?.[k])])),
      contracts:(st.contracts||[]).map(c=>({targetId:String(c.targetId||''),
        amount:typeof(c.monthlyAmount??c.amount)==='number'?(c.monthlyAmount??c.amount):0})) };
  });
  s.history=(obj.historySnapshots||obj.history||[]).slice(0,HISTORY_MAX).map(h=>({
    year:+h.year||1,month:+h.month||4,
    classPoints:Array.isArray(h.classPoints)?h.classPoints:[],
    studentPP:Array.isArray(h.studentPP)?h.studentPP:[],
    studentGrades:Array.isArray(h.studentGrades)?h.studentGrades:[],
  }));
  return s;
}
function clampStat(v){ const n=parseInt(v,10); return(!isNaN(n)&&n>=1&&n<=15)?n:1; }
function repairIntegrity(s){
  const seen=new Set();
  s.students.forEach(st=>{
    if(!st.id||seen.has(st.id)){ st.id='000'+String(s.nextId).padStart(4,'0'); s.nextId++; }
    seen.add(st.id);
  });
  s.students.forEach(st=>{ const n=parseInt(st.id.slice(-4),10); if(!isNaN(n)&&n>=s.nextId) s.nextId=n+1; });
  const validIds=new Set(s.students.map(st=>st.id));
  s.students.forEach(st=>{ st.contracts=st.contracts.filter(c=>c.targetId&&validIds.has(c.targetId)&&c.targetId!==st.id); });
}
function datestamp(){
  const d=new Date(); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

/* ──────────────────────────────────────────────────────────────────
   TIME LEAP
────────────────────────────────────────────────────────────────── */
function contractSums(sid){
  const self=state.students.find(s=>s.id===sid); if(!self) return{gains:0,losses:0};
  const losses=self.contracts.reduce((a,c)=>a+c.amount,0);
  let gains=0; state.students.forEach(s=>s.contracts.forEach(c=>{if(c.targetId===sid)gains+=c.amount;}));
  return{gains,losses};
}
function snapHistory(){
  state.history.unshift({year:state.year,month:state.month,
    classPoints:state.classes.map(c=>({grade:c.grade,classId:c.classId,cp:c.classPoints})),
    studentPP:state.students.map(s=>({id:s.id,pp:s.privatePoints})),
    studentGrades:state.students.map(s=>({id:s.id,grade:s.grade,classId:s.classId})),
  });
  if(state.history.length>HISTORY_MAX) state.history.pop();
}
function advanceMonth(){
  snapHistory(); if(state.month===3) doGradeUp();
  state.students.forEach(s=>{
    const c=state.classes.find(x=>x.grade===s.grade&&x.classId===s.classId);
    const{gains,losses}=contractSums(s.id);
    s.privatePoints+=(c?c.classPoints*100:0)+gains-losses;
  });
  state.month++; if(state.month>12){state.month=1;state.year++;}
  saveState(true); renderApp(); toast(`⏩ ${fmtDate(state.year,state.month)} へ進みました`);
}
function doGradeUp(){
  state.students.forEach(s=>{if(s.grade===6)s.grade='Graduate';});
  for(let g=5;g>=1;g--) state.students.forEach(s=>{if(s.grade===g)s.grade=g+1;});
  state.students.forEach(s=>{if(s.grade==='Incoming')s.grade=1;});
  const kept=state.classes.filter(c=>c.grade<6).map(c=>({...c,grade:c.grade+1}));
  CLASS_IDS.forEach(id=>kept.push(blankClass(1,id))); state.classes=kept;
}
function revertMonth(){
  if(!state.history.length){toast('✗ 履歴がありません','err');return;}
  const snap=state.history.shift();
  if(state.month===4) undoGradeUp(snap);
  snap.studentPP.forEach(e=>{const s=state.students.find(t=>t.id===e.id);if(s)s.privatePoints=e.pp;});
  state.month--; if(state.month<1){state.month=12;state.year=Math.max(1,state.year-1);}
  snap.classPoints.forEach(e=>{const c=state.classes.find(x=>x.grade===e.grade&&x.classId===e.classId);if(c)c.classPoints=e.cp;});
  saveState(true); renderApp(); toast(`⏪ ${fmtDate(state.year,state.month)} に戻しました`);
}
function undoGradeUp(snap){
  snap.studentGrades.forEach(e=>{const s=state.students.find(t=>t.id===e.id);if(s){s.grade=e.grade;s.classId=e.classId;}});
  state.classes=snap.classPoints.map(e=>{
    const ex=state.classes.find(c=>c.grade===e.grade&&c.classId===e.classId);
    return ex?{...ex,grade:e.grade,classId:e.classId,classPoints:e.cp}:blankClass(e.grade,e.classId);
  });
}

/* ──────────────────────────────────────────────────────────────────
   GEAR MENU
────────────────────────────────────────────────────────────────── */
let gearOpen=false;
let themeFlyOpen=false;

function toggleGear(){
  gearOpen=!gearOpen;
  const btn=document.getElementById('gear-btn');
  const tray=document.getElementById('gear-tray');
  btn?.classList.toggle('open',gearOpen);
  tray?.classList.toggle('open',gearOpen);
  tray?.setAttribute('aria-hidden',String(!gearOpen));
  btn?.setAttribute('aria-expanded',String(gearOpen));
  if(!gearOpen) closeThemeFly();
}
function closeGear(){
  if(!gearOpen) return; gearOpen=false;
  document.getElementById('gear-btn')?.classList.remove('open');
  const tray=document.getElementById('gear-tray');
  tray?.classList.remove('open'); tray?.setAttribute('aria-hidden','true');
  document.getElementById('gear-btn')?.setAttribute('aria-expanded','false');
  closeThemeFly();
}
function toggleThemeFly(e){
  e.stopPropagation();
  themeFlyOpen=!themeFlyOpen;
  const fly=document.getElementById('theme-flyout');
  const btn=document.getElementById('btn-theme');
  fly?.classList.toggle('open',themeFlyOpen);
  fly?.setAttribute('aria-hidden',String(!themeFlyOpen));
  btn?.classList.toggle('open',themeFlyOpen);
}
function closeThemeFly(){
  if(!themeFlyOpen) return; themeFlyOpen=false;
  document.getElementById('theme-flyout')?.classList.remove('open');
  document.getElementById('btn-theme')?.classList.remove('open');
}

window.gearNav=function(page){ closeGear(); navigate(page,{},false); };

/* ──────────────────────────────────────────────────────────────────
   NAVIGATION
────────────────────────────────────────────────────────────────── */
function navigate(page,params={},reset=false){
  if(reset) navStack=[];
  navStack.push({page,params});
  renderPage(page,params); updateBreadcrumb();
}
function navigateReplace(page,params={}){
  if(navStack.length>0) navStack[navStack.length-1]={page,params};
  else navStack.push({page,params});
  renderPage(page,params); updateBreadcrumb();
}
function goBack(){
  if(navStack.length<=1) return;
  navStack.pop(); selectMode=false; selectedIds=new Set();
  const t=navStack[navStack.length-1]; renderPage(t.page,t.params); updateBreadcrumb();
}
window.navTo=function(i){
  navStack=navStack.slice(0,i+1); selectMode=false; selectedIds=new Set();
  const t=navStack[navStack.length-1]; renderPage(t.page,t.params); updateBreadcrumb();
};
function pageLabel(n){
  switch(n.page){
    case 'home':      return 'ホーム';
    case 'grade':     return JP.gradeN(n.params.grade);
    case 'class':     return clsName(n.params.grade,n.params.classId);
    case 'graduates': return JP.graduates;
    case 'incoming':  return JP.incoming2;
    case 'ranking':   return JP.ranking;
    case 'history':   return JP.history;
    case 'profile':   { const s=state.students.find(x=>x.id===n.params.sid); return s?(s.name||s.id):'プロフィール'; }
    default: return n.page;
  }
}
function updateBreadcrumb(){
  const el=document.getElementById('breadcrumb'); if(!el) return;
  el.innerHTML=navStack.map((n,i)=>
    i===navStack.length-1?`<span>${pageLabel(n)}</span>`:`<a onclick="navTo(${i})">${pageLabel(n)}</a>`
  ).join('<span class="bc-sep">›</span>');
}

/* ──────────────────────────────────────────────────────────────────
   RENDER ENGINE
────────────────────────────────────────────────────────────────── */
function renderApp(){
  updateDateDisplay();
  const cur=navStack[navStack.length-1];
  if(cur) renderPage(cur.page,cur.params); else navigate('home',{},true);
}
function updateDateDisplay(){
  const el=document.getElementById('date-display'); if(el) el.textContent=fmtDate(state.year,state.month);
}
function renderPage(page,params){
  const app=document.getElementById('app');
  switch(page){
    case 'home':      app.innerHTML=renderHome(); break;
    case 'grade':     app.innerHTML=renderGrade(params.grade); break;
    case 'class':     app.innerHTML=renderClass(params.grade,params.classId); break;
    case 'profile':   app.innerHTML=renderProfile(params.sid); break;
    case 'graduates': app.innerHTML=renderSpecial('Graduate'); break;
    case 'incoming':  app.innerHTML=renderSpecial('Incoming'); break;
    case 'ranking':   app.innerHTML=renderRankingPage(); break;
    case 'history':   app.innerHTML=renderHistory(); break;
    default: app.innerHTML=`<p style="color:var(--rd)">ページが見つかりません</p>`;
  }
  afterRender();
}

/* ──────────────────────────────────────────────────────────────────
   HOME PAGE
────────────────────────────────────────────────────────────────── */
function renderHome(){
  const activeCount=state.students.filter(s=>typeof s.grade==='number').length;
  const grads=state.students.filter(s=>s.grade==='Graduate').length;
  const inc=state.students.filter(s=>s.grade==='Incoming').length;

  let h=`
    <div class="home-bar">
      <span class="hm-slot">スロット ${currentSlot}</span>
      <span>${fmtDate(state.year,state.month)}</span>
      <span>${activeCount}名在籍</span>
      <div class="hm-right">
        <span class="hm-link" onclick="navigate('ranking',{},false)">🏆 ${JP.ranking} TOP${TOP_N}</span>
      </div>
    </div>
    <div class="pg-hdr">
      <span class="pg-title">システム概要</span>
      <span class="pg-sub">6学年 · 5クラス統合管理 v${APP_VER}</span>
    </div>
  `;

  GRADES.forEach(grade=>{
    const ranked=getRanked(grade);
    h+=`
      <div class="grade-block">
        <div class="grade-hdr" onclick="navigate('grade',{grade:${grade}},false)">
          <span class="grade-lbl">${JP.gradeN(grade)}</span>
          <span class="grade-hint">▶ 詳細を見る</span>
        </div>
        <div class="cls-strip">
    `;
    ranked.forEach((cls,ri)=>{
      const rank=RANK_LABELS[ri], nm=clsName(grade,cls.classId);
      h+=`
        <div class="cls-mini" onclick="navigate('class',{grade:${grade},classId:${cls.classId}},false)">
          <span class="mini-rank r${rank}">${rank}</span>
          <div class="mini-name">${esc(nm)}</div>
          <div class="mini-cp">${cls.classPoints.toLocaleString()}</div>
          <div class="mini-cplbl">CP</div>
          <div class="dist-row" onclick="event.stopPropagation()">
            <input class="dist-inp" type="number" id="di-${grade}-${cls.classId}" placeholder="PP" />
            <button class="dist-btn" onclick="homeDistPP(${grade},${cls.classId})">配布</button>
          </div>
        </div>`;
    });
    h+=`</div></div>`;
  });

  h+=`
    <div class="sp-tiles">
      <div class="sp-tile" style="border-color:var(--yw)" onclick="navigate('graduates',{},false)">
        <div class="sp-cnt" style="color:var(--yw)">${grads}</div>
        <div class="sp-lbl">${JP.graduates}</div>
      </div>
      <div class="sp-tile" style="border-color:var(--ac)" onclick="navigate('incoming',{},false)">
        <div class="sp-cnt" style="color:var(--ac)">${inc}</div>
        <div class="sp-lbl">${JP.incoming2}</div>
      </div>
    </div>`;
  return h;
}

window.homeDistPP=function(grade,classId){
  const inp=document.getElementById(`di-${grade}-${classId}`);
  const amt=parseInt(inp?.value);
  if(isNaN(amt)){toast('✗ 有効な数値を入力してください','err');return;}
  const nm=clsName(grade,classId);
  const cnt=getStudentsOf(grade,classId).filter(s=>!s.isExpelled).length;
  openModal(`
    <div class="m-title">クラス全員にPP配布</div>
    <div class="m-body">
      <p><strong style="color:var(--ac)">${esc(nm)}</strong> の全生徒 (${cnt}名) に<br>
         <strong style="color:${amt>=0?'var(--gn)':'var(--rd)'}">
           ${amt>=0?'+':''}${amt.toLocaleString()} PP</strong> を配布しますか？</p>
      <div class="btn-row">
        <button class="btn btn-ac" onclick="execHomeDist(${grade},${classId},${amt})">実行</button>
        <button class="btn" onclick="closeModal()">キャンセル</button>
      </div>
    </div>`);
};
window.execHomeDist=function(grade,classId,amt){
  getStudentsOf(grade,classId).filter(s=>!s.isExpelled).forEach(s=>{s.privatePoints+=amt;});
  closeModal(); saveState(true); renderApp();
  toast(`✓ PP配布完了 (${amt>=0?'+':''}${amt.toLocaleString()})`,'ok');
};

/* ──────────────────────────────────────────────────────────────────
   HISTORY PAGE
────────────────────────────────────────────────────────────────── */
function renderHistory(){
  const snaps=state.history;
  let h=`
    <button class="back-btn" onclick="goBack()">◀ 戻る</button>
    <div class="pg-hdr">
      <span class="pg-title">📋 ${JP.history}</span>
      <span class="pg-sub">${snaps.length} / ${HISTORY_MAX} スナップショット</span>
    </div>`;
  if(!snaps.length){ h+=`<div class="hist-empty">月を進めると履歴が記録されます。</div>`; return h; }
  h+=`<div class="hist-pg-grid">`;
  snaps.forEach((snap,idx)=>{
    const cpRows=(snap.classPoints||[]).slice(0,10).map(e=>{
      const cls=state.classes.find(c=>c.grade===e.grade&&c.classId===e.classId);
      const nm=cls?.customName||JP.clsDef(e.grade,RANK_LABELS[e.classId]||'?');
      return `<div class="hist-cp-row"><span class="hist-cp-nm">${esc(nm)}</span><span class="hist-cp-val">${(e.cp||0).toLocaleString()} CP</span></div>`;
    }).join('');
    const more=(snap.classPoints||[]).length>10?`<div class="dim" style="font-size:.62rem;margin-top:3px">+${snap.classPoints.length-10}クラス…</div>`:'';
    h+=`
      <div class="hist-snap">
        <div class="hist-snap-hdr">
          <span class="hist-snap-date">${fmtDate(snap.year,snap.month)}</span>
          <span class="hist-snap-cnt">#${snaps.length-idx}</span>
        </div>
        <div class="hist-cp-list">${cpRows}${more}</div>
      </div>`;
  });
  h+=`</div>`;
  return h;
}

/* ──────────────────────────────────────────────────────────────────
   GRADE PAGE
────────────────────────────────────────────────────────────────── */
function renderGrade(grade){
  const ranked=getRanked(grade);
  let h=`
    <button class="back-btn" onclick="goBack()">◀ 戻る</button>
    <div class="grade-pg-hdr">
      <div class="grade-pg-hdr-left">
        <span class="pg-title">${JP.gradeN(grade)}</span>
        <span class="pg-sub">クラス順位 · ${fmtDate(state.year,state.month)}</span>
      </div>
      <button class="btn btn-yw" onclick="confirmRandomizeGrade(${grade})">🎲 ランダム生成</button>
    </div>`;
  ranked.forEach((cls,ri)=>{
    const rank=RANK_LABELS[ri], nm=clsName(grade,cls.classId);
    const sts=getStudentsOf(grade,cls.classId).filter(s=>!s.isExpelled);
    const kp=sts.slice(0,5);
    h+=`
      <div class="cls-row bl${rank}">
        <div class="cls-row-hdr" onclick="navigate('class',{grade:${grade},classId:${cls.classId}},false)">
          <div class="cls-rnk-lg r${rank}">${rank}</div>
          <div class="cls-info">
            <div class="cls-i-nm">${esc(nm)}</div>
            <div class="cls-i-cp">${cls.classPoints.toLocaleString()}<small>CP</small></div>
          </div>
          <div></div>
          <div class="cls-rmeta">${sts.length}名 ▶ クラスへ</div>
        </div>
        <div class="kp-strip">`;
    if(!kp.length) h+=`<span class="dim" style="padding:8px;font-size:.7rem">生徒なし</span>`;
    kp.forEach(s=>{
      h+=`
        <div class="kp-card" onclick="navigate('profile',{sid:'${s.id}'},false)">
          <div class="kp-card-top">
            <div class="kp-name">${esc(s.name)||'<span class="dim">(未記入)</span>'}</div>
            <div class="kp-right">
              <span class="kp-pp-val ${ppCol(s.privatePoints)}">${fmtPP(s.privatePoints)}<span style="color:#fff;font-size:.58rem;margin-left:2px;opacity:.82">PP</span></span>
              ${s.protectPoints>0?`<span class="kp-prp-val">${s.protectPoints}<span style="color:#fff;font-size:.58rem;margin-left:2px;opacity:.82">PRP</span></span>`:''}
            </div>
          </div>
        </div>`;
    });
    h+=`</div></div>`;
  });
  return h;
}

window.confirmRandomizeGrade=function(grade){
  const total=state.students.filter(s=>s.grade===grade&&!s.isExpelled).length;
  openModal(`
    <div class="m-title">🎲 ${JP.gradeN(grade)} ランダム生成</div>
    <div class="m-body">
      <p><strong style="color:var(--yw)">${JP.gradeN(grade)}</strong> の在籍生徒
         <strong style="color:var(--ac)">${total}名</strong> の<br>
         氏名・性別・生年月日・PP・能力値をランダムに再生成します。<br>
         <span class="dim" style="font-size:.75rem">特殊能力はリセットされます。</span></p>
      <div class="btn-row">
        <button class="btn btn-yw" onclick="execRandomizeGrade(${grade})">実行</button>
        <button class="btn" onclick="closeModal()">キャンセル</button>
      </div>
    </div>`);
};
window.execRandomizeGrade=function(grade){
  randomizeGrade(grade); closeModal(); saveState(true);
  navigateReplace('grade',{grade});
  toast(`✓ ${JP.gradeN(grade)} ランダム生成完了`,'ok',3000);
};

/* ──────────────────────────────────────────────────────────────────
   CLASS PAGE
────────────────────────────────────────────────────────────────── */
function renderClass(grade,classId){
  const cls=getCls(grade,classId), rank=rankOf(grade,classId), nm=clsName(grade,classId);
  const active=getStudentsOf(grade,classId).filter(s=>!s.isExpelled);
  const expl=getStudentsOf(grade,classId).filter(s=>s.isExpelled);

  let h=`
    <button class="back-btn" onclick="goBack()">◀ 戻る</button>
    <div class="cls-pg-top">
      <div class="cls-pg-left">
        <div class="pg-hdr" style="margin-bottom:5px">
          <span class="pg-title">${esc(nm)}</span>
          <span class="cls-rnk-lg r${rank}" style="font-size:1.2rem;font-family:var(--fd)">順位 ${rank}</span>
        </div>
        <div class="cls-nm-edit">
          <label>クラス名：</label>
          <input class="cls-nm-inp fi" id="cls-nm-inp"
                 value="${escA(cls?.customName||'')}" placeholder="${grade}年${rank}組 (規定)" />
          <button class="btn btn-sm" onclick="saveClsName(${grade},${classId})">変更</button>
        </div>
      </div>
      <div class="cp-ctrl">
        <label>クラスポイント：</label>
        <input type="number" id="cp-inp" class="fi"
               style="width:88px;text-align:center;font-family:var(--fd);font-size:.9rem"
               value="${cls?.classPoints||0}" />
        <button class="btn btn-sm" onclick="setCP(${grade},${classId})">設定</button>
        <button class="btn btn-sm" onclick="adjCP(${grade},${classId},100)">+100</button>
        <button class="btn btn-sm" onclick="adjCP(${grade},${classId},-100)">-100</button>
      </div>
    </div>

    <div class="bulk-bar">
      <label>一括操作：</label>
      <button class="btn btn-sm ${selectMode?'btn-yw':''}" onclick="toggleSel(${grade},${classId})">
        ${selectMode?'✓ ':''}選択モード
      </button>
      ${selectMode?`
        <button class="btn btn-sm" onclick="selAll(${grade},${classId})">全選択</button>
        <button class="btn btn-sm" onclick="deselAll(${grade},${classId})">解除</button>
        <span class="bulk-cnt">${selectedIds.size}名選択中</span>
        <input type="number" class="fi bulk-inp" id="blk-pp" placeholder="PP量" style="width:90px" />
        <button class="btn btn-sm btn-ac" onclick="applyBulk(${grade},${classId})">PP付与</button>
        <button class="btn btn-sm btn-dn" onclick="confirmBulkDelete(${grade},${classId})">選択した生徒を削除</button>
      `:''}
    </div>

    <div class="srch-row">
      <input class="fi" id="s-search" placeholder="生徒を検索..." oninput="filterStudents()" />
      <button class="btn btn-sm" onclick="addStudent(${grade},${classId})">＋ 生徒を追加</button>
    </div>

    <div class="s-grid ${selectMode?'sel-mode':''}">
      ${renderCards(active)}
    </div>`;

  if(expl.length){
    h+=`<div class="alt-hdr"><span>退学処分 (${expl.length}名)</span><hr /></div>
        <div class="s-grid">${renderCards(expl)}</div>`;
  }
  return h;
}

/* s-card renderer — v5.3 layout (3:2 grid, 1.62rem name) */
function renderCards(students){
  if(!students.length)
    return `<div class="dim" style="grid-column:1/-1;padding:8px;font-size:.7rem">生徒なし</div>`;
  return students.map(s=>{
    const sel=selectedIds.has(s.id), hasPrp=s.protectPoints>0;
    return `
      <div class="s-card ${s.isExpelled?'expelled':''} ${sel?'selected':''}"
           data-name="${escA(s.name.toLowerCase())}"
           onclick="cardClick('${s.id}')">
        <div class="s-chk">${sel?'✓':''}</div>
        <div class="s-top-left">
          <span class="s-sid">${s.id}</span>
          <span class="s-gender">${s.gender==='M'?JP.male:JP.female}</span>
        </div>
        <div class="s-top-right">
          ${hasPrp?`<span class="s-prp-val">${s.protectPoints}<span class="s-prp-unit">PRP</span></span>`:''}
        </div>
        <div class="s-bot-left">
          <div class="s-name">${esc(s.name)||'<span class="dim">(未記入)</span>'}</div>
        </div>
        <div class="s-bot-right">
          <span class="s-pp-val ${ppCol(s.privatePoints)}">${fmtPP(s.privatePoints)}<span class="s-pp-unit">PP</span></span>
        </div>
      </div>`;
  }).join('');
}

window.cardClick=function(sid){
  if(selectMode){ selectedIds.has(sid)?selectedIds.delete(sid):selectedIds.add(sid);
    const c=navStack[navStack.length-1]; if(c) renderPage(c.page,c.params);
  } else navigate('profile',{sid},false);
};
window.toggleSel=(g,c)=>{selectMode=!selectMode;selectedIds=new Set();renderPage('class',{grade:g,classId:c});};
window.selAll=(g,c)=>{getStudentsOf(g,c).filter(s=>!s.isExpelled).forEach(s=>selectedIds.add(s.id));renderPage('class',{grade:g,classId:c});};
window.deselAll=(g,c)=>{selectedIds=new Set();renderPage('class',{grade:g,classId:c});};

window.applyBulk=function(grade,classId){
  const amt=parseInt(document.getElementById('blk-pp')?.value);
  if(isNaN(amt)){toast('✗ 有効な数値を入力してください','err');return;}
  if(!selectedIds.size){toast('✗ 生徒が選択されていません','err');return;}
  openModal(`
    <div class="m-title">一括PP操作</div>
    <div class="m-body">
      <p>選択中の<strong style="color:var(--ac)">${selectedIds.size}名</strong>に<br>
         <strong style="color:${amt>=0?'var(--gn)':'var(--rd)'}">
           ${amt>=0?'+':''}${amt.toLocaleString()} PP</strong> を付与しますか？</p>
      <div class="btn-row">
        <button class="btn btn-ac" onclick="execBulk(${grade},${classId},${amt})">実行</button>
        <button class="btn" onclick="closeModal()">キャンセル</button>
      </div>
    </div>`);
};
window.execBulk=function(grade,classId,amt){
  let n=0; selectedIds.forEach(id=>{const s=state.students.find(x=>x.id===id);if(s){s.privatePoints+=amt;n++;}});
  selectedIds=new Set(); selectMode=false;
  closeModal(); saveState(true); renderPage('class',{grade,classId});
  toast(`✓ ${n}名に ${amt>=0?'+':''}${amt.toLocaleString()} PP を付与`,'ok');
};
window.confirmBulkDelete=function(grade,classId){
  const n=selectedIds.size; if(!n){toast('✗ 生徒が選択されていません','err');return;}
  openModal(`
    <div class="m-title">選択した生徒を削除</div>
    <div class="m-body">
      <p>選択中の<strong style="color:var(--rd)">${n}名</strong>を完全に削除しますか？<br>
         <span class="dim" style="font-size:.75rem">この操作は取り消せません。コントラクトも削除されます。</span></p>
      <div class="btn-row">
        <button class="btn btn-dn" onclick="execBulkDelete(${grade},${classId})">削除実行</button>
        <button class="btn" onclick="closeModal()">キャンセル</button>
      </div>
    </div>`);
};
window.execBulkDelete=function(grade,classId){
  const del=new Set(selectedIds);
  state.students=state.students.filter(s=>!del.has(s.id));
  state.students.forEach(s=>{s.contracts=s.contracts.filter(c=>!del.has(c.targetId));});
  selectedIds=new Set(); selectMode=false;
  closeModal(); saveState(true); renderPage('class',{grade,classId});
  toast(`✓ ${del.size}名を削除しました`,'ok');
};
window.filterStudents=function(){
  const q=(document.getElementById('s-search')?.value||'').toLowerCase();
  document.querySelectorAll('.s-card[data-name]').forEach(c=>{
    c.style.display=c.dataset.name.includes(q)?'':'none';
  });
};
window.saveClsName=function(grade,classId){
  const v=document.getElementById('cls-nm-inp')?.value?.trim()||'';
  const c=getCls(grade,classId); if(c) c.customName=v;
  saveState(true); renderApp(); toast('✓ クラス名を変更しました','ok');
};
window.setCP=function(grade,classId){
  const v=parseInt(document.getElementById('cp-inp')?.value); if(isNaN(v)) return;
  const c=getCls(grade,classId); if(c){c.classPoints=v;saveState(true);renderApp();}
};
window.adjCP=function(grade,classId,d){
  const c=getCls(grade,classId);
  if(c){c.classPoints+=d;const el=document.getElementById('cp-inp');if(el)el.value=c.classPoints;saveState(true);renderApp();}
};
window.addStudent=function(grade,classId){
  const s=blankStudent(grade,classId); state.students.push(s);
  saveState(true); renderPage('class',{grade,classId});
  toast(`✓ 生徒を追加しました (${s.id})`,'ok');
};

/* ──────────────────────────────────────────────────────────────────
   PROFILE PAGE
────────────────────────────────────────────────────────────────── */
function renderProfile(sid){
  const s=state.students.find(x=>x.id===sid);
  if(!s) return `<p style="color:var(--rd)">生徒が見つかりません</p>`;

  const ppCls=s.privatePoints>=0?'pos':'neg';
  const statusLabel=s.isExpelled?JP.expelled:s.grade==='Graduate'?JP.graduate:s.grade==='Incoming'?JP.incoming:JP.active;
  const badgeCls=s.isExpelled?'bd-ex':s.grade==='Graduate'?'bd-gr':s.grade==='Incoming'?'bd-ic':'bd-in';
  const gradeDisp=typeof s.grade==='number'?JP.gradeN(s.grade):statusLabel;
  const clsDisp=typeof s.grade==='number'?clsName(s.grade,s.classId):'―';
  const hasProt=s.protectPoints>0;

  const bars=STATS_KEYS.map(k=>{
    const v=s.stats[k]||1;
    return `<div class="sb-row">
      <span class="sb-lbl">${JP[k]}</span>
      <div class="sb-track"><div class="sb-fill" style="width:${((v-1)/14)*100}%"></div></div>
      <span class="sb-val">${v}</span>
    </div>`;
  }).join('');

  const gradeOpts=[
    ...GRADES.map(g=>`<option value="${g}" ${s.grade===g?'selected':''}>${JP.gradeN(g)}</option>`),
    `<option value="Graduate" ${s.grade==='Graduate'?'selected':''}>卒業生</option>`,
    `<option value="Incoming" ${s.grade==='Incoming'?'selected':''}>入学予定</option>`,
  ].join('');
  const clsOpts=CLASS_IDS.map(id=>`<option value="${id}" ${s.classId===id?'selected':''}>${id}</option>`).join('');

  const ctrOut=s.contracts.length
    ?s.contracts.map((c,i)=>{
        const t=state.students.find(x=>x.id===c.targetId), tn=t?(t.name||t.id):`[不明 ${c.targetId}]`;
        return `<div class="ctr-item"><span>→ ${esc(tn)}</span><span class="ctr-amt">${c.amount.toLocaleString()} PP/月</span><button class="ctr-del" onclick="rmContract('${sid}',${i})">✕</button></div>`;
      }).join('')
    :`<div class="dim" style="font-size:.71rem">送信契約なし</div>`;

  const ctrIn=[];
  state.students.forEach(o=>o.contracts.forEach(c=>{if(c.targetId===sid)ctrIn.push({from:o.name||o.id,amt:c.amount});}));
  const ctrInHtml=ctrIn.length
    ?ctrIn.map(c=>`<div class="ctr-item"><span>← ${esc(c.from)}</span><span class="ctr-amt pos">+${c.amt.toLocaleString()} PP/月</span></div>`).join('')
    :`<div class="dim" style="font-size:.71rem">受信契約なし</div>`;

  return `
    <button class="back-btn" onclick="goBack()">◀ 戻る</button>
    <div id="prof-wrap">
      <div class="prof-side">
        <div class="prof-name">${esc(s.name)||'(未記入)'}</div>
        <div class="prof-sid">${s.id}</div>
        <span class="badge ${badgeCls}">${statusLabel}</span>
        <div class="prof-pp ${ppCls}">${s.privatePoints.toLocaleString()}</div>
        <div class="prof-pplbl">${JP.pp}</div>
        <div class="prof-prot${hasProt?' active':''}">
          ${s.protectPoints} ${JP.protect}
        </div>
        <table class="info-tbl">
          <tr><td>${JP.gender}</td><td>${s.gender==='M'?JP.male:JP.female}</td></tr>
          <tr><td>${JP.dob}</td><td>${s.dob||'未設定'}</td></tr>
          <tr><td>${JP.grade}</td><td>${gradeDisp}</td></tr>
          <tr><td>${JP.cls}</td><td>${esc(clsDisp)}</td></tr>
        </table>
        <div class="sec-ttl mt8">能力プロフィール</div>
        <div class="sb-grid">${bars}</div>
        <div style="margin-top:12px">
          ${s.isExpelled
            ?`<button class="btn-expel" style="border-color:var(--gn);color:var(--gn)" onclick="reinstateStudent('${sid}')">↩ ${JP.reinstate}</button>`
            :`<button class="btn-expel" onclick="confirmExpel('${sid}')">${JP.expel}</button>`}
        </div>
        <button class="btn-del-student" onclick="confirmDeleteFromProfile('${sid}')">🗑 生徒を削除</button>
      </div>

      <div class="prof-main">
        <div class="prof-sec">
          <div class="sec-ttl">基本情報</div>
          <div class="fr"><label>${JP.name}</label><input class="fi" id="pf-name" value="${escA(s.name)}" placeholder="(未記入)" /></div>
          <div class="fr"><label>${JP.gender}</label>
            <select class="fs" id="pf-gender">
              <option value="M" ${s.gender==='M'?'selected':''}>男性</option>
              <option value="F" ${s.gender==='F'?'selected':''}>女性</option>
            </select>
          </div>
          <div class="fr"><label>${JP.dob}</label><input class="fi" id="pf-dob" type="date" value="${s.dob||''}" /></div>
          <div class="fr"><label>${JP.grade}</label><select class="fs" id="pf-grade">${gradeOpts}</select></div>
          <div class="fr"><label>${JP.cls} ID</label><select class="fs" id="pf-cls">${clsOpts}</select></div>
          <div class="fr"><label>${JP.pp}</label><input class="fi" id="pf-pp" type="number" value="${s.privatePoints}" /></div>
          <div class="fr"><label class="label-faded">${JP.protect}</label><input class="fi" id="pf-prot" type="number" value="${s.protectPoints}" min="0" /></div>
        </div>

        <div class="prof-sec">
          <div class="sec-ttl">能力値 (1–15)</div>
          <div class="stats-grid">
            ${STATS_KEYS.map(k=>`
              <div class="stat-slide">
                <label>${JP[k]}</label>
                <input type="range" id="st-${k}" min="1" max="15" value="${s.stats[k]||1}"
                       oninput="document.getElementById('sv-${k}').textContent=this.value" />
                <span class="sv-lbl" id="sv-${k}">${s.stats[k]||1}</span>
              </div>`).join('')}
          </div>
        </div>

        <div class="prof-sec">
          <div class="sec-ttl">送信コントラクト（支出）</div>
          <div class="ctr-list">${ctrOut}</div>
          <div class="ctr-add">
            <input id="ct-tgt" class="fi" placeholder="生徒IDまたは氏名..." style="flex:2" />
            <input id="ct-amt" class="fi" type="number" placeholder="PP/月" style="flex:1" />
            <button class="btn btn-sm" onclick="addContract('${sid}')">＋ 追加</button>
          </div>
        </div>

        <div class="prof-sec">
          <div class="sec-ttl">受信コントラクト（収入）</div>
          <div class="ctr-list">${ctrInHtml}</div>
        </div>

        <div class="prof-sec">
          <div class="sec-ttl">${JP.specialAbility}（最大300文字）</div>
          <textarea class="sa-area fta" id="pf-sa" maxlength="300"
                    placeholder="特殊能力を記載...">${esc(s.specialAbility||'')}</textarea>
          <div class="sa-cnt" id="sa-ct">${(s.specialAbility||'').length}/300</div>
        </div>

        <button class="btn-save-prof" onclick="saveProfile('${sid}')">✓ プロフィールを保存</button>
      </div>
    </div>`;
}

window.saveProfile=function(sid){
  const s=state.students.find(x=>x.id===sid); if(!s) return;
  s.name=document.getElementById('pf-name')?.value?.trim()||'';
  s.gender=document.getElementById('pf-gender')?.value||'M';
  s.dob=document.getElementById('pf-dob')?.value||'';
  const gv=document.getElementById('pf-grade')?.value; s.grade=isNaN(+gv)?gv:+gv;
  s.classId=+(document.getElementById('pf-cls')?.value)||0;
  const ppv=parseInt(document.getElementById('pf-pp')?.value); if(!isNaN(ppv)) s.privatePoints=ppv;
  const prv=parseInt(document.getElementById('pf-prot')?.value); if(!isNaN(prv)) s.protectPoints=Math.max(0,prv);
  s.specialAbility=document.getElementById('pf-sa')?.value||'';
  STATS_KEYS.forEach(k=>{const e=document.getElementById(`st-${k}`);if(e)s.stats[k]=+e.value;});
  saveState(true); renderApp(); toast('✓ プロフィールを保存しました：'+(s.name||s.id),'ok');
};
window.rmContract=function(sid,idx){
  const s=state.students.find(x=>x.id===sid); if(s) s.contracts.splice(idx,1);
  saveState(true); navigate('profile',{sid},false); updateBreadcrumb();
  toast('✓ コントラクトを削除しました','ok');
};
window.addContract=function(sid){
  const s=state.students.find(x=>x.id===sid); if(!s) return;
  const ti=document.getElementById('ct-tgt')?.value?.trim();
  const amt=parseInt(document.getElementById('ct-amt')?.value);
  if(!ti||isNaN(amt)||amt<=0){toast('✗ 入力が無効です','err');return;}
  let t=state.students.find(x=>x.id===ti);
  if(!t) t=state.students.find(x=>x.name.toLowerCase().includes(ti.toLowerCase()));
  if(!t){toast('✗ 生徒が見つかりません','err');return;}
  if(t.id===sid){toast('✗ 自分自身にコントラクトできません','err');return;}
  s.contracts.push({targetId:t.id,amount:amt});
  saveState(true); navigate('profile',{sid},false); updateBreadcrumb();
  toast(`✓ コントラクト設定 → ${t.name||t.id}: ${amt} PP/月`,'ok');
};
window.confirmExpel=function(sid){
  const s=state.students.find(x=>x.id===sid); if(!s) return;
  openModal(`
    <div class="m-title">退学確認</div>
    <div class="m-body">
      <p><strong>${esc(s.name)||s.id}</strong> を退学処分にしますか？</p>
      <div class="btn-row">
        <button class="btn btn-dn" onclick="expelStudent('${sid}')">退学実行</button>
        <button class="btn" onclick="closeModal()">キャンセル</button>
      </div>
    </div>`);
};
window.expelStudent=function(sid){
  const s=state.students.find(x=>x.id===sid); if(s) s.isExpelled=true;
  closeModal(); saveState(true); goBack(); toast('⚠ 退学処分：'+(s?.name||sid),'warn');
};
window.reinstateStudent=function(sid){
  const s=state.students.find(x=>x.id===sid); if(s) s.isExpelled=false;
  saveState(true); renderApp(); toast('✓ 復帰：'+(s?.name||sid),'ok');
};
window.confirmDeleteFromProfile=function(sid){
  const s=state.students.find(x=>x.id===sid); if(!s) return;
  openModal(`
    <div class="m-title">生徒削除確認</div>
    <div class="m-body">
      <p><strong style="color:var(--rd)">${esc(s.name)||s.id}</strong> を完全に削除しますか？<br>
         <span class="dim" style="font-size:.75rem">この操作は取り消せません。コントラクトも削除されます。</span></p>
      <div class="btn-row">
        <button class="btn btn-dn" onclick="deleteStudentFromProfile('${sid}')">削除実行</button>
        <button class="btn" onclick="closeModal()">キャンセル</button>
      </div>
    </div>`);
};
window.deleteStudentFromProfile=function(sid){
  const s=state.students.find(x=>x.id===sid);
  const grade=s?.grade, classId=s?.classId;
  state.students=state.students.filter(x=>x.id!==sid);
  state.students.forEach(x=>{x.contracts=x.contracts.filter(c=>c.targetId!==sid);});
  selectedIds.delete(sid); closeModal(); saveState(true);
  if(navStack.length>1) navStack.pop();
  if(typeof grade==='number'){
    if(navStack.length>0&&navStack[navStack.length-1].page==='class'){renderPage('class',{grade,classId});updateBreadcrumb();}
    else navigate('class',{grade,classId},false);
  } else renderApp();
  toast('✓ 生徒を削除しました','ok');
};

/* ──────────────────────────────────────────────────────────────────
   RANKING PAGE
────────────────────────────────────────────────────────────────── */
function renderRankingPage(){
  const ranked=computeRanking();
  let h=`
    <button class="back-btn" onclick="goBack()">◀ 戻る</button>
    <div class="pg-hdr">
      <span class="pg-title">🏆 ${JP.ranking} TOP ${TOP_N}</span>
      <span class="pg-sub">全生徒PP降順 · 同PP=同順位</span>
    </div>
    <div class="rnk-wrap">
      <table class="rnk-tbl">
        <thead><tr>
          <th style="text-align:right">順位</th><th>氏名</th>
          <th>学年 / クラス</th><th>ID</th><th style="text-align:right">PP</th>
        </tr></thead><tbody>`;
  if(!ranked.length) h+=`<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--t3)">データなし</td></tr>`;
  ranked.forEach(({rank,student:s})=>{
    const gd=typeof s.grade==='number'?JP.gradeN(s.grade):(s.grade==='Graduate'?'卒業生':'入学予定');
    const cd=typeof s.grade==='number'?clsName(s.grade,s.classId):'―';
    h+=`<tr>
      <td class="rn ${rank<=3?'top3':''}">${rank}</td>
      <td class="rk-nm" onclick="navigate('profile',{sid:'${s.id}'},false)">${esc(s.name)||'<span class="dim">(未記入)</span>'}</td>
      <td style="font-size:.7rem;color:var(--t1)">${gd} / ${esc(cd)}</td>
      <td style="font-size:.62rem;color:var(--t3)">${s.id}</td>
      <td class="rk-pp ${s.privatePoints<0?'neg':''}">${s.privatePoints.toLocaleString()}</td>
    </tr>`;
  });
  h+=`</tbody></table></div>`;
  if(ranked.length){
    const medals=['🥇','🥈','🥉'];
    h+=`<div class="medal-row">
      ${ranked.slice(0,Math.min(3,ranked.length)).map(({rank,student:s},i)=>`
        <div class="medal-card">
          <div class="medal-rnk">${medals[i]} 第${rank}位</div>
          <div class="medal-name">${esc(s.name)||'(未記入)'}</div>
          <div class="medal-pp">${s.privatePoints.toLocaleString()} PP</div>
        </div>`).join('')}
    </div>`;
  }
  return h;
}

/* ──────────────────────────────────────────────────────────────────
   SPECIAL PAGES (Graduates / Incoming)
────────────────────────────────────────────────────────────────── */
function renderSpecial(gradeType){
  const isGrad=gradeType==='Graduate';
  const sts=state.students.filter(s=>s.grade===gradeType);
  const title=isGrad?JP.graduates:JP.incoming2;
  const col=isGrad?'var(--yw)':'var(--ac)';

  let h=`
    <button class="back-btn" onclick="goBack()">◀ 戻る</button>
    <div class="pg-hdr">
      <span class="pg-title" style="color:${col}">${title}</span>
      <span class="pg-sub">${sts.length}名</span>
    </div>
    <div class="srch-row">
      <input class="fi" id="s-search" placeholder="生徒を検索..." oninput="filterStudents()" />
      ${!isGrad?`<button class="btn btn-sm" onclick="addIncoming()">＋ 追加</button>`:''}
    </div>
    <div class="s-grid">`;
  if(!sts.length) h+=`<div class="dim" style="grid-column:1/-1;padding:20px;text-align:center">生徒なし</div>`;
  sts.forEach(s=>{
    const hasPrp=s.protectPoints>0;
    h+=`
      <div class="s-card ${s.isExpelled?'expelled':''}"
           data-name="${escA(s.name.toLowerCase())}"
           onclick="navigate('profile',{sid:'${s.id}'},false)">
        <div class="s-top-left">
          <span class="s-sid">${s.id}</span>
          <span class="s-gender">${s.gender==='M'?JP.male:JP.female}</span>
        </div>
        <div class="s-top-right">
          ${hasPrp?`<span class="s-prp-val">${s.protectPoints}<span class="s-prp-unit">PRP</span></span>`:''}
        </div>
        <div class="s-bot-left">
          <div class="s-name">${esc(s.name)||'<span class="dim">(未記入)</span>'}</div>
        </div>
        <div class="s-bot-right">
          <span class="s-pp-val ${ppCol(s.privatePoints)}">${fmtPP(s.privatePoints)}<span class="s-pp-unit">PP</span></span>
        </div>
      </div>`;
  });
  return h+'</div>';
}
window.addIncoming=function(){
  const s=blankStudent('Incoming',0); state.students.push(s);
  saveState(true); renderApp(); toast('✓ 入学予定を追加しました: '+s.id,'ok');
};

/* ──────────────────────────────────────────────────────────────────
   MODAL
────────────────────────────────────────────────────────────────── */
function openModal(html){
  document.getElementById('modal-body').innerHTML=html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
window.closeModal=function(){ document.getElementById('modal-overlay').classList.add('hidden'); };

/* ──────────────────────────────────────────────────────────────────
   POST-RENDER HOOKS
────────────────────────────────────────────────────────────────── */
function afterRender(){
  const ta=document.getElementById('pf-sa'), ct=document.getElementById('sa-ct');
  if(ta&&ct) ta.addEventListener('input',()=>{ct.textContent=ta.value.length+'/300';});
}

/* ──────────────────────────────────────────────────────────────────
   EVENT BINDINGS
────────────────────────────────────────────────────────────────── */
function bindEvents(){
  /* Time nav — always bound to their IDs; safe because zones don't overlap */
  document.getElementById('btn-prev').addEventListener('click', revertMonth);
  document.getElementById('btn-next').addEventListener('click', advanceMonth);

  document.addEventListener('keydown', e=>{
    if(!e.ctrlKey) return;
    if(e.key==='ArrowLeft'){e.preventDefault();revertMonth();}
    if(e.key==='ArrowRight'){e.preventDefault();advanceMonth();}
    if(e.key==='s'){e.preventDefault();saveState();}
  });

  /* Gear toggle */
  document.getElementById('gear-btn').addEventListener('click', e=>{
    e.stopPropagation(); toggleGear();
  });

  /* Close gear when clicking outside */
  document.addEventListener('click', e=>{
    const wrap=document.getElementById('gear-wrap');
    if(wrap&&!wrap.contains(e.target)) closeGear();
  });

  /* Theme flyout */
  document.getElementById('btn-theme').addEventListener('click', toggleThemeFly);
  document.querySelectorAll('.tf-opt').forEach(b=>{
    b.addEventListener('click', e=>{
      e.stopPropagation();
      applyTheme(b.dataset.theme);
      closeThemeFly(); closeGear();
      toast(`テーマ: ${b.dataset.theme}`);
    });
  });

  /* Save / Reset */
  document.getElementById('btn-save').addEventListener('click', ()=>{ closeGear(); saveState(); });
  document.getElementById('btn-reset').addEventListener('click', ()=>{
    closeGear();
    openModal(`
      <div class="m-title">スロット${currentSlot} リセット確認</div>
      <div class="m-body">
        <p>スロット${currentSlot}の<strong>全データを削除</strong>して<br>
           1,200名の空欄データを再生成します。<br>
           <span class="dim">この操作は取り消せません。</span></p>
        <div class="btn-row">
          <button class="btn btn-dn" onclick="doReset()">リセット実行</button>
          <button class="btn" onclick="closeModal()">キャンセル</button>
        </div>
      </div>`);
  });

  /* Export / Import */
  document.getElementById('btn-export').addEventListener('click',()=>{ closeGear(); exportAllSlots(); });
  document.getElementById('btn-import').addEventListener('click',()=>{ closeGear(); triggerImportDialog(); });
  document.getElementById('file-pick').addEventListener('change', function(){
    onFilePicked(this.files[0]); this.value='';
  });

  /* Slot buttons */
  document.querySelectorAll('.sl').forEach(b=>{
    b.addEventListener('click', ()=>{
      const n=+b.dataset.slot; if(n!==currentSlot) switchSlot(n); closeGear();
    });
  });

  /* Modal close */
  document.getElementById('modal-x').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e=>{
    if(e.target.id==='modal-overlay') closeModal();
  });
}

window.doReset=function(){
  closeModal(); resetSlot(); selectMode=false; selectedIds=new Set(); navStack=[];
  navigate('home',{},true); toast(`✓ スロット${currentSlot} リセット完了`,'ok');
};

/* Global references */
window.navigate            = navigate;
window.navigateBack        = goBack;
window.exportAllSlots      = exportAllSlots;
window.triggerImportDialog = triggerImportDialog;

/* ──────────────────────────────────────────────────────────────────
   BOOT
────────────────────────────────────────────────────────────────── */
function showLoader(msg){
  const el=document.createElement('div'); el.id='loading';
  el.innerHTML=`<div class="ld-logo">COTE-OS</div><div class="ld-txt">${msg}</div><div class="ld-sub">しばらくお待ちください...</div>`;
  document.body.appendChild(el); return el;
}
function boot(){
  loadTheme();  // apply saved theme before any render
  const ok=loadSlot(currentSlot);
  if(!ok||!state?.students?.length){
    const ld=showLoader('1,200名の初期データを生成中...');
    setTimeout(()=>{ state=newState(); generateInitialData(); saveState(true); ld.remove(); finishBoot(); },80);
  } else finishBoot();
}
function finishBoot(){
  bindEvents();
  updateSlotButtons();
  updateDateDisplay();
  navigate('home',{},true);
}
if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded',boot);
else
  boot();
