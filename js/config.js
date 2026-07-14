/* ================================================================
   SJNAM — KONFIGURASI MODE SERVER LOKAL
   ================================================================
   File ini menggantikan config.js biasa KHUSUS saat aplikasi
   dijalankan lewat "Jalankan Server SJNAM.bat" (server lokal di
   laptop Anda), BUKAN lewat Firebase/internet.

   LOCAL_SERVER_MODE: true membuat semua fungsi sync (yang aslinya
   bicara ke Firestore Google) diarahkan ke server lokal ini saja
   (lihat firestoreBase() di shared-utils.js).
   ================================================================ */
window.SJNAM_CONFIG = {
  FIREBASE_PROJECT_ID: "local",
  LOCAL_SERVER_MODE: true
};
