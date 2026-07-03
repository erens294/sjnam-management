/* ================================================================
   SJNAM — STATION REPORT
   ================================================================
   Grup tab baru: Activity Report, Check-In Report, First Bag Last
   Bag Report. Daftar distrik pada Activity Report diambil dari
   Master Distrik (28 distrik) sesuai file Excel
   "Distrik_Activity_Dashboard2.xlsx" yang dilampirkan — supaya
   pengisian tetap konsisten dengan skema pelaporan yang sudah ada
   (Tanggal, Distrik, Status: Lapor / Tidak Lapor / Tutup,
   Keterangan opsional).

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

  // ── Master Distrik (28 distrik, sesuai Master Distrik pada file Excel) ──
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
  function getActivityData() { return load(LS_ACT, []); }
  function saveActivityData(list) { persist(LS_ACT, list); }

  function actKeyOf(date, distrik) { return date + "|" + distrik; }

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

  function renderActivityGrid() {
    var tbody = document.getElementById("srActTableBody");
    if (!tbody) return;
    var dateInput = document.getElementById("srActDate");
    var date = dateInput && dateInput.value ? dateInput.value : todayStr();
    if (dateInput && !dateInput.value) dateInput.value = date;

    var filled = 0;
    tbody.innerHTML = MASTER_DISTRIK.map(function (distrik, i) {
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
        '</tr>';
    }).join("");

    var progEl = document.getElementById("srActProgress");
    if (progEl) progEl.textContent = filled + " / " + MASTER_DISTRIK.length + " distrik sudah diisi untuk tanggal ini";

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

  function initActivityReportEvents() {
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
      "function" == typeof window.showToast && window.showToast("Data dihapus", "success");
    });
    document.getElementById("srActHistorySearch")?.addEventListener("input", renderActivityHistory);
    document.getElementById("btnSrActExportExcel")?.addEventListener("click", function () {
      if (!window.XLSX) return void ("function" == typeof window.showToast && window.showToast("XLSX tidak tersedia", "error"));
      var rows = getActivityData()
        .sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : -1; })
        .map(function (r, i) {
          return { No: i + 1, Tanggal: r.tanggal, Distrik: r.distrik, Status: r.status, Keterangan: r.keterangan || "" };
        });
      if (!rows.length) return void ("function" == typeof window.showToast && window.showToast("Belum ada data untuk di-export", "error"));
      var ws = XLSX.utils.json_to_sheet(rows), wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Activity Report");
      XLSX.writeFile(wb, "Activity_Report_" + todayStr() + ".xlsx");
    });
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

  /* ============================== INIT / HOOK KE switchTab ============================== */
  var initedAct = false, initedCi = false, initedFlb = false;

  function onTabOpen(tab) {
    if (tab === "station-activity") {
      if (!initedAct) { initActivityReportEvents(); initedAct = true; }
      var d = document.getElementById("srActDate");
      if (d && !d.value) d.value = todayStr();
      renderActivityGrid();
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

  function hookSwitchTab() {
    var orig = window.switchTab;
    if (typeof orig !== "function" || orig._srHooked) return false;
    window.switchTab = function (tab) {
      var r = orig.apply(this, arguments);
      onTabOpen(tab);
      return r;
    };
    window.switchTab._srHooked = true;
    return true;
  }

  document.addEventListener("DOMContentLoaded", function () {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (hookSwitchTab() || tries > 60) clearInterval(iv);
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
    MASTER_DISTRIK: MASTER_DISTRIK
  };

  console.info("%c[SJNAM] Station Report module loaded: Activity / Check-In / First-Last Bag", "color:#16a34a;font-weight:bold;font-size:11px");
}();
