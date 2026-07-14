/* ================================================================
   SJNAM — FILTER PERSISTENCE UNIVERSAL (SEMUA MODUL)
   ================================================================
   Menyimpan & memulihkan isi filter (search box, dropdown, tanggal)
   di SEMUA modul yang punya filter — supaya tidak reset ke kosong
   setiap kali halaman di-refresh. Pelengkap dari stcr-filter-persist.js
   dan baggage-filter-persist.js yang sudah dibuat lebih dulu secara
   khusus (keduanya TETAP dipakai terpisah, tidak digantikan file ini).

   Cara kerja: 1 "mesin" generik dipakai berulang untuk tiap modul,
   supaya tidak perlu menulis file terpisah untuk masing-masing —
   modul baru cukup ditambahkan sebagai 1 baris konfigurasi di bawah.

   Modul yang dicakup di sini:
   - Data Karyawan            (karyawanSearch, karyawanFilterStation)
   - Kelola Akun               (userSearchInput, userFilterRole, userFilterStatus)
   - Bank Item Drygoods         (dgBankItemSearch, dgBankItemFilterGroup)
   - Data Stok Drygoods         (dgSearchTrx, dgFilterDateFrom/To, dgFilterType)
   - Activity Report (Rekap)    (srActHistorySearch)
   - Check-In Report            (srCiSearch)
   - First Bag Last Bag         (srFlbSearch)
   - Bank Data Peserta Training (pesertaSearch)
   - Bank Data Station          (searchStation)
   ================================================================ */
!function () {
  "use strict";

  if (window._universalFilterPersistInit) return;
  window._universalFilterPersistInit = true;

  var LS_KEY = "sjnam_universal_filters_v1";

  // Setiap modul: { key: nama unik, ids: [daftar id elemen filter] }
  var MODULES = [
    { key: "karyawan", ids: ["karyawanSearch", "karyawanFilterStation"] },
    { key: "users", ids: ["userSearchInput", "userFilterRole", "userFilterStatus"] },
    { key: "dgBankItem", ids: ["dgBankItemSearch", "dgBankItemFilterGroup"] },
    { key: "dgTrx", ids: ["dgSearchTrx", "dgFilterDateFrom", "dgFilterDateTo", "dgFilterType"] },
    { key: "srActHistory", ids: ["srActHistorySearch"] },
    { key: "srCi", ids: ["srCiSearch"] },
    { key: "srFlb", ids: ["srFlbSearch"] },
    { key: "peserta", ids: ["pesertaSearch"] },
    { key: "stations", ids: ["searchStation"] }
  ];
  var ALL_IDS = MODULES.reduce(function (acc, m) { return acc.concat(m.ids); }, []);

  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch (e) { return {}; }
  }
  function saveSaved(obj) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch (e) { /* abaikan */ }
  }

  function eventNameFor(el) {
    return el.tagName === "SELECT" || el.type === "date" ? "change" : "input";
  }

  function saveCurrentFilters() {
    var saved = loadSaved();
    ALL_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) saved[id] = el.value;
    });
    saveSaved(saved);
  }

  function restoreFilters() {
    var saved = loadSaved();
    var restoredAny = false;
    ALL_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || saved[id] === undefined || saved[id] === "") return;
      if (el.tagName === "SELECT") {
        var hasOption = Array.from(el.options).some(function (o) { return o.value === saved[id]; });
        if (!hasOption) return; // opsi belum siap (diisi dinamis) -> coba lagi nanti
      }
      if (el.value !== saved[id]) {
        el.value = saved[id];
        el.dispatchEvent(new Event(eventNameFor(el), { bubbles: true }));
        restoredAny = true;
      }
    });
    return restoredAny;
  }

  function bindChangeListeners() {
    ALL_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el._universalFilterBound) return;
      el._universalFilterBound = true;
      el.addEventListener(eventNameFor(el), saveCurrentFilters);
    });
  }

  // Sebagian dropdown (mis. karyawanFilterStation, dgBankItemFilterGroup)
  // diisi ulang secara dinamis oleh modul masing-masing (opsinya baru
  // muncul belakangan) — jadi pemulihan dicoba berkali-kali sampai
  // berhasil, bukan cuma sekali di awal.
  bindChangeListeners(); // pasang segera (jangan nunggu interval pertama)
  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    bindChangeListeners();
    restoreFilters();
    if (tries > 60) clearInterval(iv); // ~15 detik, cukup utk semua modul selesai render dinamis
  }, 250);

  console.info("%c[SJNAM] Filter persistence universal (Karyawan, User, Drygoods, Station Report, Training, Station) aktif.", "color:#0891b2;font-weight:bold;font-size:11px");
}();
