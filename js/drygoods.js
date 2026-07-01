/* ================================================================
   SJNAM — MODUL DRYGOODS
   ================================================================
   Modul Kartu Stok & IFS Station Drygoods: transaksi stok, bank item,
   dashboard, data karyawan IFS per-station, notifikasi kontrak akan
   habis.

   Diekstrak dari index.html (sebelumnya IIFE mandiri, baris
   ~6870-8537 di file asli — terverifikasi BUKAN bagian dari modul
   "HOME TAB: Logo & Background Editor" yang langsung menyambung
   setelahnya dalam <script> tag yang sama tanpa pemisah). Lihat
   REFACTOR_NOTES.md bagian "Tahap 5".

   ⚠️ URUTAN LOAD WAJIB: file ini HARUS dimuat SETELAH js/auth.js.
   Modul ini membungkus (wrap) window.switchTab:
     const _origSwitch = window.switchTab;
     window.switchTab = function(tab){ _origSwitch(tab); ...logic drygoods... };
   — bagian dari rantai switchTab yang didokumentasikan sejak Tahap 1-2:
   base (service-recovery.js) → permission-gate (auth.js) → Enhanced-
   features (index.html) → Drygoods (file ini, HARUS LING TERAKHIR).
   Jika file ini dimuat SEBELUM auth.js, ia akan membungkus versi
   switchTab yang BELUM punya permission-gate — mengembalikan bug
   yang sama persis dengan regresi yang ditemukan & diperbaiki di
   Tahap 2.

   Desain modul ini sudah baik (sama seperti Training/STCR): IIFE
   sejak awal, tidak ada pemanggilan sinkron ke fungsi shared-utils.js
   saat top-level (semua di-guard typeof atau dipanggil via event
   listener/setTimeout) — aman dari race condition TDZ yang ditemukan
   berulang kali di Tahap 3 (Service Recovery).
   ================================================================ */

