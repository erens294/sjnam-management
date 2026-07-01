/* ================================================================
   SJNAM — MODUL CERTIFICATE BUILDER
   ================================================================
   2 sub-modul digabung (sebelumnya tersambung tanpa pemisah dalam
   1 blok <script> yang sama di file asli):

   1. CUSTOM TEXT BLOCKS (CTB) — Teks bebas tambahan yang bisa
      diduplikat & diposisikan bebas di atas sertifikat (drag & drop),
      terpisah per template (Sriwijaya Air / NAM Air / Both).
   2. CERTIFICATE FIELD STYLING — panel kontrol ukuran/warna/font
      untuk field bawaan sertifikat (Nama, No, Validity), termasuk
      reset ke default per field.

   Diekstrak dari index.html (sebelumnya 2 IIFE berurutan tanpa
   pemisah <script>, baris ~6265-6866 di file asli — modul KEDUA
   tidak punya komentar header sendiri di source asli). Lihat
   REFACTOR_NOTES.md bagian "Tahap 6".

   ⚠️ URUTAN LOAD: file ini membungkus (wrap) window.renderCertificate
   dan window.loadCertificateTemplate yang basis definisinya ada di
   js/training.js (yang SENDIRI sudah membungkus versi lebih dasar).
   WAJIB dimuat SETELAH js/training.js. Wrapping di sini AMAN
   terlepas dari urutan load yang tepat karena dipanggil via
   DOMContentLoaded/setTimeout (bukan sinkron saat parse) dan
   di-guard dengan typeof check — tapi logisnya tetap harus setelah
   training.js untuk koherensi rantai wrapping.
   ================================================================ */

