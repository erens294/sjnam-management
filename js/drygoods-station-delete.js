/* ================================================================
   SJNAM — HAPUS STATION DARI KARTU STOK DRYGOODS
   ================================================================
   Menambahkan tombol "✕" pada tiap tab station di Kartu Stok
   Drygoods, supaya station yang sudah tidak dipakai bisa disembunyikan
   dari daftar tab tanpa perlu menghapus transaksi yang sudah ada.

   PENTING — apa yang TIDAK terjadi saat hapus station di sini:
   Ini hanya menghapus kode station dari daftar "tab pintasan"
   (dgData.stations). Transaksi yang sudah tercatat untuk station
   itu TETAP ada & tetap bisa dilihat/di-export — kode station
   otomatis muncul lagi sebagai tab begitu ada transaksi baru
   dibuat untuk station itu (lihat ensureStationActive() di
   drygoods.js). Ini konsisten dengan cara kerja "+ Station" yang
   sudah ada (menambah ke daftar pintasan yang sama).

   Kenapa dibuat file terpisah (bukan edit drygoods.js langsung):
   drygoods.js dibungkus IIFE & terminifikasi jadi satu baris,
   variabel seperti dgData & activeDgStation adalah closure privat.
   Untungnya drygoods.js SUDAH meng-expose beberapa pintu resmi ke
   window: window.DRYGOODS.getData() (referensi langsung ke dgData,
   termasuk array dgData.stations — bisa dimodifikasi langsung karena
   array di-passing by reference), window.DRYGOODS.saveData(),
   window.buildDgStationTabs(), dan window.renderDgTrx(). Semua
   modifikasi di file ini lewat pintu-pintu resmi itu, TIDAK menebak
   struktur internal yang tidak di-expose.

   Karena buildStationTabs() (drygoods.js) selalu me-replace total
   innerHTML #dgStationTabs setiap kali dipanggil, tombol hapus yang
   kita sisipkan akan selalu hilang lagi — makanya dipasang ulang
   lewat MutationObserver, bukan cuma sekali saat load (pola yang
   sama seperti fitur status Aktif/Non-Aktif Bank Data Station).

   [BUG DITEMUKAN & DIPERBAIKI] drygoods.js sudah punya listener
   "sjn:stations-updated" yang otomatis membuang kode station yang
   sudah tidak valid dari dgData.stations (mis. station dihapus dari
   Bank Data Station) — tapi listener itu tidak pernah memanggil
   renderDgTrx() sesudahnya. Akibatnya tabel transaksi bisa tetap
   menampilkan data yang sudah difilter berdasarkan tab yang baru
   saja hilang, sampai user klik tab lain secara manual. File ini
   menambah listener KEDUA untuk event yang sama (event listener
   custom boleh lebih dari satu, semua tetap terpanggil) yang
   melengkapi dengan renderDgTrx() — tanpa perlu mengubah drygoods.js.
   ================================================================ */
