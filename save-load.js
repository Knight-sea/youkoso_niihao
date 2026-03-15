/* save-load.js — v9.5: Save/Load system + Firebase cloud sync */

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

/* ── v9.2: スキーマ圧縮 + gzip (fflate) ──────────────────────────
   フォーマット: "GZ92:" + Base64(gzip(UTF-8 JSON of packed state))
   "GZ91:" は旧フォーマット (生JSON gzip) として後方互換読み込みを維持。
   "PB87:" は Protobuf 旧フォーマット — meta sidecar から読む。

   スキーマ圧縮: JSON キー名をすべて排除して配列化することで
   JSON サイズを約65〜75%削減。gzip と合わせて元の約10〜15%まで圧縮。

   生徒1人のパック配列レイアウト (固定14要素 + オプション2要素):
     [0]  id          string
     [1]  name        string
     [2]  gender      0=M / 1=F
     [3]  dob         string (YYYY-MM-DD)
     [4]  grade       number | "Graduate" | "Incoming"
     [5]  classId     number
     [6]  privatePoints number
     [7]  protectPoints number
     [8]  isExpelled  0=false / 1=true
     [9]  specialAbility string
     [10] stats       [language,reasoning,memory,thinking,physical,mental]
     [11] traits      string[]
     [12] customTraits [[id,label,cat], ...]
     [13] contracts   [[targetId,amount], ...]
     [14] cohortGrade  number (省略可 — 存在するときのみ)
     [15] graduateYear number (省略可 — 存在するときのみ)

   クラス1件のパック配列:
     [grade, classId, classPoints, customName, name]

   パック済み state のトップレベル:
     { v:2, year, month, nextId, slotName, cl:[...classes], st:[...students] }
     (履歴は含まない — ローカル保持のみ)
────────────────────────────────────────────────────────────────── */

/* Base64 ↔ Uint8Array 変換 */
function _u8ToB64(u8){
  let s=''; u8.forEach(b=>{ s+=String.fromCharCode(b); }); return btoa(s);
}
function _b64ToU8(b64){
  const s=atob(b64); const u=new Uint8Array(s.length);
  for(let i=0;i<s.length;i++) u[i]=s.charCodeAt(i); return u;
}

/* _packState — state オブジェクトをキーなし配列構造に変換 */
function _packState(s){
  const cl = s.classes.map(c=>[c.grade, c.classId, c.classPoints, c.customName||'', c.name||'']);
  const st = s.students.map(st=>{
    const row = [
      st.id,
      st.name,
      st.gender==='F' ? 1 : 0,
      st.dob||'',
      st.grade,
      st.classId,
      st.privatePoints||0,
      st.protectPoints||0,
      st.isExpelled ? 1 : 0,
      st.specialAbility||'',
      STATS_KEYS.map(k=>st.stats?.[k]??1),
      Array.isArray(st.traits) ? st.traits : [],
      Array.isArray(st.customTraits) ? st.customTraits.map(t=>[t.id,t.label,t.cat]) : [],
      Array.isArray(st.contracts)    ? st.contracts.map(c=>[c.targetId,c.amount])    : [],
    ];
    /* オプションフィールド: cohortGrade / graduateYear が存在するときだけ追加 */
    const hasCohort   = typeof st.cohortGrade  ==='number';
    const hasGraduate = typeof st.graduateYear ==='number';
    if(hasCohort || hasGraduate){
      row.push(hasCohort   ? st.cohortGrade  : null);
      row.push(hasGraduate ? st.graduateYear : null);
    }
    return row;
  });
  return { v:2, year:s.year, month:s.month, nextId:s.nextId,
           slotName:s.slotName||'', cl, st };
}

/* _unpackState — パック済み配列構造を state オブジェクトに戻す */
function _unpackState(p){
  const s = newState();
  s.year     = +p.year  || 1;
  s.month    = +p.month || 4;
  s.nextId   = +p.nextId|| 1;
  s.slotName = String(p.slotName||'');
  s.classes  = (p.cl||[]).map(c=>({
    grade:c[0], classId:c[1], classPoints:c[2]||0,
    customName:c[3]||'', name:c[4]||'',
  }));
  s.students = (p.st||[]).map(row=>{
    const out = {
      id:             String(row[0]||''),
      name:           String(row[1]||''),
      gender:         row[2]===1 ? 'F' : 'M',
      dob:            String(row[3]||''),
      grade:          row[4],
      classId:        row[5]||0,
      privatePoints:  row[6]||0,
      protectPoints:  row[7]||0,
      isExpelled:     row[8]===1,
      specialAbility: String(row[9]||''),
      stats:          Object.fromEntries(STATS_KEYS.map((k,i)=>[k, row[10]?.[i]??1])),
      traits:         Array.isArray(row[11]) ? row[11] : [],
      customTraits:   Array.isArray(row[12]) ? row[12].map(t=>({id:t[0],label:t[1],cat:t[2]})) : [],
      contracts:      Array.isArray(row[13]) ? row[13].map(c=>({targetId:c[0],amount:c[1]}))   : [],
    };
    /* オプション: cohortGrade / graduateYear */
    if(row.length>14 && row[14]!=null) out.cohortGrade  = row[14];
    if(row.length>15 && row[15]!=null) out.graduateYear = row[15];
    return out;
  });
  /* 履歴はパック済みデータに含まれないので空配列のまま */
  s.history = [];
  return s;
}

