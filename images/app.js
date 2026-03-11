/* ============================================================
   STELLARIUM — app.js
   ============================================================ */
'use strict';

/* ── Constants ─────────────────────────────────────────── */
const GRADES  = ['中1','中2','中3','高1','高2','高3'];
const CLASSES = ['A','B','C','D','E'];

// 惑星番号ごとの固定タイプ: 1=資源型, 2=炉晶特化, 3=演晶特化, 4=要塞/未開拓
const PLANET_NUM_TYPE = { 1:'資', 2:'炉', 3:'演', 4:'要' };
// 銀河団5の惑星4(10個)は未開拓型
const UNEXPLORED_IDS = new Set(
  Array.from({ length: 6 }, (_, g) => `5-${g+1}-4`)
);
// 銀河団1〜4の銀河6の惑星4(4個)も未開拓型 → 合計10個
[1,2,3,4].forEach(c => UNEXPLORED_IDS.add(`${c}-6-4`));

function getPlanetType(planetId) {
  if (UNEXPLORED_IDS.has(planetId)) return '未';
  const num = parseInt(planetId.split('-')[2]);
  return PLANET_NUM_TYPE[num] || '資';
}

const PLANET_TYPE_LABELS = { 炉:'炉晶特化型', 演:'演晶特化型', 資:'資源型', 要:'要塞型', 未:'未開拓型' };

const PLANET_BASE_OUTPUT = {
  炉: { 炉晶:100, 演晶:0,  鋼材:0  },
  演: { 炉晶:0,   演晶:100, 鋼材:0  },
  資: { 炉晶:40,  演晶:40,  鋼材:20 },
  要: { 炉晶:0,   演晶:0,   鋼材:60 },
  未: null,
};

const CIV_LEVELS = [
  { lv:1, name:'原始文明',   range:'自分の1惑星のみ',          cost_炉:0,     cost_演:0,     cost_鋼:0,     cost_暗:0,  cum_炉:0,     cum_鋼:0,     cum_暗:0  },
  { lv:2, name:'航星文明',   range:'同一銀河内（4惑星）',      cost_炉:200,   cost_演:200,   cost_鋼:0,     cost_暗:0,  cum_炉:200,   cum_鋼:0,     cum_暗:0  },
  { lv:3, name:'銀河文明',   range:'同一銀河団の隣接銀河まで', cost_炉:500,   cost_演:500,   cost_鋼:0,     cost_暗:0,  cum_炉:700,   cum_鋼:0,     cum_暗:0  },
  { lv:4, name:'星間文明',   range:'同一銀河団の全銀河',       cost_炉:1300,  cost_演:1300,  cost_鋼:700,   cost_暗:0,  cum_炉:2000,  cum_鋼:700,   cum_暗:0  },
  { lv:5, name:'大星間文明', range:'隣接銀河団まで',           cost_炉:3500,  cost_演:3500,  cost_鋼:1300,  cost_暗:0,  cum_炉:5500,  cum_鋼:2000,  cum_暗:0  },
  { lv:6, name:'銀河団文明', range:'全銀河団に展開可能',       cost_炉:9500,  cost_演:9500,  cost_鋼:3000,  cost_暗:10, cum_炉:15000, cum_鋼:5000,  cum_暗:10 },
  { lv:7, name:'超銀河文明', range:'最高威信',                 cost_炉:35000, cost_演:35000, cost_鋼:15000, cost_暗:50, cum_炉:50000, cum_鋼:20000, cum_暗:60 },
];

const PLANET_LV = [
  { lv:1, name:'開拓地',     mult:1.0,  cum_炉:0,    cum_鋼:0,    cum_暗:0  },
  { lv:2, name:'集落',       mult:1.5,  cum_炉:500,  cum_鋼:0,    cum_暗:0  },
  { lv:3, name:'都市',       mult:2.5,  cum_炉:1000, cum_鋼:0,    cum_暗:0  },
  { lv:4, name:'惑星国家',   mult:4.0,  cum_炉:2200, cum_鋼:300,  cum_暗:0  },
  { lv:5, name:'星間都市',   mult:6.0,  cum_炉:4000, cum_鋼:900,  cum_暗:0  },
  { lv:6, name:'恒星文明圏', mult:8.0,  cum_炉:6500, cum_鋼:2500, cum_暗:5  },
  { lv:7, name:'超銀河都市', mult:10.0, cum_炉:10000,cum_鋼:5000, cum_暗:10 },
];

const SOLDIER_LV = [
  { lv:1, name:'民兵',       power:1  },
  { lv:2, name:'正規兵',     power:2  },
  { lv:3, name:'精鋭兵',     power:4  },
  { lv:4, name:'機械兵',     power:8  },
  { lv:5, name:'強化機械兵', power:16 },
  { lv:6, name:'量子兵',     power:32 },
  { lv:7, name:'超空間兵',   power:64 },
];

/* ── State ─────────────────────────────────────────────── */
let state = {
  day: 1,
  selectedId: null,
  // 惑星マスター: key="c-g-n", value={ owner: allianceId|null, lv:1-7 }
  planets: {},
  alliances: [],
  nextAllianceId: 1,
  insertOrder: 0,
};

/* ── Planet master init ─────────────────────────────────── */
function initPlanets() {
  for (let c = 1; c <= 5; c++)
    for (let g = 1; g <= 6; g++)
      for (let n = 1; n <= 4; n++)
        state.planets[`${c}-${g}-${n}`] = { owner: null, lv: 1 };
}

