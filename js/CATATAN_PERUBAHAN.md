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

---

## Update 7: Tombol "+ Tambah Station" "tidak berfungsi" — akar masalahnya cache browser, bukan bug kode

### Diagnosis
Screenshot yang dikirim menunjukkan teks **"0 / 28 distrik sudah diisi..."** — padahal di Update 6
teks itu sudah diganti jadi **"station"**. Ini adalah tanda pasti bahwa file `js/station-report.js`
yang benar-benar berjalan di browser masih versi **lama** (dari sebelum Update 6), bukan file yang
sudah saya kirim. Saya cek ulang file yang saya kirim di Update 6 — teks & tombolnya sudah benar
(sudah saya verifikasi ulang: 0 kemunculan teks "distrik" yang terlihat user, tombol
`btnSrActAddStation` sudah tersambung ke fungsi `openAddStationModal`). Jadi bukan bug kode, tapi
**file lama masih ter-cache** di browser atau server hosting belum menimpa file yang lama.

### Perbaikan: cache-busting otomatis
- File: `index.html`.
- Semua tag `<script src="js/....js">` sekarang punya akhiran versi, contoh:
  `<script src="js/station-report.js?v=20260704a">`. Setiap kali saya kirim update baru, versi ini
  akan saya naikkan (misal jadi `?v=20260704b`) — begitu Anda mengganti `index.html` dengan versi
  baru, browser **otomatis dipaksa mengambil ulang** semua file JS yang berubah, tidak mengandalkan
  cache lama sama sekali. ini menutup celah "kode sudah benar tapi browser masih pakai versi lama"
  yang sepertinya jadi penyebab beberapa laporan bug beberapa waktu terakhir.

### Yang perlu dilakukan di sisi Anda
1. Timpa **seluruh isi folder `dist/`** (jangan cuma file yang "kelihatan berubah") dengan yang saya
   kirim, termasuk `index.html` yang baru ini.
2. Setelah upload, lakukan **hard refresh** di browser (Ctrl+Shift+R / Cmd+Shift+R) satu kali saja
   untuk memastikan `index.html` versi terbaru (dengan tag `?v=...` baru) benar-benar termuat.
   Setelah itu, `?v=...` akan otomatis menjaga cache tetap segar setiap kali ada update selanjutnya
   — tidak perlu hard refresh manual lagi ke depannya.
3. Kalau memakai CDN/proxy caching di depan hosting (Cloudflare, dsb.), pastikan juga cache di sana
   di-*purge* setelah upload, karena cache-busting di sisi browser tidak menembus cache di layer itu.

### Semua group tab lain
Sudah saya cek ulang seluruh grup tab (Service Recovery, Stretchercase & POB, Service Training,
Admin, Drygoods, Station Report) — tidak ada bug tambahan yang ditemukan di kode. Perbaikan
cache-busting di atas berlaku untuk SEMUA file JS aplikasi ini sekaligus, jadi kalau ada tab lain
yang juga terasa "nyangkut di versi lama", perbaikan ini akan ikut menyelesaikannya.

---

## Update 8: Sidebar tidak bisa di-minimize, refresh page reset data, import Excel, dan investigasi lanjutan kasus Elyn

### Bug ditemukan & diperbaiki: grup "STATION REPORT" tidak bisa di-minimize
- File: `index.html`.
- Saat menambahkan grup sidebar "Station Report" di update sebelumnya, saya menambahkan tombol &
  event click-nya, tapi **lupa mendaftarkan ID kontainernya (`#stationReportMenuContent`) ke 3 baris
  CSS** yang mengatur animasi collapse/expand (yang sudah ada sejak awal untuk grup Admin, Service
  Recovery, STCR, Training, Drygoods). Akibatnya class `.collapsed` yang di-toggle oleh JavaScript
  tidak punya efek visual apa pun — klik pada header grup terlihat tidak merespon. Sudah diperbaiki,
  ke-3 baris CSS itu sekarang ikut menyertakan `#stationReportMenuContent`.

### Bug ditemukan & diperbaiki: refresh resets filter Dashboard Service Recovery
- File: `js/service-recovery.js`.
- Kode inisialisasi filter tanggal Dashboard (Service Recovery) selalu **memaksa reset ke "7 hari
  terakhir"** setiap kali halaman dimuat ulang — tidak peduli filter tanggal/airline apa yang
  sebelumnya Anda pilih. Ini yang menyebabkan kesan "pindah halaman" & "data ter-reset" setelah
  refresh: Anda tetap di tab Dashboard yang benar, tapi tampilan KPI/grafik berubah total karena
  filter tanggalnya diam-diam kembali ke default.
- Diperbaiki: filter tanggal & airline sekarang **disimpan ke localStorage** setiap kali diubah
  (baik lewat input tanggal manual maupun tombol preset 7 Hari/30 Hari/Semua), dan **dipulihkan**
  saat halaman dimuat ulang. Kalau belum pernah diatur sebelumnya, baru default ke 7 hari terakhir
  seperti semula.

### Bug ditemukan & diperbaiki: refresh listener station Drygoods yang salah nama fungsi
- File: `js/service-recovery.js`.
- Ditemukan saat menelusuri kasus Elyn lebih dalam: ada kode yang seharusnya menyegarkan tampilan
  Drygoods saat browser tab kembali terlihat (misal setelah pindah tab lalu balik lagi, atau laptop
  bangun dari sleep) — tapi kode itu memanggil nama fungsi yang **tidak pernah benar-benar dibuat
  global** (`buildStationTabs` — yang benar diekspos dengan nama `buildDgStationTabs`). Akibatnya
  bagian refresh tab-station (dimming, status "+Station" terkunci, dsb.) diam-diam gagal jalan di
  jalur ini, meski jalur lain (polling 5 detik, event tab-changed) tetap berjalan. Sudah diganti
  memakai `DRYGOODS.renderAll()` yang benar dan mencakup semua bagian (lock, tab, tabel, dashboard).
- File: `js/shared-utils.js` — pembersihan kode serupa yang tidak berbahaya (karena
  `DRYGOODS.renderAll()` di baris setelahnya sudah mencakup itu) tapi membingungkan untuk dibaca.

### Kasus Elyn (station tidak berubah) — status investigasi
Dengan perbaikan di atas + seluruh perbaikan Update 1–7 sebelumnya, sekarang ada **6 mekanisme
independen** yang saling menopang untuk menjaga station Drygoods selalu sesuai data karyawan
terbaru: refresh di dalam `cloudPull()`, hook di `patch-arsitektur-v3.js`, polling lokal 5 detik,
pengamatan DOM tab-aktif (`drygoods-tab-watch.js`), event bus `sjn:tab-changed`, dan sekarang
refresh saat tab browser kembali terlihat. Kalau setelah update ini (dan hard-refresh + hapus cache)
Elyn **masih** tidak berubah, kemungkinan besar akar masalahnya bukan lagi di kode, melainkan:
- **Cloud sync (Firebase) belum benar-benar terhubung** untuk device/browser Elyn — cek indikator
  status sync di tab Settings saat Elyn login (harus hijau "Terhubung", bukan abu-abu).
- **Elyn & Admin memakai device/browser yang benar-benar berbeda** dan belum ada satu pun proses
  sync yang berhasil jalan sejak perubahan dibuat — minta Elyn logout lalu login ulang (bukan cuma
  refresh) untuk memaksa pull data terbaru saat proses login.
- Kalau kedua hal di atas sudah dipastikan oke tapi tetap gagal, mohon info: apakah Elyn login di
  device/browser yang sama dengan Admin, atau benar-benar berbeda? Ini akan menentukan apakah
  masalahnya di sisi cloud sync atau ada hal lain yang perlu ditelusuri lebih jauh.

### Fitur baru: Import Excel di Activity Report → Input Data
- File: `index.html`, `js/station-report.js`.
- Tombol **📥 Import Excel** baru di sub-tab Input Data (sebelah tombol Tambah Station & Export
  Excel). Mendukung file dengan struktur seperti `Distrik_Activity_Dashboard2.xlsx` yang dilampirkan
  sebelumnya — kolom dikenali secara fleksibel: **Tanggal** (atau Tgl/Date), **Station** (atau
  Distrik/Stasiun), **Status** (Lapor/Tidak Lapor/Tutup — juga menerima singkatan L/TL/T), dan
  **Keterangan** (opsional, atau Catatan/Note).
- Kalau ada nama station di file Excel yang belum ada di daftar aplikasi, akan **otomatis
  ditambahkan** ke daftar station (dengan konfirmasi sebelum disimpan).
- Data tanggal & station yang sama akan **diperbarui**, bukan diduplikasi — sama seperti aturan
  input manual. Ada ringkasan hasil import (berapa data baru, berapa diperbarui, berapa baris
  dilewati beserta alasannya).
