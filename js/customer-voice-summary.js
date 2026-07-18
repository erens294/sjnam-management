/* ================================================================
   SJNAM — CUSTOMER VOICE: SUMMARY
   ================================================================
   Mereplikasi logika sheet "SUMARY" dari file Excel asli:
   - Per airline (Sriwijaya Air / NAM Air): Quantity, Value, Max Value,
     Score (Avg) keseluruhan
   - Per layanan (12 dimensi + 2 pertanyaan kepuasan): VALUE (jumlah
     skor) & SCORE (VALUE / (jumlah_respon * 6)) — dipisah per airline

   Dibangun sebagai tab TERPISAH (tab-cv-summary), baca data dari
   window.CustomerVoice.load() (customer-voice.js).
   ================================================================ */
!function () {
  "use strict";

  if (window._customerVoiceSummaryInit) return;
  window._customerVoiceSummaryInit = true;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtPct(n) { return (n * 100).toFixed(1) + "%"; }

  var ALL_FIELDS_FOR_SUMMARY = null; // diisi lazy dari window.CustomerVoice.SERVICE_FIELDS + 2 kepuasan

  function getAllFields() {
    if (ALL_FIELDS_FOR_SUMMARY) return ALL_FIELDS_FOR_SUMMARY;
    var svc = (window.CustomerVoice && window.CustomerVoice.SERVICE_FIELDS) || [];
    ALL_FIELDS_FOR_SUMMARY = svc.concat([
      { key: "overallSatisfaction", label: "Bagaimana kepuasan Anda secara umum terhadap pelayanan kami ?", shortLabel: "Overall Satisfaction" },
      { key: "recommendLikelihood", label: "Seberapa besar kemungkinan Anda merekomendasikan penerbangan kami ?", shortLabel: "Recommend Likelihood" }
    ]);
    return ALL_FIELDS_FOR_SUMMARY;
  }

  /* ---------------------------------------------------------------
     Kalkulasi ringkasan — PERSIS logika sheet SUMARY:
     VALUE = jumlah semua skor utk pertanyaan itu (per airline)
     SCORE = VALUE / (jumlah_respon_terisi * 6)
     --------------------------------------------------------------- */
  function computeSummary(list, monthFilter) {
    var filteredList = monthFilter
      ? list.filter(function (r) { return (r.tanggalTerbang || "").slice(0, 7) === monthFilter; })
      : list;

    var airlinesList = ["Sriwijaya Air", "NAM Air"];
    var perAirline = {};
    airlinesList.forEach(function (al) {
      var subset = filteredList.filter(function (r) { return r.airlines === al; });
      var fields = getAllFields();
      var perField = {};
      fields.forEach(function (f) {
        var value = 0, filled = 0;
        subset.forEach(function (r) {
          var v = Number(r[f.key]);
          if (r[f.key] !== "" && r[f.key] != null && !isNaN(v)) { value += v; filled++; }
        });
        var maxVal = filled * 6;
        perField[f.key] = { value: value, filled: filled, maxValue: maxVal, score: maxVal ? value / maxVal : 0 };
      });

      var totalValue = 0, totalMax = 0;
      fields.forEach(function (f) { totalValue += perField[f.key].value; totalMax += perField[f.key].maxValue; });

      perAirline[al] = {
        qty: subset.length,
        totalValue: totalValue,
        totalMax: totalMax,
        avgScore: totalMax ? totalValue / totalMax : 0,
        perField: perField
      };
    });

    var combinedQty = perAirline["Sriwijaya Air"].qty + perAirline["NAM Air"].qty;
    var combinedValue = perAirline["Sriwijaya Air"].totalValue + perAirline["NAM Air"].totalValue;
    var combinedMax = perAirline["Sriwijaya Air"].totalMax + perAirline["NAM Air"].totalMax;

    return {
      perAirline: perAirline,
      combined: { qty: combinedQty, value: combinedValue, maxValue: combinedMax, avgScore: combinedMax ? combinedValue / combinedMax : 0 }
    };
  }

  /* ---------------------------------------------------------------
     Render tab Summary
     --------------------------------------------------------------- */
  function ensureSummaryUi() {
    var section = document.getElementById("tab-cv-summary");
    if (!section || section._cvSummaryUiBuilt) return false;
    section._cvSummaryUiBuilt = true;
    section.innerHTML =
      '<div class="card p-4 md:p-5">' +
      '<div class="flex flex-wrap items-center justify-between gap-3 mb-4">' +
      '<div><h2 class="text-lg font-bold">📊 Customer Voice — Summary</h2><p class="text-xs text-slate-500 mt-0.5">Ringkasan skor per layanan, per airline</p></div>' +
      '<div class="flex items-center gap-2 no-print">' +
      '<select id="cvSummaryMonth" class="input !w-auto"><option value="">Semua Periode</option></select>' +
      '<button type="button" id="btnCvSummaryExportPdf" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl whitespace-nowrap">📕 Export PDF</button>' +
      "</div></div>" +
      '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5" id="cvSummaryKpiGrid"></div>' +
      '<div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">' +
      '<table class="w-full text-sm"><thead class="bg-slate-50 dark:bg-slate-800"><tr class="text-left">' +
      '<th class="p-3 font-semibold">Type of Service</th>' +
      '<th class="p-3 font-semibold">Category</th>' +
      '<th class="p-3 font-semibold text-right">Sriwijaya Air (Value)</th><th class="p-3 font-semibold text-right">Sriwijaya Air (Score)</th>' +
      '<th class="p-3 font-semibold text-right">NAM Air (Value)</th><th class="p-3 font-semibold text-right">NAM Air (Score)</th>' +
      "</tr></thead><tbody id=\"cvSummaryTableBody\"></tbody></table></div>" +
      "</div>" +
      '<div class="card p-4 md:p-5 mt-5">' +
      '<div class="no-print">' +
      '<h3 class="font-bold mb-1">🤖 Analisa AI — Customer Voice</h3>' +
      '<p class="text-xs text-slate-500 mb-4">Analisa SERVQUAL otomatis dari kolom feedback bebas, mengikuti periode yang sama dengan Summary di atas.</p>' +
      "</div>" +
      '<div id="cvSummaryAiResult"><p class="text-sm text-slate-400 text-center py-6">Belum ada data feedback untuk dianalisa pada periode ini.</p></div>' +
      "</div>" +
      '<div class="card p-4 md:p-5 mt-5">' +
      '<div class="flex flex-wrap items-center justify-between gap-3 mb-4 no-print">' +
      '<div><h3 class="font-bold">📈 Trend Bulanan per Tahun</h3><p class="text-xs text-slate-500 mt-0.5">Skor tiap Type of Service, per bulan, untuk tahun yang dipilih</p></div>' +
      '<div class="flex items-center gap-2"><label for="cvSummaryYear" class="text-xs font-medium text-slate-500">Tahun</label>' +
      '<select id="cvSummaryYear" class="input !w-auto"></select></div>' +
      "</div>" +
      '<div class="mb-8">' +
      '<div class="flex items-center gap-2 mb-2"><span class="inline-block w-3.5 h-3.5 rounded-full" style="background:var(--brand-600,#2563eb)"></span><h4 class="font-semibold text-sm">Sriwijaya Air — Customer Voice</h4></div>' +
      '<div style="position:relative;height:clamp(260px,45vh,420px)"><canvas id="cvSummaryChartSJ"></canvas></div>' +
      "</div>" +
      '<div>' +
      '<div class="flex items-center gap-2 mb-2"><span class="inline-block w-3.5 h-3.5 rounded-full" style="background:#dc2626"></span><h4 class="font-semibold text-sm">NAM Air — Customer Voice</h4></div>' +
      '<div style="position:relative;height:clamp(260px,45vh,420px)"><canvas id="cvSummaryChartNAM"></canvas></div>' +
      "</div>" +
      "</div>";
    // [PATCH perf/appearance] Circle biru Sriwijaya sekarang pakai token
    // desain yang SUDAH ADA di app (--brand-600, dipakai jg oleh tombol2
    // biru lain) — bukan hex baru — supaya konsisten & gampang diganti
    // sekali tempat kalau tema berubah. Circle merah NAM Air tetap
    // #dc2626 (Tailwind red-600) karena itu sudah jadi warna "merah" resmi
    // di tab ini (dipakai tombol Export PDF di atas), jadi konsisten
    // secara lokal tanpa perlu token baru.
    // Tinggi chart diubah dari fixed 380px -> clamp(260px,45vh,420px)
    // supaya proporsional di layar kecil/HP, tidak overflow atau kepotong.
    console.log("[CustomerVoiceSummary] ensureSummaryUi() — urutan blok: KPI+Tabel → Analisa AI → Trend Bulanan per Tahun (chart dipindah ke paling bawah, tinggi chart kini responsif).");
    return true;
  }

  function scoreColorClass(pct) {
    if (pct < 0.5) return "text-red-600 dark:text-red-400";
    if (pct < 0.75) return "text-amber-600 dark:text-amber-400";
    return "text-emerald-600 dark:text-emerald-400";
  }

  function populateMonthOptions(list) {
    var sel = document.getElementById("cvSummaryMonth");
    if (!sel) return;
    var months = Array.from(new Set(list.map(function (r) { return (r.tanggalTerbang || "").slice(0, 7); }).filter(Boolean))).sort().reverse();
    var cur = sel.value;
    // [PATCH] Persistensi filter lintas refresh — kalau elemen ini belum
    // pernah di-bind, coba pulihkan dari localStorage dulu sebelum opsi dirender.
    if (!sel._sjnFilterPersistBound) {
      try { var saved = localStorage.getItem("sjnam_cv_summary_filter_month_v1"); if (null !== saved) cur = saved; } catch (e) {}
    }
    sel.innerHTML = '<option value="">Semua Periode</option>' + months.map(function (m) { return '<option value="' + m + '">' + m + "</option>"; }).join("");
    if (months.indexOf(cur) !== -1) sel.value = cur;
    if (!sel._sjnFilterPersistBound) {
      sel._sjnFilterPersistBound = true;
      sel.addEventListener("change", function () {
        try { localStorage.setItem("sjnam_cv_summary_filter_month_v1", sel.value); } catch (e) {}
      });
    }
  }

  /* ---------------------------------------------------------------
     [PATCH] Chart Trend Bulanan per Tahun — mereplikasi chart stacked
     bar "Sriwijaya Air - Customer Voice" / "NAM Air - Customer Voice"
     dari lampiran user: sumbu X = 12 Type of Service, tiap bulan pada
     tahun terpilih jadi 1 dataset (stacked), nilainya = SCORE (%)
     bulan itu untuk layanan tsb.
     --------------------------------------------------------------- */
  var MONTH_NAMES_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  // Palet warna per bulan (bulan ke-1..12) — konsisten dipakai lintas
  // tahun supaya "Jan" selalu warna yang sama, dst. Meniru palet
  // default Excel pada screenshot lampiran (navy, orange, hijau tua,
  // cyan, ungu, hijau muda, ...).
  var MONTH_COLOR_PALETTE = [
    "#1F3864", "#ED7D31", "#375623", "#2E9EC4", "#7030A0", "#92D050",
    "#C00000", "#FFC000", "#00B0F0", "#D6558C", "#808080", "#4472C4"
  ];

  var _cvCharts = { sj: null, nam: null };

  function populateYearOptions(list) {
    var sel = document.getElementById("cvSummaryYear");
    if (!sel) { console.warn("[CustomerVoiceSummary] #cvSummaryYear tidak ditemukan di DOM — chart trend dilewati."); return null; }
    var years = Array.from(new Set(list.map(function (r) { return (r.tanggalTerbang || "").slice(0, 4); }).filter(Boolean))).sort().reverse();
    console.log("[CustomerVoiceSummary] populateYearOptions() — tahun terdeteksi dari data:", years);
    if (!years.length) { sel.innerHTML = ""; return null; }
    var cur = sel.value;
    // [PATCH] Persistensi filter lintas refresh — pulihkan tahun yang
    // terakhir dipilih (kalau masih ada di data), baru kalau tidak valid
    // fallback ke tahun terbaru (perilaku lama).
    if (!sel._sjnFilterPersistBound) {
      try { var saved = localStorage.getItem("sjnam_cv_summary_filter_year_v1"); if (null !== saved) cur = saved; } catch (e) {}
    }
    sel.innerHTML = years.map(function (y) { return '<option value="' + y + '">' + y + "</option>"; }).join("");
    sel.value = years.indexOf(cur) !== -1 ? cur : years[0];
    if (!sel._sjnFilterPersistBound) {
      sel._sjnFilterPersistBound = true;
      sel.addEventListener("change", function () {
        try { localStorage.setItem("sjnam_cv_summary_filter_year_v1", sel.value); } catch (e) {}
      });
    }
    return sel.value;
  }

  // Hitung SCORE (%) per Type-of-Service, per bulan, utk 1 airline pada
  // tahun tertentu. Return { months: ["2026-01", ...], seriesByField: { key: [pct,...] } }
  function computeMonthlyChartData(list, year, airline) {
    var svc = (window.CustomerVoice && window.CustomerVoice.SERVICE_FIELDS) || [];
    var monthsInYear = Array.from(new Set(
      list.filter(function (r) { return r.airlines === airline && (r.tanggalTerbang || "").slice(0, 4) === year; })
        .map(function (r) { return r.tanggalTerbang.slice(0, 7); })
    )).sort();

    var perMonthPerField = {}; // { "2026-01": { website: 0.83, ... } }
    monthsInYear.forEach(function (m) {
      var subset = list.filter(function (r) { return r.airlines === airline && (r.tanggalTerbang || "").slice(0, 7) === m; });
      var perField = {};
      svc.forEach(function (f) {
        var value = 0, filled = 0;
        subset.forEach(function (r) {
          var v = Number(r[f.key]);
          if (r[f.key] !== "" && r[f.key] != null && !isNaN(v)) { value += v; filled++; }
        });
        perField[f.key] = filled ? value / (filled * 6) : 0;
      });
      perMonthPerField[m] = perField;
    });

    console.log("[CustomerVoiceSummary] computeMonthlyChartData() — airline:", airline, "| tahun:", year, "| bulan ditemukan:", monthsInYear);
    return { months: monthsInYear, svc: svc, perMonthPerField: perMonthPerField };
  }

  function monthLabel(monthKey) {
    // "2026-01" -> "Jan-26"
    var parts = (monthKey || "").split("-");
    if (parts.length !== 2) return monthKey;
    var idx = parseInt(parts[1], 10) - 1;
    var yy = parts[0].slice(2);
    return (MONTH_NAMES_ID[idx] || parts[1]) + "-" + yy;
  }

  function renderAirlineChart(canvasId, chartRefKey, list, year, airline) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) { console.warn("[CustomerVoiceSummary] Canvas #" + canvasId + " tidak ditemukan — render chart dilewati."); return; }
    if ("undefined" === typeof Chart) { console.warn("[CustomerVoiceSummary] Library Chart.js belum termuat — render chart dilewati."); return; }

    var data = computeMonthlyChartData(list, year, airline);

    if (_cvCharts[chartRefKey]) {
      try { _cvCharts[chartRefKey].destroy(); } catch (eDestroy) { console.warn("[CustomerVoiceSummary] Gagal destroy chart lama (" + chartRefKey + "):", eDestroy); }
      _cvCharts[chartRefKey] = null;
    }

    if (!data.months.length) {
      var ctxEmpty = canvas.getContext("2d");
      // [FIX BUG] Sebelumnya ctxEmpty.clearRect() dipanggil tanpa cek
      // null -- kalau context 2D gagal didapat (mis. canvas sedang
      // tersembunyi/belum siap), ini melempar TypeError yang TIDAK
      // tertangkap dan menghentikan SELURUH renderSummary() di
      // tengah jalan -- KPI & tabel jadi tidak pernah ter-update sama
      // sekali (persis gejala "filter tidak ada respon").
      if (ctxEmpty) ctxEmpty.clearRect(0, 0, canvas.width, canvas.height);
      else console.warn("[CustomerVoiceSummary] canvas.getContext('2d') mengembalikan null utk '" + chartRefKey + "' — kemungkinan canvas sedang tersembunyi. Chart dilewati, TIDAK menghentikan render lainnya.");
      console.log("[CustomerVoiceSummary] Tidak ada data " + airline + " untuk tahun " + year + " — chart dikosongkan.");
      return;
    }

    var labels = data.svc.map(function (f) { return f.shortLabel || f.label; });
    var datasets = data.months.map(function (m) {
      var monthNum = parseInt(m.slice(5, 7), 10); // 1-12
      var color = MONTH_COLOR_PALETTE[(monthNum - 1) % MONTH_COLOR_PALETTE.length];
      return {
        label: monthLabel(m),
        backgroundColor: color,
        data: data.svc.map(function (f) { return +(data.perMonthPerField[m][f.key] * 100).toFixed(2); }),
        stack: "stack1"
      };
    });

    try {
      _cvCharts[chartRefKey] = new Chart(canvas.getContext("2d"), {
        type: "bar",
        data: { labels: labels, datasets: datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          scales: {
            x: { stacked: true, ticks: { autoSkip: false, maxRotation: 60, minRotation: 45, font: { size: 10 } }, grid: { display: false } },
            y: { stacked: true, display: false, grid: { display: false } }
          },
          plugins: {
            legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: { callbacks: { label: function (ctx) { return ctx.dataset.label + ": " + ctx.parsed.y.toFixed(2) + "%"; } } },
            datalabels: {
              display: function (ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; },
              color: "#fff",
              font: { size: 9, weight: "bold" },
              formatter: function (value) { return value.toFixed(2) + "%"; }
            }
          }
        }
        // Catatan: TIDAK perlu daftar ulang plugin datalabels di sini —
        // sudah di-register secara global lewat Chart.register(ChartDataLabels)
        // di index.html. Mendaftarkannya lagi lewat opsi `plugins:[...]`
        // di level instance akan membuat label tampil dobel.
      });
      console.log("[CustomerVoiceSummary] Chart '" + chartRefKey + "' berhasil dirender —", datasets.length, "dataset (bulan) x", labels.length, "layanan.");
    } catch (eChart) {
      console.error("[CustomerVoiceSummary] GAGAL membuat chart '" + chartRefKey + "':", eChart);
    }
  }

  function renderMonthlyCharts(list) {
    var section = document.getElementById("tab-cv-summary");
    if (section) {
      var blockOrder = Array.from(section.children).map(function (el, i) {
        var h = el.querySelector("h2,h3");
        return (i + 1) + ":" + (h ? h.textContent.trim() : el.id || el.className);
      });
      console.log("[CustomerVoiceSummary] Urutan blok section#tab-cv-summary saat ini:", blockOrder.join(" | "));
    }
    var year = populateYearOptions(list);
    if (!year) {
      ["cvSummaryChartSJ", "cvSummaryChartNAM"].forEach(function (id) {
        var c = document.getElementById(id);
        if (c) { var ctx = c.getContext("2d"); ctx.clearRect(0, 0, c.width, c.height); }
      });
      return;
    }
    renderAirlineChart("cvSummaryChartSJ", "sj", list, year, "Sriwijaya Air");
    renderAirlineChart("cvSummaryChartNAM", "nam", list, year, "NAM Air");
  }

  function renderSummary() {
    if (!ensureSummaryUi()) { /* sudah ada, lanjut render */ }
    var list = (window.CustomerVoice && window.CustomerVoice.load()) || [];
    console.log("[CustomerVoiceSummary] renderSummary() — total record Customer Voice:", list.length);
    populateMonthOptions(list);
    var monthFilter = (document.getElementById("cvSummaryMonth") || {}).value || "";
    var summary = computeSummary(list, monthFilter);

    var kpiGrid = document.getElementById("cvSummaryKpiGrid");
    if (kpiGrid) {
      var sj = summary.perAirline["Sriwijaya Air"];
      var nam = summary.perAirline["NAM Air"];
      kpiGrid.innerHTML =
        '<div class="card p-4"><p class="text-xs text-slate-500 mb-1">Total Customer Voice</p><p class="text-2xl font-extrabold">' + summary.combined.qty + "</p></div>" +
        '<div class="card p-4"><p class="text-xs text-slate-500 mb-1">Sriwijaya Air — Score</p><p class="text-2xl font-extrabold ' + scoreColorClass(sj.avgScore) + '">' + fmtPct(sj.avgScore) + '</p><p class="text-[11px] text-slate-400 mt-0.5">' + sj.qty + " respon</p></div>" +
        '<div class="card p-4"><p class="text-xs text-slate-500 mb-1">NAM Air — Score</p><p class="text-2xl font-extrabold ' + scoreColorClass(nam.avgScore) + '">' + fmtPct(nam.avgScore) + '</p><p class="text-[11px] text-slate-400 mt-0.5">' + nam.qty + " respon</p></div>";
    }

    var tbody = document.getElementById("cvSummaryTableBody");
    if (tbody) {
      var fields = getAllFields();
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-slate-400 text-sm">Belum ada data Customer Voice.</td></tr>';
      } else {
        tbody.innerHTML = fields.map(function (f) {
          var sjField = summary.perAirline["Sriwijaya Air"].perField[f.key];
          var namField = summary.perAirline["NAM Air"].perField[f.key];
          return (
            '<tr><td class="p-3">' + esc(f.shortLabel || f.label) + "</td>" +
            '<td class="p-3"><span class="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">' + esc(f.category || "-") + "</span></td>" +
            '<td class="p-3 text-right">' + sjField.value + "</td>" +
            '<td class="p-3 text-right font-semibold ' + scoreColorClass(sjField.score) + '">' + (sjField.filled ? fmtPct(sjField.score) : "-") + "</td>" +
            '<td class="p-3 text-right">' + namField.value + "</td>" +
            '<td class="p-3 text-right font-semibold ' + scoreColorClass(namField.score) + '">' + (namField.filled ? fmtPct(namField.score) : "-") + "</td>" +
            "</tr>"
          );
        }).join("");
      }
    }

    // ── Analisa AI di bagian bawah — pakai filter periode yang SAMA
    //    dengan Summary di atas, memakai ulang logic dari
    //    customer-voice-ai.js (tidak duplikasi kode klasifikasi). ──
    var aiResultEl = document.getElementById("cvSummaryAiResult");
    if (aiResultEl && window.CustomerVoiceAi) {
      var withFeedback = list.filter(function (r) { return (r.feedbackText || "").trim(); });
      if (!withFeedback.length) {
        aiResultEl.innerHTML = '<p class="text-sm text-slate-400 text-center py-6">Belum ada data feedback untuk dianalisa pada periode ini.</p>';
      } else {
        var aiResult = window.CustomerVoiceAi.analyzeServqual(list, monthFilter);
        aiResultEl.innerHTML =
          window.CustomerVoiceAi.renderAirlineCard("Sriwijaya Air", aiResult["Sriwijaya Air"]) +
          window.CustomerVoiceAi.renderAirlineCard("NAM Air", aiResult["NAM Air"]);
      }
    }

    // [FIX BUG] Chart dipindah ke PALING AKHIR & dibungkus try/catch.
    // Sebelumnya dipanggil di ATAS (sebelum KPI/tabel/AI) TANPA
    // try/catch -- kalau chart gagal (mis. canvas null context, error
    // Chart.js apa pun), SISA renderSummary() tidak pernah jalan, jadi
    // KPI & tabel kelihatan "diam" walau filter sudah diganti. Sekarang
    // KPI/tabel/AI DIJAMIN selalu ter-update duluan; chart cuma bonus
    // visual yang boleh gagal sendiri tanpa mengganggu yang lain.
    try {
      renderMonthlyCharts(list);
    } catch (chartErr) {
      console.error("[CustomerVoiceSummary] Chart 'Trend Bulanan per Tahun' gagal dirender, TAPI KPI/tabel/AI di atas tetap ter-update normal:", chartErr);
    }
  }

  // ── Export PDF — mengikuti PERSIS pola yang sudah dipakai STCR
  //    Dashboard: capture tiap blok anak dari section (via html2canvas),
  //    susun jadi halaman A4 potrait dengan header biru navy. ──
  async function exportSummaryPdf() {
    console.log("[CustomerVoiceSummary] Tombol Export PDF DIKLIK — handler mulai jalan.");
    var pdfBtn = document.getElementById("btnCvSummaryExportPdf");
    // [PERBAIKAN] Ubah tampilan tombol SEKETIKA (sinkron, sebelum proses
    // async html2canvas mulai) — supaya klik terasa langsung merespons,
    // tidak terasa "diam" selama beberapa detik saat html2canvas
    // merender tabel Summary + Analisa AI yang cukup panjang.
    var originalBtnHtml = pdfBtn ? pdfBtn.innerHTML : null;
    if (pdfBtn) { pdfBtn.disabled = true; pdfBtn.innerHTML = "⏳ Memproses PDF…"; }
    // Jaring pengaman: kalau karena sebab apa pun tombol tidak sempat
    // dikembalikan normal (mis. error tak terduga di luar try/catch),
    // tombol tetap otomatis pulih setelah 20 detik — tidak akan
    // "macet" selamanya.
    var safetyTimer = pdfBtn ? setTimeout(function () { pdfBtn.disabled = false; pdfBtn.innerHTML = originalBtnHtml; }, 20000) : null;

    function restoreButton() {
      if (safetyTimer) clearTimeout(safetyTimer);
      if (pdfBtn) { pdfBtn.disabled = false; pdfBtn.innerHTML = originalBtnHtml; }
    }

    if (!window.jspdf) { alert("Library jsPDF belum dimuat."); restoreButton(); return; }
    if ("undefined" === typeof html2canvas) { alert("Library html2canvas belum dimuat."); restoreButton(); return; }
    var section = document.getElementById("tab-cv-summary");
    if (!section) { alert("Tampilan Summary tidak ditemukan."); restoreButton(); return; }

    console.info("[CustomerVoiceSummary] Mulai proses export PDF…");
    "function" === typeof window.showToast && window.showToast("⏳ Menyiapkan PDF Summary Customer Voice…", "info");

    try {
      var jsPDF = window.jspdf.jsPDF;
      var doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      var W = doc.internal.pageSize.getWidth();
      var H = doc.internal.pageSize.getHeight();
      var margin = 20;
      var NAVY = [11, 30, 58];

      doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.rect(0, 0, W, 56, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(15);
      doc.setFont("helvetica", "bold");
      doc.text("CUSTOMER VOICE — SUMMARY REPORT", W / 2, 22, { align: "center" });
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Sriwijaya Air & NAM Air", W / 2, 36, { align: "center" });
      var monthSel = document.getElementById("cvSummaryMonth");
      var periodLabel = monthSel && monthSel.value ? monthSel.value : "Semua Periode";
      doc.text("Periode: " + periodLabel + " | Dicetak: " + new Date().toLocaleString("id-ID"), W / 2, 48, { align: "center" });
      doc.setTextColor(0, 0, 0);

      var noprints = section.querySelectorAll(".no-print");
      noprints.forEach(function (el) { el.style.display = "none"; });
      var bgColor = document.documentElement.classList.contains("dark") ? "#1e293b" : "#ffffff";
      var yPos = 66;
      var successCount = 0;

      try {
        var captureEls = Array.from(section.children).filter(function (el) { return !el.classList.contains("no-print"); });
        console.log("[CustomerVoiceSummary] Jumlah blok yang akan di-capture:", captureEls.length);
        for (var i = 0; i < captureEls.length; i++) {
          var el = captureEls[i];
          if (!el || el.offsetHeight < 5) { console.warn("[CustomerVoiceSummary] Blok #" + (i + 1) + " dilewati (tinggi 0 / tidak terlihat)."); continue; }
          try {
            console.log("[CustomerVoiceSummary] Meng-capture blok #" + (i + 1) + " (tinggi:", el.offsetHeight, "px)…");
            var canvas = await html2canvas(el, { scale: 1.8, backgroundColor: bgColor, logging: false, useCORS: true });
            var imgData = canvas.toDataURL("image/jpeg", 0.92);
            var imgW = W - 2 * margin;
            var imgH = (canvas.height / canvas.width) * imgW;
            if (yPos + imgH > H - 30) { doc.addPage(); yPos = margin; }
            doc.addImage(imgData, "JPEG", margin, yPos, imgW, imgH);
            yPos += imgH + 8;
            successCount++;
            console.log("[CustomerVoiceSummary] Blok #" + (i + 1) + " berhasil di-capture.");
          } catch (e2) { console.warn("[CustomerVoiceSummary] GAGAL capture blok #" + (i + 1) + ":", e2); }
        }
      } finally {
        noprints.forEach(function (el) { el.style.display = ""; });
      }

      var totalPages = doc.getNumberOfPages();
      for (var p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text("Customer Voice Summary Report — " + new Date().toLocaleDateString("id-ID"), margin, H - 12);
        doc.text("Hal " + p + " / " + totalPages, W - margin, H - 12, { align: "right" });
        doc.setTextColor(0, 0, 0);
      }

      var todayStr = new Date().toISOString().slice(0, 10);
      var pdfFilename = "Customer_Voice_Summary_" + todayStr + ".pdf";
      console.log("[CustomerVoiceSummary] Total halaman PDF:", totalPages, "| Blok berhasil di-capture:", successCount, "| Memanggil doc.save('" + pdfFilename + "')…");
      doc.save(pdfFilename);
      console.log("[CustomerVoiceSummary] doc.save() selesai dipanggil tanpa error JS (kalau file tetap tidak muncul, kemungkinan besar diblokir browser — cek ikon download di address bar).");
      console.info("[CustomerVoiceSummary] PDF berhasil dibuat & diunduh.");
      "function" === typeof window.showToast && window.showToast("PDF Summary berhasil diunduh", "success");
    } catch (e) {
      alert("Gagal export Summary PDF: " + e.message);
      console.error("[CustomerVoiceSummary] Gagal export PDF:", e);
    } finally {
      restoreButton();
    }
  }

  function wireEvents() {
    var sel = document.getElementById("cvSummaryMonth");
    if (sel && !sel._cvBound) { sel._cvBound = true; sel.addEventListener("change", renderSummary); }
    var yearSel = document.getElementById("cvSummaryYear");
    if (yearSel && !yearSel._cvBound) {
      yearSel._cvBound = true;
      yearSel.addEventListener("change", function () {
        console.log("[CustomerVoiceSummary] Filter tahun diganti ke:", yearSel.value);
        var list = (window.CustomerVoice && window.CustomerVoice.load()) || [];
        renderAirlineChart("cvSummaryChartSJ", "sj", list, yearSel.value, "Sriwijaya Air");
        renderAirlineChart("cvSummaryChartNAM", "nam", list, yearSel.value, "NAM Air");
      });
      console.log("[CustomerVoiceSummary] Listener change BERHASIL dipasang ke #cvSummaryYear.");
    }
    var pdfBtn = document.getElementById("btnCvSummaryExportPdf");
    console.log("[CustomerVoiceSummary] wireEvents() jalan — tombol PDF ditemukan:", !!pdfBtn, "| sudah pernah di-bind sebelumnya:", pdfBtn ? !!pdfBtn._cvBound : "N/A");
    if (pdfBtn && !pdfBtn._cvBound) {
      pdfBtn._cvBound = true;
      pdfBtn.addEventListener("click", exportSummaryPdf);
      console.log("[CustomerVoiceSummary] Listener klik BERHASIL dipasang ke tombol Export PDF.");
    }
  }

  window.CustomerVoiceSummary = { computeSummary: computeSummary, render: renderSummary };

  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    ensureSummaryUi();
    // [FIX BUG KRITIS] Sebelumnya: "if (uiBuilt) wireEvents()" — HANYA
    // memasang listener kalau ensureSummaryUi() BARU SAJA membangun UI
    // di panggilan ITU. Tapi kalau tab ini sudah lebih dulu ter-render
    // lewat jalur LAIN (mis. event "sjn:tab-changed" yang terpicu SEGERA
    // saat sesi login dipulihkan setelah REFRESH — lebih cepat dari
    // polling 250ms ini), ensureSummaryUi() akan SELALU return false
    // sejak saat itu (guard sudah aktif) — akibatnya wireEvents() TIDAK
    // PERNAH terpasang, filter Bulan/Tahun/tombol PDF jadi tidak
    // merespons SAMA SEKALI walau isinya sudah benar (tampak "hidup"
    // tapi tidak bereaksi). Sekarang: cek keberadaan ELEMENnya langsung
    // (persis pola yang sudah benar di customer-voice.js) — wireEvents()
    // aman dipanggil berkali-kali karena sudah idempotent sendiri
    // (dijaga flag _cvBound per elemen).
    var ready = !!document.getElementById("cvSummaryMonth");
    if (ready) wireEvents();
    if (ready || tries > 60) clearInterval(iv);
  }, 250);

  // [PATCH perf] Jalur cepat tambahan via event global "sjn:app-ready" —
  // polling di atas tetap jadi fallback, tidak dihapus. ensureSummaryUi()
  // & wireEvents() sudah idempotent, aman dipanggil dobel.
  document.addEventListener("sjn:app-ready", function () {
    console.log("[CustomerVoiceSummary] Menerima event 'sjn:app-ready' — coba inisialisasi lebih awal.");
    ensureSummaryUi();
    if (document.getElementById("cvSummaryMonth")) wireEvents();
  });

  document.addEventListener("sjn:tab-changed", function (e) {
    if (e && e.detail && e.detail.tab === "cv-summary") setTimeout(renderSummary, 80);
  });

  console.info("%c[SJNAM] Customer Voice Summary aktif.", "color:#ec4899;font-weight:bold;font-size:11px");
}();
