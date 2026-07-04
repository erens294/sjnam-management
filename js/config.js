/* ================================================================
   SJNAM — KONFIGURASI FIREBASE
   ================================================================
   Migrasi ke-2 (2026-07-03): pindah dari Neon Data API ke Firebase
   Firestore karena Neon mengalami bug persisten pada custom JWKS
   provider ("jwk not found") yang tidak bisa diperbaiki walau sudah
   dicoba 3 keypair berbeda. Firestore dipilih karena kuota gratis
   jauh lebih longgar (reset harian), tidak perlu kartu kredit, dan
   akses publik/tanpa-login didukung resmi lewat Security Rules.

   projectId di bawah ini BUKAN rahasia — nilai config Firebase Web
   App memang didesain untuk ditaruh langsung di kode frontend/publik.
   Keamanan data diatur oleh Firestore Security Rules (Firebase
   Console → Firestore Database → Rules), bukan oleh nilai ini.
   Rules saat ini: "allow read, write: if true" (akses publik penuh,
   setara konsep "anonymous role" yang dipakai di Supabase/Neon
   sebelumnya).

   Untuk deploy: salin file ini ke folder dist/ sebagai
   dist/js/config.js (sejajar dengan file js lain), ATAU edit
   dist/js/config.example.js dengan nilai asli lalu rename jadi
   config.js.
   ================================================================ */
window.SJNAM_CONFIG = {
  FIREBASE_PROJECT_ID: 'service-sjnam'
};
