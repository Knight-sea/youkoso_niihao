/* ====================================================
   COTE-OS ADVANCED · Application Logic v2
   Features: Multi-slot saves, blank init, custom class
   names, multi-select bulk PP, Japanese UI, home PP dist
   ==================================================== */

'use strict';

// ══════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════

const GRADES    = [1, 2, 3, 4, 5, 6];
const CLASS_IDS = [0, 1, 2, 3, 4];
const DISPLAY_CLASS = ['α', 'β', 'γ', 'δ', 'ε'];
const RANK_LABELS   = ['A', 'B', 'C', 'D', 'E'];
const STATS_KEYS    = ['language', 'reasoning', 'memory', 'thinking', 'physical', 'mental'];

// Japanese UI labels
const JP = {
  // Stats
  language:  '言語力',
  reasoning: '推論力',
  memory:    '記憶力',
  thinking:  '思考力',
  physical:  '身体能力',
  mental:    '精神力',
  // Profile fields
  name:        '氏名',
  gender:      '性別',
  dob:         '生年月日',
  grade:       '学年',
  class:       'クラス',
  pp:          'プライベートポイント',
  protect:     'プロテクトポイント',
  specialAbility: '特殊能力',
  contracts:   'コントラクト',
  // Status
  active:      '在籍',
  expelled:    '退学',
  graduate:    '卒業生',
  incoming:    '入学予定',
  // Gender
  male:  '男',
  female:'女',
  // Buttons
  save:   'セーブ',
  cancel: 'キャンセル',
  confirm:'確認',
  expel:  '退学処分',
  reinstate: '復帰',
  addContract: '追加',
  // Pages
  home:    'ホーム',
  gradeN:  (n) => `${n}年生`,
  graduates: '卒業生',
  incoming:  '入学予定',
  // Actions
  distributeAll: 'クラス全員にPP配布',
  bulkPP:        '一括PP操作',
  selectAll:     '全選択',
  deselectAll:   '選択解除',
  selectMode:    '選択モード',
  applyBulkPP:   'PP付与',
};

const MONTHS_JP = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const HISTORY_MAX = 60;
const NUM_SLOTS   = 5;

// Slot storage keys
function slotKey(n) { return `CoteOS_Slot${n}`; }

// ══════════════════════════════════════════════════
// RUNTIME STATE
// ══════════════════════════════════════════════════

let currentSlot = 1;  // active save slot (1-5)

// In-memory game state (swapped when switching slots)
let state = newEmptyState();

// UI transient state (not saved)
let navStack    = [];
let selectMode  = false;
let selectedIds = new Set();

// ══════════════════════════════════════════════════
// STATE FACTORY
// ══════════════════════════════════════════════════

function newEmptyState() {
  return {
    year: 1,
    month: 4,
    students: [],
    classes:  [],
    history:  [],
    nextId:   1,
  };
}

// ══════════════════════════════════════════════════
// UTILITIES
// ══════════════════════════════════════════════════

function uid() {
  const id = 'S' + String(state.nextId).padStart(5, '0');
  state.nextId++;
  return id;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDate(y, m) {
  return `Year ${y} · ${MONTHS_JP[m - 1]}`;
}

function getClass(grade, classId) {
  return state.classes.find(c => c.grade === grade && c.classId === classId);
}

function getStudentsOfClass(grade, classId) {
  return state.students.filter(s => s.grade === grade && s.classId === classId);
}

function getRankedClasses(grade) {
  return state.classes
    .filter(c => c.grade === grade)
    .slice()
    .sort((a, b) => {
      if (b.classPoints !== a.classPoints) return b.classPoints - a.classPoints;
      return a.classId - b.classId;
    });
}

function getRankLabel(grade, classId) {
  const ranked = getRankedClasses(grade);
  const idx    = ranked.findIndex(c => c.classId === classId);
  return idx >= 0 ? RANK_LABELS[idx] : '?';
}

function getClassName(grade, classId) {
  const cls = getClass(grade, classId);
  if (cls && cls.customName) return cls.customName;
  const rank = getRankLabel(grade, classId);
  return `${grade}年${rank}組`;
}

function showToast(msg, duration = 2400) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('visible'), duration);
}

function rankClass(r)  { return 'rank-' + r; }

function formatPP(val) {
  if (Math.abs(val) >= 1000000) return (val / 1000000).toFixed(1) + 'M';
  if (Math.abs(val) >= 1000)    return (val / 1000).toFixed(1) + 'K';
  return val.toString();
}

function ppColorClass(val) {
  return val > 0 ? 'positive' : val < 0 ? 'negative' : 'neutral';
}

// ══════════════════════════════════════════════════
// DATA GENERATION — BLANK SLATE
// ══════════════════════════════════════════════════

function createBlankStudent(grade, classId, seqNum) {
  const stats = {};
  STATS_KEYS.forEach(k => { stats[k] = 1; });

  return {
    id:             uid(),
    name:           '',          // blank
    gender:         'M',
    dob:            '',
    grade,
    classId,
    stats,
    specialAbility: '',
    privatePoints:  0,
    protectPoints:  0,
    contracts:      [],
    isExpelled:     false,
  };
}

function createBlankClass(grade, classId) {
  return {
    grade,
    classId,
    classPoints: 0,
    customName:  '',            // editable
  };
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
      state.classes.push(createBlankClass(grade, classId));
      for (let i = 0; i < 40; i++) {
        state.students.push(createBlankStudent(grade, classId, i));
      }
    });
  });
}

// ══════════════════════════════════════════════════
// PERSISTENCE — MULTI-SLOT
// ══════════════════════════════════════════════════

function saveState(silent = false) {
  try {
    localStorage.setItem(slotKey(currentSlot), JSON.stringify(state));
    updateSlotButtons();
    if (!silent) showToast(`✓ スロット${currentSlot}にセーブしました`);
  } catch (e) {
    showToast('✗ セーブ失敗: ' + e.message);
  }
}

