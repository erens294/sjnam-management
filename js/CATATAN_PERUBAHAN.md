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

---

## Update 5: Perbaikan arsitektur — mengapa "saling membungkus fungsi" itu rapuh, dan solusinya

Ini jawaban untuk pertanyaan: *kenapa pola saling membungkus `window.switchTab` ini rapuh, dan apa
cara yang lebih baik?*

### Kenapa pola "membungkus fungsi" (monkey-patching) itu rapuh
Pola yang dipakai selama ini di banyak file:
```js
const orig = window.switchTab;      // simpan versi lama
window.switchTab = function(tab) {  // timpa dengan versi baru
  orig(tab);                        // panggil versi lama di dalamnya
  // ...tambahan logika...
};
```
Ini terasa praktis, tapi punya kelemahan struktural:
- **Urutan file jadi krusial.** Kalau satu file di tengah rantai lupa memanggil `orig(...)`, atau
  file itu dimuat SEBELUM `window.switchTab` pernah diisi (persis yang terjadi di sini — ada 1 titik
  di awal yang lupa mengisi nilai awal), seluruh rantai setelahnya rusak diam-diam. Tidak ada error
  di console, aplikasi terlihat jalan, cuma sebagian efek tidak pernah terpanggil.
- **Sulit dilacak.** Kalau ada bug "kok fitur X tidak jalan saat pindah tab", harus menyusuri semua
  file satu per satu untuk tahu urutan pembungkusan yang sebenarnya terjadi saat runtime.
- **Rawan tertimpa.** Siapa pun yang menambah fitur baru dan lupa memanggil versi sebelumnya (atau
  salah urutan `<script>` di HTML) otomatis mematahkan rantai untuk SEMUA fitur lain yang bergantung
  pada pemanggilan berantai itu — persis kasus yang baru terjadi.

### Pola yang lebih baik: event bus, bukan rantai pembungkus
Solusi standar untuk masalah ini adalah **pub/sub (publish-subscribe)** — satu sumber kebenaran yang
menyiarkan kejadian, dan sebanyak apa pun modul lain tinggal "mendengarkan" tanpa perlu tahu atau
menyentuh satu sama lain sama sekali. Ini sudah mulai diterapkan:

1. **`js/service-recovery.js`** — fungsi inti `switchTab()` sekarang **langsung diisi ke
   `window.switchTab` begitu didefinisikan** (baris tambahan: `window.switchTab=switchTab;`).
   Ini menutup celah di titik paling awal yang jadi akar semua masalah di atas.
2. Di akhir fungsi inti itu, ditambahkan satu baris:
   ```js
   document.dispatchEvent(new CustomEvent("sjn:tab-changed", { detail: { tab: name } }));
   ```
   Ini adalah **pengumuman resmi** setiap kali tab berpindah. Modul apa pun — sekarang atau nanti —
   bisa mendengarkan ini tanpa perlu menyentuh `window.switchTab` sama sekali:
   ```js
   document.addEventListener("sjn:tab-changed", (e) => {
     if (e.detail.tab === "drygoods-data") { /* lakukan sesuatu */ }
   });
   ```
3. Modul yang sudah ditulis ulang mengikuti pola independen ini: `js/station-report.js` dan
   `js/drygoods-tab-watch.js` — keduanya sudah tidak menyentuh `window.switchTab` sama sekali, cukup
   mengamati tab-pane yang aktif secara langsung (setara dengan mendengarkan event, tapi lewat DOM).

### Kenapa belum SEMUA file lama saya ubah ke pola event
File `auth.js` dan `drygoods.js` masih memakai pola pembungkusan lama (kini sudah berfungsi normal
setelah akar masalahnya diperbaiki di poin 1). Sengaja **tidak saya bongkar total** sekarang,
karena:
- `auth.js` membungkus `switchTab` untuk **memblokir** navigasi (gate akses berdasarkan role) —
  ini butuh jalan SEBELUM/MENGGANTI aksi asli, bukan cuma "beri tahu sesudahnya", jadi memang lebih
  cocok tetap sebagai pembungkus, bukan event listener.
- `drygoods.js` adalah file besar (60KB+) yang berisiko tinggi diubah sekaligus tanpa pengujian
  manual penuh di browser — mengubahnya butuh sesi terpisah dengan pengujian menyeluruh per fitur
  (transaksi stok, IFS, bank item, dsb.) agar tidak ada regresi yang tidak sengaja.