!function () {
  "use strict";

  if (window._dgStationDeleteInit) return;
  window._dgStationDeleteInit = true;

  function isPrivileged() {
    var cu = window.currentUser;
    if (!cu) return true; // fallback: jangan sembunyikan kalau status user belum jelas
    if ("User-DRG" !== cu.role) return true;
    var locked = window._userDrgStation;
    return !locked || "ALL" === locked;
  }

  function ensureStyle() {
    if (document.getElementById("dgStationDelStyle")) return;
    var style = document.createElement("style");
    style.id = "dgStationDelStyle";
    style.textContent =
      ".dg-station-tab-wrap{display:inline-flex;align-items:center;position:relative;}" +
      ".dg-station-del-btn{margin-left:2px;width:16px;height:16px;line-height:16px;text-align:center;" +
      "border-radius:9999px;font-size:11px;font-weight:700;color:#94a3b8;background:transparent;" +
      "cursor:pointer;flex-shrink:0;}" +
      ".dg-station-del-btn:hover{background:#fee2e2;color:#dc2626;}";
    document.head.appendChild(style);
  }

  function decorateTabs() {
    var container = document.getElementById("dgStationTabs");
    if (!container) return;
    var privileged = isPrivileged();
    Array.from(container.querySelectorAll('[data-dg-station]')).forEach(function (tabBtn) {
      var code = tabBtn.getAttribute("data-dg-station");
      if (!code || code === "ALL") return;
      if (tabBtn.parentElement && tabBtn.parentElement.classList.contains("dg-station-tab-wrap")) {
        // Sudah dibungkus sebelumnya — tinggal update tampil/sembunyi tombol hapusnya saja
        var existingBtn = tabBtn.parentElement.querySelector(".dg-station-del-btn");
        if (existingBtn) existingBtn.style.display = privileged ? "" : "none";
        return;
      }
      var wrap = document.createElement("span");
      wrap.className = "dg-station-tab-wrap";
      tabBtn.parentNode.insertBefore(wrap, tabBtn);
      wrap.appendChild(tabBtn);

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "dg-station-del-btn";
      delBtn.setAttribute("data-dg-del-station", code);
      delBtn.title = "Hapus tab station " + code + " (data transaksi tidak ikut terhapus)";
      delBtn.textContent = "✕";
      delBtn.style.display = privileged ? "" : "none";
      wrap.appendChild(delBtn);
    });
  }

  function observeTabs() {
    var container = document.getElementById("dgStationTabs");
    if (!container || container._dgDelObserved) return;
    container._dgDelObserved = true;
    new MutationObserver(function () { decorateTabs(); }).observe(container, { childList: true });
  }

  document.addEventListener("click", function (e) {
    var delBtn = e.target.closest && e.target.closest("[data-dg-del-station]");
    if (!delBtn) return;
    e.preventDefault();
    e.stopPropagation(); // supaya tidak ikut memicu tab-switch pada button station di sampingnya

    if (!isPrivileged()) {
      "function" === typeof window.showToast && window.showToast(
        "Akses Anda terbatas ke station " + window._userDrgStation + " — hanya user dengan akses ALL station yang dapat menghapus station.",
        "error"
      );
      return;
    }

    var code = delBtn.getAttribute("data-dg-del-station");
    var dg = window.DRYGOODS && window.DRYGOODS.getData ? window.DRYGOODS.getData() : null;
    if (!dg || !Array.isArray(dg.stations)) return;

    var doDelete = function () {
      var idx = dg.stations.indexOf(code);
      if (idx === -1) return;
      dg.stations.splice(idx, 1);
      "function" === typeof window.DRYGOODS.saveData && window.DRYGOODS.saveData();

      // Kalau tab yang dihapus sedang aktif/terpilih, alihkan tampilan ke "All"
      // dengan mensimulasikan klik asli (bukan menebak variabel privat activeDgStation),
      // supaya seluruh logic internal drygoods.js (simpan pilihan, render ulang, dst)
      // tetap berjalan normal lewat jalur yang sama seperti klik manual.
      var wasActive = delBtn.parentElement && delBtn.parentElement.querySelector('[data-dg-station]')?.classList.contains("border-blue-600");
      "function" === typeof window.buildDgStationTabs && window.buildDgStationTabs();
      if (wasActive) {
        var allBtn = document.querySelector('#dgStationTabs [data-dg-station="ALL"]');
        allBtn && allBtn.click();
      }
      "function" === typeof window.renderDgTrx && window.renderDgTrx();
      "function" === typeof window.showToast && window.showToast("Tab station " + code + " dihapus (data transaksi tetap tersimpan)", "success");
    };

    if ("function" === typeof window.showConfirm) {
      window.showConfirm(
        "Hapus Tab Station",
        "Hapus tab station \"" + code + "\" dari Kartu Stok Drygoods?\n\nData transaksi yang sudah ada untuk station ini TIDAK akan terhapus, dan tab ini akan muncul kembali otomatis kalau ada transaksi baru dibuat untuk station tsb."
      ).then(function (ok) { if (ok) doDelete(); });
    } else if (window.confirm("Hapus tab station " + code + "? (data transaksi tidak ikut terhapus)")) {
      doDelete();
    }
  });

  // [BUG FIX] Lengkapi listener "sjn:stations-updated" bawaan drygoods.js
  // dengan renderDgTrx(), supaya tabel transaksi tidak menampilkan data
  // basi setelah station yang sudah tidak valid otomatis terbuang.
  document.addEventListener("sjn:stations-updated", function () {
    "function" === typeof window.renderDgTrx && window.renderDgTrx();
  });

  function init() {
    ensureStyle();
    observeTabs();
    decorateTabs();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  console.info("%c[SJNAM] Hapus Tab Station Drygoods aktif.", "color:#ea580c;font-weight:bold;font-size:11px");
}();
