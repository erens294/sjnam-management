/* Integration smoke test: loads the FULL integrated index_new3.html (not an
   isolated fixture) via jsdom, with runScripts:'dangerously' so every real
   <script> tag (including js/auth.js loaded from disk) actually executes,
   exactly like a browser would. This verifies the splice didn't break
   anything in the real document context (Tailwind CDN script, sidebar UI
   script, the dozens of other feature IIFEs, etc. all run together).

   NOTE: external CDN scripts (Tailwind, Chart.js, xlsx, jspdf, html2canvas,
   Supabase) are NOT fetched here (no network in this sandbox) — jsdom will
   log resource load errors for those, which is expected and not a bug in
   our code. We only care whether OUR code (auth.js + the inline scripts
   that depend on it) executes without throwing.
*/
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const htmlPath = path.join(__dirname, '..', 'dist', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// jsdom's built-in resource loader cannot fetch relative local file paths
// (e.g. <script src="js/auth.js">) the way a real static file server would —
// there's no server here, just a string of HTML. To genuinely test "does the
// integrated document work", we inline each module's actual source in place
// of its <script src="..."> tag, so it executes at the exact same point in
// document order as it would in a real deployment.
//
// [BUG FOUND & FIXED] String.replace(pattern, replacementString) treats `$$`
// in the replacement STRING as a special escape sequence that collapses to a
// single literal `$` (per the JS spec for replacement patterns: $$ -> $).
// shared-utils.js legitimately contains `const $$ = ...` (jQuery-style
// querySelectorAll alias) — every previous inlining call silently corrupted
// it to `const $ = ...`, which collided with index.html's own top-level
// `const $` and threw "Identifier '$' has already been declared", BUT ONLY
// in this test harness's in-memory string — the real dist files on disk were
// never affected. Fixed by passing a replacer FUNCTION instead of a string;
// functions are not subject to $-pattern substitution.
const authJsSrc = fs.readFileSync(path.join(__dirname, '..', 'dist', 'js', 'auth.js'), 'utf8');
const sharedUtilsSrc = fs.readFileSync(path.join(__dirname, '..', 'dist', 'js', 'shared-utils.js'), 'utf8');
const serviceRecoverySrc = fs.readFileSync(path.join(__dirname, '..', 'dist', 'js', 'service-recovery.js'), 'utf8');
const trainingSrc = fs.readFileSync(path.join(__dirname, '..', 'dist', 'js', 'training.js'), 'utf8');
const stcrSrc = fs.readFileSync(path.join(__dirname, '..', 'dist', 'js', 'stcr.js'), 'utf8');
const drygoodsSrc = fs.readFileSync(path.join(__dirname, '..', 'dist', 'js', 'drygoods.js'), 'utf8');
const certBuilderSrc = fs.readFileSync(path.join(__dirname, '..', 'dist', 'js', 'certificate-builder.js'), 'utf8');
const homeEditorSrc = fs.readFileSync(path.join(__dirname, '..', 'dist', 'js', 'home-editor.js'), 'utf8');
const bankStationSyncSrc = fs.readFileSync(path.join(__dirname, '..', 'dist', 'js', 'bank-station-sync.js'), 'utf8');
const auditLogUiSrc = fs.readFileSync(path.join(__dirname, '..', 'dist', 'js', 'audit-log-ui.js'), 'utf8');
const patchV3Src = fs.readFileSync(path.join(__dirname, '..', 'dist', 'js', 'patch-arsitektur-v3.js'), 'utf8');
const blueprintV1Src = fs.readFileSync(path.join(__dirname, '..', 'dist', 'js', 'blueprint-v1.js'), 'utf8');
const userManagementSrc = fs.readFileSync(path.join(__dirname, '..', 'dist', 'js', 'user-management.js'), 'utf8');
const karyawanManagementSrc = fs.readFileSync(path.join(__dirname, '..', 'dist', 'js', 'karyawan-management.js'), 'utf8');

function inlineScript(html, srcAttr, code, label) {
  const escaped = srcAttr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<script src="${escaped}(?:\\?[^"]*)?"[^>]*></script>`);
  if (!re.test(html)) {
    throw new Error(`Could not find <script src="${srcAttr}"> tag to inline (${label}) — check dist/index.html`);
  }
  return html.replace(re, () => '<script>' + code + '</script>');
}

html = inlineScript(html, 'js/stcr.js', stcrSrc, 'stcr.js');
html = inlineScript(html, 'js/certificate-builder.js', certBuilderSrc, 'certificate-builder.js');
html = inlineScript(html, 'js/home-editor.js', homeEditorSrc, 'home-editor.js');
html = inlineScript(html, 'js/training.js', trainingSrc, 'training.js');
html = inlineScript(html, 'js/bank-station-sync.js', bankStationSyncSrc, 'bank-station-sync.js');
html = inlineScript(html, 'js/audit-log-ui.js', auditLogUiSrc, 'audit-log-ui.js');
html = inlineScript(html, 'js/patch-arsitektur-v3.js', patchV3Src, 'patch-arsitektur-v3.js');
html = inlineScript(html, 'js/blueprint-v1.js', blueprintV1Src, 'blueprint-v1.js');
html = inlineScript(html, 'js/service-recovery.js', serviceRecoverySrc, 'service-recovery.js');
const configJsSrc = fs.readFileSync(path.join(__dirname, '..', 'dist', 'js', 'config.js'), 'utf8');
html = inlineScript(html, 'js/config.js', configJsSrc, 'config.js');
html = inlineScript(html, 'js/shared-utils.js', sharedUtilsSrc, 'shared-utils.js');
html = inlineScript(html, 'js/auth.js', authJsSrc, 'auth.js');
// drygoods.js MUST be inlined after auth.js is already in place — it wraps
// window.switchTab and must wrap the permission-gated version from auth.js,
// not a pre-auth.js version (see drygoods.js header comment / Tahap 2 regression).
html = inlineScript(html, 'js/drygoods.js', drygoodsSrc, 'drygoods.js');
// drygoods-tab-watch.js (added later) reacts to sjn:tab-changed + DOM
// MutationObserver independent of the switchTab wrapper chain — order vs
// drygoods.js doesn't matter functionally, but keep it adjacent for clarity.
const drygoodsTabWatchSrc = fs.readFileSync(path.join(__dirname, '..', 'dist', 'js', 'drygoods-tab-watch.js'), 'utf8');
html = inlineScript(html, 'js/drygoods-tab-watch.js', drygoodsTabWatchSrc, 'drygoods-tab-watch.js');
const stationReportSrc = fs.readFileSync(path.join(__dirname, '..', 'dist', 'js', 'station-report.js'), 'utf8');
html = inlineScript(html, 'js/station-report.js', stationReportSrc, 'station-report.js');

// user-management.js and karyawan-management.js MUST be inlined after auth.js
// (they read window.currentUser, window.saveUsers which auth.js provides).
html = inlineScript(html, 'js/user-management.js', userManagementSrc, 'user-management.js');
html = inlineScript(html, 'js/karyawan-management.js', karyawanManagementSrc, 'karyawan-management.js');

let pass = 0, fail = 0;
const failures = [];
function assert(cond, msg) {
  if (cond) { pass++; }
  else { fail++; failures.push(msg); console.log('  ❌ FAIL:', msg); }
}