function getPlanetDailyOutput(planetId) {
  const p = state.planets[planetId];
  if (!p) return { 炉晶:0, 演晶:0, 鋼材:0, 暗黒:0 };
  const type = getPlanetType(planetId);
  if (type === '未' && p.lv < 6) return { 炉晶:0, 演晶:0, 鋼材:0, 暗黒:0 };
  const base   = PLANET_BASE_OUTPUT[type] ?? { 炉晶:0, 演晶:0, 鋼材:0 };
  const mult   = PLANET_LV[p.lv - 1].mult;
  const factor = (type === '未' && p.lv >= 6) ? mult * 1.5 : mult;
  return {
    炉晶: Math.round((base.炉晶||0) * factor),
    演晶: Math.round((base.演晶||0) * factor),
    鋼材: Math.round((base.鋼材||0) * factor),
    暗黒: 0,
  };
}

function getAlliancePlanetIds(allianceId) {
  return Object.entries(state.planets)
    .filter(([,v]) => v.owner === allianceId)
    .map(([k]) => k);
}

/* ── Alliance factory ──────────────────────────────────── */
function makeAlliance(name) {
  return {
    id:      state.nextAllianceId++,
    name:    name || `連合${state.nextAllianceId}`,
    leader:  '',
    members: 40,
    civLv:   1,
    res:     { 炉晶:0, 演晶:0, 鋼材:0, 暗黒:0 },
    soldiers:{ 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0 },
    allies:  [],
    notes:   '',
    order:   state.insertOrder++,
  };
}

/* ── Helpers ───────────────────────────────────────────── */
const h     = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const byId  = id => document.getElementById(id);

function toast(msg, dur = 2800) {
  const el = byId('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), dur);
}

function calcDailyTotal(allianceId) {
  const tot = { 炉晶:0, 演晶:0, 鋼材:0, 暗黒:0 };
  getAlliancePlanetIds(allianceId).forEach(pid => {
    const o = getPlanetDailyOutput(pid);
    Object.keys(tot).forEach(k => { tot[k] += o[k]||0; });
  });
  return tot;
}

function calcScore(a) {
  const pids = getAlliancePlanetIds(a.id);
  if (!pids.length) return 0;
  const sumLv = pids.reduce((s,pid) => s+(state.planets[pid]?.lv||1), 0);
  return sumLv * pids.length;
}

function calcTotalRes(a) {
  return Object.values(a.res).reduce((s,v) => s+v, 0);
}

function calcTotalSoldierPower(a) {
  return SOLDIER_LV.reduce((s,sl) => s+sl.power*(a.soldiers[sl.lv]||0), 0);
}

/* 追加順でソート */
function getAlliancesOrdered() {
  return [...state.alliances].sort((a,b) => a.order - b.order);
}

/* スコア順ランキング */
function getRanked() {
  return [...state.alliances].sort((a,b) => {
    const ds = calcScore(b) - calcScore(a);
    return ds !== 0 ? ds : calcTotalRes(b) - calcTotalRes(a);
  });
}

function getRankOf(id) {
  return getRanked().findIndex(x => x.id === id) + 1;
}

function getRankClass(rank, total) {
  if (rank === 1) return 'r1';
  if (rank <= 3) return 'r2';
  if (rank >= total - 2) return 'rbottom';
  return '';
}

/* ── Starfield ─────────────────────────────────────────── */
function initStarfield() {
  const canvas = byId('starfield-canvas');
  const ctx    = canvas.getContext('2d');
  let stars    = [];
  const init   = () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = Array.from({length:220}, () => ({
      x: Math.random()*canvas.width,  y: Math.random()*canvas.height,
      r: Math.random()*1.4+0.2,       o: Math.random()*0.8+0.1,
      d: (Math.random()-0.5)*0.015,
    }));
  };
  const draw = () => {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    stars.forEach(s => {
      ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
      ctx.fillStyle = `rgba(200,225,255,${s.o})`; ctx.fill();
      s.o += s.d;
      if (s.o < 0.05){s.o=0.05;s.d*=-1;}
      if (s.o > 0.92){s.o=0.92;s.d*=-1;}
    });
    requestAnimationFrame(draw);
  };
  window.addEventListener('resize', init);
  init(); draw();
}

/* ── Navigation ────────────────────────────────────────── */
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  byId('page-'+page).classList.add('active');
  const map = {alliances:0, ranking:1, planets:2, battle:3, rules:4};
  const btns = document.querySelectorAll('.nav-btn');
  if (btns[map[page]]) btns[map[page]].classList.add('active');
  if (page === 'ranking') { renderRanking(); const rd=byId('rank-day'); if(rd) rd.textContent=state.day; }
  if (page === 'planets') { buildPlanetFilterOwnerOptions(); renderPlanetsPage(); }
  if (page === 'battle')  initBattleCalc();
}

/* ── Day ───────────────────────────────────────────────── */
function changeDay(d) {
  state.day = Math.max(1, Math.min(7, state.day+d));
  byId('day-badge').textContent = 'DAY '+state.day;
  const badge = byId('galactic-war-badge');
  if (state.day === 7) {
    badge.classList.add('visible');
    toast('🌌 最終日！第3・第4周期に銀河大戦争が自動発動します', 4000);
  } else badge.classList.remove('visible');
}

