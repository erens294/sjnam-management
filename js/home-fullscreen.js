/* ================================================================
   SJNAM — HOME BANNER: SATU LAYAR PENUH (Fit-to-Viewport)
   ================================================================
   [TEMUAN] #homeContainer (banner biru di tab Home) sebelumnya pakai
   min-height:520px TETAP — tidak menyesuaikan tinggi layar. Di layar
   yang lebih tinggi dari 520px, ada sisa ruang kosong di bawahnya; di
   layar pendek, mungkin perlu scroll. Di sini dihitung ULANG secara
   dinamis supaya banner mengisi PERSIS sisa tinggi layar yang
   tersedia (dari posisinya sampai ke bawah viewport) — jadi terasa
   seperti "satu halaman penuh", tanpa perlu scroll ekstra.
   ================================================================ */
!function () {
  "use strict";

  if (window._homeFullScreenInit) return;
  window._homeFullScreenInit = true;

  var BOTTOM_MARGIN = 24; // jarak aman ke bawah viewport (px)
  var MIN_HEIGHT = 420; // jangan sampai lebih pendek dari ini di layar sangat kecil

  function fitHomeContainer() {
    var container = document.getElementById("homeContainer");
    if (!container) return;
    var section = document.getElementById("tab-home");
    // Cuma hitung ulang kalau tab Home sedang AKTIF/terlihat — supaya tidak
    // salah ukur saat elemen sedang display:none (offsetTop tidak akurat).
    if (!section || !section.classList.contains("active")) return;

    var rectTop = container.getBoundingClientRect().top;
    var available = window.innerHeight - rectTop - BOTTOM_MARGIN;
    var finalHeight = Math.max(MIN_HEIGHT, Math.round(available));
    container.style.minHeight = finalHeight + "px";
    container.style.height = finalHeight + "px";
  }

  function init() {
    fitHomeContainer();
    return !!document.getElementById("homeContainer");
  }

  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    if (init() || tries > 60) clearInterval(iv);
  }, 250);

  window.addEventListener("resize", fitHomeContainer);
  document.addEventListener("sjn:tab-changed", function (e) {
    if (e && e.detail && e.detail.tab === "home") setTimeout(fitHomeContainer, 80);
  });

  console.info("%c[SJNAM] Home banner satu-layar-penuh aktif.", "color:#0891b2;font-weight:bold;font-size:11px");
}();