function loadState(slot) {
  const raw = localStorage.getItem(slotKey(slot));
  if (!raw) return false;
  try {
    const loaded = JSON.parse(raw);
    // Deep-copy to prevent reference sharing, then free old memory
    state = loaded;
    return true;
  } catch (e) {
    console.warn('Load failed for slot', slot, e);
    return false;
  }
}

function slotHasData(slot) {
  return localStorage.getItem(slotKey(slot)) !== null;
}

function resetCurrentSlot() {
  localStorage.removeItem(slotKey(currentSlot));
  state = newEmptyState();
  generateInitialData();
  saveState(true);
}

// Switch active slot — clear memory first, then load
function switchSlot(newSlot) {
  if (newSlot === currentSlot) return;

  // Save current slot before leaving
  saveState(true);

  // Clear active memory explicitly
  state = null;

  currentSlot = newSlot;
  selectMode  = false;
  selectedIds = new Set();
  navStack    = [];

  const loaded = loadState(currentSlot);
  if (!loaded) {
    state = newEmptyState();
    generateInitialData();
    saveState(true);
  }

  updateSlotButtons();
  updateDateDisplay();
  navigate('home', {}, true);
  showToast(`スロット${currentSlot}に切り替えました`);
}

function updateSlotButtons() {
  document.querySelectorAll('.slot-btn').forEach(btn => {
    const n = parseInt(btn.dataset.slot);
    btn.classList.toggle('active', n === currentSlot);
    btn.classList.toggle('has-data', slotHasData(n));
  });
}

// ══════════════════════════════════════════════════
// TIME SYSTEM
// ══════════════════════════════════════════════════

function getContractSums(studentId) {
  let gains = 0, losses = 0;
  const student = state.students.find(s => s.id === studentId);
  if (!student) return { gains, losses };

  student.contracts.forEach(c => { losses += c.amount; });

  state.students.forEach(s => {
    s.contracts.forEach(c => {
      if (c.targetId === studentId) gains += c.amount;
    });
  });
  return { gains, losses };
}

function snapshotHistory() {
  const snap = {
    year:          state.year,
    month:         state.month,
    classPoints:   state.classes.map(c => ({ grade: c.grade, classId: c.classId, cp: c.classPoints })),
    studentPP:     state.students.map(s => ({ id: s.id, pp: s.privatePoints })),
    studentGrades: state.students.map(s => ({ id: s.id, grade: s.grade, classId: s.classId })),
  };
  state.history.unshift(snap);
  if (state.history.length > HISTORY_MAX) state.history.pop();
}

function advanceMonth() {
  snapshotHistory();

  const isMarchToApril = (state.month === 3);
  if (isMarchToApril) doGradeAdvancement();

  // PP update for all students
  state.students.forEach(s => {
    const cls      = state.classes.find(c => c.grade === s.grade && c.classId === s.classId);
    const cpBonus  = cls ? cls.classPoints * 100 : 0;
    const { gains, losses } = getContractSums(s.id);
    s.privatePoints += cpBonus + gains - losses;
  });

  state.month++;
  if (state.month > 12) { state.month = 1; state.year++; }

  saveState(true);
  renderApp();
  showToast(`⏩ ${formatDate(state.year, state.month)} へ進みました`);
}

function doGradeAdvancement() {
  // Grade 6 → Graduate
  state.students.forEach(s => { if (s.grade === 6) s.grade = 'Graduate'; });
  // 5→6, 4→5 … 1→2
  for (let g = 5; g >= 1; g--) {
    state.students.forEach(s => { if (s.grade === g) s.grade = g + 1; });
  }
  // Incoming → Grade 1
  state.students.forEach(s => { if (s.grade === 'Incoming') s.grade = 1; });

  // Rebuild classes: shift grades 1-5 → 2-6, add new grade-1 blank classes
  const newClasses = [];
  state.classes.forEach(c => {
    if (c.grade < 6) {
      newClasses.push({ ...c, grade: c.grade + 1 });
    }
    // grade 6 classes are dropped (students already moved to Graduate)
  });
  CLASS_IDS.forEach(id => newClasses.push(createBlankClass(1, id)));
  state.classes = newClasses;
}

function revertMonth() {
  if (state.history.length === 0) {
    showToast('✗ 履歴がありません');
    return;
  }

  const snap            = state.history.shift();
  const isAprilToMarch  = (state.month === 4);

  if (isAprilToMarch) undoGradeAdvancement(snap);

  // Revert PP
  snap.studentPP.forEach(entry => {
    const s = state.students.find(st => st.id === entry.id);
    if (s) s.privatePoints = entry.pp;
  });

  // Revert time
  state.month--;
  if (state.month < 1) { state.month = 12; state.year = Math.max(1, state.year - 1); }

  // Revert CP
  snap.classPoints.forEach(entry => {
    const c = state.classes.find(cl => cl.grade === entry.grade && cl.classId === entry.classId);
    if (c) c.classPoints = entry.cp;
  });

  saveState(true);
  renderApp();
  showToast(`⏪ ${formatDate(state.year, state.month)} に戻しました`);
}

function undoGradeAdvancement(snap) {
  snap.studentGrades.forEach(entry => {
    const s = state.students.find(st => st.id === entry.id);
    if (s) { s.grade = entry.grade; s.classId = entry.classId; }
  });
  // Revert class structure from snapshot
  state.classes = snap.classPoints.map(e => {
    const existing = state.classes.find(c => c.grade === e.grade && c.classId === e.classId);
    return existing
      ? { ...existing, grade: e.grade, classId: e.classId, classPoints: e.cp }
      : createBlankClass(e.grade, e.classId);
  });
}

// ══════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════

function navigate(page, params = {}, reset = false) {
  if (reset) navStack = [];
  navStack.push({ page, params });
  renderPage(page, params);
  updateBreadcrumb();
}

function navigateBack() {
  if (navStack.length <= 1) return;
  navStack.pop();
  const prev = navStack[navStack.length - 1];
  // Exit select mode on back
  selectMode  = false;
  selectedIds = new Set();
  renderPage(prev.page, prev.params);
  updateBreadcrumb();
}

