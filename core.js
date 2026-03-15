import { SURNAMES_MAJOR, SURNAMES_RARE, MALE_NAMES, FEMALE_NAMES } from './names-data.js';

/* core.js — v9.5: Constants, state, utilities, data generation, class helpers */
/* ──────────────────────────────────────────────────────────────────
   CONSTANTS
────────────────────────────────────────────────────────────────── */
export const GRADES      = [1, 2, 3, 4, 5, 6];
export const CLASS_IDS   = [0, 1, 2, 3, 4];
export const RANK_LABELS = ['A', 'B', 'C', 'D', 'E'];
export const STATS_KEYS  = ['language', 'reasoning', 'memory', 'thinking', 'physical', 'mental'];
/* v7.6: RADAR_LABELS — display labels for drawProfileRadar, strip 力/能力 suffix.
   Order must match STATS_KEYS exactly.                                            */
export const RADAR_LABELS = ['言語', '推論', '記憶', '思考', '身体', '精神'];
export const MONTHS_JP   = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

/* ── v7.8: Special Trait catalogue — 30 traits in 6 categories ────
   cat key maps directly to CSS .tc-{cat} classes on tags and chips.
   Sensory has 5 items (not 6) per spec; all others have 6.         */
export const SPECIAL_TRAITS = [
  /* Brain */
  {id:'lang_acq',   label:'多言語習得', cat:'brain'},
  {id:'memorize',   label:'記憶術',     cat:'brain'},
  {id:'fast_calc',  label:'高速演算',   cat:'brain'},
  {id:'medicine',   label:'医学知識',   cat:'brain'},
  {id:'law',        label:'法律知識',   cat:'brain'},
  {id:'cipher',     label:'暗号解読',   cat:'brain'},
  /* Physical */
  {id:'track',      label:'陸上',       cat:'physical'},
  {id:'swim',       label:'水泳',       cat:'physical'},
  {id:'gymnastics', label:'体操',       cat:'physical'},
  {id:'ballgame',   label:'球技',       cat:'physical'},
  {id:'reflex',     label:'超反射神経', cat:'physical'},
  {id:'recovery',   label:'超回復力',   cat:'physical'},
  /* Artistic */
  {id:'art',        label:'美術',       cat:'artistic'},
  {id:'calligraphy',label:'書道',       cat:'artistic'},
  {id:'music',      label:'音楽演奏',   cat:'artistic'},
  {id:'singing',    label:'歌唱',       cat:'artistic'},
  {id:'writing',    label:'執筆',       cat:'artistic'},
  {id:'cooking',    label:'料理',       cat:'artistic'},
  /* Strategic */
  {id:'leadership', label:'リーダーシップ',  cat:'strategic'},
  {id:'strategy',   label:'戦略的思考',      cat:'strategic'},
  {id:'logic',      label:'論理的思考',      cat:'strategic'},
  {id:'negotiate',  label:'交渉術',          cat:'strategic'},
  {id:'persuade',   label:'説得術',          cat:'strategic'},
  {id:'situate',    label:'状況判断力',      cat:'strategic'},
  /* Skill */
  {id:'disguise',   label:'変装',       cat:'skill'},
  {id:'machine',    label:'機械操作',   cat:'skill'},
  {id:'hacking',    label:'ハッキング', cat:'skill'},
  {id:'tracking',   label:'追跡',       cat:'skill'},
  {id:'taming',     label:'動物調教',   cat:'skill'},
  {id:'survival',   label:'サバイバル', cat:'skill'},
  /* Sensory (5 items per spec) */
  {id:'sixthsense', label:'第六感',     cat:'sensory'},
  {id:'empathy',    label:'共感力',     cat:'sensory'},
  {id:'foresight',  label:'未来予知',   cat:'sensory'},
  {id:'luck',       label:'幸運補正',   cat:'sensory'},
  {id:'tenacity',   label:'不屈の精神', cat:'sensory'},
  {id:'trust',      label:'信頼',       cat:'sensory'},
];

