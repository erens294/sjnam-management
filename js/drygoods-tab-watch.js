/* ================================================================
   SJNAM — DRYGOODS TAB WATCHER
   ================================================================
   Kenapa file ini ada: window.switchTab dibungkus berlapis-lapis
   oleh banyak file (service-recovery.js, auth.js, drygoods.js, dst).
   Kalau salah satu titik pembungkus gagal meneruskan pemanggilan ke
   fungsi sebelumnya, refresh station-lock milik Drygoods (khusus
   role User-DRG) bisa berhenti terpanggil sama sekali — meskipun
   data karyawan di Admin sudah benar diperbarui.

   Untuk memastikan tab Data Stok / IFS Station / Dashboard Drygoods
   SELALU menampilkan station terbaru begitu tab itu terlihat, file
   ini mengamati langsung perubahan class "active" pada tab-pane
   terkait (tidak tergantung window.switchTab sama sekali) dan
   memanggil DRYGOODS.renderAll() setiap kali tab itu jadi aktif.
   ================================================================ */
!function () {
  "use strict";

  var WATCH_IDS = ["tab-drygoods-data", "tab-drygoods-ifs", "tab-drygoods-dashboard", "tab-drygoods-bankitem"];

  function refreshDrygoods() {
    if (window.DRYGOODS && typeof window.DRYGOODS.renderAll === "function") {
      try { window.DRYGOODS.renderAll(); } catch (e) { console.warn("[DrygoodsTabWatch]", e); }
    }
  }

  function watchSections() {
    var found = false;
    WATCH_IDS.forEach(function (id) {
      var sec = document.getElementById(id);
      if (!sec) return;
      found = true;
      if (sec._dgWatched) return;
      sec._dgWatched = true;
      if (sec.classList.contains("active")) setTimeout(refreshDrygoods, 0);
      new MutationObserver(function () {
        if (sec.classList.contains("active")) refreshDrygoods();
      }).observe(sec, { attributes: true, attributeFilter: ["class"] });
    });
    return found;
  }

  function bindSidebarShortcuts() {
    document.querySelectorAll('[data-tab="drygoods-data"],[data-tab="drygoods-ifs"],[data-tab="drygoods-dashboard"],[data-tab="drygoods-bankitem"]').forEach(function (btn) {
      if (btn._dgBoundClick) return;
      btn._dgBoundClick = true;
      btn.addEventListener("click", function () { setTimeout(refreshDrygoods, 30); });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      var ok = watchSections();
      bindSidebarShortcuts();
      if (ok || tries > 60) clearInterval(iv);
    }, 250);
  }, { once: true });

  console.info("%c[SJNAM] Drygoods tab watcher aktif — station-lock selalu disegarkan saat tab dibuka.", "color:#ea580c;font-weight:bold;font-size:11px");
}();
