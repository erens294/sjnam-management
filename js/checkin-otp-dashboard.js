/* ================================================================
   SJNAM — OTP CHECK-IN: FIELD STD, IMPORT DIPERKAYA, & DASHBOARD
   ================================================================
   Melengkapi modul Check-In Report (station-report.js) yang sudah
   ada — TIDAK mengubah file station-report.js sama sekali (mengikuti
   pola file "-enhance"/"-sync" lain di project ini: baca localStorage
   key yang sama secara langsung, karena getCiData()/saveCiData() di
   station-report.js bersifat closure privat & tidak di-expose).

   RUMUS OTP CHECK-IN — direplikasi PERSIS dari sheet Excel asli
   (sheet "Data", kolom AG "OTP Check-In" & AH "Confirm OTP Check-In"):
     AG = STD - Checkin Open Time
     AH = IF(AG < TIME(1,55,0), 0, 1)     →  1 = On Time, 0 = Tidak
   Catatan: formula ASLI tidak melakukan koreksi lintas-tengah-malam
   pada AG (kalau Checkin Open Time "lebih besar" dari STD secara
   angka jam clock-face, hasilnya negatif → otomatis dianggap "0/
   Tidak On Time"). Direplikasi apa adanya sesuai instruksi ("lihat
   rumusnya pada sheet") — bukan versi yang "diperbaiki" sepihak.

   Isi file ini:
   1. Field STD ditambahkan ke form input manual Check-In Report.
   2. Tombol Simpan manual: di-patch pasca-simpan (bukan menimpa
      logic simpan aslinya) supaya field STD & hasil OTP ikut
      tersimpan di record yang baru saja dibuat.
   3. Import Excel: diganti total (clone+replace, pola yang sama
      dipakai full-backup-restore.js) dengan versi yang JUGA
      membaca kolom STD, Arrival, ATD, AOC, Airlines, Baggage —
      supaya data yang di-import punya breakdown lebih kaya di
      Dashboard.
   4. Kolom "OTP" ditambahkan ke tabel Data Check-In Report.
   5. Sub-tab BARU "📊 Dashboard" di dalam tab Check-In Report,
      berisi KPI % OTP Check-In, breakdown per Station & per
      Airline, dan tren bulanan.
   6. Tombol baru "📋 Template Excel" — unduh file .xlsx kosong
      dengan kolom yang PERSIS sama seperti yang dibaca importer,
      plus 1 baris contoh.
   ================================================================ */
