/* ================================================================
   SJNAM — IMPORT BANK DATA PESERTA TRAINING
   ================================================================
   Melengkapi tab "Bank Data Peserta" di modul Service Training
   dengan tombol "Import Excel" — struktur kolom PERSIS sama dengan
   "Export Excel" yang sudah ada (No Sertifikat, Tanggal Training,
   Jam Training, Airlines, Nama, Stasiun, Perusahaan, Jabatan,
   No Handphone, Email, Skor, Skor Maksimal, Expired Date), supaya
   file hasil export bisa diedit di Excel lalu di-import balik
   (round-trip) — mis. untuk migrasi data dari sistem lama, atau
   input massal peserta training yang datanya sudah ada di Excel.

   Kenapa dibuat file terpisah: training.js terminifikasi jadi satu
   baris. window.trainingData & window.saveTraining sudah di-expose
   (referensi langsung) — dipakai untuk baca/tulis data peserta
   tanpa menebak variabel privat lain.

   Deduplikasi: berdasarkan "No Sertifikat" — kalau nomor sertifikat
   sudah ada di data yang tersimpan, baris itu dilewati (tidak
   ditimpa), supaya import berulang/tidak sengaja tidak menduplikasi
   atau menghapus histori.
   ================================================================ */
!function () {
  "use strict";

  if (window._pesertaImportInit) return;
  window._pesertaImportInit = true;

  function getVal(row, keys) {
    for (var i = 0; i < keys.length; i++) {
      for (var rk in row) {
        if (Object.prototype.hasOwnProperty.call(row, rk) && rk.trim().toLowerCase() === keys[i].toLowerCase()) {
          return String(row[rk] == null ? "" : row[rk]).trim();
        }
      }
    }
    return "";
  }

  function toAirlinesCode(v) {
    var s = (v || "").toLowerCase();
    if (s.indexOf("nam") !== -1) return "nam";
    if (s.indexOf("sriwijaya") !== -1 || s === "sj") return "sriwijaya";
    return s === "nam" || s === "sriwijaya" ? s : "sriwijaya"; // default aman kalau tidak dikenali
  }

  function toISODateLoose(v) {
    if (!v) return "";
    // Dukung format umum: "07 Jul 2026", "2026-07-07", serial Excel mentah, dll.
    var s = String(v).trim();
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
    var num = Number(s);
    if (!isNaN(num) && s !== "" && !/[a-zA-Z:\-\/]/.test(s) && num > 20000 && num < 80000) {
      // kemungkinan serial Excel mentah (lihat catatan di checkin-otp-dashboard.js
      // untuk kasus serupa — beberapa versi SheetJS mengembalikan angka mentah).
      var utcDays = Math.floor(num - 25569);
      var d = new Date(utcDays * 86400 * 1000);
      return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
    }
    var d2 = new Date(s);
    if (!isNaN(d2.getTime())) return d2.getFullYear() + "-" + String(d2.getMonth() + 1).padStart(2, "0") + "-" + String(d2.getDate()).padStart(2, "0");
    return s; // biarkan apa adanya kalau tidak bisa diparse — lebih baik daripada kosong
  }

  function genId() { return "pst_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

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
        var wb = XLSX.read(ev.target.result, { type: "array" });
        var ws = wb.Sheets[wb.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (!rows.length) {
          "function" === typeof window.showToast && window.showToast("File Excel kosong atau format tidak sesuai", "error");
          return;
        }

        var existingCertNo = {};
        td.peserta.forEach(function (p) { if (p.certNo) existingCertNo[p.certNo] = true; });

        var added = 0, skippedDup = 0, skippedInvalid = 0;
        rows.forEach(function (row) {
          var certNo = getVal(row, ["No Sertifikat", "Sertifikat", "Certificate No", "No Cert"]);
          var nama = getVal(row, ["Nama", "Name"]);
          if (!certNo || !nama) { skippedInvalid++; return; }
          if (existingCertNo[certNo]) { skippedDup++; return; }

          var scoreVal = Number(getVal(row, ["Skor", "Score"])) || 0;
          var maxScoreVal = Number(getVal(row, ["Skor Maksimal", "Max Score", "Skor Max"])) || 0;
          var tanggal = toISODateLoose(getVal(row, ["Tanggal Training", "Tanggal", "Date"]));
          var expiredDate = toISODateLoose(getVal(row, ["Expired Date", "Berlaku Hingga", "Kadaluarsa"]));

          var peserta = {
            id: genId(),
            certNo: certNo,
            airlines: toAirlinesCode(getVal(row, ["Airlines", "Maskapai"])),
            bankId: "", bankName: "",
            tanggal: tanggal,
            jam: getVal(row, ["Jam Training", "Jam", "Time"]),
            nama: nama,
            stasiun: getVal(row, ["Stasiun", "Station"]),
            perusahaan: getVal(row, ["Perusahaan", "Company"]),
            jabatan: getVal(row, ["Jabatan", "Position"]),
            hp: getVal(row, ["No Handphone", "No HP", "Handphone", "Phone"]),
            email: getVal(row, ["Email", "E-mail"]),
            score: scoreVal,
            maxScore: maxScoreVal,
            createdAt: new Date().toISOString(),
            expiredDate: expiredDate
          };

          existingCertNo[certNo] = true; // cegah duplikat ANTAR baris dalam file yang sama juga
          td.peserta.push(peserta);
          added++;
        });

        if (added > 0) {
          "function" === typeof window.saveTraining && window.saveTraining();
          "function" === typeof window.renderPeserta && window.renderPeserta();
        }

        var msg = added + " data peserta berhasil diimport" +
          (skippedDup ? ", " + skippedDup + " dilewati (No Sertifikat sudah ada)" : "") +
          (skippedInvalid ? ", " + skippedInvalid + " dilewati (No Sertifikat/Nama kosong)" : "");
        "function" === typeof window.showToast && window.showToast(msg, added ? "success" : "error");
      } catch (err) {
        "function" === typeof window.showToast && window.showToast("Gagal membaca file Excel: " + err.message, "error");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  }

  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    if (ensureImportButton() || tries > 60) clearInterval(iv);
  }, 250);

  console.info("%c[SJNAM] Import Bank Data Peserta Training aktif.", "color:#0891b2;font-weight:bold;font-size:11px");
}();
