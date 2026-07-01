/* ================================================================
   SJNAM — MODUL HOME TAB EDITOR
   ================================================================
   Editor logo & background untuk halaman Home — upload/reset logo
   Sriwijaya Air & NAM Air, resize, ubah background, toggle mode edit
   (khusus Admin/Master).

   Diekstrak dari index.html (sebelumnya IIFE mandiri, baris
   ~6871-7057 di file asli). Lihat REFACTOR_NOTES.md bagian "Tahap 6".

   URUTAN LOAD: independen — tidak ada pemanggilan sinkron ke fungsi
   modul lain saat top-level, init selalu via DOMContentLoaded.
   ================================================================ */

// ── HOME TAB: Logo & Background Editor ──────────────────────────────────────
(function(){
  const LS_BG = 'home_bg_v1';
  const LS_LOGO_SJ = 'home_logo_sj_v1';
  const LS_LOGO_NAM = 'home_logo_nam_v1';
  const LS_LOGO_SJ_SIZE = 'home_logo_sj_size_v1';
  const LS_LOGO_NAM_SIZE = 'home_logo_nam_size_v1';
  const LS_LOGO_SJ_POS = 'home_logo_sj_pos_v1';
  const LS_LOGO_NAM_POS = 'home_logo_nam_pos_v1';

  function initHomeEditor(){
    loadHomeBg();
    loadHomeLogo('sj');
    loadHomeLogo('nam');
    makeDraggable('logo-sj-wrap', LS_LOGO_SJ_POS);
    makeDraggable('logo-nam-wrap', LS_LOGO_NAM_POS);
  }

  function loadHomeBg(){
    try {
      const saved = localStorage.getItem(LS_BG);
      if(saved){
        document.getElementById('homeBg').style.backgroundImage = 'url('+saved+')';
        document.getElementById('homeBg').style.backgroundSize = 'cover';
      }
    } catch(e){}
  }

  function loadHomeLogo(which){
    const lsKey = which==='sj' ? LS_LOGO_SJ : LS_LOGO_NAM;
    const lsSizeKey = which==='sj' ? LS_LOGO_SJ_SIZE : LS_LOGO_NAM_SIZE;
    const lsPosKey = which==='sj' ? LS_LOGO_SJ_POS : LS_LOGO_NAM_POS;
    try {
      const src = localStorage.getItem(lsKey);
      const img = document.getElementById('logo-'+which);
      const ph = document.getElementById('logo-'+which+'-placeholder');
      const wrap = document.getElementById('logo-'+which+'-wrap');
      if(src){
        img.src = src;
        img.style.display = 'block';
        if(ph) ph.style.display = 'none';
      }
      const size = localStorage.getItem(lsSizeKey);
      if(size && wrap){
        const s = JSON.parse(size);
        wrap.style.width = s.w + 'px';
        wrap.style.height = s.h + 'px';
      }
      const pos = localStorage.getItem(lsPosKey);
      if(pos && wrap){
        const p = JSON.parse(pos);
        wrap.style.left = p.l + 'px';
        wrap.style.top = p.t + 'px';
        wrap.style.transform = 'none';
      }
    } catch(e){}
  }

  window.setHomeBg = function(inp){
    if(!inp.files || !inp.files[0]) return;
    const reader = new FileReader();
    reader.onload = function(e){
      const url = e.target.result;
      document.getElementById('homeBg').style.backgroundImage = 'url('+url+')';
      document.getElementById('homeBg').style.backgroundSize = 'cover';
      try { localStorage.setItem(LS_BG, url); } catch(e){}
    };
    reader.readAsDataURL(inp.files[0]);
    inp.value = '';
  };

  window.resetHomeBg = function(){
    document.getElementById('homeBg').style.backgroundImage = '';
    document.getElementById('homeBg').style.background = 'linear-gradient(135deg,#1e3a8a,#312e81)';
    try { localStorage.removeItem(LS_BG); } catch(e){}
  };

  window.setHomeLogo = function(which, inp){
    if(!inp.files || !inp.files[0]) return;
    const lsKey = which==='sj' ? LS_LOGO_SJ : LS_LOGO_NAM;
    const reader = new FileReader();
    reader.onload = function(e){
      const url = e.target.result;
      const img = document.getElementById('logo-'+which);
      const ph = document.getElementById('logo-'+which+'-placeholder');
      img.src = url;
      img.style.display = 'block';
      if(ph) ph.style.display = 'none';
      try { localStorage.setItem(lsKey, url); } catch(e){}
    };
    reader.readAsDataURL(inp.files[0]);
    inp.value = '';
  };

  window.resetHomeLogo = function(which){
    const lsKey = which==='sj' ? LS_LOGO_SJ : LS_LOGO_NAM;
    const lsSizeKey = which==='sj' ? LS_LOGO_SJ_SIZE : LS_LOGO_NAM_SIZE;
    const img = document.getElementById('logo-'+which);
    const ph = document.getElementById('logo-'+which+'-placeholder');
    const wrap = document.getElementById('logo-'+which+'-wrap');
    img.src = '';
    img.style.display = 'none';
    if(ph) ph.style.display = '';
    if(wrap){ wrap.style.width='180px'; wrap.style.height='100px'; }
    try { localStorage.removeItem(lsKey); localStorage.removeItem(lsSizeKey); } catch(e){}
  };

  window.resizeHomeLogo = function(which, delta){
    const lsSizeKey = which==='sj' ? LS_LOGO_SJ_SIZE : LS_LOGO_NAM_SIZE;
    const wrap = document.getElementById('logo-'+which+'-wrap');
    if(!wrap) return;
    const cw = parseInt(wrap.style.width)||180;
    const ch = parseInt(wrap.style.height)||100;
    const ratio = ch/cw;
    const nw = Math.max(60, Math.min(400, cw+delta));
    const nh = Math.round(nw*ratio);
    wrap.style.width = nw+'px';
    wrap.style.height = nh+'px';
    try { localStorage.setItem(lsSizeKey, JSON.stringify({w:nw,h:nh})); } catch(e){}
  };

  window.toggleHomeEdit = function(){
    // Guard: Admin dan Master bisa membuka panel edit Home
    if(!window.currentUser || (window.currentUser.role !== 'Admin' && window.currentUser.role !== 'Master')){
      if(typeof showToast === 'function') showToast('Hanya Admin/Master yang dapat mengedit tampilan Home', 'error');
      return;
    }
    const panel = document.getElementById('homeEditPanel');
    if(!panel) return;
    panel.style.display = panel.style.display==='none' ? 'block' : 'none';
    const btn = document.getElementById('btnHomeEditToggle');
    if(btn) btn.textContent = panel.style.display==='none' ? '✏️ Edit' : '✅ Selesai';
  };

  function makeDraggable(elemId, lsPosKey){
    const el = document.getElementById(elemId);
    if(!el) return;
    let isDragging = false, startX=0, startY=0, origL=0, origT=0;
    const getLeft = ()=> parseInt(el.style.left||el.offsetLeft)||0;
    const getTop = ()=> parseInt(el.style.top||el.offsetTop)||0;
    el.addEventListener('mousedown', function(e){
      if(e.target.tagName==='BUTTON'||e.target.tagName==='INPUT'||e.target.tagName==='LABEL') return;
      isDragging=true; startX=e.clientX; startY=e.clientY;
      origL=getLeft(); origT=getTop();
      el.style.transform='none';
      e.preventDefault();
    });
    document.addEventListener('mousemove', function(e){
      if(!isDragging) return;
      const dx=e.clientX-startX, dy=e.clientY-startY;
      const nl=origL+dx, nt=origT+dy;
      el.style.left=nl+'px'; el.style.top=nt+'px';
    });
    document.addEventListener('mouseup', function(){
      if(!isDragging) return;
      isDragging=false;
      try { localStorage.setItem(lsPosKey, JSON.stringify({l:getLeft(),t:getTop()})); } catch(e){}
    });
    // Touch support
    el.addEventListener('touchstart', function(e){
      if(e.target.tagName==='BUTTON'||e.target.tagName==='INPUT'||e.target.tagName==='LABEL') return;
      const t=e.touches[0];
      isDragging=true; startX=t.clientX; startY=t.clientY;
      origL=getLeft(); origT=getTop();
      el.style.transform='none';
    }, {passive:true});
    document.addEventListener('touchmove', function(e){
      if(!isDragging) return;
      const t=e.touches[0];
      const dx=t.clientX-startX, dy=t.clientY-startY;
      el.style.left=(origL+dx)+'px'; el.style.top=(origT+dy)+'px';
    }, {passive:true});
    document.addEventListener('touchend', function(){
      if(!isDragging) return;
      isDragging=false;
      try { localStorage.setItem(lsPosKey, JSON.stringify({l:getLeft(),t:getTop()})); } catch(e){}
    });
  }

  // Init after DOM ready
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', initHomeEditor);
  } else {
    initHomeEditor();
  }
})();
