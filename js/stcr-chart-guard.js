/* ================================================================
   SJNAM — GUARD GLOBAL ANTI-TABRAKAN CANVAS CHART.JS
   ================================================================
   [BUG DITEMUKAN & DIPERBAIKI] Versi sebelumnya membungkus
   window.STCR.applyFilters / resetFilters / onShowDashboard lewat
   setInterval (polling). TERNYATA TIDAK CUKUP: ada script lain di
   halaman ini (patch-arsitektur-v3.js, blueprint-v1.js) yang JUGA
   membungkus/menimpa fungsi-fungsi window.STCR tersebut secara
   SINKRON saat load — sehingga siapa yang "menang" jadi lapisan
   terluar tergantung urutan timing, dan pembungkus kita bisa
   terlewat sepenuhnya dari rantai pemanggilan. Akibatnya stcr.js
   tetap bisa membuat chart baru di canvas yang masih dipakai chart
   lain, dan error "Canvas is already in use" tetap muncul.

   Solusi yang lebih kuat & anti-celah: alih-alih mengejar satu per
   satu fungsi pemanggil (yang jumlahnya bisa terus bertambah oleh
   patch lain kapan saja), kita bungkus CONSTRUCTOR Chart.js itu
   SENDIRI. Jadi SIAPAPUN yang memanggil `new Chart(canvas, ...)` —
   dari stcr.js, stcr-trend-split.js, atau patch manapun — otomatis
   dicek dulu: kalau canvas targetnya (khusus 3 canvas dashboard
   STCR yang jadi rebutan) sudah dipakai chart lain, chart lama itu
   di-destroy dulu SEBELUM chart baru dibuat. Ini bekerja di level
   paling bawah (Chart.js langsung), sehingga tidak bergantung pada
   urutan load atau berapa banyak script lain yang saling
   membungkus fungsi di atasnya.
   ================================================================ */
!function () {
  "use strict";

  if (window._stcrChartCtorGuardInit) return;
  window._stcrChartCtorGuardInit = true;

  if (typeof Chart === "undefined") {
    console.warn("[SJNAM] Chart.js belum termuat saat guard canvas STCR dipasang — dibatalkan.");
    return;
  }

  // Canvas yang jadi rebutan antara stcr.js (versi asli) dan
  // stcr-trend-split.js (versi override POB/STCR terpisah).
  var GUARDED_CANVAS_IDS = { stcrTrendChart: 1, stcrRevenueChart: 1, stcrStationChart: 1 };
  var OriginalChart = window.Chart;

  function resolveCanvasElement(item) {
    if (!item) return null;
    if (typeof item === "string") return document.getElementById(item);
    if (item.tagName === "CANVAS") return item;
    if (item.canvas && item.canvas.tagName === "CANVAS") return item.canvas; // item berupa 2D context
    return null;
  }

  function GuardedChart(item, config) {
    var canvasEl = resolveCanvasElement(item);
    if (canvasEl && canvasEl.id && GUARDED_CANVAS_IDS[canvasEl.id] && typeof OriginalChart.getChart === "function") {
      var existing = OriginalChart.getChart(canvasEl);
      if (existing) {
        try { existing.destroy(); } catch (e) { /* abaikan, tetap lanjut coba bikin chart baru */ }
      }
    }
    return new OriginalChart(item, config);
  }

  // Pastikan semua static method/property Chart.js asli (getChart, register,
  // defaults, dst) tetap bisa diakses lewat window.Chart setelah diganti,
  // supaya kode lain yang manggil Chart.getChart(...) / Chart.register(...)
  // tidak ikut rusak.
  GuardedChart.prototype = OriginalChart.prototype;
  Object.setPrototypeOf(GuardedChart, OriginalChart);

  window.Chart = GuardedChart;

  console.info("%c[SJNAM] Guard global anti-tabrakan canvas Chart.js aktif.", "color:#0891b2;font-weight:bold;font-size:11px");
}();
