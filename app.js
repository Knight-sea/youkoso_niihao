/* ══════════════════════════════════════════════════════════════════
   app.js — Cote-OS v9.7
   ──────────────────────────────────────────────────────────────────
   アプリのエントリーポイント。ナビゲーション、月次進行、
   イベントバインド、起動処理を担当する。

   【モジュール読み込み順序】
   1. names-data.js  — 名前配列データ
   2. core.js         — 定数・状態・ユーティリティ
   3. save-load.js    — セーブ/ロード + Firebase
   4. render.js       — 全画面の描画
   5. app.js          — ★このファイル（ナビゲーション・イベント・起動）
══════════════════════════════════════════════════════════════════ */

import {
  GRADES, CLASS_IDS, RANK_LABELS, MONTHS_JP, JP, APP_VER, HISTORY_MAX,
  THEME_KEY, BGM_KEY, BGM_KEY as _BGM_KEY,
  state, setState, currentSlot, setCurrentSlot,
  isGuestMode, setIsGuestMode,
  navStack, setNavStack,
  selectMode, setSelectMode, swapMode, setSwapMode,
  selectedIds, setSelectedIds,
  bgmEnabled, bgmWidget, bgmReady,
  slModalOpen,
  newState, generateInitialData, blankStudent,
  genStudentId, fmtDate, toast,
  applyTheme, loadTheme,
  toggleBGM, initBGM, syncBgmButton, setBgmEnabled,
  clsName, RANK_LABELS as _RL,
  getIncomingCohorts,
} from './core.js';
import {
  saveState, loadSlot, updateSlotButtons,
  openSaveLoadModal, closeSaveLoadModal,
  bindSaveLoadModalControls, triggerImportDialog, exportAllSlots,
  initFirebase, bindFirebaseControls, onFilePicked,
} from './save-load.js';
import { renderApp, renderPage, updateDateDisplay, uiConfirm } from './render.js';


