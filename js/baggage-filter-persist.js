/* ================================================================
   SJNAM — SIMPAN & PULIHKAN FILTER BAGGAGE REPORT (TIDAK RESET SAAT REFRESH)
   ================================================================
   Sama seperti stcr-filter-persist.js — filter Entry (Station,
   Airlines, Jenis Kasus, Status, Tahun, Bulan) dan filter Dashboard
   (Station, Airlines, Tahun, Bulan) di Baggage Report disimpan ke
   localStorage setiap kali berubah, dan dipulihkan lagi saat halaman
   dibuka ulang.

   [PENTING] Baggage Report memakai TOGGLE (Entry/Dashboard) dalam
   SATU tab yang sama, BUKAN 2 tab terpisah seperti STCR — jadi
   selain restore nilai filter, script ini juga tidak perlu
   memanggil applyFilters manapun karena baggage-report.js sendiri
   sudah re-render otomatis begitu nilai filter di-set dan event
   "change" di-dispatch.
   ================================================================ */
!function () {
  "use strict";

  if (window._bgFilterPersistInit) return;
  window._bgFilterPersistInit = true;

  var LS_KEY = "sjnam_baggage_filters_v1";
  var FILTER_IDS = [
    "bg-f-station", "bg-f-aoc", "bg-f-case-type", "bg-f-case-status", "bg-f-year", "bg-f-month",
    "bg-d-station", "bg-d-aoc", "bg-d-year", "bg-d-month"
  ];

  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch (e) { return {}; }
  }
  function saveSaved(obj) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch (e) { /* abaikan */ }
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
      var hasOption = Array.from(el.options).some(function (o) { return o.value === saved[id]; });
      if (hasOption && el.value !== saved[id]) {
        el.value = saved[id];
        el.dispatchEvent(new Event("change")); // pemicu render ulang baggage-report.js
        restoredAny = true;
      }
    });
    return restoredAny;
  }
  function bindChangeListeners() {
    FILTER_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el._bgFilterPersistBound) return;
      el._bgFilterPersistBound = true;
      el.addEventListener("change", saveCurrentFilters);
    });
  }

  // Filter Station/Tahun diisi ulang secara dinamis oleh baggage-report.js
  // (opsinya baru muncul belakangan) — jadi pemulihan dicoba berkali-kali
  // sampai berhasil atau menyerah setelah beberapa saat.
  bindChangeListeners(); // pasang segera (jangan nunggu interval pertama)
  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    bindChangeListeners();
    restoreFilters();
    var stationEl = document.getElementById("bg-f-station");
    if ((stationEl && stationEl.options.length > 1 && tries > 4) || tries > 40) clearInterval(iv);
  }, 250);

  console.info("%c[SJNAM] Filter Baggage Report tersimpan otomatis (tidak reset saat refresh) aktif.", "color:#dc2626;font-weight:bold;font-size:11px");
}();
