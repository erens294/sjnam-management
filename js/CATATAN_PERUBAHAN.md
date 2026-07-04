# Catatan Perubahan

## 1. Tab IFS Station → mode "lihat saja" (read-only)
- File: `js/ifs-station-viewonly.js` (**baru**), `index.html` (nambah 1 baris `<script>`).
- Tombol **+ Tambah Karyawan** dan tombol **Edit/Hapus** di tabel Drygoods → IFS Station kini disembunyikan.
- Muncul catatan info di atas tabel: *"Tab ini bersifat lihat-saja..."*.
- Semua tambah/ubah/hapus karyawan, ganti password, atur akun & role sekarang **hanya** lewat
  **Admin → Data Karyawan** dan **Admin → Kelola Akun**. Tabel IFS Station tetap otomatis
  menampilkan data terbaru (nama, NIP, station, jabatan, status kontrak) karena sumber datanya
  sama (`sjnam_karyawan_v1`) — jadi begitu diedit di Admin, tampilan IFS Station ikut berubah
  tanpa perlu reload.
- Tidak ada data yang diubah/dihapus — ini murni membatasi tombol di 1 layar saja.

## 2. Group tab baru: "Station Report"
- File: `js/station-report.js` (**baru**), `index.html` (sidebar group + 3 section tab, 1 baris `<script>`),
  `js/auth.js` (tambah entri permission untuk 3 tab baru + grup sidebar).
- 3 sub-tab:
  1. **Activity Report** — daftar 28 distrik (diambil dari sheet *Master Distrik* pada file Excel
     yang dilampirkan). Pilih tanggal → klik status **Lapor / Tidak Lapor / Tutup** per distrik
     (satu klik langsung tersimpan, tidak perlu tombol Simpan terpisah). Ada progress counter,
     riwayat, pencarian, dan tombol Export Excel.
  2. **Check-In Report** — form sederhana: Tanggal, Station, Flight, jam buka/tutup check-in,
     jumlah pax, catatan. Tabel data + pencarian + Export Excel.
  3. **First Bag Last Bag Report** — form sederhana: Tanggal, Station, Flight, waktu bag pertama/
     terakhir turun, total bag, catatan. Otomatis hitung durasi. Tabel data + pencarian + Export Excel.
- Semua data tersimpan lokal (localStorage) dan ikut mekanisme sync yang sudah ada (`triggerAutoSync`),
  sama seperti modul lain di aplikasi ini.
- Akses tab-tab ini diatur lewat **Admin → Atur Akses Role** seperti tab lainnya (default: Co-Admin
  & User punya akses, role lain perlu diaktifkan manual).

## Cara pasang
1. Salin `index.html` ini menimpa `dist/index.html` yang lama.
2. Salin `js/auth.js`, `js/ifs-station-viewonly.js`, `js/station-report.js` ke folder `dist/js/`
   (auth.js menimpa yang lama, dua file lainnya baru).
3. File JS lain (drygoods.js, karyawan-management.js, dst.) **tidak diubah** — tidak perlu diganti,
   tapi tetap disertakan hanya sebagai referensi bila diperlukan.
4. Reload aplikasi. Tidak ada migrasi data yang diperlukan.

## Yang TIDAK diubah
- Struktur data karyawan (`sjnam_karyawan_v1`), stok Drygoods, transaksi, dan modul lain tidak disentuh.
- Tidak ada penghapusan data existing.

---

## Update 2: Perbaikan sinkronisasi station "ALL" + kunci tombol +Station

### Bug: Station karyawan sudah diubah ke "ALL" di Admin, tapi di sesi user tetap terkunci ke station lama
- File: `js/patch-arsitektur-v3.js` (diperbaiki, 2 titik).
- Akar masalah: setelah data karyawan tersinkron ulang (baik lewat auto cloud-pull ~1.2 detik
  setelah halaman dibuka, maupun langsung setelah Admin menyimpan perubahan), kode lama hanya
  me-render ulang **tabel transaksi** (`renderDgTrx`) tapi **tidak** membangun ulang **baris tab
  station** (`buildStationTabs`) — sehingga tombol "🌐 All" dan daftar tab station tetap
  menampilkan kondisi lama (terkunci ke 1 station) walau data di baliknya sudah benar "ALL".
- Perbaikan: kedua titik itu sekarang memanggil `DRYGOODS.renderAll()` (yang membangun ulang tab
  station, dashboard, tabel, dst. secara lengkap) untuk role `User-DRG`, bukan cuma render tabel.
