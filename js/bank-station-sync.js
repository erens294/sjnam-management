/* ================================================================
   SJNAM — MODUL BANK STATION SYNC
   ================================================================
   Bank Station: daftar station turunan (derived) dari Bank Data
   Peserta Training — setiap kombinasi unik Stasiun/Perusahaan/
   Tanggal Training jadi satu baris ringkasan. Juga berisi indikator
   & tombol Sync untuk tab Soal Training.

   Diekstrak dari index.html (sebelumnya IIFE mandiri, baris
   ~5728-5827 di file asli — tercampur dalam SATU blok <script> yang
   sama dengan kode admin/audit tidak terkait (beforeunload cleanup,
   Audit Log UI) yang TETAP berada di index.html karena dipanggil
   lewat inline onclick="" dan tidak boleh terbungkus IIFE). Lihat
   REFACTOR_NOTES.md bagian "Tahap 7".

   ⚠️ URUTAN LOAD WAJIB: file ini HARUS dimuat SETELAH js/training.js.
   Baris ke-3 modul ini (const trainingData = window.trainingData;)
   meng-capture window.trainingData secara SINKRON saat parse — bukan
   lazy/deferred. Jika dimuat SEBELUM training.js, trainingData di
   sini akan permanen bernilai undefined (const tidak ter-update lagi
   meskipun window.trainingData baru di-set belakangan), menyebabkan
   renderBankStations() selalu error "Cannot read property 'peserta'
   of undefined" setiap kali dipanggil.
   ================================================================ */

// === Bank Station (derived from Bank Data Peserta) & Service Training Sync ===
(function(){
  const trainingData = window.trainingData;
  const esc = window.esc;
  const saveTraining = window.saveTraining;
  const fmtDate = window.fmtDate || (d=>d||'-');

  // Bangun daftar Bank Station dari Bank Data Peserta.
  // Setiap kombinasi unik (Stasiun, Perusahaan, Tanggal Training, Berlaku Hingga) jadi satu baris.
  // Kolom "No" SELALU dibuat ulang/berurutan, tidak diambil dari data peserta.
  function buildStationRows(){
    const peserta = Array.isArray(trainingData.peserta) ? trainingData.peserta : [];
    const map = new Map();
    peserta.forEach(p=>{
      const stasiun = (p.stasiun||'').trim();
      if(!stasiun) return;
      const perusahaan = (p.perusahaan||'').trim();
      const tanggal = p.tanggal||'';
      const berlaku = p.expiredDate||'';
      const key = [stasiun.toLowerCase(), perusahaan.toLowerCase(), tanggal, berlaku].join('|');
      if(!map.has(key)){
        map.set(key, {stasiun, perusahaan, tanggal, berlaku, qty: 1});
      } else {
        map.get(key).qty++;
      }
    });
    // Urutkan berdasarkan tanggal training terbaru, lalu nama stasiun
    return Array.from(map.values()).sort((a,b)=>{
      const da = a.tanggal||'', db = b.tanggal||'';
      if(da !== db) return db.localeCompare(da);
      return (a.stasiun||'').localeCompare(b.stasiun||'');
    });
  }

  function renderBankStations(){
    const tbody = document.getElementById('stationTableBody');
    if(!tbody) return;
    const rows = buildStationRows();
    // Simpan hasil derive ke trainingData.stations agar tersedia untuk export/cloud sync
    const changed = JSON.stringify(trainingData.stations||[]) !== JSON.stringify(rows);
    trainingData.stations = rows;
    if(changed && typeof saveTraining === 'function') saveTraining();

    const countEl = document.getElementById('stationTotalCount');
    if(countEl) countEl.textContent = rows.length;

    if(!rows.length){
      tbody.innerHTML = '<tr><td colspan="6" class="px-3 py-6 text-center text-sm text-slate-500">Belum ada data station (isi Bank Data Peserta terlebih dahulu).</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((s,i)=>`
      <tr>
        <td class="px-3 py-2">${i+1}</td>
        <td class="px-3 py-2">${esc(s.stasiun||'')}</td>
        <td class="px-3 py-2">${esc(s.perusahaan||'')}</td>
        <td class="px-3 py-2">${esc(fmtDate(s.tanggal))}</td>
        <td class="px-3 py-2">${esc(fmtDate(s.berlaku))}</td>
        <td class="px-3 py-2 text-center font-semibold text-blue-700 dark:text-blue-300">${s.qty||1}</td>
      </tr>`).join('');
  }
  window.renderBankStations = renderBankStations;

  document.getElementById('btnExportStation')?.addEventListener('click', ()=>{
    const rows = buildStationRows();
    if(!rows.length){ showToast('Belum ada data station','error'); return; }
    const exportRows = rows.map((s,i)=>({No:i+1, Stasiun:s.stasiun, Perusahaan:s.perusahaan, 'Tanggal Training':s.tanggal, 'Berlaku Hingga':s.berlaku, 'Qty Peserta':s.qty||1}));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws['!cols'] = [{wch:4},{wch:20},{wch:25},{wch:16},{wch:16},{wch:12}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bank Station');
    XLSX.writeFile(wb, `Bank_Station_${todayLocalStr()}.xlsx`);
  });

  // =============================================================
  // SERVICE TRAINING SYNC (Soal Training tab)
  // =============================================================
  function updateServiceSyncIndicator(){
    const dot = document.getElementById('serviceSyncDot');
    const lbl = document.getElementById('serviceSyncLabel');
    if(!dot || !lbl) return;
    const connected = typeof cloudConfig !== 'undefined' && cloudConfig.supabaseUrl;
    dot.className = 'w-2 h-2 rounded-full ' + (connected ? 'bg-emerald-500' : 'bg-slate-300');
    lbl.textContent = 'Smart-Sync: ' + (connected ? 'ON' : 'Belum terhubung');
  }
  window.updateServiceSyncIndicator = updateServiceSyncIndicator;

  // Sinkronkan: simpan data training saat ini + paksa cloud push (jika sudah dikonfigurasi)
  document.getElementById('btnSyncService')?.addEventListener('click', async ()=>{
    saveTraining(); // pastikan data tersimpan ke localStorage
    if(typeof cloudConfig !== 'undefined' && cloudConfig.supabaseUrl && cloudConfig.supabaseKey){
      const ok = await cloudPush(false);
      if(ok) showToast('Data Service Training berhasil disinkronkan','success');
    } else {
      showToast('Data Service Training tersimpan secara lokal','success');
    }
    updateServiceSyncIndicator();
  });

  setTimeout(updateServiceSyncIndicator, 600);
})();
