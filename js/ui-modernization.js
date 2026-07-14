/* ================================================================
   SJNAM — UI MODERNIZATION (JS)
   ================================================================
   Sama seperti file enhancement lain di project ini (baggage-ux-
   enhance.js, station-active-status.js, dst): file terpisah, tidak
   menyentuh logic modul manapun, aman dihapus kapan saja (cukup
   hapus 1 baris <script> di index.html).

   Isi:
   1. Animasi "pop" halus saat angka KPI berubah (micro-interaction)
      — MutationObserver generik, tidak bergantung pada modul mana
      pun secara spesifik sehingga otomatis berlaku di semua tab
      (Dashboard, STCR, Executive Dashboard, dst).
   2. Warna default Chart.js otomatis menyesuaikan dark/light mode
      — hanya mengubah Chart.defaults (warna grid/label default),
      TIDAK menyentuh file chart per-modul manapun. Chart dengan
      warna eksplisit di dataset (mis. backgroundColor bar/pie)
      tetap seperti semula; yang berubah cuma warna teks & garis
      bantu yang sebelumnya kurang kontras di dark mode.
   ================================================================ */
!function () {
  "use strict";

  if (window._uiModernizationInit) return;
  window._uiModernizationInit = true;

  /* ---------- 1. KPI pop animation on value change ---------- */
  function isKpiValueEl(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.classList && el.classList.contains("stcr-kpi-value")) return true;
    if (el.id && /^kpi[A-Z]/.test(el.id)) return true;
    if (el.id && /^ciKpi/.test(el.id)) return true;
    if (el.id && /^exec/.test(el.id) && el.classList && el.classList.contains("font-bold")) return true;
    return false;
  }

  // [PERBAIKAN PERFORMA] Versi sebelumnya memasang SATU observer di
  // #mainContent (seluruh isi aplikasi, semua modul, semua tab) dengan
  // {subtree:true, characterData:true} — artinya callback ini terpanggil
  // untuk SETIAP perubahan teks di MANA PUN di seluruh aplikasi, terus-
  // menerus (jam yang update tiap detik, tabel yang re-render, dst).
  // Ini kemungkinan besar biang utama refresh/aplikasi jadi berat.
  //
  // Sekarang: alih-alih 1 observer besar yang mengawasi segalanya,
  // discan secara BERKALA (setiap 2 detik, jauh lebih jarang & murah
  // dibanding observer permanen) untuk menemukan elemen KPI yang ADA,
  // lalu pasang observer KECIL yang scope-nya cuma elemen itu sendiri
  // (bukan seluruh #mainContent). Elemen yang sudah diamati ditandai
  // supaya tidak dipasang observer dobel.
  function attachSmallObserver(el) {
    if (el._kpiPopObserved) return;
    el._kpiPopObserved = true;
    var observer = new MutationObserver(function () {
      el.classList.remove("kpi-value-updated");
      void el.offsetWidth; // reflow supaya animasi bisa retrigger walau class sama
      el.classList.add("kpi-value-updated");
    });
    // Scope observasi HANYA ke elemen KPI itu sendiri (subtree kecil,
    // biasanya cuma 1 text node) — bukan ke seluruh halaman.
    observer.observe(el, { childList: true, characterData: true, subtree: true });
  }

  function scanForKpiElements() {
    var main = document.getElementById("mainContent");
    if (!main) return;
    // Query spesifik (bukan menjelajah seluruh subtree secara manual),
    // jauh lebih murah daripada MutationObserver permanen.
    main.querySelectorAll('.stcr-kpi-value, [id^="kpi"], [id^="exec"].font-bold, [id^="ciKpi"]').forEach(function (el) {
      if (isKpiValueEl(el)) attachSmallObserver(el);
    });
  }

  function initKpiWatchers() {
    scanForKpiElements();
    // Scan ulang tiap 2 detik untuk menangkap elemen KPI baru yang baru
    // dirender (mis. buka tab lain) — jauh lebih murah daripada observer
    // permanen yang mengawasi SELURUH #mainContent setiap saat.
    setInterval(scanForKpiElements, 2000);
  }

  /* ---------- 2. Dark-mode-aware Chart.js defaults ---------- */
  function applyChartTheme() {
    if (typeof Chart === "undefined" || !Chart.defaults) return;
    var isDark = document.documentElement.classList.contains("dark");
    var textColor = isDark ? "rgba(226,232,240,0.85)" : "#334155";
    var gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = gridColor;
    if (Chart.defaults.plugins && Chart.defaults.plugins.legend && Chart.defaults.plugins.legend.labels) {
      Chart.defaults.plugins.legend.labels.color = textColor;
    }
    if (Chart.defaults.scale) {
      Chart.defaults.scale.grid = Chart.defaults.scale.grid || {};
      Chart.defaults.scale.grid.color = gridColor;
      Chart.defaults.scale.ticks = Chart.defaults.scale.ticks || {};
      Chart.defaults.scale.ticks.color = textColor;
    }

    // update chart yang SUDAH terlanjur dibuat sebelum toggle dark mode,
    // supaya tidak perlu ganti tab dulu baru kelihatan berubah.
    try {
      if (typeof Chart.instances === "object") {
        Object.keys(Chart.instances).forEach(function (key) {
          var inst = Chart.instances[key];
          if (inst && typeof inst.update === "function") {
            try { inst.update("none"); } catch (e) { /* chart mungkin sedang di-destroy, abaikan */ }
          }
        });
      }
    } catch (e) {
      console.warn("[ui-modernization] Gagal update tema chart existing:", e);
    }
  }

  function watchDarkModeToggle() {
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.attributeName === "class") applyChartTheme();
      });
    });
    observer.observe(document.documentElement, { attributes: true });
  }

  function init() {
    initKpiWatchers();
    applyChartTheme();
    watchDarkModeToggle();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  console.info(
    "%c[SJNAM] UI Modernization aktif (KPI pop animation + dark-mode chart colors).",
    "color:#7c3aed;font-weight:bold;font-size:11px"
  );
}();
