/* ================================================================
   SJNAM — IMPORT BANK DATA PESERTA TRAINING
   ================================================================
   Melengkapi tab "Bank Data Peserta" di modul Service Training
   dengan tombol "Import Excel".

   [BUG DITEMUKAN & DIPERBAIKI] Versi sebelumnya MEWAJIBKAN kolom
   "No Sertifikat" ada & terisi di file Excel — kalau tidak ada,
   SEMUA baris ditolak (dianggap "tidak valid"), sehingga import
   selalu menghasilkan 0 data walau file-nya benar. Ternyata banyak
   kasus pemakaian (migrasi data lama, input massal peserta yang
   belum pernah dapat sertifikat SJNAM) justru TIDAK PUNYA nomor
   sertifikat sama sekali di sumber datanya. Sekarang kolom itu
   OPSIONAL — kalau tidak ada di file, nomor sertifikat dibuat
   OTOMATIS memakai rumus PERSIS SAMA seperti fitur "Mulai Training
   (Peserta)" di training.js (format: 00026/BSI/CS-SJ/VII/2026),
   termasuk melanjutkan urutan nomor dari data yang sudah ada
   (bukan reset ke 1), dan tetap berurutan benar untuk BANYAK baris
   sekaligus dalam satu file yang sama.

   Juga menyertakan proteksi yang sama seperti checkin-otp-
   dashboard.js: kalau versi SheetJS di browser mengembalikan
   tanggal/jam sebagai angka serial Excel mentah (bukan string
   terformat), itu dikenali & dikonversi dengan benar — bukan malah
   salah baca jadi tahun aneh (lihat catatan bug "01-Jan-46053" yang
   pernah terjadi di modul Check-In Report).

   Kenapa dibuat file terpisah: training.js terminifikasi jadi satu
   baris. window.trainingData & window.saveTraining sudah di-expose
   (referensi langsung) — dipakai untuk baca/tulis data peserta
   tanpa menebak variabel privat lain.
   ================================================================ */
