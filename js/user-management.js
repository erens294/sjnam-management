/*!
 * SJNAM — MODUL USER MANAGEMENT (v2.0 — Bug-Fixed)
 * ====================================================================
 * PERBAIKAN vs v1:
 *
 * [BUG FIX A] — deleteSingleUser tidak memanggil _unlinkKaryawanByUsernames
 *   Saat 1 akun dihapus lewat tombol 🗑️, field username di karyawan
 *   terkait tidak dibersihkan, sehingga karyawan tersebut tidak muncul
 *   lagi di daftar Add Role.
 *   FIX: tambahkan _unlinkKaryawanByUsernames + emit 'sjn:user-deleted'.
 *
 * [BUG FIX B] — Kandidat _doAddUser tidak di-refresh setelah clean stale
 *   kandidat dibangun dari localStorage sebelum _cleanStaleUsernames()
 *   dijalankan, sehingga karyawan yang username-nya stale masih ter-exclude.
 *   FIX: baca ulang karyawanList SETELAH _cleanStaleUsernames dipanggil.
 *
 * [BUG FIX C] — editUser modal: role dropdown tidak direfresh untuk Co-Admin
 *   Co-Admin bisa melihat opsi role yang seharusnya tidak tersedia.
 *   FIX: filter allowedRoles ketat berdasar caller role.
 *
 * [BUG FIX D] — _getUserDisplayList tidak konsisten saat currentUser null
 *   Beberapa tempat memanggil fungsi ini sebelum login selesai.
 *   FIX: guard ditambahkan, return empty array jika belum login.
 *
 * [BUG FIX E] — String(u.id) vs Number(u.id) inkonsisten di selectedIds
 *   Checkbox data-uid diset sebagai string tapi dibandingkan dengan Number.
 *   FIX: semua perbandingan id distandarisasi ke String.
 * ====================================================================
 */

// ── State ──────────────────────────────────────────────────────────────────
if (window._userManagementModuleInit) {
  console.warn("[SJNAM] user-management.js dieksekusi ulang di scope global yang sama — ini akan menyebabkan SyntaxError pada deklarasi const/let di bawah (proteksi alami browser terhadap re-injection ganda).");
}
window._userManagementModuleInit = true;
window._userSelectedIds = new Set();

// ── Helper ─────────────────────────────────────────────────────────────────
function _getUserDisplayList() {
  // [BUG FIX D]
  if (!window.currentUser) return { displayUsers: [], allUsers: [] };

  const allUsers = JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]');
  const role     = window.currentUser.role;
  const isMasterOrAdmin = role === 'Master' || role === 'Admin';

  let displayUsers = allUsers;
  if (role === 'Co-Admin') {
    displayUsers = allUsers.filter(u =>
      u.role !== 'Admin' && u.role !== 'Master' &&
      !(u.role === 'Co-Admin' && u.username !== window.currentUser.username)
    );
  } else if (!isMasterOrAdmin) {
    displayUsers = [];
  }

  const search       = (document.getElementById('userSearchInput')?.value || '').toLowerCase();
  const filterRole   = document.getElementById('userFilterRole')?.value || '';
  const filterStatus = document.getElementById('userFilterStatus')?.value || '';

  if (search)        displayUsers = displayUsers.filter(u =>
    (u.username||'').toLowerCase().includes(search) || (u.name||'').toLowerCase().includes(search)
  );
  if (filterRole)    displayUsers = displayUsers.filter(u => u.role === filterRole);
  if (filterStatus === 'active')   displayUsers = displayUsers.filter(u => u.active);
  if (filterStatus === 'inactive') displayUsers = displayUsers.filter(u => !u.active);

  return { displayUsers, allUsers };
}

function _updateUserBulkToolbar() {
  if (!window.currentUser) return;
  const sel     = window._userSelectedIds || new Set();
  const toolbar = document.getElementById('userBulkToolbar');
  const countEl = document.getElementById('userSelectedCount');
  if (toolbar) toolbar.classList.toggle('hidden', sel.size === 0);
  if (countEl) countEl.textContent = sel.size;

  const chkAll = document.getElementById('userCheckAll');
  if (chkAll) {
    const { displayUsers } = _getUserDisplayList();
    const selectableIds = displayUsers
      .filter(u => u.username !== window.currentUser.username && u.role !== 'Master')
      .map(u => String(u.id));
    const allSelected = selectableIds.length > 0 && selectableIds.every(id => sel.has(id));
    chkAll.checked       = allSelected;
    chkAll.indeterminate = !allSelected && selectableIds.some(id => sel.has(id));
  }
}

