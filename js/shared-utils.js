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
    window._realtimeChannel = null, window._lastCloudUpdatedAt = function() {
        try {
            return localStorage.getItem(window._LAST_PULL_TS_KEY) || null
        } catch (e) {
            return null
        }
    }(), window._lastPushedHash = null, window._autoSyncTimer = null, window._cloudPullInProgress = !1;
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
            console.log("[OfflineQueue] Flush", items.length, "item antrian..."), cloudLog("📶 Koneksi kembali — mengirim " + items.length + " perubahan yang tertunda...", "info");
            for (const item of items) try {
                await neonUpsert("sjnam_sync", "sjnam_main", {
                    payload: item.payload,
                    updated_at: (new Date).toISOString()
                }), await _offlineQueue.remove(item.id), console.log("[OfflineQueue] Item", item.id, "berhasil dikirim")
            } catch (e) {
                console.warn("[OfflineQueue] Gagal kirim item", item.id, ":", e.message);
                break
            }(await _offlineQueue.getAll()).length || (cloudLog("✅ Semua perubahan offline berhasil dikirim", "success"), showToast("📶 Sync offline berhasil — semua perubahan telah dikirim", "success"))
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
    async function cloudPush(silent = !1, dirtyHint = null) {
        if (!neonConfigured()) return silent || showToast("Firebase belum dikonfigurasi (js/config.js)", "error"), !1;
        const localPayload = getAllCloudData(),
            currentHash = _hashPayload(localPayload);
        if (silent && currentHash && currentHash === _lastPushedHash) return cloudLog("⏭️ Smart Push: tidak ada perubahan data, skip upload", "info"), !0;
        if (!navigator.onLine) return await _offlineQueue.enqueue(localPayload), cloudLog("📴 Offline — perubahan disimpan ke antrian lokal (akan dikirim saat online)", "info"), silent || showToast("📴 Offline — perubahan akan dikirim saat koneksi kembali", "info"), window._lastPushedHash = currentHash, !0;
        updateSyncStatus("syncing");
        try {
            let mergedPayload = localPayload;
            const cloudRow = await neonSelectOne("sjnam_sync", "sjnam_main");
            if (cloudRow && cloudRow.updated_at && (!_lastCloudUpdatedAt || cloudRow.updated_at > _lastCloudUpdatedAt)) {
                const cloudPayload = cloudRow.payload || {},
                    byIdOrKey = r => r.id || r["App Service & Tehnik"] || JSON.stringify(r),
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
                            const {
                                winner: winner,
                                conflict: conflict
                            } = detectConflict(item, existing);
                            conflict && cloudLog("⚠️ Konflik record " + k + ": " + item._updatedBy + " vs " + existing._updatedBy + " — " + winner._updatedBy + " menang", "info"), map.set(k, winner)
                        }), Array.from(map.values())
                    };
                mergedPayload = {
                    ...localPayload,
                    data: _mergeWithConflict(cloudPayload.data, localPayload.data, byIdOrKey),
                    dfsData: _mergeWithConflict(cloudPayload.dfsData, localPayload.dfsData, byIdOrKey),
                    stcrData: _mergeWithConflict(cloudPayload.stcrData, localPayload.stcrData, byIdOrKey)
                }, Array.isArray(localPayload.karyawan) && Array.isArray(cloudPayload.karyawan) && (mergedPayload.karyawan = _mergeWithConflict(cloudPayload.karyawan, localPayload.karyawan, dgTrxKeyFn)), (function() {
                    try {
                        if (cloudPayload.deletedTombstones && "object" == typeof cloudPayload.deletedTombstones) {
                            var localTS = _loadTombstones(),
                                tsChanged = !1;
                            Object.keys(cloudPayload.deletedTombstones).forEach(function(scope) {
                                localTS[scope] = localTS[scope] || {}, Object.keys(cloudPayload.deletedTombstones[scope] || {}).forEach(function(id) {
                                    (!localTS[scope][id] || cloudPayload.deletedTombstones[scope][id] > localTS[scope][id]) && (localTS[scope][id] = cloudPayload.deletedTombstones[scope][id], tsChanged = !0)
                                })
                            }), tsChanged && _saveTombstones(localTS)
                        }
                        if (Array.isArray(cloudPayload.users) || Array.isArray(localPayload.users)) {
                            mergedPayload.users = _filterTombstoned("users", _mergeWithConflict(cloudPayload.users, localPayload.users, function(u) {
                                return u.id
                            }))
                        }
                        Array.isArray(mergedPayload.karyawan) && (mergedPayload.karyawan = _filterTombstoned("karyawan", mergedPayload.karyawan))
                    } catch (bugfixErr) {
                        console.warn("[cloudPush BUGFIX users/karyawan merge] Gagal:", bugfixErr)
                    }
                })(), localPayload.training && cloudPayload.training && (mergedPayload.training = {
                    ...localPayload.training
                }, Array.isArray(localPayload.training.peserta) && Array.isArray(cloudPayload.training.peserta) && (mergedPayload.training.peserta = _filterTombstoned("peserta", _mergeWithConflict(cloudPayload.training.peserta, localPayload.training.peserta, pesertaKeyFn)))), localPayload.drygoodsData && cloudPayload.drygoodsData && (mergedPayload.drygoodsData = {
                    ...localPayload.drygoodsData
                }, Array.isArray(localPayload.drygoodsData.transactions) && Array.isArray(cloudPayload.drygoodsData.transactions) && (mergedPayload.drygoodsData.transactions = _mergeWithConflict(cloudPayload.drygoodsData.transactions, localPayload.drygoodsData.transactions, dgTrxKeyFn)), Array.isArray(localPayload.drygoodsData.bankItems) && Array.isArray(cloudPayload.drygoodsData.bankItems) && (mergedPayload.drygoodsData.bankItems = _mergeWithConflict(cloudPayload.drygoodsData.bankItems, localPayload.drygoodsData.bankItems, dgTrxKeyFn))), cloudLog("🔀 Konflik terdeteksi — data digabung otomatis (merge). Cloud: " + cloudRow.updated_at, "info"), await auditLog("merge", dirtyHint || "all", "", "Merge dari cloud: " + cloudRow.updated_at), silent || showToast("🔀 Merge: data dari 2 device digabung otomatis", "info")
            }
            mergedPayload._pushedBy = getDeviceId(), mergedPayload._pushedAt = (new Date).toISOString(), dirtyHint && (mergedPayload._dirtyModule = dirtyHint);
            const upsertResult = await neonUpsert("sjnam_sync", "sjnam_main", {
                payload: mergedPayload,
                updated_at: (new Date).toISOString()
            });
            const serverUpdatedAt = upsertResult?.updated_at || mergedPayload._pushedAt;
            window._lastPushedHash = _hashPayload(mergedPayload), window._lastCloudUpdatedAt = serverUpdatedAt;
            try {
                localStorage.setItem(window._LAST_PULL_TS_KEY, window._lastCloudUpdatedAt)
            } catch (e) {}
            return dirtyHint ? clearDirty(dirtyHint) : clearDirty(), await auditLog("push", dirtyHint || "all", "", "Push berhasil. Server ts: " + serverUpdatedAt), window._rolePermsLocalDirty = !1, updateSyncStatus("connected"), cloudLog("✅ Data tersimpan ke Firestore (" + window.data.length + " delay, " + window.dfsData.length + " DFS)", "success"), silent || showToast("⚡ Firestore Sync berhasil! (" + window.data.length + " records)", "success"), !0
        } catch (err) {
            return updateSyncStatus("error"), cloudLog("❌ Gagal upload: " + err.message, "error"), silent || showToast("Sync gagal: " + err.message, "error"), !1
        }
    }
    async function cloudPull(silent = !1) {
        if (!neonConfigured()) return void (silent || showToast("Firebase belum dikonfigurasi (js/config.js)", "error"));
        updateSyncStatus("syncing");
        try {
            const meta = await neonSelectOne("sjnam_sync", "sjnam_main");
            if (!meta) throw new Error("Data tidak ditemukan di Firestore");
            const cloudUpdatedAt = meta.updated_at;
            if (_lastCloudUpdatedAt && cloudUpdatedAt && cloudUpdatedAt <= _lastCloudUpdatedAt) return cloudLog("⏭️ Smart Pull: tidak ada perubahan data antar device, skip pull (payload tidak diunduh)", "info"), updateSyncStatus("connected"), void (silent || showToast("Data sudah paling baru — tidak ada perubahan dari device lain", "info"));
            const row = await neonSelectOne("sjnam_sync", "sjnam_main");
            if (!row) throw new Error("Data tidak ditemukan di Firestore");
            const rec = row.payload,
                savedAt = cloudUpdatedAt ? new Date(cloudUpdatedAt).toLocaleString("id-ID") : "-";
            if (!silent && !await showConfirm("⚡ Tarik Data dari Firestore", `Data cloud: ${(rec.data||[]).length} delay records, ${(rec.dfsData||[]).length} DFS, disimpan ${savedAt}.\n\nData lokal saat ini akan DIGANTI. Lanjutkan?`)) return void updateSyncStatus("connected");
            window._cloudPullInProgress = !0;
            try {
                if (rec.deletedTombstones && "object" == typeof rec.deletedTombstones) {
                    const localTS = _loadTombstones();
                    let changed = !1;
                    Object.keys(rec.deletedTombstones).forEach(scope => {
                        localTS[scope] || (localTS[scope] = {}), Object.keys(rec.deletedTombstones[scope] || {}).forEach(id => {
                            (!localTS[scope][id] || rec.deletedTombstones[scope][id] > localTS[scope][id]) && (localTS[scope][id] = rec.deletedTombstones[scope][id], changed = !0)
                        })
                    }), changed && _saveTombstones(localTS)
                }
                if (Array.isArray(rec.data) && (window.data = rec.data, localStorage.setItem(STORAGE_KEY, JSON.stringify(window.data))), Array.isArray(rec.stations) && rec.stations.length > 0 && (window.stations = rec.stations, localStorage.setItem(STATIONS_KEY, JSON.stringify(window.stations))), Array.isArray(rec.dfsData) && (window.dfsData = rec.dfsData, localStorage.setItem(DFS_KEY, JSON.stringify(window.dfsData))), rec.settings && (window.settings = {
                        ...window.settings,
                        ...rec.settings
                    }, localStorage.setItem(SETTINGS_KEY, JSON.stringify(window.settings)), applyDarkMode()), rec.training) {
                    const _localTraining = function() {
                            try {
                                return JSON.parse(localStorage.getItem("sjn_training_v1") || "null")
                            } catch (e) {
                                return null
                            }
                        }(),
                        _mergedTraining = _localTraining ? mergeTraining(_localTraining, rec.training) : rec.training;
                    localStorage.setItem("sjn_training_v1", JSON.stringify(_mergedTraining)), window.trainingData && Object.assign(window.trainingData, _mergedTraining)
                }
                if (Array.isArray(rec.users)) {
                    const _localUsers = function() {
                        try {
                            return JSON.parse(localStorage.getItem("sjnam_users_v1") || "null")
                        } catch (e) {
                            return null
                        }
                    }();
                    let _mergedUsers = rec.users;
                    if (_localUsers && Array.isArray(_localUsers)) {
                        const _userMap = new Map;
                        rec.users.forEach(u => {
                            u.id && _userMap.set(u.id, u)
                        }), _localUsers.forEach(u => {
                            u.id && _userMap.set(u.id, u)
                        }), _mergedUsers = Array.from(_userMap.values())
                    }
                    _mergedUsers = _filterTombstoned("users", _mergedUsers), localStorage.setItem("sjnam_users_v1", JSON.stringify(_mergedUsers)), window._userSelectedIds && window._userSelectedIds.clear(), "function" == typeof renderUserTable && renderUserTable()
                }
                if (Array.isArray(rec.karyawan)) {
                    const _localKar = function() {
                        try {
                            return JSON.parse(localStorage.getItem("sjnam_karyawan_v1") || "null")
                        } catch (e) {
                            return null
                        }
                    }();
                    let _mergedKar = rec.karyawan;
                    if (_localKar && Array.isArray(_localKar)) {
                        const _karMap = new Map;
                        rec.karyawan.forEach(k => {
                            k.id && _karMap.set(k.id, k)
                        }), _localKar.forEach(k => {
                            k.id && _karMap.set(k.id, k)
                        }), _mergedKar = Array.from(_karMap.values())
                    }
                    _mergedKar = _filterTombstoned("karyawan", _mergedKar), localStorage.setItem("sjnam_karyawan_v1", JSON.stringify(_mergedKar)), "function" == typeof window.setKaryawanData && window.setKaryawanData(_mergedKar), "function" == typeof window.renderKaryawanUserOptions && window.renderKaryawanUserOptions(),
                        function() {
                            try {
                                var _cu = window.currentUser;
                                if (!_cu || "User-DRG" !== _cu.role) return;
                                var _myUser = (_cu.username || "").toLowerCase(),
                                    _found = _mergedKar.find(function(k) {
                                        return (k.username || "").toLowerCase() === _myUser || (k.nip || "").toLowerCase() === _myUser
                                    }),
                                    _newSt = _found && _found.station && "ALL" !== _found.station ? _found.station : null;
                                if (window._userDrgStation === _newSt) return;
                                window._userDrgStation = _newSt, window._userStationLock = _newSt, _cu && (_cu.station = _newSt), document.querySelectorAll("[data-dg-station]").forEach(function(t) {
                                    var ts = t.dataset.dgStation;
                                    ts && (_newSt && "ALL" !== _newSt ? ts === _newSt ? (t.style.opacity = "", t.style.pointerEvents = "", t.title = "") : (t.style.opacity = "0.35", t.style.pointerEvents = "none", t.title = "ALL" === ts ? "Akses terbatas" : "Akses terbatas ke station " + _newSt) : (t.style.opacity = "", t.style.pointerEvents = "", t.title = ""))
                                }), "object" == typeof window.DRYGOODS && "function" == typeof window.DRYGOODS.renderAll && setTimeout(function() {
                                    window.DRYGOODS.renderAll()
                                }, 50)
                            } catch (ex) {
                                console.warn("[DRG Cloud Station Refresh]", ex)
                            }
                        }()
                }
                Array.isArray(rec.stcrData) && rec.stcrData.length > 0 && (localStorage.setItem("sjnam_stcr_data_v1", JSON.stringify(rec.stcrData)), window.STCR && "function" == typeof window.STCR.loadData && (window.STCR.loadData(), "function" == typeof window.STCR.applyFilters && window.STCR.applyFilters())), rec.drygoodsData && (localStorage.setItem("sjnam_drygoods_v1", JSON.stringify(rec.drygoodsData)), "object" == typeof window.DRYGOODS && "function" == typeof window.DRYGOODS.loadData && (window.DRYGOODS.loadData(), window.DRYGOODS.renderAll())), rec.rolePerms && (window._rolePermsLocalDirty ? (cloudLog("⏭️ Pull: skip rolePerms dari cloud — ada perubahan lokal yang belum ter-push", "info"), neonConfigured() && setTimeout(function() {
                    cloudPush(!0).then(function(ok) {
                        ok && (window._rolePermsLocalDirty = !1)
                    }).catch(function(e) {
                        console.warn("[RolePerms push]", e)
                    })
                }, 200)) : (localStorage.setItem("sjnam_role_perms_v1", JSON.stringify(rec.rolePerms)), "function" == typeof window.renderPermTable && window.renderPermTable(), "function" == typeof window.applyPermissions ? window.applyPermissions() : "function" == typeof applyPermissions && applyPermissions()));
                let certChanged = !1;
                rec.certTemplate1 && (localStorage.setItem("sjn_cert_template_1", JSON.stringify(rec.certTemplate1)), certChanged = !0), rec.certTemplate2 && (localStorage.setItem("sjn_cert_template_2", JSON.stringify(rec.certTemplate2)), certChanged = !0), rec.certTemplateActive && (localStorage.setItem("sjn_cert_template_active", rec.certTemplateActive), certChanged = !0), rec.certPositions && (localStorage.setItem("sjn_cert_positions_v1", JSON.stringify(rec.certPositions)), certChanged = !0), void 0 !== rec.certBarcode && null !== rec.certBarcode && (localStorage.setItem("sjn_cert_barcode_v1", rec.certBarcode), certChanged = !0), rec.certCustomTexts && (localStorage.setItem("sjn_cert_custom_texts_v1", JSON.stringify(rec.certCustomTexts)), certChanged = !0), rec.certCustomTextsSJ && (localStorage.setItem("sjn_cert_custom_texts_sj_v1", JSON.stringify(rec.certCustomTextsSJ)), certChanged = !0), rec.certCustomTextsNAM && (localStorage.setItem("sjn_cert_custom_texts_nam_v1", JSON.stringify(rec.certCustomTextsNAM)), certChanged = !0), rec.certCustomTextsBoth && (localStorage.setItem("sjn_cert_custom_texts_both_v1", JSON.stringify(rec.certCustomTextsBoth)), certChanged = !0), rec.certParaf && (localStorage.setItem("sjn_cert_paraf_v1", JSON.stringify(rec.certParaf)), certChanged = !0), void 0 !== rec.certParafShow && null !== rec.certParafShow && (localStorage.setItem("sjn_cert_paraf_show_v1", rec.certParafShow), certChanged = !0), certChanged && ("function" == typeof window.loadCertificateTemplate && window.loadCertificateTemplate(), "function" == typeof window.ctbRenderAll && window.ctbRenderAll()), window._rolePermsLocalDirty || _autoSyncTimer && (clearTimeout(_autoSyncTimer), window._autoSyncTimer = null), window._lastCloudUpdatedAt = cloudUpdatedAt;
                try {
                    localStorage.setItem(window._LAST_PULL_TS_KEY, window._lastCloudUpdatedAt)
                } catch (e) {}
                window._lastPushedHash = _hashPayload(getAllCloudData())
            } finally {
                window._cloudPullInProgress = !1
            }
            renderTable(), renderDashboard(), renderStations(), renderDfsTable(), "function" == typeof window.refreshTrainingViews && window.refreshTrainingViews(), "function" == typeof window.renderBankStations && window.renderBankStations(), updateSyncStatus("connected"), cloudLog("✅ Data berhasil diambil dari Firestore (" + window.data.length + " delay, " + window.dfsData.length + " DFS)", "success"), blinkBlueLight(), await auditLog("pull", "all", "", "Pull dari cloud. " + window.data.length + " delay, " + window.dfsData.length + " DFS"), setTimeout(_flushOfflineQueue, 2e3)
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
    }, window.cloudLog = cloudLog, window.updateSyncStatus = updateSyncStatus, window.mergeById = mergeById, window.mergeTraining = mergeTraining, window.getAllCloudData = getAllCloudData, window.getDeviceId = getDeviceId, window.cloudPush = cloudPush, window.cloudPull = cloudPull, window.blinkBlueLight = blinkBlueLight, window.blinkSyncLight = blinkSyncLight, window.startRealtimeSubscription = startRealtimeSubscription, window.triggerAutoSync = function(dirtyHint = null) {
        _cloudPullInProgress || neonConfigured() && (clearTimeout(_autoSyncTimer), window._autoSyncTimer = setTimeout(async () => {
            if (_cloudPullInProgress) return;
            const currentHash = _hashPayload(getAllCloudData());
            if ((!currentHash || currentHash !== _lastPushedHash) && await cloudPush(!0, dirtyHint)) {
                const el = document.getElementById("smartSyncLastPush");
                el && (el.textContent = "Terakhir sync: " + (new Date).toLocaleTimeString("id-ID"))
            }
        }, 800))
    }, window.initCloudUI = initCloudUI, window.updateAutoSyncBtn = updateAutoSyncBtn, window.initSyncDelayUI = function() {}, window.updatePresetHighlight = function(val) {}
}();