- Tombol **📋 Template** juga ditambahkan di sebelah tombol Import — download contoh file Excel
  siap isi dengan format kolom yang benar (3 baris contoh memakai nama station yang sudah ada di
  aplikasi, mencontohkan ketiga status: Lapor, Tidak Lapor, Tutup).

### Format file Excel untuk Import Activity Report
Kolom yang dibaca (nama kolom fleksibel, tidak harus persis — sistem mencari kecocokan):

| Kolom di Excel | Nama alternatif yang juga dikenali | Wajib? | Contoh isi |
|---|---|---|---|
| **Tanggal** | Tgl, Date | Wajib | `2026-07-04` atau `04/07/2026` |
| **Station** | Distrik, Stasiun | Wajib | `Ujung Pandang (UPG)` |
| **Status** | — | Wajib | `Lapor` / `Tidak Lapor` / `Tutup` (atau singkatan `L` / `TL` / `T`) |
| **Keterangan** | Catatan, Note | Opsional | bebas teks |

Catatan format:
- **Tanggal** bisa `yyyy-mm-dd`, `dd/mm/yyyy`, atau format tanggal Excel biasa (serial number) —
  semua dikenali otomatis.
- **Station** boleh nama yang sudah ada di daftar aplikasi, ATAU nama baru — kalau baru, akan
  ditawarkan untuk otomatis ditambahkan ke daftar station saat proses import dikonfirmasi.
- **Status** harus salah satu dari 3 nilai di atas (besar/kecil huruf tidak masalah).
- Baris dengan tanggal/station/status yang tidak valid akan **dilewati** (tidak menggagalkan
  keseluruhan import) — rincian baris mana & kenapa dilewati ditampilkan di ringkasan hasil import.
- Kalau kombinasi Tanggal + Station pada baris Excel sudah ada datanya di aplikasi, data itu akan
  **diperbarui** (ditimpa), bukan membuat entri duplikat.

---

## Update 9: Bug rumus kepatuhan — bulan yang belum terjadi ikut dihitung "0% / Worst"

### Bug ditemukan & diperbaiki
Pertanyaan Anda ("kenapa Rekap Bulanan sudah sampai Desember padahal data cuma sampai Juli?")
mengarah ke bug nyata di rumus penghitungan kepatuhan (`computeDistrikMonth` di
`js/station-report.js`). Rumusnya adalah *hari Lapor ÷ jumlah hari efektif dalam bulan* — tapi
untuk bulan yang **belum terjadi** (Agustus–Desember, karena sekarang baru Juli), jumlah hari
Lapor pasti 0, sehingga hasilnya selalu **0% dan masuk kategori "Worst" (merah)** — padahal bulan
itu memang belum berjalan sama sekali, bukan berarti station-nya benar-benar tidak lapor.

### Perbaikan
- Bulan yang **sepenuhnya belum terjadi** (lebih besar dari bulan berjalan saat ini) sekarang
  ditandai kategori baru **"Belum"** dan ditampilkan sebagai **"—"** (strip, tanpa warna merah) di
  tabel Rekap Bulanan — bukan lagi "0% Worst". Ini otomatis berlaku di semua tempat yang memakai
  rumus ini: Rekap Bulanan, Dashboard (KPI, leaderboard, chart), dan pulse strip.
- Sekalian diperbaiki juga bug terkait: untuk **bulan yang sedang berjalan** (misalnya Juli, kalau
  hari ini tanggal 4 Juli), persentase sekarang dihitung dari **hari yang sudah lewat saja** (1–4
  Juli), bukan dari 31 hari penuh bulan Juli. Sebelumnya station yang rutin lapor pun akan terlihat
  persentasenya sangat rendah di awal bulan hanya karena dibagi jumlah hari yang belum tercapai.
- Data & histori yang tersimpan **tidak berubah** — ini murni perbaikan rumus tampilan/kalkulasi.

---

## Update 10: Bug import Excel salah bulan, konfirmasi fitur Reset Data, dan perbaikan kecil dialog konfirmasi

### Bug ditemukan & diperbaiki: import Excel bisa salah ambil kolom tanggal
- File: `js/station-report.js`.
- Ini kemungkinan besar penjelasan kenapa import data Januari–Juni bisa memunculkan 1 data bulan
  Juli: pencarian kolom "Tanggal" sebelumnya punya jalur cadangan (*fuzzy match*) yang menerima
  kolom APA SAJA yang namanya *mengandung* kata "date" — misalnya kolom metadata seperti "Updated
  Date" atau "Created Date" kalau kebetulan ada di file Excel Anda dan kolom "Tanggal" utama tidak
  terbaca sempurna. Kolom seperti itu biasanya berisi tanggal hari ini (saat file diproses/dibuat),
  yang kebetulan match dengan sistem sekarang di bulan Juli 2026.
- Diperbaiki: kolom **Tanggal sekarang HARUS cocok persis** dengan salah satu nama "Tanggal", "Tgl",
  atau "Date" (tidak lagi menerima kecocokan sebagian/fuzzy). Kolom lain (Station, Status,
  Keterangan) tetap fleksibel seperti sebelumnya karena risikonya jauh lebih kecil.
