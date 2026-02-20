/* ================================================================
   Cote-OS v3.0  ·  Application Logic
   Features: Flexible roster (add/delete), Global PP Ranking Top-100
   with standard competition ranking, Multi-slot saves, Full JP UI,
   Home bulk PP distribution, Multi-select class PP, Time-leap, Contracts
   ================================================================ */
'use strict';

/* ── Constants ─────────────────────────────────────────────────── */
const GRADES    = [1,2,3,4,5,6];
const CLASS_IDS = [0,1,2,3,4];
const RANK_LBLS = ['A','B','C','D','E'];
const STATS_KEYS= ['language','reasoning','memory','thinking','physical','mental'];
const MONTHS_JP = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const HISTORY_MAX = 60;
const NUM_SLOTS   = 5;
const RANKING_TOP = 100;

const JP = {
  // stat labels
  language:'言語力', reasoning:'推論力', memory:'記憶力',
  thinking:'思考力', physical:'身体能力', mental:'精神力',
  // fields
  name:'氏名', gender:'性別', dob:'生年月日',
  grade:'学年', cls:'クラス',
  pp:'プライベートポイント', protect:'プロテクトポイント',
  specialAbility:'特殊能力',
  // status
  active:'在籍', expelled:'退学', graduate:'卒業生', incoming:'入学予定',
  // gender
  male:'男', female:'女',
  // buttons / labels
  save:'セーブ', cancel:'キャンセル',
  expel:'退学処分', reinstate:'復帰',
  addStudent:'生徒を追加', deleteStudent:'削除',
  distributeAll:'クラス全員にPP配布',
  bulkPP:'一括PP操作', applyBulkPP:'PP付与',
  selectMode:'選択モード', selectAll:'全選択', deselect:'解除',
  ranking:'ランキング',
  graduates:'卒業生', incoming2:'入学予定',
  // helpers
  gradeN: g => `${g}年生`,
  clsDefault: (g,r) => `${g}年${r}組`,
};

/* ── Runtime state ─────────────────────────────────────────────── */
let currentSlot = 1;
let state       = null;   // loaded per slot
let navStack    = [];
let selectMode  = false;
let selectedIds = new Set();

/* ── Slot key ──────────────────────────────────────────────────── */
const slotKey = n => `CoteOS_v3_Slot${n}`;

/* ================================================================
   STATE FACTORY
================================================================ */
function newState() {
  return { year:1, month:4, students:[], classes:[], history:[], nextId:1 };
}

/* ================================================================
   UTILITIES
================================================================ */
function uid() {
  const id = 'S' + String(state.nextId).padStart(5,'0');
  state.nextId++;
  return id;
}

function esc(s) {
  return String(s??'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escA(s){ return String(s??'').replace(/"/g,'&quot;'); }

function toast(msg, ms=2600) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('on'), ms);
}

function fmtDate(y,m){ return `Year ${y} · ${MONTHS_JP[m-1]}`; }

function fmtPP(v) {
  const a = Math.abs(v);
  if (a>=1e6) return (v/1e6).toFixed(1)+'M';
  if (a>=1000) return (v/1000).toFixed(1)+'K';
  return String(v);
}

function ppCol(v){ return v>0?'pos':v<0?'neg':'neu'; }

/* ── Class helpers ─────────────────────────────────────────────── */
function getCls(grade, classId) {
  return state.classes.find(c=>c.grade===grade && c.classId===classId);
}

function getStudentsOf(grade, classId) {
  return state.students.filter(s=>s.grade===grade && s.classId===classId);
}

function getRanked(grade) {
  return state.classes
    .filter(c=>c.grade===grade)
    .slice()
    .sort((a,b)=> b.classPoints!==a.classPoints ? b.classPoints-a.classPoints : a.classId-b.classId);
}

function rankOf(grade, classId) {
  const r = getRanked(grade).findIndex(c=>c.classId===classId);
  return r>=0 ? RANK_LBLS[r] : '?';
}

function clsName(grade, classId) {
  const c = getCls(grade, classId);
  if (c?.customName) return c.customName;
  return JP.clsDefault(grade, rankOf(grade,classId));
}

/* ================================================================
   DATA GENERATION — BLANK SLATE
================================================================ */
function blankStudent(grade, classId) {
  const stats = {};
  STATS_KEYS.forEach(k=>{ stats[k]=1; });
  return {
    id: uid(), name:'', gender:'M', dob:'',
    grade, classId, stats,
    specialAbility:'',
    privatePoints:0, protectPoints:0,
    contracts:[], isExpelled:false,
  };
}

function blankClass(grade, classId) {
  return { grade, classId, classPoints:0, customName:'' };
}

function generateInitialData() {
  state.students = [];
  state.classes  = [];
  state.nextId   = 1;
  state.year     = 1;
  state.month    = 4;
  state.history  = [];

  GRADES.forEach(grade => {
    CLASS_IDS.forEach(classId => {
      state.classes.push(blankClass(grade, classId));
      for (let i=0;i<40;i++) state.students.push(blankStudent(grade, classId));
    });
  });
}

/* ================================================================
   GLOBAL PP RANKING — Top 100, Standard Competition Ranking
   Rules: sort by PP desc; tie-breaker = lower ID string wins
   Ranking type: standard competition (1,1,3,4,4,6…)
================================================================ */
function computeGlobalRanking() {
  // Include all non-expelled students with a numeric grade (active + graduates + incoming)
  const all = state.students.slice().sort((a,b)=>{
    if (b.privatePoints !== a.privatePoints) return b.privatePoints - a.privatePoints;
    // Tie-breaker: lower ID wins (IDs are "S00001" style — lexicographic works)
    return a.id < b.id ? -1 : 1;
  });

  // Assign standard competition ranks
  const ranked = [];
  let rank = 1;
  for (let i=0; i<all.length; i++) {
    if (i>0 && all[i].privatePoints === all[i-1].privatePoints) {
      // same PP → same rank as previous
      ranked.push({ rank: ranked[i-1].rank, student: all[i] });
    } else {
      rank = i+1;
      ranked.push({ rank, student: all[i] });
    }
    if (ranked.length >= RANKING_TOP) break;
  }
  return ranked;
}