/* Category display metadata — ordered for the accordion */
/* v8.0: TRAIT_CATEGORIES — labels fully localized to Japanese */
/* v8.1: 'custom' category added for user-created traits (always last) */
export const TRAIT_CATEGORIES = [
  {key:'brain',    label:'頭脳系'},
  {key:'physical', label:'身体能力系'},
  {key:'artistic', label:'芸術系'},
  {key:'strategic',label:'戦略系'},
  {key:'skill',    label:'特殊技能系'},
  {key:'sensory',  label:'特殊感覚系'},
  {key:'custom',   label:'その他 (カスタム)'},
];

/* v7.8: traitCategoryCollapsedState — persists open/closed status of
   each trait-category accordion panel in the profile edit view.
   Key = category key string (e.g. "brain"), value = true means collapsed.
   Written by toggleTraitCat; read by renderProfile to restore state.  */
export const traitCategoryCollapsedState = new Map();
/* v8.3: contractAccCollapsedState — persists open/closed state of the
   two contract accordion panels: 'issue' and 'confirm'.
   Default: issue open, confirm open. */
export const contractAccCollapsedState = new Map([['issue',false],['confirm',false]]);
export const HISTORY_MAX = 120;
export const NUM_SLOTS   = 12;
export const TOP_N       = 100;
export const APP_VER     = '9.5';
export const THEME_KEY   = 'CoteOS_theme';
export const SLOT_META_KEY = 'CoteOS_v7_SlotMeta';
export const BGM_KEY       = 'CoteOS_v7_BGM';

export const slotKey = n => `CoteOS_v7_Slot${n}`;

export const STAT_GRADE_TABLE = [
  null, 'D-', 'D', 'D+', 'C-', 'C', 'C+',
  'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S-', 'S', 'S+',
];

export const JP = {
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
  ranking:'ランキング', history:'月次履歴',
  gradeN: g => `${g}年生`,
  clsDef: (g, r) => `${g}年${r}組`,
};

export const CLASS_STAT_CFG = {
  0:{ avg:[6,8],  rare:[4,12], focus:['reasoning','memory','thinking'] },
  1:{ avg:[5,7],  rare:[4,10], focus:['language','memory'] },
  2:{ avg:[4,6],  rare:[2,10], focus:['physical','mental'] },
  3:{ avg:[5,5],  rare:[3,8],  focus:['physical','mental'] },
  4:{ avg:[1,6],  rare:[7,13], focus:[] },
};
/* ── v8.2: X-SUM BINOMIAL DISTRIBUTION CONFIG ────────────────────
   Updated per spec — tighter individual stat bounds:
     Class A: sMin:5, sMax:8  → X feasible [30,48], mean≈40
     Class B: sMin:5, sMax:7  → X feasible [30,42], mean≈37
     Class C: sMin:4, sMax:7  → X feasible [24,42], mean≈34
     Class D: sMin:4, sMax:6  → X feasible [24,36], mean≈31
     Class E: sMin:2, sMax:8  → X feasible [12,48], mean≈28
   xMin = sMin×6, xMax = sMax×6  (hard feasibility bounds)
   xMean tuned for balanced distribution within each class tier.  */
export const XSUM_CFG = {
  0: { xMin:30, xMax:48, xMean:40, sMin:5, sMax:8  }, /* Class A: 5–8  */
  1: { xMin:30, xMax:42, xMean:37, sMin:5, sMax:7  }, /* Class B: 5–7  */
  2: { xMin:24, xMax:42, xMean:34, sMin:4, sMax:7  }, /* Class C: 4–7  */
  3: { xMin:24, xMax:36, xMean:31, sMin:4, sMax:6  }, /* Class D: 4–6  */
  4: { xMin:12, xMax:48, xMean:28, sMin:2, sMax:8  }, /* Class E: 2–8  */
};

/* v8.1: binomialSample — approximate a binomial-shaped value in [lo, hi]
   centred near mean. Uses sum of 12 uniform [0,1] samples (CLT) scaled
   to the desired range, then clamps. n=12 gives excellent bell shape.  */