/* encodeStateToBinary — スキーマ圧縮 + gzip して "GZ92:" + Base64 を返す。
   fflate が未ロードの場合は null を返す (呼び出し側で平文 JSON にフォールバック)。 */
function encodeStateToBinary(s){
  try{
    const fl = window.fflate;
    if(!fl) return null;
    const packed = _packState(s);
    const raw    = fl.strToU8(JSON.stringify(packed));
    const gz     = fl.gzipSync(raw, { level: 6 });
    return 'GZ92:' + _u8ToB64(gz);
  }catch(e){
    console.warn('[GZ] encodeStateToBinary failed:', e);
    return null;
  }
}

/* decodeStateFromBinary — GZ92 / GZ91 / PB87 を判別して state を返す。
   GZ92: → gzip解凍 → _unpackState → state (履歴なし)
   GZ91: → gzip解凍 → JSON.parse    → state (旧フォーマット後方互換)
   PB87: → null を返す (呼び出し側で meta sidecar から読む)           */
function decodeStateFromBinary(raw){
  try{
    if(raw.startsWith('GZ92:')){
      const fl  = window.fflate; if(!fl) return null;
      const gz  = _b64ToU8(raw.slice(5));
      const dec = fl.decompressSync(gz);
      const obj = JSON.parse(fl.strFromU8(dec));
      return _unpackState(obj);
    }
    if(raw.startsWith('GZ91:')){
      /* v9.1 旧フォーマット: 生 JSON gzip — そのまま展開して返す */
      const fl  = window.fflate; if(!fl) return null;
      const gz  = _b64ToU8(raw.slice(5));
      const dec = fl.decompressSync(gz);
      return JSON.parse(fl.strFromU8(dec));
    }
    /* PB87: は meta sidecar が正規ソースなので null を返す */
    return null;
  }catch(e){
    console.warn('[GZ] decodeStateFromBinary failed:', e);
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
    if(raw.startsWith('GZ92:') || raw.startsWith('GZ91:')){
      return decodeStateFromBinary(raw);
    }
    if(raw.startsWith('PB87:')){
      const metaRaw = localStorage.getItem(slotKey(n)+'_meta');
      if(metaRaw) return JSON.parse(metaRaw);
      return null;
    }
    return JSON.parse(raw);
  }catch(_){ return null; }
}

