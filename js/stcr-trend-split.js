/* ================================================================
   SJNAM — PEMISAHAN CHART TREN REQUEST: POB vs STCR
   ================================================================
   Chart "Tren Request per Bulan" bawaan (stcr.js) menggabungkan
   SEMUA jenis request (POB, STCR, maupun "STCR & POB") jadi SATU
   garis — tidak bisa dibedakan berapa dari POB dan berapa dari STCR
   di tiap bulan. File ini mengganti chart itu dengan 2 garis
   terpisah (POB & STCR), masing-masing dengan angka di tiap titik.

   Kenapa dibuat file terpisah: stcr.js terminifikasi jadi satu
   baris, dan variabel-variabel penting (ALL_DATA, filtered, charts)
   adalah closure privat yang tidak di-expose ke window. Karena itu:
   - Data mentah dibaca LANGSUNG dari localStorage
     ("sjnam_stcr_data_v1"), bukan dari variabel privat stcr.js.
   - Kriteria filter (tahun/bulan/AOC/jenis request/station, termasuk
     penguncian station untuk role User-STCR) DIREPLIKASI PERSIS
     sama dengan logic getFiltered() asli di stcr.js, dengan
     membaca langsung nilai dropdown filter yang sama di halaman.
   - Untuk tahu KAPAN filter baru saja diterapkan (supaya chart kita
     ikut ter-refresh), diamati perubahan isi #stcrKpiGrid — elemen
     itu SELALU dibangun ulang oleh applyFilters() versi asli, apa
     pun jalur pemanggilannya (klik filter, buka tab Dashboard, dst)
     — jadi ini penanda yang bisa diandalkan, tidak seperti mencoba
     membungkus salah satu fungsi yang mungkin dipanggil lewat
     closure internal (yang terbukti tidak selalu bisa diandalkan
     di kasus-kasus sebelumnya).
   ================================================================ */
