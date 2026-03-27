import { SURNAMES_MAJOR, SURNAMES_RARE, MALE_NAMES, FEMALE_NAMES } from './names-data.js';

/* ══════════════════════════════════════════════════════════════════
   core.js — Cote-OS v9.7
   ──────────────────────────────────────────────────────────────────
   アプリ全体で共有する定数、状態（state）、ユーティリティ関数、
   データ生成ロジック、クラスヘルパーを定義するファイルです。

   【モジュール読み込み順序】
   1. names-data.js  — 名前配列データ
   2. core.js         — ★このファイル（定数・状態・ユーティリティ）
   3. save-load.js    — セーブ/ロード + Firebase連携
   4. render.js       — 全画面の描画
   5. app.js          — ナビゲーション・イベント・起動処理

   【バージョン履歴】
   v7.0  12スロットセーブ/ロードシステム
   v7.4  入学予定コホートシステム
   v7.8  特殊特性30種 + カスタム特性
   v8.1  X-Sum二項分布ステータス生成
   v8.3  プライベートコントラクト
   v8.7  Firebase/Protobuf統合
   v9.2  gzip圧縮セーブ（GZ92フォーマット）
   v9.6  ESモジュール化 + 状態管理改善
   v9.7  日本語コメント整備 + コード整理
══════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════
   定数定義
   ──────────────────────────────────────────────────────────────────
   アプリ全体で使う固定値。学年、クラス、ステータスなどの基本設定。
══════════════════════════════════════════════════════════════════ */
export const GRADES      = [1, 2, 3, 4, 5, 6];
export const CLASS_IDS   = [0, 1, 2, 3, 4];
export const RANK_LABELS = ['A', 'B', 'C', 'D', 'E'];
export const STATS_KEYS  = ['language', 'reasoning', 'memory', 'thinking', 'physical', 'mental'];
/* レーダーチャート用の表示ラベル（「力」「能力」の接尾辞なし版）
   ※ STATS_KEYS と同じ順番で並べること */
export const RADAR_LABELS = ['言語', '推論', '記憶', '思考', '身体', '精神'];
export const MONTHS_JP   = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

/* ── 特殊特性カタログ: 6カテゴリ × 5〜6個 = 31種 ──────────────
   cat（カテゴリキー）は CSS の .tc-{cat} クラスに対応。
   sensory（特殊感覚系）のみ6個、他は5個。 */
export const SPECIAL_TRAITS = [
  /* 頭脳系 */
  {id:'lang_acq',   label:'多言語習得', cat:'brain'},
  {id:'memorize',   label:'記憶術',     cat:'brain'},
  {id:'fast_calc',  label:'高速演算',   cat:'brain'},
  {id:'medicine',   label:'医学知識',   cat:'brain'},
  {id:'law',        label:'法律知識',   cat:'brain'},
  {id:'cipher',     label:'暗号解読',   cat:'brain'},
  /* 身体能力系 */
  {id:'track',      label:'陸上',       cat:'physical'},
  {id:'swim',       label:'水泳',       cat:'physical'},
  {id:'gymnastics', label:'体操',       cat:'physical'},
  {id:'ballgame',   label:'球技',       cat:'physical'},
  {id:'reflex',     label:'超反射神経', cat:'physical'},
  {id:'recovery',   label:'超回復力',   cat:'physical'},
  /* 芸術系 */
  {id:'art',        label:'美術',       cat:'artistic'},
  {id:'calligraphy',label:'書道',       cat:'artistic'},
  {id:'music',      label:'音楽演奏',   cat:'artistic'},
  {id:'singing',    label:'歌唱',       cat:'artistic'},
  {id:'writing',    label:'執筆',       cat:'artistic'},
  {id:'cooking',    label:'料理',       cat:'artistic'},
  /* 戦略系 */
  {id:'leadership', label:'リーダーシップ',  cat:'strategic'},
  {id:'strategy',   label:'戦略的思考',      cat:'strategic'},
  {id:'logic',      label:'論理的思考',      cat:'strategic'},
  {id:'negotiate',  label:'交渉術',          cat:'strategic'},
  {id:'persuade',   label:'説得術',          cat:'strategic'},
  {id:'situate',    label:'状況判断力',      cat:'strategic'},
  /* 特殊技能系 */
  {id:'disguise',   label:'変装',       cat:'skill'},
  {id:'machine',    label:'機械操作',   cat:'skill'},
  {id:'hacking',    label:'ハッキング', cat:'skill'},
  {id:'tracking',   label:'追跡',       cat:'skill'},
  {id:'taming',     label:'動物調教',   cat:'skill'},
  {id:'survival',   label:'サバイバル', cat:'skill'},
  /* 特殊感覚系（仕様上6個） */
  {id:'sixthsense', label:'第六感',     cat:'sensory'},
  {id:'empathy',    label:'共感力',     cat:'sensory'},
  {id:'foresight',  label:'未来予知',   cat:'sensory'},
  {id:'luck',       label:'幸運補正',   cat:'sensory'},
  {id:'tenacity',   label:'不屈の精神', cat:'sensory'},
  {id:'trust',      label:'信頼',       cat:'sensory'},
];

