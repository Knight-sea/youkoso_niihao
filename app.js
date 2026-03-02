/* ================================================================
   Cote-OS v8.9  ·  app.js  "Save System Overhaul"
   ─────────────────────────────────────────────────────────────────
   v8.9 バグ修正 (6件):
   [1] 最重大: proto_bundle.js がブラウザで動作せず圧縮ゼロ問題
       → index.html にインライン GameSave スキーマ定義を追加。
         全セーブが正しく Protobuf バイナリ圧縮されるようになった。
   [2] 他スロットへのセーブ後「空き」→「データあり」が反映されない
       → saveState() に syncSlModalButtons() 呼び出しを追加。
   [3] 書き出しファイル読み込みで slSelectedSlot が無視される
       → 書き出しを「選択スロット単体」に変更。
         読み込みも選択スロットのみを対象とする単一スロット読み込みに変更。
         全スロットバックアップ/復元は別途「全バックアップ」ボタンへ。
   [4] 非同期競合によるスロット番号ズレ (「スロット3保存→スロット2に入る」等)
       → saveToSelectedSlot の uiConfirm callback でスロット番号を
         ローカル変数 n に固定してキャプチャ済み (再確認・問題なし)。
         ゲストモード保存パスの currentSlot 一時書換競合を修正。
   [5] 同アカウント別端末でクラウドデータが紐付かない
       → savedAt タイムスタンプ比較でクラウドが新しければ上書き。
         クラウド復元データを JSON ではなく binary+meta で保存。
   [6] loadSlot() 内で Protobuf を二重デコードするパフォーマンス問題
       → meta sidecar が存在する場合は二回目のデコードをスキップ。
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

/* ── v7.8: Special Trait catalogue — 30 traits in 6 categories ────
   cat key maps directly to CSS .tc-{cat} classes on tags and chips.
   Sensory has 5 items (not 6) per spec; all others have 6.         */
const SPECIAL_TRAITS = [
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
];

