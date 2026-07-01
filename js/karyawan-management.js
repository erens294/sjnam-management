/* ================================================================
   SJNAM — MODUL KARYAWAN MANAGEMENT
   ================================================================
   Data Karyawan (Tab Admin → sub-tab Data Karyawan): Nama, NIP,
   Jabatan, No HP, Email, Station — terpisah dari kredensial login
   (users). Kolom "User" hanya menyimpan REFERENSI (username) ke
   akun login yang sudah ada di Manajemen Role, tidak menduplikasi
   username/password/role.

   ⚠️ CATATAN PEMULIHAN: modul ini sebelumnya HILANG TOTAL dari hasil
   refactor — terhapus tidak sengaja bersamaan dengan User Management
   saat ekstraksi js/auth.js di Tahap 1. Dipulihkan dari index.html
   ASLI yang diunggah pengguna. Lihat REFACTOR_NOTES.md bagian
   "Tahap 8" dan js/user-management.js untuk kronologi lengkap.

   PERBAIKAN YANG DITERAPKAN SAAT PEMULIHAN:
   - Referensi `currentUser` bare diubah jadi `window.currentUser`
     (alasan sama seperti user-management.js).
   - KARYAWAN_KEY tetap aman sebagai const lokal (dideklarasikan di
     dalam IIFE modul ini sendiri, tidak perlu diubah).

   URUTAN LOAD: independen dari auth.js/training.js untuk fungsi
   intinya sendiri, tapi memanggil window.DRYGOODS.renderAll() (jika
   ada) dan window.renderKaryawanTable() dipanggil balik dari
   service-recovery.js (event 'sjn:stations-updated') — modul ini
   aman dimuat di urutan mana pun karena semua cross-reference
   sudah di-guard typeof check di kode asli.
   ================================================================ */

