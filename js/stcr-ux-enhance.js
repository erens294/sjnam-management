/* ================================================================
   SJNAM — UX ENHANCEMENT: STCR (FILTER CHIP)
   ================================================================
   Menerapkan pola filter chip (sudah terbukti di Baggage Report)
   ke modul STCR & POB Request — filter yang sedang aktif (Tahun,
   Bulan, AOC, Tipe Request, Stasiun) ditampilkan sebagai chip kecil
   yang bisa dihapus satu-satu tanpa reset semua filter.
   ================================================================ */
!function () {
  "use strict";

  if (window._stcrUxEnhanceInit) return;
  window._stcrUxEnhanceInit = true;

  var FILTERS = [
    { id: "stcr-f-year", label: "Tahun" },
    { id: "stcr-f-month", label: "Bulan" },
    { id: "stcr-f-aoc", label: "AOC" },
    { id: "stcr-f-req", label: "Tipe Request" },
    { id: "stcr-f-station", label: "Stasiun" }
  ];

  function ensureChipContainer() {
    var existing = document.getElementById("stcrFilterChips");
    if (existing) return existing;
    var anchor = document.getElementById("stcrKpiGrid");
    if (!anchor) return null;
    var chipRow = document.createElement("div");
    chipRow.id = "stcrFilterChips";
    chipRow.className = "filter-chip-row";
    anchor.parentNode.insertBefore(chipRow, anchor);
    return chipRow;
  }

  function renderChips() {
    var container = ensureChipContainer();
    if (!container) return;
    var chipsHtml = [];
    FILTERS.forEach(function (f) {
      var el = document.getElementById(f.id);
      if (!el || !el.value) return;
      var displayValue = el.value;
      if (el.tagName === "SELECT" && el.selectedIndex > -1 && el.options[el.selectedIndex]) {
        displayValue = el.options[el.selectedIndex].text;
      }
      chipsHtml.push('<span class="filter-chip">' + f.label + ": " + displayValue + '<button type="button" data-clear-stcr-filter="' + f.id + '">✕</button></span>');
    });
    container.innerHTML = chipsHtml.join("");
    container.querySelectorAll("[data-clear-stcr-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-clear-stcr-filter");
        var el = document.getElementById(id);
        if (!el) return;
        el.value = "";
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  }

  function wireListeners() {
    FILTERS.forEach(function (f) {
      var el = document.getElementById(f.id);
      if (!el || el._stcrChipBound) return;
      el._stcrChipBound = true;
      el.addEventListener("change", renderChips);
    });
  }

  function init() {
    wireListeners();
    renderChips();
  }

  document.addEventListener("sjn:tab-changed", function (e) {
    var tab = e && e.detail && e.detail.tab;
    if (tab && tab.indexOf("stcr") === 0) setTimeout(init, 50);
  });

  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    wireListeners();
    renderChips();
    if (document.getElementById("stcrKpiGrid") && tries > 4) clearInterval(iv);
    if (tries > 60) clearInterval(iv);
  }, 250);

  console.info("%c[SJNAM] UX Enhancement STCR (filter chip) aktif.", "color:#0891b2;font-weight:bold;font-size:11px");
}();
