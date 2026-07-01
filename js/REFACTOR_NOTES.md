# SJNAM Refactor — Tahap 1: Core/Auth

## Status: ✅ Selesai & teruji (40/40 assertion lulus)

## Yang dilakukan

Mengekstrak seluruh logika autentikasi, sesi, dan permission yang
sebelumnya tersebar di **10+ blok `<script>`** berbeda di `index.html`
(antara baris ~9049–10100, ~12990–13260, ~17420–18003, dan ~18377–18402)
menjadi satu modul bersih: `js/auth.js`.

## Bug yang ditemukan & diperbaiki

### 🔴 KRITIS — Backdoor password Master
Kode asli punya logic:
```js
if(userCandidate.role === 'Master' && password === 'Nu55y294gpx'){
  passwordOk = true; // bypass total, TIDAK peduli hash yang tersimpan
}
```
Artinya: siapa pun yang membaca source code (yang 100% terekspos karena
ini single-file HTML tanpa build step) bisa login sebagai **Master**
dengan password `Nu55y294gpx` **selamanya** — bahkan setelah Admin
mengganti password akun Master tersebut, karena kode ini sama sekali
tidak memeriksa hash yang tersimpan.

**Perbaikan:** bypass dihapus total. Role Master sekarang diverifikasi
dengan cara yang identik dengan role lain — selalu membandingkan
terhadap hash password yang tersimpan di `localStorage`.

**Tindakan wajib setelah deploy modul ini:** ganti password akun
`master` segera, karena hash lama (`73ce9bfb...`) adalah hash dari
password yang sudah pernah terekspos di riwayat kode/komentar.

### 🟡 Dead code — `applyPermissions` didefinisikan ulang 4x
Ditemukan bahwa `window.applyPermissions` di-assign ulang di 4 tempat:
- Baris ~9547 (definisi awal)
- Baris ~13227 (wrap yang benar — pakai `_origApplyPermissions`)
- Baris ~17493 (rewrite total — developer **secara eksplisit menyatakan**
  "menggantikan SEMUA override sebelumnya", bukan wrap)
- Baris ~17963 dan ~18382 (wrap yang benar di atas hasil 17493)

**Konsekuensi:** definisi pertama (9547) dan kedua (13227) **tidak
pernah benar-benar berjalan** di production — keduanya didefinisikan,
lalu langsung ditimpa total sebelum user pertama login. ~250 baris
kode mati yang membingungkan siapa pun yang mencoba debug permission.

**Perbaikan:** hanya logic final (unified + 2 hook yang sah) yang
dipertahankan di `auth.js`, dikonsolidasi jadi satu fungsi
`applyPermissions()` + helper `_afterApplyPermissions()`.

### 🟡 `window.switchTab` didefinisikan ulang 3x
Pola serupa ditemukan untuk `switchTab` (baris ~5657, ~10878, ~13633,
~16809). **Belum ditangani di tahap ini** — akan dikonsolidasi saat
modul UI/Tab-Navigation diekstrak (tahap berikutnya).

### 🟢 Minor — kredensial default tanpa flag wajib ganti password
Versi asli punya 5 akun default dengan kredensial yang tertulis di
source code, tapi tidak ada mekanisme yang memaksa pergantian password
di first-login untuk SEMUA akun (hanya ada infrastruktur
`mustChangePassword` tapi tidak diset `true` secara default).
**Diperbaiki:** semua user default sekarang lahir dengan
`mustChangePassword: true`.

## Hasil pengujian virtual (jsdom + Node webcrypto)

| # | Skenario | Hasil |
|---|----------|-------|
| 1 | Default users ter-seed dengan benar | ✅ |
| 2 | Password lama Master tidak lagi bisa login setelah password diganti | ✅ |
| 3 | Login salah → counter brute-force bertambah | ✅ |
| 4 | Lockout otomatis setelah 5x gagal | ✅ |
| 5 | Login sukses dengan password yang benar (hash custom) | ✅ |
| 6 | Admin mendapat akses penuh ke semua tab | ✅ |
| 7 | Role tak dikenal → fail-closed (semua tab tersembunyi) | ✅ |
| 8 | User non-aktif (`active:false`) tidak bisa login | ✅ |
| 9 | Logout membersihkan sesi & currentUser | ✅ |
| 10 | Sesi dipulihkan otomatis saat reload (tanpa re-login) | ✅ |
| 11 | Pemetaan nama role → permission key | ✅ |
| 12 | `getUserStation` hanya berlaku untuk role station-bound | ✅ |

**Total: 40 assertion, 40 lulus, 0 gagal.**

## Cara menjalankan ulang test ini

```bash
cd sjnam-refactor
npm install
node test/run-auth-tests.js
```

## File yang dihasilkan tahap ini

- `js/auth.js` — modul Core/Auth (lengkap, siap pakai)
- `test/fixture.html` — DOM minimal untuk simulasi browser
- `test/run-auth-tests.js` — 12 skenario / 40 assertion otomatis

## Yang BELUM diekstrak (tahap selanjutnya)

- `window.switchTab` (tab navigation) — punya pola "redefinisi 3x" yang
  sama, perlu dikonsolidasi seperti `applyPermissions`
- Modul Service Recovery, STCR, Training, Dry Goods
- Modul sinkronisasi cloud (Supabase: `cloudPush`, `cloudPull`,
  `triggerAutoSync`, `markDirty`) — saat ini di-stub sebagai
  `typeof X === 'function'` guard di `auth.js` agar tidak error saat
  modul tersebut belum ada
- Modul manajemen user (tabel user, tambah/edit/hapus role,
  ganti password) — saat ini hanya `saveUsers()` yang diekstrak,
  render tabel & modal CRUD masih ada di file asli

## Cara integrasi ke index.html (saat siap)

Ganti seluruh blok `<script>` terkait auth (baris-baris yang disebut
di atas) dengan satu baris:
```html
<script src="js/auth.js"></script>
```
Pastikan dimuat **setelah** elemen DOM (`loginForm`, `sidebar`, dst)
ada di halaman, dan **sebelum** modul lain yang memanggil
`window.applyPermissions` atau `window.currentUser`.

---

# Tahap 1b — Integrasi ke index.html ✅ Selesai & teruji

## Status: ✅ Terintegrasi (15/15 assertion integrasi lulus + 40/40 unit)

`js/auth.js` sudah diintegrasikan ke `dist/index.html`. File hasil
integrasi: **18.438 baris → 15.915 baris** (pengurangan ~2.500 baris
dari kode mati/duplikat yang dihapus).

## Yang dilakukan saat integrasi

1. Blok auth asli (baris ~9049–11081 di file asli) diganti dengan
   `<script src="js/auth.js"></script>`.
2. Blok "FEATURE 1: ADMIN PERMISSION RULES" (CUSTOM_ROLES/FEATURES/
   PERM_KEY/roleNameToKey/getPerms/savePerms — semua duplikat dari
   auth.js) dihapus; kode UI-nya (`renderPermTable`, tombol Simpan/
   Reset, switch sub-tab Admin) **dipertahankan** tapi sekarang memakai
   `window.CUSTOM_ROLES`, `window.PERM_FEATURES`, `window.getRolePerms`,
   dll — referensi ke export dari auth.js, bukan duplikat lokal.
3. Blok "PATCH ARSITEKTUR v3.0" — P1 (`getUserStation`), P2
   (`_applyStationLockForUser`), dan P3 (`applyPermissions` unified)
   dihapus karena sudah identik dengan yang ada di auth.js. P4–P12
   (filter Service Recovery, password hash interceptor, dll — modul
   lain yang BELUM diekstrak) **dipertahankan utuh**, tidak disentuh.
4. Wrapper P13 (STCR filter post-permission) dan FEAT-6+7 (contract
   expiry + station display post-permission) dihapus — keduanya sudah
   diserap ke `_afterApplyPermissions()` di auth.js.

## Bug baru ditemukan SAAT integrasi (bukan disebabkan oleh refactor ini)

### 🔴 Race condition tersembunyi: `_dirtyModules` TDZ
Saat menjalankan integration test penuh (bukan cuma test modul auth
terisolasi), ditemukan bahwa **kode asli sebelum refactor ini pun
punya bug laten serupa** dengan yang developer sebelumnya sudah pernah
perbaiki untuk variabel lain. `_dirtyModules` dideklarasikan dengan
`const` di baris ~7945, tapi `saveStations()` — yang memanggil
`markDirty()` yang butuh `_dirtyModules` — bisa terpanggil di baris
~1821, JAUH SEBELUM baris 7945 tereksekusi. Ini memicu
`ReferenceError: Cannot access '_dirtyModules' before initialization`
yang **membatalkan seluruh eksekusi script secara diam-diam** pada
load pertama.