/* ============================================================
   ALLIANCE LIST & DETAIL
   ============================================================ */
function renderAllianceList() {
  const scroll  = byId('alliance-list-scroll');
  const ordered = getAlliancesOrdered();
  const total   = ordered.length;

  scroll.innerHTML = ordered.map(a => {
    const rank = getRankOf(a.id);
    const rc   = getRankClass(rank, total);
    const pids = getAlliancePlanetIds(a.id);
    const sel  = a.id === state.selectedId ? ' selected' : '';
    return `<div class="alliance-item${sel}" onclick="selectAlliance(${a.id})">
      <div class="ai-top">
        <span class="ai-name">${h(a.name)}</span>
        <span class="ai-score">${calcScore(a).toLocaleString()}</span>
      </div>
      <div class="ai-meta">
        <span class="civ-lv-tag">Lv${a.civLv}</span>
        <span>${h(CIV_LEVELS[a.civLv-1].name)}</span>
        <span class="ai-members">👥${a.members}</span>
      </div>
      <div class="ai-res">
        <span class="res-pill r炉">炉${a.res.炉晶}</span>
        <span class="res-pill r演">演${a.res.演晶}</span>
        <span class="res-pill r鋼">鋼${a.res.鋼材}</span>
        <span class="res-pill r暗">暗${a.res.暗黒}</span>
      </div>
      <div class="ai-rank-row">
        <span class="ai-rank-badge ${rc}">#${rank}</span>
        <span class="ai-planet-count">${pids.length}惑星</span>
      </div>
    </div>`;
  }).join('');
}

function selectAlliance(id) {
  state.selectedId = id;
  renderAllianceList();
  renderAllianceDetail();
  showPage('alliances');
}

function renderAllianceDetail() {
  const panel = byId('alliance-detail-panel');
  const a = state.alliances.find(x => x.id === state.selectedId);
  if (!a) {
    panel.innerHTML = `<div class="detail-inner"><div class="empty-state">
      <div class="empty-icon">🌌</div><div>左のリストから連合を選択してください</div>
    </div></div>`;
    return;
  }

  const ranked = getRanked();
  const rank   = ranked.findIndex(x => x.id === a.id)+1;
  const total  = ranked.length;
  const rc     = getRankClass(rank, total);
  const score  = calcScore(a);
  const pids   = getAlliancePlanetIds(a.id);
  const sumLv  = pids.reduce((s,pid)=>s+(state.planets[pid]?.lv||1),0);
  const daily  = calcDailyTotal(a.id);
  const tp     = calcTotalSoldierPower(a);

  panel.innerHTML = `<div class="detail-inner">
    <div class="a-header-row">
      <div>
        <div class="a-title">${h(a.name)}</div>
        <div class="a-subtitle">リーダー: ${h(a.leader)||'未設定'} ／ 👥${a.members}人</div>
        <div class="a-subtitle mt-4">
          <button onclick="openEditAllianceModal(${a.id})" class="edit-inline-btn">✎ 編集</button>
        </div>
      </div>
      <div class="a-right">
        <div class="civ-card">
          <div class="civ-lv-big">Lv${a.civLv}</div>
          <div class="civ-name-sm">${h(CIV_LEVELS[a.civLv-1].name)}</div>
        </div>
        <div class="rank-card">
          <div class="rank-big ${rc}">#${rank}</div>
          <div class="rank-lbl">順位</div>
        </div>
      </div>
    </div>

    <div class="score-bar">
      <div>
        <div class="score-val">${score.toLocaleString()}</div>
        <div class="score-lbl">SCORE</div>
        <div class="score-formula">Σ発展Lv(${sumLv}) × 惑星数(${pids.length})</div>
      </div>
      <div class="daily-est">
        1日推定産出<br>
        <span style="color:var(--res-炉)">炉${daily.炉晶}</span>
        <span style="color:var(--res-演)">演${daily.演晶}</span>
        <span style="color:var(--res-鋼)">鋼${daily.鋼材}</span>
        <span style="color:var(--res-暗)">暗${daily.暗黒}</span>
      </div>
    </div>

    <div class="sec-title">■ RESOURCES</div>
    <div class="res-grid">
      ${['炉晶','演晶','鋼材','暗黒'].map(k => {
        const icons={炉晶:'🔥',演晶:'💠',鋼材:'⚙️',暗黒:'🌑'};
        return `<div class="res-card rc${k}">
          <div class="res-card-icon">${icons[k]}</div>
          <div class="res-card-lbl">${k}</div>
          <div class="res-card-val">${a.res[k]}</div>
          <input class="res-card-input" type="number" min="0" value="${a.res[k]}"
            onchange="setRes(${a.id},'${k}',this.value)" />
        </div>`;
      }).join('')}
    </div>

    <div class="sec-title">■ CIVILIZATION LEVEL</div>
    <div class="civ-upgrade-list">
      ${CIV_LEVELS.map(c => {
        const isCur = a.civLv === c.lv;
        const costStr = c.lv===1?'初期文明'
          :`累積 炉晶・演晶×${c.cum_炉.toLocaleString()}${c.cum_鋼?` 鋼材×${c.cum_鋼.toLocaleString()}`:''}${c.cum_暗?` 暗黒×${c.cum_暗}`:''}`;
        return `<div class="civ-row${isCur?' current-lv':''}">
          <div class="civ-num">${c.lv}</div>
          <div>
            <div class="civ-info-name">${h(c.name)}</div>
            <div class="civ-info-cost">${costStr} ／ 範囲: ${h(c.range)}</div>
          </div>
          <button class="civ-set-btn${isCur?' is-current':''}" ${isCur?'disabled':''}
            onclick="setCivLv(${a.id},${c.lv})">${isCur?'◆ 現在':'設定'}</button>
        </div>`;
      }).join('')}
    </div>

    <div class="sec-title">■ PLANETS（${pids.length}惑星）</div>
    <div class="planet-grid">
      ${pids.sort().map(pid => renderPlanetCard(pid, a)).join('')}
      <div class="add-planet-slot" onclick="openAssignPlanetModal(${a.id})">＋ 惑星を割当</div>
    </div>

    <div class="sec-title">■ SOLDIERS</div>
    <div class="soldiers-grid">
      ${SOLDIER_LV.map(sl => `
        <div class="soldier-card">
          <div class="soldier-lv">${sl.lv}</div>
          <div class="soldier-name">${h(sl.name)}</div>
          <div class="soldier-power">💪${sl.power}</div>
          <input class="soldier-input" type="number" min="0" value="${a.soldiers[sl.lv]||0}"
            onchange="setSoldier(${a.id},${sl.lv},this.value)" />
        </div>`).join('')}
    </div>
    <div class="total-power-row">
      <span class="total-power-label">総戦闘力：</span>
      <span class="total-power-val" id="total-power-${a.id}">${tp.toLocaleString()}</span>
    </div>

    <div class="sec-title">■ DIPLOMACY</div>
    <div class="diplo-tags">
      ${!a.allies.length ? '<span class="text-dim" style="font-size:11px">外交関係なし</span>'
        : a.allies.map(al => {
          const lbl={normal:'通常同盟',vassal:'属国同盟',secret:'🤫 秘密協定',war:'⚔️ 宣戦'};
          return `<span class="diplo-tag dt-${al.type}"
            onclick="removeDiplo(${a.id},${al.targetId})" title="クリックで削除">
            ${lbl[al.type]} ${h(al.targetName)} ✕</span>`;
        }).join('')}
    </div>
    <div class="diplo-add-row">
      ${['normal','vassal','secret','war'].map(type => {
        const lbl={normal:'通常同盟',vassal:'属国同盟',secret:'秘密協定',war:'宣戦布告'};
        return `<button class="diplo-add-btn" onclick="openDiploModal(${a.id},'${type}')">＋${lbl[type]}</button>`;
      }).join('')}
    </div>

    <div class="sec-title">■ NOTES</div>
    <textarea class="notes-area" placeholder="メモ..." oninput="setNote(${a.id},this.value)">${h(a.notes)}</textarea>

    <div class="action-row">
      <button class="btn-primary" onclick="grantDailyRes(${a.id})">📅 1日分の資源を付与</button>
      <button class="btn-primary" onclick="grantDailySoldiers(${a.id})"
        style="color:var(--accent2);border-color:rgba(160,64,255,.5);">⚔️ 1日分の兵士を付与</button>
      <button class="btn-danger" onclick="deleteAlliance(${a.id})">削除</button>
    </div>
  </div>`;
}

