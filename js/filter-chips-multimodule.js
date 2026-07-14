/* ================================================================
   SJNAM — FILTER CHIP: STCR DASHBOARD & EXECUTIVE DASHBOARD
   ================================================================
   Pola sama persis dengan baggage-ux-enhance.js (yang sudah lebih
   dulu ada, khusus modul Baggage Report) — di sini digeneralisasi
   supaya bisa dipakai untuk beberapa modul sekaligus lewat daftar
   konfigurasi, tanpa mengubah baggage-ux-enhance.js itu sendiri.

   Filter yang sedang aktif ditampilkan sebagai "chip" kecil yang
   bisa diklik ✕ untuk menghapus SATU filter saja (tanpa reset
   semua filter sekaligus).
   ================================================================ */
!function () {
  "use strict";

  if (window._filterChipsMultiModuleInit) return;
  window._filterChipsMultiModuleInit = true;

  var MODULES = [
    // CATATAN: modul STCR Dashboard SENGAJA tidak dimasukkan di sini —
    // stcr-ux-enhance.js sudah lebih dulu mengimplementasikan filter chip
    // untuk STCR Dashboard persis dengan container id yang sama
    // ("stcrFilterChips") dan filter yang sama. Menambahkannya di sini
    // lagi akan membuat DUA listener berebut elemen DOM yang sama.
    {
      // Executive Dashboard
      anchorSelector: "#execFilterInfo",
      containerId: "execFilterChips",
      insertMode: "after",
      filters: [
        { id: "exec-f-year", label: "Tahun" },
        { id: "exec-f-month", label: "Bulan" }
      ]
    }
  ];

  function ensureChipContainer(cfg) {
    var existing = document.getElementById(cfg.containerId);
    if (existing) return existing;
    var anchor = document.querySelector(cfg.anchorSelector);
    if (!anchor) return null;
    var row = document.createElement("div");
    row.id = cfg.containerId;
    row.className = "filter-chip-row";
    if (cfg.insertMode === "after") {
      anchor.parentNode.insertBefore(row, anchor.nextSibling);
    } else {
      anchor.parentNode.insertBefore(row, anchor.nextSibling);
    }
    return row;
  }

  function renderChips(cfg) {
    var container = document.getElementById(cfg.containerId) || ensureChipContainer(cfg);
    if (!container) return;
    var chipsHtml = [];
    cfg.filters.forEach(function (f) {
      var el = document.getElementById(f.id);
      if (!el || !el.value) return;
      var displayValue = el.value;
      if (el.tagName === "SELECT" && el.selectedIndex > -1 && el.options[el.selectedIndex]) {
        displayValue = el.options[el.selectedIndex].text;
      }
      chipsHtml.push(
        '<span class="filter-chip">' +
          escapeHtml(f.label) +
          ": " +
          escapeHtml(displayValue) +
          '<button type="button" data-clear-filter="' +
          f.id +
          '" data-module="' +
          cfg.containerId +
          '">✕</button></span>'
      );
    });
    container.innerHTML = chipsHtml.join("");
    container.querySelectorAll("[data-clear-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-clear-filter");
        var el = document.getElementById(id);
        if (!el) return;
        el.value = "";
        el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
        renderChips(cfg);
      });
    });
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function wireModule(cfg) {
    cfg.filters.forEach(function (f) {
      var el = document.getElementById(f.id);
      if (!el || el._filterChipBound) return;
      el._filterChipBound = true;
      el.addEventListener(el.tagName === "SELECT" ? "change" : "input", function () {
        renderChips(cfg);
      });
    });
    renderChips(cfg);
  }

  function initAll() {
    MODULES.forEach(function (cfg) {
      try {
        wireModule(cfg);
      } catch (e) {
        console.warn("[filter-chips-multimodule] Gagal inisialisasi modul " + cfg.containerId + ":", e);
      }
    });
  }

  // Filter di beberapa modul (mis. tab STCR) baru ada di DOM setelah
  // user membuka tab-nya pertama kali — jadi dicoba beberapa kali,
  // sama seperti pola di baggage-ux-enhance.js.
  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    initAll();
    if (tries > 60) clearInterval(iv);
  }, 500);

  document.addEventListener("sjn:tab-changed", function () {
    setTimeout(initAll, 80);
  });

  console.info(
    "%c[SJNAM] Filter chip Executive Dashboard aktif.",
    "color:#7c3aed;font-weight:bold;font-size:11px"
  );
}();
