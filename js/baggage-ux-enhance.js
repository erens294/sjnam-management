/* ================================================================
   SJNAM — UX ENHANCEMENT: BAGGAGE REPORT (contoh penerapan)
   ================================================================
   Menerapkan 2 pola perbaikan UX sebagai CONTOH NYATA di modul
   Baggage Report (modul yang paling lengkap fiturnya) — siap
   dijadikan pola untuk modul lain kalau hasilnya disetujui:

   1. FORM ACCORDION — bagian "Detail Baggage" & "Klaim & Status"
      pada form Entry dilipat jadi collapsible section, supaya form
      30 field tidak terasa menakutkan saat pertama dibuka.
   2. FILTER CHIP — filter yang sedang aktif ditampilkan sebagai
      "chip" kecil yang bisa diklik ✕ untuk menghapus SATU filter
      saja (tanpa perlu reset semua).

   Cara kerja: memindahkan elemen HTML yang SUDAH ADA ke struktur
   baru lewat DOM (bukan menulis ulang HTML dari nol) — semua id,
   value, dan event listener yang sudah terpasang di elemen aslinya
   tetap utuh, jadi tidak mengganggu logic baggage-report.js sama
   sekali.
   ================================================================ */
!function () {
  "use strict";

  if (window._bgUxEnhanceInit) return;
  window._bgUxEnhanceInit = true;

  // ── 1. FORM ACCORDION ──
  function makeAccordion(headerMatchText, sectionKey, startOpen) {
    var headers = Array.from(document.querySelectorAll("#bgEntryView h3"));
    var h3 = headers.find(function (h) { return h.textContent.indexOf(headerMatchText) !== -1; });
    if (!h3 || h3._bgAccordionized) return false;
    var grid = h3.nextElementSibling;
    if (!grid) return false;
    h3._bgAccordionized = true;

    var section = document.createElement("div");
    section.className = "form-accordion-section" + (startOpen ? " open" : "");
    section.id = "bgAccordion_" + sectionKey;

    var header = document.createElement("div");
    header.className = "form-accordion-header";
    header.innerHTML = "<span>" + h3.innerHTML + "</span><span class=\"chevron\">▾</span>";

    var body = document.createElement("div");
    body.className = "form-accordion-body";

    grid.parentNode.insertBefore(section, h3);
    body.appendChild(grid);
    section.appendChild(header);
    section.appendChild(body);
    h3.remove();

    header.addEventListener("click", function () {
      section.classList.toggle("open");
    });
    return true;
  }

  // ── 2. FILTER CHIP ──
  function ensureChipContainer(afterElId, containerId) {
    var existing = document.getElementById(containerId);
    if (existing) return existing;
    var afterEl = document.getElementById(afterElId);
    if (!afterEl) return null;
    var chipRow = document.createElement("div");
    chipRow.id = containerId;
    chipRow.className = "filter-chip-row";
    // taruh setelah baris tombol Reset Filter/Hapus (parent afterEl)
    var insertAfter = afterEl.closest(".flex.flex-wrap.items-center.gap-2.mb-3") || afterEl.parentElement;
    insertAfter.parentNode.insertBefore(chipRow, insertAfter.nextSibling);
    return chipRow;
  }

  function renderChips(containerId, filterConfigs) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var chipsHtml = [];
    filterConfigs.forEach(function (f) {
      var el = document.getElementById(f.id);
      if (!el || !el.value) return;
      var displayValue = el.value;
      if (el.tagName === "SELECT" && el.selectedIndex > -1 && el.options[el.selectedIndex]) {
        displayValue = el.options[el.selectedIndex].text;
      }
      chipsHtml.push('<span class="filter-chip">' + f.label + ": " + displayValue + '<button type="button" data-clear-filter="' + f.id + '">✕</button></span>');
    });
    container.innerHTML = chipsHtml.join("");
    container.querySelectorAll("[data-clear-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-clear-filter");
        var el = document.getElementById(id);
        if (!el) return;
        el.value = "";
        el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
      });
    });
  }

  var ENTRY_FILTERS = [
    { id: "bg-f-station", label: "Station" },
    { id: "bg-f-aoc", label: "Airlines" },
    { id: "bg-f-case-type", label: "Jenis Kasus" },
    { id: "bg-f-case-status", label: "Status" },
    { id: "bg-f-year", label: "Tahun" },
    { id: "bg-f-month", label: "Bulan" }
  ];

  function refreshEntryChips() {
    var container = ensureChipContainer("btnBgResetFilter", "bgFilterChips");
    if (container) renderChips("bgFilterChips", ENTRY_FILTERS);
  }

  function wireChipListeners() {
    ENTRY_FILTERS.forEach(function (f) {
      var el = document.getElementById(f.id);
      if (!el || el._bgChipBound) return;
      el._bgChipBound = true;
      el.addEventListener(el.tagName === "SELECT" ? "change" : "input", refreshEntryChips);
    });
  }

  function init() {
    makeAccordion("Detail Baggage", "detail", false);
    makeAccordion("Klaim", "klaim", false);
    wireChipListeners();
    refreshEntryChips();
  }

  document.addEventListener("sjn:tab-changed", function (e) {
    var tab = e && e.detail && e.detail.tab;
    if (tab === "station-baggage") setTimeout(init, 50); // beri jeda sedikit supaya elemen form sudah ada
  });

  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    if (document.getElementById("bgEntryView")) { init(); clearInterval(iv); }
    if (tries > 60) clearInterval(iv);
  }, 250);

  console.info("%c[SJNAM] UX Enhancement Baggage Report (accordion + filter chip) aktif.", "color:#0891b2;font-weight:bold;font-size:11px");
}();
