/* ================================================================
   SJNAM — MODUL SERVICE RECOVERY
   ================================================================
   Business logic inti Service Recovery (compensation/delay tracking):
   form wizard input, render tabel/dashboard, DFS Bank, stations,
   request/approval. Diekstrak dari index.html (sebelumnya tercampur
   dengan utilitas lintas-modul & cloud-sync dalam satu blok <script>
   sepanjang ~3.600 baris). Lihat REFACTOR_NOTES.md bagian "Tahap 3".

   PENTING — URUTAN LOAD: file ini WAJIB dimuat SEBELUM shared-utils.js
   dan auth.js. Alasan:
   - shared-utils.js (cloud-sync) membaca STORAGE_KEY/STATIONS_KEY/
     DFS_KEY/SETTINGS_KEY dan window.data/window.stations/dst yang
     didefinisikan di sini.
   - auth.js membungkus (wrap) window.switchTab yang basis definisinya
     ada di sini — harus sudah ada saat auth.js dimuat.
   - File ini SENDIRI berisi pre-declare blok cloud-sync (var cloudConfig
     dkk) dan saveData/saveStations/saveDfsData, karena DEFAULT STATIONS
     init di bawah memanggil saveStations() secara sinkron pada load
     pertama — keduanya harus ada di urutan yang sama seperti semula.

   DUPLIKAT YANG DIHAPUS (sekarang tinggal satu definisi resmi):
   - esc, formatHM, formatNumber, formatRupiah, formatDateDMY, MONTHS,
     todayLocalStr, showToast, showConfirm, applyDarkMode, Error Log
     Modal IIFE → semua dipindahkan ke shared-utils.js.
   - BUG DITEMUKAN saat audit: implementasi showToast/showConfirm/
     updateClock/Error-Log-Modal yang SAYA tulis ulang di shared-utils.js
     Tahap 3 (Part 1) ternyata SALAH — menggunakan ID elemen HTML yang
     tidak pernah ada (#confirmOverlay, #clockUTC, dll, padahal yang asli
     #confirmModal, #clockWib/#clockUtc). Sudah diperbaiki memakai
     implementasi asli yang diverifikasi byte-per-byte terhadap source.
   ================================================================ */

// =================================================================
// KONSTANTA & STATE
// =================================================================
const STORAGE_KEY = 'sjn_delay_pro_v4';
const SETTINGS_KEY = 'sjn_settings_v4';
const STATIONS_KEY = 'sjn_stations_v2';

// PERSIAPAN PEMISAHAN MODUL: data/stations/settings sebelumnya `let` (scoped
// hanya ke blok <script> ini). Diubah ke `var` (otomatis jadi window.data dkk)
// agar tetap bisa diakses dari shared-utils.js (cloud-sync) dan modul lain
// setelah dipisah jadi file terpisah — lihat REFACTOR_NOTES.md bagian "Tahap 3".
var data = [];
var stations = [];
var settings = { darkMode: false, costPerPax: 300000 };
let editingId = null;
let currentPage = 1;
const pageSize = 20;
let sortOrder = 'asc'; // 'asc' = Terlama (Jan-Dec), 'desc' = Terbaru
let barChart, lineChart, pieChart, statusChart;
let currentWizardStep = 1;

// Load data
try { data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch(e){ data=[]; }
// Sanitasi data: pastikan field kritis tidak null/undefined (mencegah TypeError localeCompare)
data = data.map(d => ({
  ...d,
  tanggal:       d.tanggal      || '',
  flightNumber:  d.flightNumber || '',
  route:         d.route        || '',
  stdUtc:        d.stdUtc       || '',
  etdUtc:        d.etdUtc       || '',
  kategori:      d.kategori     || '',
  flightStatus:  d.flightStatus || 'Delay Flight',
  approval:      d.approval     || 'Not-Approved',
  verifikasi:    d.verifikasi   || 'No',
}));
try { stations = JSON.parse(localStorage.getItem(STATIONS_KEY) || '[]'); } catch(e){ stations=[]; }
try { const s = JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'); settings={...settings,...s}; } catch(e){}

// =================================================================
// HELPERS
// =================================================================
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// esc() dipindahkan ke shared-utils.js (lihat REFACTOR_NOTES.md Tahap 3)


// saveData original removed - patched version below
function saveSettings(){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); if(typeof triggerAutoSync==='function') triggerAutoSync(); }
// saveStations original removed - patched version below

// function parseUTC removed to avoid duplicate declaration

// formatHM() dipindahkan ke shared-utils.js

// formatNumber()/formatRupiah() dipindahkan ke shared-utils.js

function getStationTz(iata){
  const s=stations.find(x=>x.iata===(iata||'').toUpperCase());
  return s?s.tz:7;
}
// Route parsing helpers (route stored as 6-char "UPGCGK" or with dash "UPG-CGK")
function getRouteOrigin(route){ if(!route) return ''; route=route.replace('-',''); return route.slice(0,3).toUpperCase(); }
function getRouteDest(route){ if(!route) return ''; route=route.replace('-',''); return route.slice(3,6).toUpperCase(); }


function stationExists(iata){
  return stations.some(x=>x.iata===(iata||'').toUpperCase());
}

// MONTHS const + formatDateDMY() dipindahkan ke shared-utils.js

// todayLocalStr() dipindahkan ke shared-utils.js

// Helper parse UTC
const parseUTC = s => s ? new Date(s+'Z') : null;

// Format UTC time + local conversion using station TZ
function formatTimeLocal(utcStr, stationIata){
  if(!utcStr) return {utc:'-',local:'-',tz:7};
  const d=parseUTC(utcStr);
  if(!d) return {utc:'-',local:'-',tz:7};
  const tz=getStationTz(stationIata);
  const local=new Date(d.getTime()+tz*3600000);
  const utcTime=d.toISOString().slice(11,16);
  const localH=String(local.getUTCHours()).padStart(2,'0');
  const localM=String(local.getUTCMinutes()).padStart(2,'0');
  return {utc:utcTime, local:`${localH}:${localM}`, tz};
}

// =================================================================
// TOAST & CONFIRM
// =================================================================
// showToast() dipindahkan ke shared-utils.js

// showConfirm() dipindahkan ke shared-utils.js

// Error Log Modal IIFE dipindahkan ke shared-utils.js

// =================================================================
// TABS
// =================================================================
function switchTab(name){
  $$('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
  $$('.tab-pane').forEach(p=>p.classList.toggle('active',p.id===`tab-${name}`));
  if(name==='dashboard') renderDashboard();
  if(name==='data') renderTable();
  if(name==='stations') renderStations();
  if(name==='admin'){
    // Sub-tab default Tab Admin adalah Data Karyawan — pastikan tabelnya (dan
    // dropdown User-nya) sudah terisi data terbaru tiap kali tab ini dibuka.
    // renderKaryawanTable di-expose ke window karena fungsi aslinya berada di
    // dalam IIFE modul Data Karyawan (lihat NOTE Drygoods di bawah untuk alasan
    // yang sama: tidak boleh panggil fungsi ber-scope tertutup langsung dari sini).
    if(typeof window.renderKaryawanTable === 'function') window.renderKaryawanTable();
    if(typeof window.renderKaryawanUserOptions === 'function') window.renderKaryawanUserOptions();
    // [BUGFIX] Restore sub-tab Admin yang terakhir aktif — dipanggil di sini
    // (bukan di restoreSession dengan delay) supaya berjalan SINKRON bersamaan
    // dengan switchTab, bukan bergantung pada timing requestAnimationFrame yang
    // bisa kalah dengan operasi async lain (cloudPull, applyPermissions, dll).
    const _savedAdminSubtab = (function(){ try{ return localStorage.getItem('sjnam_current_admin_subtab'); }catch(e){ return null; } })();
    if(_savedAdminSubtab && typeof window.switchAdminSubtab === 'function'){
      window.switchAdminSubtab(_savedAdminSubtab);
    }
  }
  if(name==='request'){refreshRequestSelect();$('#requestPreview').textContent='Pilih data terlebih dahulu...';}
  if(name==='settings'){$('#settingsTotalData').textContent=data.length+' record';}
  if(name==='stcr-dashboard' && window.STCR) window.STCR.onShowDashboard();
  if(name==='stcr-data' && window.STCR) window.STCR.onShowData();
  if(name==='stcr-station' && window.STCR) window.STCR.onShowStation();
  // NOTE: Drygoods sub-tab rendering ditangani oleh patch window.switchTab
  // di dalam Drygoods IIFE (lihat bagian "DRYGOODS MODULE") — JANGAN panggil
  // renderDg* di sini karena fungsi tsb hanya ada di dalam scope IIFE (akan ReferenceError)
  if(name==='sertifikat'){
    setTimeout(()=>{ if(typeof window.ctbRenderAll==='function') window.ctbRenderAll(); }, 120);
  }
  if(name==='soal'){
    // Render konten sub-tab yang aktif saat tab soal dibuka
    const activePeserta = document.getElementById('soalSubPeserta');
    const activeStation = document.getElementById('soalSubStation');
    if(activePeserta && !activePeserta.classList.contains('hidden') && typeof window.renderPeserta === 'function') window.renderPeserta();
    if(activeStation && !activeStation.classList.contains('hidden') && typeof window.renderBankStations === 'function') window.renderBankStations();
  }
  window.scrollTo({top:0,behavior:'smooth'});
}
// NOTE: Menggunakan window.switchTab agar permission check (role-based) ikut berlaku.
$$('[data-tab]').forEach(b=>b.addEventListener('click',()=>{
  if(window.switchTab && window.switchTab !== switchTab) window.switchTab(b.dataset.tab);
  else switchTab(b.dataset.tab);
}));

// ================================================================
// SWITCH ADMIN SUB-TAB
// Didefinisikan di sini (bukan di FEATURE 1 inline script) supaya
// SELALU tersedia sejak dini — sebelum auth.js bisa memanggil
// checkAuth()/restoreSession() terlepas dari timing document.readyState.
// Jika didefinisikan di inline script setelah auth.js, ada kondisi
// (readyState !== 'loading' saat auth.js diparse) di mana initAuthModule()
// dipanggil langsung sinkron sebelum script yang lebih belakang diparse.
// ================================================================
window.switchAdminSubtab = function(target){
  if(!target) return;
  document.querySelectorAll('.admin-subtab-btn').forEach(function(b){
    b.classList.remove('active','border-blue-600','text-blue-600');
    b.classList.add('border-transparent','text-slate-500');
  });
  var btn = document.querySelector('[data-admin-subtab="'+target+'"]');
  if(btn){
    btn.classList.add('active','border-blue-600','text-blue-600');
    btn.classList.remove('border-transparent','text-slate-500');
  }
  document.querySelectorAll('.admin-subtab-pane').forEach(function(p){ p.classList.add('hidden'); });
  var paneId = target==='karyawan' ? 'adminSubKaryawan' : target==='users' ? 'adminSubUsers' : 'adminSubPerms';
  var pane = document.getElementById(paneId);
  if(pane){
    pane.classList.remove('hidden');
    if(target==='perms' && typeof renderPermTable==='function') renderPermTable();
    if(target==='karyawan' && typeof window.renderKaryawanTable==='function') window.renderKaryawanTable();
    if(target==='users' && typeof renderUserTable==='function'){
      window._userSelectedIds = window._userSelectedIds || new Set();
      var rfSel = document.getElementById('userFilterRole');
      if(rfSel && window.ALL_ROLES){
        rfSel.innerHTML = '<option value="">Semua Role</option>'+(window.ALL_ROLES||[]).map(function(r){ return '<option value="'+r+'">'+r+'</option>'; }).join('');
      }
      renderUserTable();
    }
  }
  try{ localStorage.setItem('sjnam_current_admin_subtab', target); }catch(e){}
};

// =================================================================
// CLOCK
// =================================================================
function updateClock(){
  const now=new Date();
  // Ambil waktu UTC murni menggunakan getter UTC (tidak bergantung pada timezone browser)
  const utcH=now.getUTCHours(), utcM=now.getUTCMinutes(), utcS=now.getUTCSeconds();
  const wibH=(utcH+7)%24;
  const fmt=(h,m,s)=>String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  $('#clockWib').textContent='WIB '+fmt(wibH,utcM,utcS);
  $('#clockUtc').textContent='UTC '+fmt(utcH,utcM,utcS);
}
setInterval(updateClock,1000); updateClock();

// iPhone Safari: setInterval dibekukan saat layar kunci/pindah app.
// Resync langsung saat halaman kembali aktif (visibilitychange + pageshow).
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState==='visible'){
    updateClock(); updateStationClocks();
    if(window.currentUser){
      var _cs=null;try{_cs=JSON.parse(localStorage.getItem('sjnam_session_v1')||'null');}catch(ex){}
      if(!_cs){window.currentUser=null;var _ov2=document.getElementById('loginOverlay');if(_ov2)_ov2.style.display='';document.getElementById('userPanel')?.classList.add('hidden');document.getElementById('sidebar')?.classList.remove('perm-ready');document.getElementById('mainContent')?.classList.remove('perm-ready');document.body.style.overflow='hidden';return;}
    }
    if(navigator.onLine&&typeof _flushOfflineQueue==='function')setTimeout(_flushOfflineQueue,800);
    if(navigator.onLine&&typeof cloudPull==='function'&&typeof cloudConfig!=='undefined'&&cloudConfig?.supabaseUrl)setTimeout(function(){cloudPull(true);},1500);
    // PATCH4 FIX3: Re-apply DRG lock saat tab kembali aktif
    // Memastikan perubahan station Admin langsung tampak tanpa re-login
    if(window.currentUser && window.currentUser.role === 'User-DRG'){
      setTimeout(function(){
        if(typeof _applyDrgLock==='function') _applyDrgLock();
        if(typeof buildStationTabs==='function') buildStationTabs();
        if(typeof renderDgTrx==='function') renderDgTrx();
      }, 400);
    }
  }
});
window.addEventListener('pageshow', function(e){
  updateClock();
  updateStationClocks();
  if(e.persisted){
    var _s=null;try{_s=JSON.parse(localStorage.getItem('sjnam_session_v1')||'null');}catch(ex){}
    if(!_s&&window.currentUser){
      window.currentUser=null;
      var _ov=document.getElementById('loginOverlay');if(_ov)_ov.style.display='';
      document.getElementById('userPanel')?.classList.add('hidden');
      document.getElementById('sidebar')?.classList.remove('perm-ready');
      document.getElementById('mainContent')?.classList.remove('perm-ready');
    } else if(_s&&navigator.onLine&&typeof cloudPull==='function'&&typeof cloudConfig!=='undefined'&&cloudConfig.supabaseUrl){
      setTimeout(function(){cloudPull(true);},500);
    }
  }
});

// Online/offline indicator
window.addEventListener('online',()=>$('#offlineBadge').classList.add('hidden'));
window.addEventListener('offline',()=>$('#offlineBadge').classList.remove('hidden'));
if(!navigator.onLine) $('#offlineBadge').classList.remove('hidden');

// =================================================================
// DARK MODE
// =================================================================
// applyDarkMode() dipindahkan ke shared-utils.js (window.applyDarkMode)
const dmToggle = $('#darkModeToggle'); if(dmToggle) dmToggle.addEventListener('change',e=>{settings.darkMode=e.target.checked;saveSettings();applyDarkMode();});
const btnDark = $('#btnDarkToggle'); if(btnDark) btnDark.addEventListener('click',()=>{settings.darkMode=!settings.darkMode;saveSettings();applyDarkMode();});

// =================================================================
// WIZARD NAVIGATION
// =================================================================
function setWizardStep(step){
  currentWizardStep=step;
  for(let i=1;i<=3;i++){
    const s=$(`#step${i}`),dot=$(`#dot${i}`);
    s.classList.toggle('active',i===step);
    dot.classList.remove('done','active','pending');
    if(i<step) dot.classList.add('done');
    else if(i===step) dot.classList.add('active');
    else dot.classList.add('pending');
    if(i<3){const line=$(`#line${i}`);line.style.background=i<step?'#2563eb':'';}
  }
  $('#stepLabel').textContent=`Langkah ${step} / 3`;
}