function renderPlanetCard(planetId, alliance) {
  const p    = state.planets[planetId];
  const type = getPlanetType(planetId);
  const lv   = p?.lv||1;
  const out  = getPlanetDailyOutput(planetId);
  const stars= Array.from({length:7},(_,i)=>`<div class="star-dot${i<lv?' lit':''}"></div>`).join('');
  const outStr = Object.entries(out).filter(([,v])=>v>0).map(([k,v])=>`${k[0]}:${v}`).join(' ');
  const warn = lv > alliance.civLv ? ' style="border-color:rgba(255,96,48,.6)"' : '';
  return `<div class="planet-card owned"${warn}>
    <div class="pc-top">
      <span class="pc-name" style="font-family:var(--font-mono);font-size:11px">${h(planetId)}</span>
      <span class="type-badge tb${type}">${PLANET_TYPE_LABELS[type]||type}</span>
    </div>
    <div class="pc-stars">${stars}</div>
    <select class="pc-lv-select" onchange="setPlanetLv('${planetId}',this.value)">
      ${PLANET_LV.map(l=>`<option value="${l.lv}"${lv===l.lv?' selected':''}>${l.lv} ${l.name}(×${l.mult})</option>`).join('')}
    </select>
    <div class="pc-output">${outStr||'産出なし'} /日</div>
    <button class="pc-del-btn" onclick="unassignPlanet('${planetId}')">解放</button>
  </div>`;
}

