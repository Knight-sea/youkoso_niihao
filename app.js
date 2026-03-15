/* app.js — v9.5: Navigation, time leap, event bindings, boot sequence
   ─────────────────────────────────────────────────────────────────
   Module load order:
   1. names-data.js  — Name arrays
   2. core.js         — Constants, state, utilities
   3. save-load.js    — Save/Load + Firebase
   4. render.js       — All rendering
   5. features.js     — Trend graph + CSV export
   6. app.js          — This file (navigation, events, boot)
   ───────────────────────────────────────────────────────────────── */

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
  if(!state){toast('✗ データがありません','err');return;}
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
  // Stamp graduateYear before grade changes
  state.students.forEach(s=>{
    if(s.grade===6){
      s.grade='Graduate';
      s.graduateYear=state.year; // v7.4: archive year for cohort grouping
    }
  });
  for(let g=5;g>=1;g--) state.students.forEach(s=>{if(s.grade===g)s.grade=g+1;});

  // v7.4: Promote Incoming → Grade 1, assigning fresh Grade-1 IDs
  // cohortGrade is cleared after promotion (no longer needed)
  const hadIncoming = state.students.some(s=>s.grade==='Incoming');
  state.students.forEach(s=>{
    if(s.grade==='Incoming'){
      s.grade=1;
      delete s.cohortGrade;
      // Re-generate ID under new grade-1 prefix
      s.id=genStudentId(1);
    }
  });

  const kept=state.classes.filter(c=>c.grade<6).map(c=>{
    const newGrade=c.grade+1;
    const newStaticName=c.customName?c.name:JP.clsDef(newGrade,RANK_LABELS[c.classId]||'A');
    return {...c,grade:newGrade,name:newStaticName};
  });
  CLASS_IDS.forEach(id=>kept.push(blankClass(1,id,RANK_LABELS[id])));
  state.classes=kept;

  /* v7.9: Auto-fill — if no Incoming cohort was prepared, generate
     200 EMPTY Grade-1 slots (IDs assigned, all other fields blank).
     No randomiseGrade call — slots are left for manual/random fill.  */
  if(!hadIncoming){
    CLASS_IDS.forEach(cid=>{
      for(let i=0;i<40;i++) state.students.push(blankStudent(1,cid));
    });
    toast('⚡ 入学予定者なし — 1年生の空枠200名を自動作成しました','warn',4000);
  }
}
function revertMonth(){
  if(!state){toast('✗ データがありません','err');return;}
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
let gearOpen     = false;
let themeFlyOpen = false;

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
  if(!gearOpen) return;
  gearOpen=false;
  document.getElementById('gear-btn')?.classList.remove('open');
  const tray=document.getElementById('gear-tray');
  tray?.classList.remove('open');
  tray?.setAttribute('aria-hidden','true');
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
  if(!themeFlyOpen) return;
  themeFlyOpen=false;
  document.getElementById('theme-flyout')?.classList.remove('open');
  document.getElementById('btn-theme')?.classList.remove('open');
}

/* ──────────────────────────────────────────────────────────────────
   NAVIGATION
────────────────────────────────────────────────────────────────── */
/* v8.5: navigate — deduplicate consecutive same-page pushes.
   If the top of the stack is already the same page+params, replace
   instead of push (prevents duplicate profile entries from card clicks). */
