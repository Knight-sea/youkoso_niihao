/* features.js — v9.5: PP/CP Trend Graph + CSV/Excel Export */
'use strict';

/* ══════════════════════════════════════════════════════════════════
   MODULE STATE
══════════════════════════════════════════════════════════════════ */
let trendMode  = 'classCP';   // 'classCP' | 'studentPP'
let trendGrade = 1;

/* ── Rank-colour palette (fallback hex for canvas — matches CSS vars) ── */
const RANK_COLORS = ['#00ff88','#00c8ff','#ffd700','#ff8800','#ff3355'];

/* ── Distinct line colours for student PP mode ── */
const STUDENT_LINE_COLORS = ['#00c8ff','#ff3355','#ffd700','#00ff88','#e060ff'];

/* ══════════════════════════════════════════════════════════════════
   1.  PP / CP TREND GRAPH
══════════════════════════════════════════════════════════════════ */

/**
 * renderTrendPage — builds the full HTML for the trend-graph page.
 * Called by the app router when navigating to 'trend'.
 */
window.renderTrendPage = function () {
  const gradeOpts = GRADES.map(g =>
    `<option value="${g}"${g === trendGrade ? ' selected' : ''}>${JP.gradeN(g)}</option>`
  ).join('');

  const cpActive  = trendMode === 'classCP'   ? ' active' : '';
  const ppActive  = trendMode === 'studentPP' ? ' active' : '';

  return `
    <button class="back-btn" onclick="goBack()">◀ 戻る</button>
    <div class="pg-hdr">
      <span class="pg-title">PP / CP 推移グラフ</span>
    </div>

    <div style="display:flex;gap:8px;align-items:center;margin:10px 0;flex-wrap:wrap">
      <button class="tab-btn${cpActive}" onclick="setTrendMode('classCP')">クラスCP推移</button>
      <button class="tab-btn${ppActive}" onclick="setTrendMode('studentPP')">個人PP推移</button>
      <label style="margin-left:auto;font-size:.85rem;color:var(--t2)">学年フィルター
        <select onchange="setTrendGrade(+this.value)" style="margin-left:4px">${gradeOpts}</select>
      </label>
    </div>

    <div id="trend-wrap" style="width:100%;overflow-x:auto">
      <canvas id="trend-canvas" width="700" height="350"></canvas>
    </div>

    <div id="trend-summary" style="margin-top:12px;font-size:.85rem;color:var(--t2)"></div>
    <div id="trend-legend" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:10px;font-size:.82rem"></div>`;
};

/* ── mode / grade setters ────────────────────────────────────── */
window.setTrendMode = function (mode) {
  trendMode = mode;
  /* Re-render the page in-place */
  const app = document.getElementById('app');
  if (app) { app.innerHTML = window.renderTrendPage(); }
  requestAnimationFrame(drawTrendChart);
};

window.setTrendGrade = function (grade) {
  trendGrade = grade;
  requestAnimationFrame(drawTrendChart);
};

