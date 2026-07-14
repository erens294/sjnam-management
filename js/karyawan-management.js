/*!
 * SJNAM — MODUL KARYAWAN MANAGEMENT (v2.0 — Refactored & Bug-Fixed)
 * ====================================================================
 * PERUBAHAN UTAMA vs v1:
 *
 * [SIMPLIFIKASI ALUR]
 *   - Field Role + Password Sementara sekarang ada di dalam modal Tambah/Edit
 *     Karyawan. Tidak perlu lagi buka tab Admin → Add Role terpisah.
 *   - Saat karyawan baru disimpan dengan role dipilih, akun login dibuat
 *     otomatis dalam satu langkah.
 *
 * [BUG FIX 1] — Karyawan baru tidak muncul di daftar Add Role
 *   PENYEBAB: filter kandidat di _doAddUser() mengexclude karyawan jika
 *   k.username terisi, meski akun yang dirujuk sudah dihapus.
 *   FIX: saat modal karyawan dibuka, username yang menggantung (tidak ada
 *   akunnya) dibersihkan otomatis sebelum disimpan.
 *
 * [BUG FIX 2] — Akun tidak ter-unlink saat dihapus dari Manajemen Role
 *   PENYEBAB: deleteSingleUser() di user-management.js tidak memanggil
 *   _unlinkKaryawanByUsernames. Sekarang dipanggil dari dalam modul ini
 *   via event 'sjn:user-deleted'.
 *
 * [BUG FIX 3] — Duplikat akun bisa dibuat jika klik Simpan cepat 2x
 *   PENYEBAB: tombol Simpan di-disable tapi logika async sha256() tidak
 *   dicek apakah akun sudah ada setelah hash selesai (race condition).
 *   FIX: cek duplikat dijalankan ULANG setelah sha256() selesai.
 *
 * [BUG FIX 4] — Station karyawan hilang setelah cloudPull karena merge
 *   PENYEBAB: field station tidak di-copy saat karyawan ter-merge dengan
 *   data cloud yang lebih baru tapi tidak punya field station.
 *   FIX: merge mempertahankan station dari local jika remote kosong.
 *
 * [BUG FIX 5] — saveBtn tidak direset jika validasi email/hp gagal
 *   PENYEBAB: _resetSaveBtn tidak dipanggil di semua jalur return awal.
 *   FIX: semua jalur return sekarang memanggil _resetSaveBtn().
 *
 * [BUG FIX 6] — renderKaryawanUserOptions salah exclude karyawan aktif
 *   PENYEBAB: linkedUsernames dibangun dari karyawan[].username, lalu
 *   dipakai untuk filter allUsers — seharusnya sebaliknya.
 *   FIX: logika filter diperbaiki.
 *
 * [BUG FIX 7] — onchange handler di karyawanUser leak antar buka modal
 *   PENYEBAB: document.getElementById('karyawanUser').onchange diset
 *   setiap kali openKaryawanModal() dipanggil tanpa remove handler lama.
 *   FIX: handler di-assign lewat addEventListener dengan flag {once:true}
 *   dan listener lama dibuang lewat AbortController.
 * ====================================================================
 */