/* ================================================================
   PERSISTENCE — MULTI-SLOT
================================================================ */
function saveState(silent=false) {
  try {
    localStorage.setItem(slotKey(currentSlot), JSON.stringify(state));
    updateSlotButtons();
    if (!silent) toast(`✓ スロット${currentSlot}にセーブしました`);
  } catch(e) {
    toast('✗ セーブ失敗: '+e.message);
  }
}

function loadSlot(slot) {
  const raw = localStorage.getItem(slotKey(slot));
  if (!raw) return false;
  try { state = JSON.parse(raw); return true; }
  catch(e) { console.warn('loadSlot failed', slot, e); return false; }
}

function slotHasData(slot) { return !!localStorage.getItem(slotKey(slot)); }

function switchSlot(n) {
  if (n === currentSlot) return;
  saveState(true);
  state = null;       // release memory
  currentSlot = n;
  selectMode  = false;
  selectedIds = new Set();
  navStack    = [];

  if (!loadSlot(currentSlot)) {
    state = newState();
    generateInitialData();
    saveState(true);
  }
  updateSlotButtons();
  updateDateDisplay();
  navigate('home', {}, true);
  toast(`スロット${currentSlot}に切り替えました`);
}

function resetSlot() {
  localStorage.removeItem(slotKey(currentSlot));
  state = newState();
  generateInitialData();
  saveState(true);
}

function updateSlotButtons() {
  document.querySelectorAll('.sl').forEach(b=>{
    const n = +b.dataset.slot;
    b.classList.toggle('active', n===currentSlot);
    b.classList.toggle('has-data', slotHasData(n));
  });
  const sd = document.getElementById('slot-display');
  if (sd) sd.textContent = `スロット ${currentSlot}`;
}

/* ================================================================
   TIME SYSTEM
================================================================ */
function contractSums(sid) {
  const st = state.students.find(s=>s.id===sid);
  if (!st) return {gains:0,losses:0};
  let gains=0, losses=0;
  st.contracts.forEach(c=>{ losses+=c.amount; });
  state.students.forEach(s=>{ s.contracts.forEach(c=>{ if(c.targetId===sid) gains+=c.amount; }); });
  return {gains,losses};
}

function snapHistory() {
  const snap = {
    year:  state.year,
    month: state.month,
    classPoints:   state.classes.map(c=>({grade:c.grade,classId:c.classId,cp:c.classPoints})),
    studentPP:     state.students.map(s=>({id:s.id,pp:s.privatePoints})),
    studentGrades: state.students.map(s=>({id:s.id,grade:s.grade,classId:s.classId})),
  };
  state.history.unshift(snap);
  if (state.history.length>HISTORY_MAX) state.history.pop();
}

function advanceMonth() {
  snapHistory();
  const marchToApril = state.month===3;
  if (marchToApril) doGradeUp();

  state.students.forEach(s=>{
    const c = state.classes.find(c=>c.grade===s.grade&&c.classId===s.classId);
    const bonus = c ? c.classPoints*100 : 0;
    const {gains,losses} = contractSums(s.id);
    s.privatePoints += bonus + gains - losses;
  });

  state.month++;
  if (state.month>12){ state.month=1; state.year++; }
  saveState(true);
  renderApp();
  toast(`⏩ ${fmtDate(state.year,state.month)} へ進みました`);
}

function doGradeUp() {
  state.students.forEach(s=>{ if(s.grade===6) s.grade='Graduate'; });
  for (let g=5;g>=1;g--) state.students.forEach(s=>{ if(s.grade===g) s.grade=g+1; });
  state.students.forEach(s=>{ if(s.grade==='Incoming') s.grade=1; });

  const newCls=[];
  state.classes.forEach(c=>{
    if(c.grade<6) newCls.push({...c, grade:c.grade+1});
  });
  CLASS_IDS.forEach(id=>newCls.push(blankClass(1,id)));
  state.classes=newCls;
}

function revertMonth() {
  if (!state.history.length){ toast('✗ 履歴がありません'); return; }
  const snap = state.history.shift();
  const aprilToMarch = state.month===4;
  if (aprilToMarch) undoGradeUp(snap);

  snap.studentPP.forEach(e=>{ const s=state.students.find(t=>t.id===e.id); if(s) s.privatePoints=e.pp; });
  state.month--;
  if (state.month<1){ state.month=12; state.year=Math.max(1,state.year-1); }
  snap.classPoints.forEach(e=>{ const c=state.classes.find(x=>x.grade===e.grade&&x.classId===e.classId); if(c) c.classPoints=e.cp; });

  saveState(true);
  renderApp();
  toast(`⏪ ${fmtDate(state.year,state.month)} に戻しました`);
}

function undoGradeUp(snap) {
  snap.studentGrades.forEach(e=>{ const s=state.students.find(t=>t.id===e.id); if(s){s.grade=e.grade;s.classId=e.classId;} });
  state.classes = snap.classPoints.map(e=>{
    const ex = state.classes.find(c=>c.grade===e.grade&&c.classId===e.classId);
    return ex ? {...ex,grade:e.grade,classId:e.classId,classPoints:e.cp} : blankClass(e.grade,e.classId);
  });
}

/* ================================================================
   NAVIGATION
================================================================ */
function navigate(page, params={}, reset=false) {
  if (reset) navStack=[];
  navStack.push({page,params});
  renderPage(page,params);
  updateBreadcrumb();
}

function goBack() {
  if (navStack.length<=1) return;
  navStack.pop();
  selectMode=false; selectedIds=new Set();
  const t=navStack[navStack.length-1];
  renderPage(t.page,t.params);
  updateBreadcrumb();
}

window.navTo = function(i){
  navStack=navStack.slice(0,i+1);
  selectMode=false; selectedIds=new Set();
  const t=navStack[navStack.length-1];
  renderPage(t.page,t.params);
  updateBreadcrumb();
};

function pageLabel(n) {
  switch(n.page){
    case 'home':      return 'ホーム';
    case 'grade':     return JP.gradeN(n.params.grade);
    case 'class':     return clsName(n.params.grade,n.params.classId);
    case 'graduates': return JP.graduates;
    case 'incoming':  return JP.incoming2;
    case 'ranking':   return JP.ranking;
    case 'profile': {
      const s=state.students.find(x=>x.id===n.params.sid);
      return s ? (s.name||s.id) : 'プロフィール';
    }
    default: return n.page;
  }
}

