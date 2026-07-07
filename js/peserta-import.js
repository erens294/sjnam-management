/* ================================================================
   SJNAM — IMPORT BANK DATA PESERTA (Excel)
   ================================================================
   Menambahkan kemampuan Download Template & Import Excel khusus
   untuk "Bank Data Peserta" (tab Soal Training > Bank Data Peserta).

   Kenapa dibuat file terpisah (bukan edit training.js langsung):
   training.js sudah terminifikasi jadi satu baris — mengedit
   langsung berisiko merusak IIFE yang ada. Sesuai pola file-file
   patch lain di project ini (blueprint-v1.js, patch-arsitektur-v3.js,
   bank-station-sync.js, dll), fitur baru ditambahkan lewat file
   terpisah yang jalan setelah training.js dimuat.

   Data peserta hasil import langsung digabung ke
   window.trainingData.peserta (struktur sama persis dengan peserta
   yang dibuat lewat wizard "Mulai Training"), sehingga otomatis
   muncul juga di Bank Station & bisa dicetak ulang sertifikatnya.
   ================================================================ */
!function () {
  "use strict";

  var TEMPLATE_COLS = [
    "Tanggal Training",
    "Jam Training",
    "Airlines",
    "Nama",
    "Stasiun",
    "Perusahaan",
    "Jabatan",
    "No Handphone",
    "Email",
    "Skor",
    "Skor Maksimal"
  ];

  function romanMonthOf(m) {
    var romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
    return romans[(Number(m) - 1 + 12) % 12] || "I";
  }

  function normalizeAirlines(v) {
    var s = String(v == null ? "" : v).trim().toLowerCase();
    if (!s) return "";
    if (s.indexOf("nam") !== -1) return "nam";
    if (s.indexOf("sriwijaya") !== -1 || s === "sj" || s.indexOf("cs-sj") !== -1) return "sriwijaya";
    return "";
  }

  function pad2(n) { return String(n).padStart(2, "0"); }

  // Menerima Date object (cellDates:true), serial number Excel, atau string
  // berformat umum (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY) lalu mengembalikan
  // string tanggal ISO (YYYY-MM-DD) atau "" jika gagal diparsing.
  function toISODate(v) {
    if (v === null || v === undefined || v === "") return "";
    if (v instanceof Date && !isNaN(v.getTime())) {
      return v.getFullYear() + "-" + pad2(v.getMonth() + 1) + "-" + pad2(v.getDate());
    }
    if (typeof v === "number") {
      var epoch = new Date(Date.UTC(1899, 11, 30));
      var d = new Date(epoch.getTime() + v * 86400000);
      if (!isNaN(d.getTime())) return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
      return "";
    }
    var str = String(v).trim();
    var m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + "-" + pad2(m[2]) + "-" + pad2(m[3]);
    m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m) return m[3] + "-" + pad2(m[2]) + "-" + pad2(m[1]);
    var parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return parsed.getFullYear() + "-" + pad2(parsed.getMonth() + 1) + "-" + pad2(parsed.getDate());
    return "";
  }

  function addYearsLocal(dateStr, years) {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return (d.getFullYear() + years) + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  // Format No Sertifikat sama persis dengan generator bawaan di training.js:
  // 00001/TRN/CS-SJ/VII/2026  (nomor urut per-airlines per-bulan per-tahun)
  function generateCertNo(airlines, tanggal, existingList) {
    var ref = tanggal ? new Date(tanggal) : new Date();
    var y = isNaN(ref.getTime()) ? new Date().getFullYear() : ref.getFullYear();
    var code = airlines === "nam" ? "CS-IN" : "CS-SJ";
    var m = isNaN(ref.getTime()) ? new Date().getMonth() + 1 : ref.getMonth() + 1;
    var romanMonth = romanMonthOf(m);
    var prefixPattern = new RegExp("^(\\d{5})/TRN/" + code + "/[IVX]+/" + y + "$");
    var maxSeq = 0;
    existingList.forEach(function (p) {
      var match = (p.certNo || "").match(prefixPattern);
      if (match) {
        var seq = parseInt(match[1], 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    });
    return String(maxSeq + 1).padStart(5, "0") + "/TRN/" + code + "/" + romanMonth + "/" + y;
  }

  function downloadTemplate() {
    var sample = [{
      "Tanggal Training": "2026-07-01",
      "Jam Training": "10:00",
      "Airlines": "Sriwijaya Air",
      "Nama": "Contoh Nama Peserta",
      "Stasiun": "CGK - Jakarta Soekarno-Hatta",
      "Perusahaan": "Sriwijaya Air",
      "Jabatan": "Check-In Staff",
      "No Handphone": "081234567890",
      "Email": "contoh@email.com",
      "Skor": 80,
      "Skor Maksimal": 100
    }];
    var ws = XLSX.utils.json_to_sheet(sample, { header: TEMPLATE_COLS });
    ws["!cols"] = [
      { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 25 },
      { wch: 28 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 22 },
      { wch: 8 }, { wch: 14 }
    ];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Peserta");
    XLSX.writeFile(wb, "Template_Bank_Data_Peserta_SJNAM.xlsx");
  }

  function getVal(row, keys) {
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var rowKeys = Object.keys(row);
      for (var j = 0; j < rowKeys.length; j++) {
        if (rowKeys[j].trim().toLowerCase() === k.toLowerCase()) return row[rowKeys[j]];
      }
    }
    return "";
  }

  function handleFile(file) {
    if (!file) return;
    if (window.currentUserReadOnly) {
      window.showToast && window.showToast("Akses ditolak (mode read-only)", "error");
      return;
    }
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var wb = XLSX.read(ev.target.result, { type: "array", cellDates: true });
        var ws = wb.Sheets[wb.SheetNames[0]];
        var rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (!rows.length) {
          window.showToast && window.showToast("File Excel kosong atau format tidak sesuai", "error");
          return;
        }
        var trainingData = window.trainingData;
        if (!trainingData || !Array.isArray(trainingData.peserta)) {
          window.showToast && window.showToast("Data training belum siap, coba lagi sebentar", "error");
          return;
        }

        var added = 0, skipped = 0;
        var remainingSlots = 150 - trainingData.peserta.length;

        rows.forEach(function (r) {
          if (added >= remainingSlots) { skipped++; return; }

          var nama = String(getVal(r, ["Nama", "Nama Lengkap"])).trim();
          var airlines = normalizeAirlines(getVal(r, ["Airlines"]));
          var stasiun = String(getVal(r, ["Stasiun"])).trim();
          var perusahaan = String(getVal(r, ["Perusahaan"])).trim();
          var jabatan = String(getVal(r, ["Jabatan"])).trim();
          var hp = String(getVal(r, ["No Handphone", "No HP", "HP", "Handphone"])).trim();
          var email = String(getVal(r, ["Email"])).trim();
          var tanggal = toISODate(getVal(r, ["Tanggal Training", "Tanggal"])) || (window.todayLocalStr ? window.todayLocalStr() : "");
          var jam = String(getVal(r, ["Jam Training", "Jam"])).trim() || "00:00";
          var score = Number(getVal(r, ["Skor", "Nilai", "Score"])) || 0;
          var maxScore = Number(getVal(r, ["Skor Maksimal", "Skor Maks", "Max Skor", "Nilai Maksimal", "Max Score"])) || 0;
          if (maxScore < score) maxScore = score;

          var emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

          if (!(nama && airlines && stasiun && perusahaan && jabatan && hp && email && emailValid && tanggal)) {
            skipped++;
            return;
          }

          // No Sertifikat & Masa Berlaku SELALU dibuat otomatis oleh sistem
          // (tidak membaca kolom manual dari Excel) — konsisten dengan hasil
          // wizard "Mulai Training" dan mencegah nomor bentrok/format salah.
          var certNo = generateCertNo(airlines, tanggal, trainingData.peserta);
          var expiredDate = addYearsLocal(tanggal, 2);

          var peserta = {
            id: Date.now().toString() + "-" + Math.floor(1e4 * Math.random()),
            certNo: certNo,
            airlines: airlines,
            bankId: "",
            bankName: "Import Excel",
            tanggal: tanggal,
            jam: jam,
            nama: nama,
            stasiun: stasiun,
            perusahaan: perusahaan,
            jabatan: jabatan,
            hp: hp,
            email: email,
            score: score,
            maxScore: maxScore,
            createdAt: new Date().toISOString(),
            expiredDate: expiredDate
          };

          trainingData.peserta.push(peserta);
          added++;
        });

        if (added > 0) {
          "function" === typeof window.saveTraining && window.saveTraining();
          "function" === typeof window.renderPeserta && window.renderPeserta();
        }

        var msg = added + " peserta berhasil diimpor" + (skipped ? (", " + skipped + " baris dilewati (data wajib belum lengkap / format salah)") : "");
        window.showToast && window.showToast(msg, added ? "success" : "error");
      } catch (err) {
        console.error("[peserta-import] Gagal memproses file:", err);
        window.showToast && window.showToast("Gagal membaca file Excel: " + err.message, "error");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function bind() {
    var btnTemplate = document.getElementById("btnDownloadPesertaTemplate");
    var inputImport = document.getElementById("inputImportPeserta");
    if (btnTemplate && !btnTemplate._pesertaImportBound) {
      btnTemplate._pesertaImportBound = true;
      btnTemplate.addEventListener("click", downloadTemplate);
    }
    if (inputImport && !inputImport._pesertaImportBound) {
      inputImport._pesertaImportBound = true;
      inputImport.addEventListener("change", function (e) {
        var file = e.target.files[0];
        handleFile(file);
        e.target.value = "";
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }

  console.info("%c[SJNAM] Import Bank Data Peserta (Excel) aktif — tombol Download Template & Import Data Peserta siap dipakai.", "color:#0891b2;font-weight:bold;font-size:11px");
}();
