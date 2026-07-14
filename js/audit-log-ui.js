function toggleAuditPanel(){const panel=document.getElementById("auditPanel"),chevron=document.getElementById("auditPanelChevron");if(!panel)return;const isHidden=panel.classList.toggle("hidden");chevron&&(chevron.textContent=isHidden?"▼":"▲")}
var _auditEsc=window.esc||function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
async function loadAuditLog(){
  const container=document.getElementById("auditLogTable");
  if(!container)return;
  const firebaseReady="undefined"!=typeof window.SJNAM_CONFIG&&!!(window.SJNAM_CONFIG&&window.SJNAM_CONFIG.FIREBASE_PROJECT_ID);
  if(firebaseReady){
    container.innerHTML='<p class="text-slate-400 p-3 italic">Memuat...</p>';
    try{
      const moduleFilter=document.getElementById("auditModuleFilter")?.value||"";
      // [BUG DITEMUKAN & DIPERBAIKI] Sebelumnya query menggabungkan
      // where(module==X) DAN orderBy(created_at) sekaligus di server.
      // Firestore MEWAJIBKAN composite index manual untuk kombinasi
      // filter+urutkan seperti ini — index itu tidak pernah dibuat,
      // sehingga query ini SELALU GAGAL (400 FAILED_PRECONDITION) begitu
      // user memilih filter modul tertentu. Tanpa filter modul (whereField
      // kosong) query cuma pakai orderBy saja (index tunggal, otomatis
      // tersedia dari Firestore, makanya sebelumnya kelihatan baik-baik
      // saja). Sekarang: HANYA orderBy yang dikirim ke server (selalu
      // aman, tidak pernah butuh index manual), ambil batch lebih besar,
      // lalu filter modul & potong ke 50 teratas dilakukan di JS.
      const allLogs=await window.firestoreRunQuery("sjnam_audit_log",{
        orderByField:"created_at", desc:!0, limit:200
      });
      const logs=(moduleFilter?allLogs.filter(l=>l.module===moduleFilter):allLogs).slice(0,50);
      if(!logs||!logs.length)return void(container.innerHTML='<p class="text-slate-400 p-3 italic">Belum ada log. Pastikan sudah pernah push/pull minimal sekali.</p>');
      const actionColor={push:"text-blue-500",pull:"text-green-500",merge:"text-amber-500",create:"text-emerald-500",update:"text-slate-400",delete:"text-red-400",push_partial_fail:"text-red-600 font-bold"};
      container.innerHTML=`
      <table class="w-full text-xs">
        <thead><tr class="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
          <th class="text-left px-2 py-1.5">Waktu</th>
          <th class="text-left px-2 py-1.5">Aksi</th>
          <th class="text-left px-2 py-1.5">Modul</th>
          <th class="text-left px-2 py-1.5">Oleh</th>
          <th class="text-left px-2 py-1.5">Detail</th>
        </tr></thead>
        <tbody>
          ${logs.map(l=>`<tr class="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700">
            <td class="px-2 py-1.5 text-slate-400 whitespace-nowrap">${new Date(l.created_at).toLocaleString("id-ID",{hour12:!1,dateStyle:"short",timeStyle:"short"})}</td>
            <td class="px-2 py-1.5 font-semibold ${actionColor[l.action]||"text-slate-400"} whitespace-nowrap">${_auditEsc(l.action||"-")}</td>
            <td class="px-2 py-1.5 text-slate-500">${_auditEsc(l.module||"-")}</td>
            <td class="px-2 py-1.5 font-medium">${_auditEsc(l.changed_by||"-")}</td>
            <td class="px-2 py-1.5 text-slate-400 truncate max-w-32">${_auditEsc(l.detail||"-")}</td>
          </tr>`).join("")}
        </tbody>
      </table>`
    }catch(e){
      container.innerHTML='<p class="text-red-400 p-3 italic">Gagal memuat: '+e.message+"</p>"
    }
  }else container.innerHTML='<p class="text-red-400 p-3 italic">Cloud belum terhubung</p>'
}
async function _updateOfflineQueueBadge(){try{const items=await window.getOfflineQueueItems(),badge=document.getElementById("offlineQueueStatus"),count=document.getElementById("offlineQueueCount");if(!badge)return;items.length>0?(badge.classList.remove("hidden"),count&&(count.textContent="📴 "+items.length+" perubahan dalam antrian offline (belum terkirim)")):badge.classList.add("hidden")}catch(e){console.warn("[_updateOfflineQueueBadge]",e)}}
window.addEventListener("beforeunload",function(){if("undefined"!=typeof _autoSyncTimer&&_autoSyncTimer&&clearTimeout(_autoSyncTimer),window.currentUser)try{localStorage.setItem("sjnam_last_active",Date.now().toString())}catch(ex){}"function"==typeof cloudPush&&cloudPush(!0)}),setInterval(_updateOfflineQueueBadge,1e4),_updateOfflineQueueBadge();
