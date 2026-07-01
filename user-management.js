/* ================================================================
   SJNAM — MODUL USER MANAGEMENT
   ================================================================
   Render tabel user (Tab Admin → sub-tab Manajemen Role): search,
   filter, bulk select/aktivasi/hapus, edit role per user, badge
   warna per role, tambah user baru.

   ⚠️ CATATAN PEMULIHAN PENTING: modul ini sebelumnya HILANG TOTAL
   dari hasil refactor — tidak sengaja terhapus saat ekstraksi
   js/auth.js di Tahap 1, karena posisinya bersebelahan dengan blok
   auth yang diekstrak saat itu dan tidak dikenali sebagai
   fungsionalitas terpisah yang masih dibutuhkan (mirip kesalahan
   yang ditemukan untuk window.switchTab di Tahap 1b, tapi modul ini
   baru ketahuan jauh kemudian karena SETIAP titik pemanggilannya
   sudah di-guard dengan `typeof renderUserTable === 'function'` —
   jadi tidak pernah melempar error, hanya diam-diam tidak pernah
   menggambar apa pun). Dipulihkan dari index.html ASLI yang
   diunggah pengguna, BUKAN dari hasil refactor manapun. Lihat
   REFACTOR_NOTES.md bagian "Tahap 8" untuk kronologi lengkap.

   PERBAIKAN YANG DITERAPKAN SAAT PEMULIHAN (bukan ada di asli):
   - Semua referensi `currentUser` bare diubah jadi `window.currentUser`
     (di source asli, kode ini berbagi closure yang sama dengan
     deklarasi `let currentUser` — sekarang jadi file terpisah, jadi
     WAJIB akses lewat window agar tidak ReferenceError).
   - Semua referensi `USERS_KEY` bare diubah jadi literal string
     'sjnam_users_v1' (konstanta ini private di dalam IIFE js/auth.js,
     tidak bisa diakses dari file lain).

   Struktur asli di index.html TIDAK berurutan rapi — kode modul ini
   sebenarnya tersebar di 2 bagian terpisah, diselingi oleh "MODUL
   DATA KARYAWAN" (sekarang js/karyawan-management.js) di tengahnya.
   Kedua bagian sudah digabung jadi satu file koheren di sini.
   ================================================================ */

// ============================================================
// MANAJEMEN USER — renderUserTable, bulk select, edit modal, delete
// ============================================================
// State untuk checkbox selection
window._userSelectedIds = new Set();

function _getUserDisplayList(){
  const allUsers = JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]');
  if(!window.currentUser) return { displayUsers: [], allUsers };
  let displayUsers = allUsers;
  const role = window.currentUser.role;
  const isMasterOrAdmin = role === 'Master' || role === 'Admin';
  if(role === 'Co-Admin'){
    displayUsers = allUsers.filter(u =>
      u.role !== 'Admin' && u.role !== 'Master' &&
      !(u.role === 'Co-Admin' && u.username !== window.currentUser.username)
    );
  } else if(!isMasterOrAdmin){
    displayUsers = [];
  }
  // Apply search filter
  const search = (document.getElementById('userSearchInput')?.value || '').toLowerCase();
  const filterRole = document.getElementById('userFilterRole')?.value || '';
  const filterStatus = document.getElementById('userFilterStatus')?.value || '';
  if(search) displayUsers = displayUsers.filter(u =>
    (u.username||'').toLowerCase().includes(search) ||
    (u.name||'').toLowerCase().includes(search)
  );
  if(filterRole) displayUsers = displayUsers.filter(u => u.role === filterRole);
  if(filterStatus === 'active') displayUsers = displayUsers.filter(u => u.active);
  if(filterStatus === 'inactive') displayUsers = displayUsers.filter(u => !u.active);
  return { displayUsers, allUsers };
}

function _updateUserBulkToolbar(){
  if(!window.currentUser && typeof window.currentUser === 'undefined') return; // not logged in yet
  const sel = window._userSelectedIds || new Set();
  const toolbar = document.getElementById('userBulkToolbar');
  const countEl = document.getElementById('userSelectedCount');
  if(toolbar){ toolbar.classList.toggle('hidden', sel.size === 0); }
  if(countEl) countEl.textContent = sel.size;
  // Update check-all state
  const chkAll = document.getElementById('userCheckAll');
  if(chkAll){
    const { displayUsers } = _getUserDisplayList();
    const selectableIds = displayUsers
      .filter(u => u.username !== window.currentUser.username && u.role !== 'Master')
      .map(u => String(u.id));
    const allSelected = selectableIds.length > 0 && selectableIds.every(id => sel.has(id));
    chkAll.checked = allSelected;
    chkAll.indeterminate = !allSelected && selectableIds.some(id => sel.has(id));
  }
}

