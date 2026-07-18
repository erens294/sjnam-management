/* ================================================================
   SJNAM — BAGGAGE REPORT (Entry & Dashboard)
   ================================================================
   Modul baru di grup "Station Report" untuk mencatat kasus bagasi
   (rusak/hilang/tertinggal/dll) berikut biaya klaimnya — dari sheet
   "Baggage" pada file data yang diberikan (sheet "Bank" diabaikan).

   Memakai infrastruktur sinkronisasi cloud yang SUDAH disiapkan
   sebelumnya di shared-utils.js (bucket "baggage_data", key
   localStorage "sjnam_baggage_v1", format {records:[...]}, sudah
   termasuk tombstone & deteksi konflik yang benar — pelajaran dari
   semua bug yang pernah kita perbaiki sebelumnya di modul lain).

   Pola UI & perilaku sengaja dibuat KONSISTEN dengan modul yang
   sudah ada:
   - Struktur Entry (form + tabel + cari/filter + hapus) meniru pola
     Check-In Report (station-report.js).
   - Struktur Dashboard (KPI grid + beberapa chart) meniru pola
     Dashboard Service Recovery.
   - Setiap simpan/hapus SELALU: (1) stamping _updatedAt/_updatedBy,
     (2) tombstone saat hapus, (3) triggerAutoSync dengan dirtyHint
     yang sudah terdaftar di CLOUD_BUCKETS ("baggageData").
   ================================================================ */
