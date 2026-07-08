/* ================================================================
   SJNAM — TOMBSTONE UNTUK HAPUS TRANSAKSI DRYGOODS
   ================================================================
   [BUG DITEMUKAN & DIPERBAIKI] Menghapus transaksi Drygoods (satuan,
   terpilih, maupun "hapus semua terfilter") di drygoods.js selama ini
   HANYA melakukan `dgData.transactions.filter(t=>t.id!==delId)` lalu
   menyimpan — TIDAK PERNAH menandai id yang dihapus sebagai
   "tombstone" (beda dengan penghapusan user/karyawan yang sudah benar
   memakai window.markDeletedTombstone()).

   Akibatnya: kalau proses PUSH penghapusan itu belum sempat selesai
   (debounce 800ms) saat proses PULL lain kebetulan berjalan (baik
   otomatis maupun manual/dipaksa lewat Console), data yang BARU SAJA
   dihapus bisa "hidup lagi" — cloud masih punya salinan lamanya, dan
   proses merge (yang cuma tahu "id ini ada di cloud tapi tidak ada
   di lokal" = berarti data baru yang belum diketahui) salah
   menganggapnya sebagai data baru untuk ditambahkan kembali, padahal
   sebenarnya SENGAJA dihapus.

   Kenapa dibuat file terpisah: drygoods.js terminifikasi jadi satu
   baris, dan dgData/dgSelectedIds/dgSelectAllMode adalah closure
   privat yang tidak di-expose ke window — hanya window.DRYGOODS.getData()
   yang memberi kita akses BACA ke array transactions (referensi
   langsung, bukan salinan). Karena itu, alih-alih menebak variabel
   privat mana yang dipakai tiap tombol hapus, kita BANDINGKAN
   snapshot lengkap id transaksi SEBELUM & SESUDAH tombol hapus
   diklik (menunggu sampai jumlahnya benar-benar berubah, karena ada
   dialog konfirmasi async di tengah) — cara ini otomatis benar untuk
   ketiga jalur hapus (satuan/terpilih/massal) tanpa perlu tahu detail
   internal masing-masing.
   ================================================================ */
!function () {
  "use strict";

  if (window._dgTombstoneInit) return;
  window._dgTombstoneInit = true;

  var DELETE_SELECTORS = ["[data-dg-del-trx]", "#btnDgDeleteSelected", "#btnDgDeleteAllFiltered"];

  function getCurrentIds() {
    var dg = window.DRYGOODS && window.DRYGOODS.getData ? window.DRYGOODS.getData() : null;
    if (!dg || !Array.isArray(dg.transactions)) return null;
    return new Set(dg.transactions.map(function (t) { return t.id; }));
  }

  document.addEventListener("click", function (e) {
    var matched = DELETE_SELECTORS.some(function (sel) { return e.target.closest && e.target.closest(sel); });
    if (!matched) return;

    var idsBefore = getCurrentIds();
    if (!idsBefore) return;
    var sizeBefore = idsBefore.size;

    // showConfirm() di drygoods.js bersifat async (menunggu user klik
    // OK/Batal di dialog) — kita tidak tahu kapan itu selesai dari luar,
    // jadi dipantau berkala sampai jumlah transaksi benar-benar berkurang
    // (berarti penghapusan sungguhan terjadi), atau menyerah setelah ~15
    // detik (mis. user membatalkan dialog konfirmasi — aman, tidak ada
    // yang perlu ditandai tombstone).
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      var idsAfter = getCurrentIds();
      if (idsAfter && idsAfter.size < sizeBefore) {
        clearInterval(iv);
        var deletedIds = [];
        idsBefore.forEach(function (id) { if (!idsAfter.has(id)) deletedIds.push(id); });
        if (deletedIds.length && "function" === typeof window.markDeletedTombstone) {
          window.markDeletedTombstone("drygoods_trx", deletedIds);
          console.info("[SJNAM] " + deletedIds.length + " transaksi Drygoods ditandai tombstone (tidak akan hidup lagi lewat sync).");
        }
      } else if (tries > 150) { // ~15 detik (150 x 100ms) — kemungkinan dialog dibatalkan
        clearInterval(iv);
      }
    }, 100);
  }, true);

  console.info("%c[SJNAM] Tombstone hapus transaksi Drygoods aktif.", "color:#ea580c;font-weight:bold;font-size:11px");
}();