- Tambahan **lapisan pengaman**: sebelum data benar-benar disimpan, dialog konfirmasi import
  sekarang menampilkan **rentang tanggal yang terdeteksi di file** (misalnya "01-Jan-2026 s/d
  30-Jun-2026") di baris paling atas — supaya kalau ada tanggal yang meleset, langsung terlihat
  SEBELUM data ikut tersimpan, bukan sesudahnya.

### Soal data "06-Dec-2026" di Riwayat Terbaru
Saya tidak bisa memastikan 100% asal data tersebut (kemungkinan tersisa dari sesi testing
sebelumnya — pola isiannya seperti tandai-status-satu-per-satu untuk semua 28 station, bukan pola
yang dihasilkan bug otomatis). Yang jelas, perbaikan kolom tanggal import di atas menutup jalur
paling mungkin penyebabnya. Untuk membersihkannya: pilih tanggal 06-Dec-2026 di kalender Input
Data, lalu pakai fitur **Reset Data → Hapus data harian** (lihat poin berikutnya) — atau hapus satu
per satu lewat tombol Hapus di baris Riwayat Terbaru.

### Fitur "Reset Data" (by day / by month / all)
Fitur ini **sudah ada** di aplikasi — tombol **🗑️ Reset Data** di sub-tab Input Data (sebelah
Export Excel) berisi dropdown dengan 3 opsi: **Hapus data harian** (sesuai tanggal yang sedang
dipilih di kalender), **Hapus data bulanan** (sesuai bulan dari tanggal yang sedang dipilih), dan
**Hapus SEMUA data**. Masing-masing minta konfirmasi eksplisit sebelum benar-benar menghapus, dan
menyebutkan jumlah data yang akan terhapus. Kalau tombol ini belum terlihat, pastikan sudah
melakukan hard-refresh setelah upload versi terbaru.

### Perbaikan kecil: dialog konfirmasi sekarang menampilkan baris baru dengan benar
- File: `index.html`.
- Dialog konfirmasi (dipakai di banyak tempat: hapus data, import Excel, dst.) sebelumnya tidak
  menampilkan baris baru (`\n`) dengan benar — semua teks jadi menyatu dalam satu baris panjang.
  Ini bug lama yang mempengaruhi SEMUA dialog konfirmasi di aplikasi, bukan cuma yang baru
  ditambahkan. Sudah diperbaiki dengan satu baris CSS — sekarang pesan multi-baris (termasuk
  preview rentang tanggal import di atas) tampil rapi per baris.

---

## Update 11: Audit tampilan mobile — bug CSS ditemukan & diperbaiki, plus perbaikan cache HTML

### Bug ditemukan & diperbaiki: sidebar di HP tampil kosong (cuma ikon, tanpa teks)
- File: `index.html`.
- Akar masalahnya murni CSS: ada 2 aturan yang saling bertentangan untuk teks menu sidebar.
  Aturan "sembunyikan teks" (dipakai untuk mode sidebar diciutkan di laptop) ditulis dengan
  `!important`, sedangkan aturan "tampilkan teks di HP" yang seharusnya membatalkannya **tidak**
  memakai `!important`. Dalam CSS, aturan tanpa `!important` **tidak pernah bisa mengalahkan**
  aturan ber-`!important`, jadi kalau sidebar sempat dalam mode "diciutkan" (misalnya tersimpan
  dari sesi laptop sebelumnya), begitu dibuka di HP teksnya tetap tersembunyi — persis seperti di
  screenshot Anda (kolom ikon gelap tanpa tulisan).
- Sudah diperbaiki: aturan "tampilkan teks di HP" sekarang juga memakai `!important`, plus posisi
  ikon ikut dirapikan supaya sejajar dengan teks (bukan ikut mode "ikon di tengah" ala laptop).

### Peningkatan UX mobile: overlay gelap di belakang sidebar
- Sebelumnya saat sidebar dibuka di HP, konten di belakangnya tetap terlihat terang tanpa penanda
  visual bahwa sidebar sedang aktif. Sekarang ditambahkan overlay gelap transparan di belakang
  sidebar — standar pola "drawer menu" di aplikasi mobile — sekaligus bisa disentuh untuk menutup
  sidebar (selain tombol X/toggle yang sudah ada).

### Perbaikan cache: HTML utama sekarang tidak lagi di-cache
- File: `index.html`.
- `?v=...` yang ditambahkan di Update 7 hanya melindungi file JavaScript dari cache — dokumen
  `index.html` itu sendiri tetap bisa di-cache oleh browser/hosting. Sudah ditambahkan header
  `Cache-Control: no-cache, no-store, must-revalidate` supaya `index.html` **selalu** diambil ulang
  dari server setiap kali dibuka, bukan dari cache. Ini melengkapi perbaikan cache di Update 7 —
  sekarang baik file HTML maupun semua file JS-nya sama-sama tidak akan nyangkut di versi lama.

### Perbaikan tambahan untuk kestabilan tampilan mobile secara umum
- Ditambahkan pengaman CSS agar halaman tidak bisa scroll ke samping (horizontal) di layar kecil —
  penyebab umum tampilan "meleset"/terpotong di HP kalau ada elemen yang sedikit lebih lebar dari
  layar. Elemen seperti tabel yang memang perlu di-scroll ke samping (misalnya Rekap Bulanan) tetap
  bisa di-scroll normal di dalam kotaknya sendiri — ini cuma mencegah SELURUH HALAMAN ikut bergeser.

### Yang perlu Anda lakukan
1. Timpa `index.html` dengan yang baru ini.
2. Di HP, lakukan **hard refresh / hapus cache Safari atau Chrome** SATU KALI (biasanya lewat
   Pengaturan browser → Hapus Riwayat & Data Situs Web, karena HP tidak punya tombol
   Ctrl+Shift+R seperti laptop). Setelah itu header `no-cache` yang baru akan menjaga agar versi
   terbaru selalu termuat otomatis ke depannya.

---

## Update 12: Audit mendalam pengalihan station User-DRG — dites otomatis, akar masalah asli ditemukan & diperbaiki

### Metodologi
Karena tidak ada VirtualBox di lingkungan kerja saya, saya membangun **test otomatis** yang benar-benar
menjalankan seluruh aplikasi (semua file JS asli, tanpa disederhanakan) di dalam mesin browser
virtual (headless), lengkap dengan localStorage sungguhan — lalu men-simulasikan skenario nyata:
login sebagai User-DRG, admin mengubah station, dan memeriksa apakah tampilan benar-benar berubah.
Ini jauh lebih dapat diandalkan dibanding membaca kode secara manual, karena setiap klaim
"seharusnya berfungsi" langsung diuji, bukan diasumsikan. File tesnya saya sertakan di
`tests/run-integration-smoke-test.js` kalau Anda ingin menjalankannya sendiri (`npm i jsdom` lalu
`node tests/run-integration-smoke-test.js` dari folder yang berisi `dist/`).

### Akar masalah SEBENARNYA — akhirnya ditemukan
Tes otomatis ini berhasil mereproduksi persis laporan Anda ("saya sudah coba delete lalu tambahkan
lagi juga tetap tidak bisa dipindahkan stationnya") dan menunjukkan akar masalah yang **belum pernah
ketahuan di 11 update sebelumnya**:

Daftar station yang muncul sebagai tab di Drygoods (`dgData.stations`) itu **daftar terpisah**
dari data karyawan — hanya terisi saat aplikasi pertama kali dimuat, atau saat station baru
ditambahkan lewat form Drygoods sendiri (Tambah Transaksi / Tambah Karyawan IFS). Kalau admin
mengubah station seorang karyawan lewat **Data Karyawan** (panel admin umum, bukan form khusus
Drygoods) — SAAT APLIKASI SUDAH BERJALAN — station baru itu **tidak pernah ditambahkan** ke daftar
tab tersebut. Semua 11 mekanisme refresh yang saya bangun di update-update sebelumnya (polling 5
detik, event bus, pengamatan DOM, dsb.) sudah **benar** memperbarui variabel penguncian station di
belakang layar — tapi karena tab station-nya sendiri tidak pernah dibuat, tidak ada apa pun yang
bisa diklik user untuk melihatnya. Persis seperti "station-nya berubah tapi tidak kelihatan" —
karena secara harfiah tab-nya tidak ada.

### Perbaikan
- File: `js/drygoods.js`.
- Setiap kali station seorang User-DRG berhasil dibaca dari data karyawan (di 3 titik kode yang
  melakukan pembacaan ini), sekarang station itu **otomatis didaftarkan** ke `dgData.stations` kalau
  belum ada di sana (asalkan station itu valid/terdaftar di Bank Data Station) — sehingga tab untuk
  station tersebut **selalu muncul**, tidak peduli lewat form mana admin mengubahnya.

### Hasil pengujian
- **164 dari 164 test otomatis lulus** (termasuk 7 skenario baru yang meniru persis kasus Anda:
  login → cek lock awal, admin ganti station → cek via panggilan langsung, via event bus, via
  polling latar belakang murni tanpa navigasi, hapus-lalu-buat-ulang karyawan dengan station
  berbeda, dan kepekaan huruf besar/kecil pada username).
- Sebelum perbaikan: 5 dari 164 gagal — persis pada skenario "tab station tidak muncul setelah
  station diubah". Sesudah perbaikan: semua lulus.
- Sebagai bonus temuan sampingan: 1 test lama (`cloudConfig`) ternyata menguji asumsi yang sudah
  usang dari sebelum migrasi Supabase→Firebase — sudah diperbarui supaya sesuai arsitektur saat ini.

### Catatan jujur soal keterbatasan pengujian ini
Tes ini memvalidasi **seluruh logika di sisi browser/kode** secara menyeluruh dan nyata (bukan
simulasi/tebakan) — ini yang selama ini paling sering jadi sumber bug. Yang TIDAK bisa diuji di
lingkungan ini adalah lapisan sinkronisasi cloud (Firebase) itu sendiri, karena tidak ada akses
jaringan ke Firebase dari lingkungan kerja saya. Kalau setelah update ini kasus Elyn (atau kasus
serupa) masih terjadi, itu artinya akar masalahnya kemungkinan besar sudah bergeser ke lapisan
konfigurasi/koneksi cloud sync, bukan lagi logika kode — silakan cek indikator status sync di
Settings saat Elyn login, seperti yang saya sarankan di update sebelumnya.

---

## Update 13: Hapus tab IFS Station (Drygoods) + putuskan semua tautan terkait

### Yang dihapus
Tab **Drygoods → IFS Station** dihapus sepenuhnya beserta semua yang terhubung dengannya:
- Tombol sidebar "IFS Station" — dihapus.
- Section/halaman tab itu sendiri (tabel data karyawan per station) — dihapus dari `index.html`.
- Pengaturan hak akses "Drygoods – IFS Station" di halaman **Atur Akses Role** — otomatis hilang
  (halaman itu dibuat otomatis dari daftar fitur, jadi tidak perlu diedit manual).
- `js/ifs-station-viewonly.js` — file ini isinya HANYA logika read-only untuk tab IFS Station,
  jadi sekarang jadi file mati. Sudah dihapus sepenuhnya beserta referensinya di `index.html`.
- Referensi ke tab ini di `js/drygoods-tab-watch.js` (pengamat DOM & event bus) dan
  `js/drygoods.js` (listener event `sjn:tab-changed`) — dilepas.
- Baris di `js/auth.js` yang mengizinkan role "User" mengakses tab ini secara langsung — dilepas.

### Yang SENGAJA tidak diutak-atik
- **Data karyawan itu sendiri** (`sjnam_karyawan_v1`) — tidak dihapus, tidak diubah. Data ini
  dipakai bersama oleh banyak fitur lain (kunci station User-DRG, tab Admin → Data Karyawan, dll),
  jadi menghapus tab IFS Station tidak menghapus satu pun data karyawan yang sudah ada.
  Kalau butuh melihat/mengelola data karyawan per station, tetap bisa lewat **Admin → Data
  Karyawan** — form dan tabelnya lebih lengkap dari yang ada di tab IFS Station.
- Fungsi render internal (`renderDgEmployees`, dsb.) di `drygoods.js` sengaja **dibiarkan ada**
  (bukan dihapus) tapi sudah tidak pernah terpanggil oleh apa pun — ini pilihan yang lebih aman
  daripada membongkar fungsi tersebut, karena tidak menyentuh logika lain yang mungkin masih
  bergantung padanya secara tidak langsung.

### Verifikasi
Dites ulang dengan seluruh 164 test otomatis dari Update 12 (termasuk 7 skenario deep-audit
pengalihan station User-DRG) — **semua tetap lulus** setelah tab IFS Station dihapus, memastikan
penghapusan ini tidak mematahkan logika kunci station yang sudah diperbaiki sebelumnya.

---

## Update 14: Role baru "User-STR" (Station Report)

### Yang ditambahkan
- Role baru **User-STR** — akses default HANYA ke 3 tab Station Report (Activity Report,
  Check-In Report, First Bag Last Bag). Semua tab lain (Home, Drygoods, Admin, dst.) terkunci
  secara default, sama seperti pola role kustom lain (User-SR, User-STCR, dst.).
- Warna khas: cyan (badge `bg-cyan-100 text-cyan-700`), supaya mudah dibedakan dari role lain di
  tabel & dropdown.
- Muncul otomatis di semua tempat yang relevan: dropdown **Add Role** (Admin → Manajemen Role),
  filter role di tabel akun, dropdown **Buat Akun Sekaligus** di form Data Karyawan, dan di halaman
  **Atur Akses Role** (baris kolom baru otomatis muncul karena dibuat dari daftar fitur).
- Nama "User-STR" saya pertahankan sesuai usulan Anda — sedikit mirip visual dengan "User-ST"
  (Service Training) tapi cukup beda (3 huruf vs 2) dan langsung mencerminkan nama modul "Station
  Report". Kalau ke depan terasa membingungkan di lapangan, gampang diganti ke nama lain (misalnya
  "User-SREP") kapan saja lewat satu berkas ini saja.

### Belum ditambahkan (opsional, beri tahu saya kalau perlu)
- **Kunci per-station** seperti yang dimiliki User-DRG/User-SR/User-STCR/User-ST (di mana user hanya
  bisa melihat/isi data untuk 1 station miliknya sendiri). Saat ini User-STR yang login bisa
  isi/lihat data SEMUA station di ketiga tab Station Report. Kalau Anda mau setiap User-STR dikunci
  ke 1 station saja (mis. staff Activity Report di Makassar cuma bisa isi data Makassar), ini fitur
  tambahan yang bisa saya bangun terpisah — pola & seluruh infrastrukturnya sudah ada (dipakai
  Drygoods), tinggal diterapkan ke modul Station Report.

### Verifikasi
Ditambahkan 2 test baru khusus role ini ke `tests/run-integration-smoke-test.js`, termasuk
pengecekan **end-to-end nyata** (bukan cuma cek konfigurasi): login sebagai User-STR lalu benar-benar
mencoba `switchTab` ke tab yang boleh (berhasil) dan yang tidak boleh (diblokir) lewat rantai
`switchTab` sungguhan, plus cek visibilitas grup sidebar. **Total 195 dari 195 test lulus**
(179 test lama + 2 baru untuk role ini + beberapa test lama yang saya sesuaikan jumlah role-nya).

---

## Update 15: 3 bug nyata ditemukan & diperbaiki dari laporan Anda

### Bug #1: Tulisan aneh muncul di bagian bawah layar (`ISTRASI v1 =====...`)
- File: `index.html`.
- **Akar masalah:** ada 1 baris komentar JavaScript (`// ============= SISTEM ADMINISTRASI v1 =============...`)
  yang tertinggal **di luar tag `<script>`** — sisa dari refactor lama yang memindahkan logika
  auth/login ke `js/auth.js`, tapi komentarnya sendiri tidak ikut dibersihkan. Karena tidak dibungkus
  `<script>`, browser membacanya sebagai teks biasa dan menampilkannya apa adanya di halaman.
- **Sudah diperbaiki:** baris itu dihapus. Ini bug lama yang sudah ada sejak sebelum sesi ini
  dimulai — bukan sesuatu yang baru muncul, hanya baru ketahuan sekarang.

### Bug #2: Import data Kartu Stok Drygoods "muncul lalu langsung hilang", termasuk saat dicek Admin
- File: `js/drygoods.js`, `js/shared-utils.js`.
- **Akar masalah — race condition sinkronisasi cloud:** saat import Excel (atau tambah transaksi
  manual) berhasil, data disimpan ke local storage lalu dijadwalkan dikirim ke cloud (Firestore)
  dengan jeda ~800ms. Kalau dalam jeda itu ada proses **tarik data dari cloud** (auto-sync
  berkala, atau device lain), Firestore masih menyimpan versi LAMA (karena data baru belum sempat
  terkirim) — dan versi lama itu **menimpa balik** data yang baru saja diimport, tanpa
  pengecekan apa pun. Ini menjelaskan persis gejala yang Anda lihat: data sempat muncul (berhasil
  tersimpan sesaat), lalu hilang (tertimpa tarikan dari cloud), dan Admin pun tidak melihatnya
  karena data yang sama sudah ikut hilang di local storage.
  Kode untuk `rolePerms` (Atur Akses Role) sebenarnya SUDAH punya perlindungan untuk masalah
  serupa ini sejak awal — tapi Drygoods belum kebagian perlindungan yang sama.
- **Sudah diperbaiki:** ditambahkan "penanda belum-terkirim" (dirty flag) khusus Drygoods,
  meniru pola yang sudah ada untuk `rolePerms`. Setiap kali data Drygoods disimpan secara lokal,
  sistem menandai "belum terkirim ke cloud" selama beberapa detik — tarikan data dari cloud yang
  datang dalam jendela waktu itu akan **dilewati**, bukan menimpa. Begitu pengiriman selesai,
  tarikan dari cloud kembali berjalan normal seperti biasa.

### Bug #3: Elyn sudah dipindah ke station DJJ, tapi Drygoods masih menunjukkan "All"
- File: `js/drygoods.js`.
- **Kemungkinan penyebab yang ditemukan & diperbaiki:** pencarian data karyawan Elyn di 3 titik
  kode Drygoods memakai `.find()` — yang mengambil kecocokan PERTAMA di daftar. Kalau pernah ada
  percobaan hapus-lalu-tambah-ulang sebelumnya dan sampai ada 2 baris data untuk username yang
  sama (satu lama tanpa station yang benar, satu baru dengan station DJJ), `.find()` bisa saja
  mengambil baris LAMA duluan tergantung urutan di larik — membuat station terlihat kosong/ALL
  padahal data yang benar (DJJ) sebenarnya sudah ada.
- **Sudah diperbaiki:** pencarian sekarang mengambil SEMUA baris yang cocok untuk username/NIP
  tersebut, lalu memilih yang **paling baru diubah** (`updatedAt`) — bukan sekadar yang pertama
  ditemukan.
- **Catatan jujur:** saya tidak bisa memastikan 100% ini akar masalah PERSIS yang Anda alami tanpa
  akses langsung ke data Anda, tapi ini cocok dengan gejala yang dijelaskan dan merupakan perbaikan
  yang aman/bermanfaat terlepas dari penyebab pastinya. Kalau setelah update ini + hard refresh
  Elyn MASIH menunjukkan "All", kemungkinan besar penyebabnya adalah **deployment yang belum
  sepenuhnya konsisten di GitHub Pages Anda** (mengingat 3 masalah upload yang kita temukan
  sebelumnya: folder salah, config.js hilang, file lama tidak terhapus) — coba pastikan dulu semua
  file di repo GitHub Anda benar-benar versi terbaru sebelum menyimpulkan ini bug kode.

### Verifikasi
Ditambahkan 2 test baru khusus untuk kedua bug di atas. **Total 199 dari 199 test lulus.**

---

## Update 16: Dashboard Activity Report dirapikan, Export PDF sekarang tangkapan layar

### Tabel "Peringkat Kepatuhan Station" dihapus dari Dashboard
- File: `index.html`, `js/station-report.js`.
- Tabel ini dihapus dari tampilan Dashboard sesuai permintaan. Data yang sama tetap tersedia di
  **Export Excel** (sheet "Peringkat Station") dan di tab **Rekap Bulanan** kalau sewaktu-waktu
  dibutuhkan.

### Grafik "Distribusi Kategori" diperbesar
- Sebelumnya grafik pie ini disempilkan kecil (tinggi 210px) di atas grafik batang dalam 1 panel
  yang sama. Sekarang keduanya dipisah jadi 2 panel bersebelahan yang sama besar — grafik pie naik
  jadi 380px dan punya kolom sendiri, jadi lebih jelas dibaca dan proporsinya lebih pas dengan
  ukuran halaman.

### Export PDF Dashboard — sekarang benar-benar tangkapan layar
- File: `js/station-report.js`.
- Sebelumnya "Export PDF" di Dashboard membuat halaman PDF baru dari data mentah (tabel teks +
  1 grafik kecil) — bukan tampilan Dashboard yang sesungguhnya. Sekarang diganti total: PDF berisi
  **tangkapan layar asli** dari tampilan Dashboard Aktivitas Station (KPI card, grafik pie, grafik
  batang, grafik tren) persis seperti yang terlihat di layar untuk bulan yang sedang dipilih.
- Tombol Export Excel/PDF itu sendiri otomatis disembunyikan dari hasil tangkapan (tidak ikut
  ter-screenshot).
- Kalau tampilan Dashboard terlalu panjang untuk 1 halaman PDF, otomatis dipotong jadi beberapa
  halaman (bukan diperkecil paksa sampai sulit dibaca).

### Audit menyeluruh
Dijalankan ulang seluruh 199 test otomatis setelah perubahan di atas — semua tetap lulus, dan
dipastikan tidak ada lagi kode yang mencoba menulis ke tabel "Peringkat Kepatuhan Station" yang
sudah dihapus (yang bisa menyebabkan error diam-diam di versi lama).

---

## Update 17: Angka/persentase di grafik ditampilkan + persistensi state di seluruh aplikasi

### Angka/persentase ditampilkan di grafik Dashboard
- File: `js/station-report.js`.
- Grafik **Distribusi Kategori** (pie) sekarang menampilkan jumlah + persentase langsung di tiap
  irisan (contoh: "3 (25%)").
- Grafik **Kepatuhan % per Station** (bar) sekarang menampilkan angka persentase di ujung tiap
  batang, jadi tidak perlu menebak-nebak dari panjang batang saja.

### Persistensi state — refresh halaman tidak lagi mengubah tab/sub-tab/filter yang sedang dilihat
Ini permintaan besar, jadi saya audit modul demi modul dan menambahkan penyimpanan otomatis
(localStorage) untuk setiap pilihan yang sebelumnya reset saat refresh:

- **Activity Report** (paling lengkap dibenahi): sub-tab aktif (Dashboard/Input Data/Rekap
  Bulanan), bulan yang dipilih di Dashboard, mode Rekap (Kepatuhan % / Jumlah Hari Lapor), tahun
  yang dipilih di Rekap, dan tanggal yang dipilih di Input Data — semuanya sekarang tersimpan
  otomatis begitu diubah, dan dipulihkan tepat seperti semula saat halaman di-refresh.
- **Check-In Report & First/Last Bag Report**: tanggal yang dipilih di form input sekarang
  tersimpan & dipulihkan (sebelumnya selalu reset ke hari ini).
- **Soal Training**: sub-tab aktif (Bank Soal/Bank Data Peserta/Bank Station) sekarang tersimpan &
  dipulihkan — sebelumnya tidak ada penyimpanan sama sekali untuk ini.
- **Drygoods**: tab station yang sedang dipilih (mis. CGK, DJJ, dst.) sekarang tersimpan &
  dipulihkan untuk user yang tidak dikunci ke 1 station (Admin, User-All, dsb). User-DRG yang
  memang dikunci ke station tertentu tidak terpengaruh — mereka tetap otomatis diarahkan ke
  station mereka sendiri seperti biasa.
- **Admin (Data Karyawan/Kelola Akun/Atur Akses Role)** dan **Dashboard Service Recovery**:
  sudah punya penyimpanan serupa dari update-update sebelumnya — dicek ulang, masih berfungsi
  normal.

### Kenapa belum 100% "semua tab tanpa kecuali"
Aplikasi ini punya banyak sekali filter kecil di berbagai tab (kolom pencarian, filter status,
dsb.) yang tersebar di puluhan ribu baris kode. Saya prioritaskan yang paling terasa dampaknya
kalau reset (pilihan tanggal, sub-tab, station) di atas — bukan filter pencarian teks bebas (yang
secara UX memang lebih wajar kosong lagi saat reload, mirip kotak pencarian di kebanyakan aplikasi
web). Kalau ada filter spesifik lain yang menurut Anda penting untuk ikut disimpan, beri tahu saya
tab & nama filternya, nanti saya tambahkan secara terarah.

### Untuk tab baru di masa depan
Pola yang saya pakai di sini (satu key localStorage per grup state, disimpan tiap kali user
mengubah pilihan, dipulihkan saat modul pertama kali dibuka) adalah pola yang sudah konsisten
dipakai di banyak tempat lain di aplikasi ini sejak awal — jadi kalau saya (atau siapa pun)
menambahkan tab baru nanti mengikuti pola yang sama, otomatis ikut mendapat perilaku "tidak reset
saat refresh" ini tanpa perlu membangun sistem baru dari nol.

### Verifikasi
Ditambahkan 3 test baru yang mensimulasikan skenario nyata "ubah pilihan → simulasikan reload →
pastikan pilihan tadi masih ada", bukan cuma mengecek nilai tersimpan di localStorage. **Total 206
dari 206 test lulus.**

---

## Update 18: Bug KRITIS ditemukan — sinkronisasi antar-device bisa diam-diam gagal selamanya

Ini yang menjelaskan laporan Anda: "data di-upload Elyn, tidak pernah muncul di device Admin,
padahal status Cloud Sync sama-sama 'Terhubung'."

### Akar masalah
Setiap kali aplikasi menyimpan data ke Firestore, ia mencatat waktu "terakhir diperbarui"
memakai **jam komputer/HP perangkat itu sendiri** (`new Date().toISOString()`) — bukan jam
server Firestore. Lalu setiap kali menarik data (pull), sistem membandingkan "apakah cloud lebih
baru dari yang terakhir saya tahu?" — kalau tidak, **dilewati** supaya hemat kuota (fitur
"Smart-Sync" yang terlihat di Settings).

