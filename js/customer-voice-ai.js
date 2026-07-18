/* ================================================================
   SJNAM — CUSTOMER VOICE: AI ANALYSIS (SERVQUAL Classifier)
   ================================================================
   Menganalisa kolom feedback bebas ("Bantu kami dengan memberikan
   masukan untuk layanan yang menurut Anda paling membutuhkan
   perbaikan...") memakai framework SERVQUAL (5 dimensi), mereplikasi
   format sheet "Analisa Ai" di file Excel asli.

   [PENTING — KETERBATASAN ARSITEKTUR, BACA INI]
   Aplikasi ini adalah web app mandiri (bukan artifact Claude), tidak
   ada server backend untuk memanggil API AI (Anthropic/OpenAI dst).
   Memanggil API tsb LANGSUNG dari browser tidak akan berhasil (CORS)
   dan menaruh API key di kode client-side adalah risiko keamanan
   serius (siapa pun bisa lihat & pakai key itu lewat View Source).

   Karena itu, "AI Generate" di sini adalah CLASSIFIER BERBASIS ATURAN
   (keyword + heuristik sentimen) — BUKAN panggilan ke LLM sungguhan.
   Ini tetap benar-benar MENGANALISA data asli (bukan template kosong),
   tapi kualitas narasinya tidak akan se-nuansa LLM asli. Kalau ingin
   upgrade ke analisa LLM sungguhan, perlu ditambahkan endpoint di
   server Node.js sendiri yang menyimpan API key dengan aman di sisi
   server, lalu tab ini tinggal diarahkan memanggil endpoint itu.
   ================================================================ */