**Rekomendasi ke depan:** untuk fitur BARU yang cuma perlu "bereaksi" saat tab tertentu dibuka
(bukan memblokir navigasi), gunakan `document.addEventListener("sjn:tab-changed", ...)` — jangan
menambah pembungkus baru di atas `window.switchTab`. Kalau Anda mau, saya juga bisa membongkar
`drygoods.js` ke pola event ini secara bertahap di sesi terpisah (dengan pengujian menyeluruh),
supaya rantai pembungkusnya makin pendek dan makin jarang punya titik rawan seperti ini.

---

## Update 6: Bongkar `drygoods.js` ke pola event bus + fitur baru Activity Report

### Bongkar drygoods.js
- File: `js/drygoods.js`.
- Baris `const _origSwitch=window.switchTab;window.switchTab=function(tab){...}` **dihapus total**
  dan diganti `document.addEventListener("sjn:tab-changed", function(e){...})` — jadi drygoods.js
  sekarang **tidak lagi ikut menambah lapisan pembungkus** ke `window.switchTab`. Efeknya persis
  sama (buka tab Data Stok/Dashboard/IFS Station/Bank Item → data disegarkan), tapi lewat jalur yang
  tidak bisa rusak karena urutan loading script.
- Langkah resize chart dashboard yang sebelumnya cuma jalan lewat 1 jalur, sekarang dipindah ke
  dalam `DRYGOODS.renderAll()` supaya konsisten dipanggil dari jalur mana pun (event bus, DOM
  watcher di `drygoods-tab-watch.js`, atau panggilan manual).
- `js/drygoods-tab-watch.js` dan `js/station-report.js` juga ditambahkan listener
  `sjn:tab-changed` sebagai pelengkap cepat di samping pengamatan DOM yang sudah ada — jadi kalau
  Firebase/timing apa pun berubah di masa depan, ada 2 jalur independen yang saling menopang.
- **Belum dibongkar:** pembungkusan di `auth.js` (memang harus tetap sebagai pembungkus karena
  fungsinya memblokir navigasi) dan lapisan di `index.html` (script "Enhanced" — kecil, berisiko
  rendah, dan hanya menambah 1 baris `setTimeout` untuk admin, aman dibiarkan).

### Activity Report — bisa tambah Station sendiri
- Sebelumnya daftar 28 station di Activity Report tetap/baku (hardcode). Sekarang di sub-tab
  **Input Data** ada tombol **➕ Tambah Station** — isi nama (bebas, misal "Bandung (BDO)"), station
  baru langsung muncul di form input, dashboard, dan rekap.
- Tabel Input Data juga dapat kolom **Aksi** dengan tombol **Hapus** per baris untuk menghapus
  station dari daftar (riwayat data yang sudah ada untuk station itu tetap tersimpan, hanya tidak
  tampil lagi di form input).
- Daftar station tersimpan terpisah dari 28 default (di localStorage), jadi tidak perlu ubah kode
  kalau mau menambah/mengurangi station di kemudian hari.

### Ganti istilah "Distrik" → "Station"
- Semua label & teks yang terlihat di tab Activity Report (judul, KPI card, header tabel,
  placeholder pencarian, keterangan kategori Tutup) diganti dari "Distrik" menjadi "Station".
  Data yang tersimpan tidak berubah — ini murni perubahan tampilan/istilah.

### Export PDF & Excel — sub-tab Dashboard dan Rekap Bulanan
- **Dashboard**: tombol **⬇️ Export Excel** (2 sheet: ringkasan KPI + peringkat kepatuhan station
  untuk bulan yang sedang dipilih) dan **📕 Export PDF** (ringkasan KPI, grafik distribusi kategori,
  dan tabel peringkat dengan warna kategori — untuk bulan yang sedang dipilih).
- **Rekap Bulanan**: tombol **⬇️ Export Excel** dan **📕 Export PDF** — mengekspor tabel rekap
  station × 12 bulan sesuai tahun & mode yang sedang aktif (Kepatuhan % atau Jumlah Hari Lapor),
  termasuk pewarnaan sel kategori pada PDF saat mode Kepatuhan %.
- Tidak ada library baru yang ditambahkan — memakai jsPDF + jspdf-autotable + SheetJS (XLSX) yang
  sudah termuat di aplikasi ini.