window.navTo = function(idx) {
  navStack    = navStack.slice(0, idx + 1);
  selectMode  = false;
  selectedIds = new Set();
  const n = navStack[navStack.length - 1];
  renderPage(n.page, n.params);
  updateBreadcrumb();
};

function getPageLabel(n) {
  switch (n.page) {
    case 'home':      return 'ホーム';
    case 'grade':     return JP.gradeN(n.params.grade);
    case 'class':     return getClassName(n.params.grade, n.params.classId);
    case 'graduates': return JP.graduates;
    case 'incoming':  return JP.incoming;
    case 'profile': {
      const s = state.students.find(st => st.id === n.params.studentId);
      return s ? (s.name || s.id) : 'プロフィール';
    }
    default: return n.page.toUpperCase();
  }
}

function updateBreadcrumb() {
  const bc = document.getElementById('breadcrumb');
  if (!bc) return;
  const parts = navStack.map((n, i) => {
    if (i === navStack.length - 1) return `<span>${getPageLabel(n)}</span>`;
    return `<a onclick="navTo(${i})">${getPageLabel(n)}</a>`;
  });
  bc.innerHTML = parts.join(' <span style="color:var(--text-dim)">›</span> ');
}

// ══════════════════════════════════════════════════
// RENDER ENGINE
// ══════════════════════════════════════════════════

function renderApp() {
  updateDateDisplay();
  const current = navStack[navStack.length - 1];
  if (current) renderPage(current.page, current.params);
  else navigate('home', {}, true);
}

function updateDateDisplay() {
  const el = document.getElementById('date-display');
  if (el) el.textContent = formatDate(state.year, state.month);
}

function renderPage(page, params) {
  const app = document.getElementById('app');

  switch (page) {
    case 'home':      app.innerHTML = renderHomePage();                              break;
    case 'grade':     app.innerHTML = renderGradePage(params.grade);                break;
    case 'class':     app.innerHTML = renderClassPage(params.grade, params.classId);break;
    case 'profile':   app.innerHTML = renderProfilePage(params.studentId);          break;
    case 'graduates': app.innerHTML = renderSpecialPage('Graduate');                break;
    case 'incoming':  app.innerHTML = renderSpecialPage('Incoming');                break;
    default:          app.innerHTML = `<p style="color:var(--red)">ページが見つかりません</p>`;
  }

  attachPageHandlers(page, params);
}

// ══════════════════════════════════════════════════
// HOME PAGE
// ══════════════════════════════════════════════════