$('#btnStep1Next').addEventListener('click',()=>{
  const rt=$('#route').value.trim().toUpperCase().replace('-','');
  if(!rt||!/^[A-Z]{6}$/.test(rt)){showToast('Route harus 6 huruf IATA','error');return;}
  const org=rt.slice(0,3),dst=rt.slice(3);
  if(!stationExists(org)){showToast(`⚠️ Station ${org} belum terdaftar! Daftarkan di menu Stations.`,'warn');return;}
  if(!stationExists(dst)){showToast(`⚠️ Station ${dst} belum terdaftar! Daftarkan di menu Stations.`,'warn');return;}
  if(!$('#kategori').value){showToast('Pilih kategori delay','error');return;}
  setWizardStep(2);
});
$('#btnStep2Back').addEventListener('click',()=>setWizardStep(1));
$('#btnStep2Next').addEventListener('click',()=>{
  if(!$('#stdUtc').value||!$('#etdUtc').value){showToast('Lengkapi STD dan ETD','error');return;}
  setWizardStep(3);
});
$('#btnStep3Back').addEventListener('click',()=>setWizardStep(2));

// =================================================================
// ROUTE VALIDATION & PREVIEW
// =================================================================
$('#route').addEventListener('input',e=>{
  const v=e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,6);
  e.target.value=v;
  const hint=$('#routeHint');
  if(v.length===6){
    const org=v.slice(0,3),dst=v.slice(3);
    const oOk=stationExists(org),dOk=stationExists(dst);
    const orgSt=stations.find(x=>x.iata===org);
    const dstSt=stations.find(x=>x.iata===dst);
    let msg=`${org}(UTC+${oOk?orgSt.tz:'?'}) → ${dst}(UTC+${dOk?dstSt.tz:'?'})`;
    if(!oOk||!dOk){
      hint.className='text-xs mt-1 text-amber-600 dark:text-amber-400 font-medium';
      msg+=' ⚠️ Station belum terdaftar';
    } else {
      hint.className='text-xs mt-1 text-emerald-600 dark:text-emerald-400 font-medium';
    }
    hint.textContent=msg;
  } else {
    hint.textContent=''; hint.className='text-xs mt-1 min-h-[16px]';
  }
  updatePreviews();
});

// =================================================================
// PREVIEW & KALKULASI REALTIME
// =================================================================
function updatePreviews(){
  const tanggal=$('#tanggal').value;
  const stdTime=$('#stdUtc').value;
  const etdTime=$('#etdUtc').value;
  const atdTime=$('#atdUtc').value;
  const oclVal=$('#oclTime').value;
  const routeRaw=$('#route').value.trim().toUpperCase().replace('-','');
  const originIata=routeRaw.slice(0,3);
  const destIata=routeRaw.slice(3);
  const originTz=getStationTz(originIata);
  const destTz=getStationTz(destIata);
  const tzOriginName=originTz===7?'WIB':originTz===8?'WITA':'WIT';
  const tzDestName=destTz===7?'WIB':destTz===8?'WITA':'WIT';

  // Helper: buat UTC yang pas dengan tanggal lokal
  function makeUtcForLocal(tanggal, timeStr, tz){
    if(!tanggal||!timeStr) return '';
    let d = parseUTC(`${tanggal}T${timeStr}`);
    // sesuaikan agar tanggal lokal = tanggal penerbangan
    let local = new Date(d.getTime() + tz*3600000);
    const ly = local.getUTCFullYear(), lm = local.getUTCMonth(), ld = local.getUTCDate();
    const [y,m,day] = tanggal.split('-').map(Number);
    if(ly!==y || lm!==m-1 || ld!==day){
      const diffDays = Math.round((Date.UTC(y,m-1,day) - Date.UTC(ly,lm,ld))/86400000);
      d = new Date(d.getTime() + diffDays*86400000);
    }
    return d.toISOString().slice(0,16);
  }

  const stdVal = makeUtcForLocal(tanggal, stdTime, originTz);
  const etdVal = makeUtcForLocal(tanggal, etdTime, originTz);
  const atdVal = makeUtcForLocal(tanggal, atdTime, originTz);

  // STD preview (origin station tz)
  if(stdVal){
    const d=parseUTC(stdVal);
    const local=new Date(d.getTime()+originTz*3600000);
    const hh=String(local.getUTCHours()).padStart(2,'0');
    const mm=String(local.getUTCMinutes()).padStart(2,'0');
    $('#previewStd').textContent=`${tzOriginName}(UTC+${originTz}): ${hh}:${mm}`;
  } else $('#previewStd').textContent='';

  // ETD preview (origin station tz)
  if(etdVal){
    let d=parseUTC(etdVal);
    const crossMid=stdVal&&d<parseUTC(stdVal);
    if(crossMid) d=new Date(d.getTime()+24*3600000);
    const local=new Date(d.getTime()+originTz*3600000);
    const hh=String(local.getUTCHours()).padStart(2,'0');
    const mm=String(local.getUTCMinutes()).padStart(2,'0');
    $('#previewEtd').textContent=`${tzOriginName}(UTC+${originTz}): ${hh}:${mm}${crossMid?' 🌙+1':''}`;
  } else $('#previewEtd').textContent='';

  // ATD preview (origin station tz)
  if(atdVal){
    let d=parseUTC(atdVal);
    const crossMid=stdVal&&d<parseUTC(stdVal);
    if(crossMid) d=new Date(d.getTime()+24*3600000);
    const local=new Date(d.getTime()+originTz*3600000);
    const hh=String(local.getUTCHours()).padStart(2,'0');
    const mm=String(local.getUTCMinutes()).padStart(2,'0');
    $('#previewAtd').textContent=`${tzOriginName}(UTC+${originTz}): ${hh}:${mm}${crossMid?' 🌙+1':''}`;
  } else $('#previewAtd').textContent='';

  // OCL preview (origin station tz)
  if(oclVal&&stdVal){
    const std=parseUTC(stdVal);
    const [hh,mm]=oclVal.split(':').map(Number);
    let oclUtc=new Date(Date.UTC(std.getUTCFullYear(),std.getUTCMonth(),std.getUTCDate(),hh,mm));
    if(oclUtc<std) oclUtc=new Date(oclUtc.getTime()+24*3600000);
    const local=new Date(oclUtc.getTime()+originTz*3600000);
    const lh=String(local.getUTCHours()).padStart(2,'0');
    const lm=String(local.getUTCMinutes()).padStart(2,'0');
    $('#previewOcl').textContent=`${tzOriginName}(UTC+${originTz}): ${lh}:${lm}`;
  } else $('#previewOcl').textContent='';

  // Delay calculation
  if(stdVal&&etdVal){
    const s=parseUTC(stdVal);
    let e=parseUTC(etdVal);
    const midnight=e<s;
    if(midnight) e=new Date(e.getTime()+24*3600000);
    const diff=Math.round((e-s)/60000);

    $('#calcDelay').textContent=formatHM(diff)+(midnight?' 🌙':'');
    $('#calcDelay').className='text-xl font-bold '+(diff>0?'text-red-600 dark:text-red-400':diff<0?'text-emerald-600':' text-slate-700 dark:text-slate-200');
    $('#calcMidnightNote').classList.toggle('hidden',!midnight);

    // Warning >720 menit
    const warn=$('#calcWarn');
    if(diff>720){warn.textContent='⚠️ >12jam!';warn.style.color='#ef4444';}
    else if(diff>0){warn.textContent='';} else warn.textContent='';

    // Status
    let status='-';
    if(diff>=240) status='⛔ Critical';
    else if(diff>=120) status='🔴 Major';
    else if(diff>=60) status='🟠 Significant';
    else if(diff>=15) status='🟡 Minor';
    else if(diff>0) status='🟢 Minimal';
    else if(diff===0) status='✅ On Time';
    else status='🔵 Early';
    $('#calcStatus').textContent=status;

    // OCL diff
    if(oclVal){
      const stdLocal=new Date(s.getTime()+originTz*3600000);
      const [hh,mm]=oclVal.split(':').map(Number);
      let oclUtc=new Date(Date.UTC(s.getUTCFullYear(),s.getUTCMonth(),s.getUTCDate(),hh,mm));
      if(oclUtc<s) oclUtc=new Date(oclUtc.getTime()+24*3600000);
      const oclLocal=new Date(oclUtc.getTime()+originTz*3600000);
      const oclDiff=Math.round((oclLocal-stdLocal)/60000);
      const sign=oclDiff>0?'+':'';
      $('#calcOclDiff').textContent=`${sign}${formatHM(Math.abs(oclDiff))}`;
      $('#calcOclDiff').className='text-lg font-semibold '+(oclDiff>0?'text-amber-600 dark:text-amber-400':oclDiff<0?'text-blue-600':'text-slate-600');
    }

    // Cost
    const pax=parseInt($('#qtyPax').value||0, 10);
    const cost=parseInt($('#costPerPax').value||settings.costPerPax||300000, 10);
    $('#calcCost').textContent=formatRupiah(pax*cost);

    // Delay Now = Waktu UTC sekarang - STD UTC (hanya untuk flight hari ini)
    if(stdVal){
      const flightDate = $('#tanggal').value || todayLocalStr();
      const el = $('#calcDelayNow');
      if(el){
        if(flightDate !== todayLocalStr()){
          // Flight bukan hari ini → tidak relevan
          el.textContent = '-';
        } else {
          const s = parseUTC(stdVal); // BUGFIX: stdVal sudah berisi full ISO string, jangan tambahkan tanggal lagi
          if(s && !isNaN(s.getTime())){
            const diffNow = Math.round((Date.now() - s.getTime())/60000);
            if(diffNow <= 0) el.textContent = '00:00';
            else el.textContent = formatHM(diffNow);
          } else {
            el.textContent = '-';
          }
        }
      }
    }
  } else {
    $('#calcDelay').textContent='00:00';
    $('#calcOclDiff').textContent='-';
    $('#calcStatus').textContent='-';
    $('#calcWarn').textContent='';
    $('#calcMidnightNote').classList.add('hidden');
    $('#calcCost').textContent=formatRupiah(0);
    const el=$('#calcDelayNow'); if(el) el.textContent='--:--';
  }
}

['tanggal','stdUtc','etdUtc','atdUtc','oclTime','qtyPax','costPerPax'].forEach(id=>{
  const el=$('#'+id);
  if(el) el.addEventListener('input',updatePreviews);
});

// Update Delay Now setiap 30 detik
setInterval(()=>{ if(document.getElementById('calcDelayNow')) updatePreviews(); },30000);

// Refresh tabel Data setiap 60 detik untuk update Delay Now
setInterval(()=>{ if(document.getElementById('tab-data')?.classList.contains('active')) renderTable(); },60000);

// =================================================================
// FLIGHT NUMBER AUTOCOMPLETE
// =================================================================
function updateFlightHistory(){
  const recent=[...new Set(data.map(d=>d.flightNumber))].slice(0,20);
  const dl=$('#flightHistory');
  dl.innerHTML=recent.map(f=>`<option value="${esc(f)}">`).join('');
}

// =================================================================
// FORM SUBMIT
// =================================================================
$('#btnSimpan').addEventListener('click',()=>{
  const routeRaw=$('#route').value.trim().toUpperCase().replace('-','');
  if(!/^[A-Z]{6}$/.test(routeRaw)){showToast('Route harus 6 huruf','error');setWizardStep(1);return;}
  const org=routeRaw.slice(0,3),dst=routeRaw.slice(3);
  if(!stationExists(org)||!stationExists(dst)){
    showToast(`Station ${!stationExists(org)?org:dst} belum terdaftar!`,'error');
    setWizardStep(1);return;
  }
  const route=`${org}-${dst}`;
  const tanggal=$('#tanggal').value;
  const stdTime=$('#stdUtc').value, etdTime=$('#etdUtc').value;
  if(!tanggal||!stdTime||!etdTime){showToast('Lengkapi tanggal, STD, ETD','error');setWizardStep(2);return;}
  
  // VALIDASI DUPLIKASI FLIGHT
  const flightNum=$('#flightNumber').value.trim().toUpperCase();
  const isDuplicate=data.some(d=>d.flightNumber.toUpperCase()===flightNum && d.tanggal===tanggal && d.id!==editingId);
  if(isDuplicate){
    showToast(`⚠️ Duplikat: ${flightNum} tanggal ${formatDateDMY(tanggal)} sudah ada`,'error');
    setWizardStep(1);
    $('#flightNumber').classList.add('input-error');
    setTimeout(()=>$('#flightNumber').classList.remove('input-error'),2000);
    return;
  }

  const std=parseUTC(`${tanggal}T${stdTime}`);
  let etd=parseUTC(`${tanggal}T${etdTime}`);
  if(etd<std) etd=new Date(etd.getTime()+24*3600000);
  const diff=Math.round((etd-std)/60000);

  if(diff>720){
    // masih boleh simpan tapi warning
    showToast('⚠️ Delay >12 jam, pastikan input benar','warn');
  }

  const atdTime=$('#atdUtc').value;
  let atdSave='';
  if(atdTime){
    let atd=parseUTC(`${tanggal}T${atdTime}`);
    if(atd<std) atd=new Date(atd.getTime()+24*3600000);
    atdSave=atd.toISOString().slice(0,16);
  }

  const oclVal=$('#oclTime').value;
  let oclDiff=0;
  if(oclVal){
    const [hh,mm]=oclVal.split(':').map(Number);
    let oclUtc=new Date(Date.UTC(std.getUTCFullYear(),std.getUTCMonth(),std.getUTCDate(),hh,mm));
    if(oclUtc<std) oclUtc=new Date(oclUtc.getTime()+24*3600000);
    const originTz=getStationTz(org);
    const oclLocal=new Date(oclUtc.getTime()+originTz*3600000);
    const stdLocal=new Date(std.getTime()+originTz*3600000);
    oclDiff=Math.round((oclLocal-stdLocal)/60000);
  }

  const payload={
    id: editingId||Date.now(),
    tanggal,
    flightNumber: $('#flightNumber').value.trim().toUpperCase(),
    route,
    stdUtc: `${tanggal}T${stdTime}`,
    etdUtc: etd.toISOString().slice(0,16),
    atdUtc: atdSave,
    oclTime: oclVal,
    kategori: $('#kategori').value,
    flightStatus: $('#flightStatus').value||'Delay Flight',
    approval: $('#approval').value,
    verifikasi: $('#verifikasi').value||'No',
    qtyPax: parseInt($('#qtyPax').value||0, 10),
    costPerPax: parseInt($('#costPerPax').value||settings.costPerPax||300000, 10),
    about: $('#about').value.trim(),
    keterangan: $('#keterangan').value.trim(),
    delayMenit: diff,
    oclDiff,
    // BUGFIX: pertahankan createdAt asli saat edit — jangan timpa dengan waktu sekarang
    createdAt: (editingId ? (data.find(d=>d.id===editingId)||{}).createdAt || new Date().toISOString() : new Date().toISOString()),
    updatedAt: new Date().toISOString()
  };

  if(editingId){
    const idx=data.findIndex(d=>d.id===editingId);
    if(idx>-1) data[idx]=payload;
    showToast('Data berhasil diperbarui');
  } else {
    data.unshift(payload);
    showToast('Data delay berhasil disimpan ✅');
  }
  saveData();
  resetForm();
  renderTable();
  updateFlightHistory();
});

function resetForm(){
  // Reset fields manually (no form.reset() since it's a div structure)
  ['flightNumber','route','stdUtc','etdUtc','atdUtc','oclTime','about','keterangan'].forEach(id=>{const el=$('#'+id);if(el)el.value='';});
  // BUGFIX: valueAsDate menggunakan UTC yang di Indonesia (UTC+7) bisa menampilkan
  // kemarin. Gunakan tanggal lokal device agar selalu menampilkan hari ini.
  $('#tanggal').value=todayLocalStr();
  $('#kategori').value='';
  $('#flightStatus').value='Delay Flight';
  $('#approval').value='Not-Approved';
  $('#verifikasi').value='No';
  $('#qtyPax').value='';
  $('#costPerPax').value=settings.costPerPax||300000;
  editingId=null;
  $('#editIndicator').classList.add('hidden');
  $('#btnSimpan').innerHTML='💾 Simpan Data';
  $('#routeHint').textContent='';
  setWizardStep(1);
  const hint=$('#dfsHintStd'); if(hint) hint.textContent='';
  updatePreviews();
}
$('#btnReset').addEventListener('click',resetForm);

// =================================================================
// FILTER & TABLE
// =================================================================
function getDashboardData(){
  const from=$('#dashFrom').value, to=$('#dashTo').value;
  const airline=$('#dashAirlineFilter')?$('#dashAirlineFilter').value:'';
  let filtered=[...data];
  if(from) filtered=filtered.filter(d=>d.tanggal>=from);
  if(to) filtered=filtered.filter(d=>d.tanggal<=to);
  if(airline) filtered=filtered.filter(d=>(d.flightNumber||'').toUpperCase().startsWith(airline));
  return filtered;
}