/* ── drawing ─────────────────────────────────────────────────── */
function drawTrendChart () {
  const canvas = document.getElementById('trend-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  /* Responsive width */
  const wrap = document.getElementById('trend-wrap');
  if (wrap) { canvas.width = Math.max(350, wrap.clientWidth - 4); }
  const W = canvas.width, H = canvas.height;

  /* Margins */
  const ml = 60, mr = 20, mt = 20, mb = 40;
  const cw = W - ml - mr, ch = H - mt - mb;

  ctx.clearRect(0, 0, W, H);

  /* History is newest-first → reverse for chronological order */
  const hist = state && state.history ? [...state.history].reverse() : [];
  if (hist.length < 2) {
    ctx.fillStyle = 'rgba(190,220,240,.6)';
    ctx.font = '14px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('データが不足しています（2件以上の履歴が必要です）', W / 2, H / 2);
    return;
  }

  /* ── Build series ─────────────────────────────────────────── */
  let series = [];   // [{label, color, values:[number]}]
  let yLabel = '';

  if (trendMode === 'classCP') {
    yLabel = 'クラスCP';
    CLASS_IDS.forEach((cid, idx) => {
      const vals = hist.map(h => {
        const entry = (h.classPoints || []).find(e => e.grade === trendGrade && e.classId === cid);
        return entry ? entry.cp : null;
      });
      series.push({
        label: clsName(trendGrade, cid),
        color: RANK_COLORS[idx % RANK_COLORS.length],
        values: vals,
      });
    });
  } else {
    /* studentPP — top 5 by current PP in selected grade */
    yLabel = 'プライベートポイント';
    const pool = (state.students || [])
      .filter(s => s.grade === trendGrade && !s.isExpelled)
      .sort((a, b) => b.privatePoints - a.privatePoints)
      .slice(0, 5);
    pool.forEach((s, idx) => {
      const vals = hist.map(h => {
        const entry = (h.studentPP || []).find(e => e.id === s.id);
        return entry ? entry.pp : null;
      });
      series.push({
        label: s.name || s.id,
        color: STUDENT_LINE_COLORS[idx % STUDENT_LINE_COLORS.length],
        values: vals,
      });
    });
  }

  /* ── Value range ──────────────────────────────────────────── */
  let allVals = [];
  series.forEach(sr => sr.values.forEach(v => { if (v !== null) allVals.push(v); }));
  if (!allVals.length) {
    ctx.fillStyle = 'rgba(190,220,240,.6)';
    ctx.font = '14px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('選択学年のデータがありません', W / 2, H / 2);
    return;
  }
  let yMin = Math.min(...allVals);
  let yMax = Math.max(...allVals);
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const yPad = (yMax - yMin) * 0.08;
  yMin -= yPad; yMax += yPad;

  /* ── Grid lines & Y-axis labels ───────────────────────────── */
  const numYTicks = 5;
  ctx.strokeStyle = 'rgba(120,160,190,.2)';
  ctx.lineWidth = 1;
  ctx.fillStyle = 'rgba(190,220,240,.7)';
  ctx.font = '11px "Share Tech Mono", monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= numYTicks; i++) {
    const y = mt + ch - (ch * i / numYTicks);
    ctx.beginPath(); ctx.moveTo(ml, y); ctx.lineTo(ml + cw, y); ctx.stroke();
    const val = yMin + (yMax - yMin) * i / numYTicks;
    ctx.fillText(fmtPP(Math.round(val)), ml - 6, y);
  }

  /* ── X-axis labels (months) ───────────────────────────────── */
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const nPts = hist.length;
  const maxXLabels = Math.min(nPts, 12);
  const xStep = nPts <= maxXLabels ? 1 : Math.ceil(nPts / maxXLabels);
  for (let i = 0; i < nPts; i += xStep) {
    const x = ml + (cw * i / (nPts - 1));
    const h = hist[i];
    const label = h.month + '月';
    ctx.fillText(label, x, mt + ch + 6);
  }

  /* ── Axes ──────────────────────────────────────────────────── */
  ctx.strokeStyle = 'rgba(160,200,230,.5)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(ml, mt); ctx.lineTo(ml, mt + ch); ctx.lineTo(ml + cw, mt + ch); ctx.stroke();

  /* ── Y-axis title ─────────────────────────────────────────── */
  ctx.save();
  ctx.translate(14, mt + ch / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = 'rgba(190,220,240,.7)';
  ctx.font = '11px "Share Tech Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();

  /* ── Plot lines ────────────────────────────────────────────── */
  series.forEach(sr => {
    ctx.strokeStyle = sr.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    sr.values.forEach((v, i) => {
      if (v === null) { started = false; return; }
      const x = ml + (cw * i / (nPts - 1));
      const y = mt + ch - ((v - yMin) / (yMax - yMin)) * ch;
      if (!started) { ctx.moveTo(x, y); started = true; }
      else { ctx.lineTo(x, y); }
    });
    ctx.stroke();

    /* Data points */
    sr.values.forEach((v, i) => {
      if (v === null) return;
      const x = ml + (cw * i / (nPts - 1));
      const y = mt + ch - ((v - yMin) / (yMax - yMin)) * ch;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = sr.color;
      ctx.fill();
    });
  });

  /* ── Legend ─────────────────────────────────────────────────── */
  const legendEl = document.getElementById('trend-legend');
  if (legendEl) {
    legendEl.innerHTML = series.map(sr =>
      `<span style="display:inline-flex;align-items:center;gap:4px">` +
      `<span style="display:inline-block;width:14px;height:3px;background:${sr.color};border-radius:2px"></span>` +
      `${esc(sr.label)}</span>`
    ).join('');
  }

  /* ── Summary stats ─────────────────────────────────────────── */
  const summaryEl = document.getElementById('trend-summary');
  if (summaryEl) {
    const latest = hist[hist.length - 1];
    let summaryLines = [];
    if (trendMode === 'classCP') {
      const entries = (latest.classPoints || []).filter(e => e.grade === trendGrade);
      entries.sort((a, b) => b.cp - a.cp);
      summaryLines.push(`最新月: Year ${latest.year}, ${latest.month}月`);
      entries.forEach(e => {
        summaryLines.push(`${esc(clsName(trendGrade, e.classId))}: ${fmtPP(e.cp)} CP`);
      });
    } else {
      summaryLines.push(`最新月: Year ${latest.year}, ${latest.month}月`);
      series.forEach(sr => {
        const last = sr.values[sr.values.length - 1];
        if (last !== null) summaryLines.push(`${esc(sr.label)}: ${fmtPP(last)} PP`);
      });
    }
    summaryEl.innerHTML = summaryLines.map(l => `<div>${l}</div>`).join('');
  }
}

/* Kick draw after DOM update (called by router after innerHTML set) */
window.drawTrendChart = drawTrendChart;

/* ══════════════════════════════════════════════════════════════════
   2.  CSV / EXCEL EXPORT
══════════════════════════════════════════════════════════════════ */

/* ── helpers ──────────────────────────────────────────────────── */
function csvEscape (val) {
  const s = String(val ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? '"' + s.replace(/"/g, '""') + '"'
    : s;
}

function downloadCSV (filename, csvContent) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 15000);
  toast('\u2713 ' + filename + ' をダウンロードしました', 'io', 3000);
}

function datestampExport () {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/* ── page renderer ───────────────────────────────────────────── */
window.renderExportPage = function () {
  return `
    <button class="back-btn" onclick="goBack()">◀ 戻る</button>
    <div class="pg-hdr">
      <span class="pg-title">CSV / Excel エクスポート</span>
    </div>

    <div style="display:flex;flex-direction:column;gap:12px;margin:16px 0;max-width:420px">
      <button class="btn io" onclick="exportAllStudentsCSV()" style="text-align:left;padding:10px 14px">
        <strong>全生徒データ</strong><br>
        <span style="font-size:.82rem;opacity:.7">ID・氏名・ステータス・PP・能力値を全件出力</span>
      </button>
      <button class="btn io" onclick="exportRankingCSV()" style="text-align:left;padding:10px 14px">
        <strong>PPランキング</strong><br>
        <span style="font-size:.82rem;opacity:.7">PP順位付きの生徒リストを出力</span>
      </button>
      <button class="btn io" onclick="exportClassCPCSV()" style="text-align:left;padding:10px 14px">
        <strong>クラスCP一覧</strong><br>
        <span style="font-size:.82rem;opacity:.7">全クラスのクラスポイントを出力</span>
      </button>
      <button class="btn io" onclick="exportStatsMatrixCSV()" style="text-align:left;padding:10px 14px">
        <strong>統計マトリクス</strong><br>
        <span style="font-size:.82rem;opacity:.7">全生徒の6能力値＋合計＋総合スコアを出力</span>
      </button>
    </div>`;
};

/* ── 1) All Students CSV ─────────────────────────────────────── */
window.exportAllStudentsCSV = function () {
  if (!state || !state.students) { toast('\u2717 データがありません', 'err'); return; }
  const header = ['ID', '氏名', '性別', '生年月日', '学年', 'クラス',
    'PP', 'PrP', '言語力', '推論力', '記憶力', '思考力', '身体能力', '精神力',
    '総合', '状態'];
  const pool = getSchoolRankingPool();
  const rows = state.students.map(s => {
    const st = s.stats || {};
    const overall = calcOverallScore(s, pool);
    const status  = s.isExpelled ? '退学' : '在籍';
    return [
      s.id, s.name, s.gender === 'F' ? '女' : '男', s.dob || '',
      s.grade, clsName(s.grade, s.classId),
      s.privatePoints, s.protectPoints,
      clampStat(st.language), clampStat(st.reasoning), clampStat(st.memory),
      clampStat(st.thinking), clampStat(st.physical), clampStat(st.mental),
      overall, status,
    ].map(csvEscape).join(',');
  });
  const csv = header.map(csvEscape).join(',') + '\n' + rows.join('\n');
  downloadCSV(`cote_os_all_students_${datestampExport()}.csv`, csv);
};

/* ── 2) Ranking CSV ──────────────────────────────────────────── */
window.exportRankingCSV = function () {
  if (!state || !state.students) { toast('\u2717 データがありません', 'err'); return; }
  const header = ['順位', 'ID', '氏名', '学年', 'クラス', 'PP'];
  const ranking = computeRanking();
  const rows = ranking.map(r => {
    const s = r.student;
    return [
      r.rank, s.id, s.name, s.grade,
      clsName(s.grade, s.classId), s.privatePoints,
    ].map(csvEscape).join(',');
  });
  const csv = header.map(csvEscape).join(',') + '\n' + rows.join('\n');
  downloadCSV(`cote_os_ranking_${datestampExport()}.csv`, csv);
};

/* ── 3) Class CP CSV ─────────────────────────────────────────── */
window.exportClassCPCSV = function () {
  if (!state || !state.classes) { toast('\u2717 データがありません', 'err'); return; }
  const header = ['順位', '学年', 'クラス名', 'クラスランク', 'CP'];
  const sorted = computeClassRanking();
  const rows = sorted.map((c, i) => {
    const rank = rankOf(c.grade, c.classId);
    return [
      i + 1, c.grade, clsName(c.grade, c.classId), rank, c.classPoints,
    ].map(csvEscape).join(',');
  });
  const csv = header.map(csvEscape).join(',') + '\n' + rows.join('\n');
  downloadCSV(`cote_os_class_cp_${datestampExport()}.csv`, csv);
};

/* ── 4) Stats Matrix CSV ─────────────────────────────────────── */
window.exportStatsMatrixCSV = function () {
  if (!state || !state.students) { toast('\u2717 データがありません', 'err'); return; }
  const header = ['ID', '氏名', '学年', 'クラス',
    '言語力', '推論力', '記憶力', '思考力', '身体能力', '精神力',
    '合計', '総合スコア'];
  const pool = getSchoolRankingPool();
  const rows = state.students.map(s => {
    const st = s.stats || {};
    const vals = STATS_KEYS.map(k => clampStat(st[k]));
    const sum  = vals.reduce((a, b) => a + b, 0);
    const overall = calcOverallScore(s, pool);
    return [
      s.id, s.name, s.grade, clsName(s.grade, s.classId),
      ...vals, sum, overall,
    ].map(csvEscape).join(',');
  });
  const csv = header.map(csvEscape).join(',') + '\n' + rows.join('\n');
  downloadCSV(`cote_os_stats_matrix_${datestampExport()}.csv`, csv);
};
