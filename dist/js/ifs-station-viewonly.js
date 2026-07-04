/* ================================================================
   SJNAM — IFS STATION: MODE VIEW-ONLY
   ================================================================
   Permintaan: tab "Drygoods → IFS Station" hanya untuk MENDATA/
   MELIHAT karyawan IFS per station — TIDAK boleh lagi dipakai untuk
   tambah/ubah/hapus karyawan maupun akun login. Semua pengelolaan
   karyawan (tambah, ubah, hapus, ganti password, atur role/akses)
   sekarang terpusat HANYA di tab Admin → Data Karyawan, dan otomatis
   ikut sinkron ke tampilan IFS Station ini (read-only) sesuai akses
   role karyawan tersebut.

   Patch ini tidak mengubah data maupun logika inti drygoods.js —
   hanya menyembunyikan tombol Tambah Karyawan dan menghapus tombol
   Edit/Hapus dari tabel setiap kali tabel di-render ulang.
   ================================================================ */
!function () {
  "use strict";

  function stripIfsWriteControls() {
    var addBtn = document.getElementById("btnDgAddEmployee");
    if (addBtn) addBtn.style.display = "none";

    var body = document.getElementById("dgEmployeeTableBody");
    if (!body) return;

    body.querySelectorAll("[data-dg-edit-emp],[data-dg-del-emp]").forEach(function (btn) {
      btn.remove();
    });

    body.querySelectorAll("td").forEach(function (td) {
      if (!td.querySelector("button") && /^\s*$/.test(td.textContent)) {
        td.innerHTML = '<span class="text-slate-300 dark:text-slate-600">—</span>';
      }
    });

    ensureNotice();
  }

  function ensureNotice() {
    if (document.getElementById("_ifsViewOnlyNotice")) return;
    var table = document.getElementById("dgEmployeeTableBody");
    var wrap = table && table.closest(".card");
    if (!wrap) return;
    var notice = document.createElement("div");
    notice.id = "_ifsViewOnlyNotice";
    notice.className = "mb-3 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300 font-medium";
    notice.textContent = "ℹ️ Tab ini bersifat lihat-saja (read-only). Untuk menambah, mengubah, menghapus karyawan, atau mengatur akun/role, silakan buka tab Admin → Data Karyawan.";
    var header = wrap.querySelector(".flex.flex-wrap.items-center.justify-between") || wrap.firstElementChild;
    if (header && header.parentNode) {
      header.parentNode.insertBefore(notice, header.nextSibling);
    } else {
      wrap.insertBefore(notice, wrap.firstChild);
    }
  }

  var observer = null;
  function initObserver() {
    var body = document.getElementById("dgEmployeeTableBody");
    if (!body) return;
    stripIfsWriteControls();
    if (observer) observer.disconnect();
    observer = new MutationObserver(stripIfsWriteControls);
    observer.observe(body, { childList: true, subtree: true });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initObserver();
    document.addEventListener("click", function (e) {
      if (e.target.closest('[data-tab="drygoods-ifs"]')) {
        setTimeout(initObserver, 50);
      }
    });
  }, { once: true });

  console.info("%c[SJNAM] IFS Station -> mode view-only aktif. Kelola karyawan hanya via tab Admin.", "color:#2563eb;font-weight:bold;font-size:11px");
}();