function updateBreadcrumb() {
  const el=document.getElementById('breadcrumb');
  if (!el) return;
  const parts=navStack.map((n,i)=>{
    if (i===navStack.length-1) return `<span>${pageLabel(n)}</span>`;
    return `<a onclick="navTo(${i})">${pageLabel(n)}</a>`;
  });
  el.innerHTML=parts.join('<span class="bc-sep">›</span>');
}

/* ================================================================
   RENDER ENGINE
================================================================ */
function renderApp() {
  updateDateDisplay();
  const cur=navStack[navStack.length-1];
  if (cur) renderPage(cur.page,cur.params);
  else navigate('home',{},true);
}

function updateDateDisplay() {
  const el=document.getElementById('date-display');
  if (el) el.textContent=fmtDate(state.year,state.month);
}

function renderPage(page,params) {
  const app=document.getElementById('app');
  switch(page){
    case 'home':      app.innerHTML=renderHome();                     break;
    case 'grade':     app.innerHTML=renderGrade(params.grade);        break;
    case 'class':     app.innerHTML=renderClass(params.grade,params.classId); break;
    case 'profile':   app.innerHTML=renderProfile(params.sid);        break;
    case 'graduates': app.innerHTML=renderSpecial('Graduate');        break;
    case 'incoming':  app.innerHTML=renderSpecial('Incoming');        break;
    case 'ranking':   app.innerHTML=renderRankingPage();              break;
    default: app.innerHTML=`<p style="color:var(--rd)">ページ不明</p>`;
  }
  postRender(page,params);
}

