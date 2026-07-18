/* ================================================================
   SJNAM — CUSTOMER VOICE (Data Entry / CRUD)
   ================================================================
   Modul baru "Customer Voice" — data survei kepuasan pelanggan dari
   QR-Code Survey. Struktur data direplikasi dari file Excel asli
   (sheet SJ/IN): setiap entry punya 12 skor layanan (1-6), skor
   kepuasan umum, kemungkinan merekomendasikan, dan 1 kolom feedback
   bebas (teks) yang jadi bahan Analisa AI di modul terpisah.

   localStorage key: sjnam_customer_voice_v1 (array of records)
   Airlines: "Sriwijaya Air" | "NAM Air"
   ================================================================ */
!function () {
  "use strict";

  if (window._customerVoiceInit) return;
  window._customerVoiceInit = true;

  var LS_KEY = "sjnam_customer_voice_v1";
  var LS_MENU_KEY = "sjnam_cv_menu_open";
  var PAGE_SIZE = 50;
  var _currentPage = 1;
  var _editingId = null;

  // [PATCH] Tambah field "category" per layanan — mereplikasi kolom
  // "Type of Service" pada tabel referensi asli (kata di dalam kurung
  // pada tiap baris menandakan kategori: Niaga / Service / Operation /
  // Technic). Dipakai oleh customer-voice-summary.js untuk kolom
  // Category pada tabel Summary.
  var SERVICE_FIELDS = [
    { key: "website", label: "Layanan Website (Website Service)", shortLabel: "Layanan Website", category: "Niaga" },
    { key: "mobileApp", label: "Layanan Aplikasi Mobile (Mobile Apps Service)", shortLabel: "Layanan Aplikasi Mobile", category: "Niaga" },
    { key: "ticketing", label: "Layanan Ticketing & Pelanggan (Ticketing & Customer Service)", shortLabel: "Layanan Ticketing & Pelanggan", category: "Service" },
    { key: "checkin", label: "Layanan Check-in (Check-In Service)", shortLabel: "Layanan Check-in", category: "Service" },
    { key: "boarding", label: "Layanan Pengelolaan Boarding (Boarding Management Service)", shortLabel: "Layanan Pengelolaan Boarding", category: "Operation" },
    { key: "otp", label: "Performa Ketepatan Waktu (On Time Performance)", shortLabel: "Performa Ketepatan Waktu", category: "Operation" },
    { key: "cabinCrew", label: "Layanan Awak Kabin (Cabin Crew Service)", shortLabel: "Layanan Awak Kabin", category: "Operation" },
    { key: "seatComfort", label: "Kenyamanan Kursi Kabin (Cabin Seat Comfort)", shortLabel: "Kenyamanan Kursi Kabin", category: "Technic" },
    { key: "cleanliness", label: "Kebersihan Kabin (Cabin Cleanliness)", shortLabel: "Kebersihan Kabin", category: "Technic" },
    { key: "food", label: "Makanan Dalam Pesawat (Inflight Food)", shortLabel: "Makanan Dalam Pesawat", category: "Service" },
    { key: "lavatory", label: "Toilet Pesawat (Airplane Lavatory)", shortLabel: "Toilet Pesawat", category: "Technic" },
    { key: "baggage", label: "Penanganan Bagasi (Baggage Handling)", shortLabel: "Penanganan Bagasi", category: "Service" }
  ];

  function esc(s) {
    return window.esc ? window.esc(s) : String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function genId() { return "cv_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function loadCv() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (e) { return []; } }
  function saveCv(list) {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
    "function" === typeof window.markDirty && window.markDirty("customerVoice");
    "function" === typeof window.triggerAutoSync && window.triggerAutoSync("customerVoice");
  }

  // ── Konversi tanggal/serial Excel yang robust — replikasi proteksi
  //    yang sudah terbukti benar di checkin-otp-dashboard.js (mencegah
  //    bug "01-Jan-46053" kalau SheetJS kembalikan serial mentah). ──
  function excelSerialToInfo(serial) {
    var utcDays = Math.floor(serial - 25569);
    var utcValue = utcDays * 86400;
    var dateInfo = new Date(utcValue * 1000);
    var fractionalDay = serial - Math.floor(serial) + 0.0000001;
    var totalSeconds = Math.floor(86400 * fractionalDay);
    var hours = Math.floor(totalSeconds / 3600);
    var minutes = Math.floor((totalSeconds / 60) % 60);
    return { year: dateInfo.getUTCFullYear(), month: dateInfo.getUTCMonth() + 1, day: dateInfo.getUTCDate(), hours: hours, minutes: minutes };
  }
  function looksLikeExcelSerial(v) {
    var s = String(v).trim();
    if (!s || /[:\-\/]/.test(s)) return false;
    var n = Number(s);
    return !isNaN(n) && n >= 0;
  }
  function toISODateLoose(raw) {
    if (raw === "" || raw == null) return "";
    if (raw instanceof Date && !isNaN(raw.getTime())) return raw.getFullYear() + "-" + String(raw.getMonth() + 1).padStart(2, "0") + "-" + String(raw.getDate()).padStart(2, "0");
    if (looksLikeExcelSerial(raw) && Number(raw) > 20000 && Number(raw) < 80000) {
      var info = excelSerialToInfo(Number(raw));
      if (info.year > 1990 && info.year < 2100) return info.year + "-" + String(info.month).padStart(2, "0") + "-" + String(info.day).padStart(2, "0");
    }
    var s = String(raw).trim();
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
    var d2 = new Date(s);
    if (!isNaN(d2.getTime())) return d2.getFullYear() + "-" + String(d2.getMonth() + 1).padStart(2, "0") + "-" + String(d2.getDate()).padStart(2, "0");
    return s;
  }

  var MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function deriveDateParts(isoDate) {
    if (!isoDate) return { year: "", month: "", date: "", day: "" };
    var d = new Date(isoDate + "T00:00:00");
    if (isNaN(d.getTime())) return { year: "", month: "", date: "", day: "" };
    return { year: String(d.getFullYear()), month: MONTH_ABBR[d.getMonth()], date: String(d.getDate()), day: DAY_ABBR[d.getDay()] };
  }

  function computeScoreTotals(entry) {
    var total = 0, count = 0, maxPossible = 0;
    var fieldsToCount = SERVICE_FIELDS.map(function (f) { return f.key; }).concat(["overallSatisfaction"]);
    fieldsToCount.forEach(function (k) {
      var v = Number(entry[k]);
      if (entry[k] !== "" && entry[k] != null && !isNaN(v)) { total += v; count++; }
    });
    maxPossible = count * 6; // skala 1-6, sesuai data asli
    return { totalScore: total, totalQuestion: count, maxScore: maxPossible, percentScore: maxPossible ? total / maxPossible : 0 };
  }

  function buildEntryFromForm(existing) {
    var tanggal = document.getElementById("_cvTanggal").value;
    var dateParts = deriveDateParts(tanggal);
    var entry = {
      id: existing ? existing.id : genId(),
      timestamp: existing ? existing.timestamp : new Date().toISOString(),
      email: document.getElementById("_cvEmail").value.trim(),
      tanggalTerbang: tanggal,
      dari: document.getElementById("_cvDari").value.trim(),
      tujuan: document.getElementById("_cvTujuan").value.trim(),
      airlines: document.getElementById("_cvAirlines").value,
      fromStation: document.getElementById("_cvFromStation").value.trim(),
      overallSatisfaction: numOrEmpty(document.getElementById("_cvOverall").value),
      recommendLikelihood: numOrEmpty(document.getElementById("_cvRecommend").value),
      feedbackText: document.getElementById("_cvFeedback").value.trim(),
      year: dateParts.year, month: dateParts.month, date: dateParts.date, day: dateParts.day
    };
    SERVICE_FIELDS.forEach(function (f) {
      var el = document.getElementById("_cvSvc_" + f.key);
      entry[f.key] = el ? numOrEmpty(el.value) : "";
    });
    var totals = computeScoreTotals(entry);
    entry.totalScore = totals.totalScore;
    entry.totalQuestion = totals.totalQuestion;
    entry.maxScore = totals.maxScore;
    entry.percentScore = totals.percentScore;
    entry.qtyVoice = 1;
    return entry;
  }
  function numOrEmpty(v) { if (v === "" || v == null) return ""; var n = Number(v); return isNaN(n) ? "" : n; }

  /* ---------------------------------------------------------------
     Bangun struktur HTML awal ke #tab-cv-data (section kosong) —
     bagian yang tadinya HILANG: semua fungsi render/CRUD di atas
     mengasumsikan elemen ini sudah ada, tapi tidak ada satu pun kode
     yang benar-benar membuatnya.
     --------------------------------------------------------------- */
  function ensureDataEntryUi() {
    var section = document.getElementById("tab-cv-data");
    if (!section || section._cvUiBuilt) return false;
    section._cvUiBuilt = true;
    section.innerHTML =
      '<div class="card p-4 md:p-5">' +
      '<div class="flex flex-wrap items-center justify-between gap-3 mb-4">' +
      '<div><h2 class="text-lg font-bold">🗣️ Customer Voice — Data Entry</h2><p class="text-xs text-slate-500 mt-0.5">Data survei kepuasan pelanggan (QR-Code Customer Voice)</p></div>' +
      '<span id="cvTotalCount" class="text-xs text-slate-400"></span>' +
      "</div>" +
      '<div class="flex flex-wrap items-center gap-2 mb-4">' +
      '<input id="cvSearch" placeholder="🔍 Cari email / feedback / stasiun..." class="input flex-1 min-w-[220px]">' +
      '<select id="cvFilterAirlines" class="input !w-auto"><option value="">Semua Airlines</option><option value="Sriwijaya Air">Sriwijaya Air</option><option value="NAM Air">NAM Air</option></select>' +
      '<button type="button" id="btnCvAdd" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl">+ Tambah Data</button>' +
      '<button type="button" id="btnCvTemplate" class="px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white text-sm font-semibold rounded-xl">📋 Template Excel</button>' +
      '<label id="btnCvImportWrap" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl cursor-pointer">⬆️ Import Excel<input type="file" id="btnCvImport" accept=".xlsx,.xls" class="hidden"></label>' +
      '<button type="button" id="btnCvExport" class="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl">📤 Export Excel</button>' +
      '<button type="button" id="btnCvDeleteSelected" class="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl" disabled>🗑️ Hapus Terpilih</button>' +
      '<span id="cvBulkCount" class="text-xs text-slate-400"></span>' +
      '<button type="button" id="btnCvDeleteAll" class="px-4 py-2 bg-red-800 hover:bg-red-900 text-white text-sm font-semibold rounded-xl ml-auto">🗑️ Hapus Semua</button>' +
      "</div>" +
      '<div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">' +
      '<table class="w-full text-sm"><thead class="bg-slate-50 dark:bg-slate-800"><tr class="text-left">' +
      '<th class="px-2 py-2 w-8"><input type="checkbox" id="cvSelectAll" title="Pilih semua di halaman ini"></th>' +
      '<th class="p-3 font-semibold">Tanggal Terbang</th><th class="p-3 font-semibold">Airlines</th>' +
      '<th class="p-3 font-semibold">Rute</th>' +
      '<th class="p-3 font-semibold text-center">Kepuasan Umum</th>' +
      '<th class="p-3 font-semibold">Feedback (Perlu Perbaikan)</th>' +
      '<th class="p-3 font-semibold text-right">Aksi</th>' +
      "</tr></thead><tbody id=\"cvTableBody\"></tbody></table></div>" +
      '<div id="cvPaginationBar" class="flex items-center justify-between gap-2 mt-3 text-xs"></div>' +
      "</div>";
    return true;
  }

  /* ---------------------------------------------------------------
     Toggle grup sidebar "Customer Voice" (collapsible) — dibangun
     sendiri (tidak bergantung ke setMenuState internal index.html)
     supaya tidak ada risiko scope/closure dari file terpisah.
     --------------------------------------------------------------- */
  function ensureSidebarToggle() {
    var btn = document.getElementById("toggleCustomerVoiceMenu");
    if (!btn || btn._cvToggleBound) return false;
    btn._cvToggleBound = true;
    var content = document.getElementById("customerVoiceMenuContent");
    var icon = document.getElementById("iconCustomerVoiceMenu");
    // Pulihkan status terbuka/tertutup dari kunjungan sebelumnya
    try {
      if (localStorage.getItem(LS_MENU_KEY) === "1" && content) {
        content.classList.remove("collapsed");
        content.setAttribute("aria-hidden", "false");
        if (icon) icon.style.transform = "rotate(0deg)";
        btn.setAttribute("aria-expanded", "true");
      }
    } catch (e) { /* abaikan */ }
    btn.addEventListener("click", function () {
      if (!content) return;
      var willOpen = content.classList.contains("collapsed");
      content.classList.toggle("collapsed", !willOpen);
      content.setAttribute("aria-hidden", willOpen ? "false" : "true");
      if (icon) icon.style.transform = willOpen ? "rotate(0deg)" : "rotate(-90deg)";
      btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
      try { localStorage.setItem(LS_MENU_KEY, willOpen ? "1" : "0"); } catch (e) { /* abaikan */ }
    });
    return true;
  }

  function renderTable() {
    var tbody = document.getElementById("cvTableBody");
    if (!tbody) return;
    var list = loadCv();
    var search = (document.getElementById("cvSearch")?.value || "").toLowerCase().trim();
    var airlinesFilter = document.getElementById("cvFilterAirlines")?.value || "";

    var filtered = list.filter(function (r) {
      if (airlinesFilter && r.airlines !== airlinesFilter) return false;
      if (!search) return true;
      return (r.email || "").toLowerCase().indexOf(search) !== -1 ||
        (r.fromStation || "").toLowerCase().indexOf(search) !== -1 ||
        (r.dari || "").toLowerCase().indexOf(search) !== -1 ||
        (r.tujuan || "").toLowerCase().indexOf(search) !== -1 ||
        (r.feedbackText || "").toLowerCase().indexOf(search) !== -1;
    }).sort(function (a, b) { return (b.tanggalTerbang || "").localeCompare(a.tanggalTerbang || ""); });

    document.getElementById("cvTotalCount").textContent = list.length;

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-400 text-sm">Belum ada data yang cocok.</td></tr>';
      renderPagination(0, 0);
      return;
    }

    var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (_currentPage > totalPages) _currentPage = totalPages;
    var start = (_currentPage - 1) * PAGE_SIZE;
    var pageItems = filtered.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = pageItems.map(function (r) {
      var airlinesBadge = r.airlines === "NAM Air"
        ? '<span class="badge bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">NAM Air</span>'
        : '<span class="badge bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Sriwijaya Air</span>';
      var feedbackShort = (r.feedbackText || "").length > 60 ? esc(r.feedbackText.slice(0, 60)) + "…" : esc(r.feedbackText || "-");
      return '<tr class="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">' +
        '<td class="p-3"><input type="checkbox" data-cv-select="' + r.id + '"></td>' +
        '<td class="p-3 whitespace-nowrap">' + esc(fmtDate(r.tanggalTerbang)) + '</td>' +
        '<td class="p-3 whitespace-nowrap">' + airlinesBadge + '</td>' +
        '<td class="p-3 whitespace-nowrap">' + esc(r.dari || "-") + ' → ' + esc(r.tujuan || "-") + '</td>' +
        '<td class="p-3 text-center font-semibold">' + (r.overallSatisfaction !== "" && r.overallSatisfaction != null ? r.overallSatisfaction + "/6" : "-") + '</td>' +
        '<td class="p-3 text-xs max-w-xs truncate" title="' + esc(r.feedbackText || "") + '">' + feedbackShort + '</td>' +
        '<td class="p-3 text-right whitespace-nowrap"><button data-cv-edit="' + r.id + '" class="text-xs text-blue-600 hover:underline mr-2">Edit</button><button data-cv-del="' + r.id + '" class="text-xs text-red-600 hover:underline">Hapus</button></td>' +
        '</tr>';
    }).join("");

    renderPagination(filtered.length, totalPages);
    updateBulkCount();
  }

  function fmtDate(d) {
    if (!d) return "-";
    try { return new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }); }
    catch (e) { return d; }
  }

  function renderPagination(totalRows, totalPages) {
    var bar = document.getElementById("cvPaginationBar");
    if (!bar) return;
    var startShown = totalRows ? (_currentPage - 1) * PAGE_SIZE + 1 : 0;
    var endShown = Math.min(_currentPage * PAGE_SIZE, totalRows);
    bar.innerHTML = '<span class="text-slate-400">Menampilkan ' + startShown + '-' + endShown + ' dari ' + totalRows + ' data</span>' +
      '<div class="flex items-center gap-1">' +
      '<button type="button" id="btnCvPagePrev" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 disabled:opacity-40" ' + (_currentPage <= 1 ? "disabled" : "") + '>‹ Sebelumnya</button>' +
      '<span class="px-2 text-slate-500">Halaman ' + _currentPage + ' / ' + totalPages + '</span>' +
      '<button type="button" id="btnCvPageNext" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 disabled:opacity-40" ' + (_currentPage >= totalPages ? "disabled" : "") + '>Selanjutnya ›</button></div>';
    var prevBtn = document.getElementById("btnCvPagePrev");
    var nextBtn = document.getElementById("btnCvPageNext");
    if (prevBtn) prevBtn.onclick = function () { _currentPage--; renderTable(); };
    if (nextBtn) nextBtn.onclick = function () { _currentPage++; renderTable(); };
  }

  function updateBulkCount() {
    var count = document.querySelectorAll("#cvTableBody [data-cv-select]:checked").length;
    var countEl = document.getElementById("cvBulkCount");
    if (countEl) countEl.textContent = count > 0 ? count + " dipilih" : "";
    var btn = document.getElementById("btnCvDeleteSelected");
    if (btn) btn.disabled = count === 0;
  }

  /* ---------------------------------------------------------------
     Modal Tambah / Edit
     --------------------------------------------------------------- */
  function openModal(existing) {
    var isEdit = !!existing;
    var old = document.getElementById("_cvModal");
    if (old) old.remove();
    _editingId = isEdit ? existing.id : null;
    var v = existing || {};

    var modal = document.createElement("div");
    modal.id = "_cvModal";
    modal.className = "modal-overlay";
    modal.style.cssText = "display:flex;z-index:9999;";
    var svcFieldsHtml = SERVICE_FIELDS.map(function (f) {
      return '<div><label class="block text-xs font-medium mb-1">' + esc(f.label) + '</label><input type="number" min="1" max="6" id="_cvSvc_' + f.key + '" class="input !py-1.5 !text-sm" value="' + (v[f.key] != null ? v[f.key] : "") + '"></div>';
    }).join("");

    modal.innerHTML = [
      '<div class="modal-box max-w-3xl">',
      '<h3 class="text-lg font-bold mb-1">' + (isEdit ? "✏️ Edit Customer Voice" : "👤 Tambah Customer Voice Manual") + "</h3>",
      '<p class="text-xs text-slate-500 mb-4">Skor tiap layanan 1-6 (kosongkan kalau tidak ada respon).</p>',
      '<div class="space-y-4 max-h-[70vh] overflow-y-auto pr-1">',
      '<div class="grid grid-cols-2 md:grid-cols-4 gap-3">',
      '<div><label class="block text-xs font-medium mb-1">Tanggal Terbang</label><input type="date" id="_cvTanggal" class="input !py-1.5 !text-sm" value="' + esc(v.tanggalTerbang || "") + '"></div>',
      '<div><label class="block text-xs font-medium mb-1">Airlines</label><select id="_cvAirlines" class="input !py-1.5 !text-sm"><option value="Sriwijaya Air"' + ("NAM Air" !== v.airlines ? " selected" : "") + '>Sriwijaya Air</option><option value="NAM Air"' + ("NAM Air" === v.airlines ? " selected" : "") + ">NAM Air</option></select></div>",
      '<div><label class="block text-xs font-medium mb-1">Dari</label><input id="_cvDari" class="input !py-1.5 !text-sm" value="' + esc(v.dari || "") + '"></div>',
      '<div><label class="block text-xs font-medium mb-1">Tujuan</label><input id="_cvTujuan" class="input !py-1.5 !text-sm" value="' + esc(v.tujuan || "") + '"></div>',
      "</div>",
      '<div class="grid grid-cols-2 md:grid-cols-4 gap-3">',
      '<div><label class="block text-xs font-medium mb-1">Email</label><input type="email" id="_cvEmail" class="input !py-1.5 !text-sm" value="' + esc(v.email || "") + '"></div>',
      '<div><label class="block text-xs font-medium mb-1">Stasiun Asal (From Station)</label><input id="_cvFromStation" class="input !py-1.5 !text-sm" value="' + esc(v.fromStation || "") + '"></div>',
      '<div><label class="block text-xs font-medium mb-1">Overall Satisfaction (1-6)</label><input type="number" min="1" max="6" id="_cvOverall" class="input !py-1.5 !text-sm" value="' + (v.overallSatisfaction != null ? v.overallSatisfaction : "") + '"></div>',
      '<div><label class="block text-xs font-medium mb-1">Recommend Likelihood (1-6)</label><input type="number" min="1" max="6" id="_cvRecommend" class="input !py-1.5 !text-sm" value="' + (v.recommendLikelihood != null ? v.recommendLikelihood : "") + '"></div>',
      "</div>",
      '<div class="pt-2 border-t border-slate-200 dark:border-slate-700"><p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Skor per Layanan (1-6)</p><div class="grid grid-cols-2 md:grid-cols-4 gap-3">' + svcFieldsHtml + "</div></div>",
      '<div><label class="block text-xs font-medium mb-1">Feedback Perbaikan (teks bebas)</label><textarea id="_cvFeedback" rows="3" class="input !text-sm">' + esc(v.feedbackText || "") + "</textarea></div>",
      "</div>",
      '<div class="flex gap-3 justify-end mt-5">',
      '<button id="_cvCancel" type="button" class="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 font-medium rounded-xl text-sm">Batal</button>',
      '<button id="_cvSave" type="button" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm">💾 ' + (isEdit ? "Update" : "Simpan") + "</button>",
      "</div></div>"
    ].join("");
    document.body.appendChild(modal);
    modal.addEventListener("click", function (e) { if (e.target === modal) { modal.remove(); _editingId = null; } });
    document.getElementById("_cvCancel").addEventListener("click", function () { modal.remove(); _editingId = null; });
    document.getElementById("_cvSave").addEventListener("click", handleSave);
  }

  function handleSave() {
    var tanggal = document.getElementById("_cvTanggal").value;
    var dari = document.getElementById("_cvDari").value.trim();
    if (!tanggal) { "function" === typeof window.showToast && window.showToast("Tanggal Terbang wajib diisi", "error"); return; }
    var list = loadCv();
    if (_editingId) {
      var idx = list.findIndex(function (r) { return r.id === _editingId; });
      if (idx === -1) { "function" === typeof window.showToast && window.showToast("Data tidak ditemukan (mungkin sudah dihapus)", "error"); return; }
      var updated = buildEntryFromForm(list[idx]);
      list[idx] = updated;
      saveCv(list);
      "function" === typeof window.showToast && window.showToast("Data Customer Voice berhasil diperbarui", "success");
    } else {
      var entry = buildEntryFromForm(null);
      list.push(entry);
      saveCv(list);
      "function" === typeof window.showToast && window.showToast("Data Customer Voice berhasil ditambahkan", "success");
    }
    var modal = document.getElementById("_cvModal");
    if (modal) modal.remove();
    _editingId = null;
    renderTable();
  }

  /* ---------------------------------------------------------------
     Import / Export / Template
     --------------------------------------------------------------- */
  var EXPORT_COLUMNS = ["Tanggal Terbang", "Email Address", "Berangkat Dari", "Tujuan Ke", "Airlines", "From Station",
    "Layanan Website", "Layanan Aplikasi Mobile", "Layanan Ticketing & Pelanggan", "Layanan Check-in",
    "Layanan Pengelolaan Boarding", "Performa Ketepatan Waktu", "Layanan Awak Kabin", "Kenyamanan Kursi Kabin",
    "Kebersihan Kabin", "Makanan Dalam Pesawat", "Toilet Pesawat", "Penanganan Bagasi",
    "Overall Satisfaction", "Recommend Likelihood", "Feedback Perbaikan"];

  function entryToExportRow(r) {
    return {
      "Tanggal Terbang": r.tanggalTerbang, "Email Address": r.email, "Berangkat Dari": r.dari, "Tujuan Ke": r.tujuan,
      "Airlines": r.airlines, "From Station": r.fromStation,
      "Layanan Website": r.website, "Layanan Aplikasi Mobile": r.mobileApp, "Layanan Ticketing & Pelanggan": r.ticketing,
      "Layanan Check-in": r.checkin, "Layanan Pengelolaan Boarding": r.boarding, "Performa Ketepatan Waktu": r.otp,
      "Layanan Awak Kabin": r.cabinCrew, "Kenyamanan Kursi Kabin": r.seatComfort, "Kebersihan Kabin": r.cleanliness,
      "Makanan Dalam Pesawat": r.food, "Toilet Pesawat": r.lavatory, "Penanganan Bagasi": r.baggage,
      "Overall Satisfaction": r.overallSatisfaction, "Recommend Likelihood": r.recommendLikelihood,
      "Feedback Perbaikan": r.feedbackText
    };
  }

  function handleExport() {
    var list = loadCv();
    if (!list.length) { "function" === typeof window.showToast && window.showToast("Belum ada data untuk diexport", "error"); return; }
    if (!window.XLSX) { "function" === typeof window.showToast && window.showToast("Library XLSX tidak tersedia", "error"); return; }
    var rows = list.map(entryToExportRow);
    var ws = XLSX.utils.json_to_sheet(rows, { header: EXPORT_COLUMNS });
    ws["!cols"] = EXPORT_COLUMNS.map(function () { return { wch: 20 }; });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customer Voice");
    var todayStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, "Customer_Voice_" + todayStr + ".xlsx");
    "function" === typeof window.showToast && window.showToast(rows.length + " data berhasil diexport", "success");
  }

  function handleTemplate() {
    if (!window.XLSX) { "function" === typeof window.showToast && window.showToast("Library XLSX tidak tersedia", "error"); return; }
    var example = {
      "Tanggal Terbang": "2026-07-16", "Email Address": "nama@email.com", "Berangkat Dari": "CGK", "Tujuan Ke": "UPG",
      "Airlines": "Sriwijaya Air", "From Station": "CGK",
      "Layanan Website": 5, "Layanan Aplikasi Mobile": 5, "Layanan Ticketing & Pelanggan": 6, "Layanan Check-in": 5,
      "Layanan Pengelolaan Boarding": 5, "Performa Ketepatan Waktu": 4, "Layanan Awak Kabin": 6, "Kenyamanan Kursi Kabin": 5,
      "Kebersihan Kabin": 5, "Makanan Dalam Pesawat": 4, "Toilet Pesawat": 4, "Penanganan Bagasi": 5,
      "Overall Satisfaction": 5, "Recommend Likelihood": 5, "Feedback Perbaikan": "Contoh: AC pesawat terlalu dingin"
    };
    var ws = XLSX.utils.json_to_sheet([example], { header: EXPORT_COLUMNS });
    ws["!cols"] = EXPORT_COLUMNS.map(function () { return { wch: 20 }; });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Customer Voice");
    XLSX.writeFile(wb, "Template_Customer_Voice_SJNAM.xlsx");
    "function" === typeof window.showToast && window.showToast("Template Excel berhasil diunduh", "success");
  }

  function getVal(row, keys) {
    for (var i = 0; i < keys.length; i++) {
      var wantedKey = keys[i].trim().toLowerCase();
      for (var rk in row) {
        if (!Object.prototype.hasOwnProperty.call(row, rk)) continue;
        // Header ASLI sheet SJ/IN berformat dwibahasa dengan baris baru,
        // mis. "Tanggal Terbang\n(Date of Flight)" — cocokkan berdasarkan
        // BARIS PERTAMA saja (sebelum newline), bukan exact-match penuh,
        // supaya import langsung dari file Excel asli tetap berhasil.
        var firstLine = rk.split("\n")[0].trim().toLowerCase();
        if (firstLine === wantedKey || firstLine.indexOf(wantedKey) === 0) return row[rk];
      }
    }
    return "";
  }
  function getValStr(row, keys) { var v = getVal(row, keys); return String(v == null ? "" : v).trim(); }
  function getValNum(row, keys) { var v = getVal(row, keys); var n = Number(v); return v === "" || v == null || isNaN(n) ? "" : n; }
  function toAirlinesName(v) {
    var s = (v || "").toLowerCase();
    if (s.indexOf("nam") !== -1) return "NAM Air";
    return "Sriwijaya Air";
  }

  function handleImport(e) {
    var file = e.target.files[0];
    if (!file) return;
    if (!window.XLSX) { "function" === typeof window.showToast && window.showToast("Library XLSX tidak tersedia", "error"); e.target.value = ""; return; }
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var wb = XLSX.read(ev.target.result, { type: "array", cellDates: true });
        var ws = wb.Sheets[wb.SheetNames[0]];

        // [BUG DITEMUKAN & DIPERBAIKI] File Excel ASLI (sheet SJ) punya
        // beberapa baris metadata (ringkasan Score/Max Value) SEBELUM
        // baris header sesungguhnya (baris ke-12) — tanpa deteksi ini,
        // sheet_to_json() salah menganggap baris metadata itu sebagai
        // header, membuat SEMUA baris data tertolak diam-diam. Dicari
        // dulu baris header yang benar (mengandung "Timestamp"),
        // meniru pola yang sudah ada di station-report.js.
        var rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
        var headerRowIdx = -1;
        for (var i = 0; i < rawRows.length; i++) {
          if (rawRows[i].some(function (c) { return String(c).trim().toLowerCase() === "timestamp"; })) { headerRowIdx = i; break; }
        }
        var rows;
        if (headerRowIdx !== -1) {
          var headerCells = rawRows[headerRowIdx];
          rows = rawRows.slice(headerRowIdx + 1)
            .filter(function (r) { return r.some(function (c) { return String(c).trim() !== ""; }); })
            .map(function (dataRow) {
              var obj = {};
              headerCells.forEach(function (h, colIdx) { if (h !== "") obj[h] = dataRow[colIdx] != null ? dataRow[colIdx] : ""; });
              return obj;
            });
        } else {
          rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false }); // fallback: file sederhana tanpa metadata (mis. template sendiri)
        }
        if (!rows.length) { "function" === typeof window.showToast && window.showToast("File Excel kosong atau format tidak sesuai", "error"); return; }

        var list = loadCv();
        var added = 0, updated = 0, skipped = 0;

        // [PATCH] Deteksi duplikat saat import Excel — sebelumnya TIDAK
        // ADA logika ini sama sekali: setiap baris selalu jadi record
        // baru (list.push tanpa syarat), jadi import file yang sama 2x
        // menghasilkan data dobel. Sekarang: tiap baris dicocokkan ke
        // data yang sudah ada lewat "kunci unik" —
        //   1) Kolom "Timestamp" asli dari spreadsheet (paling akurat,
        //      biasanya unik per submit Google Form/QR Survey), ATAU
        //   2) Kalau kolom Timestamp tidak ada/kosong: kombinasi
        //      email + tanggal terbang + airlines + rute (dari-tujuan)
        //      sebagai kunci cadangan.
        // Kalau kunci COCOK dengan data yang sudah ada -> GANTIKAN data
        // lama itu (id tetap sama, supaya referensi lain tidak rusak).
        // Kalau TIDAK cocok -> TAMBAHKAN sebagai data baru.
        function normKey(s) { return String(s == null ? "" : s).trim().toLowerCase(); }
        function buildDedupeKey(rec) {
          var ts = normKey(rec.sourceTimestamp);
          if (ts) return "ts:" + ts;
          return "ck:" + normKey(rec.email) + "|" + normKey(rec.tanggalTerbang) + "|" + normKey(rec.airlines) + "|" + normKey(rec.dari) + "|" + normKey(rec.tujuan);
        }
        var existingIndex = {};
        list.forEach(function (rec, idx) { existingIndex[buildDedupeKey(rec)] = idx; });
        console.log("[CustomerVoice][Import] Mulai import — " + rows.length + " baris terbaca dari Excel, " + list.length + " data sudah ada di sistem (diindeks utk deteksi duplikat).");

        rows.forEach(function (row, rowIdx) {
          var tanggal = toISODateLoose(getVal(row, ["Tanggal Terbang", "Tanggal", "Date of Flight"]));
          var dari = getValStr(row, ["Berangkat Dari", "Dari", "Departing From"]);
          if (!tanggal) { skipped++; return; }
          var airlines = toAirlinesName(getValStr(row, ["Airlines"]));
          var dateParts = deriveDateParts(tanggal);
          var entry = {
            id: genId(), timestamp: new Date().toISOString(),
            sourceTimestamp: getValStr(row, ["Timestamp"]),
            email: getValStr(row, ["Email Address", "Email"]),
            tanggalTerbang: tanggal, dari: dari, tujuan: getValStr(row, ["Tujuan Ke", "Tujuan", "Destination"]),
            airlines: airlines, fromStation: getValStr(row, ["From Station", "Stasiun Asal"]),
            overallSatisfaction: getValNum(row, ["Overall Satisfaction", "Bagaimana kepuasan Anda"]),
            recommendLikelihood: getValNum(row, ["Recommend Likelihood", "seberapa besar kemungkinan"]),
            feedbackText: getValStr(row, ["Feedback Perbaikan", "Bantu kami dengan memberikan masukan"]),
            year: dateParts.year, month: dateParts.month, date: dateParts.date, day: dateParts.day,
            qtyVoice: 1
          };
          SERVICE_FIELDS.forEach(function (f) {
            entry[f.key] = getValNum(row, [f.label, f.shortLabel, f.key]);
          });
          var totals = computeScoreTotals(entry);
          entry.totalScore = totals.totalScore; entry.totalQuestion = totals.totalQuestion;
          entry.maxScore = totals.maxScore; entry.percentScore = totals.percentScore;

          var key = buildDedupeKey(entry);
          if (Object.prototype.hasOwnProperty.call(existingIndex, key)) {
            var idx = existingIndex[key];
            entry.id = list[idx].id; // pertahankan id lama supaya tidak ada referensi yang putus
            list[idx] = entry;
            updated++;
            if (rowIdx < 5) console.log("[CustomerVoice][Import] Baris " + (rowIdx + 1) + " -> COCOK data lama (key=" + key + "), digantikan (update).");
          } else {
            list.push(entry);
            existingIndex[key] = list.length - 1;
            added++;
            if (rowIdx < 5) console.log("[CustomerVoice][Import] Baris " + (rowIdx + 1) + " -> tidak ada yang cocok (key=" + key + "), ditambahkan sebagai data baru.");
          }
        });

        console.log("[CustomerVoice][Import] Selesai — ditambahkan=" + added + ", digantikan(update)=" + updated + ", dilewati=" + skipped + ".");
        if (added > 0 || updated > 0) { saveCv(list); renderTable(); }
        var msg = added + " data baru ditambahkan" + (updated ? ", " + updated + " data diperbarui (menggantikan data yang sama)" : "") + (skipped ? ", " + skipped + " dilewati (Tanggal Terbang kosong)" : "");
        "function" === typeof window.showToast && window.showToast(msg, (added || updated) ? "success" : "error");
      } catch (err) {
        "function" === typeof window.showToast && window.showToast("Gagal membaca file Excel: " + err.message, "error");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /* ---------------------------------------------------------------
     Hapus
     --------------------------------------------------------------- */
  async function handleDeleteSingle(id) {
    var ok = "function" === typeof window.showConfirm
      ? await window.showConfirm("Hapus Data", "Yakin ingin menghapus data Customer Voice ini?")
      : window.confirm("Hapus data ini?");
    if (!ok) return;
    var list = loadCv().filter(function (r) { return r.id !== id; });
    saveCv(list);
    renderTable();
    "function" === typeof window.showToast && window.showToast("Data dihapus", "success");
  }

  async function handleDeleteSelected() {
    var ids = Array.from(document.querySelectorAll("#cvTableBody [data-cv-select]:checked")).map(function (cb) { return cb.getAttribute("data-cv-select"); });
    if (!ids.length) return;
    var ok = "function" === typeof window.showConfirm
      ? await window.showConfirm("Hapus Data Terpilih", "Hapus " + ids.length + " data Customer Voice yang dipilih?")
      : window.confirm("Hapus " + ids.length + " data terpilih?");
    if (!ok) return;
    var idSet = {}; ids.forEach(function (id) { idSet[id] = true; });
    var list = loadCv().filter(function (r) { return !idSet[r.id]; });
    saveCv(list);
    renderTable();
    "function" === typeof window.showToast && window.showToast(ids.length + " data terpilih berhasil dihapus", "success");
  }

  async function handleDeleteAll() {
    var total = loadCv().length;
    if (!total) { "function" === typeof window.showToast && window.showToast("Data sudah kosong", "error"); return; }
    var ok = "function" === typeof window.showConfirm
      ? await window.showConfirm("⚠️ Hapus SEMUA Data Customer Voice", "Ini akan menghapus SELURUH " + total + " data tanpa terkecuali. Tindakan ini TIDAK BISA DIBATALKAN. Lanjutkan?")
      : window.confirm("Hapus SEMUA " + total + " data?");
    if (!ok) return;
    saveCv([]);
    renderTable();
    "function" === typeof window.showToast && window.showToast("Semua data Customer Voice (" + total + ") berhasil dihapus", "success");
  }

  /* ---------------------------------------------------------------
     Init & wiring
     --------------------------------------------------------------- */
  function wireEvents() {
    document.getElementById("btnCvAdd")?.addEventListener("click", function () { openModal(null); });
    document.getElementById("btnCvExport")?.addEventListener("click", handleExport);
    document.getElementById("btnCvTemplate")?.addEventListener("click", handleTemplate);
    document.getElementById("btnCvImport")?.addEventListener("change", handleImport);
    document.getElementById("btnCvDeleteSelected")?.addEventListener("click", handleDeleteSelected);
    document.getElementById("btnCvDeleteAll")?.addEventListener("click", handleDeleteAll);
    window.bindFilterPersistence(document.getElementById("cvSearch"), "sjnam_cv_filter_search_v1");
    window.bindFilterPersistence(document.getElementById("cvFilterAirlines"), "sjnam_cv_filter_airlines_v1");
    document.getElementById("cvSearch")?.addEventListener("input", function () { _currentPage = 1; renderTable(); });
    document.getElementById("cvFilterAirlines")?.addEventListener("change", function () { _currentPage = 1; renderTable(); });

    var selectAllCb = document.getElementById("cvSelectAll");
    if (selectAllCb) selectAllCb.addEventListener("change", function (e) {
      var checked = e.target.checked;
      document.querySelectorAll("#cvTableBody [data-cv-select]").forEach(function (cb) {
        var tr = cb.closest("tr");
        if (tr && tr.style.display !== "none") cb.checked = checked;
      });
      updateBulkCount();
    });

    var tbody = document.getElementById("cvTableBody");
    if (tbody && !tbody._cvBound) {
      tbody._cvBound = true;
      tbody.addEventListener("click", function (e) {
        var editBtn = e.target.closest("[data-cv-edit]");
        var delBtn = e.target.closest("[data-cv-del]");
        if (editBtn) {
          var rec = loadCv().find(function (r) { return r.id === editBtn.getAttribute("data-cv-edit"); });
          if (rec) openModal(rec);
        }
        if (delBtn) handleDeleteSingle(delBtn.getAttribute("data-cv-del"));
      });
      tbody.addEventListener("change", function (e) {
        if (e.target.matches("[data-cv-select]")) updateBulkCount();
      });
    }
  }

  window.CustomerVoice = {
    load: loadCv, save: saveCv, render: renderTable,
    SERVICE_FIELDS: SERVICE_FIELDS, computeScoreTotals: computeScoreTotals
  };

  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    ensureSidebarToggle();
    var uiBuilt = ensureDataEntryUi();
    var ready = !!document.getElementById("cvTableBody");
    if (ready) { wireEvents(); renderTable(); }
    if (ready || tries > 60) clearInterval(iv);
  }, 250);

  // [PATCH perf] Jalur cepat TAMBAHAN via event global "sjn:app-ready"
  // (ditembak app-ready-bridge.js tepat setelah login/restore sesi
  // selesai). Polling di atas TETAP jalan sebagai fallback — kalau
  // event ini karena sebab apa pun tidak pernah tertembak, modul ini
  // tetap ter-inisialisasi seperti sebelumnya, tidak ada yang rusak.
  // ensureDataEntryUi() & wireEvents() sudah idempotent (dijaga flag
  // _cvUiBuilt / _cvBound) jadi aman dipanggil dobel oleh polling+event.
  document.addEventListener("sjn:app-ready", function () {
    console.log("[CustomerVoice] Menerima event 'sjn:app-ready' — coba inisialisasi lebih awal (tanpa menunggu polling).");
    ensureSidebarToggle();
    var uiBuilt = ensureDataEntryUi();
    if (document.getElementById("cvTableBody")) { wireEvents(); renderTable(); }
  });

  document.addEventListener("sjn:tab-changed", function (e) {
    if (e && e.detail && e.detail.tab === "cv-data") setTimeout(renderTable, 80);
  });

  console.info("%c[SJNAM] Customer Voice (Data Entry) aktif.", "color:#ec4899;font-weight:bold;font-size:11px");
}();
