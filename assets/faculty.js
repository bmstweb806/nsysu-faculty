(function () {
  'use strict';

  const root = document.getElementById('app');
  const params = new URLSearchParams(window.location.search);
  const lang = params.get('lang') === 'en' ? 'en' : 'zh';
  const otherLang = lang === 'en' ? 'zh' : 'en';
  const isPreview = document.body.dataset.preview === '1' || params.get('preview') === '1';
  const view = document.body.dataset.view === 'list' ? 'list' : 'detail';
  const text = lang === 'en' ? {
    loading: 'Loading faculty information…', empty: 'No published faculty information is available yet.',
    notFound: 'This faculty profile is not available.', error: 'Unable to load faculty information.',
    details: 'View profile', website: 'Official profile', email: 'Email', office: 'Office',
    expertise: 'Research interests', back: 'Faculty directory', link: 'Related link', photo: 'Faculty photograph',
    none: 'No further information is available.', preview: 'Preview — not the official published page',
    photoMissing: 'No photo', langTitle: 'Choose language', draft: 'Draft'
  } : {
    loading: '教師資料載入中…', empty: '目前尚無已發布的教師資料。',
    notFound: '找不到此教師，或此語言版本尚未公開。', error: '教師資料載入失敗。',
    details: '查看個人資料', website: '官方教師頁面', email: '電子郵件', office: '研究室',
    expertise: '研究專長', back: '教師列表', link: '相關連結', photo: '教師照片',
    none: '目前尚無其他資料。', preview: '測試預覽｜非正式教師頁面',
    photoMissing: '暫無照片', langTitle: '切換語言', draft: '草稿'
  };

  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant';
  const make = (tag, className, content) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content !== undefined && content !== null) el.textContent = String(content);
    return el;
  };
  const local = (obj) => obj && typeof obj === 'object' ? String(obj[lang] || '').trim() : '';
  const validUrl = (value) => {
    try {
      const u = new URL(value);
      return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : '';
    } catch (_) { return ''; }
  };
  const addExternal = (parent, url, label, className) => {
    const href = validUrl(url);
    if (!href) return;
    const a = make('a', className, label);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    parent.append(a);
  };
  const profileHref = (id) => {
    const href = new URL(isPreview ? 'preview.html' : 'faculty.html', window.location.href);
    href.searchParams.set('teacher', String(id));
    href.searchParams.set('lang', lang);
    return href.href;
  };
  const listHref = () => {
    const href = new URL('faculty-list.html', window.location.href);
    href.searchParams.set('lang', lang);
    if (isPreview) href.searchParams.set('preview', '1');
    return href.href;
  };
  const status = (message) => root.append(make('p', 'info-notice', message));
  const available = (teacher) =>
    Boolean(teacher && teacher.visible && teacher.visible[lang] === true && local(teacher.name)) &&
    (isPreview || teacher.publish_status === 'PUBLISHED');

  function languageToolbar() {
    const bar = make('div', 'toolbar');
    const choices = make('nav', 'language-switch');
    choices.setAttribute('aria-label', text.langTitle);
    [['zh', '中文'], ['en', 'English']].forEach((choice) => {
      const href = new URL(window.location.href);
      href.searchParams.set('lang', choice[0]);
      const a = make('a', '', choice[1]);
      a.href = href.href;
      if (choice[0] === lang) a.setAttribute('aria-current', 'page');
      choices.append(a);
    });
    bar.append(choices);
    root.append(bar);
  }

  function photo(teacher) {
    const url = validUrl(teacher.photo_url);
    const fallback = make('div', 'faculty-photo faculty-photo-fallback', text.photoMissing);
    if (!url) return fallback;
    const img = make('img', 'faculty-photo');
    img.src = url;
    img.alt = local(teacher.name) + ' — ' + text.photo;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => img.replaceWith(fallback), { once: true });
    return img;
  }

  function teacherEmail(parent, email) {
    const address = String(email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return;
    const row = make('p', 'faculty-contact');
    const a = make('a', '', address);
    a.href = 'mailto:' + address;
    row.append(a);
    parent.append(row);
  }

  function renderList(teachers) {
    if (!teachers.length) { status(text.empty); return; }
    const grid = make('div', 'faculty-list');
    teachers.forEach((t) => {
      const card = make('article', 'faculty-card');
      const photoLink = make('a');
      photoLink.href = profileHref(t.id);
      photoLink.setAttribute('aria-label', text.details + ': ' + local(t.name));
      photoLink.append(photo(t));
      const info = make('div', 'faculty-card-info');
      const heading = make('h2', 'faculty-name');
      const a = make('a', '', local(t.name));
      a.href = profileHref(t.id);
      heading.append(a);
      info.append(heading);
      if (local(t.name[otherLang]) && local(t.name[otherLang]) !== local(t.name)) {
        info.append(make('p', 'faculty-altname', String(t.name[otherLang])));
      }
      if (local(t.title)) info.append(make('p', 'faculty-title', local(t.title)));
      if (local(t.unit)) info.append(make('p', 'faculty-unit', local(t.unit)));
      if (local(t.expertise)) info.append(make('p', 'faculty-expertise', local(t.expertise)));
      teacherEmail(info, t.email);
      const links = make('div', 'faculty-links');
      addExternal(links, t.profile_url, text.website);
      if (links.children.length) info.append(links);
      card.append(photoLink, info);
      grid.append(card);
    });
    root.append(grid);
  }

  function renderEntry(entry, area) {
    const c = local(entry.content);
    const t = local(entry.title);
    if (entry.type === 'list_item') {
      const li = make('li', '', c || t);
      if (c && t && t !== c && !/^最高學歷$|^Highest Degree$/i.test(t)) {
        const head = make('strong', '', t + '：');
        li.prepend(head);
      }
      if (entry.url) {
        li.append(' ');
        addExternal(li, entry.url, text.link);
      }
      area.append(li);
    } else {
      const block = make('div', 'entry');
      if (t) block.append(make('p', 'entry-title', t));
      if (c) block.append(make('p', 'entry-content', c));
      if (entry.url) addExternal(block, entry.url, text.link, 'entry-link');
      area.append(block);
    }
  }

  function renderDetail(teacher, tabDefs) {
    const back = make('a', 'profile-back', (lang === 'en' ? '← ' : '← ') + text.back);
    back.href = listHref();
    root.append(back);
    const header = make('header', 'profile');
    header.append(photo(teacher));
    const info = make('div', 'profile-info');
    info.append(make('h1', 'profile-name', local(teacher.name)));
    if (String(teacher.name[otherLang] || '').trim()) {
      info.append(make('p', 'faculty-altname', String(teacher.name[otherLang])));
    }
    if (local(teacher.title)) info.append(make('p', 'faculty-title', local(teacher.title)));
    if (local(teacher.unit)) info.append(make('p', 'faculty-unit', local(teacher.unit)));
    if (local(teacher.office)) info.append(make('p', 'faculty-contact', text.office + ': ' + local(teacher.office)));
    teacherEmail(info, teacher.email);
    if (local(teacher.expertise)) {
      info.append(make('p', 'profile-expertise', text.expertise + ': ' + local(teacher.expertise)));
    }
    const links = make('div', 'faculty-links');
    addExternal(links, teacher.profile_url, text.website);
    if (links.children.length) info.append(links);
    header.append(info);
    root.append(header);

    const sections = Array.isArray(teacher.sections) ? teacher.sections : [];
    const visibleTabs = [...tabDefs]
      .sort((a, b) => Number(a.order) - Number(b.order))
      .map((def) => {
        const section = sections.find((s) => String(s.key) === String(def.key));
        const entries = (section && Array.isArray(section.entries) ? section.entries : [])
          .filter((e) => e && e.visible && e.visible[lang] === true && (local(e.content) || local(e.title)))
          .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
        return { key: def.key, title: local({ zh: def.zh, en: def.en }), entries };
      })
      .filter((tab) => tab.entries.length && tab.title);

    if (!visibleTabs.length) { status(text.none); return; }
    const tablist = make('div', 'tabs');
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-label', lang === 'en' ? 'Faculty information sections' : '教師資料分類');
    const panels = make('div');
    const buttons = [];

    visibleTabs.forEach((tab, i) => {
      const btn = make('button', 'tab-button', tab.title);
      btn.type = 'button';
      btn.id = 'faculty-tab-' + i;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-controls', 'faculty-panel-' + i);
      btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      btn.tabIndex = i === 0 ? 0 : -1;
      const panel = make('section', 'tab-panel');
      panel.id = 'faculty-panel-' + i;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', btn.id);
      panel.hidden = i !== 0;
      let list = null;
      tab.entries.forEach((e) => {
        if (e.type === 'list_item') {
          if (!list) { list = make('ul', 'entry-list'); panel.append(list); }
          renderEntry(e, list);
        } else {
          list = null;
          renderEntry(e, panel);
        }
      });
      buttons.push(btn);
      tablist.append(btn);
      panels.append(panel);
    });

    function activate(i, focus) {
      buttons.forEach((btn, k) => {
        const active = i === k;
        btn.setAttribute('aria-selected', String(active));
        btn.tabIndex = active ? 0 : -1;
        panels.children[k].hidden = !active;
      });
      if (focus) buttons[i].focus();
      scheduleHeight();
    }
    buttons.forEach((b, i) => b.addEventListener('click', () => activate(i, false)));
    tablist.addEventListener('keydown', (event) => {
      const current = buttons.indexOf(document.activeElement);
      if (current < 0) return;
      let next = current;
      if (event.key === 'ArrowRight') next = (current + 1) % buttons.length;
      else if (event.key === 'ArrowLeft') next = (current - 1 + buttons.length) % buttons.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = buttons.length - 1;
      else return;
      event.preventDefault();
      activate(next, true);
    });
    root.append(tablist, panels);
  }

  let lastHeight = -1;
  let scheduled = false;
  function sendHeight() {
    scheduled = false;
    if (window.parent === window) return;
    const elements = [...document.body.children].filter((node) => node.tagName !== 'SCRIPT');
    const bottom = elements.reduce((n, el) =>
      Math.max(n, el.getBoundingClientRect().bottom + window.scrollY), 0);
    const height = Math.ceil(bottom + 16);
    if (height < 100 || height === lastHeight) return;
    lastHeight = height;
    window.parent.postMessage({ type: 'NSYSU_FACULTY_HEIGHT', height }, '*');
  }
  function scheduleHeight() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sendHeight);
  }
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(scheduleHeight);
    observer.observe(root);
    observer.observe(document.body);
  }
  window.addEventListener('resize', scheduleHeight);
  window.addEventListener('load', scheduleHeight);

  async function init() {
    root.replaceChildren();
    languageToolbar();
    status(text.loading);
    try {
      const response = await fetch(isPreview ? './data/faculty-preview.json' : './data/faculty.json',
        { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const json = await response.json();
      if (!json || Number(json.schema_version) !== 3 || !Array.isArray(json.teachers) || !Array.isArray(json.tabs)) {
        throw new Error('V3 schema mismatch');
      }
      if (Boolean(json.preview) !== isPreview) throw new Error('Preview/production mismatch');
      root.replaceChildren();
      languageToolbar();
      const teachers = json.teachers.filter(available).sort((a, b) =>
        Number(a.display_order || 0) - Number(b.display_order || 0));
      if (view === 'list') {
        renderList(teachers);
      } else {
        const id = String(params.get('teacher') || '').trim();
        const teacher = teachers.find((t) => String(t.id) === id);
        if (!teacher) status(text.notFound);
        else renderDetail(teacher, json.tabs);
      }
    } catch (error) {
      root.replaceChildren();
      languageToolbar();
      status(text.error + (isPreview ? ' (' + error.message + ')' : ''));
    }
    scheduleHeight();
  }
  init();
})();