/* ================================================================
   HOME PAGE
================================================================ */
function renderHome() {
  const total = state.students.filter(s=>typeof s.grade==='number').length;

  let h = `
    <div class="home-meta">
      <span class="hm-slot">スロット ${currentSlot}</span>
      <span>${fmtDate(state.year,state.month)}</span>
      <span>${total}名在籍</span>
      <span class="hm-link" onclick="navigate('ranking',{},false)">🏆 ${JP.ranking} TOP${RANKING_TOP}</span>
    </div>
    <div class="pg-header">
      <span class="pg-title">システム概要</span>
      <span class="pg-sub">6学年・5クラス統合管理</span>
    </div>
  `;

  GRADES.forEach(grade=>{
    const ranked=getRanked(grade);
    h+=`
      <div class="grade-section">
        <div class="grade-header" onclick="navigate('grade',{grade:${grade}},false)">
          <span class="grade-lbl">${JP.gradeN(grade)}</span>
          <span class="grade-hint">▶ 詳細を見る</span>
        </div>
        <div class="class-strip">
    `;
    ranked.forEach((cls,ri)=>{
      const rank=RANK_LBLS[ri];
      const nm=clsName(grade,cls.classId);
      h+=`
        <div class="cls-mini" onclick="navigate('class',{grade:${grade},classId:${cls.classId}},false)">
          <span class="cls-rank-badge r${rank}">${rank}</span>
          <div class="cls-name-sm">${esc(nm)}</div>
          <div class="cls-cp">${cls.classPoints.toLocaleString()}</div>
          <div class="cls-cp-lbl">CP</div>
          <div class="dist-row" onclick="event.stopPropagation()">
            <input class="dist-inp" type="number" id="di-${grade}-${cls.classId}"
              placeholder="PP" title="${JP.distributeAll}" />
            <button class="dist-btn" onclick="homeDistPP(${grade},${cls.classId})">配布</button>
          </div>
        </div>
      `;
    });
    h+=`</div></div>`;
  });

  // Graduates / Incoming tiles
  const grads = state.students.filter(s=>s.grade==='Graduate').length;
  const inc   = state.students.filter(s=>s.grade==='Incoming').length;
  h+=`
    <div class="special-tiles">
      <div class="sp-tile" style="border-color:var(--yw)" onclick="navigate('graduates',{},false)">
        <div class="sp-count" style="color:var(--yw)">${grads}</div>
        <div class="sp-lbl">${JP.graduates}</div>
      </div>
      <div class="sp-tile" style="border-color:var(--ac)" onclick="navigate('incoming',{},false)">
        <div class="sp-count" style="color:var(--ac)">${inc}</div>
        <div class="sp-lbl">${JP.incoming2}</div>
      </div>
    </div>
  `;

  // History log
  if (state.history.length) {
    h+=`
      <div class="hist-panel mt12">
        <div class="sec-title">最近の履歴 (${state.history.length}件)</div>
        <table class="hist-table">
          <thead><tr><th>日付</th><th>内容</th></tr></thead>
          <tbody>
            ${state.history.slice(0,8).map(s=>`
              <tr><td>${fmtDate(s.year,s.month)}</td>
              <td>スナップショット (${s.classPoints.length}クラス)</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  return h;
}

window.homeDistPP = function(grade, classId){
  const inp=document.getElementById(`di-${grade}-${classId}`);
  const amt=parseInt(inp?.value);
  if (isNaN(amt)){ toast('✗ 有効な数値を入力してください'); return; }
  const nm=clsName(grade,classId);
  const sts=getStudentsOf(grade,classId).filter(s=>!s.isExpelled);
  openModal(`
    <div class="modal-title">${JP.distributeAll}</div>
    <div class="modal-body">
      <p><strong style="color:var(--ac)">${esc(nm)}</strong> の全生徒 (${sts.length}名) に<br>
         <strong style="color:${amt>=0?'var(--gn)':'var(--rd)'}">
           ${amt>=0?'+':''}${amt.toLocaleString()} PP
         </strong> を配布しますか？</p>
      <div class="btn-row">
        <button class="btn btn-ac" onclick="execHomeDist(${grade},${classId},${amt})">実行</button>
        <button class="btn" onclick="closeModal()">キャンセル</button>
      </div>
    </div>
  `);
};

window.execHomeDist = function(grade, classId, amt){
  const sts=getStudentsOf(grade,classId).filter(s=>!s.isExpelled);
  sts.forEach(s=>{ s.privatePoints+=amt; });
  closeModal(); saveState(true); renderApp();
  toast(`✓ ${sts.length}名に ${amt>=0?'+':''}${amt.toLocaleString()} PP を配布`);
};

/* ================================================================
   GRADE PAGE
================================================================ */
function renderGrade(grade) {
  const ranked=getRanked(grade);
  let h=`
    <button class="back-btn" onclick="goBack()">◀ 戻る</button>
    <div class="pg-header">
      <span class="pg-title">${JP.gradeN(grade)}</span>
      <span class="pg-sub">クラス順位 · ${fmtDate(state.year,state.month)}</span>
    </div>
    <div id="grade-page">
  `;

  ranked.forEach((cls,ri)=>{
    const rank=RANK_LBLS[ri];
    const nm=clsName(grade,cls.classId);
    const sts=getStudentsOf(grade,cls.classId).filter(s=>!s.isExpelled);
    const kp=sts.slice(0,5);

    h+=`
      <div class="cls-row bl-${rank}">
        <div class="cls-row-hdr" onclick="navigate('class',{grade:${grade},classId:${cls.classId}},false)">
          <div class="cls-rank-lg r${rank}">${rank}</div>
          <div class="cls-info">
            <div class="cls-info-name">${esc(nm)}</div>
            <div class="cls-info-cp">${cls.classPoints.toLocaleString()}<small>CP</small></div>
          </div>
          <div></div>
          <div class="cls-row-meta">${sts.length}名 ▶ クラスへ</div>
        </div>
        <div class="kp-strip">
    `;

    if (!kp.length) h+=`<span style="color:var(--tx3);font-size:.7rem;padding:6px">生徒なし</span>`;
    kp.forEach(s=>{
      h+=`
        <div class="kp-card" onclick="navigate('profile',{sid:'${s.id}'},false)">
          <div class="kp-name">${esc(s.name)||'<span style="color:var(--tx3)">(未記入)</span>'}</div>
          <div class="kp-stats">
            <div class="kp-stat">
              <span class="kv ${ppCol(s.privatePoints)}">${fmtPP(s.privatePoints)}</span>
              <span class="kl">PP</span>
            </div>
            <div class="kp-stat">
              <span class="kv" style="color:var(--yw)">${s.protectPoints}</span>
              <span class="kl">保護</span>
            </div>
          </div>
        </div>
      `;
    });
    h+=`</div></div>`;
  });

  return h+'</div>';
}

/* ================================================================
   CLASS PAGE
================================================================ */
function renderClass(grade, classId) {
  const cls = getCls(grade, classId);
  const rank = rankOf(grade, classId);
  const nm   = clsName(grade, classId);
  const active   = getStudentsOf(grade,classId).filter(s=>!s.isExpelled);
  const expelled = getStudentsOf(grade,classId).filter(s=>s.isExpelled);
  const selCount = selectedIds.size;

  let h=`
    <button class="back-btn" onclick="goBack()">◀ 戻る</button>

    <div class="cls-pg-top">
      <div class="cls-pg-title-block">
        <div class="pg-header" style="margin-bottom:5px">
          <span class="pg-title">${esc(nm)}</span>
          <span class="cls-rank-lg r${rank}" style="font-size:1.25rem;font-family:var(--fd)">順位 ${rank}</span>
        </div>
        <div class="cls-name-edit">
          <label>クラス名：</label>
          <input class="cls-name-input f-input" id="cls-nm"
            value="${escA(cls?.customName||'')}" placeholder="${grade}年${rank}組 (規定)" />
          <button class="btn btn-sm" onclick="saveClsName(${grade},${classId})">変更</button>
        </div>
      </div>
      <div class="cp-ctrl">
        <label>クラスポイント：</label>
        <input type="number" id="cp-inp" class="f-input" value="${cls?.classPoints||0}" />
        <button class="btn btn-sm" onclick="setCP(${grade},${classId})">設定</button>
        <button class="btn btn-sm" onclick="adjCP(${grade},${classId},100)">+100</button>
        <button class="btn btn-sm" onclick="adjCP(${grade},${classId},-100)">-100</button>
      </div>
    </div>

    <!-- Bulk bar -->
    <div class="bulk-bar">
      <label>${JP.bulkPP}：</label>
      <button class="btn btn-sm ${selectMode?'btn-yw':''}"
        onclick="toggleSel(${grade},${classId})">
        ${selectMode?'✓ ':''} ${JP.selectMode}
      </button>
      ${selectMode?`
        <button class="btn btn-sm" onclick="selAll(${grade},${classId})">${JP.selectAll}</button>
        <button class="btn btn-sm" onclick="deselAll(${grade},${classId})">解除</button>
        <span class="bulk-count">${selCount}名選択中</span>
        <input type="number" class="bulk-inp f-input" id="blk-pp" placeholder="PP量" />
        <button class="btn btn-sm btn-ac" onclick="applyBulk(${grade},${classId})">${JP.applyBulkPP}</button>
      `:''}
    </div>

    <div class="search-row">
      <input class="f-input" id="s-search" placeholder="生徒を検索..." oninput="filterStudents()" />
      <button class="btn btn-sm" onclick="addStudentTo(${grade},${classId})">＋ ${JP.addStudent}</button>
    </div>

    <div class="students-grid ${selectMode?'sel-mode':''}">
      ${renderStudentCards(active, grade, classId, true)}
    </div>
  `;

  if (expelled.length) {
    h+=`
      <div class="alt-hdr">
        <span>退学処分 (${expelled.length}名)</span><hr />
      </div>
      <div class="students-grid ${selectMode?'sel-mode':''}">
        ${renderStudentCards(expelled, grade, classId, false)}
      </div>
    `;
  }

  return h;
}

function renderStudentCards(students, grade, classId, showDel) {
  if (!students.length) return `<div style="color:var(--tx3);grid-column:1/-1;padding:8px;font-size:.73rem">生徒なし</div>`;
  return students.map(s=>{
    const isSel=selectedIds.has(s.id);
    return `
      <div class="s-card ${s.isExpelled?'expelled':''} ${isSel?'selected':''}"
           data-id="${s.id}" data-name="${escA(s.name.toLowerCase())}"
           onclick="cardClick('${s.id}',${grade},${classId})">
        <div class="s-chk">${isSel?'✓':''}</div>
        <span class="s-id">${s.id}</span>
        <div class="s-name">${esc(s.name)||'<span style="color:var(--tx3)">(未記入)</span>'}</div>
        <div class="s-row">
          <div class="s-stat">
            <span class="sv ${ppCol(s.privatePoints)}">${fmtPP(s.privatePoints)}</span>
            <span class="sl2">PP</span>
          </div>
          <div class="s-stat">
            <span class="sv" style="color:var(--yw)">${s.protectPoints}</span>
            <span class="sl2">保護</span>
          </div>
          <div class="s-stat">
            <span class="sv" style="color:var(--tx1)">${s.gender==='M'?JP.male:JP.female}</span>
            <span class="sl2">性</span>
          </div>
        </div>
        ${showDel&&!s.isExpelled?`<button class="s-del" onclick="event.stopPropagation();confirmDelete('${s.id}',${grade},${classId})">🗑</button>`:''}
      </div>
    `;
  }).join('');
}

window.cardClick = function(sid, grade, classId){
  if (selectMode){
    selectedIds.has(sid) ? selectedIds.delete(sid) : selectedIds.add(sid);
    renderPage('class',{grade,classId});
  } else {
    navigate('profile',{sid},false);
  }
};

window.toggleSel = function(g,c){ selectMode=!selectMode; selectedIds=new Set(); renderPage('class',{grade:g,classId:c}); };
window.selAll    = function(g,c){ getStudentsOf(g,c).filter(s=>!s.isExpelled).forEach(s=>selectedIds.add(s.id)); renderPage('class',{grade:g,classId:c}); };
window.deselAll  = function(g,c){ selectedIds=new Set(); renderPage('class',{grade:g,classId:c}); };

window.applyBulk = function(grade, classId){
  const amt=parseInt(document.getElementById('blk-pp')?.value);
  if (isNaN(amt)){ toast('✗ 有効な数値を入力してください'); return; }
  if (!selectedIds.size){ toast('✗ 生徒が選択されていません'); return; }
  openModal(`
    <div class="modal-title">${JP.bulkPP}</div>
    <div class="modal-body">
      <p>選択中の <strong style="color:var(--ac)">${selectedIds.size}名</strong> に<br>
         <strong style="color:${amt>=0?'var(--gn)':'var(--rd)'}">
           ${amt>=0?'+':''}${amt.toLocaleString()} PP
         </strong> を付与しますか？</p>
      <div class="btn-row">
        <button class="btn btn-ac" onclick="execBulk(${grade},${classId},${amt})">実行</button>
        <button class="btn" onclick="closeModal()">キャンセル</button>
      </div>
    </div>
  `);
};

window.execBulk = function(grade, classId, amt){
  let n=0;
  selectedIds.forEach(id=>{ const s=state.students.find(x=>x.id===id); if(s){ s.privatePoints+=amt; n++; } });
  selectedIds=new Set(); selectMode=false;
  closeModal(); saveState(true); renderPage('class',{grade,classId});
  toast(`✓ ${n}名に ${amt>=0?'+':''}${amt.toLocaleString()} PP を付与`);
};

window.filterStudents = function(){
  const q=(document.getElementById('s-search')?.value||'').toLowerCase();
  document.querySelectorAll('.s-card[data-name]').forEach(c=>{
    c.style.display=c.dataset.name.includes(q)?'':'none';
  });
};

window.saveClsName = function(grade, classId){
  const v=document.getElementById('cls-nm')?.value?.trim()||'';
  const c=getCls(grade,classId);
  if (c) c.customName=v;
  saveState(true); renderApp();
  toast('✓ クラス名を変更しました');
};

window.setCP = function(grade, classId){
  const v=parseInt(document.getElementById('cp-inp')?.value);
  if (isNaN(v)) return;
  const c=getCls(grade,classId);
  if (c){ c.classPoints=v; saveState(true); renderApp(); }
};

window.adjCP = function(grade, classId, d){
  const c=getCls(grade,classId);
  if (c){ c.classPoints+=d; const i=document.getElementById('cp-inp'); if(i) i.value=c.classPoints; saveState(true); renderApp(); }
};

window.addStudentTo = function(grade, classId){
  const s=blankStudent(grade, classId);
  state.students.push(s);
  saveState(true); renderPage('class',{grade,classId});
  toast(`✓ 生徒を追加しました (${s.id})`);
};

window.confirmDelete = function(sid, grade, classId){
  const s=state.students.find(x=>x.id===sid);
  if (!s) return;
  openModal(`
    <div class="modal-title">生徒削除確認</div>
    <div class="modal-body">
      <p><strong style="color:var(--rd)">${esc(s.name)||s.id}</strong> を<br>
         完全に削除しますか？<br><br>
         <span style="color:var(--tx2);font-size:.78rem">この操作は取り消せません。コントラクトも削除されます。</span></p>
      <div class="btn-row">
        <button class="btn btn-dn" onclick="deleteStudent('${sid}',${grade},${classId})">削除実行</button>
        <button class="btn" onclick="closeModal()">キャンセル</button>
      </div>
    </div>
  `);
};

window.deleteStudent = function(sid, grade, classId){
  // Remove from students array
  state.students = state.students.filter(s=>s.id!==sid);
  // Remove any contracts targeting this student
  state.students.forEach(s=>{ s.contracts=s.contracts.filter(c=>c.targetId!==sid); });
  selectedIds.delete(sid);
  closeModal(); saveState(true); renderPage('class',{grade,classId});
  toast(`✓ 生徒を削除しました`);
};

/* ================================================================
   PROFILE PAGE — Full Japanese
================================================================ */
function renderProfile(sid) {
  const s=state.students.find(x=>x.id===sid);
  if (!s) return `<p style="color:var(--rd)">生徒が見つかりません</p>`;

  const ppCls=s.privatePoints>=0?'pos':'neg';
  const statusLabel = s.isExpelled?JP.expelled : s.grade==='Graduate'?JP.graduate : s.grade==='Incoming'?JP.incoming : JP.active;
  const badgeCls    = s.isExpelled?'badge-ex'  : s.grade==='Graduate'?'badge-gr'   : s.grade==='Incoming'?'badge-ic'   : 'badge-in';
  const gradeDisp   = typeof s.grade==='number' ? JP.gradeN(s.grade) : statusLabel;
  const clsDisp     = typeof s.grade==='number' ? clsName(s.grade,s.classId) : '―';

  // Stat bars
  const bars = STATS_KEYS.map(k=>{
    const v=s.stats[k]||1;
    const pct=((v-1)/14)*100;
    return `
      <div class="sb-row">
        <span class="sb-lbl">${JP[k]}</span>
        <div class="sb-track"><div class="sb-fill" style="width:${pct}%"></div></div>
        <span class="sb-val">${v}</span>
      </div>`;
  }).join('');

  // Grade options
  const gradeOpts=[
    ...GRADES.map(g=>`<option value="${g}" ${s.grade===g?'selected':''}>${JP.gradeN(g)}</option>`),
    `<option value="Graduate" ${s.grade==='Graduate'?'selected':''}>卒業生</option>`,
    `<option value="Incoming" ${s.grade==='Incoming'?'selected':''}>入学予定</option>`,
  ].join('');

  const clsOpts=CLASS_IDS.map(id=>`<option value="${id}" ${s.classId===id?'selected':''}>${id}</option>`).join('');

  // Contracts out
  const ctrOut = s.contracts.length
    ? s.contracts.map((c,i)=>{
        const t=state.students.find(x=>x.id===c.targetId);
        const tn=t?(t.name||t.id):`[不明 ${c.targetId}]`;
        return `
          <div class="ctr-item">
            <span>→ ${esc(tn)}</span>
            <span class="ctr-amt">${c.amount.toLocaleString()} PP/月</span>
            <button class="ctr-del" onclick="rmContract('${sid}',${i})">✕</button>
          </div>`;
      }).join('')
    : `<div style="color:var(--tx3);font-size:.71rem">契約なし</div>`;

  // Contracts in
  const ctrIn=[];
  state.students.forEach(o=>{ o.contracts.forEach(c=>{ if(c.targetId===sid) ctrIn.push({from:o.name||o.id,amt:c.amount}); }); });
  const ctrInHtml = ctrIn.length
    ? ctrIn.map(c=>`
        <div class="ctr-item">
          <span>← ${esc(c.from)}</span>
          <span class="ctr-amt pos">+${c.amt.toLocaleString()} PP/月</span>
        </div>`).join('')
    : `<div style="color:var(--tx3);font-size:.71rem">受信契約なし</div>`;

  return `
    <button class="back-btn" onclick="goBack()">◀ 戻る</button>
    <div id="prof-layout">

      <!-- ── Sidebar ── -->
      <div class="prof-sidebar">
        <div class="prof-name">${esc(s.name)||'(未記入)'}</div>
        <div class="prof-id">${s.id}</div>
        <span class="badge ${badgeCls}">${statusLabel}</span>
        <div class="prof-pp ${ppCls}">${s.privatePoints.toLocaleString()}</div>
        <div class="prof-pp-lbl">${JP.pp}</div>
        <div class="prof-prot">🛡 ${s.protectPoints} ${JP.protect}</div>

        <table class="info-tbl">
          <tr><td>${JP.gender}</td><td>${s.gender==='M'?JP.male:JP.female}</td></tr>
          <tr><td>${JP.dob}</td><td>${s.dob||'未設定'}</td></tr>
          <tr><td>${JP.grade}</td><td>${gradeDisp}</td></tr>
          <tr><td>${JP.cls}</td><td>${esc(clsDisp)}</td></tr>
        </table>

        <div class="sec-title mt8">能力プロフィール</div>
        <div class="sb-grid">${bars}</div>

        <div style="margin-top:12px">
          ${s.isExpelled
            ? `<button class="btn-expel" style="border-color:var(--gn);color:var(--gn)" onclick="reinstate('${sid}')">↩ ${JP.reinstate}</button>`
            : `<button class="btn-expel" onclick="confirmExpel('${sid}')">${JP.expel}</button>`
          }
        </div>
      </div>

      <!-- ── Main edit ── -->
      <div class="prof-main">

        <div class="prof-sec">
          <div class="sec-title">基本情報</div>
          <div class="fr"><label>${JP.name}</label><input class="f-input" id="pf-name" value="${escA(s.name)}" placeholder="(未記入)" /></div>
          <div class="fr"><label>${JP.gender}</label>
            <select class="f-select" id="pf-gender">
              <option value="M" ${s.gender==='M'?'selected':''}>男性</option>
              <option value="F" ${s.gender==='F'?'selected':''}>女性</option>
            </select>
          </div>
          <div class="fr"><label>${JP.dob}</label><input class="f-input" id="pf-dob" type="date" value="${s.dob||''}" /></div>
          <div class="fr"><label>${JP.grade}</label><select class="f-select" id="pf-grade">${gradeOpts}</select></div>
          <div class="fr"><label>${JP.cls} ID</label><select class="f-select" id="pf-cls">${clsOpts}</select></div>
          <div class="fr"><label>${JP.pp}</label><input class="f-input" id="pf-pp" type="number" value="${s.privatePoints}" /></div>
          <div class="fr"><label>${JP.protect}</label><input class="f-input" id="pf-prot" type="number" value="${s.protectPoints}" min="0" /></div>
        </div>

        <div class="prof-sec">
          <div class="sec-title">能力値 (1–15)</div>
          <div class="stats-grid">
            ${STATS_KEYS.map(k=>`
              <div class="stat-slide">
                <label>${JP[k]}</label>
                <input type="range" id="st-${k}" min="1" max="15" value="${s.stats[k]||1}"
                  oninput="document.getElementById('sv-${k}').textContent=this.value" />
                <span class="stat-val" id="sv-${k}">${s.stats[k]||1}</span>
              </div>`).join('')}
          </div>
        </div>

        <div class="prof-sec">
          <div class="sec-title">送信コントラクト（支出）</div>
          <div class="ctr-list">${ctrOut}</div>
          <div class="ctr-add">
            <input id="ct-target" class="f-input" placeholder="生徒IDまたは氏名..." style="flex:2" />
            <input id="ct-amt"    class="f-input" type="number" placeholder="PP/月" style="flex:1" />
            <button class="btn btn-sm" onclick="addContract('${sid}')">＋ 追加</button>
          </div>
        </div>

        <div class="prof-sec">
          <div class="sec-title">受信コントラクト（収入）</div>
          <div class="ctr-list">${ctrInHtml}</div>
        </div>

        <div class="prof-sec">
          <div class="sec-title">${JP.specialAbility}（最大300文字）</div>
          <textarea class="sa-area" id="pf-sa" maxlength="300"
            placeholder="特殊能力を記載...">${esc(s.specialAbility||'')}</textarea>
          <div class="sa-count" id="sa-ct">${(s.specialAbility||'').length}/300</div>
        </div>

        <button class="btn-save-prof" onclick="saveProfile('${sid}')">✓ プロフィールを保存</button>
      </div>
    </div>
  `;
}

window.saveProfile = function(sid){
  const s=state.students.find(x=>x.id===sid);
  if (!s) return;
  s.name   = document.getElementById('pf-name')?.value?.trim()||'';
  s.gender = document.getElementById('pf-gender')?.value||'M';
  s.dob    = document.getElementById('pf-dob')?.value||'';
  const gv = document.getElementById('pf-grade')?.value;
  s.grade  = isNaN(+gv)?gv:+gv;
  s.classId= +document.getElementById('pf-cls')?.value||0;
  const ppv= parseInt(document.getElementById('pf-pp')?.value);
  if (!isNaN(ppv)) s.privatePoints=ppv;
  const prv= parseInt(document.getElementById('pf-prot')?.value);
  if (!isNaN(prv)) s.protectPoints=Math.max(0,prv);
  s.specialAbility=document.getElementById('pf-sa')?.value||'';
  STATS_KEYS.forEach(k=>{ const e=document.getElementById(`st-${k}`); if(e) s.stats[k]=+e.value; });
  saveState(true); renderApp();
  toast('✓ プロフィールを保存しました：'+(s.name||s.id));
};

window.rmContract = function(sid, idx){
  const s=state.students.find(x=>x.id===sid);
  if (s) s.contracts.splice(idx,1);
  saveState(true); navigate('profile',{sid},false); updateBreadcrumb();
  toast('✓ コントラクトを削除しました');
};

window.addContract = function(sid){
  const s=state.students.find(x=>x.id===sid);
  if (!s) return;
  const ti=document.getElementById('ct-target')?.value?.trim();
  const amt=parseInt(document.getElementById('ct-amt')?.value);
  if (!ti||isNaN(amt)||amt<=0){ toast('✗ 入力が無効です'); return; }
  let t=state.students.find(x=>x.id===ti);
  if (!t) t=state.students.find(x=>x.name.toLowerCase().includes(ti.toLowerCase()));
  if (!t){ toast('✗ 生徒が見つかりません'); return; }
  if (t.id===sid){ toast('✗ 自分自身にコントラクトできません'); return; }
  s.contracts.push({targetId:t.id,amount:amt});
  saveState(true); navigate('profile',{sid},false); updateBreadcrumb();
  toast(`✓ コントラクト設定 → ${t.name||t.id}: ${amt} PP/月`);
};

window.confirmExpel = function(sid){
  const s=state.students.find(x=>x.id===sid);
  if (!s) return;
  openModal(`
    <div class="modal-title">退学確認</div>
    <div class="modal-body">
      <p><strong>${esc(s.name)||s.id}</strong> を退学処分にしますか？<br><br>
         コントラクトと負債は処理され続けます。</p>
      <div class="btn-row">
        <button class="btn btn-dn" onclick="expelStudent('${sid}')">退学実行</button>
        <button class="btn" onclick="closeModal()">キャンセル</button>
      </div>
    </div>
  `);
};

window.expelStudent = function(sid){
  const s=state.students.find(x=>x.id===sid);
  if (s) s.isExpelled=true;
  closeModal(); saveState(true); goBack();
  toast('⚠ 退学処分：'+(s?.name||sid));
};

window.reinstate = function(sid){
  const s=state.students.find(x=>x.id===sid);
  if (s) s.isExpelled=false;
  saveState(true); renderApp();
  toast('✓ 復帰：'+(s?.name||sid));
};

/* ================================================================
   GLOBAL RANKING PAGE
================================================================ */
function renderRankingPage() {
  const ranked = computeGlobalRanking();

  let h=`
    <button class="back-btn" onclick="goBack()">◀ 戻る</button>
    <div class="pg-header">
      <span class="pg-title">🏆 ${JP.ranking} TOP ${RANKING_TOP}</span>
      <span class="pg-sub">全生徒PP降順 · 同順位は競技順位方式</span>
    </div>
    <div class="rank-table-wrap">
      <table class="rank-table">
        <thead>
          <tr>
            <th style="text-align:right">順位</th>
            <th>氏名</th>
            <th>学年 / クラス</th>
            <th>ID</th>
            <th style="text-align:right">PP</th>
          </tr>
        </thead>
        <tbody>
  `;

  if (!ranked.length) {
    h+=`<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--tx3)">データなし</td></tr>`;
  }

  ranked.forEach(({rank,student:s})=>{
    const gradeDisp = typeof s.grade==='number' ? JP.gradeN(s.grade) : (s.grade==='Graduate'?'卒業生':'入学予定');
    const clsDisp   = typeof s.grade==='number' ? clsName(s.grade,s.classId) : '―';
    const isTop3    = rank<=3;
    h+=`
      <tr>
        <td class="rank-num ${isTop3?'top3':''}">${rank}</td>
        <td class="rk-name" onclick="navigate('profile',{sid:'${s.id}'},false)">${esc(s.name)||'<span style="color:var(--tx3)">(未記入)</span>'}</td>
        <td style="font-size:.72rem;color:var(--tx1)">${gradeDisp} / ${esc(clsDisp)}</td>
        <td style="font-size:.65rem;color:var(--tx3)">${s.id}</td>
        <td class="rk-pp ${s.privatePoints<0?'neg':''}">${s.privatePoints.toLocaleString()}</td>
      </tr>
    `;
  });

  h+=`</tbody></table></div>`;

  // Medal summary for top 3
  if (ranked.length>=1) {
    h+=`
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        ${ranked.slice(0,Math.min(3,ranked.length)).map(({rank,student:s},i)=>{
          const medals=['🥇','🥈','🥉'];
          return `
            <div style="background:var(--c2);border:1px solid var(--bdr);padding:10px 14px;flex:1;min-width:180px">
              <div style="font-size:.7rem;color:var(--tx2);margin-bottom:4px">${medals[i]} 第${rank}位</div>
              <div style="font-family:var(--fj);font-size:.88rem;color:var(--tx0);margin-bottom:3px">${esc(s.name)||'(未記入)'}</div>
              <div style="font-family:var(--fd);font-size:1.1rem;color:var(--gn)">${s.privatePoints.toLocaleString()} PP</div>
            </div>`;
        }).join('')}
      </div>
    `;
  }

  return h;
}

/* ================================================================
   SPECIAL PAGES (Graduates / Incoming)
================================================================ */
function renderSpecial(gradeType) {
  const isGrad = gradeType==='Graduate';
  const sts = state.students.filter(s=>s.grade===gradeType);
  const title = isGrad ? JP.graduates : JP.incoming2;
  const col   = isGrad ? 'var(--yw)' : 'var(--ac)';

  let h=`
    <button class="back-btn" onclick="goBack()">◀ 戻る</button>
    <div class="pg-header">
      <span class="pg-title" style="color:${col}">${title}</span>
      <span class="pg-sub">${sts.length}名</span>
    </div>
    <div class="search-row">
      <input class="f-input" id="s-search" placeholder="生徒を検索..." oninput="filterStudents()" />
      ${!isGrad?`<button class="btn btn-sm" onclick="addIncoming()">＋ 追加</button>`:''}
    </div>
    <div id="students-grid" class="students-grid">
  `;

  if (!sts.length) h+=`<div style="color:var(--tx3);grid-column:1/-1;padding:20px;text-align:center">生徒なし</div>`;
  sts.forEach(s=>{
    h+=`
      <div class="s-card ${s.isExpelled?'expelled':''}"
           data-name="${escA(s.name.toLowerCase())}"
           onclick="navigate('profile',{sid:'${s.id}'},false)">
        <span class="s-id">${s.id}</span>
        <div class="s-name">${esc(s.name)||'<span style="color:var(--tx3)">(未記入)</span>'}</div>
        <div class="s-row">
          <div class="s-stat">
            <span class="sv ${ppCol(s.privatePoints)}">${fmtPP(s.privatePoints)}</span>
            <span class="sl2">PP</span>
          </div>
          <div class="s-stat">
            <span class="sv" style="color:var(--yw)">${s.protectPoints}</span>
            <span class="sl2">保護</span>
          </div>
        </div>
      </div>
    `;
  });
  h+=`</div>`;
  return h;
}

window.addIncoming = function(){
  const s=blankStudent('Incoming',0);
  state.students.push(s);
  saveState(true); renderApp();
  toast('✓ 入学予定を追加しました: '+s.id);
};

/* ================================================================
   MODAL
================================================================ */
function openModal(html) {
  document.getElementById('modal-body').innerHTML=html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
window.closeModal = function(){
  document.getElementById('modal-overlay').classList.add('hidden');
};

/* ================================================================
   POST-RENDER HANDLERS
================================================================ */
function postRender(page) {
  // Textarea char counter
  const ta=document.getElementById('pf-sa'), ct=document.getElementById('sa-ct');
  if (ta&&ct) ta.addEventListener('input',()=>{ ct.textContent=ta.value.length+'/300'; });
}

/* ================================================================
   GLOBAL EVENT BINDINGS
================================================================ */
function bindEvents() {
  document.getElementById('btn-prev').addEventListener('click', revertMonth);
  document.getElementById('btn-next').addEventListener('click', advanceMonth);
  document.getElementById('btn-save').addEventListener('click', ()=>saveState());
  document.getElementById('btn-reset').addEventListener('click', ()=>{
    openModal(`
      <div class="modal-title">スロット${currentSlot} リセット確認</div>
      <div class="modal-body">
        <p>スロット${currentSlot}の<strong>全データを削除</strong>して<br>
           1,200名の空欄データを再生成します。<br>この操作は取り消せません。</p>
        <div class="btn-row">
          <button class="btn btn-dn" onclick="doReset()">リセット実行</button>
          <button class="btn" onclick="closeModal()">キャンセル</button>
        </div>
      </div>
    `);
  });
  document.querySelectorAll('.sl').forEach(b=>{
    b.addEventListener('click',()=>{ const n=+b.dataset.slot; if(n!==currentSlot) switchSlot(n); });
  });
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e=>{ if(e.target.id==='modal-overlay') closeModal(); });
}

window.doReset = function(){
  closeModal(); resetSlot();
  selectMode=false; selectedIds=new Set(); navStack=[];
  navigate('home',{},true);
  toast(`✓ スロット${currentSlot} リセット完了 — 1,200名のブランクデータを生成`);
};

window.navigate     = navigate;
window.navigateBack = goBack;

/* ================================================================
   BOOT
================================================================ */
function showLoader(msg) {
  const el=document.createElement('div');
  el.id='loading';
  el.innerHTML=`<div class="ld-logo">COTE-OS</div>
    <div class="ld-txt">${msg}</div>
    <div class="ld-sub">しばらくお待ちください...</div>`;
  document.body.appendChild(el);
  return el;
}

function boot() {
  const ok=loadSlot(currentSlot);
  if (!ok||!state?.students?.length) {
    const ld=showLoader('1,200名の初期データを生成中...');
    setTimeout(()=>{
      state=newState();
      generateInitialData();
      saveState(true);
      ld.remove();
      finishBoot();
    }, 80);
  } else {
    finishBoot();
  }
}

function finishBoot() {
  bindEvents();
  updateSlotButtons();
  updateDateDisplay();
  navigate('home',{},true);
}

if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