function navigate(page,params={},reset=false){
  if(reset) navStack=[];
  const top=navStack[navStack.length-1];
  /* Dedup: same page + same sid (profile) → replace instead of push */
  if(!reset && top && top.page===page){
    if(page==='profile' && top.params?.sid===params?.sid){
      navStack[navStack.length-1]={page,params};
      renderPage(page,params); updateBreadcrumb();
      return;
    }
  }
  navStack.push({page,params});
  renderPage(page,params); updateBreadcrumb();
}
function navigateReplace(page,params={}){
  if(navStack.length>0) navStack[navStack.length-1]={page,params};
  else navStack.push({page,params});
  renderPage(page,params); updateBreadcrumb();
}
function navigateSafe(page,params={}){
  const top=navStack[navStack.length-1];
  if(top&&top.page===page) { navigateReplace(page,params); }
  else { navigate(page,params,false); }
}
window.gearNav=function(page){
  navigateSafe(page,{});
};
function goBack(){
  if(navStack.length<=1) return;
  navStack.pop(); selectMode=false; swapMode=false; selectedIds=new Set();
  const t=navStack[navStack.length-1]; renderPage(t.page,t.params); updateBreadcrumb();
}
window.navTo=function(i){
  navStack=navStack.slice(0,i+1); selectMode=false; swapMode=false; selectedIds=new Set();
  const t=navStack[navStack.length-1]; renderPage(t.page,t.params); updateBreadcrumb();
};
function pageLabel(n){
  switch(n.page){
    case 'home':         return 'ホーム';
    case 'grade':        return JP.gradeN(n.params.grade);
    case 'class':        return clsName(n.params.grade,n.params.classId);
    case 'graduates':    return JP.graduates;
    case 'incoming':     return JP.incoming2;
    case 'graduateYear': return `${n.params.yrKey} 卒業`;
    case 'graduateClass':return `${n.params.yrKey} · クラス${RANK_LABELS[n.params.classId]||n.params.classId}`;
    case 'incomingCohort':return `入学予定 第${n.params.cg}期`;
    case 'incomingClass': return `第${n.params.cg}期 · クラス${RANK_LABELS[n.params.classId]||n.params.classId}`;
    case 'ranking':      return JP.ranking;
    case 'classRanking': return 'クラスランキング';
    case 'history':      return JP.history;
    case 'profile':   {
      const s=state?.students?.find(x=>x.id===n.params.sid);
      return s?(s.name||s.id):'プロフィール';
    }
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
   EVENT BINDINGS
────────────────────────────────────────────────────────────────── */
function bindEvents(){
  /* Time navigation */
  document.getElementById('btn-prev')?.addEventListener('click', revertMonth);
  document.getElementById('btn-next')?.addEventListener('click', advanceMonth);
  document.addEventListener('keydown', e=>{
    if(!e.ctrlKey) return;
    if(e.key==='ArrowLeft'){e.preventDefault();revertMonth();}
    if(e.key==='ArrowRight'){e.preventDefault();advanceMonth();}
    if(e.key==='s'){e.preventDefault();saveState();}
  });

  /* Gear toggle — ONLY the gear button opens/closes; clicking elsewhere does NOT close it */
  document.getElementById('gear-btn')?.addEventListener('click', e=>{
    e.stopPropagation(); toggleGear();
  });

  /* Tray swallows its own clicks */
  document.getElementById('gear-tray')?.addEventListener('click', e=>{
    e.stopPropagation();
  });

  /* History — no tray close */
  document.getElementById('btn-history')?.addEventListener('click', e=>{
    e.stopPropagation(); navigateSafe('history',{});
  });

  /* Theme flyout */
  document.getElementById('btn-theme')?.addEventListener('click', e=>{
    e.stopPropagation(); toggleThemeFly(e);
  });
  document.querySelectorAll('.tf-opt').forEach(b=>{
    b.addEventListener('click', e=>{
      e.stopPropagation(); applyTheme(b.dataset.theme); closeThemeFly();
      toast(`テーマ: ${b.dataset.theme}`);
    });
  });

  /* Save/Load modal + BGM */
  document.getElementById('btn-save')?.addEventListener('click', e=>{
    e.stopPropagation();
    openSaveLoadModal();
  });
  document.getElementById('btn-bgm')?.addEventListener('click', e=>{
    e.stopPropagation();
    toggleBGM();
  });

  /* v7.5: volume slider — syncs SoundCloud widget + green fill bar */
  document.getElementById('bgm-volume')?.addEventListener('input', function(){
    const vol = parseInt(this.value, 10) / 100;
    if(bgmReady && bgmWidget){
      bgmWidget.setVolume(vol * 100);
    }
    syncVolFill();
  });

  /* v7.5: mouseleave/mouseenter on #bgm-hitbox — reliable open/close.
     .vol-open lives on #bgm-hitbox itself (bgm-column removed in v7.5).
     The CSS ::after bridge prevents premature mouseleave mid-transition. */
  document.getElementById('bgm-hitbox')?.addEventListener('mouseleave', ()=>{
    const hitbox = document.getElementById('bgm-hitbox');
    if(hitbox && bgmEnabled) hitbox.classList.remove('vol-open');
  });
  document.getElementById('bgm-hitbox')?.addEventListener('mouseenter', ()=>{
    const hitbox = document.getElementById('bgm-hitbox');
    if(hitbox && bgmEnabled) hitbox.classList.add('vol-open');
  });

  /* v7.3: uic-overlay — cancel on backdrop click or Escape */
  document.getElementById('uic-overlay')?.addEventListener('click', e=>{
    if(e.target.id==='uic-overlay'){
      document.getElementById('uic-btn-cancel')?.click();
    }
  });
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape'){
      const ov=document.getElementById('uic-overlay');
      if(ov && !ov.classList.contains('hidden')){
        document.getElementById('uic-btn-cancel')?.click();
      }
    }
  });

  document.getElementById('file-pick')?.addEventListener('change', function(){
    onFilePicked(this.files[0]); this.value='';
  });
  bindSaveLoadModalControls();

  /* v8.6: Firebase Login / Logout button handlers */
  bindFirebaseControls();

  /* Modal close */
  document.getElementById('modal-x')?.addEventListener('click', closeModal);
  document.getElementById('modal-overlay')?.addEventListener('click', e=>{
    if(e.target.id==='modal-overlay') closeModal();
  });
}

