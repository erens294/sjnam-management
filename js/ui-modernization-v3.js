/* ================================================================
   SJNAM — UI MODERNIZATION V3: Sidebar Icon, Avatar, Breadcrumb
   ================================================================
   Melengkapi modernisasi tampilan: ikon sidebar SVG (pengganti
   emoji), avatar inisial user di header, dan breadcrumb kecil untuk
   modul yang punya sub-tab (Bank Soal/Data Peserta/Station, Data/
   Dashboard Check-In, dst).

   Semua lewat DOM manipulation (bukan edit index.html langsung) —
   aman, konsisten dengan pola file "-enhance" lain di project ini.
   ================================================================ */
!function () {
  "use strict";

  if (window._uiModernizationV3Init) return;
  window._uiModernizationV3Init = true;

  /* ---------------------------------------------------------------
     1. Ikon Sidebar: emoji -> SVG inline
     --------------------------------------------------------------- */
  var ICONS = {
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    barChart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    trendingUp: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    clipboardCheck: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    fileText: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    mapPin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    bookOpen: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    award: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    package: '<path d="M16.5 9.4L7.5 4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    checkSquare: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'
  };

  var TAB_ICON_MAP = {
    "home": "home", "executive-dashboard": "barChart", "input": "send", "data": "list",
    "dashboard": "trendingUp", "request": "clipboardCheck", "dfs": "folder",
    "stcr-dashboard": "barChart", "stcr-data": "fileText", "stcr-station": "mapPin",
    "materi": "bookOpen", "soal": "edit", "sertifikat": "award", "admin": "users",
    "stations": "mapPin", "settings": "settings", "drygoods-bankitem": "folder",
    "drygoods-data": "package", "drygoods-dashboard": "barChart",
    "station-activity": "list", "station-checkin": "checkSquare",
    "station-bagreport": "briefcase", "station-baggage": "briefcase"
  };

  function svgIcon(name) {
    var path = ICONS[name];
    if (!path) return null;
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">' + path + "</svg>";
  }

  function replaceSidebarIcons() {
    var replaced = 0;
    document.querySelectorAll("[data-tab]").forEach(function (btn) {
      var tab = btn.getAttribute("data-tab");
      var iconName = TAB_ICON_MAP[tab];
      if (!iconName) return;
      var span = btn.querySelector("span.text-lg.w-6.text-center");
      if (!span || span._svgReplaced) return;
      var svg = svgIcon(iconName);
      if (!svg) return;
      span._svgReplaced = true;
      span.innerHTML = svg;
      span.classList.remove("text-lg");
      replaced++;
    });
    return replaced;
  }

  /* ---------------------------------------------------------------
     2. Avatar Inisial User
     --------------------------------------------------------------- */
  function getInitials(name) {
    if (!name) return "?";
    var parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function ensureAvatar() {
    var nameEl = document.getElementById("userNameDisplay");
    if (!nameEl || document.getElementById("userAvatarBadge")) return false;
    var avatar = document.createElement("span");
    avatar.id = "userAvatarBadge";
    avatar.style.cssText = "display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--fill-accent,#3b82f6);color:#fff;font-size:11px;font-weight:700;margin-right:6px;flex-shrink:0;";
    nameEl.parentNode.insertBefore(avatar, nameEl);
    return true;
  }

  function refreshAvatar() {
    var avatar = document.getElementById("userAvatarBadge");
    var nameEl = document.getElementById("userNameDisplay");
    if (!avatar || !nameEl) return;
    var name = nameEl.textContent.trim() || (window.currentUser && window.currentUser.name) || "";
    avatar.textContent = getInitials(name);
  }

  /* ---------------------------------------------------------------
     3. Breadcrumb untuk modul dengan sub-tab
     --------------------------------------------------------------- */
  function ensureBreadcrumbs() {
    // Cari SEMUA bar sub-tab yang mengikuti pola "*-subtab-btn" (soal-subtab-btn,
    // ci-subtab-btn, dst) — generik, tidak perlu daftar manual per modul.
    var subtabButtons = document.querySelectorAll('[class*="-subtab-btn"]');
    var containers = new Set();
    subtabButtons.forEach(function (btn) {
      var bar = btn.parentElement;
      if (bar) containers.add(bar);
    });
    containers.forEach(function (bar) {
      if (bar._breadcrumbDone) return;
      bar._breadcrumbDone = true;
      updateBreadcrumbFor(bar);
      bar.addEventListener("click", function () { setTimeout(function () { updateBreadcrumbFor(bar); }, 50); });
    });
  }

  function updateBreadcrumbFor(bar) {
    var activeBtn = bar.querySelector('[class*="-subtab-btn"].active');
    if (!activeBtn) return;
    var parentSection = bar.closest("section.tab-pane");
    var sectionTitle = parentSection ? parentSection.querySelector("h1, h2, h3") : null;
    var rootLabel = sectionTitle ? sectionTitle.textContent.trim() : "";
    var subLabel = activeBtn.textContent.trim();

    var crumb = bar.parentNode.querySelector(":scope > .sjnam-breadcrumb");
    if (!crumb) {
      crumb = document.createElement("div");
      crumb.className = "sjnam-breadcrumb";
      crumb.style.cssText = "font-size:11px;color:var(--text-muted,#94a3b8);margin-bottom:6px;display:flex;align-items:center;gap:4px;";
      bar.parentNode.insertBefore(crumb, bar);
    }
    crumb.innerHTML = (rootLabel ? esc(rootLabel) + ' <span style="opacity:.5">/</span> ' : "") + '<span style="font-weight:600;color:var(--text-secondary,#475569)">' + esc(subLabel) + "</span>";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------------------------------------------------------------
     Init
     --------------------------------------------------------------- */
  function init() {
    var iconOk = replaceSidebarIcons() > 0;
    var avatarOk = ensureAvatar();
    refreshAvatar();
    ensureBreadcrumbs();
    return iconOk && avatarOk;
  }

  document.addEventListener("sjn:tab-changed", function () {
    setTimeout(function () { ensureBreadcrumbs(); replaceSidebarIcons(); }, 100);
  });

  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    if (init() || tries > 60) clearInterval(iv);
  }, 250);

  // Nama user bisa berubah setelah login/ganti sesi — pantau berkala,
  // ringan (cuma baca textContent), lebih murah daripada MutationObserver
  // permanen di seluruh header untuk hal sekecil ini.
  setInterval(refreshAvatar, 3000);

  console.info("%c[SJNAM] UI Modernization v3 (ikon sidebar SVG, avatar, breadcrumb) aktif.", "color:#7c3aed;font-weight:bold;font-size:11px");
}();
