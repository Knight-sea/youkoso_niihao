/* ================================================================
   render.js — Cote-OS v9.5  (Module 4 of 6)
   All page rendering: renderApp, renderPage, home, grade, class,
   profile, ranking, graduates, incoming, history, trend, export.
   ================================================================ */
'use strict';

/* ── Render-local state (collapsed sections) ── */
let graduatesCollapsedState = new Map();
let incomingCollapsedState  = new Map();

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
  /* v9.3: sync mobile settings sheet date display */
  const mssDate = document.getElementById('mss-date-display');
  if(mssDate) mssDate.textContent = el.textContent;
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
    case 'trend':        app.innerHTML=renderTrendPage(); break;
    case 'export':       app.innerHTML=renderExportPage(); break;
    default: app.innerHTML=`<p style="color:var(--rd)">ページが見つかりません</p>`;
  }
  afterRender();
  updateBottomNav();
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
        <span class="hm-link" onclick="navigate('ranking',{},false)">🏆 ${JP.ranking}</span>
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

  /* v9.5: New feature navigation buttons */
  h += `<div class="home-feature-nav">
    <button class="feat-nav-btn" onclick="navigate('trend',{},false)">
      <span class="feat-nav-icon">📈</span>
      <span class="feat-nav-lbl">トレンドグラフ</span>
      <span class="feat-nav-sub">PP/CP推移を可視化</span>
    </button>
    <button class="feat-nav-btn" onclick="navigate('export',{},false)">
      <span class="feat-nav-icon">📊</span>
      <span class="feat-nav-lbl">CSVエクスポート</span>
      <span class="feat-nav-sub">データをCSVで書き出し</span>
    </button>
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
  {key:'dob',       label:'誕生日'},
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

/* v9.3: dobSortKey — converts a YYYY-MM-DD string to a school-year-aware
   sort integer. April 1st = smallest value (ranks first, i.e. "oldest"
   in the school year). March 31st = largest value (ranks last).
   Months 1–3 are treated as months 13–15 so the April boundary works.
   Returns Infinity for missing/invalid dates (sorts to the bottom).    */
function dobSortKey(dob){
  if(!dob) return Infinity;
  const parts = dob.split('-');
  if(parts.length < 3) return Infinity;
  const mm = parseInt(parts[1], 10);
  const dd = parseInt(parts[2], 10);
  if(isNaN(mm) || isNaN(dd)) return Infinity;
  const m = mm <= 3 ? mm + 12 : mm;   /* Jan=13, Feb=14, Mar=15, Apr=4 … Dec=12 */
  return m * 100 + dd;
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
    /* v9.3: dob — negate so computeRankingBy's descending sort puts
       the smallest dobSortKey (Apr 1) first.                        */
    case 'dob': return -dobSortKey(student.dob);
    default: return student.privatePoints||0;
  }
}
function computeRankingBy(key='pp', filterOpts={}){
  /* Full unfiltered pool used for overall score calculation */
  const fullPool = state.students.filter(s=>typeof s.grade==='number' && !s.isExpelled);
  /* Apply grade / classId / gender filters for the displayed list */
  let pool = fullPool;
  if(filterOpts.grade    != null) pool = pool.filter(s=>s.grade   === filterOpts.grade);
  if(filterOpts.classId  != null) pool = pool.filter(s=>s.classId === filterOpts.classId);
  if(filterOpts.gender   != null) pool = pool.filter(s=>s.gender  === filterOpts.gender);

  const sorted=[...pool].sort((a,b)=>{
    const av=rankSortValue(a,key,fullPool);
    const bv=rankSortValue(b,key,fullPool);
    if(bv!==av) return bv-av;
    if((b.privatePoints||0)!==(a.privatePoints||0)) return (b.privatePoints||0)-(a.privatePoints||0);
    return String(a.id).localeCompare(String(b.id));
  });
  const out=[];
  for(let i=0;i<sorted.length;i++){
    const cur=rankSortValue(sorted[i],key,fullPool);
    const prev=i>0?rankSortValue(sorted[i-1],key,fullPool):null;
    const rank=(i>0&&cur===prev)?out[out.length-1].rank:i+1;
    out.push({rank,student:sorted[i],value:cur});
  }
  return out;
}
window.setRankingSort=function(key){
  rankingSortKey=RANK_SORT_ITEMS.some(x=>x.key===key)?key:'pp';
  rankingPage=1;
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
  { key:null,        label:'順位',         cls:'col-rank',  thCls:'',        tdCls:'rn',            align:'right'  },
  { key:null,        label:'氏名',         cls:'col-name',  thCls:'th-left', tdCls:'rk-nm td-left', align:'left'   },
  { key:null,        label:'学年 / 組',    cls:'col-class', thCls:'th-left', tdCls:'td-left',       align:'left'   },
  { key:'dob',       label:'誕生日',       cls:'col-dob',   thCls:'th-left', tdCls:'rk-dob',        align:'left'   },
  { key:'pp',        label:'PP',           cls:'col-pp',    thCls:'',        tdCls:'rk-pp',         align:'right'  },
  { key:'prp',       label:'PRP',          cls:'col-prp',   thCls:'',        tdCls:'',              align:'right'  },
  { key:'language',  label:'言語',         cls:'col-s0',    thCls:'',        tdCls:'',              align:'right'  },
  { key:'reasoning', label:'推論',         cls:'col-s1',    thCls:'',        tdCls:'',              align:'right'  },
  { key:'memory',    label:'記憶',         cls:'col-s2',    thCls:'',        tdCls:'',              align:'right'  },
  { key:'thinking',  label:'思考',         cls:'col-s3',    thCls:'',        tdCls:'',              align:'right'  },
  { key:'physical',  label:'身体',         cls:'col-s4',    thCls:'',        tdCls:'',              align:'right'  },
  { key:'mental',    label:'精神',         cls:'col-s5',    thCls:'',        tdCls:'',              align:'right'  },
  { key:'overall',   label:'総合',         cls:'col-ov',    thCls:'',        tdCls:'',              align:'right'  },
];

/* v9.3: ranking pagination + filter state */
let rankingPage = 1;
const RANK_PAGE_SIZE = 100;
let rankingFilter = { grade:null, classId:null, gender:null };

window.setRankingPage = function(p){
  rankingPage = p;
  renderPage('ranking', {});
};
/* Toggle a filter value — clicking the same value again clears it */
window.setRankingFilter = function(type, value){
  if(rankingFilter[type] === value) rankingFilter[type] = null;
  else rankingFilter[type] = value;
  rankingPage = 1;
  renderPage('ranking', {});
};
window.clearRankingFilters = function(){
  rankingFilter = { grade:null, classId:null, gender:null };
  rankingPage = 1;
  renderPage('ranking', {});
};

function renderRankingPage(){
  /* Build full ranked list applying current filters */
  const allRanked = computeRankingBy(rankingSortKey, rankingFilter);
  /* Unfiltered pool for overall score & medal podium */
  const pool      = state.students.filter(s=>typeof s.grade==='number' && !s.isExpelled);
  const medals    = ['🥇','🥈','🥉'];
  const valLabel  = rankSortLabel(rankingSortKey);

  /* ── Pagination ── */
  const totalPages = Math.max(1, Math.ceil(allRanked.length / RANK_PAGE_SIZE));
  const curPage    = Math.min(Math.max(1, rankingPage), totalPages);
  const pageStart  = (curPage - 1) * RANK_PAGE_SIZE;
  const ranked     = allRanked.slice(pageStart, pageStart + RANK_PAGE_SIZE);

  /* ── Active filter summary for subtitle ── */
  const activeFilters = [
    rankingFilter.grade   != null ? `${rankingFilter.grade}年生` : null,
    rankingFilter.classId != null ? `${RANK_LABELS[rankingFilter.classId]}組` : null,
    rankingFilter.gender  != null ? (rankingFilter.gender==='M'?'男':'女') : null,
  ].filter(Boolean);

  /* ── Header ── */
  let h = `
    <button class="back-btn" onclick="goBack()">◀ 戻る</button>
    <div class="pg-hdr">
      <span class="pg-title">🏆 ${JP.ranking}</span>
      <span class="pg-sub">${allRanked.length}名 · 並び替え: ${valLabel}（降順）${activeFilters.length ? ' · ' + activeFilters.join(' / ') : ''}</span>
    </div>`;

  /* ── Filter bar ── */
  h += `<div class="rnk-filter-bar">`;
  /* Grade buttons */
  h += `<label>学年</label><div class="rnk-filter-group">`;
  GRADES.forEach(g => {
    const act = rankingFilter.grade === g ? ' active' : '';
    h += `<button class="rnk-flt-btn${act}" onclick="setRankingFilter('grade',${g})">${g}年</button>`;
  });
  h += `</div><span class="rnk-filter-sep"></span>`;
  /* Class buttons */
  h += `<label>組</label><div class="rnk-filter-group">`;
  CLASS_IDS.forEach(cid => {
    const act = rankingFilter.classId === cid ? ' active' : '';
    h += `<button class="rnk-flt-btn${act}" onclick="setRankingFilter('classId',${cid})">${RANK_LABELS[cid]}</button>`;
  });
  h += `</div><span class="rnk-filter-sep"></span>`;
  /* Gender buttons */
  h += `<label>性別</label><div class="rnk-filter-group">`;
  h += `<button class="rnk-flt-btn f-gn${rankingFilter.gender==='M' ? ' active' : ''}" onclick="setRankingFilter('gender','M')">男</button>`;
  h += `<button class="rnk-flt-btn f-rd${rankingFilter.gender==='F' ? ' active' : ''}" onclick="setRankingFilter('gender','F')">女</button>`;
  h += `</div>`;
  if(activeFilters.length){
    h += `<button class="rnk-filter-clear" onclick="clearRankingFilters()">× フィルター解除</button>`;
  }
  h += `</div>`;

  /* ── Medal podium — always rendered from allRanked (persists across pages) ── */
  if(allRanked.length){
    h += `<div class="medal-row">`;
    allRanked.slice(0, Math.min(3, allRanked.length)).forEach(({rank, student:s, value}, i)=>{
      const gd = typeof s.grade==='number' ? JP.gradeN(s.grade) : (s.grade==='Graduate'?'卒業生':'入学予定');
      /* v9.3: class display as A-E rank letter */
      const clsRank = typeof s.grade==='number' ? rankOf(s.grade, s.classId) : '―';
      const cd = typeof s.grade==='number' ? `${clsRank}組` : '―';

      /* v9.3: safe medal value display — guard against invalid dob sort values */
      let dispValue;
      if(rankingSortKey === 'dob'){
        dispValue = (s.dob && s.dob.trim()) ? s.dob : '未設定';
      } else {
        dispValue = Number.isInteger(value) ? value.toLocaleString() : String(value ?? '―');
      }

      h += `
        <div class="medal-card" style="cursor:pointer" onclick="navigate('profile',{sid:'${s.id}'},false)">
          <div class="medal-rnk">${medals[i]} 第${rank}位</div>
          <div class="medal-name">${esc(s.name) || '(未記入)'}</div>
          <div class="medal-sub">${gd} &nbsp;${esc(cd)}</div>
          <div class="medal-pp">${dispValue} ${rankingSortKey==='dob'?'':valLabel}</div>
        </div>`;
    });
    h += `</div>`;
  }

  /* ── Pagination controls ── */
  if(totalPages > 1){
    h += `
    <div class="rnk-pagination">
      <button class="rnk-pg-btn" onclick="setRankingPage(${curPage-1})" ${curPage<=1?'disabled':''}>◀ 前ページ</button>
      <span class="rnk-pg-info">${curPage} / ${totalPages} ページ（${allRanked.length}名）</span>
      <button class="rnk-pg-btn" onclick="setRankingPage(${curPage+1})" ${curPage>=totalPages?'disabled':''}>次ページ ▶</button>
    </div>`;
  }

  /* ── colgroup ── */
  const colgroup = RNK_COLS.map(c=>`<col class="${c.cls}" />`).join('');

  /* ── thead — clickable headers ── */
  const thead = RNK_COLS.map(c=>{
    const isActive = c.key && c.key === rankingSortKey;
    const arrow    = c.key ? `<span class="sort-arrow">${isActive ? '▼' : ' '}</span>` : '';
    const activeCs = isActive ? ' sort-active' : '';
    const thCls    = [c.thCls, activeCs].filter(Boolean).join(' ');
    const onClick  = c.key ? `onclick="setRankingSort('${c.key}')"` : '';
    return `<th class="${thCls}" ${onClick}>${c.label}${arrow}</th>`;
  }).join('');

  h += `
    <div class="rnk-wrap" style="margin-top:10px">
      <table class="rnk-tbl">
        <colgroup>${colgroup}</colgroup>
        <thead><tr>${thead}</tr></thead>
        <tbody>`;

  if(!ranked.length){
    h += `<tr><td colspan="${RNK_COLS.length}" style="text-align:center;padding:20px;color:var(--t3)">データなし</td></tr>`;
  }

  ranked.forEach(({rank, student:s, value})=>{
    const gd    = typeof s.grade==='number' ? JP.gradeN(s.grade) : (s.grade==='Graduate'?'卒業生':'入学予定');
    /* v9.3: use A-E rank letter for class display in table */
    const clsRank = typeof s.grade==='number' ? rankOf(s.grade, s.classId) : '―';
    const cd    = typeof s.grade==='number' ? `${clsRank}組` : '―';
    const ov    = calcOverallScore(s, pool);
    const top3  = rank <= 3 ? ' top3' : '';

    /* Per-column value helper */
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
        /* v9.3: dob — display raw date string, never the numeric sort key */
        case 'dob':      return (s.dob && s.dob.trim()) ? s.dob : '―';
        default: return '';
      }
    };

    const tds = RNK_COLS.map(c=>{
      const isActive  = c.key && c.key === rankingSortKey;
      const activeCls = isActive ? ' stat-active' : '';
      switch(c.cls){
        case 'col-rank':
          return `<td class="rn${top3}">${rank}</td>`;
        case 'col-name':
          return `<td class="rk-nm td-left${activeCls}" onclick="navigate('profile',{sid:'${s.id}'},false)">${esc(s.name)||'<span class="dim">(未記入)</span>'}</td>`;
        case 'col-class':
          return `<td class="td-left${activeCls}" style="font-size:.68rem;color:var(--t1)">${gd} / ${esc(cd)}</td>`;
        case 'col-dob':
          return `<td class="rk-dob${activeCls}">${sv('dob')}</td>`;
        default:{
          const base = (c.tdCls||'').trim();
          const cls  = base ? `${base} rk-num${activeCls}` : `rk-num${activeCls}`;
          return `<td class="${cls}">${sv(c.key)}</td>`;
        }
      }
    }).join('');

    h += `<tr>${tds}</tr>`;
  });

  h += `</tbody></table></div>`;

  /* ── Pagination controls (bottom) ── */
  if(totalPages > 1){
    h += `
    <div class="rnk-pagination" style="margin-top:8px">
      <button class="rnk-pg-btn" onclick="setRankingPage(${curPage-1})" ${curPage<=1?'disabled':''}>◀ 前ページ</button>
      <span class="rnk-pg-info">${curPage} / ${totalPages} ページ（${allRanked.length}名）</span>
      <button class="rnk-pg-btn" onclick="setRankingPage(${curPage+1})" ${curPage>=totalPages?'disabled':''}>次ページ ▶</button>
    </div>`;
  }

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
  /* v9.5: draw trend chart after DOM update */
  if(cur?.page==='trend' && typeof drawTrendChart==='function'){
    drawTrendChart();
  }
}
