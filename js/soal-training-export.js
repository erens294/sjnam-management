/* ================================================================
   SJNAM — EXPORT SOAL TRAINING (Bank Soal)
   ================================================================
   Melengkapi tab "Bank Soal" di modul Service Training dengan
   tombol "Export Soal" — mengekspor soal yang SEDANG ADA di
   kategori aktif ke file Excel, dengan struktur kolom PERSIS sama
   dengan "Download Template Excel" & "Upload Soal (Excel)" yang
   sudah ada (No, Pertanyaan, Pilihan A-D, Kunci Jawaban, Skor) —
   supaya hasil export ini bisa langsung di-upload ulang (round-trip)
   kalau perlu diedit massal di Excel lalu dikembalikan.

   Kenapa dibuat file terpisah: training.js terminifikasi jadi satu
   baris. window.trainingData sudah di-expose (referensi langsung,
   bukan salinan) — cukup dipakai untuk membaca kategori/soal aktif,
   tidak perlu menebak variabel privat lain.
   ================================================================ */
!function () {
  "use strict";

  if (window._soalExportInit) return;
  window._soalExportInit = true;

  function getActiveBankSafe() {
    var td = window.trainingData;
    if (!td || !Array.isArray(td.banks) || !td.banks.length) return null;
    return td.banks.find(function (b) { return b.id === td.activeBankId; }) || td.banks[0];
  }

  function slugifyFilename(name) {
    return String(name || "Soal").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function exportSoal() {
    if (!window.XLSX) { "function" === typeof window.showToast && window.showToast("Library XLSX tidak tersedia", "error"); return; }
    var bank = getActiveBankSafe();
    if (!bank) { "function" === typeof window.showToast && window.showToast("Kategori soal tidak ditemukan", "error"); return; }
    if (!bank.questions || !bank.questions.length) {
      "function" === typeof window.showToast && window.showToast('Belum ada soal pada kategori "' + bank.name + '" untuk diexport', "error");
      return;
    }

    var rows = bank.questions.map(function (s, i) {
      var opts = s.options || {};
      return {
        No: i + 1,
        Pertanyaan: s.q || "",
        "Pilihan A": opts.A || "",
        "Pilihan B": opts.B || "",
        "Pilihan C": opts.C || "",
        "Pilihan D": opts.D || "",
        "Kunci Jawaban": s.answer || "",
        Skor: Number(s.score) || 0
      };
    });

    try {
      var ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch: 4 }, { wch: 40 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 14 }, { wch: 8 }];
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Soal Training");
      var todayStr = "function" === typeof window.todayLocalStr ? window.todayLocalStr() : new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, "Export_Soal_" + slugifyFilename(bank.name) + "_" + todayStr + ".xlsx");
      "function" === typeof window.showToast && window.showToast(rows.length + " soal dari kategori \"" + bank.name + "\" berhasil diexport", "success");
    } catch (err) {
      "function" === typeof window.showToast && window.showToast("Gagal membuat file export: " + err.message, "error");
    }
  }

  function ensureExportButton() {
    var templateBtn = document.getElementById("btnDownloadSoalTemplate");
    if (!templateBtn || document.getElementById("btnExportSoal")) return false;
    var btn = document.createElement("button");
    btn.id = "btnExportSoal";
    btn.type = "button";
    btn.className = "px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl";
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg>Export Soal';
    templateBtn.parentNode.insertBefore(btn, templateBtn.nextSibling);
    btn.addEventListener("click", exportSoal);
    return true;
  }

  function init() {
    return ensureExportButton();
  }

  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    if (init() || tries > 60) clearInterval(iv);
  }, 250);

  console.info("%c[SJNAM] Export Soal Training aktif.", "color:#0891b2;font-weight:bold;font-size:11px");
}();
