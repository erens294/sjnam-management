/* ================================================================
   SJNAM — STATUS AKTIF / NON-AKTIF UNTUK BANK DATA STATION
   ================================================================
   Menambahkan kolom "Status" (Aktif/Non-Aktif) pada tabel Bank Data
   Station (tab "Stations"), plus badge jumlah station aktif.

   Kenapa dibuat file terpisah (bukan edit service-recovery.js
   langsung): service-recovery.js sudah terminifikasi jadi satu
   baris. Meski variabel & fungsinya (stations, renderStations,
   saveStations, dst) bersifat global (tidak dibungkus IIFE, jadi
   bisa diakses lewat window), listener yang SUDAH ADA (search
   input, tombol Edit, dsb) sudah menyimpan referensi fungsi asli
   secara permanen saat didaftarkan — override window.renderStations
   TIDAK akan mengubah perilaku listener yang sudah telanjur berjalan
   itu. Solusinya sama seperti fitur duplikat di Bank Data Peserta:
   MutationObserver pada #stationBody, supaya kolom Status SELALU
   konsisten ditambahkan apa pun pemicu render-nya (cari, edit,
   toggle, dsb).

   Untuk field "aktif" pada form Tambah/Edit Station: karena
   window.saveStations() dipanggil oleh nama (bukan lewat callback
   tersimpan), pemanggilan itu di-resolve ulang setiap saat, sehingga
   AMAN untuk di-override dari sini — override tsb dipakai untuk
   menyisipkan nilai checkbox #stAktif ke object station yang baru
   saja disimpan, sebelum data dipersist.
   ================================================================ */
