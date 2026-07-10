/* ================================================================
   SJNAM — SIMPAN & PULIHKAN FILTER STCR (TIDAK RESET SAAT REFRESH)
   ================================================================
   [BUG DITEMUKAN & DIPERBAIKI] Filter Dashboard STCR (Tahun, Bulan,
   AOC, Tipe Request, Stasiun) TIDAK PERNAH disimpan ke mana pun —
   setiap refresh halaman, semua filter otomatis kembali ke "Semua"
   karena memang belum ada mekanisme penyimpanannya sama sekali.

   File ini menyimpan pilihan filter ke localStorage setiap kali
   berubah, dan memulihkannya kembali saat halaman dibuka lagi.

   Kenapa dibuat file terpisah: stcr.js terminifikasi jadi satu
   baris. Dropdown Stasiun diisi ulang secara dinamis oleh stcr.js
   sendiri (rebuildStationOptions, dipanggil dari closure privat)
   — karena itu proses pemulihan nilai Stasiun dicoba berkali-kali
   (bukan cuma sekali di awal) sampai opsi station yang tersimpan
   benar-benar sudah tersedia di dropdown.
   ================================================================ */
!function () {
  "use strict";

  if (window._stcrFilterPersistInit) return;
  window._stcrFilterPersistInit = true;

  var LS_KEY = "sjnam_stcr_filters_v1";
  var FILTER_IDS = ["stcr-f-year", "stcr-f-month", "stcr-f-aoc", "stcr-f-req", "stcr-f-station"];

  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch (e) { return {}; }
  }
  function saveSaved(obj) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch (e) { /* abaikan kalau localStorage penuh/gagal */ }
  }

  function saveCurrentFilters() {
    var saved = {};
    FILTER_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) saved[id] = el.value;
    });
    saveSaved(saved);
  }

  function restoreFilters() {
    var saved = loadSaved();
    var restoredAny = false;
    FILTER_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || !saved[id]) return;
      if (el.disabled) return; // jangan timpa station yg dikunci (role User-STCR)
      var hasOption = Array.from(el.options).some(function (o) { return o.value === saved[id]; });
      if (hasOption && el.value !== saved[id]) { el.value = saved[id]; restoredAny = true; }
    });
    return restoredAny;
  }

  function bindChangeListeners() {
    FILTER_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el._stcrFilterPersistBound) return;
      el._stcrFilterPersistBound = true;
      el.addEventListener("change", saveCurrentFilters);
    });
  }

  // [BUG DITEMUKAN & DIPERBAIKI] Sebelumnya pemasangan listener &
  // pemulihan filter HANYA dilakukan di dalam setInterval — yang berarti
  // ada jeda ~250ms setelah halaman dimuat sebelum listener benar-benar
  // terpasang. Kalau user mengubah filter secepat itu, perubahannya bisa
  // terlewat tidak tersimpan. Sekarang dijalankan SEGERA sekali di awal
  // (synchronous), baru setelah itu interval hanya untuk menangani
  // dropdown Stasiun yang opsinya baru muncul belakangan.
  bindChangeListeners();
  if (restoreFilters() && window.STCR && typeof window.STCR.applyFilters === "function") {
    window.STCR.applyFilters();
  }

  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    bindChangeListeners();
    var restored = restoreFilters();
    if (restored && window.STCR && typeof window.STCR.applyFilters === "function") {
      window.STCR.applyFilters();
    }
    var yearEl = document.getElementById("stcr-f-year");
    if ((yearEl && yearEl.options.length > 1 && tries > 4) || tries > 40) clearInterval(iv);
  }, 250);

  console.info("%c[SJNAM] Filter STCR tersimpan otomatis (tidak reset saat refresh) aktif.", "color:#0891b2;font-weight:bold;font-size:11px");
}();
