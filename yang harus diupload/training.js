/* ================================================================
   SJNAM — MODUL TRAINING
   ================================================================
   Modul Service Training: materi, bank soal, peserta, wizard quiz,
   sertifikat (generate/download/email), Bank Station (derived dari
   data peserta).

   Diekstrak dari index.html (sebelumnya satu blok <script> IIFE
   mandiri, baris ~5630-7145 di file asli). Lihat REFACTOR_NOTES.md
   bagian "Tahap 4" untuk detail.

   CATATAN PENTING — bagian "Bank Station Sync" (IIFE kedua, terpisah,
   yang membaca window.trainingData/window.esc/window.saveTraining
   yang diekspor modul ini) BELUM diekstrak — masih tercampur dengan
   kode admin/audit lain (toggleAuditPanel, loadAuditLog) dalam satu
   blok <script> di index.html. Modul ini tetap meng-ekspor
   window.trainingData/window.saveTraining/window.esc/window.fmtDate
   agar kode tersebut (sementara masih di index.html) tetap berfungsi.

   URUTAN LOAD: file ini independen — tidak butuh shared-utils.js atau
   service-recovery.js untuk INIT sinkronnya sendiri (tidak ada
   pemanggilan fungsi shared-utils.js secara sinkron di top-level
   modul ini), tapi beberapa fungsi di dalamnya (triggerAutoSync,
   cloudPush, showToast, dst) baru benar-benar berfungsi setelah
   shared-utils.js dimuat — sudah di-guard dengan typeof check di
   kode asli.
   ================================================================ */