!function () {
  "use strict";

  if (window._stcrTrendSplitInit) return;
  window._stcrTrendSplitInit = true;

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function getFilteredReplica() {
    var ALL_DATA = [];
    try { ALL_DATA = JSON.parse(localStorage.getItem("sjnam_stcr_data_v1") || "[]"); } catch (e) { ALL_DATA = []; }

    var year = (document.getElementById("stcr-f-year") || {}).value || "";
    var month = (document.getElementById("stcr-f-month") || {}).value || "";
    var aoc = (document.getElementById("stcr-f-aoc") || {}).value || "";
    var req = (document.getElementById("stcr-f-req") || {}).value || "";
    var station = (document.getElementById("stcr-f-station") || {}).value || "";

    // Replikasi persis penguncian station untuk role User-STCR (lihat getFiltered() asli)
    var cu = window.currentUser;
    if (cu && cu.role === "User-STCR") {
      try {
        var kar = JSON.parse(localStorage.getItem("sjnam_karyawan_v1") || "[]");
        var un = (cu.username || "").toLowerCase();
        var me = kar.find(function (k) { return (k.username || "").toLowerCase() === un || (k.nip || "").toLowerCase() === un; });
        var freshSt = me && me.station && me.station !== "ALL" ? me.station : null;
        if (freshSt) station = freshSt;
      } catch (e) { /* abaikan, lanjut pakai nilai dropdown apa adanya */ }
    }

    return ALL_DATA.filter(function (d) {
      return !(
        (year && String(d.Year) !== year) ||
        (month && d.Month !== month) ||
        (aoc && d.AOC !== aoc) ||
        (req && d.Request !== req) ||
        (station && d.Station !== station)
      );
    });
  }

  function rebuildSplitTrendChart() {
    var canvas = document.getElementById("stcrTrendChart");
    if (!canvas || typeof Chart === "undefined") return;
    if (!canvas.offsetWidth && !canvas.offsetParent) return; // tab tidak sedang terlihat

    var filtered = getFilteredReplica();
    var pobMap = {}, stcrMap = {};
    filtered.forEach(function (d) {
      var key = d.Year + "-" + d.Month;
      // "STCR & POB" dihitung ke KEDUA garis, karena request itu memang mencakup keduanya sekaligus
      if (d.Request === "POB" || d.Request === "STCR & POB") pobMap[key] = (pobMap[key] || 0) + 1;
      if (d.Request === "STCR" || d.Request === "STCR & POB") stcrMap[key] = (stcrMap[key] || 0) + 1;
    });

    var allKeys = Object.keys(pobMap).concat(Object.keys(stcrMap));
    var uniqueKeys = allKeys.filter(function (k, i) { return allKeys.indexOf(k) === i; });
    uniqueKeys.sort(function (a, b) {
      var pa = a.split("-"), pb = b.split("-");
      return (Number(pa[0]) - Number(pb[0])) || (MONTHS.indexOf(pa[1]) - MONTHS.indexOf(pb[1]));
    });

    var existing = typeof Chart.getChart === "function" ? Chart.getChart(canvas) : null;
    if (existing) existing.destroy();
    if (window._stcrSplitChart) { try { window._stcrSplitChart.destroy(); } catch (e) {} }

    window._stcrSplitChart = new Chart(canvas, {
      type: "line",
      data: {
        labels: uniqueKeys.map(function (k) { return k.replace("-", " "); }),
        datasets: [
          {
            label: "POB",
            data: uniqueKeys.map(function (k) { return pobMap[k] || 0; }),
            borderColor: "#F59E0B",
            backgroundColor: "rgba(245,158,11,.12)",
            borderWidth: 2, pointRadius: 3, fill: true, tension: 0.3
          },
          {
            label: "STCR",
            data: uniqueKeys.map(function (k) { return stcrMap[k] || 0; }),
            borderColor: "#1AA7C4",
            backgroundColor: "rgba(26,167,196,.12)",
            borderWidth: 2, pointRadius: 3, fill: true, tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true, position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
          datalabels: {
            display: true, font: { size: 9, weight: "bold" }, align: "top", anchor: "end",
            color: function (ctx) { return ctx.dataset.borderColor; },
            formatter: function (v) { return v > 0 ? v : ""; }
          }
        },
        scales: { x: { ticks: { maxRotation: 45, font: { size: 10 } } } }
      }
    });
  }

  function rebuildTop5StationChart() {
    var canvas = document.getElementById("stcrStationChart");
    if (!canvas || typeof Chart === "undefined") return;
    if (!canvas.offsetWidth && !canvas.offsetParent) return;

    var filtered = getFilteredReplica();
    var stMap = {};
    filtered.forEach(function (d) {
      if (d.Station) stMap[d.Station] = (stMap[d.Station] || 0) + 1;
    });
    // [PERUBAHAN] Sebelumnya Top 10 — dipersempit jadi Top 5 sesuai
    // permintaan. Efek sampingnya sekaligus memperbaiki label yang
    // tumpang-tindih (10 batang dipaksa muat di ruang yang sama membuat
    // ruang per-batang terlalu sempit, mirip kasus chart "Kepatuhan %
    // per Station" yang pernah diperbaiki sebelumnya) — dengan cuma 5
    // batang, ruang per-batang otomatis 2x lebih lega.
    var top5 = Object.entries(stMap).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);

    var existing = typeof Chart.getChart === "function" ? Chart.getChart(canvas) : null;
    if (existing) existing.destroy();
    if (window._stcrTop5Chart) { try { window._stcrTop5Chart.destroy(); } catch (e) {} }
    if (!top5.length) return;

    window._stcrTop5Chart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: top5.map(function (s) { return s[0]; }),
        datasets: [{ label: "Request", data: top5.map(function (s) { return s[1]; }), backgroundColor: "#0B1E3A", borderRadius: 4 }]
      },
      options: {
        indexAxis: "y", responsive: true,
        plugins: {
          legend: { display: false },
          datalabels: { display: true, color: "#fff", font: { size: 10, weight: "bold" }, anchor: "end", align: "start", formatter: function (v) { return v > 0 ? v : ""; } }
        },
        scales: { x: { ticks: { font: { size: 11 } } } }
      }
    });
  }

  function updateTop5Title() {
    var box = document.getElementById("stcrStationChart");
    var h3 = box && box.closest(".stcr-chart-box") && box.closest(".stcr-chart-box").querySelector("h3");
    if (h3 && /Top\s*10\s*Stasiun/i.test(h3.textContent)) h3.textContent = h3.textContent.replace(/Top\s*10/i, "Top 5");
  }

  function rebuildRevenueChart() {
    var canvas = document.getElementById("stcrRevenueChart");
    if (!canvas || typeof Chart === "undefined") return;
    if (!canvas.offsetWidth && !canvas.offsetParent) return;

    var filtered = getFilteredReplica();
    var revMap = {};
    filtered.filter(function (d) { return d["Price POB"] > 0; }).forEach(function (d) {
      var key = d.Year + "-" + d.Month;
      revMap[key] = (revMap[key] || 0) + d["Price POB"];
    });
    var revKeys = Object.keys(revMap).sort(function (a, b) {
      var pa = a.split("-"), pb = b.split("-");
      return (Number(pa[0]) - Number(pb[0])) || (MONTHS.indexOf(pa[1]) - MONTHS.indexOf(pb[1]));
    });

    var existing = typeof Chart.getChart === "function" ? Chart.getChart(canvas) : null;
    if (existing) existing.destroy();
    if (window._stcrRevenueChart) { try { window._stcrRevenueChart.destroy(); } catch (e) {} }

    window._stcrRevenueChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: revKeys.map(function (k) { return k.replace("-", " "); }),
        datasets: [{ label: "Revenue (juta Rp)", data: revKeys.map(function (k) { return revMap[k] / 1e6; }), backgroundColor: "#E8A427", borderRadius: 5 }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          datalabels: { display: true, color: "#92400e", font: { size: 9, weight: "bold" }, anchor: "end", align: "top", formatter: function (v) { return v > 0 ? "Rp" + v.toFixed(1) + "jt" : ""; } }
        },
        scales: { y: { ticks: { callback: function (v) { return "Rp " + v + "jt"; } } }, x: { ticks: { maxRotation: 45, font: { size: 10 } } } }
      }
    });
  }

  function observeAndInit() {
    var kpiGrid = document.getElementById("stcrKpiGrid");
    if (!kpiGrid || kpiGrid._stcrSplitObserved) return false;
    kpiGrid._stcrSplitObserved = true;
    new MutationObserver(function () { rebuildSplitTrendChart(); rebuildTop5StationChart(); rebuildRevenueChart(); }).observe(kpiGrid, { childList: true });
    updateTop5Title();
    rebuildSplitTrendChart();
    rebuildTop5StationChart();
    rebuildRevenueChart();
    return true;
  }

  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    if (observeAndInit() || tries > 60) clearInterval(iv);
  }, 250);

  console.info("%c[SJNAM] Tren Request POB vs STCR (terpisah + angka) aktif.", "color:#0891b2;font-weight:bold;font-size:11px");
}();