- Dampak: begitu data karyawan seorang User-DRG diubah menjadi `ALL` (atau ke station lain), tab
  station di layar Data Stok Drygoods miliknya akan otomatis memperbarui diri sendiri — baik saat
  auto-sync berjalan (±1 detik setelah reload) maupun mekanisme polling 5 detik yang sudah ada
  sebelumnya. User tidak perlu logout/login manual, cukup tunggu sebentar atau reload halaman.

### Fitur baru: kunci tombol "+ Station" untuk user yang stationnya bukan ALL
- File: `js/drygoods.js` (diperbaiki, 2 titik: `buildStationTabs()` dan click handler).
- Untuk role `User-DRG` yang station-nya terkunci ke 1 station tertentu (bukan `ALL`), tombol
  **"+ Station"** di tab Data Stok Drygoods kini:
  - Tampil abu-abu / redup dan tidak bisa diklik (`disabled`).
  - Ada tooltip saat hover: *"Akses Anda terbatas ke station XXX. Hanya user dengan akses ALL
    station yang dapat menambah station baru. Hubungi Admin bila perlu."*
  - Sebagai lapis keamanan tambahan, kalau tombol ini somehow tetap ter-klik, sistem akan
    menampilkan toast error dan tidak membuka modal tambah station.
- Untuk user dengan station `ALL` (termasuk Admin/Master), tombol tetap berfungsi normal seperti
  sebelumnya.

---

## Update 3: Perbaikan akar masalah sinkronisasi station + redesain Activity Report

### Bug akar masalah ditemukan: lookup karyawan di dalam cloudPull tidak punya fallback NIP
- File: `js/shared-utils.js` (diperbaiki).
- Selain 2 titik yang sudah diperbaiki di Update 2, ternyata ada **satu lagi titik utama** —
  di dalam fungsi `cloudPull()` sendiri (bukan cuma di file patch) — yang mendeteksi ulang station
  User-DRG setiap kali data ditarik dari cloud. Titik ini mencari data karyawan **hanya berdasarkan
  `username`**, tanpa fallback ke NIP seperti fungsi-fungsi lain di aplikasi. Kalau pencarian itu
  gagal cocok, station dianggap kosong/tidak terkunci — makanya tab station & tombol "+ Station"
  tampil seperti tidak ada pembatasan sama sekali, walau data karyawannya sudah benar diubah ke
  station tertentu (SUB, dsb.) di Admin.
- Diperbaiki agar lookup ini konsisten dengan bagian lain: cocok lewat `username` **atau** `NIP`.

### Tambahan: auto-sync berkala (bukan cuma sekali saat halaman dibuka)
- Sebelumnya, pengambilan data terbaru dari cloud (Smart-Sync) hanya berjalan **sekali**, ± 1 detik
  setelah halaman pertama kali dibuka. Kalau Admin mengubah data di device/browser lain sementara
  user lain sudah lebih dulu login dan tidak reload halaman, perubahan itu baru akan terlihat kalau
  user tersebut reload manual.
- Ditambahkan pengambilan data otomatis berkala **setiap 25 detik** (selama Firebase terkonfigurasi
  & user sedang login), supaya perubahan seperti "station karyawan diubah di Admin" ikut terlihat
  di sesi user lain tanpa perlu logout/login atau reload manual — cukup tunggu sebentar.
- Dengan 2 perbaikan di atas + perbaikan Update 2 sebelumnya, sekarang ada 4 lapis mekanisme yang
  saling menopang untuk menjaga tab station & tombol "+ Station" selalu sesuai data karyawan
  terbaru: refresh di dalam `cloudPull()`, hook tambahan di `patch-arsitektur-v3.js`, polling lokal
  5 detik, dan auto-sync berkala 25 detik.

### Activity Report — didesain ulang mengikuti model "Dashboard Distrik App" yang dilampirkan
- File: `index.html` (markup tab Activity Report diganti total), `js/station-report.js` (logika
  dashboard baru).
- Tab Activity Report sekarang punya **3 sub-tab**, meniru gaya dashboard "Denyut Distrik" yang
  dilampirkan:
  1. **📊 Dashboard** — tampilan utama: 6 KPI card (Distrik Aktif, Rata-rata Hari Lapor, Kategori
     Better/Middle/Worst, Tidak Lapor), leaderboard peringkat kepatuhan per distrik, chart pie
     (distribusi kategori), chart bar horizontal (kepatuhan % per distrik, diurutkan), dan chart
     tren garis (rata-rata kepatuhan seluruh distrik antar bulan). Ada month-picker (◀ ▶ + dropdown
     bulan) dan "pulse strip" — deretan titik warna kecil di kanan atas yang menunjukkan status
     kepatuhan tiap distrik sekilas pandang.
  2. **✍️ Input Data** — bentuk pengisian harian yang sudah ada sebelumnya tetap dipertahankan
     (pilih tanggal → klik status Lapor/Tidak Lapor/Tutup per distrik, satu klik langsung
     tersimpan) plus riwayat & pencarian. Ini tetap satu-satunya tempat input manual.
  3. **🗓️ Rekap Bulanan** — tabel rekap per distrik x 12 bulan dalam satu tahun (bisa pilih tahun
     via tab tahun), dengan 2 mode tampilan: **Kepatuhan %** (sel diwarnai sesuai kategori) atau
     **Jumlah Hari Lapor**.