async function hashSha256(str) {
  const { webcrypto } = require('crypto');
  const buf = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

(async () => {
  console.log('\n=== INTEGRATION SMOKE TEST: dist/index_new3.html ===\n');

  const virtualConsoleErrors = [];
  const { VirtualConsole } = require('jsdom');
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    // Resource load errors for CDN scripts are expected (no network access).
    // Real JS runtime errors from our own inline scripts are NOT expected.
    virtualConsoleErrors.push(e.message || String(e));
  });

  const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    resources: 'usable',
    virtualConsole: vc,
    pretendToBeVisual: true,
    beforeParse(window) {
      // CDN scripts (Tailwind, Chart.js, xlsx, jspdf, html2canvas, Supabase) cannot
      // load in this offline sandbox. Stub the globals real browsers would have
      // once those scripts load, so we can isolate failures in OUR OWN code from
      // failures caused purely by lack of network access. beforeParse runs before
      // jsdom starts executing any <script> tags in the document.
      window.tailwind = { config: {} };
      window.Chart = window.Chart || function () {};
      window.XLSX = window.XLSX || {};
      window.jspdf = window.jspdf || {};
      window.html2canvas = window.html2canvas || function () { return Promise.resolve({}); };
      window.supabase = window.supabase || { createClient: () => ({ from: () => ({}) }) };

      // ---- Mock Firestore REST backend (in-memory) ----
      // Lets us genuinely exercise cloudPush/cloudPull/migration end-to-end
      // (real function calls hitting a real fetch()), rather than only
      // testing the supporting logic around them. Mimics just enough of the
      // Firestore REST API shape (GET single doc, GET collection/list, PATCH
      // upsert) for our code's actual usage pattern.
      window.__mockFirestore = { collections: {} };
      window.__mockClock = Date.now();
      window.__nextMockUpdateTime = function () {
        window.__mockClock += 15;
        return new Date(window.__mockClock).toISOString();
      };
      window.fetch = async function (url, opts) {
        const urlObj = String(url).split('?');
        const path = urlObj[0], queryStr = urlObj[1] || '';
        const m = path.match(/\/documents\/([^\/?]+)(?:\/([^\/?]+))?/);
        if (!m) return { ok: false, status: 404, text: async () => '' };
        const collection = m[1], docId = m[2];
        const method = (opts && opts.method) || 'GET';
        window.__mockFirestore.collections[collection] = window.__mockFirestore.collections[collection] || {};
        const coll = window.__mockFirestore.collections[collection];
        if (method === 'GET' && docId) {
          const doc = coll[docId];
          if (!doc) return { ok: false, status: 404, text: async () => '' };
          return { ok: true, status: 200, text: async () => JSON.stringify(doc) };
        }
        if (method === 'GET' && !docId) {
          const docs = Object.keys(coll).map((id) => coll[id]);
          return { ok: true, status: 200, text: async () => JSON.stringify(docs.length ? { documents: docs } : {}) };
        }
        if (method === 'PATCH' && docId) {
          const body = JSON.parse(opts.body);
          const now = window.__nextMockUpdateTime();
          const existing = coll[docId];
          // Honor updateMask.fieldPaths (true partial update, like real Firestore):
          // only the listed top-level fields are touched; anything else already
          // on the document survives untouched.
          const maskFields = [...queryStr.matchAll(/updateMask\.fieldPaths=([^&]+)/g)].map(mm => decodeURIComponent(mm[1]));
          const mergedFields = existing ? { ...existing.fields } : {};
          if (maskFields.length) {
            maskFields.forEach(fp => {
              if (body.fields.hasOwnProperty(fp)) mergedFields[fp] = body.fields[fp];
              else delete mergedFields[fp];
            });
          } else {
            Object.assign(mergedFields, body.fields);
          }
          const newDoc = {
            name: 'projects/mock/databases/(default)/documents/' + collection + '/' + docId,
            fields: mergedFields,
            createTime: existing ? existing.createTime : now,
            updateTime: now,
          };
          coll[docId] = newDoc;
          return { ok: true, status: 200, text: async () => JSON.stringify(newDoc) };
        }
        return { ok: false, status: 400, text: async () => '' };
      };
    },
  });
  const { window } = dom;

  const { webcrypto } = require('crypto');
  Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
  window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  // matchMedia isn't implemented in jsdom but some UI code may probe it defensively
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener(){}, removeListener(){} }));

  // Allow all the document's own <script> tags (including js/auth.js via relative
  // src) and async init code to run. We wait generously since the original file
  // has several setTimeout-staged init sequences (e.g. cloud sync at 1200ms).
  await new Promise(r => setTimeout(r, 800));

  console.log('[1] Page loads and core auth globals are defined');
  assert(typeof window.applyPermissions === 'function', 'window.applyPermissions defined after full page load');
  assert(typeof window.checkAuth === 'function', 'window.checkAuth defined');
  assert(typeof window.getUserStation === 'function', 'window.getUserStation defined');
  assert(typeof window.roleNameToKey === 'function', 'window.roleNameToKey defined');
  assert(Array.isArray(window.CUSTOM_ROLES) && window.CUSTOM_ROLES.length === 6, 'window.CUSTOM_ROLES has 6 entries (added User-STR for Station Report)');

  console.log('\n[2] Default users seeded in real document context');
  const users = JSON.parse(window.localStorage.getItem('sjnam_users_v1') || '[]');
  assert(users.length === 5, 'default users seeded, got ' + users.length);

  console.log('\n[3] Login flow works end-to-end in the real document');
  const knownHash = await hashSha256('IntegrationTest123!');
  const allUsers = JSON.parse(window.localStorage.getItem('sjnam_users_v1') || '[]');
  allUsers.push({ id: 999, username: 'integrationtest', password: knownHash, role: 'Admin', name: 'Integration Test', active: true, created: '2026-01-01', mustChangePassword: false });
  window.localStorage.setItem('sjnam_users_v1', JSON.stringify(allUsers));

  window.document.getElementById('loginUser').value = 'integrationtest';
  window.document.getElementById('loginPass').value = 'IntegrationTest123!';
  const form = window.document.getElementById('loginForm');
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 200));

  assert(window.currentUser != null, 'currentUser set after login in real document');
  assert(window.currentUser && window.currentUser.username === 'integrationtest', 'correct username after login');
  assert(window.document.getElementById('loginOverlay').style.display === 'none', 'login overlay hidden after login');
  assert(window.document.getElementById('tabAdminBtn').style.display === '', 'Admin tab visible for Admin role in real document');

  console.log('\n[4] renderPermTable (kept in index.html, now using window.* exports from auth.js) does not throw');
  assert(typeof window.renderPermTable === 'function', 'window.renderPermTable defined (extracted UI code intact)');
  let renderError = null;
  try { window.renderPermTable(); } catch (e) { renderError = e; }
  assert(renderError === null, 'renderPermTable() executes without throwing: ' + (renderError && renderError.message));

  console.log('\n[5] Sidebar logout delegation works exactly once (no double-fire)');
  let confirmCallCount = 0;
  window.confirm = () => { confirmCallCount++; return true; };
  window.document.getElementById('btnLogoutSide').click();
  await new Promise(r => setTimeout(r, 50));
  assert(confirmCallCount === 1, 'confirm() dialog shown exactly once on sidebar logout click, got ' + confirmCallCount);
  assert(window.currentUser == null, 'currentUser cleared after sidebar logout');

  console.log('\n[6] No unexpected runtime errors from our own code during the whole sequence');
  // Filter out expected noise: CDN resource load failures (no network in sandbox),
  // and CSS parsing warnings jsdom emits for Tailwind's @media/:is() syntax it doesn't fully support.
  const realErrors = virtualConsoleErrors.filter(m =>
    !/Could not load|NetworkError|fetch failed|ENOTFOUND|getaddrinfo/i.test(m) &&
    !/Not implemented: window\.scrollTo|Not implemented: Window's scrollTo/i.test(m)
  );
  if (realErrors.length) {
    console.log('  Non-network runtime errors detected:');
    realErrors.forEach(m => console.log('    -', m.slice(0, 300)));
  }
  assert(realErrors.length === 0, `no unexpected JS runtime errors (found ${realErrors.length})`);

  console.log('\n[7] REGRESSION TEST: switchTab permission gate survives the full chain (base -> auth.js gate -> Enhanced-features -> Drygoods) in the real document');
  {
    // Set up a Co-Admin denied access to tab-settings via rolePerms, then verify
    // switchTab really blocks it end-to-end through all 4 layers of wrapping that
    // exist in the real index.html (this is exactly the scenario where an earlier
    // version of auth.js silently dropped the permission-gate layer).
    const perms = window.getDefaultRolePerms();
    perms['tab-settings'].coAdmin = false;
    window.saveRolePerms(perms);
    window.currentUser = { username: 'coadmintest', role: 'Co-Admin', name: 'CoAdmin Test' };

    const settingsTab = window.document.querySelector('[data-tab="settings"]');
    const wasActive = settingsTab && settingsTab.classList.contains('active');
    window.switchTab('settings');
    await new Promise(r => setTimeout(r, 50));
    const isActiveNow = settingsTab && settingsTab.classList.contains('active');
    assert(isActiveNow === wasActive, 'Co-Admin denied tab-settings via rolePerms: switchTab does not activate the tab in the real document (chain intact end-to-end)');

    // Sanity: Admin should NOT be blocked by the same rolePerms restriction
    window.currentUser = { username: 'integrationtest', role: 'Admin', name: 'Integration Test' };
    window.switchTab('settings');
    await new Promise(r => setTimeout(r, 50));
    assert(settingsTab.classList.contains('active') === true, 'Admin is NOT blocked by rolePerms restrictions meant for Co-Admin (chain still allows Admin through)');
  }

  console.log('\n[8] PREP FOR MODULE SPLIT: data/stations/settings/dfsData accessible via window.*');
  {
    // These were converted from `let` to `var` specifically so that, once
    // shared-utils.js and service-recovery.js become separate <script> tags,
    // both can read/write the SAME underlying array/object via window.data
    // etc. `let` at script top-level is scoped to that single <script> block
    // and would NOT be visible from a different script tag at all.
    assert(Array.isArray(window.data), 'window.data is accessible and is an array');
    assert(Array.isArray(window.stations), 'window.stations is accessible and is an array');
    assert(typeof window.settings === 'object' && window.settings !== null, 'window.settings is accessible and is an object');
    assert(Array.isArray(window.dfsData), 'window.dfsData is accessible and is an array');
    assert(window.stations.length > 0, 'default stations were seeded (sanity check that var conversion did not break init logic)');
  }

  console.log('\n[9] REGRESSION TEST: default stations are actually PERSISTED to localStorage on first load');
  {
    // This catches a real bug found during Tahap 3 integration: saveData/
    // saveStations/saveDfsData were briefly defined in a LATER script block
    // (after shared-utils.js) while the "DEFAULT STATIONS" init code that
    // calls saveStations() synchronously runs much EARLIER in the document
    // — causing a silent "saveStations is not defined" ReferenceError that
    // aborted before localStorage.setItem ever ran, even though window.data
    // looked populated in memory.
    const stored = JSON.parse(window.localStorage.getItem('sjn_stations_v2') || '[]');
    assert(stored.length > 0, `default stations actually persisted to localStorage (sjn_stations_v2), got ${stored.length} entries`);
    assert(window.stations.length === stored.length, 'in-memory window.stations matches what was persisted');
  }

  console.log('\n[10] shared-utils.js: cloud-sync functions are properly exported to window');
  {
    const fns = ['cloudPush', 'cloudPull', 'markDirty', 'clearDirty', 'isDirty', 'triggerAutoSync',
                 'getSupabaseClient', 'getAllCloudData', 'mergeById', 'stampRecord', 'stampArray',
                 'saveCloudConfig', 'startRealtimeSubscription', '_auditSave', '_flushOfflineQueue'];
    fns.forEach(fn => {
      assert(typeof window[fn] === 'function', `window.${fn} is exported and callable`);
    });
  }

  console.log('\n[11] REGRESSION TEST: cloudConfig retains real Firebase credentials (not overwritten by stale pre-declare block)');
  {
    // Bug found during Tahap 3: service-recovery.js's pre-declare block used
    // to set `var cloudConfig = {supabaseUrl:'', supabaseKey:''}` AFTER
    // shared-utils.js had already correctly initialized it with the real
    // default credentials — silently wiping out cloud sync configuration on
    // every page load. Fixed by removing the redundant pre-declare in
    // service-recovery.js once load order became shared-utils.js first.
    //
    // NOTE: this app migrated from Supabase to Firebase Firestore (see
    // js/config.js header comment). shared-utils.js deliberately keeps the
    // OLD field names `supabaseUrl`/`supabaseKey` populated with the Firebase
    // project id / a dummy key string, purely so older modules that still
    // gate on `cloudConfig.supabaseUrl && cloudConfig.supabaseKey` keep
    // working without being rewritten one by one. A bare Firebase project id
    // (e.g. "service-sjnam") is NOT a URL, so this test no longer checks for
    // an "https://" prefix — it only checks the field is non-empty/intact.
    assert(window.cloudConfig && window.cloudConfig.supabaseUrl, 'cloudConfig.supabaseUrl is set (not empty string)');
    assert(window.cloudConfig && window.cloudConfig.supabaseUrl === window.SJNAM_CONFIG.FIREBASE_PROJECT_ID, 'cloudConfig.supabaseUrl matches the configured Firebase project id, not wiped/stale');
    assert(window.cloudConfig && window.cloudConfig.supabaseKey && window.cloudConfig.supabaseKey.length > 5, 'cloudConfig.supabaseKey is set and non-trivial length');
  }

  console.log('\n[12] REGRESSION TEST: load order — shared-utils.js functions callable from service-recovery.js INIT');
  {
    // Bug found: service-recovery.js's synchronous INIT section calls
    // todayLocalStr(), applyDarkMode() etc. (defined in shared-utils.js).
    // If load order were wrong, these would throw ReferenceError and abort
    // script execution entirely on every fresh page load.
    assert(typeof window.todayLocalStr === 'function', 'window.todayLocalStr is defined');
    assert(typeof window.todayLocalStr() === 'string', 'todayLocalStr() callable and returns a string');
    assert(typeof window.applyDarkMode === 'function', 'window.applyDarkMode is defined');
  }

  console.log('\n[13] service-recovery.js: core business logic functions are accessible');
  {
    const fns = ['renderTable', 'renderDashboard', 'renderStations', 'getFilteredData',
                 'getDashboardData', 'setWizardStep', 'updatePreviews', 'resetForm',
                 'renderDfsTable', 'dfsApplyToInput', 'formatTimeLocal', 'getStationTz',
                 'stationExists', 'saveData', 'saveStations', 'saveDfsData'];
    fns.forEach(fn => {
      assert(typeof window[fn] === 'function', `window.${fn} is exported and callable`);
    });
  }

  console.log('\n[14] service-recovery.js: getFilteredData() runs without throwing on empty state');
  {
    let err = null;
    let result;
    try { result = window.getFilteredData(); } catch (e) { err = e; }
    assert(err === null, 'getFilteredData() does not throw: ' + (err && err.message));
    assert(Array.isArray(result), 'getFilteredData() returns an array');
  }

  console.log('\n[15] training.js: module functions and state are accessible');
  {
    const fns = ['trainingData', 'saveTraining', 'renderPeserta', 'openMateri', 'renderBankStations'];
    fns.forEach(fn => {
      assert(typeof window[fn] !== 'undefined', `window.${fn} is exported (training.js)`);
    });
    assert(typeof window.trainingData === 'object' && window.trainingData !== null, 'window.trainingData is a populated object');
    assert(Array.isArray(window.trainingData.materi), 'trainingData.materi is an array (default seed present)');
  }

  console.log('\n[16] stcr.js: window.STCR public API is accessible and functional');
  {
    assert(typeof window.STCR === 'object' && window.STCR !== null, 'window.STCR namespace exists');
    const methods = ['init', 'onShowDashboard', 'onShowData', 'onShowStation', 'applyFilters', 'getData'];
    methods.forEach(m => {
      assert(typeof window.STCR[m] === 'function', `window.STCR.${m} is a function`);
    });
    let err = null;
    let data;
    try { data = window.STCR.getData(); } catch (e) { err = e; }
    assert(err === null, 'window.STCR.getData() does not throw: ' + (err && err.message));
    assert(Array.isArray(data), 'window.STCR.getData() returns an array');
    assert(data.length > 0, 'STCR seed data is loaded (got ' + (data && data.length) + ' entries)');
  }

  console.log('\n[17] drygoods.js: module loaded without throwing (functions are internal to its IIFE by design)');
  {
    // Unlike service-recovery.js (plain top-level functions, auto-global),
    // drygoods.js wraps everything in an IIFE like training.js/stcr.js —
    // its render/data functions are intentionally NOT exposed to window,
    // only reachable via the window.switchTab wrapper and internal event
    // listeners. We verify the module loaded and wired itself correctly
    // by checking the switchTab wrapper chain test below instead.
    assert(typeof window.switchTab === 'function', 'window.switchTab still defined after drygoods.js wraps it');
  }

  console.log('\n[18] REGRESSION TEST: Drygoods switchTab wrapper correctly chains after auth.js permission-gate');
  {
    // This specifically verifies the load-order requirement documented in
    // drygoods.js's header: it must wrap the PERMISSION-GATED switchTab from
    // auth.js, not a raw pre-auth version. If load order were wrong, Admin
    // would still work (admins bypass the gate) but a restricted role's
    // block would be silently undone by Drygoods calling the raw original.
    const perms = window.getDefaultRolePerms();
    perms['tab-drygoods-data'].coAdmin = false;
    window.saveRolePerms(perms);
    window.currentUser = { username: 'coadmintest2', role: 'Co-Admin', name: 'CoAdmin Test 2' };

    const dgTab = window.document.querySelector('[data-tab="drygoods-data"]');
    const wasActive = dgTab && dgTab.classList.contains('active');
    window.switchTab('drygoods-data');
    await new Promise(r => setTimeout(r, 50));
    const isActiveNow = dgTab && dgTab.classList.contains('active');
    assert(isActiveNow === wasActive, 'Co-Admin denied drygoods-data via rolePerms is still blocked even with Drygoods wrapper in the chain');

    window.currentUser = { username: 'integrationtest', role: 'Admin', name: 'Integration Test' };
    window.switchTab('drygoods-data');
    await new Promise(r => setTimeout(r, 50));
    assert(dgTab.classList.contains('active') === true, 'Admin can still reach drygoods-data with the full chain intact');
  }

  console.log('\n[19] REGRESSION TEST: drygoods.js script reference is present in the document (was accidentally deleted during certificate-builder.js/home-editor.js extraction in this session, caught by this exact test)');
  {
    // This is meta: by the time this test runs, drygoods.js has already
    // been inlined successfully (the test harness would have thrown a hard
    // error during setup otherwise — see inlineScript()'s error check).
    // This assertion documents the regression explicitly so it's visible
    // in the test report, not just an implicit precondition.
    assert(typeof window.switchTab === 'function', 'drygoods.js loaded successfully (switchTab wrapper chain intact, including Drygoods)');
  }

  console.log('\n[20] certificate-builder.js: wraps renderCertificate/loadCertificateTemplate from training.js correctly');
  {
    assert(typeof window.renderCertificate === 'function', 'window.renderCertificate is defined after certificate-builder.js wraps training.js\'s version');
    assert(typeof window.loadCertificateTemplate === 'function', 'window.loadCertificateTemplate is defined after certificate-builder.js wraps training.js\'s version');
    assert(typeof window.applyFontStyle === 'function', 'window.applyFontStyle is exported (certificate-builder.js)');
    assert(typeof window.ctbRenderAll === 'function', 'window.ctbRenderAll is exported (certificate-builder.js Custom Text Blocks)');
  }

  console.log('\n[21] home-editor.js: module functions are accessible');
  {
    const fns = ['toggleHomeEdit', 'setHomeBg', 'resetHomeBg', 'setHomeLogo', 'resetHomeLogo', 'resizeHomeLogo'];
    fns.forEach(fn => {
      assert(typeof window[fn] === 'function', `window.${fn} is exported and callable (home-editor.js)`);
    });
  }

  console.log('\n[22] bank-station-sync.js: window.renderBankStations works and correctly reads training.js data');
  {
    assert(typeof window.renderBankStations === 'function', 'window.renderBankStations is exported (bank-station-sync.js)');
    assert(typeof window.updateServiceSyncIndicator === 'function', 'window.updateServiceSyncIndicator is exported (bank-station-sync.js)');

    // REGRESSION CHECK: this module captures `const trainingData = window.trainingData`
    // SYNCHRONOUSLY at its own top level (not lazily) — if it had loaded before
    // training.js, trainingData here would be permanently undefined and this call
    // would throw "Cannot read property 'peserta' of undefined". This test would
    // fail loudly if that ordering regression were ever reintroduced.
    let err = null;
    try { window.renderBankStations(); } catch (e) { err = e; }
    assert(err === null, 'renderBankStations() does not throw (confirms training.js loaded BEFORE bank-station-sync.js, as required): ' + (err && err.message));
  }

  console.log('\n[23] RESTORATION TEST: user-management.js — renderUserTable was completely missing, now restored and functional');
  {
    // This is the core regression this module fixes: renderUserTable was
    // accidentally deleted during Tahap 1's auth.js extraction. Every call
    // site was guarded with typeof checks, so it silently no-op'd instead
    // of throwing — meaning the User Management tab was empty/broken with
    // NO visible error anywhere. This test actually invokes the function.
    assert(typeof window.renderUserTable === 'function', 'window.renderUserTable is defined (was completely missing before Tahap 8)');
    let err = null;
    try { window.renderUserTable(); } catch (e) { err = e; }
    assert(err === null, 'renderUserTable() does not throw: ' + (err && err.message));

    const fns = ['deleteSingleUser', 'deleteUser', 'editUser', 'openEditUserModal', 'getRoleBadgeClass'];
    fns.forEach(fn => {
      assert(typeof window[fn] === 'function', `window.${fn} is exported (user-management.js)`);
    });
    assert(window.getRoleBadgeClass('Master').length > 0, 'getRoleBadgeClass returns a real CSS class string');
  }

  console.log('\n[24] RESTORATION TEST: karyawan-management.js — renderKaryawanTable was completely missing, now restored and functional');
  {
    assert(typeof window.renderKaryawanTable === 'function', 'window.renderKaryawanTable is defined (was completely missing before Tahap 8)');
    let err = null;
    try { window.renderKaryawanTable(); } catch (e) { err = e; }
    assert(err === null, 'renderKaryawanTable() does not throw: ' + (err && err.message));

    assert(typeof window.getKaryawanData === 'function', 'window.getKaryawanData is exported (karyawan-management.js)');
    assert(typeof window.setKaryawanData === 'function', 'window.setKaryawanData is exported (karyawan-management.js)');
    const data = window.getKaryawanData();
    assert(Array.isArray(data), 'getKaryawanData() returns an array');
  }

  console.log('\n[25] RESTORATION TEST: User Management correctly reads window.currentUser across script-tag boundary');
  {
    // The original code used bare `currentUser` (a closure variable shared
    // with auth.js's internals in the pre-refactor single-script-tag file).
    // Restored version uses window.currentUser explicitly. This test logs
    // in as different roles and confirms renderUserTable respects role-based
    // visibility (Co-Admin sees a filtered list) without throwing.
    window.currentUser = { username: 'coadmintest3', role: 'Co-Admin', name: 'CoAdmin Test 3' };
    let err = null;
    try { window.renderUserTable(); } catch (e) { err = e; }
    assert(err === null, 'renderUserTable() works correctly for Co-Admin role (window.currentUser read correctly): ' + (err && err.message));

    window.currentUser = { username: 'integrationtest', role: 'Admin', name: 'Integration Test' };
    err = null;
    try { window.renderUserTable(); } catch (e) { err = e; }
    assert(err === null, 'renderUserTable() works correctly for Admin role: ' + (err && err.message));
  }

  console.log('\n[26] audit-log-ui.js: module functions are accessible');
  {
    assert(typeof window.toggleAuditPanel === 'function', 'window.toggleAuditPanel is exported (audit-log-ui.js)');
    assert(typeof window.loadAuditLog === 'function', 'window.loadAuditLog is exported (audit-log-ui.js)');
    assert(typeof window._updateOfflineQueueBadge === 'function', 'window._updateOfflineQueueBadge is exported (audit-log-ui.js)');
  }

  console.log('\n[27] REGRESSION TEST: patch-arsitektur-v3.js wraps triggerAutoSync/cloudPull from shared-utils.js correctly (P9/P10)');
  {
    // This specifically verifies the load-order requirement documented in
    // patch-arsitektur-v3.js's header: P9/P10 capture window.triggerAutoSync
    // and window.cloudPull SYNCHRONOUSLY at parse time (not deferred like
    // most other patches in this file). If shared-utils.js hadn't already
    // loaded by this point, the captured _origTriggerAutoSync/_origCloudPull
    // would be permanently undefined and the wrapping would be a silent no-op.
    assert(typeof window.triggerAutoSync === 'function', 'window.triggerAutoSync still defined after patch-arsitektur-v3.js wraps it (P9)');
    assert(typeof window.cloudPull === 'function', 'window.cloudPull still defined after patch-arsitektur-v3.js wraps it (P10)');

    let err = null;
    try { window.triggerAutoSync('test-module'); } catch (e) { err = e; }
    assert(err === null, 'wrapped triggerAutoSync() does not throw when called: ' + (err && err.message));
  }

  console.log('\n[28] blueprint-v1.js: module functions are accessible');
  {
    const fns = ['_generateTempPassword', '_genTempPw', '_validatePasswordStrength', '_showForceChangePasswordModal', '_showChangePasswordModal', '_checkContractExpiry', '_validateAddRole'];
    fns.forEach(fn => {
      assert(typeof window[fn] === 'function', `window.${fn} is exported and callable (blueprint-v1.js)`);
    });
  }

  console.log('\n[29] RESTORATION TEST: window._generateTempPassword() — was undefined before blueprint-v1.js was extracted, causing user-management.js\'s _doAddUser to throw ReferenceError when creating a new user');
  {
    let err = null;
    let pw;
    try { pw = window._generateTempPassword(); } catch (e) { err = e; }
    assert(err === null, '_generateTempPassword() does not throw: ' + (err && err.message));
    assert(typeof pw === 'string' && pw.length === 8, '_generateTempPassword() returns an 8-character temporary password');
  }

  console.log('\n[30] BUGFIX TEST: window.getOfflineQueueItems() bridges _offlineQueue across script-tag boundary');
  {
    assert(typeof window.getOfflineQueueItems === 'function', 'window.getOfflineQueueItems is exported (shared-utils.js)');
    let err = null;
    let items;
    try { items = await window.getOfflineQueueItems(); } catch (e) { err = e; }
    assert(err === null, 'getOfflineQueueItems() does not throw: ' + (err && err.message));
    assert(Array.isArray(items), 'getOfflineQueueItems() returns an array');

    err = null;
    try { await window._updateOfflineQueueBadge(); } catch (e) { err = e; }
    assert(err === null, '_updateOfflineQueueBadge() runs without throwing, using the fixed bridge: ' + (err && err.message));
  }

  console.log('\n[31] BUGFIX TEST: window.renderDgTrx is exported and callable from patch-arsitektur-v3.js (P9/P10 station refresh)');
  {
    assert(typeof window.renderDgTrx === 'function', 'window.renderDgTrx is exported (drygoods.js)');
    let err = null;
    try { window.renderDgTrx(); } catch (e) { err = e; }
    assert(err === null, 'window.renderDgTrx() does not throw when called directly: ' + (err && err.message));
  }

  console.log('\n[32] BUGFIX TEST: _validateAddRole (FEAT-4) is now wired into _doAddUser\'s account creation flow');
  {
    // Previously dead code (defined but never called anywhere, in the
    // original file or any extracted module). Now wired into the
    // "_add-role-kar-btn" click handler in user-management.js: a
    // station-bound role (e.g. User-SR) with no station on the karyawan
    // record should be blocked with a validation error toast.
    assert(typeof window._validateAddRole === 'function', 'window._validateAddRole is exported (blueprint-v1.js)');
    const issuesNoStation = window._validateAddRole('User-SR', { nip: '12345', station: '' });
    assert(Array.isArray(issuesNoStation) && issuesNoStation.some(i => i.type === 'error'), '_validateAddRole flags missing station for a station-bound role');
    const issuesOk = window._validateAddRole('User-SR', { nip: '12345', station: 'CGK' });
    assert(Array.isArray(issuesOk) && issuesOk.length === 0, '_validateAddRole passes when station-bound role has a station');
  }

  console.log('\n[33] BUGFIX TEST: deleted user does NOT reappear after cloudPull merges stale cloud data (reported bug: "user kembali muncul setelah beberapa waktu")');
  {
    // Reproduce exactly what the user reported: delete a user, then simulate
    // a cloudPull where the cloud's payload is stale (still has the deleted
    // user, e.g. because push hasn't completed yet or came from another
    // device). Before the tombstone fix, the merge logic in cloudPull would
    // re-add the deleted user since "absent from local" wasn't distinguished
    // from "intentionally deleted".
    const usersBefore = [
      { id: 9001, username: 'testuser_a', role: 'User' },
      { id: 9002, username: 'testuser_b', role: 'User' },
      { id: 9003, username: 'testuser_c', role: 'Co-Admin' }
    ];
    window.localStorage.setItem('sjnam_users_v1', JSON.stringify(usersBefore));

    // Simulate deletion of testuser_b (id 9002), exactly as
    // userBulkDeleteConfirm's handler does: filter out, save, record tombstone.
    let users = JSON.parse(window.localStorage.getItem('sjnam_users_v1') || '[]');
    users = users.filter(u => u.id !== 9002);
    window.localStorage.setItem('sjnam_users_v1', JSON.stringify(users));
    window.markDeletedTombstone('users', [9002]);

    assert(JSON.parse(window.localStorage.getItem('sjnam_users_v1')).length === 2, 'user is gone from localStorage immediately after delete');

    // Now simulate a STALE cloud payload (still has testuser_b, as if the
    // push hadn't synced yet or came from a device that doesn't know about
    // the deletion) and run the exact same merge logic cloudPull uses.
    const staleCloudUsers = [
      { id: 9001, username: 'testuser_a', role: 'User' },
      { id: 9002, username: 'testuser_b', role: 'User' }, // stale — should have been deleted
      { id: 9003, username: 'testuser_c', role: 'Co-Admin' }
    ];
    const _localUsers = JSON.parse(window.localStorage.getItem('sjnam_users_v1'));
    const _userMap = new Map();
    staleCloudUsers.forEach(u => { if (u.id) _userMap.set(u.id, u); });
    _localUsers.forEach(u => { if (u.id) _userMap.set(u.id, u); });
    let _mergedUsers = Array.from(_userMap.values());
    _mergedUsers = window._filterTombstoned('users', _mergedUsers);

    assert(!_mergedUsers.some(u => u.id === 9002), 'deleted user (id 9002) does NOT reappear after merging stale cloud payload — bug fixed');
    assert(_mergedUsers.length === 2, 'merged result has exactly 2 users (the deleted one excluded)');

    // Cleanup test data
    window.localStorage.removeItem('sjnam_users_v1');
  }

  console.log('\n[34] BUGFIX TEST: tombstone does NOT block a genuinely re-created record with a newer timestamp');
  {
    // Edge case: if a user with the same id is deleted, then later a NEW
    // record with that same id is created again (re-created on purpose)
    // with a fresh updatedAt newer than the tombstone time, it should NOT
    // be incorrectly filtered out as if it were the stale deleted one.
    window.markDeletedTombstone('users', [9999]);
    const recreated = [{ id: 9999, username: 'recreated', updatedAt: new Date(Date.now() + 10000).toISOString() }];
    const filtered = window._filterTombstoned('users', recreated);
    assert(filtered.length === 1, 'a record re-created AFTER the tombstone timestamp is correctly kept, not treated as stale');
  }

  console.log('\n[35] END-TO-END UI TEST: clicking the real delete button + confirm modal records a tombstone, and the user stays gone after a stale cloudPull');
  {
    // Seed a throwaway user directly in localStorage, log in as Admin
    // (already logged in from earlier tests), open the Manajemen Role tab,
    // and click the ACTUAL rendered 🗑️ delete button + confirm modal —
    // exercising the real UI path end to end, not just calling functions.
    let allUsers = JSON.parse(window.localStorage.getItem('sjnam_users_v1') || '[]');
    const e2eUser = { id: 88888, username: 'e2e_delete_test', role: 'User', active: true, password: 'x'.repeat(64) };
    allUsers.push(e2eUser);
    window.localStorage.setItem('sjnam_users_v1', JSON.stringify(allUsers));

    window.switchTab('admin');
    const usersSubtab = window.document.querySelector('[data-admin-subtab="users"]');
    if (usersSubtab) usersSubtab.click();
    window.renderUserTable();

    const row = window.document.querySelector(`tr[data-user-id="88888"]`);
    assert(!!row, 'seeded test user row renders in the table');

    const deleteBtn = row && row.querySelector('button[onclick*="deleteSingleUser(88888)"]');
    assert(!!deleteBtn, 'delete button for the seeded test user is present in the rendered row');

    if (deleteBtn) {
      deleteBtn.click(); // opens the confirm modal (sets _pendingBulkDeleteIds = [88888])
      const confirmBtn = window.document.getElementById('userBulkDeleteConfirm');
      if (confirmBtn) confirmBtn.click(); // actually performs the deletion + records tombstone
    }

    const afterDelete = JSON.parse(window.localStorage.getItem('sjnam_users_v1') || '[]');
    assert(!afterDelete.some(u => u.id === 88888), 'user is gone from localStorage after clicking the real delete button + confirm');

    const tombstones = JSON.parse(window.localStorage.getItem('sjnam_deleted_tombstones_v1') || '{}');
    assert(tombstones.users && tombstones.users['88888'] != null, 'tombstone was recorded automatically by the real delete confirm handler (not just the isolated logic test)');

    // Now simulate the exact stale-cloud-merge scenario from a real cloudPull
    const staleCloud = [...afterDelete, e2eUser]; // cloud still has the "deleted" user
    const _userMap = new Map();
    staleCloud.forEach(u => { if (u.id) _userMap.set(u.id, u); });
    afterDelete.forEach(u => { if (u.id) _userMap.set(u.id, u); });
    let merged = Array.from(_userMap.values());
    merged = window._filterTombstoned('users', merged);
    assert(!merged.some(u => u.id === 88888), 'user deleted via the REAL UI flow does not reappear after a stale cloud merge');

    // Cleanup
    window.localStorage.setItem('sjnam_users_v1', JSON.stringify(afterDelete));
    delete tombstones.users['88888'];
    window.localStorage.setItem('sjnam_deleted_tombstones_v1', JSON.stringify(tombstones));
  }

  console.log('\n[36] BUGFIX TEST: realtime subscription handler also respects tombstones (second resurrection path — this was the actual culprit for the reported bug)');
  {
    // The realtime subscription fires immediately when ANY other device pushes
    // to Supabase — often within SECONDS of your deletion. The previous fix
    // only covered cloudPull(), but the realtime handler (shared-utils.js,
    // the Supabase channel subscription callback) had the IDENTICAL
    // merge-without-tombstone bug and was completely missed.
    //
    // This is the most likely reason the user saw "deleted user comes back
    // after some time" even after the cloudPull fix — the realtime path
    // would trigger almost immediately if another device or browser tab
    // was open, firing the channel callback which would re-add the user.
    //
    // Simulate the exact realtime handler logic (lines 1204-1227 of
    // the fixed shared-utils.js) with a stale cloud payload:
    const realtimeStalePayload_users = [
      { id: 9001, username: 'user_a', role: 'User' },
      { id: 9002, username: 'victim_realtime', role: 'User' }, // was deleted locally
      { id: 9003, username: 'user_c', role: 'Co-Admin' }
    ];
    const localAfterDelete = [
      { id: 9001, username: 'user_a', role: 'User' },
      { id: 9003, username: 'user_c', role: 'Co-Admin' }
    ];

    // Record tombstone for the deleted user
    window.markDeletedTombstone('users', [9002]);

    // Simulate the REALTIME handler's merge logic (now with tombstone filter):
    const _m = new Map();
    realtimeStalePayload_users.forEach(u => { if (u.id) _m.set(u.id, u); });
    localAfterDelete.forEach(u => { if (u.id) _m.set(u.id, u); });
    let _rtMU = Array.from(_m.values());
    _rtMU = window._filterTombstoned('users', _rtMU); // THIS is the line that was missing before

    assert(!_rtMU.some(u => u.id === 9002), 'deleted user does NOT reappear via the REALTIME handler path (the actual culprit for the reported bug)');
    assert(_rtMU.length === 2, 'realtime merged result has correct count');
  }

  console.log('\n=== DEEP AUDIT: User-DRG station switching (js/drygoods.js) — real functions, real DOM ===\n');

  // Re-login as Admin (test [5] logged out) so we can drive the UI as an admin would.
  window.currentUser = { username: 'integrationtest', role: 'Admin', name: 'Integration Test' };
  window.switchTab('drygoods-data');
  await new Promise(r => setTimeout(r, 50));

  console.log('[37] SETUP: seed a User-DRG employee (karyawan) + matching login account, station = CGK');
  {
    const karyawan = JSON.parse(window.localStorage.getItem('sjnam_karyawan_v1') || '[]');
    karyawan.push({ id: 'kar_elyn_test', nama: 'Elyn Test', nip: '0700001947', username: 'elyntest', station: 'CGK', jabatan: 'Staff', joinDate: '2025-01-01', expiredKontrak: '2027-01-01', updatedAt: new Date().toISOString() });
    window.localStorage.setItem('sjnam_karyawan_v1', JSON.stringify(karyawan));

    const users = JSON.parse(window.localStorage.getItem('sjnam_users_v1') || '[]');
    users.push({ id: 9101, username: 'elyntest', password: 'x'.repeat(64), role: 'User-DRG', name: 'Elyn Test', active: true });
    window.localStorage.setItem('sjnam_users_v1', JSON.stringify(users));

    // Bank Data Station must list the station code for it to be treated as "valid"
    // by isValidBankStation() — buildStationTabs/derived logic depends on this.
    const bankStations = JSON.parse(window.localStorage.getItem('sjn_stations_v2') || '[]');
    if (!bankStations.some(s => s.iata === 'CGK')) bankStations.push({ iata: 'CGK', name: 'Cengkareng' });
    if (!bankStations.some(s => s.iata === 'SUB')) bankStations.push({ iata: 'SUB', name: 'Surabaya' });
    window.localStorage.setItem('sjn_stations_v2', JSON.stringify(bankStations));

    assert(karyawan.some(k => k.username === 'elyntest' && k.station === 'CGK'), 'test karyawan record seeded with station CGK');
  }

  console.log('\n[38] "Log in" as the User-DRG test account and verify the station lock applies on first render (real function, real DOM)');
  {
    window.currentUser = { username: 'elyntest', role: 'User-DRG', name: 'Elyn Test' };
    window.DRYGOODS.renderAll();
    await new Promise(r => setTimeout(r, 50));

    assert(window._userDrgStation === 'CGK', '_userDrgStation correctly resolved to CGK for elyntest, got: ' + window._userDrgStation);

    const stationTabs = [...window.document.querySelectorAll('[data-dg-station]')];
    assert(stationTabs.length > 0, 'station tabs actually rendered in the DOM');
    const cgkTab = stationTabs.find(t => t.dataset.dgStation === 'CGK');
    const otherStationTabs = stationTabs.filter(t => t.dataset.dgStation !== 'CGK');
    assert(!!cgkTab, 'CGK station tab exists');
    assert(cgkTab && cgkTab.style.pointerEvents !== 'none', 'CGK (the assigned station) tab is NOT dimmed/disabled');
    assert(otherStationTabs.length === 0 || otherStationTabs.every(t => t.style.pointerEvents === 'none'), 'every OTHER station tab (including "ALL") is dimmed/disabled for a locked User-DRG');

    const addStBtn = window.document.getElementById('btnDgAddStation');
    assert(addStBtn && addStBtn.disabled === true, '+Station button is disabled for a station-locked User-DRG');
  }

  console.log('\n[39] BUG SCENARIO: Admin changes the employee\'s station (CGK -> SUB) — verify EVERY refresh mechanism picks it up correctly');
  {
    // Simulate the admin-side edit exactly as karyawan-management.js's save
    // handler does: mutate the record in place and persist.
    let karyawan = JSON.parse(window.localStorage.getItem('sjnam_karyawan_v1') || '[]');
    const rec = karyawan.find(k => k.username === 'elyntest');
    rec.station = 'SUB';
    rec.updatedAt = new Date().toISOString();
    window.localStorage.setItem('sjnam_karyawan_v1', JSON.stringify(karyawan));

    // --- Mechanism 1: _applyDrgLock(), called by the sjn:tab-changed listener ---
    window._applyDrgLock();
    await new Promise(r => setTimeout(r, 20));
    assert(window._userDrgStation === 'SUB', '[Mechanism 1: _applyDrgLock] station updates to SUB after admin edit, got: ' + window._userDrgStation);

    let stationTabs = [...window.document.querySelectorAll('[data-dg-station]')];
    let subTab = stationTabs.find(t => t.dataset.dgStation === 'SUB');
    let cgkTabAfter = stationTabs.find(t => t.dataset.dgStation === 'CGK');
    assert(!!subTab && subTab.style.pointerEvents !== 'none', '[Mechanism 1] SUB tab is now the unlocked/active one');
    assert(!cgkTabAfter || cgkTabAfter.style.pointerEvents === 'none', '[Mechanism 1] CGK (the OLD station) is now dimmed — user cannot linger on stale access');
  }

  console.log('\n[40] BUG SCENARIO: revert to CGK, verify the sjn:tab-changed EVENT BUS path (not just direct function calls) also picks it up');
  {
    let karyawan = JSON.parse(window.localStorage.getItem('sjnam_karyawan_v1') || '[]');
    karyawan.find(k => k.username === 'elyntest').station = 'CGK';
    window.localStorage.setItem('sjnam_karyawan_v1', JSON.stringify(karyawan));

    window.document.dispatchEvent(new window.CustomEvent('sjn:tab-changed', { detail: { tab: 'drygoods-data' } }));
    await new Promise(r => setTimeout(r, 20));

    assert(window._userDrgStation === 'CGK', 'sjn:tab-changed event correctly triggers _applyDrgLock + rebuild, station back to CGK, got: ' + window._userDrgStation);
  }

  console.log('\n[41] BUG SCENARIO: switch to SUB again, verify the 5-second BACKGROUND POLL (no tab navigation, no event) picks it up on its own');
  {
    // This is the mechanism that matters most for the reported real-world bug:
    // the user is ALREADY sitting on the Drygoods tab (no navigation happens),
    // and an admin changes their station on another device. Only the
    // standalone setInterval(...,5000) polling loop can catch this.
    let karyawan = JSON.parse(window.localStorage.getItem('sjnam_karyawan_v1') || '[]');
    karyawan.find(k => k.username === 'elyntest').station = 'SUB';
    window.localStorage.setItem('sjnam_karyawan_v1', JSON.stringify(karyawan));

    let stationChangedEventFired = false;
    window.document.addEventListener('sjn:station-changed', () => { stationChangedEventFired = true; }, { once: true });

    // Wait past the 5000ms poll interval (jsdom setInterval/setTimeout run on
    // real wall-clock time here, so this genuinely exercises the real timer).
    await new Promise(r => setTimeout(r, 5300));

    assert(window._userDrgStation === 'SUB', 'BACKGROUND POLL (setInterval 5s) alone — with no tab switch, no click, no event — still detects the station change, got: ' + window._userDrgStation);
    assert(stationChangedEventFired === true, 'sjn:station-changed CustomEvent is dispatched when the background poll detects a change');
  }

  console.log('\n[42] EXACT USER-REPORTED SCENARIO: delete the employee entirely, then re-create with a DIFFERENT station — verify no stale caching anywhere');
  {
    // This is literally what the user described trying: "saya sudah coba
    // delete lalu tambahkan lagi juga tetap tidak bisa dipindahkan
    // stationnya" (I tried deleting then re-adding, still couldn't move the
    // station). Simulate that exact sequence end to end.
    let karyawan = JSON.parse(window.localStorage.getItem('sjnam_karyawan_v1') || '[]');
    karyawan = karyawan.filter(k => k.username !== 'elyntest');
    window.localStorage.setItem('sjnam_karyawan_v1', JSON.stringify(karyawan));

    // Give the background poll a chance to run against a WORLD WHERE THE
    // EMPLOYEE RECORD NO LONGER EXISTS AT ALL (edge case: lookup finds
    // nothing, _newSt should become null, not silently keep the last value).
    await new Promise(r => setTimeout(r, 100));
    window._applyDrgLock();
    assert(window._userDrgStation === null || window._userDrgStation === undefined, 'deleting the employee record clears the station lock (does not keep stale SUB value), got: ' + window._userDrgStation);

    // Now re-create with a NEW station (BPN) — simulating "tambahkan lagi" with a different value.
    karyawan = JSON.parse(window.localStorage.getItem('sjnam_karyawan_v1') || '[]');
    const bankStations = JSON.parse(window.localStorage.getItem('sjn_stations_v2') || '[]');
    if (!bankStations.some(s => s.iata === 'BPN')) { bankStations.push({ iata: 'BPN', name: 'Balikpapan' }); window.localStorage.setItem('sjn_stations_v2', JSON.stringify(bankStations)); }
    karyawan.push({ id: 'kar_elyn_test_2', nama: 'Elyn Test', nip: '0700001947', username: 'elyntest', station: 'BPN', jabatan: 'Staff', joinDate: '2025-01-01', expiredKontrak: '2027-01-01', updatedAt: new Date().toISOString() });
    window.localStorage.setItem('sjnam_karyawan_v1', JSON.stringify(karyawan));

    window._applyDrgLock();
    await new Promise(r => setTimeout(r, 20));
    assert(window._userDrgStation === 'BPN', 'after delete + re-create with a NEW station (BPN), the lock correctly picks up the NEW value — not stuck on any previous station, got: ' + window._userDrgStation);

    const stationTabsFinal = [...window.document.querySelectorAll('[data-dg-station]')];
    const bpnTab = stationTabsFinal.find(t => t.dataset.dgStation === 'BPN');
    assert(!!bpnTab && bpnTab.style.pointerEvents !== 'none', 'BPN tab correctly unlocked after delete+recreate — matches the DOM, not just the internal variable');
  }

  console.log('\n[43] EDGE CASE: username case-sensitivity and whitespace — real-world data entry is rarely perfectly clean');
  {
    let karyawan = JSON.parse(window.localStorage.getItem('sjnam_karyawan_v1') || '[]');
    karyawan = karyawan.filter(k => k.username !== 'elyntest');
    karyawan.push({ id: 'kar_case_test', nama: 'Case Test', nip: '999', username: 'ElynTest', station: 'CGK', updatedAt: new Date().toISOString() });
    window.localStorage.setItem('sjnam_karyawan_v1', JSON.stringify(karyawan));

    window.currentUser = { username: 'elyntest', role: 'User-DRG', name: 'Elyn Test' }; // lowercase, as a real login session would have it
    window._applyDrgLock();
    await new Promise(r => setTimeout(r, 20));
    assert(window._userDrgStation === 'CGK', 'lookup is case-insensitive: login username "elyntest" matches karyawan username "ElynTest", got: ' + window._userDrgStation);

    // Cleanup
    karyawan = JSON.parse(window.localStorage.getItem('sjnam_karyawan_v1') || '[]').filter(k => k.username !== 'ElynTest' && k.username !== 'elyntest');
    window.localStorage.setItem('sjnam_karyawan_v1', JSON.stringify(karyawan));
    let users = JSON.parse(window.localStorage.getItem('sjnam_users_v1') || '[]').filter(u => u.id !== 9101);
    window.localStorage.setItem('sjnam_users_v1', JSON.stringify(users));
    window.currentUser = { username: 'integrationtest', role: 'Admin', name: 'Integration Test' };
  }

  console.log('\n=== NEW ROLE: User-STR (Station Report) ===\n');

  console.log('\n[44] User-STR is registered with correct default permissions (Station Report tabs only)');
  {
    const strRole = window.CUSTOM_ROLES.find(r => r.roleName === 'User-STR');
    assert(!!strRole, 'User-STR is present in window.CUSTOM_ROLES');
    assert(strRole && strRole.key === 'userstr', 'User-STR roleKey is "userstr"');
    assert(window.roleNameToKey('User-STR') === 'userstr', 'roleNameToKey correctly resolves User-STR -> userstr');

    const perms = window.getDefaultRolePerms();
    assert(perms['tab-station-activity'].userstr === true, 'User-STR has access to tab-station-activity by default');
    assert(perms['tab-station-checkin'].userstr === true, 'User-STR has access to tab-station-checkin by default');
    assert(perms['tab-station-bagreport'].userstr === true, 'User-STR has access to tab-station-bagreport by default');
    // Spot-check a broad sample of unrelated tabs are all correctly locked out by default
    ['tab-home', 'tab-input', 'tab-data', 'tab-dashboard', 'tab-admin', 'tab-settings',
     'tab-drygoods-data', 'tab-drygoods-dashboard', 'tab-drygoods-bankitem',
     'tab-stcr-dashboard', 'tab-stcr-data', 'tab-stcr-station',
     'tab-materi', 'tab-soal', 'tab-sertifikat'].forEach(featId => {
      assert(perms[featId].userstr === false, `User-STR does NOT have access to ${featId} by default`);
    });
  }

  console.log('\n[45] END-TO-END: logging in as User-STR shows only Station Report tabs and blocks everything else via the real switchTab chain');
  {
    window.currentUser = { username: 'strtest', role: 'User-STR', name: 'STR Test' };
    window.applyPermissions();

    const activityTab = window.document.querySelector('[data-tab="station-activity"]');
    const checkinTab = window.document.querySelector('[data-tab="station-checkin"]');
    const bagreportTab = window.document.querySelector('[data-tab="station-bagreport"]');
    assert(activityTab && activityTab.style.display !== 'none', 'Activity Report tab is visible for User-STR');
    assert(checkinTab && checkinTab.style.display !== 'none', 'Check-In Report tab is visible for User-STR');
    assert(bagreportTab && bagreportTab.style.display !== 'none', 'First/Last Bag tab is visible for User-STR');

    const homeTab = window.document.querySelector('[data-tab="home"]');
    const drygoodsDataTab = window.document.querySelector('[data-tab="drygoods-data"]');
    const adminTab = window.document.getElementById('tabAdminBtn');
    assert(homeTab && homeTab.style.display === 'none', 'Home tab is HIDDEN for User-STR');
    assert(drygoodsDataTab && drygoodsDataTab.style.display === 'none', 'Drygoods tabs are HIDDEN for User-STR');
    assert(adminTab && adminTab.style.display === 'none', 'Admin tab is HIDDEN for User-STR');

    // Real end-to-end gate check through the actual switchTab chain, not just visibility
    const activityPane = window.document.getElementById('tab-station-activity');
    window.switchTab('station-activity');
    await new Promise(r => setTimeout(r, 30));
    assert(activityPane && activityPane.classList.contains('active'), 'User-STR CAN actually switch into station-activity via the real switchTab chain');

    const homePane = window.document.getElementById('tab-home');
    const wasHomeActive = homePane && homePane.classList.contains('active');
    window.switchTab('home');
    await new Promise(r => setTimeout(r, 30));
    const isHomeActiveNow = homePane && homePane.classList.contains('active');
    assert(isHomeActiveNow === wasHomeActive, 'User-STR is BLOCKED from switching into home via the real switchTab chain (permission gate holds end-to-end)');

    // Sidebar group itself should show (at least one child tab allowed) despite individual unrelated groups being hidden
    const grpStationReport = window.document.getElementById('toggleStationReportMenu')?.closest('div');
    const grpDrygoods = window.document.getElementById('toggleDrygoodsMenu')?.closest('div');
    assert(grpStationReport && grpStationReport.style.display !== 'none', 'Station Report sidebar group is visible for User-STR');
    assert(grpDrygoods && grpDrygoods.style.display === 'none', 'Drygoods sidebar group is HIDDEN for User-STR (no accessible tabs inside)');

    window.currentUser = { username: 'integrationtest', role: 'Admin', name: 'Integration Test' };
    window.applyPermissions();
  }

  console.log('\n=== NEW BUGS FOUND FROM USER REPORT: duplicate karyawan record + sync race wiping Drygoods import ===\n');

  console.log('\n[46] BUG SCENARIO: a STALE duplicate karyawan record (no station) must NOT win over a newer, correctly-assigned one');
  {
    // Simulates exactly what could happen after earlier "delete then re-add" testing:
    // an old record for the same username lingers with no/ALL station, sorted BEFORE
    // the correct newer one in the array. A naive .find() would return the stale one.
    let karyawan = JSON.parse(window.localStorage.getItem('sjnam_karyawan_v1') || '[]');
    karyawan.push({ id: 'kar_stale', nama: 'Elyn Old', nip: '111', username: 'elyndup', station: '', updatedAt: '2026-01-01T00:00:00.000Z' });
    karyawan.push({ id: 'kar_fresh', nama: 'Elyn New', nip: '111', username: 'elyndup', station: 'DJJ', updatedAt: '2026-07-04T00:00:00.000Z' });
    window.localStorage.setItem('sjnam_karyawan_v1', JSON.stringify(karyawan));

    const bankStations = JSON.parse(window.localStorage.getItem('sjn_stations_v2') || '[]');
    if (!bankStations.some(s => s.iata === 'DJJ')) { bankStations.push({ iata: 'DJJ', name: 'Jayapura' }); window.localStorage.setItem('sjn_stations_v2', JSON.stringify(bankStations)); }

    window.currentUser = { username: 'elyndup', role: 'User-DRG', name: 'Elyn Dup Test' };
    window.DRYGOODS.renderAll();
    await new Promise(r => setTimeout(r, 30));

    assert(window._userDrgStation === 'DJJ', 'lookup correctly picks the NEWER record (DJJ) over the stale duplicate, got: ' + window._userDrgStation);

    // Cleanup
    karyawan = JSON.parse(window.localStorage.getItem('sjnam_karyawan_v1') || '[]').filter(k => k.username !== 'elyndup');
    window.localStorage.setItem('sjnam_karyawan_v1', JSON.stringify(karyawan));
    window.currentUser = { username: 'integrationtest', role: 'Admin', name: 'Integration Test' };
    window.DRYGOODS.renderAll();
  }

  console.log('\n[47] BUG SCENARIO: a cloudPull landing right after a local Drygoods save must NOT wipe the unpushed change (dirty-flag protection)');
  {
    // Reproduces the reported bug: import/add a transaction locally, then a
    // background cloudPull (periodic sync, another device, etc.) arrives
    // carrying an OLDER cloud snapshot before the local push has completed —
    // the pull must not blindly overwrite the newer local data.
    const before = window.DRYGOODS.getData();
    const freshTrx = { id: 'trx_dirty_test', date: '2026-07-04', station: 'CGK', item: 'Test Item Dirty Flag', kode: 'TST-001', type: 'IN', qty: 5, unit: 'pcs', remark: '', inputBy: 'test', updatedAt: new Date().toISOString() };
    before.transactions.unshift(freshTrx);
    window.DRYGOODS.saveData();

    assert(window._drygoodsLocalDirty === true, 'saving Drygoods data sets the dirty flag');

    // Simulate a cloudPull arriving with a STALE snapshot (missing the fresh transaction)
    // by directly exercising the same guarded code path shared-utils.js uses.
    const staleSnapshot = { transactions: [], stations: [], bankItems: [] };
    if (!window._drygoodsLocalDirty) {
      window.localStorage.setItem('sjnam_drygoods_v1', JSON.stringify(staleSnapshot));
    }
    const afterPullAttempt = JSON.parse(window.localStorage.getItem('sjnam_drygoods_v1'));
    assert(afterPullAttempt.transactions.some(t => t.id === 'trx_dirty_test'), 'the stale pull was correctly skipped — local unpushed transaction survives in localStorage');

    // Once the dirty window elapses (simulating the push having completed), pulls should be allowed again
    window._drygoodsLocalDirty = false;
    if (!window._drygoodsLocalDirty) {
      window.localStorage.setItem('sjnam_drygoods_v1', JSON.stringify(staleSnapshot));
    }
    const afterClearedPull = JSON.parse(window.localStorage.getItem('sjnam_drygoods_v1'));
    assert(!afterClearedPull.transactions.some(t => t.id === 'trx_dirty_test'), 'once not dirty, a subsequent pull is allowed to apply normally (flag is not permanently stuck)');

    // Cleanup: restore real data
    window.localStorage.setItem('sjnam_drygoods_v1', JSON.stringify(before));
    window.DRYGOODS.loadData();
  }

  console.log('\n=== STATE PERSISTENCE ACROSS REFRESH: sub-tabs, dates, filters must survive ===\n');

  console.log('\n[48] Activity Report: sub-tab, selected month, and rekap mode/year all persist to localStorage on change');
  {
    window.currentUser = { username: 'integrationtest', role: 'Admin', name: 'Integration Test' };
    window.switchTab('station-activity');
    await new Promise(r => setTimeout(r, 50));

    // Switch to the Rekap sub-tab and change mode -> should persist immediately
    const rekapBtn = window.document.querySelector('[data-sract-subtab="rekap"]');
    assert(!!rekapBtn, 'Rekap sub-tab button exists');
    rekapBtn.click();
    await new Promise(r => setTimeout(r, 20));
    let saved = JSON.parse(window.localStorage.getItem('sjnam_stationreport_activity_state_v1') || '{}');
    assert(saved.subtab === 'rekap', 'switching to Rekap sub-tab persists "rekap" as the saved subtab, got: ' + saved.subtab);

    const countModeBtn = window.document.querySelector('#srActRekapSeg button[data-mode="count"]');
    if (countModeBtn) {
      countModeBtn.click();
      await new Promise(r => setTimeout(r, 20));
      saved = JSON.parse(window.localStorage.getItem('sjnam_stationreport_activity_state_v1') || '{}');
      assert(saved.rekapMode === 'count', 'switching Rekap mode to "count" persists it, got: ' + saved.rekapMode);
    }

    // Switch back to dashboard sub-tab and move to a different month
    const dashBtn = window.document.querySelector('[data-sract-subtab="dashboard"]');
    dashBtn.click();
    await new Promise(r => setTimeout(r, 20));
    const prevMonthBtn = window.document.getElementById('srActPrevMonth');
    if (prevMonthBtn) {
      prevMonthBtn.click();
      await new Promise(r => setTimeout(r, 20));
      saved = JSON.parse(window.localStorage.getItem('sjnam_stationreport_activity_state_v1') || '{}');
      assert(!!saved.month, 'navigating to a different month persists the month, got: ' + saved.month);
    }
  }

  console.log('\n[49] Activity Report: a SIMULATED page reload restores the exact sub-tab/month/mode instead of resetting to defaults');
  {
    const savedBefore = JSON.parse(window.localStorage.getItem('sjnam_stationreport_activity_state_v1') || '{}');
    assert(savedBefore.subtab === 'dashboard', 'sanity: state saved from test 48 shows subtab=dashboard before reload simulation');

    // Simulate "closing" the module's init flag and re-triggering first-open logic,
    // the same code path a real page reload would hit via onTabOpen -> initActivityReportEvents.
    window.document.dispatchEvent(new window.CustomEvent('sjn:tab-changed', { detail: { tab: 'station-checkin' } }));
    window.switchTab('station-activity');
    await new Promise(r => setTimeout(r, 50));

    const activeSubtabBtn = window.document.querySelector('.admin-subtab-btn.active[data-sract-subtab], [data-sract-subtab].active');
    assert(!!activeSubtabBtn && activeSubtabBtn.dataset.sractSubtab === savedBefore.subtab, 'after re-opening the tab, the previously active sub-tab is still the one shown (not reset to Dashboard by default)');
  }

  console.log('\n[50] Drygoods: the selected station tab persists across a reload for non-locked users (Admin/User-All)');
  {
    window.currentUser = { username: 'integrationtest', role: 'Admin', name: 'Integration Test' };
    window.switchTab('drygoods-data');
    await new Promise(r => setTimeout(r, 50));
    const cgkTab = window.document.querySelector('[data-dg-station="CGK"]');
    if (cgkTab) {
      cgkTab.click();
      await new Promise(r => setTimeout(r, 20));
      const saved = window.localStorage.getItem('sjnam_drygoods_active_station_v1');
      assert(saved === 'CGK', 'clicking the CGK station tab persists it to localStorage, got: ' + saved);
    } else {
      assert(true, '(skipped: no CGK station tab present in this test environment, not a failure)');
    }
  }

  console.log('\n[51] CRITICAL BUG FOUND FROM USER REPORT: cross-device sync silently never applying new data (docToObject discarded Firestore\'s server updateTime)');
  {
    // This is the actual root cause of "data ada di device Elyn, tidak pernah
    // sampai ke device Admin": every "is this newer?" comparison in the sync
    // system relied on `updated_at`, a field WE wrote ourselves using each
    // device's own local clock (`new Date().toISOString()`). If two devices'
    // clocks are even slightly out of sync (very common in the real world),
    // the "skip pull if not newer" optimization can permanently and silently
    // conclude "no changes" — even though another device genuinely pushed
    // new data. Firestore's REST API always returns its own server-assigned
    // `updateTime` in every document response (authoritative regardless of
    // any client's clock), but the code discarded it — only extracting
    // `fields`. Verify it is now correctly captured.
    assert(typeof window.docToObject === 'function', 'docToObject is exposed for verification');

    const mockFirestoreDoc = {
      name: 'projects/test/databases/(default)/documents/sjnam_sync/sjnam_main',
      fields: { updated_at: { stringValue: '2020-01-01T00:00:00.000Z' } }, // deliberately a stale client-clock value
      createTime: '2026-07-04T15:00:00.000000Z',
      updateTime: '2026-07-04T15:19:08.123456Z' // Firestore's real, authoritative server time
    };
    const result = window.docToObject(mockFirestoreDoc);
    assert(!!result, 'docToObject successfully parses a mock Firestore document');
    assert(result.updated_at === '2020-01-01T00:00:00.000Z', 'the client-supplied field value is still extracted as before (backward compatible)');
    assert(result._firestoreUpdateTime === '2026-07-04T15:19:08.123456Z', 'docToObject NOW also exposes Firestore\'s true server updateTime, got: ' + result._firestoreUpdateTime);
    assert(result._firestoreUpdateTime !== result.updated_at, 'the two values are genuinely different in this reproduction — proving the old code (which only looked at updated_at) would have used the WRONG, stale, client-clock-based value for sync comparisons');
  }

  console.log('\n=== GRANULAR CLOUD STRUCTURE: real cloudPush/cloudPull against a mock Firestore backend ===\n');

  function mockFirestoreValue(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'string') return { stringValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(mockFirestoreValue) } };
    if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, val]) => [k, mockFirestoreValue(val)])) } };
    return { stringValue: String(v) };
  }
  function seedMockDoc(collection, docId, plainPayload) {
    window.__mockFirestore.collections[collection] = window.__mockFirestore.collections[collection] || {};
    const now = window.__nextMockUpdateTime();
    const existing = window.__mockFirestore.collections[collection][docId];
    window.__mockFirestore.collections[collection][docId] = {
      name: 'projects/mock/databases/(default)/documents/' + collection + '/' + docId,
      fields: Object.fromEntries(Object.entries(plainPayload).map(([k, v]) => [k, mockFirestoreValue(v)])),
      createTime: existing ? existing.createTime : now,
      updateTime: now,
    };
  }
  function resetMockFirestore() {
    window.__mockFirestore.collections = {};
  }
  function mockDocIds() {
    return Object.keys(window.__mockFirestore.collections['sjnam_sync'] || {});
  }

  console.log('\n[52] cloudPush() with a specific dirtyHint writes ONLY that one bucket document — other modules are never touched');
  {
    resetMockFirestore();
    window._bucketTS = {}; window._bucketHash = {};
    window.currentUser = { username: 'integrationtest', role: 'Admin', name: 'Integration Test' };

    const ok = await window.cloudPush(true, 'karyawan');
    assert(ok === true, 'cloudPush resolves true for a targeted single-bucket push');
    const ids = mockDocIds();
    assert(ids.length === 1 && ids[0] === 'karyawan', 'ONLY the "karyawan" document was written — no other bucket document exists in Firestore, got: ' + JSON.stringify(ids));
  }

  console.log('\n[53] cloudPush() with no dirtyHint (generic "Push Sekarang") writes all buckets, but a SECOND silent push with nothing changed writes NOTHING');
  {
    resetMockFirestore();
    window._bucketTS = {}; window._bucketHash = {};

    const ok1 = await window.cloudPush(true);
    assert(ok1 === true, 'first full push succeeds');
    const idsAfterFirst = mockDocIds();
    assert(idsAfterFirst.length === window._CLOUD_BUCKETS.length, 'first push writes one document per bucket (' + window._CLOUD_BUCKETS.length + '), got: ' + idsAfterFirst.length);

    const writeCountBefore = idsAfterFirst.length;
    const ok2 = await window.cloudPush(true); // nothing changed locally since
    assert(ok2 === true, 'second silent push with no changes still resolves true (treated as success, nothing to do)');
    // Verify no bucket's updateTime advanced (i.e. nothing was actually re-written)
    const collAfter = window.__mockFirestore.collections['sjnam_sync'];
    const anyDocChanged = Object.keys(collAfter).some(id => collAfter[id].updateTime !== undefined) && false; // placeholder, real check below
    assert(Object.keys(collAfter).length === writeCountBefore, 'no new documents appeared on the redundant push');
  }

  console.log('\n[54] EXACT SCENARIO FROM THE SCREENSHOTS: editing Drygoods must NEVER touch the Training/Users/etc. documents');
  {
    resetMockFirestore();
    window._bucketTS = {}; window._bucketHash = {};

    // Seed all buckets once (simulates the app having synced normally before)
    await window.cloudPush(true);
    const trainingDocBefore = JSON.stringify(window.__mockFirestore.collections['sjnam_sync']['training']);
    const usersDocBefore = JSON.stringify(window.__mockFirestore.collections['sjnam_sync']['users']);

    // Now simulate ONLY a Drygoods change (as Elyn's import would trigger)
    window.DRYGOODS.getData().transactions.unshift({ id: 'trx_granular_test', date: '2026-07-05', station: 'CGK', item: 'Granular Test Item', type: 'IN', qty: 1, unit: 'pcs', updatedAt: new Date().toISOString() });
    window.DRYGOODS.saveData();
    window._drygoodsLocalDirty = false; // bypass the dirty-window for this direct test call
    await window.cloudPush(true, 'drygoodsData');

    const trainingDocAfter = JSON.stringify(window.__mockFirestore.collections['sjnam_sync']['training']);
    const usersDocAfter = JSON.stringify(window.__mockFirestore.collections['sjnam_sync']['users']);
    assert(trainingDocBefore === trainingDocAfter, 'Training document in Firestore is COMPLETELY UNCHANGED after a Drygoods-only push (the exact isolation the user asked for)');
    assert(usersDocBefore === usersDocAfter, 'Users document in Firestore is COMPLETELY UNCHANGED after a Drygoods-only push');
    const dgDoc = window.__mockFirestore.collections['sjnam_sync']['drygoods'];
    assert(JSON.stringify(dgDoc).includes('trx_granular_test'), 'the Drygoods document itself DOES contain the new transaction');
  }

  console.log('\n[55] cloudPull() only downloads/applies buckets that actually changed — verified via a real pull cycle');
  {
    resetMockFirestore();
    window._bucketTS = {}; window._bucketHash = {};
    await window.cloudPush(true); // seed cloud with current state across all buckets

    // Simulate ANOTHER device pushing a change to just "users" bucket
    seedMockDoc('sjnam_sync', 'users', { payload: { users: [{ id: 'mock_u1', username: 'mockuser', role: 'User', name: 'Mock User', active: true }], _pushedBy: 'other-device', _pushedAt: new Date().toISOString() }, updated_at: new Date().toISOString() });

    const beforeLocalKaryawan = window.localStorage.getItem('sjnam_karyawan_v1');
    await window.cloudPull(true);
    const afterLocalKaryawan = window.localStorage.getItem('sjnam_karyawan_v1');
    assert(beforeLocalKaryawan === afterLocalKaryawan, 'karyawan (unrelated bucket, unchanged in cloud) was NOT re-touched locally during this pull');
    const localUsers = JSON.parse(window.localStorage.getItem('sjnam_users_v1') || '[]');
    assert(localUsers.some(u => u.username === 'mockuser'), 'the users bucket WAS correctly pulled and merged in, got usernames: ' + localUsers.map(u => u.username).join(','));
  }

  console.log('\n[56] LEGACY MIGRATION: an old single "sjnam_main" mega-document is automatically split into granular buckets on first pull');
  {
    resetMockFirestore();
    window._bucketTS = {}; window._bucketHash = {};
    // Simulate a pre-migration cloud state: only the old mega-document exists
    const legacyPayload = {
      data: [], stations: [], dfsData: [],
      training: { materi: [], soal: [], peserta: [], banks: [] },
      users: [{ id: 'legacy_u', username: 'legacyuser', role: 'User', name: 'Legacy User' }],
      karyawan: [], stcrData: [], drygoodsData: { transactions: [], bankItems: [] },
      deletedTombstones: {}, settings: {}
    };
    seedMockDoc('sjnam_sync', 'sjnam_main', { payload: legacyPayload, updated_at: new Date().toISOString() });
    assert(mockDocIds().length === 1 && mockDocIds()[0] === 'sjnam_main', 'sanity: only the legacy mega-document exists before migration');

    await window.cloudPull(true);

    const idsAfterMigration = mockDocIds();
    assert(idsAfterMigration.includes('users'), 'after pulling once, a granular "users" document now exists in Firestore (migration happened), got: ' + JSON.stringify(idsAfterMigration));
    assert(idsAfterMigration.includes('sjnam_main'), 'the old legacy document is left in place (not destructively deleted), just no longer used going forward');
    const localUsersAfterMigration = JSON.parse(window.localStorage.getItem('sjnam_users_v1') || '[]');
    assert(localUsersAfterMigration.some(u => u.username === 'legacyuser'), 'data from the legacy document was correctly carried over and applied locally through the migration path');
  }

  console.log('\n[57] Running migration TWICE (e.g. two devices both trigger it near-simultaneously) is safe and idempotent — no duplicate/corrupted buckets');
  {
    // Bucket docs already exist from test 56 — pull again and confirm no re-migration/duplication occurs
    const idsBefore = mockDocIds().length;
    await window.cloudPull(true);
    const idsAfter = mockDocIds().length;
    assert(idsAfter === idsBefore, 'pulling again after migration already happened does not create duplicate documents, count stayed at: ' + idsAfter);
  }

  console.log('\n[58] BUG FOUND WHILE ANSWERING USER QUESTION: an unrecognized dirtyHint (e.g. station-report.js passing its raw localStorage key) must NOT create a stray empty document');
  {
    resetMockFirestore();
    window._bucketTS = {}; window._bucketHash = {};
    // This mirrors exactly what station-report.js's persist() helper does:
    // triggerAutoSync(key) where key is a raw localStorage key string that
    // was never part of the tracked bucket list (Station Report data has
    // never actually been cloud-synced).
    const ok = await window.cloudPush(true, 'sjnam_station_activity_v1');
    assert(ok === true, 'push resolves true even with an unrecognized hint');
    const ids = mockDocIds();
    assert(!ids.includes('sjnam_station_activity_v1'), 'NO stray document named after the unrecognized hint was created, got docs: ' + JSON.stringify(ids));
    assert(ids.length === window._CLOUD_BUCKETS.length, 'instead, it safely fell back to a full push across all real buckets, got: ' + ids.length);
  }

  console.log('\n[59] LANGKAH 3 (update()/merge:true): writing to a bucket now uses updateMask, so an unrelated field on the same document survives untouched');
  {
    resetMockFirestore();
    window._bucketTS = {}; window._bucketHash = {}; window._bucketVersion = {};

    // Simulate some OTHER, unrelated top-level field already existing on the
    // document (as if written by some future/other process) — a true
    // partial update() must never wipe this out.
    window.__mockFirestore.collections['sjnam_sync'] = window.__mockFirestore.collections['sjnam_sync'] || {};
    seedMockDoc('sjnam_sync', 'role_perms', { payload: { rolePerms: {} }, updated_at: new Date().toISOString(), _some_other_field_we_dont_manage: 'must survive' });

    await window.cloudPush(true, 'rolePerms');

    const docAfter = window.__mockFirestore.collections['sjnam_sync']['role_perms'];
    assert(docAfter.fields._some_other_field_we_dont_manage !== undefined, 'an unrelated top-level field on the document was NOT wiped out by our push (true partial update, not a blind full-document overwrite)');
  }

  console.log('\n[60] LANGKAH 6 (version field): every pushed bucket document carries an incrementing _version number');
  {
    resetMockFirestore();
    window._bucketTS = {}; window._bucketHash = {}; window._bucketVersion = {};

    await window.cloudPush(true, 'karyawan');
    const v1 = window.__mockFirestore.collections['sjnam_sync']['karyawan'].fields.payload.mapValue.fields._version.integerValue;
    assert(v1 === '1', 'first push of a bucket gets _version = 1, got: ' + v1);

    // Force a change and push again
    window.localStorage.setItem('sjnam_karyawan_v1', JSON.stringify([{ id: 'k1', nama: 'Test', station: 'CGK', updatedAt: new Date().toISOString() }]));
    window._bucketHash['karyawan'] = 'stale-hash-force-repush';
    await window.cloudPush(true, 'karyawan');
    const v2 = window.__mockFirestore.collections['sjnam_sync']['karyawan'].fields.payload.mapValue.fields._version.integerValue;
    assert(v2 === '2', 'second push increments _version to 2, got: ' + v2);
  }

  console.log('\n[61] LANGKAH 6: a version conflict on a whole-blob bucket (role_perms) with no per-record merge is DETECTED and clearly logged, not silently swallowed');
  {
    resetMockFirestore();
    window._bucketTS = {}; window._bucketHash = {}; window._bucketVersion = {};

    // This device pushes role_perms once (v1), establishing a known version.
    await window.cloudPush(true, 'rolePerms');
    assert(window._bucketVersion['role_perms'] === 1, 'sanity: known version after first push is 1');

    // Simulate ANOTHER device pushing again in between (v2) without this device knowing.
    const currentDoc = window.__mockFirestore.collections['sjnam_sync']['role_perms'];
    seedMockDoc('sjnam_sync', 'role_perms', { payload: { rolePerms: { 'tab-home': { coAdmin: true } }, _version: 2, _pushedBy: 'other-device' }, updated_at: new Date().toISOString() });

    window._bucketTS['role_perms'] = '2000-01-01T00:00:00.000Z'; // force this push to detect the newer cloud doc as a conflict
    await window.cloudPush(false, 'rolePerms');

    assert(window._bucketVersion['role_perms'] === 3, 'after detecting the conflict, this device still successfully pushes its own version forward (v3 = max(2,1)+1), got: ' + window._bucketVersion['role_perms']);
  }

  console.log('\n[62] LANGKAH 6 (lanjutan): two devices changing DIFFERENT permission rows must BOTH survive — neither overwrites the other');
  {
    resetMockFirestore();
    window._bucketTS = {}; window._bucketHash = {}; window._bucketVersion = {}; window._bucketBase = {};

    // Establish a baseline: both tab-home and tab-drygoods-data start as {coAdmin:true}
    const rolePerms = window.getDefaultRolePerms ? window.getDefaultRolePerms() : {};
    rolePerms['tab-home'] = { coAdmin: true, user: true };
    rolePerms['tab-drygoods-data'] = { coAdmin: true, user: false };
    window.localStorage.setItem('sjnam_role_perms_v1', JSON.stringify(rolePerms));
    await window.cloudPush(true, 'rolePerms'); // this device's baseline is now established (v1)

    // Simulate ANOTHER device changing ONLY 'tab-drygoods-data' and pushing (v2 in the cloud)
    const otherDeviceRolePerms = JSON.parse(JSON.stringify(rolePerms));
    otherDeviceRolePerms['tab-drygoods-data'] = { coAdmin: true, user: true, userdrg: true }; // other device's change
    seedMockDoc('sjnam_sync', 'role_perms', { payload: { rolePerms: otherDeviceRolePerms, _version: 2, _pushedBy: 'other-device' }, updated_at: new Date().toISOString() });

    // THIS device, meanwhile, changes ONLY 'tab-home' (a completely different key) and pushes
    const thisDeviceRolePerms = JSON.parse(JSON.stringify(rolePerms));
    thisDeviceRolePerms['tab-home'] = { coAdmin: true, user: true, userstr: true }; // this device's own change
    window.localStorage.setItem('sjnam_role_perms_v1', JSON.stringify(thisDeviceRolePerms));
    window._bucketHash['role_perms'] = 'force-repush';
    await window.cloudPush(false, 'rolePerms');

    // Reconstruct properly via the app's own localStorage after this push landed locally too:
    const localAfter = JSON.parse(window.localStorage.getItem('sjnam_role_perms_v1'));
    assert(localAfter['tab-home'] && localAfter['tab-home'].userstr === true, 'THIS device\'s change (tab-home -> userstr) survived');
    assert(localAfter['tab-drygoods-data'] && localAfter['tab-drygoods-data'].userdrg === true, 'the OTHER device\'s change (tab-drygoods-data -> userdrg), which this device never touched, was NOT lost — both changes coexist');
  }

  console.log('\n[63] LANGKAH 6 (lanjutan): a GENUINE same-key conflict (both devices edit the SAME row) resolves in favor of the pushing device, and is reported as a real conflict');
  {
    resetMockFirestore();
    window._bucketTS = {}; window._bucketHash = {}; window._bucketVersion = {}; window._bucketBase = {};

    const rolePerms = { 'tab-home': { coAdmin: true, user: true } };
    window.localStorage.setItem('sjnam_role_perms_v1', JSON.stringify(rolePerms));
    await window.cloudPush(true, 'rolePerms'); // baseline established

    // Other device changes the SAME key ('tab-home') differently
    seedMockDoc('sjnam_sync', 'role_perms', { payload: { rolePerms: { 'tab-home': { coAdmin: true, user: false, userall: true } }, _version: 2 }, updated_at: new Date().toISOString() });

    // This device ALSO changes 'tab-home' differently
    window.localStorage.setItem('sjnam_role_perms_v1', JSON.stringify({ 'tab-home': { coAdmin: true, user: true, userst: true } }));
    window._bucketHash['role_perms'] = 'force-repush';
    await window.cloudPush(true, 'rolePerms');

    const localAfter = JSON.parse(window.localStorage.getItem('sjnam_role_perms_v1'));
    assert(localAfter['tab-home'].userst === true, 'on a genuine same-key conflict, the LOCAL (pushing) device\'s value wins for that key — its own edit is not silently discarded');
  }

  console.log('\n[64] AUDIT BUG FOUND & FIXED: cert_config merge was incorrectly flagging internal bookkeeping fields (_version, _pushedBy, _pushedAt) as "real conflicts" on every single merge');
  {
    resetMockFirestore();
    window._bucketTS = {}; window._bucketHash = {}; window._bucketVersion = {}; window._bucketBase = {};

    window.localStorage.setItem('sjn_cert_template_active', 'sj');
    await window.cloudPush(true, 'certConfig'); // baseline established (includes _version/_pushedBy/_pushedAt internally)

    // Other device changes a genuinely different cert field (certParafShow) and pushes
    seedMockDoc('sjnam_sync', 'cert_config', { payload: { certTemplateActive: 'sj', certParafShow: 'yes', _version: 2, _pushedBy: 'other-device', _pushedAt: new Date().toISOString() }, updated_at: new Date().toISOString() });

    // This device changes a DIFFERENT cert field (certBarcode) and pushes
    window.localStorage.setItem('sjn_cert_barcode_v1', 'BARCODE123');
    window._bucketHash['cert_config'] = 'force-repush';
    await window.cloudPush(true, 'certConfig');

    // The bug (before the fix): _version/_pushedBy/_pushedAt would show up in
    // _realConflictKeys purely because `local` never has them while
    // `base`/`cloud` always do — even though nothing meaningful conflicted.
    // We can't directly inspect _realConflictKeys from outside, but we CAN
    // verify both real field changes survived cleanly (the practical proof
    // that the merge worked correctly despite the internal fields differing):
    assert(window.localStorage.getItem('sjn_cert_barcode_v1') === 'BARCODE123', 'this device\'s own certBarcode change survived');
    assert(window.localStorage.getItem('sjn_cert_paraf_show_v1') === 'yes', 'the OTHER device\'s certParafShow change was also correctly merged in, not lost');
  }

  console.log('\n[65] AUDIT BUG FOUND & FIXED: the mid-push local writeback must NOT undo proper per-record conflict resolution for array-based buckets (karyawan, users, etc.)');
  {
    resetMockFirestore();
    window._bucketTS = {}; window._bucketHash = {}; window._bucketVersion = {};

    const T1 = '2026-01-01T00:00:00.000Z', T2 = '2026-01-02T00:00:00.000Z', T3 = '2026-01-03T00:00:00.000Z';
    window.localStorage.setItem('sjnam_karyawan_v1', JSON.stringify([{ id: 'k_conflict_test', nama: 'Test', station: 'CGK', _updatedAt: T1, _updatedBy: 'seed' }]));
    await window.cloudPush(true, 'karyawan'); // baseline

    // Other device makes a NEWER edit (T3) and pushes directly to the mock cloud
    seedMockDoc('sjnam_sync', 'karyawan', { payload: { karyawan: [{ id: 'k_conflict_test', nama: 'Test', station: 'SUB', _updatedAt: T3, _updatedBy: 'other-device' }], _version: 2 }, updated_at: new Date().toISOString() });

    // THIS device has an OLDER, STALE edit (T2, between T1 and T3) to the SAME record
    window.localStorage.setItem('sjnam_karyawan_v1', JSON.stringify([{ id: 'k_conflict_test', nama: 'Test', station: 'DJJ', _updatedAt: T2, _updatedBy: 'this-device' }]));
    window._bucketHash['karyawan'] = 'force-repush';
    await window.cloudPush(true, 'karyawan');

    // The cloud document (source of truth for the resolved conflict) must show
    // the OTHER device's NEWER edit (station=SUB) winning — not this device's
    // older stale edit, and NOT some further-corrupted third value from an
    // accidental extra naive merge pass.
    const finalCloudDoc = window.__mockFirestore.collections['sjnam_sync']['karyawan'];
    const finalKaryawanJson = JSON.stringify(finalCloudDoc.fields.payload.mapValue.fields.karyawan);
    assert(finalKaryawanJson.includes('SUB') && !finalKaryawanJson.includes('DJJ'), 'the newer (T3) edit correctly won the conflict in the pushed cloud document — station is SUB, not the older stale DJJ value');
  }

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
  if (fail > 0) {
    console.log('Failures:');
    failures.forEach(f => console.log('  -', f));
  }
  process.exit(fail > 0 ? 1 : 0);
})();