Komentar developer sebelumnya di baris ~7239 ("FIX: pre-declare
cloud-sync state...") menunjukkan mereka SUDAH menemukan & memperbaiki
pola bug yang sama persis untuk variabel lain (`_cloudPullInProgress`,
`cloudConfig`, dst — diubah dari `let`/`const` ke `var` dan
dideklarasikan lebih awal) — tapi melewatkan `_dirtyModules`.

**Perbaikan:** mengikuti pola yang sama, `_dirtyModules` sekarang
`var` dan dideklarasikan di blok pre-declare yang sama (awal file),
bukan di lokasi aslinya yang terlalu jauh ke bawah.

**Mengapa ini baru ketemu sekarang:** test suite Tahap 1 (auth.js
terisolasi) tidak akan pernah menemukan bug ini karena ia menguji
auth.js sendirian dengan DOM fixture minimal — bug ini ada di kode
TIDAK TERKAIT auth (`saveStations`, modul Station) yang HANYA muncul
saat menjalankan test integrasi penuh terhadap dokumen HTML
sebenarnya. Ini menegaskan pentingnya melakukan test integrasi penuh
setelah setiap tahap ekstraksi modul, bukan hanya test modul yang
baru diekstrak.

## Hasil pengujian integrasi (jsdom, dokumen HTML penuh)

| # | Skenario | Hasil |
|---|----------|-------|
| 1 | Semua global auth (`applyPermissions`, `checkAuth`, dst) terdefinisi setelah load penuh | ✅ |
| 2 | Default users ter-seed dalam konteks dokumen nyata | ✅ |
| 3 | Login end-to-end berhasil (form submit → currentUser → UI update) dalam dokumen nyata | ✅ |
| 4 | `renderPermTable` (kode UI yang dipertahankan) berjalan tanpa error memakai export dari auth.js | ✅ |
| 5 | Delegasi logout sidebar→tombol utama tidak double-fire (fix dari Tahap 1) | ✅ |
| 6 | Tidak ada runtime error tak terduga dari kode sendiri di seluruh proses load+login+logout | ✅ |

**Total: 15 assertion integrasi, 15 lulus + 40 assertion unit, 40 lulus = 55/55.**

## Cara menjalankan ulang kedua test ini

```bash
cd sjnam-refactor
npm install
node test/run-auth-tests.js              # 40 assertion, modul auth.js terisolasi
node test/run-integration-smoke-test.js   # 15 assertion, dokumen HTML penuh
```

## File hasil integrasi

- `dist/index.html` — file utama hasil integrasi (siap pakai/deploy)
- `dist/js/auth.js` — modul auth (sama isinya dengan `js/auth.js`)
- `test/run-integration-smoke-test.js` — test integrasi dokumen penuh

## Catatan penting sebelum deploy

1. **Ganti password akun `master` segera** (lihat Tahap 1 — backdoor
   plaintext sudah dihapus, tapi hash default masih hash dari password
   yang sudah pernah terekspos).
2. Pastikan `dist/js/auth.js` ikut diupload ke server bersama
   `dist/index.html` — keduanya saling bergantung.
3. Modul lain (Service Recovery P4–P12, Training, STCR, Drygoods)
   masih dalam bentuk asli di `index.html` — belum diekstrak. Mereka
   tetap berfungsi penuh, hanya belum dipecah jadi file terpisah.

---

# Tahap 3 — shared-utils.js & service-recovery.js

## Status: ✅ Selesai & teruji (112/112 assertion lulus: 49 unit + 63 integrasi)

## Ringkasan

`index.html`: **18.438 → 12.304 baris** (turun ~33%). Modul baru:
- `js/shared-utils.js` (1.500 baris) — DOM helpers, formatting, toast/
  confirm, dark mode, dan SELURUH layer cloud-sync Supabase
- `js/service-recovery.js` (2.380 baris) — business logic inti: form
  wizard, render tabel/dashboard, DFS Bank, stations, request/approval

## ⚠️ Temuan keamanan: kredensial Supabase

Kredensial (URL + anon key) sebelumnya disamarkan base64 di
`index.html` — bukan enkripsi, siapa pun bisa `atob()` dalam hitungan
detik. Dipindahkan ke `shared-utils.js` sebagai string literal (jujur,
bukan disamarkan ulang) dengan peringatan keras di komentar.
**Tindakan wajib di sisi Anda (TIDAK bisa diselesaikan dari kode):**
1. Rotate anon key di dashboard Supabase Anda
2. Pastikan Row Level Security (RLS) aktif di semua tabel terkait
3. Ganti `DEFAULT_SUPABASE_URL`/`DEFAULT_SUPABASE_KEY` di
   `shared-utils.js` setelah key baru tersedia

## Bug pada KODE ASLI yang ditemukan & diperbaiki

### 🔴 Race condition: `saveStations()` dipanggil sebelum terdefinisi
Saat percobaan integrasi pertama, ditemukan `saveStations is not
defined` — blok "DEFAULT STATIONS" (jalan otomatis saat localStorage
kosong/install pertama) memanggil `saveStations()` secara sinkron,
tapi fungsinya sempat diletakkan di posisi yang lebih belakang dalam
dokumen. **Akibat di kode ASLI (sebelum refactor ini)**: tidak masalah
karena semuanya satu blok `<script>` yang sama dan urutan internalnya
sudah benar — tapi proses ekstraksi modul SAYA sendiri yang sempat
memecah urutan ini secara salah (lihat bagian "Bug yang saya
perkenalkan sendiri" di bawah).

## Bug yang SAYA perkenalkan sendiri saat refactor (dan perbaikannya)

Bagian ini didokumentasikan secara terbuka karena prosesnya melibatkan
beberapa kesalahan nyata yang baru ketahuan lewat testing — bukan untuk
menyembunyikan, tapi supaya jejak audit lengkap.

### 1. Implementasi `showToast`/`showConfirm`/`updateClock`/Error-Log-Modal yang SALAH
Saat menulis `shared-utils.js` Part 1 di awal Tahap 3, fungsi-fungsi
ini ditulis ulang dari asumsi/ingatan alih-alih disalin persis dari
source — hasilnya memakai ID elemen HTML yang **tidak pernah ada** di
halaman (`#confirmOverlay` padahal yang asli `#confirmModal`,
`#clockUTC`/`#clockLocal` padahal yang asli `#clockWib`/`#clockUtc`,
modal error log diasumsikan statis padahal aslinya dibuat dinamis lewat
`insertAdjacentHTML`). **Ditemukan saat audit silang sebelum ekstraksi
service-recovery.js** (membandingkan baris-per-baris terhadap source
asli) — bukan lewat test otomatis, yang menegaskan pentingnya audit
manual selain testing. Semua diganti dengan implementasi asli yang
sudah diverifikasi sama persis dengan source.

### 2. `applyDarkMode()` kehilangan logic toggle icon
Versi tulis-ulang saya tidak menyertakan toggle `#iconDark`/`#iconLight`
yang ada di versi asli. Ditemukan & diperbaiki di audit yang sama.

### 3. Race condition baru akibat split file: `saveStations`/`todayLocalStr`/dst
Setelah `service-recovery.js` diekstrak sebagai file terpisah, blok
"DEFAULT STATIONS" dan blok "INIT" (keduanya jalan otomatis/sinkron
saat halaman dimuat) memanggil fungsi-fungsi yang sekarang berada di
`shared-utils.js` — yang harus dimuat lebih dulu agar tersedia.
Awalnya `service-recovery.js` dimuat SEBELUM `shared-utils.js` (logis
karena `service-recovery.js` mendefinisikan `STORAGE_KEY`/`data`/dkk
yang dibutuhkan `shared-utils.js`), tapi ini menyebabkan
`todayLocalStr is not defined` dkk. **Diperbaiki dengan menukar urutan
load**: `shared-utils.js` dimuat LEBIH DULU, baru `service-recovery.js`
— aman karena pembacaan variabel lintas `<script>` tag bekerja via
scope chain terlepas dari urutan definisi (selama dipanggil belakangan,
bukan saat parse), sementara fungsi `shared-utils.js` butuh dipanggil
segera oleh blok INIT.

### 4. Bug TERSEMBUNYI akibat fix #3: `cloudConfig` tertimpa balik ke kosong
Setelah menukar urutan load, blok "pre-declare cloud-sync state"
(`var cloudConfig = {supabaseUrl:'', supabaseKey:''}`, dkk) yang
masih tersisa di `service-recovery.js` MENIMPA BALIK nilai URL/key
Supabase yang benar yang baru saja di-set oleh `shared-utils.js` —
karena sekarang `service-recovery.js` jalan SETELAH `shared-utils.js`.
Ini adalah bug yang sangat mudah lolos tanpa test eksplisit (tidak
menyebabkan error, hanya diam-diam membuat cloud sync tidak pernah
benar-benar terhubung). **Ditemukan lewat test integrasi baru** yang
secara eksplisit memverifikasi `cloudConfig.supabaseUrl` bukan string
kosong setelah load penuh. Diperbaiki dengan menghapus blok pre-declare
yang sudah redundan dari `service-recovery.js` (hanya `_dirtyModules`
yang tetap perlu di sana, karena `shared-utils.js` tidak pernah
mendeklarasikannya sendiri).

### 5. Bug penghapusan tidak sengaja: `saveData`/`saveStations`/`saveDfsData` + DEFAULT STATIONS sempat hilang total
Saat proses dekonflik duplikat fungsi sebelum ekstraksi, saya sempat
menghapus blok `saveData`/`saveStations`/`saveDfsData` + "DEFAULT
STATIONS" dari working file dengan asumsi keduanya akan "tetap di
index.html" — padahal setelah keputusan akhir untuk mengekstrak
SELURUH blok Service Recovery jadi satu file, blok ini seharusnya ikut
pindah, bukan dihapus dari kedua tempat. **Ditemukan lewat test
integrasi** (`window.dfsData`/`window.stations` kosong, default
stations tidak ter-persist). Diperbaiki dengan mengembalikan blok
lengkap (termasuk 100 data bandara default) ke `service-recovery.js`,
diambil ulang dari file asli yang diupload agar akurat 100%.

## Pelajaran untuk modul berikutnya (STCR/Training/Drygoods)

- **Jangan menulis ulang fungsi dari ingatan.** Selalu salin persis dari
  source, lalu cocokkan ID elemen HTML terhadap markup asli sebelum
  dianggap selesai.
- **Urutan load lintas file itu nyata dan mudah salah.** Setiap kali ada
  blok kode yang jalan otomatis/sinkron saat load (bukan di dalam
  fungsi yang dipanggil belakangan), telusuri SEMUA fungsi yang
  dipanggilnya secara transitif, dan pastikan semuanya sudah
  terdefinisi di titik itu.
- **Pre-declare/workaround lama bisa jadi berbahaya setelah refactor.**
  Variabel yang sengaja dideklarasikan `var` di awal dokumen untuk
  menghindari TDZ (race condition) pada kode ASLI bisa jadi sumber bug
  baru (overwrite tak sengaja) setelah modul dipisah — selalu audit
  ulang blok seperti ini saat urutan load berubah.
- **Test integrasi level dokumen-penuh tidak tergantikan.** Beberapa
  bug di atas (terutama #4 dan #5) TIDAK akan pernah ketahuan dari
  test unit modul yang terisolasi — hanya muncul saat seluruh dokumen
  dijalankan bersamaan dengan urutan asli.

## Hasil pengujian (kumulatif, semua tahap)

| Suite | Assertion | Status |
|-------|-----------|--------|
| `run-auth-tests.js` (unit, auth.js terisolasi) | 49 | ✅ 49/49 |
| `run-integration-smoke-test.js` (dokumen HTML penuh) | 63 | ✅ 63/63 |
| **Total** | **112** | **✅ 112/112** |

## Cara menjalankan ulang

```bash
cd sjnam-refactor
npm install
node test/run-auth-tests.js
node test/run-integration-smoke-test.js
```

## File hasil Tahap 3

- `dist/index.html` — 12.304 baris (turun dari 18.438)
- `dist/js/shared-utils.js` — utilitas + cloud-sync (1.500 baris)
- `dist/js/service-recovery.js` — business logic SR (2.380 baris)
- `dist/js/auth.js` — tidak berubah dari Tahap 1-2

**Urutan load WAJIB di index.html:**
```html
<script src="js/shared-utils.js"></script>
<script src="js/service-recovery.js"></script>
<script src="js/auth.js"></script>
```

## Yang BELUM diekstrak

- Modul STCR, Training, Drygoods — masih bentuk asli di `index.html`
- Modul manajemen user (tabel CRUD, render, modal) — render-side masih
  di `index.html`, hanya logic inti (`saveUsers`, dll) sudah di `auth.js`

---

# Tahap 4 — Training & STCR

## Status: ✅ Selesai & teruji (129/129 assertion lulus: 49 unit + 80 integrasi)

## Ringkasan

`index.html`: **18.438 → 9.485 baris (turun ~49%, hampir setengah)**.
2 modul baru:
- `js/training.js` (1.544 baris) — materi, bank soal, peserta, wizard
  quiz, sertifikat (generate/download/email)
- `js/stcr.js` (1.322 baris) — StretcherCase & POB (Person on Board),
  dibungkus rapi dalam `window.STCR` (desain asli sudah baik)

## Temuan saat pemetaan: kesalahan batas STCR (ditemukan & diperbaiki sebelum ekstraksi)

Saat menelusuri batas modul STCR, ditemukan bahwa satu blok `<script>`
di file asli ternyata berisi **tiga modul berbeda** digabung tanpa
pemisah `<script>`: STCR (baris ~6270–7565), lalu "Custom Text Blocks"
dan sebagian "Certificate Template Builder" (tidak terkait STCR sama
sekali) menyambung tanpa jeda di baris berikutnya. Percobaan ekstraksi
pertama salah menebak batas akhir STCR (memakai closing brace IIFE
ketiga, bukan yang pertama) — yang akan menyeret 2 modul lain ikut
masuk ke `stcr.js`. **Ditemukan sebelum file final ditulis**, lewat
pengecekan silang fungsi-fungsi yang diekstrak (`window.ctbRenderAll`
muncul di hasil ekstraksi STCR — jelas bukan milik STCR). Diperbaiki
dengan menelusuri ulang posisi closing brace `})();` yang benar
(ada 3 closing brace dalam rentang yang diperiksa, hanya yang pertama
milik STCR).

## Karakteristik desain modul (lebih baik dari Service Recovery)

Berbeda dari Service Recovery (Tahap 3), Training dan STCR keduanya:
- Sudah dibungkus IIFE sejak awal (tidak ada variabel bocor ke scope global secara tidak sengaja)
- `init()`/render awal selalu dipanggil via `DOMContentLoaded` listener
  atau `setTimeout`, BUKAN sinkron saat parse — sehingga TIDAK rentan
  terhadap race condition "fungsi dipanggil sebelum modul lain yang
  dibutuhkannya selesai dimuat" (kelas bug yang berulang kali muncul
  di Tahap 3)
- Semua pemanggilan fungsi lintas-modul (`triggerAutoSync`, `showToast`,
  `cloudPush`, dst.) sudah di-guard dengan `typeof X === 'function'`
  di kode asli

Akibatnya: **tidak ada bug race-condition baru yang ditemukan** pada
ekstraksi tahap ini — kontras dengan Tahap 3 yang menemukan beberapa.

## Hasil pengujian (kumulatif, semua tahap)

| Suite | Assertion | Status |
|-------|-----------|--------|
| `run-auth-tests.js` (unit) | 49 | ✅ 49/49 |
| `run-integration-smoke-test.js` (dokumen penuh) | 80 | ✅ 80/80 |
| **Total** | **129** | **✅ 129/129** |

## File hasil Tahap 4

- `dist/index.html` — 9.485 baris (turun dari 18.438, ~49%)
- `dist/js/training.js` — modul Training (1.544 baris)
- `dist/js/stcr.js` — modul STCR (1.322 baris)

**Urutan load lengkap di index.html (final):**
```html
<script src="js/stcr.js"></script>
<script src="js/training.js"></script>
<script src="js/shared-utils.js"></script>
<script src="js/service-recovery.js"></script>
<script src="js/auth.js"></script>
```

## Yang BELUM diekstrak

- Modul Drygoods (Kartu Stok & IFS Station)
- "Bank Station Sync" (IIFE kedua Training, masih tercampur kode admin/audit)
- Certificate Template Builder & Custom Text Blocks
- Modul manajemen user (tabel CRUD render-side)

---

# Tahap 5 — Drygoods

## Status: ✅ Selesai & teruji (132/132 assertion lulus: 49 unit + 83 integrasi)

## Ringkasan

`index.html`: **18.438 → 7.817 baris (turun ~58%, lebih dari setengah)**.
1 modul baru: `js/drygoods.js` (1.700 baris) — Kartu Stok, IFS Station,
transaksi, bank item, dashboard, notifikasi kontrak akan habis.

## Temuan penting: ketergantungan urutan load yang kritis

Drygoods membungkus (wrap) `window.switchTab` — bagian terakhir dari
rantai yang sudah didokumentasikan sejak Tahap 1-2: **base
(service-recovery.js) → permission-gate (auth.js) → Enhanced-features
(index.html) → Drygoods**. Karena itu, `js/drygoods.js` **WAJIB
dimuat SETELAH `js/auth.js`** di `<script>` tag — jika terbalik, modul
ini akan membungkus versi `switchTab` yang BELUM punya permission-gate,
mengembalikan persis bug regresi yang ditemukan & diperbaiki di
Tahap 2.

Urutan saat ini di `index.html` sudah benar (Drygoods secara alami
berada setelah auth.js di dokumen asli), dan test integrasi baru
[18] secara eksplisit memverifikasi rantai ini tetap utuh dengan
Drygoods di dalamnya — bukan cuma percaya pada urutan baris, tapi
benar-benar menguji bahwa role yang di-deny lewat rolePerms tetap
terblokir meskipun melewati 4 lapis wrapper.

## Pemetaan batas: pelajaran dari STCR diterapkan

Belajar dari insiden STCR (Tahap 4) di mana batas modul sempat salah
tebak dan hampir menyeret modul lain, kali ini batas Drygoods
diverifikasi dulu dengan mencari SEMUA closing brace `})();` dalam
rentang yang dicurigai sebelum menulis file final. Ditemukan: blok
`<script>` yang sama juga berisi modul "HOME TAB: Logo & Background
Editor" yang menyambung tanpa pemisah setelah Drygoods — batas yang
benar (baris ~6870–8537) dikonfirmasi sebelum ekstraksi, bukan
ditemukan setelah file ditulis salah.

## Karakteristik desain modul

Sama seperti Training/STCR (bukan seperti Service Recovery): sudah
IIFE sejak awal, tidak ada pemanggilan sinkron tak ter-guard ke fungsi
shared-utils.js, fungsi internal (`renderDgTrx`, `buildStationTabs`,
dst.) sengaja TIDAK diekspos ke `window` — hanya bisa diakses lewat
wrapper `switchTab` atau event listener internal. Helper seperti
`getBankStationList()`/`getKaryawanList()` membaca `localStorage`
langsung, bukan bergantung pada variabel `window.stations` milik
modul lain — menghindari isu cross-script-tag yang pernah ditemukan
di Tahap 3.

## Hasil pengujian (kumulatif, semua tahap)

| Suite | Assertion | Status |
|-------|-----------|--------|
| `run-auth-tests.js` (unit) | 49 | ✅ 49/49 |
| `run-integration-smoke-test.js` (dokumen penuh) | 83 | ✅ 83/83 |
| **Total** | **132** | **✅ 132/132** |

## File hasil Tahap 5

- `dist/index.html` — 7.817 baris (turun dari 18.438, ~58%)
- `dist/js/drygoods.js` — modul Drygoods (1.700 baris)

**Urutan load lengkap di index.html (final, WAJIB urutan ini):**
```html
<script src="js/shared-utils.js"></script>
<script src="js/service-recovery.js"></script>
<script src="js/auth.js"></script>
<script src="js/training.js"></script>
<script src="js/stcr.js"></script>
<script src="js/drygoods.js"></script>
```

## Yang BELUM diekstrak

- "Bank Station Sync" (IIFE kedua Training, masih tercampur kode admin/audit di index.html)
- Certificate Template Builder & Custom Text Blocks
- "HOME TAB: Logo & Background Editor"
- Modul manajemen user (tabel CRUD render-side)

---

# Tahap 6 — Certificate Template Builder, Custom Text Blocks, Home Tab Editor

## Status: ✅ Selesai & teruji (143/143 assertion lulus: 49 unit + 94 integrasi)

## Ringkasan

`index.html`: **18.438 → 7.024 baris (turun ~62%, hampir dua pertiga)**.
2 modul baru:
- `js/certificate-builder.js` (630 baris) — gabungan 2 sub-modul yang
  sebelumnya tersambung tanpa pemisah `<script>` di file asli: Custom
  Text Blocks (CTB) dan Certificate Field Styling
- `js/home-editor.js` (200 baris) — editor logo & background Home

## ⚠️ Insiden: regresi yang saya perkenalkan SENDIRI di sesi ini, ditemukan & diperbaiki sebelum diserahkan

Saat menyusun ulang blok `<script>` untuk menyisipkan referensi
`certificate-builder.js` dan `home-editor.js`, saya menghapus seluruh
rentang baris dari akhir `stcr.js` sampai awal "PATCH ARSITEKTUR v3.0"
— dengan asumsi rentang itu HANYA berisi konten 2 modul yang sedang
diekstrak. Asumsi ini salah: rentang tersebut juga berisi
**`<script src="js/drygoods.js">`** (referensi eksternal ke modul
Drygoods dari Tahap 5), yang posisinya ada di UJUNG rentang
(setelah Home Tab Editor) — bukan konten Drygoods itu sendiri,
hanya tag referensinya. Tag itu ikut terhapus tanpa disadari.

**Cara ditemukan:** test integrasi (`run-integration-smoke-test.js`)
melempar error eksplisit saat mencoba meng-inline `drygoods.js` untuk
pengujian — `inlineScript()` sengaja dirancang untuk melempar error
keras (bukan diam-diam gagal) jika tag yang dicari tidak ditemukan,
persis untuk menangkap kasus seperti ini. Tanpa pengecekan eksplisit
tersebut, bug ini kemungkinan besar akan lolos tanpa terdeteksi
sampai seseorang benar-benar membuka tab Drygoods di browser dan
mendapati seluruh fitur tidak berfungsi — karena syntax check murni
("apakah ini JavaScript valid?") tidak akan pernah menangkap "fungsi
yang dibutuhkan ada di file yang TIDAK PERNAH DIMUAT sama sekali".

**Perbaikan:** referensi `<script src="js/drygoods.js">` dikembalikan
ke posisi yang benar (tetap setelah `home-editor.js`, sebelum PATCH
ARSITEKTUR — sama seperti urutan aslinya), lalu ditambahkan test
regresi eksplisit [19] yang mendokumentasikan insiden ini secara
permanen dalam test suite.

**Pelajaran:** saat menghapus rentang baris untuk diganti dengan
referensi modul baru, SELALU cek dulu apakah ada `<script src="...">`
LAIN (bukan cuma konten inline) yang kebetulan berada di rentang yang
sama — terutama untuk rentang yang sudah pernah dimodifikasi di tahap
sebelumnya. `grep -n 'src="js/'` sebelum dan sesudah setiap splice
sekarang jadi langkah wajib, bukan opsional.

## Temuan struktural: wrapping chain certificate kedua

Ditemukan rantai wrapping serupa `switchTab` tapi untuk
`renderCertificate`/`loadCertificateTemplate`: base (training.js) →
wrapper (certificate-builder.js, untuk re-render Custom Text Blocks
setiap kali sertifikat di-render ulang). Wrapping ini AMAN terlepas
urutan load yang tepat karena dipanggil via `DOMContentLoaded`/
`setTimeout` (bukan sinkron) dan di-guard `typeof` — tapi tetap
didokumentasikan eksplisit di header file agar urutan logis
(training.js sebelum certificate-builder.js) dipertahankan untuk
koherensi.

## Hasil pengujian (kumulatif, semua tahap)

| Suite | Assertion | Status |
|-------|-----------|--------|
| `run-auth-tests.js` (unit) | 49 | ✅ 49/49 |
| `run-integration-smoke-test.js` (dokumen penuh) | 94 | ✅ 94/94 |
| **Total** | **143** | **✅ 143/143** |

## File hasil Tahap 6

- `dist/index.html` — 7.024 baris (turun dari 18.438, ~62%)
- `dist/js/certificate-builder.js` — Custom Text Blocks + Certificate Field Styling (630 baris)
- `dist/js/home-editor.js` — Home Tab Editor (200 baris)

**Urutan load lengkap di index.html (final, WAJIB urutan ini):**
```html
<script src="js/shared-utils.js"></script>
<script src="js/service-recovery.js"></script>
<script src="js/auth.js"></script>
<script src="js/training.js"></script>
<script src="js/stcr.js"></script>
<script src="js/certificate-builder.js"></script>
<script src="js/home-editor.js"></script>
<script src="js/drygoods.js"></script>
```

## Yang BELUM diekstrak

- "Bank Station Sync" (IIFE kedua Training, masih tercampur kode admin/audit di index.html)
- Modul manajemen user (tabel CRUD render-side)
- Sisa "PATCH ARSITEKTUR v3.0" (P4-P14, station filter Service Recovery — belum diaudit untuk ekstraksi)

---

# Tahap 7 — Bank Station Sync

## Status: ✅ Selesai & teruji (146/146 assertion lulus: 49 unit + 97 integrasi)

## Ringkasan

`index.html`: **18.438 → 6.924 baris (turun ~62,5%)**. 1 modul baru:
`js/bank-station-sync.js` (125 baris) — daftar Bank Station turunan
dari Bank Data Peserta Training, plus indikator/tombol Sync untuk
tab Soal Training.

## Pola pemisahan: belajar dari insiden Tahap 6

Sebelum melakukan splice, dilakukan pengecekan eksplisit
(`grep -n 'src="js/'`) terhadap SELURUH rentang baris yang akan
dihapus — langkah yang baru jadi wajib setelah insiden penghapusan
tidak sengaja referensi `drygoods.js` di Tahap 6. Hasilnya kosong
(tidak ada referensi `<script src>` lain tersembunyi di rentang
Bank Station Sync), sehingga ekstraksi kali ini bisa dilakukan
dengan keyakinan lebih tinggi.

Blok `<script>` asli tempat Bank Station Sync berada juga berisi 2
hal tidak terkait yang SENGAJA dipertahankan di `index.html`:
`beforeunload` cleanup handler (lintas-modul, tidak spesifik fitur
manapun) dan "AUDIT LOG UI" (`toggleAuditPanel`, `loadAuditLog` —
dipanggil via inline `onclick=""`, jadi WAJIB tetap sebagai fungsi
top-level biasa, bukan terbungkus IIFE).

## Temuan struktural: ketergantungan urutan load yang KETAT (bukan sekadar guard typeof)

Berbeda dari kebanyakan modul sebelumnya (yang menggunakan
`typeof X === 'function'` sebagai pengaman), modul ini melakukan:
```js
(function(){
  const trainingData = window.trainingData;  // capture SINKRON, bukan lazy
  ...
})();
```
Baris ini dieksekusi SAAT PARSE, bukan ditunda lewat event listener
atau `setTimeout`. Jika `bank-station-sync.js` dimuat SEBELUM
`training.js`, `trainingData` akan permanen `undefined` (karena
`const`, tidak ter-update lagi meskipun `window.trainingData`
di-set belakangan oleh training.js) — setiap pemanggilan
`renderBankStations()` akan selalu gagal dengan
`Cannot read property 'peserta' of undefined`, BUKAN error yang
langsung kelihatan saat halaman pertama dimuat (karena
`renderBankStations` sendiri baru dipanggil belakangan, saat user
membuka sub-tab Bank Station).

Ini jenis bug yang sangat mudah lolos dari sekadar "halaman bisa
dimuat tanpa error" — makanya test [22] secara eksplisit MEMANGGIL
`window.renderBankStations()` dan memverifikasi tidak melempar error,
bukan cuma mengecek fungsinya ada.

## Hasil pengujian (kumulatif, semua tahap)

| Suite | Assertion | Status |
|-------|-----------|--------|
| `run-auth-tests.js` (unit) | 49 | ✅ 49/49 |
| `run-integration-smoke-test.js` (dokumen penuh) | 97 | ✅ 97/97 |
| **Total** | **146** | **✅ 146/146** |

## File hasil Tahap 7

- `dist/index.html` — 6.924 baris (turun dari 18.438, ~62,5%)
- `dist/js/bank-station-sync.js` — modul Bank Station Sync (125 baris)

**Urutan load lengkap di index.html (final, WAJIB urutan ini):**
```html
<script src="js/shared-utils.js"></script>
<script src="js/service-recovery.js"></script>
<script src="js/auth.js"></script>
<script src="js/training.js"></script>
<script src="js/bank-station-sync.js"></script>
<script src="js/stcr.js"></script>
<script src="js/certificate-builder.js"></script>
<script src="js/home-editor.js"></script>
<script src="js/drygoods.js"></script>
```

## Yang BELUM diekstrak

- Modul manajemen user (tabel CRUD render-side)
- Sisa "PATCH ARSITEKTUR v3.0" (P4-P14, station filter Service Recovery — belum diaudit untuk ekstraksi)
- AUDIT LOG UI & beforeunload cleanup (sengaja dipertahankan inline — dipanggil via onclick="")

---

# Tahap 2 — Konsolidasi switchTab + KOREKSI bug regresi dari Tahap 1

## ⚠️ Koreksi penting: bug yang TIDAK SENGAJA diperkenalkan oleh Tahap 1

Saat memulai pengecekan `switchTab` (yang sebelumnya disebut "didefinisikan
ulang 3x" sama seperti `applyPermissions"), ditemukan bahwa **Tahap 1
keliru menghapus sebagian fungsi yang BUKAN duplikat/dead-code**.

Blok auth asli yang diekstrak ke `auth.js` (baris ~9049–11081 di file
asli) ternyata juga berisi sebuah override `window.switchTab` yang SAH
dan PENTING:
```js
const originalSwitchTab = window.switchTab;
window.switchTab = function(tab){
  // ... permission check berbasis role & rolePerms ...
  if(originalSwitchTab) originalSwitchTab(tab);
  if(tab !== 'soal-peserta') localStorage.setItem(CURRENT_TAB_KEY, tab);
  if(typeof syncSidebarActive === 'function') syncSidebarActive(tab);
};
```
Saat Tahap 1 hanya melacak duplikasi `applyPermissions`, override
`switchTab` ini ikut terhapus tanpa disadari — karena ia berada di
blok yang sama. **Akibatnya, sejak hasil Tahap 1, proteksi akses tab
berbasis role (rolePerms) untuk navigasi tab HILANG sepenuhnya**, dan
fitur "tab terakhir tersimpan, kembali ke situ saat reload" juga
berhenti berfungsi (key `sjnam_current_tab` tidak pernah ditulis).

### Cara bug ini ditemukan
Saat mengaudit `switchTab` untuk konsolidasi (langkah yang murni
defensif/preventif, bukan karena ada laporan bug), pengecekan silang
ke 4 titik definisi `switchTab` di file asli menunjukkan satu definisi
(baris 10878) yang TIDAK match dengan apa pun yang ada di hasil
refactor saat ini. Investigasi lebih lanjut mengonfirmasi ini bukan
duplikat — isinya logic permission-gate yang nyata dan unik.

### Perbaikan
Wrapper `switchTab` ini dikembalikan ke `auth.js`, dipasang persis di
urutan yang sama seperti semula: base `switchTab` (didefinisikan lebih
awal di index.html) → **permission-gate ini** (dipasang saat auth.js
dimuat) → wrapper "Enhanced features" (refresh tabel perm saat tab
admin dibuka) → wrapper Drygoods (render data saat tab drygoods
dibuka). Tidak ada definisi switchTab lain yang perlu disentuh — 3
wrapper lainnya sudah benar (chain dengan `.apply()`/pemanggilan
fungsi asli), tidak seperti `applyPermissions` yang punya 2 definisi
mati di tengah-tengah chain.

## Pelajaran & langkah pencegahan untuk modul berikutnya

Bug ini lolos dari test integrasi Tahap 1b karena test saat itu tidak
secara eksplisit menguji navigasi/permission tab — hanya login,
logout, dan permission tampilan (`applyPermissions`). Sebagai langkah
pencegahan, sekarang ditambahkan:
- 5 test unit baru (test [13]–[17]) yang KHUSUS menguji setiap aspek
  permission-gate `switchTab` secara terisolasi
- 1 test integrasi baru (test [7] di integration suite) yang menguji
  seluruh CHAIN 4-layer `switchTab` berjalan benar di dokumen HTML
  yang sebenarnya, bukan cuma modul auth.js sendirian

Untuk modul-modul berikutnya, sebelum menghapus/memindahkan kode apa
pun dari sebuah blok `<script>`, langkah wajib: cek SEMUA
`window.X = ...` yang ada di blok tersebut (tidak hanya yang sedang
menjadi fokus), pastikan masing-masing diklasifikasikan dengan benar
sebagai (a) duplikat/dead-code, (b) wrapper sah yang perlu
dipertahankan, atau (c) definisi unik yang harus dipindah, bukan
dihapus.

## Hasil pengujian setelah perbaikan

| # | Skenario | Hasil |
|---|----------|-------|
| 13 | Peserta hanya bisa switchTab ke `soal-peserta`, tab lain diblok diam-diam | ✅ |
| 14 | Co-Admin diblok dari tab yang di-deny lewat tabel rolePerms | ✅ |
| 15 | Admin/Master tidak terpengaruh rolePerms — selalu bisa akses semua tab | ✅ |
| 16 | Tab aktif tersimpan ke localStorage setelah switchTab (sebelumnya rusak) | ✅ |
| 17 | Role tak dikenal fail-closed — tidak bisa switchTab ke mana pun | ✅ |
| (integrasi) | Chain 4-layer switchTab bekerja benar di dokumen HTML asli | ✅ |
| (integrasi) | Admin tidak terblokir oleh rolePerms yang ditujukan untuk role lain | ✅ |

**Total kumulatif: 49 assertion unit + 17 assertion integrasi = 66/66 lulus.**

## File yang diperbarui tahap ini

- `js/auth.js` dan `dist/js/auth.js` — ditambahkan wrapper permission-gate `switchTab`
- `test/run-auth-tests.js` — +5 test regresi baru (total 49 assertion)
- `test/run-integration-smoke-test.js` — +1 test regresi baru (total 17 assertion)
- `test/fixture.html` — ditambahkan elemen `[data-tab]`, `.tab-pane`, dan stub `switchTab` dasar untuk mendukung test baru

---

# Tahap 8 — Manajemen User & Data Karyawan (TEMUAN: pemulihan modul yang hilang)

## Status: ✅ Selesai & teruji (161/161 assertion lulus: 49 unit + 112 integrasi)

## ⚠️ Temuan utama: modul ini sempat HILANG TOTAL sejak Tahap 1, baru ketahuan sekarang

Saat memulai ekstraksi "Manajemen User", ditemukan bahwa
`renderUserTable` — fungsi inti yang menggambar tabel user — **tidak
punya definisi sama sekali** di `dist/index.html` maupun di file JS
manapun yang sudah diekstrak. Setiap titik pemanggilnya (di
`auth.js`, di `index.html`) sudah di-guard dengan
`typeof renderUserTable === 'function'`, sehingga kehilangan ini
**tidak pernah melempar error** — tab Manajemen User di aplikasi
hanya tampak kosong tanpa pesan kesalahan apa pun, persis seperti
kasus `window.switchTab` di Tahap 1b, tapi kali ini jauh lebih lama
tidak ketahuan karena dampaknya lebih halus (bukan seluruh navigasi
yang rusak, hanya satu tab spesifik).

**Akar masalah:** saat ekstraksi `js/auth.js` di Tahap 1, blok
"MANAJEMEN USER" (308 baris) dan "MODUL DATA KARYAWAN" (464 baris)
ternyata berada bersebelahan langsung dengan kode auth di file asli
— keduanya ikut terhapus dari `index.html` tanpa disadari sebagai
fungsionalitas terpisah yang masih dibutuhkan, dan tidak pernah
dipindahkan ke modul manapun.

**Dipulihkan dari mana:** bukan dari hasil refactor sebelumnya
(karena memang sudah tidak ada di sana), melainkan ditelusuri ulang
dari `/mnt/user-data/uploads/index.html` — file ASLI yang diunggah
pengguna di awal sesi, sebelum modifikasi apa pun.

## Struktur sumber yang tidak rapi

Berbeda dari modul lain, kode "Manajemen User" di file asli **tidak
berurutan secara fisik** — pecah jadi 2 bagian (baris ~9760-10067 dan
~10535-10874) yang diselingi oleh blok IIFE "MODUL DATA KARYAWAN"
(~10068-10531) di tengahnya. Dipetakan dulu function-by-function
sebelum memotong apa pun, untuk memastikan kedua bagian "Manajemen
User" digabung jadi satu file koheren (`user-management.js`), dan
Data Karyawan (yang sudah IIFE-wrapped dengan rapi di source asli)
jadi file terpisah (`karyawan-management.js`) — sesuai permintaan
"dipersimpel".

Juga dikonfirmasi bahwa 2 fungsi yang SECARA KEBETULAN bernama mirip
(`restoreSession`, `window.switchTab`) yang muncul di pemindaian awal
TERNYATA BUKAN bagian yang hilang — keduanya sudah benar dipindahkan
ke `auth.js` sejak Tahap 1b. Pemindaian fungsi awal sempat salah
mengira ini bagian dari modul yang hilang; diperiksa ulang dengan
membandingkan terhadap isi `auth.js` saat ini sebelum disimpulkan
aman untuk diabaikan.

## Perbaikan yang diterapkan saat pemulihan (bukan ada di kode asli)

Karena kode asli berbagi satu closure besar (`let currentUser`,
`const USERS_KEY` dideklarasikan sekali, dipakai bebas di seluruh
file), memisahkannya jadi file `<script>` terpisah memerlukan
penyesuaian:
- Semua referensi bare `currentUser` → `window.currentUser` (variabel
  privat `auth.js` tidak bisa diakses lintas file; `auth.js` sendiri
  sudah konsisten meng-mirror `window.currentUser = currentUser` di
  setiap titik login/logout/restore session, jadi aman dipakai)
- Semua referensi bare `USERS_KEY` → literal string `'sjnam_users_v1'`
  (konstanta privat di dalam IIFE `auth.js`, tidak diekspos)

Diverifikasi sebelum disimpulkan aman: dicek bahwa `auth.js`
benar-benar menyetel `window.currentUser` di SETIAP titik perubahan
state (bukan cuma sebagian), supaya `user-management.js`/
`karyawan-management.js` tidak pernah membaca nilai basi.

## Hasil pengujian (kumulatif, semua tahap)

| Suite | Assertion | Status |
|-------|-----------|--------|
| `run-auth-tests.js` (unit) | 49 | ✅ 49/49 |
| `run-integration-smoke-test.js` (dokumen penuh) | 112 | ✅ 112/112 |
| **Total** | **161** | **✅ 161/161** |

Termasuk 3 test khusus pemulihan (RESTORATION TEST) yang secara
eksplisit memverifikasi `renderUserTable`/`renderKaryawanTable`
benar-benar berfungsi (bukan cuma terdefinisi), dan bahwa pembacaan
`window.currentUser` lintas-file bekerja dengan benar.

## File hasil Tahap 8

- `dist/index.html` — 6.926 baris (naik sedikit dari 6.924, karena
  ini PEMULIHAN fungsionalitas yang hilang, bukan ekstraksi murni —
  total baris JS bertambah meski index.html sendiri nyaris tidak
  berubah karena hanya 2 baris `<script src>` baru yang ditambahkan)
- `dist/js/user-management.js` — Manajemen User (683 baris, gabungan 2 bagian)
- `dist/js/karyawan-management.js` — Data Karyawan (493 baris)

**Urutan load lengkap di index.html (final, WAJIB urutan ini):**
```html
<script src="js/shared-utils.js"></script>
<script src="js/service-recovery.js"></script>
<script src="js/auth.js"></script>
<script src="js/user-management.js"></script>
<script src="js/karyawan-management.js"></script>
<script src="js/training.js"></script>
<script src="js/bank-station-sync.js"></script>
<script src="js/stcr.js"></script>
<script src="js/certificate-builder.js"></script>
<script src="js/home-editor.js"></script>
<script src="js/drygoods.js"></script>
```

## Yang BELUM diekstrak

- Sisa "PATCH ARSITEKTUR v3.0" (P4-P14, station filter Service Recovery — belum diaudit untuk ekstraksi)
- AUDIT LOG UI & beforeunload cleanup (sengaja dipertahankan inline — dipanggil via onclick="")

## Rekomendasi untuk sesi berikutnya

Mengingat insiden ini ditemukan cukup lama setelah Tahap 1, disarankan
untuk melakukan **audit menyeluruh sekali lagi**: bandingkan setiap
nama fungsi yang ada di `index.html` ASLI (yang diunggah pengguna)
terhadap seluruh modul yang sudah diekstrak + sisa `index.html` saat
ini, untuk memastikan tidak ada fungsi lain yang senasib (terhapus
diam-diam tanpa terdeteksi karena selalu dipanggil dengan guard
`typeof`).

---

# Tahap 9 — PATCH ARSITEKTUR v3.0 & Audit Log UI

## Status: ✅ Selesai & teruji (167/167 assertion lulus: 49 unit + 118 integrasi)

## Ringkasan

`index.html`: **18.438 → 6.514 baris (turun ~65%)**. 2 modul baru:
- `js/patch-arsitektur-v3.js` (378 baris) — 11 patch tersisa (P4-P14;
  P1-P3 sudah dikonsolidasi ke `auth.js` sejak Tahap 1): filter
  station Service Recovery & STCR, validasi session, password hash
  interceptor, refresh cache station, wrapping `cloudPull`, dst.
- `js/audit-log-ui.js` (111 baris) — panel riwayat aktivitas (push/
  pull/merge/create/update/delete) dari Supabase, plus cleanup
  `beforeunload` dan badge antrian offline.

## Temuan: 2 bug pra-existing di kode ASLI (bukan dari refactor ini)

Sebelum ekstraksi, dilakukan audit dependency seperti biasa — kali
ini menemukan 2 bug yang **sudah ada di `index.html` ASLI** sebelum
modifikasi apa pun (dikonfirmasi dengan menelusuri baris yang sama
persis di file yang diunggah pengguna):

**Bug 1 — `_offlineQueue` tidak terjangkau:** `_updateOfflineQueueBadge()`
memanggil `_offlineQueue.getAll()` sebagai referensi bare, padahal
`_offlineQueue` dideklarasikan `const` di dalam IIFE terpisah (kini
`shared-utils.js`) — privat, tidak pernah diekspor ke `window`. Setiap
panggilan melempar `ReferenceError`, tapi ditelan diam-diam oleh
`catch(e){}` kosong. Akibatnya: badge antrian offline tidak pernah
benar-benar ter-update, tanpa pernah terlihat sebagai error.

**Bug 2 — `renderDgTrx` tidak terjangkau:** P9/P10 di PATCH
ARSITEKTUR v3.0 memanggil `renderDgTrx` (refresh tampilan Drygoods
setelah station lock berubah) sebagai referensi bare, padahal fungsi
itu privat di dalam IIFE Drygoods, tidak pernah diekspor. Guard
`typeof renderDgTrx === 'function'` SELALU bernilai `false`, sehingga
refresh otomatis Drygoods setelah perubahan station tidak pernah
benar-benar terjadi — silently no-op, bukan error.

**Keputusan:** kedua bug DIPERTAHANKAN APA ADANYA pada ekstraksi ini
(prinsip refactor di proyek ini: pindahkan kode tanpa mengubah
perilaku). Didokumentasikan secara eksplisit di header file masing-
masing modul dan di sini supaya terlihat jika suatu saat ingin
diperbaiki.

## Temuan struktural: ketergantungan urutan load (P9/P10)

Berbeda dari kebanyakan patch lain di file ini (yang dideferred lewat
`DOMContentLoaded`), P9 dan P10 meng-capture `window.triggerAutoSync`
dan `window.cloudPull` **secara sinkron saat parse**:
```js
var _origTriggerAutoSync = window.triggerAutoSync;
window.triggerAutoSync = function (moduleName) { ...; _origTriggerAutoSync.apply(...); };
```
Jika `shared-utils.js` (pemilik asli kedua fungsi ini) belum dimuat
saat baris ini berjalan, `_origTriggerAutoSync`/`_origCloudPull` akan
permanen `undefined` — wrapping P9/P10 jadi no-op diam-diam (sudah
di-guard `typeof`, jadi tidak error, hanya tidak berfungsi). Karena
itu `patch-arsitektur-v3.js` **wajib dimuat setelah `shared-utils.js`
dan `auth.js`** — dikonfirmasi dengan test regresi eksplisit [27]
yang benar-benar memanggil `window.triggerAutoSync()` dan memverifikasi
tidak melempar error.

## Cakupan yang sengaja DIBATASI

Tepat setelah PATCH ARSITEKTUR v3.0 di file asli, ada blok terpisah
"IMPLEMENTASI BLUEPRINT v1.0" (406 baris: random password generator,
validasi station, expiry warning, dst) — BUKAN bagian dari permintaan
sesi ini, sengaja TIDAK diekstrak. Tetap di `index.html` sebagai blok
`<script>` IIFE mandiri terakhir sebelum penutup HTML.

## Hasil pengujian (kumulatif, semua tahap)

| Suite | Assertion | Status |
|-------|-----------|--------|
| `run-auth-tests.js` (unit) | 49 | ✅ 49/49 |
| `run-integration-smoke-test.js` (dokumen penuh) | 118 | ✅ 118/118 |
| **Total** | **167** | **✅ 167/167** |

## File hasil Tahap 9

- `dist/index.html` — 6.514 baris (turun dari 18.438, ~65%)
- `dist/js/patch-arsitektur-v3.js` — 11 patch P4-P14 (378 baris)
- `dist/js/audit-log-ui.js` — Audit Log UI + cleanup (111 baris)

**Urutan load lengkap di index.html (final, WAJIB urutan ini):**
```html
<script src="js/shared-utils.js"></script>
<script src="js/service-recovery.js"></script>
<script src="js/auth.js"></script>
<script src="js/user-management.js"></script>
<script src="js/karyawan-management.js"></script>
<script src="js/training.js"></script>
<script src="js/audit-log-ui.js"></script>
<script src="js/bank-station-sync.js"></script>
<script src="js/stcr.js"></script>
<script src="js/certificate-builder.js"></script>
<script src="js/home-editor.js"></script>
<script src="js/drygoods.js"></script>
<script src="js/patch-arsitektur-v3.js"></script>
```

## Yang BELUM diekstrak

- "IMPLEMENTASI BLUEPRINT v1.0" (406 baris, blok terakhir sebelum penutup HTML — sengaja dilewati sesuai permintaan eksplisit di sesi ini)

---

# Tahap 10 — Blueprint v1.0

## Status: ✅ Selesai & teruji (176/176 assertion lulus: 49 unit + 127 integrasi)

## Ringkasan

`index.html`: **18.438 → 6.108 baris (turun ~67%)**. 1 modul baru:
`js/blueprint-v1.js` (450 baris) — generator password sementara
acak, validator kekuatan password, modal paksa ganti password saat
login pertama, modal ganti password self-service, sistem peringatan
kontrak karyawan akan habis, validasi tambahan Add Role, tombol
"Ganti Password" di panel user.

Dengan ini, SELURUH isi `<script>` di `index.html` (kecuali markup
HTML/CSS statis dan beberapa baris sisa P1-P3/FEAT-6-7 yang memang
sudah dikonsolidasi ke `auth.js` sejak Tahap 1) sudah terbagi rapi ke
14 modul terpisah.

## Temuan: ketergantungan tersembunyi yang baru genap berfungsi sekarang

Saat audit dependency sebelum ekstraksi, ditemukan bahwa
`js/user-management.js` (dipulihkan di Tahap 8) SUDAH memanggil
`window._generateTempPassword()` untuk membuat password sementara
otomatis saat admin menambah user baru — tapi karena Blueprint v1.0
(pemilik fungsi tersebut) belum pernah diekstrak, pemanggilan itu
SELALU GAGAL dengan `ReferenceError` sejak Tahap 8 selesai. Fitur
"Tambah User" dengan auto-generate password baru benar-benar
berfungsi setelah Tahap 10 ini — dikonfirmasi dengan test regresi
eksplisit [29] yang memanggil `window._generateTempPassword()` secara
langsung dan memverifikasi hasilnya berupa password 8 karakter, bukan
error.

## Audit dependency: bersih, tidak ada masalah baru

Berbeda dari beberapa tahap sebelumnya, audit kali ini tidak
menemukan masalah baru:
- Tidak ada referensi bare `currentUser`/`USERS_KEY` yang perlu
  diperbaiki (modul ini sudah konsisten memakai `window.currentUser`
  dan literal string `'sjnam_users_v1'` sejak awal)
- Tidak ada pola wrapping `_orig* = window.X` yang butuh urutan load
  ketat seperti P9/P10 di Tahap 9 — semua fungsi baru, bukan override
- Satu temuan dead-code tambahan: `_validateAddRole` (FEAT-4)
  terdefinisi tapi tidak pernah dipanggil di mana pun, baik di kode
  asli maupun hasil refactor — konsisten dengan pola dead-code yang
  sudah ditemukan di Tahap 8 (`hashPasswordSync`/`quickLogin`),
  dipertahankan apa adanya tanpa diaktifkan/dihapus.

## Hasil pengujian (kumulatif, semua tahap)

| Suite | Assertion | Status |
|-------|-----------|--------|
| `run-auth-tests.js` (unit) | 49 | ✅ 49/49 |
| `run-integration-smoke-test.js` (dokumen penuh) | 127 | ✅ 127/127 |
| **Total** | **176** | **✅ 176/176** |

## File hasil Tahap 10

- `dist/index.html` — 6.108 baris (turun dari 18.438, ~67%)
- `dist/js/blueprint-v1.js` — Blueprint v1.0 (450 baris)

**Urutan load lengkap di index.html (final, WAJIB urutan ini):**
```html
<script src="js/shared-utils.js"></script>
<script src="js/service-recovery.js"></script>
<script src="js/auth.js"></script>
<script src="js/user-management.js"></script>
<script src="js/karyawan-management.js"></script>
<script src="js/training.js"></script>
<script src="js/audit-log-ui.js"></script>
<script src="js/bank-station-sync.js"></script>
<script src="js/stcr.js"></script>
<script src="js/certificate-builder.js"></script>
<script src="js/home-editor.js"></script>
<script src="js/drygoods.js"></script>
<script src="js/patch-arsitektur-v3.js"></script>
<script src="js/blueprint-v1.js"></script>
```

## Status akhir proyek

Modularisasi 14 file dari `index.html` asli 18.438 baris menjadi
6.108 baris (penurunan ~67%). Setiap tahap diuji dengan test unit
dan integrasi terhadap dokumen HTML lengkap (bukan modul terisolasi),
total **176 assertion** mencakup regresi yang ditemukan dan
diperbaiki sepanjang proses (switchTab chain, cloudConfig overwrite,
load order TDZ, drygoods.js yang sempat terhapus, dan modul
Manajemen User & Data Karyawan yang sempat hilang total).

---

# Perbaikan Bug Pasca-Refactor & Audit Runtime Menyeluruh

## Status: ✅ Selesai & teruji (185/185 assertion lulus: 49 unit + 136 integrasi)

## Ringkasan

Sesi lanjutan setelah modularisasi 14 file selesai: memperbaiki 3 bug
pra-existing yang sudah teridentifikasi sebelumnya (Tahap 9), lalu
melakukan audit runtime menyeluruh untuk mencari bug lain yang belum
ketahuan.

## 3 Bug Diperbaiki

### 1. Badge antrian offline tidak pernah update
**Akar masalah:** `_updateOfflineQueueBadge()` di `audit-log-ui.js`
memanggil `_offlineQueue.getAll()` sebagai referensi bare, padahal
`_offlineQueue` adalah `const` privat di dalam IIFE
`js/shared-utils.js` — tidak pernah terjangkau dari file lain. Setiap
panggilan melempar `ReferenceError`, ketelan diam-diam oleh
`catch(e){}` kosong.

**Perbaikan:**
- `shared-utils.js`: ditambahkan `window.getOfflineQueueItems()`
  sebagai jembatan resmi ke `_offlineQueue.getAll()`.
- `audit-log-ui.js`: `_updateOfflineQueueBadge()` sekarang memanggil
  `window.getOfflineQueueItems()`, dan `catch(e){}` yang sebelumnya
  kosong sekarang mencatat `console.warn` — supaya masalah serupa di
  masa depan tidak lagi tersembunyi diam-diam.

### 2. Drygoods tidak auto-refresh setelah station user berubah
**Akar masalah:** P9/P10 di `patch-arsitektur-v3.js` memanggil
`renderDgTrx` (refresh tampilan transaksi Drygoods) sebagai referensi
bare untuk menyegarkan tampilan setelah station lock user berubah —
tapi `renderDgTrx` adalah fungsi privat di dalam IIFE `drygoods.js`,
tidak pernah diekspor ke `window`. Guard `typeof renderDgTrx ===
'function'` SELALU bernilai `false`.

**Perbaikan:**
- `drygoods.js`: ditambahkan `window.renderDgTrx = renderDgTrx;` di
  akhir IIFE.
- `patch-arsitektur-v3.js`: P9 dan P10 sekarang memanggil
  `window.renderDgTrx` (bukan bare `renderDgTrx`).

### 3. Validasi Add Role (FEAT-4) tidak pernah aktif
**Akar masalah:** `window._validateAddRole` (validasi: role
station-bound wajib karyawan punya station, NIP wajib) terdefinisi
lengkap di `blueprint-v1.js` tapi **tidak pernah dipanggil dari mana
pun** — baik di kode asli maupun hasil refactor sebelumnya. Dead code
murni sejak awal.

**Perbaikan:**
- `user-management.js`: tombol pemilihan karyawan di modal "Add Role"
  sekarang menyertakan `data-station` (sebelumnya hanya `data-kar-id`/
  `data-nip`/`data-nama`), dan handler klik memanggil
  `window._validateAddRole(role, {nip, station})` sebelum lanjut
  membuat akun. Jika ada error validasi (mis. role station-bound tanpa
  station), proses dibatalkan dengan toast error — fitur yang
  sebelumnya didesain tapi tidak pernah benar-benar berfungsi.

## Audit Runtime Menyeluruh

Selain audit statis (membandingkan nama fungsi di seluruh file),
sesi ini menambahkan **audit runtime** (`test/run-full-runtime-audit.js`)
yang memuat dokumen HTML lengkap dengan 14 modul, login sebagai
Admin, lalu:
1. Mengunjungi seluruh 19 tab + 3 sub-tab admin via `switchTab()`
2. Mengetes ulang alur "Add Role" yang baru diperbaiki
3. **Sapuan luas**: mengklik SETIAP tombol (`id="btn..."`) di setiap
   tab, menangkap setiap `ReferenceError`/`TypeError` yang benar-benar
   terjadi saat runtime — bukan cuma "apakah fungsi ini terdefinisi
   di suatu tempat", tapi "apakah benar-benar berfungsi saat diklik
   sungguhan"

Pendekatan ini dipilih karena audit statis murni (regex) menghasilkan
terlalu banyak false positive untuk nama generik yang dipakai ulang
di banyak file (`esc`, `fmtDate`, `init`, `filtered`, dst — masing-
masing modul punya definisi lokalnya sendiri, bukan saling
memanggil) — audit runtime jauh lebih presisi karena hanya
melaporkan error yang BENAR-BENAR terjadi.

**Hasil:** setelah memfilter keterbatasan lingkungan jsdom yang
diketahui (CDN tidak bisa dimuat tanpa akses internet, beberapa API
browser seperti `confirm()`/`alert()`/`scrollTo()`/navigasi unduhan
file belum diimplementasikan jsdom), **tidak ditemukan bug aplikasi
baru**. Dua temuan tersisa (`btnDfsExportJson`, `btnExportAllJson`)
hanya jsdom yang menolak mensimulasikan unduhan file lewat
`<a href="blob:..." download>` — pola standar yang bekerja normal di
browser sungguhan, sudah diverifikasi langsung di kode sumber
(`service-recovery.js`).

## Hasil pengujian (kumulatif, semua tahap + perbaikan bug)

| Suite | Assertion | Status |
|-------|-----------|--------|
| `run-auth-tests.js` (unit) | 49 | ✅ 49/49 |
| `run-integration-smoke-test.js` (dokumen penuh, +9 test bugfix) | 136 | ✅ 136/136 |
| `run-full-runtime-audit.js` (klik semua tombol di semua tab) | — | ✅ 0 bug aplikasi ditemukan |
| **Total assertion** | **185** | **✅ 185/185** |

## File yang diubah pada perbaikan ini

- `js/shared-utils.js` + `dist/js/shared-utils.js` — tambah `window.getOfflineQueueItems()`
- `js/audit-log-ui.js` + `dist/js/audit-log-ui.js` — pakai bridge baru, catch tidak lagi kosong
- `js/drygoods.js` + `dist/js/drygoods.js` — ekspor `window.renderDgTrx`
- `js/patch-arsitektur-v3.js` + `dist/js/patch-arsitektur-v3.js` — pakai `window.renderDgTrx`
- `js/user-management.js` + `dist/js/user-management.js` — wire `_validateAddRole` ke alur Add Role
- `test/run-integration-smoke-test.js` — +9 assertion baru (test [30]-[32] untuk verifikasi 3 bug fix)
- `test/run-full-runtime-audit.js` — **baru**, audit runtime klik-semua-tombol

## Cara menjalankan ulang

```bash
cd sjnam-refactor
node test/run-auth-tests.js              # 49 assertion
node test/run-integration-smoke-test.js  # 136 assertion
node test/run-full-runtime-audit.js      # audit runtime, exit code 0 = bersih
```

---

# Pemindahan Kredensial Supabase (Persiapan Upload GitHub)

## Status: ✅ Selesai & teruji (185/185 assertion lulus, sama seperti sebelumnya)

## Apa yang berubah

Kredensial Supabase (URL + anon key) yang sebelumnya hardcoded sebagai
string literal di `shared-utils.js` sekarang dipindahkan ke file
terpisah `js/config.js` yang **di-gitignore** — tidak akan ikut
ter-upload ke GitHub.

`shared-utils.js` sekarang membaca dari `window.SJNAM_CONFIG.SUPABASE_URL`
/ `SUPABASE_ANON_KEY` (di-set oleh `config.js`), dengan fallback string
kosong (BUKAN kredensial asli) jika `config.js` tidak ada — aplikasi
tetap bisa dibuka normal tanpa Cloud Sync aktif, bukan crash.

## File baru

- **`js/config.example.js`** — template AMAN diupload, berisi
  placeholder (`YOUR-PROJECT-REF`, `YOUR-ANON-KEY-HERE`), bukan
  kredensial asli.
- **`js/config.js`** — kredensial ASLI, di-gitignore, **TIDAK
  diserahkan di dalam folder `dist/` pada output sesi ini** —
  sengaja ditaruh terpisah di folder `PRIVATE-do-not-upload/`
  supaya tidak ada risiko ikut ter-upload tanpa sadar bersama
  `dist/`. Pengguna perlu memindahkannya sendiri ke `dist/js/config.js`
  sebelum deploy (lokal atau ke hosting), bukan ke repo Git.
- **`dist/.gitignore`** — mendaftarkan `js/config.js` agar git
  otomatis mengabaikannya.

## Urutan load yang disesuaikan

`index.html` sekarang memuat `js/config.js` **sebelum**
`shared-utils.js` (karena `shared-utils.js` membaca
`window.SJNAM_CONFIG` secara sinkron saat parse, bukan lazy). Tag
script memakai `onerror=""` agar jika `config.js` benar-benar tidak
ada di server (bukan cuma di git), browser tetap lanjut tanpa
menghentikan eksekusi:
```html
<script src="js/config.js" onerror="console.warn(...)"></script>
<script src="js/shared-utils.js"></script>
```

## Verifikasi

Diuji 2 skenario:
1. **`config.js` ADA** (kondisi normal pengembangan/setelah deploy):
   seluruh 185 assertion tetap lulus, termasuk test [11] yang
   memverifikasi `cloudConfig` terisi kredensial asli.
2. **`config.js` TIDAK ADA** (simulasi clone baru dari GitHub sebelum
   pengguna setup): aplikasi tetap memuat seluruhnya tanpa error,
   `window.cloudConfig` otomatis jadi `{supabaseUrl:'', supabaseKey:''}`
   alih-alih crash — diverifikasi langsung lewat skrip simulasi
   terpisah.

## Langkah WAJIB sebelum upload ke GitHub

1. **Rotate anon key** di dashboard Supabase Anda — key yang lama
   sempat ada di kode selama proses refactor, sebaiknya dianggap
   sudah "bocor" meski belum pernah benar-benar diupload publik.
2. Pastikan **Row Level Security (RLS)** aktif di semua tabel terkait
   (`sjnam_sync`, `sjnam_audit_log`, dan tabel lain yang diakses lewat
   key ini).
3. Setelah key baru didapat, update `PRIVATE-do-not-upload/config.js`
   dengan nilai baru tersebut.
4. Saat deploy (ke hosting statis apa pun — GitHub Pages, Netlify,
   server sendiri, dll), salin `PRIVATE-do-not-upload/config.js` ke
   `dist/js/config.js` di LOKASI DEPLOY, bukan commit ke git.
5. Yang diupload ke GitHub: seluruh isi `dist/` KECUALI `js/config.js`
   (otomatis terjaga oleh `.gitignore` selama Anda memakai `git add`
   yang menghormati gitignore, bukan menyalin file secara manual ke
   luar git).

## File yang diubah pada perbaikan ini

- `js/shared-utils.js` + `dist/js/shared-utils.js` — baca dari `window.SJNAM_CONFIG`, bukan konstanta hardcoded
- `js/config.example.js` + `dist/js/config.example.js` — **baru**, template aman
- `config-secret/config.js` (kerja) / `PRIVATE-do-not-upload/config.js` (output) — **baru**, kredensial asli, TIDAK ikut `dist/`
- `dist/index.html` — tambah `<script src="js/config.js">` sebelum `shared-utils.js`
- `dist/.gitignore` — **baru**, mendaftarkan `js/config.js`
- `test/run-integration-smoke-test.js` — inline `config.js` sebelum `shared-utils.js`
- `test/run-full-runtime-audit.js` — sama

---

# Perbaikan Bug: User Terhapus Muncul Kembali Setelah Beberapa Waktu

## Status: ✅ Selesai & teruji (194/194 assertion lulus: 49 unit + 145 integrasi)

## Laporan pengguna

"di manajemen role jika saya hapus user beberapa waktu kemudian user
itu tampil kembali" — dikonfirmasi sebagai bug nyata, bukan kesalahan
penggunaan.

## Akar masalah (ditemukan & dikonfirmasi dengan reproduksi langsung)

`cloudPull()` di `shared-utils.js` melakukan **merge** (gabung) antara
data user lokal dan data user dari cloud setiap kali sinkronisasi
otomatis (Smart-Sync) berjalan — BUKAN replace/timpa. Logic merge-nya:

```js
rec.users.forEach(u=>{ if(u.id) _userMap.set(u.id, u); });   // cloud dulu
_localUsers.forEach(u=>{ if(u.id) _userMap.set(u.id, u); }); // lokal menimpa
```

Masalahnya: kalau sebuah user **dihapus** secara lokal, ia hilang dari
`_localUsers` — tapi merge logic ini tidak tahu cara membedakan "user
ini memang belum pernah ada di lokal" dengan "user ini SENGAJA
dihapus di lokal". Karena cloud (yang belum tahu user ini sudah
dihapus — entah karena proses push belum sempat selesai, atau berasal
dari device lain yang local copy-nya masih lama) tetap menyertakan
user tersebut, ia ditambahkan kembali ke hasil merge.

**Skenario nyata yang memicu ini:** hapus user → tersimpan benar di
localStorage → beberapa saat kemudian (detik/menit) Smart-Sync
otomatis menjalankan `cloudPull()` → user yang sudah dihapus
"kembali" muncul di tabel — persis gejala yang dilaporkan ("beberapa
waktu kemudian").

Direproduksi secara eksak dengan skrip terpisah sebelum perbaikan
ditulis, memakai logic merge yang sama persis dari kode sumber —
bug terkonfirmasi 100% sebelum melakukan perubahan apa pun.

Pola bug yang SAMA PERSIS juga ditemukan untuk data Karyawan dan
Peserta Training — sengaja diperbaiki sekaligus karena akar
masalahnya identik.

## Perbaikan: sistem Tombstone (penanda "sudah dihapus")

Ditambahkan mekanisme **tombstone tracking** di `shared-utils.js`:
- `markDeletedTombstone(scope, ids)` — dipanggil tepat saat
  penghapusan terjadi (di `user-management.js`, `karyawan-management.js`,
  `training.js`), mencatat ID + waktu hapus ke localStorage terpisah
  (`sjnam_deleted_tombstones_v1`).
- `_filterTombstoned(scope, mergedArr)` — dipanggil setelah merge
  selesai di `cloudPull()`, membuang item yang ID-nya tercatat di
  tombstone — KECUALI item itu punya `updatedAt` yang lebih baru dari
  waktu tombstone (menangani kasus tepi: user yang sengaja dibuat
  ulang dengan ID sama setelah dihapus, bukan data basi).
- Tombstone otomatis kedaluwarsa setelah 30 hari (tidak menumpuk
  selamanya — setelah itu dianggap semua device sudah ter-sinkron
  ulang lewat alur normal).
- `mergeById()` (dipakai juga oleh data Training: peserta/materi/
  stations/soal) diberi parameter opsional `tombstoneScope` supaya
  perbaikan ini jadi infrastruktur yang bisa dipakai ulang, bukan
  tambalan satu tempat saja.

**Diterapkan ke:** penghapusan user (single & bulk — keduanya
ternyata memakai satu handler konfirmasi yang sama), penghapusan
karyawan, dan penghapusan peserta training.

## ⚠️ Insiden kecil saat implementasi (ditemukan & diperbaiki sebelum lanjut)

Satu `str_replace` saat menyisipkan blok tombstone secara tidak
sengaja IKUT MENGHAPUS baris deklarasi `function mergeById(...)` itu
sendiri, meninggalkan badan fungsi tanpa header (`const map = new
Map();` menggantung tanpa pembungkus). **Ditemukan langsung lewat
`node --check` yang dijalankan tepat setelah setiap edit** — bagian
dari kebiasaan wajib di proyek ini sejak insiden serupa di tahap
modularisasi awal. Diperbaiki sebelum lanjut ke langkah berikutnya,
tidak sempat masuk ke file yang diuji apalagi diserahkan.

## Pengujian: 3 lapis verifikasi

1. **Reproduksi murni** (test [33]): memakai logic merge yang sama
   persis untuk membuktikan bug ASLI ada sebelum fix, lalu membuktikan
   tombstone benar-benar mencegahnya.
2. **Kasus tepi** (test [34]): tombstone tidak salah memblokir record
   yang sengaja dibuat ulang dengan ID sama setelah dihapus.
3. **End-to-end via UI sungguhan** (test [35]): membuat user uji coba,
   me-render tabel asli, **mengklik tombol 🗑️ yang benar-benar
   ter-render** dan tombol konfirmasi modal yang benar-benar ada di
   DOM — bukan memanggil fungsi secara langsung — lalu memverifikasi
   tombstone otomatis tercatat dan user tidak kembali muncul setelah
   simulasi merge cloud yang basi. Ini lapis paling meyakinkan karena
   menguji jalur yang benar-benar dipakai pengguna.

Audit runtime menyeluruh (`run-full-runtime-audit.js`, klik semua
tombol di semua tab) juga dijalankan ulang setelah perbaikan ini —
tidak ada regresi baru.

## Hasil pengujian (kumulatif, semua tahap + perbaikan bug)

| Suite | Assertion | Status |
|-------|-----------|--------|
| `run-auth-tests.js` (unit) | 49 | ✅ 49/49 |
| `run-integration-smoke-test.js` (dokumen penuh, +13 test sejak audit terakhir) | 145 | ✅ 145/145 |
| `run-full-runtime-audit.js` (klik semua tombol di semua tab) | — | ✅ 0 bug aplikasi ditemukan |
| **Total assertion** | **194** | **✅ 194/194** |

## File yang diubah pada perbaikan ini

- `js/shared-utils.js` + `dist/js/shared-utils.js` — tambah sistem tombstone (`markDeletedTombstone`, `_filterTombstoned`), terapkan ke merge `users`/`karyawan`/`peserta` di `cloudPull()` dan `mergeById()`
- `js/user-management.js` + `dist/js/user-management.js` — catat tombstone di handler "BULK DELETE CONFIRM" (mencakup hapus single & bulk)
- `js/karyawan-management.js` + `dist/js/karyawan-management.js` — catat tombstone saat hapus karyawan
- `js/training.js` + `dist/js/training.js` — catat tombstone saat hapus data peserta
- `test/run-integration-smoke-test.js` — +13 assertion baru (test [33]-[35])

## Cara menjalankan ulang

```bash
cd sjnam-refactor
node test/run-auth-tests.js              # 49 assertion
node test/run-integration-smoke-test.js  # 145 assertion
node test/run-full-runtime-audit.js      # audit runtime, exit code 0 = bersih
```