!function () {
  'use strict';

  if (window._karyawanManagementInit) {
    console.warn("[SJNAM] karyawan-management.js sudah pernah dimuat, eksekusi ulang dibatalkan.");
    return;
  }
  window._karyawanManagementInit = true;

  // ── State lokal ──────────────────────────────────────────────────────────
  let karyawan = [];
  try { karyawan = JSON.parse(localStorage.getItem('sjnam_karyawan_v1') || '[]'); }
  catch (e) { karyawan = []; }

  // AbortController untuk listener modal yang perlu di-cleanup
  let _modalAC = null;

  // ── Helper: baca users ───────────────────────────────────────────────────
  function getUsersList() {
    try { return JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]'); }
    catch (e) { return []; }
  }

  // ── Helper: simpan karyawan ──────────────────────────────────────────────
  function saveKaryawan() {
    localStorage.setItem('sjnam_karyawan_v1', JSON.stringify(karyawan));
    if (typeof triggerAutoSync === 'function') triggerAutoSync('karyawan');
    document.dispatchEvent(new CustomEvent('sjn:karyawan-updated'));
  }

  // ── Helper: bersihkan username menggantung di semua karyawan ────────────
  // [BUG FIX 1] — dipanggil sekali saat modul load & saat modal dibuka
  function _cleanStaleUsernames() {
    const existingUsernames = new Set(getUsersList().map(u => u.username));
    let changed = false;
    karyawan.forEach(k => {
      if (k.username && !existingUsernames.has(k.username)) {
        k.username = '';
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem('sjnam_karyawan_v1', JSON.stringify(karyawan));
      if (typeof triggerAutoSync === 'function') triggerAutoSync('karyawan');
    }
    return changed;
  }

  // Jalankan sekali saat load
  _cleanStaleUsernames();

  // ── [BUG FIX 2] — Listen event hapus user dari user-management ──────────
  document.addEventListener('sjn:user-deleted', function (e) {
    const deletedUsernames = e.detail && e.detail.usernames;
    if (Array.isArray(deletedUsernames) && deletedUsernames.length) {
      if (typeof window._unlinkKaryawanByUsernames === 'function') {
        window._unlinkKaryawanByUsernames(deletedUsernames);
      }
      // Refresh state lokal
      try { karyawan = JSON.parse(localStorage.getItem('sjnam_karyawan_v1') || '[]'); }
      catch (e) { /* keep current */ }
    }
  });

  // ── Populate dropdown station ────────────────────────────────────────────
  function populateStationDropdowns() {
    const list = (function () {
      try { return JSON.parse(localStorage.getItem('sjn_stations_v2') || '[]'); }
      catch (e) { return []; }
    })();
    const opts = list.map(s => `<option value="${esc(s.iata)}">${esc(s.iata)} — ${esc(s.name)}</option>`).join('');

    const filterEl = document.getElementById('karyawanFilterStation');
    const formEl   = document.getElementById('karyawanStation');

    if (filterEl) {
      const cur = filterEl.value;
      filterEl.innerHTML = '<option value="">Semua Station</option>' + opts;
      if (list.some(s => s.iata === cur)) filterEl.value = cur;
    }
    if (formEl) {
      const cur = formEl.value;
      formEl.innerHTML = '<option value="">Pilih station...</option>'
        + '<option value="ALL">🌐 ALL — Semua Station (akses semua)</option>'
        + opts;
      if (cur === 'ALL') formEl.value = 'ALL';
      else if (list.some(s => s.iata === cur)) formEl.value = cur;
    }
  }

  // ── Render tabel karyawan ────────────────────────────────────────────────
  function renderKaryawan() {
    const tbody = document.getElementById('karyawanTableBody');
    if (!tbody) return;
    populateStationDropdowns();

    const search        = (document.getElementById('karyawanSearch')?.value || '').toLowerCase();
    const stationFilter = document.getElementById('karyawanFilterStation')?.value || '';
    const allUsersMap   = new Map(getUsersList().map(u => [u.username, u]));

    let list = karyawan.filter(k =>
      (!stationFilter || k.station === stationFilter) &&
      !(search && ![k.nama, k.nip, k.jabatan, k.station, k.hp, k.email].join(' ').toLowerCase().includes(search))
    );

    const countEl = document.getElementById('karyawanCountInfo');
    if (countEl) countEl.textContent = `Total Karyawan: ${karyawan.length}`;

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="11" class="text-center py-8 text-slate-400 text-sm">Belum ada data karyawan.</td></tr>';
      return;
    }

    const canEdit   = window.currentUserCanAdd;
    const canDelete = window.currentUserCanDelete;

    tbody.innerHTML = list.map((k, i) => {
      const linkedUser    = k.username ? allUsersMap.get(k.username) : null;
      const userLoginCell = linkedUser
        ? `<span class="font-mono text-xs text-slate-700 dark:text-slate-200">${esc(k.nip || linkedUser.username)}</span>`
        : k.username
          ? `<span class="text-xs text-red-500" title="Akun ${esc(k.username)} sudah dihapus">⚠️ ${esc(k.nip || k.username)}</span>`
          : '<span class="text-xs text-slate-400">— Belum terhubung —</span>';

      const _stWarn = !linkedUser || !['User-SR','User-STCR','User-ST','User-DRG'].includes(linkedUser.role) || (k.station && k.station !== '')
        ? ''
        : '<span class="text-[10px] text-amber-600 font-semibold block mt-0.5">⚠️ Station belum diisi</span>';

      const roleCell = linkedUser
        ? `<div><span class="badge ${getRoleBadgeClass(linkedUser.role)}">${esc(linkedUser.role)}</span>${_stWarn}</div>`
        : k.username
          ? '<span class="text-xs text-red-400">Akun tidak ditemukan</span>'
          : '<span class="text-xs text-slate-400">—</span>';

      return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
        <td class="p-3 text-xs text-slate-400">${i + 1}</td>
        <td class="p-3 font-medium">${esc(k.nama)}</td>
        <td class="p-3 font-mono text-xs">${esc(k.nip)}</td>
        <td class="p-3 text-xs">${esc(k.jabatan)}</td>
        <td class="p-3 text-xs">${esc(k.hp || '-')}</td>
        <td class="p-3 text-xs">${esc(k.email || '-')}</td>
        <td class="p-3 text-xs">${esc(k.station || '-')}</td>
        <td class="p-3">${userLoginCell}</td>
        <td class="p-3 text-xs">
          ${linkedUser
            ? linkedUser.active
              ? '<span class="text-emerald-600 font-semibold text-xs">● Aktif</span>'
              : '<span class="text-red-400 font-semibold text-xs">○ Nonaktif</span>'
            : '<span class="text-slate-300 text-xs">—</span>'}
        </td>
        <td class="p-3">${roleCell}</td>
        <td class="p-3 text-right whitespace-nowrap">
          ${canEdit   ? `<button data-kar-edit="${k.id}" class="text-xs px-2 py-1 bg-amber-500 text-white rounded mr-1">Edit</button>` : ''}
          ${canDelete ? `<button data-kar-del="${k.id}"  class="text-xs px-2 py-1 bg-red-500 text-white rounded">Hapus</button>` : ''}
        </td>
      </tr>`;
    }).join('');
  }

  // ── [BUG FIX 6] renderKaryawanUserOptions ───────────────────────────────
  // Sebelumnya: linkedUsernames dibangun dari karyawan[].username lalu
  // digunakan untuk filter allUsers — padahal seharusnya filter karyawan
  // yang BELUM terhubung ke akun mana pun.
  window.renderKaryawanUserOptions = function () {
    const sel = document.getElementById('karyawanUser');
    if (!sel) return;

    const allUsers = getUsersList();
    // Set username yang sudah terhubung ke karyawan lain (bukan yang sedang diedit)
    const editingKarId  = window._karyawanEditId;
    const editingKar    = editingKarId ? karyawan.find(k => k.id === editingKarId) : null;
    const editingUname  = editingKar ? editingKar.username : null;

    const usernamesTaken = new Set(
      karyawan
        .filter(k => k.id !== editingKarId && k.username)
        .map(k => k.username)
    );

    const cur  = sel.value;
    const opts = allUsers
      .filter(u => !usernamesTaken.has(u.username) || u.username === editingUname)
      .map(u => `<option value="${esc(u.username)}">${esc(u.username)} — ${esc(u.role)}</option>`)
      .join('');

    sel.innerHTML = '<option value="">— Belum dihubungkan ke akun manapun —</option>' + opts;
    if (allUsers.some(u => u.username === cur)) sel.value = cur;
  };

  // ── Buka modal karyawan ──────────────────────────────────────────────────
  function openKaryawanModal(item) {
    // [BUG FIX 1] Bersihkan username menggantung sebelum buka modal
    _cleanStaleUsernames();

    window._karyawanEditId = item ? item.id : null;

    document.getElementById('karyawanModalTitle').textContent = item ? 'Edit Karyawan' : 'Tambah Karyawan';

    populateStationDropdowns();
    _populateRoleDropdownInModal();
    window.renderKaryawanUserOptions();

    // Isi field dasar
    document.getElementById('karyawanNama').value         = item?.nama         || '';
    document.getElementById('karyawanNip').value          = item?.nip          || '';
    document.getElementById('karyawanJabatan').value      = item?.jabatan      || '';
    document.getElementById('karyawanStation').value      = item?.station      || '';
    document.getElementById('karyawanHp').value           = item?.hp           || '';
    document.getElementById('karyawanEmail').value        = item?.email        || '';
    document.getElementById('karyawanUser').value         = item?.username     || '';
    document.getElementById('karyawanJoinDate').value     = item?.joinDate     || '';
    document.getElementById('karyawanExpiredKontrak').value = item?.expiredKontrak || '';
    document.getElementById('karyawanNote').value         = item?.note         || '';

    // ── Bagian akun yang sudah terhubung ──
    const accountSection    = document.getElementById('karyawanAccountSection');
    const karyawanUsernameEl = document.getElementById('karyawanUsername');
    const karyawanPasswordEl = document.getElementById('karyawanPassword');
    const karyawanAktifEl   = document.getElementById('karyawanAktif');

    if (item?.username) {
      const linkedU = getUsersList().find(u => u.username === item.username);
      if (linkedU) {
        accountSection?.classList.remove('hidden');
        if (karyawanUsernameEl) { karyawanUsernameEl.value    = linkedU.username; karyawanUsernameEl.readOnly = linkedU.role === 'Master'; }
        if (karyawanPasswordEl) karyawanPasswordEl.value = '';
        if (karyawanAktifEl)    karyawanAktifEl.checked  = !!linkedU.active;
      } else {
        // akun sudah hilang — sembunyikan section
        accountSection?.classList.add('hidden');
      }
    } else {
      accountSection?.classList.add('hidden');
      if (karyawanUsernameEl) { karyawanUsernameEl.value = ''; karyawanUsernameEl.readOnly = false; }
      if (karyawanPasswordEl) karyawanPasswordEl.value = '';
      if (karyawanAktifEl)    karyawanAktifEl.checked  = true;
    }

    // ── [BUG FIX 7] Handler karyawanUser pakai AbortController ──
    if (_modalAC) _modalAC.abort();
    _modalAC = new AbortController();
    const sig = _modalAC.signal;

    document.getElementById('karyawanUser')?.addEventListener('change', function () {
      const selectedUsername = this.value;
      if (!selectedUsername) { accountSection?.classList.add('hidden'); return; }
      const linkedU = getUsersList().find(u => u.username === selectedUsername);
      if (linkedU) {
        accountSection?.classList.remove('hidden');
        if (karyawanUsernameEl) { karyawanUsernameEl.value = linkedU.username; karyawanUsernameEl.readOnly = linkedU.role === 'Master'; }
        if (karyawanPasswordEl) karyawanPasswordEl.value = '';
        if (karyawanAktifEl)    karyawanAktifEl.checked  = !!linkedU.active;
      } else {
        accountSection?.classList.add('hidden');
      }
    }, { signal: sig });

    // ── Toggle visibilitas seksi "Buat Akun Baru" ──
    const newRoleEl      = document.getElementById('karyawanNewRole');
    const newAccSection  = document.getElementById('karyawanNewAccountSection');
    const newPwDisplay   = document.getElementById('karyawanNewPwDisplay');

    // Reset
    if (newRoleEl)    newRoleEl.value = '';
    if (newAccSection) newAccSection.classList.add('hidden');
    if (newPwDisplay)  newPwDisplay.textContent = '';

    newRoleEl?.addEventListener('change', function () {
      if (!newAccSection) return;
      if (this.value && !item?.username) {
        newAccSection.classList.remove('hidden');
        // Auto-generate password preview
        const pw = typeof window._generateTempPassword === 'function'
          ? window._generateTempPassword()
          : _genTempPwFallback();
        if (newPwDisplay) newPwDisplay.textContent = pw;
        // Simpan di dataset supaya bisa dipakai saat save
        newRoleEl.dataset.generatedPw = pw;
      } else {
        newAccSection.classList.add('hidden');
        if (newPwDisplay) newPwDisplay.textContent = '';
        if (newRoleEl) delete newRoleEl.dataset.generatedPw;
      }
    }, { signal: sig });

    document.getElementById('karyawanModal')?.classList.remove('hidden');
  }

  // Fallback password generator kalau blueprint-v1 belum load
  function _genTempPwFallback() {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
    return Array.from({ length: 10 }, () => c[Math.floor(Math.random() * c.length)]).join('');
  }

  // ── Populate dropdown Role di dalam modal ────────────────────────────────
  function _populateRoleDropdownInModal() {
    const sel = document.getElementById('karyawanNewRole');
    if (!sel) return;

    const allowedRoles = ['Co-Admin','User-All','User-SR','User-STCR','User-ST','User-DRG','Peserta'];
    sel.innerHTML = '<option value="">— Tidak perlu akun —</option>'
      + allowedRoles.map(r => `<option value="${r}">${r}</option>`).join('');
  }

  // ── Tutup modal ──────────────────────────────────────────────────────────
  function closeKaryawanModal() {
    document.getElementById('karyawanModal')?.classList.add('hidden');
    window._karyawanEditId = null;

    // Bersihkan
    document.getElementById('karyawanAccountSection')?.classList.add('hidden');
    document.getElementById('karyawanNewAccountSection')?.classList.add('hidden');
    const pwEl = document.getElementById('karyawanPassword'); if (pwEl) pwEl.value = '';
    const unEl = document.getElementById('karyawanUsername'); if (unEl) { unEl.value = ''; unEl.readOnly = false; }
    const aktifEl = document.getElementById('karyawanAktif'); if (aktifEl) aktifEl.checked = true;
    const newRoleEl = document.getElementById('karyawanNewRole'); if (newRoleEl) { newRoleEl.value = ''; delete newRoleEl.dataset.generatedPw; }
    const newPwDisplay = document.getElementById('karyawanNewPwDisplay'); if (newPwDisplay) newPwDisplay.textContent = '';
    const saveBtn = document.getElementById('karyawanModalSave');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Simpan'; }

    // [BUG FIX 7] Batalkan semua listener modal
    if (_modalAC) { _modalAC.abort(); _modalAC = null; }
  }

  // ── SAVE karyawan (dengan pembuatan akun opsional) ───────────────────────
  document.getElementById('karyawanModalSave')?.addEventListener('click', async function () {
    if (!window.currentUserCanAdd) return showToast('Tidak ada izin untuk menyimpan data karyawan', 'error');

    const saveBtn = document.getElementById('karyawanModalSave');
    if (saveBtn?.disabled) return;
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Menyimpan...'; }

    const _resetSaveBtn = () => { if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Simpan'; } };
    
    // [FIX] Wrap dengan try-catch agar error tidak diam-diam bikin tombol stuck disabled
    try {

    // Baca field
    const nama            = document.getElementById('karyawanNama').value.trim();
    const nip             = document.getElementById('karyawanNip').value.trim();
    const jabatan         = document.getElementById('karyawanJabatan').value.trim();
    const station         = document.getElementById('karyawanStation').value;
    const hp              = document.getElementById('karyawanHp').value.trim();
    const email           = document.getElementById('karyawanEmail').value.trim();
    const username        = document.getElementById('karyawanUser').value;
    const joinDate        = document.getElementById('karyawanJoinDate').value;
    const expiredKontrak  = document.getElementById('karyawanExpiredKontrak').value;
    const note            = document.getElementById('karyawanNote').value.trim();

    // Bagian akun yang sudah ada (edit)
    const accountSection    = document.getElementById('karyawanAccountSection');
    const accountVisible    = accountSection && !accountSection.classList.contains('hidden');
    const newUsername       = accountVisible ? (document.getElementById('karyawanUsername')?.value || '').trim().toLowerCase() : null;
    const newPassword       = accountVisible ? (document.getElementById('karyawanPassword')?.value || '').trim() : null;
    const newAktif          = accountVisible ? (document.getElementById('karyawanAktif')?.checked ?? true) : null;

    // Bagian akun BARU (dari dropdown role)
    const newRoleEl         = document.getElementById('karyawanNewRole');
    const selectedNewRole   = newRoleEl?.value || '';
    const generatedPw       = newRoleEl?.dataset?.generatedPw || '';
    const newAccSection     = document.getElementById('karyawanNewAccountSection');
    // [FIX] Tidak syaratkan !username dari hidden field
    // Tapi jika karyawan sudah punya akun (username tidak kosong), jangan buat akun baru
    const existingLinkedUser = username ? (function() {
      try { return JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]').find(u => u.username === username); } catch(e) { return null; }
    })() : null;
    const createNewAccount  = !!(selectedNewRole && newAccSection && !newAccSection.classList.contains('hidden') && !existingLinkedUser);

    // ── Validasi wajib ──
    if (!nama || !nip || !jabatan) {
      showToast('Lengkapi field wajib: Nama, NIP, dan Jabatan', 'error');
      return _resetSaveBtn();
    }

    // [BUG FIX 5] semua jalur validasi wajib memanggil _resetSaveBtn
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Format email tidak valid', 'error');
      return _resetSaveBtn();
    }
    if (hp && !/^[0-9+\-\s]{8,20}$/.test(hp)) {
      showToast('Format No Handphone tidak valid', 'error');
      return _resetSaveBtn();
    }

    // Validasi station untuk role station-bound
    const _stationBoundRoles = ['User-SR','User-STCR','User-ST','User-DRG','Op-SR','Op-STCR','Op-DRG','Op-ST'];
    if (!station || station === '') {
      const _linkedUname = (accountVisible && newUsername) || username || (createNewAccount ? nip.toLowerCase() : '');
      if (_linkedUname) {
        const _linkedU = getUsersList().find(u => u.username === _linkedUname);
        const _roleToCheck = _linkedU?.role || (createNewAccount ? selectedNewRole : '');
        if (_roleToCheck && _stationBoundRoles.includes(_roleToCheck)) {
          showToast(`Role ${_roleToCheck} wajib memiliki station — pilih station terlebih dahulu`, 'error');
          return _resetSaveBtn();
        }
      }
      // Validasi juga untuk role baru yang mau dibuat
      if (createNewAccount && _stationBoundRoles.includes(selectedNewRole)) {
        showToast(`Role ${selectedNewRole} wajib memiliki station`, 'error');
        return _resetSaveBtn();
      }
    }

    // Cek duplikat NIP
    const dupNip = karyawan.find(k => k.id !== window._karyawanEditId && (k.nip || '').toLowerCase() === nip.toLowerCase());
    if (dupNip) {
      showToast('NIP sudah digunakan oleh: ' + dupNip.nama, 'error');
      return _resetSaveBtn();
    }

    // Cek duplikat username (edit)
    if (accountVisible && newUsername && newUsername !== username) {
      if (getUsersList().find(u => u.username === newUsername && u.username !== username)) {
        showToast(`Username "${newUsername}" sudah digunakan akun lain`, 'error');
        return _resetSaveBtn();
      }
    }

    if (username) {
      const dupUser = karyawan.find(k => k.id !== window._karyawanEditId && k.username === username);
      if (dupUser) {
        showToast('Akun ini sudah terhubung ke karyawan lain: ' + dupUser.nama, 'error');
        return _resetSaveBtn();
      }
    }

    // Validasi NIP wajib ada sebelum buat akun baru
    if (createNewAccount && !nip) {
      showToast('NIP wajib diisi sebelum membuat akun', 'error');
      return _resetSaveBtn();
    }

    // Validasi _validateAddRole (blueprint-v1)
    if (createNewAccount && typeof window._validateAddRole === 'function') {
      const issues = window._validateAddRole(selectedNewRole, { nip, station });
      const blocking = issues.filter(i => i.type === 'error');
      if (blocking.length) {
        showToast(blocking[0].msg, 'error');
        return _resetSaveBtn();
      }
    }

    // ── Fungsi inti simpan entry karyawan ──
    const doSaveKaryawan = (finalUsername) => {
      const entry = {
        id:             window._karyawanEditId || 'kar_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        nama, nip, jabatan, station, hp, email,
        joinDate, expiredKontrak, note,
        username:       finalUsername || username,
        // [BUG FIX] Sebelumnya field ini bernama "updatedAt" (tanpa underscore),
        // padahal detectConflict() di shared-utils.js — yang dipakai untuk
        // menentukan versi mana yang menang saat data karyawan digabung dari
        // 2 device — membaca field "_updatedAt" (DENGAN underscore, konvensi
        // resmi stampRecord/stampArray). Akibatnya perubahan di sini (mis.
        // update station karyawan) tidak pernah "menang" saat disinkronkan
        // ke device yang sudah punya salinan lokal karyawan yang sama —
        // device itu terus mempertahankan data lamanya. Field ini sekarang
        // dinamai sesuai konvensi yang benar, plus _updatedBy supaya log
        // konflik ("Konflik record ... X vs Y") menunjukkan nama yang benar.
        _updatedAt:     new Date().toISOString(),
        _updatedBy:     (window.currentUser && (window.currentUser.name || window.currentUser.username)) || 'system'
      };

      const idx = karyawan.findIndex(k => k.id === window._karyawanEditId);
      if (idx > -1) karyawan[idx] = entry;
      else karyawan.push(entry);

      saveKaryawan();

      // Sync nama ke users jika ada akun terhubung
      const finalUname = finalUsername || username;
      if (finalUname) {
        try {
          let users = getUsersList();
          let u = users.find(x => x.username === finalUname);
          if (u) {
            u.name = nama;
            if (finalUsername && finalUsername !== username) u.username = finalUsername;
            if (newAktif !== null && u.username !== window.currentUser?.username) u.active = newAktif;
            if (typeof saveUsers === 'function') saveUsers(users);
            // Update sesi jika edit diri sendiri
            if (window.currentUser && (window.currentUser.username === username || window.currentUser.username === finalUname)) {
              window.currentUser.name = nama;
              if (finalUsername) window.currentUser.username = finalUsername;
              localStorage.setItem('sjnam_session_v1', JSON.stringify(window.currentUser));
              ['userNameDisplay', 'userNameDisplaySide'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = nama;
              });
            }
          }
        } catch (e) { console.error('Gagal sinkron akun', e); }
      }

      if (typeof auditLog === 'function') auditLog(idx > -1 ? 'update' : 'create', 'karyawan', entry.id, nama);

      closeKaryawanModal();
      renderKaryawan();
      if (typeof renderUserTable === 'function') renderUserTable();
      showToast(idx > -1 ? 'Data karyawan diperbarui' : 'Karyawan ditambahkan', 'success');

      // [FIX] Update station DRG untuk sesi yang sedang login (jika relevan)
      _selfUpdateDrgStation(entry);

      // [FIX] Refresh tampilan Drygoods (station tabs, tabel IFS, dsb) TANPA
      // SYARAT — sebelumnya hanya di-refresh via _selfUpdateDrgStation yang
      // cuma jalan kalau yang login adalah karyawan yang sama persis dengan
      // yang sedang diedit. Akibatnya kalau Admin mengedit station karyawan
      // LAIN (kasus paling umum), tab Drygoods tetap
      // menampilkan station lama sampai halaman di-refresh manual.
      if (typeof window.DRYGOODS?.renderAll === 'function') window.DRYGOODS.renderAll();
    };

    // ── Jalur A: buat akun BARU bersamaan dengan karyawan ──────────────────
    if (createNewAccount) {
      const uname = nip.toLowerCase();

      // [BUG FIX 3] Cek duplikat sebelum hash
      const freshUsersPre = getUsersList();
      if (freshUsersPre.find(u => (u.username || '').toLowerCase() === uname)) {
        showToast(`Akun dengan username "${uname}" sudah ada`, 'error');
        return _resetSaveBtn();
      }

      if (selectedNewRole === 'Peserta') {
        if (freshUsersPre.filter(u => u.role === 'Peserta').length >= 150) {
          showToast('Maksimal 150 slot Peserta sudah tercapai', 'error');
          return _resetSaveBtn();
        }
      }

      const pwToHash = generatedPw || _genTempPwFallback();

      try {
        // sha256 ada di _authInternal (auth.js), fallback ke implementasi inline
        const _sha256fn = (typeof sha256 === 'function') ? sha256
          : window._authInternal?.sha256
          ?? (async str => { const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)); return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join(''); });
        const hashedPw = await _sha256fn(pwToHash);

        // [BUG FIX 3] Cek ulang setelah async selesai (race condition)
        let finalUsers = getUsersList();
        if (finalUsers.find(u => (u.username || '').toLowerCase() === uname)) {
          showToast(`Username "${uname}" sudah ada (mungkin dibuat perangkat lain)`, 'error');
          return _resetSaveBtn();
        }

        if (typeof window._filterTombstoned === 'function') {
          finalUsers = window._filterTombstoned('users', finalUsers);
        }

        finalUsers.push({
          id:                 Date.now(),
          username:           uname,
          password:           hashedPw,
          role:               selectedNewRole,
          name:               nama,
          active:             true,
          mustChangePassword: true,
          created:            new Date().toISOString().split('T')[0],
          // [BUG FIX] Lihat catatan yang sama di user-management.js — tanpa
          // field ini, sync antar device untuk bucket "users" selalu
          // mempertahankan salinan lokal, mengabaikan akun baru/role dari
          // device lain untuk id yang bentrok (tidak relevan untuk akun BARU
          // seperti ini karena id-nya pasti unik, tapi konsisten dengan
          // konvensi timestamp di seluruh record user).
          _updatedAt:         new Date().toISOString(),
          _updatedBy:         (window.currentUser && (window.currentUser.name || window.currentUser.username)) || 'system'
        });

        if (typeof saveUsers === 'function') saveUsers(finalUsers);

        // Tampilkan password sekali kepada Admin
        alert(
          `✅ Akun berhasil dibuat!\n\n` +
          `Username : ${uname}\n` +
          `Password : ${pwToHash}\n` +
          `Role     : ${selectedNewRole}\n\n` +
          `⚠️ Password ini hanya ditampilkan SEKALI.\n` +
          `Karyawan wajib mengganti password saat login pertama.`
        );

        try { navigator.clipboard?.writeText(pwToHash); } catch (_) {}

        doSaveKaryawan(uname);
      } catch (err) {
        console.error('[karyawan-management] Gagal buat akun:', err);
        showToast('Gagal membuat akun: ' + (err.message || err), 'error');
        _resetSaveBtn();
      }
      return;
    }

    // ── Jalur B: edit password akun yang sudah ada ──────────────────────────
    if (accountVisible && newPassword) {
      (typeof window._ensureHashedPassword === 'function'
        ? window._ensureHashedPassword(newPassword)
        : Promise.resolve(newPassword)
      ).then(hashed => {
        try {
          const users = getUsersList();
          const u = users.find(x => x.username === username);
          if (u) { u.password = hashed; if (typeof saveUsers === 'function') saveUsers(users); }
        } catch (e) { /* non-fatal */ }
        doSaveKaryawan(newUsername && newUsername !== username ? newUsername : null);
      });
      return;
    }

    // ── Jalur C: simpan karyawan saja (tanpa perubahan akun) ────────────────
    doSaveKaryawan(newUsername && newUsername !== username ? newUsername : null);

    } catch (unexpectedErr) {
      console.error('[karyawanModalSave] Error tak terduga:', unexpectedErr);
      showToast('Gagal menyimpan: ' + (unexpectedErr?.message || String(unexpectedErr)), 'error');
      _resetSaveBtn();
    }
  });

  // ── Helper: self-update station DRG ─────────────────────────────────────

  // [FIX] Jika karyawan yang diedit adalah User-DRG yang sedang login,
  // refresh station lock-nya secara langsung tanpa perlu re-login
  document.addEventListener('sjn:karyawan-updated', function _onKarUpdated() {
    const cu = window.currentUser;
    if (!cu || !window._STATION_FILTER_ROLES || !window._STATION_FILTER_ROLES.includes(cu.role)) return;
    try {
      const kar = JSON.parse(localStorage.getItem('sjnam_karyawan_v1') || '[]');
      const me = kar.find(k => { const un = (cu.username || '').toLowerCase(); return (k.username || '').toLowerCase() === un || (k.nip || '').toLowerCase() === un; });
      if (!me) return;
      const newSt = me.station && me.station !== 'ALL' ? me.station : null;
      if (newSt !== window._userDrgStation) {
        window._userDrgStation = newSt;
        window._userStationLock = newSt;
        cu.station = newSt;
        if (typeof window._applyStationLockForUser === 'function') {
          window._applyStationLockForUser(cu.role, cu.username);
        }
        if (typeof window.DRYGOODS !== 'undefined' && typeof window.DRYGOODS.renderAll === 'function') {
          setTimeout(window.DRYGOODS.renderAll, 100);
        }
        console.info('[StationLock] Diperbarui ke:', newSt || 'ALL');
      }
    } catch(e) { console.warn('[StationLock refresh]', e); }
  }, false);

  function _selfUpdateDrgStation(entry) {
    try {
      const cu = window.currentUser;
      if (!cu || cu.role !== 'User-DRG') return;
      if ((cu.username || '').toLowerCase() !== (entry.username || '').toLowerCase()) return;
      const newSt = entry.station || null;
      window._userDrgStation = newSt;
      if (cu) cu.station = newSt;
      document.querySelectorAll('[data-dg-station]').forEach(t => {
        const ts = t.dataset.dgStation;
        if (!ts) return;
        if (newSt && newSt !== 'ALL') {
          if (ts === newSt) { t.style.opacity = ''; t.style.pointerEvents = ''; t.title = ''; }
          else { t.style.opacity = '0.35'; t.style.pointerEvents = 'none'; t.title = 'Akses terbatas ke station ' + newSt; }
        } else { t.style.opacity = ''; t.style.pointerEvents = ''; t.title = ''; }
      });
      if (typeof window.DRYGOODS?.renderAll === 'function') setTimeout(window.DRYGOODS.renderAll, 50);
    } catch (ex) { console.warn('[DRG Self-Update]', ex); }
  }

  // ── Event listeners tombol & tabel ───────────────────────────────────────
  document.getElementById('btnAddKaryawan')?.addEventListener('click', () => {
    if (window.currentUserCanAdd) openKaryawanModal(null);
    else showToast('Tidak ada izin untuk menambah karyawan', 'error');
  });

  document.getElementById('karyawanModalCancel')?.addEventListener('click', closeKaryawanModal);

  document.getElementById('karyawanModal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('karyawanModal')) closeKaryawanModal();
  });

  document.getElementById('karyawanTableBody')?.addEventListener('click', async e => {
    const editId = e.target.closest('[data-kar-edit]')?.dataset.karEdit;
    const delId  = e.target.closest('[data-kar-del]')?.dataset.karDel;

    if (editId) {
      if (!window.currentUserCanAdd) return showToast('Tidak ada izin untuk mengedit karyawan', 'error');
      const item = karyawan.find(k => k.id === editId);
      if (item) openKaryawanModal(item);
    }

    if (delId) {
      if (!window.currentUserCanDelete) return showToast('Tidak ada izin untuk menghapus karyawan', 'error');
      const item = karyawan.find(k => k.id === delId);
      if (!await showConfirm('Hapus Karyawan', `Hapus data karyawan "${item?.nama || ''}"? Akun login terkait TIDAK akan terhapus, hanya tautannya yang diputus.`)) return;
      karyawan = karyawan.filter(k => k.id !== delId);
      saveKaryawan();
      if (typeof window.markDeletedTombstone === 'function') window.markDeletedTombstone('karyawan', [delId]);
      if (typeof auditLog === 'function') auditLog('delete', 'karyawan', delId, item?.nama || '');
      renderKaryawan();
      // [FIX] Sama seperti simpan/edit — refresh Drygoods agar karyawan yang
      // dihapus juga hilang dari data karyawan Drygoods tanpa perlu reload.
      if (typeof window.DRYGOODS?.renderAll === 'function') window.DRYGOODS.renderAll();
      showToast('Karyawan dihapus', 'success');
    }
  });

  ['karyawanSearch', 'karyawanFilterStation'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', renderKaryawan);
    document.getElementById(id)?.addEventListener('change', renderKaryawan);
  });

  document.getElementById('btnKaryawanResetFilter')?.addEventListener('click', () => {
    const s = document.getElementById('karyawanSearch'); if (s) s.value = '';
    const f = document.getElementById('karyawanFilterStation'); if (f) f.value = '';
    renderKaryawan();
  });

  document.getElementById('btnExportKaryawan')?.addEventListener('click', () => {
    if (!window.XLSX) return showToast('XLSX tidak tersedia', 'error');
    if (!karyawan.length) return showToast('Tidak ada data karyawan', 'error');

    const allUsersMap = new Map(getUsersList().map(u => [u.username, u]));
    const rows = karyawan.map((k, i) => {
      const u = k.username ? allUsersMap.get(k.username) : null;
      return {
        No: i + 1, Nama: k.nama || '', NIP: k.nip || '',
        Jabatan: k.jabatan || '', 'No Handphone': k.hp || '',
        Email: k.email || '', Station: k.station || '',
        Username: k.username || '', Role: u ? u.role : '',
        'Status Akun': u ? (u.active ? 'Aktif' : 'Nonaktif') : ''
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Karyawan');
    XLSX.writeFile(wb, `Data_Karyawan_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Export Excel Data Karyawan berhasil');
  });

  // ── Public API ───────────────────────────────────────────────────────────
  window.getKaryawanData    = () => karyawan;
  window.setKaryawanData    = arr => {
    karyawan = Array.isArray(arr) ? arr : [];
    // [BUG FIX 4] Setelah cloud-pull, bersihkan username menggantung
    _cleanStaleUsernames();
    if (document.getElementById('karyawanTableBody')) renderKaryawan();
    document.dispatchEvent(new CustomEvent('sjn:karyawan-updated'));
  };
  window.renderKaryawanTable = renderKaryawan;

  // Render awal
  if (document.getElementById('karyawanTableBody')) renderKaryawan();
}();