function renderUserTable(){
  const tbody = document.getElementById('userTableBody');
  if(!tbody || !window.currentUser) return;

  const { displayUsers, allUsers } = _getUserDisplayList();
  const canDelete = window.currentUserCanDelete;
  const canEdit   = window.currentUserCanAdd;
  const sel = window._userSelectedIds;

  if(!displayUsers.length){
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-slate-400 text-sm">Tidak ada user ditemukan.</td></tr>';
  } else {
    tbody.innerHTML = displayUsers.map(u => {
      const isMasterRow = u.role === 'Master';
      const isSelf      = u.username === window.currentUser.username;
      const canEditThis   = canEdit && !(isMasterRow && window.currentUser.role !== 'Master');
      const canDeleteThis = canDelete && !isSelf && !(isMasterRow && window.currentUser.role !== 'Master');
      const isSelectable  = canDeleteThis; // hanya yang bisa dihapus yang bisa dicentang
      const isChecked     = sel.has(String(u.id));
      const systemBadge   = isMasterRow ? '<span class="text-[10px] text-yellow-600 dark:text-yellow-400 font-semibold ml-1">⚙ sistem</span>' : '';
      const selfBadge     = isSelf ? '<span class="text-[10px] text-slate-400 ml-1">(Anda)</span>' : '';
      return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 ${isChecked ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${isMasterRow ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''}" data-user-id="${u.id}">
        <td class="p-3 w-10">
          ${isSelectable
            ? `<input type="checkbox" class="user-row-chk accent-blue-600 w-4 h-4 cursor-pointer" data-uid="${u.id}" ${isChecked ? 'checked' : ''}>`
            : `<span class="inline-block w-4 h-4"></span>`}
        </td>
        <td class="p-3">
          <div class="flex items-center gap-1 flex-wrap">
            <span class="badge ${getRoleBadgeClass(u.role)}">${esc(u.role)}</span>${systemBadge}${selfBadge}
          </div>
          <div class="text-[11px] text-slate-400 font-mono mt-0.5">${esc(u.username)}</div>
        </td>
        <td class="p-3">
          <span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${u.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}">
            ${u.active ? '● Aktif' : '○ Nonaktif'}
          </span>
        </td>
        <td class="p-3 text-right whitespace-nowrap">
          ${canEditThis ? `<button onclick="openEditUserModal(${u.id})" class="text-xs px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg mr-1 font-semibold transition">✏️ Edit</button>` : ''}
          ${canDeleteThis ? `<button onclick="deleteSingleUser(${u.id})" class="text-xs px-2.5 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition">🗑️</button>` : ''}
        </td>
      </tr>`;
    }).join('');
  }

  // Count & info
  const pesertaCount = allUsers.filter(u=>u.role==='Peserta').length;
  const totalUsers   = allUsers.length;
  const pesertaInfo  = document.getElementById('userPesertaCountInfo');
  if(pesertaInfo) pesertaInfo.textContent = `Total Akun: ${totalUsers} | Akun Peserta: ${pesertaCount} / 150`;
  const footer = document.getElementById('userTableFooter');
  if(footer) footer.textContent = displayUsers.length < allUsers.length
    ? `Menampilkan ${displayUsers.length} dari ${totalUsers} akun`
    : `Total: ${totalUsers} akun`;

  // Re-wire checkbox events
  tbody.querySelectorAll('.user-row-chk').forEach(chk => {
    chk.addEventListener('change', function(){
      const uid = this.dataset.uid;
      if(this.checked) window._userSelectedIds.add(uid);
      else window._userSelectedIds.delete(uid);
      _updateUserBulkToolbar();
      // Update row highlight
      const row = this.closest('tr');
      if(row){
        row.classList.toggle('bg-blue-50', this.checked);
        row.classList.toggle('dark:bg-blue-900/20', this.checked);
      }
    });
  });

  _updateUserBulkToolbar();

  // Refresh Data Karyawan
  if(typeof window.renderKaryawanUserOptions === 'function') window.renderKaryawanUserOptions();
  if(typeof window.renderKaryawanTable === 'function') window.renderKaryawanTable();
}

// ── SELECT ALL CHECKBOX ──
document.addEventListener('change', function(e){
  if(e.target && e.target.id === 'userCheckAll'){
    if(!window.currentUser) return;
    window._userSelectedIds = window._userSelectedIds || new Set();
    const { displayUsers } = _getUserDisplayList();
    const checked = e.target.checked;
    displayUsers.forEach(u => {
      if(u.username !== window.currentUser.username && u.role !== 'Master'){
        if(checked) window._userSelectedIds.add(String(u.id));
        else        window._userSelectedIds.delete(String(u.id));
      }
    });
    renderUserTable();
  }
});

// ── SEARCH & FILTER LIVE ──
document.addEventListener('input', function(e){
  if(e.target && e.target.id === 'userSearchInput') renderUserTable();
});
document.addEventListener('change', function(e){
  if(e.target && (e.target.id === 'userFilterRole' || e.target.id === 'userFilterStatus')) renderUserTable();
});
document.getElementById('btnUserResetFilter')?.addEventListener('click', function(){
  const s = document.getElementById('userSearchInput');
  const r = document.getElementById('userFilterRole');
  const st = document.getElementById('userFilterStatus');
  if(s) s.value = '';
  if(r) r.value = '';
  if(st) st.value = '';
  window._userSelectedIds.clear();
  renderUserTable();
});

// ── CLEAR SELECTION ──
document.getElementById('btnUserClearSelection')?.addEventListener('click', function(){
  window._userSelectedIds.clear();
  renderUserTable();
});

// ── TOGGLE AKTIF/NONAKTIF BULK ──
document.getElementById('btnUserToggleActive')?.addEventListener('click', function(){
  if(!window.currentUserCanDelete){ showToast('Akses ditolak', 'error'); return; }
  const ids = Array.from(window._userSelectedIds);
  if(!ids.length){ showToast('Pilih user terlebih dahulu', 'error'); return; }
  let users = JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]');
  let changed = 0;
  users = users.map(u => {
    if(ids.includes(String(u.id)) && u.username !== window.currentUser.username && u.role !== 'Master'){
      changed++;
      return { ...u, active: !u.active };
    }
    return u;
  });
  saveUsers(users);
  window._userSelectedIds.clear();
  renderUserTable();
  showToast(`${changed} akun berhasil di-toggle status aktif/nonaktif`, 'success');
});

// ── BULK DELETE BUTTON ──
document.getElementById('btnUserDeleteSelected')?.addEventListener('click', function(){
  if(!window.currentUserCanDelete){ showToast('Akses ditolak', 'error'); return; }
  const ids = Array.from(window._userSelectedIds);
  if(!ids.length){ showToast('Pilih user terlebih dahulu', 'error'); return; }
  const allUsers = JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]');
  const toDelete = allUsers.filter(u =>
    ids.includes(String(u.id)) &&
    u.username !== window.currentUser.username &&
    u.role !== 'Master'
  );
  if(!toDelete.length){
    showToast('Tidak ada user yang dapat dihapus dari pilihan ini', 'error');
    return;
  }
  // Tampilkan modal konfirmasi
  const modal = document.getElementById('userBulkDeleteModal');
  const msg   = document.getElementById('userBulkDeleteMsg');
  const list  = document.getElementById('userBulkDeleteList');
  if(msg)  msg.textContent  = `Anda akan menghapus ${toDelete.length} akun berikut:`;
  if(list) list.innerHTML   = toDelete.map(u =>
    `<div class="flex items-center gap-2">
      <span class="badge ${getRoleBadgeClass(u.role)} text-[10px]">${esc(u.role)}</span>
      <span class="font-mono text-sm">${esc(u.username)}</span>
    </div>`
  ).join('');
  window._pendingBulkDeleteIds = toDelete.map(u => u.id);
  window._pendingBulkDeleteTargets = toDelete.map(u => ({ id: u.id, username: u.username }));
  if(modal) modal.classList.remove('hidden');
});

// ── BULK DELETE CONFIRM ──
document.getElementById('userBulkDeleteConfirm')?.addEventListener('click', function(){
  const ids = window._pendingBulkDeleteIds || [];
  const targets = window._pendingBulkDeleteTargets || [];
  let users = JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]');
  const before = users.length;
  const actuallyDeletedIds = users
    .filter(u => ids.includes(u.id) && u.username !== window.currentUser.username && u.role !== 'Master')
    .map(u => u.id);
  users = users.filter(u =>
    !ids.includes(u.id) ||
    u.username === window.currentUser.username ||
    u.role === 'Master'
  );
  const deleted = before - users.length;
  saveUsers(users);
  // [BUGFIX] Catat tombstone untuk ID yang benar-benar terhapus, supaya
  // cloudPull berikutnya tidak memasukkannya kembali dari payload cloud
  // yang belum tahu user ini sudah dihapus. Lihat catatan TOMBSTONE
  // TRACKING di shared-utils.js (dekat mergeById) untuk detail lengkap.
  if(typeof window.markDeletedTombstone === 'function') window.markDeletedTombstone('users', actuallyDeletedIds);
  // Unlink karyawan references untuk semua user yang dihapus
  const deletedUsernames = targets.map(t => t.username).filter(Boolean);
  if(deletedUsernames.length) _unlinkKaryawanByUsernames(deletedUsernames);
  window._userSelectedIds.clear();
  window._pendingBulkDeleteIds = [];
  window._pendingBulkDeleteTargets = [];
  document.getElementById('userBulkDeleteModal')?.classList.add('hidden');
  renderUserTable();
  showToast(`${deleted} akun berhasil dihapus`, 'success');
});

document.getElementById('userBulkDeleteCancel')?.addEventListener('click', function(){
  document.getElementById('userBulkDeleteModal')?.classList.add('hidden');
  window._pendingBulkDeleteIds = [];
});
// Backdrop click-to-close for both modals
document.getElementById('userBulkDeleteModal')?.addEventListener('click', function(e){
  if(e.target === this){ this.classList.add('hidden'); window._pendingBulkDeleteIds = []; }
});

// ── SINGLE DELETE (baris individual) ──
function deleteSingleUser(id){
  if(!window.currentUser || (window.currentUser.role !== 'Admin' && window.currentUser.role !== 'Master')){
    showToast('Hanya Admin/Master yang dapat menghapus user', 'error');
    return;
  }
  const allUsers = JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]');
  const target = allUsers.find(u => u.id === id);
  if(!target){ showToast('User tidak ditemukan', 'error'); return; }
  if(target.role === 'Master' && window.currentUser.role !== 'Master'){
    showToast('Akun Master hanya dapat dihapus oleh Master', 'error'); return;
  }
  if(target.username === window.currentUser.username){
    showToast('Tidak dapat menghapus akun Anda sendiri', 'error'); return;
  }
  window._pendingBulkDeleteTargets = [{ id, username: target.username }];
  window._pendingBulkDeleteIds = [id];
  const modal = document.getElementById('userBulkDeleteModal');
  const msg   = document.getElementById('userBulkDeleteMsg');
  const list  = document.getElementById('userBulkDeleteList');
  if(msg)  msg.textContent = 'Anda akan menghapus akun berikut:';
  if(list) list.innerHTML  = `<div class="flex items-center gap-2">
    <span class="badge ${getRoleBadgeClass(target.role)} text-[10px]">${esc(target.role)}</span>
    <span>${esc(target.username)}</span>
    ${target.name ? `<span class="text-slate-400">— ${esc(target.name)}</span>` : ''}
  </div>`;
  if(modal) modal.classList.remove('hidden');
}
window.deleteSingleUser = deleteSingleUser;

// Helper: kelas warna badge untuk setiap role, termasuk role kustom (UserXXX/UserXX/UserX).
// Dipusatkan di sini agar konsisten dan mudah ditambah jika ada role baru lagi nanti.
function getRoleBadgeClass(role){
  if(role === 'Master') return 'bg-yellow-100 text-yellow-800';  // Master: gold badge
  if(role === 'Admin') return 'bg-purple-100 text-purple-700';
  if(role === 'Co-Admin') return 'bg-blue-100 text-blue-700';
  if(role === 'User') return 'bg-emerald-100 text-emerald-700';
  if(role === 'User-All') return 'bg-emerald-100 text-emerald-700';
  if(role === 'User-SR') return 'bg-sky-100 text-sky-700';
  if(role === 'User-STCR') return 'bg-purple-100 text-purple-600';
  if(role === 'User-ST') return 'bg-teal-100 text-teal-700';
  if(role === 'User-DRG') return 'bg-orange-100 text-orange-700';
  if(role === 'Peserta') return 'bg-indigo-100 text-indigo-700';
  const custom = (typeof window.CUSTOM_ROLES !== 'undefined' ? window.CUSTOM_ROLES : []).find(r=>r.roleName === role);
  if(custom) return custom.badgeClass;
  return 'bg-slate-100 text-slate-700';
}
window.getRoleBadgeClass = getRoleBadgeClass;


// === TAMBAH ROLE DROPDOWN HANDLER ===
// Close dropdown on Escape key
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape'){
    const dd = document.getElementById('addRoleDropdown');
    if(dd && !dd.classList.contains('hidden')) dd.classList.add('hidden');
  }
});
document.addEventListener('click', function(e){
  const dropdown = document.getElementById('addRoleDropdown');
  const btn = document.getElementById('btnAddRole');
  if(btn && e.target.closest('#btnAddRole')){
    // Toggle dropdown
    if(dropdown) dropdown.classList.toggle('hidden');
    e.stopPropagation();
    return;
  }
  // Click on a role option
  const opt = e.target.closest('.add-role-opt');
  if(opt && dropdown && !dropdown.classList.contains('hidden')){
    const preselectedRole = opt.dataset.role;
    dropdown.classList.add('hidden');
    _doAddUser(preselectedRole);
    return;
  }
  // Close dropdown on outside click
  if(dropdown && !dropdown.classList.contains('hidden')){
    if(!e.target.closest('#btnAddRoleWrap')) dropdown.classList.add('hidden');
  }
});

function _doAddUser(preselectedRole){
  // Guard: hanya Admin & Master
  if(!window.currentUser || (window.currentUser.role !== 'Admin' && window.currentUser.role !== 'Master')){
    showToast('Hanya Admin/Master yang dapat menambah role', 'error');
    return;
  }

  const allowedRoles = ['Co-Admin','User-All','User-SR','User-STCR','User-ST','User-DRG','Peserta'];
  const role = preselectedRole;
  if(!role || !allowedRoles.includes(role)){
    showToast('Role tidak valid', 'error');
    return;
  }

  const users  = JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]');
  const karyawanList = (function(){ try{ return JSON.parse(localStorage.getItem('sjnam_karyawan_v1')||'[]'); }catch(e){ return []; } })();

  if(role === 'Peserta'){
    const pesertaCount = users.filter(u => u.role === 'Peserta').length;
    if(pesertaCount >= 150){
      showToast('Maksimal 150 slot Peserta sudah tercapai', 'error');
      return;
    }
  }

  // Karyawan yang sudah punya akun (username terhubung & akun masih ada di users)
  const linkedUsernames = new Set(users.map(u => u.username));
  // Karyawan yang username-nya sudah tertulis di data karyawan tapi belum ada akunnya = kandidat
  // Atau karyawan yang belum punya akun sama sekali
  const kandidat = karyawanList.filter(k => {
    // Sudah ada username di field karyawanUser? Berarti sudah terhubung — skip
    if(k.username && linkedUsernames.has(k.username)) return false;
    return true; // belum punya akun atau username-nya tidak ada di users
  });

  const existingModal = document.getElementById('_addRoleModal');
  if(existingModal) existingModal.remove();

  const roleBadgeColor = {
    'Co-Admin' : 'bg-blue-100 text-blue-700',
    'User-All' : 'bg-emerald-100 text-emerald-700',
    'User-SR'  : 'bg-sky-100 text-sky-700',
    'User-STCR': 'bg-purple-100 text-purple-700',
    'User-ST'  : 'bg-teal-100 text-teal-700',
    'User-DRG' : 'bg-orange-100 text-orange-700',
    'Peserta'  : 'bg-indigo-100 text-indigo-700',
  };
  const bClass = roleBadgeColor[role] || 'bg-slate-100 text-slate-700';

  const modal = document.createElement('div');
  modal.id = '_addRoleModal';
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-box max-w-md">
      <h3 class="text-lg font-bold mb-1">Add Role <span class="badge ${bClass}">${esc(role)}</span></h3>
      <p class="text-xs text-slate-500 mb-3">Pilih karyawan untuk dibuatkan akun dengan role <strong>${esc(role)}</strong>.<br>Username = NIP karyawan · Password sementara di-generate otomatis dan tersalin ke clipboard.</p>
      <input id="_addRoleSearch" type="text" placeholder="🔍 Cari nama / NIP..." class="input text-sm mb-3">
      <div id="_addRoleList" class="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700 mb-4"></div>
      <p id="_addRoleEmpty" class="hidden text-xs text-amber-600 dark:text-amber-400 font-semibold mb-3">⚠️ Semua karyawan sudah memiliki akun, atau belum ada data karyawan. Tambahkan karyawan di tab Data Karyawan terlebih dahulu.</p>
      <div class="flex justify-end gap-2">
        <button id="_addRoleCancel" class="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300">Batal</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  function renderList(filter){
    const listEl = document.getElementById('_addRoleList');
    const emptyEl = document.getElementById('_addRoleEmpty');
    if(!listEl) return;

    if(!kandidat.length){
      listEl.classList.add('hidden');
      if(emptyEl) emptyEl.classList.remove('hidden');
      return;
    }

    const q = (filter || '').toLowerCase();
    const filtered = kandidat.filter(k =>
      !q ||
      (k.nama||'').toLowerCase().includes(q) ||
      (k.nip||'').toLowerCase().includes(q)
    );

    if(!filtered.length){
      listEl.innerHTML = '<div class="px-4 py-3 text-sm text-slate-400">Tidak ada karyawan ditemukan.</div>';
      if(emptyEl) emptyEl.classList.add('hidden');
      return;
    }

    if(emptyEl) emptyEl.classList.add('hidden');
    listEl.classList.remove('hidden');

    listEl.innerHTML = filtered.map(k => `
      <button class="_add-role-kar-btn w-full text-left px-4 py-2.5 hover:bg-emerald-50 dark:hover:bg-slate-800 transition"
              data-kar-id="${esc(k.id)}" data-nip="${esc(k.nip||'')}" data-nama="${esc(k.nama||'')}" data-station="${esc(k.station||'')}">
        <div class="flex items-center justify-between gap-2">
          <span>
            <span class="font-medium text-sm">${esc(k.nama||'—')}</span>
            <span class="text-xs text-slate-400 ml-1">· NIP: <span class="font-mono">${esc(k.nip||'—')}</span></span>
            ${k.jabatan ? `<span class="text-xs text-slate-400 ml-1">· ${esc(k.jabatan)}</span>` : ''}
          </span>
          ${k.station ? `<span class="badge bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 text-xs shrink-0">${esc(k.station)}</span>` : ''}
        </div>
      </button>
    `).join('');

    listEl.querySelectorAll('._add-role-kar-btn').forEach(btn => {
      btn.addEventListener('click', async function(){
        const karId  = this.dataset.karId;
        const nip    = (this.dataset.nip || '').trim();
        const nama   = (this.dataset.nama || '').trim();
        const station = (this.dataset.station || '').trim();

        if(!nip){
          showToast('Karyawan ini belum memiliki NIP — isi NIP di Data Karyawan terlebih dahulu', 'error');
          return;
        }

        // [BUGFIX] _validateAddRole (FEAT-4, blueprint-v1.js) sebelumnya
        // tidak pernah dipanggil dari mana pun — dead code sejak file asli.
        // Sekarang diaktifkan di sini: validasi station wajib untuk role
        // station-bound + NIP wajib (NIP sudah dicek manual di atas, tapi
        // tetap dijalankan untuk konsistensi jika logic _validateAddRole
        // berubah di masa depan). Lihat REFACTOR_NOTES.md bagian
        // "Perbaikan Bug Pasca-Refactor".
        if(typeof window._validateAddRole === 'function'){
          const issues = window._validateAddRole(role, { nip, station });
          const blocking = issues.filter(i => i.type === 'error');
          if(blocking.length){
            showToast(blocking[0].msg, 'error');
            return;
          }
        }

        // Username = NIP (lowercase)
        const uname = nip.toLowerCase();

        // Cek duplikat username
        const freshUsers = JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]');
        if(freshUsers.find(u => u.username.toLowerCase() === uname)){
          showToast(`Akun dengan username "${uname}" sudah ada`, 'error');
          return;
        }

        if(role === 'Peserta'){
          const pc = freshUsers.filter(u => u.role === 'Peserta').length;
          if(pc >= 150){ showToast('Maks 150 slot Peserta tercapai', 'error'); return; }
        }

        // Generate random secure password (not 123456)
        const defaultPw = window._generateTempPassword ? window._generateTempPassword() : _genTempPw();
        sha256(defaultPw).then(hashedPw => {
          // Baca ulang dari localStorage (async sudah selesai, ada kemungkinan
          // cloudPull/realtime sudah mengubah isi localStorage dalam jeda ini).
          let finalUsers = JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]');
          if(finalUsers.find(u => u.username.toLowerCase() === uname)){
            showToast(`Username "${uname}" sudah ada`, 'error'); return;
          }
          // [BUGFIX] Terapkan tombstone filter sebelum push — jika selama sha256()
          // berjalan (async), cloudPull/realtime sudah me-restore user yang sudah
          // dihapus ke localStorage, pastikan mereka dibuang kembali SEBELUM user
          // baru ditambahkan dan disimpan. Tanpa ini, user yang sudah dihapus ikut
          // tersimpan kembali ke cloud bersama user baru yang baru ditambahkan.
          if(typeof window._filterTombstoned === 'function'){
            finalUsers = window._filterTombstoned('users', finalUsers);
          }
          const newUser = {
            id: Date.now(),
            username: uname,
            password: hashedPw,
            role: role,
            name: nama,
            active: true,
            mustChangePassword: true, // Flag: wajib ganti saat first login
            created: new Date().toISOString().split('T')[0]
          };
          finalUsers.push(newUser);
          saveUsers(finalUsers);

          // Auto-link ke data karyawan (set field username di karyawan)
          try {
            const karList = JSON.parse(localStorage.getItem('sjnam_karyawan_v1') || '[]');
            const karEntry = karList.find(k => k.id === karId);
            if(karEntry && !karEntry.username){
              karEntry.username = uname;
              localStorage.setItem('sjnam_karyawan_v1', JSON.stringify(karList));
              if(typeof triggerAutoSync === 'function') triggerAutoSync('karyawan');
              if(typeof window.renderKaryawanTable === 'function') window.renderKaryawanTable();
            }
          } catch(e){ console.warn('Auto-link karyawan gagal', e); }

          // Validate station for station-bound roles
          if(window._STATION_FILTER_ROLES && window._STATION_FILTER_ROLES.includes(role)){
            try{
              const _kl = JSON.parse(localStorage.getItem('sjnam_karyawan_v1')||'[]');
              const _ke = _kl.find(k=>k.id===karId);
              if(_ke && (!_ke.station || _ke.station === '')){
                showToast(`⚠️ Akun dibuat tapi station karyawan belum diisi — isi di Data Karyawan`, 'error');
              }
            } catch(e){}
          }

          // Copy temp password to clipboard
          try{ navigator.clipboard?.writeText(defaultPw); } catch(e){}

          renderUserTable();
          modal.remove();
          // Show temp password clearly
          const _pwMsg = `Akun "${uname}" berhasil dibuat!
Password sementara: ${defaultPw}
(sudah tersalin ke clipboard — wajib diganti saat login pertama)`;
          alert(_pwMsg);
          showToast(`Akun "${uname}" (${esc(role)}) berhasil dibuat`, 'success');
        }).catch(() => { showToast('Gagal hash password, coba lagi', 'error'); });
      });
    });
  }

  renderList('');
  document.getElementById('_addRoleSearch').addEventListener('input', function(){
    renderList(this.value.trim());
  });
  document.getElementById('_addRoleCancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if(e.target === modal) modal.remove(); });
}

// ── EDIT USER MODAL ──
function openEditUserModal(id){
  const isMasterOrAdmin = window.currentUser && (window.currentUser.role === 'Admin' || window.currentUser.role === 'Master');
  const isCoAdmin = window.currentUser && window.currentUser.role === 'Co-Admin';
  if(!isMasterOrAdmin && !isCoAdmin){
    showToast('Akses ditolak: tidak ada izin untuk mengedit user', 'error');
    return;
  }
  const users = JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]');
  const user  = users.find(u => u.id === id);
  if(!user){ showToast('User tidak ditemukan', 'error'); return; }

  // Permission checks
  if(user.role === 'Master' && window.currentUser.role !== 'Master'){
    showToast('Akun Master hanya dapat diedit oleh Master', 'error'); return;
  }
  if(isCoAdmin && (user.role === 'Admin' || user.role === 'Master')){
    showToast('Co-Admin tidak dapat mengubah akun Admin/Master', 'error'); return;
  }
  if(isCoAdmin && user.role === 'Co-Admin' && user.username !== window.currentUser.username){
    showToast('Co-Admin tidak dapat mengubah akun Co-Admin lain', 'error'); return;
  }

  // Populate modal
  document.getElementById('editUserId').value       = id;
  document.getElementById('editUserUsername').value = user.username;

  // Build role dropdown sesuai hak caller
  const roleSelect = document.getElementById('editUserRole');
  if(roleSelect){
    const allRoles = (typeof window.ALL_ROLES !== 'undefined' && window.ALL_ROLES.length)
      ? window.ALL_ROLES
      : ['Master','Admin','Co-Admin','User-All','User-SR','User-STCR','User-ST','User-DRG','User','Peserta'];
    const allowedRoles = isMasterOrAdmin ? allRoles : allRoles.filter(r=>r!=='Admin'&&r!=='Master');
    roleSelect.innerHTML = allowedRoles.map(r =>
      `<option value="${r}" ${r===user.role?'selected':''}>${r}</option>`
    ).join('');
    // Jika Co-Admin — role select tidak perlu ditampilkan
    roleSelect.disabled = isCoAdmin;
    roleSelect.closest('div').style.opacity = isCoAdmin ? '0.5' : '';
  }

  // Active toggle: tidak bisa deactivate diri sendiri
  const activeChk = document.getElementById('editUserActive');
  if(activeChk){
    activeChk.checked = !!user.active;
    activeChk.disabled = (user.username === window.currentUser.username);
    const wrap = document.getElementById('editUserStatusWrap');
    if(wrap) wrap.style.opacity = (user.username === window.currentUser.username) ? '0.5' : '';
  }

  document.getElementById('editUserModal')?.classList.remove('hidden');
}
window.openEditUserModal = openEditUserModal;
window.editUser = openEditUserModal; // backward compat alias

// ── EDIT ROLE SAVE ──
document.getElementById('editUserModalSave')?.addEventListener('click', function(){
  const id      = parseInt(document.getElementById('editUserId')?.value || '');
  if(isNaN(id)){ showToast('ID tidak valid', 'error'); return; }
  const newRole = document.getElementById('editUserRole')?.value || '';
  const isActive= document.getElementById('editUserActive')?.checked;

  const isMasterOrAdmin = window.currentUser && (window.currentUser.role === 'Admin' || window.currentUser.role === 'Master');
  let users = JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]');
  const user = users.find(u => u.id === id);
  if(!user){ showToast('Akun tidak ditemukan', 'error'); return; }

  // Validasi role baru
  if(isMasterOrAdmin && newRole && newRole !== user.role){
    if(newRole === 'Peserta' && user.role !== 'Peserta'){
      const pc = users.filter(u=>u.role==='Peserta').length;
      if(pc >= 150){ showToast('Maksimal 150 akun Peserta tercapai', 'error'); return; }
    }
    user.role = newRole;
  }

  // Status: tidak bisa nonaktifkan akun sendiri
  if(user.username !== window.currentUser.username) user.active = isActive;

  // Update session jika edit diri sendiri
  if(user.username === window.currentUser.username){
    window.currentUser.role = user.role;
    window.currentUser.role = user.role;
    localStorage.setItem('sjnam_session_v1', JSON.stringify(window.currentUser));
    const roleEl  = document.getElementById('userRoleDisplay');
    const roleElS = document.getElementById('userRoleDisplaySide');
    if(roleEl)  roleEl.textContent  = (user.role === 'Admin' || user.role === 'Co-Admin' || user.role === 'Master') ? user.role : '';
    if(roleElS) roleElS.textContent = user.role;
  }

  saveUsers(users);
  document.getElementById('editUserModal')?.classList.add('hidden');
  renderUserTable();
  showToast('Role berhasil diperbarui', 'success');
});

// ── EDIT MODAL CANCEL & BACKDROP ──
document.getElementById('editUserModalCancel')?.addEventListener('click', function(){
  document.getElementById('editUserModal')?.classList.add('hidden');
});
document.getElementById('editUserModal')?.addEventListener('click', function(e){
  if(e.target === this) this.classList.add('hidden');
});

// ── deleteUser alias untuk backward compat ──
function deleteUser(id){ deleteSingleUser(id); }
window.deleteUser = deleteUser;
