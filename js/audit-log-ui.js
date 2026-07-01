/* ================================================================
   SJNAM — AUDIT LOG UI & CLEANUP
   ================================================================
   3 bagian kecil yang berbagi 1 blok <script> di file asli:
   1. beforeunload cleanup — flush auto-sync timer & cloudPush
      sebelum tab ditutup, supaya perubahan terakhir tidak hilang.
   2. Audit Log UI — toggleAuditPanel/loadAuditLog, menampilkan
      riwayat aktivitas (push/pull/merge/create/update/delete) dari
      tabel sjnam_audit_log di Supabase.
   3. Offline Queue Badge — indikator jumlah perubahan yang masih
      tertunda terkirim ke cloud.

   Diekstrak dari index.html (sebelumnya 1 blok <script> mandiri,
   baris ~5654-5725 di file asli). Lihat REFACTOR_NOTES.md bagian
   "Tahap 9".

   Sengaja TIDAK dibungkus IIFE: toggleAuditPanel dan loadAuditLog
   dipanggil langsung lewat onclick="" di markup HTML, harus
   otomatis ter-attach ke window.

   ✅ BUG SUDAH DIPERBAIKI (sebelumnya pra-existing, dikonfirmasi ada di
   index.html ASLI sebelum modifikasi apa pun — ditemukan saat audit
   Tahap 9, diperbaiki di sesi audit lanjutan setelah modularisasi
   selesai): _updateOfflineQueueBadge() sebelumnya memanggil
   `_offlineQueue.getAll()` sebagai referensi bare, padahal `_offlineQueue`
   adalah const privat di dalam IIFE js/shared-utils.js — tidak pernah
   terjangkau dari file lain. Setiap panggilan melempar ReferenceError,
   ketelan diam-diam oleh catch(e){} kosong. Diperbaiki dengan menambah
   window.getOfflineQueueItems() di shared-utils.js sebagai jembatan resmi,
   dan catch(e){} sekarang mencatat warning alih-alih menelan error.
   Lihat REFACTOR_NOTES.md bagian "Perbaikan Bug Pasca-Refactor".

   URUTAN LOAD: harus dimuat SETELAH js/shared-utils.js (butuh
   window.cloudPush, window._autoSyncTimer — keduanya bare reference
   yang resolve via window scope, aman karena sama-sama window.X=).
   ================================================================ */

// cleanup intervals on unload + flush perubahan yang masih tertunda (debounce)
// supaya data tidak hilang/gagal ter-sync ke device lain saat tab ditutup cepat
window.addEventListener('beforeunload', function(){
  if(typeof _autoSyncTimer!=='undefined'&&_autoSyncTimer)clearTimeout(_autoSyncTimer);
  if(window.currentUser){try{localStorage.setItem('sjnam_last_active',Date.now().toString());}catch(ex){}}
  if(typeof cloudPush==='function')cloudPush(true);
});

// === AUDIT LOG UI ===
function toggleAuditPanel(){
  const panel   = document.getElementById('auditPanel');
  const chevron = document.getElementById('auditPanelChevron');
  if(!panel) return;
  const isHidden = panel.classList.toggle('hidden');
  if(chevron) chevron.textContent = isHidden ? '▼' : '▲';
}

async function loadAuditLog(){
  const container = document.getElementById('auditLogTable');
  if(!container) return;
  const sb = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
  if(!sb){ container.innerHTML = '<p class="text-red-400 p-3 italic">Cloud belum terhubung</p>'; return; }
  container.innerHTML = '<p class="text-slate-400 p-3 italic">Memuat...</p>';
  try {
    const moduleFilter = document.getElementById('auditModuleFilter')?.value || '';
    let query = sb.from('sjnam_audit_log').select('*').order('created_at',{ascending:false}).limit(50);
    if(moduleFilter) query = query.eq('module', moduleFilter);
    const { data: logs, error } = await query;
    if(error) throw new Error(error.message);
    if(!logs || !logs.length){ container.innerHTML = '<p class="text-slate-400 p-3 italic">Belum ada log. Pastikan tabel sjnam_audit_log sudah dibuat di Supabase.</p>'; return; }
    const actionColor = { push:'text-blue-500', pull:'text-green-500', merge:'text-amber-500', create:'text-emerald-500', update:'text-slate-400', delete:'text-red-400' };
    container.innerHTML = `
      <table class="w-full text-xs">
        <thead><tr class="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
          <th class="text-left px-2 py-1.5">Waktu</th>
          <th class="text-left px-2 py-1.5">Aksi</th>
          <th class="text-left px-2 py-1.5">Modul</th>
          <th class="text-left px-2 py-1.5">Oleh</th>
          <th class="text-left px-2 py-1.5">Detail</th>
        </tr></thead>
        <tbody>
          ${logs.map(l=>`<tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700">
            <td class="px-2 py-1.5 text-slate-400 whitespace-nowrap">${new Date(l.created_at).toLocaleString('id-ID',{hour12:false,dateStyle:'short',timeStyle:'short'})}</td>
            <td class="px-2 py-1.5 font-semibold ${actionColor[l.action]||'text-slate-400'} whitespace-nowrap">${l.action||'-'}</td>
            <td class="px-2 py-1.5 text-slate-500">${l.module||'-'}</td>
            <td class="px-2 py-1.5 font-medium">${l.changed_by||'-'}</td>
            <td class="px-2 py-1.5 text-slate-400 truncate max-w-32">${l.detail||'-'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } catch(e){
    container.innerHTML = '<p class="text-red-400 p-3 italic">Gagal memuat: '+e.message+'. Pastikan tabel sjnam_audit_log sudah dibuat.</p>';
  }
}

// Cek offline queue count secara berkala dan tampilkan badge jika ada antrian
async function _updateOfflineQueueBadge(){
  try {
    const items = await window.getOfflineQueueItems();
    const badge = document.getElementById('offlineQueueStatus');
    const count = document.getElementById('offlineQueueCount');
    if(!badge) return;
    if(items.length > 0){
      badge.classList.remove('hidden');
      if(count) count.textContent = '📴 '+items.length+' perubahan dalam antrian offline (belum terkirim)';
    } else {
      badge.classList.add('hidden');
    }
  } catch(e){ console.warn('[_updateOfflineQueueBadge]', e); }
}
setInterval(_updateOfflineQueueBadge, 10000); // cek setiap 10 detik
_updateOfflineQueueBadge(); // cek langsung saat load