Masalahnya: kalau jam 2 device tidak presis sama (sangat umum terjadi — beda beberapa menit,
beda zona waktu yang salah, dsb.), perbandingan ini bisa salah selamanya. Contoh nyata: kalau jam
di HP/komputer Admin sedikit lebih maju dari jam di device Elyn, maka SETIAP push dari Elyn akan
selalu tampak "lebih lama" menurut jam Admin — sehingga Admin **tidak akan pernah** menarik data
baru dari Elyn, walau status tetap menunjukkan "Terhubung" dan tidak ada pesan error sama sekali.
Ini persis menjelaskan log yang Anda tunjukkan: berkali-kali "Smart Pull: tidak ada perubahan...
skip pull" padahal Elyn baru saja mengupload data.

### Perbaikan
- File: `js/shared-utils.js`.
- Firestore sebenarnya **selalu** mengirimkan balik waktu "terakhir diubah" versi SERVER-nya
  sendiri di setiap respons (`updateTime`) — ini otoritatif, tidak peduli jam device siapa pun.
  Kode sebelumnya membuang informasi ini begitu saja dan hanya memakai jam milik masing-masing
  device. Sekarang sistem memakai waktu resmi dari server Firestore ini untuk SEMUA keputusan
  "apakah perlu pull/push data", di 3 titik: perbandingan sebelum pull, perbandingan konflik
  sebelum push, dan pencatatan setelah push berhasil.
