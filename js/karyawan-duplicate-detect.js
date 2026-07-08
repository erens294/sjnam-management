/* ================================================================
   SJNAM — DETEKSI DUPLIKAT NIP DI DATA KARYAWAN
   ================================================================
   Kenapa fitur ini dibuat: validasi NIP unik yang sudah ada di
   karyawan-management.js (doSaveKaryawan) HANYA mengecek array
   karyawan LOKAL di device yang dipakai saat itu, sebelum data
   sempat disinkronkan. Kalau 2 device berbeda sama-sama membuat
   entry untuk orang yang SAMA (mis. karena masing-masing belum
   sempat menarik data terbaru saat itu), masing-masing device lolos
   validasi lokalnya sendiri — hasilnya 2 entry karyawan dengan id
   berbeda tapi NIP sama, yang tidak akan pernah "sembuh sendiri"
   lewat perbaikan sinkronisasi apa pun karena memang bukan bug
   sync, tapi duplikasi data yang sah menurut sistem merge (id
   berbeda = tidak dianggap konflik). Gejalanya: browser yang
   berbeda menampilkan station terkunci yang berbeda-beda secara
   PERMANEN untuk "orang yang sama" — masing-masing sebenarnya
   membaca entry karyawan yang BERBEDA.

   Kenapa dibuat file terpisah: karyawan-management.js tidak
   di-minifikasi tapi variabel `karyawan` & `renderKaryawan` ada
   di closure IIFE-nya sendiri, listener pencarian/filter yang
   sudah ada menyimpan referensi fungsi render aslinya secara
   permanen. Sama seperti fitur duplikat Bank Data Peserta,
   dipakai MutationObserver pada #karyawanTableBody supaya
   penandaan duplikat SELALU konsisten apa pun pemicu render-nya
   (cari, filter station, edit, dst).
   ================================================================ */
!function () {
  "use strict";

  if (window._karyawanDupDetectInit) return;
  window._karyawanDupDetectInit = true;

  var _filterActive = false;
  var _marking = false;

  function getKaryawanList() {
    try { return JSON.parse(localStorage.getItem("sjnam_karyawan_v1") || "[]"); }
    catch (e) { return []; }
  }

  function buildDuplicateInfo() {
    var list = getKaryawanList();
    var dupIdSet = new Set();
    var groupCount = 0;
    var groups = {};
    list.forEach(function (k) {
      var nip = String(k && k.nip || "").trim().toLowerCase();
      if (!nip) return; // NIP kosong tidak relevan dibandingkan
      (groups[nip] = groups[nip] || []).push(k);
    });
    Object.keys(groups).forEach(function (nip) {
      if (groups[nip].length > 1) {
        groupCount++;
        groups[nip].forEach(function (k) { if (k.id) dupIdSet.add(k.id); });
      }
    });
    return { dupIdSet: dupIdSet, dupCount: dupIdSet.size, groupCount: groupCount };
  }

  function ensureDupStyle() {
    if (document.getElementById("karyawanDupStyle")) return;
    var style = document.createElement("style");
    style.id = "karyawanDupStyle";
    style.textContent =
      'tr.karyawan-dup-row{background-color:rgba(245,158,11,0.12) !important;}' +
      'tr.karyawan-dup-row td:nth-child(2){position:relative;}' +
      'tr.karyawan-dup-row td:nth-child(2)::after{content:" \\1F501 NIP Duplikat";color:#b45309;font-weight:700;font-size:10px;margin-left:6px;white-space:nowrap;}';
    document.head.appendChild(style);
  }

  function updateDupSummary(info) {
    var el = document.getElementById("karyawanDupSummary");
    if (!el) return;
    if (info.dupCount > 0) {
      el.textContent = "⚠️ " + info.dupCount + " data karyawan berpotensi duplikat (" + info.groupCount + " NIP kembar) — station/role bisa beda-beda antar device";
      el.classList.remove("hidden");
    } else {
      el.textContent = "";
      el.classList.add("hidden");
    }
  }

  function markDuplicates() {
    if (_marking) return;
    _marking = true;
    try {
      var tbody = document.getElementById("karyawanTableBody");
      if (!tbody) return;
      var list = getKaryawanList();
      var info = buildDuplicateInfo();
      var rows = tbody.querySelectorAll("tr");
      rows.forEach(function (tr) {
        var cells = tr.querySelectorAll("td");
        if (cells.length < 3) return; // baris "Memuat..."/"Belum ada data" placeholder
        var nipText = (cells[2].textContent || "").trim().toLowerCase();
        if (!nipText) return;
        var isDup = list.some(function (k) {
          return String(k.nip || "").trim().toLowerCase() === nipText && info.dupIdSet.has(k.id);
        });
        tr.classList.toggle("karyawan-dup-row", isDup);
        tr.title = isDup ? "⚠️ NIP ini dipakai lebih dari satu baris data karyawan — kemungkinan duplikat dari 2 device berbeda" : "";
        if (_filterActive) {
          tr.style.display = isDup ? "" : "none";
        } else if (tr.style.display === "none") {
          tr.style.display = "";
        }
      });
      updateDupSummary(info);
    } finally {
      _marking = false;
    }
  }

  function ensureDupUI() {
    ensureDupStyle();

    if (!document.getElementById("karyawanDupSummary")) {
      var paragraphs = document.querySelectorAll("p");
      var totalP = Array.from(paragraphs).find(function (p) { return /Total Karyawan/.test(p.textContent); });
      if (totalP && totalP.parentNode) {
        var dupP = document.createElement("p");
        dupP.id = "karyawanDupSummary";
        dupP.className = "text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1 hidden";
        totalP.parentNode.insertBefore(dupP, totalP.nextSibling);
      }
    }

    var searchInput = document.getElementById("karyawanSearch");
    if (searchInput && !document.getElementById("btnToggleKaryawanDupFilter")) {
      var btn = document.createElement("button");
      btn.id = "btnToggleKaryawanDupFilter";
      btn.type = "button";
      btn.className = "px-3 py-2 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-sm font-semibold rounded-xl";
      btn.textContent = "🔁 Tampilkan Hanya Duplikat";
      btn.addEventListener("click", function () {
        _filterActive = !_filterActive;
        btn.textContent = _filterActive ? "✖️ Tampilkan Semua" : "🔁 Tampilkan Hanya Duplikat";
        btn.classList.toggle("bg-amber-500", _filterActive);
        btn.classList.toggle("text-white", _filterActive);
        markDuplicates();
      });
      searchInput.insertAdjacentElement("afterend", btn);
    }
  }

  function observeTable() {
    var tbody = document.getElementById("karyawanTableBody");
    if (!tbody || tbody._karyawanDupObserved) return;
    tbody._karyawanDupObserved = true;
    new MutationObserver(function () { markDuplicates(); }).observe(tbody, { childList: true });
  }

  function init() {
    try {
      ensureDupUI();
      observeTable();
      markDuplicates();
    } catch (err) {
      console.error("[karyawan-dup-detect] Gagal inisialisasi:", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  // Data karyawan bisa berubah kapan saja lewat sync — pastikan tanda duplikat
  // ikut ter-update walau tabel sedang tidak sedang di-render ulang oleh user.
  document.addEventListener("sjn:karyawan-updated", function () { markDuplicates(); });

  console.info("%c[SJNAM] Deteksi duplikat NIP Data Karyawan aktif.", "color:#ea580c;font-weight:bold;font-size:11px");
}();