// MULTI-KATEGORI FILTER
$('#btnKatFilter').addEventListener('click',()=>$('#katDropdown').classList.toggle('hidden'));
document.addEventListener('click',e=>{ if(!e.target.closest('#btnKatFilter') && !e.target.closest('#katDropdown')) $('#katDropdown').classList.add('hidden'); });
$('#katApply').addEventListener('click',()=>{
  const sel=Array.from(document.querySelectorAll('.katChk:checked')).map(cb=>cb.value);
  $('#katFilterLabel').textContent = sel.length ? sel.join(', ') : 'Semua Kategori';
  $('#katDropdown').classList.add('hidden');
  currentPage=1; renderTable();
});
$('#katClear').addEventListener('click',()=>{
  document.querySelectorAll('.katChk').forEach(cb=>cb.checked=false);
  $('#katFilterLabel').textContent='Semua Kategori';
  currentPage=1; renderTable();
});

function getFilteredData(){
  let filtered=[...data];
  const search=($('#searchInput').value||'').toLowerCase().trim();
  const from=$('#filterTglFrom').value, to=$('#filterTglTo').value;
  const airline=$('#filterAirline')?$('#filterAirline').value:'';
  const selectedKats=Array.from(document.querySelectorAll('.katChk:checked')).map(cb=>cb.value);
  if(search) filtered=filtered.filter(d=>(d.flightNumber||'').toLowerCase().includes(search)||(d.route||'').toLowerCase().includes(search));
  if(airline) filtered=filtered.filter(d=>(d.flightNumber||'').toUpperCase().startsWith(airline));
  if(from) filtered=filtered.filter(d=>(d.tanggal||'')>=from);
  if(to) filtered=filtered.filter(d=>(d.tanggal||'')<=to);
  if(selectedKats.length) filtered=filtered.filter(d=>selectedKats.includes(d.kategori));
  if(sortOrder==='asc'){
    filtered.sort((a,b)=>(a.tanggal||'').localeCompare(b.tanggal||'')||(a.stdUtc||'').localeCompare(b.stdUtc||''));
  } else {
    filtered.sort((a,b)=>(b.tanggal||'').localeCompare(a.tanggal||'')||(b.stdUtc||'').localeCompare(a.stdUtc||''));
  }
  return filtered;
}

const statusColor={
  'Delay Flight':'status-delay',
  'Postponed Flight':'status-postponed',
  'Cancel Flight':'status-cancel'
};
const katColors={
  'ATC':'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  'Teknik':'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'Operasional':'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'Cuaca':'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  'Lainnya':'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
};

function renderTable(){
  const filtered=getFilteredData();
  const tbody=$('#tableBody');
  const empty=$('#emptyState');
  const mobile=$('#mobileCards');

  if(filtered.length===0){
    tbody.innerHTML=''; if(mobile) mobile.innerHTML='';
    empty.classList.remove('hidden');
    $('#paginationInfo').textContent='Tidak ada data';
    $('#paginationControls').innerHTML='';
    return;
  }
  empty.classList.add('hidden');
  const totalPages=Math.ceil(filtered.length/pageSize);
  if(currentPage>totalPages) currentPage=1;
  const start=(currentPage-1)*pageSize;
  const pageData=filtered.slice(start,start+pageSize);

  tbody.innerHTML=pageData.map((d,i)=>{
    const no=start+i+1;
    const origin=getRouteOrigin(d.route), dest=getRouteDest(d.route);
    const stdInfo=formatTimeLocal(d.stdUtc,origin);
    const etdInfo=formatTimeLocal(d.etdUtc,origin);
    // Delay Now = Waktu UTC sekarang - STD UTC (dalam menit)
    // Hanya tampil jika tanggal flight = HARI INI (local date device)
    const tz = getStationTz(origin);
    const stdDate = parseUTC(d.stdUtc);
    let delayNowDisplay = '-';
    let delayNowClass = 'text-slate-400';
    
    // Cek apakah tanggal flight = hari ini berdasarkan waktu lokal device
    const todayStr = todayLocalStr(); // "YYYY-MM-DD" lokal device
    const isToday = (d.tanggal === todayStr);
    
    if(isToday && stdDate && !isNaN(stdDate.getTime())){
      const nowUtcMs = Date.now();
      const stdUtcMs = stdDate.getTime();
      let diffNowMin = Math.round((nowUtcMs - stdUtcMs)/60000);
      if(diffNowMin < -4*60){
        // STD masih > 4 jam ke depan, belum relevan
        delayNowDisplay = '-';
        delayNowClass = 'text-slate-400';
      } else if(diffNowMin <= 0){
        delayNowDisplay = '00:00';
        delayNowClass = 'text-emerald-600';
      } else {
        delayNowDisplay = formatHM(diffNowMin);
        delayNowClass = diffNowMin >= 15 ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-emerald-600';
      }
    }
    const delayColor=d.delayMenit>=240?'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-200':d.delayMenit>0?'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300':'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    const katColor=katColors[d.kategori]||'bg-slate-100 text-slate-700';
    const apColor=d.approval==='Approved'?'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300':d.approval==='On-Process'?'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300':'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    // Verifikasi: field independen yang bisa diedit manual (Yes/No). Fallback ke status Approval untuk data lama.
    const isVerified = d.verifikasi ? d.verifikasi==='Yes' : d.approval==='Approved';
    const verifLabel = isVerified ? 'Yes' : 'No';
    const verifColor = isVerified ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
    const sColor=statusColor[d.flightStatus]||'status-delay';
    const costVal=(d.qtyPax||0)*(d.costPerPax||settings.costPerPax||300000);
    // OCL local time conversion
    let oclDisplay = '-';
    if(d.oclTime && d.stdUtc){
      const [hh,mm]=d.oclTime.split(':').map(Number);
      const std=parseUTC(d.stdUtc);
      if(std){
        let oclUtc=new Date(Date.UTC(std.getUTCFullYear(),std.getUTCMonth(),std.getUTCDate(),hh,mm));
        if(oclUtc<std) oclUtc=new Date(oclUtc.getTime()+24*3600000);
        const originIataOcl=getRouteOrigin(d.route);
        const tzOcl=getStationTz(originIataOcl);
        const oclLocal=new Date(oclUtc.getTime()+tzOcl*3600000);
        const lh=String(oclLocal.getUTCHours()).padStart(2,'0');
        const lm=String(oclLocal.getUTCMinutes()).padStart(2,'0');
        const tzName=tzOcl===7?'WIB':tzOcl===8?'WITA':'WIT';
        oclDisplay=`${lh}:${lm} <span class="text-slate-400">${tzName}</span>`;
      }
    } else if(d.oclTime){
      oclDisplay=d.oclTime;
    }
    return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <td class="px-2 py-2 text-slate-500 text-xs">${no}</td>
      <td class="px-2 py-2 whitespace-nowrap text-xs font-medium">${formatDateDMY(d.tanggal)}</td>
      <td class="px-2 py-2 font-bold text-sm">${esc(d.flightNumber)}</td>
      <td class="px-2 py-2 font-mono font-semibold text-xs">${esc(d.route)}</td>
      <td class="px-2 py-2 text-xs">
        <div class="font-mono">${stdInfo.utc}</div>
        <div class="text-slate-400">${stdInfo.local} UTC+${stdInfo.tz}</div>
      </td>
      <td class="px-2 py-2 text-xs">
        <div class="font-mono">${etdInfo.utc}</div>
        <div class="text-slate-400">${etdInfo.local} UTC+${etdInfo.tz}</div>
      </td>
      <td class="px-2 py-2 text-xs text-center">
        <div class="font-mono ${delayNowClass}">${delayNowDisplay}</div>
      </td>
      <td class="px-2 py-2"><span class="badge ${delayColor}">${formatHM(d.delayMenit)}</span></td>
      <td class="px-2 py-2"><span class="flight-status-badge ${sColor} text-xs">${d.flightStatus||'Delay Flight'}</span></td>
      <td class="px-2 py-2 font-mono text-xs">${oclDisplay}</td>
      <td class="px-2 py-2"><span class="badge ${katColor}">${d.kategori}</span></td>
      <td class="px-2 py-2"><span class="badge ${apColor}">${d.approval||'Not-Approved'}</span></td>
      <td class="px-2 py-2">
        <select data-verif-id="${d.id}" class="badge ${verifColor} border-0 cursor-pointer ${window.currentUserReadOnly?'pointer-events-none opacity-60':''}" ${window.currentUserReadOnly?'disabled':''}>
          <option value="No" ${!isVerified?'selected':''}>No</option>
          <option value="Yes" ${isVerified?'selected':''}>Yes</option>
        </select>
      </td>
      <td class="px-2 py-2 text-center"><input type="number" min="0" value="${d.qtyPax||0}" data-qty-id="${d.id}" class="qty-input text-xs" ${window.currentUserReadOnly?'disabled readonly style="opacity:0.5;cursor:not-allowed"':''}></td>
      <td class="px-2 py-2 text-right text-xs font-medium text-purple-700 dark:text-purple-300">${formatRupiah(costVal)}</td>
      <td class="px-2 py-2 max-w-[120px] truncate text-xs text-slate-500" title="${d.keterangan||''}">${d.keterangan||'-'}</td>
      <td class="px-2 py-2 text-center whitespace-nowrap">
        ${window.currentUserReadOnly ? '<span class="text-xs text-slate-400">-</span>' : `<button data-edit="${d.id}" class="text-blue-600 hover:text-blue-800 mr-1.5 text-xs font-semibold">Edit</button><button data-del="${d.id}" class="text-red-600 hover:text-red-800 text-xs font-semibold">Del</button>`}
      </td>
    </tr>`;
  }).join('');

  // Mobile cards
  if(mobile){
    mobile.innerHTML=pageData.map((d,i)=>{
      const no=start+i+1;
      const origin=getRouteOrigin(d.route);
      const stdInfo=formatTimeLocal(d.stdUtc,origin);
      const etdInfo=formatTimeLocal(d.etdUtc,origin);
      const delayColor=d.delayMenit>0?'text-red-600':'text-emerald-600';
      const sColor=statusColor[d.flightStatus]||'status-delay';
      const isVerifiedM = d.verifikasi ? d.verifikasi==='Yes' : d.approval==='Approved';
      const verifColorM = isVerifiedM ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
      return `<div class="card p-4 rounded-xl">
        <div class="flex items-start justify-between mb-2">
          <div>
            <span class="font-bold text-base">${esc(d.flightNumber)}</span>
            <span class="ml-2 font-mono text-sm text-slate-500">${esc(d.route)}</span>
          </div>
          <span class="font-bold text-lg ${delayColor}">${formatHM(d.delayMenit)}</span>
        </div>
        <div class="text-xs text-slate-500 space-y-0.5">
          <div>📅 ${formatDateDMY(d.tanggal)} &nbsp; 📍 ${d.kategori}</div>
          <div>STD ${stdInfo.utc} → ETD ${etdInfo.utc} <span class="text-slate-400">(UTC+${stdInfo.tz})</span></div>
        </div>
        <div class="flex items-center justify-between mt-2">
          <div class="flex items-center gap-1.5">
            <span class="flight-status-badge ${sColor}">${d.flightStatus||'Delay'}</span>
            <select data-verif-id="${d.id}" class="badge ${verifColorM} border-0 cursor-pointer text-xs ${window.currentUserReadOnly?'pointer-events-none opacity-60':''}" ${window.currentUserReadOnly?'disabled':''} title="Verifikasi">
              <option value="No" ${!isVerifiedM?'selected':''}>No</option>
              <option value="Yes" ${isVerifiedM?'selected':''}>Yes</option>
            </select>
          </div>
          <div class="flex gap-2">
            ${window.currentUserReadOnly ? '' : `<button data-edit="${d.id}" class="text-blue-600 text-xs font-semibold">Edit</button><button data-del="${d.id}" class="text-red-600 text-xs font-semibold">Hapus</button>`}
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // Qty inline save
  tbody.querySelectorAll('[data-qty-id]').forEach(input=>{
    input.addEventListener('change',e=>{
      if(window.currentUserReadOnly) return;
      const id=parseInt(e.target.dataset.qtyId);
      const idx=data.findIndex(d=>d.id===id);
      if(idx>-1){data[idx].qtyPax=parseInt(e.target.value)||0;saveData();renderTable();}
    });
  });

  // Verifikasi inline save (desktop + mobile)
  [tbody, mobile].forEach(container=>{
    if(!container) return;
    container.querySelectorAll('[data-verif-id]').forEach(sel=>{
      sel.addEventListener('change',e=>{
        if(window.currentUserReadOnly) return;
        const id=parseInt(e.target.dataset.verifId);
        const idx=data.findIndex(d=>d.id===id);
        if(idx>-1){
          data[idx].verifikasi=e.target.value;
          saveData();
          renderTable();
          showToast('Verifikasi diperbarui');
        }
      });
    });
  });

  // Pagination
  $('#paginationInfo').textContent=`${start+1}–${Math.min(start+pageSize,filtered.length)} / ${filtered.length}`;
  let pHtml=`<button ${currentPage===1?'disabled':''} data-page="${currentPage-1}" class="px-2.5 py-1.5 rounded-lg border text-xs disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700">‹</button>`;
  for(let p=Math.max(1,currentPage-2);p<=Math.min(totalPages,currentPage+2);p++){
    pHtml+=`<button data-page="${p}" class="px-2.5 py-1.5 rounded-lg border text-xs ${p===currentPage?'bg-blue-600 text-white border-blue-600':'hover:bg-slate-100 dark:hover:bg-slate-700'}">${p}</button>`;
  }
  pHtml+=`<button ${currentPage===totalPages?'disabled':''} data-page="${currentPage+1}" class="px-2.5 py-1.5 rounded-lg border text-xs disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700">›</button>`;
  $('#paginationControls').innerHTML=pHtml;
  $('#paginationControls').onclick = e=>{if(e.target.dataset.page){currentPage=parseInt(e.target.dataset.page);renderTable();}};
}

function handleTableClick(e){
  // Read-only mode: User tidak bisa edit/hapus data
  if(window.currentUserReadOnly) return;
  if(e.target.dataset.edit){
    const id=parseInt(e.target.dataset.edit);
    const item=data.find(d=>d.id===id);
    if(!item) return;
    editingId=id;
    $('#tanggal').value=item.tanggal;
    $('#flightNumber').value=item.flightNumber;
    $('#route').value=item.route.replace('-','');
    $('#stdUtc').value=item.stdUtc.split('T')[1]||'';
    $('#etdUtc').value=item.etdUtc.split('T')[1]||'';
    $('#atdUtc').value=item.atdUtc?(item.atdUtc.split('T')[1]||''):'';
    $('#oclTime').value=item.oclTime||'';
    $('#kategori').value=item.kategori;
    $('#flightStatus').value=item.flightStatus||'Delay Flight';
    $('#approval').value=item.approval||'Not-Approved';
    $('#verifikasi').value=item.verifikasi||(item.approval==='Approved'?'Yes':'No');
    $('#qtyPax').value=item.qtyPax||'';
    $('#costPerPax').value=item.costPerPax||settings.costPerPax||300000;
    $('#about').value=item.about||'';
    $('#keterangan').value=item.keterangan||'';
    $('#editIndicator').classList.remove('hidden');
    $('#btnSimpan').innerHTML='✏️ Update Data';
    switchTab('input');
    setWizardStep(1);
    updatePreviews();
  }
  if(e.target.dataset.del){
    const id=parseInt(e.target.dataset.del);
    const item = data.find(d=>d.id===id);
    showConfirm('Hapus Data',`Hapus data flight ${item?.flightNumber||''}?`).then(ok=>{
      if(ok){
        if(typeof window.pushUndo === 'function') window.pushUndo(`Hapus data ${item ? (item.flightNumber||item.id) : id}`, data);
        data=data.filter(d=>d.id!==id);saveData();renderTable();showToast('Data dihapus');
      }
    });
  }
}

// Attach table listeners once (fix mobile pagination performance)
$('#tableBody').addEventListener('click',handleTableClick);
$('#mobileCards').addEventListener('click',handleTableClick);

['searchInput','filterTglFrom','filterTglTo','filterAirline'].forEach(id=>{
  const el=$('#'+id);
  if(el) el.addEventListener('input',()=>{currentPage=1;renderTable();});
  if(el && id==='filterAirline') el.addEventListener('change',()=>{currentPage=1;renderTable();});
});

// =================================================================
// EXPORT DATA
// =================================================================
$('#btnExportExcel').addEventListener('click',()=>{
  if(!window.XLSX){ showToast('Library Excel belum dimuat, coba refresh halaman','error'); return; }
  const filtered=getFilteredData();
  if(!filtered.length) return showToast('Tidak ada data','error');
  const rows = filtered.map((d,i)=>{
    const origin = getRouteOrigin(d.route);
    const tz = getStationTz(origin);
    const tzName = tz===7?'WIB':tz===8?'WITA':'WIT';
    const toLocal = (iso)=>{
      if(!iso) return '-';
      const dt = parseUTC(iso);
      const local = new Date(dt.getTime()+tz*3600000);
      return local.toISOString().substr(11,5)+' '+tzName;
    };
    return {
      No:i+1, DATE:formatDateDMY(d.tanggal), Flight:d.flightNumber, Route:d.route,
      STD_Local:toLocal(d.stdUtc), ETD_Local:toLocal(d.etdUtc),
      ATD_Local:d.atdUtc?toLocal(d.atdUtc):'-',
      Delay_Menit:d.delayMenit, Delay_HH_MM:formatHM(d.delayMenit),
      Flight_Status:d.flightStatus||'Delay Flight',
      Kategori:d.kategori, Approval:d.approval||'Not-Approved',
      Verifikasi: d.verifikasi ? d.verifikasi : (d.approval==='Approved' ? 'Yes' : 'No'),
      Pax:d.qtyPax||0, Cost_PM89:(d.qtyPax||0)*(d.costPerPax||settings.costPerPax||300000),
      Notice:d.about||'', Keterangan:d.keterangan||''
    }
  });
  // hitung total
  const totalPax = rows.reduce((s,r)=>s+(r.Pax||0),0);
  const totalCost = rows.reduce((s,r)=>s+(r.Cost_PM89||0),0);
  rows.push({
    No:'', DATE:'', Flight:'TOTAL', Route:'',
    STD_Local:'', ETD_Local:'', ATD_Local:'',
    Delay_Menit:'', Delay_HH_MM:'',
    Flight_Status:'', Kategori:'', Approval:'',
    Verifikasi:'',
    Pax:totalPax, Cost_PM89:totalCost,
    Notice:'', Keterangan:''
  });
  const ws=XLSX.utils.json_to_sheet(rows);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Delay');
  XLSX.writeFile(wb,`Delay_SJNAM_${todayLocalStr()}.xlsx`);
  showToast('Excel diexport (lokal time + total)');
});

$('#btnExportPdf').addEventListener('click',()=>{
  const filtered=getFilteredData();
  if(!filtered.length) return showToast('Tidak ada data','error');
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'landscape',unit:'pt'});
  doc.setFontSize(15); doc.setFont('helvetica','bold');
  doc.text('DATA DELAY PENERBANGAN — Service Management SJNAM',40,38);
  doc.setFontSize(9); doc.setFont('helvetica','normal');
  doc.text(`Generated: ${new Date().toLocaleString('id-ID')} | Total: ${filtered.length} flight`,40,52);
  const toLocal = (iso, route)=>{
    if(!iso) return '-';
    const origin = getRouteOrigin(route);
    const tz = getStationTz(origin);
    const dt = parseUTC(iso);
    const local = new Date(dt.getTime()+tz*3600000);
    return local.toISOString().substr(11,5);
  };
  const body = filtered.slice(0,500).map((d,i)=>[
      i+1,formatDateDMY(d.tanggal),d.flightNumber,d.route,
      toLocal(d.stdUtc,d.route),toLocal(d.etdUtc,d.route),
      formatHM(d.delayMenit),d.flightStatus||'Delay',
      d.kategori,d.approval||'',
      d.verifikasi ? d.verifikasi : (d.approval==='Approved'?'Yes':'No'),
      d.qtyPax||0,formatRupiah((d.qtyPax||0)*(d.costPerPax||settings.costPerPax||300000))
    ]);
  // total
  const totalPax = filtered.reduce((s,d)=>s+(d.qtyPax||0),0);
  const totalCost = filtered.reduce((s,d)=>s+((d.qtyPax||0)*(d.costPerPax||settings.costPerPax||300000)),0);
  body.push(['','','TOTAL','','','','','','','','',totalPax,formatRupiah(totalCost)]);
  doc.autoTable({
    startY:65,
    head:[['No','DATE','Flight','Route','STD (Local)','ETD (Local)','Delay','Status','Kat.','Approval','Verifikasi','Pax','Cost PM89']],
    body:body,
    styles:{fontSize:7},
    headStyles:{fillColor:[29,78,216]},
    alternateRowStyles:{fillColor:[248,250,252]},
    footStyles:{fillColor:[226,232,240],textColor:[15,23,42],fontStyle:'bold'}
  });
  doc.save(`Delay_SJNAM_${todayLocalStr()}.pdf`);
  showToast('PDF diexport (lokal time + total)');
});

