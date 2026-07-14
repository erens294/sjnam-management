/* ================================================================
   SJNAM — BACKUP & RESTORE JSON LENGKAP (SEMUA MODUL)
   ================================================================
   [BUG DITEMUKAN & DIPERBAIKI] Tombol "Export Semua Data (JSON)"
   bawaan (di service-recovery.js) HANYA mencakup 4 hal: data Service
   Recovery, Bank Data Station, DFS Bank, dan Settings — TIDAK
   mencakup Data Karyawan, Akun User, Training (Soal/Peserta),
   Drygoods, STCR, Station Report (Activity/Check-In/First-Last Bag),
   konfigurasi Sertifikat, maupun Home Editor. Fitur ini dibuat
   sebelum modul-modul itu ditambahkan ke aplikasi, dan tidak pernah
   diperbarui — padahal namanya "Export SEMUA Data".

   File ini mengganti perilaku tombol itu (dan tombol Import-nya)
   dengan versi yang benar-benar mencakup SEMUA localStorage key
   yang dipakai aplikasi.

   Kenapa dibuat file terpisah: service-recovery.js terminifikasi
   jadi satu baris. Tombol export di-"intercept" di fase capture
   (menghentikan versi lama sebelum sempat jalan), dan input file
   import di-clone (supaya listener lama benar-benar terganti, bukan
   cuma ditumpuk).
   ================================================================ */