function renderSummaryPanel() {
  const panel = byId('summary-inner');
  const a = state.alliances.find(x => x.id === state.selectedId);
  if (!a) {
    panel.innerHTML = '<div class="text-dim" style="font-size:11px;padding:8px">連合を選択してください</div>';
    return;
  }
  const daily = calcDailyTotal(a.id);
  const pids  = getAlliancePlanetIds(a.id);
  const tp    = calcTotalSoldierPower(a);
  panel.innerHTML = `
    <div class="sec-title">本日推定産出</div>
    <div style="font-family:var(--font-mono);font-size:11px;line-height:2;margin-bottom:10px;">
      <div><span style="color:var(--res-炉)">炉晶</span> +${daily.炉晶}</div>
      <div><span style="color:var(--res-演)">演晶</span> +${daily.演晶}</div>
      <div><span style="color:var(--res-鋼)">鋼材</span> +${daily.鋼材}</div>
      <div><span style="color:var(--res-暗)">暗黒</span> +${daily.暗黒}</div>
    </div>
    <div class="sec-title">スコア計算</div>
    <div style="font-family:var(--font-mono);font-size:11px;line-height:2;margin-bottom:10px;">
      <div>惑星数: ${pids.length}</div>
      <div>発展Lv合計: ${pids.reduce((s,pid)=>s+(state.planets[pid]?.lv||1),0)}</div>
      <div style="color:var(--gold);font-size:15px;font-weight:bold;">SCORE: ${calcScore(a).toLocaleString()}</div>
    </div>
    <div class="sec-title">兵力</div>
    <div style="font-family:var(--font-mono);font-size:11px;line-height:2;margin-bottom:10px;">
      ${SOLDIER_LV.map(sl=>a.soldiers[sl.lv]>0?`<div>Lv${sl.lv} ${h(sl.name)}: ${a.soldiers[sl.lv]}体</div>`:'').join('')}
      <div style="color:var(--gold)">総戦闘力: ${tp.toLocaleString()}</div>
    </div>
    <button class="daily-grant-btn" onclick="grantDailyRes(${a.id})">📅 1日分の資源を付与</button>
    <button class="daily-grant-btn" style="margin-top:6px;color:var(--accent2);border-color:rgba(160,64,255,.28);background:rgba(160,64,255,.07);"
      onclick="grantDailySoldiers(${a.id})">⚔️ 1日分の兵士を付与</button>`;
}

/* ── Alliance mutations ─────────────────────────────────── */
function setRes(id, key, val) {
  const a = state.alliances.find(x => x.id === id);
  if (!a) return;
  a.res[key] = Math.max(0, parseInt(val)||0);
  renderAllianceList(); renderSummaryPanel();
}

function setCivLv(id, lv) {
  const a = state.alliances.find(x => x.id === id);
  if (!a) return;
  a.civLv = lv;
  renderAll();
  toast(`${a.name} → 文明Lv${lv} ${CIV_LEVELS[lv-1].name}`);
}

function setSoldier(id, lv, val) {
  const a = state.alliances.find(x => x.id === id);
  if (!a) return;
  a.soldiers[lv] = Math.max(0, parseInt(val)||0);
  const el = byId(`total-power-${id}`);
  if (el) el.textContent = calcTotalSoldierPower(a).toLocaleString();
  renderSummaryPanel();
}

function setPlanetLv(planetId, lv) {
  const p = state.planets[planetId];
  if (!p) return;
  p.lv = parseInt(lv);
  if (p.owner) {
    const a = state.alliances.find(x => x.id === p.owner);
    if (a && p.lv > a.civLv) toast(`⚠️ 惑星Lv(${p.lv})が文明Lv(${a.civLv})を超えています`);
  }
  renderAll();
}

function unassignPlanet(planetId) {
  const p = state.planets[planetId];
  if (p) p.owner = null;
  renderAll();
  toast(`惑星 ${planetId} を解放しました`);
}

function grantDailyRes(id) {
  const a = state.alliances.find(x => x.id === id);
  if (!a) return;
  const d = calcDailyTotal(a.id);
  Object.keys(d).forEach(k => { a.res[k] = (a.res[k]||0)+d[k]; });
  renderAll();
  toast(`Day${state.day} 資源付与 ✓`);
}

function grantDailySoldiers(id) {
  const a = state.alliances.find(x => x.id === id);
  if (!a) return;
  let count = 0;
  getAlliancePlanetIds(a.id).forEach(pid => {
    const type = getPlanetType(pid);
    const p = state.planets[pid];
    if (type === '未' && p.lv < 6) return;
    a.soldiers[p.lv] = (a.soldiers[p.lv]||0)+1;
    count++;
  });
  renderAll();
  toast(`兵士付与 +${count}体 ✓`);
}

function setNote(id, val) {
  const a = state.alliances.find(x => x.id === id);
  if (a) a.notes = val;
}

function deleteAlliance(id) {
  if (!confirm('この連合を削除しますか？\n保有惑星は全て解放されます。')) return;
  Object.values(state.planets).forEach(p => { if (p.owner === id) p.owner = null; });
  state.alliances = state.alliances.filter(x => x.id !== id);
  state.selectedId = null;
  renderAll();
  toast('連合を削除しました');
}

function removeDiplo(allianceId, targetId) {
  const a = state.alliances.find(x => x.id === allianceId);
  if (!a) return;
  a.allies = a.allies.filter(x => x.targetId !== targetId);
  renderAll();
}

function renderAll() {
  renderAllianceList();
  renderAllianceDetail();
  renderSummaryPanel();
}

/* ============================================================
   RANKING PAGE
   ============================================================ */