/* Category display metadata — ordered for the accordion */
/* v8.0: TRAIT_CATEGORIES — labels fully localized to Japanese */
/* v8.1: 'custom' category added for user-created traits (always last) */
const TRAIT_CATEGORIES = [
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
const traitCategoryCollapsedState = new Map();
/* v8.3: contractAccCollapsedState — persists open/closed state of the
   two contract accordion panels: 'issue' and 'confirm'.
   Default: issue open, confirm open. */
const contractAccCollapsedState = new Map([['issue',false],['confirm',false]]);
const HISTORY_MAX = 120;
const NUM_SLOTS   = 12;
const TOP_N       = 100;
const APP_VER     = '8.9';
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
/* ── v8.1: SURNAMES — split into MAJOR (common) and RARE groups
   Total count ≈ 1.5× v8.0. Selection: 2:1 weighted — Major is
   picked 2 out of 3 times, Rare 1 out of 3 times.             */
const SURNAMES_MAJOR = [
  /* Top-60 ultra-common Japanese surnames */
  "佐藤","鈴木","高橋","田中","渡辺","伊藤","山本","中村","小林","加藤",
  "吉田","山田","佐々木","山口","松本","井上","木村","林","斎藤","清水",
  "山崎","池田","橋本","阿部","森","石川","前田","藤田","小川","岡田",
  "後藤","長谷川","石井","村上","近藤","坂本","遠藤","青木","藤井","西村",
  "福田","太田","三浦","岡本","松田","中島","中川","原田","小野","竹内",
  "金子","和田","中野","藤原","村田","上田","横山","宮崎","谷口","大野",
  /* Next-60 very common */
  "高木","宮本","久保","松井","内田","工藤","野口","杉山","吉川","菊地",
  "千葉","大塚","平野","市川","成田","須藤","杉本","片山","土屋","川口",
  "米田","菅原","服部","河野","中山","石田","丸山","松尾","今井","河合",
  "藤本","田村","安藤","永田","古川","石原","長田","武田","岩田","水野",
  "沢田","中井","福島","辻","大西","浜田","西田","松岡","北村","相沢",
  "桑原","黒田","新井","宮田","山内","堀","野田","菅野","川上","榎本",
  /* Common-60 */
  "大島","飯田","岸","南","上野","泉","田口","高田","白石","大谷",
  "西山","西川","神田","岡崎","五十嵐","野中","松浦","伏見","川村","徳田",
  "橘","東","新谷","滝沢","津田","波多野","志村","根本","関口","瀬戸",
  "神谷","保坂","奥田","深沢","二宮","三好","品川","八木","上原","奥村",
  "小山","吉原","本田","長嶋","平田","橋爪","荒木","久米","下村","横田",
  "片岡","尾崎","角田","内山","和泉","三宅","萩原","立花","荒井","入江",
  /* Extended-60 */
  "羽田","久野","清田","曽根","湯浅","西本","宮下","矢野","平井","吉野",
  "細川","木下","杉田","高山","田畑","丸岡","竹田","飯島","上杉","小松",
  "秋山","笠原","大石","島村","奥山","古屋","長野","酒井","桑田","富田",
  "浅野","真田","岩崎","稲垣","浜口","松下","樋口","野村","椎名","石黒",
  "市原","藤沢","嶋田","水口","池上","宇野","城戸","西岡","飯塚","泉谷",
  "赤坂","角谷","別府","深田","玉置","松永","宮島","向井","大倉","赤井",
];

const SURNAMES_RARE = [
  /* Rare batch A */
  "浜崎","戸田","国分","竹山","黒沢","川崎","宮地","福井","東野","稲田",
  "今村","小泉","松村","西澤","篠田","富山","津川","北島","澤田","坂口",
  "塚田","富永","安部","矢口","天野","萩野","中本","福本","笹田","尾野",
  "平松","野上","内海","横尾","手塚","岡部","石倉","杉浦","板垣","蒲田",
  "奥野","永井","古賀","渡部","川端","柳澤","岩本","沢村","三上","長沢",
  "大村","千田","坂田","幸田","大沼","今泉","竹中","橋口","薄田","塩谷",
  /* Rare batch B */
  "大久保","香西","児玉","高村","折戸","末廣","光永","住田","蒔田","村瀬",
  "横路","田代","中尾","仁村","荒川","小倉","御手洗","石坂","上島","田原",
  "藪田","宇佐美","川畑","宮内","白川","高岡","太刀川","三谷","近松","藤川",
  "成瀬","福永","宮里","有村","久田","根岸","長尾","岸本","下田","牧野",
  "植田","伊勢","千田","西廣","山室","佐田","竹腰","恩田","笠間","大橋",
  "遠山","石部","牛島","石丸","神崎","浅川","中谷","小澤","宮沢","田嶋",
  /* Rare batch C */
  "川本","鏡","伊原","前原","山地","塩田","国本","長井","江川","佐古",
  "赤羽","森口","桂","細野","石橋","外山","長浜","宇田","浅田","玉田",
  "岩瀬","藤野","仲田","清野","境","矢吹","杉野","荒城","大川","渡里",
  "曲木","安田","川田","岩井","堀口","末松","塚本","増田","中西","西尾",
  "大森","吉村","橋田","野澤","向山","平尾","田所","木原","坂上","原島",
  "神山","峯岸","田辺","松島","草間","久保田","日比野","杉原","村松","小池",
  /* Rare batch D */
  "永野","森山","白井","奥平","野沢","梅田","谷川","沼田","大城","森本",
  "今田","岡島","横川","春日","北野","土井","坂井","毛利","川岸","村井",
  "島津","本多","山岸","里見","内藤","広瀬","立川","根来","丹野","猪股",
  "菅井","柿沼","飯野","浦田","染谷","阿久津","角井","松葉","深見","加賀",
  "中田","西沢","大曽根","戸塚","相川","池谷","松波","永峰","葛城","大野木",
  "中筋","石山","高野","宇川","角野","中嶋","武内","牛山","荒田","岡林",
  /* Rare batch E */
  "東出","浅沼","古田","増山","枝川","川野","大庭","西島","矢田","梅野",
  "坂野","折戸","道上","秋田","糸井","梶田","瀬川","橋部","穂積","長岡",
  "丸田","村岡","林田","田島","下山","本橋","田尻","筒井","尾上","栗田",
  "広田","里中","光安","海老名","浜名","富岡","津島","有田","牧田","嶋崎",
  "城山","楠田","由良","竹下","石飛","宮城","小野寺","沓掛","赤塚","北川",
  "今立","鈴原","由比","宮古","中道","宇山","村里","岩本","田城","神保",
  /* Rare batch F */
  "兒玉","石崎","奥島","猿渡","浜松","吉岡","渋谷","加納","筒本","藤浦",
  "矢代","東坂","田主","森浦","塩川","丹羽","栗林","平塚","東川","舘野",
  "仙田","里路","光田","福地","宮岡","浦野","阿藤","竹上","橋立","中浜",
  "東原","野原","夏目","水谷","鹿島","土橋","柴田","早川","尾形","岩見",
  "玉木","高岸","水島","八島","細田","大里","川北","正木","本庄","鈴江",
  "真壁","磯野","吉浦","原坂","谷本","木佐","熊本","石塚","加茂","柚原",
  /* Rare batch G */
  "野々村","太田野","蛭田","成島","中市","稲葉","金森","内藤","末田","梅原",
  "柳田","出口","樋田","尾本","渋野","有泉","荒居","本間","佐治","平原",
  "宮腰","上条","黒須","小浜","安達","北岡","三橋","戸次","清重","米澤",
  "岩澤","川本","桑名","細谷","谷野","上西","大沢","西垣","水上","竹島",
  "伊庭","小名木","三枝","堀田","和賀","大矢","熊坂","西坂","高巻","千葉",
  "柏木","石元","吉松","森崎","古澤","末吉","林口","大和田","嶺岸","曲木",
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
  /* Extended batch D */
  "拓斗","蒼空","陽介","和真","勇人","光輝","晴也","颯士","永翔","柊平",
  "悠真","大樹","一颯","拓磨","秀斗","凜士","真登","海渡","壮士","颯輝",
  "暁斗","紘太","隆斗","陽斗","蒼介","哉太","宙斗","唯翔","倫太","響士",
  "渉人","光晴","章人","航斗","真咲","駿人","敬太","昌輝","篤人","慶太",
  "孝輝","雅斗","祐人","和輝","寛太","大晴","弘毅","成海","凛之介","翔斗",
  "陽輝","海晴","遼斗","廉太","純也","透","正輝","逸人","亮人","桐斗",
  "真輝","奏也","稔","了","力斗","太晴","天翔","大晴","晃人","崚太",
  "一翔","勝斗","汐","悠也","貫太","歩武","清太","颯斗","透暉","旺太",
  "文輝","博人","勘太","正也","研人","一志","元気","望","瑞希","良一",
  "守人","武典","亨","寿斗","勝利","和平","泰己","孝人","定","進",
  "勇也","直輝","忠道","武平","雄輝","達郎","忠孝","和斗","盛人","尚輝",
  "国雄","義己","博","勝輝","秀人","剛志","正道","公一","成斗","英輝",
  "輝之介","渚人","空翔","幸輝","永史","湊人","颯大","海人","勢人","光一",
  "澄空","陸翔","耀","一太朗","陽道","蒼汰郎","麻斗","翼人","皓","凛大",
  "晴輝","理玖","暖斗","碧翔","燦","雅輝","蒼大","光男","和彦","健司",
  "誠輝","知輝","宏平","隼士","純輝","翔輝","弦輝","孝司","文也","亮斗",
  /* Extended batch E */
  "泰雄","武晴","壱","凛翔","新太","友輝","翔太郎","日向人","颯矢","空人",
  "岳翔","湊斗","璃久","宙人","陽晴","真海","光明","恵輝","賢太","聖輝",
  "春輝","創","永輝","悠暉","藍斗","祥太","宜斗","柊人","士朗","世斗",
  "颯一","凌斗","竜平","輝彦","光道","義樹","誠斗","守輝","武輝","貴司",
  "広輝","信人","建人","朗","創太","凱人","羅偉","力翔","海慶","夢人",
  "暁人","聡人","巧斗","陽祐","明人","幸斗","太智","万人","透也","純平",
  "実輝","剣斗","煌輝","颯彦","蒼輝","永也","信輝","岳人","剣翔","湊輝",
  "武蔵斗","大道","長輝","理斗","翔夢","光士","大空","奏輝","勝太","一輝",
  "翔人","亘輝","春斗","義輝","健道","秀輝","渉輝","真道","剛輝","直斗",
  "真輝斗","澄人","祐輝","敏人","紳太","大翔","勇翔","雄人","博輝","翔祐",
  "幸平","朋輝","宙斗","天輝","勇真","英人","和道","颯聖","仁輝","光翔",
  "星輝","弘輝","礼斗","心輝","響輝","実斗","澪輝","誠翔","翼斗","啓輝",
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
  /* Extended batch D */
  "結愛","心結","陽菜","美桜","凛花","紗希","柚花","莉愛","琴葉","日菜",
  "陽花","心咲","美羽","柚月","莉花","花恵","瑞希","彩希","優菜","七海",
  "芽衣","さくら","ゆな","みお","まりん","かえで","すずな","ことね","あかね","ひまり",
  "つばき","こはる","のぞみ","あやか","まいか","みく","いろは","ことは","りおな","さな",
  "はるな","ゆみ","ともか","みほ","なつき","あおい","かほ","れな","えみ","しおり",
  "愛花","美穂","香奈恵","由衣","千恵","静","佳代","直子","典子","美代",
  "春花","夏花","秋花","冬花","光花","陽花","風花","雨花","雪花","水花",
  "桃菜","桃音","桃乃","桃香","桃愛","桃実","桃希","桃美","桃奈","桃花",
  "朱音","朱菜","朱乃","朱香","朱美","朱奈","朱花","朱実","朱希","朱愛",
  "碧菜","碧音","碧乃","碧香","碧愛","碧実","碧希","碧美","碧奈","碧花",
  "珠菜","珠音","珠乃","珠香","珠愛","珠実","珠希","珠美","珠奈","珠花",
  "つむぎ","みなみ","ゆいな","かのん","りこ","まな","ひなた","あんな","さき","めい",
  "らん","えな","るな","ちひろ","みりん","のん","ねね","ここ","ももか","はな",
  "さつき","うみ","そら","にこ","みつき","かんな","なな","ゆき","きわ","もも",
  "和歌","美和","真子","明子","恵子","節子","幸子","雪子","文子","道子",
  /* Extended batch E */
  "彩夢","詩音","緋奈","澄花","晴佳","望","汐里","羽菜","芳","翠奈",
  "空乃","夢叶","陽毬","花帆","綺羅","泉奈","霞","真珠","白雪","紫",
  "柊菜","柊音","柊乃","柊香","柊花","柊愛","柊実","柊希","柊美","柊奈",
  "椿菜","椿音","椿乃","椿香","椿花","椿愛","椿実","椿希","椿美","椿奈",
  "芙蓉","葵花","向日葵","夾竹桃","金木犀","百合花","桔梗","彼岸花","竜胆","牡丹",
  "麻友","由香里","美佐子","智恵","亜希子","裕子","順子","寿美","芳恵","光恵",
  "美々","花々","鈴々","音々","咲々","彩々","華々","星々","雪々","月々",
  "莉沙","愛沙","彩沙","詩沙","琴沙","香沙","花沙","夢沙","光沙","空沙",
  "菜々美","咲々美","花々美","愛々美","星々美","雪々美","月々美","音々美","鈴々美","光々美",
  "悠花","悠菜","悠音","悠乃","悠香","悠美","悠奈","悠愛","悠実","悠希",
  "彩花","彩音","彩菜","彩乃","彩香","彩奈","彩実","彩希","彩美","彩愛",
  "晴花","晴音","晴菜","晴乃","晴香","晴奈","晴実","晴希","晴美","晴愛",
  "澪花","澪音","澪菜","澪乃","澪香","澪奈","澪実","澪希","澪美","澪愛",
];

const CLASS_STAT_CFG = {
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
const XSUM_CFG = {
  0: { xMin:30, xMax:48, xMean:40, sMin:5, sMax:8  }, /* Class A: 5–8  */
  1: { xMin:30, xMax:42, xMean:37, sMin:5, sMax:7  }, /* Class B: 5–7  */
  2: { xMin:24, xMax:42, xMean:34, sMin:4, sMax:7  }, /* Class C: 4–7  */
  3: { xMin:24, xMax:36, xMean:31, sMin:4, sMax:6  }, /* Class D: 4–6  */
  4: { xMin:12, xMax:48, xMean:28, sMin:2, sMax:8  }, /* Class E: 2–8  */
};

/* v8.1: binomialSample — approximate a binomial-shaped value in [lo, hi]
   centred near mean. Uses sum of 12 uniform [0,1] samples (CLT) scaled
   to the desired range, then clamps. n=12 gives excellent bell shape.  */
function binomialSample(lo, hi, mean){
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
function genStatXSum(cid){
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

const PP_RANGE = {
  0:[50000,100000], 1:[30000,80000], 2:[20000,60000],
  3:[10000,50000],  4:[0,50000],
};

function rndInt(lo,hi){ return Math.floor(Math.random()*(hi-lo+1))+lo; }
function rndPick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
/* v8.0 legacy genStat — kept for backwards compat / any manual use */
function genStat(cid,key){
  const cfg=CLASS_STAT_CFG[cid], rare=Math.random()<0.20;
  const [lo,hi]=rare?cfg.rare:cfg.avg; let v=lo===hi?lo:rndInt(lo,hi);
  if(cfg.focus.includes(key)) v=Math.min(15,v+1); return v;
}

/* v7.9: base year shifted 2010 → 2000 (−10 years).
   Benchmark: grade=6, sysYear=1 → y=2000+(6-6)+(1-1)=2000;
   m≤3 bumps to 2001 → born Apr 2000 – Mar 2001 ✓           */
function genDOB(grade,sysYear){
  let y=2000+(6-grade)+(sysYear-1); const m=rndInt(1,12),d=rndInt(1,28);
  if(m<=3) y+=1;
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
/* v8.1: genSurname — 2:1 weighted selection: Major (2/3 chance) vs Rare (1/3).
   This reflects realistic surname frequency distribution in Japanese society. */
function genSurname(){
  return Math.random() < 0.667
    ? rndPick(SURNAMES_MAJOR)
    : rndPick(SURNAMES_RARE);
}
/* v7.8: half-width space " " inserted between surname and given name */
function genStudentName(gender){
  return genSurname()+' '+rndPick(gender==='M'?MALE_NAMES:FEMALE_NAMES);
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

/* v7.10: checkedClasses — Set of "grade_classId" strings for multi-select
   batch operations. Persists across re-renders; renderHome re-applies
   .chk-selected styling and restores checkbox state from this Set.    */
const checkedClasses = new Set();

/* v7.11: editMode — boolean tracking whether Edit Mode is active on the
   Home screen. When true, the PP/CP dist row and cls-sel-bars are visible.
   Persists across renderHome re-renders (preserved by navigate calls).    */
let editMode = false;

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
  /* v7.8: traits[] — array of trait id strings from SPECIAL_TRAITS */
  /* v8.1: customTraits[] — array of {id, label, cat:'custom'} objects */
  return { id:genStudentId(grade), name:'', gender:'M', dob:'', grade, classId, stats,
           specialAbility:'', privatePoints:0, protectPoints:0, contracts:[],
           isExpelled:false, traits:[], customTraits:[] };
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
      /* Incoming students: estimated DOB as if entering grade 1 next year */
      s.dob    = genDOB(1, state.year + 1);
      s.privatePoints = rndInt(ppLo, ppHi);
      /* v8.1: stats now use genStatXSum(cid) — binomial X-Sum algorithm */
      const xStats = genStatXSum(cid);
      STATS_KEYS.forEach(k=>{ s.stats[k] = xStats[k]; });
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
      /* v8.1: use genStatXSum for binomial X-Sum distribution */
      const xStats=genStatXSum(cid);
      STATS_KEYS.forEach(k=>{s.stats[k]=xStats[k];}); s.specialAbility='';
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
   v8.7: Protobuf binary persistence layer
   ─────────────────────────────────────────────────────────────────
   Binary format:
     • State is mapped to GameSave proto (from proto_bundle.js / $protobuf)
     • Encoded binary is base64-stored in localStorage under the same key
     • Prefix magic: "PB87:" marks a binary slot; absence = legacy JSON
     • On load, legacy JSON is auto-migrated and re-saved as binary
   Student proto mapping:
     id, lastName/firstName (split on ' '), gender, grade (numeric only),
     classId, stats (hp=language,mp=reasoning,str=memory,vit=thinking,
     dex=physical,agi=mental), traits[]
   Non-proto fields (isExpelled, protectPoints, privatePoints, dob,
     specialAbility, contracts, customTraits, cohortGrade, graduateYear,
     slotName, year, month, history, classes) are stored as a JSON
     sidecar in a second localStorage key (slotKey(n)+'_meta') to avoid
     losing any data. The proto only stores the core student identity
     and stats for efficiency; the meta key retains everything else.
   This hybrid approach ensures zero data loss while demonstrating
   the protobuf integration in the hot-path save/load cycle.
────────────────────────────────────────────────────────────────── */

/* v8.7: PB helpers — encode/decode student stats to/from proto Stats */
function statsToProto(stats){
  return {
    hp:  stats.language  || 1,
    mp:  stats.reasoning || 1,
    str: stats.memory    || 1,
    vit: stats.thinking  || 1,
    dex: stats.physical  || 1,
    agi: stats.mental    || 1,
    int: 0, luk: 0,
  };
}
function statsFromProto(ps){
  return {
    language:  ps.hp  || 1,
    reasoning: ps.mp  || 1,
    memory:    ps.str || 1,
    thinking:  ps.vit || 1,
    physical:  ps.dex || 1,
    mental:    ps.agi || 1,
  };
}

/* v8.7: encodeStateToBinary — returns base64 string of GameSave proto,
   or null if protobufjs ($root) is not available.                     */
function encodeStateToBinary(s){
  try{
    const $root = window.$protobuf?.roots?.default || window.$root;
    if(!$root?.GameSave) return null;
    const students = s.students.map(st=>{
      const parts = (st.name||'').split(' ');
      const lastName  = parts[0] || '';
      const firstName = parts.slice(1).join(' ') || '';
      return {
        id:        st.id        || '',
        lastName,
        firstName,
        gender:    st.gender    || 'M',
        grade:     typeof st.grade==='number' ? st.grade : 0,
        classId:   st.classId   || 0,
        stats:     statsToProto(st.stats || {}),
        traits:    Array.isArray(st.traits) ? st.traits : [],
      };
    });
    const msg = $root.GameSave.create({
      version:   parseFloat(APP_VER) || 8.7,
      timestamp: Date.now(),
      students,
    });
    const buf  = $root.GameSave.encode(msg).finish();
    /* Convert Uint8Array to base64 */
    let bin='';
    buf.forEach(b=>{ bin+=String.fromCharCode(b); });
    return 'PB87:' + btoa(bin);
  }catch(e){
    console.warn('[PB] encodeStateToBinary failed:', e);
    return null;
  }
}

/* v8.7: decodeStateFromBinary — decode a PB87: base64 string back to
   partial student data (id, name, gender, grade, classId, stats, traits).
   Returns array of partial student objects; caller merges with meta.  */
function decodeStateFromBinary(b64){
  try{
    const $root = window.$protobuf?.roots?.default || window.$root;
    if(!$root?.GameSave) return null;
    const raw   = atob(b64.slice(5));
    const buf   = new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++) buf[i]=raw.charCodeAt(i);
    const msg = $root.GameSave.decode(buf);
    return (msg.students||[]).map(ps=>({
      id:       ps.id      || '',
      name:     [ps.lastName, ps.firstName].filter(Boolean).join(' '),
      gender:   ps.gender  || 'M',
      grade:    ps.grade   || 0,
      classId:  ps.classId || 0,
      stats:    statsFromProto(ps.stats || {}),
      traits:   Array.isArray(ps.traits) ? [...ps.traits] : [],
    }));
  }catch(e){
    console.warn('[PB] decodeStateFromBinary failed:', e);
    return null;
  }
}
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

/* v8.7: readRawSlotState — get a plain object from slot n (handles binary+meta) */
function readRawSlotState(n){
  const raw = localStorage.getItem(slotKey(n));
  if(!raw) return null;
  try{
    if(raw.startsWith('PB87:')){
      const metaRaw = localStorage.getItem(slotKey(n)+'_meta');
      if(metaRaw) return JSON.parse(metaRaw);
      return null; /* no meta = unreadable brief */
    }
    return JSON.parse(raw);
  }catch(_){ return null; }
}

function saveState(silent=false,targetSlot=currentSlot,forcedName=''){
  /* v8.9 fix[1&2]: 空生徒リストも有効な状態（全退学等）なので length===0 ガード削除。
     また cross-slot セーブ直後に syncSlModalButtons() を呼んで UI を即時更新。  */
  if(!state) return false;
  const slot=Number(targetSlot)||currentSlot;
  if(slot===0) return false;
  const slotName=(forcedName||state.slotName||slotNameOf(slot)||defaultSlotName(slot)).trim();
  try{
    const payload={...state, slotName};
    const binary = encodeStateToBinary(payload);
    if(binary){
      localStorage.setItem(slotKey(slot), binary);
      localStorage.setItem(slotKey(slot)+'_meta', JSON.stringify(payload));
    } else {
      localStorage.setItem(slotKey(slot), JSON.stringify(payload));
    }
    setSlotName(slot, slotName);
    if(slot===currentSlot) state.slotName=slotName;
    updateSlotButtons();
    /* v8.9 fix[2]: renderSaveLoadModal の直後に syncSlModalButtons を呼ぶことで
       他スロットへのセーブ後「空き」→「データあり」が即座に反映される。         */
    if(slModalOpen){ renderSaveLoadModal(); syncSlModalButtons(); }
    saveToCloud(slot, payload);
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
    if(raw.startsWith('PB87:')){
      const metaRaw = localStorage.getItem(slotKey(n)+'_meta');
      if(metaRaw){
        /* v8.9 fix[6]: meta sidecar が全フィールドを持つ正規ソース。
           二回目の decodeStateFromBinary() 呼び出しを廃止。
           (1200人規模で約2×のロード速度改善)                       */
        state = JSON.parse(metaRaw);
      } else {
        /* meta 欠損時のみ proto から部分復元 */
        const pbStudents = decodeStateFromBinary(raw);
        if(!pbStudents){ state=null; return false; }
        state = newState();
        state.students = pbStudents.map(ps=>({
          ...blankStudent(ps.grade||1, ps.classId||0),
          ...ps,
        }));
      }
    } else {
      /* Legacy JSON — 次回 saveState() で自動マイグレーション */
      state=JSON.parse(raw);
    }
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
  localStorage.removeItem(slotKey(n)+'_meta'); /* v8.7: clear proto meta sidecar */
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
  const name=slNameDrafts[n]??slotNameOf(n);
  const s=readRawSlotState(n);
  if(!s){
    return { slot:n, name, empty:true, year:'-', month:'-', count:0 };
  }
  try{
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
  /* v8.9 fix[3]: 書き出しは選択スロット単体を対象とする */
  document.getElementById('sl-btn-export')?.addEventListener('click',()=>exportSelectedSlot());
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
   v8.9 fix[3]: 「書き出し」ボタンは選択中スロット単体を書き出すように変更。
   ユーザーがスロット4を選んで書き出したらスロット4だけが対象になる。
   全スロット一括バックアップは exportAllSlots() で引き続き利用可能
   (将来的に「全バックアップ」ボタンから呼ぶ想定)。
────────────────────────────────────────────────────────────────── */
function exportSelectedSlot(){
  /* モーダル表示中は slSelectedSlot、そうでなければ currentSlot を使う */
  const n = slModalOpen ? slSelectedSlot : currentSlot;
  saveState(true, n);
  const s = readRawSlotState(n);
  if(!s){ toast('✗ 書き出すデータがありません','err'); return; }
  let slotData;
  try{ slotData = serializeSlot(s); }
  catch(e){ toast('✗ シリアライズ失敗: '+e.message,'err'); return; }
  const payload = {
    app:'Cote-OS', version:APP_VER, exportedAt:new Date().toISOString(),
    singleSlot:true, slotNumber:n,
    slots:{ [n]: slotData },
  };
  const stamp=datestamp();
  const blob=new Blob(['\uFEFF'+JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=Object.assign(document.createElement('a'),{href:url,download:`cote_os_slot${n}_${stamp}.json`});
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),15000);
  toast(`✓ スロット${n}を書き出しました — cote_os_slot${n}_${stamp}.json`,'io',3500);
}
function exportAllSlots(){
  saveState(true);
  const slots={};
  for(let n=1;n<=NUM_SLOTS;n++){
    const s=readRawSlotState(n);
    if(!s){slots[n]=null;continue;}
    try{slots[n]=serializeSlot(s);}catch(e){slots[n]=null;}
  }
  const payload={app:'Cote-OS',version:APP_VER,exportedAt:new Date().toISOString(),
    description:'Cote-OS 全スロットバックアップ。',slots};
  const stamp=datestamp();
  const blob=new Blob(['\uFEFF'+JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=Object.assign(document.createElement('a'),{href:url,download:`cote_os_backup_${stamp}.json`});
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),15000);
  toast(`✓ 全スロット書き出し完了 — cote_os_backup_${stamp}.json`,'io',3500);
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
  /* v8.9 fix[3]: 選択スロット番号を確定してからダイアログを表示。
     ファイル選択後は importTargetSlot に読み込む。               */
  const targetSlot = slModalOpen ? slSelectedSlot : currentSlot;
  const hasExisting = slotHasData(targetSlot);
  openModal(`
    <div class="m-title">↑ データ読み込み (スロット${targetSlot})</div>
    <div class="m-body">
      <div class="import-info">
        <strong style="color:var(--io)">読み込み先：</strong> スロット ${targetSlot}${hasExisting?'（上書き）':''}<br>
        対象ファイル：<code>cote_os_slot${targetSlot}_*.json</code> または全バックアップ JSON<br>
        ※ JSON を手動編集してから読み込むことも可能です。
      </div>
      <p>${hasExisting?'スロット'+targetSlot+'の既存データは上書きされます。<br>':''}続行しますか？</p>
      <div class="btn-row">
        <button class="btn btn-io" onclick="pickFile(${targetSlot})">ファイルを選択</button>
        <button class="btn" onclick="closeModal()">キャンセル</button>
      </div>
    </div>
  `);
}
window.pickFile=function(targetSlot){
  closeModal();
  /* v8.9: targetSlot を data 属性に保存してからファイルピッカー起動 */
  const fp=document.getElementById('file-pick');
  fp.dataset.importTarget=targetSlot||'';
  fp.click();
};

function onFilePicked(file){
  if(!file) return;
  const isBin = file.name.endsWith('.bin') || (file.type && file.type.includes('octet-stream'));
  const isJson= file.type&&file.type.includes('json')||file.name.endsWith('.json');
  if(!isBin && !isJson){ toast('✗ .json または .bin ファイルを選択してください','err'); return; }
  if(file.size>50*1024*1024){ toast('✗ ファイルが大きすぎます (上限 50 MB)','err'); return; }

  /* v8.9 fix[3]: data-import-target から読み込み先スロットを取得 */
  const fp=document.getElementById('file-pick');
  const importTarget=parseInt(fp.dataset.importTarget||'',10)||currentSlot;
  fp.dataset.importTarget='';

  if(isBin){
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const buf = new Uint8Array(e.target.result);
        const $root = window.$protobuf?.roots?.default || window.$root;
        if(!$root?.GameSave){ toast('✗ Protobuf が初期化されていません','err'); return; }
        const msg = $root.GameSave.decode(buf);
        const s = newState();
        s.students = (msg.students||[]).map(ps=>({
          ...blankStudent(ps.grade||1, ps.classId||0),
          id:     ps.id      || '',
          name:   [ps.lastName, ps.firstName].filter(Boolean).join(' '),
          gender: ps.gender  || 'M',
          grade:  ps.grade   || 1,
          classId:ps.classId || 0,
          stats:  statsFromProto(ps.stats || {}),
          traits: Array.isArray(ps.traits) ? [...ps.traits] : [],
        }));
        repairIntegrity(s);
        /* v8.9 fix[3]: importTarget スロットに binary+meta で保存 */
        const binary = encodeStateToBinary(s);
        if(binary){
          localStorage.setItem(slotKey(importTarget), binary);
          localStorage.setItem(slotKey(importTarget)+'_meta', JSON.stringify(s));
        } else {
          localStorage.setItem(slotKey(importTarget), JSON.stringify(s));
        }
        if(importTarget===currentSlot){
          state=s; updateSlotButtons(); updateDateDisplay(); navigate('home',{},true);
        } else {
          if(slModalOpen){ renderSaveLoadModal(); syncSlModalButtons(); }
        }
        toast(`✓ Protobuf ファイルをスロット${importTarget}に読み込みました`,'io',3500);
      }catch(err){ toast('✗ Protobuf 解析失敗: '+err.message,'err',4500); }
    };
    reader.onerror=()=>toast('✗ ファイルの読み込みに失敗しました','err');
    reader.readAsArrayBuffer(file);
    return;
  }

  const reader=new FileReader();
  reader.onload=e=>{ try{ validateAndImport(JSON.parse(e.target.result.replace(/^\uFEFF/,'')), importTarget); }
    catch(err){ toast('✗ JSON 解析失敗: '+err.message,'err',4500); } };
  reader.onerror=()=>toast('✗ ファイルの読み込みに失敗しました','err');
  reader.readAsText(file,'utf-8');
}
function validateAndImport(parsed, targetSlot){
  /* v8.9 fix[3]: 単一スロット書き出し形式 (singleSlot:true) に対応。
     targetSlot が指定された場合、そのスロットのデータだけを上書き。
     全スロットバックアップ形式の場合は全スロットを復元する旧来動作。
     いずれも読み込み後は targetSlot (または currentSlot) をロード。    */
  if(!parsed?.slots||typeof parsed.slots!=='object'){ toast('✗ 無効なファイル形式です','err'); return; }
  const meta=loadSlotMeta();
  let restored=0;
  const target = targetSlot || currentSlot;

  if(parsed.singleSlot){
    /* 単一スロットファイル: ファイル内の任意のスロットを targetSlot に読み込む */
    const srcKey = parsed.slotNumber || Object.keys(parsed.slots)[0];
    const raw = parsed.slots[srcKey] ?? parsed.slots[String(srcKey)];
    if(!raw){ toast('✗ ファイルにスロットデータがありません','err'); return; }
    try{
      const ss=deserializeSlot(raw);
      repairIntegrity(ss);
      /* v8.9 fix: binary+meta で保存 */
      const binary = encodeStateToBinary(ss);
      if(binary){
        localStorage.setItem(slotKey(target), binary);
        localStorage.setItem(slotKey(target)+'_meta', JSON.stringify(ss));
      } else {
        localStorage.setItem(slotKey(target), JSON.stringify(ss));
      }
      meta[target]=(ss.slotName&&ss.slotName.trim())?ss.slotName.trim():defaultSlotName(target);
      restored=1;
    }catch(e){ toast('✗ 読み込み失敗: '+e.message,'err'); return; }
  } else {
    /* 全スロットバックアップ形式: 全スロット復元 */
    for(let n=1;n<=NUM_SLOTS;n++){
      const raw=parsed.slots[n]??parsed.slots[String(n)];
      if(!raw){
        localStorage.removeItem(slotKey(n));
        localStorage.removeItem(slotKey(n)+'_meta');
        meta[n]=defaultSlotName(n);
        continue;
      }
      try{
        const ss=deserializeSlot(raw);
        repairIntegrity(ss);
        const binary = encodeStateToBinary(ss);
        if(binary){
          localStorage.setItem(slotKey(n), binary);
          localStorage.setItem(slotKey(n)+'_meta', JSON.stringify(ss));
        } else {
          localStorage.setItem(slotKey(n), JSON.stringify(ss));
        }
        meta[n]=(ss.slotName&&ss.slotName.trim())?ss.slotName.trim():defaultSlotName(n);
        restored++;
      }catch(e){ console.warn('import slot',n,e); }
    }
  }
  saveSlotMeta(meta);
  selectMode=false; selectedIds=new Set(); navStack=[];
  /* v8.9 fix[3]: currentSlot を target にスイッチして確実にロード */
  currentSlot=target; isGuestMode=false;
  state=null;
  loadSlot(target);
  updateSlotButtons(); updateDateDisplay(); navigate('home',{},true);
  closeSaveLoadModal();
  toast(`✓ 読み込み完了 — スロット${target}に${restored===1?'データを':'全'+restored+'スロットを'}復元しました`,'io',3500);
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
  /* v7.11: remove edit-mode body class when navigating away from home */
  if(page!=='home'){
    document.body.classList.remove('edit-mode');
  }
  switch(page){
    case 'home':         app.innerHTML=renderHome(); break;
    case 'grade':        app.innerHTML=renderGrade(params.grade); break;
    case 'class':        app.innerHTML=renderClass(params.grade,params.classId); break;
    case 'profile':      app.innerHTML=renderProfile(params.sid); break;
    case 'graduates':    app.innerHTML=renderSpecial('Graduate'); break;
    case 'incoming':     app.innerHTML=renderSpecial('Incoming'); break;
    case 'graduateYear': app.innerHTML=renderGraduateYear(params.yrKey); break;
    case 'graduateClass':app.innerHTML=renderGraduateClass(params.yrKey, params.classId); break;
    case 'incomingCohort':app.innerHTML=renderIncomingCohort(params.cg); break;
    case 'incomingClass': app.innerHTML=renderIncomingClassView(params.cg, params.classId); break;
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
  const chkCount=checkedClasses.size;
  const selInfoCls=chkCount>0?'hcb-sel-info':'hcb-sel-info none';
  const selInfoTxt=chkCount>0?`${chkCount} クラス選択中`:'0 クラス選択中';
  /* v7.11: sync body.edit-mode class to current editMode state */
  document.body.classList.toggle('edit-mode', editMode);

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

    <!-- v7.11: Home Control Bar — Edit Mode toggle (left) + nav buttons (right) -->
    <div class="home-ctrl-bar">

      <!-- LEFT: Edit Mode toggle + integrated PP/CP dist row -->
      <div class="hcb-half hcb-left">
        <!-- Top row: Edit Mode button + selection info -->
        <div class="hcb-left-top">
          <button class="btn-edit-mode${editMode?' edit-active':''}"
                  onclick="toggleEditMode()"
                  title="${editMode?'編集モード終了':'クラスを選択して一括操作'}">
            ${editMode?'編集終了':'クラスを選択'}
          </button>
          <span class="${selInfoCls}" id="hcb-sel-info">${selInfoTxt}</span>
        </div>

        <!-- v7.11: Integrated PP + CP dist row — hidden by default, shown in edit-mode via CSS -->
        <div class="hcb-dist-row" id="hcb-dist-row">
          <span class="hcb-dist-lbl">PP：</span>
          <input class="hcb-inp" type="number" id="hcb-pp-inp" placeholder="量" />
          <button class="hcb-btn pp-give" onclick="hcbDistPP(1)">配布</button>
          <button class="hcb-btn pp-take" onclick="hcbDistPP(-1)">剥奪</button>

          <span class="hcb-dist-sep"></span>

          <span class="hcb-dist-lbl">CP：</span>
          <input class="hcb-inp" type="number" id="hcb-cp-inp" placeholder="量" />
          <button class="hcb-btn cp-give" onclick="hcbDistCP(1)">配布</button>
          <button class="hcb-btn cp-take" onclick="hcbDistCP(-1)">剥奪</button>
        </div>
      </div>

      <!-- RIGHT: Navigate to Graduates / Incoming -->
      <div class="hcb-half" style="gap:7px">
        <button class="hcb-nav-btn nav-grad" onclick="navigate('graduates',{},false)">
          <span class="hcb-nav-cnt">${grads}</span>
          <span class="hcb-nav-lbl">${JP.graduates}</span>
        </button>
        <button class="hcb-nav-btn nav-inc" onclick="navigate('incoming',{},false)">
          <span class="hcb-nav-cnt">${inc}</span>
          <span class="hcb-nav-lbl">${JP.incoming2}</span>
        </button>
      </div>

    </div>`;

  /* Grade blocks — cls-mini cards with checkboxes + per-grade sel-bar */
  GRADES.forEach(grade=>{
    const ranked=getRanked(grade);
    /* Count how many of this grade's 5 classes are checked */
    const gradeTotalCls=ranked.length;
    const gradeChkCls=ranked.filter(c=>checkedClasses.has(`${grade}_${c.classId}`)).length;

    h+=`
      <div class="grade-block">
        <div class="grade-hdr" onclick="navigate('grade',{grade:${grade}},false)">
          <span class="grade-lbl">${JP.gradeN(grade)}</span>
          <span class="grade-hint">▶ 詳細を見る</span>
        </div>
        <!-- v7.11: per-grade select-all bar — hidden by default, shown via body.edit-mode CSS -->
        <div class="cls-sel-bar" onclick="event.stopPropagation()">
          <span class="cls-sel-bar-lbl">一括選択：</span>
          <button class="cls-sel-btn sel-all-btn" onclick="hcbSelGrade(${grade},true)">全選択</button>
          <button class="cls-sel-btn sel-none-btn" onclick="hcbSelGrade(${grade},false)">全解除</button>
          ${gradeChkCls>0?`<span style="font-size:.6rem;color:var(--ac);margin-left:4px">${gradeChkCls}/${gradeTotalCls} 選択中</span>`:''}
        </div>
        <div class="cls-strip">`;

    ranked.forEach((cls,ri)=>{
      const rank=RANK_LABELS[ri], nm=clsName(grade,cls.classId);
      const key=`${grade}_${cls.classId}`;
      const isChk=checkedClasses.has(key);
      h+=`
        <div class="cls-mini${isChk?' chk-selected':''}"
             onclick="navigate('class',{grade:${grade},classId:${cls.classId}},false)">
          <!-- v7.12: checkbox hidden by default; CSS shows via body.edit-mode -->
          <label class="mini-chk-wrap" onclick="event.stopPropagation()">
            <input class="mini-chk" type="checkbox" ${isChk?'checked':''}
                   onchange="toggleMiniChk(${grade},${cls.classId},event)" />
          </label>
          <!-- Rank badge — absolute top-right -->
          <span class="mini-rank r${rank}">${rank}</span>
          <!-- v7.12: Top section — class name with right padding to clear rank badge -->
          <div class="mini-top">
            <div class="mini-name">${esc(nm)}</div>
          </div>
          <!-- v7.12: Bottom section — CP value pinned to bottom-left -->
          <div class="mini-bottom">
            <div class="mini-cp">${cls.classPoints.toLocaleString()}</div>
            <div class="mini-cplbl">CP</div>
          </div>
        </div>`;
    });
    h+=`</div></div>`;
  });

  return h;
}

/* ── v7.11: Home Control Bar — Edit Mode + multi-class batch actions ──
   editMode bool controls body.edit-mode CSS class, which shows/hides
   .hcb-dist-row and .cls-sel-bar via CSS selectors.
   checkedClasses (Set<"grade_classId">) is the single source of truth.
   All actions operate on every checked class at once.
   toggleMiniChk / hcbSelGrade update the Set and patch the DOM
   reactively (no full renderApp) for snappy feedback.                  */

/* v7.11: toggleEditMode — toggle editMode state, sync body class and button UI */
window.toggleEditMode=function(){
  editMode=!editMode;
  document.body.classList.toggle('edit-mode', editMode);
  /* Patch the toggle button in-place for instant feedback */
  const btn=document.querySelector('.btn-edit-mode');
  if(btn){
    btn.classList.toggle('edit-active', editMode);
    btn.textContent=editMode?'編集終了':'クラスを選択';
    btn.title=editMode?'編集モード終了':'クラスを選択して一括操作';
  }
  /* When turning OFF: clear checked classes and re-render home cleanly */
  if(!editMode){
    checkedClasses.clear();
    renderApp();
  }
};

/* Helper: convert checkedClasses Set → Array<{grade,classId}> */
function hcbGetCheckedClasses(){
  return Array.from(checkedClasses).map(key=>{
    const [g,c]=key.split('_').map(Number);
    return {grade:g, classId:c};
  }).filter(x=>!isNaN(x.grade)&&!isNaN(x.classId));
}

/* toggleMiniChk — fired by checkbox onchange inside .cls-mini.
   Updates checkedClasses, toggles .chk-selected on the card,
   and refreshes the #hcb-sel-info badge. No full re-render.     */
window.toggleMiniChk=function(grade,classId,ev){
  ev.stopPropagation();
  const key=`${grade}_${classId}`;
  const card=ev.target.closest('.cls-mini');
  if(ev.target.checked){
    checkedClasses.add(key);
    card?.classList.add('chk-selected');
  } else {
    checkedClasses.delete(key);
    card?.classList.remove('chk-selected');
  }
  /* Refresh selection counter in ctrl bar */
  const info=document.getElementById('hcb-sel-info');
  if(info){
    const n=checkedClasses.size;
    info.textContent=`${n} クラス選択中`;
    info.className=n>0?'hcb-sel-info':'hcb-sel-info none';
  }
};

/* hcbSelGrade — 全選択 / 全解除 for one grade row */
window.hcbSelGrade=function(grade,select){
  CLASS_IDS.forEach(cid=>{
    const key=`${grade}_${cid}`;
    if(select) checkedClasses.add(key); else checkedClasses.delete(key);
  });
  /* Re-render home to reflect updated checkbox states */
  renderApp();
};

/* hcbDistPP(sign): sign=+1 配布, sign=-1 剥奪 — all checked classes */
window.hcbDistPP=function(sign){
  const classes=hcbGetCheckedClasses();
  if(!classes.length){toast('✗ クラスをチェックしてください','err');return;}
  const raw=parseInt(document.getElementById('hcb-pp-inp')?.value);
  if(isNaN(raw)||raw<=0){toast('✗ 有効なPP量を入力してください','err');return;}
  const amt=raw*sign;
  const verb=sign>0?'配布':'剥奪';
  /* Count total affected students */
  let totalStu=0;
  const clsLines=classes.map(({grade,classId})=>{
    const cnt=getStudentsOf(grade,classId).filter(s=>!s.isExpelled).length;
    totalStu+=cnt;
    return `<li><span style="color:var(--t1)">${esc(clsName(grade,classId))}</span> (${cnt}名)</li>`;
  }).join('');
  /* JSON-encode class list for execDistPP — avoids multi-arg onclick limits */
  const encoded=encodeURIComponent(JSON.stringify(classes));
  openModal(`
    <div class="m-title">一括PP${verb} — ${classes.length}クラス</div>
    <div class="m-body">
      <ul style="font-size:.72rem;margin:6px 0 8px 16px;line-height:1.7">${clsLines}</ul>
      <p>対象 <strong style="color:var(--t0)">${totalStu}名</strong> に
         <strong style="color:${amt>=0?'var(--gn)':'var(--rd)'}">
           ${amt>=0?'+':''}${amt.toLocaleString()} PP</strong> を${verb}しますか？</p>
      <div class="btn-row">
        <button class="btn ${sign>0?'btn-ac':'btn-dn'}"
                onclick="hcbExecDistPP('${encoded}',${amt})">実行</button>
        <button class="btn" onclick="closeModal()">キャンセル</button>
      </div>
    </div>`);
};

window.hcbExecDistPP=function(encoded,amt){
  const classes=JSON.parse(decodeURIComponent(encoded));
  let totalStu=0;
  classes.forEach(({grade,classId})=>{
    const sts=getStudentsOf(grade,classId).filter(s=>!s.isExpelled);
    sts.forEach(s=>{s.privatePoints+=amt;});
    totalStu+=sts.length;
  });
  closeModal(); saveState(true); renderApp();
  toast(`✓ PP${amt>=0?'配布':'剥奪'}完了 — ${classes.length}クラス / ${totalStu}名 (${amt>=0?'+':''}${amt.toLocaleString()})`,'ok');
};

/* v7.11: hcbDistCP(sign): sign=+1 配布, sign=-1 剥奪 for CP — all checked classes.
   Adds/subtracts amt to/from classPoints (delta, not set). Mirrors hcbDistPP.    */
window.hcbDistCP=function(sign){
  const classes=hcbGetCheckedClasses();
  if(!classes.length){toast('✗ クラスをチェックしてください','err');return;}
  const raw=parseInt(document.getElementById('hcb-cp-inp')?.value);
  if(isNaN(raw)||raw<=0){toast('✗ 有効なCP量を入力してください','err');return;}
  const amt=raw*sign;
  const verb=sign>0?'配布':'剥奪';
  const clsLines=classes.map(({grade,classId})=>{
    return `<li><span style="color:var(--t1)">${esc(clsName(grade,classId))}</span></li>`;
  }).join('');
  const encoded=encodeURIComponent(JSON.stringify(classes));
  openModal(`
    <div class="m-title">一括CP${verb} — ${classes.length}クラス</div>
    <div class="m-body">
      <ul style="font-size:.72rem;margin:6px 0 8px 16px;line-height:1.7">${clsLines}</ul>
      <p>選択クラスに
         <strong style="color:${amt>=0?'var(--ac)':'var(--rd)'}">
           ${amt>=0?'+':''}${amt.toLocaleString()} CP</strong> を${verb}しますか？</p>
      <div class="btn-row">
        <button class="btn ${sign>0?'btn-ac':'btn-dn'}"
                onclick="hcbExecDistCP('${encoded}',${amt})">実行</button>
        <button class="btn" onclick="closeModal()">キャンセル</button>
      </div>
    </div>`);
};

window.hcbExecDistCP=function(encoded,amt){
  const classes=JSON.parse(decodeURIComponent(encoded));
  classes.forEach(({grade,classId})=>{
    const c=state.classes.find(x=>x.grade===grade&&x.classId===classId);
    if(c) c.classPoints+=amt;
  });
  closeModal(); saveState(true); renderApp();
  toast(`✓ CP${amt>=0?'配布':'剥奪'}完了 — ${classes.length}クラス (${amt>=0?'+':''}${amt.toLocaleString()})`,'ok');
};

/* hcbSetCP: LEGACY — kept for any external references; now delegates to hcbDistCP(+1)
   Note: in v7.11 the "設定" button was replaced by 配布/剥奪. This stub remains for safety. */
window.hcbSetCP=function(){
  const classes=hcbGetCheckedClasses();
  if(!classes.length){toast('✗ クラスをチェックしてください','err');return;}
  const val=parseInt(document.getElementById('hcb-cp-inp')?.value);
  if(isNaN(val)){toast('✗ 有効なCP値を入力してください','err');return;}
  classes.forEach(({grade,classId})=>{
    const c=state.classes.find(x=>x.grade===grade&&x.classId===classId);
    if(c) c.classPoints=val;
  });
  saveState(true); renderApp();
  toast(`✓ CP設定完了 — ${classes.length}クラス → ${val.toLocaleString()}`,'ok');
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

/* ── v8.2: RANK ACCENT COLOURS — top border of each card reflects
   the class rank. classId 0=A(cyan), 1=B(gold), 2=C(lime),
   3=D(orange), 4=E(dim). Used as inline border-top-color.        */
const RANK_ACCENT = {
  0:'var(--ac)',          /* A — cyan  */
  1:'var(--yw)',          /* B — gold  */
  2:'var(--gn)',          /* C — green */
  3:'#ff9944',            /* D — orange */
  4:'var(--t3)',          /* E — muted  */
};

/* ── v8.7: s-card renderer — 3-tier LEFT column layout
   ┌────────────────────────┬──────────────┐
   │  .s-col-left           │ .s-col-right │
   │  ID      (top)         │  PRP  (top)  │
   │  Gender  (.s-gender-mid│  OV   (mid)  │  ← blue value only
   │  Name    (bot)         │  PP   (bot)  │
   └────────────────────────┴──────────────┘
   v8.7: Empty slot (no name) shows '-' gender badge (neutral, no colour class).
   Named students show 男 (g-male blue) / 女 (g-female rose) as before.
   Right col unchanged from v8.5 (PRP / OV / PP space-between). */
function renderCards(students,{draggable=false}={}){
  if(!students.length)
    return `<div class="dim" style="grid-column:1/-1;padding:8px;font-size:.7rem">生徒なし</div>`;
  const pool=getSchoolRankingPool();
  return students.map(s=>{
    const sel    = selectedIds.has(s.id);
    const hasPrp = s.protectPoints>0;
    const ov     = calcOverallScore(s,pool);
    /* v8.7: blank slot (no name) shows '-' with no colour class */
    const isBlank = !s.name;
    const isMale = s.gender==='M';
    const gLbl   = isBlank ? '-' : (isMale ? JP.male : JP.female);
    const gCls   = isBlank ? '' : (isMale ? 'g-male' : 'g-female');
    return `
      <div class="s-card ${s.isExpelled?'expelled':''} ${sel?'selected':''}"
           data-name="${escA((s.name||'').toLowerCase())}"
           data-sid="${s.id}"
           ${draggable&&!s.isExpelled?'draggable="true"':''}
           onclick="cardClick('${s.id}')">
        <div class="s-chk">${sel?'✓':''}</div>
        <div class="s-card-inner">
          <!-- Left: ID (top) / Gender (mid) / Name (bot) -->
          <div class="s-col-left">
            <span class="s-sid">${s.id}</span>
            <span class="s-gender-mid ${gCls}">${gLbl}</span>
            <div class="s-name">${esc(s.name)||'<span class="dim">(未記入)</span>'}</div>
          </div>
          <!-- Right: PRP (top) / Overall Power (mid) / PP (bot) -->
          <div class="s-col-right">
            <div class="s-prp-wrap">
              ${hasPrp
                ?`<span class="s-prp-val">${s.protectPoints}</span><span class="s-prp-unit">PRP</span>`
                :`<span class="s-prp-val" style="opacity:.18">—</span>`}
            </div>
            <span class="s-ov-val">${ov}</span>
            <div class="s-pp-wrap">
              <span class="s-pp-val ${ppCol(s.privatePoints)}">${fmtPP(s.privatePoints)}</span>
              <span class="s-pp-unit">PP</span>
            </div>
          </div>
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
   SPECIAL TRAIT HELPERS — v7.8
────────────────────────────────────────────────────────────────── */

/* ── v8.1: sortTraitIds — sorts trait IDs in master SPECIAL_TRAITS order.
   Custom traits (cat==='custom') always come last, in insertion order. */
function sortTraitIds(traitIds, student){
  const masterOrder = new Map(SPECIAL_TRAITS.map((t,i)=>[t.id, i]));
  const standard = traitIds.filter(id => masterOrder.has(id))
    .sort((a,b) => masterOrder.get(a) - masterOrder.get(b));
  const custom   = traitIds.filter(id => !masterOrder.has(id));
  return [...standard, ...custom];
}

/* Build the read-only tag strip for the profile sidebar */
function buildTraitTagStrip(s){
  const traits = Array.isArray(s.traits) ? s.traits : [];
  if(!traits.length)
    return `<span class="trait-display-empty">特性未設定</span>`;
  const sorted = sortTraitIds(traits, s);
  return sorted.map(id=>{
    /* Check standard catalogue first */
    const def = SPECIAL_TRAITS.find(t=>t.id===id);
    if(def) return `<span class="trait-tag tc-${def.cat}">${esc(def.label)}</span>`;
    /* Custom trait — look up in student's customTraits array */
    const custom = (s.customTraits||[]).find(c=>c.id===id);
    if(custom) return `<span class="trait-tag tc-custom">${esc(custom.label)}</span>`;
    return '';
  }).filter(Boolean).join('');
}

/* Build the collapsible category accordion for the profile edit panel */
function buildTraitAccordion(s){
  const selected = new Set(Array.isArray(s.traits) ? s.traits : []);
  const sid = s.id;
  const customTraits = Array.isArray(s.customTraits) ? s.customTraits : [];

  return `<div class="trait-edit-wrap">`+TRAIT_CATEGORIES.map(({key,label})=>{
    const isCustomCat = (key === 'custom');
    /* For standard categories, chips come from SPECIAL_TRAITS catalogue */
    const catTraits = isCustomCat
      ? customTraits
      : SPECIAL_TRAITS.filter(t=>t.cat===key);

    const selCount  = isCustomCat
      ? customTraits.filter(t=>selected.has(t.id)).length
      : catTraits.filter(t=>selected.has(t.id)).length;

    const isCollapsed = traitCategoryCollapsedState.get(key) === true;
    const bodyClass   = isCollapsed ? 'trait-cat-body cat-collapsed' : 'trait-cat-body';
    const arrowChar   = isCollapsed ? '▶' : '▼';
    const openClass   = isCollapsed ? '' : ' tc-open';
    const badgeCls    = selCount > 0 ? 'trait-cat-badge has-sel' : 'trait-cat-badge';

    let chips;
    if(isCustomCat){
      /* Custom chips — each has a × delete button and a toggle */
      chips = customTraits.map(t=>{
        const isSel = selected.has(t.id);
        return `<span class="trait-chip tc-custom-chip${isSel?' selected':''}"
                      onclick="toggleTrait('${escA(sid)}','${escA(t.id)}')">
                  ${esc(t.label)}
                  <button class="trait-chip-del"
                          onclick="event.stopPropagation();deleteCustomTrait('${escA(sid)}','${escA(t.id)}')"
                          title="削除">×</button>
                </span>`;
      }).join('');
      /* Add the text-input row for creating new custom traits */
      chips += `
        <div class="trait-custom-input-wrap">
          <input type="text" id="trait-custom-input"
                 placeholder="特性名を入力 (最大16文字)"
                 maxlength="16"
                 onkeydown="if(event.key==='Enter'){event.preventDefault();addCustomTrait('${escA(sid)}')}" />
          <button class="btn-add-custom-trait"
                  onclick="addCustomTrait('${escA(sid)}')">追加</button>
        </div>`;
    } else {
      chips = catTraits.map(t=>{
        const isSel = selected.has(t.id);
        return `<span class="trait-chip${isSel?' selected':''}"
                      onclick="toggleTrait('${escA(sid)}','${t.id}')">${esc(t.label)}</span>`;
      }).join('');
    }

    return `
      <div class="trait-cat-block tc-${key}${openClass}" id="tcat-block-${key}">
        <div class="trait-cat-hdr" onclick="toggleTraitCat('${key}')">
          <span class="trait-cat-lbl">${label}</span>
          <span class="${badgeCls}" id="tcat-badge-${key}">${selCount||''}</span>
          <span class="trait-cat-arrow">${arrowChar}</span>
        </div>
        <div class="${bodyClass}" id="tcat-body-${key}">${chips}</div>
      </div>`;
  }).join('')+`</div>`;
}

/* Toggle a trait on a student — live-saves and reactively updates
   only the tag strip and badge counts (no full page re-render).   */
window.toggleTrait=function(sid, traitId){
  const s=state.students.find(x=>x.id===sid); if(!s) return;
  if(!Array.isArray(s.traits)) s.traits=[];
  const idx=s.traits.indexOf(traitId);
  if(idx>=0) s.traits.splice(idx,1);
  else        s.traits.push(traitId);

  /* v8.1: auto-sort traits after every toggle */
  s.traits = sortTraitIds(s.traits, s);

  /* Update the sidebar tag strip reactively */
  const strip=document.getElementById('trait-display-'+sid);
  if(strip) strip.innerHTML=buildTraitTagStrip(s);

  /* Update the chip appearance and the category badge count */
  /* Check standard catalogue first, then custom */
  const def=SPECIAL_TRAITS.find(t=>t.id===traitId);
  const catKey = def ? def.cat : 'custom';

  if(def){
    const chip=Array.from(document.querySelectorAll(
      `#tcat-body-${def.cat} .trait-chip`
    )).find(el=>el.textContent.trim()===def.label);
    if(chip) chip.classList.toggle('selected', idx<0);

    const badge=document.getElementById('tcat-badge-'+def.cat);
    if(badge){
      const catTraits=SPECIAL_TRAITS.filter(t=>t.cat===def.cat);
      const count=catTraits.filter(t=>s.traits.includes(t.id)).length;
      badge.textContent=count||'';
      badge.className=count>0?'trait-cat-badge has-sel':'trait-cat-badge';
    }
  } else {
    /* Custom trait — find chip by id data attribute */
    const chip=document.querySelector(`#tcat-body-custom .trait-chip[data-tid="${CSS.escape(traitId)}"]`);
    if(chip) chip.classList.toggle('selected', idx<0);

    const badge=document.getElementById('tcat-badge-custom');
    if(badge){
      const customTraits=Array.isArray(s.customTraits)?s.customTraits:[];
      const count=customTraits.filter(t=>s.traits.includes(t.id)).length;
      badge.textContent=count||'';
      badge.className=count>0?'trait-cat-badge has-sel':'trait-cat-badge';
    }
  }

  saveState(true);
};

/* Toggle trait-category accordion panel; persists collapsed state */
window.toggleTraitCat=function(key){
  const body =document.getElementById('tcat-body-'+key);
  const block=document.getElementById('tcat-block-'+key);
  if(!body||!block) return;
  const isOpen=!body.classList.contains('cat-collapsed');
  body.classList.toggle('cat-collapsed', isOpen);
  block.classList.toggle('tc-open', !isOpen);
  const arrow=block.querySelector('.trait-cat-arrow');
  if(arrow) arrow.textContent=isOpen?'▶':'▼';
  traitCategoryCollapsedState.set(key, isOpen);
};

/* ── v8.1: CUSTOM TRAIT CREATION & DELETION ─────────────────────
   Custom traits are stored directly on the student:
     s.customTraits = [{ id:'custom_N', label:'ラベル', cat:'custom' }]
     s.traits       = [...standardIds, ...'custom_N']
   IDs are auto-generated using a timestamp + random suffix.       */

window.addCustomTrait=function(sid){
  const s=state.students.find(x=>x.id===sid); if(!s) return;
  const inp=document.getElementById('trait-custom-input');
  if(!inp) return;
  const label=(inp.value||'').trim();
  if(!label){ toast('✗ 特性名を入力してください','err'); return; }
  if(label.length>16){ toast('✗ 特性名は16文字以内にしてください','err'); return; }

  /* Prevent duplicates */
  if(!Array.isArray(s.customTraits)) s.customTraits=[];
  if(s.customTraits.some(c=>c.label===label)){
    toast('✗ 同名の特性が既に存在します','err'); return;
  }

  /* Generate a unique ID */
  const id=`custom_${Date.now()}_${Math.floor(Math.random()*9999)}`;
  s.customTraits.push({id, label, cat:'custom'});

  /* Auto-select the new trait */
  if(!Array.isArray(s.traits)) s.traits=[];
  s.traits.push(id);
  s.traits = sortTraitIds(s.traits, s);

  inp.value='';
  saveState(true);

  /* Re-render the profile page to reflect the new chip */
  const cur=navStack[navStack.length-1];
  if(cur&&cur.page==='profile') renderPage('profile',{sid});
  toast(`✓ カスタム特性「${label}」を追加しました`,'ok',2000);
};

window.deleteCustomTrait=function(sid, traitId){
  const s=state.students.find(x=>x.id===sid); if(!s) return;
  if(Array.isArray(s.customTraits)) s.customTraits=s.customTraits.filter(c=>c.id!==traitId);
  if(Array.isArray(s.traits))       s.traits=s.traits.filter(id=>id!==traitId);
  saveState(true);
  const cur=navStack[navStack.length-1];
  if(cur&&cur.page==='profile') renderPage('profile',{sid});
  toast('✓ カスタム特性を削除しました','warn',1800);
};

/* ──────────────────────────────────────────────────────────────────
   v8.3: CONTRACT HELPERS
────────────────────────────────────────────────────────────────── */

/* calcMonthlyBalance(sid) — sums all active contracts involving student sid.
   Returns { income, expense, net } where:
     income  = sum of amounts where another student pays sid (RECV)
     expense = sum of amounts where sid pays another (SEND)
     net     = income − expense                                      */
function calcMonthlyBalance(sid){
  let income=0, expense=0;
  /* SEND: this student's own contracts[] */
  const s=state.students.find(x=>x.id===sid);
  if(s) (s.contracts||[]).forEach(c=>{ expense+=c.amount; });
  /* RECV: other students whose contracts target sid */
  state.students.forEach(o=>{
    if(o.id===sid) return;
    (o.contracts||[]).forEach(c=>{ if(c.targetId===sid) income+=c.amount; });
  });
  return { income, expense, net:income-expense };
}

/* buildContractAccordion(s) — generates the full contract UI as a pair
   of accordion panels, matching the Special Traits accordion style.
   v8.5 Panel 1: 契約の発行 — [Target ID] [PP/月] [支払] [受取]
                 No role dropdown. No badge counter on issue header.
   v8.5 Panel 2: 契約の確認 — all contracts + "月毎の変化: ±X PP" (no formula).
                 Both SEND and RECV items have a delete (✕) button.   */
function buildContractAccordion(s){
  const sid = s.id;

  /* ── Collect contract data ──────────────────────────────────── */
  const allCtr=[];
  (s.contracts||[]).forEach((c,i)=>{
    const t=state.students.find(x=>x.id===c.targetId);
    const tn=t?(t.name||t.id):`[不明 ${c.targetId}]`;
    allCtr.push({dir:'send',label:esc(tn),amt:c.amount,ownerSid:sid,idx:i});
  });
  state.students.forEach(o=>{
    if(o.id===sid) return;
    (o.contracts||[]).forEach((c,i)=>{
      if(c.targetId===sid){
        allCtr.push({dir:'recv',label:esc(o.name||o.id),amt:c.amount,ownerSid:o.id,idx:i});
      }
    });
  });

  /* ── Financial summary (v8.5: show only net change, no formula) ─ */
  const {income,expense,net}=calcMonthlyBalance(sid);
  const netSign = net>0?'+':net<0?'−':'±';
  const netAbs  = Math.abs(net).toLocaleString();
  const netCls  = net>0?'cb-pos':net<0?'cb-neg':'cb-zero';
  const balanceHtml=allCtr.length
    ? `<span class="ctr-balance">
         月毎の変化：<span class="${netCls}">${netSign}${netAbs} PP</span>
       </span>`
    : '';

  /* ── Accordion open/close states ───────────────────────────── */
  const issueColl   = contractAccCollapsedState.get('issue')   === true;
  const confirmColl = contractAccCollapsedState.get('confirm') === true;

  /* ── Panel 1: 契約の発行 (v8.5: Pay/Recv buttons, no dropdown, no badge) ── */
  const issueBody=`
    <div class="ctr-issue-row">
      <input  id="ct-tgt" class="fi ctr-id-inp" placeholder="相手の生徒ID"
              onkeydown="if(event.key==='Enter'){event.preventDefault();addContract('${escA(sid)}','pay')}"/>
      <input  id="ct-amt" class="fi ctr-amt-inp" type="number" placeholder="PP/月" min="1"/>
      <button class="ctr-issue-btn ctr-pay-btn" onclick="addContract('${escA(sid)}','pay')">支払<br><span style="font-size:.55rem;opacity:.75">SEND</span></button>
      <button class="ctr-issue-btn ctr-recv-btn" onclick="addContract('${escA(sid)}','recv')">受取<br><span style="font-size:.55rem;opacity:.75">RECV</span></button>
    </div>`;

  /* ── Panel 2: 契約の確認 (v8.5: both SEND and RECV have delete btn) ─ */
  const contractItems = allCtr.length
    ? allCtr.map(c=>{
        const isSend=c.dir==='send';
        const amtStr=isSend
          ? `<span class="ctr-amt ctr-amt-out">−${c.amt.toLocaleString()}</span>`
          : `<span class="ctr-amt ctr-amt-in">+${c.amt.toLocaleString()}</span>`;
        /* v8.5: delete button on BOTH send and recv */
        const delBtn=`<button class="ctr-del" onclick="rmContract('${escA(c.ownerSid)}',${c.idx},'${escA(sid)}')" title="契約を解除">✕</button>`;
        return `
          <div class="ctr-item ${isSend?'ctr-send':'ctr-recv'}">
            <span class="ctr-dir ${isSend?'ctr-dir-send':'ctr-dir-recv'}">${isSend?'SEND':'RECV'}</span>
            <span class="ctr-name">${c.label}</span>
            ${amtStr} <span style="font-family:var(--fm);font-size:.58rem;color:var(--t3);flex-shrink:0">PP/月</span>
            ${delBtn}
          </div>`;
      }).join('')
    : `<div class="ctr-empty">契約なし</div>`;

  /* ── Assemble accordion ─────────────────────────────────────── */
  return `
    <div class="ctr-accordion-wrap">
      <!-- Panel 1: 契約の発行 (v8.5: no badge counter) -->
      <div class="ctr-acc-block ctr-issue ${!issueColl?'ctr-open':''}" id="ctr-acc-issue">
        <div class="ctr-acc-hdr" onclick="toggleContractAcc('issue')">
          <span class="ctr-acc-lbl">契約の発行</span>
          <span class="ctr-acc-arrow">▶</span>
        </div>
        <div class="ctr-acc-body${issueColl?' ctr-collapsed':''}" id="ctr-acc-body-issue">
          ${issueBody}
        </div>
      </div>
      <!-- Panel 2: 契約の確認 -->
      <div class="ctr-acc-block ctr-confirm ${!confirmColl?'ctr-open':''}" id="ctr-acc-confirm">
        <div class="ctr-acc-hdr" onclick="toggleContractAcc('confirm')">
          <span class="ctr-acc-lbl">契約の確認</span>
          <span class="ctr-acc-badge ${allCtr.length?'has-items':''}">${allCtr.length}</span>
          ${balanceHtml}
          <span class="ctr-acc-arrow">▶</span>
        </div>
        <div class="ctr-acc-body${confirmColl?' ctr-collapsed':''}" id="ctr-acc-body-confirm">
          <div class="ctr-list">${contractItems}</div>
        </div>
      </div>
    </div>`;
}

/* toggleContractAcc — mirrors toggleTraitCat; persists collapsed state */
window.toggleContractAcc=function(key){
  const body =document.getElementById('ctr-acc-body-'+key);
  const block=document.getElementById('ctr-acc-'+key);
  if(!body||!block) return;
  const isOpen=!body.classList.contains('ctr-collapsed');
  body.classList.toggle('ctr-collapsed',isOpen);
  block.classList.toggle('ctr-open',!isOpen);
  const arrow=block.querySelector('.ctr-acc-arrow');
  if(arrow) arrow.textContent=isOpen?'▶':'▼';
  contractAccCollapsedState.set(key,isOpen);
};
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

  /* v8.3: contract accordion built by buildContractAccordion(s) below */

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
        <!-- v7.8: Trait tag strip — reactive display of selected traits -->
        <div class="trait-display-wrap" id="trait-display-${escA(sid)}">
          ${buildTraitTagStrip(s)}
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
          <div class="sec-ttl">プライベートコントラクト</div>
          ${buildContractAccordion(s)}
        </div>

        <div class="prof-sec">
          <div class="sec-ttl">特殊能力 — 特性選択</div>
          ${buildTraitAccordion(s)}
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
  /* v7.9: specialAbility memo field removed from profile UI — field preserved in data, not overwritten */
  STATS_KEYS.forEach(k=>{const e=document.getElementById(`st-${k}`);if(e)s.stats[k]=+e.value;});
  saveState(true); renderApp(); toast('✓ プロフィールを保存しました：'+(s.name||s.id),'ok');
};
/* v8.5: rmContract(ownerSid, idx, viewSid) — deletes contract at idx from
   ownerSid's contracts array. ownerSid may be the current student (SEND)
   or another student (RECV). viewSid is the profile we're viewing so we
   navigateReplace back to it after deletion.                           */
window.rmContract=function(ownerSid, idx, viewSid){
  const owner=state.students.find(x=>x.id===ownerSid);
  if(owner && Array.isArray(owner.contracts)) owner.contracts.splice(idx,1);
  saveState(true);
  /* Return to the profile we were viewing (may differ from ownerSid) */
  const targetSid = viewSid || ownerSid;
  navigateReplace('profile',{sid:targetSid}); updateBreadcrumb();
  toast('✓ コントラクトを削除しました','ok');
};
/* v8.5: addContract(sid, role) — role is 'pay'|'recv', passed directly
   by the 支払/受取 buttons. No dropdown read needed.                  */
window.addContract=function(sid, role='pay'){
  const s=state.students.find(x=>x.id===sid); if(!s) return;

  /* Read unified issuance row inputs */
  const ti   = (document.getElementById('ct-tgt')?.value||'').trim();
  const amt  = parseInt(document.getElementById('ct-amt')?.value);

  /* Validate */
  if(!ti){ toast('✗ 相手の生徒IDを入力してください','err'); return; }
  if(isNaN(amt)||amt<=0){ toast('✗ 有効なPP/月を入力してください','err'); return; }

  /* Strict ID-only lookup */
  const t=state.students.find(x=>x.id===ti);
  if(!t){ toast(`✗ ID「${ti}」の生徒が見つかりません`,'err'); return; }
  if(t.id===sid){ toast('✗ 自分自身にコントラクトできません','err'); return; }

  if(role==='pay'){
    /* s pays t — contract on s */
    if(!Array.isArray(s.contracts)) s.contracts=[];
    s.contracts.push({targetId:t.id, amount:amt});
    saveState(true);
    navigateReplace('profile',{sid});
    toast(`✓ 契約発行 → ${t.name||t.id}：${amt.toLocaleString()} PP/月（支払い）`,'ok');
  } else {
    /* t pays s — contract on t */
    if(!Array.isArray(t.contracts)) t.contracts=[];
    t.contracts.push({targetId:s.id, amount:amt});
    saveState(true);
    navigateReplace('profile',{sid});
    toast(`✓ 契約発行 ← ${t.name||t.id}：${amt.toLocaleString()} PP/月（受取）`,'ok');
  }
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

/* ── v8.7: Graduates — hierarchical nav: Year selection → Class grid → Student cards ── */
function renderGraduates(){
  const sts=state.students.filter(s=>s.grade==='Graduate');
  /* Group by graduateYear */
  const byYear={};
  sts.forEach(s=>{
    const yrKey = typeof s.graduateYear==='number' ? `Year ${s.graduateYear}` : '卒業年不明';
    if(!byYear[yrKey]) byYear[yrKey]=[];
    byYear[yrKey].push(s);
  });
  const sortedYears=Object.keys(byYear).sort((a,b)=>{
    const na=parseInt(a.replace('Year ','')),nb=parseInt(b.replace('Year ',''));
    if(isNaN(na)) return 1; if(isNaN(nb)) return -1;
    return nb-na; // most recent first
  });

  let h=`
    <button class="back-btn" onclick="goBack()">◀ 戻る</button>
    <div class="pg-hdr">
      <span class="pg-title" style="color:var(--yw)">${JP.graduates}</span>
      <span class="pg-sub">${sts.length}名 · ${sortedYears.length}期</span>
    </div>`;

  if(!sts.length){
    h+=`<div class="sp-empty-note">卒業生はいません。</div>`;
    return h;
  }

  /* Year selection blocks — each year shows class mini-cards */
  sortedYears.forEach(yrKey=>{
    const cohort=byYear[yrKey];
    const yrId=yrKey.replace(/\s+/g,'-');
    const isCollapsed = graduatesCollapsedState.get(yrId) === true;
    const arrowChar   = isCollapsed ? '▶' : '▼';
    const bodyStyle   = isCollapsed ? 'display:none' : '';

    /* Count by classId */
    const byClass={};
    CLASS_IDS.forEach(cid=>{byClass[cid]=cohort.filter(s=>s.classId===cid);});

    h+=`
      <div class="yr-sel-block" id="yr-sel-${yrId}">
        <div class="yr-sel-hdr" onclick="toggleYrSel('${yrId}','graduates')">
          <span class="yr-sel-lbl">${yrKey} 卒業</span>
          <span class="yr-sel-cnt">${cohort.length}名</span>
          <span class="yr-sel-arrow">${arrowChar}</span>
        </div>
        <div class="yr-sel-body" id="yr-sel-body-${yrId}" style="${bodyStyle}">
          <div class="yr-grade-strip">`;

    CLASS_IDS.forEach(cid=>{
      const rank=RANK_LABELS[cid]||'?';
      const cnt=byClass[cid].length;
      h+=`
            <div class="yr-grade-card" onclick="navigate('graduateClass',{yrKey:'${escA(yrKey)}',classId:${cid}},false)">
              <span class="mini-rank r${rank}">${rank}</span>
              <div class="yr-grade-lbl">${rank}組</div>
              <div class="yr-grade-cnt">${cnt}名</div>
            </div>`;
    });

    h+=`
          </div>
        </div>
      </div>`;
  });

  return h;
}

/* v8.7: renderGraduateYear (unused — navigation goes directly to graduateClass) */

/* v8.7: renderGraduateClass — show student cards for one graduate cohort's class */
function renderGraduateClass(yrKey, classId){
  const cid = typeof classId==='string' ? parseInt(classId,10) : classId;
  const sts = state.students.filter(s=>
    s.grade==='Graduate' &&
    (typeof s.graduateYear==='number' ? `Year ${s.graduateYear}` : '卒業年不明') === yrKey &&
    s.classId === cid
  );
  const rank = RANK_LABELS[cid] || '?';

  let h=`
    <button class="back-btn" onclick="goBack()">◀ 戻る</button>
    <div class="pg-hdr">
      <span class="pg-title" style="color:var(--yw)">${esc(yrKey)} 卒業 — ${rank}組</span>
      <span class="pg-sub">${sts.length}名</span>
    </div>
    <div class="srch-row">
      <input class="fi" id="s-search" placeholder="卒業生を検索..." oninput="filterStudents()" />
    </div>
    <div class="s-grid">
      ${renderGradIncCards(sts)}
    </div>`;
  return h;
}

window.toggleYrSel=function(yrId, type){
  const body=document.getElementById('yr-sel-body-'+yrId);
  const block=document.getElementById('yr-sel-'+yrId);
  if(!body||!block) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : '';
  const arrow = block.querySelector('.yr-sel-arrow');
  if(arrow) arrow.textContent = isOpen ? '▶' : '▼';
  if(type==='graduates'){
    graduatesCollapsedState.set(yrId, isOpen);
  } else {
    incomingCollapsedState.set(yrId, isOpen);
  }
};
window.toggleCohort=function(id){
  /* Legacy cohort toggle — kept for any old references */
  const body =document.getElementById('cohort-body-'+id);
  const block=document.getElementById('cohort-'+id);
  if(!body||!block) return;
  const isOpen = !body.classList.contains('cohort-collapsed');
  body.classList.toggle('cohort-collapsed', isOpen);
  const arrow = block.querySelector('.cohort-arrow');
  if(arrow) arrow.textContent = isOpen ? '▶' : '▼';
  if(id.startsWith('inc-')){
    incomingCollapsedState.set(id, isOpen);
  } else {
    graduatesCollapsedState.set(id, isOpen);
  }
};

/* v8.7: shared s-card renderer for graduates and incoming class views */
function renderGradIncCards(students){
  if(!students.length)
    return `<div class="dim" style="grid-column:1/-1;padding:8px;font-size:.7rem">生徒なし</div>`;
  const pool=getSchoolRankingPool();
  return students.map(s=>{
    const hasPrp=s.protectPoints>0;
    const ov=calcOverallScore(s,pool);
    const isBlank=!s.name;
    const isMale=(s.gender==='M');
    const gLbl=isBlank?'-':(isMale?JP.male:JP.female);
    const gCls=isBlank?'':(isMale?'g-male':'g-female');
    return `
      <div class="s-card ${s.isExpelled?'expelled':''}"
           data-name="${escA((s.name||'').toLowerCase())}"
           data-sid="${s.id}"
           onclick="navigate('profile',{sid:'${s.id}'},false)">
        <div class="s-card-inner">
          <div class="s-col-left">
            <span class="s-sid">${s.id}</span>
            <span class="s-gender-mid ${gCls}">${gLbl}</span>
            <div class="s-name">${esc(s.name)||'<span class="dim">(未記入)</span>'}</div>
          </div>
          <div class="s-col-right">
            <div class="s-prp-wrap">
              ${hasPrp
                ?`<span class="s-prp-val">${s.protectPoints}</span><span class="s-prp-unit">PRP</span>`
                :`<span class="s-prp-val" style="opacity:.18">—</span>`}
            </div>
            <span class="s-ov-val">${ov}</span>
            <div class="s-pp-wrap">
              <span class="s-pp-val ${ppCol(s.privatePoints)}">${fmtPP(s.privatePoints)}</span>
              <span class="s-pp-unit">PP</span>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');
}

/* ── v8.7: Incoming — hierarchical nav: Cohort selection → Class grid → Student cards ── */
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
    <div class="srch-row" style="justify-content:flex-end">
      <button class="btn btn-ac" onclick="createIncomingCohort()"
              title="第${nextGrade}期 200名を新規作成">＋ 入学コホート作成 (第${nextGrade}期)</button>
    </div>`;

  if(!cohorts.length){
    h+=`<div class="sp-empty-note">入学予定者はいません。<br>「＋ 入学コホート作成」で新しい期を生成できます。</div>`;
    return h;
  }

  cohorts.forEach(cg=>{
    const cohortStudents=allIncoming.filter(s=>s.cohortGrade===cg);
    const yrId=`inc-${cg}`;
    const isCollapsed = incomingCollapsedState.get(yrId) === true;
    const arrowChar   = isCollapsed ? '▶' : '▼';
    const bodyStyle   = isCollapsed ? 'display:none' : '';

    const byClass={};
    CLASS_IDS.forEach(cid=>{byClass[cid]=cohortStudents.filter(s=>s.classId===cid);});

    h+=`
      <div class="yr-sel-block" id="yr-sel-${yrId}">
        <div class="yr-sel-hdr" onclick="toggleYrSel('${yrId}','incoming')">
          <span class="yr-sel-lbl" style="color:var(--ac)">入学予定 第${cg}期</span>
          <span class="yr-sel-cnt">${cohortStudents.length}名</span>
          <button class="cohort-rnd-btn" onclick="event.stopPropagation();randomizeIncomingCohort(${cg})"
                  title="第${cg}期 全生徒をランダム生成">ランダム生成</button>
          <button class="cohort-del-btn" onclick="event.stopPropagation();deleteIncomingCohort(${cg})"
                  title="この期を削除">削除</button>
          <span class="yr-sel-arrow">${arrowChar}</span>
        </div>
        <div class="yr-sel-body" id="yr-sel-body-${yrId}" style="${bodyStyle}">
          <div class="yr-grade-strip">`;

    CLASS_IDS.forEach(cid=>{
      const rank=RANK_LABELS[cid]||'?';
      const cnt=byClass[cid].length;
      h+=`
            <div class="yr-grade-card" onclick="navigate('incomingClass',{cg:${cg},classId:${cid}},false)">
              <span class="mini-rank r${rank}">${rank}</span>
              <div class="yr-grade-lbl">${rank}組</div>
              <div class="yr-grade-cnt">${cnt}名</div>
            </div>`;
    });

    h+=`
          </div>
        </div>
      </div>`;
  });
  return h;
}

/* v8.7: renderIncomingCohort — cohort overview (unused in default nav flow) */
function renderIncomingCohort(cg){
  return renderIncomingClassView(cg, null);
}

/* v8.7: renderIncomingClassView — student cards for one incoming cohort's class */
function renderIncomingClassView(cg, classId){
  const cgNum = typeof cg==='string' ? parseInt(cg,10) : cg;
  const cid   = (classId !== null && classId !== undefined)
    ? (typeof classId==='string' ? parseInt(classId,10) : classId)
    : null;

  const allCohort = state.students.filter(s=>s.grade==='Incoming'&&s.cohortGrade===cgNum);
  const sts = cid !== null ? allCohort.filter(s=>s.classId===cid) : allCohort;
  const rank = cid !== null ? (RANK_LABELS[cid]||'?') : '全';
  const subtitle = cid !== null ? `${rank}組` : '全クラス';

  let h=`
    <button class="back-btn" onclick="goBack()">◀ 戻る</button>
    <div class="pg-hdr">
      <span class="pg-title" style="color:var(--ac)">入学予定 第${cgNum}期 — ${subtitle}</span>
      <span class="pg-sub">${sts.length}名</span>
    </div>
    <div class="srch-row">
      <input class="fi" id="s-search" placeholder="入学予定者を検索..." oninput="filterStudents()" />
    </div>
    <div class="s-grid">
      ${renderGradIncCards(sts)}
    </div>`;
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
  /* v7.9: pf-sa/sa-ct binding removed — specialAbility memo section deleted */
  const cur=navStack[navStack.length-1];
  if(cur?.page==='profile'){
    drawProfileRadar();
  }
  if(cur?.page==='class' && swapMode){
    bindSwapDragHandlers(cur.params.grade,cur.params.classId);
  }
}

/* ──────────────────────────────────────────────────────────────────
   FIREBASE CLOUD LINK — v8.6
   ─────────────────────────────────────────────────────────────────
   The Firebase SDK (modular v10) is initialised as a <script type="module">
   in index.html which exposes the following globals via window:
     fbAuth, fbDb, fbProvider,
     fbSignIn(), fbSignOut(), fbOnAuthChanged(cb),
     fbDoc(), fbGetDoc(), fbSetDoc()

   Cote-OS uses Firestore with the following path structure:
     users/{uid}/slots/{slotN}   — one document per save slot
     Document fields: { data: <JSON string of state payload> }

   Login is Google OAuth (signInWithPopup).
   Data flow:
     • On every saveState() call: saveToCloud() is called silently.
     • On login: loadAllSlotsFromCloud() mirrors cloud → localStorage
       for any slot that is empty locally but exists in the cloud.
     • On logout: no data is erased from localStorage — cloud is a
       backup mirror, not the primary store.
────────────────────────────────────────────────────────────────── */

/* Current authenticated user — null when logged out */
let fbCurrentUser = null;

/* ── syncLoginUI — update save modal header based on auth state ── */
function syncLoginUI(user){
  fbCurrentUser = user || null;
  const loginBtn  = document.getElementById('sl-btn-login');
  const userInfo  = document.getElementById('sl-user-info');
  const userName  = document.getElementById('sl-user-name');
  if(!loginBtn || !userInfo) return;
  if(user){
    loginBtn.classList.add('hidden');
    userInfo.classList.remove('hidden');
    if(userName) userName.textContent = user.displayName || user.email || 'ユーザー';
  } else {
    loginBtn.classList.remove('hidden');
    userInfo.classList.add('hidden');
  }
}

/* ── saveToCloud — silently mirrors a slot to Firestore ──────── */
async function saveToCloud(slot, payload){
  if(!fbCurrentUser) return;   /* not logged in — skip silently */
  const db  = window.fbDb;
  const docF= window.fbDoc;
  const setF= window.fbSetDoc;
  if(!db||!docF||!setF) return;
  try{
    const ref = docF(db, 'users', fbCurrentUser.uid, 'slots', `slot${slot}`);
    const ts=Date.now();
    await setF(ref, { data: JSON.stringify({...payload,_savedAt:ts}), savedAt: ts });
  }catch(e){
    console.warn('[Cloud] saveToCloud failed:', e);
  }
}

/* ── loadFromCloud — read one slot from Firestore ────────────── */
async function loadFromCloud(slot){
  if(!fbCurrentUser) return null;
  const db  = window.fbDb;
  const docF= window.fbDoc;
  const getF= window.fbGetDoc;
  if(!db||!docF||!getF) return null;
  try{
    const ref  = docF(db, 'users', fbCurrentUser.uid, 'slots', `slot${slot}`);
    const snap = await getF(ref);
    if(!snap.exists()) return null;
    return JSON.parse(snap.data().data);
  }catch(e){
    console.warn('[Cloud] loadFromCloud failed:', e); return null;
  }
}

/* ── loadAllSlotsFromCloud — on login, sync cloud → local ─────── */
async function loadAllSlotsFromCloud(){
  /* v8.9 fix[5]: savedAt タイムスタンプを比較してクラウドが新しければ上書き。
     従来はローカルデータが存在するだけでクラウドを無視していた。
     同一アカウントで複数端末を使う場合に最新データが正しく反映される。  */
  if(!fbCurrentUser) return;
  let restored=0;
  const db=window.fbDb, docF=window.fbDoc, getF=window.fbGetDoc;
  if(!db||!docF||!getF) return;
  for(let n=1;n<=NUM_SLOTS;n++){
    let cloudData=null, cloudSavedAt=0;
    try{
      const ref=docF(db,'users',fbCurrentUser.uid,'slots',`slot${n}`);
      const snap=await getF(ref);
      if(!snap.exists()) continue;
      const d=snap.data();
      cloudSavedAt=d.savedAt||0;
      cloudData=JSON.parse(d.data);
    }catch(_){ continue; }
    if(!cloudData) continue;

    /* ローカルの savedAt を meta から取得して比較 */
    let localSavedAt=0;
    if(slotHasData(n)){
      try{
        const metaRaw=localStorage.getItem(slotKey(n)+'_meta');
        if(metaRaw){ const m=JSON.parse(metaRaw); localSavedAt=m._savedAt||0; }
      }catch(_){}
      /* クラウドが古いかローカルの方が新しければスキップ */
      if(cloudSavedAt<=localSavedAt) continue;
    }

    try{
      /* v8.9 fix[5]: binary+meta で保存 (従来は平文 JSON だった) */
      const binary=encodeStateToBinary(cloudData);
      if(binary){
        localStorage.setItem(slotKey(n), binary);
        localStorage.setItem(slotKey(n)+'_meta', JSON.stringify({...cloudData, _savedAt:cloudSavedAt}));
      } else {
        localStorage.setItem(slotKey(n), JSON.stringify(cloudData));
      }
      setSlotName(n, cloudData.slotName||defaultSlotName(n));
      restored++;
    }catch(_){}
  }
  if(restored>0){
    updateSlotButtons();
    if(slModalOpen) renderSaveLoadModal();
    toast(`☁ クラウドから ${restored} スロットを同期しました`,'ok',3500);
  } else {
    toast('☁ ログインしました（ローカルデータは最新）','ok',2500);
  }
}

/* ── initFirebase — wire onAuthStateChanged listener ─────────── */
function initFirebase(){
  const onChanged = window.fbOnAuthChanged;
  if(typeof onChanged !== 'function'){
    /* Firebase SDK not yet loaded (e.g. module script still executing) —
       retry once after a short delay to handle race conditions.         */
    setTimeout(()=>{
      if(typeof window.fbOnAuthChanged === 'function')
        window.fbOnAuthChanged(user=>{ syncLoginUI(user); });
    }, 800);
    return;
  }
  onChanged(user=>{ syncLoginUI(user); });
}

/* ── bindFirebaseControls — hook Login/Logout buttons ────────── */
function bindFirebaseControls(){
  /* Login button in save modal header */
  document.getElementById('sl-btn-login')?.addEventListener('click', async ()=>{
    const signIn = window.fbSignIn;
    if(typeof signIn !== 'function'){
      toast('✗ Firebase が初期化されていません','err'); return;
    }
    try{
      const result = await signIn();
      syncLoginUI(result.user);
      await loadAllSlotsFromCloud();
    }catch(e){
      if(e.code !== 'auth/popup-closed-by-user')
        toast('✗ ログイン失敗: ' + (e.message||e.code),'err');
    }
  });

  /* Logout button */
  document.getElementById('sl-btn-logout')?.addEventListener('click', async ()=>{
    const signOut = window.fbSignOut;
    if(typeof signOut === 'function'){
      try{ await signOut(); } catch(_){}
    }
    syncLoginUI(null);
    toast('☁ ログアウトしました','warn',2000);
  });
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