!function () {
  "use strict";

  // Guard anti double-init — kalau file ini ter-include dua kali secara
  // tidak sengaja, semua listener di bawah tidak akan terpasang dobel
  // (yang bisa bikin toggle saling membatalkan & toast muncul 2x).
  if (window._stationActiveStatusInit) return;
  window._stationActiveStatusInit = true;

  // Robust terhadap variasi nilai "tidak aktif" (false, 0, "false", "0",
  // dsb) — bukan cuma strict `!== false` — supaya tahan terhadap data
  // yang mungkin masuk lewat restore JSON manual atau sumber lain.
  function isActive(s) {
    if (!s) return true;
    var v = s.aktif;
    if (v === undefined || v === null) return true; // default aktif kalau field belum ada
    if (v === false || v === 0 || v === "false" || v === "0" || v === "no" || v === "off") return false;
    return true;
  }

  function escAttr(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ── Tangkap nilai form SEBELUM listener submit asli sempat mereset form ──
  // (capture phase pada document berjalan lebih dulu daripada listener
  // submit yang didaftarkan langsung di elemen form itu sendiri).
  document.addEventListener("submit", function (e) {
    if (!e.target || e.target.id !== "formStation") return;
    var iataInput = document.getElementById("stIata");
    var aktifInput = document.getElementById("stAktif");
    window._pendingStationAktif = {
      iata: iataInput ? iataInput.value.trim().toUpperCase() : "",
      aktif: aktifInput ? aktifInput.checked : true
    };
  }, true);

  // ── Override saveStations(): tempelkan aktif dari form ke station yang baru disimpan ──
  function wrapSaveStations() {
    if (typeof window.saveStations !== "function" || window.saveStations._stAktifWrapped) return;
    var origSaveStations = window.saveStations;
    var wrapped = function () {
      try {
        var pending = window._pendingStationAktif;
        if (pending && pending.iata && Array.isArray(window.stations)) {
          var st = window.stations.find(function (s) { return s.iata === pending.iata; });
          if (st) st.aktif = pending.aktif;
        }
      } catch (err) {
        console.error("[station-active-status] Gagal menerapkan status aktif:", err);
      }
      window._pendingStationAktif = null;
      return origSaveStations.apply(this, arguments);
    };
    wrapped._stAktifWrapped = true;
    window.saveStations = wrapped;
  }

  // ── Isi ulang checkbox #stAktif saat tombol Edit station diklik ──
  document.addEventListener("click", function (e) {
    var editBtn = e.target.closest && e.target.closest("[data-st-edit]");
    if (editBtn) {
      var aktifInput = document.getElementById("stAktif");
      var st = Array.isArray(window.stations) ? window.stations.find(function (s) { return s.iata === editBtn.getAttribute("data-st-edit"); }) : null;
      if (aktifInput && st) aktifInput.checked = isActive(st);
    }

    // ── Toggle Aktif/Non-Aktif langsung dari tabel ──
    var toggleBtn = e.target.closest && e.target.closest("[data-st-toggle]");
    if (toggleBtn) {
      var iata = toggleBtn.getAttribute("data-st-toggle");
      var s = Array.isArray(window.stations) ? window.stations.find(function (x) { return x.iata === iata; }) : null;
      if (!s) return;
      s.aktif = !isActive(s);
      "function" === typeof window.saveStations && window.saveStations();
      "function" === typeof window.renderStations && window.renderStations();
      "function" === typeof window.showToast && window.showToast(
        "Station " + iata + " " + (isActive(s) ? "diaktifkan ✅" : "dinonaktifkan ⛔"),
        isActive(s) ? "success" : "info"
      );
    }
  });

  // ── Tambah header "Status" (sekali saja) ──
  function ensureStatusHeader() {
    var headRow = document.querySelector("#tab-stations thead tr");
    if (!headRow || headRow.querySelector("[data-status-header]")) return;
    var zonaTh = Array.from(headRow.children).find(function (th) { return /zona/i.test(th.textContent); });
    var th = document.createElement("th");
    th.setAttribute("data-status-header", "1");
    th.className = "px-3 py-2.5 text-center font-semibold text-xs uppercase";
    th.textContent = "Status";
    if (zonaTh && zonaTh.nextSibling) headRow.insertBefore(th, zonaTh.nextSibling);
    else headRow.appendChild(th);
  }

  // ── Sisipkan sel Status ke tiap baris + update badge jumlah aktif ──
  function decorateStationTable() {
    var tbody = document.getElementById("stationBody");
    if (!tbody) return;
    ensureStatusHeader();

    var stationsArr = Array.isArray(window.stations) ? window.stations : [];
    Array.from(tbody.querySelectorAll("tr")).forEach(function (tr) {
      if (tr.querySelector("[data-st-toggle]")) return; // sudah diproses
      var cells = tr.querySelectorAll("td");
      if (cells.length < 4) return; // baris kosong/placeholder ("Belum ada station")
      var iata = (cells[0].textContent || "").trim();
      var st = stationsArr.find(function (s) { return s.iata === iata; });
      var active = isActive(st);
      var td = document.createElement("td");
      td.className = "px-3 py-2.5 text-center";
      td.innerHTML = '<button type="button" data-st-toggle="' + escAttr(iata) + '" class="badge cursor-pointer ' +
        (active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300") +
        '" title="Klik untuk ' + (active ? "nonaktifkan" : "aktifkan") + '">' +
        (active ? "✅ Aktif" : "⛔ Non-Aktif") + "</button>";
      // Sisipkan setelah kolom Zona (index 2), sebelum Time Now (index 3)
      tr.insertBefore(td, cells[3] || null);
    });

    var countEl = document.getElementById("stationCount");
    if (countEl) {
      var totalActive = stationsArr.filter(isActive).length;
      countEl.textContent = totalActive + " Station Aktif" + (stationsArr.length !== totalActive ? " (dari " + stationsArr.length + " total)" : "");
    }
  }

  function observeStationTable() {
    var tbody = document.getElementById("stationBody");
    if (!tbody || tbody._stAktifObserved) return;
    tbody._stAktifObserved = true;
    new MutationObserver(function () { decorateStationTable(); }).observe(tbody, { childList: true });
  }

  function init() {
    wrapSaveStations();
    observeStationTable();
    decorateStationTable();
    // saveStations bisa saja belum ada saat DOMContentLoaded (urutan script),
    // coba wrap ulang beberapa kali untuk jaga-jaga.
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      wrapSaveStations();
      if (window.saveStations && window.saveStations._stAktifWrapped) clearInterval(iv);
      if (tries > 40) clearInterval(iv);
    }, 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  console.info("%c[SJNAM] Status Aktif/Non-Aktif Bank Data Station aktif.", "color:#0891b2;font-weight:bold;font-size:11px");
}();