// === TRAINING MODULE ===
// === TRAINING MODULE ===
(function(){
  const TRAINING_KEY = 'sjn_training_v1';
  let trainingData; try { trainingData = JSON.parse(localStorage.getItem(TRAINING_KEY) || ''); } catch(e){}
  if(!trainingData){ trainingData = {materi:[{id:'basic',title:'Basic Service Indoctrination',desc:'Pengenalan layanan dasar Sriwijaya Air & NAM Air'}],soal:[],peserta:[],banks:[{id:'basic',name:'Basic Service Indoctrination',questions:[]},{id:'smile',name:'Training SMILE',questions:[]}],stations:[]}; }
  if(!Array.isArray(trainingData.soal)) trainingData.soal = [];
  if(!Array.isArray(trainingData.peserta)) trainingData.peserta = [];
  if(!Array.isArray(trainingData.materi)) trainingData.materi = [{id:'basic',title:'Basic Service Indoctrination',desc:'Pengenalan layanan dasar Sriwijaya Air & NAM Air'}];
  if(!Array.isArray(trainingData.stations)) trainingData.stations = [];

  // Bank Soal (kategori): migrasi dari array soal lama jika belum ada
  if(!Array.isArray(trainingData.banks) || !trainingData.banks.length){
    trainingData.banks = [
      {id:'basic', name:'Basic Service Indoctrination', questions: trainingData.soal.slice()},
      {id:'smile', name:'Training SMILE', questions:[]}
    ];
  }
  trainingData.banks.forEach(b=>{ if(!Array.isArray(b.questions)) b.questions = []; });
  if(!trainingData.activeBankId || !trainingData.banks.some(b=>b.id===trainingData.activeBankId)){
    trainingData.activeBankId = trainingData.banks[0].id;
  }

  function saveTraining(){
    localStorage.setItem(TRAINING_KEY, JSON.stringify(trainingData));
    if(typeof triggerAutoSync === 'function') triggerAutoSync();
    // Auto-refresh Bank Station tiap kali data training tersimpan
    setTimeout(()=>{ if(typeof window.renderBankStations === 'function') window.renderBankStations(); }, 50);
  }
  window.trainingData = trainingData;
  window.saveTraining = saveTraining;

  const esc = (s)=> String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.esc = esc;

  // =============================================================
  // MATERI
  // =============================================================
  function renderMateri(){
    const list = document.getElementById('materiList');
    if(!list) return;
    list.innerHTML = trainingData.materi.map(m => `
      <div class="card p-4 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
        <div class="flex items-start justify-between">
          <div>
            <h4 class="font-bold text-slate-800 dark:text-white">${esc(m.title)}</h4>
            <p class="text-xs text-slate-500 mt-1">${esc(m.desc||'Materi training')}</p>
          </div>
          <span class="text-2xl">📘</span>
        </div>
        <button onclick="openMateri('${esc(m.id)}')" class="mt-3 text-xs text-blue-600 hover:underline">Buka Materi →</button>
      </div>
    `).join('');
  }
  document.getElementById('btnAddMateri')?.addEventListener('click', ()=>{
    const title = prompt('Judul Materi:');
    if(!title) return;
    trainingData.materi.push({id:Date.now().toString(), title, desc:'Materi tambahan'});
    saveTraining(); renderMateri();
  });
  window.openMateri = (id)=> {
    if(id==='basic'){
      const modal = document.getElementById('pdfModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      document.body.style.overflow = 'hidden';
    } else {
      alert('Membuka materi: '+id);
    }
  };

  // =============================================================
  // BANK SOAL (Admin) - mendukung multi-kategori
  // =============================================================
  function getActiveBank(){
    let bank = trainingData.banks.find(b=>b.id===trainingData.activeBankId);
    if(!bank){ bank = trainingData.banks[0]; trainingData.activeBankId = bank.id; }
    return bank;
  }

  function renderBankSelect(){
    const sel = document.getElementById('soalBankSelect');
    if(!sel) return;
    sel.innerHTML = trainingData.banks.map(b=>`<option value="${esc(b.id)}" ${b.id===trainingData.activeBankId?'selected':''}>${esc(b.name)} (${b.questions.length} soal)</option>`).join('');
  }

  function renderSoal(){
    renderBankSelect();
    const bank = getActiveBank();
    const c = document.getElementById('soalContainer');
    if(!c) return;
    if(!bank.questions.length){
      c.innerHTML = '<p class="text-sm text-slate-500 text-center py-6">Belum ada soal pada kategori ini. Klik "+ Tambah Soal" atau upload dari Excel.</p>';
    } else {
      c.innerHTML = bank.questions.map((s,i)=>`
        <div class="p-4 border border-slate-200 dark:border-slate-700 rounded-xl">
          <div class="flex items-start justify-between gap-3 mb-2">
            <p class="font-semibold text-sm">${i+1}. ${esc(s.q)}</p>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="badge bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Skor: ${Number(s.score)||0}</span>
              <button data-soal-edit="${s.id}" class="text-xs text-blue-600 hover:underline">Edit</button>
              <button data-soal-del="${s.id}" class="text-xs text-red-600 hover:underline">Hapus</button>
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
            ${['A','B','C','D'].map(opt=>`
              <div class="px-3 py-1.5 rounded-lg ${s.answer===opt ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-semibold' : 'bg-slate-50 dark:bg-slate-800'}">
                ${opt}. ${esc(s.options ? s.options[opt] : '')} ${s.answer===opt ? '✓' : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');
    }
    document.getElementById('soalTotalCount').textContent = bank.questions.length;
    document.getElementById('soalTotalScore').textContent = bank.questions.reduce((a,s)=>a+(Number(s.score)||0),0);
    // keep legacy flat array (trainingData.soal) in sync with active bank for backward compatibility
    trainingData.soal = bank.questions;
  }

  document.getElementById('soalBankSelect')?.addEventListener('change', (e)=>{
    trainingData.activeBankId = e.target.value;
    saveTraining(); renderSoal();
  });

  document.getElementById('btnAddBank')?.addEventListener('click', ()=>{
    const name = prompt('Nama kategori soal baru (contoh: Training SMILE):');
    if(!name || !name.trim()) return;
    const id = 'bank_'+Date.now();
    trainingData.banks.push({id, name: name.trim(), questions:[]});
    trainingData.activeBankId = id;
    saveTraining(); renderSoal();
    showToast('Kategori soal ditambahkan');
  });

  document.getElementById('btnRenameBank')?.addEventListener('click', ()=>{
    const bank = getActiveBank();
    const name = prompt('Nama baru kategori:', bank.name);
    if(!name || !name.trim()) return;
    bank.name = name.trim();
    saveTraining(); renderSoal();
    showToast('Nama kategori diperbarui');
  });

  document.getElementById('btnDeleteBank')?.addEventListener('click', ()=>{
    if(trainingData.banks.length <= 1){ showToast('Minimal harus ada 1 kategori soal','error'); return; }
    const bank = getActiveBank();
    showConfirm('Hapus Kategori', `Yakin ingin menghapus kategori "${bank.name}" beserta ${bank.questions.length} soal di dalamnya?`).then(ok=>{
      if(!ok) return;
      trainingData.banks = trainingData.banks.filter(b=>b.id!==bank.id);
      trainingData.activeBankId = trainingData.banks[0].id;
      saveTraining(); renderSoal();
      showToast('Kategori soal dihapus');
    });
  });

  function openSoalForm(existing){
    const isEdit = !!existing;
    const s = existing || {id:Date.now().toString(), q:'', options:{A:'',B:'',C:'',D:''}, answer:'A', score:10};
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box max-w-lg">
        <h3 class="text-lg font-bold mb-3">${isEdit?'Edit Soal':'Tambah Soal'} <span class="text-xs font-normal text-slate-400">(${esc(getActiveBank().name)})</span></h3>
        <div class="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label class="block text-sm font-medium mb-1">Pertanyaan</label>
            <textarea id="frmSoalQ" class="input" rows="2">${esc(s.q)}</textarea>
          </div>
          ${['A','B','C','D'].map(opt=>`
          <div>
            <label class="block text-sm font-medium mb-1">Pilihan ${opt}</label>
            <input id="frmSoalOpt${opt}" class="input" value="${esc(s.options[opt]||'')}">
          </div>`).join('')}
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium mb-1">Kunci Jawaban</label>
              <select id="frmSoalAnswer" class="input">
                ${['A','B','C','D'].map(opt=>`<option value="${opt}" ${s.answer===opt?'selected':''}>${opt}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Skor</label>
              <input id="frmSoalScore" type="number" min="0" class="input" value="${Number(s.score)||0}">
            </div>
          </div>
        </div>
        <div class="flex gap-3 justify-end mt-4">
          <button id="frmSoalCancel" class="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 font-medium rounded-lg">Batal</button>
          <button id="frmSoalSave" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg">Simpan</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#frmSoalCancel').addEventListener('click', ()=> overlay.remove());
    overlay.querySelector('#frmSoalSave').addEventListener('click', ()=>{
      const q = overlay.querySelector('#frmSoalQ').value.trim();
      if(!q){ showToast('Pertanyaan tidak boleh kosong','error'); return; }
      const options = {
        A: overlay.querySelector('#frmSoalOptA').value.trim(),
        B: overlay.querySelector('#frmSoalOptB').value.trim(),
        C: overlay.querySelector('#frmSoalOptC').value.trim(),
        D: overlay.querySelector('#frmSoalOptD').value.trim(),
      };
      if(!options.A || !options.B || !options.C || !options.D){ showToast('Semua pilihan A-D harus diisi','error'); return; }
      const answer = overlay.querySelector('#frmSoalAnswer').value;
      const score = Number(overlay.querySelector('#frmSoalScore').value) || 0;
      const newSoal = {id:s.id, q, options, answer, score};
      const bank = getActiveBank();
      if(isEdit){
        const idx = bank.questions.findIndex(x=>x.id===s.id);
        if(idx>-1) bank.questions[idx] = newSoal;
      } else {
        bank.questions.push(newSoal);
      }
      saveTraining(); renderSoal();
      overlay.remove();
      showToast(isEdit ? 'Soal diperbarui' : 'Soal ditambahkan');
    });
  }

  document.getElementById('btnAddSoal')?.addEventListener('click', ()=> openSoalForm(null));

  document.getElementById('soalContainer')?.addEventListener('click', (e)=>{
    const editId = e.target.closest('[data-soal-edit]')?.getAttribute('data-soal-edit');
    const delId = e.target.closest('[data-soal-del]')?.getAttribute('data-soal-del');
    const bank = getActiveBank();
    if(editId){
      const s = bank.questions.find(x=>x.id===editId);
      if(s) openSoalForm(s);
    }
    if(delId){
      showConfirm('Hapus Soal','Yakin ingin menghapus soal ini?').then(ok=>{
        if(!ok) return;
        bank.questions = bank.questions.filter(x=>x.id!==delId);
        saveTraining(); renderSoal();
        showToast('Soal dihapus');
      });
    }
  });

  document.getElementById('btnClearSoal')?.addEventListener('click', ()=>{
    const bank = getActiveBank();
    showConfirm('Hapus Semua Soal', `Yakin ingin menghapus SEMUA soal pada kategori "${bank.name}"? Tindakan ini tidak dapat dibatalkan.`).then(ok=>{
      if(!ok) return;
      bank.questions = [];
      saveTraining(); renderSoal();
      showToast('Semua soal pada kategori ini dihapus');
    });
  });

  // ---- Excel Template & Upload ----
  document.getElementById('btnDownloadSoalTemplate')?.addEventListener('click', ()=>{
    const rows = [
      {No:1, Pertanyaan:'Apa kepanjangan dari SOP?', 'Pilihan A':'Standard Operating Procedure', 'Pilihan B':'System Operation Plan', 'Pilihan C':'Service Order Process', 'Pilihan D':'Staff Operation Policy', 'Kunci Jawaban':'A', Skor:10},
      {No:2, Pertanyaan:'Berapa lama waktu maksimal check-in sebelum keberangkatan?', 'Pilihan A':'15 menit', 'Pilihan B':'30 menit', 'Pilihan C':'45 menit', 'Pilihan D':'60 menit', 'Kunci Jawaban':'B', Skor:10},
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{wch:4},{wch:40},{wch:25},{wch:25},{wch:25},{wch:25},{wch:14},{wch:8}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Soal Training');
    XLSX.writeFile(wb, 'Template_Soal_Training_SJNAM.xlsx');
  });

  document.getElementById('inputUploadSoal')?.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const bank = getActiveBank();
    const reader = new FileReader();
    reader.onload = (ev)=>{
      try {
        const wb = XLSX.read(ev.target.result, {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, {defval:''});
        if(!rows.length){ showToast('File Excel kosong atau format tidak sesuai','error'); return; }
        let added = 0, skipped = 0;
        rows.forEach(r=>{
          const getVal = (...keys)=>{
            for(const k of keys){
              for(const rk of Object.keys(r)){
                if(rk.trim().toLowerCase()===k.toLowerCase()) return String(r[rk]).trim();
              }
            }
            return '';
          };
          const q = getVal('Pertanyaan','Soal','Question');
          const A = getVal('Pilihan A','A');
          const B = getVal('Pilihan B','B');
          const C = getVal('Pilihan C','C');
          const D = getVal('Pilihan D','D');
          const ans = getVal('Kunci Jawaban','Jawaban','Kunci','Answer').toUpperCase().replace(/[^ABCD]/g,'');
          const score = Number(getVal('Skor','Score')) || 10;
          if(!q || !A || !B || !C || !D || !['A','B','C','D'].includes(ans)){
            skipped++; return;
          }
          bank.questions.push({
            id: Date.now().toString()+'-'+Math.floor(Math.random()*10000),
            q, options:{A,B,C,D}, answer:ans, score
          });
          added++;
        });
        saveTraining(); renderSoal();
        showToast(`${added} soal berhasil ditambahkan ke "${bank.name}"${skipped?`, ${skipped} baris dilewati (format tidak lengkap)`:''}`, added?'success':'error');
      } catch(err){
        showToast('Gagal membaca file Excel: '+err.message, 'error');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  });

  // =============================================================
  // BANK DATA PESERTA
  // =============================================================
  function fmtDate(d){
    if(!d) return '-';
    try {
      return new Date(d).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
    } catch(e){ return d; }
  }
  window.fmtDate = fmtDate;

  function renderPeserta(){
    const tbody = document.getElementById('pesertaTableBody');
    if(!tbody) return;
    const search = (document.getElementById('pesertaSearch')?.value || '').toLowerCase().trim();
    let list = trainingData.peserta.slice().sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
    if(search){
      list = list.filter(p =>
        (p.nama||'').toLowerCase().includes(search) ||
        (p.certNo||'').toLowerCase().includes(search) ||
        (p.email||'').toLowerCase().includes(search) ||
        (p.stasiun||'').toLowerCase().includes(search)
      );
    }
    document.getElementById('pesertaTotalCount').textContent = trainingData.peserta.length;
    document.getElementById('pesertaEmptyMsg').classList.toggle('hidden', list.length>0);
    tbody.innerHTML = list.map(p=>`
      <tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
        <td class="px-2 py-2 font-mono text-xs whitespace-nowrap">${esc(p.certNo)}</td>
        <td class="px-2 py-2 whitespace-nowrap">${fmtDate(p.tanggal)}</td>
        <td class="px-2 py-2 whitespace-nowrap">${esc(p.jam)}</td>
        <td class="px-2 py-2 whitespace-nowrap">${p.airlines==='nam'?'NAM Air':'Sriwijaya Air'}</td>
        <td class="px-2 py-2 whitespace-nowrap font-medium">${esc(p.nama)}</td>
        <td class="px-2 py-2 whitespace-nowrap">${esc(p.stasiun)}</td>
        <td class="px-2 py-2 whitespace-nowrap">${esc(p.perusahaan)}</td>
        <td class="px-2 py-2 whitespace-nowrap">${esc(p.jabatan)}</td>
        <td class="px-2 py-2 whitespace-nowrap">${esc(p.hp)}</td>
        <td class="px-2 py-2 whitespace-nowrap">${esc(p.email)}</td>
        <td class="px-2 py-2 whitespace-nowrap font-semibold">${p.score} / ${p.maxScore}</td>
        <td class="px-2 py-2 whitespace-nowrap">${fmtDate(p.expiredDate)}</td>
        <td class="px-2 py-2 whitespace-nowrap">
          <button data-peserta-cert="${p.certNo}" class="text-xs text-blue-600 hover:underline mr-2">Lihat Sertifikat</button>
          ${window.currentUserReadOnly ? '' : `<button data-peserta-del="${p.id}" class="text-xs text-red-600 hover:underline">Hapus</button>`}
        </td>
      </tr>
    `).join('');

    // Bank Station diturunkan dari Bank Data Peserta — refresh setiap kali data peserta berubah
    if(typeof window.renderBankStations === 'function') window.renderBankStations();
  }
  window.renderPeserta = renderPeserta; // expose globally

  document.getElementById('pesertaSearch')?.addEventListener('input', renderPeserta);

  document.getElementById('pesertaTableBody')?.addEventListener('click', (e)=>{
    const certNo = e.target.closest('[data-peserta-cert]')?.getAttribute('data-peserta-cert');
    const delId = e.target.closest('[data-peserta-del]')?.getAttribute('data-peserta-del');
    if(certNo){
      window.switchTab('sertifikat');
      const input = document.getElementById('certSearchInput');
      if(input){ input.value = certNo; }
      window.dispatchCertSearch?.(certNo);
    }
    if(delId){
      showConfirm('Hapus Data Peserta','Yakin ingin menghapus data peserta ini? Sertifikat terkait tidak akan bisa dicetak ulang.').then(ok=>{
        if(!ok) return;
        trainingData.peserta = trainingData.peserta.filter(x=>x.id!==delId);
        saveTraining(); renderPeserta();
        // [BUGFIX] Catat tombstone supaya peserta yang dihapus tidak
        // muncul kembali setelah cloudPull — sama seperti fix untuk
        // users/karyawan. Lihat catatan TOMBSTONE TRACKING di
        // shared-utils.js (dekat mergeById) untuk detail.
        if(typeof window.markDeletedTombstone === 'function') window.markDeletedTombstone('peserta', [delId]);
        showToast('Data peserta dihapus');
      });
    }
  });

  document.getElementById('btnClearPeserta')?.addEventListener('click', ()=>{
    if(window.currentUserReadOnly){ showToast('Akses ditolak','error'); return; }
    showConfirm('Hapus Semua Data Peserta','Yakin ingin menghapus SEMUA data peserta & sertifikat? Tindakan ini tidak dapat dibatalkan.').then(ok=>{
      if(!ok) return;
      trainingData.peserta = [];
      saveTraining(); renderPeserta();
      showToast('Semua data peserta dihapus');
    });
  });

  document.getElementById('btnExportPeserta')?.addEventListener('click', ()=>{
    if(!trainingData.peserta.length){ showToast('Belum ada data peserta','error'); return; }
    const rows = trainingData.peserta.map(p=>({
      'No Sertifikat': p.certNo,
      'Tanggal Training': p.tanggal,
      'Jam Training': p.jam,
      'Airlines': p.airlines==='nam'?'NAM Air':'Sriwijaya Air',
      'Nama': p.nama,
      'Stasiun': p.stasiun,
      'Perusahaan': p.perusahaan,
      'Jabatan': p.jabatan,
      'No Handphone': p.hp,
      'Email': p.email,
      'Skor': p.score,
      'Skor Maksimal': p.maxScore,
      'Masa Berlaku (Tahun)': 2,
      'Expired Date': p.expiredDate,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0]).map(()=>({wch:18}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Peserta');
    XLSX.writeFile(wb, `Bank_Data_Peserta_Training_${todayLocalStr()}.xlsx`);
  });

  // =============================================================
  // SOAL SUB-TABS (Bank Soal / Bank Data Peserta / Bank Station)
  // =============================================================
  document.querySelectorAll('.soal-subtab-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const target = btn.getAttribute('data-soal-subtab');
      document.querySelectorAll('.soal-subtab-btn').forEach(b=>{
        b.classList.toggle('active', b===btn);
        b.classList.toggle('border-blue-600', b===btn);
        b.classList.toggle('text-blue-600', b===btn);
        b.classList.toggle('border-transparent', b!==btn);
        b.classList.toggle('text-slate-500', b!==btn);
      });
      document.getElementById('soalSubBank').classList.toggle('hidden', target!=='bank');
      document.getElementById('soalSubPeserta').classList.toggle('hidden', target!=='peserta');
      document.getElementById('soalSubStation').classList.toggle('hidden', target!=='station');
      if(target==='peserta') renderPeserta();
      if(target==='station' && typeof window.renderBankStations === 'function') window.renderBankStations();
    });
  });

  // =============================================================
  // CERTIFICATE NUMBER & SHARED RENDERER
  // =============================================================
  // Konversi angka 1-12 menjadi angka romawi I-XII
  function monthToRoman(m){
    const romans = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
    return romans[(Number(m)-1+12)%12] || 'I';
  }

  // Format Nomor Sertifikat: 00000/TRN/CS-SJ/<bulan romawi>/<yyyy>  (Sriwijaya Air)
  //                            00000/TRN/CS-IN/<bulan romawi>/<yyyy>  (NAM Air)
  // Nomor urut 5 digit dihitung per kombinasi kode airline + tahun, dan bulan diambil dari tanggal training (pTanggal).
  function genCertNo(airlines, tanggal){
    const ref = tanggal ? new Date(tanggal) : new Date();
    const y = isNaN(ref.getTime()) ? new Date().getFullYear() : ref.getFullYear();
    const m = isNaN(ref.getTime()) ? (new Date().getMonth()+1) : (ref.getMonth()+1);
    const code = (airlines === 'nam') ? 'CS-IN' : 'CS-SJ';
    const romanMonth = monthToRoman(m);

    // Cari nomor urut tertinggi yang sudah dipakai untuk kombinasi kode+tahun ini
    const prefixPattern = new RegExp(`^(\\d{5})/TRN/${code}/[IVX]+/${y}$`);
    let maxSeq = 0;
    trainingData.peserta.forEach(p=>{
      const match = (p.certNo||'').match(prefixPattern);
      if(match){
        const seq = parseInt(match[1], 10);
        if(seq > maxSeq) maxSeq = seq;
      }
    });
    const nextSeq = String(maxSeq + 1).padStart(5,'0');
    return `${nextSeq}/TRN/${code}/${romanMonth}/${y}`;
  }

  function addYears(dateStr, years){
    const d = new Date(dateStr);
    if(isNaN(d.getTime())) return '';
    // BUGFIX: setFullYear kemudian format manual agar tidak ada UTC timezone shift
    const ny = d.getFullYear() + years;
    // Gunakan komponen lokal (bukan UTC) agar tanggal tidak geser di zona WIB/WITA/WIT
    const yy = ny;
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yy}-${mm}-${dd}`;
  }

  // Render certificate into a given set of element-id prefixes
  
function renderCertificate(p, prefix){
    const nameEl = document.getElementById(prefix+'Name');
    const noEl = document.getElementById(prefix+'No');
    const validityEl = document.getElementById(prefix+'Validity');
    const barcodeEl = document.getElementById(prefix+'Barcode');

    // Hanya 3 field sesuai permintaan: Nama, Nomor, Masa Berlaku
    if(nameEl){
      nameEl.textContent = p.nama;
      nameEl.style.color = '#000000'; // hitam
      nameEl.classList.remove('text-blue-700','dark:text-blue-400');
      nameEl.classList.add('text-black');
    }
    if(noEl) noEl.textContent = `No: ${p.certNo}`;
    if(validityEl) validityEl.textContent = `Berlaku s/d ${fmtDate(p.expiredDate)}`;

    // Barcode QR — aktif secara default. Hanya nonaktif jika admin
    // secara eksplisit mematikannya lewat toggle (nilai tersimpan '0').
    const showBarcode = localStorage.getItem('sjn_cert_barcode_v1') !== '0';
    if(!barcodeEl){
      return Promise.resolve();
    }
    barcodeEl.innerHTML = '';
    barcodeEl.classList.remove('hidden');
    barcodeEl.style.display = showBarcode ? 'block' : 'none';

    let qrPromise = Promise.resolve();
    if(showBarcode){
      if(!window.QRCode){
        if(window.__qrcodeLoadFailed){
          // Semua sumber CDN sudah dicoba dan benar-benar gagal.
          console.warn('[QR] Library QRCode tidak tersedia (semua sumber CDN gagal dimuat).');
          barcodeEl.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:8px;color:#b91c1c;text-align:center;line-height:1.2;padding:2px">QR gagal dimuat</div>';
        } else {
          // Library masih dalam proses dimuat / mencoba sumber CDN alternatif.
          // Tampilkan placeholder netral, lalu otomatis render ulang begitu siap.
          barcodeEl.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:8px;color:#64748b;text-align:center;line-height:1.2;padding:2px">Memuat QR…</div>';
          window.addEventListener('qrcode-ready', function onReady(){
            window.removeEventListener('qrcode-ready', onReady);
            (window.renderCertificate || renderCertificate)(p, prefix);
          });
        }
      } else {
        // QR berisi: Nama Peserta + Nomor Sertifikat untuk verifikasi
        const qrData = [
          'SJNAM SERTIFIKAT',
          'Nama: ' + (p.nama || ''),
          'No: ' + (p.certNo || ''),
          'Berlaku: ' + (p.expiredDate || '')
        ].join('\n');
        qrPromise = new Promise((resolve)=>{
          QRCode.toCanvas(qrData, {width: 200, margin: 1, errorCorrectionLevel: 'M'}, function(err, canvas){
            if(!err){
              canvas.style.width = '100%';
              canvas.style.height = '100%';
              barcodeEl.appendChild(canvas);
            } else {
              console.warn('[QR] Error generating QR:', err);
              barcodeEl.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:8px;color:#b91c1c;text-align:center;line-height:1.2;padding:2px">QR gagal dibuat</div>';
            }
            resolve();
          });
        });
      }
    }
    // sembunyikan elemen lama jika masih ada
    ['Logo','Subtitle','Airlines','Meta','Score','Date'].forEach(s=>{
      const el = document.getElementById(prefix+s);
      if(el) el.style.display = 'none';
    });
    return qrPromise;
  }
  window.renderCertificate = renderCertificate;

  // === CERTIFICATE TEMPLATE UPLOAD (DUAL) ===
  const TEMPLATE_KEY1 = 'sjn_cert_template_1';
  const TEMPLATE_KEY2 = 'sjn_cert_template_2';
  const TEMPLATE_ACTIVE = 'sjn_cert_template_active';
  const BARCODE_KEY = 'sjn_cert_barcode_v1';
  const POS_KEY = 'sjn_cert_positions_v1';
  const PARAF_KEY = 'sjn_cert_paraf_v1';
  const PARAF_SHOW_KEY = 'sjn_cert_paraf_show_v1';

  // Kembalikan data template berdasarkan airlines peserta:
  //   airlines === 'nam'       → Template 2 (NAM Air)
  //   airlines === 'sriwijaya' → Template 1 (Sriwijaya Air)
  //   airlines === undefined   → ikuti pilihan TEMPLATE_ACTIVE (mode manual / default)
  function getTemplateForAirlines(airlines){
    if(airlines === 'nam'){
      const d = JSON.parse(localStorage.getItem(TEMPLATE_KEY2) || 'null');
      return { data: d, num: '2' };
    }
    if(airlines === 'sriwijaya'){
      const d = JSON.parse(localStorage.getItem(TEMPLATE_KEY1) || 'null');
      return { data: d, num: '1' };
    }
    // fallback: pakai TEMPLATE_ACTIVE (pilihan manual admin)
    const active = localStorage.getItem(TEMPLATE_ACTIVE) || '1';
    const key    = active === '2' ? TEMPLATE_KEY2 : TEMPLATE_KEY1;
    return { data: JSON.parse(localStorage.getItem(key) || 'null'), num: active };
  }

  // Terapkan satu template ke satu preview container
  function applyTemplateToEl(el, templateData){
    if(!el) return;
    if(templateData && templateData.dataUrl){
      el.style.backgroundImage    = `url(${templateData.dataUrl})`;
      el.style.backgroundSize     = 'cover';
      el.style.backgroundPosition = 'center';
      el.style.backgroundRepeat   = 'no-repeat';
      el.classList.remove('bg-gradient-to-br','from-blue-50','to-indigo-100','dark:from-slate-800','dark:to-slate-900');
    } else {
      el.style.backgroundImage = '';
      if(!el.classList.contains('bg-gradient-to-br')){
        el.classList.add('bg-gradient-to-br','from-blue-50','to-indigo-100','dark:from-slate-800','dark:to-slate-900');
      }
    }
  }

  // Muat template ke preview.
  // opts.airlinesMap: { containerId: 'sriwijaya'|'nam'|null } — override per container
  // Jika tidak ada, gunakan window.lastCertData.p.airlines untuk semua container.
  function loadCertificateTemplate(opts){
    opts = opts || {};
    const airlinesMap = opts.airlinesMap || {};

    // Deteksi airlines dari lastCertData jika tidak di-pass
    const globalAirlines = (window.lastCertData && window.lastCertData.p)
      ? window.lastCertData.p.airlines
      : undefined;

    // Daftar preview → terapkan template sesuai airlines masing-masing
    const previewIds = ['certReprintPreview','pesertaCertPreview'];
    previewIds.forEach(id => {
      const el = document.getElementById(id);
      if(!el) return;
      const airlines = (id in airlinesMap) ? airlinesMap[id] : globalAirlines;
      const { data } = getTemplateForAirlines(airlines);
      applyTemplateToEl(el, data);
    });

    // Update dual preview boxes (Template 1 = SJ, Template 2 = NAM)
    const status  = document.getElementById('templateStatus');
    const t1Data  = JSON.parse(localStorage.getItem(TEMPLATE_KEY1) || 'null');
    const t2Data  = JSON.parse(localStorage.getItem(TEMPLATE_KEY2) || 'null');
    function _applyAdminPreview(imgId, boxId, badgeId, tmplData){
      const img  = document.getElementById(imgId);
      const box  = document.getElementById(boxId);
      const badge = document.getElementById(badgeId);
      if(!img || !box) return;
      if(tmplData && tmplData.dataUrl){
        img.src = tmplData.dataUrl;
        img.classList.remove('hidden');
        box.querySelector('span')?.classList.add('hidden');
        if(badge) badge.textContent = `✅ ${new Date(tmplData.savedAt).toLocaleDateString('id-ID')}`;
      } else {
        img.classList.add('hidden');
        box.querySelector('span')?.classList.remove('hidden');
        if(badge) badge.textContent = '⚠️ belum upload';
      }
    }
    _applyAdminPreview('templatePreviewImg1','templatePreviewBox1','sjTemplateAvailBadge', t1Data);
    _applyAdminPreview('templatePreviewImg2','templatePreviewBox2','namTemplateAvailBadge', t2Data);
    // Legacy single-preview (hidden but kept for compat)
    const prevImg = document.getElementById('templatePreviewImg');
    const active  = localStorage.getItem(TEMPLATE_ACTIVE) || '1';
    const { data: adminData } = getTemplateForAirlines(undefined);
    if(adminData && adminData.dataUrl && prevImg){ prevImg.src = adminData.dataUrl; prevImg.classList.remove('hidden'); }
    if(status){
      const hasBoth = t1Data && t2Data;
      const hasT1   = !!t1Data;
      const hasT2   = !!t2Data;
      if(hasBoth) status.textContent = `Status: Template 1 (SJ) & Template 2 (NAM) tersimpan. Template aktif: ${active}.`;
      else if(hasT1) status.textContent = 'Status: Template 1 (SJ) tersimpan. Template 2 (NAM) belum upload.';
      else if(hasT2) status.textContent = 'Status: Template 2 (NAM) tersimpan. Template 1 (SJ) belum upload.';
      else status.textContent = 'Status: belum ada template. Upload Template 1 untuk Sriwijaya Air & Template 2 untuk NAM Air.';
    }

    // Update badge airlines pada UI sertifikat jika ada lastCertData
    updateAirlinesBadge();

    // Barcode toggle & positions
    const toggle = document.getElementById('toggleBarcode');
    if(toggle) toggle.checked = localStorage.getItem(BARCODE_KEY) !== '0';
    loadPositions();
    updateAirlinesTemplateStatus();
    loadParaf();
  }

  // Proses gambar paraf: jika opsi transparan aktif, ubah piksel putih/terang menjadi transparan
  function processParafImage(dataUrl, makeTransparent){
    return new Promise((resolve)=>{
      if(!makeTransparent){ resolve(dataUrl); return; }
      const img = new Image();
      img.onload = ()=>{
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        try {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = imgData.data;
          for(let i=0; i<d.length; i+=4){
            const r=d[i], g=d[i+1], b=d[i+2];
            // anggap piksel terang (mendekati putih) sebagai background → transparan
            if(r>235 && g>235 && b>235){
              d[i+3] = 0;
            }
          }
          ctx.putImageData(imgData, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch(e){
          // gagal proses (misal CORS) → kembalikan dataUrl asli
          resolve(dataUrl);
        }
      };
      img.onerror = ()=> resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  // Muat paraf tersimpan ke kedua preview sertifikat
  function loadParaf(){
    const saved = JSON.parse(localStorage.getItem(PARAF_KEY) || 'null');
    const show = localStorage.getItem(PARAF_SHOW_KEY) !== '0';
    const ids = ['pesertaCertParaf','certReprintParaf'];
    ids.forEach(id=>{
      const el = document.getElementById(id);
      if(!el) return;
      if(saved && saved.dataUrl && show){
        el.src = saved.dataUrl;
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    });
    // Update preview admin & status
    const prevImg = document.getElementById('parafPreviewImg');
    const prevBox = document.getElementById('parafPreviewBox');
    const status = document.getElementById('parafStatus');
    if(saved && saved.dataUrl){
      if(prevImg){ prevImg.src = saved.dataUrl; prevImg.classList.remove('hidden'); }
      if(prevBox) prevBox.querySelector('span')?.classList.add('hidden');
      if(status) status.textContent = `Status: paraf tersimpan${saved.transparent ? ' (background transparan)' : ''} — ${new Date(saved.savedAt).toLocaleString('id-ID')}. ${show ? 'Ditampilkan pada sertifikat.' : 'Disembunyikan dari sertifikat.'}`;
    } else {
      if(prevImg) prevImg.classList.add('hidden');
      if(prevBox) prevBox.querySelector('span')?.classList.remove('hidden');
      if(status) status.textContent = 'Status: belum ada paraf.';
    }
    const btnToggle = document.getElementById('btnToggleParafShow');
    if(btnToggle) btnToggle.textContent = show ? '🙈 Sembunyikan' : '👁️ Tampilkan';
  }
  window.loadParaf = loadParaf;

  // Perbarui label status template per airlines di panel admin
  function updateAirlinesTemplateStatus(){
    const t1 = JSON.parse(localStorage.getItem(TEMPLATE_KEY1)||'null');
    const t2 = JSON.parse(localStorage.getItem(TEMPLATE_KEY2)||'null');
    const sjAvail  = document.getElementById('sjTemplateAvail');
    const namAvail = document.getElementById('namTemplateAvail');
    if(sjAvail)  sjAvail.textContent  = t1 ? `✅ tersedia (${new Date(t1.savedAt).toLocaleDateString('id-ID')})` : '⚠️ belum upload';
    if(namAvail) namAvail.textContent = t2 ? `✅ tersedia (${new Date(t2.savedAt).toLocaleDateString('id-ID')})` : '⚠️ belum upload';
    // update new dual-preview badge slots too
    const sjBadge  = document.getElementById('sjTemplateAvailBadge');
    const namBadge = document.getElementById('namTemplateAvailBadge');
    if(sjBadge)  sjBadge.textContent  = t1 ? `✅ ${new Date(t1.savedAt).toLocaleDateString('id-ID')}` : '⚠️ belum upload';
    if(namBadge) namBadge.textContent = t2 ? `✅ ${new Date(t2.savedAt).toLocaleDateString('id-ID')}` : '⚠️ belum upload';
  }

  // Tampilkan badge di atas preview yang menunjukkan template mana yang dipakai
  function updateAirlinesBadge(){
    const p = window.lastCertData && window.lastCertData.p;
    ['pesertaCertPreview','certReprintPreview'].forEach(containerId => {
      const container = document.getElementById(containerId);
      if(!container) return;
      // Hapus badge lama
      container.querySelectorAll('.cert-airlines-badge').forEach(b=>b.remove());
      if(!p) return;
      const airlines = p.airlines;
      const isSj  = airlines === 'sriwijaya';
      const isNam = airlines === 'nam';
      if(!isSj && !isNam) return;
      const badge = document.createElement('div');
      badge.className = 'cert-airlines-badge';
      badge.style.cssText = 'position:absolute;top:6px;right:8px;z-index:20;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;pointer-events:none;'
        + (isSj ? 'background:rgba(37,99,235,0.85);color:#fff;' : 'background:rgba(220,38,38,0.85);color:#fff;');
      badge.textContent = isSj ? '✈ Template 1 — Sriwijaya Air' : '✈ Template 2 — NAM Air';
      container.appendChild(badge);
    });
  }

  // hook ke renderCertificate (single consolidated wrapper)
  window.loadCertificateTemplate = loadCertificateTemplate; // ekspor agar CTB module bisa wrap
  const _origRenderCertificate = window.renderCertificate;
  window.renderCertificate = function(p, prefix){
    window.lastCertData = {p, prefix};
    const qrDone = _origRenderCertificate(p, prefix) || Promise.resolve();
    // Setelah render, muat template sesuai airlines peserta
    setTimeout(()=> loadCertificateTemplate(), 10);
    return qrDone;
  };

  function handleTemplateInput(inputId, storageKey, previewImgId, previewBoxId){
    document.getElementById(inputId)?.addEventListener('change', (e)=>{
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target.result;
        sessionStorage.setItem('temp_'+storageKey, dataUrl);
        // show in the correct per-airline preview slot
        const img = document.getElementById(previewImgId);
        const box = document.getElementById(previewBoxId);
        if(img){ img.src = dataUrl; img.classList.remove('hidden'); }
        if(box) box.querySelector('span')?.classList.add('hidden');
        // also update legacy single-preview while user hasn't saved yet
        const legacyImg = document.getElementById('templatePreviewImg');
        if(legacyImg){ legacyImg.src = dataUrl; legacyImg.classList.remove('hidden'); }
        const status = document.getElementById('templateStatus');
        if(status) status.textContent = 'Preview siap. Klik Simpan.';
      };
      reader.readAsDataURL(file);
    });
  }
  handleTemplateInput('certTemplateInput1', TEMPLATE_KEY1, 'templatePreviewImg1', 'templatePreviewBox1');
  handleTemplateInput('certTemplateInput2', TEMPLATE_KEY2, 'templatePreviewImg2', 'templatePreviewBox2');

  // === PARAF (SIGNATURE) UPLOAD ===
  const PARAF_TEMP_KEY = 'temp_'+PARAF_KEY;
  document.getElementById('certParafInput')?.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      sessionStorage.setItem(PARAF_TEMP_KEY, ev.target.result);
      const prevImg = document.getElementById('parafPreviewImg');
      const prevBox = document.getElementById('parafPreviewBox');
      if(prevImg){ prevImg.src = ev.target.result; prevImg.classList.remove('hidden'); }
      if(prevBox) prevBox.querySelector('span')?.classList.add('hidden');
      const status = document.getElementById('parafStatus');
      if(status) status.textContent = 'Preview siap. Klik Simpan Paraf.';
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('btnSaveParaf')?.addEventListener('click', async ()=>{
    const rawDataUrl = sessionStorage.getItem(PARAF_TEMP_KEY);
    if(!rawDataUrl) return showToast('Pilih file paraf dulu','error');
    const makeTransparent = document.getElementById('toggleParafTransparent')?.checked !== false;
    showToast('⏳ Memproses paraf…','info');
    const processedUrl = await processParafImage(rawDataUrl, makeTransparent);
    localStorage.setItem(PARAF_KEY, JSON.stringify({dataUrl: processedUrl, transparent: makeTransparent, savedAt: Date.now()}));
    localStorage.setItem(PARAF_SHOW_KEY, '1');
    loadParaf();
    if(typeof triggerAutoSync === 'function') triggerAutoSync();
    showToast('Paraf disimpan & ditampilkan pada sertifikat ✅','success');
  });

  document.getElementById('btnToggleParafShow')?.addEventListener('click', ()=>{
    if(!localStorage.getItem(PARAF_KEY)) return showToast('Belum ada paraf tersimpan','error');
    const current = localStorage.getItem(PARAF_SHOW_KEY) !== '0';
    localStorage.setItem(PARAF_SHOW_KEY, current ? '0' : '1');
    loadParaf();
    if(typeof triggerAutoSync === 'function') triggerAutoSync();
    showToast(current ? 'Paraf disembunyikan dari sertifikat' : 'Paraf ditampilkan pada sertifikat', 'info');
  });

  document.getElementById('btnRemoveParaf')?.addEventListener('click', ()=>{
    localStorage.removeItem(PARAF_KEY);
    localStorage.removeItem(PARAF_SHOW_KEY);
    sessionStorage.removeItem(PARAF_TEMP_KEY);
    const input = document.getElementById('certParafInput');
    if(input) input.value = '';
    loadParaf();
    if(typeof triggerAutoSync === 'function') triggerAutoSync();
    showToast('Paraf dihapus','success');
  });

  document.getElementById('btnSaveTemplate1')?.addEventListener('click', ()=>{
    const dataUrl = sessionStorage.getItem('temp_'+TEMPLATE_KEY1);
    if(!dataUrl) return showToast('Pilih file Template 1 dulu','error');
    localStorage.setItem(TEMPLATE_KEY1, JSON.stringify({dataUrl, savedAt: Date.now()}));
    localStorage.setItem(TEMPLATE_ACTIVE, '1');
    loadCertificateTemplate();
    if(typeof triggerAutoSync === 'function') triggerAutoSync();
    showToast('Template 1 disimpan & aktif','success');
  });
  document.getElementById('btnSaveTemplate2')?.addEventListener('click', ()=>{
    const dataUrl = sessionStorage.getItem('temp_'+TEMPLATE_KEY2);
    if(!dataUrl) return showToast('Pilih file Template 2 dulu','error');
    localStorage.setItem(TEMPLATE_KEY2, JSON.stringify({dataUrl, savedAt: Date.now()}));
    localStorage.setItem(TEMPLATE_ACTIVE, '2');
    loadCertificateTemplate();
    if(typeof triggerAutoSync === 'function') triggerAutoSync();
    showToast('Template 2 disimpan & aktif','success');
  });
  document.getElementById('btnUseTemplate1')?.addEventListener('click', ()=>{
    if(!localStorage.getItem(TEMPLATE_KEY1)) return showToast('Template 1 belum ada','error');
    localStorage.setItem(TEMPLATE_ACTIVE, '1');
    loadCertificateTemplate();
    if(typeof triggerAutoSync === 'function') triggerAutoSync();
    showToast('Template 1 diaktifkan','success');
  });
  document.getElementById('btnUseTemplate2')?.addEventListener('click', ()=>{
    if(!localStorage.getItem(TEMPLATE_KEY2)) return showToast('Template 2 belum ada','error');
    localStorage.setItem(TEMPLATE_ACTIVE, '2');
    loadCertificateTemplate();
    if(typeof triggerAutoSync === 'function') triggerAutoSync();
    showToast('Template 2 diaktifkan','success');
  });
  
  document.getElementById('btnDownloadTemplate')?.addEventListener('click', ()=>{
    const { data } = getTemplateForAirlines(undefined);
    if(!data) return showToast('Tidak ada template','error');
    const a = document.createElement('a');
    a.href = data.dataUrl;
    a.download = 'template-sertifikat-sjnam.png';
    a.click();
  });
  document.getElementById('btnResetTemplate')?.addEventListener('click', ()=>{
    localStorage.removeItem(TEMPLATE_KEY1);
    localStorage.removeItem(TEMPLATE_KEY2);
    localStorage.removeItem(TEMPLATE_ACTIVE);
    sessionStorage.removeItem('temp_'+TEMPLATE_KEY1);
    sessionStorage.removeItem('temp_'+TEMPLATE_KEY2);
    loadCertificateTemplate();
    if(typeof triggerAutoSync === 'function') triggerAutoSync();
    showToast('Template direset ke default (perangkat ini saja — perangkat lain tidak ikut ter-reset)','success');
  });
  document.getElementById('toggleBarcode')?.addEventListener('change', (e)=>{
    localStorage.setItem(BARCODE_KEY, e.target.checked ? '1' : '0');
    if(typeof triggerAutoSync === 'function') triggerAutoSync();
    showToast('Barcode ' + (e.target.checked ? 'diaktifkan ✅' : 'dimatikan'), e.target.checked ? 'success' : 'info');
    // Force re-render of current certificate to apply barcode toggle
    if(window.lastCertData){
      // Remove Tailwind hidden class on both barcode elements before re-render
      ['pesertaCertBarcode','certReprintBarcode'].forEach(id=>{
        const el = document.getElementById(id);
        if(el) el.classList.remove('hidden');
      });
      renderCertificate(window.lastCertData.p, window.lastCertData.prefix);
    }
  });

  // === DRAG & RESIZE untuk field teks + QR Barcode ===
  function makeDraggable(el, opts){
    if(!el) return;
    if(el.dataset.draggableInit === '1') return; // cegah pemasangan listener berulang
    el.dataset.draggableInit = '1';
    const resizeMode = (opts && opts.resizeMode) || 'font'; // 'font' atau 'box'
    let isDown = false, startX, startY, startLeft, startTop;

    el.addEventListener('mousedown', (e)=>{
      isDown = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      const parentRect = el.parentElement.getBoundingClientRect();
      startLeft = rect.left - parentRect.left;
      startTop = rect.top - parentRect.top;
      el.style.transition = 'none';
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e)=>{
      if(!isDown) return;
      const parentRect = el.parentElement.getBoundingClientRect();
      let newLeft = startLeft + (e.clientX - startX);
      let newTop = startTop + (e.clientY - startY);
      newLeft = Math.max(0, Math.min(newLeft, parentRect.width - el.offsetWidth));
      newTop = Math.max(0, Math.min(newTop, parentRect.height - el.offsetHeight));
      el.style.left = (newLeft / parentRect.width * 100) + '%';
      el.style.top = (newTop / parentRect.height * 100) + '%';
      el.style.transform = 'translate(0,0)';
    });
    document.addEventListener('mouseup', ()=>{
      if(isDown){
        isDown = false;
        el.style.transition = '';
        savePositions();
      }
    });

    // touch
    el.addEventListener('touchstart', (e)=>{
      const t = e.touches[0];
      isDown = true;
      startX = t.clientX; startY = t.clientY;
      const rect = el.getBoundingClientRect();
      const parentRect = el.parentElement.getBoundingClientRect();
      startLeft = rect.left - parentRect.left;
      startTop = rect.top - parentRect.top;
    });
    document.addEventListener('touchmove', (e)=>{
      if(!isDown) return;
      const t = e.touches[0];
      const parentRect = el.parentElement.getBoundingClientRect();
      let newLeft = startLeft + (t.clientX - startX);
      let newTop = startTop + (t.clientY - startY);
      el.style.left = (newLeft / parentRect.width * 100) + '%';
      el.style.top = (newTop / parentRect.height * 100) + '%';
      el.style.transform = 'translate(0,0)';
    });
    document.addEventListener('touchend', ()=>{ if(isDown){ isDown=false; savePositions(); }});

    // wheel + ctrl/alt/meta untuk resize (font untuk teks, kotak untuk QR Barcode)
    el.addEventListener('wheel', (e)=>{
      if(!e.ctrlKey && !e.altKey && !e.metaKey) return; // require modifier to avoid scroll conflict
      e.preventDefault();
      if(resizeMode === 'box'){
        const curW = parseFloat(el.style.width) || el.offsetWidth || 90;
        let w = curW + (e.deltaY < 0 ? 4 : -4);
        w = Math.max(40, Math.min(220, w));
        el.style.width = w + 'px';
        el.style.height = w + 'px';
      } else {
        const style = window.getComputedStyle(el);
        let size = parseFloat(style.fontSize) || 16;
        size += (e.deltaY < 0 ? 1 : -1);
        size = Math.max(8, Math.min(72, size));
        el.style.fontSize = size + 'px';
      }
      savePositions();
    });
  }

  function savePositions(){
    const fields = ['Name','No','Validity','Barcode','Paraf'];
    const prefixes = ['pesertaCert','certReprint'];
    const pos = {};
    prefixes.forEach(pre=>{
      fields.forEach(f=>{
        const el = document.getElementById(pre+f);
        if(el){
          pos[pre+f] = {
            left: el.style.left,
            top: el.style.top,
            fontSize: el.style.fontSize,
            width: el.style.width,
            height: el.style.height,
            transform: el.style.transform,
            color: el.style.color,
            fontFamily: el.style.fontFamily,
            fontWeight: el.style.fontWeight,
            fontStyle: el.style.fontStyle,
            textDecoration: el.style.textDecoration,
            textAlign: el.style.textAlign
          };
        }
      });
    });
    localStorage.setItem(POS_KEY, JSON.stringify(pos));
    if(typeof triggerAutoSync === 'function') triggerAutoSync();
  }

  function loadPositions(){
    const pos = JSON.parse(localStorage.getItem(POS_KEY) || '{}');
    // Jika tidak ada posisi tersimpan, biarkan default dari HTML
    if(Object.keys(pos).length === 0) {
      // pasang draggable tanpa mengubah posisi
      ['pesertaCertName','pesertaCertNo','pesertaCertValidity','certReprintName','certReprintNo','certReprintValidity'].forEach(id=>{
        makeDraggable(document.getElementById(id), {resizeMode:'font'});
      });
      ['pesertaCertBarcode','certReprintBarcode','pesertaCertParaf','certReprintParaf'].forEach(id=>{
        makeDraggable(document.getElementById(id), {resizeMode:'box'});
      });
      return;
    }
    Object.keys(pos).forEach(id=>{
      const el = document.getElementById(id);
      if(el && pos[id]){
        if(pos[id].left) el.style.left = pos[id].left;
        if(pos[id].top) el.style.top = pos[id].top;
        if(pos[id].fontSize) el.style.fontSize = pos[id].fontSize;
        if(pos[id].width) el.style.width = pos[id].width;
        if(pos[id].height) el.style.height = pos[id].height;
        if(pos[id].color) el.style.color = pos[id].color;
        if(pos[id].fontFamily) el.style.fontFamily = pos[id].fontFamily;
        if(pos[id].fontWeight) el.style.fontWeight = pos[id].fontWeight;
        if(pos[id].fontStyle) el.style.fontStyle = pos[id].fontStyle;
        if(pos[id].textDecoration) el.style.textDecoration = pos[id].textDecoration;
        if(pos[id].textAlign) el.style.textAlign = pos[id].textAlign;
        // Jika posisi menggunakan % tanpa drag → pakai translate(-50%,-50%) untuk centering
        if(pos[id].transform) el.style.transform = pos[id].transform;
        else if(pos[id].left && pos[id].left.includes('%')) el.style.transform = 'translate(-50%,-50%)';
      }
    });
    // make draggable — teks (resize via font) + QR Barcode (resize via kotak)
    ['pesertaCertName','pesertaCertNo','pesertaCertValidity','certReprintName','certReprintNo','certReprintValidity'].forEach(id=>{
      makeDraggable(document.getElementById(id), {resizeMode:'font'});
    });
    ['pesertaCertBarcode','certReprintBarcode','pesertaCertParaf','certReprintParaf'].forEach(id=>{
      makeDraggable(document.getElementById(id), {resizeMode:'box'});
    });
  }
  window.loadPositions = loadPositions; // ekspor agar cloud sync bisa re-apply posisi setelah pull

  // init
  setTimeout(()=>{
    loadCertificateTemplate();
    loadPositions();
  }, 500);

  async function downloadCertificate(previewElId, filenamePrefix, certNo){
  // BUGFIX: wrap seluruh fungsi dalam try-catch agar kegagalan html2canvas/jsPDF
  // tidak menyebabkan unhandled promise rejection tanpa feedback ke user.
  try {
    const el = document.getElementById(previewElId);
    if(typeof html2canvas === 'undefined'){ showToast('html2canvas belum load','error'); return null; }
    showToast('Membuat PDF (kualitas tinggi)...','info');
    // scale:4 menghasilkan gambar 4× lebih besar → jernih saat dicetak
    const canvas = await html2canvas(el, {
      scale: 4,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      imageTimeout: 0,
      logging: false
    });
    // Gunakan PNG untuk ketajaman teks & QR code maksimal
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({orientation:'landscape', unit:'mm', format:'a4'});
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    // Isi penuh halaman tanpa margin
    pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH, '', 'FAST');
    pdf.save(`${filenamePrefix}-${certNo}.pdf`);
    showToast('PDF berhasil diunduh ✅','success');
    return imgData;
  } catch(err){
    // BUGFIX: catch PDF generation errors and show user-friendly message
    showToast('Gagal membuat PDF: ' + err.message, 'error');
    console.error('[downloadCertificate]', err);
    return null;
  }
} // BUGFIX: closing brace for downloadCertificate function (was missing — caused SyntaxError in training module)
  window.downloadCertificate = downloadCertificate;

  function sendCertificateEmail(p){
    const airlinesName = p.airlines==='nam' ? 'NAM Air' : 'Sriwijaya Air';
    const subject = `Sertifikat Training ${airlinesName} - ${esc(p.nama)} (${p.certNo})`;
    const body = [
      `Yth. ${esc(p.nama)},`,
      '',
      `Terima kasih telah menyelesaikan Soal Training Basic Service Indoctrination ${airlinesName}.`,
      '',
      `No Sertifikat : ${p.certNo}`,
      `Tanggal Training : ${fmtDate(p.tanggal)} pukul ${p.jam}`,
      `Stasiun : ${esc(p.stasiun)}`,
      `Perusahaan : ${esc(p.perusahaan)}`,
      `Jabatan : ${esc(p.jabatan)}`,
      `Skor : ${p.score} / ${p.maxScore}`,
      `Berlaku hingga : ${fmtDate(p.expiredDate)}`,
      '',
      'Mohon lampirkan file sertifikat (PNG) yang telah didownload ke email ini sebelum dikirim.',
      '',
      'Salam,',
      'Training Team SJNAM'
    ].join('\n');

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(p.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
    showToast('Jendela Gmail dibuka. Lampirkan sertifikat PNG yang telah didownload, lalu klik Kirim.', 'info');
  }
  window.sendCertificateEmail = sendCertificateEmail;

  // =============================================================
  // CERTIFICATE SEARCH (Tab Sertifikat)
  // =============================================================
  function dispatchCertSearch(query){
    query = (query||'').toLowerCase().trim();
    const resultsEl = document.getElementById('certSearchResults');
    const reprintArea = document.getElementById('certReprintArea');
    if(!resultsEl) return;
    if(!query){ resultsEl.innerHTML=''; if(reprintArea) reprintArea.classList.add('hidden'); return; }
    const matches = (trainingData.peserta||[]).filter(p =>
      (p.certNo||'').toLowerCase().includes(query) ||
      (p.nama||'').toLowerCase().includes(query) ||
      (p.email||'').toLowerCase().includes(query)
    );
    if(!matches.length){
      resultsEl.innerHTML = '<p class="text-sm text-slate-500">Tidak ditemukan data sertifikat.</p>';
      if(reprintArea) reprintArea.classList.add('hidden');
      return;
    }
    resultsEl.innerHTML = matches.map(p=>`
      <div data-cert-pick="${p.certNo}" class="p-3 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
        <div>
          <p class="font-semibold text-sm">${esc(p.nama)} <span class="text-slate-400 font-normal">(${p.airlines==='nam'?'NAM Air':'Sriwijaya Air'})</span></p>
          <p class="text-xs text-slate-500">${esc(p.certNo)} • Skor ${p.score}/${p.maxScore} • ${fmtDate(p.tanggal)}</p>
        </div>
        <span class="text-xs text-blue-600">Lihat →</span>
      </div>
    `).join('');
    if(matches.length===1) showCertReprint(matches[0]);
  }
  window.dispatchCertSearch = dispatchCertSearch;

  function showCertReprint(p){
    const reprintArea = document.getElementById('certReprintArea');
    if(!reprintArea) return;
    reprintArea.classList.remove('hidden');
    renderCertificate(p, 'certReprint');
    const reprintInfo = document.getElementById('certReprintInfo');
    if(!reprintInfo) return;
    reprintInfo.innerHTML = `
      <p><strong>No Sertifikat:</strong> ${esc(p.certNo)}</p>
      <p><strong>Nama:</strong> ${esc(p.nama)}</p>
      <p><strong>Airlines:</strong> ${p.airlines==='nam'?'NAM Air':'Sriwijaya Air'}</p>
      <p><strong>Stasiun:</strong> ${esc(p.stasiun)} | <strong>Perusahaan:</strong> ${esc(p.perusahaan)} | <strong>Jabatan:</strong> ${esc(p.jabatan)}</p>
      <p><strong>Email:</strong> ${esc(p.email)} | <strong>No HP:</strong> ${esc(p.hp)}</p>
      <p><strong>Skor:</strong> ${p.score} / ${p.maxScore}</p>
      <p><strong>Tanggal Training:</strong> ${fmtDate(p.tanggal)} ${esc(p.jam)}</p>
      <p><strong>Berlaku hingga:</strong> ${fmtDate(p.expiredDate)}</p>
    `;
    reprintArea.dataset.certNo = p.certNo;
  }

  document.getElementById('btnCertSearch')?.addEventListener('click', ()=>{
    const inp = document.getElementById('certSearchInput');
    if(inp) dispatchCertSearch(inp.value);
  });
  document.getElementById('certSearchInput')?.addEventListener('keydown', (e)=>{
    if(e.key==='Enter') dispatchCertSearch(e.target.value);
  });
  document.getElementById('certSearchResults')?.addEventListener('click', (e)=>{
    const certNo = e.target.closest('[data-cert-pick]')?.getAttribute('data-cert-pick');
    if(certNo){
      const p = (trainingData.peserta||[]).find(x=>x.certNo===certNo);
      if(p) showCertReprint(p);
    }
  });
  document.getElementById('btnReprintDownload')?.addEventListener('click', ()=>{
    const repArea = document.getElementById('certReprintArea');
    if(!repArea) return;
    const certNo = repArea.dataset.certNo;
    const p = (trainingData.peserta||[]).find(x=>x.certNo===certNo);
    if(p) downloadCertificate('certReprintPreview', 'sertifikat', p.certNo);
  });
  document.getElementById('btnReprintSendEmail')?.addEventListener('click', ()=>{
    const certNo = document.getElementById('certReprintArea').dataset.certNo;
    const p = trainingData.peserta.find(x=>x.certNo===certNo);
    if(p) sendCertificateEmail(p);
  });

  // =============================================================
  // PESERTA WIZARD (Soal Training Flow)
  // =============================================================
  let pesertaCurrentResult = null; // holds quiz answers in progress
  let pesertaWizardStep = 1;
  let pesertaSelectedBank = null; // bank object chosen by peserta for this attempt

  function populateStasiunOptions(){
    const sel = document.getElementById('pStasiun');
    if(!sel) return;
    const list = (typeof stations !== 'undefined' ? stations : []).slice().sort((a,b)=>(a.iata||'').localeCompare(b.iata||''));
    sel.innerHTML = '<option value="">-- Pilih Stasiun --</option>' +
      list.map(s=>`<option value="${esc(s.iata)} - ${esc(s.name)}">${esc(s.iata)} - ${esc(s.name)}</option>`).join('');
  }

  function populateBankOptions(){
    const sel = document.getElementById('pBank');
    if(!sel) return;
    const banks = (trainingData.banks||[]).filter(b=>b.questions.length>0);
    if(!banks.length){
      sel.innerHTML = '<option value="">-- Belum ada soal training --</option>';
      return;
    }
    sel.innerHTML = '<option value="">-- Pilih Soal Training --</option>' +
      banks.map(b=>`<option value="${esc(b.id)}">${esc(b.name)} (${b.questions.length} soal)</option>`).join('');
  }

  function gotoPesertaStep(step){
    pesertaWizardStep = step;
    [1,2,3].forEach(i=>{
      document.getElementById('pesertaStep'+i)?.classList.toggle('active', i===step);
      const dot = document.getElementById('pesertaStepDot'+i);
      if(dot){
        dot.classList.remove('active','done','pending');
        if(i<step) dot.classList.add('done');
        else if(i===step) dot.classList.add('active');
        else dot.classList.add('pending');
      }
    });
    window.scrollTo({top:0,behavior:'smooth'});
  }

  document.getElementById('btnStartPeserta')?.addEventListener('click', ()=>{
    const totalQuestions = (trainingData.banks||[]).reduce((a,b)=>a+b.questions.length,0);
    if(!totalQuestions){
      showToast('Belum ada soal training. Tambahkan soal terlebih dahulu di Bank Soal.', 'error');
      return;
    }
    // reset form
    ['pAirlines','pBank','pTanggal','pJam','pNama','pStasiun','pPerusahaan','pJabatan','pHp','pEmail'].forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.value = '';
    });
    populateStasiunOptions();
    populateBankOptions();
    pesertaCurrentResult = null;
    pesertaSelectedBank = null;
    gotoPesertaStep(1);
    window.switchTab('soal-peserta');
  });

  document.getElementById('btnPesertaNext1')?.addEventListener('click', ()=>{
    const required = {
      pAirlines:'Airlines', pBank:'Soal Training', pTanggal:'Tanggal Training', pJam:'Jam Training', pNama:'Nama',
      pStasiun:'Stasiun', pPerusahaan:'Perusahaan', pJabatan:'Jabatan', pHp:'No Handphone', pEmail:'Email'
    };
    for(const [id,label] of Object.entries(required)){
      const el = document.getElementById(id);
      if(!el || !el.value.trim()){
        showToast(`Mohon lengkapi: ${label}`, 'error');
        el?.focus();
        return;
      }
    }
    const emailVal = document.getElementById('pEmail').value.trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)){
      showToast('Format email tidak valid', 'error');
      return;
    }
    const bankId = document.getElementById('pBank').value;
    pesertaSelectedBank = trainingData.banks.find(b=>b.id===bankId);
    if(!pesertaSelectedBank || !pesertaSelectedBank.questions.length){
      showToast('Soal Training yang dipilih tidak tersedia', 'error');
      return;
    }
    renderPesertaQuiz();
    gotoPesertaStep(2);
  });

  document.getElementById('btnPesertaBack2')?.addEventListener('click', ()=> gotoPesertaStep(1));

  function renderPesertaQuiz(){
    const c = document.getElementById('pesertaQuizContainer');
    if(!c) return; // BUGFIX: null check sebelum akses .innerHTML
    const questions = pesertaSelectedBank ? pesertaSelectedBank.questions : [];
    c.innerHTML = questions.map((s,i)=>`
      <div class="p-4 border border-slate-200 dark:border-slate-700 rounded-xl">
        <p class="font-semibold text-sm mb-3">${i+1}. ${esc(s.q)}</p>
        <div class="space-y-2">
          ${['A','B','C','D'].map(opt=>`
            <label class="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-400 dark:has-[:checked]:bg-blue-900/20 transition">
              <input type="radio" name="quiz_${s.id}" value="${opt}" class="accent-blue-600">
              <span class="text-sm">${opt}. ${esc(s.options[opt])}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `).join('');
    updatePesertaQuizProgress();
  }

  function updatePesertaQuizProgress(){
    const questions = pesertaSelectedBank ? pesertaSelectedBank.questions : [];
    const total = questions.length;
    let answered = 0;
    questions.forEach(s=>{
      if(document.querySelector(`input[name="quiz_${s.id}"]:checked`)) answered++;
    });
    document.getElementById('pesertaQuizProgress').textContent = `${answered} / ${total}`;
  }

  document.getElementById('btnPesertaFinish')?.addEventListener('click', async ()=>{
    const questions = pesertaSelectedBank ? pesertaSelectedBank.questions : [];
    const total = questions.length;
    let answered = 0;
    let score = 0;
    let maxScore = 0;
    questions.forEach(s=>{
      maxScore += Number(s.score)||0;
      const checked = document.querySelector(`input[name="quiz_${s.id}"]:checked`);
      if(checked){
        answered++;
        if(checked.value === s.answer) score += Number(s.score)||0;
      }
    });
    if(answered < total){
      const ok = await showConfirm('Soal Belum Lengkap', `Anda baru menjawab ${answered} dari ${total} soal. Soal yang belum dijawab dianggap salah. Lanjutkan?`);
      if(!ok) return;
    }

    const airlines = document.getElementById('pAirlines').value;
    const tanggal = document.getElementById('pTanggal').value;
    const certNo = genCertNo(airlines, tanggal);
    const peserta = {
      id: Date.now().toString(),
      certNo,
      airlines,
      bankId: pesertaSelectedBank ? pesertaSelectedBank.id : '',
      bankName: pesertaSelectedBank ? pesertaSelectedBank.name : '',
      tanggal,
      jam: document.getElementById('pJam').value,
      nama: document.getElementById('pNama').value.trim(),
      stasiun: document.getElementById('pStasiun').value,
      perusahaan: document.getElementById('pPerusahaan').value.trim(),
      jabatan: document.getElementById('pJabatan').value.trim(),
      hp: document.getElementById('pHp').value.trim(),
      email: document.getElementById('pEmail').value.trim(),
      score,
      maxScore,
      createdAt: new Date().toISOString(),
      expiredDate: addYears(tanggal || todayLocalStr(), 2),
    };
    if(trainingData.peserta.length >= 150){ showToast("Maksimal 150 peserta tercapai","error"); return; }
    // BUGFIX: wrap dalam try-catch agar kegagalan saveTraining (misal localStorage penuh)
    // tidak menyebabkan data peserta setengah tersimpan tanpa notifikasi ke user.
    try {
      trainingData.peserta.push(peserta);
      saveTraining();
    } catch(err){
      showToast('Gagal menyimpan data peserta: ' + err.message, 'error');
      // Rollback push jika saveTraining gagal
      trainingData.peserta.pop();
      return;
    }
    if(typeof renderPeserta === 'function') renderPeserta();
    // RULE BARU: langsung sync ke cloud saat peserta klik Selesai & Lihat Skor
    if(typeof cloudPush === 'function' && typeof cloudConfig !== 'undefined' && cloudConfig.supabaseUrl && cloudConfig.supabaseKey){
      cloudPush(true).then(ok=>{ if(ok) showToast('✅ Data peserta langsung tersinkron ke Bank Data','success'); }).catch(err=>{ showToast('Sync peserta gagal — akan dicoba ulang','warning'); });
    }

    // Show result
    document.getElementById('pesertaScoreValue').textContent = score;
    document.getElementById('pesertaScoreMax').textContent = maxScore;
    const pct = maxScore>0 ? (score/maxScore*100) : 0;
    const statusEl = document.getElementById('pesertaScoreStatus');
    if(pct>=80){ statusEl.textContent='✅ LULUS'; statusEl.className='text-sm font-semibold mb-4 text-emerald-600'; }
    else if(pct>=60){ statusEl.textContent='⚠️ CUKUP'; statusEl.className='text-sm font-semibold mb-4 text-amber-600'; }
    else { statusEl.textContent='❌ PERLU PENGULANGAN'; statusEl.className='text-sm font-semibold mb-4 text-red-600'; }

    renderCertificate(peserta, 'pesertaCert');
    pesertaCurrentResult = peserta;
    gotoPesertaStep(3);
  });

  document.getElementById('btnPesertaDownloadCert')?.addEventListener('click', ()=>{
    if(!pesertaCurrentResult) return;
    downloadCertificate('pesertaCertPreview', 'sertifikat', pesertaCurrentResult.certNo);
  });
  document.getElementById('btnPesertaSendEmail')?.addEventListener('click', ()=>{
    if(!pesertaCurrentResult) return;
    sendCertificateEmail(pesertaCurrentResult);
  });
  document.getElementById('btnPesertaRestart')?.addEventListener('click', ()=>{
    document.getElementById('btnStartPeserta')?.click();
  });

  // =============================================================
  // INITIALIZE
  // =============================================================
  function refreshTrainingViews(){
    renderMateri();
    renderSoal();
    renderPeserta();
  }
  window.refreshTrainingViews = refreshTrainingViews;

  setTimeout(refreshTrainingViews, 500);
})();

// === DELAY NOW LOCAL TIME FIX ===
(function(){
  // Override any Delay Now calculation to use local station time
  const origRenderData = window.renderDataTable || function(){};
  if(typeof origRenderData === 'function'){
    window.renderDataTable = function(...args){
      // Before render, convert UTC to local based on station
      if(window.delayData){
        window.delayData = window.delayData.map(d => {
          if(d.stdUtc && d.route){
            const origin = d.route.substring(0,3);
            const station = (window.stations||[]).find(s=>s.code===origin);
            const offset = station ? (station.utcOffset||7) : 7;
            // Convert to local
            const [h,m] = d.stdUtc.split(':').map(Number);
            const localHour = (h + offset) % 24;
            d.delayNowLocal = `${String(localHour).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
          }
          return d;
        });
      }
      return origRenderData.apply(this, args);
    };
  }
  // Update clock to show WIB local
  setInterval(()=>{
    const now = new Date();
    const wib = new Date(now.toLocaleString('en-US', {timeZone:'Asia/Jakarta'}));
    const el = document.getElementById('clockWib');
    if(el) el.textContent = 'WIB '+wib.toLocaleTimeString('id-ID');
  },1000);
})();


// === FIX DELAY NOW LOCAL TIME ===
(function(){
  function getLocalDelay(stdUtc, route){
    if(!stdUtc || !route) return '-';
    const origin = route.substring(0,3);
    const stations = JSON.parse(localStorage.getItem('sjn_stations_v2') || '[]');
    const station = stations.find(s=>s.code===origin);
    const offset = station ? (station.utcOffset || 7) : 7;
    const now = new Date();
    const [h,m] = stdUtc.split(':').map(Number);
    const stdUtcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m, 0));
    const localStd = new Date(stdUtcDate.getTime() + offset*3600000);
    const diffMs = now.getTime() - localStd.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    return diffMin > 0 ? diffMin + ' min' : 'On Time';
  }
  window.getLocalDelay = getLocalDelay;
  
  document.getElementById('closePdf')?.addEventListener('click', ()=>{
  const modal = document.getElementById('pdfModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.style.overflow = '';
});

// NOTE: toggleTrainingMenu & toggleDrygoodsMenu sudah ditangani di sidebar
// DOMContentLoaded block di atas (dengan localStorage persistence per-user).
// IIFE Training Menu Toggle yang lama dihapus untuk menghilangkan listener duplikat
// yang konflik dengan restoreMenuStates() dan setMenuState() di DOMContentLoaded.
})();