!function () {
  "use strict";

  if (window._pesertaImportInit) return;
  window._pesertaImportInit = true;

  var MONTH_ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

  function getVal(row, keys) {
    for (var i = 0; i < keys.length; i++) {
      for (var rk in row) {
        if (Object.prototype.hasOwnProperty.call(row, rk) && rk.trim().toLowerCase() === keys[i].toLowerCase()) {
          var v = row[rk];
          return v == null ? "" : v; // kembalikan APA ADANYA (bisa Date object/angka/string) — konversi dilakukan pemanggil
        }
      }
    }
    return "";
  }
  function getValStr(row, keys) { return String(getVal(row, keys) == null ? "" : getVal(row, keys)).trim(); }

  function toAirlinesCode(v) {
    var s = (v || "").toLowerCase();
    if (s.indexOf("nam") !== -1) return "nam";
    if (s.indexOf("sriwijaya") !== -1 || s === "sj") return "sriwijaya";
    return s === "nam" || s === "sriwijaya" ? s : "sriwijaya"; // default aman kalau tidak dikenali
  }

  // ── Konversi Excel serial → info tanggal/jam, replikasi PERSIS
  //    logic yang sudah terbukti benar di checkin-otp-dashboard.js ──
  function excelSerialToInfo(serial) {
    var utcDays = Math.floor(serial - 25569);
    var utcValue = utcDays * 86400;
    var dateInfo = new Date(utcValue * 1000);
    var fractionalDay = serial - Math.floor(serial) + 0.0000001;
    var totalSeconds = Math.floor(86400 * fractionalDay);
    var seconds = totalSeconds % 60;
    totalSeconds -= seconds;
    var hours = Math.floor(totalSeconds / 3600);
    var minutes = Math.floor(totalSeconds / 60) % 60;
    return {
      year: dateInfo.getUTCFullYear(), month: dateInfo.getUTCMonth() + 1, day: dateInfo.getUTCDate(),
      hours: hours, minutes: minutes
    };
  }
  function looksLikeExcelSerial(v) {
    var s = String(v).trim();
    if (!s || /[:\-\/]/.test(s)) return false;
    var n = Number(s);
    return !isNaN(n) && n >= 0;
  }

  function toISODateLoose(raw) {
    if (raw === "" || raw == null) return "";
    if (raw instanceof Date && !isNaN(raw.getTime())) {
      return raw.getFullYear() + "-" + String(raw.getMonth() + 1).padStart(2, "0") + "-" + String(raw.getDate()).padStart(2, "0");
    }
    if (looksLikeExcelSerial(raw) && Number(raw) > 20000 && Number(raw) < 80000) {
      var info = excelSerialToInfo(Number(raw));
      if (info.year > 1990 && info.year < 2100) {
        return info.year + "-" + String(info.month).padStart(2, "0") + "-" + String(info.day).padStart(2, "0");
      }
    }
    var s = String(raw).trim();
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
    var d2 = new Date(s);
    if (!isNaN(d2.getTime())) return d2.getFullYear() + "-" + String(d2.getMonth() + 1).padStart(2, "0") + "-" + String(d2.getDate()).padStart(2, "0");
    return s; // biarkan apa adanya kalau tidak bisa diparse — lebih baik daripada kosong
  }

  function toHHMMLoose(raw) {
    if (raw === "" || raw == null) return "";
    if (raw instanceof Date && !isNaN(raw.getTime())) {
      return String(raw.getHours()).padStart(2, "0") + ":" + String(raw.getMinutes()).padStart(2, "0");
    }
    if (looksLikeExcelSerial(raw)) {
      var n = Number(raw);
      if (n < 3 || n > 20000) {
        var info = excelSerialToInfo(n);
        return String(info.hours).padStart(2, "0") + ":" + String(info.minutes).padStart(2, "0");
      }
    }
    var s = String(raw).trim();
    var m = s.match(/(\d{1,2}):(\d{2})/);
    if (m) return String(Math.min(23, parseInt(m[1], 10))).padStart(2, "0") + ":" + m[2];
    return s;
  }

  function addYearsISO(dateStr, years) {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return (d.getFullYear() + years) + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function genId() { return "pst_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  // ── Generator No Sertifikat — REPLIKASI PERSIS rumus di training.js
  //    (fitur "Mulai Training (Peserta)"), termasuk melanjutkan urutan
  //    dari data TRN/BSI yang sudah ada, dan konsisten untuk banyak
  //    baris sekaligus dalam satu batch import (pakai counter berjalan
  //    per kombinasi kode-airline + tahun, bukan re-scan tiap baris). ──
  function makeCertNoGenerator(existingPeserta) {
    var runningMaxSeq = {}; // key: "CS-SJ|2026" -> nomor urut tertinggi sejauh ini
    function keyFor(code, year) { return code + "|" + year; }
    existingPeserta.forEach(function (p) {
      var match = (p.certNo || "").match(/^(\d{5})\/(?:TRN|BSI)\/(CS-SJ|CS-IN)\/[IVX]+\/(\d{4})$/);
      if (match) {
        var k = keyFor(match[2], match[3]);
        var seq = parseInt(match[1], 10);
        if (!runningMaxSeq[k] || seq > runningMaxSeq[k]) runningMaxSeq[k] = seq;
      }
    });
    return function (airlinesCode, tanggalISO) {
      var ref = tanggalISO ? new Date(tanggalISO) : new Date();
      var y = isNaN(ref.getTime()) ? new Date().getFullYear() : ref.getFullYear();
      var code = airlinesCode === "nam" ? "CS-IN" : "CS-SJ";
      var monthNum = isNaN(ref.getTime()) ? new Date().getMonth() + 1 : ref.getMonth() + 1;
      var romanMonth = MONTH_ROMAN[(monthNum - 1 + 12) % 12] || "I";
      var k = keyFor(code, y);
      var nextSeq = (runningMaxSeq[k] || 0) + 1;
      runningMaxSeq[k] = nextSeq; // update counter berjalan supaya baris BERIKUTNYA di batch yang sama lanjut benar
      return String(nextSeq).padStart(5, "0") + "/BSI/" + code + "/" + romanMonth + "/" + y;
    };
  }

  /* ---------------------------------------------------------------
     Tambah Peserta Manual — form modal, terpisah dari wizard
     "Mulai Training (Peserta)" (yang mewajibkan kuis dijawab dulu).
     Cocok untuk input cepat data peserta yang training-nya sudah
     dilakukan di luar sistem (offline), atau migrasi data lama.
     Memakai rumus No Sertifikat & Expired Date OTOMATIS yang sama
     persis dengan fitur Import Excel di atas — kalau field itu
     dikosongkan, sistem yang mengisi sendiri.
     --------------------------------------------------------------- */
  function ensureAddButton() {
    var exportBtn = document.getElementById("btnExportPeserta");
    if (!exportBtn || document.getElementById("btnTambahPeserta")) return false;
    var btn = document.createElement("button");
    btn.id = "btnTambahPeserta";
    btn.type = "button";
    btn.className = "px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl";
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px;margin-right:4px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Tambah Peserta';
    exportBtn.parentNode.insertBefore(btn, exportBtn);
    btn.addEventListener("click", openAddPesertaModal);
    return true;
  }

  var _editingPesertaId = null; // null = mode tambah baru; berisi id = mode edit

  function openAddPesertaModal() {
    _editingPesertaId = null;
    buildPesertaModal(null);
  }

  function openEditPesertaModal(id) {
    var td = window.trainingData;
    var p = td && Array.isArray(td.peserta) ? td.peserta.find(function (x) { return x.id === id; }) : null;
    if (!p) { "function" === typeof window.showToast && window.showToast("Data peserta tidak ditemukan", "error"); return; }
    _editingPesertaId = id;
    buildPesertaModal(p);
  }

  function buildPesertaModal(existing) {
    var isEdit = !!existing;
    var old = document.getElementById("_addPesertaModal");
    if (old) old.remove();

    var todayStr = new Date().toISOString().slice(0, 10);
    var v = existing || {};
    var modal = document.createElement("div");
    modal.id = "_addPesertaModal";
    modal.className = "modal-overlay";
    modal.style.cssText = "display:flex;z-index:9999;";
    modal.innerHTML = [
      '<div class="modal-box max-w-lg">',
      '<h3 class="text-lg font-bold mb-1">' + (isEdit ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>Edit Data Peserta' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="17" y1="11" x2="23" y2="11"/></svg>Tambah Peserta Manual') + "</h3>",
      '<p class="text-xs text-slate-500 mb-4">' + (isEdit
        ? "Perbarui data peserta. No Sertifikat tidak dapat diubah (sudah diterbitkan)."
        : "Untuk peserta yang training-nya sudah dilakukan (offline/data lama). No Sertifikat & Expired Date akan dibuat otomatis kalau dikosongkan.") + "</p>",
      '<div class="space-y-3 max-h-[65vh] overflow-y-auto pr-1">',
      '<div class="grid grid-cols-2 gap-3">',
      '<div><label class="block text-sm font-medium mb-1">Tanggal Training <span class="text-red-500">*</span></label><input type="date" id="_apTanggal" class="input" value="' + esc2(v.tanggal || todayStr) + '"></div>',
      '<div><label class="block text-sm font-medium mb-1">Jam Training <span class="text-red-500">*</span></label><input type="time" id="_apJam" class="input" value="' + esc2(v.jam || "09:00") + '"></div>',
      "</div>",
      '<div><label class="block text-sm font-medium mb-1">Airlines <span class="text-red-500">*</span></label><select id="_apAirlines" class="input"><option value="sriwijaya"' + ("nam" !== v.airlines ? " selected" : "") + '>Sriwijaya Air</option><option value="nam"' + ("nam" === v.airlines ? " selected" : "") + ">NAM Air</option></select></div>",
      '<div><label class="block text-sm font-medium mb-1">Nama <span class="text-red-500">*</span></label><input id="_apNama" class="input" placeholder="Nama lengkap peserta" value="' + esc2(v.nama || "") + '"></div>',
      '<div class="grid grid-cols-2 gap-3">',
      '<div><label class="block text-sm font-medium mb-1">Stasiun <span class="text-red-500">*</span></label><input id="_apStasiun" class="input" placeholder="mis. CGK" value="' + esc2(v.stasiun || "") + '"></div>',
      '<div><label class="block text-sm font-medium mb-1">Perusahaan <span class="text-red-500">*</span></label><input id="_apPerusahaan" class="input" placeholder="mis. PT Gapura Angkasa" value="' + esc2(v.perusahaan || "") + '"></div>',
      "</div>",
      '<div><label class="block text-sm font-medium mb-1">Jabatan <span class="text-red-500">*</span></label><input id="_apJabatan" class="input" placeholder="mis. Porter" value="' + esc2(v.jabatan || "") + '"></div>',
      '<div class="grid grid-cols-2 gap-3">',
      '<div><label class="block text-sm font-medium mb-1">No Handphone</label><input id="_apHp" class="input" value="' + esc2(v.hp || "") + '"></div>',
      '<div><label class="block text-sm font-medium mb-1">Email</label><input id="_apEmail" type="email" class="input" value="' + esc2(v.email || "") + '"></div>',
      "</div>",
      '<div class="grid grid-cols-2 gap-3">',
      '<div><label class="block text-sm font-medium mb-1">Skor</label><input id="_apSkor" type="number" min="0" class="input" value="' + (v.score != null ? v.score : 0) + '"></div>',
      '<div><label class="block text-sm font-medium mb-1">Skor Maksimal</label><input id="_apSkorMax" type="number" min="0" class="input" value="' + (v.maxScore != null ? v.maxScore : 100) + '"></div>',
      "</div>",
      isEdit
        ? '<div class="pt-2 border-t border-slate-200 dark:border-slate-700"><label class="block text-sm font-medium mb-1">No Sertifikat</label><input class="input bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed" value="' + esc2(v.certNo || "") + '" readonly></div>'
        : '<div class="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2"><span>🔒</span><span>No Sertifikat dibuat OTOMATIS oleh sistem saat disimpan (tidak bisa diisi manual) — memakai format & urutan yang sama dengan wizard Mulai Training.</span></div>',
      '<div><label class="block text-sm font-medium mb-1">Expired Date <span class="text-xs font-normal text-slate-400">(' + (isEdit ? "kosongkan untuk hitung ulang otomatis" : "opsional — kosongkan untuk otomatis 2 tahun dari Tanggal Training") + ')</span></label><input type="date" id="_apExpired" class="input" value="' + esc2(v.expiredDate || "") + '"></div>',
      "</div>",
      '<div class="flex gap-3 justify-end mt-5">',
      '<button id="_apCancel" type="button" class="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 font-medium rounded-xl text-sm">Batal</button>',
      '<button id="_apSave" type="button" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>' + (isEdit ? "Update" : "Simpan") + "</button>",
      "</div>",
      "</div>"
    ].join("");
    document.body.appendChild(modal);

    modal.addEventListener("click", function (e) { if (e.target === modal) { modal.remove(); _editingPesertaId = null; } });
    document.getElementById("_apCancel").addEventListener("click", function () { modal.remove(); _editingPesertaId = null; });
    document.getElementById("_apSave").addEventListener("click", handleSaveManualPeserta);
  }

  function esc2(s) {
    return window.esc ? window.esc(s) : String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function handleSaveManualPeserta() {
    var td = window.trainingData;
    if (!td || !Array.isArray(td.peserta)) { "function" === typeof window.showToast && window.showToast("Data training belum siap", "error"); return; }

    var required = {
      _apTanggal: "Tanggal Training", _apJam: "Jam Training", _apNama: "Nama",
      _apStasiun: "Stasiun", _apPerusahaan: "Perusahaan", _apJabatan: "Jabatan"
    };
    for (var id in required) {
      var el = document.getElementById(id);
      if (!el || !el.value.trim()) {
        "function" === typeof window.showToast && window.showToast("Mohon lengkapi: " + required[id], "error");
        if (el) el.focus();
        return;
      }
    }

    var emailVal = document.getElementById("_apEmail").value.trim();
    if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      "function" === typeof window.showToast && window.showToast("Format email tidak valid", "error");
      return;
    }

    var tanggal = document.getElementById("_apTanggal").value;
    var airlinesCode = document.getElementById("_apAirlines").value;
    var expiredInput = document.getElementById("_apExpired").value;
    var expiredDate = expiredInput || addYearsISO(tanggal, 2);

    if (_editingPesertaId) {
      // ── Mode EDIT: perbarui record yang sudah ada, certNo TIDAK diubah ──
      var idx = td.peserta.findIndex(function (p) { return p.id === _editingPesertaId; });
      if (idx === -1) {
        "function" === typeof window.showToast && window.showToast("Data peserta sudah tidak ada (mungkin terhapus)", "error");
        var m1 = document.getElementById("_addPesertaModal"); if (m1) m1.remove();
        _editingPesertaId = null;
        return;
      }
      var existingCertNo = td.peserta[idx].certNo; // dipertahankan, TIDAK di-generate ulang
      td.peserta[idx] = {
        id: _editingPesertaId,
        certNo: existingCertNo,
        airlines: airlinesCode,
        bankId: td.peserta[idx].bankId || "", bankName: td.peserta[idx].bankName || "",
        tanggal: tanggal,
        jam: document.getElementById("_apJam").value,
        nama: document.getElementById("_apNama").value.trim(),
        stasiun: document.getElementById("_apStasiun").value.trim(),
        perusahaan: document.getElementById("_apPerusahaan").value.trim(),
        jabatan: document.getElementById("_apJabatan").value.trim(),
        hp: document.getElementById("_apHp").value.trim(),
        email: emailVal,
        score: Number(document.getElementById("_apSkor").value) || 0,
        maxScore: Number(document.getElementById("_apSkorMax").value) || 0,
        createdAt: td.peserta[idx].createdAt || new Date().toISOString(),
        expiredDate: expiredDate
      };
      "function" === typeof window.saveTraining && window.saveTraining();
      "function" === typeof window.renderPeserta && window.renderPeserta();
      var m2 = document.getElementById("_addPesertaModal"); if (m2) m2.remove();
      "function" === typeof window.showToast && window.showToast("Data peserta \"" + td.peserta[idx].nama + "\" berhasil diperbarui", "success");
      _editingPesertaId = null;
      return;
    }

    // ── Mode TAMBAH BARU ──
    var certNo = makeCertNoGenerator(td.peserta)(airlinesCode, tanggal);
    var peserta = {
      id: genId(),
      certNo: certNo,
      airlines: airlinesCode,
      bankId: "", bankName: "",
      tanggal: tanggal,
      jam: document.getElementById("_apJam").value,
      nama: document.getElementById("_apNama").value.trim(),
      stasiun: document.getElementById("_apStasiun").value.trim(),
      perusahaan: document.getElementById("_apPerusahaan").value.trim(),
      jabatan: document.getElementById("_apJabatan").value.trim(),
      hp: document.getElementById("_apHp").value.trim(),
      email: emailVal,
      score: Number(document.getElementById("_apSkor").value) || 0,
      maxScore: Number(document.getElementById("_apSkorMax").value) || 0,
      createdAt: new Date().toISOString(),
      expiredDate: expiredDate
    };

    td.peserta.push(peserta);
    "function" === typeof window.saveTraining && window.saveTraining();
    "function" === typeof window.renderPeserta && window.renderPeserta();
    var modal = document.getElementById("_addPesertaModal");
    if (modal) modal.remove();
    "function" === typeof window.showToast && window.showToast("Peserta \"" + peserta.nama + "\" berhasil ditambahkan (" + certNo + ")", "success");
  }

  function ensureImportButton() {
    var exportBtn = document.getElementById("btnExportPeserta");
    if (!exportBtn || document.getElementById("btnImportPeserta")) return false;

    var label = document.createElement("label");
    label.id = "btnImportPesertaWrap";
    label.className = "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl cursor-pointer";
    label.innerHTML = '⬆️ Import Excel <input type="file" id="btnImportPeserta" accept=".xlsx,.xls" class="hidden">';
    exportBtn.parentNode.insertBefore(label, exportBtn.nextSibling);

    document.getElementById("btnImportPeserta").addEventListener("change", handleImportFile);
    return true;
  }

  function handleImportFile(e) {
    var file = e.target.files[0];
    if (!file) return;
    if (!window.XLSX) { "function" === typeof window.showToast && window.showToast("Library XLSX tidak tersedia", "error"); e.target.value = ""; return; }
    var td = window.trainingData;
    if (!td || !Array.isArray(td.peserta)) { "function" === typeof window.showToast && window.showToast("Data training belum siap", "error"); e.target.value = ""; return; }

    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var wb = XLSX.read(ev.target.result, { type: "array", cellDates: true });
        var ws = wb.Sheets[wb.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
        // raw:false supaya SheetJS berusaha memformat tanggal/jam sendiri kalau bisa;
        // fallback serial-mentah di atas tetap menjaga kalau ternyata masih lolos mentah.
        if (!rows.length) {
          "function" === typeof window.showToast && window.showToast("File Excel kosong atau format tidak sesuai", "error");
          return;
        }

        var existingCertNo = {};
        var existingNamaTglStasiun = {};
        td.peserta.forEach(function (p) {
          if (p.certNo) existingCertNo[p.certNo] = true;
          existingNamaTglStasiun[(p.nama || "").toLowerCase() + "|" + (p.tanggal || "") + "|" + (p.stasiun || "").toLowerCase() + "|" + (p.airlines || "")] = true;
        });
        var generateCertNo = makeCertNoGenerator(td.peserta);

        var added = 0, skippedDup = 0, skippedInvalid = 0, autoGenerated = 0;
        rows.forEach(function (row) {
          var nama = getValStr(row, ["Nama", "Name"]);
          if (!nama) { skippedInvalid++; return; }

          var tanggal = toISODateLoose(getVal(row, ["Tanggal Training", "Tanggal", "Date"]));
          var stasiun = getValStr(row, ["Stasiun", "Station"]);
          var airlinesCode = toAirlinesCode(getValStr(row, ["Airlines", "Maskapai"]));

          var certNoFromFile = getValStr(row, ["No Sertifikat", "Sertifikat", "Certificate No", "No Cert"]);
          var certNo, isAutoCertNo = false;
          if (certNoFromFile) {
            if (existingCertNo[certNoFromFile]) { skippedDup++; return; }
            certNo = certNoFromFile;
          } else {
            // [BUG DITEMUKAN & DIPERBAIKI] Kunci duplikat sebelumnya HANYA
            // Nama+Tanggal+Stasiun — TANPA Airlines. Akibatnya, kalau ada
            // 2 peserta (atau nama yang sama kebetulan) di stasiun & tanggal
            // yang sama tapi maskapai BERBEDA (mis. training gabungan
            // Sriwijaya Air & NAM Air pada acara yang sama), baris NAM Air
            // salah dianggap "sudah ada" (duplikat dari Sriwijaya Air yang
            // sudah ter-import lebih dulu) dan DITOLAK SELURUHNYA — persis
            // kasus 52 baris NAM Air yang semuanya tertolak. Sekarang
            // Airlines ikut jadi bagian kunci pengecekan duplikat.
            var dedupKey = nama.toLowerCase() + "|" + tanggal + "|" + stasiun.toLowerCase() + "|" + airlinesCode;
            if (existingNamaTglStasiun[dedupKey]) { skippedDup++; return; }
            existingNamaTglStasiun[dedupKey] = true;
            certNo = generateCertNo(airlinesCode, tanggal);
            isAutoCertNo = true;
          }

          var scoreVal = Number(getValStr(row, ["Skor", "Score"])) || 0;
          var maxScoreVal = Number(getValStr(row, ["Skor Maksimal", "Max Score", "Skor Max"])) || 0;
          var expiredDateFromFile = toISODateLoose(getVal(row, ["Expired Date", "Berlaku Hingga", "Kadaluarsa"]));
          var expiredDate = expiredDateFromFile || addYearsISO(tanggal || new Date().toISOString().slice(0, 10), 2);

          var peserta = {
            id: genId(),
            certNo: certNo,
            airlines: airlinesCode,
            bankId: "", bankName: "",
            tanggal: tanggal,
            jam: toHHMMLoose(getVal(row, ["Jam Training", "Jam", "Time"])),
            nama: nama,
            stasiun: stasiun,
            perusahaan: getValStr(row, ["Perusahaan", "Company"]),
            jabatan: getValStr(row, ["Jabatan", "Position"]),
            hp: getValStr(row, ["No Handphone", "No HP", "Handphone", "Phone"]),
            email: getValStr(row, ["Email", "E-mail"]),
            score: scoreVal,
            maxScore: maxScoreVal,
            createdAt: new Date().toISOString(),
            expiredDate: expiredDate
          };

          existingCertNo[certNo] = true; // cegah duplikat ANTAR baris dalam file yang sama juga
          if (isAutoCertNo) autoGenerated++;
          td.peserta.push(peserta);
          added++;
        });

        if (added > 0) {
          "function" === typeof window.saveTraining && window.saveTraining();
          "function" === typeof window.renderPeserta && window.renderPeserta();
        }

        var msg = added + " data peserta berhasil diimport" +
          (autoGenerated ? " (" + autoGenerated + " di antaranya dapat No Sertifikat otomatis, karena tidak ada di file)" : "") +
          (skippedDup ? ", " + skippedDup + " dilewati (sudah ada/duplikat)" : "") +
          (skippedInvalid ? ", " + skippedInvalid + " dilewati (Nama kosong)" : "");
        "function" === typeof window.showToast && window.showToast(msg, added ? "success" : "error");
      } catch (err) {
        "function" === typeof window.showToast && window.showToast("Gagal membaca file Excel: " + err.message, "error");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /* ---------------------------------------------------------------
     Hapus Beberapa (checkbox) — sisipkan kolom checkbox + tombol
     "Hapus Terpilih", tanpa mengubah renderPeserta() asli (training.js
     terminifikasi jadi satu baris — pola yang sama seperti file
     "-enhance" lain di project ini: amati tabel, sisipkan lewat DOM).
     --------------------------------------------------------------- */
  function ensureCheckboxHeader() {
    var headRow = document.querySelector("#pesertaTableBody")?.closest("table")?.querySelector("thead tr");
    if (!headRow || headRow.querySelector("[data-peserta-select-header]")) return;
    var th = document.createElement("th");
    th.setAttribute("data-peserta-select-header", "1");
    th.className = "px-2 py-2 whitespace-nowrap w-8";
    th.innerHTML = '<input type="checkbox" id="pesertaSelectAll" title="Pilih semua baris di halaman ini">';
    headRow.insertBefore(th, headRow.firstElementChild);

    if (!headRow._pesertaSelectAllBound) {
      headRow._pesertaSelectAllBound = true;
      headRow.addEventListener("change", function (e) {
        if (e.target.id !== "pesertaSelectAll") return;
        var checked = e.target.checked;
        document.querySelectorAll("#pesertaTableBody [data-peserta-row-select]").forEach(function (cb) { cb.checked = checked; });
        updatePesertaBulkCount();
      });
    }
  }

  function refreshPesertaCheckboxes() {
    var tbody = document.getElementById("pesertaTableBody");
    if (!tbody) return;
    ensureCheckboxHeader();
    Array.from(tbody.querySelectorAll("tr")).forEach(function (tr) {
      var delBtn = tr.querySelector("[data-peserta-del]");
      if (!delBtn) return; // baris kosong (placeholder "Belum ada data peserta")
      var pesertaId = delBtn.getAttribute("data-peserta-del");

      if (!tr.querySelector("[data-peserta-row-select]")) {
        var td = document.createElement("td");
        td.className = "px-2 py-2";
        td.innerHTML = '<input type="checkbox" data-peserta-row-select="' + pesertaId + '">';
        tr.insertBefore(td, tr.firstElementChild);
        td.querySelector("input").addEventListener("change", updatePesertaBulkCount);
      }

      if (!tr.querySelector("[data-peserta-edit]")) {
        var editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.setAttribute("data-peserta-edit", pesertaId);
        editBtn.className = "text-xs text-emerald-600 hover:underline mr-2";
        editBtn.textContent = "Edit";
        delBtn.parentNode.insertBefore(editBtn, delBtn);
      }
    });
  }

  function wirePesertaEditClick() {
    var tbody = document.getElementById("pesertaTableBody");
    if (!tbody || tbody._pesertaEditBound) return;
    tbody._pesertaEditBound = true;
    tbody.addEventListener("click", function (e) {
      var editBtn = e.target.closest("[data-peserta-edit]");
      if (editBtn) openEditPesertaModal(editBtn.getAttribute("data-peserta-edit"));
    });
  }

  function updatePesertaBulkCount() {
    var count = document.querySelectorAll("#pesertaTableBody [data-peserta-row-select]:checked").length;
    var countEl = document.getElementById("pesertaBulkCount");
    if (countEl) countEl.textContent = count > 0 ? count + " dipilih" : "";
    var btn = document.getElementById("btnPesertaDeleteSelected");
    if (btn) btn.disabled = count === 0;
  }

  function ensureBulkDeleteButton() {
    var clearBtn = document.getElementById("btnClearPeserta");
    if (!clearBtn || document.getElementById("btnPesertaDeleteSelected")) return false;
    var btn = document.createElement("button");
    btn.id = "btnPesertaDeleteSelected";
    btn.type = "button";
    btn.className = "px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl";
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Hapus Terpilih';
    btn.disabled = true;
    clearBtn.parentNode.insertBefore(btn, clearBtn);

    var countSpan = document.createElement("span");
    countSpan.id = "pesertaBulkCount";
    countSpan.className = "text-xs text-slate-400 self-center";
    clearBtn.parentNode.insertBefore(countSpan, clearBtn);

    btn.addEventListener("click", async function () {
      var ids = Array.from(document.querySelectorAll("#pesertaTableBody [data-peserta-row-select]:checked"))
        .map(function (cb) { return cb.getAttribute("data-peserta-row-select"); });
      if (!ids.length) return;
      var ok = "function" === typeof window.showConfirm
        ? await window.showConfirm("Hapus Data Peserta Terpilih", "Hapus " + ids.length + " data peserta yang dipilih? Sertifikat terkait tidak akan bisa dicetak ulang. Tindakan ini tidak bisa dibatalkan.")
        : window.confirm("Hapus " + ids.length + " data peserta terpilih?");
      if (!ok) return;

      var td = window.trainingData;
      if (!td || !Array.isArray(td.peserta)) return;
      var idSet = {};
      ids.forEach(function (id) { idSet[id] = true; });
      td.peserta = td.peserta.filter(function (p) { return !idSet[p.id]; });

      "function" === typeof window.saveTraining && window.saveTraining();
      "function" === typeof window.renderPeserta && window.renderPeserta();
      "function" === typeof window.markDeletedTombstone && window.markDeletedTombstone("peserta", ids);
      "function" === typeof window.showToast && window.showToast(ids.length + " data peserta terpilih berhasil dihapus", "success");
      updatePesertaBulkCount();
    });
    return true;
  }

  function observePesertaTable() {
    var tbody = document.getElementById("pesertaTableBody");
    if (!tbody || tbody._pesertaCheckboxObserved) return;
    tbody._pesertaCheckboxObserved = true;
    wirePesertaEditClick();
    new MutationObserver(function () { refreshPesertaCheckboxes(); updatePesertaBulkCount(); }).observe(tbody, { childList: true });
  }

  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    var importOk = ensureImportButton();
    var addOk = ensureAddButton();
    var bulkOk = ensureBulkDeleteButton();
    observePesertaTable();
    refreshPesertaCheckboxes();
    if ((importOk && addOk && bulkOk) || tries > 60) clearInterval(iv);
  }, 250);

  console.info("%c[SJNAM] Import Bank Data Peserta Training aktif.", "color:#0891b2;font-weight:bold;font-size:11px");
}();