!function () {
  "use strict";

  if (window._checkinOtpDashboardInit) return;
  window._checkinOtpDashboardInit = true;

  var LS_CI = "sjnam_station_checkin_v1";

  /* ---------------------------------------------------------------
     0. Helper dasar — semua baca/tulis localStorage lewat sini,
        supaya sinkronisasi cloud (markDirty/triggerAutoSync) selalu
        ikut terpanggil persis seperti persist() asli di station-report.js.
     --------------------------------------------------------------- */
  function loadCi() {
    try { return JSON.parse(localStorage.getItem(LS_CI) || "[]"); } catch (e) { return []; }
  }
  function saveCi(list) {
    try { localStorage.setItem(LS_CI, JSON.stringify(list)); } catch (e) { console.warn("[checkin-otp] gagal simpan", e); }
    "function" === typeof window.markDirty && window.markDirty(LS_CI);
    "function" === typeof window.triggerAutoSync && window.triggerAutoSync(LS_CI);
  }
  function esc(s) {
    return window.esc ? window.esc(s) : String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function genId() { return "ci_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  /* ---------------------------------------------------------------
     1. Rumus OTP Check-In — replikasi persis formula Excel
     --------------------------------------------------------------- */
  function toMinutes(hhmm) {
    if (!hhmm || typeof hhmm !== "string" || hhmm.indexOf(":") === -1) return null;
    var p = hhmm.split(":");
    var h = parseInt(p[0], 10), m = parseInt(p[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  }
  // Mengembalikan {agMinutes, otp} atau null kalau data STD/open belum lengkap
  function computeOtp(std, open) {
    var stdMin = toMinutes(std), openMin = toMinutes(open);
    if (stdMin === null || openMin === null) return null;
    var ag = stdMin - openMin; // = AG (STD - Checkin Open Time), TANPA koreksi lintas tengah malam (sesuai sheet asli)
    var otp = ag < 115 ? 0 : 1; // 115 menit = TIME(1,55,0)
    return { agMinutes: ag, otp: otp };
  }

  /* ---------------------------------------------------------------
     2. Field STD di form input manual
     --------------------------------------------------------------- */
  function ensureStdField() {
    if (document.getElementById("srCiStd")) return true;
    var openField = document.getElementById("srCiOpen");
    if (!openField) return false;
    var openWrap = openField.closest("div");
    if (!openWrap || !openWrap.parentNode) return false;

    var wrap = document.createElement("div");
    wrap.innerHTML =
      '<label class="block text-sm font-medium mb-1">STD (Jadwal Berangkat)</label>' +
      '<input type="time" id="srCiStd" class="input">';
    openWrap.parentNode.insertBefore(wrap, openWrap);
    return true;
  }

  /* ---------------------------------------------------------------
     3. Simpan manual — patch pasca-simpan (tidak menimpa logic asli)
     --------------------------------------------------------------- */
  function wireManualSavePatch() {
    var btn = document.getElementById("btnSrCiSave");
    if (!btn || btn._otpPatchBound) return;
    btn._otpPatchBound = true;
    btn.addEventListener("click", function () {
      var stdEl = document.getElementById("srCiStd");
      var stdVal = stdEl ? stdEl.value : "";
      // setTimeout 0: menunggu handler simpan ASLI (yang terdaftar duluan
      // di station-report.js) selesai jalan dulu (keduanya synchronous,
      // jadi giliran berikutnya browser sudah pasti selesai memprosesnya)
      // sebelum kita baca localStorage & tempelkan STD + hasil OTP ke
      // record yang BARU SAJA dibuat (selalu di posisi PALING ATAS,
      // karena logic asli pakai list.unshift()).
      setTimeout(function () {
        if (!stdVal) return; // user tidak isi STD -> tidak ada yang perlu ditempel
        var list = loadCi();
        if (!list.length) return;
        var top = list[0];
        top.std = stdVal;
        var otpResult = computeOtp(stdVal, top.open);
        top.otp = otpResult ? otpResult.otp : null;
        saveCi(list);
        if (stdEl) stdEl.value = "";
        refreshOtpColumn();
        renderDashboardIfVisible();
      }, 0);
    });
  }

  /* ---------------------------------------------------------------
     4. Import Excel diperkaya — clone+replace (pola full-backup-restore.js)
     --------------------------------------------------------------- */
  // Konversi serial Excel (pecahan hari sejak 30 Des 1899) ke komponen
  // tanggal/jam — dipakai sebagai FALLBACK ketika sel dikembalikan sebagai
  // angka mentah oleh SheetJS (bukan Date object atau string terformat).
  // [BUG DITEMUKAN & DIPERBAIKI] Sebelumnya angka mentah seperti "46053"
  // jatuh ke `new Date(s)`, yang di JavaScript diinterpretasikan sebagai
  // TAHUN 46053 (bukan serial Excel) — persis menyebabkan tanggal tampil
  // sebagai "01-Jan-46053" di tabel.
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
  // Angka mentah dianggap serial Excel kalau: murni digit/desimal (tidak
  // mengandung ":" atau "-"), DAN nilainya masuk akal sebagai serial
  // tanggal (kira-kira tahun 1990-2100 -> serial ~32874-73050).
  function looksLikeExcelSerial(v) {
    var s = String(v).trim();
    if (!s || /[:\-\/]/.test(s)) return false;
    var n = Number(s);
    return !isNaN(n) && n >= 0;
  }
  function toISODate(v) {
    if (!v && v !== 0) return "";
    if (v instanceof Date && !isNaN(v.getTime())) return v.getFullYear() + "-" + String(v.getMonth() + 1).padStart(2, "0") + "-" + String(v.getDate()).padStart(2, "0");
    if (looksLikeExcelSerial(v) && Number(v) > 20000 && Number(v) < 80000) {
      var info = excelSerialToInfo(Number(v));
      if (info.year > 1990 && info.year < 2100) {
        return info.year + "-" + String(info.month).padStart(2, "0") + "-" + String(info.day).padStart(2, "0");
      }
    }
    var s = String(v).trim();
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
    var d = new Date(s);
    if (!isNaN(d.getTime())) return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    return "";
  }
  function toHHMM(v) {
    if (v === null || v === undefined || v === "") return "";
    if (v instanceof Date && !isNaN(v.getTime())) return String(v.getHours()).padStart(2, "0") + ":" + String(v.getMinutes()).padStart(2, "0");
    if (looksLikeExcelSerial(v)) {
      var n = Number(v);
      // Waktu-saja biasanya < 1 (pecahan hari). Kalau >= 1, kemungkinan
      // gabungan tanggal+waktu (mis. 46053.375) — ambil bagian jamnya saja.
      var info = excelSerialToInfo(n);
      if (n < 3 || n > 20000) return String(info.hours).padStart(2, "0") + ":" + String(info.minutes).padStart(2, "0");
    }
    var s = String(v).trim();
    var m = s.match(/(\d{1,2}):(\d{2})/);
    if (m) return String(Math.min(23, parseInt(m[1], 10))).padStart(2, "0") + ":" + m[2];
    return "";
  }
  function numOrZero(v) {
    var n = Number(String(v == null ? "" : v).replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? 0 : n;

  }

  function replaceImportHandler() {
    var oldInput = document.getElementById("srCiImportFile");
    if (!oldInput || oldInput._otpImportBound) return;
    var newInput = oldInput.cloneNode(true);
    newInput._otpImportBound = true;
    oldInput.parentNode.replaceChild(newInput, oldInput);

    newInput.addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (!file) return;
      if (!window.XLSX) { "function" === typeof window.showToast && window.showToast("Library XLSX tidak tersedia", "error"); e.target.value = ""; return; }
      var reader = new FileReader();
      reader.onload = function (ev) {
        var headerRowIdx = -1, headerRow = null, rows = null;
        var idxDate, idxFlight, idxDep, idxArr, idxStd, idxAtd, idxOpen, idxClose,
          idxTotalPOB, idxPOBA, idxPOBC, idxPOBI, idxBagKg, idxBagColli, idxAOC, idxAirline;

        try {
          var wb = XLSX.read(ev.target.result, { type: "array", cellDates: true });
          var ws = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

          for (var i = 0; i < rows.length; i++) {
            if (rows[i].some(function (c) { return String(c).trim().toLowerCase() === "date of flight"; })) {
              headerRowIdx = i; headerRow = rows[i]; break;
            }
          }
          if (headerRowIdx === -1) {
            "function" === typeof window.showToast && window.showToast("Format tidak dikenali — kolom 'Date of Flight' tidak ditemukan", "error");
            e.target.value = ""; return;
          }
          function colIdx(name) {
            for (var j = 0; j < headerRow.length; j++) {
              if (String(headerRow[j]).trim().toLowerCase() === name.toLowerCase()) return j;
            }
            return -1;
          }
          idxDate = colIdx("Date of Flight"); idxFlight = colIdx("Flight No"); idxDep = colIdx("Departure");
          idxArr = colIdx("Arrival"); idxStd = colIdx("STD"); idxAtd = colIdx("ATD");
          idxOpen = colIdx("Checkin Open Time"); idxClose = colIdx("Checkin Close Time");
          idxTotalPOB = colIdx("Total POB (A+C)"); idxPOBA = colIdx("POB (A)"); idxPOBC = colIdx("POB (C)"); idxPOBI = colIdx("POB (I)");
          idxBagKg = colIdx("Baggage Kilo"); idxBagColli = colIdx("Baggage Colli");
          idxAOC = colIdx("AOC"); idxAirline = colIdx("Airlines");

          if (idxDate === -1 || idxFlight === -1 || idxDep === -1) {
            "function" === typeof window.showToast && window.showToast("Kolom wajib tidak ditemukan (Date of Flight / Flight No / Departure)", "error");
            e.target.value = ""; return;
          }
        } catch (err) {
          "function" === typeof window.showToast && window.showToast("Gagal membaca file: " + err.message, "error");
          e.target.value = "";
          return;
        }

        // ── Eksekusi import (dipisah dari blok try di atas supaya bisa
        // dipanggil langsung ATAU setelah dialog konfirmasi async selesai,
        // dengan try/catch/finally sendiri) ──
        function doImportRows() {
          try {
            var list = loadCi();
            var existingKeys = {};
            list.forEach(function (r) { existingKeys[r.tanggal + "|" + r.station + "|" + r.flight + "|" + r.open] = true; });

            var added = 0, skipped = 0, withOtp = 0;
            for (var r = headerRowIdx + 1; r < rows.length; r++) {
              var row = rows[r];
              if (!row || !row.length) continue;
              var tanggal = toISODate(row[idxDate]);
              var flight = String(row[idxFlight] || "").trim().toUpperCase().replace(/[\s-]/g, "");
              var station = String(row[idxDep] || "").trim().toUpperCase();
              if (!tanggal || !flight || !station || station === "DEPARTURE") { skipped++; continue; }

              var open = idxOpen > -1 ? toHHMM(row[idxOpen]) : "";
              var close = idxClose > -1 ? toHHMM(row[idxClose]) : "";
              var std = idxStd > -1 ? toHHMM(row[idxStd]) : "";
              var atd = idxAtd > -1 ? toHHMM(row[idxAtd]) : "";
              var arr = idxArr > -1 ? String(row[idxArr] || "").trim().toUpperCase() : "";
              var aoc = idxAOC > -1 ? String(row[idxAOC] || "").trim().toUpperCase() : "";
              var airline = idxAirline > -1 ? String(row[idxAirline] || "").trim() : "";
              var bagKg = idxBagKg > -1 ? numOrZero(row[idxBagKg]) : 0;
              var bagColli = idxBagColli > -1 ? numOrZero(row[idxBagColli]) : 0;

              var pax = 0;
              if (idxTotalPOB > -1 && row[idxTotalPOB] !== "" && !isNaN(Number(row[idxTotalPOB]))) {
                pax = Number(row[idxTotalPOB]);
              } else {
                var a = idxPOBA > -1 ? numOrZero(row[idxPOBA]) : 0;
                var c = idxPOBC > -1 ? numOrZero(row[idxPOBC]) : 0;
                var inf = idxPOBI > -1 ? numOrZero(row[idxPOBI]) : 0;
                pax = a + c + inf;
              }

              var key = tanggal + "|" + station + "|" + flight + "|" + open;
              if (existingKeys[key]) { skipped++; continue; }
              existingKeys[key] = true;

              var otpResult = computeOtp(std, open);
              if (otpResult) withOtp++;

              list.push({
                id: genId(), tanggal: tanggal, station: station, flight: flight,
                open: open, close: close, pax: pax, note: "",
                std: std, atd: atd, arr: arr, aoc: aoc, airline: airline,
                bagKg: bagKg, bagColli: bagColli,
                otp: otpResult ? otpResult.otp : null,
                inputBy: (window.currentUser && (window.currentUser.name || window.currentUser.username)) || "Import Excel"
              });
              added++;
            }
            saveCi(list);
            refreshOtpColumn();
            renderDashboardIfVisible();
            var msg = added + " data Check-In Report berhasil diimport" +
              (withOtp ? " (" + withOtp + " di antaranya punya data STD, OTP Check-in otomatis terhitung)" : "") +
              (skipped ? (", " + skipped + " baris dilewati (duplikat/data tidak lengkap)") : "");
            "function" === typeof window.showToast && window.showToast(msg, added ? "success" : "error");
          } catch (err2) {
            "function" === typeof window.showToast && window.showToast("Gagal memproses data: " + err2.message, "error");
          } finally {
            e.target.value = "";
          }
        }

        // ── Jaring pengaman kuota localStorage ──
        // File laporan bulanan normal ~1000-2000 baris/bulan (~250-500KB).
        // Kalau file yang di-upload ternyata jauh lebih besar (mis. berisi
        // data bertahun-tahun, bukan cuma 1 bulan), import penuh bisa
        // memakan beberapa MB — localStorage dibagi rata dengan SEMUA
        // modul lain (data pasien STCR, karyawan, dst), jadi berisiko
        // bikin modul lain gagal simpan diam-diam kalau kuota habis.
        var candidateRowCount = 0;
        for (var ck = headerRowIdx + 1; ck < rows.length; ck++) {
          if (rows[ck] && rows[ck].length && String(rows[ck][idxFlight] || "").trim()) candidateRowCount++;
        }
        if (candidateRowCount > 3000) {
          var warnMsg = "File ini berisi " + candidateRowCount.toLocaleString("id-ID") + " baris data (jauh lebih banyak dari laporan 1 bulan biasa, ~1000-2000 baris). " +
            "Import sebesar ini bisa memakan beberapa MB di penyimpanan browser, yang dibagi rata dengan SEMUA data modul lain (pasien STCR, karyawan, dll) — berisiko membuat modul lain gagal menyimpan data kalau kuota penuh.\n\n" +
            "Lanjutkan import SEMUA baris ini?";
          if ("function" === typeof window.showConfirm) {
            window.showConfirm("Data Sangat Besar", warnMsg).then(function (ok) {
              if (ok) doImportRows(); else e.target.value = "";
            });
          } else if (window.confirm(warnMsg)) {
            doImportRows();
          } else {
            e.target.value = "";
          }
        } else {
          doImportRows();
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  /* ---------------------------------------------------------------
     5. Kolom OTP + Checkbox + tombol Edit di tabel Data Check-In Report
     --------------------------------------------------------------- */
  function otpBadgeHtml(rec) {
    if (rec.otp === 1) return '<span class="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">✅ On Time</span>';
    if (rec.otp === 0) return '<span class="badge bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">⚠️ Tidak OTP</span>';
    return '<span class="text-slate-400 text-xs">— (isi STD)</span>';
  }
  function ensureOtpHeader() {
    var headRow = document.querySelector('#tab-station-checkin table thead tr');
    if (!headRow) return;

    // Kolom checkbox (paling kiri)
    if (!headRow.querySelector('[data-select-header]')) {
      var thSel = document.createElement("th");
      thSel.setAttribute("data-select-header", "1");
      thSel.className = "p-3 font-semibold w-8";
      thSel.innerHTML = '<input type="checkbox" id="srCiSelectAll" title="Pilih semua baris di halaman ini">';
      headRow.insertBefore(thSel, headRow.firstElementChild);
    }

    // Kolom Baggage Kilo & Baggage Colli (sebelum OTP)
    if (!headRow.querySelector('[data-bag-header]')) {
      var actionThForBag = Array.from(headRow.children).find(function (th) { return /aksi/i.test(th.textContent); });
      var thKg = document.createElement("th");
      thKg.setAttribute("data-bag-header", "kg");
      thKg.className = "p-3 font-semibold text-right";
      thKg.textContent = "Bag (Kg)";
      var thColli = document.createElement("th");
      thColli.setAttribute("data-bag-header", "colli");
      thColli.className = "p-3 font-semibold text-right";
      thColli.textContent = "Bag (Colli)";
      if (actionThForBag) { headRow.insertBefore(thKg, actionThForBag); headRow.insertBefore(thColli, actionThForBag); }
      else { headRow.appendChild(thKg); headRow.appendChild(thColli); }
    }

    // Kolom OTP (sebelum Aksi)
    if (!headRow.querySelector('[data-otp-header]')) {
      var actionTh = Array.from(headRow.children).find(function (th) { return /aksi/i.test(th.textContent); });
      var th = document.createElement("th");
      th.setAttribute("data-otp-header", "1");
      th.className = "p-3 font-semibold";
      th.textContent = "OTP Check-In";
      if (actionTh) headRow.insertBefore(th, actionTh); else headRow.appendChild(th);
    }

    if (!headRow._selectAllBound) {
      headRow._selectAllBound = true;
      headRow.addEventListener("change", function (e) {
        if (e.target.id !== "srCiSelectAll") return;
        var checked = e.target.checked;
        // Hanya baris yang SEDANG TERLIHAT (halaman aktif) yang ikut ter-pilih —
        // supaya "pilih semua" tidak diam-diam memilih baris di halaman lain
        // yang sedang disembunyikan oleh paginasi.
        Array.from(document.querySelectorAll("#srCiTableBody [data-row-select]")).forEach(function (cb) {
          var tr = cb.closest("tr");
          if (tr && tr.style.display !== "none") cb.checked = checked;
        });
        updateBulkToolbarCount();
      });
    }
  }
  function refreshOtpColumn() {
    var tbody = document.getElementById("srCiTableBody");
    if (!tbody) return;
    ensureOtpHeader();
    var list = loadCi();
    var byId = {};
    list.forEach(function (r) { byId[r.id] = r; });
    Array.from(tbody.querySelectorAll("tr")).forEach(function (tr) {
      var delBtn = tr.querySelector("[data-sr-ci-del]");
      if (!delBtn) return; // baris "Belum ada data" placeholder
      var recId = delBtn.getAttribute("data-sr-ci-del");
      var rec = byId[recId];
      if (!rec) return;
      var actionTd = delBtn.closest("td");

      // ── Checkbox pilih baris ──
      if (!tr.querySelector("[data-row-select]")) {
        var tdSel = document.createElement("td");
        tdSel.className = "px-3 py-2";
        tdSel.innerHTML = '<input type="checkbox" data-row-select="' + esc(recId) + '">';
        tr.insertBefore(tdSel, tr.firstElementChild);
        tdSel.querySelector("input").addEventListener("change", updateBulkToolbarCount);
      }

      // ── Kolom Baggage Kilo & Colli ──
      var existingBagKgTd = tr.querySelector('[data-bag-cell="kg"]');
      var bagKgText = (rec.bagKg || rec.bagKg === 0) ? Number(rec.bagKg).toLocaleString("id-ID") : "-";
      var bagColliText = (rec.bagColli || rec.bagColli === 0) ? Number(rec.bagColli).toLocaleString("id-ID") : "-";
      if (existingBagKgTd) {
        existingBagKgTd.textContent = bagKgText;
        var existingBagColliTd = tr.querySelector('[data-bag-cell="colli"]');
        if (existingBagColliTd) existingBagColliTd.textContent = bagColliText;
      } else {
        var tdKg = document.createElement("td");
        tdKg.setAttribute("data-bag-cell", "kg");
        tdKg.className = "px-3 py-2 text-right text-xs";
        tdKg.textContent = bagKgText;
        var tdColli = document.createElement("td");
        tdColli.setAttribute("data-bag-cell", "colli");
        tdColli.className = "px-3 py-2 text-right text-xs";
        tdColli.textContent = bagColliText;
        if (actionTd) { tr.insertBefore(tdKg, actionTd); tr.insertBefore(tdColli, actionTd); }
        else { tr.appendChild(tdKg); tr.appendChild(tdColli); }
      }

      // ── Kolom OTP ──
      var existingOtpTd = tr.querySelector("[data-otp-cell]");
      if (existingOtpTd) { existingOtpTd.innerHTML = otpBadgeHtml(rec); }
      else {
        var td = document.createElement("td");
        td.setAttribute("data-otp-cell", "1");
        td.className = "px-3 py-2 text-xs whitespace-nowrap";
        td.innerHTML = otpBadgeHtml(rec);
        if (actionTd) tr.insertBefore(td, actionTd); else tr.appendChild(td);
      }

      // ── Tombol Edit (disisipkan SEBELUM tombol Hapus yang sudah ada) ──
      if (actionTd && !actionTd.querySelector("[data-ci-edit]")) {
        var editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.setAttribute("data-ci-edit", recId);
        editBtn.className = "text-blue-600 hover:underline text-xs mr-2";
        editBtn.textContent = "Edit";
        actionTd.insertBefore(editBtn, delBtn);
      }
    });

    applyPagination();
    refreshStorageBadge();
  }
  function observeCiTable() {
    var tbody = document.getElementById("srCiTableBody");
    if (!tbody || tbody._otpObserved) return;
    tbody._otpObserved = true;
    new MutationObserver(function () { refreshOtpColumn(); }).observe(tbody, { childList: true });

    tbody.addEventListener("click", function (e) {
      var editBtn = e.target.closest("[data-ci-edit]");
      if (editBtn) startEditRecord(editBtn.getAttribute("data-ci-edit"));
    });
  }

  /* ---------------------------------------------------------------
     5b. Mode Edit — isi ulang form, timpa record yang sama (bukan
         bikin record baru), tanpa mengubah logic simpan asli.
     --------------------------------------------------------------- */
  var _editingId = null;

  function startEditRecord(id) {
    var rec = loadCi().find(function (r) { return r.id === id; });
    if (!rec) return;
    _editingId = id;

    var dateEl = document.getElementById("srCiDate");
    var stationEl = document.getElementById("srCiStation");
    var flightEl = document.getElementById("srCiFlight");
    var openEl = document.getElementById("srCiOpen");
    var closeEl = document.getElementById("srCiClose");
    var paxEl = document.getElementById("srCiPax");
    var noteEl = document.getElementById("srCiNote");
    var stdEl = document.getElementById("srCiStd");
    if (dateEl) dateEl.value = rec.tanggal || "";
    if (stationEl) stationEl.value = rec.station || "";
    if (flightEl) flightEl.value = rec.flight || "";
    if (openEl) openEl.value = rec.open || "";
    if (closeEl) closeEl.value = rec.close || "";
    if (paxEl) paxEl.value = rec.pax || 0;
    if (noteEl) noteEl.value = rec.note || "";
    if (stdEl) stdEl.value = rec.std || "";

    setEditModeUI(true);
    dateEl && dateEl.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function setEditModeUI(on) {
    var saveBtn = document.getElementById("btnSrCiSave");
    if (!saveBtn) return;
    if (on) {
      saveBtn.textContent = "🔄 Update Data";
      saveBtn.classList.add("bg-amber-500", "hover:bg-amber-600");
      saveBtn.classList.remove("bg-blue-600", "hover:bg-blue-700");
      if (!document.getElementById("btnSrCiCancelEdit")) {
        var cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.id = "btnSrCiCancelEdit";
        cancelBtn.className = "px-5 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 font-medium rounded-xl text-sm mr-2";
        cancelBtn.textContent = "Batal Edit";
        saveBtn.parentNode.insertBefore(cancelBtn, saveBtn);
        cancelBtn.addEventListener("click", function () { cancelEdit(); });
      }
    } else {
      saveBtn.textContent = "💾 Simpan";
      saveBtn.classList.remove("bg-amber-500", "hover:bg-amber-600");
      saveBtn.classList.add("bg-blue-600", "hover:bg-blue-700");
      var cancelBtn2 = document.getElementById("btnSrCiCancelEdit");
      if (cancelBtn2) cancelBtn2.remove();
    }
  }

  function cancelEdit() {
    _editingId = null;
    setEditModeUI(false);
    ["srCiFlight", "srCiOpen", "srCiClose", "srCiPax", "srCiNote", "srCiStd"].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.value = "";
    });
  }

  function wireEditInterceptor() {
    var btn = document.getElementById("btnSrCiSave");
    if (!btn || btn._editInterceptBound) return;
    btn._editInterceptBound = true;
    // Capture phase supaya jalan SEBELUM handler simpan ASLI (bubble),
    // dan bisa membatalkan (stopImmediatePropagation) supaya tidak dobel
    // membuat record baru saat sedang mode edit.
    btn.addEventListener("click", function (e) {
      if (!_editingId) return; // mode tambah baru -> biarkan logic asli jalan seperti biasa
      e.stopImmediatePropagation();
      e.preventDefault();

      var date = document.getElementById("srCiDate")?.value;
      var station = document.getElementById("srCiStation")?.value;
      var flight = (document.getElementById("srCiFlight")?.value || "").trim().toUpperCase();
      if (!date || !station || !flight) {
        "function" === typeof window.showToast && window.showToast("Lengkapi: Tanggal, Station, Flight", "error");
        return;
      }
      var list = loadCi();
      var idx = list.findIndex(function (r) { return r.id === _editingId; });
      if (idx === -1) { cancelEdit(); return; }

      var open = document.getElementById("srCiOpen")?.value || "";
      var close = document.getElementById("srCiClose")?.value || "";
      var pax = parseInt(document.getElementById("srCiPax")?.value) || 0;
      var note = (document.getElementById("srCiNote")?.value || "").trim();
      var std = document.getElementById("srCiStd")?.value || "";

      list[idx].tanggal = date;
      list[idx].station = station;
      list[idx].flight = flight;
      list[idx].open = open;
      list[idx].close = close;
      list[idx].pax = pax;
      list[idx].note = note;
      list[idx].std = std;
      var otpResult = computeOtp(std, open);
      list[idx].otp = otpResult ? otpResult.otp : null;

      saveCi(list);
      cancelEdit();
      // renderCiTable() di station-report.js bersifat closure privat (tidak
      // di-expose ke window) — cara aman memicu re-render tabel adalah
      // dispatch event "input" pada kotak pencarian, karena listener
      // "input" ASLI-nya memanggil renderCiTable() secara internal.
      var searchEl = document.getElementById("srCiSearch");
      if (searchEl) searchEl.dispatchEvent(new Event("input", { bubbles: true }));
      refreshOtpColumn();
      renderDashboardIfVisible();
      "function" === typeof window.showToast && window.showToast("Data Check-In Report berhasil diperbarui", "success");
    }, true);
  }

  /* ---------------------------------------------------------------
     5c. Toolbar Hapus Massal — Terpilih / Semua / by Bulan / by Station
     --------------------------------------------------------------- */
  function updateBulkToolbarCount() {
    var count = document.querySelectorAll("#srCiTableBody [data-row-select]:checked").length;
    var el = document.getElementById("srCiBulkCount");
    if (el) el.textContent = count > 0 ? count + " dipilih" : "";
    var btnSel = document.getElementById("btnSrCiDeleteSelected");
    if (btnSel) btnSel.disabled = count === 0;
  }

  function ensureBulkToolbar() {
    if (document.getElementById("srCiBulkToolbar")) return;
    var searchEl = document.getElementById("srCiSearch");
    if (!searchEl) return;
    var searchRow = searchEl.closest("div.flex");
    if (!searchRow) return;

    var toolbar = document.createElement("div");
    toolbar.id = "srCiBulkToolbar";
    toolbar.className = "flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-slate-200 dark:border-slate-700";
    toolbar.innerHTML =
      '<button type="button" id="btnSrCiDeleteSelected" class="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg" disabled>🗑️ Hapus Terpilih</button>' +
      '<span id="srCiBulkCount" class="text-xs text-slate-400 mr-2"></span>' +
      '<span class="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1"></span>' +
      '<input type="month" id="srCiDeleteMonth" class="input !py-1.5 !text-xs !w-36">' +
      '<button type="button" id="btnSrCiDeleteByMonth" class="px-3 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 text-xs font-semibold rounded-lg">Hapus Bulan Ini</button>' +
      '<span class="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1"></span>' +
      '<select id="srCiDeleteStation" class="input !py-1.5 !text-xs !w-36"><option value="">-- Station --</option></select>' +
      '<button type="button" id="btnSrCiDeleteByStation" class="px-3 py-1.5 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 text-xs font-semibold rounded-lg">Hapus Station Ini</button>' +
      '<span class="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1"></span>' +
      '<button type="button" id="btnSrCiDeleteAll" class="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-lg ml-auto">🗑️ Hapus SEMUA Data</button>';
    searchRow.parentNode.insertBefore(toolbar, searchRow.nextSibling);

    populateDeleteStationSelect();

    document.getElementById("btnSrCiDeleteSelected").addEventListener("click", async function () {
      var ids = Array.from(document.querySelectorAll("#srCiTableBody [data-row-select]:checked")).map(function (cb) { return cb.getAttribute("data-row-select"); });
      if (!ids.length) return;
      var ok = "function" === typeof window.showConfirm
        ? await window.showConfirm("Hapus Data Terpilih", "Hapus " + ids.length + " data Check-In Report yang dipilih? Tindakan ini tidak bisa dibatalkan.")
        : window.confirm("Hapus " + ids.length + " data terpilih?");
      if (!ok) return;
      var idSet = {}; ids.forEach(function (id) { idSet[id] = true; });
      var list = loadCi().filter(function (r) { return !idSet[r.id]; });
      saveCi(list);
      afterBulkDelete(ids.length + " data terpilih berhasil dihapus");
    });

    document.getElementById("btnSrCiDeleteByMonth").addEventListener("click", async function () {
      var monthVal = document.getElementById("srCiDeleteMonth").value; // format: YYYY-MM
      if (!monthVal) { "function" === typeof window.showToast && window.showToast("Pilih bulan terlebih dahulu", "error"); return; }
      var list = loadCi();
      var toDelete = list.filter(function (r) { return (r.tanggal || "").slice(0, 7) === monthVal; });
      if (!toDelete.length) { "function" === typeof window.showToast && window.showToast("Tidak ada data pada bulan tsb", "error"); return; }
      var ok = "function" === typeof window.showConfirm
        ? await window.showConfirm("Hapus Data per Bulan", "Hapus " + toDelete.length + " data Check-In Report pada bulan " + monthVal + "? Tindakan ini tidak bisa dibatalkan.")
        : window.confirm("Hapus " + toDelete.length + " data pada bulan " + monthVal + "?");
      if (!ok) return;
      var remaining = list.filter(function (r) { return (r.tanggal || "").slice(0, 7) !== monthVal; });
      saveCi(remaining);
      afterBulkDelete(toDelete.length + " data bulan " + monthVal + " berhasil dihapus");
    });

    document.getElementById("btnSrCiDeleteByStation").addEventListener("click", async function () {
      var st = document.getElementById("srCiDeleteStation").value;
      if (!st) { "function" === typeof window.showToast && window.showToast("Pilih station terlebih dahulu", "error"); return; }
      var list = loadCi();
      var toDelete = list.filter(function (r) { return r.station === st; });
      if (!toDelete.length) { "function" === typeof window.showToast && window.showToast("Tidak ada data untuk station tsb", "error"); return; }
      var ok = "function" === typeof window.showConfirm
        ? await window.showConfirm("Hapus Data per Station", "Hapus " + toDelete.length + " data Check-In Report untuk station " + st + "? Tindakan ini tidak bisa dibatalkan.")
        : window.confirm("Hapus " + toDelete.length + " data station " + st + "?");
      if (!ok) return;
      var remaining = list.filter(function (r) { return r.station !== st; });
      saveCi(remaining);
      afterBulkDelete(toDelete.length + " data station " + st + " berhasil dihapus");
    });

    document.getElementById("btnSrCiDeleteAll").addEventListener("click", async function () {
      var total = loadCi().length;
      if (!total) { "function" === typeof window.showToast && window.showToast("Data sudah kosong", "error"); return; }
      var ok = "function" === typeof window.showConfirm
        ? await window.showConfirm("⚠️ Hapus SEMUA Data Check-In Report", "Ini akan menghapus SELURUH " + total + " data Check-In Report tanpa terkecuali. Tindakan ini TIDAK BISA DIBATALKAN. Lanjutkan?")
        : window.confirm("Hapus SEMUA " + total + " data? TIDAK BISA DIBATALKAN.");
      if (!ok) return;
      saveCi([]);
      afterBulkDelete("Semua data Check-In Report (" + total + ") berhasil dihapus");
    });
  }

  function populateDeleteStationSelect() {
    var sel = document.getElementById("srCiDeleteStation");
    if (!sel) return;
    var stations = Array.from(new Set(loadCi().map(function (r) { return r.station; }).filter(Boolean))).sort();
    var cur = sel.value;
    sel.innerHTML = '<option value="">-- Station --</option>' + stations.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + '</option>'; }).join("");
    if (stations.indexOf(cur) !== -1) sel.value = cur;
  }

  function afterBulkDelete(msg) {
    var searchEl = document.getElementById("srCiSearch");
    if (searchEl) searchEl.dispatchEvent(new Event("input", { bubbles: true }));
    refreshOtpColumn();
    populateDeleteStationSelect();
    renderDashboardIfVisible();
    updateBulkToolbarCount();
    "function" === typeof window.showToast && window.showToast(msg, "success");
  }

  /* ---------------------------------------------------------------
     6. Sub-tab Dashboard (Data | Dashboard) di dalam Check-In Report
     --------------------------------------------------------------- */

  function ensureDashboardTab() {
    var section = document.getElementById("tab-station-checkin");
    if (!section || document.getElementById("srCiSubtabBar")) return false;

    var firstCard = section.querySelector(".card");
    if (!firstCard) return false;

    // ── Bar sub-tab ──
    var bar = document.createElement("div");
    bar.id = "srCiSubtabBar";
    bar.className = "flex gap-2 mb-4";
    bar.innerHTML =
      '<button type="button" data-ci-subtab="data" class="ci-subtab-btn px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white">📄 Data</button>' +
      '<button type="button" data-ci-subtab="dashboard" class="ci-subtab-btn px-4 py-2 rounded-xl text-sm font-semibold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200">📊 Dashboard</button>';
    section.insertBefore(bar, firstCard);

    // ── Bungkus semua card yang SUDAH ADA ke dalam 1 wrapper "data view" ──
    var existingCards = Array.from(section.querySelectorAll(":scope > .card"));
    var dataWrap = document.createElement("div");
    dataWrap.id = "srCiDataView";
    section.insertBefore(dataWrap, firstCard);
    existingCards.forEach(function (c) { dataWrap.appendChild(c); });

    // ── Container dashboard (baru, HTML dibangun sepenuhnya di sini) ──
    var dashWrap = document.createElement("div");
    dashWrap.id = "srCiDashboardView";
    dashWrap.style.display = "none";
    dashWrap.innerHTML =
      '<div class="card p-4 mb-5">' +
      '<div class="flex flex-wrap items-end gap-3">' +
      '<div><label class="block text-xs font-medium mb-1 text-slate-500">Tahun</label><select id="ciFilterYear" class="input !py-1.5 !text-xs !w-28"><option value="">Semua</option></select></div>' +
      '<div><label class="block text-xs font-medium mb-1 text-slate-500">Bulan</label><select id="ciFilterMonth" class="input !py-1.5 !text-xs !w-32"><option value="">Semua</option></select></div>' +
      '<div><label class="block text-xs font-medium mb-1 text-slate-500">Station</label><select id="ciFilterStation" class="input !py-1.5 !text-xs !w-32"><option value="">Semua</option></select></div>' +
      '<div><label class="block text-xs font-medium mb-1 text-slate-500">Route</label><select id="ciFilterRoute" class="input !py-1.5 !text-xs !w-32"><option value="">Semua</option></select></div>' +
      '<div><label class="block text-xs font-medium mb-1 text-slate-500">Flight No</label><input id="ciFilterFlight" placeholder="mis. SJ588" class="input !py-1.5 !text-xs !w-32 uppercase"></div>' +
      '<button type="button" id="btnCiFilterReset" class="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-600 dark:text-slate-200 text-xs font-semibold rounded-lg">↺ Reset Filter</button>' +
      '<span id="ciFilterInfo" class="text-xs text-slate-400 ml-auto self-center"></span>' +
      '</div></div>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">' +
      '<div class="card p-4"><p class="text-xs text-slate-500 mb-1">OTP Check-In</p><p id="ciKpiOtpPct" class="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">-</p><p class="text-[11px] text-slate-400 mt-0.5">STD - Checkin Open ≥ 1j55m</p></div>' +
      '<div class="card p-4"><p class="text-xs text-slate-500 mb-1">Total Flight (data OTP)</p><p id="ciKpiTotalOtp" class="text-2xl font-extrabold">-</p></div>' +
      '<div class="card p-4"><p class="text-xs text-slate-500 mb-1">Total Flight Tercatat</p><p id="ciKpiTotalFlight" class="text-2xl font-extrabold">-</p></div>' +
      '<div class="card p-4"><p class="text-xs text-slate-500 mb-1">Rata-rata Buka Check-In</p><p id="ciKpiAvgWindow" class="text-2xl font-extrabold">-</p><p class="text-[11px] text-slate-400 mt-0.5">sebelum STD</p></div>' +
      '</div>' +
      '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">' +
      '<div class="card p-5"><h3 class="font-bold mb-3">📈 Tren OTP Check-In per Bulan</h3><canvas id="ciOtpTrendChart" height="200"></canvas></div>' +
      '<div class="card p-5"><h3 class="font-bold mb-3">🏢 OTP Check-In per Station</h3><p class="text-[11px] text-slate-400 mb-2">🟩 ≥75% &nbsp; 🟨 50-74% &nbsp; 🟥 &lt;50%</p><canvas id="ciOtpStationChart" height="200"></canvas></div>' +
      '</div>' +
      '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">' +
      '<div class="card p-5"><h3 class="font-bold mb-3">🧳 Tren Baggage per Bulan</h3><canvas id="ciBaggageTrendChart" height="200"></canvas></div>' +
      '<div class="card p-5"><h3 class="font-bold mb-3">🧳 Baggage per Station (Top 10)</h3><canvas id="ciBaggageStationChart" height="200"></canvas></div>' +
      '</div>' +
      '<div class="card p-5">' +
      '<div class="flex items-center justify-between mb-3"><h3 class="font-bold">✈️ Breakdown per Airlines</h3><span class="text-[11px] text-slate-400">klik baris untuk rincian per station</span></div>' +
      '<div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">' +
      '<table class="w-full text-sm"><thead class="bg-slate-50 dark:bg-slate-800"><tr class="text-left">' +
      '<th class="p-3 font-semibold">Airlines</th><th class="p-3 font-semibold text-right">Total Flight</th>' +
      '<th class="p-3 font-semibold text-right">On Time</th><th class="p-3 font-semibold text-right">% OTP</th>' +
      '</tr></thead><tbody id="ciOtpAirlineTableBody"></tbody></table></div></div>';
    section.insertBefore(dashWrap, dataWrap.nextSibling);

    wireDashboardFilters();

    bar.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-ci-subtab]");
      if (!btn) return;
      var target = btn.getAttribute("data-ci-subtab");
      Array.from(bar.querySelectorAll(".ci-subtab-btn")).forEach(function (b) {
        var active = b === btn;
        b.classList.toggle("bg-blue-600", active);
        b.classList.toggle("text-white", active);
        b.classList.toggle("bg-slate-200", !active);
        b.classList.toggle("dark:bg-slate-700", !active);
        b.classList.toggle("text-slate-600", !active);
        b.classList.toggle("dark:text-slate-200", !active);
      });
      dataWrap.style.display = target === "data" ? "" : "none";
      dashWrap.style.display = target === "dashboard" ? "" : "none";
      if (target === "dashboard") { populateDashboardFilterOptions(); renderDashboard(); }
    });

    return true;
  }

  /* ---------------------------------------------------------------
     6b. Filter Dashboard — Tahun / Bulan / Station / Route / Flight No
     --------------------------------------------------------------- */
  function routeOf(rec) {
    var dep = rec.station || "";
    var arr = rec.arr || "";
    return arr ? (dep + "-" + arr) : "";
  }

  function populateDashboardFilterOptions() {
    var list = loadCi();
    var yearSel = document.getElementById("ciFilterYear");
    var monthSel = document.getElementById("ciFilterMonth");
    var stationSel = document.getElementById("ciFilterStation");
    var routeSel = document.getElementById("ciFilterRoute");
    if (!yearSel) return;

    var years = Array.from(new Set(list.map(function (r) { return (r.tanggal || "").slice(0, 4); }).filter(Boolean))).sort().reverse();
    var curYear = yearSel.value;
    yearSel.innerHTML = '<option value="">Semua</option>' + years.map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join("");
    if (years.indexOf(curYear) !== -1) yearSel.value = curYear;

    var MONTH_NAMES = ["01 - Januari", "02 - Februari", "03 - Maret", "04 - April", "05 - Mei", "06 - Juni", "07 - Juli", "08 - Agustus", "09 - September", "10 - Oktober", "11 - November", "12 - Desember"];
    var curMonth = monthSel.value;
    monthSel.innerHTML = '<option value="">Semua</option>' + MONTH_NAMES.map(function (m, i) { return '<option value="' + String(i + 1).padStart(2, "0") + '">' + m + '</option>'; }).join("");
    monthSel.value = curMonth;

    var stations = Array.from(new Set(list.map(function (r) { return r.station; }).filter(Boolean))).sort();
    var curStation = stationSel.value;
    stationSel.innerHTML = '<option value="">Semua</option>' + stations.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + '</option>'; }).join("");
    if (stations.indexOf(curStation) !== -1) stationSel.value = curStation;

    var routes = Array.from(new Set(list.map(routeOf).filter(Boolean))).sort();
    var curRoute = routeSel.value;
    routeSel.innerHTML = '<option value="">Semua</option>' + routes.map(function (r) { return '<option value="' + esc(r) + '">' + esc(r) + '</option>'; }).join("");
    if (routes.indexOf(curRoute) !== -1) routeSel.value = curRoute;
  }

  function getDashboardFilters() {
    return {
      year: (document.getElementById("ciFilterYear") || {}).value || "",
      month: (document.getElementById("ciFilterMonth") || {}).value || "",
      station: (document.getElementById("ciFilterStation") || {}).value || "",
      route: (document.getElementById("ciFilterRoute") || {}).value || "",
      flight: ((document.getElementById("ciFilterFlight") || {}).value || "").trim().toUpperCase()
    };
  }

  function applyDashboardFilters(list) {
    var f = getDashboardFilters();
    if (!f.year && !f.month && !f.station && !f.route && !f.flight) return list;
    return list.filter(function (r) {
      if (f.year && (r.tanggal || "").slice(0, 4) !== f.year) return false;
      if (f.month && (r.tanggal || "").slice(5, 7) !== f.month) return false;
      if (f.station && r.station !== f.station) return false;
      if (f.route && routeOf(r) !== f.route) return false;
      if (f.flight && (r.flight || "").toUpperCase().indexOf(f.flight) === -1) return false;
      return true;
    });
  }

  function wireDashboardFilters() {
    ["ciFilterYear", "ciFilterMonth", "ciFilterStation", "ciFilterRoute"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("change", renderDashboard);
    });
    var flightEl = document.getElementById("ciFilterFlight");
    if (flightEl) flightEl.addEventListener("input", function () {
      clearTimeout(flightEl._debounce);
      flightEl._debounce = setTimeout(renderDashboard, 250);
    });
    var resetBtn = document.getElementById("btnCiFilterReset");
    if (resetBtn) resetBtn.addEventListener("click", function () {
      ["ciFilterYear", "ciFilterMonth", "ciFilterStation", "ciFilterRoute"].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ""; });
      var fEl = document.getElementById("ciFilterFlight"); if (fEl) fEl.value = "";
      renderDashboard();
    });
  }

  var _ciOtpTrendChart = null, _ciOtpStationChart = null, _ciBaggageTrendChart = null, _ciBaggageStationChart = null;
  function destroyChartSafe(existing) {
    try {
      var real = (typeof Chart !== "undefined" && Chart.getChart) ? Chart.getChart(existing && existing.canvas ? existing.canvas : existing) : null;
      if (real) real.destroy();
    } catch (e) { /* abaikan */ }
  }

  function otpColorFor(pct) {
    if (pct < 50) return "#DC2626";   // merah
    if (pct < 75) return "#F59E0B";   // kuning
    return "#10B981";                  // hijau
  }

  function renderDashboard() {
    if (typeof Chart === "undefined") return;
    var fullList = loadCi();
    var list = applyDashboardFilters(fullList);

    var infoEl = document.getElementById("ciFilterInfo");
    if (infoEl) {
      var f = getDashboardFilters();
      var activeFilters = [];
      if (f.year) activeFilters.push("Tahun " + f.year);
      if (f.month) activeFilters.push("Bulan " + f.month);
      if (f.station) activeFilters.push("Station " + f.station);
      if (f.route) activeFilters.push("Route " + f.route);
      if (f.flight) activeFilters.push("Flight " + f.flight);
      infoEl.textContent = activeFilters.length
        ? "Filter aktif: " + activeFilters.join(", ") + " — " + list.length + " dari " + fullList.length + " data"
        : list.length + " data";
    }

    var withStd = list.filter(function (r) { return r.otp === 0 || r.otp === 1; });

    var totalOtpYes = withStd.filter(function (r) { return r.otp === 1; }).length;
    var pct = withStd.length ? (totalOtpYes / withStd.length * 100) : 0;

    var elPct = document.getElementById("ciKpiOtpPct");
    if (elPct) elPct.textContent = withStd.length ? pct.toFixed(1) + "%" : "-";
    var elTotalOtp = document.getElementById("ciKpiTotalOtp");
    if (elTotalOtp) elTotalOtp.textContent = withStd.length;
    var elTotalFlight = document.getElementById("ciKpiTotalFlight");
    if (elTotalFlight) elTotalFlight.textContent = list.length;
    var elAvgWindow = document.getElementById("ciKpiAvgWindow");
    if (elAvgWindow) {
      var windows = withStd.map(function (r) {
        var stdMin = toMinutes(r.std), openMin = toMinutes(r.open);
        return stdMin !== null && openMin !== null ? stdMin - openMin : null;
      }).filter(function (v) { return v !== null; });
      if (windows.length) {
        var avgMin = windows.reduce(function (a, b) { return a + b; }, 0) / windows.length;
        var h = Math.floor(Math.abs(avgMin) / 60), m = Math.round(Math.abs(avgMin) % 60);
        elAvgWindow.textContent = (avgMin < 0 ? "-" : "") + h + "j " + m + "m";
      } else {
        elAvgWindow.textContent = "-";
      }
    }

    // ── Tren OTP per bulan ──
    var byMonth = {};
    withStd.forEach(function (r) {
      var key = (r.tanggal || "").slice(0, 7); // YYYY-MM
      if (!key) return;
      byMonth[key] = byMonth[key] || { total: 0, otp: 0 };
      byMonth[key].total++;
      if (r.otp === 1) byMonth[key].otp++;
    });
    var monthKeys = Object.keys(byMonth).sort();
    var trendCanvas = document.getElementById("ciOtpTrendChart");
    if (trendCanvas) {
      destroyChartSafe(_ciOtpTrendChart);
      _ciOtpTrendChart = new Chart(trendCanvas, {
        type: "line",
        data: {
          labels: monthKeys,
          datasets: [{
            label: "% OTP Check-In",
            data: monthKeys.map(function (k) { return byMonth[k].total ? +(byMonth[k].otp / byMonth[k].total * 100).toFixed(1) : 0; }),
            borderColor: "#0891b2", backgroundColor: "rgba(8,145,178,.12)",
            borderWidth: 2, pointRadius: 3, fill: true, tension: 0.3
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false }, datalabels: { display: true, font: { size: 9, weight: "bold" }, align: "top", formatter: function (v) { return v ? v + "%" : ""; } } },
          scales: { y: { min: 0, max: 100, ticks: { callback: function (v) { return v + "%"; } } } }
        }
      });
    }

    // ── OTP per station — WARNA KONDISIONAL: <50% merah, <75% kuning, >=75% hijau ──
    var byStation = {};
    withStd.forEach(function (r) {
      var st = r.station || "-";
      byStation[st] = byStation[st] || { total: 0, otp: 0 };
      byStation[st].total++;
      if (r.otp === 1) byStation[st].otp++;
    });
    var stationKeys = Object.keys(byStation).sort(function (a, b) { return byStation[b].total - byStation[a].total; }).slice(0, 10);
    var stationPct = stationKeys.map(function (k) { return byStation[k].total ? +(byStation[k].otp / byStation[k].total * 100).toFixed(1) : 0; });
    var stationCanvas = document.getElementById("ciOtpStationChart");
    if (stationCanvas) {
      destroyChartSafe(_ciOtpStationChart);
      _ciOtpStationChart = new Chart(stationCanvas, {
        type: "bar",
        data: {
          labels: stationKeys,
          datasets: [{
            label: "% OTP Check-In",
            data: stationPct,
            backgroundColor: stationPct.map(otpColorFor),
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: "y", responsive: true,
          plugins: { legend: { display: false }, datalabels: { display: true, color: "#fff", font: { size: 10, weight: "bold" }, anchor: "end", align: "start", formatter: function (v) { return v ? v + "%" : ""; } } },
          scales: { x: { min: 0, max: 100 } }
        }
      });
    }

    // ── Tren Baggage per bulan (Kilo & Colli) ──
    var bagByMonth = {};
    list.forEach(function (r) {
      var key = (r.tanggal || "").slice(0, 7);
      if (!key) return;
      bagByMonth[key] = bagByMonth[key] || { kg: 0, colli: 0 };
      bagByMonth[key].kg += Number(r.bagKg) || 0;
      bagByMonth[key].colli += Number(r.bagColli) || 0;
    });
    var bagMonthKeys = Object.keys(bagByMonth).sort();
    var bagTrendCanvas = document.getElementById("ciBaggageTrendChart");
    if (bagTrendCanvas) {
      destroyChartSafe(_ciBaggageTrendChart);
      _ciBaggageTrendChart = new Chart(bagTrendCanvas, {
        type: "bar",
        data: {
          labels: bagMonthKeys,
          datasets: [
            { label: "Baggage (Kg)", data: bagMonthKeys.map(function (k) { return bagByMonth[k].kg; }), backgroundColor: "#0891b2", borderRadius: 4, yAxisID: "y" },
            { label: "Baggage (Colli)", data: bagMonthKeys.map(function (k) { return bagByMonth[k].colli; }), type: "line", borderColor: "#F59E0B", backgroundColor: "rgba(245,158,11,.15)", borderWidth: 2, pointRadius: 3, yAxisID: "y1" }
          ]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: true, position: "top", labels: { boxWidth: 12, font: { size: 10 } } }, datalabels: { display: false } },
          scales: {
            y: { type: "linear", position: "left", title: { display: true, text: "Kg", font: { size: 9 } } },
            y1: { type: "linear", position: "right", title: { display: true, text: "Colli", font: { size: 9 } }, grid: { drawOnChartArea: false } }
          }
        }
      });
    }

    // ── Baggage per station (Top 10 by Kg) ──
    var bagByStation = {};
    list.forEach(function (r) {
      var st = r.station || "-";
      bagByStation[st] = bagByStation[st] || { kg: 0, colli: 0 };
      bagByStation[st].kg += Number(r.bagKg) || 0;
      bagByStation[st].colli += Number(r.bagColli) || 0;
    });
    var bagStationKeys = Object.keys(bagByStation).sort(function (a, b) { return bagByStation[b].kg - bagByStation[a].kg; }).slice(0, 10);
    var bagStationCanvas = document.getElementById("ciBaggageStationChart");
    if (bagStationCanvas) {
      destroyChartSafe(_ciBaggageStationChart);
      _ciBaggageStationChart = new Chart(bagStationCanvas, {
        type: "bar",
        data: {
          labels: bagStationKeys,
          datasets: [{ label: "Baggage (Kg)", data: bagStationKeys.map(function (k) { return bagByStation[k].kg; }), backgroundColor: "#0B1E3A", borderRadius: 4 }]
        },
        options: {
          indexAxis: "y", responsive: true,
          plugins: { legend: { display: false }, datalabels: { display: true, color: "#fff", font: { size: 9, weight: "bold" }, anchor: "end", align: "start", formatter: function (v) { return v ? v.toLocaleString("id-ID") + " kg" : ""; } } },
          scales: { x: { title: { display: true, text: "Kg", font: { size: 9 } } } }
        }
      });
    }

    // ── Breakdown per airlines (bisa di-expand untuk rincian per station) ──
    renderAirlineBreakdown(withStd);
  }

  var _expandedAirlines = {}; // { "Sriwijaya Air": true, ... } — persisten lintas re-render
  var _lastWithStd = [];

  function renderAirlineBreakdown(withStd) {
    _lastWithStd = withStd; // dipakai ulang saat toggle expand/collapse tanpa re-render dashboard penuh
    var byAirline = {};
    var byAirlineStation = {};
    withStd.forEach(function (r) {
      var al = r.airline || "(tidak diketahui)";
      var st = r.station || "-";
      byAirline[al] = byAirline[al] || { total: 0, otp: 0 };
      byAirline[al].total++;
      if (r.otp === 1) byAirline[al].otp++;

      byAirlineStation[al] = byAirlineStation[al] || {};
      byAirlineStation[al][st] = byAirlineStation[al][st] || { total: 0, otp: 0 };
      byAirlineStation[al][st].total++;
      if (r.otp === 1) byAirlineStation[al][st].otp++;
    });

    var tbody = document.getElementById("ciOtpAirlineTableBody");
    if (!tbody) return;
    var airlineKeys = Object.keys(byAirline).sort(function (a, b) { return byAirline[b].total - byAirline[a].total; });
    if (!airlineKeys.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-slate-400 text-sm">Belum ada data dengan STD terisi.</td></tr>';
      return;
    }

    tbody.innerHTML = airlineKeys.map(function (al) {
      var v = byAirline[al];
      var pctAl = v.total ? (v.otp / v.total * 100).toFixed(1) : "0.0";
      var isOpen = !!_expandedAirlines[al];
      var mainRow =
        '<tr class="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60" data-airline-toggle="' + esc(al) + '">' +
        '<td class="p-3"><span class="inline-block w-4 text-slate-400 transition-transform' + (isOpen ? " rotate-90" : "") + '">▸</span> ' + esc(al) + '</td>' +
        '<td class="p-3 text-right">' + v.total + '</td>' +
        '<td class="p-3 text-right">' + v.otp + '</td><td class="p-3 text-right font-semibold">' + pctAl + '%</td></tr>';

      if (!isOpen) return mainRow;

      var stationKeysForAl = Object.keys(byAirlineStation[al]).sort(function (a, b) { return byAirlineStation[al][b].total - byAirlineStation[al][a].total; });
      var detailRows = stationKeysForAl.map(function (st) {
        var sv = byAirlineStation[al][st];
        var pctSt = sv.total ? (sv.otp / sv.total * 100).toFixed(1) : "0.0";
        var badgeColor = +pctSt < 50 ? "text-red-600 dark:text-red-400" : +pctSt < 75 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";
        return '<tr class="bg-slate-50/60 dark:bg-slate-800/30 text-xs">' +
          '<td class="p-2 pl-9 text-slate-500">🏢 ' + esc(st) + '</td>' +
          '<td class="p-2 text-right text-slate-500">' + sv.total + '</td>' +
          '<td class="p-2 text-right text-slate-500">' + sv.otp + '</td>' +
          '<td class="p-2 text-right font-semibold ' + badgeColor + '">' + pctSt + '%</td></tr>';
      }).join("");

      return mainRow + detailRows;
    }).join("");

    if (!tbody._airlineToggleBound) {
      tbody._airlineToggleBound = true;
      tbody.addEventListener("click", function (e) {
        var row = e.target.closest("[data-airline-toggle]");
        if (!row) return;
        var al = row.getAttribute("data-airline-toggle");
        _expandedAirlines[al] = !_expandedAirlines[al];
        renderAirlineBreakdown(_lastWithStd); // cukup render ulang tabel ini saja, tidak perlu renderDashboard() penuh
      });
    }
  }

  function renderDashboardIfVisible() {
    var dashWrap = document.getElementById("srCiDashboardView");
    if (dashWrap && dashWrap.style.display !== "none") { populateDashboardFilterOptions(); renderDashboard(); }
  }

  /* ---------------------------------------------------------------
     7. Tombol Download Template Excel
     --------------------------------------------------------------- */
  function ensureTemplateButton() {
    var exportBtn = document.getElementById("btnSrCiExportExcel");
    if (!exportBtn || document.getElementById("btnSrCiTemplate")) return;
    var btn = document.createElement("button");
    btn.id = "btnSrCiTemplate";
    btn.className = "px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl";
    btn.textContent = "📋 Template Excel";
    exportBtn.parentNode.insertBefore(btn, exportBtn);
    btn.addEventListener("click", downloadTemplate);
  }

  function downloadTemplate() {
    if (!window.XLSX) { "function" === typeof window.showToast && window.showToast("Library XLSX tidak tersedia", "error"); return; }
    var headers = [
      "Date of Flight", "Flight No", "Departure", "Arrival", "STD", "ATD",
      "Checkin Open Time", "Checkin Close Time", "POB (A)", "POB (C)", "POB (I)",
      "Baggage Kilo", "Baggage Colli", "AOC", "Airlines"
    ];
    var example = {
      "Date of Flight": "2025-06-01", "Flight No": "SJ588", "Departure": "UPG", "Arrival": "TIM",
      "STD": "03:20", "ATD": "03:08", "Checkin Open Time": "00:00", "Checkin Close Time": "02:47",
      "POB (A)": 115, "POB (C)": 4, "POB (I)": 1, "Baggage Kilo": 154, "Baggage Colli": 16,
      "AOC": "SJ", "Airlines": "Sriwijaya Air"
    };
    var ws = XLSX.utils.json_to_sheet([example], { header: headers });
    ws["!cols"] = headers.map(function (h) { return { wch: Math.max(14, h.length + 2) }; });
    // Baris catatan singkat di bawah contoh, supaya yang mengisi tahu formatnya
    XLSX.utils.sheet_add_aoa(ws, [
      [],
      ["Petunjuk: hapus baris contoh di atas, isi 1 baris per penerbangan. Format jam: HH:MM (24 jam). Kolom Date of Flight: YYYY-MM-DD."]
    ], { origin: -1 });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, "Template_CheckIn_Report.xlsx");
    "function" === typeof window.showToast && window.showToast("Template Excel berhasil diunduh", "success");
  }

  /* ---------------------------------------------------------------
     8. Indikator Pemakaian Storage
     --------------------------------------------------------------- */
  function computeLocalStorageBytes() {
    var total = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        var v = localStorage.getItem(k) || "";
        total += k.length + v.length;
      }
    } catch (e) { /* abaikan */ }
    return total; // perkiraan bytes (1 char ~ 1-2 byte tergantung encoding, cukup akurat utk indikator kasar)
  }
  function computeCheckinBytes() {
    try { return (localStorage.getItem(LS_CI) || "").length; } catch (e) { return 0; }
  }
  function fmtBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  }

  function ensureStorageBadge() {
    var exportBtn = document.getElementById("btnSrCiExportExcel");
    if (!exportBtn || document.getElementById("srCiStorageBadge")) return;
    var badge = document.createElement("span");
    badge.id = "srCiStorageBadge";
    badge.className = "text-[11px] px-2.5 py-1.5 rounded-lg font-semibold self-center";
    badge.title = "Perkiraan pemakaian penyimpanan browser (localStorage) — dibagi rata dengan SEMUA modul aplikasi, bukan cuma Check-In Report";
    exportBtn.parentNode.insertBefore(badge, exportBtn);
    refreshStorageBadge();
  }

  function refreshStorageBadge() {
    var badge = document.getElementById("srCiStorageBadge");
    if (!badge) return;

    function render(usedBytes, quotaBytes, isEstimate) {
      var pct = quotaBytes ? (usedBytes / quotaBytes * 100) : null;
      var ciBytes = computeCheckinBytes();
      var colorClass = pct === null ? "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
        : pct < 60 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
        : pct < 85 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
      badge.className = "text-[11px] px-2.5 py-1.5 rounded-lg font-semibold self-center " + colorClass;
      var label = "💾 Check-In: " + fmtBytes(ciBytes);
      if (pct !== null) {
        label += " · Total browser: " + fmtBytes(usedBytes) + " / " + fmtBytes(quotaBytes) + " (" + pct.toFixed(0) + "%)";
      } else {
        label += " · Total localStorage: " + fmtBytes(usedBytes) + (isEstimate ? " (perkiraan, kuota browser tidak diketahui persis)" : "");
      }
      badge.textContent = label;
    }

    // navigator.storage.estimate() = API resmi browser modern (Chrome/Edge/
    // Firefox terbaru), memberi angka kuota+pemakaian ORIGIN yang sesungguhnya
    // (mencakup semua jenis storage, bukan cuma localStorage) — dipakai kalau
    // tersedia karena lebih akurat daripada menghitung manual.
    if (navigator.storage && typeof navigator.storage.estimate === "function") {
      navigator.storage.estimate().then(function (info) {
        render(info.usage || 0, info.quota || 0, false);
      }).catch(function () {
        render(computeLocalStorageBytes(), 0, true);
      });
    } else {
      render(computeLocalStorageBytes(), 0, true);
    }
  }

  /* ---------------------------------------------------------------
     9. Paginasi Tabel Data Check-In Report
     --------------------------------------------------------------- */
  var CI_PAGE_SIZE = 50;
  var _ciCurrentPage = 1;

  function applyPagination() {
    var tbody = document.getElementById("srCiTableBody");
    if (!tbody) return;
    var allRows = Array.from(tbody.querySelectorAll("tr")).filter(function (tr) { return tr.querySelector("[data-sr-ci-del]"); });
    var totalRows = allRows.length;
    var totalPages = Math.max(1, Math.ceil(totalRows / CI_PAGE_SIZE));
    if (_ciCurrentPage > totalPages) _ciCurrentPage = totalPages;
    if (_ciCurrentPage < 1) _ciCurrentPage = 1;

    var startIdx = (_ciCurrentPage - 1) * CI_PAGE_SIZE;
    var endIdx = startIdx + CI_PAGE_SIZE;
    allRows.forEach(function (tr, i) {
      tr.style.display = (i >= startIdx && i < endIdx) ? "" : "none";
    });

    renderPaginationControls(totalRows, totalPages);
  }

  function renderPaginationControls(totalRows, totalPages) {
    var tableWrap = document.getElementById("srCiTableBody").closest(".card");
    if (!tableWrap) return;
    var controls = document.getElementById("srCiPaginationBar");
    if (!controls) {
      controls = document.createElement("div");
      controls.id = "srCiPaginationBar";
      controls.className = "flex items-center justify-between gap-2 mt-3 text-xs";
      tableWrap.appendChild(controls);
    }
    var startShown = totalRows ? (_ciCurrentPage - 1) * CI_PAGE_SIZE + 1 : 0;
    var endShown = Math.min(_ciCurrentPage * CI_PAGE_SIZE, totalRows);
    controls.innerHTML =
      '<span class="text-slate-400">Menampilkan ' + startShown + '-' + endShown + ' dari ' + totalRows + ' data</span>' +
      '<div class="flex items-center gap-1">' +
      '<button type="button" id="btnCiPagePrev" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed font-medium" ' + (_ciCurrentPage <= 1 ? "disabled" : "") + '>‹ Sebelumnya</button>' +
      '<span class="px-2 text-slate-500">Halaman ' + _ciCurrentPage + ' / ' + totalPages + '</span>' +
      '<button type="button" id="btnCiPageNext" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed font-medium" ' + (_ciCurrentPage >= totalPages ? "disabled" : "") + '>Selanjutnya ›</button>' +
      '</div>';

    var prevBtn = document.getElementById("btnCiPagePrev");
    var nextBtn = document.getElementById("btnCiPageNext");
    if (prevBtn) prevBtn.onclick = function () { _ciCurrentPage--; applyPagination(); };
    if (nextBtn) nextBtn.onclick = function () { _ciCurrentPage++; applyPagination(); };
  }

  function resetPaginationOnFilterChange() {
    var searchEl = document.getElementById("srCiSearch");
    if (searchEl && !searchEl._ciPageResetBound) {
      searchEl._ciPageResetBound = true;
      searchEl.addEventListener("input", function () { _ciCurrentPage = 1; });
    }
  }

  /* ---------------------------------------------------------------
     10. Arsipkan Bulan Lama — export Excel LENGKAP (semua kolom,
         termasuk STD/ATD/Baggage/OTP) lalu hapus dari localStorage,
         dalam satu langkah.
     --------------------------------------------------------------- */
  function ensureArchiveButton() {
    var toolbar = document.getElementById("srCiBulkToolbar");
    if (!toolbar || document.getElementById("btnSrCiArchive")) return;
    var wrap = document.createElement("div");
    wrap.className = "flex items-center gap-2";
    wrap.innerHTML =
      '<input type="month" id="srCiArchiveBeforeMonth" class="input !py-1.5 !text-xs !w-36" title="Arsipkan semua data SEBELUM bulan ini">' +
      '<button type="button" id="btnSrCiArchive" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg">🗄️ Arsipkan Sebelum Bulan Ini</button>';
    // taruh sebelum tombol "Hapus SEMUA" (paling kanan) supaya tidak tercampur aksi hapus destruktif
    var deleteAllBtn = document.getElementById("btnSrCiDeleteAll");
    if (deleteAllBtn) toolbar.insertBefore(wrap, deleteAllBtn); else toolbar.appendChild(wrap);

    document.getElementById("btnSrCiArchive").addEventListener("click", async function () {
      var cutoff = document.getElementById("srCiArchiveBeforeMonth").value; // format YYYY-MM
      if (!cutoff) { "function" === typeof window.showToast && window.showToast("Pilih bulan batas arsip terlebih dahulu", "error"); return; }
      var list = loadCi();
      var toArchive = list.filter(function (r) { return (r.tanggal || "").slice(0, 7) < cutoff; });
      if (!toArchive.length) { "function" === typeof window.showToast && window.showToast("Tidak ada data sebelum bulan " + cutoff + " yang perlu diarsipkan", "error"); return; }

      var ok = "function" === typeof window.showConfirm
        ? await window.showConfirm("Arsipkan Data Lama", "Ekspor " + toArchive.length + " data (sebelum bulan " + cutoff + ") ke file Excel, LALU hapus dari penyimpanan browser untuk membebaskan ruang. File Excel akan otomatis terunduh — pastikan disimpan baik-baik sebagai cadangan. Lanjutkan?")
        : window.confirm("Arsipkan " + toArchive.length + " data sebelum " + cutoff + "? File Excel akan diunduh lalu data ini dihapus dari browser.");
      if (!ok) return;

      if (!window.XLSX) { "function" === typeof window.showToast && window.showToast("Library XLSX tidak tersedia — arsip dibatalkan (data TIDAK dihapus)", "error"); return; }

      try {
        var exportRows = toArchive.map(function (r, i) {
          return {
            No: i + 1, Tanggal: r.tanggal, Station: r.station, Flight: r.flight,
            STD: r.std || "", ATD: r.atd || "", Arrival: r.arr || "",
            "Checkin Open": r.open || "", "Checkin Close": r.close || "",
            Pax: r.pax || 0, "Baggage Kilo": r.bagKg || 0, "Baggage Colli": r.bagColli || 0,
            AOC: r.aoc || "", Airlines: r.airline || "",
            "OTP Check-In": r.otp === 1 ? "On Time" : r.otp === 0 ? "Tidak On Time" : "-",
            Catatan: r.note || ""
          };
        });
        var ws = XLSX.utils.json_to_sheet(exportRows);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Arsip Check-In");
        XLSX.writeFile(wb, "Arsip_CheckIn_sebelum_" + cutoff + ".xlsx");
      } catch (err) {
        "function" === typeof window.showToast && window.showToast("Gagal membuat file arsip — data TIDAK dihapus: " + err.message, "error");
        return;
      }

      // Baru hapus dari localStorage SETELAH file Excel berhasil dibuat —
      // supaya kalau export gagal di tengah jalan, data asli tetap utuh.
      var remaining = list.filter(function (r) { return (r.tanggal || "").slice(0, 7) >= cutoff; });
      saveCi(remaining);
      afterBulkDelete(toArchive.length + " data berhasil diarsipkan ke Excel & dihapus dari penyimpanan browser");
      refreshStorageBadge();
    });
  }

  /* ---------------------------------------------------------------
     11. Init
     --------------------------------------------------------------- */
  function init() {
    var stdOk = ensureStdField();
    wireManualSavePatch();
    wireEditInterceptor();
    replaceImportHandler();
    ensureOtpHeader();
    observeCiTable();
    refreshOtpColumn();
    ensureTemplateButton();
    ensureBulkToolbar();
    ensureArchiveButton();
    ensureStorageBadge();
    resetPaginationOnFilterChange();
    var dashOk = ensureDashboardTab();
    return stdOk && dashOk;
  }

  document.addEventListener("sjn:tab-changed", function (e) {
    var tab = e && e.detail && e.detail.tab;
    if (tab === "station-checkin") setTimeout(init, 80);
  });

  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    if (init() || tries > 60) clearInterval(iv);
  }, 250);

  console.info("%c[SJNAM] OTP Check-In (field STD, import diperkaya, dashboard) aktif.", "color:#0891b2;font-weight:bold;font-size:11px");
}();
