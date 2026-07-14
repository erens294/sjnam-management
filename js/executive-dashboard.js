/* ================================================================
   SJNAM — EXECUTIVE DASHBOARD (RINGKASAN SEMUA MODUL)
   ================================================================
   Satu halaman ringkasan yang menarik data dari SEMUA modul aplikasi
   (Service Recovery, STCR & POB, Drygoods, Station Report, Baggage
   Report, Karyawan & User) — masing-masing sebagai kartu
   KPI yang bisa diklik untuk langsung membuka modul terkait, plus
   2 chart perbandingan (aktivitas & biaya per modul).

   Data dibaca LANGSUNG dari localStorage tiap modul (bukan lewat
   fungsi privat modul masing-masing, karena banyak dari fungsi itu
   ada di closure yang tidak di-expose ke window) — jadi modul ini
   TIDAK PERNAH MENULIS apa pun ke localStorage manapun, murni
   read-only, sehingga tidak berisiko mengganggu data modul lain.

   [FITUR BARU] Filter Tahun & Bulan — BERDIRI SENDIRI, sama sekali
   tidak terhubung dengan filter di tab masing-masing modul (STCR,
   Baggage Report, dll semua punya filter tahun/bulan-nya SENDIRI).
   Filter di sini murni membaca ulang data mentah tiap modul dan
   menyaringnya sendiri berdasarkan field tanggal masing-masing —
   tidak pernah membaca ATAU menulis nilai filter modul lain.
   ================================================================ */