export function binomialSample(lo, hi, mean){
  /* Map the target mean as a proportion p within [lo,hi] */
  const range = hi - lo;
  if(range <= 0) return lo;
  const p = (mean - lo) / range;            /* 0..1 */
  /* Sum 12 uniform draws, normalise → mean=p, then scale to [lo,hi] */
  let s = 0;
  for(let i = 0; i < 12; i++) s += Math.random();
  s /= 12;                                  /* now ≈ 0.5 */
  /* Shift so mean matches p */
  s = s + (p - 0.5);
  s = Math.max(0, Math.min(1, s));          /* clamp to [0,1] */
  return Math.round(lo + s * range);
}

/* v8.1: genStatXSum(cid) — generate all 6 stats for one student.
   1. Draw X (total) from binomial distribution for class cid.
   2. Shuffle stat order randomly (no focus bias — stats are allocated
      randomly so the sum constraint is the dominant shaping force).
   3. Greedily allocate X across 6 stats:
      - Each stat gets at minimum sMin.
      - Remaining budget is distributed randomly within [0, sMax-sMin]
        per stat; final stat absorbs remainder, clamped to [sMin, sMax].
   Returns an object keyed by STATS_KEYS.                            */
export function genStatXSum(cid){
  const cfg = XSUM_CFG[cid] ?? XSUM_CFG[4];
  const X   = binomialSample(cfg.xMin, cfg.xMax, cfg.xMean);
  const n   = STATS_KEYS.length; /* 6 */
  const {sMin, sMax} = cfg;

  /* Start each stat at minimum */
  const vals = STATS_KEYS.map(() => sMin);
  let budget = X - sMin * n;   /* total remaining to distribute */

  /* Distribute budget in random order */
  const order = [...Array(n).keys()].sort(() => Math.random() - 0.5);
  for(let i = 0; i < n; i++){
    const idx   = order[i];
    const room  = sMax - sMin;
    const last  = (i === n - 1);
    let   give;
    if(last){
      give = budget;
    } else {
      /* Random share of remaining budget, leave at least 0 for others */
      const maxGive = Math.min(room, budget);
      give = maxGive <= 0 ? 0 : rndInt(0, maxGive);
    }
    vals[idx] = Math.max(sMin, Math.min(sMax, sMin + give));
    budget   -= give;
    if(budget <= 0) break;
  }

  return Object.fromEntries(STATS_KEYS.map((k, i) => [k, vals[i]]));
}

export const PP_RANGE = {
  0:[50000,100000], 1:[30000,80000], 2:[20000,60000],
  3:[10000,50000],  4:[0,50000],
};

export function rndInt(lo,hi){ return Math.floor(Math.random()*(hi-lo+1))+lo; }
export function rndPick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
/* v8.0 legacy genStat — kept for backwards compat / any manual use */
export function genStat(cid,key){
  const cfg=CLASS_STAT_CFG[cid], rare=Math.random()<0.20;
  const [lo,hi]=rare?cfg.rare:cfg.avg; let v=lo===hi?lo:rndInt(lo,hi);
  if(cfg.focus.includes(key)) v=Math.min(15,v+1); return v;
}

/* v7.9: base year shifted 2010 → 2000 (−10 years).
   Benchmark: grade=6, sysYear=1 → y=2000+(6-6)+(1-1)=2000;
   m≤3 bumps to 2001 → born Apr 2000 – Mar 2001 ✓           */