$('#fileImportJson').addEventListener('change',async e=>{
  if(window.currentUserReadOnly){ showToast('Akses ditolak: mode read-only','error'); e.target.value=''; return; }
  const file=e.target.files[0];if(!file) return;
  try{
    const arr=JSON.parse(await file.text());
    if(!Array.isArray(arr)) throw new Error('Format tidak valid');
    const ok=await showConfirm('Import Data',`Import ${arr.length} data?`);
    if(ok){
      const ids=new Set(data.map(d=>d.id));
      const newItems=arr.filter(x=>x.id&&!ids.has(x.id));
      data=[...newItems,...data];
      saveData(); renderTable();
      showToast(`Import berhasil: ${newItems.length} data baru`);
    }
  }catch(err){showToast('Gagal import: '+err.message,'error');}
  e.target.value='';
});

$('#btnHapusSemua').addEventListener('click',async()=>{
  if(window.currentUserReadOnly){ showToast('Akses ditolak: mode read-only','error'); return; }
  const ok=await showConfirm('Hapus Semua','Semua data delay akan dihapus permanen!');
  if(ok){
    if(data.length>0 && typeof window.pushUndo === 'function') window.pushUndo(`Hapus Semua Data (${data.length} record)`, data);
    data=[];saveData();renderTable();showToast('Semua data dihapus');
  }
});

// =================================================================
// DASHBOARD
// =================================================================
function setDashPreset(days){
  const to=new Date();
  const from=new Date();
  if(days>0) from.setDate(to.getDate()-days+1);
  else{ // all
    if(data.length){from.setFullYear(2020,0,1);}
    else from.setDate(to.getDate()-30);
  }
  $('#dashFrom').value=from.toISOString().slice(0,10);
  $('#dashTo').value=to.toISOString().slice(0,10);
  renderDashboard();
}
$('#btnDashPreset7').addEventListener('click',()=>setDashPreset(7));
$('#btnDashPreset30').addEventListener('click',()=>setDashPreset(30));
$('#btnDashPresetAll').addEventListener('click',()=>setDashPreset(0));
['dashFrom','dashTo'].forEach(id=>$('#'+id).addEventListener('input',renderDashboard));
$('#dashAirlineFilter').addEventListener('change',renderDashboard);

function renderDashboard(){
  const filtered=getDashboardData();
  const totalFlight=filtered.length;
  const totalDelayMin=filtered.reduce((s,d)=>s+Math.max(0,d.delayMenit),0);
  const totalPax=filtered.reduce((s,d)=>s+(parseInt(d.qtyPax)||0),0);
  const totalCost=filtered.reduce((s,d)=>s+(parseInt(d.qtyPax)||0)*(parseInt(d.costPerPax)||settings.costPerPax||300000),0);
  const maxDelay=filtered.length?Math.max(...filtered.map(d=>d.delayMenit),0):0;
  const cancelCount=filtered.filter(d=>(d.flightStatus||'')===('Cancel Flight')).length;
  const postponedCount=filtered.filter(d=>(d.flightStatus||'')==='Postponed Flight').length;
  const delayCount=filtered.filter(d=>(d.flightStatus||'Delay Flight')==='Delay Flight').length;

  // KPI Row 1
  $('#kpiTotal').textContent=totalFlight;
  $('#kpiTotalCost').textContent=totalCost>=1000000?`Rp ${(totalCost/1000000).toFixed(1)}jt`:formatRupiah(totalCost);
  $('#kpiPax').textContent=formatNumber(totalPax);
  $('#kpiCountDelay').textContent=delayCount;
  $('#kpiPostponed').textContent=postponedCount;
  $('#kpiCancel').textContent=cancelCount;

  // KPI Row 2 - Avg Delay/Month, Cost/Month, Cost/Day
  const monthlyMap2={};
  filtered.forEach(d=>{
    if(!d.tanggal) return;
    const ym=d.tanggal.slice(0,7);
    if(!monthlyMap2[ym]) monthlyMap2[ym]={cost:0};
    monthlyMap2[ym].cost+=(parseInt(d.qtyPax)||0)*(parseInt(d.costPerPax)||settings.costPerPax||300000);
  });
  const numMonths=Object.keys(monthlyMap2).length||1;
  const avgDelayPerMonth=Math.round(totalDelayMin/numMonths);
  const costPerMonth=Math.round(totalCost/numMonths);
  // count distinct days
  const allDays=new Set(filtered.map(d=>d.tanggal).filter(Boolean));
  const numDays=allDays.size||1;
  const costPerDay=Math.round(totalCost/numDays);

  $('#kpiAvgDelayMonth').textContent=formatHM(avgDelayPerMonth);
  $('#kpiMax').textContent=formatHM(maxDelay);
  $('#kpiCostPerMonth').textContent=totalCost>=1000000?`Rp ${(costPerMonth/1000000).toFixed(1)}jt`:formatRupiah(costPerMonth);
  $('#kpiCostPerDay').textContent=totalCost>=1000000?`Rp ${(costPerDay/1000000).toFixed(1)}jt`:formatRupiah(costPerDay);

  const cats=['ATC','Teknik','Operasional','Cuaca','Lainnya'];
  const catColors=['#8b5cf6','#f59e0b','#3b82f6','#06b6d4','#94a3b8'];
  const isDark=settings.darkMode;
  const gridColor=isDark?'rgba(255,255,255,.07)':'rgba(0,0,0,.05)';
  const tickColor=isDark?'#94a3b8':'#64748b';

  // Chart: Bar Delay per Kategori
  const barData=cats.map(c=>filtered.filter(d=>d.kategori===c).reduce((s,d)=>s+Math.max(0,d.delayMenit),0));
  if(barChart) barChart.destroy();
  barChart=new Chart(document.getElementById('chartBar'),{
    type:'bar',
    data:{labels:cats,datasets:[{data:barData,backgroundColor:catColors,borderRadius:6}]},
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.parsed.y} menit`}},
        datalabels:{display:true,color:isDark?'#e2e8f0':'#1e293b',font:{size:10,weight:'bold'},anchor:'end',align:'top',formatter:v=>v>0?formatHM(v):''}
      },
      scales:{y:{grid:{color:gridColor},ticks:{color:tickColor}},x:{grid:{display:false},ticks:{color:tickColor}}},
      onClick:(evt,elements)=>{
        if(elements.length){
          const cat=cats[elements[0].index];
          document.querySelectorAll('.katChk').forEach(cb=>cb.checked = cb.value===cat);
          $('#katFilterLabel').textContent = cat;
          switchTab('data');
          currentPage=1;
          renderTable();
          showToast(`Filter: Kategori ${cat}`,'info');
        }
      }
    }
  });

  // Chart: Line - Tren Monthly Cost PM
  const monthlyMap={};
  filtered.forEach(d=>{
    if(!d.tanggal) return;
    const ym=d.tanggal.slice(0,7); // "2026-05"
    if(!monthlyMap[ym]) monthlyMap[ym]={cost:0,delay:0,count:0};
    monthlyMap[ym].cost+=(parseInt(d.qtyPax)||0)*(parseInt(d.costPerPax)||settings.costPerPax||300000);
    monthlyMap[ym].delay+=Math.max(0,d.delayMenit);
    monthlyMap[ym].count+=1;
  });
  const sortedMonths=Object.keys(monthlyMap).sort();
  const MONTH_NAMES=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthLabels=sortedMonths.map(ym=>{const[y,m]=ym.split('-');return MONTH_NAMES[parseInt(m)-1]+' '+y.slice(2);});
  const monthlyCost=sortedMonths.map(ym=>monthlyMap[ym].cost);
  if(lineChart) lineChart.destroy();
  lineChart=new Chart(document.getElementById('chartLine'),{
    type:'bar',
    data:{
      labels:monthLabels,
      datasets:[
        {label:'Cost PM (Rp)',data:monthlyCost,backgroundColor:'rgba(37,99,235,.7)',borderColor:'#2563eb',borderWidth:1,borderRadius:4,yAxisID:'y',datalabels:{display:true,color:isDark?'#e2e8f0':'#1e293b',font:{size:9,weight:'bold'},anchor:'end',align:'top',formatter:v=>v>=1000000?'Rp'+(v/1000000).toFixed(1)+'jt':v>0?'Rp'+(v/1000).toFixed(0)+'k':''}},
        {label:'Jumlah Flight',data:sortedMonths.map(ym=>monthlyMap[ym].count),type:'line',borderColor:'#f59e0b',backgroundColor:'rgba(245,158,11,.1)',tension:.4,fill:false,pointBackgroundColor:'#f59e0b',pointRadius:4,yAxisID:'y1',datalabels:{display:true,color:'#f59e0b',font:{size:10,weight:'bold'},anchor:'end',align:'top',offset:6,formatter:v=>v>0?v:''}}
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{
        legend:{display:true,position:'top',labels:{color:tickColor,padding:10,font:{size:11}}},
        tooltip:{callbacks:{label:ctx=>ctx.datasetIndex===0?'Cost: '+formatRupiah(ctx.parsed.y):'Flight: '+ctx.parsed.y+' penerbangan'}}
      },
      scales:{
        y:{grid:{color:gridColor},ticks:{color:tickColor,callback:v=>v>=1000000?'Rp '+(v/1000000).toFixed(0)+'jt':'Rp '+(v/1000).toFixed(0)+'k'},position:'left'},
        y1:{display:true,position:'right',grid:{drawOnChartArea:false},ticks:{color:'#f59e0b',stepSize:1}},
        x:{grid:{display:false},ticks:{color:tickColor}}
      }
    }
  });

  // Pie Chart: Distribusi Delay per Kategori (menit delay, bukan jumlah flight)
  const pieDelayData=cats.map(c=>filtered.filter(d=>d.kategori===c).reduce((s,d)=>s+Math.max(0,d.delayMenit),0));
  if(pieChart) pieChart.destroy();
  pieChart=new Chart(document.getElementById('chartPie'),{
    type:'pie',
    data:{
      labels:cats,
      datasets:[{data:pieDelayData,backgroundColor:catColors,borderWidth:2,borderColor:isDark?'#1e293b':'#fff'}]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{
        legend:{position:'bottom',labels:{color:tickColor,padding:10,font:{size:11}}},
        tooltip:{callbacks:{label:ctx=>{const total=pieDelayData.reduce((a,b)=>a+b,0);const pct=total?Math.round(ctx.parsed/total*100):0;return `${ctx.label}: ${formatHM(ctx.parsed)} (${pct}%)`;}}},
        datalabels:{display:true,color:'#fff',font:{size:10,weight:'bold'},formatter:(v)=>{const total=pieDelayData.reduce((a,b)=>a+b,0);const pct=total?Math.round(v/total*100):0;return v>0?`${pct}%`:'';}}
      }
    }
  });

  // Status Doughnut
  const statusKeys=['Delay Flight','Postponed Flight','Cancel Flight'];
  const statusCounts=statusKeys.map(k=>filtered.filter(d=>(d.flightStatus||'Delay Flight')===k).length);
  if(statusChart) statusChart.destroy();
  statusChart=new Chart(document.getElementById('chartStatus'),{
    type:'doughnut',
    data:{labels:statusKeys,datasets:[{data:statusCounts,backgroundColor:['#f59e0b','#8b5cf6','#ef4444'],borderWidth:2,borderColor:isDark?'#1e293b':'#fff'}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:tickColor,padding:12}},
      datalabels:{display:true,color:'#fff',font:{size:11,weight:'bold'},formatter:(v)=>{const total=statusCounts.reduce((a,b)=>a+b,0);const pct=total?Math.round(v/total*100):0;return v>0?`${v} (${pct}%)`:'';}}
    },cutout:'60%'}
  });

    const top10=filtered.slice().sort((a,b)=>b.delayMenit-a.delayMenit).slice(0,3);
  const rankEmoji=['🥇','🥈','🥉'];
  const katBadge={ATC:'bg-purple-100 text-purple-700',Teknik:'bg-amber-100 text-amber-700',Operasional:'bg-blue-100 text-blue-700',Cuaca:'bg-cyan-100 text-cyan-700',Lainnya:'bg-slate-100 text-slate-700'};
  const _tdb = document.getElementById('topDelayBody'); if(_tdb) _tdb.innerHTML =top10.map((d,i)=>{
    const costVal=(parseInt(d.qtyPax)||0)*(parseInt(d.costPerPax)||settings.costPerPax||300000);
    const sColor=d.flightStatus==='Cancel Flight'?'status-cancel':d.flightStatus==='Postponed Flight'?'status-postponed':'status-delay';
    return `<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <td class="px-3 py-2 font-bold text-sm">${rankEmoji[i]}</td>
      <td class="px-3 py-2 text-xs whitespace-nowrap">${formatDateDMY(d.tanggal)}</td>
      <td class="px-3 py-2 font-bold">${esc(d.flightNumber)}</td>
      <td class="px-3 py-2 font-mono text-xs">${esc(d.route)}</td>
      <td class="px-3 py-2"><span class="badge bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-200 font-bold">${formatHM(d.delayMenit)}</span></td>
      <td class="px-3 py-2"><span class="badge ${katBadge[d.kategori]||'bg-slate-100 text-slate-700'}">${d.kategori}</span></td>
      <td class="px-3 py-2"><span class="flight-status-badge ${sColor} text-xs">${d.flightStatus||'Delay Flight'}</span></td>
      <td class="px-3 py-2 text-center text-xs">${formatNumber(parseInt(d.qtyPax)||0)}</td>
      <td class="px-3 py-2 text-right text-xs font-medium text-purple-700 dark:text-purple-300">${formatRupiah(costVal)}</td>
    </tr>`;
  }).join('')||`<tr><td colspan="9" class="px-4 py-8 text-center text-slate-500">Belum ada data</td></tr>`;

  // Route Delay Bar Chart (all routes, sorted by quantity desc)
  const routeMap2={};
  filtered.forEach(d=>{
    if(!d.route) return;
    if(!routeMap2[d.route]) routeMap2[d.route]={total:0,count:0};
    routeMap2[d.route].total+=Math.max(0,d.delayMenit);
    routeMap2[d.route].count+=1;
  });
  const allRoutes=Object.entries(routeMap2).map(([route,v])=>({route,...v})).sort((a,b)=>b.count-a.count);
  const routeLabels=allRoutes.map(r=>r.route);
  const routeDelays=allRoutes.map(r=>r.count);
  const routeColors=routeLabels.map((_,i)=>`hsl(${(i*47)%360},65%,55%)`);
  if(window._routeBarChart) window._routeBarChart.destroy();
  if(document.getElementById('chartRouteBar') && routeDelays.length>0){
    window._routeBarChart=new Chart(document.getElementById('chartRouteBar'),{
      type:'bar',
      data:{labels:routeLabels,datasets:[{label:'Quantity Delay',data:routeDelays,backgroundColor:routeColors,borderRadius:5}]},
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.parsed.y}`}},
          datalabels:{display:true,color:isDark?'#e2e8f0':'#1e293b',font:{size:10,weight:'bold'},anchor:'end',align:'top',formatter:v=>v>0?v:''}
        },
        scales:{
          y:{grid:{color:gridColor},ticks:{color:tickColor,callback:v=>v}},
          x:{grid:{display:false},ticks:{color:tickColor,maxRotation:45,minRotation:30,font:{size:10}}}
        }
      }
    });
  }

  // Cost PM by Station (sorted by station name)
  const stationCostMap={};
  filtered.forEach(d=>{
    if(!d.route||d.route.length<3) return;
    const origin=d.route.slice(0,3);
    if(!stationCostMap[origin]) stationCostMap[origin]=0;
    stationCostMap[origin]+=(parseInt(d.qtyPax)||0)*(parseInt(d.costPerPax)||settings.costPerPax||300000);
  });
  const stationEntries=Object.entries(stationCostMap).sort((a,b)=>a[0].localeCompare(b[0]));
  const stationLabels=stationEntries.map(e=>e[0]);
  const stationCosts=stationEntries.map(e=>e[1]);
  const stationColors=stationLabels.map((_,i)=>`hsl(${(i*67+200)%360},60%,55%)`);
  if(window._stationCostChart) window._stationCostChart.destroy();
  if(document.getElementById('chartCostStation') && stationCosts.length>0){
    window._stationCostChart=new Chart(document.getElementById('chartCostStation'),{
      type:'bar',
      data:{labels:stationLabels,datasets:[{label:'Total Cost PM (Rp)',data:stationCosts,backgroundColor:stationColors,borderRadius:5}]},
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>formatRupiah(ctx.parsed.y)}},
          datalabels:{display:true,color:isDark?'#e2e8f0':'#1e293b',font:{size:9,weight:'bold'},anchor:'end',align:'top',formatter:v=>v>=1000000?'Rp'+(v/1000000).toFixed(1)+'jt':v>0?'Rp'+(v/1000).toFixed(0)+'k':''}
        },
        scales:{
          y:{grid:{color:gridColor},ticks:{color:tickColor,callback:v=>v>=1000000?'Rp '+(v/1000000).toFixed(0)+'jt':'Rp '+(v/1000).toFixed(0)+'k'}},
          x:{grid:{display:false},ticks:{color:tickColor,maxRotation:45,font:{size:10}}}
        }
      }
    });
  }

  // Pie Chart: Distribusi Cost by Airlines
  const sjCost=filtered.filter(d=>(d.flightNumber||'').toUpperCase().startsWith('SJ')).reduce((s,d)=>s+(parseInt(d.qtyPax)||0)*(parseInt(d.costPerPax)||settings.costPerPax||300000),0);
  const inCost=filtered.filter(d=>(d.flightNumber||'').toUpperCase().startsWith('IN')).reduce((s,d)=>s+(parseInt(d.qtyPax)||0)*(parseInt(d.costPerPax)||settings.costPerPax||300000),0);
  const otherCost=totalCost-sjCost-inCost;
  const airlinePieData=[sjCost,inCost,otherCost].map(v=>Math.max(0,v));
  if(window._airlinesPieChart) window._airlinesPieChart.destroy();
  if(document.getElementById('chartCostAirlines') && airlinePieData.some(v=>v>0)){
    window._airlinesPieChart=new Chart(document.getElementById('chartCostAirlines'),{
      type:'pie',
      data:{
        labels:['Sriwijaya Air (SJ)','NAM Air (IN)','Lainnya'],
        datasets:[{data:airlinePieData,backgroundColor:['#2563eb','#f59e0b','#94a3b8'],borderWidth:2,borderColor:isDark?'#1e293b':'#fff'}]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{
          legend:{position:'bottom',labels:{color:tickColor,padding:10,font:{size:11}}},
          tooltip:{callbacks:{label:ctx=>{const total=airlinePieData.reduce((a,b)=>a+b,0);const pct=total?Math.round(ctx.parsed/total*100):0;return `${ctx.label}: ${ctx.parsed>=1000000?'Rp '+(ctx.parsed/1000000).toFixed(1)+'jt':formatRupiah(ctx.parsed)} (${pct}%)`;}}},
          datalabels:{display:true,color:'#fff',font:{size:10,weight:'bold'},formatter:(v)=>{const total=airlinePieData.reduce((a,b)=>a+b,0);const pct=total?Math.round(v/total*100):0;return v>0?`${pct}%`:'';}}
        }
      }
    });
  }

  // YoY & MoM — selalu pakai seluruh data (tidak terpengaruh filter Periode/Airlines)
  renderYoYMoM(isDark, gridColor, tickColor);
}

