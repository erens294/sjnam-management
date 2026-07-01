/* ================================================================
   SJNAM — MODUL CORE / AUTH
   ================================================================
   Modul ini menggantikan +10 blok <script> yang sebelumnya tersebar
   di index.html (auth, login, session, idle-timeout, permission).

   KONSOLIDASI YANG DILAKUKAN (lihat REFACTOR_NOTES.md untuk detail):
   - window.applyPermissions sebelumnya didefinisikan ulang 4x secara
     berantai (line ~9547, ~13227, ~17493, ~17963, ~18382 di file asli).
     Definisi pertama (9547) dan kedua (13227) TIDAK PERNAH benar-benar
     berjalan karena langsung ditimpa total oleh "P3 unified" sebelum
     ada user yang login — keduanya dihapus di modul ini, hanya logic
     final (unified + 2 wrapper) yang dipertahankan.
   - window.switchTab is wrapped here with a permission-gate layer (role-
     based tab access control + current-tab persistence + sidebar sync).
     This logic previously lived inline in index.html as part of the same
     auth block this module replaces. [CORRECTION] An earlier version of
     this module mistakenly omitted this wrapper, treating it as dead
     code like the duplicate applyPermissions definitions — it is NOT
     dead code, and has been restored. Two further switchTab wrappers
     still remain inline in index.html (Enhanced-features admin-perm-
     table refresh, and Drygoods tab rendering) — both correctly chain
     via _origSwitchTab.apply(), so they are left untouched for now.

   BUG KEAMANAN KRITIS YANG DIPERBAIKI:
   - [FIXED] Versi asli punya backdoor: SETIAP akun dengan role 'Master'
     bisa login dengan password plaintext hardcoded 'Nu55y294gpx',
     TERLEPAS dari hash password yang tersimpan. Kombinasi dengan
     username default 'master' = celah keamanan kritis yang bisa
     dieksploitasi siapa pun yang membaca source code (yang ter-expose
     penuh di single-file HTML ini). Backdoor ini DIHAPUS di sini.
     Password Master sekarang HARUS diverifikasi via hash seperti role lain.
     -> TINDAKAN DIPERLUKAN: ganti password akun 'master' segera setelah
        deploy modul ini, karena hash lama (berasal dari password yang
        sama) sudah terekspos di riwayat kode.
   ================================================================ */