export function genDOB(grade,sysYear){
  let y=2000+(6-grade)+(sysYear-1); const m=rndInt(1,12),d=rndInt(1,28);
  if(m<=3) y+=1;
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
/* v8.1: genSurname — 2:1 weighted selection: Major (2/3 chance) vs Rare (1/3).
   This reflects realistic surname frequency distribution in Japanese society. */
export function genSurname(){
  return Math.random() < 0.667
    ? rndPick(SURNAMES_MAJOR)
    : rndPick(SURNAMES_RARE);
}
/* v7.8: half-width space " " inserted between surname and given name */
export function genStudentName(gender){
  return genSurname()+' '+rndPick(gender==='M'?MALE_NAMES:FEMALE_NAMES);
}

/* ──────────────────────────────────────────────────────────────────
   RUNTIME STATE
────────────────────────────────────────────────────────────────── */
export let currentSlot = 1;
export let state       = null;
export let navStack    = [];
export let selectMode  = false;
export let selectedIds = new Set();
export let bulkPPValue = '';
export let swapMode    = false;
export let swapDragId  = null;

export let slModalOpen     = false;
export let slSelectedSlot  = 1;
export let slNameDrafts    = {};

/* v7.3: Slot 0 — Guest Mode ─────────────────────────────────────
   currentSlot === 0  ⟹  session is volatile; data lives in state
   only. saveState() refuses to persist slot 0 unless the user
   explicitly picks a target slot 1-12 via the Save modal.       */
export let isGuestMode     = false;   // true when currentSlot === 0

export let bgmWidget   = null;
export let bgmReady    = false;
export let bgmEnabled  = false;

/* v7.10: checkedClasses — Set of "grade_classId" strings for multi-select
   batch operations. Persists across re-renders; renderHome re-applies
   .chk-selected styling and restores checkbox state from this Set.    */
export const checkedClasses = new Set();

/* v7.11: editMode — boolean tracking whether Edit Mode is active on the
   Home screen. When true, the PP/CP dist row and cls-sel-bars are visible.
   Persists across renderHome re-renders (preserved by navigate calls).    */
export let editMode = false;

export function newState(){
  return { year:1, month:4, students:[], classes:[], history:[], nextId:1, slotName:'' };
}

/* ──────────────────────────────────────────────────────────────────
   THEME ENGINE
────────────────────────────────────────────────────────────────── */
const THEMES = ['classic','light','dark'];

export function applyTheme(name){
  if(!THEMES.includes(name)) name='classic';
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem(THEME_KEY, name);
  document.querySelectorAll('.tf-opt').forEach(b=>{
    b.classList.toggle('active', b.dataset.theme===name);
  });
}
export function loadTheme(){
  applyTheme(localStorage.getItem(THEME_KEY)||'classic');
}

/* ──────────────────────────────────────────────────────────────────
   BGM (SoundCloud Widget)
────────────────────────────────────────────────────────────────── */
/* v7.4: syncVolFill — sets --vol-pct on #bgm-slider-wrap so the CSS
   green fill-bar height matches the current slider value.           */
export function syncVolFill(){
  const slider=document.getElementById('bgm-volume');
  const wrap  =document.getElementById('bgm-slider-wrap');
  if(!slider||!wrap) return;
  wrap.style.setProperty('--vol-pct', slider.value);
}

export function syncBgmButton(){
  const btn  = document.getElementById('btn-bgm');
  const hitbox = document.getElementById('bgm-hitbox');
  if(!btn) return;
  btn.classList.toggle('on', !!bgmEnabled);
  btn.setAttribute('aria-pressed', String(!!bgmEnabled));
  btn.title = bgmEnabled ? 'BGM ON' : 'BGM OFF';
  /* v7.5: slider panel uses .vol-open on #bgm-hitbox (bgm-column removed) */
  if(hitbox){
    hitbox.classList.toggle('vol-open', !!bgmEnabled);
    const wrap = document.getElementById('bgm-slider-wrap');
    if(wrap) wrap.setAttribute('aria-hidden', String(!bgmEnabled));
  }
  syncVolFill();
  /* v9.3: sync mobile settings sheet BGM button if open */
  if(typeof syncMssBgmBtn === 'function') syncMssBgmBtn();
}
export function setBgmEnabled(on, silent=false){
  bgmEnabled=!!on;
  localStorage.setItem(BGM_KEY, bgmEnabled?'1':'0');
  syncBgmButton();
  if(bgmReady && bgmWidget){
    if(bgmEnabled){
      bgmWidget.play();
      if(!silent) toast('♪ BGM ON','ok',1400);
    }else{
      bgmWidget.pause();
      if(!silent) toast('♪ BGM OFF','warn',1400);
    }
  }
}
export function toggleBGM(){
  setBgmEnabled(!bgmEnabled);
}
export function initBGM(){
  bgmEnabled = localStorage.getItem(BGM_KEY)==='1';
  syncBgmButton();

  const frame=document.getElementById('bgm-player');
  if(!frame || !window.SC || !window.SC.Widget) return;
  try{
    bgmWidget = window.SC.Widget(frame);
    bgmWidget.bind(window.SC.Widget.Events.READY, ()=>{
      bgmReady=true;
      if(bgmEnabled) bgmWidget.play();
    });
    bgmWidget.bind(window.SC.Widget.Events.FINISH, ()=>{
      if(!bgmEnabled) return;
      bgmWidget.seekTo(0);
      bgmWidget.play();
    });
  }catch(e){
    console.warn('BGM init failed', e);
  }
}

/* ──────────────────────────────────────────────────────────────────
   STUDENT ID
────────────────────────────────────────────────────────────────── */
export function gradePrefix(grade){
  /* v7.4: supports numeric incoming cohort grades (e.g. 7, 8, 12, 13…)
     The prefix encodes: base-year offset from year 7 + grade offset.
     Standard grades 1-6 retain original prefix logic.
     Incoming cohort grades (>6) use grade number directly as base.  */
  if(typeof grade!=='number'||grade<1) return '000';
  if(grade<=6){
    return String(7+(6-grade)+(state.year-1)).padStart(3,'0');
  }
  // Incoming cohort: prefix = grade number (e.g. grade 13 → '013')
  return String(grade).padStart(3,'0');
}
export function genStudentId(grade){
  const pfx=gradePrefix(grade);
  const used=new Set(
    state.students
      .filter(s=>typeof s.grade==='number'&&s.grade===grade&&s.id&&s.id.startsWith(pfx))
      .map(s=>parseInt(s.id.slice(-4),10))
      .filter(n=>!isNaN(n))
  );
  let seq=1;
  while(used.has(seq)) seq++;
  if(seq>9999){seq=state.nextId++;}
  return pfx+String(seq).padStart(4,'0');
}

/* ──────────────────────────────────────────────────────────────────
   UTILITIES
────────────────────────────────────────────────────────────────── */
export function esc(s){
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
export function escA(s){ return String(s??'').replace(/"/g,'&quot;'); }

export function toast(msg,cls='',ms=2800){
  const el=document.getElementById('toast'); if(!el) return;
  el.textContent=msg; el.className=cls?`on ${cls}`:'on';
  clearTimeout(toast._t); toast._t=setTimeout(()=>{ el.className=''; },ms);
}
/* v7.7: date format changed from "Year X · 4月" to "Year X, Month Y" */
export function fmtDate(y,m){ return `Year ${y}, Month ${m}`; }

export function fmtPP(v){
  const a=Math.abs(v);
  if(a>=1e12) return (v/1e12).toFixed(1)+'T';
  if(a>=1e9)  return (v/1e9).toFixed(1)+'B';
  if(a>=1e6)  return (v/1e6).toFixed(1)+'M';
  if(a>=1e3)  return (v/1e3).toFixed(1)+'K';
  return String(v);
}
export function ppCol(v){ return v>0?'pos':v<0?'neg':'neu'; }
export function clampStat(v){
  const n=parseInt(v,10);
  return (!isNaN(n)&&n>=1&&n<=15)?n:1;
}

export function statGradeLabel(value){
  return STAT_GRADE_TABLE[clampStat(value)] || 'D-';
}
export function statGradeClass(value){
  const n=clampStat(value);
  const map=['sg-dm','sg-d','sg-dp','sg-cm','sg-c','sg-cp','sg-bm','sg-b','sg-bp','sg-am','sg-a','sg-ap','sg-s','sg-s','sg-sp'];
  return map[n-1] || 'sg-dm';
}

export function getSchoolRankingPool(src=state?.students||[]){
  return src.filter(s=>typeof s.privatePoints==='number' && !s.isExpelled);
}
export function getPPRankPercentile(student,pool=getSchoolRankingPool()){
  if(!student || !pool.length) return 100;
  const higher = pool.filter(s=>s.privatePoints > student.privatePoints).length;
  const same   = pool.filter(s=>s.privatePoints === student.privatePoints).length;
  const rank   = higher + (same>0 ? 1 : 0);
  return (rank / pool.length) * 100;
}
export function getPPRankBonus(student,pool=getSchoolRankingPool()){
  const p=getPPRankPercentile(student,pool);
  if(p<=1) return 5;
  if(p<=20) return 4;
  if(p<=40) return 3;
  if(p<=60) return 2;
  if(p<=80) return 1;
  return 0;
}
export function calcOverallScoreDetail(student,pool=getSchoolRankingPool()){
  if(!student){
    return { base:0, protectBonus:0, ppBonus:0, percentile:100, total:0 };
  }
  const base=STATS_KEYS.reduce((sum,k)=>sum+clampStat(student.stats?.[k]),0); // max 90
  const protectBonus = student.protectPoints>0 ? 5 : 0; // once only
  const ppBonus      = getPPRankBonus(student,pool);    // max 5
  const percentile   = getPPRankPercentile(student,pool);
  const total        = Math.min(100, base + protectBonus + ppBonus);
  return { base, protectBonus, ppBonus, percentile, total };
}
export function calcOverallScore(student,pool=getSchoolRankingPool()){
  return calcOverallScoreDetail(student,pool).total;
}

/* ──────────────────────────────────────────────────────────────────
   CLASS HELPERS
────────────────────────────────────────────────────────────────── */
export function getCls(grade,classId){ return state.classes.find(c=>c.grade===grade&&c.classId===classId); }
export function getStudentsOf(grade,classId){ return state.students.filter(s=>s.grade===grade&&s.classId===classId); }
export function getRanked(grade){
  return [...state.classes.filter(c=>c.grade===grade)]
    .sort((a,b)=>b.classPoints!==a.classPoints?b.classPoints-a.classPoints:a.classId-b.classId);
}
export function rankOf(grade,classId){
  const i=getRanked(grade).findIndex(c=>c.classId===classId);
  return i>=0?RANK_LABELS[i]:'?';
}
export function clsName(grade,classId){
  const c=getCls(grade,classId);
  if(!c) return JP.clsDef(grade,rankOf(grade,classId));
  return c.customName||c.name||JP.clsDef(grade,rankOf(grade,classId));
}

/* ──────────────────────────────────────────────────────────────────
   BLANK DATA GENERATORS
────────────────────────────────────────────────────────────────── */
export function blankStudent(grade,classId){
  const stats=Object.fromEntries(STATS_KEYS.map(k=>[k,1]));
  /* v7.8: traits[] — array of trait id strings from SPECIAL_TRAITS */
  /* v8.1: customTraits[] — array of {id, label, cat:'custom'} objects */
  return { id:genStudentId(grade), name:'', gender:'M', dob:'', grade, classId, stats,
           specialAbility:'', privatePoints:0, protectPoints:0, contracts:[],
           isExpelled:false, traits:[], customTraits:[] };
}
export function blankClass(grade,classId,rankLabel){
  const name=rankLabel?JP.clsDef(grade,rankLabel):'';
  return { grade,classId,classPoints:0,customName:'',name };
}

export function generateInitialData(){
  const sName = currentSlot > 0 ? slotNameOf(currentSlot) : 'ゲストデータ';
  Object.assign(state,{students:[],classes:[],nextId:1,year:1,month:4,history:[],slotName:sName});
  GRADES.forEach(g=>CLASS_IDS.forEach(c=>{
    state.classes.push(blankClass(g,c,RANK_LABELS[c]));
  }));
  GRADES.forEach(g=>{
    state.nextId=1;
    CLASS_IDS.forEach(c=>{
      for(let i=0;i<40;i++) state.students.push(blankStudent(g,c));
    });
  });
  state.nextId=10000;
}

/* ──────────────────────────────────────────────────────────────────
   INCOMING COHORT SYSTEM — v7.4
   ─────────────────────────────────────────────────────────────────
   "Incoming" students are numeric-grade cohorts (grade > 6) that
   live alongside the active grades. On next April (doGradeUp), all
   Incoming students (grade === 'Incoming') become Grade 1; the
   numeric cohort grade is only used for display/organisation here.

   Design decision: we keep storing s.grade = 'Incoming' (the
   existing string used by doGradeUp), but add s.cohortGrade (a
   number like 13) so we can group and label them. The ID prefix
   uses the cohortGrade number (e.g. 013NNNN).
   ─────────────────────────────────────────────────────────────────
   currentIncomingBaseGrade():
     Returns the numeric grade that represents "Year 1 students"
     entering this cycle. Looks at IDs of grade-1 students:
     the first 3 chars of their ID is the year-1 prefix → base.
     If no grade-1 students exist, falls back to 7 + (state.year-1).

   nextIncomingCohortGrade():
     The cohort grade for the NEXT incoming class = base grade + 1.

   getIncomingCohorts():
     Returns a sorted array of unique cohortGrade numbers found
     among Incoming students.

   createIncomingCohort():
     Generates 200 blank Incoming students across 5 classes with
     proper IDs and pushes them; saves state.

   deleteIncomingCohort(cohortGrade):
     Removes all Incoming students with that cohortGrade.
────────────────────────────────────────────────────────────────── */
export function currentIncomingBaseGrade(){
  // Find grade-1 students and read their ID prefix
  const g1 = state.students.find(s=>s.grade===1&&s.id&&s.id.length>=3);
  if(g1){
    const pfxNum = parseInt(g1.id.slice(0,3),10);
    if(!isNaN(pfxNum)) return pfxNum;
  }
  // Fallback: standard formula
  return 7+(6-1)+(state.year-1); // = year+11
}

export function nextIncomingCohortGrade(){
  const existing = getIncomingCohorts();
  if(existing.length){
    return Math.max(...existing)+1;
  }
  return currentIncomingBaseGrade()+1;
}

export function getIncomingCohorts(){
  const set=new Set();
  state.students.forEach(s=>{
    if(s.grade==='Incoming' && typeof s.cohortGrade==='number') set.add(s.cohortGrade);
  });
  return [...set].sort((a,b)=>a-b);
}

window.createIncomingCohort=function(){
  const cg = nextIncomingCohortGrade();
  // Temporarily set grade to cg so genStudentId uses prefix 0cg
  // We store grade='Incoming' and cohortGrade=cg
  let seq=1;
  CLASS_IDS.forEach(cid=>{
    for(let i=0;i<40;i++){
      const pfx=String(cg).padStart(3,'0');
      const id=pfx+String(seq).padStart(4,'0');
      seq++;
      const stats=Object.fromEntries(STATS_KEYS.map(k=>[k,1]));
      state.students.push({
        id, name:'', gender:'M', dob:'', grade:'Incoming', cohortGrade:cg,
        classId:cid, stats, specialAbility:'',
        privatePoints:0, protectPoints:0, contracts:[], isExpelled:false,
      });
    }
  });
  window.saveState(true);
  window.navigateReplace('incoming',{});
  toast(`✓ 入学予定コホート 第${cg}期 (200名) を作成しました`,'ok',3000);
};

window.deleteIncomingCohort=function(cg){
  window.uiConfirm({
    title:`第${cg}期コホートを削除`,
    body:`入学予定 第${cg}期 の全生徒を削除します。<br><strong>この操作は取り消せません。</strong>`,
    variant:'danger',
    okLabel:'削除する',
    onOk:()=>{
      state.students=state.students.filter(s=>!(s.grade==='Incoming'&&s.cohortGrade===cg));
      // Remove their contract references too
      state.students.forEach(s=>{
        const validIds=new Set(state.students.map(x=>x.id));
        s.contracts=s.contracts.filter(c=>validIds.has(c.targetId));
      });
      saveState(true);
      window.navigateReplace('incoming',{});
      toast(`✓ 第${cg}期コホートを削除しました`,'warn',3000);
    },
  });
};

/* v8.0: randomizeIncomingCohort — fills all 200 slots of the given cohort
   with randomised name, gender, DOB, PP (by class config), and stats.
   v8.0 BALANCE FIX: stat generation now uses genStat(cid, key) — same
   as active students — replacing the inflated raw 40–90 formula that
   produced min≈7, max≈14 stats regardless of class. Incoming students
   are now balanced equivalently to a newly-promoted Grade-1 class.    */
window.randomizeIncomingCohort=function(cg){
  const cohortStudents = state.students.filter(s=>s.grade==='Incoming'&&s.cohortGrade===cg);
  if(!cohortStudents.length){
    toast(`✗ 第${cg}期に生徒がいません`,'err'); return;
  }
  /* Group by classId so we can apply PP_RANGE and CLASS_STAT_CFG per-class */
  const byClass = {};
  CLASS_IDS.forEach(cid=>{ byClass[cid]=[]; });
  cohortStudents.forEach(s=>{ if(byClass[s.classId]!==undefined) byClass[s.classId].push(s); });

  CLASS_IDS.forEach(cid=>{
    const grp = byClass[cid];
    if(!grp.length) return;
    const n    = grp.length;
    const half = Math.floor(n / 2);
    /* Balanced gender array — roughly 50/50, then shuffle */
    const gend = Array(half).fill('M').concat(Array(n-half).fill('F'));
    for(let i=gend.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [gend[i],gend[j]]=[gend[j],gend[i]];
    }
    /* PP range: use CLASS_STAT_CFG-equivalent for incoming (treat as class 0–4) */
    const [ppLo, ppHi] = PP_RANGE[cid] ?? [0, 50000];

    grp.forEach((s, idx)=>{
      const gender = gend[idx] || 'M';
      s.name   = genStudentName(gender);
      s.gender = gender;
      /* Incoming students: DOB based on cohortGrade offset from current base.
         offset=0 → 来年入学, offset=1 → 再来年入学, etc.
         作り置きコホートでも正しい年度の誕生日が生成される。 */
      const _cgOffset = cg - currentIncomingBaseGrade() - 1;
      s.dob    = genDOB(1, state.year + 1 + _cgOffset);
      s.privatePoints = rndInt(ppLo, ppHi);
      /* v8.1: stats now use genStatXSum(cid) — binomial X-Sum algorithm */
      const xStats = genStatXSum(cid);
      STATS_KEYS.forEach(k=>{ s.stats[k] = xStats[k]; });
      s.specialAbility = '';
    });
  });

  window.saveState(true);
  window.navigateReplace('incoming', {});
  toast(`✓ 第${cg}期 ランダム生成完了 (${cohortStudents.length}名)`, 'ok', 3000);
};
export function randomizeGrade(grade){
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
      /* v8.1: use genStatXSum for binomial X-Sum distribution */
      const xStats=genStatXSum(cid);
      STATS_KEYS.forEach(k=>{s.stats[k]=xStats[k];}); s.specialAbility='';
    });
  });
}

