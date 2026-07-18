/* ================================================================
   SJNAM — APP READY BRIDGE
   ================================================================
   Tujuan: menyediakan SATU event global ("sjn:app-ready") yang
   ditembak persis sekali setelah proses login/restore-sesi selesai
   (baik login baru maupun reload halaman dengan sesi tersimpan).

   PENTING — kenapa dibuat sebagai file terpisah, bukan edit auth.js:
   auth.js adalah kode otentikasi yang sensitif. Daripada mengedit
   file itu langsung (berisiko salah titik-sisip di kode login yang
   sudah berjalan), file ini hanya "membungkus" (wrap) fungsi
   window.restoreSession dari LUAR — auth.js tidak disentuh sama
   sekali, jadi risiko ke alur login = nol.

   Titik hook: restoreSession() dipanggil TEPAT SEKALI oleh auth.js
   di 2 tempat (handleLoginSubmit & checkAuth), selalu tepat setelah
   document.body.classList.add("js-ready"). Ini titik paling aman
   dan konsisten yang ditemukan untuk menandai "aplikasi benar-benar
   siap dipakai user".

   CARA PAKAI DI MODUL LAIN (mis. customer-voice.js):
     document.addEventListener("sjn:app-ready", function () {
       // render/inisialisasi modul di sini
     });
   Event ini SEBAIKNYA dipakai sebagai jalur cepat TAMBAHAN, bukan
   pengganti mutlak polling yang sudah ada — supaya kalau karena
   sebab apa pun bridge ini gagal nemu window.restoreSession, modul
   lain tetap jalan normal lewat mekanisme polling lama (fallback).
   ================================================================ */
!function () {
  "use strict";

  if (window._sjnAppReadyBridgeInit) {
    console.warn("[AppReadyBridge] Sudah pernah dimuat, eksekusi ulang dibatalkan.");
    return;
  }
  window._sjnAppReadyBridgeInit = true;

  var MAX_TRIES = 80; // 80 x 250ms = 20 detik — cukup lama utk auth.js selesai load, tidak selamanya
  var tries = 0;

  console.log("[AppReadyBridge] Mulai mencari window.restoreSession untuk di-wrap...");

  var iv = setInterval(function () {
    tries++;

    if ("function" === typeof window.restoreSession && !window.restoreSession._sjnWrapped) {
      var original = window.restoreSession;

      window.restoreSession = function () {
        var result;
        try {
          result = original.apply(this, arguments);
        } finally {
          // Tembak event SETELAH restoreSession asli selesai (termasuk
          // kalau restoreSession asli melempar error — pakai finally
          // supaya modul lain tetap dapat sinyal "app ready", bukan
          // ikut macet gara-gara error di tempat lain).
          console.log("[AppReadyBridge] restoreSession() selesai dipanggil — menembak event 'sjn:app-ready'.");
          try {
            document.dispatchEvent(new CustomEvent("sjn:app-ready", { detail: { at: Date.now() } }));
          } catch (eDispatch) {
            console.error("[AppReadyBridge] Gagal dispatch event 'sjn:app-ready':", eDispatch);
          }
        }
        return result;
      };
      window.restoreSession._sjnWrapped = true;

      clearInterval(iv);
      console.log("[AppReadyBridge] window.restoreSession berhasil di-wrap setelah " + tries + " percobaan (" + (tries * 250) + "ms). Event 'sjn:app-ready' siap ditembak saat login/restore sesi berikutnya.");
      return;
    }

    if (tries >= MAX_TRIES) {
      clearInterval(iv);
      console.warn("[AppReadyBridge] GAGAL menemukan window.restoreSession setelah " + MAX_TRIES + " percobaan (" + (MAX_TRIES * 250 / 1000) + " detik). Event 'sjn:app-ready' TIDAK akan pernah ditembak sesi ini — kemungkinan auth.js belum/gagal dimuat, atau nama fungsi berubah. Modul lain yang bergantung ke event ini akan otomatis fallback ke mekanisme polling internal masing-masing (tidak ada yang rusak, hanya tidak dapat percepatan).");
    }
  }, 250);
}();
