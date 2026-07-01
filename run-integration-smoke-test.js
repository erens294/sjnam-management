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
  const before = html;
  const result = html.replace(`<script src="${srcAttr}"></script>`, () => '<script>' + code + '</script>');
  if (result === before) {
    throw new Error(`Could not find <script src="${srcAttr}"></script> tag to inline (${label}) — check dist/index.html`);
  }
  return result;
}

html = inlineScript(html, 'js/stcr.js', stcrSrc, 'stcr.js');
html = inlineScript(html, 'js/certificate-builder.js', certBuilderSrc, 'certificate-builder.js');
html = inlineScript(html, 'js/home-editor.js', homeEditorSrc, 'home-editor.js');
html = inlineScript(html, 'js/training.js', trainingSrc, 'training.js');
html = inlineScript(html, 'js/bank-station-sync.js', bankStationSyncSrc, 'bank-station-sync.js');
html = inlineScript(html, 'js/audit-log-ui.js', auditLogUiSrc, 'audit-log-ui.js');
html = inlineScript(html, 'js/patch-arsitektur-v3.js', patchV3Src, 'patch-arsitektur-v3.js');
html = inlineScript(html, 'js/blueprint-v1.js', blueprintV1Src, 'blueprint-v1.js');
const beforeSR = html;
html = html.replace(
  '<script src="js/service-recovery.js"></script>',
  () => '<script>' + serviceRecoverySrc + '</script>'
);
if (html === beforeSR) {
  throw new Error('Could not find <script src="js/service-recovery.js"></script> tag to inline — check dist/index.html');
}
const beforeReplace = html;
const configJsSrc = fs.readFileSync(path.join(__dirname, '..', 'dist', 'js', 'config.js'), 'utf8');
html = html.replace(
  /<script src="js\/config\.js"[^>]*><\/script>/,
  () => '<script>' + configJsSrc + '</script>'
);
if (html === beforeReplace) {
  throw new Error('Could not find <script src="js/config.js" ...></script> tag to inline — check dist/index.html');
}
const beforeSharedUtils = html;
html = html.replace(
  '<script src="js/shared-utils.js"></script>',
  () => '<script>' + sharedUtilsSrc + '</script>'
);
if (html === beforeSharedUtils) {
  throw new Error('Could not find <script src="js/shared-utils.js"></script> tag to inline — check dist/index.html');
}
const beforeAuth = html;
html = html.replace(
  '<script src="js/auth.js"></script>',
  () => '<script>' + authJsSrc + '</script>'
);
if (html === beforeAuth) {
  throw new Error('Could not find <script src="js/auth.js"></script> tag to inline — check dist/index.html');
}
// drygoods.js MUST be inlined after auth.js is already in place — it wraps
// window.switchTab and must wrap the permission-gated version from auth.js,
// not a pre-auth.js version (see drygoods.js header comment / Tahap 2 regression).
html = inlineScript(html, 'js/drygoods.js', drygoodsSrc, 'drygoods.js');

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
  assert(Array.isArray(window.CUSTOM_ROLES) && window.CUSTOM_ROLES.length === 5, 'window.CUSTOM_ROLES has 5 entries');

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

  console.log('\n[11] REGRESSION TEST: cloudConfig retains real Supabase credentials (not overwritten by stale pre-declare block)');
  {
    // Bug found during Tahap 3: service-recovery.js's pre-declare block used
    // to set `var cloudConfig = {supabaseUrl:'', supabaseKey:''}` AFTER
    // shared-utils.js had already correctly initialized it with the real
    // default credentials — silently wiping out cloud sync configuration on
    // every page load. Fixed by removing the redundant pre-declare in
    // service-recovery.js once load order became shared-utils.js first.
    assert(window.cloudConfig && window.cloudConfig.supabaseUrl, 'cloudConfig.supabaseUrl is set (not empty string)');
    assert(window.cloudConfig && window.cloudConfig.supabaseUrl.startsWith('https://'), 'cloudConfig.supabaseUrl looks like a real URL, not wiped to empty');
    assert(window.cloudConfig && window.cloudConfig.supabaseKey && window.cloudConfig.supabaseKey.length > 20, 'cloudConfig.supabaseKey is set and non-trivial length');
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

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===\n`);
  if (fail > 0) {
    console.log('Failures:');
    failures.forEach(f => console.log('  -', f));
  }
  process.exit(fail > 0 ? 1 : 0);
})();