!function () {
  "use strict";

  if (window._fullBackupInit) return;
  window._fullBackupInit = true;

  var DATA_KEYS = {
    data: "sjn_delay_pro_v4",
    stations: "sjn_stations_v2",
    dfsData: "sjn_dfs_bank_v1",
    settings: "sjn_settings_v4",
    training: "sjn_training_v1",
    karyawan: "sjnam_karyawan_v1",
    users: "sjnam_users_v1",
    stcr: "sjnam_stcr_data_v1",
    drygoods: "sjnam_drygoods_v1",
    rolePerms: "sjnam_role_perms_v1",
    stationActivity: "sjnam_station_activity_v1",
    stationActivityMaster: "sjnam_station_activity_master_v1",
    stationCheckin: "sjnam_station_checkin_v1",
    stationBagreport: "sjnam_station_bagreport_v1",
    baggage: "sjnam_baggage_v1"
  };
  var CERT_KEYS = {
    certTemplate1: "sjn_cert_template_1",
    certTemplate2: "sjn_cert_template_2",
    certTemplateActive: "sjn_cert_template_active",
    certPositions: "sjn_cert_positions_v1",
    certParaf: "sjn_cert_paraf_v1",
    certParafShow: "sjn_cert_paraf_show_v1",
    certCustomTexts: "sjn_cert_custom_texts_v1",
    certCustomTextsSJ: "sjn_cert_custom_texts_sj_v1",
    certCustomTextsNAM: "sjn_cert_custom_texts_nam_v1",
    certCustomTextsBoth: "sjn_cert_custom_texts_both_v1",
    certBarcode: "sjn_cert_barcode_v1"
  };
  var HOME_KEYS = {
    homeBg: "home_bg_v1",
    homeLogoSj: "home_logo_sj_v1",
    homeLogoSjPos: "home_logo_sj_pos_v1",
    homeLogoSjSize: "home_logo_sj_size_v1",
    homeLogoNam: "home_logo_nam_v1",
    homeLogoNamPos: "home_logo_nam_pos_v1",
    homeLogoNamSize: "home_logo_nam_size_v1"
  };

  function readKey(key) {
    try {
      var v = localStorage.getItem(key);
      if (v === null) return null;
      try { return JSON.parse(v); } catch (e) { return v; } // sebagian key (mis. home_bg_v1) simpan string mentah (data URL gambar), bukan JSON
    } catch (e) { return null; }
  }
  function writeKey(key, val) {
    try {
      if (val === null || val === undefined) return;
      localStorage.setItem(key, typeof val === "string" ? val : JSON.stringify(val));
    } catch (e) { console.warn("[full-backup] gagal simpan", key, e); }
  }

  function buildFullBackup() {
    var out = { _format: "sjnam-full-backup-v1", exportedAt: new Date().toISOString() };
    Object.keys(DATA_KEYS).forEach(function (name) { out[name] = readKey(DATA_KEYS[name]); });
    out.certConfig = {};
    Object.keys(CERT_KEYS).forEach(function (name) { out.certConfig[name] = readKey(CERT_KEYS[name]); });
    out.homeEditor = {};
    Object.keys(HOME_KEYS).forEach(function (name) { out.homeEditor[name] = readKey(HOME_KEYS[name]); });
    return out;
  }

  function restoreFullBackup(parsed) {
    var restoredCount = 0;
    Object.keys(DATA_KEYS).forEach(function (name) {
      if (parsed[name] !== undefined && parsed[name] !== null) { writeKey(DATA_KEYS[name], parsed[name]); restoredCount++; }
    });
    if (parsed.certConfig) {
      Object.keys(CERT_KEYS).forEach(function (name) {
        if (parsed.certConfig[name] !== undefined && parsed.certConfig[name] !== null) { writeKey(CERT_KEYS[name], parsed.certConfig[name]); restoredCount++; }
      });
    }
    if (parsed.homeEditor) {
      Object.keys(HOME_KEYS).forEach(function (name) {
        if (parsed.homeEditor[name] !== undefined && parsed.homeEditor[name] !== null) { writeKey(HOME_KEYS[name], parsed.homeEditor[name]); restoredCount++; }
      });
    }
    return restoredCount;
  }

  function bindExportImportButtons() {
    var bound = false;

    var exportBtn = document.getElementById("btnExportAllJson");
    if (exportBtn && !exportBtn._fullBackupBound) {
      var newExportBtn = exportBtn.cloneNode(true);
      newExportBtn._fullBackupBound = true;
      exportBtn.parentNode.replaceChild(newExportBtn, exportBtn);
      newExportBtn.addEventListener("click", function (e) {
        e.preventDefault();
        var backup = buildFullBackup();
        var blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "sjnam_full_backup_" + (window.todayLocalStr ? window.todayLocalStr() : new Date().toISOString().slice(0, 10)) + ".json";
        a.click();
        URL.revokeObjectURL(a.href);
        window.showToast && window.showToast("Backup LENGKAP (semua modul) berhasil diunduh", "success");
      });
      bound = true;
    }

    var importInput = document.getElementById("fileImportAllJson");
    if (importInput && !importInput._fullBackupBound) {
      var newInput = importInput.cloneNode(true);
      newInput._fullBackupBound = true;
      importInput.parentNode.replaceChild(newInput, importInput);
      newInput.addEventListener("change", async function (e) {
        var file = e.target.files[0];
        if (!file) return;
        try {
          var parsed = JSON.parse(await file.text());
          var ok = window.showConfirm
            ? await window.showConfirm("Import Database LENGKAP", "Ganti SEMUA modul (Karyawan, User, Training, Drygoods, STCR, Station Report, Sertifikat, dll)? Data saat ini di device ini akan tertimpa!")
            : confirm("Import semua data? Data saat ini akan tertimpa.");
          if (ok) {
            var count = restoreFullBackup(parsed);
            window.showToast && window.showToast("Restore lengkap berhasil (" + count + " bagian data dipulihkan) — memuat ulang halaman...", "success");
            setTimeout(function () { location.reload(); }, 1200);
          }
        } catch (err) {
          window.showToast && window.showToast("File tidak valid: " + err.message, "error");
        }
        e.target.value = "";
      });
      bound = true;
    }

    return bound;
  }

  // [BUG DITEMUKAN & DIPERBAIKI] Versi sebelumnya mencoba menghentikan
  // klik pakai stopImmediatePropagation() di fase capture — di teori
  // seharusnya cukup, tapi di kondisi nyata ternyata TIDAK berhasil
  // mencegah handler lama tetap jalan (kemungkinan besar karena urutan
  // pemuatan script yang beda-beda di tiap deployment membuat asumsi
  // urutan event listener tidak selalu berlaku). Sekarang tombol/input
  // di-clone (menghapus SEMUA listener lama yang menempel secara pasti,
  // tidak bergantung pada urutan capture/bubble sama sekali) — dan
  // dicoba berkali-kali (bukan cuma sekali saat script dimuat) sampai
  // kedua elemen benar-benar ditemukan & berhasil diganti, untuk jaga-jaga
  // andai HTML-nya belum sepenuhnya termuat saat script ini pertama jalan.
  var _tries = 0;
  var _iv = setInterval(function () {
    _tries++;
    var exportOk = document.getElementById("btnExportAllJson") && document.getElementById("btnExportAllJson")._fullBackupBound;
    var importOk = document.getElementById("fileImportAllJson") && document.getElementById("fileImportAllJson")._fullBackupBound;
    bindExportImportButtons();
    if ((exportOk && importOk) || _tries > 40) clearInterval(_iv);
  }, 250);
  bindExportImportButtons();

  console.info("%c[SJNAM] Backup & Restore LENGKAP (semua modul) aktif.", "color:#0891b2;font-weight:bold;font-size:11px");
}();