/* doReset — clears current slot (or guest session), navigates home */
window.doReset=function(){
  closeModal();
  if(isGuestMode){
    // Guest: just regenerate blank data in memory
    state=newState(); generateInitialData();
    selectMode=false; swapMode=false; selectedIds=new Set(); navStack=[];
    navigate('home',{},true);
    toast('✓ ゲストデータをリセットしました','ok');
  }else{
    resetSlot();
    selectMode=false; swapMode=false; selectedIds=new Set(); navStack=[];
    navigate('home',{},true);
    toast(`✓ スロット${currentSlot} リセット完了`,'ok');
  }
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

/* ──────────────────────────────────────────────────────────────────
   MOBILE BOTTOM NAV & SETTINGS SHEET  (v9.3 mobile redesign)
────────────────────────────────────────────────────────────────── */

/* updateBottomNav — highlight the active tab based on current page */
function updateBottomNav(){
  const cur = navStack[navStack.length - 1];
  const page = cur ? cur.page : 'home';
  const map = {
    'home':         'bn-home',
    'grade':        'bn-home',
    'class':        'bn-home',
    'profile':      'bn-home',
    'graduates':    'bn-home',
    'incoming':     'bn-home',
    'graduateYear': 'bn-home',
    'graduateClass':'bn-home',
    'incomingCohort':'bn-home',
    'incomingClass':'bn-home',
    'ranking':      'bn-ranking',
    'classRanking': 'bn-ranking',
    'history':      'bn-history',
  };
  document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('bn-active'));
  const activeId = map[page] || 'bn-home';
  document.getElementById(activeId)?.classList.add('bn-active');
}

/* toggleMobileSettings / closeMobileSettings */
function toggleMobileSettings(){
  const ov = document.getElementById('mobile-settings-overlay');
  if(!ov) return;
  const isOpen = ov.classList.contains('visible');
  if(isOpen){ closeMobileSettings(); }
  else {
    // sync date display
    const dd = document.getElementById('date-display');
    const mssDate = document.getElementById('mss-date-display');
    if(dd && mssDate) mssDate.textContent = dd.textContent;
    // sync theme buttons
    const curTheme = document.documentElement.getAttribute('data-theme') || 'classic';
    document.querySelectorAll('.mss-theme-btn').forEach(b => {
      b.classList.toggle('mss-theme-active', b.dataset.theme === curTheme);
    });
    // sync bgm toggle
    syncMssBgmBtn();
    // sync volume slider
    const vol = document.getElementById('bgm-volume');
    const mssVol = document.getElementById('mss-bgm-volume');
    const mssVal = document.getElementById('mss-vol-val');
    if(vol && mssVol){ mssVol.value = vol.value; }
    if(mssVal && vol){ mssVal.textContent = vol.value; }
    ov.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }
}
window.toggleMobileSettings = toggleMobileSettings;

function closeMobileSettings(){
  const ov = document.getElementById('mobile-settings-overlay');
  if(ov){ ov.classList.remove('visible'); }
  document.body.style.overflow = '';
}
window.closeMobileSettings = closeMobileSettings;

function syncMssBgmBtn(){
  const btn = document.getElementById('mss-bgm-btn');
  if(!btn) return;
  btn.classList.toggle('bgm-on', !!bgmEnabled);
  btn.textContent = bgmEnabled ? '♫ BGM ON' : '♫ BGM OFF';
}
window.syncMssBgmBtn = syncMssBgmBtn;

/* syncMssVolume — mirror mss slider → main bgm-volume slider */
function syncMssVolume(val){
  const mainVol = document.getElementById('bgm-volume');
  const mssVal  = document.getElementById('mss-vol-val');
  if(mainVol){ mainVol.value = val; mainVol.dispatchEvent(new Event('input')); }
  if(mssVal) mssVal.textContent = val;
}
window.syncMssVolume = syncMssVolume;

/* v7.6: boot — Guest Mode (slot 0) by default, but immediately
   calls generateInitialData() so the Home screen is populated
   with 1,200 blank students on first load. Slot 1–12 data is
   preserved in localStorage and accessible via the Save modal. */
function boot(){
  loadTheme();
  initBGM();
  currentSlot = 0;
  isGuestMode  = true;
  state = newState();
  generateInitialData();   /* populate 1,200 blank students for guest session */
  finishBoot();
}
function finishBoot(){
  bindEvents();
  updateSlotButtons();
  updateDateDisplay();
  /* v8.0: apply mobile-mode class on load and wire resize listener */
  updateMobileMode();
  window.addEventListener('resize', updateMobileMode, {passive:true});
  /* v8.7: initialise Firebase auth state listener */
  initFirebase();
  navigate('home',{},true);
}

/* v8.0: updateMobileMode — detects portrait orientation or narrow viewport
   (≤768px) and toggles 'mobile-mode' class on <body>. CSS uses this class
   to activate all mobile-specific layout rules (@media queries are also
   present as a complementary approach for viewport-width-only triggers).   */
function updateMobileMode(){
  const narrow = window.innerWidth <= 768;
  const portrait = window.matchMedia('(orientation: portrait)').matches;
  document.body.classList.toggle('mobile-mode', narrow || portrait);
}

if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded', boot);
else
  boot();