// Chart YoY (Year on Year) & MoM (Month on Month) — Home Dashboard
// Menggunakan variabel global `data` (seluruh data, tanpa filter periode/airlines)
window._yoyChart = window._yoyChart || null;
window._momChart = window._momChart || null;
function renderYoYMoM(isDark, gridColor, tickColor){
  const MONTH_NAMES=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // ---- YoY: jumlah flight per tahun ----
  const yearMap={};
  data.forEach(d=>{
    if(!d.tanggal) return;
    const y=d.tanggal.slice(0,4);
    if(!yearMap[y]) yearMap[y]={count:0,delay:0};
    yearMap[y].count+=1;
    yearMap[y].delay+=Math.max(0,d.delayMenit);
  });
  const years=Object.keys(yearMap).sort();
  const yoyCounts=years.map(y=>yearMap[y].count);
  // Pertumbuhan % dari tahun sebelumnya (untuk tooltip)
  const yoyGrowth=years.map((y,i)=>{
    if(i===0) return null;
    const prev=yearMap[years[i-1]].count;
    if(!prev) return null;
    return Math.round((yearMap[y].count-prev)/prev*100);
  });

  if(window._yoyChart) window._yoyChart.destroy();
  const yoyCanvas=document.getElementById('chartYoY');
  if(yoyCanvas && years.length){
    window._yoyChart=new Chart(yoyCanvas,{
      type:'bar',
      data:{
        labels:years,
        datasets:[{label:'Jumlah Flight per Tahun',data:yoyCounts,backgroundColor:'#7c3aed',borderRadius:6}]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{
          legend:{display:false},
          tooltip:{callbacks:{label:ctx=>{
            const g=yoyGrowth[ctx.dataIndex];
            const base=`Flight: ${ctx.parsed.y}`;
            return g===null ? base : `${base} (${g>=0?'+':''}${g}% vs tahun sebelumnya)`;
          }}},
          datalabels:{display:true,color:isDark?'#e2e8f0':'#1e293b',font:{size:10,weight:'bold'},anchor:'end',align:'top',formatter:(v,ctx)=>{
            const g=yoyGrowth[ctx.dataIndex];
            return g===null ? String(v) : `${v} (${g>=0?'+':''}${g}%)`;
          }}
        },
        scales:{
          y:{grid:{color:gridColor},ticks:{color:tickColor}},
          x:{grid:{display:false},ticks:{color:tickColor}}
        }
      }
    });
  }

  // ---- MoM: jumlah flight per bulan (12 bulan terakhir berdasarkan data, urut kronologis) ----
  const monthMap={};
  data.forEach(d=>{
    if(!d.tanggal) return;
    const ym=d.tanggal.slice(0,7); // YYYY-MM
    if(!monthMap[ym]) monthMap[ym]=0;
    monthMap[ym]+=1;
  });
  const sortedYm=Object.keys(monthMap).sort();
  const last12=sortedYm.slice(-12);
  const momLabels=last12.map(ym=>{const[y,m]=ym.split('-');return MONTH_NAMES[parseInt(m)-1]+' '+y.slice(2);});
  const momCounts=last12.map(ym=>monthMap[ym]);
  const momGrowth=last12.map((ym,i)=>{
    if(i===0) return null;
    const prev=monthMap[last12[i-1]];
    if(!prev) return null;
    return Math.round((monthMap[ym]-prev)/prev*100);
  });

  if(window._momChart) window._momChart.destroy();
  const momCanvas=document.getElementById('chartMoM');
  if(momCanvas && last12.length){
    window._momChart=new Chart(momCanvas,{
      type:'bar',
      data:{
        labels:momLabels,
        datasets:[{label:'Jumlah Flight per Bulan',data:momCounts,backgroundColor:'#0ea5e9',borderRadius:6}]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{
          legend:{display:false},
          tooltip:{callbacks:{label:ctx=>{
            const g=momGrowth[ctx.dataIndex];
            const base=`Flight: ${ctx.parsed.y}`;
            return g===null ? base : `${base} (${g>=0?'+':''}${g}% vs bulan sebelumnya)`;
          }}},
          datalabels:{display:true,color:isDark?'#e2e8f0':'#1e293b',font:{size:9,weight:'bold'},anchor:'end',align:'top',formatter:(v,ctx)=>{
            const g=momGrowth[ctx.dataIndex];
            return g===null ? String(v) : `${v} (${g>=0?'+':''}${g}%)`;
          }}
        },
        scales:{
          y:{grid:{color:gridColor},ticks:{color:tickColor}},
          x:{grid:{display:false},ticks:{color:tickColor,maxRotation:45,minRotation:30,font:{size:10}}}
        }
      }
    });
  }
}