// CUSTOM TEXT BLOCKS — Teks bebas yang bisa diduplikat di sertifikat
// =================================================================
(function(){
  'use strict';

  const CTB_KEY      = 'sjn_cert_custom_texts_v1';   // legacy — kept for migration
  const CTB_KEY_SJ   = 'sjn_cert_custom_texts_sj_v1';
  const CTB_KEY_NAM  = 'sjn_cert_custom_texts_nam_v1';
  const CTB_KEY_BOTH = 'sjn_cert_custom_texts_both_v1';

  let blocks = [];       // current set displayed
  let selectedId = null;
  let blockCounter = 0;

  // Airline currently selected in the CTB panel
  function ctbActiveAirline(){
    const el = document.querySelector('input[name="ctbAirline"]:checked');
    return el ? el.value : 'sriwijaya'; // 'sriwijaya' | 'nam' | 'both'
  }

  // Resolve the storage key for a given airline value
  function ctbKey(airline){ 
    if(airline==='nam')  return CTB_KEY_NAM;
    if(airline==='both') return CTB_KEY_BOTH;
    return CTB_KEY_SJ;
  }

  // ----- Persistensi -----
  function saveBlocks(){
    try { localStorage.setItem(ctbKey(ctbActiveAirline()), JSON.stringify(blocks)); } catch(e){}
    if(typeof triggerAutoSync === 'function') triggerAutoSync();
  }
  function loadBlocks(airline){
    airline = airline || ctbActiveAirline();
    try {
      // try new per-airline key first; fall back to legacy key (one-time migration)
      const raw = localStorage.getItem(ctbKey(airline));
      if(raw){ blocks = JSON.parse(raw); }
      else {
        // legacy migration: if sriwijaya slot is empty, import from old shared key
        if(airline==='sriwijaya'){
          const legacy = localStorage.getItem(CTB_KEY);
          blocks = legacy ? JSON.parse(legacy) : [];
          if(blocks.length) localStorage.setItem(CTB_KEY_SJ, JSON.stringify(blocks)); // migrate
        } else { blocks = []; }
      }
      blockCounter = blocks.reduce((mx,b)=>Math.max(mx, parseInt(b.id.replace('ctb_',''))||0),0);
    } catch(e){ blocks = []; }
  }

  // ----- Helpers -----
  function newId(){ blockCounter++; return 'ctb_'+blockCounter; }
  function getEl(id, prefix){ return document.getElementById((prefix||'')+id); }

  // Semua preview container yang mendukung custom text blocks
  function allPreviews(){
    return ['pesertaCertPreview','certReprintPreview'].map(id=>document.getElementById(id)).filter(Boolean);
  }

  // Get the airlines for a specific preview container
  function airlinesForContainer(containerId){
    const p = window.lastCertData && window.lastCertData.p;
    if(!p) return undefined;
    return p.airlines; // 'sriwijaya' | 'nam'
  }

  // Load blocks for a specific airlines value (for rendering into cert preview)
  function blocksForAirlines(airlines){
    // Load 'both' blocks always, plus airline-specific
    let bothBlocks = [];
    let alBlocks   = [];
    try { bothBlocks = JSON.parse(localStorage.getItem(CTB_KEY_BOTH)||'[]')||[]; } catch(e){}
    if(airlines==='nam'){
      try { alBlocks = JSON.parse(localStorage.getItem(CTB_KEY_NAM)||'[]')||[]; } catch(e){}
    } else {
      // sriwijaya (or undefined → show SJ by default)
      try {
        alBlocks = JSON.parse(localStorage.getItem(CTB_KEY_SJ)||'null');
        if(!alBlocks){
          // legacy migration
          alBlocks = JSON.parse(localStorage.getItem(CTB_KEY)||'[]')||[];
        }
      } catch(e){ alBlocks=[]; }
    }
    return [...bothBlocks, ...alBlocks];
  }

  // ----- Render semua block ke preview -----
  // In admin panel (CTB editor): renders blocks for the currently-selected airline tab
  // In cert preview containers: renders the correct airline's blocks
  function renderAllBlocks(){
    allPreviews().forEach(container=>{
      container.querySelectorAll('.ctb-el').forEach(e=>e.remove());
      // Determine which blocks apply to this container
      const airlines = airlinesForContainer(container.id);
      const containerBlocks = (airlines !== undefined)
        ? blocksForAirlines(airlines)
        : blocks; // in admin mode (no cert loaded), show current panel airline's blocks
      containerBlocks.forEach(b=> renderBlockInContainer(b, container));
    });
    renderList();
  }

  // Expose a version that refreshes all containers (called after cert load)
  window.ctbRenderAll = renderAllBlocks;

  function styleEl(el, b){
    el.style.position       = 'absolute';
    el.style.left           = b.left   || '50%';
    el.style.top            = b.top    || '10%';
    el.style.fontSize       = (b.fontSize||24)+'px';
    el.style.fontFamily     = b.fontFamily  || 'Inter, sans-serif';
    el.style.fontWeight     = b.fontWeight  || 'bold';
    el.style.fontStyle      = b.fontStyle   || 'normal';
    el.style.textDecoration = b.textDecoration || 'none';
    el.style.textAlign      = b.textAlign   || 'center';
    el.style.color          = b.color       || '#1d4ed8';
    el.style.background     = b.bgColor === 'transparent' ? 'transparent' : (b.bgColor || 'transparent');
    el.style.maxWidth       = b.maxWidth    || '90%';
    el.style.transform      = b.transform  || 'translate(-50%,-50%)';
    el.style.whiteSpace     = 'pre-wrap';
    el.style.wordBreak      = 'break-word';
    el.style.lineHeight     = '1.25';
    el.style.cursor         = 'move';
    el.style.userSelect     = 'none';
    el.style.zIndex         = '10';
    el.style.padding        = '0 4px';
    // highlight jika dipilih
    el.style.outline = (b.id === selectedId) ? '2px dashed rgba(16,185,129,0.8)' : '1px dashed transparent';
  }

  function renderBlockInContainer(b, container){
    const el = document.createElement('div');
    el.className    = 'ctb-el cert-field';
    el.dataset.ctbId = b.id;
    el.dataset.containerId = container.id;
    el.textContent  = b.text || '';
    styleEl(el, b);
    makeDraggableCtb(el, container, b);
    el.addEventListener('click', e=>{ e.stopPropagation(); selectBlock(b.id); });
    container.appendChild(el);
  }

  // ----- Drag untuk custom block -----
  function makeDraggableCtb(el, container, b){
    let isDown=false, sx, sy, sl, st;
    el.addEventListener('mousedown', e=>{
      isDown=true; sx=e.clientX; sy=e.clientY;
      const r=el.getBoundingClientRect(), pr=container.getBoundingClientRect();
      sl=r.left-pr.left; st=r.top-pr.top;
      el.style.transform='translate(0,0)';
      b.transform='translate(0,0)';
      e.preventDefault(); e.stopPropagation();
    });
    document.addEventListener('mousemove', e=>{
      if(!isDown) return;
      const pr=container.getBoundingClientRect();
      let nl=sl+(e.clientX-sx), nt=st+(e.clientY-sy);
      nl=Math.max(0,Math.min(nl, pr.width-el.offsetWidth));
      nt=Math.max(0,Math.min(nt, pr.height-el.offsetHeight));
      el.style.left=(nl/pr.width*100)+'%';
      el.style.top=(nt/pr.height*100)+'%';
      b.left=(nl/pr.width*100)+'%';
      b.top=(nt/pr.height*100)+'%';
    });
    document.addEventListener('mouseup', ()=>{ if(isDown){ isDown=false; saveBlocks(); syncOtherPreviews(b); } });
    // touch
    el.addEventListener('touchstart', e=>{
      const t=e.touches[0]; isDown=true; sx=t.clientX; sy=t.clientY;
      const r=el.getBoundingClientRect(), pr=container.getBoundingClientRect();
      sl=r.left-pr.left; st=r.top-pr.top;
      el.style.transform='translate(0,0)'; b.transform='translate(0,0)';
    },{passive:true});
    document.addEventListener('touchmove', e=>{
      if(!isDown) return;
      const t=e.touches[0], pr=container.getBoundingClientRect();
      let nl=sl+(t.clientX-sx), nt=st+(t.clientY-sy);
      el.style.left=(nl/pr.width*100)+'%';
      el.style.top=(nt/pr.height*100)+'%';
      b.left=(nl/pr.width*100)+'%';
      b.top=(nt/pr.height*100)+'%';
    },{passive:true});
    document.addEventListener('touchend', ()=>{ if(isDown){ isDown=false; saveBlocks(); syncOtherPreviews(b); }});
    // wheel resize
    el.addEventListener('wheel', e=>{
      if(!e.ctrlKey && !e.altKey && !e.metaKey) return;
      e.preventDefault();
      let fs=parseFloat(b.fontSize||24)+(e.deltaY<0?1:-1);
      fs=Math.max(6,Math.min(120,fs));
      b.fontSize=fs;
      el.style.fontSize=fs+'px';
      if(b.id===selectedId){ const s=document.getElementById('ctbFontSize'); if(s){s.value=Math.round(fs); document.getElementById('ctbFontSizeLabel').textContent=Math.round(fs);} }
      saveBlocks();
      syncOtherPreviews(b);
    });
  }

  // Sync posisi/style block di semua preview container lain
  function syncOtherPreviews(b){
    allPreviews().forEach(container=>{
      const el=container.querySelector('[data-ctb-id="'+b.id+'"]');
      if(el) styleEl(el,b);
    });
  }

  // ----- List panel -----
  function renderList(){
    const list  = document.getElementById('customTextList');
    const empty = document.getElementById('customTextEmpty');
    if(!list) return;
    // hapus row lama
    list.querySelectorAll('.ctb-row').forEach(r=>r.remove());
    if(blocks.length===0){ if(empty) empty.classList.remove('hidden'); return; }
    if(empty) empty.classList.add('hidden');
    blocks.forEach((b,i)=>{
      const row = document.createElement('div');
      row.className='ctb-row flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition '+(b.id===selectedId?'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20':'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800');
      row.innerHTML=`
        <span class="flex-1 text-xs font-medium truncate">${(b.text||'(kosong)').replace(/\n/g,' ')}</span>
        <span class="text-[10px] text-slate-400">${b.fontSize||24}px</span>
        <button class="ctb-up px-1.5 py-0.5 text-xs bg-slate-200 dark:bg-slate-700 rounded" title="Naik">↑</button>
        <button class="ctb-dn px-1.5 py-0.5 text-xs bg-slate-200 dark:bg-slate-700 rounded" title="Turun">↓</button>
        <button class="ctb-del px-1.5 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 rounded" title="Hapus">✕</button>
      `;
      row.querySelector('.ctb-up').addEventListener('click', e=>{ e.stopPropagation(); moveBlock(i,-1); });
      row.querySelector('.ctb-dn').addEventListener('click', e=>{ e.stopPropagation(); moveBlock(i,+1); });
      row.querySelector('.ctb-del').addEventListener('click', e=>{ e.stopPropagation(); deleteBlock(b.id); });
      row.addEventListener('click', ()=> selectBlock(b.id));
      list.appendChild(row);
    });
  }

  // ----- Select block → isi editor -----
  function selectBlock(id){
    selectedId = id;
    const b = blocks.find(x=>x.id===id);
    if(!b) return;

    // highlight di preview
    allPreviews().forEach(c=>{
      c.querySelectorAll('.ctb-el').forEach(el=>{
        el.style.outline = el.dataset.ctbId===id ? '2px dashed rgba(16,185,129,0.8)' : '1px dashed transparent';
      });
    });

    // tampilkan editor
    const ed=document.getElementById('customTextEditor');
    if(ed) ed.classList.remove('hidden');
    document.getElementById('ctbEditLabel').textContent = (b.text||'(kosong)').replace(/\n/g,' ').slice(0,30);

    // isi nilai
    const setVal=(id,v)=>{ const el=document.getElementById(id); if(el) el.value=v||''; };
    setVal('ctbText', b.text);
    setVal('ctbFontFamily', b.fontFamily||'Inter, sans-serif');
    const fs = Math.round(parseFloat(b.fontSize)||24);
    setVal('ctbFontSize', fs);
    document.getElementById('ctbFontSizeLabel').textContent=fs;
    // warna: perlu konversi rgb→hex
    let col=b.color||'#1d4ed8';
    if(col.startsWith('rgb')){ const m=col.match(/\d+/g); if(m&&m.length>=3) col='#'+[m[0],m[1],m[2]].map(x=>parseInt(x).toString(16).padStart(2,'0')).join(''); }
    setVal('ctbFontColor', col);
    setVal('ctbBgColor', (b.bgColor&&b.bgColor!=='transparent')?b.bgColor:'#ffffff');
    setVal('ctbMaxWidth', b.maxWidth||'90%');

    // Bold/italic/underline highlight
    document.getElementById('ctbBtnBold')?.classList.toggle('bg-emerald-200',(b.fontWeight==='bold'||parseInt(b.fontWeight)>=700));
    document.getElementById('ctbBtnItalic')?.classList.toggle('bg-emerald-200', b.fontStyle==='italic');
    document.getElementById('ctbBtnUnderline')?.classList.toggle('bg-emerald-200', (b.textDecoration||'').includes('underline'));

    // Align highlight
    ['Left','Center','Right'].forEach(a=>{
      const btn=document.getElementById('ctbBtnAlign'+a);
      if(btn){ btn.className=btn.className.replace(/bg-emerald-\d+[^\s]*/g,'').replace(/text-emerald-\d+[^\s]*/g,'').trim()+' px-3 py-1.5 text-xs rounded-lg bg-slate-200 dark:bg-slate-700'; }
    });
    const aKey=((b.textAlign||'center').charAt(0).toUpperCase()+(b.textAlign||'center').slice(1));
    const activeAlignBtn=document.getElementById('ctbBtnAlign'+aKey);
    if(activeAlignBtn) activeAlignBtn.className=activeAlignBtn.className.replace(/bg-slate-200[^\s]*/g,'').trim()+' bg-emerald-100 text-emerald-700 font-semibold';

    renderList();
  }

  // ----- Apply dari editor ke block -----
  function applyEditor(){
    const b=blocks.find(x=>x.id===selectedId);
    if(!b) return;
    b.text          = document.getElementById('ctbText')?.value || '';
    b.fontFamily    = document.getElementById('ctbFontFamily')?.value || 'Inter, sans-serif';
    b.fontSize      = parseFloat(document.getElementById('ctbFontSize')?.value||'24');
    b.color         = document.getElementById('ctbFontColor')?.value || '#1d4ed8';
    const bgRaw     = document.getElementById('ctbBgColor')?.value;
    b.bgColor       = (!bgRaw||bgRaw==='#ffffff') ? 'transparent' : bgRaw;
    b.maxWidth      = document.getElementById('ctbMaxWidth')?.value || '90%';
    saveBlocks();
    renderAllBlocks();
    selectBlock(selectedId);
  }

  // ----- Tambah block baru -----
  function addBlock(source){
    const id=newId();
    const b = source ? {...source, id, left:'50%', top: (parseFloat(source.top||'10')+8)+'%', transform:'translate(-50%,-50%)'} : {
      id, text:'Teks Baru', left:'50%', top:'15%', transform:'translate(-50%,-50%)',
      fontSize:28, fontFamily:'Impact, sans-serif', fontWeight:'bold', fontStyle:'normal',
      textDecoration:'none', textAlign:'center', color:'#1d4ed8', bgColor:'transparent', maxWidth:'90%'
    };
    blocks.push(b);
    saveBlocks();
    renderAllBlocks();
    selectBlock(id);
  }

  function deleteBlock(id){
    if(!confirm('Hapus custom text block ini?')) return;
    blocks=blocks.filter(b=>b.id!==id);
    if(selectedId===id){ selectedId=null; const ed=document.getElementById('customTextEditor'); if(ed) ed.classList.add('hidden'); }
    saveBlocks();
    renderAllBlocks();
  }

  function moveBlock(idx, dir){
    const ni=idx+dir;
    if(ni<0||ni>=blocks.length) return;
    [blocks[idx],blocks[ni]]=[blocks[ni],blocks[idx]];
    saveBlocks();
    renderAllBlocks();
  }

  // ----- Toggle bold/italic/underline -----
  function ctbToggle(prop, valOn, valOff){
    const b=blocks.find(x=>x.id===selectedId); if(!b) return;
    b[prop]=(b[prop]===valOn)?valOff:valOn;
    saveBlocks(); renderAllBlocks(); selectBlock(selectedId);
  }
  function ctbSetAlign(align){
    const b=blocks.find(x=>x.id===selectedId); if(!b) return;
    b.textAlign=align; saveBlocks(); renderAllBlocks(); selectBlock(selectedId);
  }
  window.ctbSetColor=function(c){ document.getElementById('ctbFontColor').value=c; const b=blocks.find(x=>x.id===selectedId); if(b){b.color=c;saveBlocks();renderAllBlocks();selectBlock(selectedId);} };
  window.ctbSetBg=function(c){ const b=blocks.find(x=>x.id===selectedId); if(!b) return; b.bgColor=c; if(c!=='transparent') document.getElementById('ctbBgColor').value=c; saveBlocks(); renderAllBlocks(); selectBlock(selectedId); };

  // ----- Init -----
  function init(){
    loadBlocks('sriwijaya'); // default to SJ on load
    renderAllBlocks();
    window.ctbRenderAll = renderAllBlocks;

    // Airline selector: switch block set when radio changes
    document.querySelectorAll('input[name="ctbAirline"]').forEach(radio=>{
      radio.addEventListener('change', ()=>{
        // save current blocks before switching
        selectedId = null;
        const ed=document.getElementById('customTextEditor'); if(ed) ed.classList.add('hidden');
        loadBlocks(ctbActiveAirline());
        renderAllBlocks();
      });
    });

    document.getElementById('btnAddCustomText')?.addEventListener('click', ()=> addBlock(null));

    document.getElementById('btnCtbApply')?.addEventListener('click', applyEditor);

    document.getElementById('btnCtbDuplicate')?.addEventListener('click', ()=>{
      const b=blocks.find(x=>x.id===selectedId); if(b) addBlock(b);
    });

    document.getElementById('btnCtbDelete')?.addEventListener('click', ()=>{
      if(selectedId) deleteBlock(selectedId);
    });

    // Live update text saat mengetik
    document.getElementById('ctbText')?.addEventListener('input', ()=>{
      const b=blocks.find(x=>x.id===selectedId); if(!b) return;
      b.text=document.getElementById('ctbText').value;
      allPreviews().forEach(c=>{ const el=c.querySelector('[data-ctb-id="'+b.id+'"]'); if(el) el.textContent=b.text; });
      document.getElementById('ctbEditLabel').textContent=(b.text||'(kosong)').replace(/\n/g,' ').slice(0,30);
      saveBlocks();
    });

    // Font family
    document.getElementById('ctbFontFamily')?.addEventListener('change', ()=>{
      const b=blocks.find(x=>x.id===selectedId); if(!b) return;
      b.fontFamily=document.getElementById('ctbFontFamily').value;
      syncOtherPreviews(b); saveBlocks();
    });

    // Slider font size
    const sizeSlider=document.getElementById('ctbFontSize');
    if(sizeSlider) sizeSlider.addEventListener('input', ()=>{
      const b=blocks.find(x=>x.id===selectedId); if(!b) return;
      b.fontSize=parseFloat(sizeSlider.value);
      document.getElementById('ctbFontSizeLabel').textContent=Math.round(b.fontSize);
      syncOtherPreviews(b); saveBlocks();
    });

    document.getElementById('btnCtbFontInc')?.addEventListener('click', ()=>{
      const s=document.getElementById('ctbFontSize'); if(!s) return;
      s.value=Math.min(120,parseInt(s.value)+1); s.dispatchEvent(new Event('input'));
    });
    document.getElementById('btnCtbFontDec')?.addEventListener('click', ()=>{
      const s=document.getElementById('ctbFontSize'); if(!s) return;
      s.value=Math.max(6,parseInt(s.value)-1); s.dispatchEvent(new Event('input'));
    });

    // Color picker
    document.getElementById('ctbFontColor')?.addEventListener('input', e=>{
      const b=blocks.find(x=>x.id===selectedId); if(!b) return;
      b.color=e.target.value; syncOtherPreviews(b); saveBlocks();
    });
    document.getElementById('ctbBgColor')?.addEventListener('input', e=>{
      const b=blocks.find(x=>x.id===selectedId); if(!b) return;
      b.bgColor=e.target.value; syncOtherPreviews(b); saveBlocks();
    });

    // max-width
    document.getElementById('ctbMaxWidth')?.addEventListener('change', ()=>{
      const b=blocks.find(x=>x.id===selectedId); if(!b) return;
      b.maxWidth=document.getElementById('ctbMaxWidth').value; syncOtherPreviews(b); saveBlocks();
    });

    // Style toggles
    document.getElementById('ctbBtnBold')?.addEventListener('click', ()=> ctbToggle('fontWeight','bold','normal'));
    document.getElementById('ctbBtnItalic')?.addEventListener('click', ()=> ctbToggle('fontStyle','italic','normal'));
    document.getElementById('ctbBtnUnderline')?.addEventListener('click', ()=> ctbToggle('textDecoration','underline','none'));
    document.getElementById('ctbBtnAlignLeft')?.addEventListener('click', ()=> ctbSetAlign('left'));
    document.getElementById('ctbBtnAlignCenter')?.addEventListener('click', ()=> ctbSetAlign('center'));
    document.getElementById('ctbBtnAlignRight')?.addEventListener('click', ()=> ctbSetAlign('right'));

    // Re-render ketika template berubah (loadCertificateTemplate dipanggil ulang)
    const origLoad = window.loadCertificateTemplate;
    if(typeof origLoad==='function'){
      window.loadCertificateTemplate = function(){
        const r = origLoad.apply(this, arguments);
        setTimeout(renderAllBlocks, 20);
        return r;
      };
    }

    // Re-render ketika renderCertificate dipanggil (setelah cari/cetak ulang)
    const origRender = window.renderCertificate;
    if(typeof origRender==='function'){
      window.renderCertificate = function(p, prefix){
        const r = origRender.apply(this, arguments);
        setTimeout(renderAllBlocks, 50);
        return r;
      };
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 300);
  }

})();
(function(){
  function getSelectedField(){
    const sel = document.getElementById('certFieldSelector');
    if(!sel) return null;
    return sel.value; // 'Name', 'No', 'Validity'
  }

  function getFieldEls(fieldKey){
    return [
      document.getElementById('pesertaCert'+fieldKey),
      document.getElementById('certReprint'+fieldKey)
    ].filter(Boolean);
  }

  // Terapkan style dari panel ke elemen yang dipilih
  window.applyFontStyle = function(){
    const fieldKey = getSelectedField();
    if(!fieldKey) return;
    const els = getFieldEls(fieldKey);
    const family = document.getElementById('certFontFamily')?.value || '';
    const size   = document.getElementById('certFontSize')?.value || '16';
    const color  = document.getElementById('certFontColor')?.value || '#000000';
    els.forEach(el=>{
      if(family) el.style.fontFamily = family;
      el.style.fontSize = size + 'px';
      el.style.color = color;
    });
    if(document.getElementById('certFontSizeLabel')) document.getElementById('certFontSizeLabel').textContent = size;
    if(typeof savePositions === 'function') savePositions();
  };

  // Sync panel dengan nilai field yang dipilih
  function syncPanelToField(){
    const fieldKey = getSelectedField();
    if(!fieldKey) return;
    const el = document.getElementById('pesertaCert'+fieldKey) || document.getElementById('certReprint'+fieldKey);
    if(!el) return;
    const cs = window.getComputedStyle(el);
    const fs = parseFloat(el.style.fontSize || cs.fontSize) || 16;
    if(document.getElementById('certFontSize')) document.getElementById('certFontSize').value = Math.round(fs);
    if(document.getElementById('certFontSizeLabel')) document.getElementById('certFontSizeLabel').textContent = Math.round(fs);
    if(el.style.color && document.getElementById('certFontColor')){
      // Konversi rgb ke hex jika perlu
      let c = el.style.color;
      if(c.startsWith('rgb')){
        const m = c.match(/\d+/g);
        if(m && m.length>=3) c = '#'+[m[0],m[1],m[2]].map(x=>parseInt(x).toString(16).padStart(2,'0')).join('');
      }
      document.getElementById('certFontColor').value = c || '#000000';
    }
    if(el.style.fontFamily && document.getElementById('certFontFamily')){
      const ff = document.getElementById('certFontFamily');
      // cari opsi yang paling cocok
      for(let opt of ff.options){ if(el.style.fontFamily.includes(opt.value.replace(/['"]/g,'').split(',')[0].trim())){ ff.value = opt.value; break; } }
    }
    // Bold / italic / underline
    const bold = (el.style.fontWeight === 'bold' || el.style.fontWeight >= 700);
    const italic = el.style.fontStyle === 'italic';
    const underline = (el.style.textDecoration||'').includes('underline');
    document.getElementById('btnFontBold')?.classList.toggle('bg-blue-200', bold);
    document.getElementById('btnFontItalic')?.classList.toggle('bg-blue-200', italic);
    document.getElementById('btnFontUnderline')?.classList.toggle('bg-blue-200', underline);
    // Align
    const align = el.style.textAlign || 'center';
    ['Left','Center','Right'].forEach(a=>{
      const btn = document.getElementById('btnFontAlign'+a);
      if(btn){ btn.className = btn.className.replace(/bg-blue-100[^\s]*/g,'').replace(/text-blue-700[^\s]*/g,'').trim(); }
    });
    const activeAlignBtn = document.getElementById('btnFontAlign'+align.charAt(0).toUpperCase()+align.slice(1));
    if(activeAlignBtn) activeAlignBtn.classList.add('bg-blue-100','text-blue-700','font-semibold');
  }

  function toggleStyle(prop, valOn, valOff){
    const fieldKey = getSelectedField();
    if(!fieldKey) return;
    const els = getFieldEls(fieldKey);
    const current = els[0]?.style[prop] || '';
    const newVal = (current === valOn) ? valOff : valOn;
    els.forEach(el=> el.style[prop] = newVal);
    syncPanelToField();
    if(typeof savePositions === 'function') savePositions();
  }

  function setAlign(align){
    const fieldKey = getSelectedField();
    if(!fieldKey) return;
    getFieldEls(fieldKey).forEach(el=> el.style.textAlign = align);
    syncPanelToField();
    if(typeof savePositions === 'function') savePositions();
  }

  function init(){
    const fieldSel = document.getElementById('certFieldSelector');
    if(fieldSel) fieldSel.addEventListener('change', syncPanelToField);

    const fontFamily = document.getElementById('certFontFamily');
    if(fontFamily) fontFamily.addEventListener('change', applyFontStyle);

    const fontSizeSlider = document.getElementById('certFontSize');
    if(fontSizeSlider) fontSizeSlider.addEventListener('input', applyFontStyle);

    const fontColor = document.getElementById('certFontColor');
    if(fontColor) fontColor.addEventListener('input', applyFontStyle);

    document.getElementById('btnFontInc')?.addEventListener('click', ()=>{
      const s = document.getElementById('certFontSize');
      if(s){ s.value = Math.min(72, parseInt(s.value)+1); applyFontStyle(); }
    });
    document.getElementById('btnFontDec')?.addEventListener('click', ()=>{
      const s = document.getElementById('certFontSize');
      if(s){ s.value = Math.max(8, parseInt(s.value)-1); applyFontStyle(); }
    });

    document.getElementById('btnFontBold')?.addEventListener('click', ()=> toggleStyle('fontWeight','bold','normal'));
    document.getElementById('btnFontItalic')?.addEventListener('click', ()=> toggleStyle('fontStyle','italic','normal'));
    document.getElementById('btnFontUnderline')?.addEventListener('click', ()=> toggleStyle('textDecoration','underline','none'));

    document.getElementById('btnFontAlignLeft')?.addEventListener('click', ()=> setAlign('left'));
    document.getElementById('btnFontAlignCenter')?.addEventListener('click', ()=> setAlign('center'));
    document.getElementById('btnFontAlignRight')?.addEventListener('click', ()=> setAlign('right'));

    document.getElementById('btnResetFontField')?.addEventListener('click', ()=>{
      const fieldKey = getSelectedField();
      if(!fieldKey) return;
      const defaults = {
        Name: {fontSize:'22px', color:'#000000', fontFamily:'', fontWeight:'bold', fontStyle:'normal', textDecoration:'none', textAlign:'center'},
        No:   {fontSize:'13px', color:'#000000', fontFamily:'', fontWeight:'normal', fontStyle:'normal', textDecoration:'none', textAlign:'center'},
        Validity: {fontSize:'12px', color:'#000000', fontFamily:'', fontWeight:'normal', fontStyle:'normal', textDecoration:'none', textAlign:'center'}
      };
      const d = defaults[fieldKey] || defaults.Name;
      getFieldEls(fieldKey).forEach(el=>{
        Object.keys(d).forEach(k=> el.style[k] = d[k]);
      });
      syncPanelToField();
      if(typeof savePositions === 'function') savePositions();
    });

    // Sync panel saat pertama kali
    setTimeout(syncPanelToField, 600);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 200);
  }
})();