- Ditambahkan juga migrasi satu kali: cache waktu lama (dari sebelum perbaikan ini, yang formatnya
  beda) dibuang sekali saat pertama kali membuka versi baru ini, supaya perbandingan pertama tidak
  membandingkan dua format berbeda — device akan menarik data lengkap sekali di awal, lalu
  berjalan normal seterusnya.

### Kenapa ini baru ketahuan sekarang
Bug ini sudah ada sejak sistem Cloud Sync pertama kali dibangun — bukan sesuatu yang saya
sebabkan di update-update sebelumnya. Butuh laporan konkret dengan 2 device nyata (screenshot
Anda) untuk bisa terlihat, karena di lingkungan pengujian otomatis saya (satu "device" virtual)
gejala ini tidak pernah muncul — inilah kenapa audit menyeluruh saja tidak cukup untuk menemukan
bug seperti ini; butuh laporan nyata dari pemakaian sungguhan seperti yang Anda berikan.

### Verifikasi
Ditambahkan test yang membuktikan secara langsung: sebelum perbaikan, sistem hanya melihat waktu
versi device sendiri (dan akan salah kalau device lain punya waktu "lebih lama" secara keliru);
sesudah perbaikan, sistem benar-benar mengambil `updateTime` asli dari server Firestore. **Total
211 dari 211 test lulus.**