/* ══════════════════════════════════════════════════════════════════
   月次進行（タイムリープ）
   ──────────────────────────────────────────────────────────────────
   advanceMonth() … 次月へ進む（3月なら進級処理も実行）
   revertMonth()  … 履歴から前月に戻す
══════════════════════════════════════════════════════════════════ */
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
  /* 学年変更前に卒業年を記録 */
  state.students.forEach(s=>{
    if(s.grade===6){
      s.grade='Graduate';
      s.graduateYear=state.year; /* 卒業年を記録（コホートグループ用） */
    }
  });
  for(let g=5;g>=1;g--) state.students.forEach(s=>{if(s.grade===g)s.grade=g+1;});

  /* 入学予定 → 1年生に昇格（新しい1年生用IDを割り当て） */
  /* 昇格後は cohortGrade を削除（不要になるため） */
  const hadIncoming = state.students.some(s=>s.grade==='Incoming');
  state.students.forEach(s=>{
    if(s.grade==='Incoming'){
      s.grade=1;
      delete s.cohortGrade;
      /* 新しい1年生プレフィックスでIDを再生成 */
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

  /* 自動補充: 入学予定者がいない場合、200名の空枠を1年生に作成。
     ランダム生成は行わず、手動/ランダム入力用の空枠のみ。 */
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

/* ══════════════════════════════════════════════════════════════════
   ギアメニュー（設定トレイ）
══════════════════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════════════════
   ナビゲーション
   ──────────────────────────────────────────────────────────────────
   navStack（ナビスタック）でページ遷移履歴を管理。
   navigate()       … 新しいページをスタックに追加
   navigateReplace() … スタック最上位を置き換え
   goBack()         … スタックを1つ戻る
══════════════════════════════════════════════════════════════════ */
/* ナビゲーション関数: 連続した同一ページへの遷移を防止
   スタックの先頭が同じページ+パラメータなら push ではなく replace する */
function navigate(page,params={},reset=false){
  if(reset) setNavStack([]);
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
  navStack.pop(); setSelectMode(false); setSwapMode(false); setSelectedIds(new Set());
  const t=navStack[navStack.length-1]; renderPage(t.page,t.params); updateBreadcrumb();
}
window.navTo=function(i){
  setNavStack(navStack.slice(0,i+1)); setSelectMode(false); setSwapMode(false); setSelectedIds(new Set());
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

/* ══════════════════════════════════════════════════════════════════
   イベントバインド
   ──────────────────────────────────────────────────────────────────
   DOM要素にイベントリスナーを登録する。起動時に1回だけ実行。
══════════════════════════════════════════════════════════════════ */
function bindEvents(){
  /* 月ナビゲーション */
  document.getElementById('btn-prev')?.addEventListener('click', revertMonth);
  document.getElementById('btn-next')?.addEventListener('click', advanceMonth);
  document.addEventListener('keydown', e=>{
    if(!e.ctrlKey) return;
    if(e.key==='ArrowLeft'){e.preventDefault();revertMonth();}
    if(e.key==='ArrowRight'){e.preventDefault();advanceMonth();}
    if(e.key==='s'){e.preventDefault();saveState();}
  });

  /* ギアメニュー開閉: ギアボタンのみで操作（外側クリックでは閉じない） */
  document.getElementById('gear-btn')?.addEventListener('click', e=>{
    e.stopPropagation(); toggleGear();
  });

  /* トレイ内のクリックは外に伝播させない */
  document.getElementById('gear-tray')?.addEventListener('click', e=>{
    e.stopPropagation();
  });

  /* 履歴ボタン */
  document.getElementById('btn-history')?.addEventListener('click', e=>{
    e.stopPropagation(); navigateSafe('history',{});
  });

  /* テーマフライアウト */
  document.getElementById('btn-theme')?.addEventListener('click', e=>{
    e.stopPropagation(); toggleThemeFly(e);
  });
  document.querySelectorAll('.tf-opt').forEach(b=>{
    b.addEventListener('click', e=>{
      e.stopPropagation(); applyTheme(b.dataset.theme); closeThemeFly();
      toast(`テーマ: ${b.dataset.theme}`);
    });
  });

  /* セーブ/ロードモーダル + BGM */
  document.getElementById('btn-save')?.addEventListener('click', e=>{
    e.stopPropagation();
    openSaveLoadModal();
  });
  document.getElementById('btn-bgm')?.addEventListener('click', e=>{
    e.stopPropagation();
    toggleBGM();
  });

  /* 音量スライダー: SoundCloudウィジェットと緑バーに同期 */
  document.getElementById('bgm-volume')?.addEventListener('input', function(){
    const vol = parseInt(this.value, 10) / 100;
    if(bgmReady && bgmWidget){
      bgmWidget.setVolume(vol * 100);
    }
    syncVolFill();
  });

  /* BGMヒットボックスのマウスイベント: 音量スライダーの開閉制御 */
  document.getElementById('bgm-hitbox')?.addEventListener('mouseleave', ()=>{
    const hitbox = document.getElementById('bgm-hitbox');
    if(hitbox && bgmEnabled) hitbox.classList.remove('vol-open');
  });
  document.getElementById('bgm-hitbox')?.addEventListener('mouseenter', ()=>{
    const hitbox = document.getElementById('bgm-hitbox');
    if(hitbox && bgmEnabled) hitbox.classList.add('vol-open');
  });

  /* カスタム確認ダイアログ: 背景クリックまたはEscでキャンセル */
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

  /* Firebaseログイン/ログアウトボタンのハンドラ */
  bindFirebaseControls();

  /* 関連サイトボタン */
  document.getElementById('btn-related')?.addEventListener('click', e=>{
    e.stopPropagation(); openRelatedSitesModal();
  });

  /* モーダル閉じるボタン */
  document.getElementById('modal-x')?.addEventListener('click', ()=>window.closeModal());
  document.getElementById('modal-overlay')?.addEventListener('click', e=>{
    if(e.target.id==='modal-overlay') window.closeModal();
  });

  /* ── イベント委譲システム ──────────────────────────────────────
     #app 要素上の単一のclickリスナーで data-action 属性を読み取り、
     ACTION_MAP に登録されたハンドラを実行する仕組み。
     これにより window への関数登録（グローバル汚染）を削減できる。
     新しいハンドラは下の ACTION_MAP に追加するだけでOK。 */
  document.getElementById('app')?.addEventListener('click', e=>{
    const actionEl=e.target.closest('[data-action]');
    if(!actionEl) return;
    const action=actionEl.dataset.action;
    const handler=ACTION_MAP[action];
    if(handler) handler(actionEl, e);
  });
}

/* ── イベント委譲用アクションマップ ── */
const ACTION_MAP = {
  'nav':         (el)=>{ navigate(el.dataset.page, JSON.parse(el.dataset.params||'{}'), el.dataset.reset==='true'); },
  'nav-safe':    (el)=>{ navigateSafe(el.dataset.page, JSON.parse(el.dataset.params||'{}')); },
  'go-back':     ()=>{ goBack(); },
  'save-state':  ()=>{ saveState(); },
  'open-sl':     ()=>{ openSaveLoadModal(); },
  'toggle-edit': ()=>{ window.toggleEditMode(); },
  'filter-students': ()=>{ window.filterStudents(); },
};

/* データリセット: 現在のスロット（またはゲストセッション）を初期化してホームへ */
window.doReset=function(){
  closeModal();
  if(isGuestMode){
    /* ゲストモード: メモリ上のデータを再生成 */
    setState(newState()); generateInitialData();
    setSelectMode(false); setSwapMode(false); setSelectedIds(new Set()); setNavStack([]);
    navigate('home',{},true);
    toast('✓ ゲストデータをリセットしました','ok');
  }else{
    resetSlot();
    setSelectMode(false); setSwapMode(false); setSelectedIds(new Set()); setNavStack([]);
    navigate('home',{},true);
    toast(`✓ スロット${currentSlot} リセット完了`,'ok');
  }
};

/* グローバル参照: HTML内のonclickから呼び出せるようwindowに公開 */
window.navigate            = navigate;
window.navigateBack        = goBack;
window.goBack              = goBack;
window.navigateReplace     = navigateReplace;
window.navigateSafe        = navigateSafe;
window.updateBreadcrumb    = updateBreadcrumb;
window.revertMonth         = revertMonth;
window.advanceMonth        = advanceMonth;
window.exportAllSlots      = exportAllSlots;
window.triggerImportDialog = triggerImportDialog;
window.saveState           = saveState;

/* ══════════════════════════════════════════════════════════════════
   起動処理
   ──────────────────────────────────────────────────────────────────
   boot() → finishBoot() の順で初期化を行う。
   ゲストモード（スロット0）でデフォルト起動し、1,200名の
   空データを生成してホーム画面を表示する。
══════════════════════════════════════════════════════════════════ */
function showLoader(msg){
  const el=document.createElement('div'); el.id='loading';
  el.innerHTML=`<div class="ld-logo">COTE-OS</div><div class="ld-txt">${msg}</div><div class="ld-sub">しばらくお待ちください...</div>`;
  document.body.appendChild(el); return el;
}

/* ══════════════════════════════════════════════════════════════════
   モバイル: ボトムナビゲーション & 設定シート
══════════════════════════════════════════════════════════════════ */

/* 現在のページに応じてボトムナビのアクティブタブをハイライト */
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

/* モバイル設定シートの開閉 */
function toggleMobileSettings(){
  const ov = document.getElementById('mobile-settings-overlay');
  if(!ov) return;
  const isOpen = ov.classList.contains('visible');
  if(isOpen){ closeMobileSettings(); }
  else {
    /* 日付表示を同期 */
    const dd = document.getElementById('date-display');
    const mssDate = document.getElementById('mss-date-display');
    if(dd && mssDate) mssDate.textContent = dd.textContent;
    /* テーマボタンを同期 */
    const curTheme = document.documentElement.getAttribute('data-theme') || 'classic';
    document.querySelectorAll('.mss-theme-btn').forEach(b => {
      b.classList.toggle('mss-theme-active', b.dataset.theme === curTheme);
    });
    /* BGMトグルを同期 */
    syncMssBgmBtn();
    /* 音量スライダーを同期 */
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

/* モバイル音量スライダーの値をメインスライダーに同期 */
function syncMssVolume(val){
  const mainVol = document.getElementById('bgm-volume');
  const mssVal  = document.getElementById('mss-vol-val');
  if(mainVol){ mainVol.value = val; mainVol.dispatchEvent(new Event('input')); }
  if(mssVal) mssVal.textContent = val;
}
window.syncMssVolume = syncMssVolume;


/* ══════════════════════════════════════════════════════════════════
   関連サイトモーダル
══════════════════════════════════════════════════════════════════ */
function openRelatedSitesModal(){
  document.getElementById('rel-overlay')?.classList.remove('hidden');
  closeGear();
}
function closeRelatedSitesModal(){
  document.getElementById('rel-overlay')?.classList.add('hidden');
}
window.openRelatedSitesModal  = openRelatedSitesModal;
window.closeRelatedSitesModal = closeRelatedSitesModal;

/* 起動関数: ゲストモード（スロット0）でデフォルト起動。
   generateInitialData() で1,200名の空データを即座に生成し、
   ホーム画面がすぐ表示されるようにする。
   スロット1〜12のデータはlocalStorageに保存され、セーブモーダルからアクセス可能。 */
function boot(){
  loadTheme();
  initBGM();
  setCurrentSlot(0);
  setIsGuestMode(true);
  setState(newState());
  generateInitialData();   /* ゲストセッション用に1,200名の空データを生成 */
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

/* モバイルモード判定: 縦向きまたは幅768px以下で body に mobile-mode クラスを付与。
   CSSはこのクラスを使ってモバイル専用レイアウトを適用する。 */
function updateMobileMode(){
  const narrow = window.innerWidth <= 768;
  const portrait = window.matchMedia('(orientation: portrait)').matches;
  document.body.classList.toggle('mobile-mode', narrow || portrait);
}

if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded', boot);
else
  boot();