!function () {
  "use strict";

  if (window._customerVoiceAiInit) return;
  window._customerVoiceAiInit = true;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtPct(n) { return (n * 100).toFixed(1) + "%"; }

  // ── 5 Dimensi SERVQUAL + kata kunci pemicu (Indonesia + Inggris) ──
  var DIMENSIONS = [
    {
      key: "tangibles", label: "Tangibles (Fasilitas)",
      keywords: ["kursi", "seat", " ac ", "ac,", "ac.", "pendingin", "panas", "gerah", "dingin", "kabin", "toilet", "wc", "bau", "kotor", "bersih", "meja", "interior", "sempit", "rusak", "fasilitas", "bangku", "sandaran", "jendela", "lampu"]
    },
    {
      key: "reliability", label: "Reliability (Ketepatan Waktu)",
      keywords: ["delay", "telat", "terlambat", "jadwal", "cancel", "batal", "on time", "ontime", "tepat waktu", "mundur", "dimajukan", "diundur", "ubah jadwal", "ditunda", "reschedule"]
    },
    {
      key: "responsiveness", label: "Responsiveness (Proses & Sistem)",
      keywords: ["check-in", "checkin", "check in", "web check", "boarding pass", "bagasi", "baggage", "proses", "sistem", "aplikasi", "app ", "website", "web ", " cs ", "customer service", "respon", "balas", "lambat", "antri", "antrian", "counter", "loket"]
    },
    {
      key: "assurance", label: "Assurance (Keamanan)",
      keywords: ["aman", "keamanan", "kompeten", "profesional", "safety", "lancar", "terpercaya", "yakin"]
    },
    {
      key: "empathy", label: "Empathy (Pelayanan Staf)",
      keywords: ["ramah", "senyum", "staf", "staff", "pramugari", "pramugara", "petugas", "pelayanan", "sopan", "jutek", "galak", "ketus", "kooperatif", "cuek", "kasar"]
    }
  ];

  var NEGATIVE_WORDS = ["tidak bagus", "tidak ramah", "kurang ramah", "kurang nyaman", "kurang baik", "kurang jelas",
    "gak enak", "tidak enak", "tidak jelas", "tidak nyaman", "tidak puas", "tidak sesuai", "dingin banget",
    "rusak", "bau", "kotor", "jelek", "buruk", "lambat", "lama", "kurang", "panas", "gerah", "sempit",
    "jutek", "galak", "ketus", "corrupt", "hilang", "kacau", "delay", "telat", "terlambat", "cancel", "batal",
    "berisik", "bocor", "mati", "error", "gagal", "susah", "sulit", "kecewa", "parah", "kasar", "cuek", "terlalu"];
  var POSITIVE_WORDS = ["bagus", "baik", "nyaman", "ramah", "cepat", "memuaskan", "mengesankan", "puas", "oke",
    "sudah baik", "tidak ada masalah", "lancar", "mantap", "keren", "top", "sangat baik", "profesional",
    "tidak ada keluhan", "no complaint", "aman", "tepat waktu", "sesuai", "senyum"];
  var NO_ISSUE_MARKERS = ["-", "tidak ada", "tdk ada", "nihil", "none", "n/a", "na", "no", "aman semua", "semua baik", "semua sudah baik", "tidak ada masukan", "tidak ada saran"];

  function classifyFeedback(text) {
    var t = (text || "").toLowerCase().trim();
    if (!t || NO_ISSUE_MARKERS.indexOf(t) !== -1 || t.length < 2) {
      return { dimension: null, sentiment: "positif", noIssue: true };
    }

    var matchedDims = [];
    DIMENSIONS.forEach(function (d) {
      var hit = d.keywords.some(function (kw) { return t.indexOf(kw) !== -1; });
      if (hit) matchedDims.push(d.key);
    });

    // [FIX] Susunan NEGATIVE_WORDS SENGAJA menaruh frasa gabungan
    // ("kurang ramah", "tidak ramah") di AWAL daftar, sebelum kata
    // tunggalnya ("kurang"). Dan dipakai forEach (bukan some()) supaya
    // SEMUA frasa yang cocok sempat "dibuang" dari teks — bukan cuma
    // yang PERTAMA ditemukan (some() berhenti di kecocokan pertama,
    // sehingga frasa BERIKUTNYA di daftar tidak sempat diproses).
    // Ini mencegah "tidak ramah"/"kurang ramah" (yang jelas negatif)
    // salah dihitung ganda sebagai sinyal positif hanya karena
    // mengandung kata "ramah" di dalamnya.
    var textForPositiveCheck = t;
    var hasNegative = false;
    NEGATIVE_WORDS.forEach(function (w) {
      if (t.indexOf(w) !== -1) {
        hasNegative = true;
        textForPositiveCheck = textForPositiveCheck.split(w).join(" ");
      }
    });
    var hasPositive = POSITIVE_WORDS.some(function (w) { return textForPositiveCheck.indexOf(w) !== -1; });
    var sentiment = "netral";
    if (hasNegative && !hasPositive) sentiment = "negatif";
    else if (hasPositive && !hasNegative) sentiment = "positif";
    else if (hasNegative && hasPositive) sentiment = "netral"; // campuran (sinyal positif BUKAN dari frasa negatif ternegasi) -> netral

    if (!matchedDims.length) {
      // Tidak match dimensi manapun secara spesifik, tapi ada isi teks —
      // catat sebagai "umum" (dihitung, tapi tidak ke salah satu dari 5 dimensi)
      return { dimension: null, sentiment: sentiment, noIssue: false, rawText: text };
    }
    return { dimension: matchedDims, sentiment: sentiment, noIssue: false, rawText: text };
  }

  /* ---------------------------------------------------------------
     Agregasi SERVQUAL per airline (mereplikasi struktur sheet
     "Analisa Ai": per dimensi -> Positif/Netral/Negatif/Skor/Insight)
     --------------------------------------------------------------- */
  function analyzeServqual(list, monthFilter) {
    var filtered = monthFilter ? list.filter(function (r) { return (r.tanggalTerbang || "").slice(0, 7) === monthFilter; }) : list;
    var airlinesList = ["Sriwijaya Air", "NAM Air"];
    var result = {};

    airlinesList.forEach(function (al) {
      var subset = filtered.filter(function (r) { return r.airlines === al && (r.feedbackText || "").trim(); });
      var perDim = {};
      DIMENSIONS.forEach(function (d) { perDim[d.key] = { positif: 0, netral: 0, negatif: 0, mentions: [] }; });

      subset.forEach(function (r) {
        var cls = classifyFeedback(r.feedbackText);
        if (cls.noIssue || !cls.dimension) return;
        cls.dimension.forEach(function (dimKey) {
          perDim[dimKey][cls.sentiment]++;
          perDim[dimKey].mentions.push(r.feedbackText);
        });
      });

      var dims = DIMENSIONS.map(function (d) {
        var v = perDim[d.key];
        var total = v.positif + v.netral + v.negatif;
        var score = total ? v.positif / total : 0;
        return {
          key: d.key, label: d.label, positif: v.positif, netral: v.netral, negatif: v.negatif,
          score: score, insight: buildInsight(d, v)
        };
      });

      var totalPositif = dims.reduce(function (s, d) { return s + d.positif; }, 0);
      var totalNetral = dims.reduce(function (s, d) { return s + d.netral; }, 0);
      var totalNegatif = dims.reduce(function (s, d) { return s + d.negatif; }, 0);
      var totalAll = totalPositif + totalNetral + totalNegatif;

      result[al] = {
        dims: dims,
        totalRespondenFeedback: subset.length,
        ikp: {
          positif: totalPositif, netral: totalNetral, negatif: totalNegatif,
          score: totalAll ? totalPositif / totalAll : 0,
          kategori: !totalAll ? "Belum ada data" : (totalAll && totalPositif / totalAll < 0.5 ? "Buruk. Perlu perbaikan" : (totalPositif / totalAll < 0.75 ? "Cukup. Ada ruang perbaikan" : "Baik"))
        }
      };
    });
    return result;
  }

  // ── Insight kunci: dibangun dari DATA sungguhan (kata yang paling
  //    sering muncul di keluhan dimensi itu), bukan teks template kosong —
  //    tapi TETAP bukan narasi LLM asli (lihat catatan arsitektur di atas). ──
  function buildInsight(dim, v) {
    var total = v.positif + v.netral + v.negatif;
    if (!total) return "Belum ada masukan untuk dimensi ini pada periode ini.";

    // Cari kata kunci dimensi ini yang PALING SERING muncul di kalimat feedback
    var kwCounts = {};
    v.mentions.forEach(function (text) {
      var t = text.toLowerCase();
      dim.keywords.forEach(function (kw) {
        if (t.indexOf(kw) !== -1) kwCounts[kw.trim()] = (kwCounts[kw.trim()] || 0) + 1;
      });
    });
    var topKeywords = Object.keys(kwCounts).sort(function (a, b) { return kwCounts[b] - kwCounts[a]; }).slice(0, 4);

    var pct = total ? (v.negatif / total * 100).toFixed(0) : 0;
    var label = v.negatif > v.positif ? "Perlu perhatian" : v.positif > v.negatif ? "Cukup baik" : "Beragam";
    var kwText = topKeywords.length ? "Kata kunci paling sering: " + topKeywords.join(", ") + "." : "";
    return label + ". Dari " + total + " masukan terkait dimensi ini (" + v.positif + " positif, " + v.netral + " netral, " + v.negatif + " negatif — " + pct + "% negatif). " + kwText;
  }

  /* ---------------------------------------------------------------
     Render tab AI Analysis
     --------------------------------------------------------------- */
  function ensureAiUi() {
    var section = document.getElementById("tab-cv-ai");
    if (!section || section._cvAiUiBuilt) return false;
    section._cvAiUiBuilt = true;
    section.innerHTML =
      '<div class="card p-4 md:p-5">' +
      '<div class="flex flex-wrap items-center justify-between gap-3 mb-2">' +
      '<div><h2 class="text-lg font-bold">🤖 Customer Voice — AI Analysis</h2><p class="text-xs text-slate-500 mt-0.5">Analisa SERVQUAL dari kolom feedback bebas (klasifikasi berbasis kata kunci)</p></div>' +
      '<div class="flex items-center gap-2">' +
      '<select id="cvAiMonth" class="input !w-auto"><option value="">Semua Periode</option></select>' +
      '<button type="button" id="btnCvAiGenerate" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl">✨ AI Generate</button>' +
      "</div></div>" +
      '<div class="text-[11px] text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300 rounded-lg px-3 py-2 mb-4">ℹ️ Analisa ini berbasis klasifikasi kata kunci otomatis (bukan panggilan ke LLM eksternal) — hasilnya membantu tapi sebaiknya tetap direview manual untuk keputusan penting.</div>' +
      '<div id="cvAiResult"><p class="text-sm text-slate-400 text-center py-8">Klik "✨ AI Generate" untuk menganalisa data feedback.</p></div>' +
      "</div>";
    return true;
  }

  function populateMonthOptions(list) {
    var sel = document.getElementById("cvAiMonth");
    if (!sel) return;
    var months = Array.from(new Set(list.map(function (r) { return (r.tanggalTerbang || "").slice(0, 7); }).filter(Boolean))).sort().reverse();
    var cur = sel.value;
    sel.innerHTML = '<option value="">Semua Periode</option>' + months.map(function (m) { return '<option value="' + m + '">' + m + "</option>"; }).join("");
    if (months.indexOf(cur) !== -1) sel.value = cur;
  }

  function scoreColorClass(pct) {
    if (pct < 0.5) return "text-red-600 dark:text-red-400";
    if (pct < 0.75) return "text-amber-600 dark:text-amber-400";
    return "text-emerald-600 dark:text-emerald-400";
  }

  function renderAirlineCard(airlineName, data) {
    var rowsHtml = data.dims.map(function (d) {
      var total = d.positif + d.netral + d.negatif;
      return (
        '<tr><td class="p-2 font-medium">' + esc(d.label) + "</td>" +
        '<td class="p-2 text-center">' + d.positif + "</td>" +
        '<td class="p-2 text-center">' + d.netral + "</td>" +
        '<td class="p-2 text-center">' + d.negatif + "</td>" +
        '<td class="p-2 text-center font-semibold ' + scoreColorClass(d.score) + '">' + (total ? fmtPct(d.score) : "-") + "</td>" +
        '<td class="p-2 text-xs text-slate-600 dark:text-slate-300">' + esc(d.insight) + "</td></tr>"
      );
    }).join("");

    return (
      '<div class="card p-4 mb-4">' +
      '<div class="flex items-center justify-between mb-3"><h3 class="font-bold">' + esc(airlineName) + '</h3><span class="text-xs text-slate-400">' + data.totalRespondenFeedback + " feedback dianalisa</span></div>" +
      '<div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 mb-3">' +
      '<table class="w-full text-sm"><thead class="bg-slate-50 dark:bg-slate-800"><tr class="text-left">' +
      '<th class="p-2 font-semibold">Dimensi</th><th class="p-2 font-semibold text-center">Positif</th><th class="p-2 font-semibold text-center">Netral</th><th class="p-2 font-semibold text-center">Negatif</th><th class="p-2 font-semibold text-center">Skor</th><th class="p-2 font-semibold">Insight Kunci</th>' +
      "</tr></thead><tbody>" + rowsHtml + "</tbody></table></div>" +
      '<div class="flex items-center gap-3 text-sm">' +
      '<span class="font-semibold">IKP Keseluruhan:</span>' +
      '<span class="' + scoreColorClass(data.ikp.score) + ' font-bold">' + fmtPct(data.ikp.score) + "</span>" +
      '<span class="text-slate-400 text-xs">(' + data.ikp.positif + " positif, " + data.ikp.netral + " netral, " + data.ikp.negatif + " negatif) — " + esc(data.ikp.kategori) + "</span>" +
      "</div></div>"
    );
  }

  function runAiGenerate() {
    var list = (window.CustomerVoice && window.CustomerVoice.load()) || [];
    populateMonthOptions(list);
    var monthFilter = (document.getElementById("cvAiMonth") || {}).value || "";
    var withFeedback = list.filter(function (r) { return (r.feedbackText || "").trim(); });

    if (!withFeedback.length) {
      document.getElementById("cvAiResult").innerHTML = '<p class="text-sm text-slate-400 text-center py-8">Belum ada data dengan feedback teks untuk dianalisa.</p>';
      return;
    }

    var result = analyzeServqual(list, monthFilter);
    var resultEl = document.getElementById("cvAiResult");
    resultEl.innerHTML = renderAirlineCard("Sriwijaya Air", result["Sriwijaya Air"]) + renderAirlineCard("NAM Air", result["NAM Air"]);
    "function" === typeof window.showToast && window.showToast("Analisa AI selesai dibuat", "success");
  }

  function wireEvents() {
    var btn = document.getElementById("btnCvAiGenerate");
    if (btn && !btn._cvBound) { btn._cvBound = true; btn.addEventListener("click", runAiGenerate); }
    var sel = document.getElementById("cvAiMonth");
    if (sel && !sel._cvBound) { sel._cvBound = true; sel.addEventListener("change", runAiGenerate); }
  }

  window.CustomerVoiceAi = { classifyFeedback: classifyFeedback, analyzeServqual: analyzeServqual, DIMENSIONS: DIMENSIONS, renderAirlineCard: renderAirlineCard };

  var tries = 0;
  var iv = setInterval(function () {
    tries++;
    ensureAiUi();
    // [FIX BUG KRITIS] Sama persis dengan perbaikan di
    // customer-voice-summary.js — cek keberadaan elemen langsung,
    // bukan "apakah ensureAiUi() BARU SAJA membangun UI di panggilan
    // ini". Kalau tidak, wireEvents() bisa TIDAK PERNAH terpasang
    // kalau tab ini sudah lebih dulu ter-render lewat event
    // "sjn:tab-changed" (mis. saat sesi dipulihkan setelah refresh).
    var ready = !!document.getElementById("cvAiMonth");
    if (ready) { wireEvents(); populateMonthOptions((window.CustomerVoice && window.CustomerVoice.load()) || []); }
    if (ready || tries > 60) clearInterval(iv);
  }, 250);

  // [PATCH perf] Jalur cepat tambahan via event global "sjn:app-ready" —
  // polling di atas tetap fallback. ensureAiUi() idempotent (guard
  // _cvAiUiBuilt), aman dipanggil dobel oleh polling+event.
  document.addEventListener("sjn:app-ready", function () {
    console.log("[CustomerVoiceAi] Menerima event 'sjn:app-ready' — coba inisialisasi lebih awal.");
    ensureAiUi();
    if (document.getElementById("cvAiMonth")) { wireEvents(); populateMonthOptions((window.CustomerVoice && window.CustomerVoice.load()) || []); }
  });

  document.addEventListener("sjn:tab-changed", function (e) {
    if (e && e.detail && e.detail.tab === "cv-ai") setTimeout(function () { populateMonthOptions((window.CustomerVoice && window.CustomerVoice.load()) || []); }, 80);
  });

  console.info("%c[SJNAM] Customer Voice AI Analysis aktif.", "color:#7c3aed;font-weight:bold;font-size:11px");
}();