- Kategori kepatuhan dihitung sama seperti pola pada file Excel/Dashboard yang dilampirkan:
  **Better ≥ 87%**, **Middle 53–86%**, **Worst < 53%** (dihitung dari hari Lapor dibagi hari
  efektif dalam bulan — hari berstatus Tutup dikeluarkan dari pembagi). Kalau seluruh hari dalam
  sebulan berstatus Tutup, distrik itu masuk kategori **Tutup** (bukan Worst).
- Semua chart menggunakan Chart.js yang sudah termuat di aplikasi (tidak menambah library baru).
- Data & skema penyimpanan **tidak berubah** — masih pakai data Input Data yang sama, jadi tidak
  ada migrasi/kehilangan data.

---

## Update 4: Perbaikan akar masalah sesungguhnya — rantai `switchTab` yang rapuh

Setelah ditelusuri lebih dalam, ternyata Update 1–3 sudah benar secara logika, tapi **tidak
pernah sempat jalan** untuk kasus tab Station Report yang baru & untuk refresh station Drygoods,
karena ada bug struktural yang sudah ada sejak lama di aplikasi ini (bukan bagian yang saya
tambahkan sebelumnya):

### Apa yang terjadi
Aplikasi ini punya banyak file (`service-recovery.js`, `auth.js`, `drygoods.js`, dst.) yang saling
"membungkus" fungsi global `window.switchTab` — setiap file menyimpan versi sebelumnya lalu
menambahkan perilaku baru di atasnya, lalu memanggil versi sebelumnya di dalamnya. Ternyata di titik
paling awal (antara `service-recovery.js` dan `auth.js`), pembungkusan itu terputus: `window.switchTab`
belum sempat diisi nilai apa pun sampai `drygoods.js` memaksanya diisi ulang **tanpa memanggil
versi sebelumnya**. Akibatnya, sebagian efek "begitu tab X dibuka, jalankan Y" — termasuk mekanisme
saya sebelumnya yang menyalakan Dashboard Activity Report & yang menyegarkan station lock Drygoods
— **tidak selalu terpanggil**, tergantung urutan & timing loading skrip. Ini juga menjelaskan kenapa
tab Dashboard/Input Data/Rekap Bulanan terlihat tapi tidak responsif (CSS & event listener-nya
memang belum sempat dipasang).

### Perbaikan
Alih-alih ikut menambah satu lapis pembungkus lagi ke rantai yang sudah rapuh itu (yang berisiko
menambah bug baru), pendekatannya diubah total: **tidak lagi bergantung pada `window.switchTab`
sama sekali** untuk 2 hal ini. Sebagai gantinya:
- `js/station-report.js` — sekarang mengamati langsung perubahan tampilan (DOM) pada section tab
  Activity Report / Check-In Report / First Bag Last Bag. Begitu section itu terlihat aktif di
  layar (dengan cara apa pun itu terjadi), modul ini otomatis menyalakan dirinya sendiri — memasang
  CSS, event listener sub-tab, dan mengisi data dashboard. Ditambah juga listener klik langsung di
  tombol sidebar sebagai jalur cepat cadangan.
- `js/drygoods-tab-watch.js` (**file baru**) — pola yang sama diterapkan untuk tab Drygoods (Data
  Stok, IFS Station, Dashboard, Bank Item): begitu salah satu tab itu terlihat aktif, station-lock
  & seluruh tampilan Drygoods otomatis disegarkan ulang dari data karyawan terbaru. Ini memastikan
  kasus seperti Elyn (station diubah di Admin ke SUB) langsung tercermin begitu tab Data Stok/IFS
  Station dibuka atau di-refresh — tidak lagi bergantung pada rantai `switchTab` yang rapuh.

Perbaikan Update 1–3 (lookup NIP, auto-sync berkala, dsb.) **tetap dipertahankan** sebagai lapis
tambahan — sekarang total ada 5 mekanisme berbeda yang saling menopang, dan yang paling menentukan
(pengamatan DOM langsung) tidak lagi bisa gagal karena masalah urutan loading skrip.



