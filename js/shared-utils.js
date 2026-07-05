! function() {
    "use strict";

    function formatNumber(n) {
        try {
            return parseInt(n || 0).toLocaleString("id-ID")
        } catch (e) {
            return String(parseInt(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")
        }
    }
    window.$ = window.$ || (s => document.querySelector(s)), window.$$ = window.$$ || (s => document.querySelectorAll(s)), window.esc = function(s) {
        return String(null == s ? "" : s).replace(/[&<>"']/g, c => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        } [c]))
    }, window.formatNumber = formatNumber, window.formatRupiah = function(val) {
        return "Rp " + formatNumber(val)
    }, window.formatHM = function(minutes) {
        const sign = minutes < 0 ? "-" : "",
            abs = Math.abs(minutes),
            h = Math.floor(abs / 60),
            m = abs % 60;
        return `${sign}${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`
    };
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    window.MONTHS = MONTHS, window.formatDateDMY = function(iso) {
        if (!iso) return "-";
        const [y, m, d] = iso.split("-");
        return `${d}-${MONTHS[parseInt(m)-1]}-${y}`
    }, window.todayLocalStr = function() {
        const n = new Date;
        return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0")
    }, window.parseUTC = s => s ? new Date(s + "Z") : null, window.applyDarkMode = function() {
        const isDark = window.settings && window.settings.darkMode || !1;
        document.documentElement.classList.toggle("dark", isDark);
        const dmToggle = document.getElementById("darkModeToggle");
        dmToggle && (dmToggle.checked = isDark);
        const icD = document.getElementById("iconDark");
        icD && icD.classList.toggle("hidden", isDark);
        const icL = document.getElementById("iconLight");
        icL && icL.classList.toggle("hidden", !isDark)
    }, window.showToast = function(msg, type = "success") {
        if ("error" === type) {
            const eLight = document.getElementById("errorLight");
            return void(eLight && (window._errorLog || (window._errorLog = []), window._errorLog.unshift({
                msg: msg,
                time: (new Date).toLocaleTimeString("id-ID")
            }), window._errorLog.length > 20 && window._errorLog.pop(), eLight.classList.remove("active", "sticky"), eLight.offsetWidth, eLight.classList.add("active"), clearTimeout(window._errorLightTimer), window._errorLightTimer = setTimeout(() => {
                eLight.classList.remove("active"), eLight.classList.add("sticky"), clearTimeout(window._errorStickyTimer), window._errorStickyTimer = setTimeout(() => {
                    eLight.classList.remove("sticky")
                }, 3e4)
            }, 3e3), eLight.title = `❌ ${msg} (klik untuk detail)`))
        }
        const container = document.getElementById("toastContainer");
        if (!container) return void console.log("[Toast]", type, msg);
        const bg = "success" === type ? "bg-emerald-600" : "warn" === type ? "bg-amber-500" : "bg-slate-700",
            icon = "success" === type ? "✅" : "warn" === type ? "⚠️" : "ℹ️",
            el = document.createElement("div");
        el.className = `toast ${bg} pointer-events-auto text-sm`, el.textContent = `${icon} ${msg}`, container.appendChild(el), setTimeout(() => {
            el.style.opacity = "0", el.style.transform = "translateX(110%)", el.style.transition = "all .3s ease", setTimeout(() => el.remove(), 300)
        }, 3500)
    }, window.showConfirm = function(title, message) {
        return new Promise(resolve => {
            const modal = document.getElementById("confirmModal"),
                titleEl = document.getElementById("confirmTitle"),
                msgEl = document.getElementById("confirmMessage"),
                ok = document.getElementById("confirmOk"),
                cancel = document.getElementById("confirmCancel");
            if (!modal || !ok || !cancel) return void resolve(window.confirm(message || title));
            titleEl && (titleEl.textContent = title), msgEl && (msgEl.textContent = message), modal.classList.remove("hidden");
            const hOk = () => {
                    modal.classList.add("hidden"), ok.removeEventListener("click", hOk), cancel.removeEventListener("click", hCancel), resolve(!0)
                },
                hCancel = () => {
                    modal.classList.add("hidden"), ok.removeEventListener("click", hOk), cancel.removeEventListener("click", hCancel), resolve(!1)
                };
            ok.addEventListener("click", hOk), cancel.addEventListener("click", hCancel)
        })
    }, document.body.insertAdjacentHTML("beforeend", '<div id="errorLogModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;align-items:center;justify-content:center">\n    <div style="background:#fff;border-radius:12px;padding:20px;min-width:320px;max-width:480px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.4)">\n      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">\n        <h3 style="font-weight:700;color:#dc2626;font-size:1rem">❌ Log Error Sistem</h3>\n        <button id="errorLogClose" style="background:#f1f5f9;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:14px">✕ Tutup</button>\n      </div>\n      <div id="errorLogList" style="max-height:300px;overflow-y:auto;font-size:0.82rem;color:#334155"></div>\n      <button id="errorLogClear" style="margin-top:10px;background:#dc2626;color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:0.82rem">Bersihkan Log</button>\n    </div>\n  </div>'), document.getElementById("errorLogClose")?.addEventListener("click", () => {
        document.getElementById("errorLogModal").style.display = "none"
    }), document.getElementById("errorLogClear")?.addEventListener("click", () => {
        window._errorLog = [], document.getElementById("errorLogList").innerHTML = '<p style="color:#94a3b8;text-align:center;padding:16px">Log kosong</p>';
        const eLight = document.getElementById("errorLight");
        eLight && (eLight.classList.remove("active", "sticky"), eLight.title = "Ada kesalahan sistem")
    }), document.getElementById("errorLight")?.addEventListener("click", () => {
        const list = document.getElementById("errorLogList"),
            logs = window._errorLog || [];
        logs.length ? list.innerHTML = logs.map(e => `<div style="border-bottom:1px solid #f1f5f9;padding:6px 0"><span style="color:#dc2626;font-weight:600">[${e.time}]</span> ${e.msg}</div>`).join("") : list.innerHTML = '<p style="color:#94a3b8;text-align:center;padding:16px">Tidak ada error</p>', document.getElementById("errorLogModal").style.display = "flex";
        const eLight = document.getElementById("errorLight");
        eLight && (eLight.classList.remove("sticky"), clearTimeout(window._errorStickyTimer))
    })
}(),
function() {
    "use strict";
    window._LAST_PULL_TS_KEY = "sjnam_last_cloud_pull_ts_v1";

    // ---- Firebase Firestore helpers --------------------------------------------
    // Migrasi ke-2 (2026-07-03): Neon Data API dilepas karena bug persisten
    // ("jwk not found") pada custom JWKS provider yang gagal diperbaiki walau
    // sudah dicoba 3 keypair berbeda. Firestore dipilih karena: kuota gratis
    // jauh lebih longgar (reset harian, bukan bulanan), tidak perlu kartu
    // kredit, dan akses publik/tanpa-login didukung resmi lewat Security Rules
    // (bukan trik custom JWT kayak yang gagal di Neon). Tidak perlu API key
    // untuk request REST biasa — akses diatur oleh Firestore Security Rules
    // (lihat catatan "allow read, write: if true" di Firebase Console).
    function neonConfigured() {
        return "undefined" != typeof window && !!(window.SJNAM_CONFIG && window.SJNAM_CONFIG.FIREBASE_PROJECT_ID);
    }

    function firestoreBase() {
        return "https://firestore.googleapis.com/v1/projects/" + window.SJNAM_CONFIG.FIREBASE_PROJECT_ID + "/databases/(default)/documents";
    }

    // Konversi nilai JS biasa <-> format "Value" khusus Firestore REST API.
    function toFirestoreValue(v) {
        if (null == v) return {
            nullValue: null
        };
        if ("boolean" == typeof v) return {
            booleanValue: v
        };
        if ("number" == typeof v) return Number.isInteger(v) ? {
            integerValue: String(v)
        } : {
            doubleValue: v
        };
        if ("string" == typeof v) return {
            stringValue: v
        };
        if (Array.isArray(v)) return {
            arrayValue: {
                values: v.map(toFirestoreValue)
            }
        };
        if ("object" == typeof v) return {
            mapValue: {
                fields: Object.fromEntries(Object.entries(v).map(([k, val]) => [k, toFirestoreValue(val)]))
            }
        };
        return {
            stringValue: String(v)
        }
    }

    function fromFirestoreValue(fv) {
        if (!fv) return null;
        if ("nullValue" in fv) return null;
        if ("booleanValue" in fv) return fv.booleanValue;
        if ("integerValue" in fv) return parseInt(fv.integerValue, 10);
        if ("doubleValue" in fv) return fv.doubleValue;
        if ("stringValue" in fv) return fv.stringValue;
        if ("timestampValue" in fv) return fv.timestampValue;
        if ("arrayValue" in fv) return (fv.arrayValue.values || []).map(fromFirestoreValue);
        if ("mapValue" in fv) {
            const out = {},
                fields = fv.mapValue.fields || {};
            for (const k in fields) out[k] = fromFirestoreValue(fields[k]);
            return out
        }
        return null
    }

    function docToObject(doc) {
        if (!doc || !doc.fields) return null;
        const out = {};
        for (const k in doc.fields) out[k] = fromFirestoreValue(doc.fields[k]);
        // Firestore's REST API always returns its own server-assigned updateTime
        // alongside `fields` — this is authoritative regardless of any client's
        // local clock. Expose it separately so callers can use IT (not the
        // client-supplied `updated_at` field we happened to write ourselves)
        // for cross-device "is this newer?" comparisons.
        out._firestoreUpdateTime = doc.updateTime || null;
        return out
    }

    async function firestoreFetch(path, options = {}) {
        const headers = Object.assign({
            "Accept": "application/json"
        }, options.body ? {
            "Content-Type": "application/json"
        } : {}, options.headers || {});
        const res = await fetch(firestoreBase() + path, Object.assign({}, options, {
            headers: headers
        }));
        if (404 === res.status) return null;
        if (!res.ok) {
            let msg = res.status + " " + res.statusText;
            try {
                const t = await res.text();
                if (t) msg += " - " + t
            } catch (e) {}
            throw new Error(msg)
        }
        if (204 === res.status) return null;
        const text = await res.text();
        return text ? JSON.parse(text) : null
    }

    // Ambil satu dokumen by ID. Return null kalau belum ada.
    async function neonSelectOne(collection, docId) {
        const doc = await firestoreFetch("/" + collection + "/" + docId);
        return doc ? docToObject(doc) : null
    }

    // Ambil SEMUA dokumen dalam 1 collection sekaligus (1 request HTTP untuk
    // semua bucket granular) — dipakai cloudPull supaya tidak perlu 1 request
    // terpisah per bucket. Firestore mengembalikan {documents:[...]} untuk
    // collection berisi data, atau {} (tanpa field documents) kalau kosong.
    async function neonListCollection(collection) {
        const res = await firestoreFetch("/" + collection);
        if (!res || !Array.isArray(res.documents)) return [];
        return res.documents.map(doc => {
            const obj = docToObject(doc);
            if (obj) obj._docId = doc.name.split("/").pop();
            return obj
        }).filter(Boolean)
    }

    // Timpa (upsert) seluruh isi dokumen by ID — PATCH tanpa updateMask di
    // Firestore REST akan membuat dokumen baru kalau belum ada, atau
    // mengganti seluruh isinya kalau sudah ada (persis semantik "upsert").
    async function neonUpsert(collection, docId, dataObj) {
        const fields = {};
        for (const k in dataObj) fields[k] = toFirestoreValue(dataObj[k]);
        const doc = await firestoreFetch("/" + collection + "/" + docId, {
            method: "PATCH",
            body: JSON.stringify({
                fields: fields
            })
        });
        return docToObject(doc)
    }

    // Tambah dokumen baru dengan ID auto-generate (dipakai untuk audit log).
    async function neonInsert(collection, dataObj) {
        const fields = {};
        for (const k in dataObj) fields[k] = toFirestoreValue(dataObj[k]);
        await firestoreFetch("/" + collection, {
            method: "POST",
            body: JSON.stringify({
                fields: fields
            })
        })
    }

    // Query terurut/terbatas via endpoint :runQuery (dipakai audit-log-ui.js).
    async function firestoreRunQuery(collection, opts = {}) {
        const structuredQuery = {
            from: [{
                collectionId: collection
            }],
            limit: opts.limit || 50
        };
        if (opts.orderByField) structuredQuery.orderBy = [{
            field: {
                fieldPath: opts.orderByField
            },
            direction: opts.desc ? "DESCENDING" : "ASCENDING"
        }];
        if (opts.whereField) structuredQuery.where = {
            fieldFilter: {
                field: {
                    fieldPath: opts.whereField
                },
                op: "EQUAL",
                value: toFirestoreValue(opts.whereValue)
            }
        };
        const rows = await firestoreFetch(":runQuery", {
            method: "POST",
            body: JSON.stringify({
                structuredQuery: structuredQuery
            })
        });
        return (Array.isArray(rows) ? rows : []).filter(r => r.document).map(r => docToObject(r.document))
    }
    window.firestoreRunQuery = firestoreRunQuery;

    // Shim dipertahankan untuk kompatibilitas mundur (kode lain mungkin memanggil
    // window.getSupabaseClient() dan hanya mengecek truthy/falsy hasilnya).
    function getSupabaseClient() {
        return neonConfigured() ? {} : (console.warn("[Cloud Sync] Firebase belum dikonfigurasi (js/config.js) — sinkronisasi cloud dilewati."), null)
    }
    // ------------------------------------------------------------------------

    // Catatan kompatibilitas: beberapa modul lain (auth.js, training.js,
    // service-recovery.js, bank-station-sync.js) masih mengecek
    // `cloudConfig.supabaseUrl && cloudConfig.supabaseKey` sebagai gerbang
    // "apakah cloud sync sudah siap" sebelum memanggil cloudPush/cloudPull.
    // Field itu dipertahankan (diisi nilai dummy non-kosong) supaya
    // modul-modul tsb tidak perlu diubah satu per satu.
    window.cloudConfig = {
        firebaseProjectId: neonConfigured() ? window.SJNAM_CONFIG.FIREBASE_PROJECT_ID : "",
        supabaseUrl: neonConfigured() ? window.SJNAM_CONFIG.FIREBASE_PROJECT_ID : "",
        supabaseKey: neonConfigured() ? "firestore-public-rules-no-key-needed" : ""
    };

    function stampRecord(record, action = "update") {
        const user = window.currentUser;
        return {
            ...record,
            _updatedBy: user ? user.name || user.username || "unknown" : "system",
            _updatedAt: (new Date).toISOString(),
            _updatedAct: action
        }
    }

    function detectConflict(local, remote) {
        if (!local || !remote) return {
            winner: local || remote,
            loser: null,
            conflict: !1
        };
        const lt = new Date(local._updatedAt || 0).getTime(),
            rt = new Date(remote._updatedAt || 0).getTime();
        return {
            winner: lt >= rt ? local : remote,
            loser: lt >= rt ? remote : local,
            conflict: !(local._updatedBy === remote._updatedBy) && Math.abs(lt - rt) < 5e3
        }
    }

    function clearDirty(moduleName) {
        moduleName ? _dirtyModules.delete(moduleName) : _dirtyModules.clear()
    }

    function isDirty(moduleName) {
        return moduleName ? _dirtyModules.has(moduleName) : _dirtyModules.size > 0
    }

    function _hashPayload(payload) {
        try {
            const str = JSON.stringify(payload);
            let h = 0;
            for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
            return h.toString(36)
        } catch (e) {
            return null
        }
    }
    // ============ STRUKTUR DATA GRANULAR (Update: pisah 1 dokumen besar jadi banyak) ============
    // Sebelumnya: SATU dokumen (sjnam_sync/sjnam_main) berisi SEMUA modul
    // sekaligus (users, karyawan, training, stcr, drygoods, dst). Konsekuensi:
    // menyimpan perubahan di 1 modul menulis ulang SELURUH dokumen, termasuk
    // modul lain yang mungkin sedang diedit device lain — permukaan tabrakan
    // jauh lebih besar dari yang seharusnya.
    // Sekarang: setiap modul punya dokumennya SENDIRI dalam collection yang
    // sama (sjnam_sync/{bucket_id}). Mengedit Drygoods hanya menyentuh
    // dokumen "drygoods" — modul lain sama sekali tidak tersentuh, tidak
    // dibaca, tidak ditulis ulang.
    const CLOUD_BUCKETS = [
        { id: "delay_data", dirtyHints: ["data"] },
        { id: "dfs_stations", dirtyHints: ["dfsData", "stations"] },
        { id: "users", dirtyHints: ["users"] },
        { id: "karyawan", dirtyHints: ["karyawan"] },
        { id: "training", dirtyHints: ["training"] },
        { id: "stcr", dirtyHints: ["stcrData", "stcr"] },
        { id: "drygoods", dirtyHints: ["drygoodsData", "drygoods"] },
        { id: "role_perms", dirtyHints: ["rolePerms"] },
        { id: "cert_config", dirtyHints: ["certConfig", "cert"] },
        { id: "tombstones", dirtyHints: ["tombstones"] },
        { id: "settings", dirtyHints: ["settings"] }
    ];
    window._CLOUD_BUCKETS = CLOUD_BUCKETS;

    function _bucketIdForHint(hint) {
        if (!hint) return null;
        const b = CLOUD_BUCKETS.find(function(x) { return x.dirtyHints.indexOf(hint) > -1 });
        return b ? b.id : null
    }

    // Ambil potongan payload lokal yang relevan untuk 1 bucket saja, dari
    // objek lengkap yang sudah dibangun getAllCloudData().
    function pickBucketPayload(bucketId, full) {
        switch (bucketId) {
            case "delay_data": return { data: full.data };
            case "dfs_stations": return { dfsData: full.dfsData, stations: full.stations };
            case "users": return { users: full.users };
            case "karyawan": return { karyawan: full.karyawan };
            case "training": return { training: full.training };
            case "stcr": return { stcrData: full.stcrData };
            case "drygoods": return { drygoodsData: full.drygoodsData };
            case "role_perms": return { rolePerms: full.rolePerms };
            case "cert_config": return {
                certTemplate1: full.certTemplate1, certTemplate2: full.certTemplate2,
                certTemplateActive: full.certTemplateActive, certPositions: full.certPositions,
                certBarcode: full.certBarcode, certCustomTexts: full.certCustomTexts,
                certCustomTextsSJ: full.certCustomTextsSJ, certCustomTextsNAM: full.certCustomTextsNAM,
                certCustomTextsBoth: full.certCustomTextsBoth, certParaf: full.certParaf, certParafShow: full.certParafShow
            };
            case "tombstones": return { deletedTombstones: full.deletedTombstones };
            case "settings": return { settings: full.settings };
            default: return {}
        }
    }

    window._BUCKET_TS_KEY = "sjnam_bucket_ts_v1";
    window._BUCKET_HASH_KEY = "sjnam_bucket_hash_v1";

    function _loadBucketTS() {
        try { return JSON.parse(localStorage.getItem(window._BUCKET_TS_KEY) || "{}") } catch (e) { return {} }
    }
    function _saveBucketTS(obj) {
        try { localStorage.setItem(window._BUCKET_TS_KEY, JSON.stringify(obj)) } catch (e) {}
    }
    function _loadBucketHash() {
        try { return JSON.parse(localStorage.getItem(window._BUCKET_HASH_KEY) || "{}") } catch (e) { return {} }
    }
    function _saveBucketHash(obj) {
        try { localStorage.setItem(window._BUCKET_HASH_KEY, JSON.stringify(obj)) } catch (e) {}
    }

    window._realtimeChannel = null, window._bucketTS = _loadBucketTS(), window._bucketHash = _loadBucketHash(), window._autoSyncTimer = null, window._cloudPullInProgress = !1;
    const _dirtyModules = new Set;
    const _offlineQueue = function() {
        const STORE = "queue";
        let _db = null;

        function openDB() {
            return new Promise((resolve, reject) => {
                if (_db) return void resolve(_db);
                const req = indexedDB.open("sjnam_offline_q", 1);
                req.onupgradeneeded = e => {
                    const db = e.target.result;
                    db.objectStoreNames.contains(STORE) || db.createObjectStore(STORE, {
                        keyPath: "id",
                        autoIncrement: !0
                    }).createIndex("ts", "ts", {
                        unique: !1
                    })
                }, req.onsuccess = e => {
                    _db = e.target.result, resolve(_db)
                }, req.onerror = e => reject(e.target.error)
            })
        }
        return {
            enqueue: async function(payload) {
                try {
                    const db = await openDB();
                    return new Promise((res, rej) => {
                        const tx = db.transaction(STORE, "readwrite");
                        tx.objectStore(STORE).add({
                            payload: payload,
                            ts: Date.now(),
                            attempts: 0
                        }), tx.oncomplete = () => {
                            console.log("[OfflineQueue] Payload antri —", (new Date).toLocaleTimeString("id-ID")), res()
                        }, tx.onerror = e => rej(e.target.error)
                    })
                } catch (e) {
                    console.warn("[OfflineQueue] enqueue gagal:", e.message)
                }
            },
            getAll: async function() {
                try {
                    const db = await openDB();
                    return new Promise((res, rej) => {
                        const req = db.transaction(STORE, "readonly").objectStore(STORE).index("ts").getAll();
                        req.onsuccess = e => res(e.target.result || []), req.onerror = e => rej(e.target.error)
                    })
                } catch (e) {
                    return []
                }
            },
            remove: async function(id) {
                try {
                    const db = await openDB();
                    return new Promise((res, rej) => {
                        const tx = db.transaction(STORE, "readwrite");
                        tx.objectStore(STORE).delete(id), tx.oncomplete = () => res(), tx.onerror = e => rej(e.target.error)
                    })
                } catch (e) {}
            },
            clear: async function() {
                try {
                    const db = await openDB();
                    return new Promise((res, rej) => {
                        const tx = db.transaction(STORE, "readwrite");
                        tx.objectStore(STORE).clear(), tx.oncomplete = () => res(), tx.onerror = e => rej(e.target.error)
                    })
                } catch (e) {}
            }
        }
    }();
    async function _flushOfflineQueue() {
        if (!navigator.onLine) return;
        if (!neonConfigured()) return;
        const items = await _offlineQueue.getAll();
        if (items.length) {
            console.log("[OfflineQueue] Flush", items.length, "item antrian — push ulang seluruh bucket dengan state lokal terkini...");
            cloudLog("📶 Koneksi kembali — mengirim " + items.length + " perubahan yang tertunda...", "info");
            try {
                const ok = await cloudPush(!0);
                ok && (await _offlineQueue.clear(), cloudLog("✅ Semua perubahan offline berhasil dikirim", "success"), showToast("📶 Sync offline berhasil — semua perubahan telah dikirim", "success"))
            } catch (e) {
                console.warn("[OfflineQueue] Gagal flush:", e.message)
            }
        }
    }

    async function auditLog(action, moduleName, recordId, detail = "") {
        try {
            if (!neonConfigured()) return;
            const user = window.currentUser,
                by = user && (user.name || user.username) || "system";
            await neonInsert("sjnam_audit_log", {
                action: action,
                module: moduleName,
                record_id: String(recordId || ""),
                changed_by: by,
                detail: String(detail).slice(0, 500),
                device_id: getDeviceId(),
                created_at: (new Date).toISOString()
            })
        } catch (e) {
            console.warn("[AuditLog] Gagal tulis:", e.message)
        }
    }

    function cloudLog(msg, type = "info") {
        const logEl = $("#cloudLog");
        if (!logEl) return;
        logEl.classList.remove("hidden");
        const line = document.createElement("div"),
            ts = (new Date).toLocaleTimeString("id-ID", {
                hour12: !1
            });
        for (line.className = "error" === type ? "text-red-500" : "success" === type ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400", line.textContent = `[${ts}] ${msg}`, logEl.prepend(line); logEl.children.length > 20;) logEl.removeChild(logEl.lastChild)
    }

    function updateSyncStatus(status) {
        const dot = $("#syncStatusDot"),
            txt = $("#syncStatusText");
        dot && txt && ("connected" === status ? (dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500", txt.textContent = "Terhubung", txt.className = "text-xs font-medium text-emerald-600 dark:text-emerald-400") : "syncing" === status ? (dot.className = "w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse", txt.textContent = "Sinkronisasi...", txt.className = "text-xs font-medium text-blue-600 dark:text-blue-400") : "error" === status ? (dot.className = "w-2.5 h-2.5 rounded-full bg-red-500", txt.textContent = "Gagal", txt.className = "text-xs font-medium text-red-500") : (dot.className = "w-2.5 h-2.5 rounded-full bg-slate-300", txt.textContent = "Belum terhubung", txt.className = "text-xs font-medium text-slate-500"))
    }
    window.addEventListener("online", () => {
        setTimeout(_flushOfflineQueue, 1500)
    });
    const TOMBSTONE_KEY = "sjnam_deleted_tombstones_v1";

    function _loadTombstones() {
        try {
            const raw = JSON.parse(localStorage.getItem(TOMBSTONE_KEY) || "{}"),
                now = Date.now();
            let changed = !1;
            return Object.keys(raw).forEach(scope => {
                Object.keys(raw[scope] || {}).forEach(id => {
                    now - raw[scope][id] > 2592e6 && (delete raw[scope][id], changed = !0)
                })
            }), changed && localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(raw)), raw
        } catch (e) {
            return {}
        }
    }

    function _saveTombstones(obj) {
        try {
            localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(obj))
        } catch (e) {}
    }

    function _filterTombstoned(scope, mergedArr) {
        const scopeTombstones = _loadTombstones()[scope];
        return scopeTombstones && Object.keys(scopeTombstones).length ? mergedArr.filter(item => {
            if (!item || null == item.id) return !0;
            const deletedAt = scopeTombstones[String(item.id)];
            return null == deletedAt || new Date(item.updatedAt || item.createdAt || 0).getTime() > deletedAt
        }) : mergedArr
    }

    function mergeById(localArr = [], remoteArr = [], tombstoneScope = null) {
        const map = new Map;
        [...remoteArr, ...localArr].forEach(it => {
            if (!it || !it.id) return;
            const cur = map.get(it.id);
            cur ? new Date(it.updatedAt || it.createdAt || 0).getTime() >= new Date(cur.updatedAt || cur.createdAt || 0).getTime() && map.set(it.id, it) : map.set(it.id, it)
        });
        let result = Array.from(map.values());
        return tombstoneScope && (result = _filterTombstoned(tombstoneScope, result)), result
    }

    function mergeTraining(local, remote) {
        if (!remote) return local;
        const out = {
            ...local,
            ...remote
        };
        return out.peserta = mergeById(local.peserta || [], remote.peserta || [], "peserta"), out.materi = mergeById(local.materi || [], remote.materi || []), out.stations = mergeById(local.stations || [], remote.stations || []), out.banks = (remote.banks || []).map(rb => {
            const lb = (local.banks || []).find(b => b.id === rb.id) || {
                questions: []
            };
            return {
                ...rb,
                questions: mergeById(lb.questions || [], rb.questions || [])
            }
        }), (local.banks || []).forEach(lb => {
            out.banks.find(b => b.id === lb.id) || out.banks.push(lb)
        }), out
    }

    function getAllCloudData() {
        let training = null;
        try {
            training = JSON.parse(localStorage.getItem("sjn_training_v1") || "null")
        } catch (e) {}
        let users = null;
        try {
            users = JSON.parse(localStorage.getItem("sjnam_users_v1") || "null")
        } catch (e) {}
        let karyawan = null;
        try {
            karyawan = JSON.parse(localStorage.getItem("sjnam_karyawan_v1") || "null")
        } catch (e) {}
        let stcrData = null;
        try {
            stcrData = JSON.parse(localStorage.getItem("sjnam_stcr_data_v1") || "null")
        } catch (e) {}
        let drygoodsData = null;
        try {
            drygoodsData = JSON.parse(localStorage.getItem("sjnam_drygoods_v1") || "null")
        } catch (e) {}
        let rolePerms = null;
        try {
            rolePerms = JSON.parse(localStorage.getItem("sjnam_role_perms_v1") || "null")
        } catch (e) {}
        let certTemplate1 = null;
        try {
            certTemplate1 = JSON.parse(localStorage.getItem("sjn_cert_template_1") || "null")
        } catch (e) {}
        let certTemplate2 = null;
        try {
            certTemplate2 = JSON.parse(localStorage.getItem("sjn_cert_template_2") || "null")
        } catch (e) {}
        const certTemplateActive = localStorage.getItem("sjn_cert_template_active") || null;
        let certPositions = null;
        try {
            certPositions = JSON.parse(localStorage.getItem("sjn_cert_positions_v1") || "null")
        } catch (e) {}
        const certBarcode = localStorage.getItem("sjn_cert_barcode_v1");
        let certCustomTexts = null;
        try {
            certCustomTexts = JSON.parse(localStorage.getItem("sjn_cert_custom_texts_v1") || "null")
        } catch (e) {}
        let certCustomTextsSJ = null;
        try {
            certCustomTextsSJ = JSON.parse(localStorage.getItem("sjn_cert_custom_texts_sj_v1") || "null")
        } catch (e) {}
        let certCustomTextsNAM = null;
        try {
            certCustomTextsNAM = JSON.parse(localStorage.getItem("sjn_cert_custom_texts_nam_v1") || "null")
        } catch (e) {}
        let certCustomTextsBoth = null;
        try {
            certCustomTextsBoth = JSON.parse(localStorage.getItem("sjn_cert_custom_texts_both_v1") || "null")
        } catch (e) {}
        let certParaf = null;
        try {
            certParaf = JSON.parse(localStorage.getItem("sjn_cert_paraf_v1") || "null")
        } catch (e) {}
        const certParafShow = localStorage.getItem("sjn_cert_paraf_show_v1");
        return {
            data: window.data,
            stations: window.stations,
            dfsData: window.dfsData,
            settings: window.settings,
            training: training,
            users: users,
            karyawan: karyawan,
            stcrData: stcrData,
            drygoodsData: drygoodsData,
            rolePerms: rolePerms,
            certTemplate1: certTemplate1,
            certTemplate2: certTemplate2,
            certTemplateActive: certTemplateActive,
            certPositions: certPositions,
            certBarcode: certBarcode,
            certCustomTexts: certCustomTexts,
            certCustomTextsSJ: certCustomTextsSJ,
            certCustomTextsNAM: certCustomTextsNAM,
            certCustomTextsBoth: certCustomTextsBoth,
            certParaf: certParaf,
            certParafShow: certParafShow,
            deletedTombstones: _loadTombstones(),
            savedAt: (new Date).toISOString(),
            version: "v5.0-audit"
        }
    }

    function getDeviceId() {
        return localStorage.getItem("sjnam_device_id") || "unknown"
    }
    function _mergeBucketPayload(bucketId, localBucketPayload, cloudBucketPayload, dirtyHint) {
        const byIdOrKey = r => r.id || r["App Service & Tehnik"] || JSON.stringify(r),
            pesertaKeyFn = r => r.id || r.username || JSON.stringify(r),
            dgTrxKeyFn = r => r.id || JSON.stringify(r),
            _mergeWithConflict = (cloudArr = [], localArr = [], keyFn) => {
                const map = new Map;
                return cloudArr.forEach(item => {
                    const k = keyFn(item);
                    k && map.set(k, item)
                }), localArr.forEach(item => {
                    const k = keyFn(item);
                    if (!k) return void map.set(JSON.stringify(item), item);
                    const existing = map.get(k);
                    if (!existing) return void map.set(k, item);
                    const { winner: winner, conflict: conflict } = detectConflict(item, existing);
                    conflict && cloudLog("⚠️ Konflik record " + k + ": " + item._updatedBy + " vs " + existing._updatedBy + " — " + winner._updatedBy + " menang", "info"), map.set(k, winner)
                }), Array.from(map.values())
            };
        let merged = { ...localBucketPayload };
        try {
            if (bucketId === "delay_data") {
                merged.data = _mergeWithConflict(cloudBucketPayload.data, localBucketPayload.data, byIdOrKey)
            } else if (bucketId === "dfs_stations") {
                merged.dfsData = _mergeWithConflict(cloudBucketPayload.dfsData, localBucketPayload.dfsData, byIdOrKey)
            } else if (bucketId === "stcr") {
                merged.stcrData = _mergeWithConflict(cloudBucketPayload.stcrData, localBucketPayload.stcrData, byIdOrKey)
            } else if (bucketId === "users") {
                if (Array.isArray(cloudBucketPayload.users) || Array.isArray(localBucketPayload.users)) {
                    merged.users = _filterTombstoned("users", _mergeWithConflict(cloudBucketPayload.users, localBucketPayload.users, u => u.id))
                }
            } else if (bucketId === "karyawan") {
                if (Array.isArray(localBucketPayload.karyawan) && Array.isArray(cloudBucketPayload.karyawan)) {
                    merged.karyawan = _filterTombstoned("karyawan", _mergeWithConflict(cloudBucketPayload.karyawan, localBucketPayload.karyawan, dgTrxKeyFn))
                }
            } else if (bucketId === "training") {
                if (localBucketPayload.training && cloudBucketPayload.training) {
                    merged.training = { ...localBucketPayload.training };
                    if (Array.isArray(localBucketPayload.training.peserta) && Array.isArray(cloudBucketPayload.training.peserta)) {
                        merged.training.peserta = _filterTombstoned("peserta", _mergeWithConflict(cloudBucketPayload.training.peserta, localBucketPayload.training.peserta, pesertaKeyFn))
                    }
                }
            } else if (bucketId === "drygoods") {
                if (localBucketPayload.drygoodsData && cloudBucketPayload.drygoodsData) {
                    merged.drygoodsData = { ...localBucketPayload.drygoodsData };
                    if (Array.isArray(localBucketPayload.drygoodsData.transactions) && Array.isArray(cloudBucketPayload.drygoodsData.transactions)) {
                        merged.drygoodsData.transactions = _mergeWithConflict(cloudBucketPayload.drygoodsData.transactions, localBucketPayload.drygoodsData.transactions, dgTrxKeyFn)
                    }
                    if (Array.isArray(localBucketPayload.drygoodsData.bankItems) && Array.isArray(cloudBucketPayload.drygoodsData.bankItems)) {
                        merged.drygoodsData.bankItems = _mergeWithConflict(cloudBucketPayload.drygoodsData.bankItems, localBucketPayload.drygoodsData.bankItems, dgTrxKeyFn)
                    }
                }
            } else if (bucketId === "tombstones") {
                if (cloudBucketPayload.deletedTombstones && typeof cloudBucketPayload.deletedTombstones === "object") {
                    const localTS = _loadTombstones();
                    let tsChanged = false;
                    Object.keys(cloudBucketPayload.deletedTombstones).forEach(scope => {
                        localTS[scope] = localTS[scope] || {};
                        Object.keys(cloudBucketPayload.deletedTombstones[scope] || {}).forEach(id => {
                            (!localTS[scope][id] || cloudBucketPayload.deletedTombstones[scope][id] > localTS[scope][id]) && (localTS[scope][id] = cloudBucketPayload.deletedTombstones[scope][id], tsChanged = true)
                        })
                    });
                    tsChanged && _saveTombstones(localTS);
                    merged.deletedTombstones = _loadTombstones()
                }
            }
            // role_perms, cert_config, settings: tidak ada merge per-item di
            // sistem lama (selalu overwrite oleh device yang push terakhir) —
            // perilaku dipertahankan sama persis di sini.
        } catch (bugfixErr) {
            console.warn("[cloudPush merge bucket=" + bucketId + "]", bugfixErr)
        }
        return merged
    }

    async function cloudPush(silent = !1, dirtyHint = null) {
        if (!neonConfigured()) return silent || showToast("Firebase belum dikonfigurasi (js/config.js)", "error"), !1;
        if (!navigator.onLine) {
            const localPayload = getAllCloudData();
            return await _offlineQueue.enqueue(localPayload), cloudLog("📴 Offline — perubahan disimpan ke antrian lokal (akan dikirim saat online)", "info"), silent || showToast("📴 Offline — perubahan akan dikirim saat koneksi kembali", "info"), !0
        }
        const mappedBucketId = dirtyHint ? _bucketIdForHint(dirtyHint) : null;
        const targetBucketIds = mappedBucketId ? [mappedBucketId] : CLOUD_BUCKETS.map(b => b.id);
        const fullLocal = getAllCloudData();
        let anyPushed = false, anyError = null, totalPushed = 0;
        updateSyncStatus("syncing");
        for (const bucketId of targetBucketIds) {
            const localBucketPayload = pickBucketPayload(bucketId, fullLocal);
            const bucketHash = _hashPayload(localBucketPayload);
            if (silent && bucketHash && bucketHash === window._bucketHash[bucketId]) continue;
            try {
                const cloudRow = await neonSelectOne("sjnam_sync", bucketId);
                const cloudRowUpdatedAt = cloudRow ? (cloudRow._firestoreUpdateTime || cloudRow.updated_at) : null;
                let mergedPayload = localBucketPayload;
                if (cloudRow && cloudRowUpdatedAt && (!window._bucketTS[bucketId] || cloudRowUpdatedAt > window._bucketTS[bucketId])) {
                    mergedPayload = _mergeBucketPayload(bucketId, localBucketPayload, cloudRow.payload || {}, dirtyHint);
                    cloudLog("🔀 [" + bucketId + "] Konflik terdeteksi — data digabung otomatis (merge)", "info");
                    await auditLog("merge", dirtyHint || bucketId, "", "Merge bucket " + bucketId + " dari cloud");
                    silent || showToast("🔀 Merge: data " + bucketId + " dari 2 device digabung otomatis", "info")
                }
                mergedPayload._pushedBy = getDeviceId(), mergedPayload._pushedAt = (new Date).toISOString();
                const upsertResult = await neonUpsert("sjnam_sync", bucketId, { payload: mergedPayload, updated_at: (new Date).toISOString() });
                const serverUpdatedAt = upsertResult?._firestoreUpdateTime || upsertResult?.updated_at || mergedPayload._pushedAt;
                window._bucketHash[bucketId] = _hashPayload(mergedPayload), window._bucketTS[bucketId] = serverUpdatedAt;
                anyPushed = true, totalPushed++
            } catch (err) {
                anyError = err, console.warn("[cloudPush bucket=" + bucketId + "]", err)
            }
        }
        _saveBucketHash(window._bucketHash), _saveBucketTS(window._bucketTS);
        if (anyError && !anyPushed) return updateSyncStatus("error"), cloudLog("❌ Gagal upload: " + anyError.message, "error"), silent || showToast("Sync gagal: " + anyError.message, "error"), !1;
        if (!anyPushed) return cloudLog("⏭️ Smart Push: tidak ada perubahan data, skip upload", "info"), updateSyncStatus("connected"), !0;
        return dirtyHint ? clearDirty(dirtyHint) : clearDirty(), await auditLog("push", dirtyHint || "all", "", "Push berhasil (" + totalPushed + " bucket)"), window._rolePermsLocalDirty = !1, window._drygoodsLocalDirty = !1, updateSyncStatus("connected"), cloudLog("✅ Data tersimpan ke Firestore (" + totalPushed + " bucket diperbarui)", "success"), silent || showToast("⚡ Firestore Sync berhasil! (" + totalPushed + " bucket)", "success"), !0
    }
    function _applyBucketPull(bucketId, rec) {
        if (bucketId === "tombstones") {
            if (rec.deletedTombstones && typeof rec.deletedTombstones === "object") {
                const localTS = _loadTombstones();
                let changed = false;
                Object.keys(rec.deletedTombstones).forEach(scope => {
                    localTS[scope] = localTS[scope] || {};
                    Object.keys(rec.deletedTombstones[scope] || {}).forEach(id => {
                        (!localTS[scope][id] || rec.deletedTombstones[scope][id] > localTS[scope][id]) && (localTS[scope][id] = rec.deletedTombstones[scope][id], changed = true)
                    })
                });
                changed && _saveTombstones(localTS)
            }
            return
        }
        if (bucketId === "delay_data") {
            if (Array.isArray(rec.data)) window.data = rec.data, localStorage.setItem(STORAGE_KEY, JSON.stringify(window.data));
            return
        }
        if (bucketId === "dfs_stations") {
            Array.isArray(rec.stations) && rec.stations.length > 0 && (window.stations = rec.stations, localStorage.setItem(STATIONS_KEY, JSON.stringify(window.stations)));
            Array.isArray(rec.dfsData) && (window.dfsData = rec.dfsData, localStorage.setItem(DFS_KEY, JSON.stringify(window.dfsData)));
            return
        }
        if (bucketId === "settings") {
            rec.settings && (window.settings = { ...window.settings, ...rec.settings }, localStorage.setItem(SETTINGS_KEY, JSON.stringify(window.settings)), applyDarkMode());
            return
        }
        if (bucketId === "training") {
            if (rec.training) {
                const _localTraining = function() { try { return JSON.parse(localStorage.getItem("sjn_training_v1") || "null") } catch (e) { return null } }(),
                    _mergedTraining = _localTraining ? mergeTraining(_localTraining, rec.training) : rec.training;
                localStorage.setItem("sjn_training_v1", JSON.stringify(_mergedTraining)), window.trainingData && Object.assign(window.trainingData, _mergedTraining)
            }
            return
        }
        if (bucketId === "users") {
            if (Array.isArray(rec.users)) {
                const _localUsers = function() { try { return JSON.parse(localStorage.getItem("sjnam_users_v1") || "null") } catch (e) { return null } }();
                let _mergedUsers = rec.users;
                if (_localUsers && Array.isArray(_localUsers)) {
                    const _userMap = new Map;
                    rec.users.forEach(u => { u.id && _userMap.set(u.id, u) }), _localUsers.forEach(u => { u.id && _userMap.set(u.id, u) }), _mergedUsers = Array.from(_userMap.values())
                }
                _mergedUsers = _filterTombstoned("users", _mergedUsers), localStorage.setItem("sjnam_users_v1", JSON.stringify(_mergedUsers)), window._userSelectedIds && window._userSelectedIds.clear(), typeof renderUserTable === "function" && renderUserTable()
            }
            return
        }
        if (bucketId === "karyawan") {
            if (Array.isArray(rec.karyawan)) {
                const _localKar = function() { try { return JSON.parse(localStorage.getItem("sjnam_karyawan_v1") || "null") } catch (e) { return null } }();
                let _mergedKar = rec.karyawan;
                if (_localKar && Array.isArray(_localKar)) {
                    const _karMap = new Map;
                    rec.karyawan.forEach(k => { k.id && _karMap.set(k.id, k) }), _localKar.forEach(k => { k.id && _karMap.set(k.id, k) }), _mergedKar = Array.from(_karMap.values())
                }
                _mergedKar = _filterTombstoned("karyawan", _mergedKar), localStorage.setItem("sjnam_karyawan_v1", JSON.stringify(_mergedKar)), typeof window.setKaryawanData === "function" && window.setKaryawanData(_mergedKar), typeof window.renderKaryawanUserOptions === "function" && window.renderKaryawanUserOptions();
                (function() {
                    try {
                        var _cu = window.currentUser;
                        if (!_cu || "User-DRG" !== _cu.role) return;
                        var _myUser = (_cu.username || "").toLowerCase(),
                            _found = _mergedKar.find(function(k) { return (k.username || "").toLowerCase() === _myUser || (k.nip || "").toLowerCase() === _myUser }),
                            _newSt = _found && _found.station && "ALL" !== _found.station ? _found.station : null;
                        if (window._userDrgStation === _newSt) return;
                        window._userDrgStation = _newSt, window._userStationLock = _newSt, _cu && (_cu.station = _newSt), document.querySelectorAll("[data-dg-station]").forEach(function(t) {
                            var ts = t.dataset.dgStation;
                            ts && (_newSt && "ALL" !== _newSt ? ts === _newSt ? (t.style.opacity = "", t.style.pointerEvents = "", t.title = "") : (t.style.opacity = "0.35", t.style.pointerEvents = "none", t.title = "ALL" === ts ? "Akses terbatas" : "Akses terbatas ke station " + _newSt) : (t.style.opacity = "", t.style.pointerEvents = "", t.title = ""))
                        }), "object" == typeof window.DRYGOODS && "function" == typeof window.DRYGOODS.renderAll && setTimeout(function() { window.DRYGOODS.renderAll() }, 50)
                    } catch (ex) { console.warn("[DRG Cloud Station Refresh]", ex) }
                })()
            }
            return
        }
        if (bucketId === "stcr") {
            Array.isArray(rec.stcrData) && rec.stcrData.length > 0 && (localStorage.setItem("sjnam_stcr_data_v1", JSON.stringify(rec.stcrData)), window.STCR && typeof window.STCR.loadData === "function" && (window.STCR.loadData(), typeof window.STCR.applyFilters === "function" && window.STCR.applyFilters()));
            return
        }
        if (bucketId === "drygoods") {
            !window._drygoodsLocalDirty && rec.drygoodsData ? (localStorage.setItem("sjnam_drygoods_v1", JSON.stringify(rec.drygoodsData)), "object" == typeof window.DRYGOODS && typeof window.DRYGOODS.loadData === "function" && (window.DRYGOODS.loadData(), window.DRYGOODS.renderAll())) : window._drygoodsLocalDirty && rec.drygoodsData && cloudLog("⏭️ Pull: skip drygoodsData dari cloud — ada perubahan lokal yang belum ter-push", "info");
            return
        }
        if (bucketId === "role_perms") {
            if (rec.rolePerms) {
                window._rolePermsLocalDirty ? (cloudLog("⏭️ Pull: skip rolePerms dari cloud — ada perubahan lokal yang belum ter-push", "info"), neonConfigured() && setTimeout(function() {
                    cloudPush(!0, "rolePerms").then(function(ok) { ok && (window._rolePermsLocalDirty = !1) }).catch(function(e) { console.warn("[RolePerms push]", e) })
                }, 200)) : (localStorage.setItem("sjnam_role_perms_v1", JSON.stringify(rec.rolePerms)), typeof window.renderPermTable === "function" && window.renderPermTable(), typeof window.applyPermissions === "function" ? window.applyPermissions() : typeof applyPermissions === "function" && applyPermissions())
            }
            return
        }
        if (bucketId === "cert_config") {
            let certChanged = !1;
            rec.certTemplate1 && (localStorage.setItem("sjn_cert_template_1", JSON.stringify(rec.certTemplate1)), certChanged = !0), rec.certTemplate2 && (localStorage.setItem("sjn_cert_template_2", JSON.stringify(rec.certTemplate2)), certChanged = !0), rec.certTemplateActive && (localStorage.setItem("sjn_cert_template_active", rec.certTemplateActive), certChanged = !0), rec.certPositions && (localStorage.setItem("sjn_cert_positions_v1", JSON.stringify(rec.certPositions)), certChanged = !0), void 0 !== rec.certBarcode && null !== rec.certBarcode && (localStorage.setItem("sjn_cert_barcode_v1", rec.certBarcode), certChanged = !0), rec.certCustomTexts && (localStorage.setItem("sjn_cert_custom_texts_v1", JSON.stringify(rec.certCustomTexts)), certChanged = !0), rec.certCustomTextsSJ && (localStorage.setItem("sjn_cert_custom_texts_sj_v1", JSON.stringify(rec.certCustomTextsSJ)), certChanged = !0), rec.certCustomTextsNAM && (localStorage.setItem("sjn_cert_custom_texts_nam_v1", JSON.stringify(rec.certCustomTextsNAM)), certChanged = !0), rec.certCustomTextsBoth && (localStorage.setItem("sjn_cert_custom_texts_both_v1", JSON.stringify(rec.certCustomTextsBoth)), certChanged = !0), rec.certParaf && (localStorage.setItem("sjn_cert_paraf_v1", JSON.stringify(rec.certParaf)), certChanged = !0), void 0 !== rec.certParafShow && null !== rec.certParafShow && (localStorage.setItem("sjn_cert_paraf_show_v1", rec.certParafShow), certChanged = !0), certChanged && (typeof window.loadCertificateTemplate === "function" && window.loadCertificateTemplate(), typeof window.ctbRenderAll === "function" && window.ctbRenderAll())
        }
    }

    // Migrasi satu kali: dokumen lama "sjnam_main" (berisi SEMUA modul dalam
    // satu blob) dipecah jadi dokumen granular per-modul. Aman dijalankan
    // berkali-kali dari device manapun (upsert bersifat idempotent) — kalau
    // device lain sudah lebih dulu migrasi, fungsi ini langsung skip.
    async function _migrateLegacySyncDocIfNeeded(listedDocs) {
        const legacy = listedDocs.find(d => d._docId === "sjnam_main");
        if (!legacy || !legacy.payload) return listedDocs;
        const alreadyGranular = CLOUD_BUCKETS.some(b => listedDocs.some(d => d._docId === b.id));
        if (alreadyGranular) return listedDocs;
        cloudLog("🔀 Migrasi struktur data granular — memisah dokumen lama jadi per-modul...", "info");
        const legacyPayload = legacy.payload;
        const newDocs = listedDocs.slice();
        for (const bucket of CLOUD_BUCKETS) {
            const bucketPayload = pickBucketPayload(bucket.id, legacyPayload);
            bucketPayload._pushedBy = getDeviceId(), bucketPayload._pushedAt = (new Date).toISOString(), bucketPayload._migratedFrom = "sjnam_main";
            try {
                const upsertResult = await neonUpsert("sjnam_sync", bucket.id, { payload: bucketPayload, updated_at: (new Date).toISOString() });
                newDocs.push({ _docId: bucket.id, payload: bucketPayload, _firestoreUpdateTime: upsertResult?._firestoreUpdateTime || upsertResult?.updated_at })
            } catch (e) { console.warn("[Migrasi granular] gagal bucket=" + bucket.id, e) }
        }
        return cloudLog("✅ Migrasi struktur data granular selesai (" + CLOUD_BUCKETS.length + " modul dipisah)", "success"), newDocs
    }

    async function cloudPull(silent = !1) {
        if (!neonConfigured()) return void (silent || showToast("Firebase belum dikonfigurasi (js/config.js)", "error"));
        updateSyncStatus("syncing");
        try {
            let listedDocs = await neonListCollection("sjnam_sync");
            if (!listedDocs.length) throw new Error("Data tidak ditemukan di Firestore");
            listedDocs = await _migrateLegacySyncDocIfNeeded(listedDocs);
            const newerBuckets = [];
            for (const bucket of CLOUD_BUCKETS) {
                const doc = listedDocs.find(d => d._docId === bucket.id);
                if (!doc) continue;
                const docUpdatedAt = doc._firestoreUpdateTime || doc.updated_at;
                if (!docUpdatedAt) continue;
                if (window._bucketTS[bucket.id] && docUpdatedAt <= window._bucketTS[bucket.id]) continue;
                newerBuckets.push({ id: bucket.id, doc: doc, docUpdatedAt: docUpdatedAt })
            }
            if (!newerBuckets.length) return cloudLog("⏭️ Smart Pull: tidak ada perubahan data antar device, skip pull (payload tidak diunduh)", "info"), updateSyncStatus("connected"), void (silent || showToast("Data sudah paling baru — tidak ada perubahan dari device lain", "info"));
            if (!silent) {
                const namesLabel = newerBuckets.map(b => b.id).join(", ");
                if (!await showConfirm("⚡ Tarik Data dari Firestore", `Modul dengan pembaruan dari device lain: ${namesLabel}.\n\nData lokal modul-modul ini akan diganti/digabung otomatis. Lanjutkan?`)) return void updateSyncStatus("connected")
            }
            window._cloudPullInProgress = !0;
            let appliedCount = 0;
            try {
                newerBuckets.sort((a, b) => (a.id === "tombstones" ? -1 : b.id === "tombstones" ? 1 : 0));
                for (const nb of newerBuckets) {
                    const rec = nb.doc.payload || {};
                    _applyBucketPull(nb.id, rec), window._bucketTS[nb.id] = nb.docUpdatedAt, appliedCount++
                }
                _saveBucketTS(window._bucketTS);
                const fullLocalAfter = getAllCloudData();
                newerBuckets.forEach(nb => { window._bucketHash[nb.id] = _hashPayload(pickBucketPayload(nb.id, fullLocalAfter)) }), _saveBucketHash(window._bucketHash)
            } finally {
                window._cloudPullInProgress = !1
            }
            renderTable(), renderDashboard(), renderStations(), renderDfsTable(), typeof window.refreshTrainingViews === "function" && window.refreshTrainingViews(), typeof window.renderBankStations === "function" && window.renderBankStations(), updateSyncStatus("connected"), cloudLog("✅ Data berhasil diambil dari Firestore (" + appliedCount + " modul: " + newerBuckets.map(b => b.id).join(", ") + ")", "success"), blinkBlueLight(), await auditLog("pull", "all", "", appliedCount + " modul diperbarui: " + newerBuckets.map(b => b.id).join(", ")), setTimeout(_flushOfflineQueue, 2e3)
        } catch (err) {
            window._cloudPullInProgress = !1, updateSyncStatus("error"), cloudLog("❌ Gagal download: " + err.message, "error"), silent || showToast("Gagal download: " + err.message, "error")
        }
    }

    function blinkBlueLight() {
        const el = document.getElementById("autoSyncLight");
        el && (el.classList.remove("active"), el.offsetWidth, el.classList.add("active"), setTimeout(() => el.classList.remove("active"), 2200))
    }

    function blinkSyncLight() {
        const el = document.getElementById("syncLight");
        el && (el.classList.remove("active"), el.offsetWidth, el.classList.add("active"), setTimeout(() => el.classList.remove("active"), 3200))
    }

    function startRealtimeSubscription() {
        // Neon Data API tidak punya equivalen realtime channel seperti Supabase.
        // Sengaja dibuat no-op: sinkronisasi tetap berjalan lewat cloudPush/cloudPull
        // manual, Smart-Sync saat app dibuka, dan backup terjadwal tiap jam — hanya
        // tanpa "live update" instan antar device. Fungsi ini dipertahankan (bukan
        // dihapus) supaya seluruh pemanggil lama tidak error.
    }

    function initCloudUI() {
        updateAutoSyncBtn();
        const guide = $("#cloudSetupGuide");
        neonConfigured() ? (updateSyncStatus("connected"), guide && guide.classList.add("hidden")) : (updateSyncStatus("disconnected"), guide && guide.classList.remove("hidden"))
    }

    function updateAutoSyncBtn() {
        "function" == typeof window.updateServiceSyncIndicator && window.updateServiceSyncIndicator()
    }
    window.markDeletedTombstone = function(scope, ids) {
            if (!Array.isArray(ids) || !ids.length) return;
            const all = _loadTombstones();
            all[scope] || (all[scope] = {});
            const now = Date.now();
            ids.forEach(id => {
                all[scope][String(id)] = now
            }), _saveTombstones(all)
        }, window._filterTombstoned = _filterTombstoned, localStorage.getItem("sjnam_device_id") || localStorage.setItem("sjnam_device_id", "dev_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8)),
        function() {
            async function doScheduledBackup() {
                const now = new Date,
                    lastBackup = localStorage.getItem("sjnam_last_backup_v1"),
                    today = now.toISOString().slice(0, 10);
                if (lastBackup !== today) {
                    console.log("[DAILY BACKUP] Menjalankan backup harian...");
                    try {
                        const allData = {
                                data: JSON.parse(localStorage.getItem("sjn_delay_pro_v4") || "[]"),
                                stations: JSON.parse(localStorage.getItem("sjn_stations_v2") || "[]"),
                                dfsData: JSON.parse(localStorage.getItem("sjn_dfs_bank_v1") || "[]"),
                                settings: JSON.parse(localStorage.getItem("sjn_settings_v4") || "{}"),
                                users: JSON.parse(localStorage.getItem("sjnam_users_v1") || "[]"),
                                stcrData: JSON.parse(localStorage.getItem("sjnam_stcr_data_v1") || "[]"),
                                exportDate: now.toISOString(),
                                exportType: "daily_scheduled"
                            },
                            blob = new Blob([JSON.stringify(allData, null, 2)], {
                                type: "application/json"
                            }),
                            url = URL.createObjectURL(blob),
                            a = document.createElement("a");
                        a.href = url, a.download = `sjnam_backup_${today}.json`, document.body.appendChild(a), a.click(), document.body.removeChild(a), URL.revokeObjectURL(url), console.log("[DAILY BACKUP] JSON exported: sjnam_backup_" + today + ".json")
                    } catch (e) {
                        console.warn("[DAILY BACKUP] JSON export gagal:", e.message)
                    }
                    await cloudPush(!0) ? console.log("[DAILY BACKUP] Firestore push sukses") : console.warn("[DAILY BACKUP] Firestore push gagal (mungkin belum dikonfigurasi)"), localStorage.setItem("sjnam_last_backup_v1", today), showToast("📦 Backup harian selesai: JSON + Firestore", "success")
                }
            }! function() {
                const pollForLogin = setInterval(() => {
                    window.currentUser && (clearInterval(pollForLogin), setTimeout(doScheduledBackup, 5e3), setInterval(doScheduledBackup, 36e5))
                }, 1e3)
            }(), window.triggerDailyBackup = doScheduledBackup
        }(), $("#btnCloudSave")?.addEventListener("click", async () => {
            await cloudPush()
        }), $("#btnCloudLoad")?.addEventListener("click", async () => {
            await cloudPull()
        }), $("#btnCloudAutoToggle")?.addEventListener("click", () => {}), $("#btnCloudClear")?.addEventListener("click", async () => {
            if (await showConfirm("Cek Koneksi Firestore", "Uji koneksi ke Firestore sekarang?")) {
                initCloudUI();
                try {
                    await neonSelectOne("sjnam_sync", "sjnam_main"), showToast("✅ Koneksi Firestore OK", "success")
                } catch (e) {
                    showToast("❌ Koneksi Firestore gagal: " + e.message, "error")
                }
            }
        }), document.addEventListener("click", function(e) {
            e.target && e.target.id
        });
    try {
        initCloudUI()
    } catch (cloudInitErr) {
        console.error("[Cloud Sync] Gagal inisialisasi (dilewati, aplikasi tetap berjalan normal):", cloudInitErr)
    }
    setTimeout(async () => {
        neonConfigured() && (console.log("[Smart-Sync] Cek perubahan data dari Firestore (hanya pull jika ada perubahan)..."), await cloudPull(!0))
    }, 1200), setInterval(async () => {
        window._cloudPullInProgress || neonConfigured() && window.currentUser && await cloudPull(!0)
    }, 25000), window.cloudConfig = cloudConfig, window.stampRecord = stampRecord, window.stampArray = function(arr, action = "update") {
        return Array.isArray(arr) ? arr.map(item => item._updatedAt ? item : stampRecord(item, action)) : arr
    }, window.detectConflict = detectConflict, window.MODULE_KEYS = {
        data: "sjn_delay_pro_v4",
        stations: "sjn_stations_v2",
        dfsData: "sjn_dfs_bank_v1",
        settings: "sjn_settings_v4",
        training: "sjn_training_v1",
        users: "sjnam_users_v1",
        karyawan: "sjnam_karyawan_v1",
        stcrData: "sjnam_stcr_data_v1",
        drygoodsData: "sjnam_drygoods_v1",
        rolePerms: "sjnam_role_perms_v1"
    }, window.markDirty = function(moduleName) {
        _dirtyModules.add(moduleName)
    }, window.clearDirty = clearDirty, window.isDirty = isDirty, window._hashPayload = _hashPayload, window._mergeArrays = function(base, incoming, keyFn) {
        if (Array.isArray(base) || (base = []), !Array.isArray(incoming)) return base;
        const map = new Map;
        return base.forEach(item => {
            const k = keyFn(item);
            k && map.set(k, item)
        }), incoming.forEach(item => {
            const k = keyFn(item);
            k && map.set(k, item)
        }), Array.from(map.values())
    }, window._flushOfflineQueue = _flushOfflineQueue, window.getSupabaseClient = getSupabaseClient, window.saveCloudConfig = function() {}, window.getOfflineQueueItems = function() {
        return _offlineQueue.getAll()
    }, window.auditLog = auditLog, window._auditSave = function(moduleName, items, action = "update") {
        if (neonConfigured()) try {
            auditLog(action, moduleName, "", (Array.isArray(items) ? items.length : 1) + " record(s)")
        } catch (e) {}
    }, window.cloudLog = cloudLog, window.updateSyncStatus = updateSyncStatus, window.mergeById = mergeById, window.mergeTraining = mergeTraining, window.getAllCloudData = getAllCloudData, window.getDeviceId = getDeviceId, window.cloudPush = cloudPush, window.cloudPull = cloudPull, window.docToObject = docToObject, window.pickBucketPayload = pickBucketPayload, window.blinkBlueLight = blinkBlueLight, window.blinkSyncLight = blinkSyncLight, window.startRealtimeSubscription = startRealtimeSubscription, window.triggerAutoSync = function(dirtyHint = null) {
        _cloudPullInProgress || neonConfigured() && (clearTimeout(_autoSyncTimer), window._autoSyncTimer = setTimeout(async () => {
            if (_cloudPullInProgress) return;
            if (await cloudPush(!0, dirtyHint)) {
                const el = document.getElementById("smartSyncLastPush");
                el && (el.textContent = "Terakhir sync: " + (new Date).toLocaleTimeString("id-ID"))
            }
        }, 800))
    }, window.initCloudUI = initCloudUI, window.updateAutoSyncBtn = updateAutoSyncBtn, window.initSyncDelayUI = function() {}, window.updatePresetHighlight = function(val) {}
}();
