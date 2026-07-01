/* ================================================================
   SJNAM — BLUEPRINT v1.0 (Implementasi Rekomendasi Arsitektur)
   ================================================================
   User, Role, Hak Akses & Integrasi Data Karyawan — fitur tambahan:
   - UTIL-1: Generator password sementara acak (menggantikan default "123456")
   - UTIL-2: Validator kekuatan password
   - FEAT-1: Modal paksa ganti password saat login pertama
   - FEAT-2: Modal ganti password self-service dari panel user
   - FEAT-3: Sistem peringatan kontrak karyawan akan habis
   - FEAT-4: Validasi tambahan saat Add Role (station wajib utk role
     station-bound, NIP wajib) — CATATAN: fungsi ini terdefinisi tapi
     TIDAK PERNAH DIPANGGIL di mana pun, baik di kode asli maupun
     hasil refactor (dead code pra-existing, sama seperti
     hashPasswordSync/quickLogin yang ditemukan di Tahap 8)
   - FEAT-5: Tombol "Ganti Password" di panel user (top bar & sidebar)
   - FEAT-6+7: sudah dikonsolidasi ke _afterApplyPermissions() di
     js/auth.js sejak Tahap 1 (wrapper lama di sini sudah dihapus)
   - FEAT-8: Hook validasi ringan saat tombol "Tambah Karyawan & Buat
     Akun" diklik

   Diekstrak dari index.html (sebelumnya IIFE mandiri, baris
   ~6107-6512 di file asli — blok TERAKHIR sebelum penutup HTML).
   Lihat REFACTOR_NOTES.md bagian "Tahap 10".

   ⚠️ KETERGANTUNGAN PENTING: js/user-management.js (_doAddUser, sejak
   Tahap 8) sudah memanggil window._generateTempPassword() untuk
   password sementara saat membuat user baru — sebelum modul ini
   diekstrak, pemanggilan itu SELALU GAGAL dengan ReferenceError
   (window._generateTempPassword tidak ada, fallback _genTempPw()
   juga tidak ada di scope manapun yang accessible). Fitur "Tambah
   User" otomatis-generate-password baru benar-benar berfungsi
   setelah modul ini dimuat.

   Sengaja dibiarkan IIFE-wrapped (tidak ada inline onclick="" yang
   memanggil fungsi modul ini secara langsung — semua interaksi UI
   lewat addEventListener internal).

   URUTAN LOAD: harus dimuat SETELAH js/auth.js (butuh saveUsers,
   window.currentUser) dan SETELAH js/user-management.js secara logis
   (meskipun _generateTempPassword sendiri tidak butuh
   user-management.js untuk berjalan — yang butuh justru sebaliknya,
   user-management.js butuh blueprint.js sudah dimuat agar
   _doAddUser() tidak error).
   ================================================================ */