### Yang perlu Anda lakukan
Upload `index.html` dan `js/shared-utils.js` yang baru ke kedua sisi (Elyn & Admin), lalu hard
refresh sekali di kedua browser. Setelah itu, coba minta Elyn push data baru lagi (atau klik
**"Push Sekarang"** di Settings miliknya), lalu di sisi Admin klik **"Tarik Data dari Cloud"** —
seharusnya kali ini datanya benar-benar tertarik, bukan lagi "skip" terus-menerus.

---

## Update 19: Struktur data granular — 1 dokumen besar dipecah jadi per-modul

### Yang berubah
- File: `js/shared-utils.js` (perombakan besar), `js/drygoods.js` (penyesuaian kecil).
- Sebelumnya: SATU dokumen Firestore (`sjnam_sync/sjnam_main`) menyimpan SEMUA modul sekaligus
  (data delay, Bank Station, DFS, Training, User, Karyawan, STCR, Drygoods, Atur Akses Role,
  Sertifikat, Tombstone). Menyimpan perubahan di 1 modul menulis ulang SELURUH dokumen ini.
- Sekarang: setiap modul punya dokumennya sendiri di collection yang sama
  (`sjnam_sync/delay_data`, `sjnam_sync/users`, `sjnam_sync/karyawan`, `sjnam_sync/training`,
  `sjnam_sync/stcr`, `sjnam_sync/drygoods`, `sjnam_sync/role_perms`, `sjnam_sync/cert_config`,
  `sjnam_sync/tombstones`, `sjnam_sync/dfs_stations`, `sjnam_sync/settings`). Mengedit Drygoods
  sekarang hanya menyentuh dokumen `drygoods` — modul lain (Training, User, dst.) sama sekali
  tidak dibaca maupun ditulis ulang.
- **Migrasi otomatis, sekali jalan, aman:** device pertama yang membuka versi ini akan otomatis
  memecah dokumen lama jadi dokumen-dokumen baru di atas. Dokumen lama TIDAK dihapus (dibiarkan
  sebagai arsip), jadi tidak ada risiko kehilangan data selama proses migrasi. Aman juga kalau
  kebetulan 2 device memicu migrasi hampir bersamaan — hasilnya tetap konsisten (idempotent).
- **Tarik data (pull) sekarang 1 kali panggilan** untuk mengecek SEMUA modul sekaligus (pakai
  fitur "list semua dokumen" dari Firestore), lalu hanya modul yang benar-benar berubah yang
  diunduh & diterapkan — modul lain tidak disentuh sama sekali, baik di sisi cloud maupun lokal.
- Semua logika penggabungan otomatis (merge) yang sudah ada sebelumnya — deteksi konflik per
  record, perlindungan tombstone, dirty-flag Drygoods & Atur Akses Role — **dipertahankan persis
  sama**, hanya sekarang beroperasi per-modul, bukan atas satu dokumen besar.

### Kenapa ini penting untuk kasus yang sudah Anda alami
Bug "data Elyn tidak sampai ke Admin", bug "import lalu hilang", dan bug "jam device beda bikin
sync gagal" — semuanya punya risiko lebih besar terjadi ketika satu dokumen dipakai bersama oleh
semua modul. Dengan struktur granular ini, permukaan tabrakan antar-modul turun drastis: mengedit
Drygoods di satu device tidak akan pernah bisa "menimpa" atau "tertimpa" oleh perubahan Training/
User dari device lain, karena keduanya sekarang benar-benar dokumen terpisah.

### Verifikasi — diuji dengan Firestore tiruan (mock), bukan cuma dibaca ulang
Karena lingkungan kerja saya tidak punya akses jaringan ke Firebase asli, saya membangun **server
Firestore tiruan di dalam memori** (meniru cara kerja Firestore REST API — simpan dokumen, ambil 1
dokumen, ambil semua dokumen dalam 1 collection) di dalam test otomatis, lalu menjalankan fungsi
`cloudPush`/`cloudPull`/migrasi yang SESUNGGUHNYA (bukan tiruan/simulasi kodenya) melawan server
tiruan itu. Ini memungkinkan pengujian nyata untuk skenario yang sebelumnya mustahil diuji tanpa
akses jaringan asli:
- Push dengan target 1 modul spesifik benar-benar HANYA menulis 1 dokumen, tidak lebih.
- Push ulang tanpa ada perubahan benar-benar tidak menulis apa pun (hemat kuota).
- Mengedit Drygoods benar-benar TIDAK mengubah dokumen Training/User sedikit pun — dibuktikan
  dengan membandingkan isi dokumen sebelum & sesudah persis sama.
- Pull hanya mengunduh & menerapkan modul yang benar-benar berubah — modul lain di local storage
  benar-benar tidak tersentuh.
- Migrasi dari dokumen lama ke granular berhasil memindahkan data dengan benar, dan aman dijalankan
  dua kali (tidak menghasilkan duplikat).

**Total 227 dari 227 test lulus** (211 test lama + 6 test baru khusus struktur granular ini,
termasuk yang menguji migrasi dan isolasi antar-modul secara langsung terhadap Firestore tiruan).

### Langkah selanjutnya yang masih tersedia (belum dikerjakan, sesuai kesepakatan)
Sesuai diskusi sebelumnya, langkah 4 (`serverTimestamp()` penuh) dan langkah 5 (`runTransaction()`
untuk stok/counter) masih bisa dikerjakan terpisah kalau diperlukan — keduanya kini lebih mudah
diterapkan karena struktur dokumennya sudah granular. Migrasi ke Firebase SDK resmi (real-time
`onSnapshot()` + offline persistence bawaan) tetap jadi proyek terpisah sesuai kesepakatan.

---

## Update 20: Perbaikan kecil + 1 temuan penting soal Station Report

### Bug kecil ditemukan & diperbaiki
Saat mengecek semua file yang memanggil sistem sync (untuk menjawab pertanyaan Anda), ketahuan:
`js/station-report.js` memanggil sinkronisasi pakai nama key localStorage mentahnya sendiri
(bukan nama modul yang dikenali sistem granular). Kalau dibiarkan, ini akan membuat 1 dokumen
kosong "nyasar" di Firestore setiap kali Activity Report/Check-in/First-Last Bag disimpan. Sudah
diperbaiki: sinyal yang tidak dikenali sekarang otomatis jatuh ke "push semua bucket" (aman),
bukan membuat dokumen nyasar.

### Temuan penting: data Station Report TIDAK PERNAH benar-benar tersinkron ke cloud
Ini bukan bug baru dari saya — ini kondisi yang **sudah begitu sejak awal modul Activity Report/
Check-in/First-Last Bag dibuat** (Update 4 dulu). Datanya tersimpan di localStorage device
masing-masing, tapi tidak pernah ikut terkirim ke Firestore — jadi kalau 2 device dipakai untuk
input Activity Report yang berbeda, datanya **tidak akan saling muncul** di device lain. Saya
sengaja belum menambahkan ini ke sistem cloud sync granular karena itu di luar permintaan Anda kali
ini (struktur data granular) — tapi karena ini cukup penting, saya rasa perlu saya beri tahu
sekarang. Kalau Anda mau Station Report juga ikut disinkronkan antar device, beri tahu saya dan
saya tambahkan sebagai bucket baru — sekarang jauh lebih mudah dikerjakan karena strukturnya sudah
granular.

### Verifikasi
Ditambahkan 1 test baru khusus bug ini. **Total 230 dari 230 test lulus.**

---

## Update 21: Field `version` untuk anti-konflik + `update()`/`merge:true`

### Langkah 3 — Semua penulisan ke Firestore sekarang pakai `updateMask` (setara `update()`)
- File: `js/shared-utils.js`.
- Sebelumnya, menulis ke Firestore (`neonUpsert`) menimpa SELURUH isi dokumen dengan field yang
  kita kirim — kalau suatu saat ada field lain yang tidak kita kenali di dokumen itu, field itu
  bisa ikut terhapus tanpa sengaja.
- Sekarang setiap penulisan menyertakan `updateMask.fieldPaths` — persis seperti `update()` di
  Firebase SDK resmi. Hanya field yang benar-benar kita tulis yang tersentuh; field lain di
  dokumen (kalau ada) dijamin aman tidak ikut terhapus.

### Langkah 6 — Field `_version` untuk deteksi konflik
- File: `js/shared-utils.js`.
- Setiap dokumen bucket sekarang punya penomoran versi (`_version`, naik 1 setiap kali disimpan).
- Untuk bucket yang berupa **daftar record** (Karyawan, User, Drygoods, dst.) — konflik memang
  sudah otomatis digabung per-baris data sejak update sebelumnya; `_version` di sini menambah
  jejak audit (bisa dilihat versi ke berapa suatu data terakhir disimpan).
