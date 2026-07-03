/* ================================================================
   SJNAM — KONFIGURASI NEON (RAHASIA — JANGAN DI-COMMIT KE GIT)
   ================================================================
   File ini berisi URL Neon Data API dan TIDAK boleh diupload
   ke GitHub (walau URL ini tidak serahasia Supabase anon key,
   tetap disarankan private karena akses ditulis lewat role
   "anonymous" tanpa password). Sudah didaftarkan di .gitignore.

   Untuk deploy: salin file ini ke folder dist/ sebagai
   dist/js/config.js (sejajar dengan file js lain), ATAU edit
   dist/js/config.example.js dengan nilai asli lalu rename jadi
   config.js.
   ================================================================ */
window.SJNAM_CONFIG = {
  NEON_DATA_API_URL: 'https://ep-small-king-aoggycwm.apirest.c-2.ap-southeast-1.aws.neon.tech/neondb/rest/v1'
};