function renderRanking() {
  const ranked = getRanked();
  const total  = ranked.length;
  const tbody  = byId('rank-tbody');
  tbody.innerHTML = ranked.map((a,i) => {
    const rank = i+1;
    const rc   = getRankClass(rank, total);
    const pids = getAlliancePlanetIds(a.id);
    return `<tr onclick="selectAlliance(${a.id})">
      <td><span class="rk-num ${rc}">${rank}</span></td>
      <td class="rk-name">${h(a.name)}</td>
      <td class="rk-civ"><span class="civ-lv-tag">Lv${a.civLv}</span></td>
      <td class="rk-planets text-mono">${pids.length}</td>
      <td class="rk-score">${calcScore(a).toLocaleString()}</td>
      <td class="rk-res" style="color:var(--res-炉)">${a.res.炉晶.toLocaleString()}</td>
      <td class="rk-res" style="color:var(--res-演)">${a.res.演晶.toLocaleString()}</td>
      <td class="rk-res" style="color:var(--res-鋼)">${a.res.鋼材.toLocaleString()}</td>
      <td class="rk-res" style="color:var(--res-暗)">${a.res.暗黒.toLocaleString()}</td>
    </tr>`;
  }).join('');
}

/* ============================================================
   PLANETS PAGE
   ============================================================ */
function buildPlanetFilterOwnerOptions() {
  const sel = byId('planet-filter-owner');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = `<option value="all">全連合</option>
    <option value="unowned">無所属のみ</option>
    ${state.alliances.map(a=>`<option value="${a.id}">${h(a.name)}</option>`).join('')}`;
  sel.value = cur || 'all';
}

function renderPlanetsPage() {
  const container  = byId('planets-map-inner');
  const filterOwner = byId('planet-filter-owner')?.value || 'all';
  const filterType  = byId('planet-filter-type')?.value  || 'all';
  const filterLv    = byId('planet-filter-lv')?.value    || 'all';

  // 統計
  let total=0, owned=0;
  const typeCount = {};

  let html = '';
  for (let cluster = 1; cluster <= 5; cluster++) {
    let clusterHtml = '';
    for (let galaxy = 1; galaxy <= 6; galaxy++) {
      let rowHtml = '';
      for (let num = 1; num <= 4; num++) {
        const pid   = `${cluster}-${galaxy}-${num}`;
        const p     = state.planets[pid];
        const type  = getPlanetType(pid);
        const lv    = p?.lv||1;
        const owner = p?.owner ? state.alliances.find(x => x.id===p.owner) : null;
        total++;
        if (owner) owned++;
        typeCount[type] = (typeCount[type]||0)+1;

        // フィルタ
        if (filterOwner === 'unowned' && owner) continue;
        if (filterOwner !== 'all' && filterOwner !== 'unowned' && (!owner || owner.id !== parseInt(filterOwner))) continue;
        if (filterType !== 'all' && type !== filterType) continue;
        if (filterLv !== 'all' && lv !== parseInt(filterLv)) continue;

        const ownerName = owner ? owner.name : '無所属';
        const ownerCls  = owner ? 'planet-cell-owned' : 'planet-cell-empty';
        const outStr = Object.entries(getPlanetDailyOutput(pid)).filter(([,v])=>v>0).map(([k,v])=>`${k[0]}${v}`).join(' ');
        rowHtml += `<div class="planet-cell ${ownerCls}" onclick="openPlanetDetailModal('${pid}')">
          <div class="planet-cell-id">${pid}</div>
          <span class="type-badge tb${type} planet-cell-type">${PLANET_TYPE_LABELS[type]||type}</span>
          <div class="planet-cell-lv">Lv${lv}</div>
          <div class="planet-cell-owner" title="${h(ownerName)}">${h(ownerName)}</div>
          <div class="planet-cell-output">${outStr||'—'}</div>
        </div>`;
      }
      if (!rowHtml) continue;
      clusterHtml += `<div class="galaxy-row">
        <div class="galaxy-label">
          <span class="galaxy-num">銀河${galaxy}</span>
          <span class="galaxy-grade">${GRADES[galaxy-1]}</span>
        </div>
        <div class="planet-row-cells">${rowHtml}</div>
      </div>`;
    }
    if (!clusterHtml) continue;
    html += `<div class="planet-cluster-block">
      <div class="cluster-title">
        🌌 銀河団 ${cluster}
        <span class="cluster-sub">クラス${CLASSES[cluster-1]}</span>
      </div>
      ${clusterHtml}
    </div>`;
  }

  // 統計バー更新
  const statsEl = byId('planet-stats');
  if (statsEl) {
    statsEl.innerHTML = `総数: <b>${total}</b> ／ 所有済: <b style="color:var(--green)">${owned}</b> ／ 無所属: <b style="color:var(--text-dim)">${total-owned}</b>
      &nbsp;|&nbsp; 炉:${typeCount['炉']||0} 演:${typeCount['演']||0} 資:${typeCount['資']||0} 要:${typeCount['要']||0} 未:${typeCount['未']||0}`;
  }

  container.innerHTML = html || '<div class="text-dim" style="padding:24px;text-align:center">条件に一致する惑星がありません</div>';
}

/* ============================================================
   BATTLE CALCULATOR
   ============================================================ */
function initBattleCalc() {
  ['atk','def'].forEach(side => {
    const container = byId(`bt-${side}-soldiers`);
    if (container.innerHTML.trim()) return; // 既に構築済みなら再構築しない
    container.innerHTML = SOLDIER_LV.map(sl => `
      <div class="bt-soldier-row">
        <div class="bt-lv-badge">${sl.lv}</div>
        <div class="bt-name">${h(sl.name)}</div>
        <div class="bt-power-tag">×${sl.power}</div>
        <input class="bt-input" id="bt-${side}-s${sl.lv}" type="number" min="0" value="0" oninput="calcBattle()" />
      </div>`).join('');
  });
  calcBattle();
}