function renderHomePage() {
  let html = `
    <div class="slot-info-bar">
      <span class="slot-badge">スロット ${currentSlot}</span>
      <span>${formatDate(state.year, state.month)}</span>
      <span style="margin-left:auto;color:var(--text-dim)">${state.students.filter(s=>typeof s.grade==='number').length} 名在籍</span>
    </div>
    <div class="page-header">
      <span class="page-title">システム概要</span>
      <span class="page-subtitle">6学年・5クラス統合管理</span>
    </div>
    <div id="home-grid">
  `;

  GRADES.forEach(grade => {
    const ranked = getRankedClasses(grade);
    html += `
      <div class="grade-row">
        <div class="grade-row-header" onclick="navigate('grade', {grade:${grade}}, false)">
          <span class="grade-label">${JP.gradeN(grade)}</span>
          <span style="font-size:0.68rem;color:var(--text-dim)">▶ 詳細</span>
        </div>
        <div class="grade-classes-strip">
    `;

    ranked.forEach((cls, rankIdx) => {
      const rank      = RANK_LABELS[rankIdx];
      const clsName   = getClassName(grade, cls.classId);
      html += `
        <div class="class-card-mini" onclick="navigate('class',{grade:${grade},classId:${cls.classId}},false)">
          <span class="rank-badge ${rankClass(rank)}">${rank}</span>
          <div class="class-name">${escHtml(clsName)}</div>
          <div class="cp-value">${cls.classPoints.toLocaleString()}</div>
          <div class="cp-label">CP</div>
          <div class="home-dist-row" onclick="event.stopPropagation()">
            <input class="home-dist-input" type="number" id="dist-${grade}-${cls.classId}"
              placeholder="PP" title="${JP.distributeAll}" />
            <button class="home-dist-btn"
              onclick="homeDistributePP(${grade},${cls.classId})">配布</button>
          </div>
        </div>
      `;
    });

    html += `</div></div>`;
  });

  // Graduates / Incoming tiles
  const graduates = state.students.filter(s => s.grade === 'Graduate');
  const incoming  = state.students.filter(s => s.grade === 'Incoming');

  html += `
    </div>
    <div style="display:flex;gap:10px;margin-top:10px;">
      <div class="special-tile" style="border-color:var(--yellow);color:var(--yellow)"
           onclick="navigate('graduates',{},false)">
        <div class="st-count">${graduates.length}</div>
        <div class="st-label">${JP.graduates}</div>
      </div>
      <div class="special-tile" style="border-color:var(--accent);color:var(--accent)"
           onclick="navigate('incoming',{},false)">
        <div class="st-count">${incoming.length}</div>
        <div class="st-label">${JP.incoming}</div>
      </div>
    </div>
  `;

  // History
  if (state.history.length > 0) {
    html += `
      <div class="history-panel mt-12">
        <div class="section-title">最近の履歴 (${state.history.length}件)</div>
        <table class="history-table">
          <thead><tr><th>日付</th><th>内容</th></tr></thead>
          <tbody>
            ${state.history.slice(0, 8).map(h =>
              `<tr><td>${formatDate(h.year, h.month)}</td><td>スナップショット (${h.classPoints.length}クラス)</td></tr>`
            ).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  return html;
}

window.homeDistributePP = function(grade, classId) {
  const input = document.getElementById(`dist-${grade}-${classId}`);
  const amount = parseInt(input?.value);
  if (isNaN(amount)) { showToast('✗ 有効な数値を入力してください'); return; }

  const clsName = getClassName(grade, classId);
  const students = getStudentsOfClass(grade, classId).filter(s => !s.isExpelled);

  openModal(`
    <div class="confirm-dialog">
      <div class="section-title">${JP.distributeAll}</div>
      <p><strong>${escHtml(clsName)}</strong> の全生徒 (${students.length}名) に<br>
         <strong style="color:${amount >= 0 ? 'var(--green)' : 'var(--red)'}">
           ${amount >= 0 ? '+' : ''}${amount.toLocaleString()} PP
         </strong> を配布しますか？</p>
      <div class="btn-row">
        <button class="btn-sm accent-btn" onclick="execHomeDistribute(${grade},${classId},${amount})">実行</button>
        <button class="btn-sm" onclick="closeModal()">${JP.cancel}</button>
      </div>
    </div>
  `);
};

window.execHomeDistribute = function(grade, classId, amount) {
  const students = getStudentsOfClass(grade, classId).filter(s => !s.isExpelled);
  students.forEach(s => { s.privatePoints += amount; });
  closeModal();
  saveState(true);
  renderApp();
  showToast(`✓ ${students.length}名に ${amount >= 0 ? '+' : ''}${amount.toLocaleString()} PP を配布しました`);
};

// ══════════════════════════════════════════════════
// GRADE PAGE
// ══════════════════════════════════════════════════

function renderGradePage(grade) {
  const ranked = getRankedClasses(grade);

  let html = `
    <button class="page-back-btn" onclick="navigateBack()">◀ 戻る</button>
    <div class="page-header">
      <span class="page-title">${JP.gradeN(grade)}</span>
      <span class="page-subtitle">クラス順位 · ${formatDate(state.year, state.month)}</span>
    </div>
    <div id="grade-page">
  `;

  ranked.forEach((cls, rankIdx) => {
    const rank     = RANK_LABELS[rankIdx];
    const clsName  = getClassName(grade, cls.classId);
    const students = getStudentsOfClass(grade, cls.classId).filter(s => !s.isExpelled);
    const keyPersons = students.slice(0, 5);

    html += `
      <div class="class-row rank-border-${rank}">
        <div class="class-row-header"
             onclick="navigate('class',{grade:${grade},classId:${cls.classId}},false)">
          <div class="class-rank-label ${rankClass(rank)}">${rank}</div>
          <div class="class-info">
            <span class="class-name-lg">${escHtml(clsName)}</span>
            <span class="class-cp">${cls.classPoints.toLocaleString()}<span>CP</span></span>
          </div>
          <div style="display:flex;gap:14px;font-size:0.72rem;color:var(--text-dim);margin-left:auto">
            <span>${students.length}/40名</span>
            <span>▶ クラスへ</span>
          </div>
        </div>
        <div class="key-persons-strip">
    `;

    if (keyPersons.length === 0) {
      html += `<span style="color:var(--text-dim);font-size:0.72rem;padding:8px">生徒なし</span>`;
    }

    keyPersons.forEach(s => {
      const ppCls = s.privatePoints >= 0 ? 'pp-val' : 'pp-val negative';
      html += `
        <div class="kp-card" onclick="navigate('profile',{studentId:'${s.id}'},false)">
          <div class="kp-name">${escHtml(s.name) || s.id}</div>
          <div class="kp-stats">
            <div class="kp-stat">
              <span class="val ${ppCls}">${formatPP(s.privatePoints)}</span>
              <span class="lbl">PP</span>
            </div>
            <div class="kp-stat">
              <span class="val protect-val">${s.protectPoints}</span>
              <span class="lbl">保護</span>
            </div>
          </div>
        </div>
      `;
    });

    html += `</div></div>`;
  });

  html += `</div>`;
  return html;
}

// ══════════════════════════════════════════════════
// CLASS PAGE
// ══════════════════════════════════════════════════

function renderClassPage(grade, classId) {
  const cls      = getClass(grade, classId);
  const rank     = getRankLabel(grade, classId);
  const clsName  = getClassName(grade, classId);
  const allStudents    = getStudentsOfClass(grade, classId);
  const activeStudents = allStudents.filter(s => !s.isExpelled);
  const expelled       = allStudents.filter(s => s.isExpelled);

  const selCount = selectedIds.size;

  let html = `
    <button class="page-back-btn" onclick="navigateBack()">◀ 戻る</button>

    <div class="class-page-header-bar">
      <div>
        <div class="page-header" style="margin-bottom:6px">
          <span class="page-title">${escHtml(clsName)}</span>
          <span class="class-rank-label ${rankClass(rank)}" style="font-size:1.3rem;font-family:var(--font-display)">順位 ${rank}</span>
        </div>
        <div class="class-name-editor">
          <label>クラス名：</label>
          <input class="class-name-input" id="cls-custom-name"
            value="${escHtml(cls?.customName || '')}"
            placeholder="${grade}年${rank}組 (規定名)" />
          <button class="btn-sm" onclick="saveClassName(${grade},${classId})">変更</button>
        </div>
      </div>
      <div class="cp-editor">
        <label>クラスポイント：</label>
        <input type="number" id="cp-input" value="${cls ? cls.classPoints : 0}" />
        <button class="btn-sm" onclick="updateCP(${grade},${classId})">設定</button>
        <button class="btn-sm" onclick="adjustCP(${grade},${classId},100)">+100</button>
        <button class="btn-sm" onclick="adjustCP(${grade},${classId},-100)">-100</button>
      </div>
    </div>

    <!-- BULK ACTION BAR -->
    <div class="bulk-action-bar">
      <label>${JP.bulkPP}：</label>
      <button class="btn-sm ${selectMode ? 'active-mode' : ''}"
        onclick="toggleSelectMode(${grade},${classId})">
        ${selectMode ? '✓ ' : ''}${JP.selectMode}
      </button>
      ${selectMode ? `
        <button class="btn-sm" onclick="selectAllStudents(${grade},${classId})">全選択</button>
        <button class="btn-sm" onclick="deselectAllStudents()">解除</button>
        <span class="select-count">${selCount}名選択中</span>
        <input type="number" id="bulk-pp-amount" placeholder="PP 量" style="width:90px" />
        <button class="btn-sm accent-btn" onclick="applyBulkPP(${grade},${classId})">
          ${JP.applyBulkPP}
        </button>
      ` : ''}
    </div>

    <div class="search-bar">
      <input type="text" id="student-search" placeholder="生徒を検索..." oninput="filterStudents()" />
    </div>

    <div id="students-grid" class="students-grid ${selectMode ? 'select-mode' : ''}">
      ${renderStudentCards(activeStudents)}
    </div>
  `;

  if (expelled.length > 0) {
    html += `
      <div class="alt-students-header">
        <span>退学処分 (${expelled.length}名)</span><hr />
      </div>
      <div class="students-grid ${selectMode ? 'select-mode' : ''}">
        ${renderStudentCards(expelled)}
      </div>
    `;
  }

  html += `
    <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">
      <button class="btn-sm" onclick="addNewStudent(${grade},${classId})">+ 生徒を追加</button>
    </div>
  `;

  return html;
}

function renderStudentCards(students) {
  if (!students.length) return `<div style="color:var(--text-dim);font-size:0.72rem;grid-column:1/-1;padding:8px">生徒なし</div>`;

  return students.map(s => {
    const ppCls  = ppColorClass(s.privatePoints);
    const isSel  = selectedIds.has(s.id);
    return `
      <div class="student-card ${s.isExpelled ? 'expelled' : ''} ${isSel ? 'selected' : ''}"
           data-id="${s.id}" data-name="${escAttr(s.name.toLowerCase())}"
           onclick="handleStudentCardClick('${s.id}')">
        <div class="select-check">${isSel ? '✓' : ''}</div>
        <span class="s-id">${s.id}</span>
        <div class="s-name">${escHtml(s.name) || '<span style="color:var(--text-dim)">(未記入)</span>'}</div>
        <div class="s-stats-row">
          <div class="s-stat">
            <span class="v ${ppCls}">${formatPP(s.privatePoints)}</span>
            <span class="l">PP</span>
          </div>
          <div class="s-stat">
            <span class="v" style="color:var(--yellow)">${s.protectPoints}</span>
            <span class="l">保護</span>
          </div>
          <div class="s-stat">
            <span class="v" style="color:var(--text-secondary)">${s.gender === 'M' ? JP.male : JP.female}</span>
            <span class="l">性</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.handleStudentCardClick = function(studentId) {
  if (selectMode) {
    if (selectedIds.has(studentId)) selectedIds.delete(studentId);
    else selectedIds.add(studentId);
    // Partial re-render of grid only
    const current = navStack[navStack.length - 1];
    if (current) renderPage(current.page, current.params);
  } else {
    navigate('profile', { studentId }, false);
  }
};

window.toggleSelectMode = function(grade, classId) {
  selectMode  = !selectMode;
  selectedIds = new Set();
  renderPage('class', { grade, classId });
};

window.selectAllStudents = function(grade, classId) {
  const students = getStudentsOfClass(grade, classId).filter(s => !s.isExpelled);
  students.forEach(s => selectedIds.add(s.id));
  renderPage('class', { grade, classId });
};

window.deselectAllStudents = function() {
  selectedIds = new Set();
  const current = navStack[navStack.length - 1];
  if (current) renderPage(current.page, current.params);
};

window.applyBulkPP = function(grade, classId) {
  const amount = parseInt(document.getElementById('bulk-pp-amount')?.value);
  if (isNaN(amount)) { showToast('✗ 有効な数値を入力してください'); return; }
  if (selectedIds.size === 0) { showToast('✗ 生徒が選択されていません'); return; }

  openModal(`
    <div class="confirm-dialog">
      <div class="section-title">${JP.bulkPP}</div>
      <p>選択中の <strong>${selectedIds.size}名</strong> に<br>
         <strong style="color:${amount >= 0 ? 'var(--green)' : 'var(--red)'}">
           ${amount >= 0 ? '+' : ''}${amount.toLocaleString()} PP
         </strong> を付与しますか？</p>
      <div class="btn-row">
        <button class="btn-sm accent-btn" onclick="execBulkPP(${grade},${classId},${amount})">実行</button>
        <button class="btn-sm" onclick="closeModal()">${JP.cancel}</button>
      </div>
    </div>
  `);
};

window.execBulkPP = function(grade, classId, amount) {
  let count = 0;
  selectedIds.forEach(id => {
    const s = state.students.find(st => st.id === id);
    if (s) { s.privatePoints += amount; count++; }
  });
  selectedIds = new Set();
  selectMode  = false;
  closeModal();
  saveState(true);
  renderPage('class', { grade, classId });
  showToast(`✓ ${count}名に ${amount >= 0 ? '+' : ''}${amount.toLocaleString()} PP を付与しました`);
};

window.saveClassName = function(grade, classId) {
  const input = document.getElementById('cls-custom-name');
  const name  = input?.value?.trim() || '';
  const cls   = getClass(grade, classId);
  if (cls) { cls.customName = name; }
  saveState(true);
  renderApp();
  showToast('✓ クラス名を変更しました');
};

window.filterStudents = function() {
  const query = document.getElementById('student-search')?.value?.toLowerCase() || '';
  document.querySelectorAll('.student-card[data-name]').forEach(card => {
    card.style.display = card.dataset.name.includes(query) ? '' : 'none';
  });
};

window.updateCP = function(grade, classId) {
  const val = parseInt(document.getElementById('cp-input')?.value);
  if (isNaN(val)) return;
  const cls = getClass(grade, classId);
  if (cls) { cls.classPoints = val; saveState(true); renderApp(); }
};

window.adjustCP = function(grade, classId, delta) {
  const cls = getClass(grade, classId);
  if (cls) {
    cls.classPoints += delta;
    const inp = document.getElementById('cp-input');
    if (inp) inp.value = cls.classPoints;
    saveState(true);
    renderApp();
  }
};

window.addNewStudent = function(grade, classId) {
  const s = createBlankStudent(grade, classId, 0);
  state.students.push(s);
  saveState(true);
  renderApp();
  showToast('✓ 生徒を追加しました: ' + s.id);
};

// ══════════════════════════════════════════════════
// PROFILE PAGE — FULLY JAPANESE
// ══════════════════════════════════════════════════

function renderProfilePage(studentId) {
  const s = state.students.find(st => st.id === studentId);
  if (!s) return `<p style="color:var(--red)">生徒が見つかりません</p>`;

  const ppCls  = s.privatePoints >= 0 ? 'pos' : 'neg';
  const statusLabel  = s.isExpelled ? JP.expelled :
                       s.grade === 'Graduate' ? JP.graduate :
                       s.grade === 'Incoming' ? JP.incoming : JP.active;
  const statusBadge  = s.isExpelled ? 'expelled' :
                       s.grade === 'Graduate' ? 'graduate' :
                       s.grade === 'Incoming' ? 'incoming' : 'active';

  const gradeDisplay = typeof s.grade === 'number' ? JP.gradeN(s.grade) : statusLabel;
  const clsDisplay   = typeof s.grade === 'number' ? getClassName(s.grade, s.classId) : '―';

  // Stat bars (sidebar display)
  const statBars = STATS_KEYS.map(k => {
    const val = s.stats[k] || 1;
    const pct = ((val - 1) / 14) * 100;
    return `
      <div class="stat-bar-row">
        <span class="stat-bar-label">${JP[k]}</span>
        <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
        <span class="stat-bar-val">${val}</span>
      </div>
    `;
  }).join('');

  // Grade options
  const gradeOpts = [
    ...GRADES.map(g => `<option value="${g}" ${s.grade === g ? 'selected' : ''}>${JP.gradeN(g)}</option>`),
    `<option value="Graduate" ${s.grade === 'Graduate' ? 'selected' : ''}>${JP.graduate}</option>`,
    `<option value="Incoming" ${s.grade === 'Incoming' ? 'selected' : ''}>${JP.incoming}</option>`,
  ].join('');

  const classOpts = CLASS_IDS.map(id =>
    `<option value="${id}" ${s.classId === id ? 'selected' : ''}>${displayClassName(s.grade, id)}</option>`
  ).join('');

  // Outgoing contracts
  const outgoingHtml = s.contracts.length === 0
    ? `<div style="color:var(--text-dim);font-size:0.73rem">契約なし</div>`
    : s.contracts.map((c, i) => {
        const target = state.students.find(t => t.id === c.targetId);
        const tName  = target ? (target.name || target.id) : `[不明 ${c.targetId}]`;
        return `
          <div class="contract-item">
            <span>→ ${escHtml(tName)}</span>
            <span class="amount">${c.amount.toLocaleString()} PP/月</span>
            <button onclick="removeContract('${studentId}',${i})">✕</button>
          </div>
        `;
      }).join('');

  // Incoming contracts
  const incoming = [];
  state.students.forEach(other => {
    other.contracts.forEach(c => {
      if (c.targetId === studentId) incoming.push({ from: other.name || other.id, amount: c.amount });
    });
  });
  const incomingHtml = incoming.length === 0
    ? `<div style="color:var(--text-dim);font-size:0.73rem">受信契約なし</div>`
    : incoming.map(c => `
        <div class="contract-item">
          <span>← ${escHtml(c.from)}</span>
          <span class="amount positive">+${c.amount.toLocaleString()} PP/月</span>
        </div>
      `).join('');

  return `
    <button class="page-back-btn" onclick="navigateBack()">◀ 戻る</button>
    <div id="profile-page">

      <!-- ── SIDEBAR ── -->
      <div class="profile-sidebar">
        <div class="profile-bio-block">
          <div class="name-display">${escHtml(s.name) || '(未記入)'}</div>
          <div class="id-display">${s.id}</div>
          <span class="status-badge badge-${statusBadge}">${statusLabel}</span>
          <div class="pp-display ${ppCls}">${s.privatePoints.toLocaleString()}</div>
          <div class="pp-label">${JP.pp}</div>
          <div class="protect-display">🛡 ${s.protectPoints} ${JP.protect}</div>
        </div>

        <div class="info-row"><span>${JP.gender}</span><span>${s.gender === 'M' ? JP.male : JP.female}</span></div>
        <div class="info-row"><span>${JP.dob}</span><span>${s.dob || '未設定'}</span></div>
        <div class="info-row"><span>${JP.grade}</span><span>${gradeDisplay}</span></div>
        <div class="info-row"><span>${JP.class}</span><span>${escHtml(clsDisplay)}</span></div>

        <div class="section-title mt-12">能力プロフィール</div>
        <div class="stat-bars">${statBars}</div>

        <div style="margin-top:12px">
          ${s.isExpelled
            ? `<button class="btn-expel" style="border-color:var(--green);color:var(--green)" onclick="reinstateStudent('${s.id}')">↩ ${JP.reinstate}</button>`
            : `<button class="btn-expel" onclick="confirmExpel('${s.id}')">⚠ ${JP.expel}</button>`
          }
        </div>
      </div>

      <!-- ── MAIN EDIT ── -->
      <div class="profile-main">

        <div class="profile-section">
          <div class="section-title">基本情報</div>
          <div class="form-row"><label>${JP.name}</label><input id="pf-name" value="${escAttrVal(s.name)}" placeholder="(未記入)" /></div>
          <div class="form-row">
            <label>${JP.gender}</label>
            <select id="pf-gender">
              <option value="M" ${s.gender==='M'?'selected':''}>男性 (M)</option>
              <option value="F" ${s.gender==='F'?'selected':''}>女性 (F)</option>
            </select>
          </div>
          <div class="form-row"><label>${JP.dob}</label><input id="pf-dob" type="date" value="${s.dob||''}" /></div>
          <div class="form-row"><label>${JP.grade}</label><select id="pf-grade">${gradeOpts}</select></div>
          <div class="form-row"><label>${JP.class}</label><select id="pf-class">${classOpts}</select></div>
          <div class="form-row"><label>${JP.pp}</label><input id="pf-pp" type="number" value="${s.privatePoints}" /></div>
          <div class="form-row"><label>${JP.protect}</label><input id="pf-protect" type="number" value="${s.protectPoints}" min="0" /></div>
        </div>

        <div class="profile-section">
          <div class="section-title">能力値 (1–15)</div>
          <div class="stats-grid">
            ${STATS_KEYS.map(k => `
              <div class="stat-row">
                <label>${JP[k]}</label>
                <input type="range" id="stat-${k}" min="1" max="15" value="${s.stats[k]||1}"
                  oninput="document.getElementById('sv-${k}').textContent=this.value" />
                <span class="stat-val" id="sv-${k}">${s.stats[k]||1}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="profile-section">
          <div class="section-title">送信コントラクト（支出）</div>
          <div class="contract-list" id="contract-out">${outgoingHtml}</div>
          <div class="add-contract-row">
            <input id="contract-target" placeholder="生徒IDまたは氏名..." style="flex:2" />
            <input id="contract-amount" type="number" placeholder="PP/月" style="flex:1" />
            <button class="btn-sm" onclick="addContract('${s.id}')">+ ${JP.addContract}</button>
          </div>
        </div>

        <div class="profile-section">
          <div class="section-title">受信コントラクト（収入）</div>
          <div class="contract-list">${incomingHtml}</div>
        </div>

        <div class="profile-section">
          <div class="section-title">${JP.specialAbility} (最大300文字)</div>
          <textarea class="special-ability-area" id="pf-ability" maxlength="300"
            placeholder="特殊能力を記載...">${escHtml(s.specialAbility||'')}</textarea>
          <div style="font-size:0.62rem;color:var(--text-dim);text-align:right;margin-top:3px" id="ability-count">
            ${(s.specialAbility||'').length}/300
          </div>
        </div>

        <button class="btn-save-profile" onclick="saveProfile('${s.id}')">✓ プロフィールを保存</button>
      </div>
    </div>
  `;
}

function displayClassName(grade, classId) {
  if (typeof grade === 'number') return getClassName(grade, classId);
  return `${DISPLAY_CLASS[classId] || classId}`;
}

window.saveProfile = function(studentId) {
  const s = state.students.find(st => st.id === studentId);
  if (!s) return;

  s.name     = document.getElementById('pf-name')?.value?.trim() || '';
  s.gender   = document.getElementById('pf-gender')?.value || 'M';
  s.dob      = document.getElementById('pf-dob')?.value   || '';

  const gv   = document.getElementById('pf-grade')?.value;
  s.grade    = isNaN(parseInt(gv)) ? gv : parseInt(gv);
  s.classId  = parseInt(document.getElementById('pf-class')?.value) || 0;

  const ppVal = parseInt(document.getElementById('pf-pp')?.value);
  if (!isNaN(ppVal)) s.privatePoints = ppVal;

  const proVal = parseInt(document.getElementById('pf-protect')?.value);
  if (!isNaN(proVal)) s.protectPoints = Math.max(0, proVal);

  s.specialAbility = document.getElementById('pf-ability')?.value || '';

  STATS_KEYS.forEach(k => {
    const el = document.getElementById(`stat-${k}`);
    if (el) s.stats[k] = parseInt(el.value);
  });

  saveState(true);
  renderApp();
  showToast('✓ プロフィールを保存しました：' + (s.name || s.id));
};

window.removeContract = function(studentId, idx) {
  const s = state.students.find(st => st.id === studentId);
  if (s) s.contracts.splice(idx, 1);
  saveState(true);
  navigate('profile', { studentId }, false);
  updateBreadcrumb();
  showToast('✓ コントラクトを削除しました');
};

window.addContract = function(studentId) {
  const s = state.students.find(st => st.id === studentId);
  if (!s) return;

  const targetInput = document.getElementById('contract-target')?.value?.trim();
  const amount      = parseInt(document.getElementById('contract-amount')?.value);

  if (!targetInput || isNaN(amount) || amount <= 0) {
    showToast('✗ 入力が無効です'); return;
  }

  let target = state.students.find(t => t.id === targetInput);
  if (!target) target = state.students.find(t => t.name.toLowerCase().includes(targetInput.toLowerCase()));
  if (!target) { showToast('✗ 生徒が見つかりません'); return; }
  if (target.id === studentId) { showToast('✗ 自分自身にコントラクトできません'); return; }

  s.contracts.push({ targetId: target.id, amount });
  saveState(true);
  navigate('profile', { studentId }, false);
  updateBreadcrumb();
  showToast(`✓ コントラクト設定 → ${target.name || target.id}: ${amount} PP/月`);
};

window.confirmExpel = function(studentId) {
  const s = state.students.find(st => st.id === studentId);
  if (!s) return;
  openModal(`
    <div class="confirm-dialog">
      <div class="section-title">退学確認</div>
      <p><strong>${escHtml(s.name) || s.id}</strong> を退学処分にしますか？<br><br>
         コントラクトと負債は処理され続けます。</p>
      <div class="btn-row">
        <button class="btn-sm danger-btn" onclick="expelStudent('${studentId}')">退学実行</button>
        <button class="btn-sm" onclick="closeModal()">${JP.cancel}</button>
      </div>
    </div>
  `);
};

window.expelStudent = function(studentId) {
  const s = state.students.find(st => st.id === studentId);
  if (s) s.isExpelled = true;
  closeModal();
  saveState(true);
  navigateBack();
  showToast('⚠ 退学処分：' + (s?.name || studentId));
};

window.reinstateStudent = function(studentId) {
  const s = state.students.find(st => st.id === studentId);
  if (s) s.isExpelled = false;
  saveState(true);
  renderApp();
  showToast('✓ 復帰：' + (s?.name || studentId));
};

// ══════════════════════════════════════════════════
// SPECIAL PAGES (Graduates / Incoming)
// ══════════════════════════════════════════════════

function renderSpecialPage(gradeType) {
  const isGrad = gradeType === 'Graduate';
  const students = state.students.filter(s => s.grade === gradeType);
  const title    = isGrad ? JP.graduates : JP.incoming;
  const color    = isGrad ? 'var(--yellow)' : 'var(--accent)';

  let html = `
    <button class="page-back-btn" onclick="navigateBack()">◀ 戻る</button>
    <div class="page-header">
      <span class="page-title" style="color:${color}">${title}</span>
      <span class="page-subtitle">${students.length}名</span>
    </div>
    <div class="search-bar">
      <input type="text" id="student-search" placeholder="生徒を検索..." oninput="filterStudents()" />
    </div>
    <div id="students-grid" class="students-grid">
  `;

  if (students.length === 0) {
    html += `<div style="color:var(--text-dim);grid-column:1/-1;padding:20px;text-align:center">生徒なし</div>`;
  } else {
    students.forEach(s => {
      const ppCls = ppColorClass(s.privatePoints);
      html += `
        <div class="student-card ${s.isExpelled ? 'expelled' : ''}"
             data-name="${escAttr(s.name.toLowerCase())}"
             onclick="navigate('profile',{studentId:'${s.id}'},false)">
          <span class="s-id">${s.id}</span>
          <div class="s-name">${escHtml(s.name) || '<span style="color:var(--text-dim)">(未記入)</span>'}</div>
          <div class="s-stats-row">
            <div class="s-stat">
              <span class="v ${ppCls}">${formatPP(s.privatePoints)}</span>
              <span class="l">PP</span>
            </div>
            <div class="s-stat">
              <span class="v" style="color:var(--yellow)">${s.protectPoints}</span>
              <span class="l">保護</span>
            </div>
          </div>
        </div>
      `;
    });
  }

  html += `</div>`;

  if (!isGrad) {
    html += `
      <div style="margin-top:14px;text-align:right">
        <button class="btn-sm" onclick="addNewIncoming()">+ 入学予定を追加</button>
      </div>
    `;
  }
  return html;
}

window.addNewIncoming = function() {
  const s = createBlankStudent('Incoming', 0, 0);
  state.students.push(s);
  saveState(true);
  renderApp();
  showToast('✓ 入学予定を追加しました: ' + s.id);
};

// ══════════════════════════════════════════════════
// MODAL
// ══════════════════════════════════════════════════

function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

window.closeModal = function() {
  document.getElementById('modal-overlay').classList.add('hidden');
};

// ══════════════════════════════════════════════════
// HTML ESCAPE HELPERS (XSS prevention)
// ══════════════════════════════════════════════════

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
function escAttr(str) { return escHtml(str); }
function escAttrVal(str) { return String(str ?? '').replace(/"/g, '&quot;'); }

// ══════════════════════════════════════════════════
// POST-RENDER HANDLERS
// ══════════════════════════════════════════════════

function attachPageHandlers(page, params) {
  // Ability textarea char counter
  const ta = document.getElementById('pf-ability');
  const ct = document.getElementById('ability-count');
  if (ta && ct) {
    ta.addEventListener('input', () => { ct.textContent = ta.value.length + '/300'; });
  }
}

// ══════════════════════════════════════════════════
// GLOBAL BINDINGS
// ══════════════════════════════════════════════════

function bindGlobalEvents() {
  document.getElementById('btn-prev-month').addEventListener('click', revertMonth);
  document.getElementById('btn-next-month').addEventListener('click', advanceMonth);

  document.getElementById('btn-save').addEventListener('click', () => saveState());

  document.getElementById('btn-reset').addEventListener('click', () => {
    openModal(`
      <div class="confirm-dialog">
        <div class="section-title">スロット${currentSlot}リセット確認</div>
        <p>スロット${currentSlot}の<strong style="color:var(--red)">全データを削除</strong>して<br>
           1,200名の空欄データを再生成します。<br><br>この操作は取り消せません。</p>
        <div class="btn-row">
          <button class="btn-sm danger-btn" onclick="doReset()">リセット実行</button>
          <button class="btn-sm" onclick="closeModal()">${JP.cancel}</button>
        </div>
      </div>
    `);
  });

  // Slot switching
  document.querySelectorAll('.slot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const n = parseInt(btn.dataset.slot);
      if (n !== currentSlot) {
        switchSlot(n);
      }
    });
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
}

window.doReset = function() {
  closeModal();
  resetCurrentSlot();
  selectMode  = false;
  selectedIds = new Set();
  navStack    = [];
  navigate('home', {}, true);
  showToast(`✓ スロット${currentSlot}リセット — 1,200名の空データを生成しました`);
};

window.navigate     = navigate;
window.navigateBack = navigateBack;

// ══════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════

function showLoadingScreen(msg) {
  const el = document.createElement('div');
  el.id = 'loading-screen';
  el.innerHTML = `
    <div class="logo-lg">COTE-OS</div>
    <div class="loading-text">${msg}</div>
    <div class="loading-sub">しばらくお待ちください...</div>
  `;
  document.body.appendChild(el);
  return el;
}

function boot() {
  // Try loading slot 1 first
  const loaded = loadState(currentSlot);

  if (!loaded || !state.students || state.students.length === 0) {
    const screen = showLoadingScreen('1,200名の初期データを生成中...');
    // Yield to browser to show the loading screen before heavy work
    setTimeout(() => {
      state = newEmptyState();
      generateInitialData();
      saveState(true);
      screen.remove();
      finishBoot();
    }, 60);
  } else {
    finishBoot();
  }
}

function finishBoot() {
  bindGlobalEvents();
  updateSlotButtons();
  updateDateDisplay();
  navigate('home', {}, true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