// =================================================================
// DRYGOODS MODULE — Kartu Stok & IFS Station
// =================================================================
(function(){
  'use strict';
  const DG_KEY  = 'sjnam_drygoods_v1';

  // ── BANK DATA STATION (single source of truth) ────────────────────
  // Semua station di modul Drygoods (Kartu Stok, IFS Station) WAJIB
  // berasal dari Bank Data Station (Tab Station / sjn_stations_v2),
  // sama seperti yang dipakai dropdown Station di Data Karyawan.
  function getBankStationList(){
    try { return JSON.parse(localStorage.getItem('sjn_stations_v2') || '[]'); } catch(e){ return []; }
  }
  function getBankStationCodes(){
    return getBankStationList().map(s=>s.iata).filter(Boolean);
  }
  function isValidBankStation(code){
    return getBankStationCodes().includes((code||'').toUpperCase());
  }
  // ── KARYAWAN (single source of truth) ─────────────────────────────
  // Data karyawan Drygoods TIDAK lagi disimpan terpisah (dgData.employees).
  // Semua baca/tulis karyawan memakai tabel utama Data Karyawan
  // (localStorage 'sjnam_karyawan_v1'), field tambahan: joinDate,
  // expiredKontrak, note — ditambahkan ke skema karyawan utama.
  function getKaryawanList(){
    try { return JSON.parse(localStorage.getItem('sjnam_karyawan_v1') || '[]'); } catch(e){ return []; }
  }
  function saveKaryawanList(list){
    try { localStorage.setItem('sjnam_karyawan_v1', JSON.stringify(list)); } catch(e){}
    if(typeof triggerAutoSync === 'function') triggerAutoSync('karyawan');
    if(typeof window.renderKaryawanTable === 'function') window.renderKaryawanTable();
    document.dispatchEvent(new CustomEvent('sjn:karyawan-updated'));
  }

  // dgData.stations sekarang berarti: "station yang AKTIF/dipilih untuk
  // ditampilkan sebagai tab" — bukan daftar station independen. Isinya
  // selalu disaring agar hanya berisi kode yang valid di Bank Data Station.
  let dgData = { transactions:[], stations: [], bankItems:[] };

  // ── STORAGE ──────────────────────────────────────────────────────
  function saveDrygoodsData(){
    try { localStorage.setItem(DG_KEY, JSON.stringify(dgData)); } catch(e){}
    if(typeof triggerAutoSync === 'function') triggerAutoSync();
  }
  // Tentukan daftar station aktif default: semua station yang sudah
  // dipakai di transaksi ATAU sudah ditugaskan ke karyawan User-DRG;
  // jika tidak ada sama sekali, fallback ke station yang ditugaskan ke
  // karyawan (apa pun rolenya), lalu fallback terakhir: kosong (user
  // pilih sendiri lewat "+ Station").
  function deriveActiveStations(){
    const fromTrx = dgData.transactions.map(t=>t.station).filter(Boolean);
    const fromKar=getKaryawanList().map(k=>k.station).filter(function(s){return s&&s!=='ALL';});
    const combined = Array.from(new Set([...fromTrx, ...fromKar]));
    const validCodes = new Set(getBankStationCodes());
    return combined.filter(s=>validCodes.has(s)).sort();
  }
  function loadDrygoodsData(){
    try {
      const raw = localStorage.getItem(DG_KEY);
      if(raw){
        const parsed = JSON.parse(raw);
        if(parsed && typeof parsed === 'object'){
          dgData.transactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
          dgData.bankItems    = Array.isArray(parsed.bankItems)    ? parsed.bankItems    : [];
          // Migrasi: buang dgData.employees lama (jika ada dari versi
          // sebelumnya) — data karyawan sekarang ikut tabel utama.
          // Migrasi karyawan lama (jika ada & belum pernah dipindah) ke
          // tabel Data Karyawan utama supaya tidak hilang.
          if(Array.isArray(parsed.employees) && parsed.employees.length && !parsed._dgEmpMigrated){
            migrateLegacyDgEmployees(parsed.employees);
          }
          // Validasi station tersimpan terhadap Bank Data Station; buang
          // kode yang sudah tidak ada di bank (dihapus admin) atau invalid.
          const validCodes = new Set(getBankStationCodes());
          let savedStations=Array.isArray(parsed.stations)?parsed.stations.filter(function(s){return validCodes.has(s)&&s!=='ALL';}):[];
          dgData.stations = savedStations.length ? savedStations : deriveActiveStations();
          return true;
        }
      }
    } catch(e){}
    dgData.stations = deriveActiveStations();
    return false;
  }
  // Migrasi satu kali: pindahkan karyawan dari dgData.employees (versi
  // lama, terpisah) ke tabel Data Karyawan utama agar tidak perlu input
  // dua kali lagi. NIP dipakai sebagai kunci pencocokan untuk hindari
  // duplikasi jika karyawan tersebut sudah ada di Data Karyawan.
  function migrateLegacyDgEmployees(legacyEmployees){
    try {
      const karyawanList = getKaryawanList();
      const existingNips = new Set(karyawanList.map(k=>(k.nip||'').toLowerCase()));
      let added = 0;
      legacyEmployees.forEach(e=>{
        const nip = (e.nip||'').trim();
        if(!nip || existingNips.has(nip.toLowerCase())) return;
        karyawanList.push({
          id: 'kar_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
          nama: e.name||'', nip, jabatan: e.position||'', station: e.station||'',
          hp:'', email:'', username:'',
          joinDate: e.joinDate||'', expiredKontrak: e.expired||'', note: e.note||'',
          updatedAt: new Date().toISOString()
        });
        existingNips.add(nip.toLowerCase());
        added++;
      });
      if(added){
        saveKaryawanList(karyawanList);
        showToast?.(`${added} data karyawan Drygoods (IFS) dipindahkan ke Data Karyawan`, 'success');
      }
    } catch(e){ console.warn('[DG migrate employees]', e); }
  }
  loadDrygoodsData();

  // ── HELPERS ───────────────────────────────────────────────────────
  const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function fmtDate(d){ if(!d)return'-'; const [y,m,dd]=d.split('-'); return `${dd}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m)-1]}-${y}`; }
  function todayStr(){ const n=new Date(); return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0'); }
  function genId(){ return 'dg_'+Date.now()+'_'+Math.random().toString(36).slice(2,7); }

  // ── STATION TABS ─────────────────────────────────────────────────
  let activeDgStation = 'ALL';
  function buildStationTabs(){
    const container = document.getElementById('dgStationTabs');
    if(!container) return;
    // Keep the last child (+ Station button)
    const addBtn = document.getElementById('btnDgAddStation');
    container.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.setAttribute('data-dg-station','ALL');
    allBtn.className = 'dg-station-tab px-3 py-2 text-sm font-semibold border-b-2 whitespace-nowrap '+(activeDgStation==='ALL'?'border-blue-600 text-blue-600':'border-transparent text-slate-500 hover:text-slate-700');
    allBtn.textContent = '🌐 All';
    container.appendChild(allBtn);
    dgData.stations.forEach(st=>{
      const btn = document.createElement('button');
      btn.setAttribute('data-dg-station', st);
      btn.className = 'dg-station-tab px-3 py-2 text-sm font-semibold border-b-2 whitespace-nowrap '+(activeDgStation===st?'border-blue-600 text-blue-600':'border-transparent text-slate-500 hover:text-slate-700');
      btn.textContent = '✈ '+st;
      container.appendChild(btn);
    });
    if(addBtn) container.appendChild(addBtn); else {
      const nb = document.createElement('button');
      nb.id = 'btnDgAddStation';
      nb.className = 'px-3 py-2 text-sm font-semibold text-slate-400 hover:text-blue-600 whitespace-nowrap';
      nb.textContent = '＋ Station';
      container.appendChild(nb);
    }
    // *** User-DRG: lock station tabs ke station karyawan ***
    const _cu = window.currentUser;
    if(_cu && _cu.role === 'User-DRG'){
      const _drgSt = window._userDrgStation;
      // BUG5 FIX: null=belum konfigurasi (perlakukan spt ALL), 'ALL'=akses semua
      if(!_drgSt || _drgSt === 'ALL'){
        container.querySelectorAll('[data-dg-station]').forEach(function(t){
          t.style.opacity=''; t.style.pointerEvents=''; t.title='';
        });
      } else {
        container.querySelectorAll('[data-dg-station]').forEach(function(t){
          var st=t.dataset.dgStation; if(!st) return;
          if(st===_drgSt){ t.style.opacity=''; t.style.pointerEvents=''; t.title=''; }
          else{ t.style.opacity='0.3'; t.style.pointerEvents='none';
            t.title=(st==='ALL'?'Akses terbatas':'Akses terbatas — hanya station '+_drgSt); }
        });
      }
    }
    // Wire station filter select (tampilkan kode + nama dari Bank Data Station)
    const bankList = getBankStationList();
    const labelOf = (code) => {
      const s = bankList.find(b=>b.iata===code);
      return s ? `${code} — ${s.name}` : code;
    };
    const sel = document.getElementById('dgActiveStation');
    if(sel){
      const curSel = sel.value;
      sel.innerHTML = '<option value="ALL">— Semua Station —</option>';
      dgData.stations.forEach(s=>{ const o=document.createElement('option'); o.value=s; o.textContent=labelOf(s); sel.appendChild(o); });
      if(dgData.stations.includes(curSel) || curSel==='ALL') sel.value = curSel;
    }
    // Filter IFS: hanya station yang sudah aktif (tab) — konsisten dengan tab di atas
    const ifsFilterEl = document.getElementById('dgIfsFilterStation');
    if(ifsFilterEl){
      const cur = ifsFilterEl.value;
      ifsFilterEl.innerHTML = '<option value="">— Semua Station —</option>' +
        dgData.stations.map(s=>`<option value="${esc(s)}">${esc(labelOf(s))}</option>`).join('');
      if(dgData.stations.includes(cur)) ifsFilterEl.value = cur;
    }
    // Form Transaksi & Form Karyawan: tawarkan SEMUA station di Bank Data
    // Station (bukan hanya yang sudah aktif) — supaya transaksi/karyawan
    // pertama di station baru tetap bisa diinput; station tersebut akan
    // otomatis ditambahkan ke daftar aktif begitu data pertamanya disimpan.
    ['dgTrxStation','dgEmpStation'].forEach(id=>{
      const el=document.getElementById(id); if(!el) return;
      const cur=el.value;
      el.innerHTML = '<option value="">-- Pilih --</option>' +
        bankList.map(s=>`<option value="${esc(s.iata)}">${esc(s.iata)} — ${esc(s.name)}</option>`).join('');
      if(bankList.some(s=>s.iata===cur)) el.value=cur;
    });
  }
  // Pastikan station baru otomatis muncul sebagai tab aktif begitu dipakai
  // di transaksi atau karyawan — tanpa harus lewat tombol "+ Station" dulu.
  function ensureStationActive(code){
    if(!code || !isValidBankStation(code)) return;
    if(!dgData.stations.includes(code)){
      dgData.stations.push(code);
      dgData.stations.sort();
      saveDrygoodsData();
    }
  }

  // ── SALDO CALCULATION ─────────────────────────────────────────────
  function calcSaldo(){
    // Map: { key: station+'|'+itemName => { nama,kode,satuan,in:0,out:0 } }
    const map = {};
    dgData.transactions.forEach(t=>{
      const key = (t.station||'')+'|'+(t.item||'').toLowerCase();
      if(!map[key]) map[key] = { nama:t.item, kode:t.kode||'', station:t.station, satuan:t.unit||'', in:0, out:0 };
      if(t.type==='IN') map[key].in += Number(t.qty)||0;
      else              map[key].out += Number(t.qty)||0;
    });
    return Object.values(map).map(r=>({ ...r, saldo: r.in - r.out }));
  }

  // ── RUNNING SALDO PER TRX ────────────────────────────────────────
  function getFilteredTrx(){
    const search = (document.getElementById('dgSearchTrx')?.value||'').toLowerCase();
    const type   = document.getElementById('dgFilterType')?.value||'';
    const from   = document.getElementById('dgFilterDateFrom')?.value||'';
    const to     = document.getElementById('dgFilterDateTo')?.value||'';
    // FIX-DRG: enforce station restriction at DATA level for User-DRG
    // This prevents bypass via DevTools console even if UI tabs are hidden
    // Special case: station='ALL' means user can access all stations (no restriction)
    // BUG3 FIX: null = karyawan belum dikonfigurasi stationnya.
    // Jangan gunakan '__NONE__' sentinel yang memblok SEMUA data.
    // null -> tampilkan semua data (sama dengan 'ALL') + warning di UI.
    // PATCH1 ROOT-FIX: Baca station DRG langsung dari karyawan localStorage
    // setiap render. Menjamin perubahan Admin langsung berlaku tanpa re-login.
    var _freshDrgSt = null;
    if (window.currentUser && window.currentUser.role === 'User-DRG') {
      try {
        var _kfr = JSON.parse(localStorage.getItem('sjnam_karyawan_v1') || '[]');
        var _myu = (window.currentUser.username || '').toLowerCase();
        var _kmr = _kfr.find(function(k){ return (k.username||'').toLowerCase() === _myu; });
        var _fst = (_kmr && _kmr.station) ? _kmr.station : null;
        // Sync cache jika berubah
        if (window._userDrgStation !== _fst) {
          window._userDrgStation = _fst;
          if (window.currentUser) window.currentUser.station = _fst;
        }
        _freshDrgSt = (_fst && _fst !== 'ALL') ? _fst : null;
      } catch(ex) {
        // fallback ke cache jika localStorage gagal dibaca
        var _fc = window._userDrgStation;
        _freshDrgSt = (_fc && _fc !== 'ALL') ? _fc : null;
      }
    }
    const _drgSt = _freshDrgSt;
    return dgData.transactions.filter(t=>{
      // User-DRG: hard-block access to other stations at data level
      // (_drgSt=null means either non-DRG or DRG with station=ALL → no restriction)
      if(_drgSt !== null && t.station !== _drgSt) return false;
      if(activeDgStation !== 'ALL' && t.station !== activeDgStation) return false;
      if(type && t.type !== type) return false;
      if(from && t.date < from) return false;
      if(to   && t.date > to)   return false;
      if(search && ![(t.item||'').toLowerCase(),(t.remark||'').toLowerCase()].join(' ').includes(search)) return false;
      return true;
    }).sort((a,b)=> a.date > b.date ? -1 : a.date < b.date ? 1 : 0);
  }

  // ── RENDER TRANSAKSI TABLE ────────────────────────────────────────
  let dgPage = 1;
  const DG_PAGE_SIZE = 30;
  let dgSelectedIds = new Set();
  let dgSelectAllMode = false; // true = semua data terfilter dipilih (cross-page)

  function getDgFilteredIds(){
    return getFilteredTrx().map(t=>t.id);
  }

  function updateDgBulkUI(){
    const filteredIds = getDgFilteredIds();
    const filteredTotal = filteredIds.length;
    const selCount = dgSelectAllMode ? filteredTotal : dgSelectedIds.size;

    // Toolbar group
    const group = document.getElementById('dgBulkActionGroup');
    const counter = document.getElementById('dgSelectedCount');
    const selAllCount = document.getElementById('dgSelectAllFilteredCount');
    const delAllCount = document.getElementById('dgDeleteAllFilteredCount');
    if(group){
      if(selCount > 0) group.classList.remove('hidden');
      else { group.classList.add('hidden'); closeBulkDropdown(); }
    }
    if(counter) counter.textContent = selCount;
    if(selAllCount) selAllCount.textContent = filteredTotal;
    if(delAllCount) delAllCount.textContent = dgSelectAllMode ? filteredTotal : selCount;

    // Banner
    const banner = document.getElementById('dgSelectAllBanner');
    const bannerText = document.getElementById('dgSelectAllBannerText');
    const bannerBtn = document.getElementById('btnDgSelectAllFilteredBanner');
    if(banner && bannerText && bannerBtn){
      const filtered = getFilteredTrx();
      const start = (dgPage-1)*DG_PAGE_SIZE;
      const pageIds = filtered.slice(start, start+DG_PAGE_SIZE).map(t=>t.id);
      const allPageSelected = pageIds.length > 0 && pageIds.every(id=> dgSelectAllMode || dgSelectedIds.has(id));

      if(dgSelectAllMode){
        banner.classList.remove('hidden');
        bannerText.textContent = `Semua ${filteredTotal} data terfilter dipilih.`;
        bannerBtn.textContent = '';
        bannerBtn.classList.add('hidden');
      } else if(allPageSelected && filteredTotal > pageIds.length){
        // All on this page selected, more pages exist → offer to select all
        banner.classList.remove('hidden');
        bannerText.textContent = `${pageIds.length} data di halaman ini dipilih.`;
        bannerBtn.textContent = `Pilih semua ${filteredTotal} data terfilter`;
        bannerBtn.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    }

    // Check-all header checkbox
    const checkAll = document.getElementById('dgCheckAll');
    if(checkAll){
      const filtered = getFilteredTrx();
      const start = (dgPage-1)*DG_PAGE_SIZE;
      const pageIds = filtered.slice(start, start+DG_PAGE_SIZE).map(t=>t.id);
      if(dgSelectAllMode){
        checkAll.checked = true;
        checkAll.indeterminate = false;
      } else {
        const allChecked = pageIds.length > 0 && pageIds.every(id=>dgSelectedIds.has(id));
        const someChecked = pageIds.some(id=>dgSelectedIds.has(id));
        checkAll.checked = allChecked;
        checkAll.indeterminate = !allChecked && someChecked;
      }
    }
  }

  function closeBulkDropdown(){
    document.getElementById('dgBulkDropdownMenu')?.classList.add('hidden');
  }

  function clearDgSelection(){
    dgSelectedIds.clear();
    dgSelectAllMode = false;
    updateDgBulkUI();
  }

  function renderDgTrx(){
    const tbody = document.getElementById('dgTrxTableBody');
    if(!tbody) return;
    const filtered = getFilteredTrx();
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total/DG_PAGE_SIZE));
    if(dgPage > totalPages) dgPage = totalPages;
    const start = (dgPage-1)*DG_PAGE_SIZE;
    const page = filtered.slice(start, start+DG_PAGE_SIZE);

    // Compute running saldo per item per station (non-mutating: separate map by id)
    const saldoById = {};
    [...dgData.transactions]
      .sort((a,b)=> a.date>b.date?1:a.date<b.date?-1:0)
      .forEach(t=>{
        const k=(t.station||'')+'|'+(t.item||'').toLowerCase();
        if(saldoById[k] === undefined) saldoById[k] = 0;
        saldoById[k] += (t.type==='IN'?1:-1)*(Number(t.qty)||0);
        saldoById[t.id] = saldoById[k]; // map by id for O(1) lookup
      });

    if(!page.length){
      tbody.innerHTML='<tr><td colspan="13" class="text-center py-8 text-slate-400 text-sm">Tidak ada data transaksi.</td></tr>';
    } else {
      tbody.innerHTML = page.map((t,i)=>{
        const isIn = t.type==='IN';
        const saldoVal = saldoById[t.id] !== undefined ? saldoById[t.id] : '-';
        const saldoClass = typeof saldoVal === 'number' ? (saldoVal < 0 ? 'text-red-600 font-bold' : saldoVal < 10 ? 'text-amber-600 font-bold' : 'text-emerald-700 font-bold') : '';
        const isChecked = dgSelectAllMode || dgSelectedIds.has(t.id);
        return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isChecked?'bg-blue-50 dark:bg-blue-900/20':''}">
          <td class="px-3 py-2 text-center"><input type="checkbox" class="dg-row-check rounded accent-blue-600 cursor-pointer" data-id="${t.id}" ${isChecked?'checked':''}></td>
          <td class="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">${fmtDate(t.date)}</td>
          <td class="px-3 py-2"><span class="badge bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">${esc(t.station||'-')}</span></td>
          <td class="px-3 py-2 font-medium text-sm">${esc(t.item||'-')}</td>
          <td class="px-3 py-2 text-xs font-mono text-slate-500">${esc(t.kode||'-')}</td>
          <td class="px-3 py-2 text-center">
            <span class="badge ${isIn?'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300':'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}">
              ${isIn?'📥 IN':'📤 OUT'}
            </span>
          </td>
          <td class="px-3 py-2 text-right font-semibold ${isIn?'text-emerald-700':'text-red-700'}">${Number(t.qty)||0}</td>
          <td class="px-3 py-2 text-xs text-slate-500">${esc(t.unit||'-')}</td>
          <td class="px-3 py-2 text-right ${saldoClass}">${saldoVal}</td>
          <td class="px-3 py-2 text-xs text-slate-500 max-w-[120px] truncate" title="${esc(t.remark||'')}">${esc(t.remark||'-')}</td>
          <td class="px-3 py-2 text-xs text-slate-400">${esc(t.inputBy||'-')}</td>
          <td class="px-3 py-2 text-center whitespace-nowrap">
            <button data-dg-edit-trx="${t.id}" class="text-blue-600 hover:underline text-xs mr-2">Edit</button>
            <button data-dg-del-trx="${t.id}" class="text-red-600 hover:underline text-xs">Hapus</button>
          </td>
        </tr>`;
      }).join('');
    }

    // Sync check-all state and bulk UI (centralized in updateDgBulkUI)
    updateDgBulkUI();

    const info = document.getElementById('dgTrxInfo');
    if(info){
      const selCount = dgSelectAllMode ? total : dgSelectedIds.size;
      const selText = selCount > 0 ? ` · <span class="text-blue-600 font-semibold">${selCount} dipilih</span>` : '';
      info.innerHTML = `${total} transaksi${selText}`;
    }

    // Pagination
    const pag = document.getElementById('dgTrxPagination');
    if(pag){
      let html = `<button ${dgPage===1?'disabled':''} data-dg-page="${dgPage-1}" class="px-2 py-1 rounded border text-xs disabled:opacity-40">‹</button>`;
      for(let p=Math.max(1,dgPage-2); p<=Math.min(totalPages,dgPage+2); p++){
        html+=`<button data-dg-page="${p}" class="px-2 py-1 rounded border text-xs ${p===dgPage?'bg-blue-600 text-white border-blue-600':''}">${p}</button>`;
      }
      html+=`<button ${dgPage===totalPages?'disabled':''} data-dg-page="${dgPage+1}" class="px-2 py-1 rounded border text-xs disabled:opacity-40">›</button>`;
      pag.innerHTML = html;
      pag.onclick = e=>{ const p=e.target.dataset.dgPage; if(p){ dgPage=parseInt(p); renderDgTrx(); }};
    }

    renderDgSaldo();
  }

  function renderDgSaldo(){
    const tbody = document.getElementById('dgSaldoTableBody');
    if(!tbody) return;
    const saldos = calcSaldo().filter(s=> activeDgStation==='ALL' || s.station===activeDgStation);
    if(!saldos.length){
      tbody.innerHTML='<tr><td colspan="8" class="text-center py-6 text-slate-400 text-sm">Belum ada data stok.</td></tr>';
      return;
    }
    tbody.innerHTML = saldos.sort((a,b)=>(a.nama||'').localeCompare(b.nama||'')).map(s=>{
      const statusClass = s.saldo < 0 ? 'bg-red-100 text-red-700' : s.saldo < 10 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
      const statusLabel = s.saldo < 0 ? '⚠️ Minus' : s.saldo < 10 ? '🔴 Rendah' : '✅ OK';
      return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
        <td class="px-3 py-2 font-medium text-sm">${esc(s.nama)}</td>
        <td class="px-3 py-2 text-xs font-mono text-slate-500">${esc(s.kode||'-')}</td>
        <td class="px-3 py-2"><span class="badge bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">${esc(s.station||'-')}</span></td>
        <td class="px-3 py-2 text-right text-emerald-700 font-semibold">${(s.in||0).toLocaleString('id-ID')}</td>
        <td class="px-3 py-2 text-right text-red-700 font-semibold">${(s.out||0).toLocaleString('id-ID')}</td>
        <td class="px-3 py-2 text-right font-bold ${s.saldo<0?'text-red-700':s.saldo<10?'text-amber-600':'text-slate-800 dark:text-slate-100'}">${(s.saldo||0).toLocaleString('id-ID')}</td>
        <td class="px-3 py-2 text-xs text-slate-500">${esc(s.satuan||'-')}</td>
        <td class="px-3 py-2 text-center"><span class="badge ${statusClass}">${statusLabel}</span></td>
      </tr>`;
    }).join('');
  }

  // ── RENDER EMPLOYEE TABLE ────────────────────────────────────────
  function renderDgEmployees(){
    const tbody = document.getElementById('dgEmployeeTableBody');
    if(!tbody) return;
    const search = (document.getElementById('dgIfsSearch')?.value||'').toLowerCase();
    const filterSt = document.getElementById('dgIfsFilterStation')?.value||'';
    const filterStatus = document.getElementById('dgIfsFilterStatus')?.value||'';
    const today = todayStr();
    // Sumber data: tabel Data Karyawan utama (bukan lagi dgData.employees).
    // Hanya karyawan yang punya station terisi relevan untuk IFS Station.
    const allEmp = getKaryawanList().filter(k=>k.station);
    let list = allEmp.filter(e=>{
      if(filterSt && e.station !== filterSt) return false;
      if(search && ![(e.nama||'').toLowerCase(),(e.nip||'').toLowerCase()].join(' ').includes(search)) return false;
      if(filterStatus){
        const daysLeft = e.expiredKontrak ? Math.ceil((new Date(e.expiredKontrak)-new Date(today))/(1000*60*60*24)) : 9999;
        if(filterStatus==='active' && daysLeft <= 0) return false;
        if(filterStatus==='expiring' && (daysLeft > 30 || daysLeft <= 0)) return false;
        if(filterStatus==='expired' && daysLeft > 0) return false;
      }
      return true;
    });

    // KPI
    const kpiAll  = allEmp.length;
    let kpiActive=0, kpiExpiring=0, kpiExpired=0;
    allEmp.forEach(e=>{
      const dl = e.expiredKontrak ? Math.ceil((new Date(e.expiredKontrak)-new Date(today))/(1000*60*60*24)) : 9999;
      if(dl > 30) kpiActive++;
      else if(dl > 0) kpiExpiring++;
      else kpiExpired++;
    });
    document.getElementById('dgEmpKpiTotal').textContent  = kpiAll;
    document.getElementById('dgEmpKpiActive').textContent = kpiActive;
    document.getElementById('dgEmpKpiExpiring').textContent = kpiExpiring;
    document.getElementById('dgEmpKpiExpired').textContent  = kpiExpired;
    document.getElementById('dgEmpInfo').textContent = `${list.length} karyawan`;

    if(!list.length){
      tbody.innerHTML='<tr><td colspan="9" class="text-center py-8 text-slate-400 text-sm">Tidak ada data karyawan. Tambahkan via Data Karyawan atau tombol di atas.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map((e,i)=>{
      const daysLeft = e.expiredKontrak ? Math.ceil((new Date(e.expiredKontrak)-new Date(today))/(1000*60*60*24)) : 9999;
      let statusClass = 'bg-emerald-100 text-emerald-700', statusLabel = '✅ Aktif';
      if(!e.expiredKontrak){ statusClass='bg-slate-100 text-slate-500'; statusLabel='— Belum diisi'; }
      else if(daysLeft <= 0){ statusClass='bg-red-100 text-red-700'; statusLabel='❌ Expired'; }
      else if(daysLeft <= 30){ statusClass='bg-amber-100 text-amber-700'; statusLabel=`⚠️ ${daysLeft}hr`; }
      return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
        <td class="px-3 py-2 text-xs text-slate-400">${i+1}</td>
        <td class="px-3 py-2 font-semibold text-sm">${esc(e.nama||'-')}</td>
        <td class="px-3 py-2 font-mono text-xs">${esc(e.nip||'-')}</td>
        <td class="px-3 py-2 text-center"><span class="badge bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">${esc(e.station||'-')}</span></td>
        <td class="px-3 py-2 text-xs">${esc(e.jabatan||'-')}</td>
        <td class="px-3 py-2 text-xs whitespace-nowrap">${fmtDate(e.joinDate)}</td>
        <td class="px-3 py-2 text-xs font-medium whitespace-nowrap ${daysLeft<=0?'text-red-600':daysLeft<=30?'text-amber-600':''}">${fmtDate(e.expiredKontrak)}</td>
        <td class="px-3 py-2 text-center"><span class="badge ${statusClass}">${statusLabel}</span></td>
        <td class="px-3 py-2 text-center whitespace-nowrap">
          <button data-dg-edit-emp="${e.id}" class="text-blue-600 hover:underline text-xs mr-2">Edit</button>
          <button data-dg-del-emp="${e.id}" class="text-red-600 hover:underline text-xs">Hapus</button>
        </td>
      </tr>`;
    }).join('');
  }

  // ── DASHBOARD ─────────────────────────────────────────────────────
  let dgCharts = {};
  function destroyDgChart(k){ if(dgCharts[k]){ dgCharts[k].destroy(); delete dgCharts[k]; } }
  function renderDgDashboard(){
    // KPI
    const saldos = calcSaldo();
    document.getElementById('dgKpiItems').textContent     = new Set(dgData.transactions.map(t=>t.item)).size;
    document.getElementById('dgKpiIn').textContent        = dgData.transactions.filter(t=>t.type==='IN').reduce((s,t)=>s+(Number(t.qty)||0),0).toLocaleString('id-ID');
    document.getElementById('dgKpiOut').textContent       = dgData.transactions.filter(t=>t.type==='OUT').reduce((s,t)=>s+(Number(t.qty)||0),0).toLocaleString('id-ID');
    document.getElementById('dgKpiStations').textContent  = new Set(dgData.transactions.map(t=>t.station).filter(Boolean)).size;

    // Chart Monthly
    const monthMap = {};
    dgData.transactions.forEach(t=>{
      if(!t.date) return;
      const ym = t.date.slice(0,7);
      if(!monthMap[ym]) monthMap[ym]={in:0,out:0};
      if(t.type==='IN') monthMap[ym].in += Number(t.qty)||0;
      else monthMap[ym].out += Number(t.qty)||0;
    });
    const months = Object.keys(monthMap).sort().slice(-12);
    // BUGFIX: skip chart creation if container not visible (zero dimensions)
    const _dgCanvas0 = document.getElementById('dgChartMonthly');
    if(_dgCanvas0 && !_dgCanvas0.offsetWidth && !_dgCanvas0.offsetParent) return;
    destroyDgChart('monthly');
    const ctx1 = document.getElementById('dgChartMonthly');
    if(ctx1 && months.length){
      dgCharts['monthly'] = new Chart(ctx1,{type:'bar',data:{labels:months,datasets:[
        {label:'IN',data:months.map(m=>monthMap[m].in),backgroundColor:'#10b981',borderRadius:4,
          datalabels:{display:true,color:'#065f46',font:{size:9,weight:'bold'},anchor:'end',align:'top',formatter:v=>v>0?v.toLocaleString('id-ID'):''}},
        {label:'OUT',data:months.map(m=>monthMap[m].out),backgroundColor:'#ef4444',borderRadius:4,
          datalabels:{display:true,color:'#7f1d1d',font:{size:9,weight:'bold'},anchor:'end',align:'top',formatter:v=>v>0?v.toLocaleString('id-ID'):''}}
      ]},options:{responsive:true,plugins:{legend:{display:true},datalabels:{display:true}},scales:{x:{ticks:{maxRotation:45,font:{size:9}}}}}});
    }

    // Chart Top Items
    const itemMap = {};
    dgData.transactions.filter(t=>t.type==='OUT').forEach(t=>{ itemMap[t.item]=(itemMap[t.item]||0)+(Number(t.qty)||0); });
    const topItems = Object.entries(itemMap).sort((a,b)=>b[1]-a[1]).slice(0,10);
    destroyDgChart('topItems');
    const ctx2 = document.getElementById('dgChartTopItems');
    if(ctx2 && topItems.length){
      dgCharts['topItems'] = new Chart(ctx2,{type:'bar',data:{labels:topItems.map(x=>x[0]),datasets:[{label:'Total OUT',data:topItems.map(x=>x[1]),backgroundColor:'#6366f1',borderRadius:4,
        datalabels:{display:true,color:'#312e81',font:{size:9,weight:'bold'},anchor:'end',align:'right',formatter:v=>v>0?v.toLocaleString('id-ID'):''}}]},
      options:{indexAxis:'y',responsive:true,plugins:{legend:{display:false},datalabels:{display:true}},scales:{x:{ticks:{font:{size:9}}}}}});
    }

    // Chart Station
    const stMap = {};
    dgData.transactions.forEach(t=>{ if(t.station) stMap[t.station]=(stMap[t.station]||0)+1; });
    destroyDgChart('station');
    const ctx3 = document.getElementById('dgChartStation');
    if(ctx3 && Object.keys(stMap).length){
      const stTotal = Object.values(stMap).reduce((a,b)=>a+b,0);
      dgCharts['station'] = new Chart(ctx3,{type:'pie',data:{labels:Object.keys(stMap),datasets:[{data:Object.values(stMap),backgroundColor:['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6'],
        datalabels:{display:true,color:'#fff',font:{size:10,weight:'bold'},formatter:(v,ctx)=>{const pct=stTotal?Math.round(v/stTotal*100):0;return v>0?`${v.toLocaleString('id-ID')}\n${pct}%`:'';}}}]},options:{responsive:true,plugins:{legend:{display:true,position:'bottom'},datalabels:{display:true}}}});
    }

    // Low Stock
    const lowEl = document.getElementById('dgLowStockList');
    if(lowEl){
      const low = saldos.filter(s=>s.saldo < 10);
      lowEl.innerHTML = low.length ? low.sort((a,b)=>a.saldo-b.saldo).map(s=>`
        <div class="flex items-center justify-between p-2 rounded-lg ${s.saldo<0?'bg-red-50 dark:bg-red-900/20':'bg-amber-50 dark:bg-amber-900/20'}">
          <span class="font-medium text-sm">${esc(s.nama)} <span class="text-xs text-slate-500">(${esc(s.station)})</span></span>
          <span class="badge ${s.saldo<0?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}">${s.saldo}</span>
        </div>`).join('')
        : '<p class="text-slate-400 text-sm text-center py-4">✅ Semua stok dalam batas aman.</p>';
    }
  }

  // ── MODAL TRANSAKSI ───────────────────────────────────────────────
  let dgEditTrxId = null;
  function openTrxModal(trx){
    dgEditTrxId = trx ? trx.id : null;
    document.getElementById('dgTrxModalTitle').textContent = trx ? 'Edit Transaksi' : 'Tambah Transaksi Stok';
    document.getElementById('dgTrxDate').value    = trx?.date    || todayStr();
    document.getElementById('dgTrxStation').value = trx?.station || (activeDgStation!=='ALL'?activeDgStation:'');
    document.getElementById('dgTrxItem').value    = trx?.item    || '';
    document.getElementById('dgTrxCode').value    = trx?.kode    || '';
    document.getElementById('dgTrxType').value    = trx?.type    || 'IN';
    document.getElementById('dgTrxQty').value     = trx?.qty     || '';
    document.getElementById('dgTrxUnit').value    = trx?.unit    || '';
    document.getElementById('dgTrxRemark').value  = trx?.remark  || '';
    // Build item autocomplete from existing items
    const suggestions = document.getElementById('dgItemSuggestions');
    if(suggestions){
      const items = [...new Set(dgData.transactions.map(t=>t.item).filter(Boolean))];
      suggestions.innerHTML = items.map(i=>`<option value="${esc(i)}">`).join('');
    }
    document.getElementById('dgTrxModal').classList.remove('hidden');
  }
  function closeTrxModal(){ document.getElementById('dgTrxModal').classList.add('hidden'); }

  document.getElementById('dgTrxModalCancel')?.addEventListener('click', closeTrxModal);
  // Click outside modal to close
  document.getElementById('dgTrxModal')?.addEventListener('click', e=>{ if(e.target === document.getElementById('dgTrxModal')) closeTrxModal(); });
  document.getElementById('dgTrxModalSave')?.addEventListener('click', ()=>{
    const date    = document.getElementById('dgTrxDate').value;
    const station = document.getElementById('dgTrxStation').value;
    const item    = document.getElementById('dgTrxItem').value.trim();
    const kode    = document.getElementById('dgTrxCode').value.trim();
    const type    = document.getElementById('dgTrxType').value;
    const qty     = parseInt(document.getElementById('dgTrxQty').value)||0;
    const unit    = document.getElementById('dgTrxUnit').value.trim();
    const remark  = document.getElementById('dgTrxRemark').value.trim();
    if(!date||!station||!item||!qty){ showToast('Lengkapi: Tanggal, Station, Nama Barang, Qty','error'); return; }
    if(!isValidBankStation(station)){ showToast('Station tidak terdaftar di Bank Data Station','error'); return; }
    const currentUser = window.currentUser;
    const entry = { id: dgEditTrxId||genId(), date, station, item, kode, type, qty, unit, remark, inputBy: currentUser?.name||currentUser?.username||'', updatedAt: new Date().toISOString() };
    const idx = dgData.transactions.findIndex(t=>t.id===dgEditTrxId);
    if(idx>-1) dgData.transactions[idx]=entry; else dgData.transactions.unshift(entry);
    ensureStationActive(station);
    saveDrygoodsData();
    closeTrxModal();
    buildStationTabs();
    renderDgTrx();
    showToast(dgEditTrxId?'Transaksi diperbarui':'Transaksi ditambahkan','success');
  });

  // Delete single trx
  document.getElementById('dgTrxTableBody')?.addEventListener('click', async e=>{
    const editId = e.target.closest('[data-dg-edit-trx]')?.dataset.dgEditTrx;
    const delId  = e.target.closest('[data-dg-del-trx]')?.dataset.dgDelTrx;
    if(editId){ const t=dgData.transactions.find(x=>x.id===editId); if(t) openTrxModal(t); }
    if(delId){
      const ok = await showConfirm('Hapus Transaksi','Hapus transaksi ini?');
      if(!ok) return;
      dgData.transactions = dgData.transactions.filter(t=>t.id!==delId);
      dgSelectedIds.delete(delId);
      // If in select-all mode, we keep it but the deleted record is gone anyway
      saveDrygoodsData(); renderDgTrx(); showToast('Transaksi dihapus');
    }
  });

  // ── BULK SELECTION & DELETE EVENT HANDLERS ───────────────────────

  // Dropdown toggle
  document.getElementById('btnDgBulkDropdown')?.addEventListener('click', e=>{
    e.stopPropagation();
    document.getElementById('dgBulkDropdownMenu')?.classList.toggle('hidden');
  });
  // Close dropdown on outside click
  document.addEventListener('click', ()=> closeBulkDropdown());

  // Checkbox per-row selection
  document.getElementById('dgTrxTableBody')?.addEventListener('change', e=>{
    const cb = e.target.closest('.dg-row-check');
    if(!cb) return;
    const id = cb.dataset.id;
    // If we were in select-all mode, expand to explicit set first
    if(dgSelectAllMode){
      dgSelectAllMode = false;
      const filteredIds = getDgFilteredIds();
      filteredIds.forEach(fid => dgSelectedIds.add(fid));
    }
    if(cb.checked) dgSelectedIds.add(id);
    else dgSelectedIds.delete(id);
    // Update row highlight
    const row = cb.closest('tr');
    if(row){
      row.classList.toggle('bg-blue-50', cb.checked);
      row.classList.toggle('dark:bg-blue-900/20', cb.checked);
    }
    updateDgBulkUI();
  });

  // Check-All checkbox (current page)
  document.getElementById('dgCheckAll')?.addEventListener('change', e=>{
    const filtered = getFilteredTrx();
    const start = (dgPage-1)*DG_PAGE_SIZE;
    const pageIds = filtered.slice(start, start+DG_PAGE_SIZE).map(t=>t.id);
    if(dgSelectAllMode && !e.target.checked){
      // Expand select-all to explicit set, then remove this page
      dgSelectAllMode = false;
      getDgFilteredIds().forEach(id=>dgSelectedIds.add(id));
      pageIds.forEach(id=>dgSelectedIds.delete(id));
    } else if(e.target.checked){
      dgSelectAllMode = false; // stay in per-id mode
      pageIds.forEach(id=>dgSelectedIds.add(id));
    } else {
      dgSelectAllMode = false;
      pageIds.forEach(id=>dgSelectedIds.delete(id));
    }
    renderDgTrx();
  });

  // Select ALL filtered data (cross-page) — from dropdown
  document.getElementById('btnDgSelectAllFiltered')?.addEventListener('click', ()=>{
    closeBulkDropdown();
    dgSelectAllMode = true;
    dgSelectedIds.clear();
    renderDgTrx();
  });

  // Select ALL filtered data — from inline banner button
  document.getElementById('btnDgSelectAllFilteredBanner')?.addEventListener('click', ()=>{
    dgSelectAllMode = true;
    dgSelectedIds.clear();
    renderDgTrx();
  });

  // Clear selection — from dropdown
  document.getElementById('btnDgClearSelection')?.addEventListener('click', ()=>{
    closeBulkDropdown();
    clearDgSelection();
    renderDgTrx();
  });

  // Clear selection — from banner
  document.getElementById('btnDgClearSelectionBanner')?.addEventListener('click', ()=>{
    clearDgSelection();
    renderDgTrx();
  });

  // Hapus Terpilih (per-id set, NOT all-mode)
  document.getElementById('btnDgDeleteSelected')?.addEventListener('click', async ()=>{
    const filteredIds = getDgFilteredIds();
    const idsToDelete = dgSelectAllMode
      ? new Set(filteredIds)
      : new Set(dgSelectedIds);
    const n = idsToDelete.size;
    if(!n) return;
    const label = dgSelectAllMode ? `semua ${n} data terfilter` : `${n} data terpilih`;
    const ok = await showConfirm('Hapus Data', `Hapus ${label}? Tindakan ini tidak dapat dibatalkan.`);
    if(!ok) return;
    dgData.transactions = dgData.transactions.filter(t=>!idsToDelete.has(t.id));
    clearDgSelection();
    saveDrygoodsData(); renderDgTrx(); renderDgSaldo(); renderDgDashboard();
    showToast(`${n} transaksi berhasil dihapus`, 'success');
  });

  // Hapus Semua Data Terfilter — from dropdown (shortcut: pilih semua lalu hapus)
  document.getElementById('btnDgDeleteAllFiltered')?.addEventListener('click', async ()=>{
    closeBulkDropdown();
    const filteredIds = getDgFilteredIds();
    const idsToDelete = dgSelectAllMode ? filteredIds : [...dgSelectedIds];
    const n = idsToDelete.length || idsToDelete.size || 0;
    if(!n){ showToast('Tidak ada data untuk dihapus','error'); return; }
    const label = dgSelectAllMode ? `semua ${filteredIds.length} data terfilter` : `${n} data terpilih`;
    const ok = await showConfirm('Hapus Data', `Hapus ${label}? Tindakan ini tidak dapat dibatalkan.`);
    if(!ok) return;
    const deleteSet = new Set(dgSelectAllMode ? filteredIds : idsToDelete);
    const deleted = deleteSet.size;
    dgData.transactions = dgData.transactions.filter(t=>!deleteSet.has(t.id));
    clearDgSelection();
    saveDrygoodsData(); renderDgTrx(); renderDgSaldo(); renderDgDashboard();
    showToast(`${deleted} transaksi berhasil dihapus`, 'success');
  });

  // ── MODAL KARYAWAN ────────────────────────────────────────────────
  let dgEditEmpId = null;
  function openEmpModal(emp){
    dgEditEmpId = emp ? emp.id : null;
    document.getElementById('dgEmpModalTitle').textContent = emp ? 'Edit Karyawan' : 'Tambah Karyawan';
    document.getElementById('dgEmpName').value     = emp?.nama     || '';
    document.getElementById('dgEmpNip').value      = emp?.nip      || '';
    document.getElementById('dgEmpStation').value  = emp?.station  || '';
    document.getElementById('dgEmpPosition').value = emp?.jabatan  || '';
    document.getElementById('dgEmpJoinDate').value = emp?.joinDate || '';
    document.getElementById('dgEmpExpired').value  = emp?.expiredKontrak || '';
    document.getElementById('dgEmpNote').value     = emp?.note     || '';
    document.getElementById('dgEmpModal').classList.remove('hidden');
  }
  function closeEmpModal(){ document.getElementById('dgEmpModal').classList.add('hidden'); }

  document.getElementById('dgEmpModalCancel')?.addEventListener('click', closeEmpModal);
  // Click outside modal to close
  document.getElementById('dgEmpModal')?.addEventListener('click', e=>{ if(e.target === document.getElementById('dgEmpModal')) closeEmpModal(); });
  document.getElementById('dgEmpModalSave')?.addEventListener('click', ()=>{
    const nama     = document.getElementById('dgEmpName').value.trim();
    const nip      = document.getElementById('dgEmpNip').value.trim();
    const station  = document.getElementById('dgEmpStation').value;
    const jabatan  = document.getElementById('dgEmpPosition').value.trim();
    const joinDate = document.getElementById('dgEmpJoinDate').value;
    const expiredKontrak = document.getElementById('dgEmpExpired').value;
    const note     = document.getElementById('dgEmpNote').value.trim();
    if(!nama||!nip||!station||!expiredKontrak){ showToast('Lengkapi: Nama, NIP, Station, Expired Kontrak','error'); return; }
    if(!isValidBankStation(station)){ showToast('Station tidak terdaftar di Bank Data Station','error'); return; }
    // Data karyawan disimpan ke tabel Data Karyawan utama (sumber tunggal).
    const karyawanList = getKaryawanList();
    // NIP harus unik di tabel karyawan utama (kecuali sedang mengedit dirinya sendiri)
    const dup = karyawanList.find(k => k.id !== dgEditEmpId && (k.nip||'').toLowerCase() === nip.toLowerCase());
    if(dup){ showToast('NIP sudah digunakan oleh: ' + dup.nama, 'error'); return; }
    const idx = karyawanList.findIndex(k=>k.id===dgEditEmpId);
    if(idx>-1){
      // Pertahankan field yang tidak ditampilkan di modal ini (hp, email, username, dst)
      karyawanList[idx] = { ...karyawanList[idx], nama, nip, station, jabatan, joinDate, expiredKontrak, note, updatedAt: new Date().toISOString() };
    } else {
      karyawanList.push({
        id: genId(), nama, nip, station, jabatan, hp:'', email:'', username:'',
        joinDate, expiredKontrak, note, updatedAt: new Date().toISOString()
      });
    }
    saveKaryawanList(karyawanList);
    closeEmpModal();
    ensureStationActive(station); // station baru otomatis muncul sebagai tab aktif
    buildStationTabs();
    renderDgEmployees();
    showToast(dgEditEmpId?'Data karyawan diperbarui':'Karyawan ditambahkan','success');
  });

  document.getElementById('dgEmployeeTableBody')?.addEventListener('click', async e=>{
    const editId = e.target.closest('[data-dg-edit-emp]')?.dataset.dgEditEmp;
    const delId  = e.target.closest('[data-dg-del-emp]')?.dataset.dgDelEmp;
    if(editId){ const emp=getKaryawanList().find(x=>x.id===editId); if(emp) openEmpModal(emp); }
    if(delId){
      const ok = await showConfirm('Hapus Karyawan','Hapus data karyawan ini? Data ini juga akan terhapus dari Data Karyawan utama.');
      if(!ok) return;
      const karyawanList = getKaryawanList().filter(k=>k.id!==delId);
      saveKaryawanList(karyawanList);
      renderDgEmployees(); showToast('Data karyawan dihapus');
    }
  });

  // ── EVENT WIRING ──────────────────────────────────────────────────
  // Add button - handled by bank item module patch below for + Transaksi Baru
  // document.getElementById('btnDgAddTrx')?.addEventListener('click', ()=> openTrxModal(null));
  document.getElementById('btnDgAddEmployee')?.addEventListener('click', ()=> openEmpModal(null));

  // Station tabs click
  document.getElementById('dgStationTabs')?.addEventListener('click', e=>{
    // User-DRG: hanya boleh akses station mereka sendiri
    // Kecuali jika station='ALL' → boleh akses semua station
    const cu = window.currentUser;
    if(cu && cu.role === 'User-DRG'){
      const targetSt = e.target.closest('[data-dg-station]')?.dataset.dgStation;
      if(targetSt){
        // BUG6 FIX: null = belum konfigurasi = tidak ada restrict
        const allowedSt = window._userDrgStation;
        if(allowedSt && allowedSt !== 'ALL' && targetSt !== allowedSt && targetSt !== cu.station){
          showToast('Akses terbatas: Anda hanya dapat melihat station ' + (allowedSt || 'yang ditugaskan'), 'error');
          return; // block switching to other station
        }
      }
    }
    const st = e.target.closest('[data-dg-station]')?.dataset.dgStation;
    if(!st) return;
    activeDgStation = st;
    clearDgSelection();
    buildStationTabs();
    dgPage=1; renderDgTrx();
  });

  // Active station select change
  document.getElementById('dgActiveStation')?.addEventListener('change', e=>{
    // PATCH3 FIX-S13: Jaga agar User-DRG dengan station spesifik
    // tidak bisa memilih station lain via dropdown.
    var _cu13 = window.currentUser;
    if (_cu13 && _cu13.role === 'User-DRG') {
      var _st13 = window._userDrgStation;
      if (_st13 && _st13 !== 'ALL' && e.target.value !== _st13) {
        e.target.value = _st13; // revert
        if (typeof showToast === 'function')
          showToast('Akses terbatas ke station ' + _st13, 'error');
        return;
      }
    }
    activeDgStation = e.target.value;
    clearDgSelection();
    buildStationTabs(); dgPage=1; renderDgTrx();
  });

  // Filter changes — wire both input AND change for all filter controls
  ['dgSearchTrx','dgFilterType','dgFilterDateFrom','dgFilterDateTo'].forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    const handler = ()=>{ dgPage=1; clearDgSelection(); renderDgTrx(); };
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  });
  document.getElementById('btnDgResetFilter')?.addEventListener('click', ()=>{
    ['dgSearchTrx','dgFilterType','dgFilterDateFrom','dgFilterDateTo'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    (function(){ var _drg=window.currentUser&&window.currentUser.role==='User-DRG'&&window._userDrgStation&&window._userDrgStation!=='ALL'; activeDgStation=_drg?window._userDrgStation:'ALL'; })(); clearDgSelection(); buildStationTabs(); dgPage=1; renderDgTrx();
  });

  // IFS filters
  ['dgIfsSearch','dgIfsFilterStation','dgIfsFilterStatus'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input', renderDgEmployees);
    document.getElementById(id)?.addEventListener('change', renderDgEmployees);
  });

  // Add station — pilih dari Bank Data Station (bukan ketik bebas lagi)
  function openAddStationModal(){
    const sel = document.getElementById('dgAddStationSelect');
    if(!sel) return;
    const bankList = getBankStationList();
    const already = new Set(dgData.stations);
    const available = bankList.filter(s=>!already.has(s.iata));
    if(!available.length){
      showToast('Semua station di Bank Data Station sudah aktif di sini','info');
      return;
    }
    sel.innerHTML = '<option value="">-- Pilih station --</option>' +
      available.map(s=>`<option value="${esc(s.iata)}">${esc(s.iata)} — ${esc(s.name)}</option>`).join('');
    document.getElementById('dgAddStationModal').classList.remove('hidden');
  }
  function closeAddStationModal(){ document.getElementById('dgAddStationModal').classList.add('hidden'); }
  document.addEventListener('click', e=>{
    if(e.target && e.target.id === 'btnDgAddStation'){ openAddStationModal(); }
  });
  document.getElementById('dgAddStationCancel')?.addEventListener('click', closeAddStationModal);
  document.getElementById('dgAddStationModal')?.addEventListener('click', e=>{ if(e.target === document.getElementById('dgAddStationModal')) closeAddStationModal(); });
  document.getElementById('dgAddStationConfirm')?.addEventListener('click', ()=>{
    const code = document.getElementById('dgAddStationSelect')?.value || '';
    if(!code){ showToast('Pilih station terlebih dahulu','error'); return; }
    if(!isValidBankStation(code)){ showToast('Station tidak terdaftar di Bank Data Station','error'); return; }
    if(dgData.stations.includes(code)){ showToast('Station sudah ada','error'); return; }
    dgData.stations.push(code);
    dgData.stations.sort();
    saveDrygoodsData();
    buildStationTabs();
    closeAddStationModal();
    showToast('Station '+code+' diaktifkan','success');
  });

  // Export Excel Transactions
  document.getElementById('btnDgExportExcel')?.addEventListener('click', ()=>{
    if(!window.XLSX){ showToast('XLSX tidak tersedia','error'); return; }
    const rows = getFilteredTrx().map((t,i)=>({
      'No':i+1,'Tanggal':t.date,'Station':t.station,'Nama Barang':t.item,'Kode':t.kode||'',
      'Jenis':t.type,'Qty':t.qty,'Satuan':t.unit||'','Keterangan':t.remark||'','Input By':t.inputBy||''
    }));
    if(!rows.length){ showToast('Tidak ada data untuk di-export','error'); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Stok');
    XLSX.writeFile(wb, `Drygoods_Stok_${todayLocalStr()}.xlsx`);
    showToast('Export Excel berhasil');
  });

  // ── IMPORT EXCEL KARTU STOK ─────────────────────────────────────
  // Format kolom: Tgl, Station, Nama Barang, Kode, Jenis (IN/OUT), Qty, Satuan, Saldo*, Keterangan, Input By
  // *Kolom Saldo diabaikan saat import (dihitung otomatis dari transaksi)
  document.getElementById('btnDgImportExcel')?.addEventListener('click', ()=>{
    const inp = document.getElementById('dgImportExcelInput');
    if(inp){ inp.value=''; inp.click(); }
  });

  // Download Template Excel kosong
  document.getElementById('btnDgDownloadTemplate')?.addEventListener('click', ()=>{
    if(!window.XLSX){ showToast('Library XLSX belum termuat','error'); return; }
    const templateRows = [
      { 'Tgl':'15/06/2025', 'Station':'CGK', 'Nama Barang':'Contoh Barang A', 'Kode':'DG-001', 'Jenis':'IN',  'Qty':10, 'Satuan':'PCS', 'Saldo':'', 'Keterangan':'Penerimaan barang', 'Input By':'Nama Operator' },
      { 'Tgl':'16/06/2025', 'Station':'CGK', 'Nama Barang':'Contoh Barang A', 'Kode':'DG-001', 'Jenis':'OUT', 'Qty':3,  'Satuan':'PCS', 'Saldo':'', 'Keterangan':'Pengeluaran operasional', 'Input By':'Nama Operator' },
      { 'Tgl':'16/06/2025', 'Station':'UPG', 'Nama Barang':'Contoh Barang B', 'Kode':'DG-002', 'Jenis':'IN',  'Qty':5,  'Satuan':'BOX', 'Saldo':'', 'Keterangan':'',                   'Input By':'Nama Operator' },
    ];
    const ws = XLSX.utils.json_to_sheet(templateRows);
    // Set lebar kolom
    ws['!cols'] = [{wch:14},{wch:10},{wch:25},{wch:12},{wch:8},{wch:8},{wch:10},{wch:10},{wch:30},{wch:20}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kartu Stok');
    XLSX.writeFile(wb, 'Template_Import_KartuStok_Drygoods.xlsx');
    showToast('Template Excel didownload — isi kolom sesuai contoh', 'success');
  });

  document.getElementById('dgImportExcelInput')?.addEventListener('change', async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    if(!window.XLSX){ showToast('Library XLSX belum termuat','error'); return; }

    const reader = new FileReader();
    reader.onload = async (ev)=>{
      try {
        const wb = XLSX.read(ev.target.result, {type:'binary', cellDates:true});
        const ws = wb.Sheets[wb.SheetNames[0]];
        // raw:false agar tanggal otomatis diformat, defval:'' agar sel kosong jadi ''
        const rows = XLSX.utils.sheet_to_json(ws, {defval:'', raw:false});

        if(!rows.length){ showToast('File Excel kosong atau format tidak dikenali','error'); return; }

        // ── Mapping kolom fleksibel (partial match, case-insensitive) ──
        // Coba match exact dulu, lalu partial (includes)
        function col(row, ...names){
          const rowKeys = Object.keys(row);
          for(const n of names){
            const nl = n.toLowerCase();
            // 1. Exact match (case-insensitive + trim)
            const exact = rowKeys.find(k => k.trim().toLowerCase() === nl);
            if(exact !== undefined) return String(row[exact]||'').trim();
          }
          for(const n of names){
            const nl = n.toLowerCase();
            // 2. Partial match — kolom mengandung kata kunci
            const partial = rowKeys.find(k => k.trim().toLowerCase().includes(nl));
            if(partial !== undefined) return String(row[partial]||'').trim();
          }
          return '';
        }

        // ── Parse tanggal dari berbagai format ──
        function parseDate(raw){
          if(!raw || String(raw).trim()==='') return '';
          const s = String(raw).trim();

          // Format ISO / yyyy-mm-dd (sudah benar)
          if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

          // Format Excel serial number (angka)
          if(!isNaN(Number(s)) && Number(s) > 40000 && Number(s) < 60000){
            try {
              const d = XLSX.SSF.parse_date_code(Number(s));
              if(d && d.y && d.m && d.d)
                return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
            } catch(e){}
          }

          // Format tanggal yang sudah di-parse oleh XLSX (Date object as string)
          // Misal: "2025-06-15T00:00:00.000Z" atau "6/15/2025"
          if(s.includes('T') || s.includes('Z')){
            const d = new Date(s);
            if(!isNaN(d)) return d.toISOString().slice(0,10);
          }

          // dd/mm/yyyy atau dd-mm-yyyy
          let m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
          if(m){
            const [,d,mo,y] = m;
            const yr = y.length===2 ? '20'+y : y;
            // Cek apakah format mm/dd/yyyy (bulan > 12 tidak mungkin)
            const dInt=parseInt(d), moInt=parseInt(mo);
            if(moInt > 12 && dInt <= 12){
              // swap: mm/dd/yyyy
              return `${yr}-${String(dInt).padStart(2,'0')}-${String(moInt).padStart(2,'0')}`;
            }
            return `${yr}-${String(moInt).padStart(2,'0')}-${String(dInt).padStart(2,'0')}`;
          }

          // dd-Mon-yyyy (misal: 15-Jun-2025 atau 15-Jun-25)
          m = s.match(/^(\d{1,2})[\/\-\.]([A-Za-z]{3,})[\/\-\.](\d{2,4})$/);
          if(m){
            const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
                          januari:1,februari:2,maret:3,april:4,mei:5,juni:6,juli:7,agustus:8,september:9,oktober:10,november:11,desember:12};
            const mo2 = months[m[2].toLowerCase()];
            if(mo2){
              const yr = m[3].length===2?'20'+m[3]:m[3];
              return `${yr}-${String(mo2).padStart(2,'0')}-${String(parseInt(m[1])).padStart(2,'0')}`;
            }
          }

          // Fallback: native Date parse
          const d = new Date(s);
          if(!isNaN(d) && d.getFullYear() > 2000 && d.getFullYear() < 2100)
            return d.toISOString().slice(0,10);

          return ''; // gagal parse
        }

        let added=0, skipped=0, errors=[];
        const currentUserName = window.currentUser?.name || window.currentUser?.username || '';
        const newTrx = [];

        // Log header kolom untuk debug
        if(rows.length > 0) console.log('[DG Import] Kolom terdeteksi:', Object.keys(rows[0]));

        rows.forEach((row, idx)=>{
          const rowNum = idx + 2; // +2 karena header di baris 1

          // Skip baris yang benar-benar kosong (semua nilai kosong)
          const vals = Object.values(row).map(v=>String(v||'').trim()).filter(Boolean);
          if(vals.length === 0){ return; } // baris kosong total — skip tanpa hitung sebagai error

          // ── Tanggal ──
          const dateRaw = col(row,'tgl','tanggal','date','tgl.','tanggal transaksi','tgl transaksi','waktu');
          const dateVal = parseDate(dateRaw);
          if(!dateVal){
            // Baris dengan tanggal kosong — mungkin baris sub-header / total / kosong parsial
            // Cek apakah ada field penting lainnya; jika tidak ada item juga, skip senyap
            const itemCheck = col(row,'nama barang','namabarang','barang','item','nama','name','description');
            if(!itemCheck){ return; } // baris kosong parsial — skip senyap
            errors.push(`Baris ${rowNum}: Tanggal tidak valid ("${dateRaw}") — baris dilewati`);
            skipped++;
            return;
          }

          // ── Station ──
          // Coba dari kolom station, jika kosong gunakan active station filter
          let station = col(row,'station','stasiun','stn','sta','bandara','kota','port','airport');
          if(!station) station = activeDgStation !== 'ALL' ? activeDgStation : '';
          station = station.toUpperCase().trim();

          // ── Nama Barang ──
          const item = col(row,'nama barang','namabarang','barang','item','nama','name','description','deskripsi','uraian');

          // ── Kode ──
          const kode = col(row,'kode','code','kode barang','item code','kode item','part no','partno');

          // ── Jenis (IN/OUT) ──
          const typeRaw = col(row,'jenis','type','tipe','in/out','mutasi','gerakan','movement').toUpperCase().replace(/\s+/g,'');
          let type = '';
          if(typeRaw==='IN' || typeRaw==='MASUK' || typeRaw==='TAMBAH' || typeRaw==='PENERIMAAN' || typeRaw==='+') type='IN';
          else if(typeRaw==='OUT' || typeRaw==='KELUAR' || typeRaw==='KURANG' || typeRaw==='PENGELUARAN' || typeRaw==='-') type='OUT';

          // ── Qty ──
          const qtyRaw = col(row,'qty','jumlah','quantity','kuantitas','jml','banyak');
          const qty = parseInt(String(qtyRaw).replace(/[^\d]/g,''))||0;

          // ── Satuan ──
          const unit = col(row,'satuan','unit','uom','satuan barang');

          // kolom Saldo diabaikan — dihitung otomatis

          // ── Keterangan ──
          const remark = col(row,'keterangan','remark','catatan','ket','note','notes','keterangan/note');

          // ── Input By ──
          const inputBy = col(row,'input by','inputby','diinput','oleh','by','operator','petugas','user') || currentUserName;

          // ── Validasi ──
          if(!item){
            errors.push(`Baris ${rowNum}: Nama Barang kosong`);
            skipped++; return;
          }
          if(!station){
            errors.push(`Baris ${rowNum}: Station kosong — pilih station aktif di filter atau isi kolom Station`);
            skipped++; return;
          }
          if(!type){
            errors.push(`Baris ${rowNum}: Jenis harus IN atau OUT (ditemukan: "${typeRaw || 'kosong'}")`);
            skipped++; return;
          }
          if(!qty){
            errors.push(`Baris ${rowNum}: Qty tidak valid (ditemukan: "${qtyRaw}")`);
            skipped++; return;
          }

          newTrx.push({
            id: genId()+'_'+idx,
            date: dateVal, station, item, kode, type, qty, unit, remark, inputBy,
            updatedAt: new Date().toISOString()
          });
          added++;
        });

        if(!newTrx.length){
          let msg = `Import gagal: ${skipped} baris dilewati.`;
          if(errors.length){
            msg += '\n\nDetail:\n' + errors.slice(0,5).join('\n');
            if(errors.length > 5) msg += `\n... dan ${errors.length-5} baris lainnya`;
          }
          msg += '\n\n💡 Tips:\n- Pastikan kolom "Station" terisi\n- Format Jenis: IN atau OUT\n- Format tanggal: dd/mm/yyyy atau yyyy-mm-dd';
          showToast('Import gagal — lihat detail di console', 'error');
          if(errors.length) console.warn('[DG Import] Baris tidak valid:\n', errors.join('\n'));
          // Tampilkan alert jika semua gagal
          setTimeout(()=> alert(msg), 100);
          return;
        }

        // Konfirmasi
        const skipMsg = skipped ? `\n⚠️ ${skipped} baris dilewati (tidak valid).` : '';
        const ok = await showConfirm('Import Excel Kartu Stok',
          `Akan menambahkan ${added} transaksi dari file Excel.${skipMsg}\n\nLanjutkan?`
        );
        if(!ok) return;

        // Gabungkan — cegah duplikat berdasarkan (date+station+item+type+qty)
        const existingKeys = new Set(dgData.transactions.map(t=>`${t.date}|${t.station}|${(t.item||'').toLowerCase()}|${t.type}|${t.qty}`));
        let dupCount = 0;
        newTrx.forEach(t=>{
          const k = `${t.date}|${t.station}|${(t.item||'').toLowerCase()}|${t.type}|${t.qty}`;
          if(existingKeys.has(k)){ dupCount++; return; }
          existingKeys.add(k);
          dgData.transactions.unshift(t);
        });

        saveDrygoodsData();
        renderDgTrx();
        renderDgSaldo();
        renderDgDashboard();

        let msg = `✅ Import berhasil: ${added - dupCount} data baru ditambahkan`;
        if(dupCount) msg += `, ${dupCount} duplikat dilewati`;
        if(skipped) msg += `, ${skipped} baris tidak valid`;
        if(errors.length) console.warn('[DG Import] Baris tidak valid:', errors.join('\n'));
        showToast(msg, 'success');
      } catch(err){
        showToast('Gagal membaca file Excel: '+err.message, 'error');
        console.error('[DG Import]', err);
      }
    };
    reader.readAsBinaryString(file);
    // Reset input agar file yang sama bisa dipilih lagi
    e.target.value = '';
  });

  // Export Excel Employees
  document.getElementById('btnDgExportEmployee')?.addEventListener('click', ()=>{
    if(!window.XLSX){ showToast('XLSX tidak tersedia','error'); return; }
    const today = todayStr();
    const rows = getKaryawanList().filter(e=>e.station).map((e,i)=>({
      'No':i+1,'Nama':e.nama,'NIP':e.nip,'Station':e.station,'Jabatan':e.jabatan||'',
      'Tgl Masuk':e.joinDate||'','Expired Kontrak':e.expiredKontrak||'',
      'Sisa Hari': e.expiredKontrak ? Math.ceil((new Date(e.expiredKontrak)-new Date(today))/(1000*60*60*24)) : '',
      'Catatan':e.note||''
    }));
    if(!rows.length){ showToast('Tidak ada data karyawan','error'); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'IFS Karyawan');
    XLSX.writeFile(wb, `Drygoods_IFS_Karyawan_${todayLocalStr()}.xlsx`);
    showToast('Export Excel karyawan berhasil');
  });

  // ── SIDEBAR TOGGLE — dikontrol sepenuhnya oleh DOMContentLoaded block ────────

  // ── TAB SWITCHING HOOK ───────────────────────────────────────────
  function _applyDrgLock(){
    var cu=window.currentUser; if(!cu||cu.role!=='User-DRG') return;
    // PATCH2 FIX2: baca fresh dari karyawan agar konsisten dengan PATCH1
    var st=window._userDrgStation;
    try {
      var _kf2=JSON.parse(localStorage.getItem('sjnam_karyawan_v1')||'[]');
      var _mu2=(cu.username||'').toLowerCase();
      var _km2=_kf2.find(function(k){return(k.username||'').toLowerCase()===_mu2;});
      st=(_km2&&_km2.station)?_km2.station:null;
      window._userDrgStation=st;
      if(cu)cu.station=st;
    } catch(ex){ /* fallback ke cache */ }
    document.querySelectorAll('[data-dg-station]').forEach(function(t){
      var ts=t.dataset.dgStation; if(!ts) return;
      if(!st||st==='ALL'){t.style.opacity='';t.style.pointerEvents='';t.title='';}
      else if(ts===st){t.style.opacity='';t.style.pointerEvents='';t.title='';}
      else{t.style.opacity='0.3';t.style.pointerEvents='none';
        t.title=(ts==='ALL'?'Akses terbatas':'Akses terbatas ke station '+st);}
    });
    // FIX: always set activeDgStation to correct value, not only when it was 'ALL'
    if(typeof activeDgStation!=='undefined'){
      if(!st||st==='ALL') activeDgStation='ALL';
      else activeDgStation=st;
    }
  }
  const _origSwitch = window.switchTab;
  window.switchTab = function(tab){
    if(typeof _origSwitch === 'function') _origSwitch(tab);
    if(tab === 'drygoods-bankitem')  { renderDgBankItem(); }
    if(tab === 'drygoods-data')      { _applyDrgLock(); buildStationTabs(); renderDgTrx(); }
    if(tab === 'drygoods-dashboard') {
      renderDgDashboard();
      // BUGFIX: force-resize after tab becomes visible
      requestAnimationFrame(function(){
        Object.values(dgCharts).forEach(function(ch){
          if(ch && typeof ch.resize === 'function') ch.resize();
        });
      });
    }
    if(tab === 'drygoods-ifs')       { buildStationTabs(); renderDgEmployees(); }
  };

  // ── EXPOSE PUBLIC API ────────────────────────────────────────────
  window.DRYGOODS = {
    loadData: loadDrygoodsData,
    saveData: saveDrygoodsData,
    renderAll: function(){ if(typeof _applyDrgLock==='function')_applyDrgLock(); buildStationTabs(); renderDgTrx(); renderDgDashboard(); renderDgEmployees(); renderDgBankItem(); },
    getData: ()=> dgData,
    openTrxFromBankItem: openTrxFromBankItem
  };

  // ── INIT ─────────────────────────────────────────────────────────
  if(typeof _applyDrgLock==='function')_applyDrgLock(); buildStationTabs();
  // Initial render only if tab is active
  const currentTab = localStorage.getItem('sjnam_current_tab')||'';
  if(currentTab.startsWith('drygoods')){ renderDgTrx(); renderDgDashboard(); renderDgEmployees(); }
  // NOTE: renderDgBankItem() for the initial tab-active render is intentionally called
  // at the bottom of this IIFE (see "INIT BANK ITEM" section) because it depends on
  // DG_BANK_ITEM_DEFAULTS / DG_BI_PAGE_SIZE, which are declared with const further down
  // this file. Calling it here threw "Cannot access 'DG_BANK_ITEM_DEFAULTS' before
  // initialization" (a temporal-dead-zone ReferenceError) and silently aborted the rest
  // of this IIFE — which is why the Bank Item table got stuck on "Loading..." and the
  // + Tambah Barang / Export Excel / search / filter controls never worked.

  // ── BANK ITEM MODULE ──────────────────────────────────────────────
  // Default bank item data sesuai permintaan
  const DG_BANK_ITEM_DEFAULTS = [
    {name:'Hand soap calington',uom:'Dus',isiUom:'1',satuan:'liter',satuan2:'Pcs',satuan3:'',group:'Dry Goods'},
    {name:'Botol sabun',uom:'Dus',isiUom:'1',satuan:'Bottle',satuan2:'',satuan3:'',group:'Dry Goods'},
    {name:'Air Mineral 330ml',uom:'Dus',isiUom:'24',satuan:'Bottle',satuan2:'',satuan3:'',group:'Dry Goods'},
    {name:'Air Mineral 600ml',uom:'Pack',isiUom:'24',satuan:'Bottle',satuan2:'Pcs',satuan3:'',group:'Dry Goods'},
    {name:'Air Sicknes Bag',uom:'Pack',isiUom:'10000',satuan:'Papper',satuan2:'Pcs',satuan3:'',group:'Cabin & Toilet Article'},
    {name:'Blanket',uom:'Pcs',isiUom:'1',satuan:'Pcs',satuan2:'',satuan3:'',group:'Cabin & Toilet Article'},
    {name:'Coffee',uom:'Pack',isiUom:'250',satuan:'Sachet',satuan2:'Pcs',satuan3:'',group:'Dry Goods'},
    {name:'Creamer',uom:'Box',isiUom:'2500',satuan:'Sachet',satuan2:'Pcs',satuan3:'',group:'Dry Goods'},
    {name:'Daily Order (DO)',uom:'Book',isiUom:'1',satuan:'Book',satuan2:'',satuan3:'',group:'Cabin & Toilet Article'},
    {name:'Disposal Bag',uom:'Pack',isiUom:'500',satuan:'Pocket',satuan2:'Pcs',satuan3:'',group:'Cabin & Toilet Article'},
    {name:'Facial Tisue',uom:'Dus',isiUom:'40',satuan:'Box',satuan2:'Pcs',satuan3:'Kelenex',group:'Dry Goods'},
    {name:'Hand Soap',uom:'Pack',isiUom:'1',satuan:'Pcs',satuan2:'',satuan3:'',group:'Cabin & Toilet Article'},
    {name:'Monouse Cup',uom:'Pack',isiUom:'100',satuan:'Cup',satuan2:'',satuan3:'',group:'Dry Goods'},
    {name:'Papper Cup',uom:'Pack',isiUom:'',satuan:'Cup',satuan2:'',satuan3:'',group:'Dry Goods'},
    {name:'Plastik Klip',uom:'Pack',isiUom:'100',satuan:'Pcs',satuan2:'',satuan3:'1',group:'Dry Goods'},
    {name:'Prayer Card',uom:'Pcs',isiUom:'1',satuan:'Pcs',satuan2:'',satuan3:'',group:'Cabin & Toilet Article'},
    {name:'Roll Tissue',uom:'Dus',isiUom:'100',satuan:'Roll',satuan2:'Pcs',satuan3:'',group:'Cabin & Toilet Article'},
    {name:'Seal',uom:'Pack',isiUom:'1000',satuan:'Pcs',satuan2:'',satuan3:'1',group:'Dry Goods'},
    {name:'Sugar',uom:'Box',isiUom:'2500',satuan:'Sachet',satuan2:'Pcs',satuan3:'',group:'Dry Goods'},
    {name:'Tea Sosro',uom:'Box',isiUom:'25',satuan:'Sachet',satuan2:'Pcs',satuan3:'1',group:'Dry Goods'},
    {name:'Tea Spoon',uom:'Pack',isiUom:'250',satuan:'Pcs',satuan2:'',satuan3:'1',group:'Dry Goods'},
    {name:'Plastik Penutup Gerobak',uom:'Pcs',isiUom:'1',satuan:'Pcs',satuan2:'',satuan3:'1',group:'Cabin & Toilet Article'},
    {name:'Catering Slip (CS)',uom:'Book',isiUom:'1',satuan:'book',satuan2:'',satuan3:'',group:'Cabin & Toilet Article'}
  ];

  // Generate kode barang: DG-DRY-001 for Dry Goods, DG-CAB-001 for Cabin & Toilet Article
  function generateBankItemCode(group, existingItems){
    const prefix = (group||'').toLowerCase().includes('cabin') ? 'DG-CAB' : 'DG-DRY';
    const existing = (existingItems||[]).filter(i=> i.kode && i.kode.startsWith(prefix));
    let maxNum = 0;
    existing.forEach(i=>{
      const parts = i.kode.split('-');
      const n = parseInt(parts[parts.length-1])||0;
      if(n > maxNum) maxNum = n;
    });
    return prefix+'-'+String(maxNum+1).padStart(3,'0');
  }

  // Ensure default bank items loaded if bankItems array missing/empty
  function ensureBankItemDefaults(){
    if(!dgData.bankItems || dgData.bankItems.length === 0){
      dgData.bankItems = DG_BANK_ITEM_DEFAULTS.map((it, idx)=>{
        const prefix = (it.group||'').toLowerCase().includes('cabin') ? 'DG-CAB' : 'DG-DRY';
        // Count how many of same prefix before this
        const samePrefix = DG_BANK_ITEM_DEFAULTS.slice(0, idx).filter(x=>
          (x.group||'').toLowerCase().includes('cabin') === (it.group||'').toLowerCase().includes('cabin')
        ).length;
        return {
          id: 'bi_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)+'_'+idx,
          kode: prefix+'-'+String(samePrefix+1).padStart(3,'0'),
          name: it.name,
          uom: it.uom,
          isiUom: it.isiUom,
          satuan: it.satuan,
          satuan2: it.satuan2,
          satuan3: it.satuan3,
          group: it.group,
          createdAt: new Date().toISOString()
        };
      });
      // Re-sort and regenerate codes properly
      let dryIdx=0, cabIdx=0;
      dgData.bankItems.forEach(it=>{
        const isCabin = (it.group||'').toLowerCase().includes('cabin');
        if(isCabin){ cabIdx++; it.kode='DG-CAB-'+String(cabIdx).padStart(3,'0'); }
        else { dryIdx++; it.kode='DG-DRY-'+String(dryIdx).padStart(3,'0'); }
      });
      saveDrygoodsData();
    }
  }

  // Render Bank Item table
  let dgBankItemPage = 1;
  const DG_BI_PAGE_SIZE = 30;
  function renderDgBankItem(){
    if(!dgData.bankItems) dgData.bankItems = [];
    ensureBankItemDefaults();

    const search = (document.getElementById('dgBankItemSearch')?.value||'').toLowerCase();
    const groupFilter = document.getElementById('dgBankItemFilterGroup')?.value||'';

    let list = dgData.bankItems.filter(it=>{
      if(groupFilter && it.group !== groupFilter) return false;
      if(search && ![(it.name||''),(it.kode||''),(it.group||''),(it.uom||''),(it.satuan||'')].join(' ').toLowerCase().includes(search)) return false;
      return true;
    });

    // KPI
    const allItems = dgData.bankItems;
    const kpiDry = allItems.filter(i=>(i.group||'').includes('Dry')).length;
    const kpiCabin = allItems.filter(i=>(i.group||'').toLowerCase().includes('cabin')).length;
    // "With stock" = item name exists in transactions
    const itemsWithTrx = new Set(dgData.transactions.map(t=>(t.item||'').toLowerCase()));
    const kpiWithStock = allItems.filter(i=>itemsWithTrx.has((i.name||'').toLowerCase())).length;
    document.getElementById('dgBankItemKpiTotal').textContent = allItems.length;
    document.getElementById('dgBankItemKpiDryGoods').textContent = kpiDry;
    document.getElementById('dgBankItemKpiCabin').textContent = kpiCabin;
    document.getElementById('dgBankItemKpiWithStock').textContent = kpiWithStock;

    // Pagination
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total/DG_BI_PAGE_SIZE));
    if(dgBankItemPage > totalPages) dgBankItemPage = 1;
    const start = (dgBankItemPage-1)*DG_BI_PAGE_SIZE;
    const page = list.slice(start, start+DG_BI_PAGE_SIZE);

    const infoEl = document.getElementById('dgBankItemInfo');
    if(infoEl) infoEl.textContent = `${total} barang`;

    const tbody = document.getElementById('dgBankItemTableBody');
    if(!tbody) return;

    if(!page.length){
      tbody.innerHTML='<tr><td colspan="10" class="text-center py-8 text-slate-400 text-sm">Tidak ada data barang.</td></tr>';
    } else {
      const groupColors = {'Dry Goods':'bg-amber-100 text-amber-700','Cabin & Toilet Article':'bg-purple-100 text-purple-700'};
      tbody.innerHTML = page.map((it,i)=>{
        const gc = groupColors[it.group]||'bg-slate-100 text-slate-600';
        return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
          <td class="px-3 py-2.5 text-xs text-slate-400">${start+i+1}</td>
          <td class="px-3 py-2.5"><span class="font-mono text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">${esc(it.kode||'-')}</span></td>
          <td class="px-3 py-2.5 font-medium text-sm">${esc(it.name||'-')}</td>
          <td class="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300">${esc(it.uom||'-')}</td>
          <td class="px-3 py-2.5 text-center text-xs">${it.isiUom||'-'}</td>
          <td class="px-3 py-2.5 text-xs">${esc(it.satuan||'-')}</td>
          <td class="px-3 py-2.5 text-xs text-slate-500">${esc(it.satuan2||'-')}</td>
          <td class="px-3 py-2.5 text-xs text-slate-500">${esc(it.satuan3||'-')}</td>
          <td class="px-3 py-2.5"><span class="badge text-xs ${gc}">${esc(it.group||'-')}</span></td>
          <td class="px-3 py-2.5 text-center whitespace-nowrap">
            <button data-bi-trx="${it.id}" class="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg mr-1" title="Buat Transaksi Baru dari barang ini">📦 Transaksi</button>
            <button data-bi-edit="${it.id}" class="text-blue-600 hover:underline text-xs mr-2">Edit</button>
            <button data-bi-del="${it.id}" class="text-red-600 hover:underline text-xs">Hapus</button>
          </td>
        </tr>`;
      }).join('');
    }

    // Pagination buttons
    const pag = document.getElementById('dgBankItemPagination');
    if(pag){
      let html = `<button ${dgBankItemPage===1?'disabled':''} data-bi-page="${dgBankItemPage-1}" class="px-2 py-1 rounded border text-xs disabled:opacity-40">‹</button>`;
      for(let p=Math.max(1,dgBankItemPage-2); p<=Math.min(totalPages,dgBankItemPage+2); p++){
        html+=`<button data-bi-page="${p}" class="px-2 py-1 rounded border text-xs ${p===dgBankItemPage?'bg-blue-600 text-white border-blue-600':''}">${p}</button>`;
      }
      html+=`<button ${dgBankItemPage===totalPages?'disabled':''} data-bi-page="${dgBankItemPage+1}" class="px-2 py-1 rounded border text-xs disabled:opacity-40">›</button>`;
      pag.innerHTML = html;
      pag.onclick = e=>{ const p=e.target.dataset.biPage; if(p){ dgBankItemPage=parseInt(p); renderDgBankItem(); }};
    }
  }

  // Open transaction from bank item (link Bank Item → Data Stok)
  function openTrxFromBankItem(item){
    // Switch to Data Stok tab first — use window.switchTab which respects permissions
    if(typeof window.switchTab === 'function'){
      window.switchTab('drygoods-data');
    } else {
      // Fallback: manually switch tab
      document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
      const tp = document.getElementById('tab-drygoods-data');
      if(tp) tp.classList.add('active');
      document.querySelectorAll('.sidebar-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('[data-tab="drygoods-data"]').forEach(b=>b.classList.add('active'));
      buildStationTabs(); renderDgTrx();
    }
    // Open modal pre-filled with item data
    setTimeout(()=>{
      dgEditTrxId = null;
      document.getElementById('dgTrxModalTitle').textContent = 'Tambah Transaksi — '+item.name;
      document.getElementById('dgTrxDate').value = todayStr();
      document.getElementById('dgTrxStation').value = activeDgStation !== 'ALL' ? activeDgStation : '';
      document.getElementById('dgTrxItem').value = item.name;
      document.getElementById('dgTrxCode').value = item.kode||'';
      document.getElementById('dgTrxType').value = 'IN';
      document.getElementById('dgTrxQty').value = '';
      document.getElementById('dgTrxUnit').value = item.satuan||item.uom||'';
      document.getElementById('dgTrxRemark').value = '';
      // Update autocomplete from bank items + existing transactions
      const suggestions = document.getElementById('dgItemSuggestions');
      if(suggestions){
        const items = [...new Set([
          ...(dgData.bankItems||[]).map(i=>i.name),
          ...dgData.transactions.map(t=>t.item)
        ].filter(Boolean))];
        suggestions.innerHTML = items.map(n=>`<option value="${esc(n)}">`).join('');
      }
      document.getElementById('dgTrxModal').classList.remove('hidden');
    }, 200);
  }

  // Auto-update item name dropdown in transaction modal from bank items
  function updateTrxModalSuggestions(){
    const suggestions = document.getElementById('dgItemSuggestions');
    if(!suggestions) return;
    const bankNames = (dgData.bankItems||[]).map(i=>i.name);
    const trxNames = dgData.transactions.map(t=>t.item);
    const items = [...new Set([...bankNames, ...trxNames].filter(Boolean))];
    suggestions.innerHTML = items.map(n=>`<option value="${esc(n)}">`).join('');
  }

  // Auto-fill code when item name is typed in transaction modal
  document.getElementById('dgTrxItem')?.addEventListener('input', function(){
    const val = this.value.trim().toLowerCase();
    if(!val) return;
    const found = (dgData.bankItems||[]).find(i=>(i.name||'').toLowerCase() === val);
    if(found){
      const codeEl = document.getElementById('dgTrxCode');
      const unitEl = document.getElementById('dgTrxUnit');
      if(codeEl && !codeEl.value) codeEl.value = found.kode||'';
      if(unitEl && !unitEl.value) unitEl.value = found.satuan||found.uom||'';
    }
  });

  // Bank Item Modal logic
  let dgEditBankItemId = null;
  window.dgBiAutoCode = function(){
    if(dgEditBankItemId) return; // only auto on new
    const group = document.getElementById('dgBankItemGroup')?.value||'Dry Goods';
    const code = generateBankItemCode(group, dgData.bankItems||[]);
    const el = document.getElementById('dgBankItemCode');
    if(el) el.value = code;
  };

  function openBankItemModal(item){
    dgEditBankItemId = item ? item.id : null;
    document.getElementById('dgBankItemModalTitle').textContent = item ? 'Edit Barang' : 'Tambah Barang';
    if(item){
      document.getElementById('dgBankItemCode').value   = item.kode||'';
      document.getElementById('dgBankItemGroup').value  = item.group||'Dry Goods';
      document.getElementById('dgBankItemName').value   = item.name||'';
      document.getElementById('dgBankItemUom').value    = item.uom||'';
      document.getElementById('dgBankItemIsiUom').value = item.isiUom||'';
      document.getElementById('dgBankItemSatuan').value = item.satuan||'';
      document.getElementById('dgBankItemSatuan2').value= item.satuan2||'';
      document.getElementById('dgBankItemSatuan3').value= item.satuan3||'';
    } else {
      // new item: auto-generate code
      const group = document.getElementById('dgBankItemGroup')?.value||'Dry Goods';
      document.getElementById('dgBankItemCode').value   = generateBankItemCode(group, dgData.bankItems||[]);
      document.getElementById('dgBankItemName').value   = '';
      document.getElementById('dgBankItemUom').value    = '';
      document.getElementById('dgBankItemIsiUom').value = '';
      document.getElementById('dgBankItemSatuan').value = '';
      document.getElementById('dgBankItemSatuan2').value= '';
      document.getElementById('dgBankItemSatuan3').value= '';
    }
    document.getElementById('dgBankItemModal').classList.remove('hidden');
  }
  function closeBankItemModal(){ document.getElementById('dgBankItemModal').classList.add('hidden'); }

  document.getElementById('dgBankItemModalCancel')?.addEventListener('click', closeBankItemModal);
  document.getElementById('dgBankItemModal')?.addEventListener('click', e=>{ if(e.target===document.getElementById('dgBankItemModal')) closeBankItemModal(); });

  document.getElementById('dgBankItemModalSave')?.addEventListener('click', ()=>{
    const kode   = document.getElementById('dgBankItemCode').value.trim();
    const group  = document.getElementById('dgBankItemGroup').value;
    const name   = document.getElementById('dgBankItemName').value.trim();
    const uom    = document.getElementById('dgBankItemUom').value.trim();
    const isiUom = document.getElementById('dgBankItemIsiUom').value.trim();
    const satuan = document.getElementById('dgBankItemSatuan').value.trim();
    const satuan2= document.getElementById('dgBankItemSatuan2').value.trim();
    const satuan3= document.getElementById('dgBankItemSatuan3').value.trim();
    if(!name||!uom||!satuan){ showToast('Lengkapi: Nama Barang, UOM, dan Satuan','error'); return; }
    if(!dgData.bankItems) dgData.bankItems = [];
    // Check duplicate name (except when editing same)
    const dupName = dgData.bankItems.find(i=>i.id!==dgEditBankItemId && (i.name||'').toLowerCase()===name.toLowerCase());
    if(dupName){ showToast('Nama barang sudah ada di bank item: '+dupName.kode,'error'); return; }
    const entry = { id: dgEditBankItemId||('bi_'+Date.now()+'_'+Math.random().toString(36).slice(2,7)), kode, group, name, uom, isiUom, satuan, satuan2, satuan3, updatedAt: new Date().toISOString() };
    const idx = dgData.bankItems.findIndex(i=>i.id===dgEditBankItemId);
    if(idx>-1) dgData.bankItems[idx]=entry; else dgData.bankItems.push(entry);
    saveDrygoodsData();
    closeBankItemModal();
    renderDgBankItem();
    showToast(dgEditBankItemId?'Barang diperbarui':'Barang ditambahkan','success');
    dgEditBankItemId = null;
  });

  document.getElementById('btnDgAddBankItem')?.addEventListener('click', ()=> openBankItemModal(null));

  // Table click delegation for bank item table
  document.getElementById('dgBankItemTableBody')?.addEventListener('click', async e=>{
    const trxId  = e.target.closest('[data-bi-trx]')?.dataset.biTrx;
    const editId = e.target.closest('[data-bi-edit]')?.dataset.biEdit;
    const delId  = e.target.closest('[data-bi-del]')?.dataset.biDel;
    if(trxId){
      const it = (dgData.bankItems||[]).find(i=>i.id===trxId);
      if(it) openTrxFromBankItem(it);
    }
    if(editId){ const it=(dgData.bankItems||[]).find(i=>i.id===editId); if(it) openBankItemModal(it); }
    if(delId){
      const ok = await showConfirm('Hapus Barang','Hapus barang ini dari bank item?');
      if(!ok) return;
      dgData.bankItems = (dgData.bankItems||[]).filter(i=>i.id!==delId);
      saveDrygoodsData(); renderDgBankItem(); showToast('Barang dihapus');
    }
  });

  // Search/filter wiring for bank item
  ['dgBankItemSearch','dgBankItemFilterGroup'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input', ()=>{ dgBankItemPage=1; renderDgBankItem(); });
    document.getElementById(id)?.addEventListener('change', ()=>{ dgBankItemPage=1; renderDgBankItem(); });
  });
  document.getElementById('btnDgBankItemResetFilter')?.addEventListener('click', ()=>{
    const s=document.getElementById('dgBankItemSearch'); if(s) s.value='';
    const g=document.getElementById('dgBankItemFilterGroup'); if(g) g.value='';
    dgBankItemPage=1; renderDgBankItem();
  });

  // Export Excel for bank items
  document.getElementById('btnDgExportBankItem')?.addEventListener('click', ()=>{
    if(!window.XLSX){ showToast('XLSX tidak tersedia','error'); return; }
    const items = dgData.bankItems||[];
    if(!items.length){ showToast('Tidak ada data bank item','error'); return; }
    const rows = items.map((it,i)=>({
      'No':i+1,'Kode':it.kode||'','Nama Barang':it.name||'','UOM':it.uom||'',
      'Isi/UOM':it.isiUom||'','Satuan':it.satuan||'','Satuan 2nd':it.satuan2||'',
      'Satuan 3rd':it.satuan3||'','Group Item':it.group||''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bank Item');
    XLSX.writeFile(wb, `Drygoods_BankItem_${todayLocalStr()}.xlsx`);
    showToast('Export Excel bank item berhasil');
  });

  // Patch openTrxModal to always load bank item suggestions
  // Register btnDgAddTrx listener here (original was commented out above)
  document.getElementById('btnDgAddTrx')?.addEventListener('click', ()=>{
    openTrxModal(null);
    updateTrxModalSuggestions();
  });

  // ── INIT BANK ITEM ───────────────────────────────────────────────
  if(!dgData.bankItems) dgData.bankItems = [];
  ensureBankItemDefaults();
  // This is the correct place to do the initial Bank Item render: everything this
  // module needs (DG_BANK_ITEM_DEFAULTS, DG_BI_PAGE_SIZE, renderDgBankItem, etc.)
  // is fully defined by this point in the file.
  if(currentTab === 'drygoods-bankitem'){ renderDgBankItem(); }

  // Notification banner untuk karyawan yang akan habis kontrak (≤30 hari)
  function checkExpiringContracts(){
    if(!window.currentUser) return;
    const today = todayStr();
    const expiring = getKaryawanList().filter(e=>{
      if(!e.station) return false;
      const dl = e.expiredKontrak ? Math.ceil((new Date(e.expiredKontrak)-new Date(today))/(1000*60*60*24)) : 9999;
      return dl > 0 && dl <= 30;
    });
    if(expiring.length > 0){
      showToast(`⚠️ ${expiring.length} karyawan IFS akan habis kontrak dalam 30 hari!`, 'warn');
    }
  }
  setTimeout(()=>{
    const pollLogin = setInterval(()=>{
      if(window.currentUser){ clearInterval(pollLogin); setTimeout(checkExpiringContracts, 3000); }
    }, 1000);
  }, 500);

  // Sinkronkan ulang daftar station Drygoods setiap kali Bank Data Station
  // (Tab Station) berubah — buang station yang sudah dihapus dari bank,
  // dan refresh semua dropdown/tab yang terkait.
  document.addEventListener('sjn:stations-updated', ()=>{
    const validCodes = new Set(getBankStationCodes());
    dgData.stations = dgData.stations.filter(s=>validCodes.has(s));
    saveDrygoodsData();
    buildStationTabs();
    renderDgEmployees();
  });

  // Sinkronkan ulang tampilan IFS Station setiap kali Data Karyawan
  // berubah (tambah/edit/hapus karyawan, ubah station) dari Tab Data
  // Karyawan utama — karena keduanya kini satu sumber data yang sama.
  document.addEventListener('sjn:karyawan-updated', ()=>{
    renderDgEmployees();
  });

  // [BUGFIX] Diekspor agar js/patch-arsitektur-v3.js (P9/P10, refresh
  // tampilan Drygoods setelah station lock user berubah) bisa benar-benar
  // memanggilnya. Sebelumnya renderDgTrx hanya fungsi internal IIFE ini,
  // tidak pernah terjangkau dari file lain — guard
  // `typeof renderDgTrx === 'function'` di patch-arsitektur-v3.js SELALU
  // bernilai false, sehingga refresh otomatis tidak pernah benar-benar
  // terjadi (silently no-op, bukan error). Lihat REFACTOR_NOTES.md bagian
  // "Perbaikan Bug Pasca-Refactor".
  window.renderDgTrx = renderDgTrx;

})();
