!function () {
  if (window._bankStationSyncInit) return void console.warn("[SJNAM] bank-station-sync.js sudah pernah dimuat, eksekusi ulang dibatalkan.");
  window._bankStationSyncInit = true;

  const trainingData = window.trainingData, esc = window.esc, saveTraining = window.saveTraining, fmtDate = window.fmtDate || (d => d || "-");

  // [PATCH] Helper lokal, meniru persis logika addYears() di training.js
  // (tidak di-expose ke window oleh training.js, jadi dibuat ulang di
  // sini secara mandiri supaya file ini tidak bergantung ke internal
  // training.js yang bisa berubah sewaktu-waktu).
  function addYearsLocal(dateStr, years) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "" : `${d.getFullYear() + years}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // [PATCH] Hitung status training: "Expired" (kalau Berlaku Hingga
  // sudah lewat hari ini), atau "X hari lagi" (dihitung dari HARI INI,
  // bukan dari Tanggal Training — karena tujuannya menandai kapan
  // sertifikat/izin training akan kedaluwarsa, bukan durasi training itu
  // sendiri, yang selalu tetap 2 tahun). Kalau tersisa <=60 hari (~2
  // bulan) diberi indikator bulatan merah; kalau sudah Expired, seluruh
  // sel diblok merah penuh.
  const NEAR_EXPIRY_DAYS = 60;
  function computeStatusTraining(berlaku) {
    if (!berlaku) return { label: "-", cellClass: "", showDot: false, diffDays: null };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const exp = new Date(berlaku); exp.setHours(0, 0, 0, 0);
    if (isNaN(exp.getTime())) return { label: "-", cellClass: "", showDot: false, diffDays: null };
    const diffDays = Math.round((exp.getTime() - today.getTime()) / 864e5);
    if (diffDays < 0) {
      return { label: "Expired", cellClass: "bg-red-600 text-white font-bold text-center rounded", showDot: false, diffDays: diffDays };
    }
    return { label: diffDays + " hari lagi", cellClass: "", showDot: diffDays <= NEAR_EXPIRY_DAYS, diffDays: diffDays };
  }

  // [PATCH] Label & badge warna Airlines — meniru logika label yang
  // sudah dipakai di Bank Data Peserta (training.js: "nam"===p.airlines
  // ? "NAM Air" : "Sriwijaya Air"). Warna: Sriwijaya = biru, NAM Air =
  // merah, konsisten dengan skema warna airline yang sudah dipakai di
  // modul lain (Customer Voice, dsb).
  function airlinesLabel(raw) {
    return "nam" === String(raw || "").trim().toLowerCase() ? "NAM Air" : "Sriwijaya Air";
  }
  function airlinesBadgeClass(raw) {
    return "nam" === String(raw || "").trim().toLowerCase()
      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
      : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
  }

  function buildStationRows() {
    const peserta = Array.isArray(trainingData.peserta) ? trainingData.peserta : [], map = new Map;
    return peserta.forEach(p => {
      const stasiun = (p.stasiun || "").trim();
      if (!stasiun) return;
      const perusahaan = (p.perusahaan || "").trim(), tanggal = p.tanggal || "", berlaku = p.expiredDate || "",
        airlines = (p.airlines || "").trim(),
        key = [stasiun.toLowerCase(), perusahaan.toLowerCase(), tanggal, berlaku, airlines.toLowerCase()].join("|");
      map.has(key) ? map.get(key).qty++ : map.set(key, { stasiun: stasiun, perusahaan: perusahaan, tanggal: tanggal, berlaku: berlaku, airlines: airlines, qty: 1 });
    }), Array.from(map.values()).sort((a, b) => {
      const da = a.tanggal || "", db = b.tanggal || "";
      return da !== db ? db.localeCompare(da) : (a.stasiun || "").localeCompare(b.stasiun || "");
    });
  }

  function updateServiceSyncIndicator() {
    const dot = document.getElementById("serviceSyncDot"), lbl = document.getElementById("serviceSyncLabel");
    if (!dot || !lbl) return;
    const connected = "undefined" != typeof cloudConfig && cloudConfig.supabaseUrl;
    dot.className = "w-2 h-2 rounded-full " + (connected ? "bg-emerald-500" : "bg-slate-300"), lbl.textContent = "Smart-Sync: " + (connected ? "ON" : "Belum terhubung");
  }

  // Menyimpan hasil render TERAKHIR supaya listener "change" pada input
  // tanggal bisa tahu persis baris mana (stasiun/perusahaan/tanggal LAMA/
  // berlaku LAMA) yang sedang diedit, untuk mencari peserta yang cocok.
  let lastRenderedRows = [];

  // [PATCH] Saat "Tanggal Training" pada satu baris Bank Station diedit:
  // 1) Hitung ulang "Berlaku Hingga" = Tanggal Training baru + 2 tahun.
  // 2) Terapkan ke SEMUA peserta di trainingData.peserta yang tadinya
  //    tergabung dalam baris grup ini (kunci lama: stasiun+perusahaan+
  //    tanggal lama+berlaku lama) — karena satu baris Bank Station bisa
  //    mewakili banyak peserta sekaligus (lihat Qty Peserta).
  // 3) Simpan & render ulang.
  function handleTanggalTrainingEdit(rowIndex, newTanggal) {
    const old = lastRenderedRows[rowIndex];
    if (!old) {
      console.warn("[BankStation][EditTanggal] GAGAL — baris index " + rowIndex + " tidak ditemukan di data terakhir yang dirender.");
      return;
    }
    if (!newTanggal) {
      console.warn("[BankStation][EditTanggal] Tanggal baru kosong, perubahan dibatalkan.");
      "function" === typeof window.showToast && window.showToast("Tanggal tidak boleh kosong", "error");
      return;
    }
    const newBerlaku = addYearsLocal(newTanggal, 2);
    console.log("[BankStation][EditTanggal] Mulai — stasiun:", old.stasiun, "| perusahaan:", old.perusahaan, "| airlines:", airlinesLabel(old.airlines), "| tanggal lama:", old.tanggal, "-> tanggal baru:", newTanggal, "| berlaku lama:", old.berlaku, "-> berlaku baru (otomatis, +2 tahun):", newBerlaku);

    const peserta = Array.isArray(trainingData.peserta) ? trainingData.peserta : [];
    let affected = 0;
    peserta.forEach(p => {
      const stasiun = (p.stasiun || "").trim().toLowerCase(), perusahaan = (p.perusahaan || "").trim().toLowerCase(), airlines = (p.airlines || "").trim().toLowerCase();
      if (stasiun === old.stasiun.toLowerCase() && perusahaan === old.perusahaan.toLowerCase() && airlines === (old.airlines || "").toLowerCase() && (p.tanggal || "") === old.tanggal && (p.expiredDate || "") === old.berlaku) {
        p.tanggal = newTanggal;
        p.expiredDate = newBerlaku;
        affected++;
      }
    });

    if (!affected) {
      console.warn("[BankStation][EditTanggal] Tidak ada peserta yang cocok dengan baris ini — kemungkinan data sudah berubah di tempat lain. Coba refresh halaman.");
      "function" === typeof window.showToast && window.showToast("Gagal menemukan data peserta terkait — coba refresh halaman", "error");
      return;
    }

    "function" === typeof saveTraining && saveTraining();
    console.log("[BankStation][EditTanggal] BERHASIL — " + affected + " peserta diperbarui (Tanggal Training & Berlaku Hingga ikut berubah).");
    "function" === typeof window.showToast && window.showToast("Tanggal Training diperbarui — " + affected + " peserta ikut diperbarui, Berlaku Hingga otomatis mengikuti", "success");
    window.renderBankStations();
  }

  // [PATCH] Filter Bank Station — Airlines, Stasiun, Perusahaan.
  // Filter hanya memengaruhi TAMPILAN (dan Export Excel mengikuti hasil
  // filter yang sedang aktif); data mentah trainingData.stations tetap
  // menyimpan SELURUH baris (tidak terpotong oleh filter).
  function getStationFilterEls() {
    return {
      airlines: document.getElementById("stationFilterAirlines"),
      stasiun: document.getElementById("stationFilterStasiun"),
      perusahaan: document.getElementById("stationFilterPerusahaan")
    };
  }

  function populateStationFilterOptions(rows) {
    const els = getStationFilterEls();
    // [PATCH] Sebelumnya logika populate-dropdown ditulis manual di sini
    // (duplikat persis dengan yang ada di training.js untuk filter Bank
    // Data Peserta). Sekarang pakai window.populateFilterSelect() dari
    // shared-utils.js — perilaku identik, tapi 1 sumber kebenaran.
    window.populateFilterSelect(els.stasiun, rows.map(r => r.stasiun), "Semua Stasiun", "sjnam_bankstation_filter_stasiun_v1");
    window.populateFilterSelect(els.perusahaan, rows.map(r => r.perusahaan), "Semua Perusahaan", "sjnam_bankstation_filter_perusahaan_v1");
  }

  function applyStationFilters(rows) {
    const els = getStationFilterEls();
    const fAirlines = (els.airlines && els.airlines.value) || "", fStasiun = (els.stasiun && els.stasiun.value) || "", fPerusahaan = (els.perusahaan && els.perusahaan.value) || "";
    const filtered = rows.filter(r => {
      const matchAirlines = !fAirlines || String(r.airlines || "").trim().toLowerCase() === fAirlines.toLowerCase();
      const matchStasiun = !fStasiun || r.stasiun === fStasiun;
      const matchPerusahaan = !fPerusahaan || r.perusahaan === fPerusahaan;
      return matchAirlines && matchStasiun && matchPerusahaan;
    });
    console.log("[BankStation][Filter] Diterapkan — Airlines:", fAirlines || "(semua)", "| Stasiun:", fStasiun || "(semua)", "| Perusahaan:", fPerusahaan || "(semua)", "| Hasil:", filtered.length, "dari", rows.length, "baris.");
    return filtered;
  }

  let stationFilterWired = false;
  function wireStationFilterEvents() {
    if (stationFilterWired) return;
    stationFilterWired = true;
    const els = getStationFilterEls();
    window.bindFilterPersistence(els.airlines, "sjnam_bankstation_filter_airlines_v1");
    els.stasiun && els.stasiun.addEventListener("change", () => {
      console.log("[BankStation][Filter] Filter diubah oleh user, render ulang tabel...");
      window.renderBankStations();
    });
    els.perusahaan && els.perusahaan.addEventListener("change", () => {
      console.log("[BankStation][Filter] Filter diubah oleh user, render ulang tabel...");
      window.renderBankStations();
    });
    els.airlines && els.airlines.addEventListener("change", () => {
      console.log("[BankStation][Filter] Filter diubah oleh user, render ulang tabel...");
      window.renderBankStations();
    });
    const resetBtn = document.getElementById("btnStationFilterReset");
    resetBtn && resetBtn.addEventListener("click", () => {
      const e2 = getStationFilterEls();
      e2.airlines && (e2.airlines.value = "");
      e2.stasiun && (e2.stasiun.value = "");
      e2.perusahaan && (e2.perusahaan.value = "");
      // [PATCH] Reset filter juga menghapus nilai yang tersimpan --
      // supaya setelah reset, filter TIDAK muncul lagi walau di-refresh.
      try {
        localStorage.removeItem("sjnam_bankstation_filter_airlines_v1");
        localStorage.removeItem("sjnam_bankstation_filter_stasiun_v1");
        localStorage.removeItem("sjnam_bankstation_filter_perusahaan_v1");
      } catch (e) {}
      console.log("[BankStation][Filter] Direset ke semua data (termasuk hapus dari localStorage).");
      window.renderBankStations();
    });
    console.log("[BankStation][Filter] Listener filter Airlines/Stasiun/Perusahaan/Reset berhasil dipasang — filter akan bertahan lintas refresh.");
  }

  window.renderBankStations = function () {
    const tbody = document.getElementById("stationTableBody");
    if (!tbody) return;
    const allRows = buildStationRows();
    const changed = JSON.stringify(trainingData.stations || []) !== JSON.stringify(allRows);
    trainingData.stations = allRows, changed && "function" == typeof saveTraining && saveTraining();

    wireStationFilterEvents();
    populateStationFilterOptions(allRows);
    const rows = applyStationFilters(allRows);
    lastRenderedRows = rows; // snapshot HASIL FILTER, dipakai handleTanggalTrainingEdit (index harus cocok dgn yg ditampilkan)

    const countEl = document.getElementById("stationTotalCount");
    // [PATCH] "Total Station" sebelumnya = rows.length (jumlah BARIS),
    // padahal 1 stasiun bisa muncul di banyak baris (beda
    // perusahaan/airlines/tanggal training). Sekarang dihitung dari
    // STASIUN UNIK saja — CGK muncul 5 baris tetap dihitung 1 station.
    const uniqueStasiunFiltered = new Set(rows.map(r => (r.stasiun || "").trim().toUpperCase())).size;
    const uniqueStasiunAll = new Set(allRows.map(r => (r.stasiun || "").trim().toUpperCase())).size;
    countEl && (countEl.textContent = uniqueStasiunFiltered + (uniqueStasiunFiltered !== uniqueStasiunAll ? " / " + uniqueStasiunAll : ""));
    console.log("[BankStation][TotalStation] Jumlah baris tampil:", rows.length, "| Stasiun UNIK tampil:", uniqueStasiunFiltered, "| Stasiun UNIK total (tanpa filter):", uniqueStasiunAll, "-> yang ditampilkan di 'Total Station' adalah jumlah stasiun unik, bukan jumlah baris.");

    const statuses = rows.map(s => computeStatusTraining(s.berlaku));
    const expiredCount = statuses.filter(st => st.diffDays !== null && st.diffDays < 0).length;
    const nearExpiryCount = statuses.filter(st => st.showDot).length;
    const sjCount = rows.filter(s => airlinesLabel(s.airlines) === "Sriwijaya Air").length, namCount = rows.length - sjCount;
    console.log("[BankStation][Render] Ditampilkan:", rows.length, "dari total", allRows.length, "| Sriwijaya Air:", sjCount, "| NAM Air:", namCount, "| Expired:", expiredCount, "| Mendekati kedaluwarsa (<=" + NEAR_EXPIRY_DAYS + " hari, bulatan merah):", nearExpiryCount);

    rows.length ? tbody.innerHTML = rows.map((s, i) => {
      const statusInfo = statuses[i];
      const dotHtml = statusInfo.showDot ? ' <span class="inline-block w-2.5 h-2.5 rounded-full bg-red-500 align-middle" title="Mendekati kedaluwarsa (<= ' + NEAR_EXPIRY_DAYS + ' hari)"></span>' : "";
      return `
      <tr>
        <td class="px-3 py-2">${i + 1}</td>
        <td class="px-3 py-2">${esc(s.stasiun || "")}</td>
        <td class="px-3 py-2">${esc(s.perusahaan || "")}</td>
        <td class="px-3 py-2"><input type="date" value="${esc(s.tanggal || "")}" data-station-edit-tanggal="${i}" class="input !py-1 !text-xs !w-auto"></td>
        <td class="px-3 py-2">${esc(fmtDate(s.berlaku))}</td>
        <td class="px-3 py-2 ${statusInfo.cellClass}">${statusInfo.label}${dotHtml}</td>
        <td class="px-3 py-2"><span class="badge ${airlinesBadgeClass(s.airlines)}">${airlinesLabel(s.airlines)}</span></td>
        <td class="px-3 py-2 text-center font-semibold text-blue-700 dark:text-blue-300">${s.qty || 1}</td>
      </tr>`;
    }).join("") : tbody.innerHTML = '<tr><td colspan="8" class="px-3 py-6 text-center text-sm text-slate-500">' + (allRows.length ? "Tidak ada data yang cocok dengan filter." : "Belum ada data station (isi Bank Data Peserta terlebih dahulu).") + '</td></tr>';

    tbody.querySelectorAll("[data-station-edit-tanggal]").forEach(input => {
      input.addEventListener("change", e => {
        const idx = parseInt(e.target.dataset.stationEditTanggal, 10);
        handleTanggalTrainingEdit(idx, e.target.value);
      });
    });
  };

  document.getElementById("btnExportStation")?.addEventListener("click", () => {
    const allRows = buildStationRows();
    const rows = applyStationFilters(allRows);
    if (!rows.length) return void showToast(allRows.length ? "Tidak ada data yang cocok dengan filter" : "Belum ada data station", "error");
    console.log("[BankStation][Export] Mengekspor " + rows.length + " baris (mengikuti filter yang sedang aktif) dari total " + allRows.length + " baris.");
    const exportRows = rows.map((s, i) => {
      const statusInfo = computeStatusTraining(s.berlaku);
      return { No: i + 1, Stasiun: s.stasiun, Perusahaan: s.perusahaan, "Tanggal Training": s.tanggal, "Berlaku Hingga": s.berlaku, "Status Training": statusInfo.label, Airlines: airlinesLabel(s.airlines), "Qty Peserta": s.qty || 1 };
    }), ws = XLSX.utils.json_to_sheet(exportRows);
    ws["!cols"] = [{ wch: 4 }, { wch: 20 }, { wch: 25 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bank Station"), XLSX.writeFile(wb, `Bank_Station_${todayLocalStr()}.xlsx`);
  });

  window.updateServiceSyncIndicator = updateServiceSyncIndicator;

  document.getElementById("btnSyncService")?.addEventListener("click", async () => {
    saveTraining();
    "undefined" != typeof cloudConfig && cloudConfig.supabaseUrl && cloudConfig.supabaseKey ? await cloudPush(!1) && showToast("Data Service Training berhasil disinkronkan", "success") : showToast("Data Service Training tersimpan secara lokal", "success");
    updateServiceSyncIndicator();
  });

  setTimeout(updateServiceSyncIndicator, 600);
}();
