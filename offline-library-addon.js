// ICMPSR Offline Library add-on. Additive only: preserves existing online search and library workflows.
(function () {
  'use strict';
  const DB_NAME = 'icmpsr-offline-library';
  const DB_VERSION = 2;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let idbPromise;
  let installPrompt = null;

  function openLocalDB() {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const local = request.result;
        if (!local.objectStoreNames.contains('chunks')) {
          const store = local.createObjectStore('chunks', { keyPath: 'key' });
          store.createIndex('library_id', 'library_id', { unique: false });
          store.createIndex('document_id', 'document_id', { unique: false });
        }
        if (!local.objectStoreNames.contains('documents')) {
          const store = local.createObjectStore('documents', { keyPath: 'id' });
          store.createIndex('library_id', 'library_id', { unique: false });
        }
        if (!local.objectStoreNames.contains('settings')) {
          local.createObjectStore('settings', { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return idbPromise;
  }

  function activeLibrary() {
    if (typeof currentView === 'undefined' || currentView === 'proposals' || currentView === 'archive') return null;
    return currentView === 'private' ? privateLib : centralLib;
  }

  function setMessage(message, kind) {
    const node = $('offlineStatus');
    if (!node) return;
    node.textContent = message;
    node.className = 'status ' + (kind || '');
  }

  async function saveSessionContext() {
    if (!user || !centralLib) return;
    const context = {
      key: 'session-context',
      user_id: user.id,
      centralLib: { id: centralLib.id, library_type: centralLib.library_type },
      privateLib: privateLib ? { id: privateLib.id, library_type: privateLib.library_type, owner_id: privateLib.owner_id } : null,
      isAdmin: !!isAdmin,
      isTrainer: !!isTrainer,
      saved_at: new Date().toISOString()
    };
    await saveRows('settings', [context]);
  }

  async function restoreSessionContext() {
    if (navigator.onLine || !user || centralLib) return false;
    try {
      const local = await openLocalDB();
      const context = await new Promise((resolve, reject) => {
        const request = local.transaction('settings', 'readonly').objectStore('settings').get('session-context');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      if (!context || context.user_id !== user.id || !context.centralLib?.id) return false;
      centralLib = context.centralLib;
      privateLib = context.privateLib || null;
      isAdmin = !!context.isAdmin;
      isTrainer = !!context.isTrainer;
      if ($('rolePill')) $('rolePill').textContent = isAdmin ? 'إدارة المركز' : isTrainer ? 'مدرب' : 'حساب موثق';
      installUI();
      setMessage('تم فتح النسخة المحلية. بعض بيانات الحساب والإدارة تحتاج اتصالًا بالإنترنت؛ البحث المحلي متاح.', 'good');
      await updateLocalStats();
      return true;
    } catch (error) {
      console.warn('Could not restore offline session context:', error);
      return false;
    }
  }

  async function saveRows(storeName, rows) {
    const local = await openLocalDB();
    return new Promise((resolve, reject) => {
      const tx = local.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      rows.forEach(row => store.put(row));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function clearLibraryCache(libraryId) {
    const local = await openLocalDB();
    return new Promise((resolve, reject) => {
      const tx = local.transaction(['chunks', 'documents'], 'readwrite');
      for (const name of ['chunks', 'documents']) {
        const store = tx.objectStore(name);
        const index = store.index('library_id');
        const request = index.openKeyCursor(IDBKeyRange.only(libraryId));
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) { store.delete(cursor.primaryKey); cursor.continue(); }
        };
      }
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function downloadCurrentLibrary() {
    const library = activeLibrary();
    if (!library) { setMessage('اختر المكتبة المركزية أو مكتبتك الخاصة أولًا.', 'error'); return; }
    if (!navigator.onLine) { setMessage('اتصل بالإنترنت أولًا لتنزيل المراجع للاستخدام دون اتصال.', 'error'); return; }
    const sourceDocs = Array.isArray(docs) ? docs.slice() : [];
    const allowedDocs = sourceDocs.filter(doc =>
      doc && doc.library_id === library.id && doc.is_active !== false &&
      (library.library_type !== 'central' || doc.review_status === 'approved')
    );
    if (!allowedDocs.length) { setMessage('لا توجد مراجع متاحة للتنزيل في هذه المكتبة حاليًا.', 'error'); return; }

    const button = $('offlineDownloadBtn');
    button.disabled = true;
    try {
      await clearLibraryCache(library.id);
      const documentRows = allowedDocs.map(doc => ({
        id: doc.id, library_id: library.id, title: doc.title,
        authors: doc.authors || [], publication_year: doc.publication_year || null,
        language: doc.language || null, cached_at: new Date().toISOString()
      }));
      await saveRows('documents', documentRows);

      let totalChunks = 0;
      const chunkRows = [];
      for (let index = 0; index < allowedDocs.length; index++) {
        const doc = allowedDocs[index];
        let from = 0;
        while (true) {
          const to = from + 499;
          const { data, error } = await db.from('knowledge_document_chunks')
            .select('id,document_id,chunk_index,page_start,page_end,section_title,content')
            .eq('document_id', doc.id)
            .order('chunk_index', { ascending: true })
            .range(from, to);
          if (error) throw error;
          const rows = data || [];
          rows.forEach(chunk => chunkRows.push({
            key: doc.id + ':' + chunk.chunk_index,
            library_id: library.id,
            document_id: doc.id,
            title: doc.title,
            section_title: chunk.section_title || '',
            page_start: chunk.page_start,
            page_end: chunk.page_end,
            content: chunk.content || ''
          }));
          totalChunks += rows.length;
          from += rows.length;
          setMessage('جارٍ تنزيل المراجع: ' + (index + 1) + '/' + allowedDocs.length + ' — ' + totalChunks + ' مقطع');
          if (rows.length < 500) break;
        }
      }
      await saveRows('chunks', chunkRows);
      setMessage('اكتمل التنزيل: ' + allowedDocs.length + ' مرجع و' + totalChunks + ' مقطع. أصبحت متاحة للبحث دون إنترنت.', 'good');
      await updateLocalStats();
    } catch (error) {
      setMessage('تعذر تنزيل المكتبة: ' + (error.message || error), 'error');
    } finally {
      button.disabled = false;
    }
  }

  function normalize(text) {
    return String(text || '').toLocaleLowerCase()
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  }

  function highlightKeywords(value, terms) {
    const safe = esc(value);
    const keywords = [...new Set((terms || []).filter(term => term && term.length > 1))];
    if (!keywords.length) return safe;
    const pattern = new RegExp('(' + keywords.join('|') + ')', 'giu');
    return safe.replace(pattern, '<mark class="offline-keyword">$1</mark>');
  }

  async function getAllFromStore(storeName) {
    const local = await openLocalDB();
    return new Promise((resolve, reject) => {
      const request = local.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async function updateLocalStats() {
    try {
      const library = activeLibrary();
      if (!library) return;
      const rows = await getAllFromStore('chunks');
      const count = rows.filter(row => row.library_id === library.id).length;
      const docsLocal = await getAllFromStore('documents');
      const docCount = docsLocal.filter(row => row.library_id === library.id).length;
      const stat = $('offlineLocalStats');
      if (stat) stat.textContent = 'محفوظ على هذا الجهاز: ' + docCount + ' مرجع / ' + count + ' مقطع';
    } catch (_) {}
  }

  async function searchOffline() {
    const query = normalize($('offlineSearchInput').value);
    const resultBox = $('offlineSearchResults');
    if (!query) { resultBox.innerHTML = '<div class="empty">اكتب كلمة أو عبارة للبحث في المراجع المحفوظة.</div>'; return; }
    const library = activeLibrary();
    if (!library) { resultBox.textContent = 'اختر مكتبة صالحة أولًا.'; return; }

    const stopWords = new Set(['the','and','for','with','from','that','this','are','was','were','في','من','على','الى','إلى','عن','ما','هو','هي','هذا','هذه','ذلك','ثم','او','أو','كل']);
    const terms = [...new Set(query.split(/\s+/).filter(term => term.length > 1 && !stopWords.has(term)))];
    const rows = (await getAllFromStore('chunks')).filter(row => row.library_id === library.id);
    const scored = rows.map(row => {
      const title = normalize(row.title);
      const section = normalize(row.section_title);
      const content = normalize(row.content);
      const combined = title + ' ' + section + ' ' + content;
      const matched = terms.filter(term => combined.includes(term));
      if (!matched.length) return null;

      const titleMatches = terms.filter(term => title.includes(term)).length;
      const sectionMatches = terms.filter(term => section.includes(term)).length;
      const contentMatches = terms.filter(term => content.includes(term)).length;
      const phraseInTitle = query.length > 2 && title.includes(query);
      const phraseInSection = query.length > 2 && section.includes(query);
      const phraseInContent = query.length > 2 && content.includes(query);
      const coverage = matched.length / Math.max(terms.length, 1);

      let score = (titleMatches * 12) + (sectionMatches * 7) + (contentMatches * 2);
      if (phraseInTitle) score += 30;
      if (phraseInSection) score += 18;
      if (phraseInContent) score += 12;
      score += Math.round(coverage * 20);
      if (coverage < 1) score -= (1 - coverage) * 25;
      return { ...row, score, coverage, matchedCount: matched.length, normalizedContent: content };
    }).filter(Boolean).sort((a, b) =>
      b.score - a.score || b.coverage - a.coverage ||
      String(a.title).localeCompare(String(b.title))
    );

    const seen = new Set();
    const hits = [];
    for (const hit of scored) {
      const compact = hit.normalizedContent.replace(/\s+/g, ' ').slice(0, 500);
      const signature = hit.document_id + ':' + compact;
      if (seen.has(signature)) continue;
      seen.add(signature);
      hits.push(hit);
      if (hits.length === 15) break;
    }

    resultBox.innerHTML = hits.length ? hits.map(hit =>
      '<article class="doc"><div class="doc-head"><div><h4>' + highlightKeywords(hit.title, terms) + '</h4><div class="muted">' +
      highlightKeywords(hit.section_title || 'مقطع من المرجع', terms) + (hit.page_start ? ' · صفحة ' + esc(hit.page_start) : '') +
      '</div></div><span class="pill">' + hit.matchedCount + '/' + Math.max(terms.length, 1) + ' كلمات</span></div><p style="white-space:pre-wrap;line-height:1.9">' +
      highlightKeywords(hit.content.slice(0, 900), terms) + '</p></article>'
    ).join('') : '<div class="empty">لم نعثر على نتائج كافية الصلة. جرّب عبارة أدق أو كلمات أقل.</div>';
  }

  function installUI() {
    if (!$('app') || !$('toolbar') && !document.querySelector('.toolbar') || !$('knowledgeSearchResults')) return false;
    const toolbar = document.querySelector('.toolbar');
    if (!$('offlineDownloadBtn')) {
      const button = document.createElement('button');
      button.id = 'offlineDownloadBtn';
      button.type = 'button';
      button.className = 'btn light';
      button.textContent = 'تنزيل للاستخدام دون إنترنت';
      toolbar.appendChild(button);
      button.addEventListener('click', downloadCurrentLibrary);
    }
    if (!$('offlineKeywordStyle')) {
      const style = document.createElement('style');
      style.id = 'offlineKeywordStyle';
      style.textContent = '.offline-keyword{background:#ffe08a;color:#563900;padding:0 .16em;border-radius:.22em;font-weight:800;box-shadow:inset 0 -1px 0 #d3a53b}';
      document.head.appendChild(style);
    }
    if (!$('offlinePanel')) {
      const panel = document.createElement('section');
      panel.id = 'offlinePanel';
      panel.className = 'panel';
      panel.style.cssText = 'margin:12px 0;padding:14px;background:#f8fbfd';
      panel.innerHTML = '<h3>البحث المحلي دون إنترنت</h3><p class="muted">يبحث في المقاطع التي سبق تنزيلها على هذا الجهاز. لا تُرسل كلمات البحث إلى الخادم.</p><div class="toolbar"><input id="offlineSearchInput" type="search" placeholder="ابحث في المراجع المحفوظة..." aria-label="بحث محلي"><button id="offlineSearchBtn" class="btn">بحث محلي</button></div><div id="offlineLocalStats" class="muted"></div><div id="offlineStatus" class="status"></div><div id="offlineSearchResults"></div><div class="hint">تنبيه خصوصية: المراجع التي تنزّلها تُحفظ محليًا على هذا الجهاز. لا تستخدم التنزيل على جهاز مشترك أو عام، وسجّل الخروج بعد الانتهاء.</div>';
      $('knowledgeSearchResults').insertAdjacentElement('afterend', panel);
      $('offlineSearchBtn').addEventListener('click', searchOffline);
      $('offlineSearchInput').addEventListener('keydown', event => { if (event.key === 'Enter') searchOffline(); });
    }
    if (!$('installPwaBtn')) {
      const button = document.createElement('button');
      button.id = 'installPwaBtn';
      button.type = 'button';
      button.textContent = 'تثبيت التطبيق';
      button.className = 'btn light';
      button.style.cssText = 'margin-inline-start:8px';
      $('welcome').insertAdjacentElement('afterend', button);
      button.addEventListener('click', async () => {
        if (installPrompt) {
          installPrompt.prompt();
          await installPrompt.userChoice;
          installPrompt = null;
          button.classList.add('hidden');
        } else {
          setMessage('من قائمة المتصفح اختر «إضافة إلى الشاشة الرئيسية» أو «تثبيت التطبيق».');
        }
      });
    }
    updateLocalStats();
    return true;
  }

  async function registerPwa() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    try {
      await navigator.serviceWorker.register('./sw.js', { scope: './' });
    } catch (error) {
      console.warn('ICMPSR PWA registration failed:', error);
    }
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    const button = $('installPwaBtn');
    if (button) button.classList.remove('hidden');
  });

  window.addEventListener('online', () => setMessage('عاد الاتصال بالإنترنت. يمكنك تحديث المراجع المحفوظة.', 'good'));
  window.addEventListener('offline', () => setMessage('أنت الآن دون اتصال. البحث المحلي متاح للمراجع التي سبق تنزيلها.', 'good'));

  function wrapLoadDocs() {
    if (typeof loadDocs !== 'function' || window.__icmpsrOfflineWrapped) return;
    const original = loadDocs;
    loadDocs = async function () {
      const result = await original.apply(this, arguments);
      installUI();
      if (navigator.onLine) saveSessionContext().catch(error => console.warn('Offline context cache failed:', error));
      return result;
    };
    window.__icmpsrOfflineWrapped = true;
  }

  const observer = new MutationObserver(() => {
    if ($('app') && !$('app').classList.contains('hidden')) {
      wrapLoadDocs();
      installUI();
      if (!navigator.onLine) restoreSessionContext();
    }
  });
  observer.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class'] });
  if (document.readyState !== 'loading') { registerPwa(); wrapLoadDocs(); installUI(); }
  else document.addEventListener('DOMContentLoaded', () => { registerPwa(); wrapLoadDocs(); installUI(); });
})();