/* 特性カテゴリの表示メタデータ（アコーディオンの表示順）
   custom は常に最後に表示される、ユーザー作成の特性用カテゴリ */
export const TRAIT_CATEGORIES = [
  {key:'brain',    label:'頭脳系'},
  {key:'physical', label:'身体能力系'},
  {key:'artistic', label:'芸術系'},
  {key:'strategic',label:'戦略系'},
  {key:'skill',    label:'特殊技能系'},
  {key:'sensory',  label:'特殊感覚系'},
  {key:'custom',   label:'その他 (カスタム)'},
];

/* 特性カテゴリの開閉状態を保持するMap
   キー = カテゴリ名（例: "brain"）、値 = true なら折りたたみ中
   プロフィール画面の再描画時に状態を復元するために使用 */
export const traitCategoryCollapsedState = new Map();
/* コントラクトのアコーディオン開閉状態
   'issue'=契約発行パネル、'confirm'=契約確認パネル
   初期値: 両方とも開いている状態(false) */
export const contractAccCollapsedState = new Map([['issue',false],['confirm',false]]);
export const HISTORY_MAX = 120;
export const NUM_SLOTS   = 12;
export const TOP_N       = 100;
export const APP_VER     = '9.7';
export const THEME_KEY   = 'CoteOS_theme';
export const SLOT_META_KEY = 'CoteOS_v7_SlotMeta';
export const BGM_KEY       = 'CoteOS_v7_BGM';

export const slotKey = n => `CoteOS_v7_Slot${n}`;

/* ステータス値(1-15)に対応するグレード文字列のテーブル
   1=D-, 2=D, 3=D+, ... 13=S-, 14=S, 15=S+ */
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

/* クラス別ステータス生成設定（レガシー用）
   avg: 通常範囲 [最小,最大]、rare: レア範囲 [最小,最大]
   focus: ボーナスが付く能力キー */
export const CLASS_STAT_CFG = {
  0:{ avg:[6,8],  rare:[4,12], focus:['reasoning','memory','thinking'] },
  1:{ avg:[5,7],  rare:[4,10], focus:['language','memory'] },
  2:{ avg:[4,6],  rare:[2,10], focus:['physical','mental'] },
  3:{ avg:[5,5],  rare:[3,8],  focus:['physical','mental'] },
  4:{ avg:[1,6],  rare:[7,13], focus:[] },
};
/* ── X-Sum 二項分布アルゴリズム設定 ──────────────────────────────
   各クラスのステータス合計値(X)の範囲と平均を定義。
   xMin/xMax = 個別ステータスの最小/最大 × 6（能力数）
   xMean = 狙いの平均値（クラスごとに調整済み）
   sMin/sMax = 個別ステータスの下限/上限

   Aクラス: 5〜8 → 合計30〜48、平均≈40（最優秀）
   Bクラス: 5〜7 → 合計30〜42、平均≈37
   Cクラス: 4〜7 → 合計24〜42、平均≈34
   Dクラス: 4〜6 → 合計24〜36、平均≈31
   Eクラス: 2〜8 → 合計12〜48、平均≈28（ばらつき大） */