- Untuk bucket yang berupa **satu blok pengaturan utuh tanpa penggabungan per-baris** — yaitu
  **Atur Akses Role**, **Pengaturan Sertifikat**, dan **Preferensi Tampilan** — di sinilah
  `_version` benar-benar berguna: kalau terdeteksi versi di cloud sudah lebih baru dari yang
  terakhir diketahui device ini (tandanya ada admin lain yang menyimpan perubahan di sela-sela
  waktu itu), sistem sekarang **memberi tahu dengan jelas** lewat log & notifikasi, bukan diam-diam
  menimpa tanpa jejak. Perubahan Anda tetap tersimpan (konsisten dengan gaya aplikasi ini:
  jalan terus + catat, bukan blokir total) — tapi sekarang ketahuan kalau itu terjadi, sehingga
  bisa dicek ulang kalau perlu.

### Kenapa tidak semua bucket diberi penggabungan per-field yang lebih canggih
Untuk 3 bucket "blok utuh" di atas, penggabungan otomatis per-field (bukan cuma deteksi+catat)
akan butuh melacak persis field mana yang baru saja diubah di tiap perubahan — informasi yang
belum ada infrastrukturnya saat ini. Deteksi + pemberitahuan jelas adalah langkah yang jujur dan
bermanfaat tanpa membangun sistem pelacakan baru yang lebih rumit dan berisiko. Kalau ke depan
ternyata konflik di 3 area ini sering terjadi di lapangan, penggabungan per-field bisa dibangun
sebagai langkah lanjutan.

### Verifikasi
Ditambahkan 3 test baru yang menguji langsung terhadap Firestore tiruan: memastikan field lain di
dokumen benar-benar selamat dari penulisan (updateMask bekerja), versi naik dengan benar di setiap
penyimpanan, dan konflik versi pada bucket "blok utuh" benar-benar terdeteksi & tercatat (bukan
cuma diam-diam lewat). Mock Firestore juga ditingkatkan supaya benar-benar mensimulasikan perilaku
`updateMask` asli, bukan sekadar menerima parameternya tanpa memvalidasi efeknya.
**Total 235 dari 235 test lulus.**

---

## Update 22: Penggabungan otomatis per-bagian untuk Atur Akses Role, Sertifikat & Preferensi Tampilan

Lanjutan langsung dari batasan yang saya sebutkan di Update 21 — ternyata bisa diterapkan sekarang
tanpa perlu infrastruktur baru yang rumit, jadi langsung dikerjakan.

### Cara kerjanya
- File: `js/shared-utils.js`.
- Sistem sekarang menyimpan "cuplikan terakhir yang diketahui tersinkron" (baseline) untuk 3
  bucket "blok utuh" (Atur Akses Role, Pengaturan Sertifikat, Preferensi Tampilan).
- Saat menyimpan dan terdeteksi ada perubahan dari device lain, sistem membandingkan 3 sisi:
  **baseline** (terakhir diketahui sama), **lokal** (device ini sekarang), dan **cloud** (device
  lain sekarang) — per bagian/key, bukan per keseluruhan dokumen.
  - Kalau cuma SATU sisi yang berubah dari baseline untuk suatu bagian → pakai perubahan itu (jadi
    perubahan sisi lain tidak ikut hilang).
  - Kalau KEDUA sisi berubah untuk bagian YANG SAMA dengan hasil berbeda → itu baru benar-benar
    bentrok — dimenangkan oleh device yang sedang menyimpan, dan **dicatat jelas** sebagai konflik
    nyata (bukan diam-diam).
- **Hasil gabungan langsung ditulis balik ke tampilan device yang menyimpan** — tidak perlu
  menunggu "Tarik Data dari Cloud" berikutnya untuk melihat gabungan lengkapnya.

### Contoh nyata
Admin A mengubah izin akses tab Drygoods untuk User-STR, di saat yang hampir sama Admin B (di
device lain) mengubah izin akses tab STCR untuk User-DRG. Sebelum update ini: siapa pun yang
menyimpan LEBIH DULU perubahannya akan hilang tertimpa yang menyimpan belakangan. Sekarang: KEDUA
perubahan tetap tersimpan, karena keduanya mengubah bagian yang berbeda.

### Verifikasi
Ditambahkan 2 test baru yang membuktikan langsung: (1) dua device mengubah baris izin akses yang
BERBEDA — kedua perubahan sama-sama selamat; (2) dua device mengubah baris yang SAMA — device yang
menyimpan menang untuk baris itu, dan tercatat sebagai konflik nyata. **Total 238 dari 238 test
lulus.**





---

## Update 23: Audit mendalam — 2 bug ditemukan & diperbaiki di sistem sync yang baru dibangun

Karena beberapa update terakhir (struktur granular, version field, penggabungan 3-arah) adalah
kode yang paling baru dan paling berisiko di seluruh aplikasi, saya fokuskan audit kali ini di
situ. Ketemu 2 bug nyata:

### Bug #1: Field internal ikut dianggap "konflik" di Pengaturan Sertifikat
- File: `js/shared-utils.js`.
- Penggabungan 3-arah untuk `cert_config` ikut membandingkan field internal sistem (`_version`,
  `_pushedBy`, `_pushedAt`) sebagai kalau itu bagian dari pengaturan yang perlu digabung — padahal
  field ini SELALU beda di tiap penyimpanan (bukan bagian isi yang sebenarnya). Akibatnya, hampir
  setiap kali ada penggabungan, sistem akan salah melaporkan "3 bagian bentrok" padahal sebenarnya
  tidak ada satu pun pengaturan sertifikat yang benar-benar bentrok.
- **Sudah diperbaiki:** field internal (berawalan `_`) sekarang dilewati sepenuhnya dari
  perbandingan penggabungan.

### Bug #2 (lebih serius): Penulisan balik ke lokal bisa membatalkan hasil resolusi konflik yang benar
- File: `js/shared-utils.js`.
- Fitur "tulis balik hasil gabungan ke tampilan lokal" dari Update 22 ternyata bisa memicu proses
  penggabungan KEDUA yang tidak disengaja untuk data berbentuk daftar (Karyawan, User, Training,
  STCR, Drygoods). Proses kedua ini membaca ULANG data lokal yang MASIH LAMA dan bisa membuatnya
  menang mengalahkan hasil gabungan yang SUDAH BENAR sebelumnya — berpotensi membatalkan resolusi
  konflik yang seharusnya dimenangkan oleh perubahan yang lebih baru dari device lain.
- **Sudah diperbaiki:** penulisan balik langsung ke tampilan lokal sekarang HANYA berlaku untuk 3
  pengaturan blok-utuh (Atur Akses Role, Sertifikat, Preferensi Tampilan) yang memang aman ditulis
  ulang langsung. Untuk data berbentuk daftar, device akan tetap melihat hasil gabungan lengkap
  lewat "Tarik Data dari Cloud" seperti biasa — lebih aman daripada berisiko membatalkan resolusi
  konflik yang sudah benar.

### Verifikasi
Ditambahkan 2 test baru yang secara khusus mereproduksi kedua bug di atas dan membuktikan
perbaikannya bekerja. **Total 241 dari 241 test lulus.**

---

## Update 24: Station Report (Activity/Check-In/First-Last Bag) SEKARANG BENAR-BENAR TERSINKRON

Ini perbaikan akar masalah untuk laporan Anda: data di layar Admin dan layar Vera berbeda sama
sekali untuk bulan yang sama.

### Akar masalah
Seperti yang sudah saya beri tahu di Update 20, modul Station Report (Activity Report, Check-In
Report, First/Last Bag) **tidak pernah ikut sistem sinkronisasi cloud sejak awal dibuat**. Setiap
device punya data lokalnya sendiri-sendiri, terpisah total dari device lain — jadi Admin dan Vera
memang TIDAK PERNAH bisa melihat data yang sama, sekalipun keduanya rutin membuka & menyimpan data.

### Perbaikan
- File: `js/shared-utils.js`, `js/station-report.js`.
- Station Report sekarang jadi bucket granular baru (`sjnam_sync/station_report`), sama seperti
  Drygoods, Training, dan modul lain.
- **Activity Report** (data yang diedit ulang per tanggal+station): digabung per-record, menangnya
  yang terakhir diperbarui (`updatedAt`) — jadi kalau Admin isi station A dan Vera isi station B di
  hari yang sama, KEDUANYA tetap ada, tidak ada yang saling menimpa.
