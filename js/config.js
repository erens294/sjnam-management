/* ================================================================
   SJNAM — KONFIGURASI NEON (RAHASIA — JANGAN DI-COMMIT KE GIT)
   ================================================================
   File ini berisi URL Neon Data API + token akses dan TIDAK boleh
   diupload ke GitHub. Sudah didaftarkan di .gitignore.

   CATATAN WORKAROUND (2026-07-03):
   Neon Data API ternyata mewajibkan header Authorization berisi JWT
   di SETIAP request, walau role "anonymous" sudah di-GRANT — beda
   dari asumsi awal (yang mengira request tanpa header bisa lewat).
   Karena itu NEON_JWT di bawah ini WAJIB diisi. Token ini
   ditandatangani sendiri (self-signed) pakai keypair RSA yang public
   key-nya di-host di jwks.json (lihat instruksi migrasi), dengan klaim
   role: "anonymous" — jadi tetap pakai hak akses yang sama seperti
   role anonymous yang sudah di-GRANT di Neon SQL Editor. Token ini
   masa berlakunya 50 tahun, jadi tidak perlu di-refresh berkala.

   Untuk deploy: salin file ini ke folder dist/ sebagai
   dist/js/config.js (sejajar dengan file js lain), ATAU edit
   dist/js/config.example.js dengan nilai asli lalu rename jadi
   config.js.
   ================================================================ */
window.SJNAM_CONFIG = {
  NEON_DATA_API_URL: 'https://ep-small-king-aoggycwm.apirest.c-2.ap-southeast-1.aws.neon.tech/neondb/rest/v1',
  NEON_JWT: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InNqbmFtLWtleS0xIn0.eyJyb2xlIjoiYW5vbnltb3VzIiwic3ViIjoic2puYW0tYXBwIiwiaWF0IjoxNzgzMDY2NzA5LCJleHAiOjMzNTk4NjY3MDl9.Pe4H8I7eaAha3AZ8pDPtXh8knD7KcUpWLLp-ckk254QpzntPKLTMWN4udMltjaK7h4Ea3vCtuw55LWPnFVWW_YtP78YmbMkcLHosG3DOjUbu4LDo454THqXOv4zWaDR96vWDNFH9HdbFGYqEx9iRjdqmWRi_1m0oyA6WVEd2xuzdL9N845szaqHUKBPFnZW5ba6jAG5hB_CdOusJf62_CgEAfQx9w_kD0aaDTymbsfvxQqdOvL1hz45WmvOYe4DyLD9nuDysl7RZQyHB0T8faOFlwM7pp_sNHe9yqN7aUY6BtIL7PiPyjkW-3kXlmH68WwEwvleIpCEqph6MM8J3Og'
};
