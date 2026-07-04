/* ================================================================
   SJNAM — STATION REPORT
   ================================================================
   Grup tab baru: Activity Report, Check-In Report, First Bag Last
   Bag Report. Daftar station pada Activity Report diambil dari
   Master Distrik (28 station default) sesuai file Excel
   "Distrik_Activity_Dashboard2.xlsx" yang dilampirkan — supaya
   pengisian tetap konsisten dengan skema pelaporan yang sudah ada
   (Tanggal, Station, Status: Lapor / Tidak Lapor / Tutup,
   Keterangan opsional). Daftar 28 station default ini bisa ditambah
   oleh user lewat tombol "+ Tambah Station" di sub-tab Input Data.

   Semua data disimpan di localStorage & disinkronkan lewat
   triggerAutoSync() seperti modul lain (mengikuti pola stok
   Drygoods / Bank Station).
   ================================================================ */
!function () {
  "use strict";

  var esc = window.esc || function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  function todayStr() {
    var n = new Date();
    return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
  }
  function fmtDate(d) {
    if (!d) return "-";
    var p = d.split("-");
    if (p.length !== 3) return d;
    var bulan = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return p[2] + "-" + bulan[parseInt(p[1]) - 1] + "-" + p[0];
  }
  function genId(prefix) {
    return prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  }
  function persist(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
    "function" == typeof window.markDirty && window.markDirty(key);
    "function" == typeof window.triggerAutoSync && window.triggerAutoSync(key);
  }
  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; } catch (e) { return fallback; }
  }

  // ── Master Station (28 station default, sesuai Master Distrik pada file Excel) ──
  var MASTER_DISTRIK = [
    "Ujung Pandang (UPG)", "Sorong (SOQ)", "Jayapura (DJJ)", "Manado (MDC)",
    "Biak (BIK)", "Timika (TIM)", "Nabire (NBX)", "Wamena (WMX)",
    "Denpasar (DPS)", "Pangkal Pinang (PGK)", "Cengkareng (CGK)",
    "Yogyakarta (YIA)", "Semarang (SRG)", "Surabaya (SUB)", "Balikpapan (BPN)",
    "Pontianak (PNK)", "Pangkalanbun (PKN)", "Berau (BEJ)", "Sampit (SMQ)",
    "Batam (BTH)", "Tanjung Pandan (TJQ)", "Muara Bungo (BUU)", "Jambi (DJB)",
    "Koepang (KOE)", "Maumere (MOF)", "Tambolaka (TMC)", "Ternate (TTE)",
    "Morowali (MOH)"
  ];
  var LS_ACT_STATIONS = "sjnam_station_activity_master_v1";

  // Daftar station yang benar-benar dipakai di seluruh modul Activity Report.
  // Mulai dari 28 default di atas, tapi bisa ditambah/dihapus oleh user lewat
  // tombol "+ Tambah Station" di sub-tab Input Data — tersimpan terpisah dari
  // daftar default supaya tidak perlu mengubah kode untuk menambah station.
  var STATION_LIST = (function () {
    var saved = load(LS_ACT_STATIONS, null);
    return (Array.isArray(saved) && saved.length) ? saved : MASTER_DISTRIK.slice();
  })();
  function saveStationList() { persist(LS_ACT_STATIONS, STATION_LIST); }
  function addStationToList(name) {
    name = (name || "").trim();
    if (!name) return { ok: false, msg: "Nama station tidak boleh kosong" };
    if (STATION_LIST.some(function (s) { return s.toLowerCase() === name.toLowerCase(); })) {
      return { ok: false, msg: "Station tersebut sudah ada di daftar" };
    }
    STATION_LIST.push(name);
    STATION_LIST.sort(function (a, b) { return a.localeCompare(b); });
    saveStationList();
    return { ok: true };
  }
  function removeStationFromList(name) {
    STATION_LIST = STATION_LIST.filter(function (s) { return s !== name; });
    saveStationList();
  }

  var STATUS_OPTS = ["Lapor", "Tidak Lapor", "Tutup"];
  var STATUS_CLASS = {
    "Lapor": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    "Tidak Lapor": "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    "Tutup": "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
  };

  var LS_ACT = "sjnam_station_activity_v1";
  var LS_CI = "sjnam_station_checkin_v1";
  var LS_FLB = "sjnam_station_bagreport_v1";

  function getBankStationList() {
    try { return JSON.parse(localStorage.getItem("sjn_stations_v2") || "[]"); } catch (e) { return []; }
  }

  /* ============================== ACTIVITY REPORT ============================== */
  var MONTH_NAMES = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  var CAT_COLOR = { Better: "#17A673", Middle: "#D9970B", Worst: "#DC3A45", Tutup: "#94A0B4" };

  function getActivityData() { return load(LS_ACT, []); }
  function saveActivityData(list) { persist(LS_ACT, list); }

  function findActEntry(date, distrik) {
    var list = getActivityData();
    return list.find(function (r) { return r.tanggal === date && r.distrik === distrik; });
  }

  function upsertActEntry(date, distrik, status, keterangan) {
    var list = getActivityData();
    var idx = list.findIndex(function (r) { return r.tanggal === date && r.distrik === distrik; });
    var entry = {
      id: idx > -1 ? list[idx].id : genId("act"),
      tanggal: date,
      distrik: distrik,
      status: status,
      keterangan: keterangan || "",
      updatedAt: new Date().toISOString(),
      updatedBy: (window.currentUser && (window.currentUser.name || window.currentUser.username)) || ""
    };
    if (idx > -1) list[idx] = entry; else list.push(entry);
    saveActivityData(list);
    return entry;
  }

  function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }

  function computeDistrikMonth(distrik, y, m) {
    var mm = String(m).padStart(2, "0"), prefix = y + "-" + mm;
    var lapor = 0, tutup = 0;
    getActivityData().forEach(function (r) {
      if (r.distrik !== distrik || !r.tanggal || r.tanggal.slice(0, 7) !== prefix) return;
      if (r.status === "Lapor") lapor++; else if (r.status === "Tutup") tutup++;
    });
    var dim = daysInMonth(y, m), eff = dim - tutup, pct = eff <= 0 ? null : lapor / eff, cat = "Tutup";
    if (pct !== null) cat = pct >= 0.87 ? "Better" : pct >= 0.53 ? "Middle" : "Worst";
    return { lapor: lapor, tutup: tutup, pct: pct, cat: cat };
  }

  function fmtPct(p) { return p === null ? "—" : Math.round(p * 100) + "%"; }

  // ── Injeksi CSS terpisah untuk tampilan model dashboard ──
  function ensureActivityStyles() {
    if (document.getElementById("srActStyles")) return;
    var css = ".sr-act-app{}" +
      ".sr-act-kpi-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:18px}" +
      "@media(max-width:1024px){.sr-act-kpi-grid{grid-template-columns:repeat(3,1fr)}}" +
      "@media(max-width:640px){.sr-act-kpi-grid{grid-template-columns:repeat(2,1fr)}}" +
      ".sr-act-kpi{background:var(--card-bg,#fff);border:1px solid var(--card-border,rgba(0,0,0,.08));border-radius:12px;overflow:hidden}" +
      ".sr-act-kpi .lbl{font-size:9.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:#fff;padding:8px 10px}" +
      ".sr-act-kpi .val{font-size:24px;font-weight:800;padding:12px 10px 14px;text-align:center;color:var(--text-primary,#0f172a)}" +
      ".sr-act-kpi.navy .lbl{background:#0F1A30}.sr-act-kpi.navy3 .lbl{background:#1E2E52}.sr-act-kpi.green .lbl{background:#17A673}.sr-act-kpi.amber .lbl{background:#D9970B}.sr-act-kpi.red .lbl{background:#DC3A45}.sr-act-kpi.gray .lbl{background:#94A0B4}" +
      ".sr-act-panels{display:grid;grid-template-columns:1.15fr 1fr;gap:16px}" +
      "@media(max-width:900px){.sr-act-panels{grid-template-columns:1fr}}" +
      ".sr-act-panel{background:var(--card-bg,#fff);border:1px solid var(--card-border,rgba(0,0,0,.08));border-radius:12px;padding:16px 18px 14px;margin-bottom:16px}" +
      ".sr-act-panel h3{font-size:13px;margin:0 0 10px;font-weight:700;color:var(--text-primary,#0f172a)}" +
      ".sr-act-panel-full{grid-column:1/-1}" +
      ".sr-act-tbl-scroll{max-height:460px;overflow:auto;border:1px solid var(--card-border,rgba(0,0,0,.08));border-radius:8px}" +
      ".sr-act-tbl-scroll table{width:100%;border-collapse:collapse;font-size:12.5px}" +
      ".sr-act-tbl-scroll thead th{background:#0F1A30;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:.4px;padding:8px 10px;text-align:left;position:sticky;top:0}" +
      ".sr-act-tbl-scroll tbody td{padding:7px 10px;border-bottom:1px solid var(--card-border,rgba(0,0,0,.08));color:var(--text-primary,#0f172a)}" +
      ".sr-act-tbl-scroll tbody tr:hover{background:rgba(59,130,246,.07)}" +
      ".sr-act-badge{display:inline-block;padding:2px 9px;border-radius:20px;font-size:10.5px;font-weight:700}" +
      ".sr-act-badge.Better{background:#E4F7EF;color:#17A673}.sr-act-badge.Middle{background:#FDF3DF;color:#D9970B}.sr-act-badge.Worst{background:#FCE6E7;color:#DC3A45}.sr-act-badge.Tutup{background:#EEF0F4;color:#6B7688}" +
      ".sr-act-pulse{display:flex;gap:2px;align-items:center}.sr-act-pulse .dot{width:6px;height:15px;border-radius:2px;opacity:.9}" +
      ".sr-act-monthpicker{display:flex;align-items:center;gap:6px;background:var(--input-bg,#f8fafc);border:1px solid var(--input-border,#e2e8f0);border-radius:8px;padding:5px 6px}" +
      ".sr-act-monthpicker select{border:none;background:transparent;font-weight:600;font-size:12.5px;color:var(--text-primary,#0f172a);outline:0;cursor:pointer}" +
      ".sr-act-monthpicker button{border:none;background:transparent;cursor:pointer;color:var(--text-secondary,#64748b);width:20px;height:20px;border-radius:5px;font-size:13px}" +
      ".sr-act-monthpicker button:hover{background:var(--card-border,rgba(0,0,0,.08))}" +
      ".sr-act-seg{display:flex;gap:4px;background:var(--input-bg,#f1f5f9);border-radius:8px;padding:3px}" +
      ".sr-act-seg button{border:none;background:transparent;padding:6px 12px;font-size:12px;font-weight:600;border-radius:6px;cursor:pointer;color:var(--text-secondary,#64748b)}" +
      ".sr-act-seg button.active{background:#0F1A30;color:#fff}" +
      ".sr-act-year-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 10px}" +
      ".sr-act-year-tabs button{border:1px solid var(--card-border,rgba(0,0,0,.08));background:var(--card-bg,#fff);padding:5px 12px;font-size:12px;font-weight:600;border-radius:7px;cursor:pointer;color:var(--text-primary,#0f172a)}" +
      ".sr-act-year-tabs button.active{background:#0F1A30;color:#fff;border-color:#0F1A30}";
    var style = document.createElement("style");
    style.id = "srActStyles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ── Bulan yang tersedia (dibangun dari tahun-tahun yang muncul di data + tahun berjalan) ──
  var srActMonths = [], srActCurMonthIdx = 0, srActRekapMode = "pct", srActRekapYear = null, srActCurrentSubtab = "dashboard";
  var srActPieChart, srActBarChart, srActTrendChart;

  function rebuildActMonths(keepSelection) {
    var years = new Set();
    getActivityData().forEach(function (r) { if (r.tanggal) years.add(parseInt(r.tanggal.slice(0, 4), 10)); });
    var now = new Date();
    years.add(now.getFullYear());
    var yearsArr = Array.from(years).sort(function (a, b) { return a - b; });
    var prevSel = keepSelection && srActMonths[srActCurMonthIdx] ? srActMonths[srActCurMonthIdx] : null;
    srActMonths = [];
    yearsArr.forEach(function (y) {
      for (var m = 1; m <= 12; m++) srActMonths.push({ y: y, m: m, label: MONTH_NAMES[m - 1] + " " + y });
    });
    if (prevSel) {
      var idx = srActMonths.findIndex(function (x) { return x.y === prevSel.y && x.m === prevSel.m; });
      srActCurMonthIdx = idx > -1 ? idx : srActMonths.length - 1;
    } else {
      var ci = srActMonths.findIndex(function (x) { return x.y === now.getFullYear() && x.m === now.getMonth() + 1; });
      srActCurMonthIdx = ci > -1 ? ci : srActMonths.length - 1;
    }
    if (!srActRekapYear) srActRekapYear = srActMonths.length ? srActMonths[srActCurMonthIdx].y : now.getFullYear();
  }

  function renderMonthSelect() {
    var sel = document.getElementById("srActMonthSelect");
    if (!sel) return;
    sel.innerHTML = srActMonths.map(function (x, i) { return '<option value="' + i + '">' + x.label + "</option>"; }).join("");
    sel.value = srActCurMonthIdx;
  }

  function renderPulseStrip() {
    var el = document.getElementById("srActPulseStrip");
    if (!el || !srActMonths[srActCurMonthIdx]) return;
    var y = srActMonths[srActCurMonthIdx].y, m = srActMonths[srActCurMonthIdx].m;
    el.innerHTML = STATION_LIST.map(function (d) {
      var r = computeDistrikMonth(d, y, m);
      return '<div class="dot" style="background:' + CAT_COLOR[r.cat] + '" title="' + esc(d) + ": " + fmtPct(r.pct) + '"></div>';
    }).join("");
  }

  function renderDashboard() {
    if (!srActMonths[srActCurMonthIdx]) return;
    var y = srActMonths[srActCurMonthIdx].y, m = srActMonths[srActCurMonthIdx].m;
    var rows = STATION_LIST.map(function (d) { return { distrik: d, r: computeDistrikMonth(d, y, m) }; });

    var aktif = rows.filter(function (x) { return x.r.lapor > 0; }).length;
    var rata = rows.length ? (rows.reduce(function (s, x) { return s + x.r.lapor; }, 0) / rows.length) : 0;
    var better = rows.filter(function (x) { return x.r.cat === "Better"; }).length;
    var middle = rows.filter(function (x) { return x.r.cat === "Middle"; }).length;
    var worst = rows.filter(function (x) { return x.r.cat === "Worst"; }).length;
    var tutupN = rows.filter(function (x) { return x.r.cat === "Tutup"; }).length;
    var nol = rows.filter(function (x) { return x.r.pct === 0; }).length;

    var set = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    set("srActKpiAktif", aktif);
    set("srActKpiRata", rata.toFixed(1));
    set("srActKpiBetter", better);
    set("srActKpiMiddle", middle);
    set("srActKpiWorst", worst);
    set("srActKpiNol", nol);

    var sorted = rows.slice().sort(function (a, b) {
      var pa = a.r.pct === null ? -1 : a.r.pct, pb = b.r.pct === null ? -1 : b.r.pct;
      return pb - pa;
    });
    var lb = document.getElementById("srActLeaderboardBody");
    if (lb) {
      lb.innerHTML = sorted.map(function (x, i) {
        return '<tr><td>' + (i + 1) + '</td><td>' + esc(x.distrik) + '</td><td>' + fmtPct(x.r.pct) +
          '</td><td><span class="sr-act-badge ' + x.r.cat + '">' + x.r.cat + '</span></td></tr>';
      }).join("");
    }

    if (typeof Chart === "undefined") return;

    var pieCtx = document.getElementById("srActPieChart");
    if (srActPieChart) srActPieChart.destroy();
    if (pieCtx) srActPieChart = new Chart(pieCtx, {
      type: "doughnut",
      data: { labels: ["Better", "Middle", "Worst", "Tutup"], datasets: [{ data: [better, middle, worst, tutupN], backgroundColor: [CAT_COLOR.Better, CAT_COLOR.Middle, CAT_COLOR.Worst, CAT_COLOR.Tutup], borderWidth: 0 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } }, datalabels: { display: !1 } } }
    });

    var barCtx = document.getElementById("srActBarChart");
    if (srActBarChart) srActBarChart.destroy();
    if (barCtx) {
      var barLabels = sorted.map(function (x) { return x.distrik; });
      var barVals = sorted.map(function (x) { return x.r.pct === null ? 0 : Math.round(x.r.pct * 100); });
      var barColors = sorted.map(function (x) { return CAT_COLOR[x.r.cat]; });
      srActBarChart = new Chart(barCtx, {
        type: "bar",
        data: { labels: barLabels, datasets: [{ data: barVals, backgroundColor: barColors, borderRadius: 3, barThickness: 10 }] },
        options: { indexAxis: "y", maintainAspectRatio: false, scales: { x: { max: 100, ticks: { callback: function (v) { return v + "%"; }, font: { size: 9 } }, grid: { color: "rgba(148,163,184,.15)" } }, y: { ticks: { font: { size: 10 } }, grid: { display: !1 } } }, plugins: { legend: { display: !1 }, datalabels: { display: !1 } } }
      });
    }

    var lastRecMonth = "000000";
    getActivityData().forEach(function (r) { if (r.tanggal) { var key = r.tanggal.slice(0, 7).replace("-", ""); if (key > lastRecMonth) lastRecMonth = key; } });
    var trendCtx = document.getElementById("srActTrendChart");
    if (srActTrendChart) srActTrendChart.destroy();
    if (trendCtx) {
      var tLabels = [], tVals = [];
      srActMonths.forEach(function (mo) {
        var key = mo.y + String(mo.m).padStart(2, "0");
        tLabels.push(MONTH_NAMES[mo.m - 1].slice(0, 3) + " '" + String(mo.y).slice(2));
        if (key > lastRecMonth) { tVals.push(null); return; }
        var vals = STATION_LIST.map(function (d) { return computeDistrikMonth(d, mo.y, mo.m).pct; }).filter(function (v) { return v !== null; });
        tVals.push(vals.length ? Math.round(100 * vals.reduce(function (s, v) { return s + v; }, 0) / vals.length) : null);
      });
      srActTrendChart = new Chart(trendCtx, {
        type: "line",
        data: { labels: tLabels, datasets: [{ data: tVals, borderColor: "#0F1A30", backgroundColor: "rgba(15,26,48,.1)", fill: !0, tension: .25, pointRadius: 2, spanGaps: !1 }] },
        options: { maintainAspectRatio: false, plugins: { legend: { display: !1 }, datalabels: { display: !1 } }, scales: { y: { min: 0, max: 100, ticks: { callback: function (v) { return v + "%"; }, font: { size: 9 } }, grid: { color: "rgba(148,163,184,.15)" } }, x: { ticks: { font: { size: 8 }, maxRotation: 0, autoSkip: !0, maxTicksLimit: 14 }, grid: { display: !1 } } } }
      });
    }
  }

  function renderYearTabs() {
    var years = Array.from(new Set(srActMonths.map(function (x) { return x.y; }))).sort(function (a, b) { return a - b; });
    var el = document.getElementById("srActYearTabs");
    if (!el) return;
    el.innerHTML = years.map(function (y) { return '<button type="button" data-sr-act-year="' + y + '" class="' + (y === srActRekapYear ? "active" : "") + '">' + y + "</button>"; }).join("");
  }

  function renderRekap() {
    renderYearTabs();
    var monthsInYear = srActMonths.filter(function (x) { return x.y === srActRekapYear; });
    var head = document.getElementById("srActRekapHeadRow");
    if (head) head.innerHTML = "<th>Station</th>" + monthsInYear.map(function (mo) { return "<th>" + MONTH_NAMES[mo.m - 1].slice(0, 3) + "</th>"; }).join("");
    var body = document.getElementById("srActRekapBody");
    if (body) body.innerHTML = STATION_LIST.map(function (d) {
      var cells = monthsInYear.map(function (mo) {
        var r = computeDistrikMonth(d, mo.y, mo.m);
        if (srActRekapMode === "count") return '<td>' + (r.pct === null ? "—" : r.lapor) + "</td>";
        var bg = "transparent", fg = "inherit";
        if (r.pct !== null) {
          bg = r.cat === "Better" ? "#E4F7EF" : r.cat === "Middle" ? "#FDF3DF" : "#FCE6E7";
          fg = CAT_COLOR[r.cat];
        }
        return '<td style="background:' + bg + ";color:" + fg + ';font-weight:600">' + fmtPct(r.pct) + "</td>";
      }).join("");
      return "<tr><td>" + esc(d) + "</td>" + cells + "</tr>";
    }).join("");
  }

  function renderActivityGrid() {
    var tbody = document.getElementById("srActTableBody");
    if (!tbody) return;
    var dateInput = document.getElementById("srActDate");
    var date = dateInput && dateInput.value ? dateInput.value : todayStr();
    if (dateInput && !dateInput.value) dateInput.value = date;

    var filled = 0;
    tbody.innerHTML = STATION_LIST.map(function (distrik, i) {
      var entry = findActEntry(date, distrik);
      if (entry) filled++;
      var status = entry ? entry.status : "";
      var keterangan = entry ? entry.keterangan || "" : "";
      var statusBtns = STATUS_OPTS.map(function (s) {
        var active = status === s;
        return '<button type="button" data-sr-act-status="' + esc(s) + '" data-sr-act-distrik="' + esc(distrik) + '" class="px-2.5 py-1 rounded-lg text-xs font-semibold mr-1.5 border ' +
          (active ? STATUS_CLASS[s] + " border-transparent" : "bg-transparent text-slate-400 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700") + '">' + s + '</button>';
      }).join("");
      return '<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50" data-sr-act-row="' + esc(distrik) + '">' +
        '<td class="px-3 py-2 text-xs text-slate-400">' + (i + 1) + '</td>' +
        '<td class="px-3 py-2 font-medium text-sm">' + esc(distrik) + '</td>' +
        '<td class="px-3 py-2 whitespace-nowrap">' + statusBtns + '</td>' +
        '<td class="px-3 py-2"><input type="text" class="input text-xs" data-sr-act-note="' + esc(distrik) + '" placeholder="Catatan (opsional)" value="' + esc(keterangan) + '"></td>' +
        '<td class="px-3 py-2 text-right"><button type="button" data-sr-act-station-del="' + esc(distrik) + '" class="text-red-600 hover:underline text-xs" title="Hapus station ini dari daftar">Hapus</button></td>' +
        '</tr>';
    }).join("");

    var progEl = document.getElementById("srActProgress");
    if (progEl) progEl.textContent = filled + " / " + STATION_LIST.length + " station sudah diisi untuk tanggal ini";

    renderActivityHistory();
  }

  function renderActivityHistory() {
    var body = document.getElementById("srActHistoryBody");
    if (!body) return;
    var search = (document.getElementById("srActHistorySearch")?.value || "").toLowerCase();
    var list = getActivityData()
      .filter(function (r) {
        return !search || (r.distrik || "").toLowerCase().includes(search) || (r.tanggal || "").includes(search);
      })
      .sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0; })
      .slice(0, 200);

    if (!list.length) {
      body.innerHTML = '<tr><td colspan="5" class="text-center py-6 text-slate-400 text-sm">Belum ada riwayat.</td></tr>';
      return;
    }
    body.innerHTML = list.map(function (r) {
      return '<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">' +
        '<td class="px-3 py-2 text-xs whitespace-nowrap">' + esc(fmtDate(r.tanggal)) + '</td>' +
        '<td class="px-3 py-2 text-sm">' + esc(r.distrik) + '</td>' +
        '<td class="px-3 py-2"><span class="badge ' + (STATUS_CLASS[r.status] || "") + '">' + esc(r.status) + '</span></td>' +
        '<td class="px-3 py-2 text-xs text-slate-500">' + esc(r.keterangan || "-") + '</td>' +
        '<td class="px-3 py-2 text-right"><button data-sr-act-del="' + r.id + '" class="text-red-600 hover:underline text-xs">Hapus</button></td>' +
        '</tr>';
    }).join("");
  }

  function switchActSubtab(name) {
    srActCurrentSubtab = name;
    document.querySelectorAll("[data-sract-subtab]").forEach(function (b) {
      var on = b.dataset.sractSubtab === name;
      b.classList.toggle("active", on);
      b.classList.toggle("border-blue-600", on);
      b.classList.toggle("text-blue-600", on);
      b.classList.toggle("border-transparent", !on);
      b.classList.toggle("text-slate-500", !on);
    });
    var panes = { dashboard: "srActSubDashboard", input: "srActSubInput", rekap: "srActSubRekap" };
    Object.keys(panes).forEach(function (k) {
      var el = document.getElementById(panes[k]);
      if (el) el.classList.toggle("hidden", k !== name);
    });
    var titles = {
      dashboard: ["📋 Dashboard Aktivitas Station", "Terhubung otomatis ke Input Data"],
      input: ["✍️ Input Data Harian", "Satu-satunya tempat input manual"],
      rekap: ["🗓️ Rekap Bulanan", "Ringkasan 12 bulan per tahun"]
    };
    var t = titles[name];
    var titleEl = document.getElementById("srActTopTitle"), subEl = document.getElementById("srActTopSub");
    if (t && titleEl) titleEl.textContent = t[0];
    if (t && subEl) subEl.textContent = t[1];
    rebuildActMonths(true);
    renderMonthSelect();
    renderPulseStrip();
    if (name === "dashboard") renderDashboard();
    else if (name === "input") renderActivityGrid();
    else if (name === "rekap") renderRekap();
  }

  function openAddStationModal() {
    var existing = document.getElementById("srActAddStationModal");
    if (existing) existing.remove();
    var modal = document.createElement("div");
    modal.id = "srActAddStationModal";
    modal.className = "modal-overlay";
    modal.style.display = "flex";
    modal.innerHTML = [
      '<div class="modal-box max-w-sm">',
      '<h3 class="text-lg font-bold mb-1">➕ Tambah Station</h3>',
      '<p class="text-xs text-slate-500 mb-4">Tambahkan station baru untuk Activity Report. Format bebas, contoh: <em>Bandung (BDO)</em>.</p>',
      '<div><label class="block text-sm font-medium mb-1">Nama Station <span class="text-red-500">*</span></label>',
      '<input id="srActNewStationName" class="input" placeholder="Contoh: Bandung (BDO)"></div>',
      '<div class="flex gap-3 justify-end mt-5">',
      '<button id="srActAddStationCancel" class="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 font-medium rounded-lg">Batal</button>',
      '<button id="srActAddStationSave" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg">💾 Simpan</button>',
      '</div></div>'
    ].join("");
    document.body.appendChild(modal);
    document.getElementById("srActAddStationCancel").addEventListener("click", function () { modal.remove(); });
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.remove(); });
    var input = document.getElementById("srActNewStationName");
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") document.getElementById("srActAddStationSave").click(); });
    document.getElementById("srActAddStationSave").addEventListener("click", function () {
      var res = addStationToList(input.value);
      if (!res.ok) return void ("function" == typeof window.showToast && window.showToast(res.msg, "error"));
      modal.remove();
      renderActivityGrid();
      rebuildActMonths(true);
      renderMonthSelect();
      renderPulseStrip();
      "function" == typeof window.showToast && window.showToast("Station ditambahkan", "success");
    });
    setTimeout(function () { input.focus(); }, 50);
  }

  /* ── Export PDF/Excel untuk sub-tab Dashboard ── */
  function exportDashboardExcel() {
    if (!window.XLSX) return void ("function" == typeof window.showToast && window.showToast("XLSX tidak tersedia", "error"));
    if (!srActMonths[srActCurMonthIdx]) return;
    var mo = srActMonths[srActCurMonthIdx];
    var rows = STATION_LIST.map(function (d) {
      var r = computeDistrikMonth(d, mo.y, mo.m);
      return { Station: d, "Hari Lapor": r.lapor, "Hari Tutup": r.tutup, "Kepatuhan %": r.pct === null ? "-" : Math.round(r.pct * 100), Kategori: r.cat };
    }).sort(function (a, b) { return (typeof b["Kepatuhan %"] === "number" ? b["Kepatuhan %"] : -1) - (typeof a["Kepatuhan %"] === "number" ? a["Kepatuhan %"] : -1); });
    var aktif = rows.filter(function (r) { return r["Hari Lapor"] > 0; }).length;
    var rata = rows.length ? (rows.reduce(function (s, r) { return s + r["Hari Lapor"]; }, 0) / rows.length) : 0;
    var kpi = [
      { KPI: "Periode", Nilai: mo.label },
      { KPI: "Station Aktif", Nilai: aktif },
      { KPI: "Rata-rata Hari Lapor", Nilai: rata.toFixed(1) },
      { KPI: "Kategori Better", Nilai: rows.filter(function (r) { return r.Kategori === "Better"; }).length },
      { KPI: "Kategori Middle", Nilai: rows.filter(function (r) { return r.Kategori === "Middle"; }).length },
      { KPI: "Kategori Worst", Nilai: rows.filter(function (r) { return r.Kategori === "Worst"; }).length },
      { KPI: "Tidak Lapor (0%)", Nilai: rows.filter(function (r) { return r["Kepatuhan %"] === 0; }).length }
    ];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpi), "KPI");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Peringkat Station");
    XLSX.writeFile(wb, "Dashboard_Aktivitas_Station_" + mo.y + "-" + String(mo.m).padStart(2, "0") + ".xlsx");
  }

  function exportDashboardPdf() {
    if (!window.jspdf) return void ("function" == typeof window.showToast && window.showToast("Library PDF tidak tersedia", "error"));
    if (!srActMonths[srActCurMonthIdx]) return;
    var mo = srActMonths[srActCurMonthIdx];
    var rows = STATION_LIST.map(function (d) { return { d: d, r: computeDistrikMonth(d, mo.y, mo.m) }; })
      .sort(function (a, b) { var pa = a.r.pct === null ? -1 : a.r.pct, pb = b.r.pct === null ? -1 : b.r.pct; return pb - pa; });
    var aktif = rows.filter(function (x) { return x.r.lapor > 0; }).length;
    var rata = rows.length ? (rows.reduce(function (s, x) { return s + x.r.lapor; }, 0) / rows.length) : 0;
    var better = rows.filter(function (x) { return x.r.cat === "Better"; }).length;
    var middle = rows.filter(function (x) { return x.r.cat === "Middle"; }).length;
    var worst = rows.filter(function (x) { return x.r.cat === "Worst"; }).length;
    var nol = rows.filter(function (x) { return x.r.pct === 0; }).length;

    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    var W = 595;
    doc.setFillColor(15, 26, 48); doc.rect(0, 0, W, 60, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(15); doc.setFont("helvetica", "bold");
    doc.text("DASHBOARD AKTIVITAS STATION — Service Management SJNAM", W / 2, 26, { align: "center" });
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text("Periode: " + mo.label + " | Generated: " + new Date().toLocaleString("id-ID"), W / 2, 44, { align: "center" });

    doc.setTextColor(15, 23, 42);
    var kpiRows = [
      ["Station Aktif", String(aktif)], ["Rata-rata Hari Lapor", rata.toFixed(1)],
      ["Kategori Better", String(better)], ["Kategori Middle", String(middle)],
      ["Kategori Worst", String(worst)], ["Tidak Lapor (0%)", String(nol)]
    ];
    doc.autoTable({ startY: 74, head: [["KPI", "Nilai"]], body: kpiRows, styles: { fontSize: 9 }, headStyles: { fillColor: [15, 26, 48] }, margin: { left: 40, right: 40 }, tableWidth: 250 });

    var pieCanvas = document.getElementById("srActPieChart"), barCanvas = document.getElementById("srActBarChart");
    var afterKpiY = doc.lastAutoTable.finalY + 14;
    try {
      if (pieCanvas) { var pieImg = pieCanvas.toDataURL("image/png"); doc.addImage(pieImg, "PNG", 320, 74, 200, 130); }
    } catch (e) { console.warn("[Dashboard PDF] pie chart embed gagal", e); }

    var tableRows = rows.map(function (x, i) { return [i + 1, x.d, fmtPct(x.r.pct), x.r.cat]; });
    doc.autoTable({
      startY: afterKpiY + 140, head: [["#", "Station", "Kepatuhan", "Kategori"]], body: tableRows,
      styles: { fontSize: 8 }, headStyles: { fillColor: [15, 26, 48] },
      didParseCell: function (data) {
        if (data.section === "body" && data.column.index === 3) {
          var cat = data.cell.raw;
          var map = { Better: [228, 247, 239], Middle: [253, 243, 223], Worst: [252, 230, 231], Tutup: [238, 240, 244] };
          if (map[cat]) data.cell.styles.fillColor = map[cat];
        }
      }
    });
    doc.save("Dashboard_Aktivitas_Station_" + mo.y + "-" + String(mo.m).padStart(2, "0") + ".pdf");
  }

  /* ── Export PDF/Excel untuk sub-tab Rekap Bulanan ── */
  function exportRekapExcel() {
    if (!window.XLSX) return void ("function" == typeof window.showToast && window.showToast("XLSX tidak tersedia", "error"));
    var monthsInYear = srActMonths.filter(function (x) { return x.y === srActRekapYear; });
    var rows = STATION_LIST.map(function (d) {
      var row = { Station: d };
      monthsInYear.forEach(function (mo) {
        var r = computeDistrikMonth(d, mo.y, mo.m);
        row[MONTH_NAMES[mo.m - 1]] = srActRekapMode === "count" ? (r.pct === null ? "-" : r.lapor) : fmtPct(r.pct);
      });
      return row;
    });
    var ws = XLSX.utils.json_to_sheet(rows), wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap " + srActRekapYear);
    XLSX.writeFile(wb, "Rekap_Bulanan_Station_" + srActRekapYear + (srActRekapMode === "count" ? "_JumlahLapor" : "_Kepatuhan") + ".xlsx");
  }

  function exportRekapPdf() {
    if (!window.jspdf) return void ("function" == typeof window.showToast && window.showToast("Library PDF tidak tersedia", "error"));
    var monthsInYear = srActMonths.filter(function (x) { return x.y === srActRekapYear; });
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    var W = 842;
    doc.setFillColor(15, 26, 48); doc.rect(0, 0, W, 55, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("REKAP BULANAN STATION — Tahun " + srActRekapYear + " (" + (srActRekapMode === "count" ? "Jumlah Hari Lapor" : "Kepatuhan %") + ")", W / 2, 24, { align: "center" });
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text("Generated: " + new Date().toLocaleString("id-ID"), W / 2, 40, { align: "center" });

    var head = ["Station"].concat(monthsInYear.map(function (mo) { return MONTH_NAMES[mo.m - 1].slice(0, 3); }));
    var catMap = {};
    var body = STATION_LIST.map(function (d) {
      var row = [d];
      monthsInYear.forEach(function (mo) {
        var r = computeDistrikMonth(d, mo.y, mo.m);
        catMap[d + "|" + mo.y + "|" + mo.m] = r.cat;
        row.push(srActRekapMode === "count" ? (r.pct === null ? "-" : r.lapor) : fmtPct(r.pct));
      });
      return row;
    });
    doc.autoTable({
      startY: 68, head: [head], body: body, styles: { fontSize: 7 }, headStyles: { fillColor: [15, 26, 48] },
      didParseCell: function (data) {
        if (data.section === "body" && data.column.index > 0 && srActRekapMode === "pct") {
          var d = STATION_LIST[data.row.index], mo = monthsInYear[data.column.index - 1];
          if (!mo) return;
          var cat = catMap[d + "|" + mo.y + "|" + mo.m];
          var map = { Better: [228, 247, 239], Middle: [253, 243, 223], Worst: [252, 230, 231], Tutup: [238, 240, 244] };
          if (map[cat]) data.cell.styles.fillColor = map[cat];
        }
      }
    });
    doc.save("Rekap_Bulanan_Station_" + srActRekapYear + (srActRekapMode === "count" ? "_JumlahLapor" : "_Kepatuhan") + ".pdf");
  }

  function parseActDate(raw) {
    if (!raw || String(raw).trim() === "") return "";
    var s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (raw instanceof Date && !isNaN(raw)) return raw.toISOString().slice(0, 10);
    if (!isNaN(Number(s)) && Number(s) > 20000 && Number(s) < 90000 && window.XLSX && XLSX.SSF) {
      try {
        var d0 = XLSX.SSF.parse_date_code(Number(s));
        if (d0 && d0.y && d0.m && d0.d) return d0.y + "-" + String(d0.m).padStart(2, "0") + "-" + String(d0.d).padStart(2, "0");
      } catch (e) {}
    }
    var m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) {
      var d = parseInt(m[1], 10), mo = parseInt(m[2], 10), yr = m[3].length === 2 ? "20" + m[3] : m[3];
      if (mo > 12 && d <= 12) { var t = d; d = mo; mo = t; }
      return yr + "-" + String(mo).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    }
    var dt = new Date(s);
    if (!isNaN(dt) && dt.getFullYear() > 2000 && dt.getFullYear() < 2100) return dt.toISOString().slice(0, 10);
    return "";
  }

  function normalizeActStatus(raw) {
    var s = String(raw || "").trim().toLowerCase();
    if (!s) return "";
    if (s === "l" || s === "lapor" || s === "yes" || s === "y" || s === "1") return "Lapor";
    if (s === "tl" || s === "tidak lapor" || s === "no" || s === "n" || s === "0" || s === "tidaklapor") return "Tidak Lapor";
    if (s === "t" || s === "tutup" || s === "closed" || s === "close") return "Tutup";
    return "";
  }

  function importActivityExcel(file) {
    if (!window.XLSX) return void ("function" == typeof window.showToast && window.showToast("Library XLSX belum termuat", "error"));
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var wb = XLSX.read(ev.target.result, { type: "binary", cellDates: true });
        var wsName = wb.SheetNames.find(function (n) { return /data/i.test(n); }) || wb.SheetNames[0];
        var ws = wb.Sheets[wsName];
        var rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
        if (!rows.length) return void ("function" == typeof window.showToast && window.showToast("File Excel kosong atau format tidak dikenali", "error"));

        function col(row, names) {
          var keys = Object.keys(row);
          for (var i = 0; i < names.length; i++) {
            var nl = names[i].toLowerCase();
            var exact = keys.find(function (k) { return k.trim().toLowerCase() === nl; });
            if (exact !== undefined) return row[exact];
          }
          for (var j = 0; j < names.length; j++) {
            var nl2 = names[j].toLowerCase();
            var partial = keys.find(function (k) { return k.trim().toLowerCase().includes(nl2); });
            if (partial !== undefined) return row[partial];
          }
          return "";
        }

        var added = 0, updated = 0, skipped = 0, newStations = [], errors = [];
        var existing = getActivityData();
        rows.forEach(function (row, idx) {
          var rowNum = idx + 2;
          var vals = Object.values(row).map(function (v) { return String(v || "").trim(); }).filter(Boolean);
          if (!vals.length) return;
          var dateRaw = col(row, ["tanggal", "tgl", "date"]);
          var dateVal = parseActDate(dateRaw);
          var stationRaw = String(col(row, ["station", "distrik", "stasiun"]) || "").trim();
          var statusRaw = col(row, ["status"]);
          var status = normalizeActStatus(statusRaw);
          var keterangan = String(col(row, ["keterangan", "catatan", "note", "remark"]) || "").trim();
          if (!dateVal) { errors.push("Baris " + rowNum + ": tanggal tidak valid (\"" + dateRaw + "\")"); skipped++; return; }
          if (!stationRaw) { errors.push("Baris " + rowNum + ": station/distrik kosong"); skipped++; return; }
          if (!status) { errors.push("Baris " + rowNum + ": status harus Lapor/Tidak Lapor/Tutup (ditemukan: \"" + statusRaw + "\")"); skipped++; return; }
          if (!STATION_LIST.some(function (s) { return s.toLowerCase() === stationRaw.toLowerCase(); })) {
            STATION_LIST.push(stationRaw);
            newStations.push(stationRaw);
          }
          var idxExisting = existing.findIndex(function (r) { return r.tanggal === dateVal && r.distrik === stationRaw; });
          var entry = {
            id: idxExisting > -1 ? existing[idxExisting].id : genId("act"),
            tanggal: dateVal, distrik: stationRaw, status: status, keterangan: keterangan,
            updatedAt: new Date().toISOString(),
            updatedBy: (window.currentUser && (window.currentUser.name || window.currentUser.username)) || ""
          };
          if (idxExisting > -1) { existing[idxExisting] = entry; updated++; } else { existing.push(entry); added++; }
        });

        if (!added && !updated) {
          var msg = "Import gagal: " + skipped + " baris dilewati.";
          if (errors.length) msg += "\n\nDetail:\n" + errors.slice(0, 8).join("\n") + (errors.length > 8 ? "\n... dan " + (errors.length - 8) + " baris lainnya" : "");
          msg += "\n\n💡 Format kolom yang dikenali: Tanggal, Station/Distrik, Status (Lapor/Tidak Lapor/Tutup), Keterangan (opsional).";
          "function" == typeof window.showToast && window.showToast("Import gagal — lihat detail", "error");
          setTimeout(function () { alert(msg); }, 100);
          return;
        }

        var confirmMsg = "Akan menambahkan " + added + " data baru" + (updated ? " dan memperbarui " + updated + " data yang sudah ada" : "") + "." +
          (skipped ? "\n⚠️ " + skipped + " baris dilewati (tidak valid)." : "") +
          (newStations.length ? "\n➕ " + newStations.length + " station baru akan ditambahkan ke daftar: " + newStations.join(", ") : "") +
          "\n\nLanjutkan?";
        (window.showConfirm ? window.showConfirm("Import Excel Activity Report", confirmMsg) : Promise.resolve(confirm(confirmMsg))).then(function (ok) {
          if (!ok) { STATION_LIST = STATION_LIST.filter(function (s) { return newStations.indexOf(s) === -1; }); return; }
          saveActivityData(existing);
          if (newStations.length) { STATION_LIST.sort(function (a, b) { return a.localeCompare(b); }); saveStationList(); }
          renderActivityGrid();
          rebuildActMonths(true);
          renderMonthSelect();
          renderPulseStrip();
          var successMsg = "✅ Import berhasil: " + added + " data baru" + (updated ? ", " + updated + " diperbarui" : "");
          if (skipped) successMsg += ", " + skipped + " baris tidak valid";
          "function" == typeof window.showToast && window.showToast(successMsg, "success");
          if (errors.length) console.warn("[Activity Import] Baris tidak valid:\n", errors.join("\n"));
        });
      } catch (err) {
        "function" == typeof window.showToast && window.showToast("Gagal membaca file Excel: " + err.message, "error");
        console.error("[Activity Import]", err);
      }
    };
    reader.readAsBinaryString(file);
  }

  function initActivityReportEvents() {
    ensureActivityStyles();
    rebuildActMonths(false);

    document.querySelectorAll("[data-sract-subtab]").forEach(function (b) {
      b.addEventListener("click", function () { switchActSubtab(b.dataset.sractSubtab); });
    });

    document.getElementById("srActMonthSelect")?.addEventListener("change", function (e) {
      srActCurMonthIdx = parseInt(e.target.value, 10) || 0;
      renderPulseStrip(); renderDashboard();
    });
    document.getElementById("srActPrevMonth")?.addEventListener("click", function () {
      if (srActCurMonthIdx > 0) { srActCurMonthIdx--; renderMonthSelect(); renderPulseStrip(); renderDashboard(); }
    });
    document.getElementById("srActNextMonth")?.addEventListener("click", function () {
      if (srActCurMonthIdx < srActMonths.length - 1) { srActCurMonthIdx++; renderMonthSelect(); renderPulseStrip(); renderDashboard(); }
    });

    document.getElementById("srActRekapSeg")?.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-mode]");
      if (!btn) return;
      srActRekapMode = btn.dataset.mode;
      document.querySelectorAll("#srActRekapSeg button").forEach(function (b) { b.classList.toggle("active", b === btn); });
      renderRekap();
    });
    document.getElementById("srActYearTabs")?.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-sr-act-year]");
      if (!btn) return;
      srActRekapYear = parseInt(btn.dataset.srActYear, 10);
      renderRekap();
    });

    var dateInput = document.getElementById("srActDate");
    if (dateInput && !dateInput._srBound) {
      dateInput._srBound = true;
      dateInput.addEventListener("change", renderActivityGrid);
    }
    document.getElementById("btnSrActToday")?.addEventListener("click", function () {
      var d = document.getElementById("srActDate");
      if (d) { d.value = todayStr(); renderActivityGrid(); }
    });
    document.getElementById("srActTableBody")?.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-sr-act-status]");
      if (!btn) return;
      var distrik = btn.dataset.srActDistrik, status = btn.dataset.srActStatus;
      var date = document.getElementById("srActDate")?.value || todayStr();
      var noteInput = document.querySelector('[data-sr-act-note="' + CSS.escape(distrik) + '"]');
      upsertActEntry(date, distrik, status, noteInput ? noteInput.value.trim() : "");
      renderActivityGrid();
      rebuildActMonths(true);
      "function" == typeof window.showToast && window.showToast(distrik + " → " + status, "success");
    });
    document.getElementById("srActTableBody")?.addEventListener("change", function (e) {
      var input = e.target.closest("[data-sr-act-note]");
      if (!input) return;
      var distrik = input.dataset.srActNote;
      var date = document.getElementById("srActDate")?.value || todayStr();
      var existing = findActEntry(date, distrik);
      if (existing) upsertActEntry(date, distrik, existing.status, input.value.trim());
    });
    document.getElementById("srActHistoryBody")?.addEventListener("click", async function (e) {
      var delId = e.target.closest("[data-sr-act-del]")?.dataset.srActDel;
      if (!delId) return;
      if (window.showConfirm && !(await window.showConfirm("Hapus Data", "Hapus entri activity report ini?"))) return;
      var list = getActivityData().filter(function (r) { return r.id !== delId; });
      saveActivityData(list);
      renderActivityGrid();
      rebuildActMonths(true);
      "function" == typeof window.showToast && window.showToast("Data dihapus", "success");
    });
    document.getElementById("srActHistorySearch")?.addEventListener("input", renderActivityHistory);
    document.getElementById("btnSrActExportExcel")?.addEventListener("click", function () {
      if (!window.XLSX) return void ("function" == typeof window.showToast && window.showToast("XLSX tidak tersedia", "error"));
      var rows = getActivityData()
        .sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : -1; })
        .map(function (r, i) {
          return { No: i + 1, Tanggal: r.tanggal, Station: r.distrik, Status: r.status, Keterangan: r.keterangan || "" };
        });
      if (!rows.length) return void ("function" == typeof window.showToast && window.showToast("Belum ada data untuk di-export", "error"));
      var ws = XLSX.utils.json_to_sheet(rows), wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Activity Report");
      XLSX.writeFile(wb, "Activity_Report_" + todayStr() + ".xlsx");
    });

    document.getElementById("btnSrActAddStation")?.addEventListener("click", openAddStationModal);
    document.getElementById("btnSrActDownloadTemplate")?.addEventListener("click", function () {
      if (!window.XLSX) return void ("function" == typeof window.showToast && window.showToast("Library XLSX belum termuat", "error"));
      var sample = STATION_LIST.slice(0, 3);
      var today = todayStr();
      var rows = [
        { Tanggal: today, Station: sample[0] || "Ujung Pandang (UPG)", Status: "Lapor", Keterangan: "" },
        { Tanggal: today, Station: sample[1] || "Sorong (SOQ)", Status: "Tidak Lapor", Keterangan: "" },
        { Tanggal: today, Station: sample[2] || "Jayapura (DJJ)", Status: "Tutup", Keterangan: "Station tutup sementara" }
      ];
      var ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch: 12 }, { wch: 26 }, { wch: 14 }, { wch: 30 }];
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Data");
      XLSX.writeFile(wb, "Template_Import_ActivityReport.xlsx");
      "function" == typeof window.showToast && window.showToast("Template Excel didownload — isi kolom sesuai contoh", "success");
    });
    document.getElementById("srActImportExcelInput")?.addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (file) importActivityExcel(file);
      e.target.value = "";
    });
    document.getElementById("srActTableBody")?.addEventListener("click", async function (e) {
      var delName = e.target.closest("[data-sr-act-station-del]")?.dataset.srActStationDel;
      if (!delName) return;
      if (window.showConfirm && !(await window.showConfirm("Hapus Station", 'Hapus station "' + delName + '" dari daftar Activity Report? Riwayat data yang sudah ada untuk station ini tetap tersimpan, hanya tidak akan muncul lagi di form input.'))) return;
      removeStationFromList(delName);
      renderActivityGrid();
      rebuildActMonths(true);
      renderMonthSelect();
      renderPulseStrip();
      "function" == typeof window.showToast && window.showToast("Station dihapus dari daftar", "success");
    });

    document.getElementById("btnSrActDashExportExcel")?.addEventListener("click", exportDashboardExcel);
    document.getElementById("btnSrActDashExportPdf")?.addEventListener("click", exportDashboardPdf);
    document.getElementById("btnSrActRekapExportExcel")?.addEventListener("click", exportRekapExcel);
    document.getElementById("btnSrActRekapExportPdf")?.addEventListener("click", exportRekapPdf);

    // Tampilan awal: Dashboard
    switchActSubtab("dashboard");
  }

  /* ============================== CHECK-IN REPORT ============================== */
  function getCiData() { return load(LS_CI, []); }
  function saveCiData(list) { persist(LS_CI, list); }

  function populateStationSelect(selectId) {
    var sel = document.getElementById(selectId);
    if (!sel) return;
    var cur = sel.value;
    var stations = getBankStationList();
    sel.innerHTML = '<option value="">-- Pilih Station --</option>' + stations.map(function (s) {
      return '<option value="' + esc(s.iata) + '">' + esc(s.iata) + ' — ' + esc(s.name) + '</option>';
    }).join("");
    if (stations.some(function (s) { return s.iata === cur; })) sel.value = cur;
  }

  function renderCiTable() {
    var body = document.getElementById("srCiTableBody");
    if (!body) return;
    var search = (document.getElementById("srCiSearch")?.value || "").toLowerCase();
    var list = getCiData()
      .filter(function (r) { return !search || (r.flight || "").toLowerCase().includes(search) || (r.station || "").toLowerCase().includes(search); })
      .sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : -1; });
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="8" class="text-center py-8 text-slate-400 text-sm">Belum ada data.</td></tr>';
      return;
    }
    body.innerHTML = list.map(function (r) {
      return '<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">' +
        '<td class="px-3 py-2 text-xs whitespace-nowrap">' + esc(fmtDate(r.tanggal)) + '</td>' +
        '<td class="px-3 py-2"><span class="badge bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">' + esc(r.station || "-") + '</span></td>' +
        '<td class="px-3 py-2 font-mono text-sm">' + esc(r.flight || "-") + '</td>' +
        '<td class="px-3 py-2 font-mono text-xs">' + esc(r.open || "-") + '</td>' +
        '<td class="px-3 py-2 font-mono text-xs">' + esc(r.close || "-") + '</td>' +
        '<td class="px-3 py-2 text-right">' + (r.pax || 0) + '</td>' +
        '<td class="px-3 py-2 text-xs text-slate-500 max-w-[160px] truncate" title="' + esc(r.note || "") + '">' + esc(r.note || "-") + '</td>' +
        '<td class="px-3 py-2 text-right"><button data-sr-ci-del="' + r.id + '" class="text-red-600 hover:underline text-xs">Hapus</button></td>' +
        '</tr>';
    }).join("");
  }

  function initCheckinReportEvents() {
    document.getElementById("btnSrCiSave")?.addEventListener("click", function () {
      var date = document.getElementById("srCiDate")?.value;
      var station = document.getElementById("srCiStation")?.value;
      var flight = (document.getElementById("srCiFlight")?.value || "").trim().toUpperCase();
      var open = document.getElementById("srCiOpen")?.value;
      var close = document.getElementById("srCiClose")?.value;
      var pax = parseInt(document.getElementById("srCiPax")?.value) || 0;
      var note = (document.getElementById("srCiNote")?.value || "").trim();
      if (!date || !station || !flight) return void ("function" == typeof window.showToast && window.showToast("Lengkapi: Tanggal, Station, Flight", "error"));
      var list = getCiData();
      list.unshift({ id: genId("ci"), tanggal: date, station: station, flight: flight, open: open, close: close, pax: pax, note: note, inputBy: (window.currentUser && (window.currentUser.name || window.currentUser.username)) || "" });
      saveCiData(list);
      renderCiTable();
      ["srCiFlight", "srCiOpen", "srCiClose", "srCiPax", "srCiNote"].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ""; });
      "function" == typeof window.showToast && window.showToast("Check-In Report disimpan", "success");
    });
    document.getElementById("srCiTableBody")?.addEventListener("click", async function (e) {
      var delId = e.target.closest("[data-sr-ci-del]")?.dataset.srCiDel;
      if (!delId) return;
      if (window.showConfirm && !(await window.showConfirm("Hapus Data", "Hapus data check-in report ini?"))) return;
      saveCiData(getCiData().filter(function (r) { return r.id !== delId; }));
      renderCiTable();
    });
    document.getElementById("srCiSearch")?.addEventListener("input", renderCiTable);
    document.getElementById("btnSrCiExportExcel")?.addEventListener("click", function () {
      if (!window.XLSX) return void ("function" == typeof window.showToast && window.showToast("XLSX tidak tersedia", "error"));
      var rows = getCiData().map(function (r, i) {
        return { No: i + 1, Tanggal: r.tanggal, Station: r.station, Flight: r.flight, "Check-In Open": r.open, "Check-In Close": r.close, Pax: r.pax, Catatan: r.note || "" };
      });
      if (!rows.length) return void ("function" == typeof window.showToast && window.showToast("Belum ada data untuk di-export", "error"));
      var ws = XLSX.utils.json_to_sheet(rows), wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Check-In Report");
      XLSX.writeFile(wb, "CheckIn_Report_" + todayStr() + ".xlsx");
    });
  }

  /* ============================== FIRST BAG LAST BAG REPORT ============================== */
  function getFlbData() { return load(LS_FLB, []); }
  function saveFlbData(list) { persist(LS_FLB, list); }

  function minutesBetween(a, b) {
    if (!a || !b) return null;
    var pa = a.split(":").map(Number), pb = b.split(":").map(Number);
    var mA = pa[0] * 60 + pa[1], mB = pb[0] * 60 + pb[1];
    var d = mB - mA;
    if (d < 0) d += 24 * 60;
    return d;
  }

  function renderFlbTable() {
    var body = document.getElementById("srFlbTableBody");
    if (!body) return;
    var search = (document.getElementById("srFlbSearch")?.value || "").toLowerCase();
    var list = getFlbData()
      .filter(function (r) { return !search || (r.flight || "").toLowerCase().includes(search) || (r.station || "").toLowerCase().includes(search); })
      .sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : -1; });
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="9" class="text-center py-8 text-slate-400 text-sm">Belum ada data.</td></tr>';
      return;
    }
    body.innerHTML = list.map(function (r) {
      var durasi = minutesBetween(r.first, r.last);
      return '<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">' +
        '<td class="px-3 py-2 text-xs whitespace-nowrap">' + esc(fmtDate(r.tanggal)) + '</td>' +
        '<td class="px-3 py-2"><span class="badge bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">' + esc(r.station || "-") + '</span></td>' +
        '<td class="px-3 py-2 font-mono text-sm">' + esc(r.flight || "-") + '</td>' +
        '<td class="px-3 py-2 font-mono text-xs">' + esc(r.first || "-") + '</td>' +
        '<td class="px-3 py-2 font-mono text-xs">' + esc(r.last || "-") + '</td>' +
        '<td class="px-3 py-2 text-xs">' + (durasi != null ? durasi + " menit" : "-") + '</td>' +
        '<td class="px-3 py-2 text-right">' + (r.total || 0) + '</td>' +
        '<td class="px-3 py-2 text-xs text-slate-500 max-w-[160px] truncate" title="' + esc(r.note || "") + '">' + esc(r.note || "-") + '</td>' +
        '<td class="px-3 py-2 text-right"><button data-sr-flb-del="' + r.id + '" class="text-red-600 hover:underline text-xs">Hapus</button></td>' +
        '</tr>';
    }).join("");
  }

  function initBagReportEvents() {
    document.getElementById("btnSrFlbSave")?.addEventListener("click", function () {
      var date = document.getElementById("srFlbDate")?.value;
      var station = document.getElementById("srFlbStation")?.value;
      var flight = (document.getElementById("srFlbFlight")?.value || "").trim().toUpperCase();
      var first = document.getElementById("srFlbFirst")?.value;
      var last = document.getElementById("srFlbLast")?.value;
      var total = parseInt(document.getElementById("srFlbTotal")?.value) || 0;
      var note = (document.getElementById("srFlbNote")?.value || "").trim();
      if (!date || !station || !flight) return void ("function" == typeof window.showToast && window.showToast("Lengkapi: Tanggal, Station, Flight", "error"));
      var list = getFlbData();
      list.unshift({ id: genId("flb"), tanggal: date, station: station, flight: flight, first: first, last: last, total: total, note: note, inputBy: (window.currentUser && (window.currentUser.name || window.currentUser.username)) || "" });
      saveFlbData(list);
      renderFlbTable();
      ["srFlbFlight", "srFlbFirst", "srFlbLast", "srFlbTotal", "srFlbNote"].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ""; });
      "function" == typeof window.showToast && window.showToast("First Bag Last Bag Report disimpan", "success");
    });
    document.getElementById("srFlbTableBody")?.addEventListener("click", async function (e) {
      var delId = e.target.closest("[data-sr-flb-del]")?.dataset.srFlbDel;
      if (!delId) return;
      if (window.showConfirm && !(await window.showConfirm("Hapus Data", "Hapus data ini?"))) return;
      saveFlbData(getFlbData().filter(function (r) { return r.id !== delId; }));
      renderFlbTable();
    });
    document.getElementById("srFlbSearch")?.addEventListener("input", renderFlbTable);
    document.getElementById("btnSrFlbExportExcel")?.addEventListener("click", function () {
      if (!window.XLSX) return void ("function" == typeof window.showToast && window.showToast("XLSX tidak tersedia", "error"));
      var rows = getFlbData().map(function (r, i) {
        return { No: i + 1, Tanggal: r.tanggal, Station: r.station, Flight: r.flight, "First Bag": r.first, "Last Bag": r.last, "Total Bag": r.total, Catatan: r.note || "" };
      });
      if (!rows.length) return void ("function" == typeof window.showToast && window.showToast("Belum ada data untuk di-export", "error"));
      var ws = XLSX.utils.json_to_sheet(rows), wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "First Last Bag");
      XLSX.writeFile(wb, "FirstLastBag_Report_" + todayStr() + ".xlsx");
    });
  }