!function () {
  "use strict";

  if (window._execDashboardInit) return;
  window._execDashboardInit = true;

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var VIEW_LS_KEY = "sjnam_exec_dashboard_filter_v1";

  function readLS(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || "null");
      return v === null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function fmtRp(n) { n = Number(n) || 0; return "Rp " + n.toLocaleString("id-ID"); }
  function fmtRpJt(n) { return (Number(n) || 0) / 1e6; }

  function extractYm(dateStr) {
    if (!dateStr) return null;
    var m = String(dateStr).match(/^(\d{4})-(\d{1,2})/);
    if (!m) return null;
    return { year: m[1], month: MONTHS[Number(m[2]) - 1] || "" };
  }
  function matchesIsoFilter(dateStr, year, month) {
    if (!year && !month) return true;
    var ym = extractYm(dateStr);
    if (!ym) return false;
    if (year && ym.year !== year) return false;
    if (month && ym.month !== month) return false;
    return true;
  }
  function matchesStcrFilter(d, year, month) {
    if (!year && !month) return true;
    if (year && String(d.Year) !== year) return false;
    if (month && d.Month !== month) return false;
    return true;
  }

  function collectModuleData(year, month) {
    var modules = [];
    var hasFilter = !!(year || month);
    // [BUG DITEMUKAN & DIPERBAIKI] Sebelumnya, saat filter aktif, metrik
    // KEDUA di tiap kartu masih menampilkan "Total Keseluruhan" — yaitu
    // angka TANPA filter (grand total sepanjang waktu). Ini melanggar
    // maksud "semua yang ada di tab Executive Dashboard harus kena
    // filter" — walau angka utamanya sudah benar ikut filter, angka
    // KEDUA di sebelahnya diam-diam TIDAK ikut, jadi kelihatan seperti
    // filter "cuma setengah jalan". Sekarang SETIAP angka yang tampil,
    // kalau filter sedang aktif, dihitung dari data yang SUDAH disaring
    // filter — tidak ada lagi angka grand-total yang lolos tanpa filter.
    var mainLabel = hasFilter ? "Total (Filter)" : "Total Kasus";
    var subLabel = "Bulan Ini";

    function isoActivityCount(list, field) {
      var now = new Date();
      var thisYm = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
      return list.filter(function (d) { return String(d[field] || "").slice(0, 7) === thisYm; }).length;
    }
    function avgRp(total, count) { return count ? Math.round(total / count) : 0; }

    var delayData = readLS("sjn_delay_pro_v4", []);
    if (!Array.isArray(delayData)) delayData = [];
    var delayFiltered = hasFilter ? delayData.filter(function (d) { return matchesIsoFilter(d.tanggal, year, month); }) : delayData;
    var delayCost = delayFiltered.reduce(function (s, d) { return s + (Number(d.cost) || 0); }, 0);
    var delayMain = delayFiltered.length;
    var delaySecond = hasFilter
      ? { label: "Rata2/Kasus", value: fmtRp(avgRp(delayCost, delayFiltered.length)) }
      : { label: subLabel, value: isoActivityCount(delayData, "tanggal") };
    modules.push({
      key: "serviceRecovery", icon: "🛬", title: "Service Recovery", tab: "dashboard",
      metrics: [{ label: mainLabel, value: delayMain }, delaySecond],
      cost: delayCost, activityThisMonth: delayFiltered.length, color: "#DC2626"
    });

    var stcrData = readLS("sjnam_stcr_data_v1", []);
    if (!Array.isArray(stcrData)) stcrData = [];
    var stcrFiltered = hasFilter ? stcrData.filter(function (d) { return matchesStcrFilter(d, year, month); }) : stcrData.filter(function (d) {
      var now1 = new Date(); return String(d.Year) === String(now1.getFullYear()) && d.Month === MONTHS[now1.getMonth()];
    });
    var stcrRevenue = stcrFiltered.reduce(function (s, d) { return s + (Number(d["Price POB"]) || 0); }, 0);
    var stcrSecond = hasFilter
      ? { label: "Rata2/Request", value: fmtRp(avgRp(stcrRevenue, stcrFiltered.length)) }
      : { label: subLabel, value: stcrFiltered.length };
    modules.push({
      key: "stcr", icon: "🏥", title: "Stretchercase & POB", tab: "stcr-dashboard",
      metrics: [{ label: mainLabel.replace("Kasus", "Request"), value: stcrFiltered.length }, stcrSecond],
      cost: stcrRevenue, activityThisMonth: stcrFiltered.length, color: "#7C3AED"
    });

    var dgData = readLS("sjnam_drygoods_v1", {});
    var dgTrx = (dgData && Array.isArray(dgData.transactions)) ? dgData.transactions : [];
    var dgBankItems = (dgData && Array.isArray(dgData.bankItems)) ? dgData.bankItems : [];
    var dgFiltered = hasFilter ? dgTrx.filter(function (d) { return matchesIsoFilter(d.date || d.tanggal, year, month); }) : dgTrx;
    // [CATATAN] "Bank Item" adalah katalog barang (tidak punya field
    // tanggal transaksi sama sekali — bukan data time-series), jadi
    // secara alami memang tidak bisa disaring per Tahun/Bulan. Ini bukan
    // "angka bocor tanpa filter", tapi memang jenis datanya berbeda.
    modules.push({
      key: "drygoods", icon: "📦", title: "Drygoods", tab: "dg-data",
      metrics: [{ label: hasFilter ? "Transaksi (Filter)" : "Total Transaksi", value: dgFiltered.length }, { label: "Bank Item (katalog, non-tanggal)", value: dgBankItems.length }],
      cost: 0, activityThisMonth: dgFiltered.length, color: "#F59E0B"
    });

    var actData = readLS("sjnam_station_activity_v1", []);
    if (!Array.isArray(actData)) actData = [];
    var actFiltered = hasFilter ? actData.filter(function (d) { return matchesIsoFilter(d.tanggal, year, month); }) : actData;
    var actLapor = actFiltered.filter(function (d) { return d.status === "Lapor"; }).length;
    var actPct = actFiltered.length ? Math.round(actLapor / actFiltered.length * 100) : 0;
    modules.push({
      key: "activity", icon: "📊", title: "Activity Report", tab: "station-activity",
      metrics: [{ label: hasFilter ? "Laporan (Filter)" : "Total Laporan", value: actFiltered.length }, { label: "% Lapor" + (hasFilter ? " (Filter)" : ""), value: actPct + "%" }],
      cost: 0, activityThisMonth: actFiltered.length, color: "#0D6E8A"
    });

    var ciData = readLS("sjnam_station_checkin_v1", []);
    if (!Array.isArray(ciData)) ciData = [];
    var ciFiltered = hasFilter ? ciData.filter(function (d) { return matchesIsoFilter(d.tanggal, year, month); }) : ciData;
    var ciPax = ciFiltered.reduce(function (s, d) { return s + (Number(d.pax) || 0); }, 0);
    modules.push({
      key: "checkin", icon: "✈️", title: "Check-In Report", tab: "station-checkin",
      metrics: [{ label: mainLabel.replace("Kasus", "Data"), value: ciFiltered.length }, hasFilter ? { label: "Total Pax", value: ciPax } : { label: subLabel, value: isoActivityCount(ciData, "tanggal") }],
      cost: 0, activityThisMonth: ciFiltered.length, color: "#16A34A"
    });

    var flbData = readLS("sjnam_station_bagreport_v1", []);
    if (!Array.isArray(flbData)) flbData = [];
    var flbFiltered = hasFilter ? flbData.filter(function (d) { return matchesIsoFilter(d.tanggal, year, month); }) : flbData;
    var flbTotalBag = flbFiltered.reduce(function (s, d) { return s + (Number(d.totalBag) || 0); }, 0);
    modules.push({
      key: "flb", icon: "🧳", title: "First Bag Last Bag", tab: "station-bagreport",
      metrics: [{ label: mainLabel.replace("Kasus", "Data"), value: flbFiltered.length }, hasFilter ? { label: "Total Bag", value: flbTotalBag } : { label: subLabel, value: isoActivityCount(flbData, "tanggal") }],
      cost: 0, activityThisMonth: flbFiltered.length, color: "#0891B2"
    });

    var bgRaw = readLS("sjnam_baggage_v1", { records: [] });
    var bgData = (bgRaw && Array.isArray(bgRaw.records)) ? bgRaw.records : [];
    var bgFiltered = hasFilter ? bgData.filter(function (d) { return matchesIsoFilter(d.caseDate, year, month); }) : bgData;
    var bgClaim = bgFiltered.reduce(function (s, d) { return s + (Number(d.approvalFee) || 0); }, 0);
    var bgClose = bgFiltered.filter(function (d) { return d.caseStatus === "Close"; }).length;
    modules.push({
      key: "baggage", icon: "🧳", title: "Baggage Report", tab: "station-baggage",
      metrics: [{ label: mainLabel, value: bgFiltered.length }, hasFilter ? { label: "Kasus Close", value: bgClose } : { label: subLabel, value: isoActivityCount(bgData, "caseDate") }],
      cost: bgClaim, activityThisMonth: bgFiltered.length, color: "#EA580C"
    });

    // [PERUBAHAN] Service Training & Karyawan/User sengaja TIDAK
    // dimasukkan ke Executive Dashboard, sesuai permintaan.

    return modules;
  }

  function collectAllYears() {
    var years = {};
    function addYear(y) { if (y) years[String(y)] = true; }
    (readLS("sjn_delay_pro_v4", []) || []).forEach(function (d) { var ym = extractYm(d.tanggal); if (ym) addYear(ym.year); });
    (readLS("sjnam_stcr_data_v1", []) || []).forEach(function (d) { addYear(d.Year); });
    var dg = readLS("sjnam_drygoods_v1", {});
    ((dg && dg.transactions) || []).forEach(function (d) { var ym = extractYm(d.date || d.tanggal); if (ym) addYear(ym.year); });
    (readLS("sjnam_station_activity_v1", []) || []).forEach(function (d) { var ym = extractYm(d.tanggal); if (ym) addYear(ym.year); });
    (readLS("sjnam_station_checkin_v1", []) || []).forEach(function (d) { var ym = extractYm(d.tanggal); if (ym) addYear(ym.year); });
    (readLS("sjnam_station_bagreport_v1", []) || []).forEach(function (d) { var ym = extractYm(d.tanggal); if (ym) addYear(ym.year); });
    var bg = readLS("sjnam_baggage_v1", { records: [] });
    ((bg && bg.records) || []).forEach(function (d) { var ym = extractYm(d.caseDate); if (ym) addYear(ym.year); });
    return Object.keys(years).sort();
  }

  function hexToRgba(hex, alpha) {
    var h = hex.replace("#", "");
    var r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function renderModuleCards(modules) {
    var grid = document.getElementById("execModuleGrid");
    if (!grid) return;
    grid.innerHTML = modules.map(function (m) {
      var metricsHtml = m.metrics.map(function (met) {
        return '<div><div class="text-2xl font-bold exec-metric-value" style="color:' + m.color + '">' + met.value + '</div><div class="text-xs text-slate-500">' + met.label + '</div></div>';
      }).join("");
      var costHtml = m.cost > 0 ? '<div class="mt-2 text-xs text-slate-500 border-t pt-2">💰 ' + fmtRp(m.cost) + '</div>' : "";
      return '<div class="card p-4 cursor-pointer exec-module-card" data-exec-tab="' + m.tab + '" style="border-left:4px solid ' + m.color + '">' +
        '<div class="flex items-center gap-2 mb-3"><span class="exec-icon-badge" style="background:' + hexToRgba(m.color, 0.12) + '">' + m.icon + '</span><h3 class="font-bold text-sm">' + m.title + '</h3></div>' +
        '<div class="grid grid-cols-2 gap-2">' + metricsHtml + '</div>' + costHtml +
        '</div>';
    }).join("");

    grid.querySelectorAll("[data-exec-tab]").forEach(function (card) {
      card.addEventListener("click", function () {
        var tab = card.getAttribute("data-exec-tab");
        if ("function" === typeof window.switchTab) window.switchTab(tab);
      });
    });
  }

  // Ringkasan "at-a-glance" — 3 angka BESAR paling penting di paling atas,
  // supaya kondisi keseluruhan bisa dipahami dalam hitungan detik sebelum
  // masuk ke detail per-modul.
  function renderSummaryStrip(modules) {
    var el = document.getElementById("execSummaryStrip");
    if (!el) return;
    var totalActivity = modules.reduce(function (s, m) { return s + (m.activityThisMonth || 0); }, 0);
    var totalCost = modules.reduce(function (s, m) { return s + (m.cost || 0); }, 0);
    var activeModules = modules.filter(function (m) { return m.activityThisMonth > 0; }).length;
    el.innerHTML =
      '<div class="exec-summary-item"><div class="exec-summary-value">' + totalActivity.toLocaleString("id-ID") + '</div><div class="exec-summary-label">📊 Total Aktivitas (Semua Modul)</div></div>' +
      '<div class="exec-summary-item variant-2"><div class="exec-summary-value">' + fmtRp(totalCost) + '</div><div class="exec-summary-label">💰 Total Biaya Gabungan</div></div>' +
      '<div class="exec-summary-item variant-3"><div class="exec-summary-value">' + activeModules + ' / ' + modules.length + '</div><div class="exec-summary-label">✅ Modul dengan Aktivitas</div></div>';
  }

  var execCharts = {};
  function destroyExecChart(id) { if (execCharts[id]) { execCharts[id].destroy(); delete execCharts[id]; } }

  function renderCharts(modules, hasFilter) {
    if (typeof Chart === "undefined") return;
    var activityLabel = hasFilter ? "Sesuai Filter" : "Aktivitas Bulan Ini";

    var actCanvas = document.getElementById("execActivityChart");
    if (actCanvas && (actCanvas.offsetWidth || actCanvas.offsetParent)) {
      destroyExecChart("activityChart");
      execCharts.activityChart = new Chart(actCanvas, {
        type: "bar",
        data: {
          labels: modules.map(function (m) { return m.icon + " " + m.title; }),
          datasets: [{ label: activityLabel, data: modules.map(function (m) { return m.activityThisMonth; }), backgroundColor: modules.map(function (m) { return m.color; }), borderRadius: 5 }]
        },
        options: {
          indexAxis: "y", responsive: true,
          plugins: { legend: { display: false }, datalabels: { display: true, color: "#fff", font: { size: 10, weight: "bold" }, anchor: "end", align: "start", formatter: function (v) { return v > 0 ? v : ""; } } },
          scales: { x: { ticks: { font: { size: 10 } } }, y: { ticks: { font: { size: 10 } } } }
        }
      });
    }

    var costCanvas = document.getElementById("execCostChart");
    if (costCanvas && (costCanvas.offsetWidth || costCanvas.offsetParent)) {
      var withCost = modules.filter(function (m) { return m.cost > 0; });
      destroyExecChart("costChart");
      if (withCost.length) {
        execCharts.costChart = new Chart(costCanvas, {
          type: "bar",
          data: {
            labels: withCost.map(function (m) { return m.icon + " " + m.title; }),
            datasets: [{ label: "Biaya (juta Rp)", data: withCost.map(function (m) { return fmtRpJt(m.cost); }), backgroundColor: withCost.map(function (m) { return m.color; }), borderRadius: 5 }]
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false }, datalabels: { display: true, color: "#334155", font: { size: 10, weight: "bold" }, anchor: "end", align: "top", formatter: function (v) { return "Rp" + v.toFixed(1) + "jt"; } } },
            scales: { x: { ticks: { font: { size: 10 } } }, y: { ticks: { callback: function (v) { return "Rp " + v + "jt"; } } } }
          }
        });
      }
    }
  }

  function getFilterValues() {
    var yearEl = document.getElementById("exec-f-year");
    var monthEl = document.getElementById("exec-f-month");
    return { year: (yearEl && yearEl.value) || "", month: (monthEl && monthEl.value) || "" };
  }
  function saveFilter(year, month) {
    try { localStorage.setItem(VIEW_LS_KEY, JSON.stringify({ year: year, month: month })); } catch (e) {}
  }
  function restoreFilterValues() {
    var saved = readLS(VIEW_LS_KEY, null);
    if (!saved) return;
    var yearEl = document.getElementById("exec-f-year");
    var monthEl = document.getElementById("exec-f-month");
    if (yearEl && saved.year) yearEl.value = saved.year;
    if (monthEl && saved.month) monthEl.value = saved.month;
  }
  function rebuildYearOptions() {
    var yearEl = document.getElementById("exec-f-year");
    if (!yearEl) return;
    var years = collectAllYears();
    var cur = yearEl.value;
    yearEl.innerHTML = '<option value="">Semua Tahun</option>' + years.map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join("");
    if (years.indexOf(cur) !== -1) yearEl.value = cur;
  }

  function renderExecDashboard() {
    rebuildYearOptions();
    restoreFilterValues();
    var f = getFilterValues();
    var modules = collectModuleData(f.year, f.month);
    renderSummaryStrip(modules);
    renderModuleCards(modules);
    renderCharts(modules, !!(f.year || f.month));
    var infoEl = document.getElementById("execFilterInfo");
    if (infoEl) {
      infoEl.textContent = (f.year || f.month)
        ? "Filter aktif: " + (f.year || "Semua Tahun") + (f.month ? " / " + f.month : "") + " — berdiri sendiri, tidak terhubung dengan filter tab lain"
        : "Tanpa filter — kolom \"Bulan Ini\" mengikuti bulan kalender berjalan";
    }
  }

  function wireEvents() {
    if (window._execEventsWired) return;
    window._execEventsWired = true;
    var refreshBtn = document.getElementById("btnExecRefresh");
    refreshBtn && refreshBtn.addEventListener("click", renderExecDashboard);
    var yearEl = document.getElementById("exec-f-year");
    var monthEl = document.getElementById("exec-f-month");
    [yearEl, monthEl].forEach(function (el) {
      el && el.addEventListener("change", function () {
        var f = getFilterValues();
        saveFilter(f.year, f.month);
        renderExecDashboard();
      });
    });
    var resetBtn = document.getElementById("btnExecResetFilter");
    resetBtn && resetBtn.addEventListener("click", function () {
      if (yearEl) yearEl.value = "";
      if (monthEl) monthEl.value = "";
      saveFilter("", "");
      renderExecDashboard();
    });
  }

  document.addEventListener("sjn:tab-changed", function (e) {
    var tab = e && e.detail && e.detail.tab;
    if (tab === "executive-dashboard") { wireEvents(); renderExecDashboard(); }
  });

  function watchTabPane() {
    var el = document.getElementById("tab-executive-dashboard");
    if (!el || el._execWatched) return false;
    el._execWatched = true;
    if (el.classList.contains("active")) setTimeout(function () { wireEvents(); renderExecDashboard(); }, 0);
    new MutationObserver(function () { if (el.classList.contains("active")) { wireEvents(); renderExecDashboard(); } }).observe(el, { attributes: true, attributeFilter: ["class"] });
    return true;
  }
  wireEvents();
  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    if (watchTabPane() || tries > 60) clearInterval(iv);
  }, 250);

  console.info("%c[SJNAM] Executive Dashboard (dengan filter Tahun/Bulan mandiri) aktif.", "color:#7c3aed;font-weight:bold;font-size:11px");
}();
