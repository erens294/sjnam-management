/* ================================================================
   SJNAM — MODUL SHARED UTILS
   ================================================================
   Utilitas lintas-modul yang dipakai oleh Service Recovery, STCR,
   Training, dan Drygoods: DOM helpers, formatting angka/tanggal/jam,
   toast/confirm dialog, dark mode, dan SELURUH layer cloud-sync
   Supabase (markDirty/cloudPush/cloudPull/merge logic).

   Diekstrak dari index.html (sebelumnya tercampur dengan business
   logic Service Recovery dalam satu blok <script> sepanjang ~3.600
   baris). Lihat REFACTOR_NOTES.md bagian "Tahap 3" untuk detail.

   ⚠️ TEMUAN KEAMANAN PENTING (lihat juga REFACTOR_NOTES.md):
   Kredensial Supabase (URL + anon key) sebelumnya hardcoded di
   source code, disamarkan dengan base64 (BUKAN enkripsi — siapa pun
   bisa decode dalam hitungan detik via atob()). Modul ini TETAP
   memuat kredensial yang sama (lihat CLOUD_DEFAULT_CONFIG di bawah)
   karena mengganti/memutus koneksi tanpa konfigurasi pengganti akan
   mematikan sinkronisasi cloud yang sedang berjalan — TIDAK aman
   untuk dilakukan sepihak oleh proses refactor ini.
   TINDAKAN WAJIB DI SISI ANDA (di luar refactor ini):
     1. Rotate (ganti) anon key di dashboard Supabase Anda.
     2. Pastikan Row Level Security (RLS) aktif di semua tabel agar
        anon key yang ter-expose tidak bisa baca/tulis data sembarangan.
     3. Setelah key baru ada, cukup ganti nilai di CLOUD_DEFAULT_CONFIG
        di bawah — tidak perlu mengubah kode lain.
   ================================================================ */

