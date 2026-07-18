/* ================================================================
   SJNAM — LOADING SPINNER GENERIK (SEMUA MODUL)
   ================================================================
   Menambahkan efek loading (spinner + tombol nonaktif sementara)
   otomatis untuk tombol Simpan/Import/Export/Hapus di SELURUH
   aplikasi — tanpa perlu memasang manual satu-satu ke tiap file
   modul (yang berisiko tinggi kalau harus sentuh puluhan file).

   Cara kerja:
   1. Delegasi klik di level document — begitu ada tombol yang
      diklik dan ID-nya cocok pola (mengandung "Save"/"Simpan",
      "Import", "Export", "Pdf", "Delete"/"Hapus", dst), spinner
      langsung ditambahkan (lihat class .btn-loading di
      visual-polish.css) dan tombol dinonaktifkan sementara —
      supaya user dapat KONFIRMASI VISUAL bahwa klik-nya terdaftar,
      dan tidak bisa klik dobel saat proses masih berjalan.
   2. Spinner otomatis HILANG begitu ada toast notifikasi muncul
      (menandakan proses selesai — semua modul di aplikasi ini
      sudah konsisten memanggil showToast() saat selesai simpan/
      import/export/hapus).
   3. Jaring pengaman: kalau karena suatu hal tidak ada toast yang
      muncul (mis. dialog konfirmasi dibatalkan), spinner otomatis
      dilepas setelah maksimal 8 detik — supaya tombol tidak
      "macet" selamanya kalau prosesnya ternyata batal di tengah.
   ================================================================ */
!function () {
  "use strict";

  if (window._loadingSpinnerInit) return;
  window._loadingSpinnerInit = true;

  // Pola ID tombol yang dianggap "aksi butuh loading feedback" —
  // dicocokkan tanpa peduli besar-kecil huruf.
  var ID_PATTERNS = /save|simpan|import|export|pdf|delete|hapus|template/i;
  // Kecualikan tombol yang JUSTRU tidak cocok dikasih spinner (mis.
  // tombol batal/reset/tutup, meski kebetulan idnya mengandung kata
  // yang mirip pola di atas).
  var EXCLUDE_PATTERNS = /reset|cancel|batal|clear|close|tutup/i;

  var activeLoadingButtons = [];

  function clearAllLoading() {
    activeLoadingButtons.forEach(function (item) {
      if (item.btn && item.btn.isConnected) {
        item.btn.classList.remove("btn-loading");
        item.btn.disabled = false;
      }
      if (item.timeoutId) clearTimeout(item.timeoutId);
    });
    activeLoadingButtons = [];
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("button, label.cursor-pointer");
    if (!btn || !btn.id) return;
    if (EXCLUDE_PATTERNS.test(btn.id)) return;
    if (!ID_PATTERNS.test(btn.id)) return;
    if (btn.tagName === "LABEL") {
      // label pembungkus <input type=file> (pola "Import Excel") —
      // kasih spinner ke label-nya sendiri, bukan input file di dalamnya
      btn.classList.add("btn-loading");
    } else {
      btn.classList.add("btn-loading");
      // [BUG DITEMUKAN & DIPERBAIKI] Sebelumnya "btn.disabled=true" langsung
      // dieksekusi di sini (capture phase, jalan PALING AWAL). Beberapa modul
      // lain (mis. karyawan-management.js) punya pengaman double-klik SENDIRI
      // yang mengecek "if (saveBtn?.disabled) return" di awal handler-nya —
      // karena interceptor generik ini menonaktifkan tombol LEBIH DULU
      // (sebelum handler asli modul tsb sempat jalan), pengaman modul itu
      // salah menyangka "sedang ada proses berjalan" padahal itu klik
      // PERTAMA — sehingga logic simpan yang sesungguhnya TIDAK PERNAH
      // jalan sama sekali (tombol terlihat seperti tidak merespons apa pun).
      // Sekarang, "disabled" beneran BARU diterapkan satu tick kemudian
      // (setelah SEMUA listener untuk klik yang sama ini selesai diproses),
      // sehingga modul lain tetap melihat status "belum disabled" yang benar
      // saat memeriksa kondisi awal mereka sendiri. Class "btn-loading" untuk
      // efek visual (spinner) tetap langsung aktif seperti sebelumnya.
      setTimeout(function () { btn.disabled = true; }, 0);
    }
    var timeoutId = setTimeout(function () {
      btn.classList.remove("btn-loading");
      btn.disabled = false;
    }, 8000); // jaring pengaman 8 detik
    activeLoadingButtons.push({ btn: btn, timeoutId: timeoutId });
  }, true);

  // Begitu toast MUNCUL (pertanda proses selesai, apa pun hasilnya —
  // sukses maupun gagal), semua spinner yang sedang aktif dilepas.
  if ("function" === typeof window.showToast) {
    var _origShowToast = window.showToast;
    window.showToast = function () {
      var result = _origShowToast.apply(this, arguments);
      setTimeout(clearAllLoading, 50); // sedikit jeda supaya animasi klik sempat terlihat dulu
      return result;
    };
  } else {
    // showToast belum ada saat script ini dimuat -> pasang ulang
    // begitu ketahuan sudah tersedia (jaga-jaga urutan pemuatan script).
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if ("function" === typeof window.showToast && !window.showToast._loadingWrapped) {
        var orig = window.showToast;
        window.showToast = function () {
          var result = orig.apply(this, arguments);
          setTimeout(clearAllLoading, 50);
          return result;
        };
        window.showToast._loadingWrapped = true;
        clearInterval(iv);
      }
      if (tries > 60) clearInterval(iv);
    }, 250);
  }

  console.info("%c[SJNAM] Loading spinner generik (tombol Simpan/Import/Export/Hapus) aktif.", "color:#0891b2;font-weight:bold;font-size:11px");
}();