function saveState(silent=false,targetSlot=currentSlot,forcedName=''){
  if(!state) return false;
  const slot=Number(targetSlot)||currentSlot;
  if(slot===0) return false;
  const slotName=(forcedName||state.slotName||slotNameOf(slot)||defaultSlotName(slot)).trim();
  try{
    /* v9.2: _savedAt を先に確定してから payload を作る。
       ローカル保存・クラウド送信の両方で同じタイムスタンプを使う。 */
    const ts = Date.now();
    const payload={...state, slotName, _savedAt: ts};

    const binary = encodeStateToBinary(payload);
    if(binary){
      /* GZ91: フォーマット — meta sidecar 不要 (state 全体が中に入っている) */
      localStorage.setItem(slotKey(slot), binary);
      localStorage.removeItem(slotKey(slot)+'_meta'); /* PB87 sidecar を削除 */
    } else {
      /* fflate 未読み込み時のフォールバック: 平文 JSON */
      localStorage.setItem(slotKey(slot), JSON.stringify(payload));
    }
    setSlotName(slot, slotName);
    if(slot===currentSlot) state.slotName=slotName;
    updateSlotButtons();
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
    if(raw.startsWith('GZ92:') || raw.startsWith('GZ91:')){
      /* v9.2/9.1: スキーマ圧縮+gzip / 旧gzip フォーマット */
      const decoded = decodeStateFromBinary(raw);
      if(!decoded){ state=null; return false; }
      /* GZ92 では history が空配列になるので、ローカルに別途保存された履歴を復元する必要はない
         (履歴はクラウドに送らずローカルのみで管理 — ここでは decoded のまま使う) */
      state = decoded;
    } else if(raw.startsWith('PB87:')){
      /* v8.7 Protobuf 後方互換: meta sidecar が正規ソース */
      const metaRaw = localStorage.getItem(slotKey(n)+'_meta');
      if(metaRaw){
        state = JSON.parse(metaRaw);
      } else {
        /* meta 欠損 — 復元不能 */
        state=null; return false;
      }
    } else {
      /* Legacy JSON */
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
  localStorage.removeItem(slotKey(n)+'_meta'); /* PB87 sidecar の残骸も削除 */
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
   FIREBASE CLOUD LINK — v9.1
   ─────────────────────────────────────────────────────────────────
   設計原則:
   • ログイン中 → クラウドが唯一の真実 (Source of Truth)
   • 未ログイン → localStorage のみ使用
   • クラウド保存: 生徒・クラス・スロットメタのみ (履歴は除外)
   • 圧縮: fflate gzip → Base64 → Firestore { gz: string, savedAt: number }
   • エラーはすべてトーストで通知
   • 同期ボタン (#sl-btn-sync) でいつでも手動同期可能
   Firestore パス: users/{uid}/slots/slot{n}
   ドキュメントフィールド: { gz: <GZ91:Base64文字列>, savedAt: <epoch ms> }
────────────────────────────────────────────────────────────────── */

let fbCurrentUser = null;

/* ── syncLoginUI — セーブモーダルのログイン状態表示を更新 ───── */
function syncLoginUI(user){
  fbCurrentUser = user || null;
  const loginBtn = document.getElementById('sl-btn-login');
  const userInfo = document.getElementById('sl-user-info');
  const userName = document.getElementById('sl-user-name');
  const syncBtn  = document.getElementById('sl-btn-sync');
  if(!loginBtn || !userInfo) return;
  if(user){
    loginBtn.classList.add('hidden');
    userInfo.classList.remove('hidden');
    if(userName) userName.textContent = user.displayName || user.email || 'ユーザー';
    if(syncBtn)  syncBtn.classList.remove('hidden');
  } else {
    loginBtn.classList.remove('hidden');
    userInfo.classList.add('hidden');
    if(syncBtn) syncBtn.classList.add('hidden');
  }
}

/* ── cloudPayload — クラウド送信用: 履歴を除いて gzip 圧縮 ──── */
function cloudPayload(payload){
  const slim = {...payload, history: []};
  return encodeStateToBinary(slim);
}

/* ── saveToCloud — 1スロットを Firestore に書き込む ─────────── */
async function saveToCloud(slot, payload){
  if(!fbCurrentUser) return;
  const db=window.fbDb, docF=window.fbDoc, setF=window.fbSetDoc;
  if(!db||!docF||!setF) return;
  try{
    const gz = cloudPayload(payload);
    if(!gz){ console.warn('[Cloud] gzip 失敗のため cloud save をスキップ'); return; }
    const ts  = payload._savedAt || Date.now();
    const ref = docF(db,'users',fbCurrentUser.uid,'slots',`slot${slot}`);
    await setF(ref, { gz, savedAt: ts });
  }catch(e){
    console.warn('[Cloud] saveToCloud failed:', e);
    toast(`☁ クラウド保存失敗 (スロット${slot}): ${e.code||e.message||e}`,'err',4000);
  }
}

/* ── loadFromCloud — 1スロットを Firestore から読み込む ──────── */
async function loadFromCloud(slot){
  if(!fbCurrentUser) return null;
  const db=window.fbDb, docF=window.fbDoc, getF=window.fbGetDoc;
  if(!db||!docF||!getF) return null;
  try{
    const ref  = docF(db,'users',fbCurrentUser.uid,'slots',`slot${slot}`);
    const snap = await getF(ref);
    if(!snap.exists()) return null;
    const d = snap.data();
    if(d.gz){
      const obj = decodeStateFromBinary(d.gz);
      if(obj){ if(!obj._savedAt) obj._savedAt = d.savedAt||0; return obj; }
    }
    if(d.data){
      const obj = JSON.parse(d.data);
      if(!obj._savedAt) obj._savedAt = d.savedAt||0;
      return obj;
    }
    return null;
  }catch(e){
    console.warn('[Cloud] loadFromCloud failed:', e); return null;
  }
}

/* ── overwriteLocalFromCloud — クラウドデータでローカルを上書き ─ */
function overwriteLocalFromCloud(n, cloudData){
  try{
    /* 履歴はローカルのものを引き継ぐ (クラウドには history:[] しか入っていない) */
    const existing = readRawSlotState(n);
    const merged   = {...cloudData, history: existing?.history || []};
    const binary   = encodeStateToBinary(merged);
    if(binary){
      localStorage.setItem(slotKey(n), binary);
      localStorage.removeItem(slotKey(n)+'_meta');
    } else {
      localStorage.setItem(slotKey(n), JSON.stringify(merged));
    }
    setSlotName(n, cloudData.slotName || defaultSlotName(n));
  }catch(e){
    console.warn('[Cloud] overwriteLocalFromCloud failed:', e);
  }
}

/* ── loadAllSlotsFromCloud — ログイン時: クラウドを全スロットに適用 ──
   クラウドが唯一の真実。クラウドにないスロットはローカルも削除。
   ローカルの履歴は保持する。エラーはトーストで通知。              */
async function loadAllSlotsFromCloud(){
  if(!fbCurrentUser) return;
  const db=window.fbDb, docF=window.fbDoc, getF=window.fbGetDoc;
  if(!db||!docF||!getF){ toast('☁ Firebase 未初期化','err'); return; }

  toast('☁ クラウドと同期中…','ok',2500);
  let synced=0, errors=0;

  for(let n=1;n<=NUM_SLOTS;n++){
    try{
      const ref  = docF(db,'users',fbCurrentUser.uid,'slots',`slot${n}`);
      const snap = await getF(ref);

      if(!snap.exists()){
        if(slotHasData(n)){
          localStorage.removeItem(slotKey(n));
          localStorage.removeItem(slotKey(n)+'_meta');
          const meta=loadSlotMeta(); meta[n]=defaultSlotName(n); saveSlotMeta(meta);
          synced++;
        }
        continue;
      }

      const d = snap.data();
      let cloudData = null;
      if(d.gz){
        cloudData = decodeStateFromBinary(d.gz);
        if(cloudData && !cloudData._savedAt) cloudData._savedAt = d.savedAt||0;
      } else if(d.data){
        cloudData = JSON.parse(d.data);
        if(!cloudData._savedAt) cloudData._savedAt = d.savedAt||0;
      }
      if(!cloudData) continue;

      overwriteLocalFromCloud(n, cloudData);
      synced++;
    }catch(e){
      console.warn(`[Cloud] sync slot${n} failed:`, e);
      errors++;
    }
  }

  updateSlotButtons();
  if(slModalOpen) renderSaveLoadModal();

  if(!isGuestMode && currentSlot>0 && slotHasData(currentSlot)){
    loadSlot(currentSlot);
    updateDateDisplay();
    navigate('home',{},true);
  }

  if(errors>0){
    toast(`☁ 同期完了 (${synced}スロット更新 / エラー${errors}件)`,'warn',4000);
  } else {
    toast(`☁ クラウドと同期しました (${synced}スロット更新)`,'ok',2800);
  }
}

/* ── initFirebase — onAuthStateChanged リスナーを登録 ─────────── */
function initFirebase(){
  const register = (onChanged)=>{
    onChanged(async user=>{
      syncLoginUI(user);
      if(user) await loadAllSlotsFromCloud();
    });
  };
  const onChanged = window.fbOnAuthChanged;
  if(typeof onChanged !== 'function'){
    setTimeout(()=>{
      if(typeof window.fbOnAuthChanged==='function') register(window.fbOnAuthChanged);
    }, 800);
    return;
  }
  register(onChanged);
}

/* ── bindFirebaseControls — ログイン/ログアウト/同期ボタンを紐付け ── */
function bindFirebaseControls(){
  document.getElementById('sl-btn-login')?.addEventListener('click', async ()=>{
    const signIn = window.fbSignIn;
    if(typeof signIn!=='function'){
      toast('✗ Firebase が初期化されていません','err'); return;
    }
    try{
      const result = await signIn();
      syncLoginUI(result.user);
      await loadAllSlotsFromCloud();
    }catch(e){
      if(e.code!=='auth/popup-closed-by-user')
        toast('✗ ログイン失敗: '+(e.message||e.code),'err');
    }
  });

  document.getElementById('sl-btn-logout')?.addEventListener('click', async ()=>{
    const signOut = window.fbSignOut;
    if(typeof signOut==='function'){ try{ await signOut(); }catch(_){} }
    toast('☁ ログアウトしました','warn',2000);
  });

  /* 同期ボタン — ログイン中のみ有効 */
  document.getElementById('sl-btn-sync')?.addEventListener('click', async ()=>{
    if(!fbCurrentUser){ toast('☁ ログインが必要です','warn'); return; }
    await loadAllSlotsFromCloud();
  });
}