export const XSUM_CFG = {
  0: { xMin:30, xMax:48, xMean:40, sMin:5, sMax:8  }, /* Aクラス: 個別5〜8 */
  1: { xMin:30, xMax:42, xMean:37, sMin:5, sMax:7  }, /* Bクラス: 個別5〜7 */
  2: { xMin:24, xMax:42, xMean:34, sMin:4, sMax:7  }, /* Cクラス: 個別4〜7 */
  3: { xMin:24, xMax:36, xMean:31, sMin:4, sMax:6  }, /* Dクラス: 個別4〜6 */
  4: { xMin:12, xMax:48, xMean:28, sMin:2, sMax:8  }, /* Eクラス: 個別2〜8 */
};

/* 二項分布近似サンプリング関数
   [lo, hi] の範囲で mean 付近を中心とした釣り鐘型の値を生成する。
   中心極限定理（CLT）を利用: 12個の一様乱数の合計を正規化して使用。
   n=12 で良好なベルカーブが得られる。 */
export function binomialSample(lo, hi, mean){
  /* 目標平均値を [lo,hi] 内での割合 p に変換 */
  const range = hi - lo;
  if(range <= 0) return lo;
  const p = (mean - lo) / range;            /* 0..1 */
  /* 12個の一様乱数を合計・正規化し、[lo,hi] にスケーリング */
  let s = 0;
  for(let i = 0; i < 12; i++) s += Math.random();
  s /= 12;                                  /* 約0.5になる */
  /* 平均値が p に一致するようシフト */
  s = s + (p - 0.5);
  s = Math.max(0, Math.min(1, s));          /* [0,1] にクランプ */
  return Math.round(lo + s * range);
}

/* 生徒1人分の全6ステータスを生成する関数
   【アルゴリズム】
   1. クラスの設定に基づき、合計値X を二項分布から抽出
   2. ステータスの順番をランダムにシャッフル
   3. X を6つのステータスに貪欲法で分配:
      - 各ステータスは最低 sMin を保証
      - 残り予算をランダムに分配（最後のステータスが残りを吸収）
   戻り値: { language:数値, reasoning:数値, ... } のオブジェクト */