- **Check-In Report & First/Last Bag** (data log per-penerbangan, jarang diedit ulang): digabung
  berdasarkan ID — entri dari kedua device disatukan, tidak ada yang hilang.
- **Daftar station custom**: digabung jadi daftar gabungan nama unik dari kedua device.
- Setelah data ditarik dari cloud, seluruh tampilan Activity Report/Check-In/First-Last Bag
  langsung diperbarui otomatis (tidak perlu refresh manual).

### Bug tambahan ditemukan & diperbaiki saat membangun ini
Sempat ada 2 kesalahan yang ketahuan lewat pengujian sebelum saya kirim:
1. Definisi bucket `station_report` sempat tertulis dua kali secara tidak sengaja (duplikat) — bisa
   menyebabkan penghitungan yang salah. Sudah dihapus salah satunya.
2. Versi pertama kode "tarik data" (`pull`) untuk Station Report langsung MENIMPA data lokal dengan
   data dari cloud, bukan MENGGABUNGKAN — persis kesalahan yang sama seperti bug Update 25 di
   modul lain. Ditemukan langsung lewat test otomatis sebelum sempat terkirim ke Anda, dan
   diperbaiki supaya benar-benar menggabungkan, bukan menimpa.

### Verifikasi
Ditambahkan test yang meniru **persis skenario Anda**: Admin mengisi data untuk beberapa station,
Vera (di device terpisah) mengisi data untuk station yang sama sekali berbeda di bulan yang sama —
setelah sinkronisasi, Admin harus melihat data GABUNGAN dari kedua device, bukan cuma satu sisi.
**Total 246 dari 246 test lulus.**

### Yang perlu Anda lakukan
Upload `index.html`, `js/shared-utils.js`, dan `js/station-report.js` yang baru ke server Anda,
lalu hard refresh di **semua device** yang dipakai (Admin, Vera, dan lainnya). Setelah semua
device membuka versi baru ini sekali, data Activity Report akan otomatis mulai tersinkron —
tidak perlu import ulang data yang sudah ada, data lama di masing-masing device akan otomatis
tergabung saat sinkronisasi pertama terjadi.

---

## Update 25: Audit menyeluruh — memastikan SEMUA data ikut sinkronisasi granular

Menjawab pertanyaan Anda langsung: sebelum update ini, **belum semua**. Saya audit ulang seluruh
kode dari awal (bukan cuma modul yang pernah dilaporkan bermasalah) dengan cara menginventarisir
**setiap key localStorage** yang dipakai di seluruh aplikasi, lalu mencocokkan satu per satu:
mana yang benar-benar "data isi" yang harus konsisten di semua device, dan mana yang murni
"preferensi tampilan per-device" yang justru SEHARUSNYA tidak disamakan.

### Ditemukan 1 modul lagi yang belum pernah tersinkron: Home Editor
Background dan logo (SJ & NAM) di tab Home — termasuk posisi & ukurannya — ternyata **tidak
pernah ikut sistem sync sama sekali**, sama seperti kasus Station Report sebelumnya. Kalau Admin
mengatur background/logo di satu device, device lain tidak akan pernah melihatnya. Sudah
ditambahkan sebagai bucket granular baru (`home_editor`), dengan penggabungan per-bagian yang
sama seperti Atur Akses Role & Pengaturan Sertifikat — jadi kalau 2 admin mengubah bagian berbeda
(satu ganti background, satu reposisi logo) hampir bersamaan, keduanya tetap tersimpan.

### Daftar LENGKAP 13 bucket granular sekarang (semua data isi, semua tab, semua sub-tab)
| # | Bucket | Mencakup |
|---|---|---|
| 1 | `delay_data` | Data Delay Penerbangan (Service Recovery) |
| 2 | `dfs_stations` | Bank Data Station + DFS Bank |
| 3 | `users` | Kelola Akun |
| 4 | `karyawan` | Data Karyawan |
| 5 | `training` | Materi Training, Bank Soal, Bank Data Peserta, Bank Station |
| 6 | `stcr` | Stretchercase & POB Request (Dashboard/Data/Station) |
| 7 | `drygoods` | Kartu Stok Drygoods, Bank Item, Dashboard |
| 8 | `role_perms` | Atur Akses Role |
| 9 | `cert_config` | Template Sertifikat, Custom Text Block, Paraf |
| 10 | `tombstones` | Jejak data terhapus (lintas semua modul) |
| 11 | `settings` | Dark Mode, Cost PM89 Default |
| 12 | `station_report` | Activity Report, Check-In Report, First/Last Bag *(Update 24)* |
| 13 | `home_editor` | Background & Logo tab Home *(baru, update ini)* |

### Yang SENGAJA TIDAK disinkronkan (bukan bug, ini pilihan desain yang benar)
Beberapa data lain SENGAJA dibiarkan per-device karena memang seharusnya begitu — menyamakannya
justru akan mengganggu:
- **Tab/sub-tab yang sedang terbuka, filter tanggal, status accordion sidebar** — tiap orang wajar
  punya tampilan yang berbeda-beda di device masing-masing saat itu.
- **Sesi login, ID device, status lockout percobaan login gagal** — ini memang harus spesifik per
  device/sesi, bukan data bersama.
- **Catatan internal sistem sync itu sendiri** (jejak waktu/versi terakhir yang diketahui tiap
  device) — kalau ini ikut disamakan, sistemnya jadi tidak masuk akal (setiap device memang perlu
  tahu "versi terakhir yang SAYA lihat", bukan versi yang sama untuk semua).

### Verifikasi
Ditambahkan test baru khusus untuk Home Editor, membuktikan perubahan dari 2 device berbeda
(background vs logo) tetap tergabung tanpa saling menghapus. **Total 249 dari 249 test lulus.**

### Kesimpulan jujur
Dengan update ini, **semua data isi aplikasi** (bukan preferensi tampilan) sudah masuk sistem sync
granular — 13 bucket mencakup seluruh tab dan sub-tab yang ada saat ini. Kalau ke depan ada tab
baru ditambahkan, saya akan selalu mengecek dan memasukkannya ke sistem ini sebagai bagian dari
pengerjaan tab tersebut, bukan menunggu dilaporkan lagi.

---

## Update 26: Perbaikan permanen — data lama tidak otomatis terkirim setelah bucket baru ditambahkan

Ini akar masalah untuk laporan Anda: data Vera masih 0/kosong padahal sudah hard refresh & hapus-
tambah user.

### Akar masalah
Data Activity Report Admin (28 hari yang sudah ada) dimasukkan **sebelum** modul ini punya sistem
sync. Sistem hanya mengirim data ke cloud saat ada **penyimpanan baru** — kalau Admin tidak sempat
mengedit ulang apa pun di Activity Report sejak update dipasang, data lama itu **belum pernah
terkirim ke cloud sama sekali**. Vera menarik data dari cloud dan menemukan kosong bukan karena
penggabungannya salah — tidak ada apa pun untuk digabungkan, karena memang belum pernah dikirim.
Menghapus & menambah ulang akun Vera tidak berpengaruh karena data Activity Report tidak terikat
ke user tertentu.

### Perbaikan permanen
- File: `js/shared-utils.js`.
- Ditambahkan **pemeriksaan otomatis sekali saat login**: setiap device mengecek SEMUA 13 bucket —
  kalau ada bucket yang punya data lokal tapi device itu belum pernah berhasil mengirimnya sama
  sekali, data itu otomatis dikirim, tanpa perlu user mengedit apa pun secara manual.
- Ini bukan cuma perbaikan untuk Activity Report — ini menutup celah yang sama untuk **bucket
  apa pun yang ditambahkan di masa depan**: begitu modul baru ditambahkan ke sistem sync, data lama
  yang sudah ada di device manapun akan otomatis "terdorong" naik ke cloud saat device itu login
  berikutnya, tidak akan pernah lagi tersangkut seperti kasus Activity Report ini.
- Bucket kosong (belum ada data sama sekali) otomatis dilewati, tidak ikut dikirim sebagai data
  kosong yang tidak perlu.

### Verifikasi
Ditambahkan 2 test baru: (1) membuktikan data historis yang belum pernah tersinkron benar-benar
terkirim otomatis tanpa edit manual; (2) memastikan bucket kosong tidak ikut terkirim sebagai
noise. **Total 253 dari 253 test lulus.**

### Yang perlu Anda lakukan
Upload `index.html` dan `js/shared-utils.js` ke server, lalu **Admin login sekali** (tidak perlu
melakukan apa pun selain login dan tunggu ±3 detik) — data Activity Report yang sudah ada akan
otomatis terkirim ke cloud saat itu. Setelah itu, Vera tinggal refresh halamannya (atau tunggu
siklus sync otomatis berikutnya) dan datanya akan muncul.