// Dashboard PDF Export - Full screenshot capture
$('#btnDashPdf').addEventListener('click', async ()=>{
  const filtered=getDashboardData();
  if(!filtered.length) return showToast('Tidak ada data','error');

  showToast('⏳ Menyiapkan PDF Dashboard…','info');

  const dashSection = document.getElementById('tab-dashboard');
  const {jsPDF} = window.jspdf;
  const doc = new jsPDF({orientation:'portrait', unit:'pt', format:'a4'});
  const W = 595, margin = 20;

  // ── HEADER ──
  doc.setFillColor(29,78,216);
  doc.rect(0,0,W,68,'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(16); doc.setFont('helvetica','bold');
  doc.text('LAPORAN OPERASIONAL DELAY — Service Management SJNAM', W/2, 26, {align:'center'});
  doc.setFontSize(9); doc.setFont('helvetica','normal');
  const airlineLabel = $('#dashAirlineFilter') ? (['','Sriwijaya Air','NAM Air'][ ['','SJ','IN'].indexOf($('#dashAirlineFilter').value) ] || 'All Airlines') : 'All Airlines';
  doc.text(`Periode: ${$('#dashFrom').value||'-'} s/d ${$('#dashTo').value||'-'} | Airlines: ${airlineLabel}`, W/2, 42, {align:'center'});
  doc.text(`Generated: ${new Date().toLocaleString('id-ID')} | Total Flight: ${filtered.length}`, W/2, 56, {align:'center'});

  try {
    // Hide the no-print filter bar temporarily visible for capture
    const noprints = dashSection.querySelectorAll('.no-print');
    noprints.forEach(el=>el.style.display='none');

    // Capture all direct children (grids and cards) of dashboard section, skipping filter bar
    const captureEls = Array.from(dashSection.children).filter(el => !el.classList.contains('no-print'));
    
    const bgColor = document.documentElement.classList.contains('dark') ? '#1e293b' : '#ffffff';
    let yPos = 78;

    for(const el of captureEls) {
      if(!el || el.offsetHeight < 5) continue;
      try {
        const canvas = await html2canvas(el, {
          scale: 1.8,
          backgroundColor: bgColor,
          logging: false,
          useCORS: true
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.90);
        const imgW = W - margin*2;
        const imgH = (canvas.height / canvas.width) * imgW;

        if(yPos + imgH > 820) {
          doc.addPage();
          yPos = margin;
        }
        doc.addImage(imgData, 'JPEG', margin, yPos, imgW, imgH);
        yPos += imgH + 8;
      } catch(e2) {
        console.warn('Block capture error:', e2);
      }
    }

    // Restore no-print
    noprints.forEach(el=>el.style.display='');

  } catch(e) {
    console.warn('Dashboard capture failed:', e);
  }

  // Page numbers
  const totalPages = doc.getNumberOfPages();
  for(let i=1;i<=totalPages;i++){
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(148,163,184);
    doc.text(`Halaman ${i} / ${totalPages}  |  Service Management SJNAM  |  Confidential`, W/2, 832, {align:'center'});
  }

  doc.save(`Dashboard_SJNAM_${todayLocalStr()}.pdf`);
  showToast('✅ Dashboard PDF berhasil diexport','success');
});

// Dashboard Excel Export
$('#btnDashExcel').addEventListener('click',()=>{
  const filtered=getDashboardData();
  if(!filtered.length) return showToast('Tidak ada data','error');
  const rows = filtered.map((d,i)=>{
    const origin = getRouteOrigin(d.route);
    const tz = getStationTz(origin);
    const toLocal = (iso)=>{ if(!iso) return '-'; const dt=parseUTC(iso); const local=new Date(dt.getTime()+tz*3600000); return local.toISOString().substr(11,5); };
    return {
      No:i+1,DATE:formatDateDMY(d.tanggal),Flight:d.flightNumber,Route:d.route,
      STD:toLocal(d.stdUtc),ETD:toLocal(d.etdUtc),
      Delay_Min:d.delayMenit,Delay:formatHM(d.delayMenit),
      Status:d.flightStatus||'Delay Flight',Kategori:d.kategori,Approval:d.approval||'',
      Pax:d.qtyPax||0,Cost:((d.qtyPax||0)*(d.costPerPax||settings.costPerPax||300000))
    }
  });
  const totalPax = rows.reduce((s,r)=>s+(r.Pax||0),0);
  const totalCost = rows.reduce((s,r)=>s+(r.Cost||0),0);
  rows.push({No:'',DATE:'',Flight:'TOTAL',Route:'',STD:'',ETD:'',Delay_Min:'',Delay:'',Status:'',Kategori:'',Approval:'',Pax:totalPax,Cost:totalCost});
  const ws=XLSX.utils.json_to_sheet(rows);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Dashboard');

  // KPI sheet
  const totalDelayMinX=filtered.reduce((s,d)=>s+Math.max(0,d.delayMenit),0);
  const totalPaxKpi=filtered.reduce((s,d)=>s+(parseInt(d.qtyPax)||0),0);
  const totalCostKpi=filtered.reduce((s,d)=>s+(d.qtyPax||0)*(d.costPerPax||settings.costPerPax||300000),0);
  const monthlyMapX={};
  filtered.forEach(d=>{ if(!d.tanggal) return; const ym=d.tanggal.slice(0,7); if(!monthlyMapX[ym]) monthlyMapX[ym]=0; monthlyMapX[ym]+=Math.max(0,d.delayMenit); });
  const numMonthsX=Object.keys(monthlyMapX).length||1;
  const allDaysX=new Set(filtered.map(d=>d.tanggal).filter(Boolean));
  const wsKpi=XLSX.utils.json_to_sheet([
    {KPI:'Total Flight',Nilai:filtered.length},
    {KPI:'Avg Delay / Month (menit)',Nilai:Math.round(totalDelayMinX/numMonthsX)},
    {KPI:'Delay Tertinggi',Nilai:filtered.length?Math.max(...filtered.map(d=>d.delayMenit)):0},
    {KPI:'Cost / Month (Rp)',Nilai:Math.round(totalCostKpi/numMonthsX)},
    {KPI:'Cost / Day (Rp)',Nilai:Math.round(totalCostKpi/(allDaysX.size||1))},
    {KPI:'Total Cost PM89 (Rp)',Nilai:totalCostKpi},
    {KPI:'Total Pax',Nilai:totalPaxKpi},
    {KPI:'Flight Delay',Nilai:filtered.filter(d=>(d.flightStatus||'Delay Flight')==='Delay Flight').length},
    {KPI:'Flight Postponed',Nilai:filtered.filter(d=>d.flightStatus==='Postponed Flight').length},
    {KPI:'Flight Cancel',Nilai:filtered.filter(d=>d.flightStatus==='Cancel Flight').length},
  ]);
  XLSX.utils.book_append_sheet(wb,wsKpi,'KPI');
  XLSX.writeFile(wb,`Dashboard_SJNAM_${todayLocalStr()}.xlsx`);
  showToast('Dashboard Excel diexport (lokal + total)');
});

// =================================================================
// REQUEST APPROVAL
// =================================================================
function buildRequestText(d){
  if(!d) return 'Pilih data terlebih dahulu...';
  const origin=getRouteOrigin(d.route), dest=getRouteDest(d.route);
  const stdInfo=formatTimeLocal(d.stdUtc,origin);
  const etdInfo=formatTimeLocal(d.etdUtc,origin);
  const namaPenerima=$('#reqNamaPenerima').value||'Bapak Achmad Yani';
  const stationPenerima=$('#reqStationPenerima').value||'JKTCN';
  const namaPengirim=$('#reqNamaPengirim').value||'Errens Nussy';
  const jabatanPengirim=$('#reqJabatanPengirim').value||'CS Ground';
  const tzLabel=stdInfo.tz===7?'WIB':stdInfo.tz===8?'WITA':'WIT';
  return `No : ${d.id}
Kepada Yth,
${namaPenerima}
${stationPenerima}

Dengan Hormat,
Berikut Kami Kirimkan Permohonan Approval PM89 CIU Insurance
Untuk Rute Sebagai Berikut :

DATE                    : ${formatDateDMY(d.tanggal)}
Flight No                : ${esc(d.flightNumber)}
Route                    : ${esc(d.route)}
Flight Status            : ${d.flightStatus||'Delay Flight'}
STD (UTC)                : ${d.stdUtc.split('T')[1]} / ${stdInfo.local} ${tzLabel}
ETD (UTC)                : ${d.etdUtc.split('T')[1]} / ${etdInfo.local} ${tzLabel}
Delay                    : ${formatHM(d.delayMenit)}
Jumlah Pax               : ${d.qtyPax||'0'}
RL/OCL/Delay Notice      : ${d.about||'-'}
Keterangan               : ${d.keterangan||d.about||'-'}

Demikian disampaikan, atas perhatian dan kerjasamanya diucapkan terima kasih.

Salam,
${namaPengirim}
${jabatanPengirim}`;
}

function refreshRequestSelect(){
  const sel=$('#reqSelect');
  const filtered=getFilteredData();
  const search=($('#reqSearch')?.value||'').toLowerCase();
  let list=filtered;
  if(search){
    list=filtered.filter(d=> 
      d.flightNumber.toLowerCase().includes(search) ||
      d.route.toLowerCase().includes(search) ||
      formatDateDMY(d.tanggal).toLowerCase().includes(search)
    );
  }
  sel.innerHTML='<option value="">-- Pilih Flight ('+list.length+') --</option>'+
    list.map((d,i)=>`<option value="${d.id}">${i+1}. ${esc(d.flightNumber)} ${esc(d.route)} - ${formatDateDMY(d.tanggal)} (${formatHM(d.delayMenit)})</option>`).join('');
}
$('#reqSearch')?.addEventListener('input',refreshRequestSelect);

$('#reqSelect').addEventListener('change',e=>{
  const id=parseInt(e.target.value);
  const d=data.find(x=>x.id===id);
  $('#requestPreview').textContent=buildRequestText(d);
});
['reqNamaPenerima','reqStationPenerima','reqNamaPengirim','reqJabatanPengirim'].forEach(id=>{
  $('#'+id).addEventListener('input',()=>{
    const selId=parseInt($('#reqSelect').value, 10);
    if(selId){const d=data.find(x=>x.id===selId);$('#requestPreview').textContent=buildRequestText(d);}
  });
});
$('#btnAmbilNo').addEventListener('click',()=>{
  const no=parseInt($('#reqNo').value, 10);
  const filtered=getFilteredData();
  const d=filtered[no-1];
  if(d){$('#reqSelect').value=d.id;$('#requestPreview').textContent=buildRequestText(d);}
  else showToast('No tidak ditemukan','error');
});
$('#btnCopyRequest').addEventListener('click',()=>{
  const txt=$('#requestPreview').textContent;
  if(!txt||txt.includes('Pilih data')) return showToast('Belum ada data','error');
  navigator.clipboard.writeText(txt).then(()=>showToast('Disalin ke clipboard'));
});
$('#btnPrintRequest').addEventListener('click',()=>{
  const txt=$('#requestPreview').textContent;
  const w=window.open('','_blank');
  w.document.write(`<pre style="font-family:monospace;padding:2rem;font-size:13px">${txt}</pre>`);
  w.document.close(); w.print();
});
$('#btnWaRequest').addEventListener('click',()=>{
  const txt=$('#requestPreview').textContent;
  if(!txt||txt.includes('Pilih data')) return showToast('Belum ada data','error');
  window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
});

// =================================================================
// STATIONS
// =================================================================
function renderStations(){
  const tbody=$('#stationBody');
  const search=($('#searchStation').value||'').toLowerCase();
  let list=stations.slice().sort((a,b)=>(a.iata||'').localeCompare(b.iata||''));
  if(search) list=list.filter(s=>(s.iata||'').toLowerCase().includes(search)||(s.name||'').toLowerCase().includes(search));
  $('#stationCount').textContent=stations.length+' station';

  tbody.innerHTML=list.map(s=>{
    return `
    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <td class="px-3 py-2.5 font-mono font-bold text-sm">${s.iata}</td>
      <td class="px-3 py-2.5 text-sm">${esc(s.name)}</td>
      <td class="px-3 py-2.5"><span class="badge ${s.tz===7?'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300':s.tz===8?'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300':'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}">UTC+${s.tz}</span></td>
      <td class="px-3 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-300" data-station-tz="${s.tz}">--:--:--</td>
      <td class="px-3 py-2.5 text-center">
        <button data-st-edit="${s.iata}" class="text-blue-600 hover:underline text-xs mr-2">Edit</button>
        <button data-st-del="${s.iata}" class="text-red-600 hover:underline text-xs">Hapus</button>
      </td>
    </tr>
  `;}).join('')||`<tr><td colspan="5" class="py-8 text-center text-slate-500">Belum ada station</td></tr>`;

  // Langsung update jam setelah render agar tidak ada jeda --:--:--
  updateStationClocks();
}

$('#searchStation').addEventListener('input',renderStations);
$('#formStation').addEventListener('submit',e=>{
  e.preventDefault();
  const iata=$('#stIata').value.trim().toUpperCase();
  const name=$('#stName').value.trim();
  const tz=parseInt($('#stTz').value, 10);
  if(!/^[A-Z]{3}$/.test(iata)) return showToast('IATA harus 3 huruf','error');
  const idx=stations.findIndex(s=>s.iata===iata);
  if(idx>-1) stations[idx]={iata,name,tz};
  else stations.push({iata,name,tz});
  saveStations(); renderStations();
  $('#formStation').reset();
  showToast(`Station ${iata} disimpan`);
});
$('#btnResetStation').addEventListener('click',()=>$('#formStation').reset());
$('#stationBody').addEventListener('click',e=>{
  if(e.target.dataset.stEdit){
    const s=stations.find(x=>x.iata===e.target.dataset.stEdit);
    if(s){$('#stIata').value=s.iata;$('#stName').value=s.name;$('#stTz').value=s.tz;}
  }
  if(e.target.dataset.stDel){
    showConfirm('Hapus Station',`Hapus ${e.target.dataset.stDel}?`).then(ok=>{
      if(ok){stations=stations.filter(x=>x.iata!==e.target.dataset.stDel);saveStations();renderStations();showToast('Station dihapus');}
    });
  }
});

// =================================================================
// SETTINGS
// =================================================================
$('#defaultCostPerPax').addEventListener('change',e=>{settings.costPerPax=parseInt(e.target.value)||300000;saveSettings();showToast('Default cost diperbarui');});

$('#btnExportAllJson').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify({data,stations,dfsData,settings,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`sjn_backup_${todayLocalStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Backup diexport');
});
$('#fileImportAllJson').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file) return;
  try{
    const parsed=JSON.parse(await file.text());
    const ok=await showConfirm('Import Database','Ganti seluruh database? Data saat ini akan hilang!');
    if(ok){
      if(Array.isArray(parsed)) data=parsed;
      else if(parsed.data){
        data=parsed.data;
        if(parsed.stations) stations=parsed.stations;
        if(Array.isArray(parsed.dfsData)){ dfsData=parsed.dfsData; saveDfsData(); }
      }
      else throw new Error('Format tidak dikenali');
      saveData();saveStations();renderTable();renderDfsTable();showToast('Database dipulihkan');
    }
  }catch(err){showToast('File tidak valid: '+err.message,'error');}
  e.target.value='';
});
$('#btnResetDb').addEventListener('click',async()=>{
  const ok=await showConfirm('⚠️ Reset Database','SEMUA data dihapus permanen!');
  if(ok){data=[];saveData();renderTable();renderDashboard();showToast('Database direset');}
});

// =================================================================
// KEYBOARD SHORTCUTS
// =================================================================
document.addEventListener('keydown',e=>{
  // BUGFIX: ignore keyboard shortcuts when not logged in
  if(!window.currentUser) return;
  if(e.ctrlKey&&e.key==='s'){e.preventDefault();$('#btnSimpan').click();}
  if(e.ctrlKey&&e.key==='n'){e.preventDefault();resetForm();switchTab('input');}
  if(e.altKey&&e.key==='s'){e.preventDefault(); cloudPush().then(ok=>{ if(!ok) showToast('Sync gagal — cek koneksi','error'); else showToast('✅ Sync selesai','success').catch(err=>{ console.warn('[Sync]',err); }); }); /* BUGFIX: chain .then() untuk feedback user */ }
});

// [BUGFIX] Pre-declare block ini SEBELUMNYA berisi cloudConfig dan semua
// state cloud-sync (var cloudConfig, _cloudPullInProgress, dst). Setelah
// urutan load diubah jadi shared-utils.js DULU baru service-recovery.js
// (karena INIT di bawah memanggil banyak fungsi shared-utils.js secara
// sinkron — lihat catatan di bagian INIT), shared-utils.js SUDAH
// menginisialisasi semua var tsb sendiri via window.X=. Jika blok var
// lama tetap ada di sini, `var cloudConfig = {supabaseUrl:'',...}` akan
// MENIMPA BALIK nilai URL/key Supabase yang benar yang baru saja di-set
// oleh shared-utils.js — bug nyata yang ditemukan saat audit Tahap 3.
// Hanya _dirtyModules yang TETAP perlu dideklarasikan di sini, karena
// shared-utils.js tidak pernah mendeklarasikannya sendiri (hanya
// memakainya via referensi bebas di dalam markDirty/clearDirty/isDirty),
// dan saveData()/saveStations() di bawah membutuhkannya segera.
var _dirtyModules = new Set();

// [BUGFIX] saveData/saveStations/saveDfsData WAJIB didefinisikan di sini,
// SEBELUM blok "DEFAULT STATIONS" di bawah — karena blok itu memanggil
// saveStations() secara sinkron pada load pertama (saat localStorage kosong).
// Sebelumnya 3 fungsi ini didefinisikan jauh di bawah (setelah <script
// src="js/shared-utils.js">), menyebabkan "saveStations is not defined"
// ReferenceError yang membatalkan inisialisasi default stations secara diam-
// diam pada install pertama. markDirty/_auditSave/triggerAutoSync (yang
// dipanggil di dalam fungsi-fungsi ini) BELUM tentu sudah dimuat dari
// shared-utils.js pada titik ini — di-guard dengan typeof check agar aman;
// efeknya hanya melewatkan dirty-tracking/cloud-sync pada SATU pemanggilan
// pertama saat instalasi awal, yang tidak masalah karena belum ada user
// login / belum ada apa pun untuk di-sync pada titik ini.
// [BUGFIX] saveData/saveStations/saveDfsData WAJIB didefinisikan SEBELUM
// blok "DEFAULT STATIONS" di bawah, karena blok itu memanggil
// saveStations() secara sinkron pada load pertama (saat localStorage
// kosong). markDirty/_auditSave/triggerAutoSync (dipanggil di dalam
// fungsi ini) berasal dari shared-utils.js yang dimuat SETELAH file ini —
// di-guard dengan typeof check agar aman; efeknya hanya melewatkan
// dirty-tracking/cloud-sync pada SATU pemanggilan pertama saat instalasi
// awal, yang tidak masalah karena belum ada user login.
function saveData(){
  data = typeof stampArray==='function' ? stampArray(data, 'update') : data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  if(typeof markDirty==='function') markDirty('data');
  if(typeof _auditSave==='function') _auditSave('data', data);
  if(typeof triggerAutoSync==='function') triggerAutoSync('data');
}
function saveStations(){
  stations = typeof stampArray==='function' ? stampArray(stations, 'update') : stations;
  localStorage.setItem(STATIONS_KEY, JSON.stringify(stations));
  if(typeof markDirty==='function') markDirty('stations');
  if(typeof _auditSave==='function') _auditSave('stations', stations);
  if(typeof triggerAutoSync==='function') triggerAutoSync('stations');
  document.dispatchEvent(new CustomEvent('sjn:stations-updated'));
}
function saveDfsData(){
  dfsData = typeof stampArray==='function' ? stampArray(dfsData, 'update') : dfsData;
  localStorage.setItem(DFS_KEY, JSON.stringify(dfsData));
  if(typeof markDirty==='function') markDirty('dfsData');
  if(typeof _auditSave==='function') _auditSave('dfsData', dfsData);
  if(typeof triggerAutoSync==='function') triggerAutoSync('dfsData');
}

// =================================================================
// DEFAULT STATIONS
// =================================================================
if(stations.length===0){
  stations=[{"iata":"BTJ","name":"Banda Aceh Sultan Iskandar Muda","tz":7},{"iata":"SBG","name":"Sabang Maimun Saleh","tz":7},{"iata":"LSW","name":"Lhokseumawe Malikussaleh","tz":7},{"iata":"MEQ","name":"Nagan Raya Cut Nyak Dhien","tz":7},{"iata":"KNO","name":"Medan Kualanamu","tz":7},{"iata":"MES","name":"Medan Polonia","tz":7},{"iata":"SIW","name":"Sibisa Toba","tz":7},{"iata":"SQT","name":"Silangit Siborongborong","tz":7},{"iata":"DTB","name":"Sibolga Ferdinand Lumban Tobing","tz":7},{"iata":"AEG","name":"Padang Sidempuan Aek Godang","tz":7},{"iata":"GNS","name":"Gunungsitoli Binaka","tz":7},{"iata":"DUM","name":"Dumai Pinang Kampai","tz":7},{"iata":"PKU","name":"Pekanbaru Sultan Syarif Kasim II","tz":7},{"iata":"RGT","name":"Rengat Japura","tz":7},{"iata":"BTH","name":"Batam Hang Nadim","tz":7},{"iata":"TNJ","name":"Tanjung Pinang Raja Haji Fisabilillah","tz":7},{"iata":"TJB","name":"Tanjung Balai Karimun","tz":7},{"iata":"NTX","name":"Natuna Ranai","tz":7},{"iata":"PDG","name":"Padang Minangkabau","tz":7},{"iata":"DJB","name":"Jambi Sultan Thaha","tz":7},{"iata":"BKS","name":"Bengkulu Fatmawati","tz":7},{"iata":"PLM","name":"Palembang Sultan Mahmud Badaruddin II","tz":7},{"iata":"LLG","name":"Lubuklinggau Silampari","tz":7},{"iata":"PGK","name":"Pangkal Pinang Depati Amir","tz":7},{"iata":"TJQ","name":"Tanjung Pandan H.A.S. Hanandjoeddin","tz":7},{"iata":"TKG","name":"Bandar Lampung Radin Inten II","tz":7},{"iata":"CGK","name":"Jakarta Soekarno-Hatta","tz":7},{"iata":"HLP","name":"Jakarta Halim Perdanakusuma","tz":7},{"iata":"PCB","name":"Pondok Cabe","tz":7},{"iata":"BDO","name":"Bandung Husein Sastranegara","tz":7},{"iata":"KJT","name":"Kertajati Majalengka","tz":7},{"iata":"CBN","name":"Cirebon","tz":7},{"iata":"TSY","name":"Tasikmalaya","tz":7},{"iata":"CXP","name":"Cilacap Tunggul Wulung","tz":7},{"iata":"SRG","name":"Semarang Ahmad Yani","tz":7},{"iata":"SOC","name":"Solo Adisumarmo","tz":7},{"iata":"YIA","name":"Yogyakarta International","tz":7},{"iata":"JOG","name":"Yogyakarta Adisucipto","tz":7},{"iata":"SUB","name":"Surabaya Juanda","tz":7},{"iata":"MLG","name":"Malang Abdul Rachman Saleh","tz":7},{"iata":"SUP","name":"Sumenep Trunojoyo","tz":7},{"iata":"PNK","name":"Pontianak Supadio","tz":7},{"iata":"KTG","name":"Ketapang Rahadi Oesman","tz":7},{"iata":"SQG","name":"Sintang Susilo","tz":7},{"iata":"PKY","name":"Palangkaraya Tjilik Riwut","tz":7},{"iata":"PKN","name":"Pangkalan Bun Iskandar","tz":7},{"iata":"SMQ","name":"Sampit H. Asan","tz":7},{"iata":"DPS","name":"Denpasar Ngurah Rai","tz":8},{"iata":"LOP","name":"Lombok International","tz":8},{"iata":"AMI","name":"Mataram Selaparang","tz":8},{"iata":"SWQ","name":"Sumbawa Brangbiji","tz":8},{"iata":"BMU","name":"Bima Sultan Salahuddin","tz":8},{"iata":"KOE","name":"Kupang El Tari","tz":8},{"iata":"LBJ","name":"Labuan Bajo Komodo","tz":8},{"iata":"ENE","name":"Ende H. Hasan Aroeboesman","tz":8},{"iata":"MOF","name":"Maumere Wai Oti","tz":8},{"iata":"RTG","name":"Ruteng Frans Sales Lega","tz":8},{"iata":"TMC","name":"Tambolaka Waikabubak","tz":8},{"iata":"WGP","name":"Waingapu Mau Hau","tz":8},{"iata":"BDJ","name":"Banjarmasin Syamsudin Noor","tz":8},{"iata":"BTW","name":"Batulicin Bersujud","tz":8},{"iata":"BPN","name":"Balikpapan Sepinggan","tz":8},{"iata":"AAP","name":"Samarinda APT Pranoto","tz":8},{"iata":"TRK","name":"Tarakan Juwata","tz":8},{"iata":"BEJ","name":"Berau Kalimarau","tz":8},{"iata":"NNX","name":"Nunukan","tz":8},{"iata":"UPG","name":"Makassar Sultan Hasanuddin","tz":8},{"iata":"MDC","name":"Manado Sam Ratulangi","tz":8},{"iata":"KDI","name":"Kendari Haluoleo","tz":8},{"iata":"PLW","name":"Palu Mutiara SIS Al-Jufrie","tz":8},{"iata":"GTO","name":"Gorontalo Jalaluddin","tz":8},{"iata":"LUW","name":"Luwuk Syukuran Aminuddin Amir","tz":8},{"iata":"PSJ","name":"Poso Kasiguncu","tz":8},{"iata":"MJU","name":"Mamuju Tampa Padang","tz":8},{"iata":"TLI","name":"Tolitoli Lalos","tz":8},{"iata":"MNA","name":"Melonguane","tz":8},{"iata":"NAH","name":"Tahuna Naha","tz":8},{"iata":"TTR","name":"Toraja Pongtiku","tz":8},{"iata":"BUW","name":"Baubau Betoambari","tz":8},{"iata":"RAQ","name":"Raha Sugimanuru","tz":8},{"iata":"AMQ","name":"Ambon Pattimura","tz":9},{"iata":"TTE","name":"Ternate Sultan Babullah","tz":9},{"iata":"OTI","name":"Morotai Pitu","tz":9},{"iata":"LUV","name":"Tual Dumatubun","tz":9},{"iata":"DOB","name":"Dobo","tz":9},{"iata":"SXK","name":"Saumlaki Olilit","tz":9},{"iata":"NAM","name":"Namlea","tz":9},{"iata":"AHI","name":"Amahai","tz":9},{"iata":"DJJ","name":"Jayapura Sentani","tz":9},{"iata":"MKQ","name":"Merauke Mopah","tz":9},{"iata":"TIM","name":"Timika Mozes Kilangin","tz":9},{"iata":"BIK","name":"Biak Frans Kaisiepo","tz":9},{"iata":"SOQ","name":"Sorong Domine Eduard Osok","tz":9},{"iata":"MKW","name":"Manokwari Rendani","tz":9},{"iata":"FKQ","name":"Fakfak Torea","tz":9},{"iata":"KNG","name":"Kaimana Utarom","tz":9},{"iata":"NBX","name":"Nabire","tz":9},{"iata":"WMX","name":"Wamena","tz":9},{"iata":"OKL","name":"Oksibil","tz":9},{"iata":"TMH","name":"Tanah Merah","tz":9}];
  saveStations();
}

// =================================================================
// INIT
// =================================================================
// [BUGFIX] applyDarkMode() didefinisikan di shared-utils.js, yang dimuat
// SETELAH file ini (service-recovery.js) dalam urutan dokumen — guard
// dengan typeof check agar tidak ReferenceError di sini. Efeknya: dark
// mode belum diterapkan pada SATU frame render pertama saat load awal;
// shared-utils.js sendiri tidak memanggil applyDarkMode() ulang setelah
// load, jadi tambahkan pemanggilan susulan via auth.js's checkAuth()
// flow tidak diperlukan — applyPermissions di auth.js maupun listener
// toggle dark mode akan memanggil applyDarkMode() lagi pada interaksi
// pertama. Untuk render awal yang benar, beri sedikit delay via
// microtask agar shared-utils.js sempat selesai load dahulu.
if(typeof applyDarkMode==='function'){ applyDarkMode(); }
else { setTimeout(()=>{ if(typeof window.applyDarkMode==='function') window.applyDarkMode(); }, 0); }

// TOGGLE SORT TERBARU / TERLAMA
function updateSortButton(){
  const btn=$('#btnSortToggle');
  if(sortOrder==='asc'){
    btn.innerHTML='⬇️ Terlama';
    btn.title='Urut Jan → Des (klik untuk Terbaru)';
  } else {
    btn.innerHTML='⬆️ Terbaru';
    btn.title='Urut Des → Jan (klik untuk Terlama)';
  }
}
$('#btnSortToggle').addEventListener('click',()=>{
  sortOrder = sortOrder==='asc' ? 'desc' : 'asc';
  localStorage.setItem('delaySortOrder', sortOrder);
  updateSortButton();
  currentPage=1;
  renderTable();
  showToast(sortOrder==='asc' ? 'Urut: Terlama (Jan-Dec)' : 'Urut: Terbaru (Des-Jan)', 'info');
});
// Load saved preference
const savedSort = localStorage.getItem('delaySortOrder');
if(savedSort) sortOrder = savedSort;
updateSortButton();

$('#defaultCostPerPax').value=settings.costPerPax||300000;
$('#tanggal').value=todayLocalStr(); // BUGFIX: valueAsDate uses UTC which shows yesterday in WIB
$('#costPerPax').value=settings.costPerPax||300000;

// Dashboard default: 7 hari terakhir
const dashTo=new Date(), dashFrom=new Date();
dashFrom.setDate(dashTo.getDate()-6);
$('#dashFrom').value=dashFrom.toISOString().slice(0,10);
$('#dashTo').value=dashTo.toISOString().slice(0,10);
renderTable();
renderStations();
updatePreviews();
updateFlightHistory();

// Refresh station times every 60s
// Update Station TIME NOW every second
function updateStationClocks(){
  const now = new Date();
  const utcH=now.getUTCHours(), utcM=now.getUTCMinutes(), utcS=now.getUTCSeconds();
  const utcTotalSec = utcH*3600+utcM*60+utcS;
  const cells = document.querySelectorAll('[data-station-tz]');
  cells.forEach(cell => {
    const tz = parseInt(cell.dataset.stationTz);
    const localSec = (utcTotalSec + tz*3600) % 86400;
    const lH=Math.floor(localSec/3600);
    const lM=Math.floor((localSec%3600)/60);
    const lS=localSec%60;
    cell.textContent=String(lH).padStart(2,'0')+':'+String(lM).padStart(2,'0')+':'+String(lS).padStart(2,'0');
  });
}
setInterval(updateStationClocks, 1000);
setInterval(()=>{ if(document.getElementById('tab-stations')?.classList.contains('active')) renderStations(); },300000);

// PWA Service Worker inline - DINONAKTIFKAN untuk GitHub Pages (menghindari XLSX not defined)
// if('serviceWorker' in navigator){
//   const swCode=`
//     const CACHE='sjnam-v4';
//     const URLS=['./'];
//     self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(URLS))));
//     self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
//   `;
//   const blob=new Blob([swCode],{type:'application/javascript'});
//   const swUrl=URL.createObjectURL(blob);
//   navigator.serviceWorker.register(swUrl).catch(()=>{});
// }


// =================================================================
// DFS BANK — Daily Flight Schedule
// =================================================================
const DFS_KEY = 'sjn_dfs_bank_v1';
// var (bukan let) — lihat catatan di deklarasi data/stations/settings di atas.
var dfsData = [];
try { dfsData = JSON.parse(localStorage.getItem(DFS_KEY)||'[]'); } catch(e){ dfsData=[]; }

// saveDfsData original removed


function formatDfsDate(dateStr){
  if(!dateStr) return '-';
  // Input: "03 JUN 2026" → Output: "03-Jun-2026" (dd-Mmm-yyyy)
  try{
    const parts = dateStr.trim().split(' ');
    if(parts.length===3){
      const d = parts[0].padStart(2,'0');
      const m = parts[1].substring(0,3);
      const mCap = m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
      const y = parts[2]; // full year
      return `${d}-${mCap}-${y}`;
    }
  }catch(e){}
  return dateStr;
}

function dfsUtcToLocal(utcTime, originIata){
  // Converts UTC time string (HH:MM) to local time based on station timezone
  if(!utcTime) return '-';
  const tz = getStationTz(originIata);
  const [h,m] = utcTime.split(':').map(Number);
  if(isNaN(h)||isNaN(m)) return '-';
  let total = h*60 + m + tz*60;
  total = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(total/60)).padStart(2,'0');
  const mm = String(total%60).padStart(2,'0');
  const tzName = tz===7?'WIB':tz===8?'WITA':'WIT';
  return `${hh}:${mm} (${tzName})`;
}

let dfsCurrentPage = 1;
const dfsPAGE_SIZE = 100; // 100 rows per page — handles 1000+ with pagination

function renderDfsTable(){
  const search = ($('#dfsSearch')||{value:''}).value.toLowerCase().trim();
  const filterDate = ($('#dfsFilterDate')||{value:''}).value;
  const filterAirline = ($('#dfsFilterAirline')||{value:''}).value;
  
  // Support >1000 entries with pagination
  let filtered = dfsData.filter(f => {
    const matchSearch = !search ||
      f.flight.toLowerCase().includes(search) ||
      (f.route||'').toLowerCase().includes(search) ||
      (f.origin||'').toLowerCase().includes(search) ||
      (f.dest||'').toLowerCase().includes(search) ||
      formatDfsDate(f.date||'').toLowerCase().includes(search) ||
      (f.date||'').toLowerCase().includes(search);
    const matchDate = !filterDate || f.date === filterDate;
    const matchAirline = !filterAirline || f.flight.startsWith(filterAirline);
    return matchSearch && matchDate && matchAirline;
  });
  
  // Sort by date then flight
  filtered.sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.flight||'').localeCompare(b.flight||''));
  
  const tbody = $('#dfsTableBody');
  const empty = $('#dfsEmptyState');
  if(!tbody) return;
  
  if(filtered.length === 0){
    tbody.innerHTML = '';
    if(empty) empty.classList.remove('hidden');
    const pi = $('#dfsPaginationInfo'); if(pi) pi.textContent='';
    const pc = $('#dfsPaginationControls'); if(pc) pc.innerHTML='';
  } else {
    if(empty) empty.classList.add('hidden');
    
    const totalPages = Math.ceil(filtered.length / dfsPAGE_SIZE);
    if(dfsCurrentPage > totalPages) dfsCurrentPage = 1;
    const start = (dfsCurrentPage-1)*dfsPAGE_SIZE;
    const pageData = filtered.slice(start, start+dfsPAGE_SIZE);
    
    tbody.innerHTML = pageData.map(f => {
      const localTime = dfsUtcToLocal(f.std_utc, f.origin);
      const formattedDate = formatDfsDate(f.date);
      return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
        <td class="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">${formattedDate}</td>
        <td class="px-3 py-2 font-mono font-bold text-sm ${f.flight.startsWith('SJ')?'text-blue-700 dark:text-blue-400':'text-amber-700 dark:text-amber-400'}">${esc(f.flight)}</td>
        <td class="px-3 py-2 font-mono text-sm">${f.origin||''}-${f.dest||''}</td>
        <td class="px-3 py-2 font-mono text-sm font-semibold text-blue-700 dark:text-blue-400">${f.std_utc||'-'}</td>
        <td class="px-3 py-2 font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">${localTime}</td>
        <td class="px-3 py-2 text-xs text-slate-500">${f.ac_reg||'-'}</td>
        <td class="px-3 py-2 text-center">
          <button onclick='dfsApplyToInput(${JSON.stringify(f).replace(/"/g, "&quot;")})' class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition">Pakai</button>
        </td>
      </tr>
    `}).join('');
    
    // Pagination info
    const pi = $('#dfsPaginationInfo');
    if(pi) pi.textContent = `${start+1}–${Math.min(start+dfsPAGE_SIZE,filtered.length)} / ${filtered.length} flight`;
    
    // Pagination controls
    const pc = $('#dfsPaginationControls');
    if(pc){
      let pHtml = `<button ${dfsCurrentPage===1?'disabled':''} data-dfs-page="${dfsCurrentPage-1}" class="px-2.5 py-1.5 rounded-lg border text-xs disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700">‹</button>`;
      for(let p=Math.max(1,dfsCurrentPage-2);p<=Math.min(totalPages,dfsCurrentPage+2);p++){
        pHtml+=`<button data-dfs-page="${p}" class="px-2.5 py-1.5 rounded-lg border text-xs ${p===dfsCurrentPage?'bg-blue-600 text-white border-blue-600':'hover:bg-slate-100 dark:hover:bg-slate-700'}">${p}</button>`;
      }
      pHtml+=`<button ${dfsCurrentPage===totalPages?'disabled':''} data-dfs-page="${dfsCurrentPage+1}" class="px-2.5 py-1.5 rounded-lg border text-xs disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700">›</button>`;
      pc.innerHTML = pHtml;
      pc.onclick = (e)=>{ if(e.target.dataset.dfsPage){ dfsCurrentPage=parseInt(e.target.dataset.dfsPage); renderDfsTable(); } };
    }
  }
  
  // Update stats
  const dates = [...new Set(dfsData.map(f=>f.date))];
  const sjCount = dfsData.filter(f=>f.flight.startsWith('SJ')).length;
  const inCount = dfsData.filter(f=>f.flight.startsWith('IN')).length;
  if($('#dfsStatDates')) $('#dfsStatDates').textContent = dates.length;
  if($('#dfsStatFlights')) $('#dfsStatFlights').textContent = dfsData.length;
  if($('#dfsStatSJ')) $('#dfsStatSJ').textContent = sjCount;
  if($('#dfsStatIN')) $('#dfsStatIN').textContent = inCount;
  
  // Update date filter options
  const sel = $('#dfsFilterDate');
  if(sel){
    const curVal = sel.value;
    sel.innerHTML = '<option value="">Semua Tanggal</option>' + dates.sort().map(d=>`<option value="${d}" ${d===curVal?'selected':''}>${formatDfsDate(d)}</option>`).join('');
  }
}

function dfsApplyToInput(f){
  // Switch to input tab
  switchTab('input');
  // Set flight number
  if($('#flightNumber')) $('#flightNumber').value = f.flight;
  // Set route
  if($('#route')) {
    $('#route').value = f.route;
    const evt = new Event('input'); $('#route').dispatchEvent(evt);
  }
  // Set STD UTC
  if($('#stdUtc') && f.std_utc) {
    $('#stdUtc').value = f.std_utc;
    const evt = new Event('input'); $('#stdUtc').dispatchEvent(evt);
  }
  // Set date if available
  if($('#tanggal') && f.date){
    // f.date format: "03 JUN 2026"
    try {
      const months = {JAN:'01',FEB:'02',MAR:'03',APR:'04',MEI:'05',MAY:'05',JUN:'06',JUL:'07',AGU:'08',AUG:'08',SEP:'09',OKT:'10',OCT:'10',NOV:'11',DES:'12',DEC:'12'};
      const parts = f.date.split(' ');
      if(parts.length===3){
        const mon = months[parts[1].toUpperCase()]||'06';
        $('#tanggal').value = parts[2]+'-'+mon+'-'+parts[0].padStart(2,'0');
      }
    } catch(e){}
  }
  // Update DFS hint in step 2
  const localFromDfs = dfsUtcToLocal(f.std_utc, f.origin);
  const hint = $('#dfsHintStd');
  if(hint) hint.textContent = `DFS: ${esc(f.flight)} ${f.origin}-${f.dest} | Lokal: ${localFromDfs}`;
  updatePreviews();
  showToast('Data DFS dimuat: '+f.flight+' '+f.origin+'-'+f.dest+' STD UTC '+f.std_utc,'success');
}

// DFS Pick button in Step 2 - lookup STD UTC and local from DFS Bank
setTimeout(()=>{
  const btnPick = $('#btnPickFromDfs');
  if(btnPick){
    btnPick.addEventListener('click',()=>{
      const fltVal = ($('#flightNumber').value||'').trim().toUpperCase();
      const dateVal = ($('#tanggal').value||'');
      const routeVal = ($('#route').value||'').trim().toUpperCase().replace('-','');
      
      if(!fltVal && !routeVal){
        showToast('Isi Flight Number atau Route terlebih dahulu','warn');
        return;
      }
      
      let matches = dfsData.filter(f => {
        const fltMatch = !fltVal || f.flight === fltVal || f.flight.replace(/^(SJ|IN)/,'') === fltVal.replace(/^(SJ|IN)/,'');
        const routeMatch = !routeVal || f.route === routeVal || (f.origin+f.dest) === routeVal;
        return fltMatch || routeMatch;
      });
      
      // Filter by date if set
      if(dateVal && matches.length > 1){
        const dm = matches.filter(f => {
          try {
            const months = {JAN:'01',FEB:'02',MAR:'03',APR:'04',MEI:'05',MAY:'05',JUN:'06',JUL:'07',AGU:'08',AUG:'08',SEP:'09',OKT:'10',OCT:'10',NOV:'11',DES:'12',DEC:'12'};
            const parts = f.date.split(' ');
            if(parts.length===3){
              const mon = months[parts[1].toUpperCase()]||'06';
              return parts[2]+'-'+mon+'-'+parts[0].padStart(2,'0') === dateVal;
            }
          } catch(e){}
          return false;
        });
        if(dm.length > 0) matches = dm;
      }
      
      if(matches.length === 0){
        showToast('Flight tidak ditemukan di DFS Bank','warn');
        return;
      }
      
      if(matches.length > 1){
        // Multiple matches - show selection toast
        showToast(`Ditemukan ${matches.length} flight. Gunakan tombol Pakai di DFS Bank.`,'info');
        switchTab('dfs');
        if($('#dfsSearch')) { $('#dfsSearch').value = fltVal || routeVal; renderDfsTable(); }
        return;
      }
      
      const f = matches[0];
      if($('#stdUtc') && f.std_utc) {
        $('#stdUtc').value = f.std_utc;
        // Show converted local time hint
        const routeFromDfs = f.origin+f.dest;
        const originIata = f.origin;
        const localTime = dfsUtcToLocal(f.std_utc, originIata);
        const hint = $('#dfsHintStd');
        if(hint) hint.textContent = `DFS: ${esc(f.flight)} ${f.route} | UTC+lokal: ${localTime}`;
        updatePreviews();
        showToast(`STD UTC ${f.std_utc} (${localTime}) dari DFS Bank: ${esc(f.flight)}`,'success');
      }
      if($('#route') && !$('#route').value && f.route){
        $('#route').value = f.route;
        const evt = new Event('input'); $('#route').dispatchEvent(evt);
      }
    });
  }
}, 600);

// Update flight number input autocomplete from DFS Bank
function updateDfsAutocomplete(flightNum, date){
  if(!flightNum || flightNum.length < 4) return;
  const fltUp = flightNum.toUpperCase();
  // Find matching flights, filter by date if set
  let matches = dfsData.filter(f => f.flight === fltUp || f.flight.replace(/^(SJ|IN)/,'') === fltUp.replace(/^(SJ|IN)/,''));
  if(date) {
    const dateMatches = matches.filter(f => {
      try {
        const months = {JAN:'01',FEB:'02',MAR:'03',APR:'04',MEI:'05',MAY:'05',JUN:'06',JUL:'07',AGU:'08',AUG:'08',SEP:'09',OKT:'10',OCT:'10',NOV:'11',DES:'12',DEC:'12'};
        const parts = f.date.split(' ');
        if(parts.length===3){
          const mon = months[parts[1].toUpperCase()]||'06';
          const fDate = parts[2]+'-'+mon+'-'+parts[0].padStart(2,'0');
          return fDate === date;
        }
      } catch(e){}
      return false;
    });
    if(dateMatches.length > 0) matches = dateMatches;
  }
  if(matches.length === 1) {
    const f = matches[0];
    if($('#route') && !$('#route').value) {
      $('#route').value = f.route;
      const evt = new Event('input'); $('#route').dispatchEvent(evt);
    }
    if($('#stdUtc') && f.std_utc && !$('#stdUtc').value) {
      $('#stdUtc').value = f.std_utc;
      const evt = new Event('input'); $('#stdUtc').dispatchEvent(evt);
    }
    const localDfs = dfsUtcToLocal(f.std_utc, f.origin);
    const hint = $('#dfsHintStd');
    if(hint) hint.textContent = `DFS: ${esc(f.flight)} ${f.origin}-${f.dest} | Lokal: ${localDfs}`;
    showToast('DFS: '+f.flight+' '+f.origin+'-'+f.dest+' STD UTC '+f.std_utc,'info');
    updatePreviews();
  }
}

// Hook flight number input for DFS autocomplete
setTimeout(()=>{
  const fltInput = $('#flightNumber');
  if(fltInput){
    fltInput.addEventListener('blur', ()=>{
      const date = $('#tanggal') ? $('#tanggal').value : '';
      updateDfsAutocomplete(fltInput.value, date);
    });
  }
}, 500);

// Parse DFS Excel using XLSX library


function parseDfsExcel(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, {type:'array', cellDates:true});
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rows = XLSX.utils.sheet_to_json(ws, {header:1, raw:false, defval:'', dateNF:'HH:mm'});
        
        // === DETEKSI AIRLINE DARI NAMA FILE + OVERRIDE MANUAL ===
        const nameUp = file.name.toUpperCase();
        let forcePrefix = null;
        const override = (document.getElementById('dfsAirlineOverride')||{}).value || 'AUTO';
        if(override !== 'AUTO'){
          forcePrefix = override;
        } else {
          if(nameUp.includes('NAM') || nameUp.includes(' IN ') || nameUp.includes('_IN') || nameUp.includes('NAI') || /\bIN\b/.test(nameUp)){
            forcePrefix = 'IN';
          } else if(nameUp.includes('SJY') || nameUp.includes('SRIWIJAYA') || nameUp.includes('SRI ') || /\bSJ\b/.test(nameUp) || nameUp.includes('_SJ')){
            forcePrefix = 'SJ';
          }
        }
        // fallback: jika tidak ada, nanti pakai nomor flight
        
        // Extract date
        let flightDate = wsName;
        const dateMatch = wsName.match(/(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/i);
        if(dateMatch){
          flightDate = dateMatch[1].padStart(2,'0')+' '+dateMatch[2].toUpperCase()+' '+dateMatch[3];
        }
        
        const flights = [];
        
        function fmtTime(val){
          if(!val) return null;
          if(val instanceof Date){
            return String(val.getHours()).padStart(2,'0')+':'+String(val.getMinutes()).padStart(2,'0');
          }
          if(typeof val === 'string'){
            const m = val.match(/^(\d{1,2}):(\d{2})/);
            if(m) return m[1].padStart(2,'0')+':'+m[2];
            const num = Number(val);
            if(!isNaN(num) && num>0 && num<1){
              const total = Math.round(num*1440);
              return String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0');
            }
          }
          if(typeof val === 'number' && val>0 && val<1){
            const total = Math.round(val*1440);
            return String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0');
          }
          return null;
        }
        
        // DFS Excel STD column is in local time (WIB = UTC+7). Convert to UTC.
        function wibToUtc(wib, offsetMin){
          if(!wib) return null;
          offsetMin = offsetMin || 420; // default WIB = UTC+7
          const [h,m] = wib.split(':').map(Number);
          let t = h*60+m-offsetMin; if(t<0) t+=1440; if(t>=1440) t-=1440;
          return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
        }
        
        function utcToWib(utc){
          if(!utc) return null;
          const [h,m] = utc.split(':').map(Number);
          let t = h*60+m+420; if(t<0) t+=1440; if(t>=1440) t-=1440;
          return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
        }
        
        function getPrefix(num){
          const n = parseInt(String(num).replace(/\D/g,''));
          if(forcePrefix) return forcePrefix; // UTAMAKAN NAMA FILE
          return n >= 600 ? 'IN' : 'SJ';
        }
        
        for(let ri=0; ri<rows.length; ri++){
          const row = rows[ri];
          if(!row) continue;
          const etdIdx = row.findIndex(c => typeof c==='string' && c.trim().toUpperCase()==='ETD');
          if(etdIdx===-1) continue;
          const routeRow = rows[ri-2] || [];
          let acReg = '---';
          for(let k=0;k<6;k++){
            const v = routeRow[k];
            if(typeof v==='string' && /^[A-Z0-9]{3}$/.test(v.trim())){ acReg = v.trim(); break; }
          }
          
          for(let c=0; c<routeRow.length-2; c++){
            const origin = String(routeRow[c]||'').trim();
            const fltNum = routeRow[c+1];
            const dest = String(routeRow[c+2]||'').trim();
            
            if(/^[A-Z]{3}$/.test(origin) && /^[A-Z]{3}$/.test(dest) && fltNum!=='' && !isNaN(Number(String(fltNum).replace(/\D/g,'')))){
              const std_utc = fmtTime(row[c]) || fmtTime(row[c+1]) || fmtTime(row[c-1]);
              if(!std_utc) continue;
              const std_wib = utcToWib(std_utc);
              const fltStr = String(fltNum).split('.')[0].replace(/\D/g,'');
              const prefix = getPrefix(fltStr);
              const fullFlt = prefix + fltStr.padStart(3,'0');
              const route = origin+dest;
              const key = fullFlt+'|'+origin+'|'+dest+'|'+std_utc+'|'+flightDate;
              if(!flights.find(f=>f._key===key)){
                flights.push({_key:key, date:flightDate, ac_reg:acReg, flight:fullFlt, origin, dest, route, std_utc, std_wib, source:file.name});
              }
            }
          }
        }
        
        flights.forEach(f=>delete f._key);
        resolve({flights, date: flightDate, filename: file.name, forced: forcePrefix});
      } catch(err){ reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

$('#dfsFileInput').addEventListener('change', async(e)=>{
  const files = Array.from(e.target.files);
  if(!files.length) return;
  
  // Guard: pastikan XLSX library sudah load
  if(typeof XLSX === 'undefined'){
    showToast('Library XLSX belum siap. Refresh halaman dan coba lagi.','error');
    e.target.value='';
    return;
  }
  
  const statusEl = $('#dfsUploadStatus');
  statusEl.classList.remove('hidden');
  statusEl.textContent = 'Memproses '+files.length+' file...';
  
  let totalAdded = 0;
  let errors = [];
  
  for(const file of files){
    try {
      const {flights, date, filename, forced} = await parseDfsExcel(file);
      // Remove existing entries for same date to avoid duplicates
      dfsData = dfsData.filter(f => f.date !== date);
      dfsData.push(...flights);
      totalAdded += flights.length;
      statusEl.textContent = 'Berhasil: '+filename+' — '+flights.length+' flight legs ('+date+')'+(forced?' ['+forced+']':'');
    } catch(err){
      errors.push(file.name+': '+err.message);
    }
  }
  
  saveDfsData();
  renderDfsTable();
  
  if(errors.length){
    showToast('Error: '+errors[0],'error');
  } else {
    showToast('DFS dimuat: '+totalAdded+' flight legs','success');
    setTimeout(()=>statusEl.classList.add('hidden'), 3000);
  }
  e.target.value='';
});

$('#dfsSearch').addEventListener('input', ()=>{ dfsCurrentPage=1; renderDfsTable(); });
$('#dfsFilterDate').addEventListener('change', ()=>{ dfsCurrentPage=1; renderDfsTable(); });
$('#dfsFilterAirline').addEventListener('change', ()=>{ dfsCurrentPage=1; renderDfsTable(); });


$('#btnDfsExportExcel').addEventListener('click',()=>{
  if(!window.XLSX){ showToast('Library Excel belum dimuat, coba refresh halaman','error'); return; }
  if(!dfsData.length) return showToast('Tidak ada data DFS','error');
  const rows = dfsData.map((f,i)=>{
    const localRaw = dfsUtcToLocal(f.std_utc, f.origin); // e.g. "08:00 (WIB)"
    const tz = getStationTz(f.origin);
    const tzName = tz===7?'WIB':tz===8?'WITA':'WIT';
    const stationName = (stations.find(s=>s.iata===f.origin)||{}).name || f.origin;
    return {
      No:i+1,
      DATE:formatDfsDate(f.date),
      Flight:f.flight,
      Route:f.origin+'-'+f.dest,
      'Bank Station (Origin)':stationName + ' (UTC+'+tz+' '+tzName+')',
      STD_UTC:f.std_utc,
      STD_Local:localRaw.replace(/\s*\([^)]+\)/,''),
      AC_Reg:f.ac_reg||'',
      Source:f.source||''
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  // Auto column widths
  const colWidths = [{wch:5},{wch:13},{wch:8},{wch:9},{wch:30},{wch:8},{wch:10},{wch:9},{wch:25}];
  ws['!cols'] = colWidths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DFS Bank');
  XLSX.writeFile(wb, `DFS_Bank_${todayLocalStr()}.xlsx`);
  showToast('DFS Bank diexport ke Excel ('+rows.length+' rows)');
});

$('#btnDfsExportJson').addEventListener('click',()=>{
  const blob = new Blob([JSON.stringify(dfsData,null,2)],{type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'dfs_bank_backup.json';
  a.click();
  showToast('Backup DFS berhasil diunduh');
});

$('#btnDfsClearAll').addEventListener('click', async()=>{
  const ok = await showConfirm('Hapus DFS Bank','Semua data DFS akan dihapus permanen!');
  if(ok){ dfsData=[]; saveDfsData(); renderDfsTable(); showToast('DFS Bank dikosongkan'); }
});

renderDfsTable();

// (Kode cloud-sync Supabase sebelumnya ada di sini — dipindahkan ke
// js/shared-utils.js. Lihat REFACTOR_NOTES.md bagian "Tahap 3".)
