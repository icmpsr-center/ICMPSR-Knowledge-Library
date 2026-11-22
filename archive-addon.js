// ICMPSR Knowledge Library - additive archive controls. Does not replace upload or parsing code.
(function(){
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function install(){
    if(!window.db || typeof loadDocs !== 'function' || !user || !centralLib) return false;
    const tabs=document.querySelector('.tabs'); if(!tabs) return false;
    if(!document.querySelector('[data-view="archive"]')){
      const b=document.createElement('button'); b.className='tab'; b.dataset.view='archive'; b.textContent='الأرشيف';
      tabs.appendChild(b);
      b.addEventListener('click',async()=>{
        document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));
        currentView='archive'; $('formTitle').textContent='أرشيف المراجع';
        $('uploadForm').classList.add('hidden'); $('docList').innerHTML='<div class="empty">جارٍ تحميل الأرشيف...</div>';
        await loadDocs();
      });
    }
    if(!window.__icmpsrArchiveWrapped){
      const originalLoadDocs=loadDocs;
      loadDocs=async function(){
        if(currentView!=='archive') return originalLoadDocs();
        let q=db.from('knowledge_documents').select('*').eq('review_status','archived').order('created_at',{ascending:false}).limit(200);
        if(!isAdmin){ if(!privateLib){docs=[]; $('docList').innerHTML='<div class="empty">لا توجد مكتبة خاصة بهذا الحساب.</div>';return;} q=q.eq('library_id',privateLib.id); }
        const {data,error}=await q;
        if(error){ status('listStatus','تعذر تحميل الأرشيف: '+error.message,'error');return; }
        docs=data||[]; renderArchive();
      };
      const originalRenderDocs=renderDocs;
      renderDocs=function(){
        if(currentView==='archive') return renderArchive();
        originalRenderDocs();
        const q=$('search').value.trim().toLowerCase();
        const shown=docs.filter(d=>!q||[d.title,d.title_original,d.specialty,(d.authors||[]).join(' '),d.extracted_text].join(' ').toLowerCase().includes(q));
        const cards=$('docList').querySelectorAll('article.doc');
        cards.forEach((card,i)=>{
          const d=shown[i]; if(!d || !(isAdmin || d.library_id===privateLib?.id)) return;
          if(!card.querySelector('[data-archive]')){
            const b=document.createElement('button'); b.className='btn danger'; b.dataset.archive=d.id; b.textContent='أرشفة';
            card.querySelector('.doc-actions')?.appendChild(b);
          }
        });
      };
      $('docList').addEventListener('click',async e=>{
        const b=e.target.closest('button[data-archive],button[data-restore]'); if(!b)return;
        e.preventDefault(); e.stopImmediatePropagation();
        const d=docs.find(x=>x.id===(b.dataset.archive||b.dataset.restore)); if(!d)return;
        if(b.dataset.archive){
          if(!confirm('سيُنقل المرجع إلى الأرشيف مع الاحتفاظ بالملف الأصلي. هل تريد المتابعة؟'))return;
          const {error}=await db.from('knowledge_documents').update({review_status:'archived',is_active:false}).eq('id',d.id);
          status('listStatus',error?'تعذرت الأرشفة: '+error.message:'تمت أرشفة المرجع مع الاحتفاظ بالملف الأصلي.',''+(error?'error':'good'));
        } else {
          const restoredStatus=d.library_id===centralLib.id?'approved':'pending';
          const {error}=await db.from('knowledge_documents').update({review_status:restoredStatus,is_active:true}).eq('id',d.id);
          status('listStatus',error?'تعذرت الاستعادة: '+error.message:'تمت استعادة المرجع من الأرشيف.',''+(error?'error':'good'));
        }
        await loadDocs();
      },true);
      window.__icmpsrArchiveWrapped=true;
    }
    return true;
  }
  function renderArchive(){
    const q=$('search').value.trim().toLowerCase();
    const shown=docs.filter(d=>!q||[d.title,d.title_original,d.specialty,(d.authors||[]).join(' '),d.extracted_text].join(' ').toLowerCase().includes(q));
    $('countDocs').textContent=docs.length;
    $('docList').innerHTML=shown.length?shown.map(d=>`<article class="doc"><div class="doc-head"><div><h4>${esc(d.title)}</h4><div class="muted">${esc((d.authors||[]).join('، ')||'المؤلف غير محدد')} ${d.publication_year||''}</div><div class="muted">${esc(d.document_type||'')} · ${esc(d.publisher||'')}</div></div><span class="pill">مؤرشف</span></div><div class="muted">الملف الأصلي محفوظ كما هو · ${esc(d.processing_status||'')}</div><div class="doc-actions">${d.storage_path?`<button class="btn light" data-open="${d.id}">فتح الملف</button>`:''}${d.source_url?`<button class="btn light" data-url="${esc(d.source_url)}">فتح الرابط</button>`:''}${(isAdmin||d.library_id===privateLib?.id)?`<button class="btn light" data-restore="${d.id}">استعادة من الأرشيف</button>`:''}</div></article>`).join(''):'<div class="empty">الأرشيف فارغ حاليًا.</div>';
  }
  const observer=new MutationObserver(()=>{if($('app')&&!$('app').classList.contains('hidden')&&install())observer.disconnect();});
  observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});
  if(document.readyState!=='loading') install(); else document.addEventListener('DOMContentLoaded',install);
})();
