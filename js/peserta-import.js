/* ================================================================
   SJNAM — IMPORT & DEDUPLIKASI BANK DATA PESERTA (Excel)
   ================================================================
   Menambahkan kemampuan Download Template & Import Excel, PLUS
   deteksi & penandaan duplikat, khusus untuk "Bank Data Peserta"
   (tab Soal Training > Bank Data Peserta).

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

   DETEKSI DUPLIKAT — kenapa pakai MutationObserver (bukan wrap
   window.renderPeserta):
   Di training.js, listener pencarian & switch sub-tab memanggil
   closure lokal `renderPeserta` secara langsung (bukan lewat
   `window.renderPeserta`). Kalau kita cuma override
   `window.renderPeserta`, tanda duplikat tidak akan ikut muncul
   ulang saat user mengetik di kolom cari / pindah tab. Maka dari
   itu kita observe perubahan childList pada #pesertaTableBody
   langsung — persis pola yang sudah dipakai patch-arsitektur-v3.js
   untuk filter station SR — supaya tanda duplikat SELALU konsisten
   apa pun pemicu render-nya.
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

  // Menerima Date object (cellDates:true — Excel time-only cell terbaca
  // sebagai Date dengan tanggal dasar 1899-12-30), angka serial waktu Excel
  // (pecahan hari, mis. 0.375 = 09:00), atau string bebas ("09:00", "9:00:00",
  // "09.00", dsb) lalu mengembalikan HANYA "HH:MM", tanpa tanggal/zona waktu.
  function toHHMM(v) {
    if (v === null || v === undefined || v === "") return "";
    if (v instanceof Date && !isNaN(v.getTime())) {
      return pad2(v.getHours()) + ":" + pad2(v.getMinutes());
    }
    if (typeof v === "number") {
      var frac = v - Math.floor(v);
      var totalMinutes = Math.round(frac * 24 * 60);
      var hh = Math.floor(totalMinutes / 60) % 24;
      var mm = totalMinutes % 60;
      return pad2(hh) + ":" + pad2(mm);
    }
    var str = String(v).trim();
    var m = str.match(/(\d{1,2})[:.](\d{2})/);
    if (m) return pad2(Math.min(23, parseInt(m[1], 10))) + ":" + pad2(m[2]);
    return "";
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

        var added = 0, updated = 0, skipped = 0;
        var remainingSlots = 150 - trainingData.peserta.length;

        // [PATCH] Sebelumnya TIDAK ADA deteksi duplikat saat import sama
        // sekali — setiap baris valid selalu jadi peserta baru
        // (trainingData.peserta.push tanpa syarat). Deteksi duplikat yang
        // sudah ada di file ini sebelumnya HANYA penanda visual (highlight
        // kuning) SETELAH data masuk, tidak mencegah/menggantikan apa pun.
        // Sekarang: kunci sama dengan yang dipakai penanda visual
        // (dupKeyOf — Tanggal + Nama + Stasiun) dipakai juga di sini —
        // kalau cocok, data lama DIGANTIKAN (certNo/id/createdAt lama
        // dipertahankan supaya sertifikat yang sudah dicetak tidak
        // berubah nomor); kalau tidak cocok, jadi peserta BARU.
        var existingIndex = {};
        trainingData.peserta.forEach(function (p, idx) { existingIndex[dupKeyOf(p)] = idx; });
        console.log("[PesertaImport] Mulai — " + rows.length + " baris terbaca, " + trainingData.peserta.length + " peserta sudah ada.");

        rows.forEach(function (r) {
          var nama = String(getVal(r, ["Nama", "Nama Lengkap"])).trim();
          var airlines = normalizeAirlines(getVal(r, ["Airlines"]));
          var stasiun = String(getVal(r, ["Stasiun"])).trim();
          var perusahaan = String(getVal(r, ["Perusahaan"])).trim();
          var jabatan = String(getVal(r, ["Jabatan"])).trim();
          var hp = String(getVal(r, ["No Handphone", "No HP", "HP", "Handphone"])).trim();
          var email = String(getVal(r, ["Email"])).trim();
          var tanggal = toISODate(getVal(r, ["Tanggal Training", "Tanggal"])) || (window.todayLocalStr ? window.todayLocalStr() : "");
          var jam = toHHMM(getVal(r, ["Jam Training", "Jam"])) || "00:00";
          var score = Number(getVal(r, ["Skor", "Nilai", "Score"])) || 0;
          var maxScore = Number(getVal(r, ["Skor Maksimal", "Skor Maks", "Max Skor", "Nilai Maksimal", "Max Score"])) || 0;
          if (maxScore < score) maxScore = score;

          var emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

          if (!(nama && airlines && stasiun && perusahaan && jabatan && hp && email && emailValid && tanggal)) {
            skipped++;
            return;
          }

          var key = tanggal + "||" + nama.toLowerCase() + "||" + stasiun.toLowerCase();
          var isDup = Object.prototype.hasOwnProperty.call(existingIndex, key);

          if (isDup) {
            var oldP = trainingData.peserta[existingIndex[key]];
            var peserta = {
              id: oldP.id, certNo: oldP.certNo, // dipertahankan — bukan digenerate ulang
              airlines: airlines, bankId: oldP.bankId || "", bankName: "Import Excel",
              tanggal: tanggal, jam: jam, nama: nama, stasiun: stasiun, perusahaan: perusahaan,
              jabatan: jabatan, hp: hp, email: email, score: score, maxScore: maxScore,
              createdAt: oldP.createdAt || new Date().toISOString(),
              expiredDate: oldP.expiredDate || addYearsLocal(tanggal, 2)
            };
            trainingData.peserta[existingIndex[key]] = peserta;
            updated++;
            return;
          }

          if (added >= remainingSlots) { skipped++; return; } // batas 150 hanya berlaku utk peserta BARU, bukan update

          // No Sertifikat & Masa Berlaku SELALU dibuat otomatis oleh sistem
          // (tidak membaca kolom manual dari Excel) — konsisten dengan hasil
          // wizard "Mulai Training" dan mencegah nomor bentrok/format salah.
          var certNo = generateCertNo(airlines, tanggal, trainingData.peserta);
          var expiredDate = addYearsLocal(tanggal, 2);

          var pesertaBaru = {
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

          trainingData.peserta.push(pesertaBaru);
          existingIndex[key] = trainingData.peserta.length - 1;
          added++;
        });

        console.log("[PesertaImport] Selesai — ditambahkan=" + added + ", digantikan(update)=" + updated + ", dilewati=" + skipped + ".");
        if (added > 0 || updated > 0) {
          "function" === typeof window.saveTraining && window.saveTraining();
          "function" === typeof window.renderPeserta && window.renderPeserta();
        }

        var msg = added + " peserta baru ditambahkan" + (updated ? ", " + updated + " peserta diperbarui (menggantikan data yang sama)" : "") + (skipped ? (", " + skipped + " baris dilewati (data wajib belum lengkap / format salah / kuota penuh)") : "");
        window.showToast && window.showToast(msg, (added || updated) ? "success" : "error");
      } catch (err) {
        console.error("[peserta-import] Gagal memproses file:", err);
        window.showToast && window.showToast("Gagal membaca file Excel: " + err.message, "error");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // ================================================================
  // DETEKSI DUPLIKAT: Tanggal Training + Nama + Stasiun sama
  // ================================================================
  var _dupFilterActive = false;
  var _marking = false;

  function dupKeyOf(p) {
    return (String(p && p.tanggal || "").trim()) + "||" +
      (String(p && p.nama || "").trim().toLowerCase()) + "||" +
      (String(p && p.stasiun || "").trim().toLowerCase());
  }

  // Mengelompokkan seluruh peserta (bukan cuma yang sedang tampil/terfilter
  // pencarian) supaya duplikat tetap terdeteksi walau user sedang mencari.
  function buildDuplicateInfo() {
    var td = window.trainingData;
    var dupCertSet = new Set();
    var groupCount = 0;
    if (td && Array.isArray(td.peserta)) {
      var groups = {};
      td.peserta.forEach(function (p) {
        var k = dupKeyOf(p);
        // lewati kalau tanggal/nama/stasiun ada yang kosong — tidak relevan dibandingkan
        if (!p || !p.tanggal || !p.nama || !p.stasiun) return;
        (groups[k] = groups[k] || []).push(p);
      });
      Object.keys(groups).forEach(function (k) {
        if (groups[k].length > 1) {
          groupCount++;
          groups[k].forEach(function (p) { if (p.certNo) dupCertSet.add(p.certNo); });
        }
      });
    }
    return { dupCertSet: dupCertSet, dupCount: dupCertSet.size, groupCount: groupCount };
  }

  function updateDupSummary(info) {
    var el = document.getElementById("pesertaDupSummary");
    if (!el) return;
    if (info.dupCount > 0) {
      el.textContent = "⚠️ " + info.dupCount + " data berpotensi duplikat (" + info.groupCount + " grup — Tanggal+Nama+Stasiun sama)";
      el.classList.remove("hidden");
    } else {
      el.textContent = "";
      el.classList.add("hidden");
    }
  }

  // Menandai baris <tr> yang duplikat lewat class + title tooltip saja
  // (bukan menyisipkan elemen anak baru) supaya TIDAK memicu MutationObserver
  // childList lagi (mencegah infinite loop render).
  function markDuplicates() {
    if (_marking) return;
    _marking = true;
    try {
      var tbody = document.getElementById("pesertaTableBody");
      if (!tbody) return;
      var info = buildDuplicateInfo();
      var rows = tbody.querySelectorAll("tr");
      rows.forEach(function (tr) {
        var firstTd = tr.querySelector("td");
        if (!firstTd) return;
        var certNo = firstTd.textContent.trim();
        var isDup = !!certNo && info.dupCertSet.has(certNo);
        tr.classList.toggle("peserta-dup-row", isDup);
        tr.title = isDup ? "⚠️ Kemungkinan duplikat: Tanggal Training + Nama + Stasiun sama dengan data peserta lain" : "";
        if (_dupFilterActive) {
          tr.style.display = isDup ? "" : "none";
        } else if (tr.style.display === "none") {
          tr.style.display = "";
        }
      });
      updateDupSummary(info);
    } finally {
      _marking = false;
    }
  }

  function ensureDupStyle() {
    if (document.getElementById("pesertaDupStyle")) return;
    var style = document.createElement("style");
    style.id = "pesertaDupStyle";
    style.textContent =
      'tr.peserta-dup-row{background-color:rgba(245,158,11,0.12) !important;}' +
      'tr.peserta-dup-row td:nth-child(5){position:relative;}' +
      'tr.peserta-dup-row td:nth-child(5)::after{content:" \\1F501 Duplikat";color:#b45309;font-weight:700;font-size:10px;margin-left:6px;white-space:nowrap;}';
    document.head.appendChild(style);
  }

  function ensureDupUI() {
    ensureDupStyle();

    var totalWrap = document.getElementById("pesertaTotalCount") && document.getElementById("pesertaTotalCount").parentElement;
    if (totalWrap && !document.getElementById("pesertaDupSummary")) {
      var dupSpan = document.createElement("span");
      dupSpan.id = "pesertaDupSummary";
      dupSpan.className = "text-xs font-semibold text-amber-600 dark:text-amber-400 ml-3 hidden";
      if (totalWrap.parentNode) totalWrap.parentNode.insertBefore(dupSpan, totalWrap.nextSibling);
    }

    var searchInput = document.getElementById("pesertaSearch");
    if (searchInput && !document.getElementById("btnTogglePesertaDupFilter")) {
      var btn = document.createElement("button");
      btn.id = "btnTogglePesertaDupFilter";
      btn.type = "button";
      btn.className = "px-4 py-2 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-sm font-semibold rounded-xl";
      btn.textContent = "🔁 Tampilkan Hanya Duplikat";
      btn.addEventListener("click", function () {
        _dupFilterActive = !_dupFilterActive;
        btn.textContent = _dupFilterActive ? "✖️ Tampilkan Semua" : "🔁 Tampilkan Hanya Duplikat";
        btn.classList.toggle("bg-amber-500", _dupFilterActive);
        btn.classList.toggle("text-white", _dupFilterActive);
        btn.classList.toggle("hover:bg-amber-600", _dupFilterActive);
        markDuplicates();
      });
      searchInput.insertAdjacentElement("afterend", btn);
    }
  }

  function observePesertaTable() {
    var tbody = document.getElementById("pesertaTableBody");
    if (!tbody || tbody._dupObserved) return;
    tbody._dupObserved = true;
    var observer = new MutationObserver(function () { markDuplicates(); });
    observer.observe(tbody, { childList: true });
  }

  function initDuplicateDetection() {
    try {
      ensureDupUI();
      observePesertaTable();
      markDuplicates();
    } catch (err) {
      console.error("[peserta-import] Gagal inisialisasi deteksi duplikat:", err);
    }
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

  // ONE-TIME AUTO-FIX: memperbaiki data peserta yang sudah kadung ter-import
  // sebelum perbaikan ini ada, di mana kolom "jam" tersimpan sebagai string
  // Date lengkap (mis. "Sat Dec 30 1899 09:00:00 GMT+0707 (Western Indonesia
  // Time)") alih-alih "09:00". Berjalan otomatis sekali saat halaman dibuka,
  // aman dijalankan berkali-kali (tidak akan mengubah data yang sudah benar).
  function fixLegacyJamFormat() {
    try {
      var td = window.trainingData;
      if (!td || !Array.isArray(td.peserta) || !td.peserta.length) return;
      var fixed = 0;
      td.peserta.forEach(function (p) {
        var jamStr = p && p.jam;
        if (!jamStr) return;
        var looksBroken = /GMT|^[A-Za-z]{3}\s[A-Za-z]{3}\s\d{1,2}\s\d{4}/.test(String(jamStr));
        if (!looksBroken) return;
        var m = String(jamStr).match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
        if (m) {
          p.jam = pad2(m[1]) + ":" + m[2];
          fixed++;
        }
      });
      if (fixed > 0) {
        "function" === typeof window.saveTraining && window.saveTraining();
        "function" === typeof window.renderPeserta && window.renderPeserta();
        console.info("[peserta-import] Auto-fixed format Jam pada " + fixed + " data peserta lama.");
        window.showToast && window.showToast("Format Jam pada " + fixed + " data peserta lama diperbaiki otomatis ✅", "success");
      }
    } catch (err) {
      console.error("[peserta-import] Gagal auto-fix format Jam:", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      bind();
      fixLegacyJamFormat();
      initDuplicateDetection();
    }, { once: true });
  } else {
    bind();
    fixLegacyJamFormat();
    initDuplicateDetection();
  }

  console.info("%c[SJNAM] Import Bank Data Peserta (Excel) aktif — tombol Download Template & Import Data Peserta siap dipakai.", "color:#0891b2;font-weight:bold;font-size:11px");
}();