/* ──────────────────────────────────────────────────────────────────
   PP RANKING
────────────────────────────────────────────────────────────────── */
export function computeRanking(){
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
   CLASS PP RANKING
────────────────────────────────────────────────────────────────── */
export function computeClassRanking(){
  return [...state.classes]
    .sort((a,b)=>b.classPoints!==a.classPoints?b.classPoints-a.classPoints:
      (a.grade!==b.grade?a.grade-b.grade:a.classId-b.classId));
}

/* ── v9.6: ES Module setters — for cross-module state writes ──────── */
export function setState(s)           { state = s; }
export function setCurrentSlot(n)     { currentSlot = n; }
export function setIsGuestMode(b)     { isGuestMode = b; }
export function setNavStack(arr)      { navStack = arr; }
export function setSelectMode(b)      { selectMode = b; }
export function setSwapMode(b)        { swapMode = b; }
export function setSwapDragId(id)     { swapDragId = id; }
export function setSelectedIds(s)     { selectedIds = s; }
export function setBulkPPValue(v)     { bulkPPValue = v; }
export function setEditMode(b)        { editMode = b; }
export function setSlModalOpen(b)     { slModalOpen = b; }
export function setSlSelectedSlot(n)  { slSelectedSlot = n; }
export function setSlNameDrafts(o)    { slNameDrafts = o; }

/* ── v9.6: window bindings for DOM-callable core functions ─────────── */
window.toast        = toast;
window.applyTheme   = applyTheme;
window.toggleBGM    = toggleBGM;
window.setBulkPPValue = setBulkPPValue;
