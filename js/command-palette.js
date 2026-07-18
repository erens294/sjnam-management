/* ================================================================
   SJNAM — COMMAND PALETTE (Ctrl+K / Cmd+K)
   ================================================================
   File terpisah, tidak menyentuh logic modul manapun.

   Cara kerja: SEMUA tombol navigasi diambil otomatis dari DOM
   (`[data-tab]` di sidebar) saat palette dibuka — bukan daftar
   hardcoded. Jadi kalau suatu saat ada tab baru ditambahkan ke
   sidebar, palette ini otomatis ikut menampilkannya tanpa perlu
   edit file ini sama sekali.

   Shortcut: Ctrl+K (Windows/Linux) atau Cmd+K (Mac). Esc untuk
   menutup. ↑/↓ untuk navigasi, Enter untuk pilih.
   ================================================================ */
!function () {
  "use strict";

  if (window._commandPaletteInit) return;
  window._commandPaletteInit = true;

  var overlay = null;
  var listEl = null;
  var inputEl = null;
  var items = [];
  var activeIndex = 0;

  function collectItems() {
    var result = [];
    var seen = {};
    Array.from(document.querySelectorAll("[data-tab]")).forEach(function (btn) {
      var tab = btn.getAttribute("data-tab");
      if (!tab || seen[tab]) return;
      seen[tab] = true;
      var iconEl = btn.querySelector("span.text-lg, span:first-child");
      var icon = iconEl ? iconEl.textContent.trim() : "▸";
      var labelEl = btn.querySelector(".sidebar-text") || btn;
      var label = (labelEl.textContent || btn.getAttribute("title") || tab).trim();
      // Cari nama grup dari heading terdekat di atasnya (Service Recovery, STCR, dst)
      var groupWrap = btn.closest('[id$="MenuContent"]');
      var group = "";
      if (groupWrap && groupWrap.previousElementSibling) {
        var p = groupWrap.previousElementSibling.querySelector("p");
        if (p) group = p.textContent.trim();
      }
      result.push({ tab: tab, icon: icon, label: label, group: group });
    });
    return result;
  }

  function ensureDom() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "cmdk-overlay";
    overlay.style.display = "none";
    overlay.innerHTML =
      '<div class="cmdk-box" role="dialog" aria-modal="true" aria-label="Pencarian cepat">' +
      '<div class="cmdk-input-row">' +
      '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>' +
      '<input id="cmdkInput" type="text" placeholder="Ketik nama menu... (mis. dashboard, karyawan, stcr)" autocomplete="off">' +
      '<span class="cmdk-esc-hint">Esc</span>' +
      "</div>" +
      '<div class="cmdk-list" id="cmdkList"></div>' +
      "</div>";
    document.body.appendChild(overlay);
    inputEl = overlay.querySelector("#cmdkInput");
    listEl = overlay.querySelector("#cmdkList");

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    inputEl.addEventListener("input", function () {
      render(inputEl.value);
    });
    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        move(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        selectActive();
      } else if (e.key === "Escape") {
        close();
      }
    });
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ── Pencarian DATA (bukan cuma navigasi tab) — STCR, Karyawan,
  //    Bank Data Peserta Training. Cuma jalan kalau query >= 3 karakter,
  //    supaya tidak berat scan localStorage di tiap ketikan huruf pertama. ──
  var DATA_SOURCES = [
    {
      key: "stcrData", tab: "stcr-data", searchInputId: "stcr-s-search", icon: "🩺", group: "STCR",
      load: function () { try { return JSON.parse(localStorage.getItem("sjnam_stcr_data_v1") || "[]"); } catch (e) { return []; } },
      match: function (r, q) { return (r["Nama Pasien"] || "").toLowerCase().indexOf(q) !== -1 || (r["Flight No"] || "").toLowerCase().indexOf(q) !== -1; },
      label: function (r) { return (r["Nama Pasien"] || "(tanpa nama)") + " — " + (r["Flight No"] || ""); },
      term: function (r) { return r["Nama Pasien"] || r["Flight No"] || ""; }
    },
    {
      key: "karyawan", tab: "admin", searchInputId: "karyawanSearch", icon: "👤", group: "Karyawan",
      load: function () { try { return JSON.parse(localStorage.getItem("sjnam_karyawan_v1") || "[]"); } catch (e) { return []; } },
      match: function (r, q) { return (r.nama || "").toLowerCase().indexOf(q) !== -1 || (r.nip || "").toLowerCase().indexOf(q) !== -1; },
      label: function (r) { return (r.nama || "(tanpa nama)") + " — NIP " + (r.nip || "-"); },
      term: function (r) { return r.nama || r.nip || ""; }
    },
    {
      key: "peserta", tab: "soal", searchInputId: "pesertaSearch", icon: "🎓", group: "Peserta Training",
      load: function () {
        try { return (JSON.parse(localStorage.getItem("sjn_training_v1") || "{}").peserta) || []; } catch (e) { return []; }
      },
      match: function (r, q) { return (r.nama || "").toLowerCase().indexOf(q) !== -1 || (r.certNo || "").toLowerCase().indexOf(q) !== -1; },
      label: function (r) { return (r.nama || "(tanpa nama)") + " — " + (r.certNo || ""); },
      term: function (r) { return r.nama || r.certNo || ""; }
    }
  ];

  function searchDataSources(query) {
    var q = (query || "").toLowerCase().trim();
    if (q.length < 3) return [];
    var results = [];
    DATA_SOURCES.forEach(function (src) {
      var list = src.load();
      if (!Array.isArray(list)) return;
      var count = 0;
      for (var i = 0; i < list.length && count < 5; i++) {
        if (src.match(list[i], q)) {
          results.push({
            tab: src.tab, icon: src.icon, group: src.group,
            label: src.label(list[i]), isData: true,
            searchInputId: src.searchInputId, searchTerm: src.term(list[i])
          });
          count++;
        }
      }
    });
    return results;
  }

  function render(query) {
    var q = (query || "").toLowerCase().trim();
    var filtered = !q
      ? items
      : items.filter(function (it) {
          return (it.label + " " + it.group).toLowerCase().indexOf(q) !== -1;
        });
    var dataResults = searchDataSources(query);
    filtered = filtered.concat(dataResults);

    if (!filtered.length) {
      listEl.innerHTML = '<div class="cmdk-empty">Tidak ada menu atau data yang cocok dengan "' + escapeHtml(query) + '"</div>';
      return;
    }

    activeIndex = Math.min(activeIndex, filtered.length - 1);
    listEl.innerHTML = filtered
      .map(function (it, i) {
        return (
          '<div class="cmdk-item' + (i === activeIndex ? " cmdk-active" : "") + '" data-idx="' + i + '">' +
          '<span class="cmdk-icon">' + it.icon + "</span>" +
          "<span>" + escapeHtml(it.label) + "</span>" +
          (it.group ? '<span class="cmdk-group">' + escapeHtml(it.group) + "</span>" : "") +
          "</div>"
        );
      })
      .join("");

    listEl._filtered = filtered;
    Array.from(listEl.querySelectorAll(".cmdk-item")).forEach(function (el) {
      el.addEventListener("click", function () {
        activeIndex = parseInt(el.getAttribute("data-idx"), 10);
        selectActive();
      });
    });
  }

  function move(delta) {
    var filtered = listEl._filtered || [];
    if (!filtered.length) return;
    activeIndex = (activeIndex + delta + filtered.length) % filtered.length;
    render(inputEl.value);
    var activeEl = listEl.querySelector(".cmdk-active");
    if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
  }

  function selectActive() {
    var filtered = listEl._filtered || [];
    var chosen = filtered[activeIndex];
    if (!chosen) return;
    close();
    var btn = document.querySelector('[data-tab="' + chosen.tab + '"]');
    if (btn) btn.click();

    if (chosen.isData && chosen.searchInputId && chosen.searchTerm) {
      // Beri jeda supaya tab benar-benar selesai berpindah (render konten
      // tab tujuan) sebelum kita coba isi kotak pencariannya.
      setTimeout(function () {
        var input = document.getElementById(chosen.searchInputId);
        if (input) {
          input.value = chosen.searchTerm;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.focus();
        }
      }, 150);
    }
  }

  function open() {
    ensureDom();
    items = collectItems();
    activeIndex = 0;
    overlay.style.display = "flex";
    inputEl.value = "";
    render("");
    setTimeout(function () {
      inputEl.focus();
    }, 10);
  }

  function close() {
    if (overlay) overlay.style.display = "none";
  }

  document.addEventListener("keydown", function (e) {
    var isCmdK = (e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K");
    if (isCmdK) {
      e.preventDefault();
      if (overlay && overlay.style.display === "flex") {
        close();
      } else {
        open();
      }
    }
  });

  console.info(
    "%c[SJNAM] Command Palette aktif — tekan Ctrl+K (atau Cmd+K) untuk buka.",
    "color:#7c3aed;font-weight:bold;font-size:11px"
  );
}();