// ===================================================================
// MODUL DATA KARYAWAN (Tab Admin → sub-tab Data Karyawan)
// ===================================================================
// Karyawan adalah data pribadi (Nama, NIP, Jabatan, No HP, Email, Station).
// Kolom "User" hanya menyimpan REFERENSI (username) ke akun login yang sudah
// ada di Manajemen Role — TIDAK menduplikasi username/password/role di sini.
// Ini sengaja dipisah dari kredensial login (users) supaya:
//  1. Username/password tetap satu sumber kebenaran untuk autentikasi.
//  2. Menambah user baru ke depannya cukup: tambah karyawan + pilih usernya
//     di dropdown kolom User (sesuai permintaan), tanpa mengubah field lain.
(function(){
  const KARYAWAN_KEY = 'sjnam_karyawan_v1';
  let karyawan = [];
  try { karyawan = JSON.parse(localStorage.getItem(KARYAWAN_KEY) || '[]'); } catch(e){ karyawan = []; }

  function saveKaryawan(){
    localStorage.setItem(KARYAWAN_KEY, JSON.stringify(karyawan));
    if(typeof triggerAutoSync === 'function') triggerAutoSync('karyawan');
    // Beritahu modul lain (mis. Drygoods IFS Station) bahwa data karyawan
    // berubah, karena keduanya kini memakai sumber data yang sama.
    document.dispatchEvent(new CustomEvent('sjn:karyawan-updated'));
  }
  // Expose getter/setter untuk dipakai oleh cloud sync (push/pull/realtime)
  window.getKaryawanData = () => karyawan;
  window.setKaryawanData = (arr) => {
    karyawan = Array.isArray(arr) ? arr : [];
    if(document.getElementById('karyawanTableBody')) renderKaryawan();
    document.dispatchEvent(new CustomEvent('sjn:karyawan-updated'));
  };

  // ── Helper: daftar station untuk dropdown filter & form ──
  // BUGFIX-PROOF: `stations` (variabel global di STATIONS_KEY) bisa berubah
  // sewaktu-waktu (tambah/hapus station di Tab Station) — selalu baca ulang
  // dari localStorage di sini agar dropdown tidak basi (stale).
  function getStationList(){
    try { return JSON.parse(localStorage.getItem('sjn_stations_v2') || '[]'); } catch(e){ return []; }
  }

  function populateStationDropdowns(){
    const list = getStationList();
    const opts = list.map(s => `<option value="${esc(s.iata)}">${esc(s.iata)} — ${esc(s.name)}</option>`).join('');
    const filterEl = document.getElementById('karyawanFilterStation');
    const formEl = document.getElementById('karyawanStation');
    if(filterEl){
      const cur = filterEl.value;
      filterEl.innerHTML = '<option value="">Semua Station</option>' + opts;
      if(list.some(s=>s.iata===cur)) filterEl.value = cur;
    }
    if(formEl){
      const cur = formEl.value;
      // BUG8 FIX: Tambah opsi ALL agar Admin bisa assign station=ALL
      formEl.innerHTML='<option value="">Pilih station...</option>'
        +'<option value="ALL">🌐 ALL — Semua Station (akses semua)</option>'
        +opts;
      if(cur==='ALL') formEl.value='ALL';
      else if(list.some(s=>s.iata===cur)) formEl.value=cur;
    }
  }

  // ── Helper: daftar user (akun login) untuk dropdown kolom "User" ──
  // Hanya tampilkan user yang BELUM dihubungkan ke karyawan lain, kecuali
  // user yang sedang dihubungkan ke karyawan yang sedang diedit saat ini.
  function getUsersList(){
    try { return JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]'); } catch(e){ return []; }
  }

  window.renderKaryawanUserOptions = function(){
    const sel = document.getElementById('karyawanUser');
    if(!sel) return;
    const allUsers = getUsersList();
    const linkedUsernames = new Set(karyawan.map(k=>k.username).filter(Boolean));
    const editingUsername = window._karyawanEditId
      ? (karyawan.find(k=>k.id===window._karyawanEditId)||{}).username
      : null;
    const cur = sel.value;
    const opts = allUsers
      .filter(u => !linkedUsernames.has(u.username) || u.username === editingUsername)
      .map(u => `<option value="${esc(u.username)}">${esc(u.username)} — ${esc(u.role)}</option>`)
      .join('');
    sel.innerHTML = '<option value="">— Belum dihubungkan ke akun manapun —</option>' + opts;
    if(allUsers.some(u=>u.username===cur)) sel.value = cur;
  };

  // ── RENDER ──
  function renderKaryawan(){
    const tbody = document.getElementById('karyawanTableBody');
    if(!tbody) return;
    populateStationDropdowns();

    const search = (document.getElementById('karyawanSearch')?.value || '').toLowerCase();
    const stationFilter = document.getElementById('karyawanFilterStation')?.value || '';
    const allUsersMap = new Map(getUsersList().map(u => [u.username, u]));

    let list = karyawan.filter(k => {
      if(stationFilter && k.station !== stationFilter) return false;
      if(search){
        const hay = [k.nama, k.nip, k.jabatan, k.station, k.hp, k.email].join(' ').toLowerCase();
        if(!hay.includes(search)) return false;
      }
      return true;
    });

    document.getElementById('karyawanCountInfo').textContent = `Total Karyawan: ${karyawan.length}`;

    if(!list.length){
      tbody.innerHTML = '<tr><td colspan="11" class="text-center py-8 text-slate-400 text-sm">Belum ada data karyawan.</td></tr>';
      return;
    }

    const canEdit = window.currentUserCanAdd;
    const canDelete = window.currentUserCanDelete;

    tbody.innerHTML = list.map((k, i) => {
      const linkedUser = k.username ? allUsersMap.get(k.username) : null;
      // Column: User (Login) — shows NIP for login identifier
      const userLoginCell = linkedUser
        ? `<span class="font-mono text-xs text-slate-700 dark:text-slate-200">${esc(k.nip || linkedUser.username)}</span>`
        : (k.username
            ? `<span class="text-xs text-red-500" title="Akun ${esc(k.username)} sudah dihapus dari Manajemen Role">⚠️ ${esc(k.nip || k.username)}</span>`
            : `<span class="text-xs text-slate-400">— Belum terhubung —</span>`);
      // Column: Role — shows role badge, links to Manajemen Role tab
      const _stBoundRoles = ['User-SR','User-STCR','User-ST','User-DRG'];
      const _needsStation = linkedUser && _stBoundRoles.includes(linkedUser.role);
      const _missingStation = _needsStation && (!k.station || k.station === '');
      const _stWarn = _missingStation ? '<span class="text-[10px] text-amber-600 font-semibold block mt-0.5">⚠️ Station belum diisi</span>' : '';
      const roleCell = linkedUser
        ? `<div><button onclick="document.querySelector('[data-admin-subtab=\"users\"]').click()" title="Lihat di Manajemen Role" class="badge ${getRoleBadgeClass(linkedUser.role)} cursor-pointer hover:opacity-80 transition">${esc(linkedUser.role)}</button>${_stWarn}</div>`
        : (k.username
            ? `<button onclick="document.querySelector('[data-admin-subtab=\"users\"]').click()" class="text-xs text-red-400 hover:underline cursor-pointer">Akun tidak ditemukan</button>`
            : `<span class="text-xs text-slate-400">—</span>`);
      return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
        <td class="p-3 text-xs text-slate-400">${i+1}</td>
        <td class="p-3 font-medium">${esc(k.nama)}</td>
        <td class="p-3 font-mono text-xs">${esc(k.nip)}</td>
        <td class="p-3 text-xs">${esc(k.jabatan)}</td>
        <td class="p-3 text-xs">${esc(k.hp || '-')}</td>
        <td class="p-3 text-xs">${esc(k.email || '-')}</td>
        <td class="p-3 text-xs">${esc(k.station || '-')}</td>
        <td class="p-3">${userLoginCell}</td>
        <td class="p-3 text-xs">
          ${linkedUser
            ? (linkedUser.active
                ? '<span class="text-emerald-600 font-semibold text-xs">● Aktif</span>'
                : '<span class="text-red-400 font-semibold text-xs">○ Nonaktif</span>')
            : '<span class="text-slate-300 text-xs">—</span>'}
        </td>
        <td class="p-3">${roleCell}</td>
        <td class="p-3 text-right whitespace-nowrap">
          ${canEdit ? `<button data-kar-edit="${k.id}" class="text-xs px-2 py-1 bg-amber-500 text-white rounded mr-1">Edit</button>` : ''}
          ${canDelete ? `<button data-kar-del="${k.id}" class="text-xs px-2 py-1 bg-red-500 text-white rounded">Hapus</button>` : ''}
        </td>
      </tr>`;
    }).join('');
  }
  window.renderKaryawanTable = renderKaryawan;

  // ── MODAL OPEN/CLOSE ──
  function openKaryawanModal(item){
    window._karyawanEditId = item ? item.id : null;
    document.getElementById('karyawanModalTitle').textContent = item ? 'Edit Karyawan' : 'Tambah Karyawan';
    populateStationDropdowns();
    window.renderKaryawanUserOptions();
    document.getElementById('karyawanNama').value    = item?.nama    || '';
    document.getElementById('karyawanNip').value     = item?.nip     || '';
    document.getElementById('karyawanJabatan').value = item?.jabatan || '';
    document.getElementById('karyawanStation').value = item?.station || '';
    document.getElementById('karyawanHp').value      = item?.hp      || '';
    document.getElementById('karyawanEmail').value   = item?.email   || '';
    document.getElementById('karyawanUser').value    = item?.username || '';
    document.getElementById('karyawanJoinDate').value         = item?.joinDate       || '';
    document.getElementById('karyawanExpiredKontrak').value   = item?.expiredKontrak || '';
    document.getElementById('karyawanNote').value              = item?.note           || '';

    // Populate account section if linked
    const accountSection = document.getElementById('karyawanAccountSection');
    const karyawanUsernameEl = document.getElementById('karyawanUsername');
    const karyawanPasswordEl = document.getElementById('karyawanPassword');
    const karyawanAktifEl   = document.getElementById('karyawanAktif');
    if(item?.username){
      const allUsers = (function(){ try{ return JSON.parse(localStorage.getItem('sjnam_users_v1')||'[]'); }catch(e){ return []; } })();
      const linkedU = allUsers.find(u => u.username === item.username);
      if(linkedU){
        if(accountSection) accountSection.classList.remove('hidden');
        if(karyawanUsernameEl) karyawanUsernameEl.value = linkedU.username;
        if(karyawanPasswordEl) karyawanPasswordEl.value = '';
        if(karyawanAktifEl)   karyawanAktifEl.checked  = !!linkedU.active;
        // Disable username edit for Master
        if(karyawanUsernameEl) karyawanUsernameEl.readOnly = (linkedU.role === 'Master');
      } else {
        if(accountSection) accountSection.classList.add('hidden');
      }
    } else {
      if(accountSection) accountSection.classList.add('hidden');
      if(karyawanUsernameEl) karyawanUsernameEl.value = '';
      if(karyawanPasswordEl) karyawanPasswordEl.value = '';
      if(karyawanAktifEl)   karyawanAktifEl.checked  = true;
    }

    // Show/hide account section when user dropdown changes
    document.getElementById('karyawanUser').onchange = function(){
      const selectedUsername = this.value;
      if(!selectedUsername){ if(accountSection) accountSection.classList.add('hidden'); return; }
      const allUsers = (function(){ try{ return JSON.parse(localStorage.getItem('sjnam_users_v1')||'[]'); }catch(e){ return []; } })();
      const linkedU = allUsers.find(u => u.username === selectedUsername);
      if(linkedU){
        if(accountSection) accountSection.classList.remove('hidden');
        if(karyawanUsernameEl){ karyawanUsernameEl.value = linkedU.username; karyawanUsernameEl.readOnly = (linkedU.role === 'Master'); }
        if(karyawanPasswordEl) karyawanPasswordEl.value = '';
        if(karyawanAktifEl)   karyawanAktifEl.checked  = !!linkedU.active;
      } else {
        if(accountSection) accountSection.classList.add('hidden');
      }
    };

    document.getElementById('karyawanModal').classList.remove('hidden');
  }
  function closeKaryawanModal(){
    document.getElementById('karyawanModal').classList.add('hidden');
    window._karyawanEditId = null;
    // Reset account section
    const accountSection = document.getElementById('karyawanAccountSection');
    if(accountSection) accountSection.classList.add('hidden');
    const pwEl = document.getElementById('karyawanPassword');
    if(pwEl) pwEl.value = '';
    const unEl = document.getElementById('karyawanUsername');
    if(unEl){ unEl.value = ''; unEl.readOnly = false; }
    const aktifEl = document.getElementById('karyawanAktif');
    if(aktifEl) aktifEl.checked = true;
    const userEl = document.getElementById('karyawanUser');
    if(userEl) userEl.onchange = null; // remove inline handler
    // Re-enable save button
    const saveBtn = document.getElementById('karyawanModalSave');
    if(saveBtn){ saveBtn.disabled = false; saveBtn.textContent = '💾 Simpan'; }
  }

  document.getElementById('btnAddKaryawan')?.addEventListener('click', () => {
    if(!window.currentUserCanAdd){ showToast('Tidak ada izin untuk menambah karyawan', 'error'); return; }
    openKaryawanModal(null);
  });
  document.getElementById('karyawanModalCancel')?.addEventListener('click', closeKaryawanModal);
  document.getElementById('karyawanModal')?.addEventListener('click', e => {
    if(e.target === document.getElementById('karyawanModal')) closeKaryawanModal();
  });

  // ── SAVE (create/update) ──
  document.getElementById('karyawanModalSave')?.addEventListener('click', () => {
    if(!window.currentUserCanAdd){ showToast('Tidak ada izin untuk menyimpan data karyawan', 'error'); return; }
    const saveBtn = document.getElementById('karyawanModalSave');
    if(saveBtn && saveBtn.disabled) return; // prevent double-submit
    if(saveBtn){ saveBtn.disabled = true; saveBtn.textContent = '⏳ Menyimpan...'; }

    const nama     = document.getElementById('karyawanNama').value.trim();
    const nip      = document.getElementById('karyawanNip').value.trim();
    const jabatan  = document.getElementById('karyawanJabatan').value.trim();
    const station  = document.getElementById('karyawanStation').value;
    const hp       = document.getElementById('karyawanHp').value.trim();
    const email    = document.getElementById('karyawanEmail').value.trim();
    const username = document.getElementById('karyawanUser').value;
    const joinDate         = document.getElementById('karyawanJoinDate').value;
    const expiredKontrak    = document.getElementById('karyawanExpiredKontrak').value;
    const note              = document.getElementById('karyawanNote').value.trim();

    // Account fields (only when account section visible)
    const accountSection  = document.getElementById('karyawanAccountSection');
    const accountVisible  = accountSection && !accountSection.classList.contains('hidden');
    const newUsername     = accountVisible ? (document.getElementById('karyawanUsername')?.value || '').trim().toLowerCase() : null;
    const newPassword     = accountVisible ? (document.getElementById('karyawanPassword')?.value || '').trim() : null;
    const newAktif        = accountVisible ? (document.getElementById('karyawanAktif')?.checked ?? true) : null;

    const _resetSaveBtn = () => { if(saveBtn){ saveBtn.disabled = false; saveBtn.textContent = '💾 Simpan'; } };

    if(!nama || !nip || !jabatan){
      showToast('Lengkapi field wajib: Nama, NIP, dan Jabatan', 'error');
      _resetSaveBtn(); return;
    }

    // Validasi: role berbasis station wajib punya station diisi
    // Cek apakah karyawan ini punya akun login dengan role station-bound
    const _stationBoundRoles = ['User-SR','User-STCR','User-ST','User-DRG',
                                 'Op-SR','Op-STCR','Op-DRG','Op-ST'];
    if(!station || station === ''){
      // Cek apakah akun terhubung punya role yang butuh station
      const _linkedUsername = accountVisible ? newUsername || username : username;
      if(_linkedUsername){
        const _allU = JSON.parse(localStorage.getItem('sjnam_users_v1')||'[]');
        const _linkedU = _allU.find(u=>u.username===_linkedUsername);
        if(_linkedU && _stationBoundRoles.includes(_linkedU.role)){
          showToast(`Role ${_linkedU.role} wajib memiliki station — pilih station terlebih dahulu`, 'error');
          _resetSaveBtn(); return;
        }
      }
    }
    if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
      showToast('Format email tidak valid', 'error'); _resetSaveBtn(); return;
    }
    if(hp && !/^[0-9+\-\s]{8,20}$/.test(hp)){
      showToast('Format No Handphone tidak valid', 'error'); _resetSaveBtn(); return;
    }
    // NIP harus unik
    const dupNip = karyawan.find(k => k.id !== window._karyawanEditId && (k.nip||'').toLowerCase() === nip.toLowerCase());
    if(dupNip){ showToast('NIP sudah digunakan oleh: ' + dupNip.nama, 'error'); _resetSaveBtn(); return; }

    // Username akun harus unik di users jika diubah
    if(accountVisible && newUsername && newUsername !== username){
      const allUsersCheck = JSON.parse(localStorage.getItem('sjnam_users_v1')||'[]');
      if(allUsersCheck.find(u => u.username === newUsername && u.username !== username)){
        showToast('Username "' + newUsername + '" sudah digunakan akun lain', 'error'); _resetSaveBtn(); return;
      }
    }

    // User hanya boleh dihubungkan ke SATU karyawan
    if(username){
      const dupUser = karyawan.find(k => k.id !== window._karyawanEditId && k.username === username);
      if(dupUser){ showToast('Akun ini sudah terhubung ke karyawan lain: ' + dupUser.nama, 'error'); _resetSaveBtn(); return; }
    }

    const doSaveKaryawan = (finalUsername) => {
      const entry = {
        id: window._karyawanEditId || ('kar_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
        nama, nip, jabatan, station, hp, email,
        joinDate, expiredKontrak, note,
        username: finalUsername || username,
        updatedAt: new Date().toISOString()
      };
      const idx = karyawan.findIndex(k => k.id === window._karyawanEditId);
      if(idx > -1) karyawan[idx] = entry; else karyawan.push(entry);
      saveKaryawan();

      // Sync nama ke akun login
      const finalUname = finalUsername || username;
      if(finalUname){
        try {
          const users = JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]');
          const u = users.find(x => x.username === finalUname);
          if(u){
            u.name = nama;
            if(finalUsername && finalUsername !== username) u.username = finalUsername;
            if(newAktif !== null && u.username !== window.currentUser.username) u.active = newAktif;
            saveUsers(users);
            if(window.currentUser && (window.currentUser.username === username || window.currentUser.username === finalUsername)){
              window.currentUser.name = nama;
              window.currentUser.name = nama;
              if(finalUsername) { window.currentUser.username = finalUsername; window.currentUser.username = finalUsername; }
              localStorage.setItem('sjnam_session_v1', JSON.stringify(window.currentUser));
              const nameEls = ['userNameDisplay','userNameDisplaySide'];
              nameEls.forEach(id => { const el = document.getElementById(id); if(el) el.textContent = nama; });
            }
          }
        } catch(e){ console.error('Gagal sinkron akun', e); }
      }

      if(typeof auditLog === 'function') auditLog(idx > -1 ? 'update' : 'create', 'karyawan', entry.id, nama);
      closeKaryawanModal();
      renderKaryawan();
      if(typeof renderUserTable === 'function') renderUserTable();
      showToast(idx > -1 ? 'Data karyawan diperbarui' : 'Karyawan ditambahkan', 'success');
      // BUG1 FIX: Jika karyawan yang diedit adalah user yang sedang login (User-DRG),
      // perbarui window._userDrgStation LANGSUNG tanpa menunggu login ulang.
      // Tanpa ini, perubahan station oleh Admin tidak berlaku sampai user re-login.
      (function _refreshDrgStationIfSelf(){
        try {
          var _cu = window.currentUser;
          if(!_cu || _cu.role !== 'User-DRG') return;
          var _myUser = (_cu.username||'').toLowerCase();
          var _entryUser = (entry.username||'').toLowerCase();
          if(_myUser !== _entryUser) return; // bukan karyawan sendiri
          // Update station di window
          var _newSt = entry.station || null;
          window._userDrgStation = _newSt;
          if(_cu) _cu.station = _newSt;
          // Re-apply lock di semua tab dg-station yang ada di DOM
          document.querySelectorAll('[data-dg-station]').forEach(function(t){
            var ts = t.dataset.dgStation; if(!ts) return;
            if(!_newSt || _newSt === 'ALL'){
              t.style.opacity=''; t.style.pointerEvents=''; t.title='';
            } else if(ts === _newSt){
              t.style.opacity=''; t.style.pointerEvents=''; t.title='';
            } else {
              t.style.opacity='0.35'; t.style.pointerEvents='none';
              t.title = (ts==='ALL' ? 'Akses terbatas' : 'Akses terbatas ke station '+_newSt);
            }
          });
          // Re-render drygoods jika sedang di tab tersebut
          if(typeof window.DRYGOODS === 'object' && typeof window.DRYGOODS.renderAll === 'function'){
            setTimeout(function(){ window.DRYGOODS.renderAll(); }, 50);
          }
        } catch(ex){ console.warn('[DRG Self-Update]', ex); }
      })();
    };

    // Handle password hash if changed
    // Use _ensureHashedPassword to prevent double-hashing (P8 interceptor may have
    // already hashed the value before this handler runs)
    if(accountVisible && newPassword){
      (window._ensureHashedPassword ? window._ensureHashedPassword(newPassword) : Promise.resolve(newPassword)).then(hashed => {
        try {
          const users = JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]');
          const u = users.find(x => x.username === username);
          if(u){ u.password = hashed; saveUsers(users); }
        } catch(e){}
        doSaveKaryawan(newUsername && newUsername !== username ? newUsername : null);
      });
    } else {
      doSaveKaryawan(newUsername && newUsername !== username ? newUsername : null);
    }
  });

  // ── Table click delegation: edit / hapus ──
  document.getElementById('karyawanTableBody')?.addEventListener('click', async e => {
    const editId = e.target.closest('[data-kar-edit]')?.dataset.karEdit;
    const delId  = e.target.closest('[data-kar-del]')?.dataset.karDel;
    if(editId){
      if(!window.currentUserCanAdd){ showToast('Tidak ada izin untuk mengedit karyawan', 'error'); return; }
      const item = karyawan.find(k => k.id === editId);
      if(item) openKaryawanModal(item);
    }
    if(delId){
      if(!window.currentUserCanDelete){ showToast('Tidak ada izin untuk menghapus karyawan', 'error'); return; }
      const item = karyawan.find(k => k.id === delId);
      const ok = await showConfirm('Hapus Karyawan', `Hapus data karyawan "${item?.nama || ''}"? Akun login terkait TIDAK akan terhapus, hanya tautannya yang diputus.`);
      if(!ok) return;
      karyawan = karyawan.filter(k => k.id !== delId);
      saveKaryawan();
      // [BUGFIX] Catat tombstone untuk karyawan yang dihapus, supaya
      // cloudPull berikutnya tidak memasukkannya kembali dari payload
      // cloud yang belum tahu data ini sudah dihapus. Sama seperti fix
      // untuk users di js/user-management.js — lihat catatan TOMBSTONE
      // TRACKING di shared-utils.js (dekat mergeById) untuk detail.
      if(typeof window.markDeletedTombstone === 'function') window.markDeletedTombstone('karyawan', [delId]);
      if(typeof auditLog === 'function') auditLog('delete', 'karyawan', delId, item?.nama || '');
      renderKaryawan();
      showToast('Karyawan dihapus', 'success');
    }
  });

  // ── Search / filter wiring ──
  ['karyawanSearch', 'karyawanFilterStation'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', renderKaryawan);
    document.getElementById(id)?.addEventListener('change', renderKaryawan);
  });
  document.getElementById('btnKaryawanResetFilter')?.addEventListener('click', () => {
    const s = document.getElementById('karyawanSearch'); if(s) s.value = '';
    const f = document.getElementById('karyawanFilterStation'); if(f) f.value = '';
    renderKaryawan();
  });

  // ── Export Excel ──
  document.getElementById('btnExportKaryawan')?.addEventListener('click', () => {
    if(!window.XLSX){ showToast('XLSX tidak tersedia', 'error'); return; }
    if(!karyawan.length){ showToast('Tidak ada data karyawan', 'error'); return; }
    const allUsersMap = new Map(getUsersList().map(u => [u.username, u]));
    const rows = karyawan.map((k, i) => {
      const u = k.username ? allUsersMap.get(k.username) : null;
      return {
        'No': i + 1, 'Nama': k.nama || '', 'NIP': k.nip || '', 'Jabatan': k.jabatan || '',
        'No Handphone': k.hp || '', 'Email': k.email || '', 'Station': k.station || '',
        'Username': k.username || '', 'Role': u ? u.role : '',
        'Status Akun': u ? (u.active ? 'Aktif' : 'Nonaktif') : ''
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Karyawan');
    XLSX.writeFile(wb, `Data_Karyawan_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Export Excel Data Karyawan berhasil');
  });

  // Render pertama kali jika tab Admin sudah aktif saat modul ini dimuat
  if(document.getElementById('karyawanTableBody')) renderKaryawan();
})();