(function () {
  'use strict';

  // ===== KONSTANTA =====
  const USERS_KEY = 'sjnam_users_v1';
  const SESSION_KEY = 'sjnam_session_v1';
  const CURRENT_TAB_KEY = 'sjnam_current_tab';
  const KARYAWAN_KEY = 'sjnam_karyawan_v1';
  const BF_KEY = 'sjnam_bf_v1';
  const PERM_KEY = 'sjnam_role_perms_v1';
  const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 menit
  const WARN_BEFORE = 60 * 1000;       // peringatan 1 menit sebelum

  let currentUser = null;

  // ===== ROLE DEFINITIONS =====
  // Role kustom non-bawaan (selain Master/Admin/Co-Admin/User/Peserta).
  const CUSTOM_ROLES = [
    { key: 'userall',  label: 'User-All',  roleName: 'User-All',  accent: 'accent-emerald-600', badgeClass: 'bg-emerald-100 text-emerald-700', headerTextClass: 'text-emerald-700 dark:text-emerald-300', headerColor: '#059669' },
    { key: 'usersr',   label: 'User-SR',   roleName: 'User-SR',   accent: 'accent-blue-600',    badgeClass: 'bg-blue-100 text-blue-700',       headerTextClass: 'text-blue-700 dark:text-blue-300',       headerColor: '#2563eb' },
    { key: 'userstcr', label: 'User-STCR', roleName: 'User-STCR', accent: 'accent-purple-600',  badgeClass: 'bg-purple-100 text-purple-700',   headerTextClass: 'text-purple-700 dark:text-purple-300',   headerColor: '#7c3aed' },
    { key: 'userst',   label: 'User-ST',   roleName: 'User-ST',   accent: 'accent-teal-600',    badgeClass: 'bg-teal-100 text-teal-700',       headerTextClass: 'text-teal-700 dark:text-teal-300',       headerColor: '#0d9488' },
    { key: 'userdrg',  label: 'User-DRG',  roleName: 'User-DRG',  accent: 'accent-orange-600',  badgeClass: 'bg-orange-100 text-orange-700',   headerTextClass: 'text-orange-700 dark:text-orange-300',   headerColor: '#ea580c' },
  ];
  window.CUSTOM_ROLES = CUSTOM_ROLES;
  window.ALL_ROLES = ['Master', 'Admin', 'Co-Admin', 'User', 'Peserta', ...CUSTOM_ROLES.map(r => r.roleName)];
  window._STATION_FILTER_ROLES = ['User-DRG', 'User-SR', 'User-STCR', 'User-ST'];

  window.roleNameToKey = function (roleName) {
    if (roleName === 'Master') return 'master';
    if (roleName === 'Co-Admin') return 'coAdmin';
    if (roleName === 'User') return 'user';
    if (roleName === 'Peserta') return 'peserta';
    const custom = CUSTOM_ROLES.find(r => r.roleName === roleName);
    return custom ? custom.key : null; // null = role tak dikenal -> fail-closed
  };

  // Feature -> default permission per role (dipakai tabel "Atur Akses Role")
  const FEATURES = [
    { id: 'tab-home',       label: '🏠 Tab Home',           def: { coAdmin: true,  user: true,  peserta: false, userall: false, usersr: false, userstcr: false, userst: false, userdrg: false } },
    { id: 'tab-input',      label: '✈️ Tab Input',           def: { coAdmin: true,  user: true,  peserta: false, userall: false, usersr: false, userstcr: false, userst: false, userdrg: false } },
    { id: 'tab-data',       label: '📊 Tab Data',            def: { coAdmin: true,  user: true,  peserta: false, userall: false, usersr: false, userstcr: false, userst: false, userdrg: false } },
    { id: 'tab-dashboard',  label: '📈 Tab Dashboard',       def: { coAdmin: true,  user: true,  peserta: false, userall: false, usersr: false, userstcr: false, userst: false, userdrg: false } },
    { id: 'tab-request',    label: '📝 Tab Approval',        def: { coAdmin: true,  user: false, peserta: false, userall: false, usersr: false, userstcr: false, userst: false, userdrg: false } },
    { id: 'tab-stations',   label: '🗺️ Tab Station',         def: { coAdmin: true,  user: false, peserta: false, userall: false, usersr: false, userstcr: false, userst: false, userdrg: false } },
    { id: 'tab-dfs',        label: '🗂️ Tab DFS Bank',        def: { coAdmin: true,  user: false, peserta: false, userall: false, usersr: false, userstcr: false, userst: false, userdrg: false } },
    { id: 'tab-materi',     label: '📚 Tab Materi Training', def: { coAdmin: true,  user: false, peserta: false, userall: false, usersr: false, userstcr: false, userst: false, userdrg: false } },
    { id: 'tab-soal',       label: '📝 Tab Soal Training',   def: { coAdmin: true,  user: true,  peserta: false, userall: false, usersr: false, userstcr: false, userst: false, userdrg: false } },
    { id: 'tab-sertifikat', label: '🎓 Tab Sertifikat',      def: { coAdmin: true,  user: false, peserta: false, userall: false, usersr: false, userstcr: false, userst: false, userdrg: false } },
    { id: 'tab-admin',      label: '👥 Tab Admin/User Mgmt', def: { coAdmin: true,  user: false, peserta: false, userall: false, usersr: false, userstcr: false, userst: false, userdrg: false } },
    { id: 'tab-settings',   label: '⚙️ Tab Settings',        def: { coAdmin: true,  user: false, peserta: false, userall: false, usersr: false, userstcr: false, userst: false, userdrg: false } },
    { id: 'tab-stcr-dashboard',     label: '🏥 STCR – Dashboard',     def: { coAdmin: true, user: true,  peserta: false, userall: false, usersr: false, userstcr: false, userst: false, userdrg: false } },
    { id: 'tab-stcr-data',          label: '📋 STCR – Data Request',  def: { coAdmin: true, user: true,  peserta: false, userall: false, usersr: false, userstcr: false, userst: false, userdrg: false } },
    { id: 'tab-stcr-station',       label: '📍 STCR – Station',       def: { coAdmin: true, user: false, peserta: false, userall: false, usersr: false, userstcr: false, userst: false, userdrg: false } },
    { id: 'tab-drygoods-data',      label: '📦 Drygoods – Data Stok',  def: { coAdmin: true, user: true,  peserta: false, userall: false, usersr: false, userstcr: false, userst: false, userdrg: true } },
    { id: 'tab-drygoods-dashboard', label: '📊 Drygoods – Dashboard',  def: { coAdmin: true, user: true,  peserta: false, userall: false, usersr: false, userstcr: false, userst: false, userdrg: true } },
    { id: 'tab-drygoods-ifs',       label: '🏢 Drygoods – IFS Station', def: { coAdmin: true, user: true, peserta: false, userall: false, usersr: false, userstcr: false, userst: false, userdrg: true } },
    { id: 'tab-drygoods-bankitem',  label: '🗂️ Drygoods – Bank Item', def: { coAdmin: true, user: false, peserta: false, userall: false, usersr: false, userstcr: false, userst: false, userdrg: false } },
    { id: 'feat-import', label: '⬆️ Fitur Import Data',     def: { coAdmin: true, user: false, peserta: false, userall: false, usersr: false, userstcr: false, userst: false, userdrg: false } },
    { id: 'feat-delete', label: '🗑️ Fitur Hapus Data',      def: { coAdmin: true, user: false, peserta: false, userall: false, usersr: false, userstcr: false, userst: false, userdrg: false } },
    { id: 'feat-edit',   label: '✏️ Fitur Edit Data',       def: { coAdmin: true, user: false, peserta: false, userall: false, usersr: false, userstcr: false, userst: false, userdrg: false } },
    { id: 'feat-mulai',  label: '🚀 Mulai Training Peserta', def: { coAdmin: true, user: true, peserta: true, userall: false, usersr: false, userstcr: false, userst: false, userdrg: false } },
  ];

  // ===== PASSWORD HASHING (SHA-256) =====
  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Backward-compat: password tersimpan bisa hash (64 hex) atau (lama) plain text.
  async function verifyPassword(inputPass, storedPass) {
    if (!storedPass) return false;
    if (/^[0-9a-f]{64}$/.test(storedPass)) {
      const h = await sha256(inputPass);
      return h === storedPass;
    }
    return inputPass === storedPass;
  }

  // ===== BRUTE-FORCE PROTECTION =====
  function getBFState() {
    try { return JSON.parse(localStorage.getItem(BF_KEY) || '{}'); } catch (e) { return {}; }
  }
  function setBFState(state) { localStorage.setItem(BF_KEY, JSON.stringify(state)); }
  function checkBFLocked(username) {
    const state = getBFState();
    const entry = state[username];
    if (!entry) return false;
    if (entry.lockedUntil && Date.now() < entry.lockedUntil) return entry.lockedUntil;
    return false;
  }
  function recordBFFail(username) {
    const state = getBFState();
    if (!state[username]) state[username] = { fails: 0, lockedUntil: 0 };
    const locked = state[username].lockedUntil && Date.now() < state[username].lockedUntil;
    if (locked) return;
    state[username].fails = (state[username].fails || 0) + 1;
    if (state[username].fails >= 5) {
      state[username].lockedUntil = Date.now() + 5 * 60 * 1000;
      state[username].fails = 0;
    }
    setBFState(state);
  }
  function resetBFState(username) {
    const state = getBFState();
    if (state[username]) delete state[username];
    setBFState(state);
  }

  function updateLoginLockMsg(username, lockedUntil) {
    const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
    const mins = Math.floor(remaining / 60), secs = remaining % 60;
    const el = document.getElementById('loginLockMsg');
    if (!el) return;
    if (remaining > 0) {
      el.textContent = `🔒 Akun terkunci. Coba lagi dalam ${mins}:${String(secs).padStart(2, '0')} menit`;
      el.style.display = 'block';
      const btn = document.getElementById('loginBtnSubmit');
      if (btn) btn.disabled = true;
    } else {
      el.textContent = '';
      el.style.display = 'none';
      const btn = document.getElementById('loginBtnSubmit');
      if (btn) btn.disabled = false;
    }
  }

  let _bfCountdownInterval = null;
  function startBFCountdown() {
    if (_bfCountdownInterval) return;
    _bfCountdownInterval = setInterval(() => {
      const overlay = document.getElementById('loginOverlay');
      if (!overlay || overlay.style.display === 'none') {
        clearInterval(_bfCountdownInterval);
        _bfCountdownInterval = null;
        return;
      }
      const unEl = document.getElementById('loginUser');
      const lmEl = document.getElementById('loginLockMsg');
      if (!lmEl || lmEl.style.display === 'none') return;
      const username = unEl ? unEl.value.trim().toLowerCase() : '';
      if (!username) return;
      const lu = checkBFLocked(username);
      if (lu) updateLoginLockMsg(username, lu);
      else updateLoginLockMsg(username, 0);
    }, 1000);
  }

  // ===== USER STORE =====
  function initUsers() {
    let users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    if (users.length === 0) {
      // PERHATIAN: kredensial default ini PUBLIK (ada di source code).
      // Wajib diganti oleh Admin segera setelah deployment pertama.
      users = [
        { id: 0, username: 'master',  password: '73ce9bfb64f5278e8eb85209fa6b546f6219acbe713da3538e0e6223f3b5eff2', role: 'Master',  name: 'Master Administrator', active: true, created: '2026-01-01', mustChangePassword: true },
        { id: 1, username: 'admin',   password: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', role: 'Admin',    name: 'Administrator',       active: true, created: '2026-01-01', mustChangePassword: true },
        { id: 2, username: 'coadmin', password: '5cbb590cbdb0ea0632a0068e808b44252646799c8bff4834a517f440eea955e5', role: 'Co-Admin', name: 'Co Administrator',    active: true, created: '2026-01-01', mustChangePassword: true },
        { id: 3, username: 'user',    password: 'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446', role: 'User',     name: 'Operator User',       active: true, created: '2026-01-01', mustChangePassword: true },
        { id: 4, username: 'peserta', password: 'b1d0478adc310cdc9ee7ed33b201677e5fd3cd3d10eb10e5086472b2248f00c5', role: 'Peserta',  name: 'Peserta Training',    active: true, created: '2026-01-01', mustChangePassword: true },
      ];
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
    return users;
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    if (typeof window.markDirty === 'function') window.markDirty('users');
    if (typeof window.triggerAutoSync === 'function') window.triggerAutoSync('users');
  }
  window.saveUsers = saveUsers;

  function _unlinkKaryawanByUsernames(usernameList) {
    if (!Array.isArray(usernameList) || !usernameList.length) return;
    try {
      const kar = JSON.parse(localStorage.getItem(KARYAWAN_KEY) || '[]');
      let changed = false;
      kar.forEach(function (k) {
        if (k.username && usernameList.includes(k.username)) {
          k.username = '';
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem(KARYAWAN_KEY, JSON.stringify(kar));
        if (typeof window.triggerAutoSync === 'function') window.triggerAutoSync('karyawan');
        if (typeof window.renderKaryawanTable === 'function') window.renderKaryawanTable();
      }
    } catch (e) { console.warn('[unlinkKaryawan]', e); }
  }
  window._unlinkKaryawanByUsernames = _unlinkKaryawanByUsernames;

  // SHA-256 migration for any legacy plaintext passwords still in storage.
  window._pwMigrationDone = (async function migratePasswordsToSHA256() {
    const MIGRATED_KEY = 'sjnam_pw_migrated_v1';
    if (localStorage.getItem(MIGRATED_KEY)) return;
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    if (!users.length) { localStorage.setItem(MIGRATED_KEY, '1'); return; }
    let changed = 0;
    for (const u of users) {
      if (u.password && !/^[0-9a-f]{64}$/.test(u.password)) {
        u.password = await sha256(u.password);
        changed++;
      }
    }
    if (changed > 0) localStorage.setItem(USERS_KEY, JSON.stringify(users));
    localStorage.setItem(MIGRATED_KEY, '1');
  })();

  // ===== ROLE PERMISSIONS TABLE (localStorage-backed) =====
  function loadPerms() {
    try { return JSON.parse(localStorage.getItem(PERM_KEY)) || null; } catch (e) { return null; }
  }
  function getDefaultPerms() {
    const p = {};
    FEATURES.forEach(f => { p[f.id] = { ...f.def }; });
    return p;
  }
  function getPerms() {
    const s = loadPerms();
    if (!s) return getDefaultPerms();
    const d = getDefaultPerms(), m = {};
    Object.keys(d).forEach(id => { m[id] = Object.assign({}, d[id], s[id] || {}); });
    return m;
  }
  window.getRolePerms = getPerms;

  function savePerms(p) {
    localStorage.setItem(PERM_KEY, JSON.stringify(p));
    window._rolePermsLocalDirty = true;
    if (typeof window.cloudPush === 'function' && typeof window.cloudConfig !== 'undefined' &&
        window.cloudConfig.supabaseUrl && window.cloudConfig.supabaseKey) {
      window.cloudPush(true).then(ok => { if (ok) window._rolePermsLocalDirty = false; })
        .catch(() => { if (typeof window.triggerAutoSync === 'function') window.triggerAutoSync(); });
    } else if (typeof window.triggerAutoSync === 'function') {
      window.triggerAutoSync();
    }
  }
  window.saveRolePerms = savePerms;
  window.getDefaultRolePerms = getDefaultPerms;
  window.PERM_FEATURES = FEATURES;

  // ===== STATION HELPERS (dipakai role station-bound: SR/STCR/ST/DRG) =====
  window.getUserStation = function (role, username) {
    if (!window._STATION_FILTER_ROLES.includes(role)) return null;
    try {
      const karyawan = JSON.parse(localStorage.getItem(KARYAWAN_KEY) || '[]');
      const uname = (username || '').toLowerCase();
      const entry = karyawan.find(k => (k.username || '').toLowerCase() === uname);
      const st = entry && entry.station ? String(entry.station).trim() : null;
      return (st && st !== 'ALL') ? st : null;
    } catch (e) {
      console.warn('[getUserStation]', e);
      return null;
    }
  };

  window._applyStationLockForUser = function (role, username) {
    const station = window.getUserStation(role, username);
    window._userStationLock = station;
    window._userDrgStation = station; // backward-compat
    if (window.currentUser) window.currentUser.station = station;
    return station;
  };

  // expose for other modules
  window._authInternal = {
    USERS_KEY, SESSION_KEY, CURRENT_TAB_KEY, KARYAWAN_KEY, BF_KEY, PERM_KEY,
    sha256, verifyPassword, getBFState, checkBFLocked, recordBFFail, resetBFState,
  };

  // ================================================================
  // LOGIN
  // ================================================================
  async function handleLoginSubmit(e) {
    e.preventDefault();
    if (window._pwMigrationDone) await window._pwMigrationDone;

    const username = document.getElementById('loginUser').value.trim().toLowerCase();
    const password = document.getElementById('loginPass').value;

    const lockedUntil = checkBFLocked(username);
    if (lockedUntil) {
      updateLoginLockMsg(username, lockedUntil);
      document.getElementById('loginPass').value = '';
      return;
    }

    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const userCandidate = users.find(u => u.username.toLowerCase() === username && u.active);

    // [SECURITY FIX] Backdoor plaintext password untuk role Master DIHAPUS.
    // Semua role, termasuk Master, sekarang diverifikasi via hash password
    // yang tersimpan — tidak ada bypass berdasarkan nama role.
    const passwordOk = userCandidate ? await verifyPassword(password, userCandidate.password) : false;
    const user = passwordOk ? userCandidate : null;

    if (!user) {
      const failsBefore = (getBFState()[username] || {}).fails || 0;
      recordBFFail(username);
      const newLock = checkBFLocked(username);
      const fails = failsBefore + 1;
      if (newLock) {
        updateLoginLockMsg(username, newLock);
        if (typeof showToast === 'function') showToast('⛔ Terlalu banyak percobaan! Akun dikunci 5 menit.', 'error');
      } else if (typeof showToast === 'function') {
        showToast(`Username atau password salah. Percobaan ${fails}/5.`, 'error');
      }
      document.getElementById('loginPass').value = '';
      document.getElementById('loginPass').focus();
      return;
    }

    resetBFState(username);

    let displayName = user.name;
    try {
      const kar = JSON.parse(localStorage.getItem(KARYAWAN_KEY) || '[]');
      const karMe = kar.find(k => (k.username || '').toLowerCase() === (user.username || '').toLowerCase());
      if (karMe && karMe.nama) displayName = karMe.nama;
    } catch (e) {}
    if (displayName !== user.name) {
      try {
        const usrs = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
        const u = usrs.find(x => x.username === user.username);
        if (u) { u.name = displayName; localStorage.setItem(USERS_KEY, JSON.stringify(usrs)); }
      } catch (e) {}
      user.name = displayName;
    }

    currentUser = { username: user.username, role: user.role, name: displayName, loginTime: Date.now() };
    window.currentUser = currentUser;
    localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));

    _updateUserPanelUI(user, displayName);
    _restoreMenuAccordionState(user);

    applyPermissions();
    requestAnimationFrame(() => {
      document.body.classList.add('js-ready');
      restoreSession();
    });

    if (user.mustChangePassword) {
      setTimeout(() => {
        if (typeof window._showForceChangePasswordModal === 'function') {
          window._showForceChangePasswordModal(user);
        }
      }, 400);
      if (typeof showToast === 'function') showToast('⚠️ Anda wajib mengganti password sebelum melanjutkan', 'error');
      return;
    }

    if (typeof showToast === 'function') showToast('Selamat datang, ' + user.name + '!', 'success');
  }

  function _updateUserPanelUI(user, displayName) {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
    document.getElementById('userPanel')?.classList.remove('hidden');
    document.getElementById('userPanel')?.classList.add('flex');
    const nameEl = document.getElementById('userNameDisplay');
    if (nameEl) nameEl.textContent = displayName;
    const roleEl = document.getElementById('userRoleDisplay');
    if (roleEl) {
      const showRole = (user.role === 'Admin' || user.role === 'Co-Admin' || user.role === 'Master');
      roleEl.textContent = showRole ? user.role : '';
      roleEl.style.display = showRole ? '' : 'none';
    }
    const sideNameEl = document.getElementById('userNameDisplaySide');
    const sideRoleEl = document.getElementById('userRoleDisplaySide');
    if (sideNameEl) sideNameEl.textContent = displayName;
    if (sideRoleEl) {
      let roleDisplay = user.role;
      if (user.role === 'User-DRG') {
        try {
          const kar = JSON.parse(localStorage.getItem(KARYAWAN_KEY) || '[]');
          const karMe = kar.find(k => (k.username || '').toLowerCase() === (user.username || '').toLowerCase());
          if (karMe && karMe.station) roleDisplay = user.role + ' · ' + karMe.station;
        } catch (e) {}
      }
      sideRoleEl.textContent = roleDisplay;
    }
    document.getElementById('userPanelSidebar')?.classList.remove('hidden');
  }

  function _restoreMenuAccordionState(user) {
    const sfx = '_' + user.username;
    function sm(contentId, iconId, btnId, key, defaultOpen) {
      const c = document.getElementById(contentId);
      const icon = document.getElementById(iconId);
      const btn = document.getElementById(btnId);
      const saved = localStorage.getItem(key);
      const open = saved !== null ? saved === '1' : defaultOpen;
      if (!c) return;
      if (open) { c.classList.remove('collapsed'); c.setAttribute('aria-hidden', 'false'); }
      else { c.classList.add('collapsed'); c.setAttribute('aria-hidden', 'true'); }
      if (icon) icon.style.transform = open ? 'rotate(0deg)' : 'rotate(-90deg)';
      if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    const isAdminOrCo = user.role === 'Admin' || user.role === 'Co-Admin' || user.role === 'Master';
    sm('serviceRecoveryMenuContent', 'iconServiceRecoveryMenu', 'toggleServiceRecoveryMenu', 'sidenav_svcrecovery_open' + sfx, isAdminOrCo);
    sm('adminMenuContent', 'iconAdminMenu', 'toggleAdminMenu', 'sidenav_admin_open' + sfx, isAdminOrCo);
    sm('stcrMenuContent', 'iconStcrMenu', 'toggleStcrMenu', 'sidenav_stcr_open' + sfx, isAdminOrCo);
    sm('trainingMenuContent', 'iconTrainingMenu', 'toggleTrainingMenu', 'sjnam_training_menu_open' + sfx, isAdminOrCo);
    sm('drygoodsMenuContent', 'iconDrygoodsMenu', 'toggleDrygoodsMenu', 'sjnam_drygoods_menu_open' + sfx, isAdminOrCo);
  }

  // ================================================================
  // LOGOUT
  // ================================================================
  function handleLogout() {
    if (!confirm('Keluar dari sistem?')) return;
    if (typeof window.cloudPush === 'function') window.cloudPush(true);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('sjnam_current_admin_subtab');
    currentUser = null;
    window.currentUser = null;
    if (window._idleCountdownInterval) { clearInterval(window._idleCountdownInterval); window._idleCountdownInterval = null; }
    const overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.style.display = '';
    document.getElementById('userPanel')?.classList.add('hidden');
    document.getElementById('userPanelSidebar')?.classList.add('hidden');
    document.getElementById('sidebar')?.classList.remove('perm-ready');
    document.getElementById('mainContent')?.classList.remove('perm-ready');
    document.body.classList.remove('js-ready');
    document.body.style.overflow = 'hidden';
    const lu = document.getElementById('loginUser'); if (lu) lu.value = '';
    const lp = document.getElementById('loginPass'); if (lp) lp.value = '';
    setTimeout(() => document.getElementById('loginUser')?.focus(), 100);
  }

  // ================================================================
  // AUTO-LOGOUT setelah idle (30 menit, peringatan 1 menit sebelumnya)
  // ================================================================
  let idleTimer, warnTimer;
  function resetIdle() {
    if (!currentUser) return;
    clearTimeout(idleTimer);
    clearTimeout(warnTimer);
    if (window._idleCountdownInterval) { clearInterval(window._idleCountdownInterval); window._idleCountdownInterval = null; }
    const wb = document.getElementById('idleWarnBanner');
    if (wb) wb.style.display = 'none';

    warnTimer = setTimeout(() => {
      if (!currentUser) return;
      let wb2 = document.getElementById('idleWarnBanner');
      if (!wb2) {
        wb2 = document.createElement('div');
        wb2.id = 'idleWarnBanner';
        wb2.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#f59e0b;color:#fff;text-align:center;padding:10px 16px;z-index:99999;font-size:0.9rem;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.2)';
        document.body.appendChild(wb2);
      }
      wb2.style.display = 'block';
      wb2.innerHTML = '⚠️ Sesi akan otomatis keluar dalam <span id="idleCountdown">60</span> detik karena tidak aktif. <button onclick="resetIdle()" style="margin-left:12px;background:#fff;color:#f59e0b;border:none;border-radius:6px;padding:3px 12px;cursor:pointer;font-weight:700">Tetap Login</button>';
      let secs = 60;
      const countEl = document.getElementById('idleCountdown');
      if (window._idleCountdownInterval) clearInterval(window._idleCountdownInterval);
      const cdInterval = setInterval(() => {
        secs--;
        if (countEl) countEl.textContent = secs;
        if (secs <= 0) { clearInterval(cdInterval); window._idleCountdownInterval = null; }
      }, 1000);
      window._idleCountdownInterval = cdInterval;
    }, IDLE_TIMEOUT - WARN_BEFORE);

    idleTimer = setTimeout(() => {
      if (!currentUser) return;
      if (typeof window.cloudPush === 'function') window.cloudPush(true);
      localStorage.removeItem(SESSION_KEY);
      currentUser = null;
      window.currentUser = null;
      if (window._idleCountdownInterval) { clearInterval(window._idleCountdownInterval); window._idleCountdownInterval = null; }
      const ov = document.getElementById('loginOverlay');
      if (ov) ov.style.display = '';
      document.getElementById('userPanel')?.classList.add('hidden');
      document.getElementById('userPanelSidebar')?.classList.add('hidden');
      document.getElementById('sidebar')?.classList.remove('perm-ready');
      document.getElementById('mainContent')?.classList.remove('perm-ready');
      document.body.classList.remove('js-ready');
      document.body.style.overflow = 'hidden';
      const lu = document.getElementById('loginUser'); if (lu) lu.value = '';
      const lp = document.getElementById('loginPass'); if (lp) lp.value = '';
      if (typeof showToast === 'function') showToast('Sesi berakhir karena tidak aktif. Silakan login kembali.', 'error');
      setTimeout(() => document.getElementById('loginUser')?.focus(), 200);
    }, IDLE_TIMEOUT);
  }
  window.resetIdle = resetIdle;

  // ================================================================
  // PERMISSIONS (unified — satu-satunya definisi applyPermissions)
  // Admin/Master = akses penuh. Role lain dievaluasi via tabel rolePerms.
  // ================================================================
  function _setBtnDisplay(id, display, viaLabelParent) {
    const el = document.getElementById(id);
    if (!el) return;
    const target = viaLabelParent ? el.closest('label') : el;
    if (target) target.style.display = display;
  }
  function _grp(toggleBtnId) {
    return document.getElementById(toggleBtnId)?.closest('div') || null;
  }

  function applyPermissions() {
    const cu = window.currentUser || currentUser;
    if (!cu) return;
    const role = cu.role;
    const isMaster = role === 'Master';
    const isAdmin = role === 'Admin' || isMaster;

    if (isAdmin) {
      ['[data-tab]', '#tabAdminBtn'].forEach(sel => {
        document.querySelectorAll(sel).forEach(el => { el.style.display = ''; });
      });
      ['toggleAdminMenu', 'toggleServiceRecoveryMenu', 'toggleTrainingMenu', 'toggleStcrMenu', 'toggleDrygoodsMenu']
        .forEach(id => { const grp = _grp(id); if (grp) grp.style.display = ''; });
      const btnHomeEdit = document.getElementById('btnHomeEditToggle');
      if (btnHomeEdit) btnHomeEdit.style.display = '';
      _setBtnDisplay('fileImportJson', '', true);
      _setBtnDisplay('btnHapusSemua', '');
      _setBtnDisplay('btnStartPeserta', '');
      _setBtnDisplay('btnPesertaSidebarStart', '');
      _setBtnDisplay('btnSyncService', '');
      _setBtnDisplay('btnClearPeserta', '');
      const bbs = document.querySelector('[data-soal-subtab="bank"]');
      if (bbs) bbs.style.display = '';
      window.currentUserReadOnly = false;
      window.currentUserCanDelete = true;
      window.currentUserCanAdd = true;
      window._userStationLock = null;
      window._userDrgStation = null;
      if (typeof window.renderUserTable === 'function') window.renderUserTable();
      _afterApplyPermissions(cu);
      return;
    }

    const roleKey = window.roleNameToKey(role);
    const perms = getPerms();
    function can(featId) {
      if (!roleKey) return false;
      return perms[featId] ? !!perms[featId][roleKey] : false;
    }

    const tabMap = {
      'tab-home': '[data-tab="home"]', 'tab-input': '[data-tab="input"]', 'tab-data': '[data-tab="data"]',
      'tab-dashboard': '[data-tab="dashboard"]', 'tab-request': '[data-tab="request"]', 'tab-stations': '[data-tab="stations"]',
      'tab-dfs': '[data-tab="dfs"]', 'tab-materi': '[data-tab="materi"]', 'tab-soal': '[data-tab="soal"]',
      'tab-sertifikat': '[data-tab="sertifikat"]', 'tab-settings': '[data-tab="settings"]',
      'tab-stcr-dashboard': '[data-tab="stcr-dashboard"]', 'tab-stcr-data': '[data-tab="stcr-data"]', 'tab-stcr-station': '[data-tab="stcr-station"]',
      'tab-drygoods-data': '[data-tab="drygoods-data"]', 'tab-drygoods-dashboard': '[data-tab="drygoods-dashboard"]',
      'tab-drygoods-ifs': '[data-tab="drygoods-ifs"]', 'tab-drygoods-bankitem': '[data-tab="drygoods-bankitem"]',
    };
    const adminTab = document.getElementById('tabAdminBtn');
    if (adminTab) adminTab.style.display = can('tab-admin') ? '' : 'none';
    Object.keys(tabMap).forEach(feat => {
      const el = document.querySelector(tabMap[feat]);
      if (el) el.style.display = can(feat) ? '' : 'none';
    });

    const grpAdmin = _grp('toggleAdminMenu'), grpSvc = _grp('toggleServiceRecoveryMenu'),
          grpTrain = _grp('toggleTrainingMenu'), grpStcr = _grp('toggleStcrMenu'), grpDg = _grp('toggleDrygoodsMenu');
    if (grpAdmin) grpAdmin.style.display = (can('tab-admin') || can('tab-settings') || can('tab-stations')) ? '' : 'none';
    if (grpSvc) grpSvc.style.display = (can('tab-input') || can('tab-data') || can('tab-dashboard') || can('tab-request') || can('tab-dfs')) ? '' : 'none';
    if (grpTrain) grpTrain.style.display = (can('tab-materi') || can('tab-soal') || can('feat-mulai') || can('tab-sertifikat')) ? '' : 'none';
    if (grpStcr) grpStcr.style.display = (can('tab-stcr-dashboard') || can('tab-stcr-data') || can('tab-stcr-station')) ? '' : 'none';
    if (grpDg) grpDg.style.display = (can('tab-drygoods-data') || can('tab-drygoods-dashboard') || can('tab-drygoods-ifs') || can('tab-drygoods-bankitem')) ? '' : 'none';

    const btnHE = document.getElementById('btnHomeEditToggle');
    const pnlHE = document.getElementById('homeEditPanel');
    if (btnHE) btnHE.style.display = 'none';
    if (pnlHE) pnlHE.style.display = 'none';

    _setBtnDisplay('fileImportJson', can('feat-import') ? '' : 'none', true);
    _setBtnDisplay('btnHapusSemua', can('feat-delete') ? '' : 'none');
    _setBtnDisplay('btnStartPeserta', can('feat-mulai') ? '' : 'none');
    _setBtnDisplay('btnPesertaSidebarStart', can('feat-mulai') ? '' : 'none');
    _setBtnDisplay('btnSyncService', can('tab-soal') ? '' : 'none');

    window.currentUserReadOnly = !can('feat-edit');
    window.currentUserCanDelete = can('feat-delete');
    window.currentUserCanAdd = can('feat-edit');

    if (window._STATION_FILTER_ROLES.includes(role)) {
      window._applyStationLockForUser(role, cu.username);
    } else {
      window._userStationLock = null;
      window._userDrgStation = null;
    }

    if (typeof window.renderUserTable === 'function') window.renderUserTable();
    if (role === 'Peserta') {
      setTimeout(() => { document.getElementById('btnStartPeserta')?.click(); }, 150);
    }
    _afterApplyPermissions(cu);
  }

  function _afterApplyPermissions(cu) {
    document.getElementById('sidebar')?.classList.add('perm-ready');
    document.getElementById('mainContent')?.classList.add('perm-ready');

    if (cu.role === 'User-STCR' && typeof window._enforceStcrStationFilter === 'function') {
      setTimeout(window._enforceStcrStationFilter, 400);
    }
    if (!window._expiryCheckedThisSession && typeof window._checkContractExpiry === 'function') {
      window._expiryCheckedThisSession = true;
      setTimeout(window._checkContractExpiry, 1500);
    }
    setTimeout(() => {
      if (!window._STATION_FILTER_ROLES.includes(cu.role)) return;
      const st = window.getUserStation(cu.role, cu.username);
      if (!st) return;
      const el = document.getElementById('userRoleDisplaySide');
      const el2 = document.getElementById('userRoleDisplay');
      if (el) el.textContent = cu.role + ' · ' + st;
      if (el2 && el2.style.display !== 'none') el2.textContent = cu.role + ' · ' + st;
    }, 200);
  }
  window.applyPermissions = applyPermissions;

  // ================================================================
  // SESSION RESTORE / TAB RESTORE
  // ================================================================
  function restoreSession() {
    const cu = window.currentUser || currentUser;
    if (cu && cu.role === 'Peserta') {
      window.switchTab('soal-peserta');
      return;
    }
    const savedTab = localStorage.getItem(CURRENT_TAB_KEY) || 'home';
    const tabBtn = document.querySelector(`[data-tab="${savedTab}"]`);
    if (tabBtn && tabBtn.style.display !== 'none') {
      window.switchTab(savedTab);
      // Jika tab yang aktif adalah 'admin', restore juga sub-tab-nya
      if (savedTab === 'admin') {
        const savedSubtab = localStorage.getItem('sjnam_current_admin_subtab');
        if (savedSubtab) {
          const subBtn = document.querySelector(`[data-admin-subtab="${savedSubtab}"]`);
          if (subBtn) setTimeout(() => subBtn.click(), 50);
        }
      }
    } else {
      const homeBtn = document.querySelector('[data-tab="home"]');
      if (homeBtn && homeBtn.style.display !== 'none') {
        window.switchTab('home');
      } else {
        const firstVisible = document.querySelector('.sidebar-btn[data-tab]:not([style*="display: none"])')?.dataset?.tab;
        if (firstVisible) window.switchTab(firstVisible);
        else if (typeof showToast === 'function') showToast('Akun belum diberi akses. Hubungi Admin.', 'error');
      }
    }
  }

  function checkAuth() {
    initUsers();
    const session = localStorage.getItem(SESSION_KEY);
    if (!session) {
      document.body.style.overflow = 'hidden';
      return;
    }
    try {
      const savedSession = JSON.parse(session);
      const allUsers = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      const stillValid = allUsers.find(u => u.username.toLowerCase() === savedSession.username.toLowerCase() && u.active);
      if (!stillValid) {
        localStorage.removeItem(SESSION_KEY);
        document.body.style.overflow = 'hidden';
        return;
      }
      currentUser = { username: stillValid.username, role: stillValid.role, name: stillValid.name, loginTime: savedSession.loginTime || Date.now() };
      window.currentUser = currentUser;
      localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));

      _updateUserPanelUI(currentUser, currentUser.name);
      _restoreMenuAccordionState(currentUser);
      applyPermissions();

      requestAnimationFrame(() => {
        document.body.classList.add('js-ready');
        restoreSession();
      });
    } catch (e) {
      localStorage.removeItem(SESSION_KEY);
      document.body.style.overflow = 'hidden';
      console.error('[AUTH] Gagal memuat sesi, fallback ke halaman login:', e);
    }
  }
  window.restoreSession = restoreSession;
  window.checkAuth = checkAuth;
  window.applyPermissionsCore = applyPermissions;

  // ================================================================
  // SWITCH TAB — permission gate (role-based access control)
  // ================================================================
  // [BUG FIX] Versi awal modul ini (Tahap 1) keliru menghapus wrapper
  // permission-gate switchTab saat mengekstrak blok auth dari index.html
  // asli, karena hanya melacak duplikasi applyPermissions dan tidak
  // menyadari window.switchTab juga di-override di blok yang sama
  // (originalSwitchTab = window.switchTab; window.switchTab = function(){...}).
  // Akibatnya proteksi akses tab berbasis role HILANG dari hasil refactor
  // — siapa pun bisa memanggil switchTab() ke tab apa pun terlepas dari
  // permission yang diset Admin, dan localStorage 'sjnam_current_tab'
  // tidak pernah ditulis (current-tab tidak ter-restore saat reload).
  // Wrapper ini DIKEMBALIKAN di sini agar urutan chain tetap sama seperti
  // semula: base switchTab (didefinisikan lebih awal di index.html) →
  // permission-gate ini (dipasang saat auth.js dimuat) → wrapper Enhanced-
  // features & Drygoods (dipasang lebih jauh di bawah index.html, masing-
  // masing mem-bungkus window.switchTab yang sudah ada di titik itu).
  const _originalSwitchTab = window.switchTab;
  if (typeof _originalSwitchTab === 'function') {
    window.switchTab = function (tab) {
      const cu = window.currentUser || currentUser;

      // Peserta: hanya wizard training yang diizinkan — hardcoded, tidak
      // bisa diberi akses tab lain meskipun lewat tabel "Atur Akses Role".
      if (cu && cu.role === 'Peserta') {
        if (tab !== 'soal-peserta') return; // silent block
      }

      // Semua role NON-ADMIN dicek generic via roleNameToKey() + tabel rolePerms.
      if (cu && cu.role !== 'Admin' && cu.role !== 'Master') {
        const perms = getPerms();
        const roleKey = window.roleNameToKey(cu.role);
        if (perms) {
          const featId = 'tab-' + tab;
          const allowed = roleKey ? (perms[featId] ? !!perms[featId][roleKey] : false) : false;
          if (tab !== 'soal-peserta' && !allowed) return; // silent block, fail-closed
        } else if (cu.role === 'User') {
          const userDefault = ['home', 'input', 'data', 'dashboard', 'soal', 'soal-peserta', 'stcr-dashboard', 'stcr-data', 'stcr-station', 'drygoods-data', 'drygoods-dashboard', 'drygoods-ifs', 'drygoods-bankitem'];
          if (!userDefault.includes(tab)) return;
        } else if (cu.role !== 'Co-Admin') {
          if (tab !== 'soal-peserta') return;
        }
      }

      _originalSwitchTab(tab);
      if (tab !== 'soal-peserta') localStorage.setItem(CURRENT_TAB_KEY, tab);
      if (typeof window.syncSidebarActive === 'function') window.syncSidebarActive(tab);
    };
  }

  // ================================================================
  // WIRING — dijalankan saat DOM siap
  // ================================================================
  function initAuthModule() {
    document.getElementById('loginForm')?.addEventListener('submit', handleLoginSubmit);
    document.getElementById('btnLogout')?.addEventListener('click', handleLogout);
    // NOTE: btnLogoutSide is intentionally NOT bound here. The sidebar UI script
    // (kept inline in index.html, see "sidebar/menu accordion" block) delegates
    // clicks on btnLogoutSide to btnLogout.click(). Binding handleLogout to both
    // elements would fire it twice per click (and show two confirm() dialogs).
    document.getElementById('loginUser')?.addEventListener('blur', startBFCountdown);
    document.getElementById('loginPass')?.addEventListener('focus', startBFCountdown);

    ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll', 'click'].forEach(evt => {
      document.addEventListener(evt, () => { if (currentUser) resetIdle(); }, { passive: true });
    });
    const pollLogin = setInterval(() => {
      if (currentUser) { resetIdle(); clearInterval(pollLogin); }
    }, 500);

    checkAuth();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthModule, { once: true });
  } else {
    initAuthModule();
  }
})();
