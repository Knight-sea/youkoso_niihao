/* ================================================================
   Cote-OS v7.7  ·  app.js  "Typography & Consistency"
   ─────────────────────────────────────────────────────────────────
   Changes vs v7.6:
   • APP_VER → '7.7'
   • fmtDate: output changed from "Year X · 4月" to "Year X, Month Y"
     (pure numeric month — no MONTHS_JP lookup needed for taskbar)
   • drawProfileRadar: labelOffset set to exactly r+18 per spec
     (was r+22 in v7.6; r+18 is the agreed visible-separation value)
   • Ranking table td builder: stale 'rnk-num' class removed; all
     numeric data cols (PP, PRP, stats, overall) now get 'rk-num'
     (CSS v7.7 .rk-num = Orbitron font); .rk-pp keeps green colour
   • Grade screen "ランダム生成" btn-yw: 🎲 emoji removed from both
     the button label and the confirmRandomizeGrade modal title
   • graduatesCollapsedState: new module-level Map (mirrors
     incomingCollapsedState); persists collapse state of each
     graduate year-cohort accordion panel across re-renders
   • renderGraduates: reads graduatesCollapsedState to restore
     collapsed class + arrow char when rebuilding HTML on re-render;
     new panels default to open (not collapsed)
   • toggleCohort: now writes to BOTH Maps keyed by id prefix —
     graduate cohort IDs start with "Year-" or "卒業年不明",
     incoming cohort IDs start with "inc-"; each Map is written
     independently so the two screens don't interfere
   ================================================================ */
'use strict';

/* ──────────────────────────────────────────────────────────────────
   CONSTANTS
────────────────────────────────────────────────────────────────── */
const GRADES      = [1, 2, 3, 4, 5, 6];
const CLASS_IDS   = [0, 1, 2, 3, 4];
const RANK_LABELS = ['A', 'B', 'C', 'D', 'E'];
const STATS_KEYS  = ['language', 'reasoning', 'memory', 'thinking', 'physical', 'mental'];
/* v7.6: RADAR_LABELS — display labels for drawProfileRadar, strip 力/能力 suffix.
   Order must match STATS_KEYS exactly.                                            */
const RADAR_LABELS = ['言語', '推論', '記憶', '思考', '身体', '精神'];
const MONTHS_JP   = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const HISTORY_MAX = 120;
const NUM_SLOTS   = 12;
const TOP_N       = 100;
const APP_VER     = '7.7';
const THEME_KEY   = 'CoteOS_theme';
const SLOT_META_KEY = 'CoteOS_v7_SlotMeta';
const BGM_KEY       = 'CoteOS_v7_BGM';

const slotKey = n => `CoteOS_v7_Slot${n}`;

const STAT_GRADE_TABLE = [
  null, 'D-', 'D', 'D+', 'C-', 'C', 'C+',
  'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S-', 'S', 'S+',
];

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
  ranking:'ランキング', history:'月次履歴',
  gradeN: g => `${g}年生`,
  clsDef: (g, r) => `${g}年${r}組`,
};

/* ──────────────────────────────────────────────────────────────────
   RANDOMISER DATA — ×5 expanded name arrays
────────────────────────────────────────────────────────────────── */
const SURNAMES = [
  /* Top 130 — v5.4 originals */
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
  /* Extended batch A */
  "白石","大谷","西山","西川","神田","岡崎","五十嵐","熊谢","野中","松浦",
  "伏見","川村","徳田","橘","比企","東","新谷","滝沢","津田","工藤",
  "波多野","志村","根本","関口","瀬戸","畑","神谷","保坂","奥田","深沢",
  "二宮","三好","菱田","品川","八木","千代","磯部","上原","奥村","黒岩",
  "小山","吉原","沖","花田","本田","長嶋","平田","橋爪","荒木","久米",
  "下村","横田","片岡","尾崎","角田","内山","和泉","三宅","萩原","立花",
  "荒井","入江","大塩","羽田","久野","清田","曽根","湯浅","西本","宮下",
  "矢野","平井","吉野","細川","木下","杉田","高山","田畑","丸岡","竹田",
  "飯島","上杉","小松","秋山","笠原","大石","島村","奥山","古屋","長野",
  "矢島","酒井","桑田","富田","浅野","海老原","真田","岩崎","稲垣","浜口",
  /* Extended batch B */
  "原口","松下","樋口","山崎","野村","三田","椎名","石黒","市原","藤沢",
  "冨田","嶋田","水口","池上","宇野","城戸","木田","西岡","越智","砂田",
  "飯塚","泉谷","赤坂","角谷","別府","深田","粟田","玉置","松永","宮島",
  "向井","大倉","赤井","浜崎","戸田","国分","竹山","黒沢","川崎","高田",
  "宮地","福井","東野","稲田","今村","小泉","松村","西澤","篠田","富山",
  "津川","北島","澤田","坂口","塚田","富永","安部","矢口","天野","萩野",
  "中本","福本","笹田","尾野","平松","野上","内海","横尾","手塚","岡部",
  "石倉","杉浦","山ノ内","板垣","蒲田","奥野","永井","古賀","渡部","川端",
  "黒田","柳澤","岩本","沢村","三上","長沢","奥田","大村","千田","坂田",
  "幸田","大沼","西本","今泉","竹中","橋口","薄田","塩谷","大久保","小泉",
  /* Extended batch C */
  "香西","児玉","高村","折戸","末廣","光永","住田","蒔田","村瀬","横路",
  "田代","中尾","仁村","荒川","小倉","松岡","御手洗","石坂","上島","田原",
  "藪田","宇佐美","奥田","川畑","宮内","白川","西田","高岡","太刀川","三谷",
  "近松","藤川","成瀬","福永","宮里","有村","久田","根岸","長尾","岸本",
  "下田","牧野","植田","原田","伊勢","千田","後藤","西廣","山室","佐田",
  "竹腰","恩田","笠間","大橋","遠山","石部","牛島","石丸","神崎","浅川",
  "中谷","小澤","宮沢","阿部","田嶋","川本","鏡","伊原","前原","山地",
  "塩田","上田","国本","長井","江川","佐古","赤羽","森口","桂","細野",
  "石橋","外山","長浜","松尾","宇田","竹ノ内","浅田","玉田","岩瀬","藤野",
  "仲田","清野","境","矢吹","丸岡","杉野","荒城","大川","渡里","曲木",
];

const MALE_NAMES = [
  /* v5.4 originals (120) */
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
  /* Extended batch A */
  "太陽","遼太","勇斗","輝","英治","健","勇","拓也","大介","裕也",
  "浩二","俊太","貴大","和也","一郎","二郎","三郎","哲也","和輝","竜",
  "雅也","一輝","祐介","翔太","清志","道明","篤","功","洋介","典彦",
  "克己","正吾","渚","宙","玄","空太","武志","輝人","広大","信也",
  "颯人","漣","柊斗","奏人","律希","結人","亮","武","豊","誠一",
  "勝己","寿","誠也","永人","将平","亘","尚也","峻","将之","怜",
  "真人","敦","昌幸","哲也","和博","俊哉","一希","玄暉","真輝","颯也",
  "泰雅","隆太","怜司","晴貴","悠誠","力也","孝之","大賀","一颯","蒼士",
  "真吾","晃司","清人","尚志","海","玄之介","碧人","泰成","大智","武蔵",
  "巧","虎","幸人","秋人","草太","峰","龍","剣","悠弥","大輔",
  /* Extended batch B */
  "晴也","輝也","寛","大海","夏生","柳生","京介","瞬","武人","晋也",
  "諒","圭","亮介","一生","秀平","礼人","旅人","心","文也","翔平",
  "嵐","光平","旭","逸平","隼斗","凜","悠生","明，","大河","蓮太",
  "楓斗","桐人","光一","竜也","悠哉","怜央","朝陽","玲人","秀哉","剛士",
  "大翔","翔也","紘人","一陽","健人","海人","彩人","奈緒人","風","渦",
  "朔太","葵音","弥人","奏輝","晴大","光翔","優斗","嵩人","柊也","遼大",
  "龍誠","成輝","弘樹","友輝","晶","大成","悠輝","光昇","明斗","颯真",
  "天斗","輝琉","純","和樹","晴彦","哲人","文斗","利樹","勢月","蒼真",
  "尊","廣介","絵人","晶大","基輝","聖","岳","心陽","泰一","秀平",
  "泰樹","明輝","寿輝","成人","光太","達輝","仁也","悠成","綾人","蒼輝",
  /* Extended batch C */
  "凱翔","輝士","剣人","直哉","柔","優汰","恵悟","強","義輝","倫太郎",
  "誠之","泰二","竜斗","太一","一太","裕太","竜也","真那","大悟","優佑",
  "勉","哲朗","啓太","輝也","正輝","頼人","昇","功己","知也","和平",
  "浩平","雄一","英樹","守","克輝","仁","圭汰","直人","朋輝","嵐士",
  "湧士","颯介","巴人","昴輝","惺","清蔵","清","基","晃太","渓",
  "悠斗","皐月","天","空音","岳人","晴斗","佑輝","蒼汰","靖人","玲太",
  "海翔","哲太","直也","侑人","凛汰","怜也","悠大","晴輝","誠翔","太志",
  "颯雅","雄飛","大央","玄太","優仁","絃","紅士","悠士","大心","愛士",
  "瞬太","幸太","勇汰","将輝","海音","洸斗","弓人","輝音","光義","凛人",
  "快人","純之介","輝斗","真輝","秋士","心太","龍輝","淳士","綾斗","光弦",
];

