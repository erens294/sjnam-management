function toggleAuditPanel(){const panel=document.getElementById("auditPanel"),chevron=document.getElementById("auditPanelChevron");if(!panel)return;const isHidden=panel.classList.toggle("hidden");chevron&&(chevron.textContent=isHidden?"▼":"▲")}
async function loadAuditLog(){
  const container=document.getElementById("auditLogTable");
  if(!container)return;
  const neonReady="undefined"!=typeof window.SJNAM_CONFIG&&!!(window.SJNAM_CONFIG&&window.SJNAM_CONFIG.NEON_DATA_API_URL);
  if(neonReady){
    container.innerHTML='<p class="text-slate-400 p-3 italic">Memuat...</p>';
    try{
      const moduleFilter=document.getElementById("auditModuleFilter")?.value||"";
      const base=window.SJNAM_CONFIG.NEON_DATA_API_URL.replace(/\/$/,"");
      let q="select=*&order=created_at.desc&limit=50";
      moduleFilter&&(q+="&module=eq."+encodeURIComponent(moduleFilter));
      const res=await fetch(base+"/sjnam_audit_log?"+q,{headers:{"Accept":"application/json"}});
      if(!res.ok){let msg=res.status+" "+res.statusText;try{const t=await res.text();t&&(msg+=" - "+t)}catch(e){}throw new Error(msg)}
      const logs=await res.json();
      if(!logs||!logs.length)return void(container.innerHTML='<p class="text-slate-400 p-3 italic">Belum ada log. Pastikan tabel sjnam_audit_log sudah dibuat & role anonymous sudah di-GRANT akses di Neon.</p>');
      const actionColor={push:"text-blue-500",pull:"text-green-500",merge:"text-amber-500",create:"text-emerald-500",update:"text-slate-400",delete:"text-red-400"};
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
            <td class="px-2 py-1.5 font-semibold ${actionColor[l.action]||"text-slate-400"} whitespace-nowrap">${l.action||"-"}</td>
            <td class="px-2 py-1.5 text-slate-500">${l.module||"-"}</td>
            <td class="px-2 py-1.5 font-medium">${l.changed_by||"-"}</td>
            <td class="px-2 py-1.5 text-slate-400 truncate max-w-32">${l.detail||"-"}</td>
          </tr>`).join("")}
        </tbody>
      </table>`
    }catch(e){
      container.innerHTML='<p class="text-red-400 p-3 italic">Gagal memuat: '+e.message+". Pastikan tabel sjnam_audit_log sudah dibuat & GRANT ke role anonymous sudah dijalankan.</p>"
    }
  }else container.innerHTML='<p class="text-red-400 p-3 italic">Cloud belum terhubung</p>'
}
async function _updateOfflineQueueBadge(){try{const items=await window.getOfflineQueueItems(),badge=document.getElementById("offlineQueueStatus"),count=document.getElementById("offlineQueueCount");if(!badge)return;items.length>0?(badge.classList.remove("hidden"),count&&(count.textContent="📴 "+items.length+" perubahan dalam antrian offline (belum terkirim)")):badge.classList.add("hidden")}catch(e){console.warn("[_updateOfflineQueueBadge]",e)}}
window.addEventListener("beforeunload",function(){if("undefined"!=typeof _autoSyncTimer&&_autoSyncTimer&&clearTimeout(_autoSyncTimer),window.currentUser)try{localStorage.setItem("sjnam_last_active",Date.now().toString())}catch(ex){}"function"==typeof cloudPush&&cloudPush(!0)}),setInterval(_updateOfflineQueueBadge,1e4),_updateOfflineQueueBadge();
