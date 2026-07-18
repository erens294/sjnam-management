/* ================================================================
   SJNAM — UI MODERNIZATION V2: Density Toggle & Sidebar Badge
   ================================================================
   Melengkapi css/ui-modernization.css (yang sudah punya CSS untuk
   ".density-compact" dan ".sidebar-notif-badge") dengan bagian JS
   yang sebelumnya belum ada: tombol untuk mengaktifkan/menonaktifkan
   mode compact, dan badge notifikasi jumlah item pending di sidebar.

   File terpisah, tidak mengubah file lain — mengikuti pola yang
   sudah mapan di codebase ini.
   ================================================================ */
!function () {
  "use strict";

  if (window._uiModernizationV2Init) return;
  window._uiModernizationV2Init = true;

  var LS_DENSITY_KEY = "sjnam_density_compact_v1";

  /* ---------------------------------------------------------------
     1. Density Toggle (Compact/Comfortable)
     --------------------------------------------------------------- */
  function applyDensityFromStorage() {
    var isCompact = localStorage.getItem(LS_DENSITY_KEY) === "1";
    document.body.classList.toggle("density-compact", isCompact);
    var btn = document.getElementById("btnDensityToggle");
    if (btn) {
      btn.classList.toggle("is-compact", isCompact);
      btn.innerHTML = isCompact ? "▤ Compact" : "▦ Comfortable";
    }
  }

  function ensureDensityToggle() {
    // Ditempatkan di header (dekat jam WIB/UTC), supaya bisa diakses dari tab manapun.
    var header = document.querySelector("header .flex.items-center.gap-2, header .flex.items-center");
    if (!header || document.getElementById("btnDensityToggle")) return false;
    var btn = document.createElement("button");
    btn.id = "btnDensityToggle";
    btn.type = "button";
    btn.title = "Ganti kepadatan tampilan tabel";
    header.insertBefore(btn, header.firstChild);
    btn.addEventListener("click", function () {
      var isCompact = document.body.classList.toggle("density-compact");
      try { localStorage.setItem(LS_DENSITY_KEY, isCompact ? "1" : "0"); } catch (e) { /* abaikan */ }
      btn.classList.toggle("is-compact", isCompact);
      btn.innerHTML = isCompact ? "▤ Compact" : "▦ Comfortable";
    });
    applyDensityFromStorage();
    return true;
  }

  /* ---------------------------------------------------------------
     2. Badge Notifikasi Sidebar — jumlah item pending
     --------------------------------------------------------------- */
  // Konfigurasi: { data-tab target, localStorage key, cara hitung }
  var NOTIF_SOURCES = [
    {
      tab: "request",
      count: function () {
        try {
          var list = JSON.parse(localStorage.getItem("sjn_delay_pro_v4") || "[]");
          return list.filter(function (d) { return d.approval && d.approval !== "Approved"; }).length;
        } catch (e) { return 0; }
      }
    }
  ];

  function refreshSidebarBadges() {
    NOTIF_SOURCES.forEach(function (src) {
      var btn = document.querySelector('[data-tab="' + src.tab + '"]');
      if (!btn) return;
      var count = 0;
      try { count = src.count(); } catch (e) { count = 0; }

      var badge = btn.querySelector(".sidebar-notif-badge");
      if (count > 0) {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "sidebar-notif-badge sidebar-text";
          btn.appendChild(badge);
        }
        badge.textContent = count > 99 ? "99+" : String(count);
      } else if (badge) {
        badge.remove();
      }
    });
  }

  function init() {
    var toggleOk = ensureDensityToggle();
    refreshSidebarBadges();
    return toggleOk;
  }

  document.addEventListener("sjn:tab-changed", function () {
    setTimeout(refreshSidebarBadges, 100);
  });

  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    if (init() || tries > 60) clearInterval(iv);
  }, 250);

  // Badge notifikasi disegarkan berkala (data delay bisa berubah dari mana saja:
  // import, sync cloud, dll — bukan cuma dari aksi yang kita ketahui langsung).
  setInterval(refreshSidebarBadges, 15000);

  console.info("%c[SJNAM] UI Modernization v2 (density toggle + sidebar badge) aktif.", "color:#7c3aed;font-weight:bold;font-size:11px");
}();