// ── renderUserTable ────────────────────────────────────────────────────────
function renderUserTable() {
  const tbody = document.getElementById('userTableBody');
  if (!tbody || !window.currentUser) return;

  const { displayUsers, allUsers } = _getUserDisplayList();
  const canDelete = window.currentUserCanDelete;
  const canEdit   = window.currentUserCanAdd;
  // [BUG FIX E] sel selalu berisi String
  const sel = window._userSelectedIds;

  if (!displayUsers.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-slate-400 text-sm">Tidak ada user ditemukan.</td></tr>';
  } else {
    tbody.innerHTML = displayUsers.map(u => {
      const isMasterRow   = u.role === 'Master';
      const isSelf        = u.username === window.currentUser.username;
      const canEditThis   = canEdit   && !(isMasterRow && window.currentUser.role !== 'Master');
      const canDeleteThis = canDelete && !isSelf && !(isMasterRow && window.currentUser.role !== 'Master');
      const isSelectable  = canDeleteThis;
      // [BUG FIX E] pakai String(u.id) konsisten
      const isChecked     = sel.has(String(u.id));
      const systemBadge   = isMasterRow ? '<span class="text-[10px] text-yellow-600 dark:text-yellow-400 font-semibold ml-1">⚙ sistem</span>' : '';
      const selfBadge     = isSelf ? '<span class="text-[10px] text-slate-400 ml-1">(Anda)</span>' : '';

      return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 ${isChecked ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${isMasterRow ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''}" data-user-id="${u.id}">
        <td class="p-3 w-10">
          ${isSelectable
            ? `<input type="checkbox" class="user-row-chk accent-blue-600 w-4 h-4 cursor-pointer" data-uid="${u.id}" ${isChecked ? 'checked' : ''}>`
            : '<span class="inline-block w-4 h-4"></span>'}
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
          ${canEditThis   ? `<button onclick="openEditUserModal(${u.id})" class="text-xs px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg mr-1 font-semibold transition">✏️ Edit</button>` : ''}
          ${canDeleteThis ? `<button onclick="deleteSingleUser(${u.id})" class="text-xs px-2.5 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition">🗑️</button>` : ''}
        </td>
      </tr>`;
    }).join('');
  }

  const pesertaCount = allUsers.filter(u => u.role === 'Peserta').length;
  const totalUsers   = allUsers.length;
  const pesertaInfo  = document.getElementById('userPesertaCountInfo');
  if (pesertaInfo) pesertaInfo.textContent = `Total Akun: ${totalUsers} | Akun Peserta: ${pesertaCount} / 150`;
  const footer = document.getElementById('userTableFooter');
  if (footer) footer.textContent = displayUsers.length < allUsers.length
    ? `Menampilkan ${displayUsers.length} dari ${totalUsers} akun`
    : `Total: ${totalUsers} akun`;

  // Re-wire checkbox events
  tbody.querySelectorAll('.user-row-chk').forEach(chk => {
    chk.addEventListener('change', function () {
      const uid = String(this.dataset.uid); // [BUG FIX E]
      if (this.checked) window._userSelectedIds.add(uid);
      else              window._userSelectedIds.delete(uid);
      _updateUserBulkToolbar();
      const row = this.closest('tr');
      if (row) {
        row.classList.toggle('bg-blue-50', this.checked);
        row.classList.toggle('dark:bg-blue-900/20', this.checked);
      }
    });
  });

  _updateUserBulkToolbar();

  // Refresh Data Karyawan dropdown & tabel
  if (typeof window.renderKaryawanUserOptions === 'function') window.renderKaryawanUserOptions();
  if (typeof window.renderKaryawanTable       === 'function') window.renderKaryawanTable();
}

// ── SELECT ALL ─────────────────────────────────────────────────────────────
document.addEventListener('change', function (e) {
  if (!e.target || e.target.id !== 'userCheckAll') return;
  if (!window.currentUser) return;
  window._userSelectedIds = window._userSelectedIds || new Set();
  const { displayUsers } = _getUserDisplayList();
  const checked = e.target.checked;
  displayUsers.forEach(u => {
    if (u.username !== window.currentUser.username && u.role !== 'Master') {
      if (checked) window._userSelectedIds.add(String(u.id)); // [BUG FIX E]
      else         window._userSelectedIds.delete(String(u.id));
    }
  });
  renderUserTable();
});

// ── SEARCH & FILTER ────────────────────────────────────────────────────────
document.addEventListener('input',  e => { if (e.target?.id === 'userSearchInput') renderUserTable(); });
document.addEventListener('change', e => { if (e.target?.id === 'userFilterRole' || e.target?.id === 'userFilterStatus') renderUserTable(); });

document.getElementById('btnUserResetFilter')?.addEventListener('click', function () {
  ['userSearchInput','userFilterRole','userFilterStatus'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  window._userSelectedIds.clear();
  renderUserTable();
});

document.getElementById('btnUserClearSelection')?.addEventListener('click', function () {
  window._userSelectedIds.clear();
  renderUserTable();
});

// ── BULK TOGGLE AKTIF ──────────────────────────────────────────────────────
document.getElementById('btnUserToggleActive')?.addEventListener('click', function () {
  if (!window.currentUserCanDelete) { showToast('Akses ditolak', 'error'); return; }
  const ids = Array.from(window._userSelectedIds);
  if (!ids.length) { showToast('Pilih user terlebih dahulu', 'error'); return; }
  let users = JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]');
  let changed = 0;
  users = users.map(u => {
    if (ids.includes(String(u.id)) && u.username !== window.currentUser.username && u.role !== 'Master') {
      changed++;
      // [BUG FIX] Stamping supaya perubahan status ini benar-benar tersinkron
      // ke device lain (lihat catatan yang sama di editUserModalSave / _doAddUser).
      return {
        ...u,
        active: !u.active,
        _updatedAt: new Date().toISOString(),
        _updatedBy: (window.currentUser && (window.currentUser.name || window.currentUser.username)) || 'system'
      };
    }
    return u;
  });
  saveUsers(users);
  window._userSelectedIds.clear();
  renderUserTable();
  showToast(`${changed} akun berhasil di-toggle status aktif/nonaktif`, 'success');
});

// ── BULK DELETE ─────────────────────────────────────────────────────────────
document.getElementById('btnUserDeleteSelected')?.addEventListener('click', function () {
  if (!window.currentUserCanDelete) { showToast('Akses ditolak', 'error'); return; }
  const ids = Array.from(window._userSelectedIds);
  if (!ids.length) { showToast('Pilih user terlebih dahulu', 'error'); return; }

  const allUsers = JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]');
  const toDelete = allUsers.filter(u =>
    ids.includes(String(u.id)) &&
    u.username !== window.currentUser.username &&
    u.role !== 'Master'
  );
  if (!toDelete.length) { showToast('Tidak ada user yang dapat dihapus dari pilihan ini', 'error'); return; }

  const modal = document.getElementById('userBulkDeleteModal');
  const msg   = document.getElementById('userBulkDeleteMsg');
  const list  = document.getElementById('userBulkDeleteList');
  if (msg)  msg.textContent = `Anda akan menghapus ${toDelete.length} akun berikut:`;
  if (list) list.innerHTML  = toDelete.map(u =>
    `<div class="flex items-center gap-2">
      <span class="badge ${getRoleBadgeClass(u.role)} text-[10px]">${esc(u.role)}</span>
      <span class="font-mono text-sm">${esc(u.username)}</span>
    </div>`
  ).join('');
  window._pendingBulkDeleteIds     = toDelete.map(u => u.id);
  window._pendingBulkDeleteTargets = toDelete.map(u => ({ id: u.id, username: u.username }));
  if (modal) modal.classList.remove('hidden');
});

document.getElementById('userBulkDeleteConfirm')?.addEventListener('click', function () {
  const ids     = window._pendingBulkDeleteIds || [];
  const targets = window._pendingBulkDeleteTargets || [];
  let users     = JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]');
  const before  = users.length;

  const actuallyDeletedIds = users
    .filter(u => ids.includes(u.id) && u.username !== window.currentUser.username && u.role !== 'Master')
    .map(u => u.id);

  users = users.filter(u =>
    !ids.includes(u.id) || u.username === window.currentUser.username || u.role === 'Master'
  );
  const deleted = before - users.length;
  saveUsers(users);

  if (typeof window.markDeletedTombstone === 'function') window.markDeletedTombstone('users', actuallyDeletedIds);

  const deletedUsernames = targets.map(t => t.username).filter(Boolean);
  if (deletedUsernames.length) {
    if (typeof window._unlinkKaryawanByUsernames === 'function') window._unlinkKaryawanByUsernames(deletedUsernames);
    // [BUG FIX A] emit event agar karyawan-management bisa refresh state-nya
    document.dispatchEvent(new CustomEvent('sjn:user-deleted', { detail: { usernames: deletedUsernames } }));
    // [FIX] Tulis marker force-logout agar tab/session user yang dihapus otomatis keluar
    try {
      const existing = JSON.parse(localStorage.getItem('sjnam_force_logout') || '[]');
      const combined = [...new Set([...existing, ...deletedUsernames])];
      localStorage.setItem('sjnam_force_logout', JSON.stringify(combined));
      // Hapus marker setelah 60 detik (cukup untuk semua tab detect)
      setTimeout(() => {
        try {
          const cur = JSON.parse(localStorage.getItem('sjnam_force_logout') || '[]');
          const remaining = cur.filter(u => !deletedUsernames.includes(u));
          if (remaining.length) localStorage.setItem('sjnam_force_logout', JSON.stringify(remaining));
          else localStorage.removeItem('sjnam_force_logout');
        } catch(e) {}
      }, 60000);
    } catch(e) {}
  }

  window._userSelectedIds.clear();
  window._pendingBulkDeleteIds = [];
  window._pendingBulkDeleteTargets = [];
  document.getElementById('userBulkDeleteModal')?.classList.add('hidden');
  renderUserTable();
  showToast(`${deleted} akun berhasil dihapus`, 'success');
});

document.getElementById('userBulkDeleteCancel')?.addEventListener('click', function () {
  document.getElementById('userBulkDeleteModal')?.classList.add('hidden');
  window._pendingBulkDeleteIds = [];
});
document.getElementById('userBulkDeleteModal')?.addEventListener('click', function (e) {
  if (e.target === this) { this.classList.add('hidden'); window._pendingBulkDeleteIds = []; }
});

// ── SINGLE DELETE ──────────────────────────────────────────────────────────
function deleteSingleUser(id) {
  if (!window.currentUser || (window.currentUser.role !== 'Admin' && window.currentUser.role !== 'Master')) {
    showToast('Hanya Admin/Master yang dapat menghapus user', 'error'); return;
  }
  const allUsers = JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]');
  const target   = allUsers.find(u => u.id === id);
  if (!target) { showToast('User tidak ditemukan', 'error'); return; }
  if (target.role === 'Master' && window.currentUser.role !== 'Master') {
    showToast('Akun Master hanya dapat dihapus oleh Master', 'error'); return;
  }
  if (target.username === window.currentUser.username) {
    showToast('Tidak dapat menghapus akun Anda sendiri', 'error'); return;
  }
  window._pendingBulkDeleteTargets = [{ id, username: target.username }];
  window._pendingBulkDeleteIds     = [id];
  const modal = document.getElementById('userBulkDeleteModal');
  const msg   = document.getElementById('userBulkDeleteMsg');
  const list  = document.getElementById('userBulkDeleteList');
  if (msg)  msg.textContent = 'Anda akan menghapus akun berikut:';
  if (list) list.innerHTML  = `<div class="flex items-center gap-2">
    <span class="badge ${getRoleBadgeClass(target.role)} text-[10px]">${esc(target.role)}</span>
    <span>${esc(target.username)}</span>
    ${target.name ? `<span class="text-slate-400">— ${esc(target.name)}</span>` : ''}
  </div>`;
  if (modal) modal.classList.remove('hidden');
}
window.deleteSingleUser = deleteSingleUser;

// ── getRoleBadgeClass ──────────────────────────────────────────────────────
function getRoleBadgeClass(role) {
  if (role === 'Master')    return 'bg-yellow-100 text-yellow-800';
  if (role === 'Admin')     return 'bg-purple-100 text-purple-700';
  if (role === 'Co-Admin')  return 'bg-blue-100 text-blue-700';
  if (role === 'User')      return 'bg-emerald-100 text-emerald-700';
  if (role === 'User-All')  return 'bg-emerald-100 text-emerald-700';
  if (role === 'User-SR')   return 'bg-sky-100 text-sky-700';
  if (role === 'User-STCR') return 'bg-purple-100 text-purple-600';
  if (role === 'User-ST')   return 'bg-teal-100 text-teal-700';
  if (role === 'User-DRG')  return 'bg-orange-100 text-orange-700';
  if (role === 'Peserta')   return 'bg-indigo-100 text-indigo-700';
  const custom = (typeof window.CUSTOM_ROLES !== 'undefined' ? window.CUSTOM_ROLES : []).find(r => r.roleName === role);
  if (custom) return custom.badgeClass;
  return 'bg-slate-100 text-slate-700';
}
window.getRoleBadgeClass = getRoleBadgeClass;

// ── ADD ROLE (jalur alternatif — tetap tersedia di tab Admin) ───────────────
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    const dd = document.getElementById('addRoleDropdown');
    if (dd && !dd.classList.contains('hidden')) dd.classList.add('hidden');
  }
});

document.addEventListener('click', function (e) {
  const dropdown = document.getElementById('addRoleDropdown');
  const btn      = document.getElementById('btnAddRole');

  if (btn && e.target.closest('#btnAddRole')) {
    if (dropdown) dropdown.classList.toggle('hidden');
    e.stopPropagation();
    return;
  }
  const opt = e.target.closest('.add-role-opt');
  if (opt && dropdown && !dropdown.classList.contains('hidden')) {
    dropdown.classList.add('hidden');
    _doAddUser(opt.dataset.role);
    return;
  }
  if (dropdown && !dropdown.classList.contains('hidden')) {
    if (!e.target.closest('#btnAddRoleWrap')) dropdown.classList.add('hidden');
  }
});

function _doAddUser(preselectedRole) {
  if (!window.currentUser || (window.currentUser.role !== 'Admin' && window.currentUser.role !== 'Master')) {
    showToast('Hanya Admin/Master yang dapat menambah role', 'error'); return;
  }

  const allowedRoles = ['Co-Admin','User-All','User-SR','User-STCR','User-ST','User-DRG','Peserta'];
  if (!preselectedRole || !allowedRoles.includes(preselectedRole)) {
    showToast('Role tidak valid', 'error'); return;
  }

  const users = JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]');

  if (preselectedRole === 'Peserta' && users.filter(u => u.role === 'Peserta').length >= 150) {
    showToast('Maksimal 150 slot Peserta sudah tercapai', 'error'); return;
  }

  // [BUG FIX B] — baca karyawan SETELAH _cleanStaleUsernames
  // (fungsi ini ada di karyawan-management.js dan diekspos via window)
  if (typeof window.getKaryawanData === 'function') {
    // _cleanStaleUsernames sudah dijalankan saat karyawan-management.js load
    // dan setiap kali setKaryawanData dipanggil. Untuk memastikan fresh,
    // baca langsung dari localStorage yang sudah dibersihkan.
  }
  const karyawanList = (function () {
    try { return JSON.parse(localStorage.getItem('sjnam_karyawan_v1') || '[]'); }
    catch (e) { return []; }
  })();

  const linkedUsernames = new Set(users.map(u => u.username));
  const kandidat = karyawanList.filter(k => {
    // Sudah punya akun aktif → skip
    if (k.username && linkedUsernames.has(k.username)) return false;
    // [BUG FIX B] username stale (akun sudah dihapus) → tampilkan
    // (_cleanStaleUsernames seharusnya sudah mengosongkan ini, tapi
    //  sebagai safety net tambahan)
    if (k.username && !linkedUsernames.has(k.username)) k.username = '';
    return true;
  });

  const existingModal = document.getElementById('_addRoleModal');
  if (existingModal) existingModal.remove();

  const roleBadgeColor = {
    'Co-Admin' : 'bg-blue-100 text-blue-700',
    'User-All' : 'bg-emerald-100 text-emerald-700',
    'User-SR'  : 'bg-sky-100 text-sky-700',
    'User-STCR': 'bg-purple-100 text-purple-700',
    'User-ST'  : 'bg-teal-100 text-teal-700',
    'User-DRG' : 'bg-orange-100 text-orange-700',
    'Peserta'  : 'bg-indigo-100 text-indigo-700',
  };
  const bClass = roleBadgeColor[preselectedRole] || 'bg-slate-100 text-slate-700';
  const role   = preselectedRole;

  const modal = document.createElement('div');
  modal.id = '_addRoleModal';
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-box max-w-md">
      <h3 class="text-lg font-bold mb-1">Add Role <span class="badge ${bClass}">${esc(role)}</span></h3>
      <p class="text-xs text-slate-500 mb-3">
        Pilih karyawan untuk dibuatkan akun dengan role <strong>${esc(role)}</strong>.<br>
        <span class="text-blue-600 font-medium">💡 Tip: Anda juga bisa buat akun langsung dari modal Tambah/Edit Karyawan.</span>
      </p>
      <input id="_addRoleSearch" type="text" placeholder="🔍 Cari nama / NIP..." class="input text-sm mb-3">
      <div id="_addRoleList" class="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700 mb-4"></div>
      <p id="_addRoleEmpty" class="hidden text-xs text-amber-600 dark:text-amber-400 font-semibold mb-3">
        ⚠️ Semua karyawan sudah memiliki akun, atau belum ada data karyawan.
        Tambahkan karyawan di tab Data Karyawan terlebih dahulu.
      </p>
      <div class="flex justify-end gap-2">
        <button id="_addRoleCancel" class="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300">Batal</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  function renderList(filter) {
    const listEl  = document.getElementById('_addRoleList');
    const emptyEl = document.getElementById('_addRoleEmpty');
    if (!listEl) return;

    if (!kandidat.length) {
      listEl.classList.add('hidden');
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }

    const q        = (filter || '').toLowerCase();
    const filtered = kandidat.filter(k =>
      !q || (k.nama||'').toLowerCase().includes(q) || (k.nip||'').toLowerCase().includes(q)
    );

    if (!filtered.length) {
      listEl.innerHTML = '<div class="px-4 py-3 text-sm text-slate-400">Tidak ada karyawan ditemukan.</div>';
      if (emptyEl) emptyEl.classList.add('hidden');
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');
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
          <div class="flex items-center gap-2 shrink-0">
            ${k.station ? `<span class="badge bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 text-xs">${esc(k.station)}</span>` : ''}
            <span class="px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white pointer-events-none">Pilih</span>
          </div>
        </div>
      </button>`).join('');

    listEl.querySelectorAll('._add-role-kar-btn').forEach(btn => {
      btn.addEventListener('click', async function () {
        try {
          const karId   = this.dataset.karId;
          const nip     = (this.dataset.nip || '').trim();
          const nama    = (this.dataset.nama || '').trim();
          const station = (this.dataset.station || '').trim();

          if (!nip) {
            showToast('Karyawan ini belum memiliki NIP — isi NIP di Data Karyawan terlebih dahulu', 'error');
            return;
          }

          if (typeof window._validateAddRole === 'function') {
            const issues  = window._validateAddRole(role, { nip, station });
            const blocking = issues.filter(i => i.type === 'error');
            if (blocking.length) { showToast(blocking[0].msg, 'error'); return; }
          }

          const uname = nip.toLowerCase();
          const freshUsers = JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]');
          if (freshUsers.find(u => (u.username||'').toLowerCase() === uname)) {
            showToast(`Akun dengan username "${uname}" sudah ada`, 'error'); return;
          }
          if (role === 'Peserta' && freshUsers.filter(u => u.role === 'Peserta').length >= 150) {
            showToast('Maks 150 slot Peserta tercapai', 'error'); return;
          }

          const defaultPw = typeof window._generateTempPassword === 'function'
            ? window._generateTempPassword()
            : (Math.random().toString(36).slice(2) + 'A1!').slice(0, 10);

          sha256(defaultPw).then(hashedPw => {
            // [BUG FIX 3 analog] cek ulang setelah async
            let finalUsers = JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]');
            if (finalUsers.find(u => (u.username||'').toLowerCase() === uname)) {
              showToast(`Username "${uname}" sudah ada`, 'error'); return;
            }
            if (typeof window._filterTombstoned === 'function') {
              finalUsers = window._filterTombstoned('users', finalUsers);
            }
            finalUsers.push({
              id: Date.now(), username: uname, password: hashedPw,
              role, name: nama, active: true, mustChangePassword: true,
              created: new Date().toISOString().split('T')[0],
              // [BUG FIX] Record user SEBELUMNYA tidak pernah diberi timestamp
              // sama sekali. detectConflict() di shared-utils.js — yang menentukan
              // versi mana yang menang saat data user digabung dari 2 device —
              // membaca field "_updatedAt"; tanpa field ini, device manapun yang
              // SUDAH punya salinan lokal user dengan id yang sama akan SELALU
              // mempertahankan datanya sendiri, mengabaikan perubahan role/status
              // dari device lain (persis kasus role/akses yang tidak ikut ke
              // device lain).
              _updatedAt: new Date().toISOString(),
              _updatedBy: (window.currentUser && (window.currentUser.name || window.currentUser.username)) || 'system'
            });
            if (typeof saveUsers === 'function') saveUsers(finalUsers);

            // Auto-link ke karyawan
            try {
              const karList  = JSON.parse(localStorage.getItem('sjnam_karyawan_v1') || '[]');
              const karEntry = karList.find(k => k.id === karId);
              if (karEntry && !karEntry.username) {
                karEntry.username = uname;
                localStorage.setItem('sjnam_karyawan_v1', JSON.stringify(karList));
                if (typeof triggerAutoSync === 'function') triggerAutoSync('karyawan');
                if (typeof window.renderKaryawanTable === 'function') window.renderKaryawanTable();
              }
            } catch (e) { console.warn('Auto-link karyawan gagal', e); }

            if (window._STATION_FILTER_ROLES?.includes(role)) {
              try {
                const _kl = JSON.parse(localStorage.getItem('sjnam_karyawan_v1')||'[]');
                const _ke = _kl.find(k => k.id === karId);
                if (_ke && (!_ke.station || _ke.station === '')) {
                  showToast(`⚠️ Akun dibuat tapi station karyawan belum diisi`, 'error');
                }
              } catch (e) {}
            }

            try { navigator.clipboard?.writeText(defaultPw); } catch (e) {}
            renderUserTable();
            modal.remove();
            alert(`Akun "${uname}" berhasil dibuat!\nPassword sementara: ${defaultPw}\n(sudah tersalin ke clipboard — wajib diganti saat login pertama)`);
            showToast(`Akun "${uname}" (${esc(role)}) berhasil dibuat`, 'success');
          }).catch(() => showToast('Gagal hash password, coba lagi', 'error'));

        } catch (unexpectedErr) {
          console.error('[_add-role-kar-btn] Error tak terduga:', unexpectedErr);
          showToast('Gagal membuat akun — error tak terduga: ' + (unexpectedErr?.message || unexpectedErr), 'error');
        }
      });
    });
  }

  renderList('');
  document.getElementById('_addRoleSearch').addEventListener('input', function () { renderList(this.value.trim()); });
  document.getElementById('_addRoleCancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ── EDIT USER MODAL ────────────────────────────────────────────────────────
function openEditUserModal(id) {
  const isMasterOrAdmin = window.currentUser && (window.currentUser.role === 'Admin' || window.currentUser.role === 'Master');
  const isCoAdmin       = window.currentUser && window.currentUser.role === 'Co-Admin';
  if (!isMasterOrAdmin && !isCoAdmin) {
    showToast('Akses ditolak: tidak ada izin untuk mengedit user', 'error'); return;
  }

  const users = JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]');
  const user  = users.find(u => u.id === id);
  if (!user) { showToast('User tidak ditemukan', 'error'); return; }

  if (user.role === 'Master' && window.currentUser.role !== 'Master') {
    showToast('Akun Master hanya dapat diedit oleh Master', 'error'); return;
  }
  if (isCoAdmin && (user.role === 'Admin' || user.role === 'Master')) {
    showToast('Co-Admin tidak dapat mengubah akun Admin/Master', 'error'); return;
  }
  if (isCoAdmin && user.role === 'Co-Admin' && user.username !== window.currentUser.username) {
    showToast('Co-Admin tidak dapat mengubah akun Co-Admin lain', 'error'); return;
  }

  document.getElementById('editUserId').value       = id;
  document.getElementById('editUserUsername').value = user.username;

  // [BUG FIX C] Role dropdown sesuai hak
  const roleSelect = document.getElementById('editUserRole');
  if (roleSelect) {
    const allRoles = (typeof window.ALL_ROLES !== 'undefined' && window.ALL_ROLES.length)
      ? window.ALL_ROLES
      : ['Master','Admin','Co-Admin','User-All','User-SR','User-STCR','User-ST','User-DRG','User','Peserta'];
    const allowedRoles = isMasterOrAdmin
      ? allRoles
      : allRoles.filter(r => r !== 'Admin' && r !== 'Master' && r !== 'Co-Admin');
    roleSelect.innerHTML = allowedRoles.map(r =>
      `<option value="${r}" ${r === user.role ? 'selected' : ''}>${r}</option>`
    ).join('');
    roleSelect.disabled = isCoAdmin;
    const wrap = roleSelect.closest('div');
    if (wrap) wrap.style.opacity = isCoAdmin ? '0.5' : '';
  }

  const activeChk = document.getElementById('editUserActive');
  if (activeChk) {
    activeChk.checked  = !!user.active;
    activeChk.disabled = (user.username === window.currentUser.username);
    const wrap = document.getElementById('editUserStatusWrap');
    if (wrap) wrap.style.opacity = (user.username === window.currentUser.username) ? '0.5' : '';
  }

  document.getElementById('editUserModal')?.classList.remove('hidden');
}
window.openEditUserModal = openEditUserModal;
window.editUser          = openEditUserModal;

// ── EDIT ROLE SAVE ─────────────────────────────────────────────────────────
document.getElementById('editUserModalSave')?.addEventListener('click', function () {
  const id       = parseInt(document.getElementById('editUserId')?.value || '');
  if (isNaN(id)) { showToast('ID tidak valid', 'error'); return; }
  const newRole  = document.getElementById('editUserRole')?.value || '';
  const isActive = document.getElementById('editUserActive')?.checked;

  const isMasterOrAdmin = window.currentUser && (window.currentUser.role === 'Admin' || window.currentUser.role === 'Master');
  let users = JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]');
  const user = users.find(u => u.id === id);
  if (!user) { showToast('Akun tidak ditemukan', 'error'); return; }

  if (isMasterOrAdmin && newRole && newRole !== user.role) {
    if (newRole === 'Peserta' && user.role !== 'Peserta') {
      if (users.filter(u => u.role === 'Peserta').length >= 150) {
        showToast('Maksimal 150 akun Peserta tercapai', 'error'); return;
      }
    }
    user.role = newRole;
  }

  if (user.username !== window.currentUser.username) {
    user.active = isActive;
  }

  // [BUG FIX — REVISI] Sebelumnya stamping hanya dilakukan KALAU role/status
  // benar-benar berubah dibanding nilai yang sudah ada di memori. Masalahnya:
  // untuk akun yang PERNAH diedit sebelum fix ini ada (role sudah benar
  // tersimpan LOKAL tapi belum pernah di-stamp _updatedAt), klik "Simpan"
  // tanpa mengubah dropdown (karena rolenya memang sudah benar) TIDAK
  // menghasilkan timestamp baru sama sekali — sehingga device lain tetap
  // tidak pernah menerima data itu sebagai "lebih baru". Klik tombol Simpan
  // adalah tindakan eksplisit Admin/Master untuk mengonfirmasi kondisi akun
  // ini sekarang — jadi SELALU distamp setiap kali tombol ini diklik,
  // apa pun isinya, supaya data lama yang belum pernah ter-stamp bisa
  // "dibetulkan" cukup dengan membuka modal ini lalu klik Simpan sekali.
  user._updatedAt = new Date().toISOString();
  user._updatedBy = (window.currentUser && (window.currentUser.name || window.currentUser.username)) || 'system';

  if (user.username === window.currentUser.username) {
    window.currentUser.role = user.role;
    localStorage.setItem('sjnam_session_v1', JSON.stringify(window.currentUser));
    const roleEl  = document.getElementById('userRoleDisplay');
    const roleElS = document.getElementById('userRoleDisplaySide');
    if (roleEl)  roleEl.textContent  = (['Admin','Co-Admin','Master'].includes(user.role)) ? user.role : '';
    if (roleElS) roleElS.textContent = user.role;
  }

  if (typeof saveUsers === 'function') saveUsers(users);
  document.getElementById('editUserModal')?.classList.add('hidden');
  renderUserTable();
  showToast('Role berhasil diperbarui', 'success');
});

document.getElementById('editUserModalCancel')?.addEventListener('click', function () {
  document.getElementById('editUserModal')?.classList.add('hidden');
});
document.getElementById('editUserModal')?.addEventListener('click', function (e) {
  if (e.target === this) this.classList.add('hidden');
});

function deleteUser(id) { deleteSingleUser(id); }
window.deleteUser     = deleteUser;
window.renderUserTable = renderUserTable;