/* ============================== INIT / DETEKSI TAB AKTIF (independen dari window.switchTab) ============================== */
  var initedAct = false, initedCi = false, initedFlb = false;
  var TAB_SECTION_MAP = {
    "tab-station-activity": "station-activity",
    "tab-station-checkin": "station-checkin",
    "tab-station-bagreport": "station-bagreport"
  };

  function onTabOpen(tab) {
    if (tab === "station-activity") {
      var d = document.getElementById("srActDate");
      if (d && !d.value) d.value = todayStr();
      if (!initedAct) { initActivityReportEvents(); initedAct = true; }
      else switchActSubtab(srActCurrentSubtab);
    }
    if (tab === "station-checkin") {
      if (!initedCi) { initCheckinReportEvents(); initedCi = true; }
      var dCi = document.getElementById("srCiDate");
      if (dCi && !dCi.value) dCi.value = todayStr();
      populateStationSelect("srCiStation");
      renderCiTable();
    }
    if (tab === "station-bagreport") {
      if (!initedFlb) { initBagReportEvents(); initedFlb = true; }
      var dFlb = document.getElementById("srFlbDate");
      if (dFlb && !dFlb.value) dFlb.value = todayStr();
      populateStationSelect("srFlbStation");
      renderFlbTable();
    }
  }

  // Sistem switchTab di aplikasi ini dibungkus berlapis-lapis oleh banyak
  // file (drygoods.js, patch, dsb). Alih-alih menggantungkan aktivasi tab
  // Station Report pada rantai window.switchTab yang rapuh itu, kita amati
  // langsung DOM: begitu section tab-pane terkait mendapat class "active",
  // baru kita jalankan inisialisasi/refresh. Ini bekerja terlepas dari
  // bagaimana switchTab dibungkus di file lain.
  function watchTabSections() {
    var sections = Object.keys(TAB_SECTION_MAP).map(function (id) { return document.getElementById(id); }).filter(Boolean);
    if (!sections.length) return false;
    sections.forEach(function (sec) {
      if (sec._srObserved) return;
      sec._srObserved = true;
      if (sec.classList.contains("active")) onTabOpen(TAB_SECTION_MAP[sec.id]);
      new MutationObserver(function () {
        if (sec.classList.contains("active")) onTabOpen(TAB_SECTION_MAP[sec.id]);
      }).observe(sec, { attributes: true, attributeFilter: ["class"] });
    });
    return true;
  }

  // Jalur cepat tambahan: klik langsung pada tombol sidebar Station Report.
  // Bersifat redundan/aman untuk dipanggil berkali-kali (semua fungsi render
  // di modul ini idempotent, cukup baca ulang dari localStorage).
  function bindSidebarShortcuts() {
    Object.keys(TAB_SECTION_MAP).forEach(function (secId) {
      var tab = TAB_SECTION_MAP[secId];
      document.querySelectorAll('[data-tab="' + tab + '"]').forEach(function (btn) {
        if (btn._srBoundClick) return;
        btn._srBoundClick = true;
        btn.addEventListener("click", function () {
          setTimeout(function () { onTabOpen(tab); }, 0);
        });
      });
    });
  }

  document.addEventListener("sjn:tab-changed", function (e) {
    var tab = e && e.detail && e.detail.tab;
    if (tab === "station-activity" || tab === "station-checkin" || tab === "station-bagreport") onTabOpen(tab);
  });

  document.addEventListener("DOMContentLoaded", function () {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      var ok = watchTabSections();
      bindSidebarShortcuts();
      if (ok || tries > 60) clearInterval(iv);
    }, 250);

    // Jika tab Station Report sedang aktif saat reload/restore session
    setTimeout(function () {
      var currentTab = localStorage.getItem("sjnam_current_tab") || "";
      if (currentTab.indexOf("station-") === 0) onTabOpen(currentTab);
    }, 800);
  }, { once: true });

  window.STATION_REPORT = {
    getActivityData: getActivityData,
    getCheckinData: getCiData,
    getBagReportData: getFlbData,
    MASTER_DISTRIK: MASTER_DISTRIK,
    getStationList: function () { return STATION_LIST.slice(); }
  };

  console.info("%c[SJNAM] Station Report module loaded: Activity / Check-In / First-Last Bag", "color:#16a34a;font-weight:bold;font-size:11px");
}();