!function () {
  "use strict";

  if (window._baggageReportInit) return;
  window._baggageReportInit = true;

  var LS_KEY = "sjnam_baggage_v1";
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // Warna standar untuk chart apa pun yang membedakan Airlines — berlaku
  // konsisten di seluruh modul (Sriwijaya Air = merah, NAM Air = biru).
  var AIRLINE_COLORS = { SJ: "#DC2626", IN: "#2563EB" };
  function airlineColor(code) { return AIRLINE_COLORS[code] || "#9CA3AF"; }
  var CASE_TYPES = ["HILANG", "HILANG ISI", "OFFLOAD", "PENGANTARAN", "RUSAK", "TERTINGGAL", "UANG TUNGGU"];
  var BAGGAGE_TYPES = ["KOPER", "RANSEL", "FIBER", "KAIN", "KARDUS", "KACA", "BOX CONTAINER", "STROLER", "LAINNYA"];

  function $id(id) { return document.getElementById(id); }
  function genId() { return "bg_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8); }
  function escapeHtml(s) { return (s == null ? "" : String(s)).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmtCurrency(n) { n = Number(n) || 0; return "Rp " + n.toLocaleString("id-ID"); }
  // Data internal TETAP disimpan format YYYY-MM-DD (dipakai untuk sortir,
  // filter Tahun/Bulan, dan <input type="date"> yang memang mewajibkan
  // format ini) — cuma TAMPILANNYA saja yang diubah ke DD-MM-YYYY di sini.
  function formatDateDisplay(iso) {
    if (!iso) return "";
    var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return iso;
    var monthName = MONTHS[Number(m[2]) - 1] || m[2];
    return m[3] + "-" + monthName + "-" + m[1];
  }
  function currentUserName() { return (window.currentUser && (window.currentUser.name || window.currentUser.username)) || "system"; }

  // ── Akses data (format {records:[...]}, PERSIS kontrak yang sudah
  // disiapkan di shared-utils.js — jangan diubah tanpa menyesuaikan
  // logic merge di sana juga) ──
  function getBaggageData() {
    try {
      var raw = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      return raw && Array.isArray(raw.records) ? raw.records : [];
    } catch (e) { return []; }
  }
  function saveBaggageData(list) {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ records: list })); } catch (e) { console.warn("[Baggage] gagal simpan:", e); }
    "function" === typeof window.markDirty && window.markDirty(LS_KEY);
    "function" === typeof window.triggerAutoSync && window.triggerAutoSync("baggageData");
  }

  function showToast(msg, type) { "function" === typeof window.showToast && window.showToast(msg, type); }

  // [BUG DITEMUKAN & DIPERBAIKI] Perbaikan untuk data yang SUDAH TERLANJUR
  // tersimpan salah akibat bug parsing tanggal serial Excel sebelumnya
  // (contoh: "46170-01-01", padahal seharusnya "2026-05-28"). Dijalankan
  // sekali otomatis setiap modul ini dimuat — kalau ketemu data rusak,
  // diperbaiki lalu disimpan ulang (mirip pola "auto-fix on load" yang
  // sudah dipakai di fitur Import Peserta Training sebelumnya).
  function repairCorruptedDates() {
    var list = getBaggageData();
    var fixedCount = 0;
    function fixField(v) {
      var m = String(v || "").match(/^(\d{4,6})-01-01$/);
      if (!m) return v;
      var yearAsSerial = Number(m[1]);
      if (yearAsSerial <= 3000) return v; // tahun wajar, bukan serial yang salah tafsir
      var utcDays = Math.floor(yearAsSerial - 25569);
      var d = new Date(utcDays * 86400 * 1000);
      if (isNaN(d.getTime())) return v;
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    list.forEach(function (r) {
      var newCaseDate = fixField(r.caseDate);
      var newReportDate = fixField(r.reportDate);
      if (newCaseDate !== r.caseDate || newReportDate !== r.reportDate) {
        if (newCaseDate !== r.caseDate) r.caseDate = newCaseDate;
        if (newReportDate !== r.reportDate) r.reportDate = newReportDate;
        var ym = deriveYearMonth(r.caseDate);
        r.year = ym.year; r.month = ym.month;
        r._updatedAt = new Date().toISOString();
        r._updatedBy = currentUserName();
        fixedCount++;
      }
    });
    if (fixedCount > 0) {
      saveBaggageData(list);
      showToast("🔧 " + fixedCount + " data dengan tanggal rusak (bug serial Excel) berhasil diperbaiki otomatis", "success");
    }
  }

  // ================================================================
  // ENTRY: form tambah/edit, tabel, cari/filter, hapus (+tombstone)
  // ================================================================
  var editingId = null;

  function fillDatalist(id, options) {
    var el = $id(id);
    if (!el) return;
    el.innerHTML = options.map(function (o) { return "<option value=\"" + escapeHtml(o) + "\">"; }).join("");
  }

  function resetEntryForm() {
    editingId = null;
    ["bg-case-date", "bg-report-date", "bg-station", "bg-aoc", "bg-flight-no", "bg-route", "bg-qty-pax",
      "bg-pax-name", "bg-booking-code", "bg-tag-number", "bg-weight", "bg-colli", "bg-case-type", "bg-object",
      "bg-baggage-type", "bg-merk", "bg-size", "bg-content", "bg-iom-distrik", "bg-proposed-fee", "bg-iom-service",
      "bg-approval-fee", "bg-charged-to", "bg-charged-to-2nd", "bg-remarks", "bg-case-status", "bg-station-awal",
      "bg-station-akhir"].forEach(function (id) { var el = $id(id); if (el) el.value = ""; });
    var saveBtn = $id("btnBgSaveEntry");
    if (saveBtn) saveBtn.textContent = "💾 Simpan Data";
    var title = $id("bgFormTitle");
    if (title) title.textContent = "🧳 Input Kasus Baggage Baru";
  }

  function fillEntryForm(d) {
    editingId = d.id;
    $id("bg-case-date") && ($id("bg-case-date").value = d.caseDate || "");
    $id("bg-report-date") && ($id("bg-report-date").value = d.reportDate || "");
    $id("bg-station") && ($id("bg-station").value = d.station || "");
    $id("bg-aoc") && ($id("bg-aoc").value = d.aoc || "");
    $id("bg-flight-no") && ($id("bg-flight-no").value = d.flightNo || "");
    $id("bg-route") && ($id("bg-route").value = d.route || "");
    $id("bg-qty-pax") && ($id("bg-qty-pax").value = d.qtyPax || "");
    $id("bg-pax-name") && ($id("bg-pax-name").value = d.paxName || "");
    $id("bg-booking-code") && ($id("bg-booking-code").value = d.bookingCode || "");
    $id("bg-tag-number") && ($id("bg-tag-number").value = d.tagNumber || "");
    $id("bg-weight") && ($id("bg-weight").value = d.weight || "");
    $id("bg-colli") && ($id("bg-colli").value = d.colli || "");
    $id("bg-case-type") && ($id("bg-case-type").value = d.caseType || "");
    $id("bg-object") && ($id("bg-object").value = d.object || "");
    $id("bg-baggage-type") && ($id("bg-baggage-type").value = d.baggageType || "");
    $id("bg-merk") && ($id("bg-merk").value = d.merk || "");
    $id("bg-size") && ($id("bg-size").value = d.size || "");
    $id("bg-content") && ($id("bg-content").value = d.content || "");
    $id("bg-iom-distrik") && ($id("bg-iom-distrik").value = d.iomDistrik || "");
    $id("bg-proposed-fee") && ($id("bg-proposed-fee").value = d.proposedFee || "");
    $id("bg-iom-service") && ($id("bg-iom-service").value = d.iomService || "");
    $id("bg-approval-fee") && ($id("bg-approval-fee").value = d.approvalFee || "");
    $id("bg-charged-to") && ($id("bg-charged-to").value = d.chargedTo || "");
    $id("bg-charged-to-2nd") && ($id("bg-charged-to-2nd").value = d.chargedTo2nd || "");
    $id("bg-remarks") && ($id("bg-remarks").value = d.remarks || "");
    $id("bg-case-status") && ($id("bg-case-status").value = d.caseStatus || "Open");
    $id("bg-station-awal") && ($id("bg-station-awal").value = d.stationAwal || "");
    $id("bg-station-akhir") && ($id("bg-station-akhir").value = d.stationAkhir || "");
    var saveBtn = $id("btnBgSaveEntry");
    if (saveBtn) saveBtn.textContent = "💾 Simpan Perubahan";
    var title = $id("bgFormTitle");
    if (title) title.textContent = "✏️ Edit Kasus Baggage";
  }

  function deriveYearMonth(dateStr) {
    if (!dateStr) return { year: "", month: "" };
    var m = String(dateStr).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) return { year: "", month: "" };
    var mi = parseInt(m[2], 10) - 1;
    return { year: m[1], month: MONTHS[mi] || "" };
  }

  function saveEntryFromForm() {
    var caseDate = ($id("bg-case-date") || {}).value || "";
    var station = (($id("bg-station") || {}).value || "").trim().toUpperCase();
    var flightNo = (($id("bg-flight-no") || {}).value || "").trim().toUpperCase();
    if (!caseDate) return void showToast("Case Date wajib diisi!", "error");
    if (!station) return void showToast("Station wajib diisi!", "error");
    if (!flightNo) return void showToast("Flight No wajib diisi!", "error");

    var ym = deriveYearMonth(caseDate);
    var list = getBaggageData();
    var isEdit = !!editingId;
    var entry = {
      id: editingId || genId(),
      caseDate: caseDate,
      reportDate: ($id("bg-report-date") || {}).value || "",
      station: station,
      aoc: (($id("bg-aoc") || {}).value || "").trim().toUpperCase(),
      flightNo: flightNo,
      route: (($id("bg-route") || {}).value || "").trim().toUpperCase().replace(/\s+/g, ""),
      qtyPax: parseInt(($id("bg-qty-pax") || {}).value, 10) || 0,
      paxName: (($id("bg-pax-name") || {}).value || "").trim(),
      bookingCode: (($id("bg-booking-code") || {}).value || "").trim().toUpperCase(),
      tagNumber: (($id("bg-tag-number") || {}).value || "").trim().toUpperCase(),
      weight: parseFloat(($id("bg-weight") || {}).value) || 0,
      colli: parseInt(($id("bg-colli") || {}).value, 10) || 0,
      caseType: ($id("bg-case-type") || {}).value || "",
      object: (($id("bg-object") || {}).value || "").trim(),
      baggageType: ($id("bg-baggage-type") || {}).value || "",
      merk: (($id("bg-merk") || {}).value || "").trim(),
      size: (($id("bg-size") || {}).value || "").trim(),
      content: (($id("bg-content") || {}).value || "").trim(),
      iomDistrik: (($id("bg-iom-distrik") || {}).value || "").trim(),
      proposedFee: parseFloat(($id("bg-proposed-fee") || {}).value) || 0,
      iomService: (($id("bg-iom-service") || {}).value || "").trim(),
      approvalFee: parseFloat(($id("bg-approval-fee") || {}).value) || 0,
      chargedTo: (($id("bg-charged-to") || {}).value || "").trim(),
      chargedTo2nd: (($id("bg-charged-to-2nd") || {}).value || "").trim(),
      remarks: (($id("bg-remarks") || {}).value || "").trim(),
      caseStatus: ($id("bg-case-status") || {}).value || "Open",
      stationAwal: (($id("bg-station-awal") || {}).value || "").trim().toUpperCase(),
      stationAkhir: (($id("bg-station-akhir") || {}).value || "").trim().toUpperCase(),
      year: ym.year, month: ym.month,
      inputBy: isEdit ? (list.find(function (r) { return r.id === editingId; }) || {}).inputBy || currentUserName() : currentUserName(),
      _updatedAt: new Date().toISOString(),
      _updatedBy: currentUserName()
    };

    if (isEdit) {
      var idx = list.findIndex(function (r) { return r.id === editingId; });
      if (idx > -1) list[idx] = entry; else list.push(entry);
    } else {
      list.push(entry);
    }
    saveBaggageData(list);
    resetEntryForm();
    renderEntryTable();
    showToast(isEdit ? "✅ Data berhasil diperbarui" : "✅ Data berhasil ditambahkan", "success");
  }

  function deleteEntry(id) {
    var doDelete = function () {
      var list = getBaggageData();
      var next = list.filter(function (r) { return r.id !== id; });
      saveBaggageData(next);
      if ("function" === typeof window.markDeletedTombstone) window.markDeletedTombstone("baggage_data", [id]);
      renderEntryTable();
      renderDashboard();
      showToast("🗑️ Data berhasil dihapus", "success");
    };
    if ("function" === typeof window.showConfirm) {
      window.showConfirm("Hapus Data Baggage", "Hapus data kasus baggage ini? Tindakan ini tidak dapat dibatalkan.").then(function (ok) { if (ok) doDelete(); });
    } else if (confirm("Hapus data kasus baggage ini?")) {
      doDelete();
    }
  }

  // Set berisi id baris yang sedang dicentang (untuk "Hapus Terpilih")
  var selectedIds = new Set();

  function deleteMultiple(ids, confirmLabel) {
    if (!ids.length) { showToast("Tidak ada data yang dipilih", "error"); return; }
    var doDelete = function () {
      var idSet = new Set(ids);
      var list = getBaggageData();
      var next = list.filter(function (r) { return !idSet.has(r.id); });
      saveBaggageData(next);
      if ("function" === typeof window.markDeletedTombstone) window.markDeletedTombstone("baggage_data", ids);
      selectedIds.clear();
      renderEntryTable();
      renderDashboard();
      showToast("🗑️ " + ids.length + " data berhasil dihapus", "success");
    };
    var msg = "Hapus " + ids.length + " " + confirmLabel + "? Tindakan ini tidak dapat dibatalkan.";
    if ("function" === typeof window.showConfirm) {
      window.showConfirm("Hapus Data Baggage", msg).then(function (ok) { if (ok) doDelete(); });
    } else if (confirm(msg)) {
      doDelete();
    }
  }

  function deleteSelected() {
    deleteMultiple(Array.from(selectedIds), "data terpilih");
  }
  function deleteAllFiltered() {
    var ids = getFilteredEntries().map(function (r) { return r.id; });
    deleteMultiple(ids, "data sesuai filter yang sedang aktif");
  }
  // Hapus SEMUA data, tanpa peduli filter apa pun yang sedang aktif —
  // beda dengan deleteAllFiltered() yang cuma hapus baris terfilter.
  function deleteAllData() {
    var all = getBaggageData();
    if (!all.length) { showToast("Tidak ada data untuk dihapus", "error"); return; }
    var ids = all.map(function (r) { return r.id; });
    deleteMultiple(ids, "SEMUA data Baggage (" + ids.length + " kasus, tanpa peduli filter)");
  }

  function updateBulkDeleteUI() {
    var bar = $id("bgBulkBar");
    var countEl = $id("bgSelectedCount");
    if (countEl) countEl.textContent = selectedIds.size;
    if (bar) bar.classList.toggle("hidden", selectedIds.size === 0);
    var selectAllCb = $id("bg-select-all");
    if (selectAllCb) {
      var visibleIds = getFilteredEntries().map(function (r) { return r.id; });
      var allSelected = visibleIds.length > 0 && visibleIds.every(function (id) { return selectedIds.has(id); });
      selectAllCb.checked = allSelected;
      selectAllCb.indeterminate = !allSelected && visibleIds.some(function (id) { return selectedIds.has(id); });
    }
  }

  function getFilteredEntries() {
    var search = (($id("bg-search") || {}).value || "").toLowerCase();
    var station = ($id("bg-f-station") || {}).value || "";
    var aoc = ($id("bg-f-aoc") || {}).value || "";
    var caseType = ($id("bg-f-case-type") || {}).value || "";
    var caseStatus = ($id("bg-f-case-status") || {}).value || "";
    var year = ($id("bg-f-year") || {}).value || "";
    var month = ($id("bg-f-month") || {}).value || "";
    return getBaggageData().filter(function (d) {
      if (station && d.station !== station) return false;
      if (aoc && d.aoc !== aoc) return false;
      if (caseType && d.caseType !== caseType) return false;
      if (caseStatus && d.caseStatus !== caseStatus) return false;
      if (year && String(d.year) !== year) return false;
      if (month && d.month !== month) return false;
      if (search) {
        var hay = [d.paxName, d.flightNo, d.tagNumber, d.bookingCode, d.station, d.object, d.merk, d.remarks].join(" ").toLowerCase();
        if (hay.indexOf(search) === -1) return false;
      }
      return true;
    }).sort(function (a, b) { return (b.caseDate || "").localeCompare(a.caseDate || ""); });
  }

  function renderEntryTable() {
    var tbody = $id("bgTableBody");
    if (!tbody) return;
    var rows = getFilteredEntries();
    // baris yg sudah tidak terlihat (krn filter berubah) dibuang dari seleksi
    // supaya "Hapus Terpilih" tidak diam-diam menghapus data yang sudah tidak
    // relevan dengan tampilan saat ini.
    var visibleIdSet = new Set(rows.map(function (r) { return r.id; }));
    Array.from(selectedIds).forEach(function (id) { if (!visibleIdSet.has(id)) selectedIds.delete(id); });

    $id("bgTableInfo") && ($id("bgTableInfo").textContent = rows.length + " kasus ditemukan");
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="13" class="text-center py-8 text-slate-400 text-sm">Tidak ada data.</td></tr>';
      updateBulkDeleteUI();
      return;
    }
    tbody.innerHTML = rows.map(function (d, i) {
      var statusBadge = d.caseStatus === "Close"
        ? '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Close</span>'
        : '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Open</span>';
      var checked = selectedIds.has(d.id) ? " checked" : "";
      return "<tr>" +
        "<td><input type=\"checkbox\" class=\"bg-row-checkbox\" data-bg-check=\"" + escapeHtml(d.id) + "\"" + checked + "></td>" +
        "<td class=\"text-slate-400\">" + (i + 1) + "</td>" +
        "<td>" + escapeHtml(formatDateDisplay(d.caseDate)) + "</td>" +
        "<td class=\"font-semibold\">" + escapeHtml(d.station) + "</td>" +
        "<td>" + escapeHtml(d.aoc) + "</td>" +
        "<td>" + escapeHtml(d.flightNo) + "</td>" +
        "<td>" + escapeHtml(d.paxName) + "</td>" +
        "<td>" + escapeHtml(d.caseType) + "</td>" +
        "<td class=\"max-w-[160px] truncate\" title=\"" + escapeHtml(d.object) + "\">" + escapeHtml(d.object) + "</td>" +
        "<td class=\"text-right\">" + fmtCurrency(d.approvalFee) + "</td>" +
        "<td>" + escapeHtml(d.chargedTo) + "</td>" +
        "<td>" + statusBadge + "</td>" +
        "<td class=\"text-right whitespace-nowrap\"><button data-bg-edit=\"" + escapeHtml(d.id) + "\" class=\"text-blue-600 hover:underline text-xs mr-2\">Edit</button><button data-bg-delete=\"" + escapeHtml(d.id) + "\" class=\"text-red-600 hover:underline text-xs\">Hapus</button></td>" +
        "</tr>";
    }).join("");
    updateBulkDeleteUI();
  }

  function rebuildEntryFilterOptions() {
    // [PATCH] Sebelumnya logika populate-dropdown Station & Tahun ditulis
    // manual (duplikat dengan rebuildDashboardFilterOptions() di bawah,
    // dan dengan pola yang sama di Bank Station/Bank Data Peserta).
    // Sekarang pakai window.populateFilterSelect() dari shared-utils.js.
    var list = getBaggageData();
    window.populateFilterSelect($id("bg-f-station"), list.map(function (d) { return d.station; }), "Semua Station", "sjnam_bg_filter_station_v1");
    window.populateFilterSelect($id("bg-f-year"), list.map(function (d) { return d.year; }), "Semua Tahun", "sjnam_bg_filter_year_v1");
  }

  // ================================================================
  // DASHBOARD: KPI + chart (pola sama seperti Dashboard Service Recovery)
  // ================================================================
  var bgCharts = {};
  function destroyBgChart(id) { if (bgCharts[id]) { bgCharts[id].destroy(); delete bgCharts[id]; } }

  function getDashboardFiltered() {
    var year = ($id("bg-d-year") || {}).value || "";
    var month = ($id("bg-d-month") || {}).value || "";
    var station = ($id("bg-d-station") || {}).value || "";
    var aoc = ($id("bg-d-aoc") || {}).value || "";
    return getBaggageData().filter(function (d) {
      if (year && String(d.year) !== year) return false;
      if (month && d.month !== month) return false;
      if (station && d.station !== station) return false;
      if (aoc && d.aoc !== aoc) return false;
      return true;
    });
  }

  function renderDashboardKpi(data) {
    var el = $id("bgKpiGrid");
    if (!el) return;
    var total = data.length;
    var totalFee = data.reduce(function (s, d) { return s + (Number(d.approvalFee) || 0); }, 0);
    var openCount = data.filter(function (d) { return d.caseStatus !== "Close"; }).length;
    var closeCount = total - openCount;
    var lostCount = data.filter(function (d) { return d.caseType === "HILANG" || d.caseType === "HILANG ISI"; }).length;
    var damagedCount = data.filter(function (d) { return d.caseType === "RUSAK"; }).length;
    el.innerHTML =
      '<div class="stcr-kpi stcr-total"><div class="stcr-kpi-label">Total Kasus</div><div class="stcr-kpi-value">' + total + '</div><div class="stcr-kpi-sub">seluruh kasus baggage</div></div>' +
      '<div class="stcr-kpi stcr-revenue"><div class="stcr-kpi-label">Total Klaim</div><div class="stcr-kpi-value" style="font-size:17px">' + fmtCurrency(totalFee) + '</div><div class="stcr-kpi-sub">total biaya disetujui</div></div>' +
      '<div class="stcr-kpi stcr-aoc-sj"><div class="stcr-kpi-label">Open</div><div class="stcr-kpi-value">' + openCount + '</div><div class="stcr-kpi-sub">belum selesai</div></div>' +
      '<div class="stcr-kpi stcr-aoc-in"><div class="stcr-kpi-label">Close</div><div class="stcr-kpi-value">' + closeCount + '</div><div class="stcr-kpi-sub">sudah selesai</div></div>' +
      '<div class="stcr-kpi stcr-stcr"><div class="stcr-kpi-label">Hilang</div><div class="stcr-kpi-value">' + lostCount + '</div><div class="stcr-kpi-sub">HILANG + HILANG ISI</div></div>' +
      '<div class="stcr-kpi stcr-pob"><div class="stcr-kpi-label">Rusak</div><div class="stcr-kpi-value">' + damagedCount + '</div><div class="stcr-kpi-sub">baggage rusak</div></div>';
  }

  function renderDashboardCharts(data) {
    if (typeof Chart === "undefined") return;

    // Tren Kasus & Klaim per Bulan — DIGABUNG jadi satu chart kombinasi
    // (batang = Klaim Rp, garis = Jumlah Kasus) dengan 2 sumbu-Y, supaya
    // kedua tren bisa dibandingkan langsung di satu tempat.
    var comboCanvas = $id("bgComboChart");
    if (comboCanvas && (comboCanvas.offsetWidth || comboCanvas.offsetParent)) {
      var countMap = {}, feeMap2 = {};
      data.forEach(function (d) {
        if (!d.year || !d.month) return;
        var k = d.year + "-" + d.month;
        countMap[k] = (countMap[k] || 0) + 1;
        if (d.approvalFee > 0) feeMap2[k] = (feeMap2[k] || 0) + d.approvalFee;
      });
      var comboKeysSet = {};
      Object.keys(countMap).forEach(function (k) { comboKeysSet[k] = true; });
      Object.keys(feeMap2).forEach(function (k) { comboKeysSet[k] = true; });
      var comboKeys = Object.keys(comboKeysSet).sort(function (a, b) {
        var pa = a.split("-"), pb = b.split("-");
        return (Number(pa[0]) - Number(pb[0])) || (MONTHS.indexOf(pa[1]) - MONTHS.indexOf(pb[1]));
      });
      destroyBgChart("comboChart");
      bgCharts.comboChart = new Chart(comboCanvas, {
        data: {
          labels: comboKeys.map(function (k) { return k.replace("-", " "); }),
          datasets: [
            { type: "bar", label: "Klaim (juta Rp)", data: comboKeys.map(function (k) { return (feeMap2[k] || 0) / 1e6; }), backgroundColor: "#E8A427", borderRadius: 5, yAxisID: "y1", order: 2 },
            { type: "line", label: "Jumlah Kasus", data: comboKeys.map(function (k) { return countMap[k] || 0; }), borderColor: "#DC2626", backgroundColor: "rgba(220,38,38,.12)", borderWidth: 2, pointRadius: 3, fill: false, tension: .3, yAxisID: "y", order: 1 }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: true, position: "top", labels: { font: { size: 10 }, boxWidth: 12 } },
            datalabels: {
              display: true, font: { size: 9, weight: "bold" }, align: "top", anchor: "end",
              color: function (ctx) { return ctx.dataset.type === "line" ? "#DC2626" : "#92400e"; },
              formatter: function (v, ctx) { if (!v) return ""; return ctx.dataset.type === "line" ? v : "Rp" + v.toFixed(1) + "jt"; }
            }
          },
          scales: {
            x: { ticks: { maxRotation: 45, font: { size: 10 } } },
            y: { type: "linear", position: "left", title: { display: true, text: "Jumlah Kasus", font: { size: 10 } } },
            y1: { type: "linear", position: "right", title: { display: true, text: "Klaim (juta Rp)", font: { size: 10 } }, grid: { drawOnChartArea: false } }
          }
        }
      });
    }

    // Distribusi jenis kasus (donut) — aspectRatio disamakan dgn donut Airlines
    var typeCanvas = $id("bgTypeChart");
    if (typeCanvas && (typeCanvas.offsetWidth || typeCanvas.offsetParent)) {
      var typeMap = {};
      data.forEach(function (d) { var t = d.caseType || "Lainnya"; typeMap[t] = (typeMap[t] || 0) + 1; });
      var typeLabels = Object.keys(typeMap);
      destroyBgChart("typeChart");
      bgCharts.typeChart = new Chart(typeCanvas, {
        type: "doughnut",
        data: { labels: typeLabels, datasets: [{ data: typeLabels.map(function (t) { return typeMap[t]; }), backgroundColor: ["#DC2626", "#F59E0B", "#7C3AED", "#0D6E8A", "#16A34A", "#9CA3AF", "#0B1E3A"], borderWidth: 2 }] },
        options: {
          responsive: true, aspectRatio: 1.4,
          plugins: {
            legend: { position: "bottom", labels: { font: { size: 10 } } },
            datalabels: { display: true, color: "#fff", font: { size: 10, weight: "bold" }, formatter: function (v, ctx) { var total = ctx.chart.data.datasets[0].data.reduce(function (a, b) { return a + b; }, 0); var pct = total ? Math.round(v / total * 100) : 0; return v > 0 ? v + " (" + pct + "%)" : ""; } }
          }
        }
      });
    }

    // Distribusi kasus by Airlines (donut) — aspectRatio SAMA dengan donut
    // Jenis Kasus di atas, dan warna standar (SJ=merah, IN=biru).
    var aocCanvas = $id("bgAocChart");
    if (aocCanvas && (aocCanvas.offsetWidth || aocCanvas.offsetParent)) {
      var aocMap = {};
      data.forEach(function (d) { var a = d.aoc || "Lainnya"; aocMap[a] = (aocMap[a] || 0) + 1; });
      var aocLabels = Object.keys(aocMap);
      destroyBgChart("aocChart");
      bgCharts.aocChart = new Chart(aocCanvas, {
        type: "doughnut",
        data: { labels: aocLabels, datasets: [{ data: aocLabels.map(function (a) { return aocMap[a]; }), backgroundColor: aocLabels.map(airlineColor), borderWidth: 2 }] },
        options: {
          responsive: true, aspectRatio: 1.4,
          plugins: {
            legend: { position: "bottom", labels: { font: { size: 10 } } },
            datalabels: { display: true, color: "#fff", font: { size: 10, weight: "bold" }, formatter: function (v, ctx) { var total = ctx.chart.data.datasets[0].data.reduce(function (a, b) { return a + b; }, 0); var pct = total ? Math.round(v / total * 100) : 0; return v > 0 ? v + " (" + pct + "%)" : ""; } }
          }
        }
      });
    }

    // Top 5 station
    var stCanvas = $id("bgStationChart");
    if (stCanvas && (stCanvas.offsetWidth || stCanvas.offsetParent)) {
      var stMap = {};
      data.forEach(function (d) { if (d.station) stMap[d.station] = (stMap[d.station] || 0) + 1; });
      var top5 = Object.entries(stMap).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);
      destroyBgChart("stationChart");
      if (top5.length) {
        bgCharts.stationChart = new Chart(stCanvas, {
          type: "bar",
          data: { labels: top5.map(function (s) { return s[0]; }), datasets: [{ label: "Kasus", data: top5.map(function (s) { return s[1]; }), backgroundColor: "#0B1E3A", borderRadius: 4 }] },
          options: { indexAxis: "y", responsive: true, plugins: { legend: { display: false }, datalabels: { display: true, color: "#fff", font: { size: 10, weight: "bold" }, anchor: "end", align: "start", formatter: function (v) { return v > 0 ? v : ""; } } }, scales: { x: { ticks: { font: { size: 11 } } } } }
        });
      }
    }
  }

  // Chart YoY (Year on Year) & MoM (Month on Month) — SENGAJA memakai
  // SELURUH data (getBaggageData(), bukan getDashboardFiltered()), supaya
  // tren jangka panjang tetap bisa dibandingkan apa adanya, tidak terpotong
  // oleh filter Station/Airlines/Tahun/Bulan yang sedang aktif.
  function renderUnfilteredCharts() {
    if (typeof Chart === "undefined") return;
    var allData = getBaggageData();

    var yoyCanvas = $id("bgYoYChart");
    if (yoyCanvas && (yoyCanvas.offsetWidth || yoyCanvas.offsetParent)) {
      var yearMap = {};
      allData.forEach(function (d) { if (d.year) yearMap[d.year] = (yearMap[d.year] || 0) + 1; });
      var years = Object.keys(yearMap).sort();
      var yoyCounts = years.map(function (y) { return yearMap[y]; });
      var yoyGrowth = years.map(function (y, i) {
        if (i === 0) return null;
        var prev = yearMap[years[i - 1]];
        return prev ? Math.round((yearMap[y] - prev) / prev * 100) : null;
      });
      destroyBgChart("yoyChart");
      bgCharts.yoyChart = new Chart(yoyCanvas, {
        type: "bar",
        data: { labels: years, datasets: [{ label: "Jumlah Kasus per Tahun", data: yoyCounts, backgroundColor: "#7C3AED", borderRadius: 6 }] },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            datalabels: { display: true, color: "#3b0764", font: { size: 10, weight: "bold" }, anchor: "end", align: "top", formatter: function (v, ctx) { var g = yoyGrowth[ctx.dataIndex]; return g === null ? String(v) : v + " (" + (g >= 0 ? "+" : "") + g + "%)"; } }
          },
          scales: { x: { ticks: { font: { size: 11 } } } }
        }
      });
    }

    var momCanvas = $id("bgMoMChart");
    if (momCanvas && (momCanvas.offsetWidth || momCanvas.offsetParent)) {
      var monthMap = {};
      allData.forEach(function (d) { if (!d.year || !d.month) return; var ym = d.year + "-" + d.month; monthMap[ym] = (monthMap[ym] || 0) + 1; });
      var sortedMonths = Object.keys(monthMap).sort(function (a, b) {
        var pa = a.split("-"), pb = b.split("-");
        return (Number(pa[0]) - Number(pb[0])) || (MONTHS.indexOf(pa[1]) - MONTHS.indexOf(pb[1]));
      });
      var last12 = sortedMonths.slice(-12);
      var momLabels = last12.map(function (ym) { return ym.replace("-", " "); });
      var momCounts = last12.map(function (ym) { return monthMap[ym]; });
      var momGrowth = last12.map(function (ym, i) {
        if (i === 0) return null;
        var prev = monthMap[last12[i - 1]];
        return prev ? Math.round((monthMap[ym] - prev) / prev * 100) : null;
      });
      destroyBgChart("momChart");
      bgCharts.momChart = new Chart(momCanvas, {
        type: "bar",
        data: { labels: momLabels, datasets: [{ label: "Jumlah Kasus per Bulan", data: momCounts, backgroundColor: "#0EA5E9", borderRadius: 6 }] },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            datalabels: { display: true, color: "#0c4a6e", font: { size: 9, weight: "bold" }, anchor: "end", align: "top", formatter: function (v, ctx) { var g = momGrowth[ctx.dataIndex]; return g === null ? String(v) : v + " (" + (g >= 0 ? "+" : "") + g + "%)"; } }
          },
          scales: { x: { ticks: { maxRotation: 45, font: { size: 10 } } } }
        }
      });
    }
  }

  function rebuildDashboardFilterOptions() {
    // [PATCH] Sama seperti rebuildEntryFilterOptions() di atas — pakai
    // window.populateFilterSelect() bersama, bukan logika manual duplikat.
    var list = getBaggageData();
    window.populateFilterSelect($id("bg-d-station"), list.map(function (d) { return d.station; }), "Semua Station", "sjnam_bg_dash_filter_station_v1");
    window.populateFilterSelect($id("bg-d-year"), list.map(function (d) { return d.year; }), "Semua Tahun", "sjnam_bg_dash_filter_year_v1");
  }

  function buildFilterDesc() {
    var parts = [];
    var st = ($id("bg-d-station") || {}).value; if (st) parts.push("Station: " + st);
    var aoc = ($id("bg-d-aoc") || {}).value; if (aoc) parts.push("Airlines: " + aoc);
    var yr = ($id("bg-d-year") || {}).value; if (yr) parts.push("Tahun: " + yr);
    var mo = ($id("bg-d-month") || {}).value; if (mo) parts.push("Bulan: " + mo);
    return parts.length ? parts.join(" | ") : "Semua Data";
  }

  function renderDashboard() {
    rebuildDashboardFilterOptions();
    var data = getDashboardFiltered();
    renderDashboardKpi(data);
    renderDashboardCharts(data);
    renderUnfilteredCharts();
    var descEl = $id("bgPrintFilterDesc");
    if (descEl) descEl.textContent = "Filter: " + buildFilterDesc() + " — Dicetak: " + new Date().toLocaleString("id-ID");
  }

  // ================================================================
  // IMPORT EXCEL — HANYA sheet "Baggage" (sheet "Bank" diabaikan)
  // ================================================================
  function toISODate(v) {
    if (!v) return "";
    if (v instanceof Date && !isNaN(v.getTime())) return v.getFullYear() + "-" + String(v.getMonth() + 1).padStart(2, "0") + "-" + String(v.getDate()).padStart(2, "0");
    var s = String(v).trim();
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
    // [BUG DITEMUKAN & DIPERBAIKI] Sebagian sel tanggal di file Excel sumber
    // ternyata tidak dikenali SheetJS sebagai sel "bertipe tanggal" (mis.
    // format sel bukan format tanggal standar), sehingga cellDates:true GAGAL
    // meng-konversinya jadi Date object — yang masuk ke sini malah angka
    // serial Excel mentah (contoh: 46170). Tanpa penanganan ini, kode di
    // bawah (fallback "new Date(s)") salah menafsirkan angka itu sebagai
    // TAHUN (mis. "46170" jadi tanggal 1 Januari tahun 46170!) — persis bug
    // yang terlihat sebagai "46170-01-01" di tabel. Sekarang, angka yang
    // masuk akal sebagai serial tanggal Excel (antara tahun ~1900-2200)
    // dikonversi dulu dengan rumus epoch Excel yang benar.
    if (/^\d+(\.\d+)?$/.test(s)) {
      var serial = Number(s);
      if (serial > 0 && serial < 110000) {
        var utcDays = Math.floor(serial - 25569);
        var d1 = new Date(utcDays * 86400 * 1000);
        if (!isNaN(d1.getTime())) return d1.getFullYear() + "-" + String(d1.getMonth() + 1).padStart(2, "0") + "-" + String(d1.getDate()).padStart(2, "0");
      }
    }
    var d = new Date(s);
    if (!isNaN(d.getTime())) return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    return "";
  }

  // [BUG DITEMUKAN & DIPERBAIKI] Kolom angka (Proposed Fee, Approval Fee,
  // dll) di file Excel sumber ternyata diformat dengan pemisah ribuan
  // (koma) dan kadang prefix "Rp" serta spasi (contoh: " Rp2,200,000 "),
  // bukan angka polos. Number(" Rp2,200,000 ") menghasilkan NaN, yang
  // lewat "|| 0" jadi 0 — semua nilai Fee ter-import sebagai 0. Sekarang
  // dibersihkan dulu (buang semua selain digit/titik/minus) sebelum
  // di-parse jadi angka.
  function parseNum(v) {
    if (v === null || v === undefined || v === "") return 0;
    if (typeof v === "number") return v;
    var cleaned = String(v).replace(/[^\d.\-]/g, "");
    var n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }

  function importFromExcel(file) {
    if (!window.XLSX) { showToast("Library XLSX tidak tersedia", "error"); return; }
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var wb = XLSX.read(ev.target.result, { type: "array", cellDates: true });
        // [PENTING] Hanya ambil sheet "Baggage" — sheet "Bank" diabaikan
        // sepenuhnya, sesuai permintaan.
        var sheetName = wb.SheetNames.find(function (n) { return n.trim().toLowerCase() === "baggage"; });
        if (!sheetName) { showToast('Sheet "Baggage" tidak ditemukan di file ini', "error"); return; }
        var ws = wb.Sheets[sheetName];
        var rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

        // Cari baris header secara dinamis (ada beberapa baris kosong di atas)
        var headerRowIdx = -1, headerRow = null;
        for (var i = 0; i < rows.length; i++) {
          if (rows[i].some(function (c) { return String(c).trim().toLowerCase() === "case date"; })) { headerRowIdx = i; headerRow = rows[i]; break; }
        }
        if (headerRowIdx === -1) { showToast('Format tidak dikenali — kolom "Case Date" tidak ditemukan', "error"); return; }

        function colIdx(name) {
          for (var j = 0; j < headerRow.length; j++) { if (String(headerRow[j]).trim().toLowerCase() === name.toLowerCase()) return j; }
          return -1;
        }
        var idx = {
          caseDate: colIdx("Case Date"), reportDate: colIdx("Report Date"), station: colIdx("Station"), aoc: colIdx("AOC"),
          flightNo: colIdx("Flight No"), route: colIdx("Route"), qtyPax: colIdx("Quantity Passanger"), paxName: colIdx("Passanger Name"),
          bookingCode: colIdx("Booking Code"), tagNumber: colIdx("Baggage Lable Tag"), weight: colIdx("Baggage Weight (Kg)"),
          colli: colIdx("Baggage Colli"), caseType: colIdx("Baggage Case"), object: colIdx("Baggage Object"), baggageType: colIdx("Baggage Type"),
          merk: colIdx("Baggage Merk"), size: colIdx("Baggage Size"), content: colIdx("Baggage Content"), iomDistrik: colIdx("IOM Distrik"),
          proposedFee: colIdx("Proposed Fee"), iomService: colIdx("IOM Service"), approvalFee: colIdx("Approval Fee"),
          chargedTo: colIdx("Charged To"), remarks: colIdx("Remarks"), caseStatus: colIdx("Case Status"), chargedTo2nd: colIdx("Charged To 2nd"),
          stationAwal: colIdx("Station Awal"), stationAkhir: colIdx("Station Akhir")
        };
        if (idx.caseDate === -1 || idx.station === -1 || idx.flightNo === -1) {
          showToast("Kolom wajib tidak ditemukan (Case Date / Station / Flight No)", "error"); return;
        }

        var list = getBaggageData();
        // [PATCH] Sebelumnya baris duplikat di-SKIP (data lama tidak
        // pernah diperbarui). Sekarang: data yang kuncinya cocok
        // DIGANTIKAN, yang tidak cocok DITAMBAHKAN — sama seperti pola
        // yang sudah dipakai di Activity Report.
        var existingIndex = {};
        list.forEach(function (r, idx) { existingIndex[r.caseDate + "|" + r.station + "|" + r.flightNo + "|" + r.tagNumber] = idx; });

        var added = 0, updated = 0, skipped = 0;
        console.log("[BaggageReport][Import] Mulai — " + (rows.length - headerRowIdx - 1) + " baris terbaca, " + list.length + " data sudah ada.");
        for (var r = headerRowIdx + 1; r < rows.length; r++) {
          var row = rows[r];
          if (!row || !row.length) continue;
          var caseDate = toISODate(row[idx.caseDate]);
          var station = String(row[idx.station] || "").trim().toUpperCase();
          var flightNo = String(row[idx.flightNo] || "").trim().toUpperCase();
          if (!caseDate || !station || !flightNo) { skipped++; continue; }
          var tagNumberVal = String(idx.tagNumber > -1 ? row[idx.tagNumber] : "").trim().toUpperCase();
          var key = caseDate + "|" + station + "|" + flightNo + "|" + tagNumberVal;
          var isDup = Object.prototype.hasOwnProperty.call(existingIndex, key);

          var ym = deriveYearMonth(caseDate);
          var entry = {
            id: isDup ? list[existingIndex[key]].id : genId(), caseDate: caseDate, reportDate: idx.reportDate > -1 ? toISODate(row[idx.reportDate]) : "",
            station: station, aoc: idx.aoc > -1 ? String(row[idx.aoc] || "").trim().toUpperCase() : "",
            flightNo: flightNo, route: idx.route > -1 ? String(row[idx.route] || "").trim().toUpperCase().replace(/\s+/g, "") : "",
            qtyPax: idx.qtyPax > -1 ? parseNum(row[idx.qtyPax]) : 0,
            paxName: idx.paxName > -1 ? String(row[idx.paxName] || "").trim() : "",
            bookingCode: idx.bookingCode > -1 ? String(row[idx.bookingCode] || "").trim().toUpperCase() : "",
            tagNumber: idx.tagNumber > -1 ? String(row[idx.tagNumber] || "").trim().toUpperCase() : "",
            weight: idx.weight > -1 ? parseNum(row[idx.weight]) : 0,
            colli: idx.colli > -1 ? parseNum(row[idx.colli]) : 0,
            caseType: idx.caseType > -1 ? String(row[idx.caseType] || "").trim().toUpperCase() : "",
            object: idx.object > -1 ? String(row[idx.object] || "").trim() : "",
            baggageType: idx.baggageType > -1 ? String(row[idx.baggageType] || "").trim().toUpperCase() : "",
            merk: idx.merk > -1 ? String(row[idx.merk] || "").trim() : "",
            size: idx.size > -1 ? String(row[idx.size] || "").trim() : "",
            content: idx.content > -1 ? String(row[idx.content] || "").trim() : "",
            iomDistrik: idx.iomDistrik > -1 ? String(row[idx.iomDistrik] || "").trim() : "",
            proposedFee: idx.proposedFee > -1 ? parseNum(row[idx.proposedFee]) : 0,
            iomService: idx.iomService > -1 ? String(row[idx.iomService] || "").trim() : "",
            approvalFee: idx.approvalFee > -1 ? parseNum(row[idx.approvalFee]) : 0,
            chargedTo: idx.chargedTo > -1 ? String(row[idx.chargedTo] || "").trim() : "",
            chargedTo2nd: idx.chargedTo2nd > -1 ? String(row[idx.chargedTo2nd] || "").trim() : "",
            remarks: idx.remarks > -1 ? String(row[idx.remarks] || "").trim() : "",
            caseStatus: idx.caseStatus > -1 ? (String(row[idx.caseStatus] || "").trim() || "Open") : "Open",
            stationAwal: idx.stationAwal > -1 ? String(row[idx.stationAwal] || "").trim().toUpperCase() : "",
            stationAkhir: idx.stationAkhir > -1 ? String(row[idx.stationAkhir] || "").trim().toUpperCase() : "",
            year: ym.year, month: ym.month,
            inputBy: "Import Excel", _updatedAt: new Date().toISOString(), _updatedBy: currentUserName()
          };
          if (isDup) {
            list[existingIndex[key]] = entry;
            updated++;
          } else {
            list.push(entry);
            existingIndex[key] = list.length - 1;
            added++;
          }
        }
        console.log("[BaggageReport][Import] Selesai — ditambahkan=" + added + ", digantikan(update)=" + updated + ", dilewati=" + skipped + ".");
        saveBaggageData(list);
        renderEntryTable();
        rebuildEntryFilterOptions();
        renderDashboard();
        showToast(added + " data baru ditambahkan" + (updated ? ", " + updated + " data diperbarui (menggantikan data yang sama)" : "") + (skipped ? (", " + skipped + " baris dilewati (data tidak lengkap)") : ""), (added || updated) ? "success" : "error");
      } catch (err) {
        showToast("Gagal membaca file: " + err.message, "error");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function exportToExcel() {
    if (!window.XLSX) { showToast("Library XLSX tidak tersedia", "error"); return; }
    var rows = getFilteredEntries().map(function (d, i) {
      return {
        No: i + 1, "Case Date": formatDateDisplay(d.caseDate), "Report Date": formatDateDisplay(d.reportDate), Station: d.station, AOC: d.aoc,
        "Flight No": d.flightNo, Route: d.route, "Qty Pax": d.qtyPax, "Nama Pax": d.paxName, "Booking Code": d.bookingCode,
        "Tag Number": d.tagNumber, "Weight (Kg)": d.weight, Colli: d.colli, "Case Type": d.caseType, Object: d.object,
        "Baggage Type": d.baggageType, Merk: d.merk, Size: d.size, Content: d.content, "IOM Distrik": d.iomDistrik,
        "Proposed Fee": d.proposedFee, "IOM Service": d.iomService, "Approval Fee": d.approvalFee, "Charged To": d.chargedTo,
        "Charged To 2nd": d.chargedTo2nd, Remarks: d.remarks, "Case Status": d.caseStatus, "Station Awal": d.stationAwal, "Station Akhir": d.stationAkhir
      };
    });
    if (!rows.length) { showToast("Belum ada data untuk di-export", "error"); return; }
    var ws = XLSX.utils.json_to_sheet(rows), wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Baggage Report");
    XLSX.writeFile(wb, "Baggage_Report_" + (window.todayLocalStr ? window.todayLocalStr() : new Date().toISOString().slice(0, 10)) + ".xlsx");
  }

  // Template kosong — kolomnya PERSIS sama dengan yang dibaca importFromExcel,
  // supaya file yang diisi dari template ini pasti bisa diimport lagi tanpa masalah.
  var TEMPLATE_HEADERS = [
    "Case Date", "Report Date", "Station", "AOC", "Flight No", "Route", "Quantity Passanger", "Passanger Name",
    "Booking Code", "Baggage Lable Tag", "Baggage Weight (Kg)", "Baggage Colli", "Baggage Case", "Baggage Object",
    "Baggage Type", "Baggage Merk", "Baggage Size", "Baggage Content", "IOM Distrik", "Proposed Fee", "IOM Service",
    "Approval Fee", "Charged To", "Remarks", "Case Status", "Charged To 2nd", "Station Awal", "Station Akhir"
  ];
  function downloadTemplate() {
    if (!window.XLSX) { showToast("Library XLSX tidak tersedia", "error"); return; }
    var exampleRow = {
      "Case Date": "2026-01-05", "Report Date": "", "Station": "CGK", "AOC": "SJ", "Flight No": "SJ589", "Route": "UPGCGK",
      "Quantity Passanger": 1, "Passanger Name": "CONTOH NAMA Mr", "Booking Code": "ABCDEF", "Baggage Lable Tag": "SJ00000000",
      "Baggage Weight (Kg)": 10, "Baggage Colli": 1, "Baggage Case": "RUSAK", "Baggage Object": "Contoh: KOPER WARNA MERAH",
      "Baggage Type": "FIBER", "Baggage Merk": "", "Baggage Size": "", "Baggage Content": "", "IOM Distrik": "001/INT/CGKSMSJ/I/2026",
      "Proposed Fee": 400000, "IOM Service": "", "Approval Fee": 400000, "Charged To": "GH CGK", "Remarks": "", "Case Status": "Open",
      "Charged To 2nd": "GH", "Station Awal": "UPG", "Station Akhir": "CGK"
    };
    var ws = XLSX.utils.json_to_sheet([exampleRow], { header: TEMPLATE_HEADERS });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Baggage");
    XLSX.writeFile(wb, "Template_Baggage_Report.xlsx");
    showToast("Template berhasil diunduh — isi data mulai baris ke-2, jangan ubah nama kolom", "success");
  }

  // Export PDF dashboard — screenshot area KPI+chart (html2canvas) supaya
  // yang tercetak PERSIS seperti yang terlihat di layar (termasuk semua
  // filter yang sedang aktif), bukan cuma tabel data mentah.
  function exportDashboardPdf() {
    if (!window.html2canvas || !window.jspdf) { showToast("Library html2canvas/jsPDF tidak tersedia", "error"); return; }
    var target = $id("bgDashboardPrintArea");
    if (!target) { showToast("Area dashboard tidak ditemukan", "error"); return; }
    var printHeader = $id("bgPrintHeader");
    if (printHeader) printHeader.classList.remove("hidden");
    showToast("Membuat PDF, mohon tunggu...", "info");
    html2canvas(target, { scale: 2, useCORS: true, backgroundColor: "#ffffff" }).then(function (canvas) {
      if (printHeader) printHeader.classList.add("hidden");
      var imgData = canvas.toDataURL("image/png");
      var jsPDF = window.jspdf.jsPDF;
      var pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      var pageWidth = pdf.internal.pageSize.getWidth();
      var margin = 24;
      var imgWidth = pageWidth - margin * 2;
      var imgHeight = imgWidth * canvas.height / canvas.width;
      var y = margin;
      var pageHeight = pdf.internal.pageSize.getHeight();
      if (imgHeight <= pageHeight - margin * 2) {
        pdf.addImage(imgData, "PNG", margin, y, imgWidth, imgHeight);
      } else {
        // gambar lebih tinggi dari 1 halaman — potong jadi beberapa halaman
        var remainingHeight = imgHeight, position = 0;
        while (remainingHeight > 0) {
          pdf.addImage(imgData, "PNG", margin, y - position, imgWidth, imgHeight);
          remainingHeight -= (pageHeight - margin * 2);
          position += (pageHeight - margin * 2);
          if (remainingHeight > 0) { pdf.addPage(); y = margin; }
        }
      }
      pdf.save("Baggage_Dashboard_" + (window.todayLocalStr ? window.todayLocalStr() : new Date().toISOString().slice(0, 10)) + ".pdf");
      showToast("PDF berhasil dibuat", "success");
    }).catch(function (err) {
      if (printHeader) printHeader.classList.add("hidden");
      showToast("Gagal membuat PDF: " + err.message, "error");
    });
  }

  // ================================================================
  // WIRING: event, tombol, tab-changed
  // ================================================================
  function wireEvents() {
    if (window._baggageEventsWired) return;
    window._baggageEventsWired = true;

    $id("btnBgSaveEntry") && $id("btnBgSaveEntry").addEventListener("click", saveEntryFromForm);
    $id("btnBgResetForm") && $id("btnBgResetForm").addEventListener("click", resetEntryForm);
    window.bindFilterPersistence($id("bg-search"), "sjnam_bg_filter_search_v1");
    $id("bg-search") && $id("bg-search").addEventListener("input", renderEntryTable);
    ["bg-f-aoc", "bg-f-case-type", "bg-f-case-status", "bg-f-month"].forEach(function (id) {
      window.bindFilterPersistence($id(id), "sjnam_bg_filter_" + id.replace(/-/g, "_") + "_v1");
    });
    ["bg-f-station", "bg-f-aoc", "bg-f-case-type", "bg-f-case-status", "bg-f-year", "bg-f-month"].forEach(function (id) {
      $id(id) && $id(id).addEventListener("change", renderEntryTable);
    });
    $id("btnBgResetFilter") && $id("btnBgResetFilter").addEventListener("click", function () {
      ["bg-search", "bg-f-station", "bg-f-aoc", "bg-f-case-type", "bg-f-case-status", "bg-f-year", "bg-f-month"].forEach(function (id) { var el = $id(id); if (el) el.value = ""; });
      // [PATCH] Reset filter juga menghapus nilai tersimpan supaya tidak
      // muncul lagi setelah refresh.
      ["sjnam_bg_filter_search_v1", "sjnam_bg_filter_station_v1", "sjnam_bg_filter_bg_f_aoc_v1", "sjnam_bg_filter_bg_f_case_type_v1", "sjnam_bg_filter_bg_f_case_status_v1", "sjnam_bg_filter_year_v1", "sjnam_bg_filter_bg_f_month_v1"].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
      console.log("[BaggageReport][FilterPersist] Filter direset (termasuk hapus dari localStorage).");
      renderEntryTable();
    });
    ["bg-d-aoc", "bg-d-month"].forEach(function (id) {
      window.bindFilterPersistence($id(id), "sjnam_bg_dash_filter_" + id.replace(/-/g, "_") + "_v1");
    });
    ["bg-d-station", "bg-d-aoc", "bg-d-year", "bg-d-month"].forEach(function (id) { $id(id) && $id(id).addEventListener("change", renderDashboard); });

    var tbody = $id("bgTableBody");
    if (tbody) {
      tbody.addEventListener("click", function (e) {
        var editBtn = e.target.closest("[data-bg-edit]");
        var delBtn = e.target.closest("[data-bg-delete]");
        var checkbox = e.target.closest("[data-bg-check]");
        if (editBtn) {
          var d = getBaggageData().find(function (r) { return r.id === editBtn.getAttribute("data-bg-edit"); });
          if (d) fillEntryForm(d);
        } else if (delBtn) {
          deleteEntry(delBtn.getAttribute("data-bg-delete"));
        } else if (checkbox) {
          var cid = checkbox.getAttribute("data-bg-check");
          if (checkbox.checked) selectedIds.add(cid); else selectedIds.delete(cid);
          updateBulkDeleteUI();
        }
      });
    }

    $id("bg-select-all") && $id("bg-select-all").addEventListener("change", function (e) {
      var visible = getFilteredEntries();
      if (e.target.checked) {
        visible.forEach(function (r) { selectedIds.add(r.id); });
      } else {
        visible.forEach(function (r) { selectedIds.delete(r.id); });
      }
      renderEntryTable();
    });
    $id("btnBgDeleteSelected") && $id("btnBgDeleteSelected").addEventListener("click", deleteSelected);
    $id("btnBgDeleteAllFiltered") && $id("btnBgDeleteAllFiltered").addEventListener("click", deleteAllFiltered);
    $id("btnBgDeleteAllData") && $id("btnBgDeleteAllData").addEventListener("click", deleteAllData);
    $id("btnBgClearSelection") && $id("btnBgClearSelection").addEventListener("click", function () { selectedIds.clear(); renderEntryTable(); });

    $id("btnBgImportExcel") && $id("btnBgImportExcel").addEventListener("click", function () { $id("bgImportFile") && $id("bgImportFile").click(); });
    $id("bgImportFile") && $id("bgImportFile").addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (file) importFromExcel(file);
      e.target.value = "";
    });
    $id("btnBgExportExcel") && $id("btnBgExportExcel").addEventListener("click", exportToExcel);
    $id("btnBgTemplateExcel") && $id("btnBgTemplateExcel").addEventListener("click", downloadTemplate);
    $id("btnBgExportPdf") && $id("btnBgExportPdf").addEventListener("click", exportDashboardPdf);

    // Toggle 2 tampilan (Entry / Dashboard) dalam SATU tab yang sama.
    // [BUG DITEMUKAN & DIPERBAIKI] Mekanisme "tab aktif tidak berpindah
    // saat refresh" yang sudah ada di aplikasi cuma mengingat TAB mana
    // yang aktif ("station-baggage") — tidak tahu-menahu soal tampilan
    // MANA (Entry atau Dashboard) yang terakhir dibuka DI DALAM tab itu,
    // karena keduanya sama-sama berada di satu tab yang sama. Makanya
    // setelah refresh selalu balik ke Entry (tampilan default). Sekarang
    // tampilan yang sedang aktif ikut disimpan sendiri, terpisah dari
    // mekanisme tab bawaan.
    var VIEW_LS_KEY = "sjnam_baggage_active_view_v1";
    var entryBtn = $id("btnBgViewEntry"), dashBtn = $id("btnBgViewDashboard");
    var entryView = $id("bgEntryView"), dashView = $id("bgDashboardView");
    function showEntryView() {
      if (entryView) entryView.classList.remove("hidden");
      if (dashView) dashView.classList.add("hidden");
      if (entryBtn) { entryBtn.classList.add("bg-blue-600", "text-white"); entryBtn.classList.remove("bg-slate-200", "dark:bg-slate-700", "text-slate-700", "dark:text-slate-200"); }
      if (dashBtn) { dashBtn.classList.remove("bg-blue-600", "text-white"); dashBtn.classList.add("bg-slate-200", "dark:bg-slate-700", "text-slate-700", "dark:text-slate-200"); }
      try { localStorage.setItem(VIEW_LS_KEY, "entry"); } catch (e) {}
    }
    function showDashboardView() {
      if (dashView) dashView.classList.remove("hidden");
      if (entryView) entryView.classList.add("hidden");
      if (dashBtn) { dashBtn.classList.add("bg-blue-600", "text-white"); dashBtn.classList.remove("bg-slate-200", "dark:bg-slate-700", "text-slate-700", "dark:text-slate-200"); }
      if (entryBtn) { entryBtn.classList.remove("bg-blue-600", "text-white"); entryBtn.classList.add("bg-slate-200", "dark:bg-slate-700", "text-slate-700", "dark:text-slate-200"); }
      renderDashboard(); // chart di-skip saat masih tersembunyi (offsetWidth=0) -> render ulang begitu terlihat
      try { localStorage.setItem(VIEW_LS_KEY, "dashboard"); } catch (e) {}
    }
    entryBtn && entryBtn.addEventListener("click", showEntryView);
    dashBtn && dashBtn.addEventListener("click", showDashboardView);

    fillDatalist("bgCaseTypeList", CASE_TYPES);
    fillDatalist("bgBaggageTypeList", BAGGAGE_TYPES);
  }

  var _datesRepaired = false;
  function initAll() {
    wireEvents();
    if (!_datesRepaired) { _datesRepaired = true; repairCorruptedDates(); }
    rebuildEntryFilterOptions();
    renderEntryTable();
    rebuildDashboardFilterOptions();
    // Pulihkan tampilan (Entry/Dashboard) yang terakhir aktif sebelum refresh.
    try {
      if (localStorage.getItem("sjnam_baggage_active_view_v1") === "dashboard") {
        var dashBtnEl = $id("btnBgViewDashboard");
        dashBtnEl && dashBtnEl.click();
      }
    } catch (e) {}
  }

  // Dipanggil setiap kali tab ini terlihat (event sjn:tab-changed yang
  // sudah dipakai konsisten di modul lain — lihat drygoods-tab-watch.js)
  document.addEventListener("sjn:tab-changed", function (e) {
    var tab = e && e.detail && e.detail.tab;
    if (tab === "station-baggage") initAll();
  });

  // Jaga-jaga: pola MutationObserver sebagai cadangan (sama seperti
  // drygoods-tab-watch.js) untuk kasus window.switchTab gagal
  // meneruskan event di beberapa skenario.
  function watchTabPane(paneId, cb) {
    var el = $id(paneId);
    if (!el || el._bgWatched) return false;
    el._bgWatched = true;
    if (el.classList.contains("active")) setTimeout(cb, 0);
    new MutationObserver(function () { if (el.classList.contains("active")) cb(); }).observe(el, { attributes: true, attributeFilter: ["class"] });
    return true;
  }
  var tries = 0;
  wireEvents(); // [BUG FIX] pasang segera (jangan nunggu interval pertama ~250ms)
  var iv = setInterval(function () {
    tries++;
    var watched = watchTabPane("tab-station-baggage", initAll);
    wireEvents();
    if (watched || tries > 60) clearInterval(iv);
  }, 250);

  // API publik — dipanggil shared-utils.js setelah pull cloud berhasil
  // (lihat _applyBucketPull bucketId === "baggage_data")
  window.BAGGAGE = {
    renderAll: function () { rebuildEntryFilterOptions(); renderEntryTable(); renderDashboard(); },
    getData: getBaggageData
  };

  console.info("%c[SJNAM] Baggage Report (1 tab: Entry & Dashboard) aktif.", "color:#dc2626;font-weight:bold;font-size:11px");
}();