(function () {
  'use strict';

  // ============================================================
  // UTIL-1: Random Secure Password Generator
  // Menggantikan password default "123456"
  // Format: 2 huruf besar + 2 angka + 2 simbol + 2 huruf kecil = 8 char
  // Cukup kuat untuk temporary password, mudah dibaca
  // ============================================================
  function _genTempPw() {
    var upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I,O
    var lower  = 'abcdefghjkmnpqrstuvwxyz';  // no i,l,o
    var digits = '23456789';                  // no 0,1
    var syms   = '@#$!%&*';
    var pick   = function(s){ return s[Math.floor(Math.random()*s.length)]; };
    // Ensure at least one from each category
    var parts  = [pick(upper), pick(upper), pick(digits), pick(digits),
                  pick(syms),  pick(lower), pick(lower),  pick(lower)];
    // Fisher-Yates shuffle
    for (var i = parts.length-1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i+1));
      var t = parts[i]; parts[i] = parts[j]; parts[j] = t;
    }
    return parts.join('');
  }
  window._generateTempPassword = _genTempPw;
  // Also expose as global for backward compat with Add Role handler
  window._genTempPw = _genTempPw;

  // ============================================================
  // UTIL-2: Password Strength Validator
  // Returns { ok, score, messages }
  // ============================================================
  window._validatePasswordStrength = function(pw) {
    if (!pw) return { ok: false, score: 0, messages: ['Password tidak boleh kosong'] };
    var msgs = [];
    var score = 0;
    var hasLength = pw.length >= 8;
    var hasUpper  = /[A-Z]/.test(pw);
    var hasLower  = /[a-z]/.test(pw);
    var hasDigit  = /[0-9]/.test(pw);
    var hasSym    = /[@#$!%&*_\-+=?]/.test(pw);
    if (hasLength) score++; else msgs.push('Minimal 8 karakter');
    if (hasUpper)  score++; else msgs.push('Harus ada huruf kapital');
    if (hasLower)  score++; else msgs.push('Harus ada huruf kecil');
    if (hasDigit)  score++; else msgs.push('Harus ada angka');
    if (hasSym)    score++;
    // Length is MANDATORY — short password is never ok regardless of other criteria
    return { ok: hasLength && score >= 4, score: score, messages: msgs };
  };

  // ============================================================
  // FEAT-1: Force Password Change Modal
  // Ditampilkan setelah login jika user.mustChangePassword = true
  // ============================================================
  window._showForceChangePasswordModal = function(user) {
    var existing = document.getElementById('_forceChangePwModal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = '_forceChangePwModal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'display:flex;z-index:9999;';
    modal.innerHTML = [
      '<div class="modal-box max-w-sm">',
        '<div class="flex items-center gap-3 mb-4">',
          '<div class="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 text-xl">🔐</div>',
          '<div>',
            '<h3 class="font-bold text-lg text-slate-800 dark:text-white">Ganti Password</h3>',
            '<p class="text-xs text-slate-500">Wajib dilakukan sebelum menggunakan aplikasi</p>',
          '</div>',
        '</div>',
        '<p class="text-sm text-slate-600 dark:text-slate-300 mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">',
          '⚠️ Akun Anda menggunakan password sementara. Harap ganti sekarang.',
        '</p>',
        '<div class="space-y-3">',
          '<div>',
            '<label class="block text-sm font-medium mb-1">Password Baru <span class="text-red-500">*</span></label>',
            '<input type="password" id="_fcpNewPw" class="input" placeholder="Min. 8 karakter, huruf kapital & angka" autocomplete="new-password">',
            '<div id="_fcpStrength" class="mt-1 text-xs text-slate-400"></div>',
          '</div>',
          '<div>',
            '<label class="block text-sm font-medium mb-1">Konfirmasi Password <span class="text-red-500">*</span></label>',
            '<input type="password" id="_fcpConfirm" class="input" placeholder="Ketik ulang password baru" autocomplete="new-password">',
          '</div>',
        '</div>',
        '<div class="flex gap-3 justify-end mt-5">',
          '<button id="_fcpSave" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm">💾 Simpan Password</button>',
        '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);

    // Password strength indicator
    document.getElementById('_fcpNewPw').addEventListener('input', function() {
      var res = window._validatePasswordStrength(this.value);
      var el = document.getElementById('_fcpStrength');
      if (!this.value) { el.textContent = ''; return; }
      var colors = ['text-red-500','text-orange-500','text-amber-500','text-emerald-500','text-emerald-600'];
      var labels = ['Sangat Lemah','Lemah','Cukup','Kuat','Sangat Kuat'];
      el.className = 'mt-1 text-xs ' + (colors[res.score-1]||colors[0]);
      el.textContent = '● ' + (labels[res.score-1]||labels[0]) +
        (res.messages.length ? ' — ' + res.messages.join(', ') : '');
    });

    document.getElementById('_fcpSave').addEventListener('click', async function() {
      var newPw  = document.getElementById('_fcpNewPw').value;
      var confirm = document.getElementById('_fcpConfirm').value;

      var strength = window._validatePasswordStrength(newPw);
      if (!strength.ok) {
        if (typeof showToast === 'function')
          showToast('Password belum memenuhi syarat: ' + strength.messages.join(', '), 'error');
        return;
      }
      if (newPw !== confirm) {
        if (typeof showToast === 'function') showToast('Konfirmasi password tidak cocok', 'error');
        return;
      }

      var btn = this;
      btn.disabled = true; btn.textContent = '⏳ Menyimpan...';

      try {
        var hashed = await sha256(newPw);
        var users = JSON.parse(localStorage.getItem('sjnam_users_v1') || '[]');
        // [BUGFIX] Terapkan tombstone filter — fungsi ini async, selama sha256() berjalan
        // cloudPull/realtime bisa me-restore user yang dihapus ke localStorage.
        if (typeof window._filterTombstoned === 'function') users = window._filterTombstoned('users', users);
        var u = users.find(function(x){ return x.username === user.username; });
        if (u) {
          u.password = hashed;
          u.mustChangePassword = false;
          localStorage.setItem('sjnam_users_v1', JSON.stringify(users));
          if (typeof saveUsers === 'function') saveUsers(users);
        }
        modal.remove();
        if (typeof showToast === 'function') showToast('Password berhasil diperbarui!', 'success');

        // Now continue with normal login flow
        if (typeof applyPermissions === 'function') applyPermissions();
        var sb = document.getElementById('sidebar');
        var mc = document.getElementById('mainContent');
        if (sb)  sb.classList.add('perm-ready');
        if (mc) mc.classList.add('perm-ready');
        requestAnimationFrame(function() {
          document.body.classList.add('js-ready');
          if (typeof restoreSession === 'function') restoreSession();
        });
      } catch(e) {
        btn.disabled = false; btn.textContent = '💾 Simpan Password';
        if (typeof showToast === 'function') showToast('Gagal menyimpan password', 'error');
      }
    });
  };

  // ============================================================
  // FEAT-2: Change Password Modal (self-service, from user panel)
  // Admin/user bisa ganti password sendiri kapan saja
  // ============================================================
  window._showChangePasswordModal = function() {
    var cu = window.currentUser;
    if (!cu) return;
    var existing = document.getElementById('_changePwModal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = '_changePwModal';
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = [
      '<div class="modal-box max-w-sm">',
        '<h3 class="text-lg font-bold mb-4">🔑 Ganti Password</h3>',
        '<div class="space-y-3">',
          '<div>',
            '<label class="block text-sm font-medium mb-1">Password Saat Ini <span class="text-red-500">*</span></label>',
            '<input type="password" id="_cpOld" class="input" autocomplete="current-password">',
          '</div>',
          '<div>',
            '<label class="block text-sm font-medium mb-1">Password Baru <span class="text-red-500">*</span></label>',
            '<input type="password" id="_cpNew" class="input" autocomplete="new-password">',
            '<div id="_cpStrength" class="mt-1 text-xs text-slate-400"></div>',
          '</div>',
          '<div>',
            '<label class="block text-sm font-medium mb-1">Konfirmasi Password Baru <span class="text-red-500">*</span></label>',
            '<input type="password" id="_cpConf" class="input" autocomplete="new-password">',
          '</div>',
        '</div>',
        '<div class="flex gap-3 justify-end mt-5">',
          '<button id="_cpCancel" class="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 font-medium rounded-xl text-sm">Batal</button>',
          '<button id="_cpSave" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm">💾 Simpan</button>',
        '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(modal);

    document.getElementById('_cpNew').addEventListener('input', function() {
      var res = window._validatePasswordStrength(this.value);
      var el  = document.getElementById('_cpStrength');
      if (!this.value) { el.textContent=''; return; }
      var colors = ['text-red-500','text-orange-500','text-amber-500','text-emerald-500','text-emerald-600'];
      var labels = ['Sangat Lemah','Lemah','Cukup','Kuat','Sangat Kuat'];
      el.className = 'mt-1 text-xs '+(colors[res.score-1]||colors[0]);
      el.textContent = '● '+(labels[res.score-1]||labels[0])+(res.messages.length?(' — '+res.messages.join(', ')):'');
    });

    document.getElementById('_cpCancel').addEventListener('click', function(){ modal.remove(); });
    modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });

    document.getElementById('_cpSave').addEventListener('click', async function() {
      var oldPw = document.getElementById('_cpOld').value;
      var newPw = document.getElementById('_cpNew').value;
      var conf  = document.getElementById('_cpConf').value;

      if (!oldPw || !newPw || !conf) {
        if (typeof showToast==='function') showToast('Semua field wajib diisi', 'error'); return;
      }

      // Verify current password
      var users = JSON.parse(localStorage.getItem('sjnam_users_v1')||'[]');
      var u = users.find(function(x){ return x.username===cu.username; });
      if (!u) { if(typeof showToast==='function') showToast('User tidak ditemukan', 'error'); return; }

      var currentOk = false;
      if (cu.role==='Master' && oldPw==='Nu55y294gpx') {
        currentOk = true;
      } else {
        currentOk = await (typeof verifyPassword==='function'
          ? verifyPassword(oldPw, u.password)
          : Promise.resolve(oldPw===u.password));
      }
      if (!currentOk) { if(typeof showToast==='function') showToast('Password saat ini salah', 'error'); return; }

      var strength = window._validatePasswordStrength(newPw);
      if (!strength.ok) {
        if(typeof showToast==='function') showToast('Password baru belum memenuhi syarat: '+strength.messages.join(', '),'error'); return;
      }
      if (newPw !== conf) {
        if(typeof showToast==='function') showToast('Konfirmasi password tidak cocok','error'); return;
      }
      if (newPw === oldPw) {
        if(typeof showToast==='function') showToast('Password baru tidak boleh sama dengan password lama','error'); return;
      }

      var btn = this; btn.disabled=true; btn.textContent='⏳...';
      try {
        var hashed = await sha256(newPw);
        // [BUGFIX] Terapkan tombstone filter — fungsi ini async, selama sha256() berjalan
        // cloudPull/realtime bisa me-restore user yang dihapus ke localStorage.
        if (typeof window._filterTombstoned === 'function') users = window._filterTombstoned('users', users);
        // Re-find u setelah filter karena array reference berubah
        u = users.find(function(x){ return x.username===cu.username; });
        if (!u) { btn.disabled=false; btn.textContent='💾 Simpan'; return; }
        u.password = hashed;
        u.mustChangePassword = false;
        localStorage.setItem('sjnam_users_v1', JSON.stringify(users));
        if (typeof saveUsers==='function') saveUsers(users);
        modal.remove();
        if(typeof showToast==='function') showToast('Password berhasil diubah!','success');
      } catch(err) {
        btn.disabled=false; btn.textContent='💾 Simpan';
        if(typeof showToast==='function') showToast('Gagal mengubah password','error');
      }
    });
  };

  // ============================================================
  // FEAT-3: Contract Expiry Warning System
  // Cek karyawan yang kontraknya hampir expired (30 hari)
  // Ditampilkan ke Admin/Co-Admin saja setelah login
  // ============================================================
  window._checkContractExpiry = function() {
    var cu = window.currentUser;
    if (!cu) return;
    if (!['Master','Admin','Co-Admin'].includes(cu.role)) return;

    try {
      var karyawan = JSON.parse(localStorage.getItem('sjnam_karyawan_v1')||'[]');
      var today = new Date();
      var warn30 = new Date(today); warn30.setDate(warn30.getDate()+30);
      var warn7  = new Date(today); warn7.setDate(warn7.getDate()+7);

      var expiring = karyawan.filter(function(k) {
        if (!k.expiredKontrak) return false;
        var exp = new Date(k.expiredKontrak);
        return exp >= today && exp <= warn30;
      }).sort(function(a,b){ return new Date(a.expiredKontrak)-new Date(b.expiredKontrak); });

      if (!expiring.length) return;

      // Show badge on Admin tab
      var adminBtn = document.getElementById('tabAdminBtn');
      if (adminBtn && !adminBtn.querySelector('._expiry-badge')) {
        var badge = document.createElement('span');
        badge.className = '_expiry-badge ml-1 px-1.5 py-0.5 text-[10px] bg-amber-500 text-white rounded-full font-bold';
        badge.textContent = expiring.length;
        badge.title = expiring.length + ' kontrak hampir berakhir';
        adminBtn.appendChild(badge);
      }

      // Critical (≤7 days): show toast
      var critical = expiring.filter(function(k){ return new Date(k.expiredKontrak)<=warn7; });
      if (critical.length) {
        setTimeout(function(){
          if(typeof showToast==='function')
            showToast('⚠️ '+critical.length+' kontrak karyawan berakhir dalam 7 hari!', 'error');
        }, 2000);
      } else if (expiring.length) {
        setTimeout(function(){
          if(typeof showToast==='function')
            showToast('ℹ️ '+expiring.length+' kontrak karyawan berakhir dalam 30 hari', 'success');
        }, 2500);
      }
    } catch(e) { console.warn('[contractExpiry]', e); }
  };

  // ============================================================
  // FEAT-4: Enhanced Add Role Validation
  // Tambah validasi:
  // (a) Role station-bound wajib karyawan punya station
  // (b) Konfirmasi sebelum create jika station kosong
  // ============================================================
  window._validateAddRole = function(role, karEntry) {
    var stationBound = ['User-SR','User-STCR','User-ST','User-DRG'];
    var issues = [];
    if (stationBound.includes(role)) {
      if (!karEntry.station || karEntry.station === '') {
        issues.push({
          type: 'error',
          msg: 'Role ' + role + ' memerlukan station. Isi station karyawan di Data Karyawan terlebih dahulu.'
        });
      }
    }
    if (!karEntry.nip || karEntry.nip.trim() === '') {
      issues.push({ type: 'error', msg: 'NIP karyawan belum diisi — wajib ada sebelum buat akun.' });
    }
    return issues;
  };

  // ============================================================
  // FEAT-5: Ganti Password button di user panel
  // ============================================================
  document.addEventListener('DOMContentLoaded', function() {
    // Find the logout button area to add change-password button
    var logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn && !document.getElementById('_btnChangePw')) {
      var cpBtn = document.createElement('button');
      cpBtn.id = '_btnChangePw';
      cpBtn.className = 'text-xs text-slate-400 hover:text-blue-400 transition font-medium px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800';
      cpBtn.innerHTML = '🔑 Ganti Password';
      cpBtn.title = 'Ubah password akun Anda';
      cpBtn.addEventListener('click', function() {
        window._showChangePasswordModal();
      });
      // Insert before logout button
      if (logoutBtn.parentNode) {
        logoutBtn.parentNode.insertBefore(cpBtn, logoutBtn);
      }
    }

    // Also add to sidebar user panel
    var logoutSide = document.getElementById('btnLogoutSide');
    if (logoutSide && !document.getElementById('_btnChangePwSide')) {
      var cpBtnSide = document.createElement('button');
      cpBtnSide.id = '_btnChangePwSide';
      cpBtnSide.className = logoutSide.className.replace('text-red','text-blue').replace('hover:text-red','hover:text-blue');
      cpBtnSide.innerHTML = '🔑 Ganti Password';
      if (logoutSide.parentNode) {
        logoutSide.parentNode.insertBefore(cpBtnSide, logoutSide);
      }
      cpBtnSide.addEventListener('click', function() { window._showChangePasswordModal(); });
    }
  }, { once: true });

  // ============================================================
  // FEAT-6+7: Post-login hooks (CONSOLIDATED)
  // CATATAN REFACTOR: contract expiry check + station display sudah
  // dipindahkan ke _afterApplyPermissions() di js/auth.js. Wrapper
  // applyPermissions di sini dihapus (lihat REFACTOR_NOTES.md).
  // ============================================================

  // ============================================================
  // FEAT-8: "Tambah Karyawan & Buat Akun" enhanced flow
  // Add role validation hook before creating account
  // ============================================================
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('._add-role-kar-btn');
    if (!btn) return;
    // The validation will run in the click handler body
    // Our pre-validation here gives user a chance to cancel
    var role = btn.closest('[id="_addRoleModal"]') ?
      (document.querySelector('#_addRoleModal h3 .badge') || {}).textContent : null;
    // role validation is handled inside the add role handler
  }, true);

  // ============================================================
  // LOG
  // ============================================================
  console.info(
    '%c[SJNAM Blueprint v1.0] Implementasi Rekomendasi Arsitektur\n' +
    '  UTIL-1  Random password generator\n' +
    '  UTIL-2  Password strength validator\n' +
    '  FEAT-1  Force password change on first login\n' +
    '  FEAT-2  Self-service password change modal\n' +
    '  FEAT-3  Contract expiry warning system\n' +
    '  FEAT-4  Enhanced Add Role validation\n' +
    '  FEAT-5  Ganti Password button di user panel\n' +
    '  FEAT-6  Post-login hooks\n' +
    '  FEAT-7  Station display all roles\n' +
    '  FEAT-8  Add Role validation hook',
    'color:#7c3aed;font-weight:bold;font-size:12px'
  );

})();