(function () {
  'use strict';

  // ===== DOM HELPERS =====
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  window.$ = window.$ || $;
  window.$$ = window.$$ || $$;

  // ===== XSS GUARD =====
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  window.esc = esc;

  // ===== NUMBER / CURRENCY FORMATTING =====
  function formatNumber(n) {
    try { return parseInt(n || 0).toLocaleString('id-ID'); }
    catch (e) { return String(parseInt(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  }
  function formatRupiah(val) { return 'Rp ' + formatNumber(val); }
  function formatHM(minutes) {
    const sign = minutes < 0 ? '-' : '';
    const abs = Math.abs(minutes);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  window.formatNumber = formatNumber;
  window.formatRupiah = formatRupiah;
  window.formatHM = formatHM;

  // ===== DATE / TIME HELPERS =====
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function formatDateDMY(iso) {
    if (!iso) return '-';
    const [y, m, d] = iso.split('-');
    return `${d}-${MONTHS[parseInt(m) - 1]}-${y}`;
  }
  // todayLocalStr: tanggal hari ini "YYYY-MM-DD" berdasarkan waktu LOKAL
  // device — iPhone/Safari safe, tidak pakai UTC yang bisa geser tanggal.
  function todayLocalStr() {
    const n = new Date();
    return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
  }
  const parseUTC = s => s ? new Date(s + 'Z') : null;
  window.MONTHS = MONTHS;
  window.formatDateDMY = formatDateDMY;
  window.todayLocalStr = todayLocalStr;
  window.parseUTC = parseUTC;

  // formatTimeLocal butuh getStationTz, yang bergantung pada `stations`
  // (state milik Service Recovery) — jadi TETAP didefinisikan di
  // service-recovery.js, bukan di sini. window.formatTimeLocal akan
  // diisi oleh service-recovery.js setelah modul itu dimuat.

  // ===== CLOCK =====
  // [CATATAN] updateClock() dan wiring visibilitychange/pageshow-nya TIDAK
  // didefinisikan di sini — implementasi asli memanggil updateStationClocks()
  // (fungsi khusus Service Recovery yang bergantung pada array `stations`)
  // dan melakukan validasi ulang sesi login, jadi tetap berada di
  // service-recovery.js, bukan di sini. Lihat REFACTOR_NOTES.md Tahap 3.

  // ===== DARK MODE =====
  // settings.darkMode dibaca dari objek `settings` milik Service Recovery
  // (window.settings, diekspos oleh service-recovery.js). Jika belum
  // dimuat, gunakan localStorage langsung sebagai fallback.
  function applyDarkMode() {
    const isDark = (window.settings && window.settings.darkMode) || false;
    document.documentElement.classList.toggle('dark', isDark);
    const dmToggle = document.getElementById('darkModeToggle');
    if (dmToggle) dmToggle.checked = isDark;
    // [FIX] Icon toggle (#iconDark/#iconLight) ditemukan ada di versi asli
    // applyDarkMode milik Service Recovery tapi terlewat saat penulisan ulang
    // shared-utils.js Tahap 3 — ditambahkan kembali di sini.
    const icD = document.getElementById('iconDark'); if (icD) icD.classList.toggle('hidden', isDark);
    const icL = document.getElementById('iconLight'); if (icL) icL.classList.toggle('hidden', !isDark);
  }
  window.applyDarkMode = applyDarkMode;
  // [CATATAN] Event listener untuk #darkModeToggle dan #btnDarkToggle TIDAK
  // dipasang di sini — keduanya sudah di-wire langsung di service-recovery.js
  // (sebagai pernyataan top-level, persis seperti kode asli). Memasang lagi
  // di sini akan menyebabkan applyDarkMode() terpanggil 2x per klik.

  // ===== TOAST & CONFIRM =====
  function showToast(msg, type = 'success') {
    if (type === 'error') {
      // Tampilkan sebagai lampu merah, bukan toast
      const eLight = document.getElementById('errorLight');
      if (eLight) {
        if (!window._errorLog) window._errorLog = [];
        window._errorLog.unshift({ msg, time: new Date().toLocaleTimeString('id-ID') });
        if (window._errorLog.length > 20) window._errorLog.pop();
        eLight.classList.remove('active', 'sticky');
        void eLight.offsetWidth; // force reflow agar animasi 'active' bisa retrigger
        eLight.classList.add('active');
        // Setelah animasi, tetap menyala redup (sticky) selama 30 detik
        clearTimeout(window._errorLightTimer);
        window._errorLightTimer = setTimeout(() => {
          eLight.classList.remove('active');
          eLight.classList.add('sticky');
          clearTimeout(window._errorStickyTimer);
          window._errorStickyTimer = setTimeout(() => { eLight.classList.remove('sticky'); }, 30000);
        }, 3000);
        eLight.title = `❌ ${msg} (klik untuk detail)`;
      }
      return;
    }
    const container = document.getElementById('toastContainer');
    if (!container) { console.log('[Toast]', type, msg); return; }
    const bg = type === 'success' ? 'bg-emerald-600' : type === 'warn' ? 'bg-amber-500' : 'bg-slate-700';
    const icon = type === 'success' ? '✅' : type === 'warn' ? '⚠️' : 'ℹ️';
    const el = document.createElement('div');
    el.className = `toast ${bg} pointer-events-auto text-sm`;
    el.textContent = `${icon} ${msg}`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0'; el.style.transform = 'translateX(110%)'; el.style.transition = 'all .3s ease';
      setTimeout(() => el.remove(), 300);
    }, 3500);
  }
  window.showToast = showToast;

  function showConfirm(title, message) {
    return new Promise(resolve => {
      const modal = document.getElementById('confirmModal');
      const titleEl = document.getElementById('confirmTitle');
      const msgEl = document.getElementById('confirmMessage');
      const ok = document.getElementById('confirmOk');
      const cancel = document.getElementById('confirmCancel');
      if (!modal || !ok || !cancel) { resolve(window.confirm(message || title)); return; }
      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.textContent = message;
      modal.classList.remove('hidden');
      const hOk = () => { modal.classList.add('hidden'); ok.removeEventListener('click', hOk); cancel.removeEventListener('click', hCancel); resolve(true); };
      const hCancel = () => { modal.classList.add('hidden'); ok.removeEventListener('click', hOk); cancel.removeEventListener('click', hCancel); resolve(false); };
      ok.addEventListener('click', hOk);
      cancel.addEventListener('click', hCancel);
    });
  }
  window.showConfirm = showConfirm;

  // ===== ERROR LOG MODAL =====
  // ===== ERROR LOG MODAL =====
  // [FIX] Implementasi sebelumnya di sini mengasumsikan elemen modal sudah
  // ada statis di HTML (gagal total karena tidak ada) — versi asli yang
  // benar MEMBUAT modal secara dinamis lewat insertAdjacentHTML. Diganti
  // dengan implementasi asli yang benar di bawah ini.
  (function () {
    const modalHtml = `<div id="errorLogModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;align-items:center;justify-content:center">
    <div style="background:#fff;border-radius:12px;padding:20px;min-width:320px;max-width:480px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.4)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="font-weight:700;color:#dc2626;font-size:1rem">❌ Log Error Sistem</h3>
        <button id="errorLogClose" style="background:#f1f5f9;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:14px">✕ Tutup</button>
      </div>
      <div id="errorLogList" style="max-height:300px;overflow-y:auto;font-size:0.82rem;color:#334155"></div>
      <button id="errorLogClear" style="margin-top:10px;background:#dc2626;color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:0.82rem">Bersihkan Log</button>
    </div>
  </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('errorLogClose')?.addEventListener('click', () => {
      document.getElementById('errorLogModal').style.display = 'none';
    });
    document.getElementById('errorLogClear')?.addEventListener('click', () => {
      window._errorLog = [];
      document.getElementById('errorLogList').innerHTML = '<p style="color:#94a3b8;text-align:center;padding:16px">Log kosong</p>';
      const eLight = document.getElementById('errorLight');
      if (eLight) { eLight.classList.remove('active', 'sticky'); eLight.title = 'Ada kesalahan sistem'; }
    });

    // Click error light → buka modal
    document.getElementById('errorLight')?.addEventListener('click', () => {
      const list = document.getElementById('errorLogList');
      const logs = window._errorLog || [];
      if (!logs.length) {
        list.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:16px">Tidak ada error</p>';
      } else {
        list.innerHTML = logs.map(e =>
          `<div style="border-bottom:1px solid #f1f5f9;padding:6px 0"><span style="color:#dc2626;font-weight:600">[${e.time}]</span> ${e.msg}</div>`
        ).join('');
      }
      document.getElementById('errorLogModal').style.display = 'flex';
      const eLight = document.getElementById('errorLight');
      if (eLight) { eLight.classList.remove('sticky'); clearTimeout(window._errorStickyTimer); }
    });
  })();
})();

// ================================================================
// CLOUD SYNC — SUPABASE REALTIME
// ================================================================
// KEAMANAN: kredensial Supabase TIDAK LAGI hardcoded di sini.
// Dipindahkan ke js/config.js (file terpisah, di-gitignore, TIDAK
// ikut ter-upload ke GitHub) — lihat js/config.example.js untuk
// template & cara setup.
//
// Jika js/config.js tidak ada/tidak dimuat, cloudConfig akan kosong
// dan Cloud Sync tidak aktif sampai diisi manual lewat menu Cloud
// Sync di dalam aplikasi (tersimpan ke localStorage seperti biasa).
(function () {
  'use strict';

  const CLOUD_KEY = 'sjn_cloud_config_v1';
  // [FIX] _LAST_PULL_TS_KEY sebelumnya dideklarasikan di pre-declare block
  // service-recovery.js — sekarang shared-utils.js dimuat LEBIH AWAL, jadi
  // konstanta ini perlu dideklarasikan sendiri di sini, bukan bergantung
  // pada file lain yang load belakangan.
  window._LAST_PULL_TS_KEY = 'sjnam_last_cloud_pull_ts_v1';
  // Dibaca dari window.SJNAM_CONFIG (lihat js/config.js / config.example.js).
  // Fallback string kosong jika config.js belum dimuat — BUKAN kredensial
  // asli, supaya file ini aman diupload ke repo publik.
  const _cfg = (typeof window !== 'undefined' && window.SJNAM_CONFIG) || {};
  const DEFAULT_SUPABASE_URL = _cfg.SUPABASE_URL || '';
  const DEFAULT_SUPABASE_KEY = _cfg.SUPABASE_ANON_KEY || '';

window.cloudConfig = { supabaseUrl: DEFAULT_SUPABASE_URL, supabaseKey: DEFAULT_SUPABASE_KEY };
try {
  const c = JSON.parse(localStorage.getItem(CLOUD_KEY)||'{}');
  // migrasi dari format lama (apiKey/binId) ke format baru
  cloudConfig = {
    supabaseUrl: c.supabaseUrl || c.apiKey || DEFAULT_SUPABASE_URL,
    supabaseKey: c.supabaseKey || c.binId || DEFAULT_SUPABASE_KEY,
    // autoSync & syncDelaySec dihapus — diganti Smart-Sync otomatis
  };
} catch(e){}

// BUGFIX: saveCloudConfig dipanggil di banyak tempat (btnCloudSave, btnCloudLoad,
// btnCloudClear, input change, cloudPush) tapi tidak pernah didefinisikan —
// menyebabkan "saveCloudConfig is not defined" ReferenceError setiap kali push/pull.
function saveCloudConfig(){
  try {
    localStorage.setItem(CLOUD_KEY, JSON.stringify({
      supabaseUrl: cloudConfig.supabaseUrl,
      supabaseKey: cloudConfig.supabaseKey
    }));
  } catch(e){
    console.warn('[CloudSync] Gagal simpan cloud config:', e.message);
  }
}

window._supabaseClient = null;
window._realtimeChannel = null;

// === SMART SYNC STATE ===
// Restore dari localStorage agar Smart Pull tidak pull ulang jika tidak ada perubahan data
window._lastCloudUpdatedAt = (function(){ try{ return localStorage.getItem(window._LAST_PULL_TS_KEY)||null; }catch(e){ return null; } })();
window._lastPushedHash = null;        // hash payload terakhir yang berhasil di-push
// Deklarasi di sini agar tersedia untuk semua fungsi di bawah (fix hoisting bug)
window._autoSyncTimer = null;
window._cloudPullInProgress = false;

// === PER-RECORD METADATA: updated_by + updated_at ===
// Dipakai untuk conflict detection dan audit trail
function stampRecord(record, action='update'){
  const user = window.currentUser;
  const by   = user ? (user.name || user.username || 'unknown') : 'system';
  const now  = new Date().toISOString();
  return {
    ...record,
    _updatedBy:  by,
    _updatedAt:  now,
    _updatedAct: action   // 'create' | 'update' | 'delete'
  };
}

// Tempelkan stampRecord ke item array sebelum disimpan.
// Dipanggil dari saveData(), saveStcrData(), dst. — lihat patch di bawah.
function stampArray(arr, action='update'){
  if(!Array.isArray(arr)) return arr;
  // Hanya stamp item yang belum punya _updatedAt (baru) atau yang lebih baru dari cloud
  return arr.map(item => item._updatedAt ? item : stampRecord(item, action));
}

// Deteksi konflik antar dua versi record dengan id sama:
// kembalikan { winner, loser, conflict } — conflict=true jika beda user edit beda field
function detectConflict(local, remote){
  if(!local || !remote) return { winner: local||remote, loser: null, conflict: false };
  const lt = new Date(local._updatedAt||0).getTime();
  const rt = new Date(remote._updatedAt||0).getTime();
  const sameUser = local._updatedBy === remote._updatedBy;
  const conflict = !sameUser && Math.abs(lt - rt) < 5000; // beda user dalam 5 detik = konflik
  return {
    winner: lt >= rt ? local : remote,
    loser:  lt >= rt ? remote : local,
    conflict
  };
}

// === MODULE KEYS: daftar semua localStorage key per modul ===
// Dipakai untuk dirty-flag tracking dan per-module push
const MODULE_KEYS = {
  data:         'sjn_delay_pro_v4',
  stations:     'sjn_stations_v2',
  dfsData:      'sjn_dfs_bank_v1',
  settings:     'sjn_settings_v4',
  training:     'sjn_training_v1',
  users:        'sjnam_users_v1',
  karyawan:     'sjnam_karyawan_v1',  // BUGFIX: karyawan perlu dirty tracking
  stcrData:     'sjnam_stcr_data_v1',
  drygoodsData: 'sjnam_drygoods_v1',
  rolePerms:    'sjnam_role_perms_v1',
};

// Dirty-flag per modul — set true saat modul berubah, reset setelah push berhasil
// BUGFIX: _dirtyModules sebelumnya `const`, didefinisikan di sini (jauh di bawah
// titik di mana saveStations() bisa terpanggil lebih awal dalam dokumen — lihat
// komentar "FIX: pre-declare cloud-sync state" di atas untuk bug serupa yang
// sudah pernah diperbaiki untuk _cloudPullInProgress dkk, tapi terlewat untuk
// _dirtyModules). Ini menyebabkan ReferenceError TDZ ("Cannot access
// '_dirtyModules' before initialization") yang membatalkan seluruh eksekusi
// script ini secara diam-diam pada load pertama. _dirtyModules SEKARANG
// dideklarasikan sebagai `var` di bagian atas file (lihat blok "pre-declare
// cloud-sync state") agar aman dipanggil dari mana pun dalam dokumen ini.
function markDirty(moduleName){ _dirtyModules.add(moduleName); }
function clearDirty(moduleName){ if(moduleName) _dirtyModules.delete(moduleName); else _dirtyModules.clear(); }
function isDirty(moduleName){ return moduleName ? _dirtyModules.has(moduleName) : _dirtyModules.size > 0; }

// Hash ringan untuk deteksi perubahan data (tanpa kirim ke mana-mana)
function _hashPayload(payload){
  try {
    const str = JSON.stringify(payload);
    let h = 0;
    for(let i = 0; i < str.length; i++){
      h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    }
    return h.toString(36);
  } catch(e){ return null; }
}

// === OFFLINE QUEUE — IndexedDB ===
// Menyimpan payload yang gagal dikirim saat offline,
// lalu flush otomatis saat koneksi kembali.
const _offlineQueue = (function(){
  const DB_NAME = 'sjnam_offline_q';
  const STORE   = 'queue';
  let _db = null;

  function openDB(){
    return new Promise((resolve, reject)=>{
      if(_db){ resolve(_db); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if(!db.objectStoreNames.contains(STORE)){
          const store = db.createObjectStore(STORE, { keyPath:'id', autoIncrement:true });
          store.createIndex('ts','ts',{unique:false});
        }
      };
      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function enqueue(payload){
    try {
      const db = await openDB();
      return new Promise((res,rej)=>{
        const tx = db.transaction(STORE,'readwrite');
        tx.objectStore(STORE).add({ payload, ts: Date.now(), attempts: 0 });
        tx.oncomplete = ()=>{ console.log('[OfflineQueue] Payload antri —', new Date().toLocaleTimeString('id-ID')); res(); };
        tx.onerror    = e => rej(e.target.error);
      });
    } catch(e){ console.warn('[OfflineQueue] enqueue gagal:', e.message); }
  }

  async function getAll(){
    try {
      const db = await openDB();
      return new Promise((res,rej)=>{
        const tx = db.transaction(STORE,'readonly');
        const req = tx.objectStore(STORE).index('ts').getAll();
        req.onsuccess = e => res(e.target.result||[]);
        req.onerror   = e => rej(e.target.error);
      });
    } catch(e){ return []; }
  }

  async function remove(id){
    try {
      const db = await openDB();
      return new Promise((res,rej)=>{
        const tx = db.transaction(STORE,'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = ()=>res();
        tx.onerror    = e => rej(e.target.error);
      });
    } catch(e){}
  }

  async function clear(){
    try {
      const db = await openDB();
      return new Promise((res,rej)=>{
        const tx = db.transaction(STORE,'readwrite');
        tx.objectStore(STORE).clear();
        tx.oncomplete = ()=>res();
        tx.onerror    = e => rej(e.target.error);
      });
    } catch(e){}
  }

  return { enqueue, getAll, remove, clear };
})();

// Flush offline queue: kirim semua payload yang antri saat online kembali
async function _flushOfflineQueue(){
  if(!navigator.onLine) return;
  if(!cloudConfig.supabaseUrl || !cloudConfig.supabaseKey) return;
  const items = await _offlineQueue.getAll();
  if(!items.length) return;
  console.log('[OfflineQueue] Flush', items.length, 'item antrian...');
  cloudLog('📶 Koneksi kembali — mengirim '+items.length+' perubahan yang tertunda...', 'info');
  for(const item of items){
    try {
      const sb = getSupabaseClient();
      if(!sb) break;
      const { error } = await sb
        .from('sjnam_sync')
        .upsert({ id:'sjnam_main', payload: item.payload, updated_at: new Date().toISOString() }, { onConflict:'id' });
      if(!error){
        await _offlineQueue.remove(item.id);
        console.log('[OfflineQueue] Item', item.id, 'berhasil dikirim');
      } else {
        console.warn('[OfflineQueue] Gagal kirim item', item.id, ':', error.message);
        break; // berhenti di error, coba lagi nanti
      }
    } catch(e){
      console.warn('[OfflineQueue] Exception:', e.message);
      break;
    }
  }
  const remaining = await _offlineQueue.getAll();
  if(!remaining.length){
    cloudLog('✅ Semua perubahan offline berhasil dikirim', 'success');
    showToast('📶 Sync offline berhasil — semua perubahan telah dikirim', 'success');
  }
}

// Daftarkan listener online/offline untuk queue
window.addEventListener('online', ()=>{
  setTimeout(_flushOfflineQueue, 1500); // delay kecil agar koneksi stabil dulu
});



function getSupabaseClient(){
  // Guard: if the Supabase SDK script (from the CDN) hasn't loaded — e.g. no internet
  // connection, the CDN is blocked, or the page is opened offline via file:// — `supabase`
  // is undefined here. Calling supabase.createClient(...) used to throw a synchronous
  // ReferenceError right at page load (via initCloudUI() -> startRealtimeSubscription()),
  // which silently aborted the entire script BEFORE the login form's submit listener got
  // registered further down. That is why clicking "Masuk" did nothing but reload the page.
  if(typeof supabase === 'undefined'){
    console.warn('[Cloud Sync] Supabase SDK belum termuat (cek koneksi internet) — sinkronisasi cloud dilewati.');
    return null;
  }
  const url = cloudConfig.supabaseUrl.trim();
  const key = cloudConfig.supabaseKey.trim();
  if(!url || !key) return null;
  if(!_supabaseClient || _supabaseClient._url !== url){
    window._supabaseClient = supabase.createClient(url, key);
    _supabaseClient._url = url;
  }
  return _supabaseClient;
}

// === AUDIT LOG ===
// Menulis satu baris ke tabel sjnam_audit_log di Supabase (best-effort, tidak block UI)
async function auditLog(action, moduleName, recordId, detail=''){
  try {
    const sb = getSupabaseClient();
    if(!sb) return;
    const user = window.currentUser;
    const by   = user ? (user.name || user.username || 'system') : 'system';
    await sb.from('sjnam_audit_log').insert({
      action,                         // 'create' | 'update' | 'delete' | 'pull' | 'push' | 'merge'
      module:     moduleName,         // 'data' | 'stcrData' | 'training' | ...
      record_id:  String(recordId||''), // id record yang berubah (jika ada)
      changed_by: by,
      detail:     detail.slice(0,500),// ringkasan perubahan (max 500 char)
      device_id:  getDeviceId(),
      created_at: new Date().toISOString()
    });
  } catch(e){
    // Audit log bersifat best-effort — jangan sampai menghentikan operasi utama
    console.warn('[AuditLog] Gagal tulis:', e.message);
  }
}

// Shorthand untuk audit log yang dipanggil dari save functions
function _auditSave(moduleName, items, action='update'){
  if(!cloudConfig.supabaseUrl) return; // skip jika cloud belum dikonfigurasi
  try {
    const count = Array.isArray(items) ? items.length : 1;
    auditLog(action, moduleName, '', count+' record(s)');
  } catch(e){}
}


// BUGFIX: function header cloudLog hilang — body fungsi ini orphan sehingga semua
// panggilan cloudLog() melempar "cloudLog is not defined" ReferenceError.
function cloudLog(msg, type='info'){
  const logEl = $('#cloudLog');
  if(!logEl) return;
  logEl.classList.remove('hidden');
  const line = document.createElement('div');
  const ts = new Date().toLocaleTimeString('id-ID',{hour12:false});
  line.className = type==='error' ? 'text-red-500' : type==='success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400';
  line.textContent = `[${ts}] ${msg}`;
  logEl.prepend(line);
  while(logEl.children.length > 20) logEl.removeChild(logEl.lastChild);
}

function updateSyncStatus(status){
  const dot = $('#syncStatusDot');
  const txt = $('#syncStatusText');
  if(!dot || !txt) return;
  if(status === 'connected'){
    dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500';
    txt.textContent = 'Terhubung';
    txt.className = 'text-xs font-medium text-emerald-600 dark:text-emerald-400';
  } else if(status === 'syncing'){
    dot.className = 'w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse';
    txt.textContent = 'Sinkronisasi...';
    txt.className = 'text-xs font-medium text-blue-600 dark:text-blue-400';
  } else if(status === 'error'){
    dot.className = 'w-2.5 h-2.5 rounded-full bg-red-500';
    txt.textContent = 'Gagal';
    txt.className = 'text-xs font-medium text-red-500';
  } else {
    dot.className = 'w-2.5 h-2.5 rounded-full bg-slate-300';
    txt.textContent = 'Belum terhubung';
    txt.className = 'text-xs font-medium text-slate-500';
  }
}

// === MERGE HELPERS - anti tabrakan ===
// ================================================================
// [BUGFIX] TOMBSTONE TRACKING — mencegah user/karyawan yang sudah
// dihapus muncul kembali setelah cloudPull.
// ================================================================
// AKAR MASALAH: merge logic untuk `users` dan `karyawan` di cloudPull
// (lihat di bawah) sebelumnya hanya tahu cara MENGGABUNGKAN data lokal
// + remote berdasarkan id — tidak ada cara untuk membedakan "id ini
// memang belum pernah ada di local" vs "id ini SENGAJA dihapus di
// local". Akibatnya: hapus user → localStorage benar (user hilang) →
// beberapa saat kemudian cloudPull otomatis berjalan (Smart-Sync) →
// payload cloud (yang belum tahu user ini sudah dihapus, misal karena
// push belum sempat selesai atau berasal dari device lain) di-merge
// balik → user yang sudah dihapus muncul lagi di tabel.
//
// PERBAIKAN: setiap kali user/karyawan dihapus, ID-nya dicatat ke
// "tombstone list" (localStorage terpisah) berikut waktu hapusnya.
// Saat merge berjalan di cloudPull, ID apa pun yang ada di tombstone
// list TIDAK akan dimasukkan ke hasil merge — bahkan jika masih ada
// di payload cloud — KECUALI jika cloud punya versi yang updatedAt-nya
// LEBIH BARU dari waktu hapus (artinya user itu memang sengaja
// dibuat ulang/diaktifkan lagi setelah penghapusan, bukan data basi).
//
// Tombstone otomatis dibersihkan setelah 30 hari (tidak perlu disimpan
// selamanya — setelah itu, payload cloud yang sudah usang dianggap
// sudah ter-replace oleh push normal di semua device yang aktif).
const TOMBSTONE_KEY = 'sjnam_deleted_tombstones_v1';
const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari

function _loadTombstones(){
  try {
    const raw = JSON.parse(localStorage.getItem(TOMBSTONE_KEY) || '{}');
    const now = Date.now();
    // Buang tombstone yang sudah kedaluwarsa (>30 hari) saat dimuat,
    // supaya file tidak membengkak tak terbatas seiring waktu.
    let changed = false;
    Object.keys(raw).forEach(scope => {
      Object.keys(raw[scope] || {}).forEach(id => {
        if(now - raw[scope][id] > TOMBSTONE_TTL_MS){ delete raw[scope][id]; changed = true; }
      });
    });
    if(changed) localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(raw));
    return raw;
  } catch(e){ return {}; }
}

function _saveTombstones(obj){
  try { localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(obj)); } catch(e){}
}

// Dipanggil dari user-management.js/karyawan-management.js tepat saat
// penghapusan terjadi — mencatat id + waktu hapus untuk scope tertentu
// ('users' atau 'karyawan'), supaya merge logic di cloudPull tahu untuk
// tidak memasukkannya kembali.
function markDeletedTombstone(scope, ids){
  if(!Array.isArray(ids) || !ids.length) return;
  const all = _loadTombstones();
  if(!all[scope]) all[scope] = {};
  const now = Date.now();
  ids.forEach(id => { all[scope][String(id)] = now; });
  _saveTombstones(all);
}
window.markDeletedTombstone = markDeletedTombstone;

// Filter array hasil merge: buang item yang id-nya ada di tombstone
// scope tertentu, KECUALI item itu sendiri punya updatedAt yang lebih
// baru dari waktu tombstone dicatat (berarti memang sengaja dibuat
// ulang setelah dihapus, bukan data basi dari cloud).
function _filterTombstoned(scope, mergedArr){
  const all = _loadTombstones();
  const scopeTombstones = all[scope];
  if(!scopeTombstones || !Object.keys(scopeTombstones).length) return mergedArr;
  return mergedArr.filter(item => {
    if(!item || item.id == null) return true;
    const deletedAt = scopeTombstones[String(item.id)];
    if(deletedAt == null) return true; // tidak pernah dihapus, aman
    const itemTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
    // Item dipertahankan HANYA jika punya bukti diperbarui setelah waktu hapus
    // (mis. dibuat ulang secara sengaja). Jika tidak ada info waktu sama
    // sekali pada item (itemTime = 0/NaN), anggap basi → tetap dibuang.
    return itemTime > deletedAt;
  });
}
window._filterTombstoned = _filterTombstoned;


function mergeById(localArr=[], remoteArr=[], tombstoneScope=null){
  const map = new Map();
  // Remote goes first (lower priority), local goes second (higher priority = overwrites)
  [...remoteArr,...localArr].forEach(it=>{
    if(!it || !it.id) return;
    const cur = map.get(it.id);
    if(!cur){
      // First occurrence: always add
      map.set(it.id, it);
    } else {
      // Compare timestamps: whichever is newer wins; if no timestamps, local wins (localArr processed last)
      const itTime  = new Date(it.updatedAt  || it.createdAt  || 0).getTime();
      const curTime = new Date(cur.updatedAt || cur.createdAt || 0).getTime();
      if(itTime >= curTime){
        map.set(it.id, it);
      }
    }
  });
  let result = Array.from(map.values());
  // [BUGFIX] Jika scope tombstone diberikan, buang item yang sudah
  // dihapus secara lokal — mencegah item yang sudah dihapus muncul
  // kembali dari payload remote yang belum tahu item ini sudah dihapus.
  // Sama seperti fix untuk users/karyawan — lihat catatan TOMBSTONE
  // TRACKING di atas (dekat deklarasi TOMBSTONE_KEY) untuk detail.
  if(tombstoneScope && typeof _filterTombstoned === 'function'){
    result = _filterTombstoned(tombstoneScope, result);
  }
  return result;
}

function mergeTraining(local, remote){
  if(!remote) return local;
  const out = {...local, ...remote};
  out.peserta = mergeById(local.peserta||[], remote.peserta||[], 'peserta');
  out.materi = mergeById(local.materi||[], remote.materi||[]);
  out.stations = mergeById(local.stations||[], remote.stations||[]);
  out.banks = (remote.banks||[]).map(rb=>{
    const lb = (local.banks||[]).find(b=>b.id===rb.id) || {questions:[]};
    return {...rb, questions: mergeById(lb.questions||[], rb.questions||[])};
  });
  // pertahankan banks lokal yang tidak ada di remote
  (local.banks||[]).forEach(lb=>{
    if(!out.banks.find(b=>b.id===lb.id)) out.banks.push(lb);
  });
  return out;
}

function getAllCloudData(){
  let training = null;
  try { training = JSON.parse(localStorage.getItem('sjn_training_v1') || 'null'); } catch(e){}
  let users = null;
  try { users = JSON.parse(localStorage.getItem('sjnam_users_v1') || 'null'); } catch(e){}
  // Data Karyawan (Tab Admin → sub-tab Data Karyawan)
  let karyawan = null;
  try { karyawan = JSON.parse(localStorage.getItem('sjnam_karyawan_v1') || 'null'); } catch(e){}
  let stcrData = null;
  try { stcrData = JSON.parse(localStorage.getItem('sjnam_stcr_data_v1') || 'null'); } catch(e){}
  // Drygoods data
  let drygoodsData = null;
  try { drygoodsData = JSON.parse(localStorage.getItem('sjnam_drygoods_v1') || 'null'); } catch(e){}
  // Hak akses per-role (Co-Admin/User/Peserta)
  let rolePerms = null;
  try { rolePerms = JSON.parse(localStorage.getItem('sjnam_role_perms_v1') || 'null'); } catch(e){}
  // Template sertifikat (gambar dataURL) — Template 1 (Sriwijaya Air) & Template 2 (NAM Air)
  let certTemplate1 = null;
  try { certTemplate1 = JSON.parse(localStorage.getItem('sjn_cert_template_1') || 'null'); } catch(e){}
  let certTemplate2 = null;
  try { certTemplate2 = JSON.parse(localStorage.getItem('sjn_cert_template_2') || 'null'); } catch(e){}
  const certTemplateActive = localStorage.getItem('sjn_cert_template_active') || null;
  // Posisi elemen draggable di kanvas sertifikat
  let certPositions = null;
  try { certPositions = JSON.parse(localStorage.getItem('sjn_cert_positions_v1') || 'null'); } catch(e){}
  // Toggle tampil/sembunyi barcode pada sertifikat
  const certBarcode = localStorage.getItem('sjn_cert_barcode_v1');
  // Custom text block tambahan pada sertifikat
  let certCustomTexts = null; // legacy — kept for compat
  try { certCustomTexts = JSON.parse(localStorage.getItem('sjn_cert_custom_texts_v1') || 'null'); } catch(e){}
  let certCustomTextsSJ = null;
  try { certCustomTextsSJ = JSON.parse(localStorage.getItem('sjn_cert_custom_texts_sj_v1') || 'null'); } catch(e){}
  let certCustomTextsNAM = null;
  try { certCustomTextsNAM = JSON.parse(localStorage.getItem('sjn_cert_custom_texts_nam_v1') || 'null'); } catch(e){}
  let certCustomTextsBoth = null;
  try { certCustomTextsBoth = JSON.parse(localStorage.getItem('sjn_cert_custom_texts_both_v1') || 'null'); } catch(e){}
  // Paraf / tanda tangan pada sertifikat
  let certParaf = null;
  try { certParaf = JSON.parse(localStorage.getItem('sjn_cert_paraf_v1') || 'null'); } catch(e){}
  const certParafShow = localStorage.getItem('sjn_cert_paraf_show_v1');

  return {
    data: window.data, stations: window.stations, dfsData: window.dfsData, settings: window.settings,
    training, users, karyawan, stcrData, drygoodsData,
    rolePerms, certTemplate1, certTemplate2, certTemplateActive, certPositions, certBarcode, certCustomTexts,
    certCustomTextsSJ, certCustomTextsNAM, certCustomTextsBoth,
    certParaf, certParafShow,
    savedAt: new Date().toISOString(), version: 'v5.0-audit'
  };
}

// Generate/get a persistent device ID for this browser
(function _initDeviceId(){
  if(!localStorage.getItem('sjnam_device_id')){
    localStorage.setItem('sjnam_device_id', 'dev_'+Date.now()+'_'+Math.random().toString(36).slice(2,8));
  }
})();
function getDeviceId(){ return localStorage.getItem('sjnam_device_id') || 'unknown'; }

// Merge two arrays by a unique key (id or App Service & Tehnik) — last-write-wins per item
function _mergeArrays(base, incoming, keyFn){
  if(!Array.isArray(base)) base = [];
  if(!Array.isArray(incoming)) return base;
  const map = new Map();
  base.forEach(item=>{ const k = keyFn(item); if(k) map.set(k, item); });
  // incoming overrides existing items and adds new ones
  incoming.forEach(item=>{ const k = keyFn(item); if(k) map.set(k, item); });
  return Array.from(map.values());
}

// UPLOAD ke Supabase (upsert dengan record_id = 'sjnam_main')
// Smart Push: hanya upload jika data benar-benar berubah dari push terakhir
// Conflict-safe: jika cloud lebih baru dari pull terakhir kita, merge array data dulu
// Offline-safe: jika tidak ada koneksi, antri ke IndexedDB dan flush saat online
async function cloudPush(silent=false, dirtyHint=null){
  const sb = getSupabaseClient();
  if(!sb){ if(!silent) showToast('Masukkan URL & Key Supabase dulu','error'); return false; }

  const localPayload = getAllCloudData();
  const currentHash = _hashPayload(localPayload);

  // Jika hash sama dengan push terakhir → tidak ada perubahan, skip
  if(silent && currentHash && currentHash === _lastPushedHash){
    cloudLog('⏭️ Smart Push: tidak ada perubahan data, skip upload', 'info');
    return true;
  }

  // Jika offline — antri ke IndexedDB dan keluar
  if(!navigator.onLine){
    await _offlineQueue.enqueue(localPayload);
    cloudLog('📴 Offline — perubahan disimpan ke antrian lokal (akan dikirim saat online)', 'info');
    if(!silent) showToast('📴 Offline — perubahan akan dikirim saat koneksi kembali', 'info');
    // Tetap update hash agar tidak push ulang hal yang sama saat online
    window._lastPushedHash = currentHash;
    return true; // return true agar caller tidak error
  }

  updateSyncStatus('syncing');
  try {
    // === CONFLICT CHECK: baca updated_at cloud dulu ===
    let mergedPayload = localPayload;
    const { data: cloudRow } = await sb.from('sjnam_sync').select('payload, updated_at').eq('id','sjnam_main').maybeSingle();
    if(cloudRow && cloudRow.updated_at && (
      !_lastCloudUpdatedAt ||                          // Sesi baru (belum pernah pull) → selalu merge
      cloudRow.updated_at > _lastCloudUpdatedAt         // Cloud lebih baru dari pull terakhir
    )){
      // Cloud lebih baru dari pull terakhir kita → ada perubahan dari device lain
      // Merge semua array data agar tidak kehilangan data dari device lain
      const cloudPayload = cloudRow.payload || {};
      const byIdOrKey = r => (r.id || r['App Service & Tehnik'] || JSON.stringify(r));
      const pesertaKeyFn = r => (r.id || r.username || JSON.stringify(r));
      const dgTrxKeyFn = r => r.id || JSON.stringify(r);

      // Per-record conflict detection untuk modul data utama
      const _mergeWithConflict = (cloudArr=[], localArr=[], keyFn)=>{
        const map = new Map();
        cloudArr.forEach(item=>{ const k=keyFn(item); if(k) map.set(k,item); });
        localArr.forEach(item=>{
          const k = keyFn(item);
          if(!k){ map.set(JSON.stringify(item),item); return; }
          const existing = map.get(k);
          if(!existing){ map.set(k,item); return; }
          const { winner, conflict } = detectConflict(item, existing);
          if(conflict){
            cloudLog('⚠️ Konflik record '+k+': '+item._updatedBy+' vs '+existing._updatedBy+' — '+winner._updatedBy+' menang', 'info');
          }
          map.set(k, winner);
        });
        return Array.from(map.values());
      };

      mergedPayload = {
        ...localPayload,
        data:     _mergeWithConflict(cloudPayload.data,     localPayload.data,     byIdOrKey),
        dfsData:  _mergeWithConflict(cloudPayload.dfsData,  localPayload.dfsData,  byIdOrKey),
        stcrData: _mergeWithConflict(cloudPayload.stcrData, localPayload.stcrData, byIdOrKey),
      };
      // Merge Data Karyawan (key by id) — sama seperti drygoodsData.employees,
      // supaya karyawan yang ditambah dari device lain tidak hilang saat push.
      if(Array.isArray(localPayload.karyawan) && Array.isArray(cloudPayload.karyawan)){
        mergedPayload.karyawan = _mergeWithConflict(cloudPayload.karyawan, localPayload.karyawan, dgTrxKeyFn);
      }
      // Merge peserta training jika ada
      if(localPayload.training && cloudPayload.training){
        mergedPayload.training = {...localPayload.training};
        if(Array.isArray(localPayload.training.peserta) && Array.isArray(cloudPayload.training.peserta)){
          mergedPayload.training.peserta = _mergeWithConflict(cloudPayload.training.peserta, localPayload.training.peserta, pesertaKeyFn);
        }
      }
      // Merge drygoods transactions (yang paling sering berubah per-device)
      if(localPayload.drygoodsData && cloudPayload.drygoodsData){
        mergedPayload.drygoodsData = {...localPayload.drygoodsData};
        if(Array.isArray(localPayload.drygoodsData.transactions) && Array.isArray(cloudPayload.drygoodsData.transactions)){
          mergedPayload.drygoodsData.transactions = _mergeWithConflict(
            cloudPayload.drygoodsData.transactions, localPayload.drygoodsData.transactions, dgTrxKeyFn
          );
        }
        // Catatan: drygoodsData.employees (karyawan IFS Drygoods) sudah TIDAK
        // dipakai lagi — data karyawan kini disimpan & di-merge lewat
        // `karyawan` (lihat merge Data Karyawan di atas), satu sumber untuk
        // semua modul (Data Karyawan utama + IFS Station Drygoods).
        if(Array.isArray(localPayload.drygoodsData.bankItems) && Array.isArray(cloudPayload.drygoodsData.bankItems)){
          mergedPayload.drygoodsData.bankItems = _mergeWithConflict(
            cloudPayload.drygoodsData.bankItems, localPayload.drygoodsData.bankItems, dgTrxKeyFn
          );
        }
      }
      cloudLog('🔀 Konflik terdeteksi — data digabung otomatis (merge). Cloud: '+cloudRow.updated_at, 'info');
      await auditLog('merge', dirtyHint||'all', '', 'Merge dari cloud: '+cloudRow.updated_at);
      if(!silent) showToast('🔀 Merge: data dari 2 device digabung otomatis', 'info');
    }

    // Tambahkan device id ke payload untuk tracing
    mergedPayload._pushedBy = getDeviceId();
    mergedPayload._pushedAt = new Date().toISOString();
    // Tandai modul yang di-push untuk audit
    if(dirtyHint) mergedPayload._dirtyModule = dirtyHint;

    const { data: upsertResult, error } = await sb
      .from('sjnam_sync')
      .upsert({ id: 'sjnam_main', payload: mergedPayload, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      .select('updated_at')
      .single();

    if(error) throw new Error(error.message);

    // Gunakan updated_at dari server (bukan waktu lokal) agar perbandingan timestamp realtime akurat
    const serverUpdatedAt = upsertResult?.updated_at || mergedPayload._pushedAt;
    window._lastPushedHash = _hashPayload(mergedPayload);
    window._lastCloudUpdatedAt = serverUpdatedAt;
    try{ localStorage.setItem(window._LAST_PULL_TS_KEY, window._lastCloudUpdatedAt); }catch(e){}

    // Reset dirty flag untuk modul yang baru di-push
    if(dirtyHint) clearDirty(dirtyHint); else clearDirty();

    // Audit log push berhasil
    await auditLog('push', dirtyHint||'all', '', 'Push berhasil. Server ts: '+serverUpdatedAt);

    // Push berhasil → rolePerms sudah aman di cloud, hapus flag dirty
    window._rolePermsLocalDirty = false;
    updateSyncStatus('connected');
    cloudLog('✅ Data tersimpan ke Supabase ('+window.data.length+' delay, '+window.dfsData.length+' DFS)', 'success');
    if(!silent) showToast('⚡ Supabase Sync berhasil! ('+window.data.length+' records)','success');
    saveCloudConfig();
    return true;
  } catch(err){
    updateSyncStatus('error');
    cloudLog('❌ Gagal upload: '+err.message, 'error');
    if(!silent) showToast('Sync gagal: '+err.message,'error');
    return false;
  }
}

// DOWNLOAD dari Supabase
// Smart Pull: cek updated_at cloud terlebih dahulu; pull hanya jika cloud lebih baru
async function cloudPull(silent = false){
  const sb = getSupabaseClient();
  if(!sb){ if(!silent) showToast('Masukkan URL & Key Supabase dulu','error'); return; }

  updateSyncStatus('syncing');
  try {
    // === SMART PULL TAHAP 1: cek "ukuran" perubahan dulu — hanya minta kolom updated_at,
    // BUKAN payload. Ini seperti cek timestamp/besar file sebelum benar-benar mengunduhnya:
    // kalau updated_at cloud sama/tidak lebih baru dari yang terakhir kita tarik, berarti
    // tidak ada perubahan data antar device → hentikan di sini, payload TIDAK pernah diunduh.
    const { data: meta, error: metaError } = await sb
      .from('sjnam_sync')
      .select('updated_at')
      .eq('id', 'sjnam_main')
      .single();

    if(metaError) throw new Error(metaError.message);
    if(!meta) throw new Error('Data tidak ditemukan di Supabase');

    const cloudUpdatedAt = meta.updated_at;

    // Tidak ada perubahan dari device lain → skip total, tidak ada payload yang ditarik.
    // Berlaku untuk silent (auto/realtime) maupun manual — keduanya tidak perlu pull
    // kalau memang tidak ada apa-apa yang baru di cloud.
    if(_lastCloudUpdatedAt && cloudUpdatedAt && cloudUpdatedAt <= _lastCloudUpdatedAt){
      cloudLog('⏭️ Smart Pull: tidak ada perubahan data antar device, skip pull (payload tidak diunduh)', 'info');
      updateSyncStatus('connected');
      if(!silent) showToast('Data sudah paling baru — tidak ada perubahan dari device lain','info');
      return;
    }

    // === SMART PULL TAHAP 2: ada perubahan terdeteksi → baru sekarang ambil payload penuh ===
    const { data: rows, error } = await sb
      .from('sjnam_sync')
      .select('payload, updated_at')
      .eq('id', 'sjnam_main')
      .single();

    if(error) throw new Error(error.message);
    if(!rows) throw new Error('Data tidak ditemukan di Supabase');

    const rec = rows.payload;
    const savedAt = cloudUpdatedAt ? new Date(cloudUpdatedAt).toLocaleString('id-ID') : '-';

    // Jika tidak silent, minta konfirmasi seperti sebelumnya
    if(!silent){
      const ok = await showConfirm('⚡ Tarik Data dari Supabase',
        `Data cloud: ${(rec.data||[]).length} delay records, ${(rec.dfsData||[]).length} DFS, disimpan ${savedAt}.\n\nData lokal saat ini akan DIGANTI. Lanjutkan?`
      );
      if(!ok){ updateSyncStatus('connected'); return; }
    }

    window._cloudPullInProgress = true;
    try {
    if(Array.isArray(rec.data)) { window.data = rec.data; localStorage.setItem(STORAGE_KEY, JSON.stringify(window.data)); }
    if(Array.isArray(rec.stations) && rec.stations.length > 0) { window.stations = rec.stations; localStorage.setItem(STATIONS_KEY, JSON.stringify(window.stations)); }
    if(Array.isArray(rec.dfsData)) { window.dfsData = rec.dfsData; localStorage.setItem(DFS_KEY, JSON.stringify(window.dfsData)); }
    // Gunakan localStorage langsung (BUKAN saveSettings) agar tidak memicu triggerAutoSync di tengah pull
    if(rec.settings) { window.settings = {...window.settings, ...rec.settings}; localStorage.setItem(SETTINGS_KEY, JSON.stringify(window.settings)); applyDarkMode(); }
    if(rec.training){
      // BUGFIX: sebelumnya overwrite langsung — peserta yang ditambahkan di device lain bisa hilang.
      // Gunakan mergeTraining() agar peserta, materi, banks, dan questions dari kedua device digabung.
      const _localTraining = (function(){ try{ return JSON.parse(localStorage.getItem('sjn_training_v1')||'null'); }catch(e){ return null; } })();
      const _mergedTraining = (typeof mergeTraining === 'function' && _localTraining)
        ? mergeTraining(_localTraining, rec.training)
        : rec.training;
      localStorage.setItem('sjn_training_v1', JSON.stringify(_mergedTraining));
      if(window.trainingData){
        Object.assign(window.trainingData, _mergedTraining);
      }
    }
    if(Array.isArray(rec.users)){
      // BUGFIX: merge users instead of overwrite to avoid losing users added on other devices.
      // Local admin user (id=1) always wins to prevent lockout.
      const _localUsers = (function(){ try{ return JSON.parse(localStorage.getItem('sjnam_users_v1')||'null'); }catch(e){ return null; } })();
      let _mergedUsers = rec.users;
      if(_localUsers && Array.isArray(_localUsers)){
        const _userMap = new Map();
        // Remote first (lower priority)
        rec.users.forEach(u=>{ if(u.id) _userMap.set(u.id, u); });
        // Local overwrites (higher priority — local admin changes win)
        _localUsers.forEach(u=>{ if(u.id) _userMap.set(u.id, u); });
        _mergedUsers = Array.from(_userMap.values());
      }
      // [BUGFIX] Buang user yang sudah dihapus secara lokal (tercatat di
      // tombstone) supaya tidak muncul kembali dari payload cloud yang
      // belum tahu user ini sudah dihapus. Lihat catatan TOMBSTONE TRACKING
      // di atas (dekat mergeById) untuk detail akar masalah & desain fix.
      if(typeof _filterTombstoned === 'function') _mergedUsers = _filterTombstoned('users', _mergedUsers);
      localStorage.setItem('sjnam_users_v1', JSON.stringify(_mergedUsers));
      if(window._userSelectedIds) window._userSelectedIds.clear(); // clear stale selections
      if(typeof renderUserTable === 'function') renderUserTable();
    }
    // Restore Data Karyawan — merge by id (local wins on conflict) supaya karyawan
    // yang ditambahkan dari device lain tidak hilang, sama seperti pola users di atas.
    if(Array.isArray(rec.karyawan)){
      const _localKar = (function(){ try{ return JSON.parse(localStorage.getItem('sjnam_karyawan_v1')||'null'); }catch(e){ return null; } })();
      let _mergedKar = rec.karyawan;
      if(_localKar && Array.isArray(_localKar)){
        const _karMap = new Map();
        rec.karyawan.forEach(k=>{ if(k.id) _karMap.set(k.id, k); });
        _localKar.forEach(k=>{ if(k.id) _karMap.set(k.id, k); });
        _mergedKar = Array.from(_karMap.values());
      }
      // [BUGFIX] Sama seperti users di atas — buang karyawan yang sudah
      // dihapus secara lokal (tercatat di tombstone) supaya tidak muncul
      // kembali dari payload cloud yang belum tahu sudah dihapus.
      if(typeof _filterTombstoned === 'function') _mergedKar = _filterTombstoned('karyawan', _mergedKar);
      localStorage.setItem('sjnam_karyawan_v1', JSON.stringify(_mergedKar));
      if(typeof window.setKaryawanData === 'function') window.setKaryawanData(_mergedKar);
      if(typeof window.renderKaryawanUserOptions === 'function') window.renderKaryawanUserOptions();
      // BUG2 FIX: Jika user yang login adalah User-DRG, perbarui stationnya
      // setelah karyawan ter-sync dari cloud/realtime agar pembatasan data selalu akurat.
      (function _refreshDrgStationFromCloud(){
        try {
          var _cu = window.currentUser;
          if(!_cu || _cu.role !== 'User-DRG') return;
          var _myUser = (_cu.username||'').toLowerCase();
          var _found = _mergedKar.find(function(k){ return (k.username||'').toLowerCase()===_myUser; });
          var _newSt = (_found && _found.station) ? _found.station : null;
          if(window._userDrgStation === _newSt) return; // tidak ada perubahan
          window._userDrgStation = _newSt;
          if(_cu) _cu.station = _newSt;
          // Re-apply lock
          document.querySelectorAll('[data-dg-station]').forEach(function(t){
            var ts=t.dataset.dgStation; if(!ts) return;
            if(!_newSt||_newSt==='ALL'){t.style.opacity='';t.style.pointerEvents='';t.title='';}
            else if(ts===_newSt){t.style.opacity='';t.style.pointerEvents='';t.title='';}
            else{t.style.opacity='0.35';t.style.pointerEvents='none';t.title=(ts==='ALL'?'Akses terbatas':'Akses terbatas ke station '+_newSt);}
          });
          if(typeof window.DRYGOODS==='object'&&typeof window.DRYGOODS.renderAll==='function'){
            setTimeout(function(){window.DRYGOODS.renderAll();},50);
          }
        } catch(ex){ console.warn('[DRG Cloud Station Refresh]', ex); }
      })();
    }
    // Restore data STCR
    if(Array.isArray(rec.stcrData) && rec.stcrData.length > 0){
      localStorage.setItem('sjnam_stcr_data_v1', JSON.stringify(rec.stcrData));
      if(window.STCR && typeof window.STCR.loadData === 'function'){
        window.STCR.loadData();
        if(typeof window.STCR.applyFilters === 'function') window.STCR.applyFilters();
      }
    }
    // Restore drygoods data
    if(rec.drygoodsData){
      localStorage.setItem('sjnam_drygoods_v1', JSON.stringify(rec.drygoodsData));
      if(typeof window.DRYGOODS === 'object' && typeof window.DRYGOODS.loadData === 'function'){
        window.DRYGOODS.loadData();
        if(typeof _applyDrgLock==='function')_applyDrgLock();
        window.DRYGOODS.renderAll();
      }
    }
    // Restore hak akses per-role
    // BUGFIX: jangan timpa rolePerms lokal yang baru disimpan Admin (_rolePermsLocalDirty=true)
    // sebelum sempat di-push ke cloud. Biarkan push yang sudah dijadwalkan yang menang.
    if(rec.rolePerms){
      if(window._rolePermsLocalDirty){
        cloudLog('⏭️ Pull: skip rolePerms dari cloud — ada perubahan lokal yang belum ter-push', 'info');
        // Jadwalkan push ulang agar perms lokal tidak hilang
        if(typeof cloudPush === 'function' && cloudConfig.supabaseUrl){
          setTimeout(function(){ cloudPush(true).then(function(ok){ if(ok) window._rolePermsLocalDirty=false; }).catch(function(e){ console.warn('[RolePerms push]', e); }); }, 200);
        }
      } else {
        localStorage.setItem('sjnam_role_perms_v1', JSON.stringify(rec.rolePerms));
        if(typeof window.renderPermTable === 'function') window.renderPermTable();
        if(typeof window.applyPermissions === 'function') window.applyPermissions(); else if(typeof applyPermissions === 'function') applyPermissions();
      }
    }
    // Restore template & elemen sertifikat (gambar, posisi, toggle barcode, custom text)
    let certChanged = false;
    if(rec.certTemplate1){ localStorage.setItem('sjn_cert_template_1', JSON.stringify(rec.certTemplate1)); certChanged = true; }
    if(rec.certTemplate2){ localStorage.setItem('sjn_cert_template_2', JSON.stringify(rec.certTemplate2)); certChanged = true; }
    if(rec.certTemplateActive){ localStorage.setItem('sjn_cert_template_active', rec.certTemplateActive); certChanged = true; }
    if(rec.certPositions){ localStorage.setItem('sjn_cert_positions_v1', JSON.stringify(rec.certPositions)); certChanged = true; }
    if(rec.certBarcode !== undefined && rec.certBarcode !== null){ localStorage.setItem('sjn_cert_barcode_v1', rec.certBarcode); certChanged = true; }
    if(rec.certCustomTexts){ localStorage.setItem('sjn_cert_custom_texts_v1', JSON.stringify(rec.certCustomTexts)); certChanged = true; }
    if(rec.certCustomTextsSJ)   { localStorage.setItem('sjn_cert_custom_texts_sj_v1',   JSON.stringify(rec.certCustomTextsSJ));   certChanged = true; }
    if(rec.certCustomTextsNAM)  { localStorage.setItem('sjn_cert_custom_texts_nam_v1',  JSON.stringify(rec.certCustomTextsNAM));  certChanged = true; }
    if(rec.certCustomTextsBoth) { localStorage.setItem('sjn_cert_custom_texts_both_v1', JSON.stringify(rec.certCustomTextsBoth)); certChanged = true; }
    if(rec.certParaf){ localStorage.setItem('sjn_cert_paraf_v1', JSON.stringify(rec.certParaf)); certChanged = true; }
    if(rec.certParafShow !== undefined && rec.certParafShow !== null){ localStorage.setItem('sjn_cert_paraf_show_v1', rec.certParafShow); certChanged = true; }
    if(certChanged){
      if(typeof window.loadCertificateTemplate === 'function') window.loadCertificateTemplate();
      if(typeof window.ctbRenderAll === 'function') window.ctbRenderAll();
    }
    // Simpan timestamp & hash SEBELUM melepas flag, agar triggerAutoSync tidak push balik
    // Batalkan push timer yang mungkin sedang menunggu (debounce) — data sudah diambil dari cloud
    // BUGFIX: jangan batalkan jika ada perubahan rolePerms lokal yang belum ter-push
    if(!window._rolePermsLocalDirty){
      if(_autoSyncTimer){ clearTimeout(_autoSyncTimer); window._autoSyncTimer = null; }
    }
    window._lastCloudUpdatedAt = cloudUpdatedAt;
    try{ localStorage.setItem(window._LAST_PULL_TS_KEY, window._lastCloudUpdatedAt); }catch(e){}
    window._lastPushedHash = _hashPayload(getAllCloudData());
    } finally {
    window._cloudPullInProgress = false;  // always reset — prevents deadlock on error
    }

    renderTable();
    renderDashboard();
    renderStations();
    renderDfsTable();
    if(typeof window.refreshTrainingViews === 'function') window.refreshTrainingViews();
    if(typeof window.renderBankStations === 'function') window.renderBankStations();

    updateSyncStatus('connected');
    cloudLog('✅ Data berhasil diambil dari Supabase ('+window.data.length+' delay, '+window.dfsData.length+' DFS)', 'success');
    blinkBlueLight(); // selalu blink saat data berhasil ditarik
    // Audit log pull berhasil
    await auditLog('pull', 'all', '', 'Pull dari cloud. '+window.data.length+' delay, '+window.dfsData.length+' DFS');
    // Flush offline queue jika ada — mungkin ada perubahan yang tertunda saat offline
    setTimeout(_flushOfflineQueue, 2000);
  } catch(err){
    window._cloudPullInProgress = false; // also reset on outer catch
    updateSyncStatus('error');
    cloudLog('❌ Gagal download: '+err.message, 'error');
    if(!silent) showToast('Gagal download: '+err.message,'error');
  }
}



function blinkBlueLight(){
  const el = document.getElementById('autoSyncLight');
  if(!el) return;
  el.classList.remove('active');
  void el.offsetWidth;
  el.classList.add('active');
  setTimeout(()=>el.classList.remove('active'), 2200);
}

function blinkSyncLight(){
  const el = document.getElementById('syncLight');
  if(!el) return;
  el.classList.remove('active');
  void el.offsetWidth; // restart animation
  el.classList.add('active');
  setTimeout(()=>el.classList.remove('active'), 3200);
}

// REALTIME SUBSCRIPTION — dengarkan perubahan dari device lain
function startRealtimeSubscription(){
  // BUGFIX (kritis): seluruh isi fungsi ini dibungkus try-catch. Sebelumnya, jika
  // Supabase client gagal membuat channel (mis. versi SDK berubah, network putus
  // di tengah call, CORS, dll), error di sini akan UNCAUGHT dan menghentikan
  // SELURUH <script> tag yang sama — termasuk checkAuth() & pemasangan listener
  // submit form login yang didefinisikan lebih jauh di bawah pada script yang sama.
  // Akibatnya: tombol "Masuk" tidak merespons sama sekali (listener belum terpasang),
  // dan localStorage user/sesi tidak pernah diinisialisasi. Cloud sync bersifat
  // best-effort dan TIDAK BOLEH PERNAH bisa menjatuhkan fitur login/auth.
  try {
    const sb = getSupabaseClient();
    if(!sb) return;
    if(_realtimeChannel) { sb.removeChannel(_realtimeChannel); window._realtimeChannel = null; }

    window._realtimeChannel = sb
      .channel('sjnam_sync_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sjnam_sync', filter: 'id=eq.sjnam_main' },
        (payload) => {
          // PENTING: callback ini harus NON-ASYNC — Supabase Realtime tidak support async handler
          // (return Promise dianggap "true" → "message channel closed" error)
          // Jalankan logic async secara terpisah (fire-and-forget) agar callback return undefined/void
          (async () => {
          try {
          if(_cloudPullInProgress) return;
          const rec = payload.new?.payload;
          if(!rec) return;
          // Cek apakah data ini adalah push dari device kita sendiri — jika ya, skip
          if(rec._pushedBy && rec._pushedBy === getDeviceId()) {
            cloudLog('⏭️ Realtime: update dari device sendiri — skip pull balik', 'info');
            return;
          }
          cloudLog('🔄 Update masuk dari device lain ('+( rec._pushedBy||'?')+') — memuat ulang data...', 'info');
          window._cloudPullInProgress = true;
          try {
          if(Array.isArray(rec.data)) { window.data = rec.data; localStorage.setItem(STORAGE_KEY, JSON.stringify(window.data)); }
          if(Array.isArray(rec.stations) && rec.stations.length > 0) { window.stations = rec.stations; localStorage.setItem(STATIONS_KEY, JSON.stringify(window.stations)); }
          if(Array.isArray(rec.dfsData)) { window.dfsData = rec.dfsData; localStorage.setItem(DFS_KEY, JSON.stringify(window.dfsData)); }
          // Gunakan localStorage langsung (BUKAN saveSettings) agar tidak memicu triggerAutoSync
          if(rec.settings) { window.settings = {...window.settings, ...rec.settings}; localStorage.setItem(SETTINGS_KEY, JSON.stringify(window.settings)); applyDarkMode(); }
          if(rec.training){
            // BUGFIX: merge training instead of overwrite to prevent data loss across devices
            const _rtLocalTr = (function(){ try{ return JSON.parse(localStorage.getItem('sjn_training_v1')||'null'); }catch(e){ return null; } })();
            const _rtMergedTr = (typeof mergeTraining === 'function' && _rtLocalTr)
              ? mergeTraining(_rtLocalTr, rec.training)
              : rec.training;
            localStorage.setItem('sjn_training_v1', JSON.stringify(_rtMergedTr));
            if(window.trainingData){ Object.assign(window.trainingData, _rtMergedTr); }
          }
          if(Array.isArray(rec.users)){
              // BUGFIX: merge users dari realtime — lokal menang untuk mencegah kehilangan user baru
              const _rtLU = (function(){ try{ return JSON.parse(localStorage.getItem('sjnam_users_v1')||'null'); }catch(e){ return null; } })();
              let _rtMU = rec.users;
              if(_rtLU && Array.isArray(_rtLU)){
                const _m = new Map();
                rec.users.forEach(u=>{ if(u.id) _m.set(u.id, u); });
                _rtLU.forEach(u=>{ if(u.id) _m.set(u.id, u); });
                _rtMU = Array.from(_m.values());
              }
              // [BUGFIX] Sama seperti fix di cloudPull() — buang user yang sudah
              // dihapus secara lokal (tercatat di tombstone) supaya tidak muncul
              // kembali dari payload realtime yang belum tahu user ini sudah
              // dihapus. Ini adalah jalur KEDUA yang bisa menyebabkan user yang
              // sudah dihapus "kembali muncul" selain cloudPull() yang sudah
              // diperbaiki sebelumnya — realtime subscription dipicu setiap kali
              // device LAIN melakukan push, jadi sering terjadi bahkan hanya
              // beberapa detik setelah penghapusan. Lihat catatan TOMBSTONE
              // TRACKING di atas (dekat mergeById) untuk detail.
              if(typeof _filterTombstoned === 'function') _rtMU = _filterTombstoned('users', _rtMU);
              localStorage.setItem('sjnam_users_v1', JSON.stringify(_rtMU));
              if(window._userSelectedIds) window._userSelectedIds.clear();
              if(typeof renderUserTable === 'function') renderUserTable();
          }
          // Restore Data Karyawan dari realtime — merge by id, sama seperti cloudPull
          if(Array.isArray(rec.karyawan)){
              const _rtLK = (function(){ try{ return JSON.parse(localStorage.getItem('sjnam_karyawan_v1')||'null'); }catch(e){ return null; } })();
              let _rtMK = rec.karyawan;
              if(_rtLK && Array.isArray(_rtLK)){
                const _mk = new Map();
                rec.karyawan.forEach(k=>{ if(k.id) _mk.set(k.id, k); });
                _rtLK.forEach(k=>{ if(k.id) _mk.set(k.id, k); });
                _rtMK = Array.from(_mk.values());
              }
              // [BUGFIX] Sama seperti fix untuk users di atas — buang karyawan
              // yang sudah dihapus secara lokal agar tidak kembali muncul dari
              // payload realtime yang belum tahu data ini sudah dihapus.
              if(typeof _filterTombstoned === 'function') _rtMK = _filterTombstoned('karyawan', _rtMK);
              localStorage.setItem('sjnam_karyawan_v1', JSON.stringify(_rtMK));
              if(typeof window.setKaryawanData === 'function') window.setKaryawanData(_rtMK);
              if(typeof window.renderKaryawanUserOptions === 'function') window.renderKaryawanUserOptions();
          }
          // Restore data STCR dari realtime
          if(Array.isArray(rec.stcrData) && rec.stcrData.length > 0){
            localStorage.setItem('sjnam_stcr_data_v1', JSON.stringify(rec.stcrData));
            if(window.STCR && typeof window.STCR.loadData === 'function'){
              window.STCR.loadData();
              if(typeof window.STCR.applyFilters === 'function') window.STCR.applyFilters();
            }
          }
          // Restore drygoods dari realtime
          if(rec.drygoodsData){
            localStorage.setItem('sjnam_drygoods_v1', JSON.stringify(rec.drygoodsData));
            if(typeof window.DRYGOODS === 'object' && typeof window.DRYGOODS.loadData === 'function'){
              window.DRYGOODS.loadData();
              if(typeof _applyDrgLock==='function')_applyDrgLock();
              window.DRYGOODS.renderAll();
            }
          }
          // Restore hak akses per-role dari realtime
          // BUGFIX: sama seperti cloudPull — jangan timpa perms lokal yang dirty
          if(rec.rolePerms){
            if(window._rolePermsLocalDirty){
              cloudLog('⏭️ Realtime: skip rolePerms dari cloud — ada perubahan lokal yang belum ter-push', 'info');
              // Push balik perms lokal agar cloud sinkron
              if(typeof cloudPush === 'function' && cloudConfig.supabaseUrl){
                setTimeout(function(){ cloudPush(true).then(function(ok){ if(ok) window._rolePermsLocalDirty=false; }).catch(function(e){ console.warn('[RolePerms push]', e); }); }, 300);
              }
            } else {
              localStorage.setItem('sjnam_role_perms_v1', JSON.stringify(rec.rolePerms));
              if(typeof window.renderPermTable === 'function') window.renderPermTable();
              if(typeof window.applyPermissions === 'function') window.applyPermissions(); else if(typeof applyPermissions === 'function') applyPermissions();
            }
          }
          // Restore template & elemen sertifikat dari realtime
          let certChangedRt = false;
          if(rec.certTemplate1){ localStorage.setItem('sjn_cert_template_1', JSON.stringify(rec.certTemplate1)); certChangedRt = true; }
          if(rec.certTemplate2){ localStorage.setItem('sjn_cert_template_2', JSON.stringify(rec.certTemplate2)); certChangedRt = true; }
          if(rec.certTemplateActive){ localStorage.setItem('sjn_cert_template_active', rec.certTemplateActive); certChangedRt = true; }
          if(rec.certPositions){ localStorage.setItem('sjn_cert_positions_v1', JSON.stringify(rec.certPositions)); certChangedRt = true; }
          if(rec.certBarcode !== undefined && rec.certBarcode !== null){ localStorage.setItem('sjn_cert_barcode_v1', rec.certBarcode); certChangedRt = true; }
          if(rec.certCustomTexts){ localStorage.setItem('sjn_cert_custom_texts_v1', JSON.stringify(rec.certCustomTexts)); certChangedRt = true; }
          if(rec.certCustomTextsSJ)   { localStorage.setItem('sjn_cert_custom_texts_sj_v1',   JSON.stringify(rec.certCustomTextsSJ));   certChangedRt = true; }
          if(rec.certCustomTextsNAM)  { localStorage.setItem('sjn_cert_custom_texts_nam_v1',  JSON.stringify(rec.certCustomTextsNAM));  certChangedRt = true; }
          if(rec.certCustomTextsBoth) { localStorage.setItem('sjn_cert_custom_texts_both_v1', JSON.stringify(rec.certCustomTextsBoth)); certChangedRt = true; }
          if(rec.certParaf){ localStorage.setItem('sjn_cert_paraf_v1', JSON.stringify(rec.certParaf)); certChangedRt = true; }
          if(rec.certParafShow !== undefined && rec.certParafShow !== null){ localStorage.setItem('sjn_cert_paraf_show_v1', rec.certParafShow); certChangedRt = true; }
          if(certChangedRt){
            if(typeof window.loadCertificateTemplate === 'function') window.loadCertificateTemplate();
            if(typeof window.ctbRenderAll === 'function') window.ctbRenderAll();
          }
          // Simpan server timestamp — PENTING: gunakan updated_at dari server, bukan waktu lokal
          if(payload.new?.updated_at){ window._lastCloudUpdatedAt = payload.new.updated_at; try{ localStorage.setItem(window._LAST_PULL_TS_KEY, window._lastCloudUpdatedAt); }catch(e){} }
          // Batalkan push timer yang mungkin sedang menunggu — data sudah datang dari cloud
          // BUGFIX: jangan batalkan jika ada perubahan rolePerms lokal yang belum ter-push
          if(!window._rolePermsLocalDirty){
            if(_autoSyncTimer){ clearTimeout(_autoSyncTimer); window._autoSyncTimer = null; }
          }
          // Set hash SETELAH semua data diapply ke localStorage & variabel in-memory
          window._lastPushedHash = _hashPayload(getAllCloudData());
          } finally {
          window._cloudPullInProgress = false; // always reset — prevents deadlock
          }
          renderTable();
          renderDashboard();
          renderStations();
          renderDfsTable();
          if(typeof window.refreshTrainingViews === 'function') window.refreshTrainingViews();
          if(typeof window.renderBankStations === 'function') window.renderBankStations();
          blinkSyncLight();
          } catch(rtErr){
            console.error('[Cloud Sync] Error saat memproses realtime payload:', rtErr);
            window._cloudPullInProgress = false;
          }
          })(); // fire-and-forget async IIFE — callback sendiri return void (bukan Promise)
        }
      )
      .subscribe((status) => {
        if(status === 'SUBSCRIBED'){
          cloudLog('📡 Realtime aktif — mendengarkan perubahan...', 'success');
          updateSyncStatus('connected');
        }
      });
  } catch(err){
    console.error('[Cloud Sync] Gagal memulai realtime subscription (sinkronisasi cloud dilewati, sisa aplikasi tetap berjalan normal):', err);
  }
}

// Auto-sync: patch saveData, saveStations, saveDfsData untuk trigger cloud sync otomatis

// ===== PENJADWALAN BACKUP HARIAN =====
(function setupDailyBackup(){
  const BACKUP_KEY = 'sjnam_last_backup_v1';
  
  async function doScheduledBackup(){
    const now = new Date();
    const lastBackup = localStorage.getItem(BACKUP_KEY);
    const today = now.toISOString().slice(0,10); // YYYY-MM-DD
    
    if(lastBackup === today) return; // Sudah backup hari ini
    
    console.log('[DAILY BACKUP] Menjalankan backup harian...');
    
    // 1. Export JSON lokal
    try {
      const allData = {
        data: JSON.parse(localStorage.getItem('sjn_delay_pro_v4')||'[]'),
        stations: JSON.parse(localStorage.getItem('sjn_stations_v2')||'[]'),
        dfsData: JSON.parse(localStorage.getItem('sjn_dfs_bank_v1')||'[]'),
        settings: JSON.parse(localStorage.getItem('sjn_settings_v4')||'{}'),
        users: JSON.parse(localStorage.getItem('sjnam_users_v1')||'[]'),
        stcrData: JSON.parse(localStorage.getItem('sjnam_stcr_data_v1')||'[]'),
        exportDate: now.toISOString(),
        exportType: 'daily_scheduled'
      };
      const blob = new Blob([JSON.stringify(allData,null,2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sjnam_backup_${today}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log('[DAILY BACKUP] JSON exported: sjnam_backup_'+today+'.json');
    } catch(e) {
      console.warn('[DAILY BACKUP] JSON export gagal:', e.message);
    }
    
    // 2. Push ke Supabase (silent)
    if(typeof cloudPush === 'function'){
      const ok = await cloudPush(true);
      if(ok) console.log('[DAILY BACKUP] Supabase push sukses');
      else console.warn('[DAILY BACKUP] Supabase push gagal (mungkin belum dikonfigurasi)');
    }
    
    localStorage.setItem(BACKUP_KEY, today);
    showToast('📦 Backup harian selesai: JSON + Supabase', 'success');
  }

  // Jalankan backup saat login & setiap jam cek apakah sudah backup hari ini
  function scheduleBackupCheck(){
    // Cek setelah login
    const pollForLogin = setInterval(()=>{
      if(window.currentUser){
        clearInterval(pollForLogin);
        setTimeout(doScheduledBackup, 5000); // 5 detik setelah login
        // Set interval cek setiap jam
        setInterval(doScheduledBackup, 60 * 60 * 1000);
      }
    }, 1000);
  }
  
  scheduleBackupCheck();
  
  // Expose manual trigger
  window.triggerDailyBackup = doScheduledBackup;
})();

// ⚡ SMART-SYNC: push segera jika ada perubahan data, tanpa delay, tanpa toggle
// Dipanggil setiap kali ada save (data, user, drygoods, stcr, training, dll)
// dirtyHint: nama modul yang berubah (opsional, untuk audit log)
function triggerAutoSync(dirtyHint=null){
  // JANGAN push jika sedang pull dari cloud — akan overwrite data cloud yang baru datang
  if(_cloudPullInProgress) return;
  if(!cloudConfig.supabaseUrl || !cloudConfig.supabaseKey) return;
  // Debounce 800ms — cukup lama untuk menunggu serangkaian save selesai semuanya,
  // tapi cukup cepat agar user tidak menunggu. Setelah debounce, cek hash dulu.
  clearTimeout(_autoSyncTimer);
  window._autoSyncTimer = setTimeout(async ()=>{
    // Guard kedua di dalam setTimeout — pastikan pull tidak sedang berjalan
    if(_cloudPullInProgress) return;
    const localPayload = getAllCloudData();
    const currentHash = _hashPayload(localPayload);
    if(currentHash && currentHash === _lastPushedHash){
      // Hash sama = tidak ada perubahan nyata → skip, tidak kirim ke cloud
      return;
    }
    // Ada perubahan → push sekarang (silent), sertakan hint modul
    const ok = await cloudPush(true, dirtyHint);
    if(ok){
      const el = document.getElementById('smartSyncLastPush');
      if(el) el.textContent = 'Terakhir sync: ' + new Date().toLocaleTimeString('id-ID');
    }
  }, 800);
}



// Init UI dari config tersimpan
function initCloudUI(){
  if($('#cloudApiKey')) $('#cloudApiKey').value = cloudConfig.supabaseUrl || '';
  if($('#cloudBinId')) $('#cloudBinId').value = cloudConfig.supabaseKey || '';
  updateAutoSyncBtn();
  if(cloudConfig.supabaseUrl && cloudConfig.supabaseKey){
    updateSyncStatus('connected');
    const guide = $('#cloudSetupGuide');
    if(guide) guide.classList.add('hidden');
    startRealtimeSubscription();
  }
}

function updateAutoSyncBtn(){
  // Smart-Sync selalu aktif — fungsi ini dipertahankan agar tidak error jika dipanggil dari tempat lain
  if(typeof window.updateServiceSyncIndicator === 'function') window.updateServiceSyncIndicator();
}

// EVENT LISTENERS
$('#btnCloudSave').addEventListener('click', async()=>{
  const url = $('#cloudApiKey').value.trim();
  const key = $('#cloudBinId').value.trim();
  if(!url){ showToast('Project URL tidak boleh kosong','error'); return; }
  if(!key){ showToast('Anon Key tidak boleh kosong','error'); return; }
  cloudConfig.supabaseUrl = url;
  cloudConfig.supabaseKey = key;
  window._supabaseClient = null; // reset client agar dibuat ulang dengan kredensial baru
  saveCloudConfig();
  const ok = await cloudPush();
  if(ok){
    const guide = $('#cloudSetupGuide');
    if(guide) guide.classList.add('hidden');
    startRealtimeSubscription();
  }
});

$('#btnCloudLoad').addEventListener('click', async()=>{
  const url = $('#cloudApiKey').value.trim();
  const key = $('#cloudBinId').value.trim();
  if(!url){ showToast('Project URL tidak boleh kosong','error'); return; }
  if(!key){ showToast('Anon Key tidak boleh kosong','error'); return; }
  cloudConfig.supabaseUrl = url;
  cloudConfig.supabaseKey = key;
  window._supabaseClient = null;
  saveCloudConfig();
  await cloudPull();
});

// Smart-Sync: toggle dihapus — selalu aktif. Handler dipertahankan untuk compat.
$('#btnCloudAutoToggle').addEventListener('click', ()=>{
  // No-op: Smart-Sync selalu ON, tidak ada toggle
});

$('#btnCloudClear').addEventListener('click', async()=>{
  const ok = await showConfirm('Hapus Cloud Config','Hapus URL & Key Supabase dari browser ini? Data di Supabase tidak terhapus.');
  if(ok){
    const sb = getSupabaseClient();
    if(sb && _realtimeChannel){ sb.removeChannel(_realtimeChannel); window._realtimeChannel = null; }
    window._supabaseClient = null;
    cloudConfig = { supabaseUrl:'', supabaseKey:'' };
    saveCloudConfig();
    initCloudUI();
    updateSyncStatus('disconnected');
    showToast('Cloud config dihapus');
    const guide = $('#cloudSetupGuide');
    if(guide) guide.classList.remove('hidden');
  }
});

// Input change → simpan ke config
$('#cloudApiKey').addEventListener('change', e=>{ cloudConfig.supabaseUrl = e.target.value.trim(); saveCloudConfig(); });
$('#cloudBinId').addEventListener('change', e=>{ cloudConfig.supabaseKey = e.target.value.trim(); saveCloudConfig(); });

// ⏱ SYNC DELAY — dihapus (Smart-Sync tidak pakai delay)
function initSyncDelayUI(){ /* no-op: Smart-Sync tidak pakai delay */ }
function updatePresetHighlight(val){ /* no-op */ }
document.addEventListener('click', function(e){
  if(e.target && e.target.id === 'btnSaveSyncDelay'){
    // no-op: tombol ini hidden
  }
});

// Jalankan init
// BUGFIX: dibungkus try-catch — fitur cloud sync (Supabase) bersifat opsional/best-effort
// dan tidak boleh pernah menjatuhkan sisa aplikasi (termasuk checkAuth/login) jika gagal.
try {
  initCloudUI();
  initSyncDelayUI();
} catch(cloudInitErr){
  console.error('[Cloud Sync] Gagal inisialisasi (dilewati, aplikasi tetap berjalan normal):', cloudInitErr);
}

// === AUTO PULL SAAT LOAD ===
// Smart Pull: hanya pull jika cloud memiliki data lebih baru dari sesi terakhir.
// Jika _lastCloudUpdatedAt sudah tersimpan di localStorage (dari sesi sebelumnya),
// Supabase hanya dicek timestamp-nya — payload TIDAK diunduh bila tidak ada perubahan.
setTimeout(async ()=>{
  if(cloudConfig.supabaseUrl && cloudConfig.supabaseKey){
    console.log('[Smart-Sync] Cek perubahan data dari Supabase (hanya pull jika ada perubahan)...');
    await cloudPull(true); // silent = true, Smart Pull: skip jika tidak ada perubahan
    startRealtimeSubscription();
  }
}, 1200);

// ================================================================
// EXPORTS — semua fungsi di atas dipakai dari modul LAIN (Service
// Recovery, STCR, Training, Drygoods, auth.js) yang sekarang berada
// di <script> tag terpisah. Tanpa export eksplisit ini, fungsi-fungsi
// di atas hanya privat ke closure IIFE ini dan akan ReferenceError
// saat dipanggil dari file lain.
// ================================================================
window.cloudConfig = cloudConfig;
window.saveCloudConfig = saveCloudConfig;
window.stampRecord = stampRecord;
window.stampArray = stampArray;
window.detectConflict = detectConflict;
window.MODULE_KEYS = MODULE_KEYS;
window.markDirty = markDirty;
window.clearDirty = clearDirty;
window.isDirty = isDirty;
window._hashPayload = _hashPayload;
window._mergeArrays = _mergeArrays;
// _flushOfflineQueue dipanggil dari inline onclick="" di index.html (tombol
// "Kirim sekarang" pada banner offline-queue) — WAJIB di-export ke window
// karena inline event handler HTML hanya bisa memanggil fungsi global.
window._flushOfflineQueue = _flushOfflineQueue;
window.getSupabaseClient = getSupabaseClient;
// [BUGFIX] Diekspor agar audit-log-ui.js (file <script> terpisah) bisa
// mengakses _offlineQueue, yang sebelumnya hanya const privat di dalam
// IIFE ini. Sebelumnya audit-log-ui.js memanggil `_offlineQueue.getAll()`
// sebagai referensi bare dari scope lain — selalu melempar ReferenceError,
// ketelan diam-diam oleh catch(e){} kosong di sana. Lihat REFACTOR_NOTES.md
// bagian "Perbaikan Bug Pasca-Refactor".
window.getOfflineQueueItems = function(){ return _offlineQueue.getAll(); };
window.auditLog = auditLog;
window._auditSave = _auditSave;
window.cloudLog = cloudLog;
window.updateSyncStatus = updateSyncStatus;
window.mergeById = mergeById;
window.mergeTraining = mergeTraining;
window.getAllCloudData = getAllCloudData;
window.getDeviceId = getDeviceId;
window.cloudPush = cloudPush;
window.cloudPull = cloudPull;
window.blinkBlueLight = blinkBlueLight;
window.blinkSyncLight = blinkSyncLight;
window.startRealtimeSubscription = startRealtimeSubscription;
window.triggerAutoSync = triggerAutoSync;
window.initCloudUI = initCloudUI;
window.updateAutoSyncBtn = updateAutoSyncBtn;
window.initSyncDelayUI = initSyncDelayUI;
window.updatePresetHighlight = updatePresetHighlight;

})();