const FEMALE_NAMES = [
  /* v5.4 originals (120) */
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
  /* Extended batch A */
  "里奈","知佳","亜沙子","麻理","友里","真紀","瑠菜","綾","永遠","七星",
  "夢花","柚","香","夢奈","涼","真由","桂","千里","里帆","はな",
  "みな","彩","夏音","愛里","瑛","薫","日奈","睦","ゆい","まい",
  "なつ","ひな","さくら","みき","あゆ","ゆか","あい","まな","りか","もも",
  "はる","ゆず","かな","のあ","みゆ","えり","あみ","ふゆ","さら","ゆき",
  "桜花","友香","真帆","千鶴","里美","美乃","和奏","彩音","佳音","理音",
  "春奈","星奈","美晴","日和","柚乃","恋奈","萌音","心乃","凜奈","奏乃",
  "愛奈","里音","詩音","夢乃","桜奈","麻奈","光奈","彩奈","花奈","紗奈",
  "美南","真奈","菜奈","友奈","佑奈","咲奈","和奈","陽奈","香奈","菜奈",
  "茉奈","葵奈","七奈","莉奈","美奈","涼奈","優奈","夏奈","遥奈","晴奈",
  /* Extended batch B */
  "栞","泉","暖","茉莉","胡桃","柊葉","紫苑","月","夕","星花",
  "菖蒲","藤花","山吹","杜若","緑","翠","碧空","虹","彩虹","萌黄",
  "春霞","秋霜","冬夜","夏宵","朝凪","夕凪","暮里","暁音","宵音","夜音",
  "芽吹","青葉","若葉","新葉","双葉","小葉","一葉","千葉","万葉","彩葉",
  "朱夏","白秋","玄冬","黎明","曙","暁","夕暮","薄暮","宵闇","黎",
  "雪花","雪音","雪菜","雪奈","雪乃","雪絵","雪佳","雪菊","雪実","雪珠",
  "咲花","咲希","咲音","咲乃","咲奈","咲菜","咲季","咲紀","咲恵","咲実",
  "花音","花奏","花恋","花菜","花澄","花穂","花純","花子","花菊","花絵",
  "美空","美海","美湖","美川","美滝","美波","美桜","美香","美音","美凛",
  "幸菜","幸穂","幸恵","幸絵","幸美","幸子","幸乃","幸音","幸花","幸葉",
  /* Extended batch C */
  "妙","千代","喜久","弥生","卯月","皐","文","武","葛","諾",
  "綾香","綾音","綾乃","綾菜","綾花","綾奈","綾子","綾帆","綾佳","綾美",
  "穂乃果","穂奈美","穂波","穂音","穂花","穂葉","穂香","穂菜","穂美","穂実",
  "菜緒","菜月","菜音","菜乃","菜穂","菜波","菜摘","菜那","菜帆","菜恵",
  "怜奈","怜花","怜菜","怜佳","怜音","怜乃","怜美","怜菊","怜珠","怜子",
  "凛花","凛音","凛乃","凛菜","凛佳","凛美","凛珠","凛香","凛穂","凛葉",
  "紗月","紗希","紗音","紗乃","紗菜","紗花","紗奈","紗美","紗香","紗葉",
  "舞","舞花","舞音","舞菜","舞香","舞奈","舞佳","舞葉","舞夏","舞乃",
  "歌","歌花","歌音","歌菜","歌乃","歌奈","歌美","歌帆","歌月","歌晴",
  "奏花","奏音","奏菜","奏乃","奏佳","奏香","奏美","奏葉","奏月","奏晴",
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
  const cfg=CLASS_STAT_CFG[cid], rare=Math.random()<0.20;
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
let bulkPPValue = '';
let swapMode    = false;
let swapDragId  = null;

let slModalOpen     = false;
let slSelectedSlot  = 1;
let slNameDrafts    = {};

/* v7.3: Slot 0 — Guest Mode ─────────────────────────────────────
   currentSlot === 0  ⟹  session is volatile; data lives in state
   only. saveState() refuses to persist slot 0 unless the user
   explicitly picks a target slot 1-12 via the Save modal.       */
let isGuestMode     = false;   // true when currentSlot === 0

let bgmWidget   = null;
let bgmReady    = false;
let bgmEnabled  = false;

function newState(){
  return { year:1, month:4, students:[], classes:[], history:[], nextId:1, slotName:'' };
}

/* ──────────────────────────────────────────────────────────────────
   THEME ENGINE
────────────────────────────────────────────────────────────────── */
const THEMES = ['classic','light','dark'];

function applyTheme(name){
  if(!THEMES.includes(name)) name='classic';
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem(THEME_KEY, name);
  document.querySelectorAll('.tf-opt').forEach(b=>{
    b.classList.toggle('active', b.dataset.theme===name);
  });
}
function loadTheme(){
  applyTheme(localStorage.getItem(THEME_KEY)||'classic');
}

/* ──────────────────────────────────────────────────────────────────
   BGM (SoundCloud Widget)
────────────────────────────────────────────────────────────────── */
/* v7.4: syncVolFill — sets --vol-pct on #bgm-slider-wrap so the CSS
   green fill-bar height matches the current slider value.           */
function syncVolFill(){
  const slider=document.getElementById('bgm-volume');
  const wrap  =document.getElementById('bgm-slider-wrap');
  if(!slider||!wrap) return;
  wrap.style.setProperty('--vol-pct', slider.value);
}

function syncBgmButton(){
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
}
function setBgmEnabled(on, silent=false){
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
function toggleBGM(){
  setBgmEnabled(!bgmEnabled);
}
function initBGM(){
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
function gradePrefix(grade){
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
function genStudentId(grade){
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
/* v7.7: date format changed from "Year X · 4月" to "Year X, Month Y" */
function fmtDate(y,m){ return `Year ${y}, Month ${m}`; }

function fmtPP(v){
  const a=Math.abs(v);
  if(a>=1e12) return (v/1e12).toFixed(1)+'T';
  if(a>=1e9)  return (v/1e9).toFixed(1)+'B';
  if(a>=1e6)  return (v/1e6).toFixed(1)+'M';
  if(a>=1e3)  return (v/1e3).toFixed(1)+'K';
  return String(v);
}
function ppCol(v){ return v>0?'pos':v<0?'neg':'neu'; }
function clampStat(v){
  const n=parseInt(v,10);
  return (!isNaN(n)&&n>=1&&n<=15)?n:1;
}

function statGradeLabel(value){
  return STAT_GRADE_TABLE[clampStat(value)] || 'D-';
}
function statGradeClass(value){
  const n=clampStat(value);
  const map=['sg-dm','sg-d','sg-dp','sg-cm','sg-c','sg-cp','sg-bm','sg-b','sg-bp','sg-am','sg-a','sg-ap','sg-s','sg-s','sg-sp'];
  return map[n-1] || 'sg-dm';
}

function getSchoolRankingPool(src=state?.students||[]){
  return src.filter(s=>typeof s.privatePoints==='number' && !s.isExpelled);
}
function getPPRankPercentile(student,pool=getSchoolRankingPool()){
  if(!student || !pool.length) return 100;
  const higher = pool.filter(s=>s.privatePoints > student.privatePoints).length;
  const same   = pool.filter(s=>s.privatePoints === student.privatePoints).length;
  const rank   = higher + (same>0 ? 1 : 0);
  return (rank / pool.length) * 100;
}
function getPPRankBonus(student,pool=getSchoolRankingPool()){
  const p=getPPRankPercentile(student,pool);
  if(p<=1) return 5;
  if(p<=20) return 4;
  if(p<=40) return 3;
  if(p<=60) return 2;
  if(p<=80) return 1;
  return 0;
}
function calcOverallScoreDetail(student,pool=getSchoolRankingPool()){
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
function calcOverallScore(student,pool=getSchoolRankingPool()){
  return calcOverallScoreDetail(student,pool).total;
}

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
  const c=getCls(grade,classId);
  if(!c) return JP.clsDef(grade,rankOf(grade,classId));
  return c.customName||c.name||JP.clsDef(grade,rankOf(grade,classId));
}

/* ──────────────────────────────────────────────────────────────────
   BLANK DATA GENERATORS
────────────────────────────────────────────────────────────────── */
function blankStudent(grade,classId){
  const stats=Object.fromEntries(STATS_KEYS.map(k=>[k,1]));
  return { id:genStudentId(grade), name:'', gender:'M', dob:'', grade, classId, stats,
           specialAbility:'', privatePoints:0, protectPoints:0, contracts:[], isExpelled:false };
}
function blankClass(grade,classId,rankLabel){
  const name=rankLabel?JP.clsDef(grade,rankLabel):'';
  return { grade,classId,classPoints:0,customName:'',name };
}

function generateInitialData(){
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
function currentIncomingBaseGrade(){
  // Find grade-1 students and read their ID prefix
  const g1 = state.students.find(s=>s.grade===1&&s.id&&s.id.length>=3);
  if(g1){
    const pfxNum = parseInt(g1.id.slice(0,3),10);
    if(!isNaN(pfxNum)) return pfxNum;
  }
  // Fallback: standard formula
  return 7+(6-1)+(state.year-1); // = year+11
}

function nextIncomingCohortGrade(){
  const existing = getIncomingCohorts();
  if(existing.length){
    return Math.max(...existing)+1;
  }
  return currentIncomingBaseGrade()+1;
}

function getIncomingCohorts(){
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
  saveState(true);
  navigateReplace('incoming',{});
  toast(`✓ 入学予定コホート 第${cg}期 (200名) を作成しました`,'ok',3000);
};

window.deleteIncomingCohort=function(cg){
  uiConfirm({
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
      navigateReplace('incoming',{});
      toast(`✓ 第${cg}期コホートを削除しました`,'warn',3000);
    },
  });
};

/* v7.5: randomizeIncomingCohort — fills all 200 slots of the given cohort
   with randomised name, gender, DOB, PP (by class config), and stats.
   Stat range: 40–90 on a 0–100 scale mapped to the 1–15 stat range:
     raw 0–100  →  stat = round(raw / 100 * 14) + 1  (gives 1–15)
   With range 40–90: min stat ≈ 7, max stat ≈ 14 (strong incoming class). */
window.randomizeIncomingCohort=function(cg){
  const cohortStudents = state.students.filter(s=>s.grade==='Incoming'&&s.cohortGrade===cg);
  if(!cohortStudents.length){
    toast(`✗ 第${cg}期に生徒がいません`,'err'); return;
  }
  /* Group by classId so we can apply PP_RANGE per-class */
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
      /* Incoming students: estimated DOB as if entering grade 1 next year */
      s.dob    = genDOB(1, state.year + 1);
      s.privatePoints = rndInt(ppLo, ppHi);
      /* Stats: raw 40–90 range → mapped to 1–15 scale */
      STATS_KEYS.forEach(k=>{
        const raw  = rndInt(40, 90);
        s.stats[k] = Math.min(15, Math.max(1, Math.round(raw / 100 * 14) + 1));
      });
      s.specialAbility = '';
    });
  });

  saveState(true);
  navigateReplace('incoming', {});
  toast(`✓ 第${cg}期 ランダム生成完了 (${cohortStudents.length}名)`, 'ok', 3000);
};
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
   CLASS PP RANKING
────────────────────────────────────────────────────────────────── */
function computeClassRanking(){
  return [...state.classes]
    .sort((a,b)=>b.classPoints!==a.classPoints?b.classPoints-a.classPoints:
      (a.grade!==b.grade?a.grade-b.grade:a.classId-b.classId));
}

/* ──────────────────────────────────────────────────────────────────
   SAVE / LOAD (v7.0) — 12 slot modal system
────────────────────────────────────────────────────────────────── */
function defaultSlotName(n){ return `Slot ${n}`; }
function normalizeSlotMeta(meta){
  const out={};
  for(let n=1;n<=NUM_SLOTS;n++){
    const v=meta?.[n] ?? meta?.[String(n)];
    out[n]=(typeof v==='string'&&v.trim())?v.trim():defaultSlotName(n);
  }
  return out;
}
function loadSlotMeta(){
  try{ return normalizeSlotMeta(JSON.parse(localStorage.getItem(SLOT_META_KEY)||'{}')); }
  catch(_){ return normalizeSlotMeta({}); }
}
function saveSlotMeta(meta){
  localStorage.setItem(SLOT_META_KEY, JSON.stringify(normalizeSlotMeta(meta)));
}
function slotNameOf(n){
  const meta=loadSlotMeta();
  return meta[n] || defaultSlotName(n);
}
function setSlotName(n,name){
  const meta=loadSlotMeta();
  meta[n]=(name&&name.trim())?name.trim():defaultSlotName(n);
  saveSlotMeta(meta);
}
function slotHasData(n){ return !!localStorage.getItem(slotKey(n)); }

function saveState(silent=false,targetSlot=currentSlot,forcedName=''){
  if(!state || !state.students || state.students.length===0) return false;
  const slot=Number(targetSlot)||currentSlot;
  /* v7.3: Slot 0 is volatile — never write guest data to localStorage */
  if(slot===0) return false;
  const slotName=(forcedName||state.slotName||slotNameOf(slot)||defaultSlotName(slot)).trim();
  try{
    const payload={...state, slotName};
    localStorage.setItem(slotKey(slot), JSON.stringify(payload));
    setSlotName(slot, slotName);
    if(slot===currentSlot) state.slotName=slotName;
    updateSlotButtons();
    if(slModalOpen) renderSaveLoadModal();
    if(!silent) toast(`✓ スロット${slot}にセーブしました`,'ok');
    return true;
  }catch(e){
    toast('✗ セーブ失敗: '+e.message,'err');
    return false;
  }
}
function loadSlot(n){
  const raw=localStorage.getItem(slotKey(n));
  if(!raw){ state=null; return false; }
  try{
    state=JSON.parse(raw);
    if(!state.slotName) state.slotName=slotNameOf(n);
    return true;
  }catch(e){
    console.warn('loadSlot',n,e);
    state=null;
    return false;
  }
}
function switchSlot(n, silent=false){
  const next=+n;
  if(next===currentSlot) return;
  saveState(true,currentSlot,state?.slotName||slotNameOf(currentSlot));
  state=null; currentSlot=next; selectMode=false; swapMode=false; selectedIds=new Set(); navStack=[];
  loadSlot(next);
  updateSlotButtons(); updateDateDisplay(); navigate('home',{},true);
  if(!silent) toast(`スロット${next}に切り替えました`);
}
function resetSlot(slot=currentSlot){
  const n=+slot;
  localStorage.removeItem(slotKey(n));
  const meta=loadSlotMeta();
  meta[n]=defaultSlotName(n);
  saveSlotMeta(meta);
  if(n===currentSlot) state=null;
  updateSlotButtons();
  if(slModalOpen) renderSaveLoadModal();
}
function updateSlotButtons(){
  const chip=document.getElementById('slot-chip');
  if(chip){
    /* v7.3: slot 0 = guest mode, slots 1-12 = normal */
    chip.textContent = currentSlot===0 ? 'ゲストモード' : `スロット ${currentSlot}`;
  }
  isGuestMode = (currentSlot===0);
}

function readSlotBrief(n){
  const raw=localStorage.getItem(slotKey(n));
  const name=slNameDrafts[n]??slotNameOf(n);
  if(!raw){
    return { slot:n, name, empty:true, year:'-', month:'-', count:0 };
  }
  try{
    const s=JSON.parse(raw);
    return {
      slot:n,
      name:slNameDrafts[n]??(s.slotName||slotNameOf(n)),
      empty:false,
      year:s.year ?? '-',
      month:s.month ?? '-',
      count:Array.isArray(s.students)?s.students.length:0,
    };
  }catch(_){
    return { slot:n, name, empty:true, year:'-', month:'-', count:0 };
  }
}

function renderSaveLoadModal(){
  const slotsEl=document.getElementById('sl-slots');
  if(!slotsEl) return;
  let html='';
  for(let n=1;n<=NUM_SLOTS;n++){
    const info=readSlotBrief(n);
    const active=(n===slSelectedSlot)?' active':'';
    const emptyCls=info.empty?' empty':'';
    // v7.2: Japanese status labels
    const status=info.empty?'空き':'データあり';
    html+=`
      <div class="sl-slot${active}${emptyCls}" data-slot="${n}">
        <div class="sl-slot-head">
          <span class="sl-slot-num">スロット ${n}</span>
          <span class="sl-slot-state">${status}</span>
        </div>
        <input class="sl-slot-name" data-slot-name="${n}" value="${escA(info.name||defaultSlotName(n))}" />
        <div class="sl-slot-meta">
          <div class="sl-slot-meta-row"><span>年</span><span>${info.empty?'―':info.year}</span></div>
          <div class="sl-slot-meta-row"><span>月</span><span>${info.empty?'―':MONTHS_JP[Math.max(0,(+info.month||1)-1)]}</span></div>
          <div class="sl-slot-meta-row"><span>生徒数</span><span>${info.empty?'―':info.count+'名'}</span></div>
        </div>
      </div>`;
  }
  slotsEl.innerHTML=html;

  slotsEl.querySelectorAll('.sl-slot').forEach(card=>{
    card.addEventListener('click',()=>{
      slSelectedSlot=+card.dataset.slot;
      renderSaveLoadModal();
    });
  });
  slotsEl.querySelectorAll('input[data-slot-name]').forEach(inp=>{
    inp.addEventListener('click',e=>e.stopPropagation());
    inp.addEventListener('input',()=>{
      const n=+inp.dataset.slotName;
      slNameDrafts[n]=inp.value;
      setSlotName(n, inp.value);
      if(state && n===currentSlot) state.slotName=slotNameOf(n);
      updateSlotButtons();
    });
  });

  /* v7.3: enable/disable action buttons based on whether selected slot has data */
  syncSlModalButtons();
}

/* v7.3: Disable Play / Export / Save when the selected slot is empty.
   "新しくプレイ" (#sl-btn-new-play) and "読み込み" are always enabled. */
function syncSlModalButtons(){
  const hasData = slotHasData(slSelectedSlot);
  const btns = {
    'sl-btn-play':   !hasData,   // disabled when empty
    'sl-btn-save':   false,      // always enabled (saves current state INTO selected slot)
    'sl-btn-export': !hasData,   // disabled when empty
    'sl-btn-delete': !hasData,   // disabled when empty
  };
  Object.entries(btns).forEach(([id, disable])=>{
    const el=document.getElementById(id);
    if(!el) return;
    el.classList.toggle('sl-act-disabled', disable);
    el.disabled = disable;
  });
  /* new-play is always enabled — never disable it */
  const newPlay=document.getElementById('sl-btn-new-play');
  if(newPlay){ newPlay.classList.remove('sl-act-disabled'); newPlay.disabled=false; }
}
function openSaveLoadModal(){
  slModalOpen=true;
  slSelectedSlot=currentSlot;
  slNameDrafts={};
  const ov=document.getElementById('sl-overlay');
  ov?.classList.remove('hidden');
  renderSaveLoadModal();
}
function closeSaveLoadModal(){
  slModalOpen=false;
  document.getElementById('sl-overlay')?.classList.add('hidden');
}
function saveToSelectedSlot(){
  const n=slSelectedSlot;
  const nameInput=document.querySelector(`input[data-slot-name="${n}"]`);
  const nm=nameInput?.value?.trim() || slotNameOf(n) || defaultSlotName(n);
  if(n>0) setSlotName(n,nm);

  if(!state || !state.students?.length){
    toast('✗ セーブ対象データがありません','err');
    return;
  }

  /* v7.3: guest mode — the current state is volatile (slot 0).
     Saving it means copying to the selected permanent slot.        */
  if(isGuestMode){
    uiConfirm({
      title:'ゲストデータをセーブ',
      body:`スロット ${n} にゲストデータを保存します。<br>既存データは上書きされます。続行しますか？`,
      variant: slotHasData(n) ? 'warn' : 'info',
      okLabel:'セーブ',
      onOk:()=>{
        const prevSlot=currentSlot;
        currentSlot=n;
        state.slotName=nm;
        saveState(false,n,nm);
        currentSlot=prevSlot;     // stay in guest mode
        renderSaveLoadModal();
      },
    });
    return;
  }

  /* Normal: save current slot into n */
  if(n!==currentSlot){
    uiConfirm({
      title:`スロット ${n} に上書き`,
      body:`現在のデータをスロット ${n} に保存します。<br>${slotHasData(n)?'既存データは上書きされます。':''}続行しますか？`,
      variant: slotHasData(n) ? 'warn' : 'info',
      okLabel:'セーブ',
      onOk:()=>{
        saveState(true,n,nm);
        toast(`✓ 現在データをスロット${n}へ保存`,'ok');
        renderSaveLoadModal();
      },
    });
  }else{
    if(!saveState(true,n,nm)) return;
    toast(`✓ スロット${n}を保存`,'ok');
    renderSaveLoadModal();
  }
}
function playSelectedSlot(){
  const n=slSelectedSlot;

  /* v7.3: If user is in guest mode with data, warn before switching */
  if(isGuestMode && state?.students?.length){
    uiConfirm({
      title:'未保存のゲストデータ',
      body:`スロット ${n} に切り替えると、現在のゲストデータは失われます。<br>続行しますか？`,
      variant:'warn',
      okLabel:'切り替える',
      onOk:()=>_doPlaySlot(n),
    });
    return;
  }

  _doPlaySlot(n);
}

function _doPlaySlot(n){
  /* Empty slot → auto-generate 1,200 blank students and go home */
  if(!slotHasData(n)){
    saveState(true, currentSlot, state?.slotName||slotNameOf(currentSlot));
    currentSlot=n; isGuestMode=false;
    state=newState();
    generateInitialData();
    saveState(true);
    updateSlotButtons(); updateDateDisplay();
    selectMode=false; swapMode=false; selectedIds=new Set(); navStack=[];
    navigate('home',{},true);
    closeSaveLoadModal();
    toast(`▶ スロット${n} — 新規データを開始しました`,'ok',3000);
    return;
  }

  /* Normal: load existing slot */
  saveState(true, currentSlot, state?.slotName||slotNameOf(currentSlot));
  currentSlot=n; isGuestMode=false;
  loadSlot(n);
  updateSlotButtons(); updateDateDisplay();
  selectMode=false; swapMode=false; selectedIds=new Set(); navStack=[];
  navigate('home',{},true);
  closeSaveLoadModal();
  toast(`▶ スロット${n}をロードしました`,'ok');
}
function deleteSelectedSlot(){
  const n=slSelectedSlot;
  resetSlot(n);
  if(n===currentSlot){
    navStack=[];
    navigate('home',{},true);
  }
  toast(`✓ スロット${n}を削除しました`,'warn');
}
function bindSaveLoadModalControls(){
  if(bindSaveLoadModalControls._bound) return;
  bindSaveLoadModalControls._bound=true;

  // v7.1: #sl-close is hidden in HTML; keep binding harmless
  document.getElementById('sl-close')?.addEventListener('click',closeSaveLoadModal);

  // v7.1: Back button closes the modal
  document.getElementById('sl-btn-back')?.addEventListener('click',closeSaveLoadModal);

  // v7.1: Clicking the overlay does NOTHING (background non-interactive)
  // Do NOT bind sl-overlay click to close.

  document.getElementById('sl-btn-save')?.addEventListener('click',saveToSelectedSlot);
  document.getElementById('sl-btn-export')?.addEventListener('click',()=>exportAllSlots());
  document.getElementById('sl-btn-import')?.addEventListener('click',()=>triggerImportDialog());

  // v7.3: Delete — custom UI confirm instead of window.confirm
  document.getElementById('sl-btn-delete')?.addEventListener('click',()=>{
    const n=slSelectedSlot;
    if(!slotHasData(n)){
      toast(`✗ スロット${n}にはデータがありません`,'err');
      return;
    }
    uiConfirm({
      title:`スロット ${n} を削除`,
      body:`スロット ${n} のデータを完全に削除します。<br><strong>この操作は取り消せません。</strong>`,
      variant:'danger',
      okLabel:'削除する',
      onOk:()=>deleteSelectedSlot(),
    });
  });

  document.getElementById('sl-btn-play')?.addEventListener('click',playSelectedSlot);

  /* v7.3: "新しくプレイ" — Slot 0 guest mode, always available */
  document.getElementById('sl-btn-new-play')?.addEventListener('click',()=>{
    const doStart=()=>{
      currentSlot=0; isGuestMode=true;
      state=newState();
      generateInitialData();
      // Do NOT saveState — guest data is volatile
      updateSlotButtons(); updateDateDisplay();
      selectMode=false; swapMode=false; selectedIds=new Set(); navStack=[];
      navigate('home',{},true);
      closeSaveLoadModal();
      toast('ゲストモード開始 — データは自動保存されません','warn',4000);
    };

    /* Warn if switching away from unsaved guest session */
    if(isGuestMode && state?.students?.length){
      uiConfirm({
        title:'ゲストデータをリセット',
        body:'新しくプレイすると、現在のゲストデータは失われます。<br>続行しますか？',
        variant:'warn',
        okLabel:'新しくプレイ',
        onOk:doStart,
      });
    }else{
      doStart();
    }
  });
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
    year:s.year,month:s.month,nextId:s.nextId,slotName:s.slotName||'',
    classes:s.classes.map(c=>({grade:c.grade,classId:c.classId,classPoints:c.classPoints,customName:c.customName||'',name:c.name||''})),
    students:s.students.map(st=>({
      id:st.id,name:st.name,gender:st.gender,dateOfBirth:st.dob,
      grade:st.grade,classId:st.classId,privatePoints:st.privatePoints,protectPoints:st.protectPoints,
      status:st.isExpelled?'expelled':st.grade==='Graduate'?'graduate':st.grade==='Incoming'?'incoming':'active',
      specialAbility:st.specialAbility,
      /* v7.4: cohort fields */
      ...(typeof st.cohortGrade==='number'  ? {cohortGrade:st.cohortGrade}   : {}),
      ...(typeof st.graduateYear==='number' ? {graduateYear:st.graduateYear} : {}),
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
        <strong style="color:var(--io)">読み込み先：</strong> スロット 1〜12 すべてが上書きされます。<br>
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
  const meta=loadSlotMeta();
  let restored=0;
  for(let n=1;n<=NUM_SLOTS;n++){
    const raw=parsed.slots[n]??parsed.slots[String(n)];
    if(!raw){
      localStorage.removeItem(slotKey(n));
      meta[n]=defaultSlotName(n);
      continue;
    }
    try{
      const ss=deserializeSlot(raw);
      repairIntegrity(ss);
      localStorage.setItem(slotKey(n),JSON.stringify(ss));
      meta[n]=(ss.slotName&&ss.slotName.trim())?ss.slotName.trim():defaultSlotName(n);
      restored++;
    }
    catch(e){ console.warn('import slot',n,e); }
  }
  saveSlotMeta(meta);
  state=null; selectMode=false; selectedIds=new Set(); navStack=[];
  loadSlot(currentSlot);
  updateSlotButtons(); updateDateDisplay(); navigate('home',{},true);
  toast(`✓ 読み込み完了 — ${restored}スロットを復元しました`,'io',3500);
}
function deserializeSlot(obj){
  const s=newState();
  s.year=typeof obj.year==='number'&&obj.year>=1?obj.year:1;
  s.month=typeof obj.month==='number'&&obj.month>=1?obj.month:4;
  s.nextId=typeof obj.nextId==='number'&&obj.nextId>=1?obj.nextId:1;
  s.slotName=String(obj.slotName||'').trim();
  s.classes=(obj.classes||[]).map(c=>({grade:c.grade,classId:typeof c.classId==='number'?c.classId:0,
    classPoints:typeof c.classPoints==='number'?c.classPoints:0,
    customName:String(c.customName||''),
    name:String(c.name||JP.clsDef(c.grade,RANK_LABELS[typeof c.classId==='number'?c.classId:0]||'A'))}));
  s.students=(obj.students||[]).map(st=>{
    const expelled=st.isExpelled===true||st.status==='expelled';
    let grade=st.grade; if(typeof grade==='string'&&/^\d+$/.test(grade)) grade=+grade;
    const out={ id:String(st.id||''),name:String(st.name||''),gender:st.gender==='F'?'F':'M',
      dob:String(st.dateOfBirth||st.dob||''),grade,classId:typeof st.classId==='number'?st.classId:0,
      privatePoints:typeof st.privatePoints==='number'?st.privatePoints:0,
      protectPoints:typeof st.protectPoints==='number'?st.protectPoints:0,
      isExpelled:expelled,specialAbility:String(st.specialAbility||''),
      stats:Object.fromEntries(STATS_KEYS.map(k=>[k,clampStat(st.stats?.[k])])),
      contracts:(st.contracts||[]).map(c=>({targetId:String(c.targetId||''),
        amount:typeof(c.monthlyAmount??c.amount)==='number'?(c.monthlyAmount??c.amount):0})) };
    /* v7.4: restore cohort fields */
    if(typeof st.cohortGrade==='number')  out.cohortGrade  = st.cohortGrade;
    if(typeof st.graduateYear==='number') out.graduateYear = st.graduateYear;
    return out;
  });
  s.history=(obj.historySnapshots||obj.history||[]).slice(0,HISTORY_MAX).map(h=>({
    year:+h.year||1,month:+h.month||4,
    classPoints:Array.isArray(h.classPoints)?h.classPoints:[],
    studentPP:Array.isArray(h.studentPP)?h.studentPP:[],
    studentGrades:Array.isArray(h.studentGrades)?h.studentGrades:[],
  }));
  return s;
}
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
  const d=new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
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
   RENDER ENGINE
────────────────────────────────────────────────────────────────── */
function renderApp(){
  updateDateDisplay();
  const cur=navStack[navStack.length-1];
  if(cur) renderPage(cur.page,cur.params); else navigate('home',{},true);
}
function updateDateDisplay(){
  const el=document.getElementById('date-display'); if(!el) return;
  // v7.1: always show a date — default to Year 1 · 4月 when no state
  if(state) el.textContent=fmtDate(state.year,state.month);
  else el.textContent=fmtDate(1,4);
}
function renderPage(page,params){
  const app=document.getElementById('app');
  if(!app) return;
  /* v7.3: state is ALWAYS non-null after boot (slot 1 auto-inits; guest mode inits in memory).
     The NO DATA path has been fully removed. */
  if(!state){
    // Safety net only — should never occur in normal operation
    app.innerHTML='<div class="pg-hdr"><span class="pg-title" style="color:var(--t2)">読み込み中...</span></div>';
    afterRender();
    return;
  }
  switch(page){
    case 'home':         app.innerHTML=renderHome(); break;
    case 'grade':        app.innerHTML=renderGrade(params.grade); break;
    case 'class':        app.innerHTML=renderClass(params.grade,params.classId); break;
    case 'profile':      app.innerHTML=renderProfile(params.sid); break;
    case 'graduates':    app.innerHTML=renderSpecial('Graduate'); break;
    case 'incoming':     app.innerHTML=renderSpecial('Incoming'); break;
    case 'ranking':      app.innerHTML=renderRankingPage(); break;
    case 'classRanking': app.innerHTML=renderClassRankingPage(); break;
    case 'history':      app.innerHTML=renderHistory(); break;
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
      <span class="hm-slot">${isGuestMode?'ゲストモード':`スロット ${currentSlot}`}</span>
      <span>${fmtDate(state.year,state.month)}</span>
      <span>${activeCount}名在籍</span>
      <div class="hm-right">
        <span class="hm-link" onclick="navigate('ranking',{},false)">🏆 ${JP.ranking} TOP${TOP_N}</span>
        <span class="hm-link hm-link-cls" onclick="navigate('classRanking',{},false)">🏫 クラスランキング</span>
      </div>
    </div>
    <div class="pg-hdr">
      <span class="pg-title">システム概要</span>
      <span class="pg-sub">6学年 · 5クラス統合管理 v${APP_VER}${isGuestMode?' · <span style="color:var(--yw)">ゲストモード（未保存）</span>':''}</span>
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
        <div class="cls-strip">`;
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
   HISTORY PAGE — v6.5: vertical list, HISTORY_MAX=120
────────────────────────────────────────────────────────────────── */
function renderHistory(){
  const snaps=state.history;
  let h=`
    <button class="back-btn" onclick="goBack()">◀ 戻る</button>
    <div class="pg-hdr">
      <span class="pg-title">${JP.history}</span>
      <span class="pg-sub">${snaps.length} / ${HISTORY_MAX} スナップショット</span>
    </div>`;

  if(!snaps.length){
    h+=`<div class="hist-empty">月を進めると履歴が記録されます。</div>`;
    return h;
  }

  h+=`<div class="hist-list">`;
  snaps.forEach((snap,idx)=>{
    const clsCount=(snap.classPoints||[]).length;
    const stuCount=(snap.studentPP||[]).length;
    h+=`
      <div class="hist-row">
        <div class="hist-row-date">Year ${snap.year} &nbsp;·&nbsp; ${MONTHS_JP[snap.month-1]}</div>
        <div class="hist-row-idx">#${snaps.length-idx}</div>
        <div class="hist-row-cls"><span>${clsCount}</span> クラス</div>
        <div class="hist-row-stu"><span>${stuCount}</span> 名</div>
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
      <button class="btn btn-yw" onclick="confirmRandomizeGrade(${grade})">ランダム生成</button>
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
    if(!kp.length){
      h+=`<span class="dim" style="padding:8px 12px;font-size:.7rem;align-self:center">生徒なし</span>`;
    } else {
      kp.forEach(s=>{
        h+=`
          <div class="kp-card" onclick="navigate('profile',{sid:'${s.id}'},false)">
            <div class="kp-name">${esc(s.name)||'<span class="dim">(未記入)</span>'}</div>
            <span class="kp-pp-val ${ppCol(s.privatePoints)}">${fmtPP(s.privatePoints)}<span style="color:#fff;font-size:.58rem;margin-left:2px;opacity:.8">PP</span></span>
            ${s.protectPoints>0?`<span class="kp-prp-val">${s.protectPoints}<span style="color:#fff;font-size:.58rem;margin-left:2px;opacity:.8">PRP</span></span>`:''}
          </div>`;
      });
    }
    h+=`</div></div>`;
  });
  return h;
}

window.confirmRandomizeGrade=function(grade){
  const total=state.students.filter(s=>s.grade===grade&&!s.isExpelled).length;
  openModal(`
    <div class="m-title">${JP.gradeN(grade)} ランダム生成</div>
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
   CLASS PAGE — v7.0 (Select Mode + Swap Mode)
────────────────────────────────────────────────────────────────── */
function applyClassActiveOrder(grade,classId,orderedActive){
  const activeSet=new Set(orderedActive.map(s=>s.id));
  const rebuilt=[];
  let inserted=false;
  state.students.forEach(s=>{
    if(activeSet.has(s.id)){
      if(!inserted){
        rebuilt.push(...orderedActive);
        inserted=true;
      }
      return;
    }
    rebuilt.push(s);
  });
  if(!inserted) rebuilt.push(...orderedActive);
  state.students=rebuilt;
}
function swapMoveStudent(grade,classId,dragId,targetId){
  const active=getStudentsOf(grade,classId).filter(s=>!s.isExpelled);
  const from=active.findIndex(s=>s.id===dragId);
  const to=active.findIndex(s=>s.id===targetId);
  if(from<0||to<0||from===to) return;
  const [mv]=active.splice(from,1);
  active.splice(to,0,mv);
  applyClassActiveOrder(grade,classId,active);
}
function bindSwapDragHandlers(grade,classId){
  if(!swapMode) return;
  document.querySelectorAll('.s-card[data-sid]').forEach(card=>{
    card.addEventListener('dragstart',()=>{
      swapDragId=card.dataset.sid;
      card.classList.add('dragging');
    });
    card.addEventListener('dragend',()=>{
      card.classList.remove('dragging');
      document.querySelectorAll('.s-card.drag-over').forEach(el=>el.classList.remove('drag-over'));
      swapDragId=null;
    });
    card.addEventListener('dragover',e=>{
      e.preventDefault();
      if(card.dataset.sid!==swapDragId) card.classList.add('drag-over');
    });
    card.addEventListener('dragleave',()=>card.classList.remove('drag-over'));
    card.addEventListener('drop',e=>{
      e.preventDefault();
      card.classList.remove('drag-over');
      const targetId=card.dataset.sid;
      if(!swapDragId||!targetId||swapDragId===targetId) return;
      swapMoveStudent(grade,classId,swapDragId,targetId);
      renderPage('class',{grade,classId});
    });
  });
}

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
      <button class="btn btn-sm ${swapMode?'btn-gn':''}" onclick="toggleSwapMode(${grade},${classId})">
        ${swapMode?'✓ ':''}入れ替えモード
      </button>
      ${selectMode?`
        <button class="btn btn-sm" onclick="selAll(${grade},${classId})">全選択</button>
        <button class="btn btn-sm" onclick="deselAll(${grade},${classId})">全解除</button>
        <span class="bulk-cnt">${selectedIds.size}名選択中</span>
        <input type="number" class="fi bulk-inp" id="blk-pp" placeholder="PP量" min="0"
               value="${escA(String(bulkPPValue))}"
               oninput="bulkPPValue=this.value" />
        <button class="btn btn-sm btn-ac" onclick="applyBulkGive(${grade},${classId})"><span class="cls-pp-lbl">PP</span>付与</button>
        <button class="btn btn-sm btn-ac" onclick="applyBulkSeize(${grade},${classId})"><span class="cls-pp-lbl">PP</span>剥奪</button>
        <button class="btn btn-sm btn-dn" onclick="confirmBulkDelete(${grade},${classId})">選択した生徒を削除</button>
      `:''}
      ${swapMode?`
        <button class="btn btn-sm btn-ac" onclick="sortByIdSwap(${grade},${classId})">番号ソート</button>
        <button class="btn btn-sm btn-gn" onclick="confirmSwap(${grade},${classId})">決定</button>
      `:''}
    </div>

    <div class="srch-row">
      <input class="fi" id="s-search" placeholder="生徒を検索..." oninput="filterStudents()" />
      <button class="btn btn-sm" onclick="addStudent(${grade},${classId})">＋ 生徒を追加</button>
    </div>

    <div class="s-grid ${selectMode?'sel-mode':''} ${swapMode?'swap-mode':''}" data-swap-grid="1">
      ${renderCards(active,{draggable:swapMode})}
    </div>`;

  if(expl.length){
    h+=`<div class="alt-hdr"><span>退学処分 (${expl.length}名)</span><hr /></div>
        <div class="s-grid">${renderCards(expl,{draggable:false})}</div>`;
  }
  return h;
}

/* s-card renderer */
function renderCards(students,{draggable=false}={}){
  if(!students.length)
    return `<div class="dim" style="grid-column:1/-1;padding:8px;font-size:.7rem">生徒なし</div>`;
  return students.map(s=>{
    const sel=selectedIds.has(s.id), hasPrp=s.protectPoints>0;
    return `
      <div class="s-card ${s.isExpelled?'expelled':''} ${sel?'selected':''}"
           data-name="${escA((s.name||'').toLowerCase())}"
           data-sid="${s.id}"
           ${draggable&&!s.isExpelled?'draggable="true"':''}
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
  if(swapMode) return;
  if(selectMode){
    const inp=document.getElementById('blk-pp');
    if(inp) bulkPPValue=inp.value;
    selectedIds.has(sid)?selectedIds.delete(sid):selectedIds.add(sid);
    const c=navStack[navStack.length-1]; if(c) renderPage(c.page,c.params);
  } else navigate('profile',{sid},false);
};
window.toggleSel=(g,c)=>{
  selectMode=!selectMode;
  if(selectMode) swapMode=false;
  selectedIds=new Set();
  if(!selectMode) bulkPPValue='';
  renderPage('class',{grade:g,classId:c});
};
window.toggleSwapMode=(g,c)=>{
  swapMode=!swapMode;
  if(swapMode){
    selectMode=false;
    selectedIds=new Set();
  }
  renderPage('class',{grade:g,classId:c});
};
window.sortByIdSwap=(g,c)=>{
  const active=getStudentsOf(g,c).filter(s=>!s.isExpelled).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  applyClassActiveOrder(g,c,active);
  renderPage('class',{grade:g,classId:c});
  toast('✓ 番号ソートしました','ok');
};
window.confirmSwap=(g,c)=>{
  swapMode=false;
  saveState(true);
  renderPage('class',{grade:g,classId:c});
  toast('✓ 入れ替えを保存しました','ok');
};
window.selAll=(g,c)=>{
  const inp=document.getElementById('blk-pp'); if(inp) bulkPPValue=inp.value;
  getStudentsOf(g,c).filter(s=>!s.isExpelled).forEach(s=>selectedIds.add(s.id));
  renderPage('class',{grade:g,classId:c});
};
window.deselAll=(g,c)=>{
  const inp=document.getElementById('blk-pp'); if(inp) bulkPPValue=inp.value;
  selectedIds=new Set();
  renderPage('class',{grade:g,classId:c});
};

/* ── PP付与 (give) — keeps selectMode active ── */
window.applyBulkGive=function(grade,classId){
  const inp=document.getElementById('blk-pp');
  if(inp) bulkPPValue=inp.value;
  const amt=parseInt(bulkPPValue);
  if(isNaN(amt)||amt<0){toast('✗ 0以上の数値を入力してください','err');return;}
  if(!selectedIds.size){toast('✗ 生徒が選択されていません','err');return;}
  let n=0; selectedIds.forEach(id=>{const s=state.students.find(x=>x.id===id);if(s){s.privatePoints+=amt;n++;}});
  saveState(true); renderPage('class',{grade,classId});
  toast(`✓ ${n}名に +${amt.toLocaleString()} PP を付与`,'ok');
};

/* ── PP剥奪 (seize) — keeps selectMode active ── */
window.applyBulkSeize=function(grade,classId){
  const inp=document.getElementById('blk-pp');
  if(inp) bulkPPValue=inp.value;
  const amt=parseInt(bulkPPValue);
  if(isNaN(amt)||amt<0){toast('✗ 0以上の数値を入力してください','err');return;}
  if(!selectedIds.size){toast('✗ 生徒が選択されていません','err');return;}
  let n=0; selectedIds.forEach(id=>{
    const s=state.students.find(x=>x.id===id);
    if(s){ s.privatePoints=Math.max(0, s.privatePoints-amt); n++; }
  });
  saveState(true); renderPage('class',{grade,classId});
  toast(`✓ ${n}名から ${amt.toLocaleString()} PP を剥奪`,'warn');
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
  selectedIds=new Set(); selectMode=false; bulkPPValue='';
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
   PROFILE PAGE — v6.5
   • プロフィール header color → var(--t1) via CSS
   • .fr label min-width:96px for flush alignment
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

  const pool=getSchoolRankingPool();
  const ov=calcOverallScoreDetail(s,pool);
  const bars=STATS_KEYS.map(k=>{
    const v=s.stats[k]||1;
    // v7.1: sb-val span removed — numerical value not shown next to stat name
    return `<div class="sb-row">
      <span class="sb-lbl">${JP[k]}</span>
      <div class="sb-track"><div class="sb-fill" style="width:${((v-1)/14)*100}%"></div></div>
      <span class="sb-grade ${statGradeClass(v)}">${statGradeLabel(v)}</span>
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
        <div class="prof-side-hdr">プロフィール</div>
        <hr class="prof-side-sep" />
        <div class="prof-name">${esc(s.name)||'(未記入)'}</div>
        <div class="prof-sid">${s.id}</div>
        <span class="badge ${badgeCls}">${statusLabel}</span>
        <div class="prof-pp ${ppCls}">${s.privatePoints.toLocaleString()}</div>
        <div class="prof-pplbl">${JP.pp}</div>
        <div class="prof-prot${hasProt?' active':''}">
          ${s.protectPoints}<span class="prof-prot-unit"> ${JP.protect}</span>
        </div>
        <table class="info-tbl">
          <tr><td>${JP.gender}</td><td>${s.gender==='M'?JP.male:JP.female}</td></tr>
          <tr><td>${JP.dob}</td><td>${s.dob||'未設定'}</td></tr>
          <tr><td>${JP.grade}</td><td>${gradeDisp}</td></tr>
          <tr><td>${JP.cls}</td><td>${esc(clsDisp)}</td></tr>
        </table>
        <div class="sec-ttl mt8">能力プロフィール</div>
        <div class="sb-grid">${bars}</div>
        <div class="ov-wrap">
          <div class="ov-score-block">
            <div class="ov-score-lbl">総合力</div>
            <div class="ov-score-val">${ov.total}</div>
            <div class="ov-score-sub">/100</div>
          </div>
          <div class="radar-wrap">
            <canvas id="pf-radar-canvas" data-sid="${escA(sid)}" width="220" height="220"></canvas>
          </div>
        </div>
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
          <div class="fr"><label>${JP.protect}</label><input class="fi" id="pf-prot" type="number" value="${s.protectPoints}" min="0" /></div>
        </div>

        <div class="prof-sec">
          <div class="sec-ttl">能力値 (1–15 / D-〜S+)</div>
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

function drawProfileRadar(){
  const canvas=document.getElementById('pf-radar-canvas');
  if(!canvas) return;
  const sid=canvas.dataset.sid;
  const s=state?.students?.find(x=>x.id===sid);
  if(!s) return;

  const ctx=canvas.getContext('2d');
  if(!ctx) return;

  // v7.1: size canvas to its CSS container to prevent overflow
  const wrap=canvas.parentElement;
  const size=wrap
    ? Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight) * 0.96)
    : 180;
  const displaySize=Math.max(120, Math.min(size, 260));
  canvas.width=displaySize;
  canvas.height=displaySize;

  const w=canvas.width, h=canvas.height;
  const cx=w/2, cy=h/2;
  // v7.1: tighter radius so labels don't clip at smaller size
  // v7.7: labelOffset set to exactly r+18 per spec (was r+22 in v7.6)
  const r=Math.min(w,h)*0.32;
  const labelOffset=r+18;

  const vals=STATS_KEYS.map(k=>clampStat(s.stats?.[k]));
  const count=STATS_KEYS.length;
  const step=(Math.PI*2)/count;

  ctx.clearRect(0,0,w,h);

  // Grid rings
  for(let lv=1; lv<=5; lv++){
    const rr=(r*lv)/5;
    ctx.beginPath();
    for(let i=0;i<count;i++){
      const a=-Math.PI/2 + step*i;
      const x=cx+Math.cos(a)*rr;
      const y=cy+Math.sin(a)*rr;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.closePath();
    ctx.strokeStyle='rgba(120,160,190,.28)';
    ctx.lineWidth=1;
    ctx.stroke();
  }

  // Spokes + labels
  const fontSize=Math.max(8, Math.floor(displaySize*0.072));
  for(let i=0;i<count;i++){
    const a=-Math.PI/2 + step*i;
    const x=cx+Math.cos(a)*r;
    const y=cy+Math.sin(a)*r;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.lineTo(x,y);
    ctx.strokeStyle='rgba(120,160,190,.25)';
    ctx.stroke();

    const lx=cx+Math.cos(a)*labelOffset;
    const ly=cy+Math.sin(a)*labelOffset;
    ctx.fillStyle='rgba(190,220,240,.8)';
    ctx.font=`${fontSize}px "Share Tech Mono", monospace`;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    /* v7.6: RADAR_LABELS — suffix-stripped [言語,推論,記憶,思考,身体,精神] */
    ctx.fillText(RADAR_LABELS[i], lx, ly);
  }

  // Data polygon
  ctx.beginPath();
  for(let i=0;i<count;i++){
    const a=-Math.PI/2 + step*i;
    const rr=(vals[i]/15)*r;
    const x=cx+Math.cos(a)*rr;
    const y=cy+Math.sin(a)*rr;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  }
  ctx.closePath();
  ctx.fillStyle='rgba(0,200,255,.25)';
  ctx.strokeStyle='rgba(0,200,255,.9)';
  ctx.lineWidth=2;
  ctx.fill();
  ctx.stroke();
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
   RANKING PAGE — Top 3 Podium + v7 sort expansion
────────────────────────────────────────────────────────────────── */
const RANK_SORT_ITEMS = [
  {key:'pp',        label:'PP'},
  {key:'prp',       label:'PRP'},
  {key:'language',  label:'言語'},
  {key:'reasoning', label:'推論'},
  {key:'memory',    label:'記憶'},
  {key:'thinking',  label:'思考'},
  {key:'physical',  label:'身体'},
  {key:'mental',    label:'精神'},
  {key:'overall',   label:'総合力'},
];
let rankingSortKey='pp';

/* v7.6: incomingCollapsedState — persists open/closed status of each
   incoming cohort accordion panel across re-renders. Key = cohortId
   string (e.g. "inc-7"), value = true means collapsed.
   Populated by toggleCohort; read by renderIncoming to restore state.
   Lives at module level so it survives navigate / renderApp calls.    */
const incomingCollapsedState = new Map();

/* v7.7: graduatesCollapsedState — identical mechanism for the Graduates
   screen. Key = cohortId string (e.g. "Year-3" or "卒業年不明"),
   value = true means collapsed. Populated by toggleCohort (shared
   function); read by renderGraduates to restore state on re-render.  */
const graduatesCollapsedState = new Map();

function rankSortLabel(key){
  const it=RANK_SORT_ITEMS.find(x=>x.key===key);
  return it?it.label:'PP';
}
function rankSortValue(student,key,pool){
  switch(key){
    case 'pp': return student.privatePoints||0;
    case 'prp': return student.protectPoints||0;
    case 'language':
    case 'reasoning':
    case 'memory':
    case 'thinking':
    case 'physical':
    case 'mental': return clampStat(student.stats?.[key]);
    case 'overall': return calcOverallScore(student,pool);
    default: return student.privatePoints||0;
  }
}
function computeRankingBy(key='pp'){
  /* v7.6: active students only — typeof grade === 'number' (grades 1-6),
     non-expelled. Incoming and Graduate are excluded from Top-100.     */
  const pool = state.students.filter(s=>typeof s.grade==='number' && !s.isExpelled);
  const sorted=[...pool].sort((a,b)=>{
    const av=rankSortValue(a,key,pool);
    const bv=rankSortValue(b,key,pool);
    if(bv!==av) return bv-av;
    if((b.privatePoints||0)!==(a.privatePoints||0)) return (b.privatePoints||0)-(a.privatePoints||0);
    return String(a.id).localeCompare(String(b.id));
  });
  const out=[];
  for(let i=0;i<sorted.length&&out.length<TOP_N;i++){
    const cur=rankSortValue(sorted[i],key,pool);
    const prev=i>0?rankSortValue(sorted[i-1],key,pool):null;
    const rank=(i>0&&cur===prev)?out[out.length-1].rank:i+1;
    out.push({rank,student:sorted[i],value:cur});
  }
  return out;
}
window.setRankingSort=function(key){
  rankingSortKey=RANK_SORT_ITEMS.some(x=>x.key===key)?key:'pp';
  renderPage('ranking',{});
};

/* ── v7.3: Ranking page — 11-column table with clickable stat headers ──
   Columns: 順位 | 氏名 | 学年/クラス | PP | PRP | 言語 | 推論 | 記憶 | 思考 | 身体 | 精神 | 総合
   Each stat header is clickable and updates rankingSortKey.
   The active-sort column gets .sort-active on both th and td.
   Mini-bar column is fully removed.
──────────────────────────────────────────────────────────────── */

/* Column definitions — maps to CSS col-* classes and sort keys */
const RNK_COLS = [
  { key:null,        label:'順位',         cls:'col-rank',  thCls:'',        tdCls:'rn',   align:'right'  },
  { key:null,        label:'氏名',         cls:'col-name',  thCls:'th-left', tdCls:'rk-nm td-left', align:'left' },
  { key:null,        label:'学年 / クラス',cls:'col-class', thCls:'th-left', tdCls:'td-left',align:'left' },
  { key:'pp',        label:'PP',           cls:'col-pp',    thCls:'',        tdCls:'rk-pp', align:'right' },
  { key:'prp',       label:'PRP',          cls:'col-prp',   thCls:'',        tdCls:'',      align:'right' },
  { key:'language',  label:'言語',         cls:'col-s0',    thCls:'',        tdCls:'',      align:'right' },
  { key:'reasoning', label:'推論',         cls:'col-s1',    thCls:'',        tdCls:'',      align:'right' },
  { key:'memory',    label:'記憶',         cls:'col-s2',    thCls:'',        tdCls:'',      align:'right' },
  { key:'thinking',  label:'思考',         cls:'col-s3',    thCls:'',        tdCls:'',      align:'right' },
  { key:'physical',  label:'身体',         cls:'col-s4',    thCls:'',        tdCls:'',      align:'right' },
  { key:'mental',    label:'精神',         cls:'col-s5',    thCls:'',        tdCls:'',      align:'right' },
  { key:'overall',   label:'総合',         cls:'col-ov',    thCls:'',        tdCls:'',      align:'right' },
];

function renderRankingPage(){
  const ranked  = computeRankingBy(rankingSortKey);
  /* v7.6: active pool for overall score must match computeRankingBy filter */
  const pool    = state.students.filter(s=>typeof s.grade==='number' && !s.isExpelled);
  const medals  = ['🥇','🥈','🥉'];
  const valLabel = rankSortLabel(rankingSortKey);

  let h=`
    <button class="back-btn" onclick="goBack()">◀ 戻る</button>
    <div class="pg-hdr">
      <span class="pg-title">🏆 ${JP.ranking} TOP ${TOP_N}</span>
      <span class="pg-sub">並び替え: ${valLabel}（降順）</span>
    </div>`;

  /* ── Podium: TOP 3 ── */
  if(ranked.length){
    h+=`<div class="medal-row">`;
    ranked.slice(0,Math.min(3,ranked.length)).forEach(({rank,student:s,value},i)=>{
      const gd=typeof s.grade==='number'?JP.gradeN(s.grade):(s.grade==='Graduate'?'卒業生':'入学予定');
      const cd=typeof s.grade==='number'?clsName(s.grade,s.classId):'―';
      h+=`
        <div class="medal-card" style="cursor:pointer" onclick="navigate('profile',{sid:'${s.id}'},false)">
          <div class="medal-rnk">${medals[i]} 第${rank}位</div>
          <div class="medal-name">${esc(s.name)||'(未記入)'}</div>
          <div class="medal-sub">${gd} &nbsp;${esc(cd)}</div>
          <div class="medal-pp">${Number.isInteger(value)?value.toLocaleString():value} ${valLabel}</div>
        </div>`;
    });
    h+=`</div>`;
  }

  /* ── colgroup ── */
  const colgroup = RNK_COLS.map(c=>`<col class="${c.cls}" />`).join('');

  /* ── thead — clickable stat headers ── */
  const thead = RNK_COLS.map(c=>{
    const isActive = c.key && c.key===rankingSortKey;
    const arrow    = c.key ? `<span class="sort-arrow">${isActive?'▼':' '}</span>` : '';
    const activeCs = isActive ? ' sort-active' : '';
    const thCls    = [c.thCls, activeCs].filter(Boolean).join(' ');
    const onClick  = c.key ? `onclick="setRankingSort('${c.key}')"` : '';
    return `<th class="${thCls}" ${onClick}>${c.label}${arrow}</th>`;
  }).join('');

  h+=`
    <div class="rnk-wrap" style="margin-top:10px">
      <table class="rnk-tbl">
        <colgroup>${colgroup}</colgroup>
        <thead><tr>${thead}</tr></thead>
        <tbody>`;

  if(!ranked.length){
    h+=`<tr><td colspan="${RNK_COLS.length}" style="text-align:center;padding:20px;color:var(--t3)">データなし</td></tr>`;
  }

  ranked.forEach(({rank,student:s,value})=>{
    const gd  = typeof s.grade==='number'?JP.gradeN(s.grade):(s.grade==='Graduate'?'卒業生':'入学予定');
    const cd  = typeof s.grade==='number'?clsName(s.grade,s.classId):'―';
    const ov  = calcOverallScore(s, pool);
    const top3 = rank<=3 ? ' top3' : '';

    /* Per-stat value helper — returns formatted string */
    const sv = key => {
      switch(key){
        case 'pp':       return (s.privatePoints||0).toLocaleString();
        case 'prp':      return String(s.protectPoints||0);
        case 'language': return String(clampStat(s.stats?.language));
        case 'reasoning':return String(clampStat(s.stats?.reasoning));
        case 'memory':   return String(clampStat(s.stats?.memory));
        case 'thinking': return String(clampStat(s.stats?.thinking));
        case 'physical': return String(clampStat(s.stats?.physical));
        case 'mental':   return String(clampStat(s.stats?.mental));
        case 'overall':  return String(ov);
        default: return '';
      }
    };

    /* Build tds from RNK_COLS definition */
    const tds = RNK_COLS.map(c=>{
      const isActive = c.key && c.key===rankingSortKey;
      const activeCls = isActive ? ' stat-active' : '';
      switch(c.cls){
        case 'col-rank':
          /* .rn already carries Orbitron; no extra class needed */
          return `<td class="rn${top3}">${rank}</td>`;
        case 'col-name':
          return `<td class="rk-nm td-left${activeCls}" onclick="navigate('profile',{sid:'${s.id}'},false)">${esc(s.name)||'<span class="dim">(未記入)</span>'}</td>`;
        case 'col-class':
          return `<td class="td-left${activeCls}" style="font-size:.68rem;color:var(--t1)">${gd} / ${esc(cd)}</td>`;
        default:{
          /* v7.7: all numeric data cols get rk-num (Orbitron via CSS).
             PP column additionally gets rk-pp for its green colour.   */
          const base = (c.tdCls||'').trim();
          const cls  = base ? `${base} rk-num${activeCls}` : `rk-num${activeCls}`;
          return `<td class="${cls}">${sv(c.key)}</td>`;
        }
      }
    }).join('');

    h+=`<tr>${tds}</tr>`;
  });

  h+=`</tbody></table></div>`;
  return h;
}

/* ──────────────────────────────────────────────────────────────────
   CLASS RANKING PAGE
────────────────────────────────────────────────────────────────── */
function renderClassRankingPage(){
  const clsRanked=computeClassRanking();
  const medals=['🥇','🥈','🥉'];

  const rows=[];
  let lastCP=null, lastRank=1;
  clsRanked.forEach((cls,i)=>{
    const rank=(i===0)?1:(cls.classPoints===lastCP?lastRank:i+1);
    lastCP=cls.classPoints; lastRank=rank;
    rows.push({rank,cls});
  });

  let h=`
    <button class="back-btn" onclick="goBack()">◀ 戻る</button>
    <div class="pg-hdr">
      <span class="pg-title">🏫 クラスランキング</span>
      <span class="pg-sub">全30クラス CP降順 · 同CP=同順位</span>
    </div>`;

  if(rows.length){
    h+=`<div class="medal-row">`;
    rows.slice(0,Math.min(3,rows.length)).forEach(({rank,cls},i)=>{
      const nm=clsName(cls.grade,cls.classId);
      const rnk=rankOf(cls.grade,cls.classId);
      h+=`
        <div class="medal-card">
          <div class="medal-rnk">${medals[i]} 第${rank}位</div>
          <div class="medal-name" style="font-family:var(--fj)">${esc(nm)}</div>
          <div style="font-size:.67rem;color:var(--t2);margin-bottom:2px">${JP.gradeN(cls.grade)} &nbsp;<span class="r${rnk}" style="font-family:var(--fd);font-weight:700">${rnk}組</span></div>
          <div class="medal-pp">${cls.classPoints.toLocaleString()} CP</div>
        </div>`;
    });
    h+=`</div>`;
  }

  h+=`
    <div class="rnk-wrap" style="margin-top:10px">
      <table class="cls-rnk-tbl">
        <thead><tr>
          <th style="text-align:right;min-width:44px">順位</th>
          <th>クラス名</th>
          <th>学年</th>
          <th>クラス内順位</th>
          <th style="text-align:right">CP</th>
        </tr></thead>
        <tbody>`;
  if(!rows.length){
    h+=`<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--t3)">データなし</td></tr>`;
  }
  rows.forEach(({rank,cls})=>{
    const nm=clsName(cls.grade,cls.classId);
    const rnk=rankOf(cls.grade,cls.classId);
    h+=`<tr>
      <td class="rn ${rank<=3?'top3':''}">${rank}</td>
      <td class="rk-nm" onclick="navigate('class',{grade:${cls.grade},classId:${cls.classId}},false)">${esc(nm)}</td>
      <td style="font-size:.7rem;color:var(--t1)">${JP.gradeN(cls.grade)}</td>
      <td><span class="r${rnk}" style="font-family:var(--fd);font-size:.8rem;font-weight:700">${rnk}</span></td>
      <td class="rk-cp">${cls.classPoints.toLocaleString()}</td>
    </tr>`;
  });
  h+=`</tbody></table></div>`;
  return h;
}

/* ──────────────────────────────────────────────────────────────────
   SPECIAL PAGES (Graduates / Incoming) — v7.4
────────────────────────────────────────────────────────────────── */
function renderSpecial(gradeType){
  return gradeType==='Graduate' ? renderGraduates() : renderIncoming();
}

/* ── Graduates — archived by original grade-year cohort ─────── */
function renderGraduates(){
  const sts=state.students.filter(s=>s.grade==='Graduate');
  /* Group by graduateYear (set at time of graduation) or by ID prefix cohort */
  const byYear={};
  sts.forEach(s=>{
    /* graduateYear: set when student graduated (year they left grade 6).
       Fall back to 'Unknown' if not set (legacy data).               */
    const yrKey = typeof s.graduateYear==='number' ? `Year ${s.graduateYear}` : '卒業年不明';
    if(!byYear[yrKey]) byYear[yrKey]=[];
    byYear[yrKey].push(s);
  });
  const sortedYears=Object.keys(byYear).sort((a,b)=>{
    const na=parseInt(a.replace('Year ','')),nb=parseInt(b.replace('Year ',''));
    if(isNaN(na)) return 1;
    if(isNaN(nb)) return -1;
    return nb-na; // most recent first
  });

  let h=`
    <button class="back-btn" onclick="goBack()">◀ 戻る</button>
    <div class="pg-hdr">
      <span class="pg-title" style="color:var(--yw)">${JP.graduates}</span>
      <span class="pg-sub">${sts.length}名 · ${sortedYears.length}期</span>
    </div>
    <div class="srch-row">
      <input class="fi" id="s-search" placeholder="卒業生を検索..." oninput="filterStudents()" />
    </div>`;

  if(!sts.length){
    h+=`<div class="sp-empty-note">卒業生はいません。</div>`;
    return h;
  }

  sortedYears.forEach(yrKey=>{
    const cohort=byYear[yrKey];
    const cohortId=yrKey.replace(/\s+/g,'-');

    /* v7.7: restore collapsed state from persistent Map.
       Default is OPEN (not collapsed) for new/unseen cohorts.      */
    const isCollapsed = graduatesCollapsedState.get(cohortId) === true;
    const bodyClass   = isCollapsed
      ? 'cohort-body s-grid cohort-collapsed'
      : 'cohort-body s-grid';
    const arrowChar   = isCollapsed ? '▶' : '▼';

    h+=`
      <div class="cohort-block" id="cohort-${cohortId}">
        <div class="cohort-hdr" onclick="toggleCohort('${cohortId}')">
          <span class="cohort-yr">${yrKey} 卒業</span>
          <span class="cohort-cnt">${cohort.length}名</span>
          <span class="cohort-arrow">${arrowChar}</span>
        </div>
        <div class="${bodyClass}" id="cohort-body-${cohortId}" onclick="event.stopPropagation()">`;
    cohort.forEach(s=>{
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
    h+=`</div></div>`;
  });
  return h;
}
window.toggleCohort=function(id){
  const body =document.getElementById('cohort-body-'+id);
  const block=document.getElementById('cohort-'+id);
  if(!body||!block) return;
  const isOpen = !body.classList.contains('cohort-collapsed');
  /* isOpen=true means it IS open now → user clicked to CLOSE it */
  body.classList.toggle('cohort-collapsed', isOpen);
  const arrow = block.querySelector('.cohort-arrow');
  if(arrow) arrow.textContent = isOpen ? '▶' : '▼';
  /* v7.7: route to the correct persistence Map by ID prefix.
     Incoming cohort IDs are "inc-N"; graduate cohort IDs are
     "Year-N" or "卒業年不明". Both Maps use true = collapsed. */
  if(id.startsWith('inc-')){
    incomingCollapsedState.set(id, isOpen);
  } else {
    graduatesCollapsedState.set(id, isOpen);
  }
};

/* ── Incoming — grouped by cohort grade, with Create/Delete ── */
function renderIncoming(){
  const cohorts=getIncomingCohorts();
  const allIncoming=state.students.filter(s=>s.grade==='Incoming');
  const nextGrade=nextIncomingCohortGrade();

  let h=`
    <button class="back-btn" onclick="goBack()">◀ 戻る</button>
    <div class="pg-hdr">
      <span class="pg-title" style="color:var(--ac)">${JP.incoming2}</span>
      <span class="pg-sub">${allIncoming.length}名 · ${cohorts.length}コホート</span>
    </div>
    <div class="srch-row">
      <input class="fi" id="s-search" placeholder="入学予定者を検索..." oninput="filterStudents()" />
      <button class="btn btn-ac" onclick="createIncomingCohort()"
              title="第${nextGrade}期 200名を新規作成">＋ 入学コホート作成 (第${nextGrade}期)</button>
    </div>`;

  if(!cohorts.length){
    h+=`<div class="sp-empty-note">入学予定者はいません。<br>「＋ 入学コホート作成」で新しい期を生成できます。</div>`;
    return h;
  }

  cohorts.forEach(cg=>{
    const cohortStudents=allIncoming.filter(s=>s.cohortGrade===cg);
    const cohortId=`inc-${cg}`;
    const classGroups={};
    CLASS_IDS.forEach(cid=>{classGroups[cid]=cohortStudents.filter(s=>s.classId===cid);});

    /* v7.6: restore collapsed state from persistent Map.
       Default is OPEN (not collapsed) for newly created cohorts.  */
    const isCollapsed = incomingCollapsedState.get(cohortId) === true;
    const bodyClass   = isCollapsed ? 'cohort-body cohort-collapsed' : 'cohort-body';
    const arrowChar   = isCollapsed ? '▶' : '▼';

    h+=`
      <div class="cohort-block" id="cohort-${cohortId}">
        <div class="cohort-hdr" onclick="toggleCohort('${cohortId}')">
          <span class="cohort-yr" style="color:var(--ac)">入学予定 第${cg}期</span>
          <span class="cohort-cnt">${cohortStudents.length}名 · 5クラス</span>
          <button class="cohort-rnd-btn" onclick="event.stopPropagation();randomizeIncomingCohort(${cg})"
                  title="第${cg}期 全生徒をランダム生成">ランダム生成</button>
          <button class="cohort-del-btn" onclick="event.stopPropagation();deleteIncomingCohort(${cg})"
                  title="この期を削除">削除</button>
          <span class="cohort-arrow">${arrowChar}</span>
        </div>
        <div class="${bodyClass}" id="cohort-body-${cohortId}" onclick="event.stopPropagation()">`;

    /* Per-class sub-groups */
    CLASS_IDS.forEach(cid=>{
      const clsSts=classGroups[cid];
      const rankLabel=RANK_LABELS[cid]||'?';
      h+=`
          <div class="inc-cls-block">
            <div class="inc-cls-hdr">
              <span class="r${rankLabel}" style="font-family:var(--fd);font-weight:700;font-size:.8rem">${rankLabel}組</span>
              <span style="color:var(--t1);font-size:.7rem">${clsSts.length}名</span>
            </div>
            <div class="s-grid">`;
      if(!clsSts.length){
        h+=`<div class="dim" style="grid-column:1/-1;padding:10px;font-size:.7rem">生徒なし</div>`;
      } else {
        clsSts.forEach(s=>{
          h+=`
              <div class="s-card"
                   data-name="${escA(s.name.toLowerCase())}"
                   onclick="navigate('profile',{sid:'${s.id}'},false)">
                <div class="s-top-left">
                  <span class="s-sid">${s.id}</span>
                  <span class="s-gender">${s.gender==='M'?JP.male:JP.female}</span>
                </div>
                <div class="s-top-right"></div>
                <div class="s-bot-left">
                  <div class="s-name">${esc(s.name)||'<span class="dim">(未記入)</span>'}</div>
                </div>
                <div class="s-bot-right">
                  <span class="s-pp-val ${ppCol(s.privatePoints)}">${fmtPP(s.privatePoints)}<span class="s-pp-unit">PP</span></span>
                </div>
              </div>`;
        });
      }
      h+=`</div></div>`;
    });

    h+=`</div></div>`;
  });
  return h;
}

/* Legacy single-student add — kept for backward compat */
window.addIncoming=function(){
  const cg=nextIncomingCohortGrade();
  const pfx=String(cg).padStart(3,'0');
  const existingSeqs=state.students
    .filter(s=>s.grade==='Incoming'&&s.id?.startsWith(pfx))
    .map(s=>parseInt(s.id.slice(-4),10)).filter(n=>!isNaN(n));
  let seq=(existingSeqs.length?Math.max(...existingSeqs):0)+1;
  const id=pfx+String(seq).padStart(4,'0');
  const stats=Object.fromEntries(STATS_KEYS.map(k=>[k,1]));
  const s={id,name:'',gender:'M',dob:'',grade:'Incoming',cohortGrade:cg,
           classId:0,stats,specialAbility:'',privatePoints:0,protectPoints:0,
           contracts:[],isExpelled:false};
  state.students.push(s);
  saveState(true); renderApp(); toast('✓ 入学予定を追加しました: '+id,'ok');
};

/* ──────────────────────────────────────────────────────────────────
   CUSTOM UI CONFIRM / ALERT — v7.3
   Replaces window.confirm and window.alert throughout the app.

   uiConfirm({
     title   : string,               — modal header text
     body    : string (HTML allowed),— modal body text
     variant : 'info'|'warn'|'danger', — colour scheme
     okLabel : string,               — confirm button label
     cancelLabel? : string,          — cancel button label (omit to hide)
     onOk    : function,             — called when OK is pressed
     onCancel? : function,           — called when Cancel / X is pressed
   });

   uiAlert({ title, body, variant, okLabel }) — confirm-only variant
────────────────────────────────────────────────────────────────── */
function uiConfirm({title='確認',body='',variant='info',okLabel='確認',cancelLabel='キャンセル',onOk,onCancel}={}){
  const box   = document.getElementById('uic-box');
  const ov    = document.getElementById('uic-overlay');
  const ttl   = document.getElementById('uic-title-el');
  const bdy   = document.getElementById('uic-body');
  const btnOk = document.getElementById('uic-btn-ok');
  const btnCn = document.getElementById('uic-btn-cancel');
  if(!box||!ov||!ttl||!bdy||!btnOk||!btnCn) return;

  /* Apply variant */
  box.className = variant==='danger'?'uic-danger':variant==='warn'?'uic-warn':'';
  ttl.textContent = title;
  bdy.innerHTML   = body;
  btnOk.textContent = okLabel;

  if(cancelLabel){
    btnCn.textContent = cancelLabel;
    btnCn.style.display = '';
  }else{
    btnCn.style.display = 'none';
  }

  /* Wire up one-shot listeners */
  const close=(accept)=>{
    ov.classList.add('hidden');
    btnOk.onclick = null;
    btnCn.onclick = null;
    if(accept && typeof onOk==='function')     onOk();
    if(!accept && typeof onCancel==='function') onCancel();
  };
  btnOk.onclick = ()=>close(true);
  btnCn.onclick = ()=>close(false);

  ov.classList.remove('hidden');
}

function uiAlert({title='通知',body='',variant='info',okLabel='OK'}={}){
  uiConfirm({title,body,variant,okLabel,cancelLabel:null});
}


function openModal(html){
  document.getElementById('modal-body').innerHTML=html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
window.closeModal=function(){ document.getElementById('modal-overlay').classList.add('hidden'); };

/* ──────────────────────────────────────────────────────────────────
   POST-RENDER
────────────────────────────────────────────────────────────────── */
function afterRender(){
  const ta=document.getElementById('pf-sa'), ct=document.getElementById('sa-ct');
  if(ta&&ct) ta.addEventListener('input',()=>{ ct.textContent=ta.value.length+'/300'; });

  const cur=navStack[navStack.length-1];
  if(cur?.page==='profile'){
    drawProfileRadar();
  }
  if(cur?.page==='class' && swapMode){
    bindSwapDragHandlers(cur.params.grade,cur.params.classId);
  }
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
  navigate('home',{},true);
}

if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded', boot);
else
  boot();