export function genStatXSum(cid){
  const cfg = XSUM_CFG[cid] ?? XSUM_CFG[4];
  const X   = binomialSample(cfg.xMin, cfg.xMax, cfg.xMean);
  const n   = STATS_KEYS.length; /* 6 */
  const {sMin, sMax} = cfg;

  /* 各ステータスを最小値で初期化 */
  const vals = STATS_KEYS.map(() => sMin);
  let budget = X - sMin * n;   /* 分配する残り予算 */

  /* ランダムな順序で予算を分配 */
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

/* クラス別のプライベートポイント初期値の範囲 [最小, 最大]
   Aクラスほど初期PPが高い */
export const PP_RANGE = {
  0:[50000,100000], 1:[30000,80000], 2:[20000,60000],
  3:[10000,50000],  4:[0,50000],
};

export function rndInt(lo,hi){ return Math.floor(Math.random()*(hi-lo+1))+lo; }
export function rndPick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
/* レガシーステータス生成関数（後方互換のため残存） */
export function genStat(cid,key){
  const cfg=CLASS_STAT_CFG[cid], rare=Math.random()<0.20;
  const [lo,hi]=rare?cfg.rare:cfg.avg; let v=lo===hi?lo:rndInt(lo,hi);
  if(cfg.focus.includes(key)) v=Math.min(15,v+1); return v;
}

/* 生年月日生成（基準年: 2000年）
   学年とシステム年から逆算して誕生日を生成。
   1〜3月生まれは翌年度扱い（日本の学年制度に準拠） */
export function genDOB(grade,sysYear){
  let y=2000+(6-grade)+(sysYear-1); const m=rndInt(1,12),d=rndInt(1,28);
  if(m<=3) y+=1;
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
/* 姓の生成: 一般的な姓(2/3) vs 珍しい姓(1/3) の重み付き選択
   日本の姓の頻度分布を反映 */
export function genSurname(){
  return Math.random() < 0.667
    ? rndPick(SURNAMES_MAJOR)
    : rndPick(SURNAMES_RARE);
}
/* 姓と名の間に半角スペースを挿入して氏名を生成 */
export function genStudentName(gender){
  return genSurname()+' '+rndPick(gender==='M'?MALE_NAMES:FEMALE_NAMES);
}

/* ══════════════════════════════════════════════════════════════════
   実行時の状態変数
   ──────────────────────────────────────────────────────────────────
   アプリの現在の状態を保持する変数群。
   ESモジュールでは外部から直接 export let は再代入できないため、
   各変数に対応する setter 関数を用意しています。
══════════════════════════════════════════════════════════════════ */
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

/* スロット0 = ゲストモード
   ゲストモードでは state はメモリ上のみに存在し、自動保存されない。
   セーブモーダルでスロット1〜12を選択すると永続化される。 */
export let isGuestMode     = false;   // true when currentSlot === 0

export let bgmWidget   = null;
export let bgmReady    = false;
export let bgmEnabled  = false;

/* ホーム画面の複数クラス選択用Set: "学年_クラスID" 形式の文字列を保持
   再描画をまたいで選択状態を維持する */
export const checkedClasses = new Set();

/* ホーム画面の編集モードフラグ
   true のとき PP/CP配布行とクラス選択バーが表示される */
export let editMode = false;

export function newState(){
  return { year:1, month:4, students:[], classes:[], history:[], nextId:1, slotName:'' };
}

/* ══════════════════════════════════════════════════════════════════
   テーマエンジン
   ──────────────────────────────────────────────────────────────────
   classic / light / dark の3テーマをCSS変数で切り替える。
   選択中のテーマは localStorage に保存される。
══════════════════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════════════════
   BGM（SoundCloud ウィジェット連携）
   ──────────────────────────────────────────────────────────────────
   SoundCloud の iframe Player API を使ってBGMの再生/停止/音量を制御。
   状態は localStorage に保存される。
══════════════════════════════════════════════════════════════════ */
/* 音量スライダーの緑バーの高さをCSS変数で同期する */
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
  /* スライダーパネルの表示/非表示を .vol-open クラスで制御 */
  if(hitbox){
    hitbox.classList.toggle('vol-open', !!bgmEnabled);
    const wrap = document.getElementById('bgm-slider-wrap');
    if(wrap) wrap.setAttribute('aria-hidden', String(!bgmEnabled));
  }
  syncVolFill();
  /* モバイル設定シートのBGMボタンも同期 */
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

/* ══════════════════════════════════════════════════════════════════
   生徒ID生成
   ──────────────────────────────────────────────────────────────────
   ID形式: 3桁プレフィックス + 4桁連番 = 7桁
   プレフィックスは学年とシステム年から算出。
   例: "0120001" = 1年生の1番目の生徒
══════════════════════════════════════════════════════════════════ */
export function gradePrefix(grade){
  /* 学年からIDプレフィックス（3桁）を生成
   1〜6年生: 基準年7からのオフセットで計算
   入学予定（>6）: 学年番号をそのままプレフィックスに使用 */
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

/* ══════════════════════════════════════════════════════════════════
   ユーティリティ関数
══════════════════════════════════════════════════════════════════ */
export function esc(s){
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
export function escA(s){ return String(s??'').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

export function toast(msg,cls='',ms=2800){
  const el=document.getElementById('toast'); if(!el) return;
  el.textContent=msg; el.className=cls?`on ${cls}`:'on';
  clearTimeout(toast._t); toast._t=setTimeout(()=>{ el.className=''; },ms);
}
/* 日付表示フォーマット */
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

/* ══════════════════════════════════════════════════════════════════
   クラスヘルパー関数
   ──────────────────────────────────────────────────────────────────
   クラスデータの取得、ランキング、名前表示などの便利関数。
══════════════════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════════════════
   空データ生成関数
   ──────────────────────────────────────────────────────────────────
   新規生徒・クラス・初期データの雛形を生成する。
══════════════════════════════════════════════════════════════════ */
export function blankStudent(grade,classId){
  const stats=Object.fromEntries(STATS_KEYS.map(k=>[k,1]));
  /* traits: 選択された特性IDの配列 */
  /* customTraits: ユーザー作成の特性 [{id, label, cat:'custom'}] */
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
      /* 削除した生徒を参照するコントラクトも除去 */
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

/* 入学予定コホートの全200名をランダム生成
   名前・性別・生年月日・PP・ステータスをクラス設定に基づき生成。
   ステータスは genStatXSum(cid) で在校生と同じバランスになる。 */
window.randomizeIncomingCohort=function(cg){
  const cohortStudents = state.students.filter(s=>s.grade==='Incoming'&&s.cohortGrade===cg);
  if(!cohortStudents.length){
    toast(`✗ 第${cg}期に生徒がいません`,'err'); return;
  }
  /* クラスIDごとにグループ化してクラス別設定を適用 */
  const byClass = {};
  CLASS_IDS.forEach(cid=>{ byClass[cid]=[]; });
  cohortStudents.forEach(s=>{ if(byClass[s.classId]!==undefined) byClass[s.classId].push(s); });

  CLASS_IDS.forEach(cid=>{
    const grp = byClass[cid];
    if(!grp.length) return;
    const n    = grp.length;
    const half = Math.floor(n / 2);
    /* 男女比を約50:50にしてシャッフル */
    const gend = Array(half).fill('M').concat(Array(n-half).fill('F'));
    for(let i=gend.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [gend[i],gend[j]]=[gend[j],gend[i]];
    }
    /* PP範囲: クラス0〜4の設定を適用 */
    const [ppLo, ppHi] = PP_RANGE[cid] ?? [0, 50000];

    grp.forEach((s, idx)=>{
      const gender = gend[idx] || 'M';
      s.name   = genStudentName(gender);
      s.gender = gender;
      /* 入学予定生徒の生年月日: コホート番号のオフセットから逆算
         offset=0 → 来年入学、offset=1 → 再来年入学
         先に作っておいたコホートでも正しい年度になる */
      const _cgOffset = cg - currentIncomingBaseGrade() - 1;
      s.dob    = genDOB(1, state.year + 1 + _cgOffset);
      s.privatePoints = rndInt(ppLo, ppHi);
      /* X-Sum二項分布アルゴリズムでステータスを生成 */
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
      /* X-Sum二項分布でステータス生成 */
      const xStats=genStatXSum(cid);
      STATS_KEYS.forEach(k=>{s.stats[k]=xStats[k];}); s.specialAbility='';
    });
  });
}

/* ══════════════════════════════════════════════════════════════════
   PP（プライベートポイント）ランキング
══════════════════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════════════════
   クラスポイント（CP）ランキング
══════════════════════════════════════════════════════════════════ */
export function computeClassRanking(){
  return [...state.classes]
    .sort((a,b)=>b.classPoints!==a.classPoints?b.classPoints-a.classPoints:
      (a.grade!==b.grade?a.grade-b.grade:a.classId-b.classId));
}

/* ── ESモジュール用セッター関数 ──────────────────────────────────
   ES Modulesの export let は外部モジュールから直接再代入できないため、
   各状態変数にセッター関数を提供する。 */
export function setState(s)           { state = s; _stateDirty = false; }
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

/* ── 状態変更の追跡（ダーティフラグ）───────────────────────────
   _stateDirty: 最後のセーブ以降に state が変更されたかを追跡。
   markDirty()    … state を直接変更した後に呼ぶ
   clearDirty()   … セーブ成功後に呼ばれる（自動）
   isStateDirty() … 未保存の変更があるか確認する */
let _stateDirty = false;
export function markDirty()       { _stateDirty = true; }
export function clearDirty()      { _stateDirty = false; }
export function isStateDirty()    { return _stateDirty; }

/* 生徒データを安全に変更するヘルパー関数
   IDで生徒を検索 → fn(生徒) を実行 → ダーティフラグを立てる
   使用例: mutateStudent('0120001', s => { s.privatePoints += 100; }); */
export function mutateStudent(sid, fn){
  const s = state?.students?.find(x=>x.id===sid);
  if(s){ fn(s); _stateDirty = true; }
  return s;
}

/* クラスデータを安全に変更するヘルパー関数
   学年+クラスIDで検索 → fn(クラス) を実行 → ダーティフラグを立てる */
export function mutateClass(grade, classId, fn){
  const c = state?.classes?.find(x=>x.grade===grade&&x.classId===classId);
  if(c){ fn(c); _stateDirty = true; }
  return c;
}

/* ── HTML内のonclickから呼び出せるようwindowに公開 ── */
window.toast        = toast;
window.applyTheme   = applyTheme;
window.toggleBGM    = toggleBGM;
window.setBulkPPValue = setBulkPPValue;