function calcBattle() {
  const defBonus = parseFloat(byId('def-bonus-select')?.value ?? 1.5);
  let atkRaw = 0, defRaw = 0;
  SOLDIER_LV.forEach(sl => {
    atkRaw += (parseInt(byId(`bt-atk-s${sl.lv}`)?.value)||0) * sl.power;
    defRaw += (parseInt(byId(`bt-def-s${sl.lv}`)?.value)||0) * sl.power;
  });
  const defAdj = defRaw * defBonus;

  byId('bt-atk-total').textContent = atkRaw.toLocaleString();
  byId('bt-def-total').textContent = defRaw.toLocaleString();
  byId('br-atk-power').textContent = atkRaw.toLocaleString();
  byId('br-def-power').textContent = defAdj.toFixed(1);
  const bonusLabel = byId('br-def-bonus-label');
  if (bonusLabel) bonusLabel.textContent = `（防衛×${defBonus}補正済）`;

  const winnerEl   = byId('br-winner');
  const survivorEl = byId('br-survivors');

  if (atkRaw === 0 && defRaw === 0) {
    winnerEl.className = 'br-winner neutral';
    winnerEl.textContent = '数値を入力してください';
    survivorEl.textContent = '';
    return;
  }

  let winnerText, winnerClass, remainPower;
  if (atkRaw > defAdj) {
    remainPower = atkRaw - defAdj;
    winnerText  = '⚔️ 攻撃側勝利';
    winnerClass = 'atk-win';
  } else {
    remainPower = defAdj - atkRaw;
    winnerText  = '🛡️ 防衛側勝利';
    winnerClass = 'def-win';
  }
  winnerEl.className = `br-winner ${winnerClass}`;
  winnerEl.textContent = winnerText;
  survivorEl.textContent = '残存: ' + calcSurvivors(remainPower);
}

function calcSurvivors(power) {
  let rem = power;
  const parts = [];
  for (let i = SOLDIER_LV.length-1; i >= 0; i--) {
    const sl = SOLDIER_LV[i];
    const cnt = Math.floor(rem / sl.power);
    if (cnt > 0) { parts.push(`${sl.name}×${cnt}`); rem -= cnt * sl.power; }
  }
  if (rem >= 0.5) parts.push(`民兵×${Math.round(rem)}`);
  return parts.length ? parts.join(' ') : '全滅';
}

/* ============================================================
   RULES PAGE
   ============================================================ */
function showRulesSection(key) {
  document.querySelectorAll('.rules-nav-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.rules-section').forEach(el => el.classList.remove('active'));
  document.querySelector(`.rules-nav-item[data-key="${key}"]`)?.classList.add('active');
  byId('rules-'+key)?.classList.add('active');
}

/* ============================================================
   MODALS
   ============================================================ */
let _editAllianceId = null;

function openAddAllianceModal() {
  _editAllianceId = null;
  byId('modal-alliance-title').textContent = '✦ 連合を追加';
  byId('modal-a-name').value    = '';
  byId('modal-a-leader').value  = '';
  byId('modal-a-members').value = '40';
  openModal('modal-alliance');
}

function openEditAllianceModal(id) {
  const a = state.alliances.find(x => x.id === id);
  if (!a) return;
  _editAllianceId = id;
  byId('modal-alliance-title').textContent = '✦ 連合を編集';
  byId('modal-a-name').value    = a.name;
  byId('modal-a-leader').value  = a.leader;
  byId('modal-a-members').value = a.members;
  openModal('modal-alliance');
}

function submitAllianceModal() {
  const name    = byId('modal-a-name').value.trim();
  const leader  = byId('modal-a-leader').value.trim();
  const members = Math.min(80, Math.max(10, parseInt(byId('modal-a-members').value)||40));
  if (!name) { toast('連合名を入力してください'); return; }

  if (_editAllianceId !== null) {
    const a = state.alliances.find(x => x.id === _editAllianceId);
    if (a) { a.name=name; a.leader=leader; a.members=members; }
    toast('連合情報を更新しました');
  } else {
    const a = makeAlliance(name);
    a.leader=leader; a.members=members;
    state.alliances.push(a);
    state.selectedId = a.id;
    toast(`「${name}」を追加しました`);
  }
  closeModal('modal-alliance');
  renderAll();
}

/* --- Assign Planet --- */
let _assignPlanetAllianceId = null;

function openAssignPlanetModal(allianceId) {
  _assignPlanetAllianceId = allianceId;
  const free = Object.entries(state.planets)
    .filter(([,v]) => v.owner === null)
    .map(([pid]) => pid)
    .sort((a,b) => {
      const [ac,ag,an] = a.split('-').map(Number);
      const [bc,bg,bn] = b.split('-').map(Number);
      return ac!==bc ? ac-bc : ag!==bg ? ag-bg : an-bn;
    });
  if (!free.length) { toast('割り当て可能な惑星がありません'); return; }
  const sel = byId('modal-ap-planet');
  sel.innerHTML = free.map(pid => {
    const type = getPlanetType(pid);
    return `<option value="${pid}">${pid} — ${PLANET_TYPE_LABELS[type]}</option>`;
  }).join('');
  openModal('modal-assign-planet');
}

