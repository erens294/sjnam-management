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