function submitAssignPlanetModal() {
  const a = state.alliances.find(x => x.id === _assignPlanetAllianceId);
  if (!a) return;
  const pid = byId('modal-ap-planet').value;
  const p   = state.planets[pid];
  if (!p) return;
  if (p.owner !== null) { toast('その惑星は既に所有されています'); return; }
  p.owner = a.id;
  closeModal('modal-assign-planet');
  renderAll();
  toast(`惑星 ${pid} を ${a.name} に割り当てました`);
}

/* --- Planet Detail --- */
function openPlanetDetailModal(planetId) {
  const p    = state.planets[planetId];
  const type = getPlanetType(planetId);
  const lv   = p?.lv||1;
  const owner= p?.owner ? state.alliances.find(x=>x.id===p.owner) : null;
  const out  = getPlanetDailyOutput(planetId);
  const outStr = Object.entries(out).filter(([,v])=>v>0).map(([k,v])=>`${k}: ${v}`).join(' / ');

  byId('modal-pd-title').textContent  = `惑星 ${planetId}`;
  byId('modal-pd-type').textContent   = PLANET_TYPE_LABELS[type]||type;
  byId('modal-pd-lv').textContent     = `Lv${lv} ${PLANET_LV[lv-1].name}`;
  byId('modal-pd-owner').textContent  = owner ? owner.name : '無所属';
  byId('modal-pd-output').textContent = outStr || '産出なし';

  const ownerSel = byId('modal-pd-owner-sel');
  ownerSel.innerHTML = `<option value="">無所属</option>`
    + state.alliances.map(a=>`<option value="${a.id}"${a.id===p?.owner?' selected':''}>${h(a.name)}</option>`).join('');

  const lvSel = byId('modal-pd-lv-sel');
  lvSel.innerHTML = PLANET_LV.map(l=>
    `<option value="${l.lv}"${lv===l.lv?' selected':''}>${l.lv} ${l.name}（×${l.mult}）</option>`
  ).join('');

  byId('modal-pd-planet-id').value = planetId;
  openModal('modal-planet-detail');
}

function submitPlanetDetailModal() {
  const pid   = byId('modal-pd-planet-id').value;
  const p     = state.planets[pid];
  if (!p) return;
  const newOwner = byId('modal-pd-owner-sel').value;
  const newLv    = parseInt(byId('modal-pd-lv-sel').value);
  p.owner = newOwner ? parseInt(newOwner) : null;
  p.lv    = newLv;
  if (p.owner) {
    const a = state.alliances.find(x=>x.id===p.owner);
    if (a && p.lv > a.civLv) toast(`⚠️ 惑星Lv(${p.lv})が文明Lv(${a.civLv})を超えています`);
  }
  closeModal('modal-planet-detail');
  renderAll();
  renderPlanetsPage();
  toast(`惑星 ${pid} を更新しました`);
}

/* --- Diplomacy --- */
let _diploAllianceId = null, _diploType = null;

function openDiploModal(allianceId, type) {
  _diploAllianceId = allianceId;
  _diploType = type;
  const labels = {normal:'通常同盟',vassal:'属国同盟',secret:'秘密協定（暗黒×2消費）',war:'宣戦布告'};
  byId('modal-diplo-title').textContent = `✦ ${labels[type]}`;
  const a = state.alliances.find(x=>x.id===allianceId);
  const opts = state.alliances
    .filter(x=>x.id!==allianceId && !a.allies.find(al=>al.targetId===x.id))
    .map(x=>`<option value="${x.id}">${h(x.name)}</option>`).join('');
  if (!opts) { toast('対象となる連合がありません'); return; }
  byId('modal-diplo-target').innerHTML = opts;
  openModal('modal-diplo');
}

function submitDiploModal() {
  const a = state.alliances.find(x=>x.id===_diploAllianceId);
  const targetId = parseInt(byId('modal-diplo-target').value);
  const target   = state.alliances.find(x=>x.id===targetId);
  if (!a||!target) return;
  if (_diploType === 'secret') {
    if (a.res.暗黒 < 2) { toast('⚠️ 暗黒物質が足りません（必要:2）'); return; }
    a.res.暗黒 -= 2;
  }
  a.allies.push({targetId, type:_diploType, targetName:target.name});
  closeModal('modal-diplo');
  renderAll();
  toast(`${a.name} ↔ ${target.name} 外交締結`);
}

/* --- Generic --- */
function openModal(id)  { byId(id).classList.add('open'); }
function closeModal(id) { byId(id).classList.remove('open'); }
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
});

/* ── Init 30 alliances with default planets ─────────────── */
function initAllAlliances() {
  // クラス A→銀河団1, B→2, C→3, D→4, E→5
  // 学年 中1→銀河1, 中2→2, 中3→3, 高1→4, 高2→5, 高3→6
  // デフォルト惑星: 惑星番号1 (資源型)
  GRADES.forEach((grade, gi) => {
    CLASSES.forEach((cls, ci) => {
      const a = makeAlliance(`${grade}${cls}クラス連合`);
      a.members = 40;
      state.alliances.push(a);

      const pid = `${ci+1}-${gi+1}-1`;
      if (state.planets[pid]) {
        state.planets[pid].owner = a.id;
        state.planets[pid].lv   = 1;
      }
    });
  });
}

/* ── Bootstrap ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initStarfield();
  initPlanets();
  initAllAlliances();
  showPage('alliances');
  renderAllianceList();
  renderSummaryPanel();
});
