/* Admin panel: block editor for data/content.json with live preview and GitHub publishing. */
(function () {
  'use strict';
  const { esc, icon } = window.NZ;
  const $ = (s, r = document) => r.querySelector(s);

  /* ================= schema ================= */
  const COLORS = ['default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];
  const F = {
    text: (k, label, ph) => ({ k, t: 'text', label, ph }),
    area: (k, label, ph) => ({ k, t: 'textarea', label, ph }),
    url: (k = 'url', label = 'Link') => ({ k, t: 'url', label, ph: 'https://…  or  /page  or  /#section' }),
    icon: (k = 'icon', label = 'Icon') => ({ k, t: 'icon', label, ph: '🚀  or  si:github  or  assets/…png' }),
    image: (k, label = 'Image') => ({ k, t: 'image', label, ph: 'assets/images/…  or  https://…' }),
    color: (k = 'color', label = 'Color') => ({ k, t: 'select', label, opts: COLORS }),
    select: (k, label, opts) => ({ k, t: 'select', label, opts }),
    check: (k, label) => ({ k, t: 'check', label }),
    num: (k, label) => ({ k, t: 'number', label }),
  };
  const MD = 'Supports **bold**, *italic*, `code`, [link](url). Blank line = new paragraph.';

  const SCHEMA = {
    text: { label: 'Text', glyph: '¶', fields: [F.area('text', 'Text', MD), F.color('color', 'Text color')] },
    h1: { label: 'Heading 1', glyph: 'H1', fields: [F.text('text', 'Heading')] },
    h2: { label: 'Heading 2', glyph: 'H2', fields: [F.text('text', 'Heading')] },
    h3: { label: 'Heading 3', glyph: 'H3', fields: [F.text('text', 'Heading')] },
    bullets: { label: 'List', glyph: '•', fields: [F.area('text', 'Items', 'One item per line'), F.check('ordered', 'Numbered list')] },
    callout: { label: 'Callout', glyph: '💡', fields: [F.icon(), F.color('color', 'Background'), F.area('text', 'Text', MD)] },
    quote: { label: 'Quote', glyph: '❝', fields: [F.area('text', 'Quote', MD), F.text('author', 'Author')] },
    toggle: { label: 'Toggle', glyph: '▸', fields: [F.text('title', 'Title'), F.area('text', 'Hidden content', MD), F.check('open', 'Open by default')] },
    divider: { label: 'Divider', glyph: '—', fields: [] },
    image: { label: 'Image', glyph: '🖼', fields: [F.image('src'), F.text('caption', 'Caption'), F.select('width', 'Width', ['full', 'medium', 'small'])] },
    button: { label: 'Button', glyph: '⏺', fields: [F.text('label', 'Label'), F.url(), F.icon()] },
    links: { label: 'Link cards', glyph: '🔗', items: [F.icon(), F.text('label', 'Label'), F.text('desc', 'Subtitle'), F.url()] },
    cards: { label: 'Icon cards', glyph: '▦', fields: [F.select('columns', 'Columns', ['2', '3', '4'])], items: [F.icon(), F.text('title', 'Title'), F.area('desc', 'Description'), F.url()] },
    gallery: { label: 'Gallery', glyph: '🗂', fields: [F.select('columns', 'Columns', ['1', '2', '3'])], items: [F.image('image', 'Cover image'), F.text('title', 'Title'), F.text('desc', 'Description'), F.text('tags', 'Tags', 'comma, separated'), F.url()] },
    badges: { label: 'Badges', glyph: '🏷', items: [F.text('label', 'Label'), F.color(), F.url()] },
    inline: { label: 'Inline links', glyph: '↔', items: [F.icon(), F.text('label', 'Label'), F.url()] },
    timeline: { label: 'Timeline', glyph: '⏱', items: [F.text('date', 'Date', '2024 — 2025'), F.text('title', 'Title'), F.text('subtitle', 'Subtitle'), F.area('text', 'Description')] },
    progress: { label: 'Skill bars', glyph: '▬', items: [F.text('label', 'Skill'), F.num('value', 'Percent')] },
    form: { label: 'Contact form', glyph: '✉', fields: [F.text('button', 'Button text', 'Send message'), F.text('success', 'Message after sending', 'Thanks! Your message has been sent.')] },
  };

  const SITE_FIELDS = [
    F.text('title', 'Site title (browser tab / SEO)'),
    F.area('description', 'SEO description'),
    F.url('url', 'Site URL (for sitemap & share links)'),
    F.image('image', 'Share image (shown in Telegram / social previews)'),
    F.icon('brandIcon', 'Navbar icon'),
    F.text('brandText', 'Navbar text'),
    F.select('defaultTheme', 'Default theme', ['dark', 'light']),
    F.area('footer', 'Footer', MD + ' {year} = current year.'),
  ];
  const NAV_FIELDS = [F.text('label', 'Label'), F.url(), F.check('highlight', 'Highlighted button')];
  const PAGE_FIELDS = [
    F.text('title', 'Title'),
    F.icon('icon', 'Page icon (emoji or photo)'),
    { k: 'cover', t: 'image', label: 'Cover image', ph: 'empty = animated gradient,  none = no cover' },
    F.area('description', 'SEO description'),
    F.check('hideTitle', 'Hide title'),
  ];

  const blank = (type) => {
    const s = SCHEMA[type];
    const b = { type };
    (s.fields || []).forEach((f) => (b[f.k] = f.t === 'check' ? false : f.t === 'select' ? f.opts[f.k === 'color' ? 0 : 0] : ''));
    if (type === 'cards') b.columns = '3';
    if (type === 'gallery') b.columns = '2';
    if (type === 'callout') { b.icon = '💡'; b.color = 'gray'; }
    if (s.items) b.items = [blankItem(type)];
    return b;
  };
  const blankItem = (type) => {
    const it = {};
    SCHEMA[type].items.forEach((f) => (it[f.k] = f.t === 'check' ? false : f.t === 'number' ? 50 : f.t === 'select' ? f.opts[0] : ''));
    return it;
  };

  /* ================= state ================= */
  const DRAFT_KEY = 'nz-draft';
  const GH_KEY = 'nz-gh';
  let content = null;
  let baseSha = null; // sha of content.json the draft is based on (when loaded from GitHub)
  let dirty = false;
  let view = 'page:'; // "site" | "page:<slug>"
  const collapsed = new Set();
  let openProps = null; // page whose properties panel starts expanded (a freshly created one)
  const overrides = {}; // uploaded-but-not-yet-deployed images → blob URLs for the preview

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('Could not save draft locally: ' + e.message, 'err'); } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };

  const pageIndex = () => content.pages.findIndex((p) => 'page:' + (p.slug || '') === view);

  /* path helpers: "pages.0.blocks.2.items.1.label" */
  const getAt = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), content);
  function setAt(path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const obj = keys.reduce((o, k) => o[k], content);
    obj[last] = value;
  }

  /* ================= rendering: editor ================= */
  function renderSidebar() {
    $('#page-list').innerHTML = content.pages
      .map((p, i) => {
        const v = 'page:' + (p.slug || '');
        return `<button class="a-side-item${view === v ? ' active' : ''}" data-act="open" data-target="${esc(v)}">
          <span class="a-side-ico">${icon(p.icon || '📄', 'side-ico')}</span><span>${esc(p.title || 'Untitled')}</span>
          <small>/${esc(p.slug || '')}</small></button>`;
      })
      .join('');
    document.querySelectorAll('.a-side-item[data-target="site"]').forEach((el) => el.classList.toggle('active', view === 'site'));
  }

  function field(f, path, value) {
    const id = 'f-' + path.replace(/\./g, '-');
    const p = esc(path);
    const ph = f.ph ? ` placeholder="${esc(f.ph)}"` : '';
    let input;
    switch (f.t) {
      case 'textarea':
        input = `<textarea id="${id}" data-path="${p}" rows="${Math.min(10, Math.max(2, String(value ?? '').split('\n').length + 1))}"${ph}>${esc(value)}</textarea>`;
        break;
      case 'select':
        input = `<select id="${id}" data-path="${p}">${f.opts.map((o) => `<option${String(value ?? '') === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
        break;
      case 'check':
        return `<label class="a-check"><input type="checkbox" data-path="${p}"${value ? ' checked' : ''}> ${esc(f.label)}</label>`;
      case 'number':
        input = `<input id="${id}" type="number" min="0" max="100" data-path="${p}" value="${esc(value)}">`;
        break;
      case 'icon':
      case 'image':
        input = `<div class="a-media"><span class="a-thumb" data-thumb="${p}" data-kind="${f.t}">${thumb(value, f.t)}</span>
          <input id="${id}" data-path="${p}" value="${esc(value)}"${ph}>
          <button type="button" class="a-mini" data-act="upload" data-path="${p}" title="Upload image to GitHub">⬆</button></div>`;
        break;
      default:
        input = `<input id="${id}" data-path="${p}" value="${esc(value)}"${ph}${f.t === 'url' ? ' spellcheck="false"' : ''}>`;
    }
    return `<label class="a-field" for="${id}"><span>${esc(f.label)}</span>${input}</label>`;
  }
  const thumb = (v, t) => (v ? icon(overrides[v] || v, 'a-thumb-ico') : t === 'image' ? '<span class="muted">—</span>' : '<span class="muted">·</span>');

  function renderEditor() {
    const ed = $('#editor');
    const scroll = ed.scrollTop;
    if (view === 'site') {
      const s = content.site;
      ed.innerHTML = `
        <div class="a-head"><h1>⚙️ Site settings</h1></div>
        <section class="a-card">${SITE_FIELDS.map((f) => field(f, 'site.' + f.k, s[f.k])).join('')}</section>
        <h3 class="a-sub">Navbar links</h3>
        <section class="a-card">${itemsEditor(s.nav || [], 'site.nav', NAV_FIELDS)}</section>`;
    } else {
      const pi = pageIndex();
      if (pi < 0) { view = 'page:'; return renderEditor(); }
      const pg = content.pages[pi];
      const base = `pages.${pi}`;
      ed.innerHTML = `
        <div class="a-head">
          <h1>${icon(pg.icon || '📄', 'head-ico')} ${esc(pg.title || 'Untitled')}</h1>
          <div class="a-head-actions">
            <a class="a-btn ghost" href="/${esc(pg.slug || '')}" target="_blank" rel="noopener">Open ↗</a>
            ${pg.slug ? `<button class="a-btn ghost danger" data-act="page-del">Delete page</button>` : ''}
          </div>
        </div>
        <details class="a-card a-page-props"${openProps === pg ? ' open' : ''}>
          <summary>Page properties</summary>
          ${pg.slug ? `<label class="a-field"><span>URL slug</span><div class="a-slug"><span>/</span><input data-slug value="${esc(pg.slug)}" spellcheck="false"></div></label>` : '<p class="muted small">This is the home page (<code>/</code>).</p>'}
          ${PAGE_FIELDS.map((f) => field(f, `${base}.${f.k}`, pg[f.k])).join('')}
        </details>
        <div class="a-blocks">
          ${addBar(0)}
          ${(pg.blocks || []).map((b, bi) => blockEditor(b, `${base}.blocks.${bi}`, bi) + addBar(bi + 1)).join('')}
        </div>`;
    }
    ed.scrollTop = scroll;
    renderSidebar();
  }

  const addBar = (at) => `<div class="a-add"><button class="a-add-btn" data-act="block-menu" data-at="${at}" title="Add block here">＋</button></div>`;

  function blockEditor(b, path, bi) {
    const s = SCHEMA[b.type];
    if (!s) return `<div class="a-block"><div class="a-block-head"><b>Unknown block “${esc(b.type)}”</b>${blockActions(bi)}</div></div>`;
    const key = path;
    const isCollapsed = collapsed.has(key);
    const summary = summaryOf(b);
    return `<div class="a-block${isCollapsed ? ' collapsed' : ''}" data-bi="${bi}">
      <div class="a-block-head">
        <button class="a-collapse" data-act="collapse" data-key="${esc(key)}" title="Collapse">${isCollapsed ? '▸' : '▾'}</button>
        <span class="a-glyph">${esc(s.glyph)}</span><b>${esc(s.label)}</b>
        <span class="a-summary">${esc(summary)}</span>
        ${blockActions(bi)}
      </div>
      <div class="a-block-body">
        ${(s.fields || []).map((f) => field(f, `${path}.${f.k}`, b[f.k])).join('')}
        ${s.items ? itemsEditor(b.items || [], `${path}.items`, s.items, b.type) : ''}
      </div>
    </div>`;
  }
  const blockActions = (bi) => `<span class="a-actions">
      <button class="a-mini" data-act="block-move" data-bi="${bi}" data-dir="-1" title="Move up">↑</button>
      <button class="a-mini" data-act="block-move" data-bi="${bi}" data-dir="1" title="Move down">↓</button>
      <button class="a-mini" data-act="block-dup" data-bi="${bi}" title="Duplicate">⧉</button>
      <button class="a-mini danger" data-act="block-del" data-bi="${bi}" title="Delete">✕</button></span>`;
  function summaryOf(b) {
    const t = b.text || b.title || b.label || b.src || '';
    if (t) return String(t).replace(/\s+/g, ' ').slice(0, 60);
    if (b.items) return `${b.items.length} item${b.items.length === 1 ? '' : 's'}`;
    return '';
  }

  function itemsEditor(list, path, fields, type) {
    return `<div class="a-items">${list
      .map(
        (it, ii) => `<div class="a-item">
          <div class="a-item-head"><span class="muted small">#${ii + 1}</span>
            <span class="a-actions">
              <button class="a-mini" data-act="item-move" data-path="${esc(path)}" data-ii="${ii}" data-dir="-1" title="Move up">↑</button>
              <button class="a-mini" data-act="item-move" data-path="${esc(path)}" data-ii="${ii}" data-dir="1" title="Move down">↓</button>
              <button class="a-mini danger" data-act="item-del" data-path="${esc(path)}" data-ii="${ii}" title="Remove">✕</button>
            </span></div>
          <div class="a-item-fields">${fields.map((f) => field(f, `${path}.${ii}.${f.k}`, it[f.k])).join('')}</div>
        </div>`
      )
      .join('')}
      <button class="a-btn ghost small" data-act="item-add" data-path="${esc(path)}" data-type="${esc(type || 'nav')}">＋ Add item</button></div>`;
  }

  /* ================= preview ================= */
  const frame = $('#preview');
  let previewTimer = null;
  function pushPreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      if (!frame.contentWindow || !content) return;
      const slug = view === 'site' ? '' : view.slice(5);
      frame.contentWindow.postMessage({ type: 'nz-preview', content: withOverrides(content), slug }, location.origin);
    }, 120);
  }
  // Swap freshly uploaded image paths for local blob URLs so the preview shows them before Netlify redeploys.
  function withOverrides(c) {
    if (!Object.keys(overrides).length) return c;
    return JSON.parse(JSON.stringify(c), (k, v) => (typeof v === 'string' && overrides[v] ? overrides[v] : v));
  }
  window.addEventListener('message', (e) => {
    if (e.origin === location.origin && e.data && e.data.type === 'nz-ready') pushPreview();
  });

  /* ================= persistence ================= */
  let saveTimer = null;
  function changed(structural) {
    dirty = true;
    setStatus('dirty', 'Unpublished changes');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.set(DRAFT_KEY, { content, baseSha, savedAt: Date.now() }), 300);
    if (structural) renderEditor();
    pushPreview();
  }

  function setStatus(kind, text) {
    $('#status').className = 'a-status ' + kind;
    $('#status-text').textContent = text;
  }

  function normalize(c) {
    c = c && typeof c === 'object' ? c : {};
    c.site = c.site || {};
    c.site.nav = Array.isArray(c.site.nav) ? c.site.nav : [];
    c.pages = Array.isArray(c.pages) ? c.pages : [];
    if (!c.pages.some((p) => !p.slug)) c.pages.unshift({ slug: '', title: 'Home', icon: '👋', cover: '', blocks: [] });
    c.pages.forEach((p) => (p.blocks = Array.isArray(p.blocks) ? p.blocks : []));
    return c;
  }

  /* ================= GitHub ================= */
  const gh = {
    cfg() {
      return Object.assign({ owner: 'mukhammadaziz-x', repo: 'mukhammadaziz.uz', branch: 'main', root: 'My-portfolio', token: '' }, store.get(GH_KEY) || {});
    },
    repoPath(rel) {
      const root = gh.cfg().root.replace(/^\/+|\/+$/g, '');
      return (root ? root + '/' : '') + rel;
    },
    async api(method, rel, body) {
      const c = gh.cfg();
      if (!c.token) throw new Error('Add your GitHub token first (⚙︎ GitHub).');
      const path = gh.repoPath(rel).split('/').map(encodeURIComponent).join('/');
      const url = `https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${path}` + (method === 'GET' ? `?ref=${encodeURIComponent(c.branch)}` : '');
      const r = await fetch(url, {
        method,
        cache: 'no-store',
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${c.token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (r.status === 404 && method === 'GET') return null;
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`GitHub ${r.status}: ${data.message || r.statusText}`);
      return data;
    },
    async getContent() {
      const d = await gh.api('GET', 'data/content.json');
      if (!d) return null;
      return { sha: d.sha, json: JSON.parse(b64decode(d.content)) };
    },
    async putFile(rel, b64, message, sha) {
      return gh.api('PUT', rel, { message, content: b64, branch: gh.cfg().branch, ...(sha ? { sha } : {}) });
    },
  };

  function b64encodeBytes(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  const b64encode = (str) => b64encodeBytes(new TextEncoder().encode(str));
  const b64decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

  let publishing = false;
  async function publish() {
    if (publishing) return;
    if (!gh.cfg().token) { openSettings(); return toast('Connect GitHub to publish.', 'warn'); }
    const problem = validate();
    if (problem) return toast(problem, 'err');
    publishing = true;
    setStatus('busy', 'Publishing…');
    try {
      const remote = await gh.api('GET', 'data/content.json');
      const remoteSha = remote ? remote.sha : undefined;
      if (baseSha && remoteSha && remoteSha !== baseSha &&
          !confirm('content.json was changed on GitHub since you loaded it. Overwrite it with your version?')) {
        setStatus('dirty', 'Unpublished changes');
        return;
      }
      const res = await gh.putFile('data/content.json', b64encode(JSON.stringify(content, null, 2) + '\n'), 'Update site content via admin', remoteSha);
      baseSha = res.content.sha;
      dirty = false;
      store.del(DRAFT_KEY);
      setStatus('ok', 'Published');
      toast('Published! Netlify will redeploy in about a minute.', 'ok');
    } catch (e) {
      setStatus('dirty', 'Unpublished changes');
      toast(e.message, 'err');
    } finally {
      publishing = false;
    }
  }

  async function pullFromGitHub() {
    if (dirty && !confirm('Discard your unpublished changes and load the latest version from GitHub?')) return;
    try {
      setStatus('busy', 'Loading from GitHub…');
      const r = await gh.getContent();
      if (!r) throw new Error('data/content.json not found in the repo.');
      content = normalize(r.json);
      baseSha = r.sha;
      dirty = false;
      store.del(DRAFT_KEY);
      setStatus('ok', 'Up to date with GitHub');
      closeSettings();
      renderEditor();
      pushPreview();
      toast('Loaded latest content from GitHub.', 'ok');
    } catch (e) {
      setStatus(dirty ? 'dirty' : 'ok', dirty ? 'Unpublished changes' : 'Ready');
      toast(e.message, 'err');
    }
  }

  async function upload(path) {
    if (!gh.cfg().token) { openSettings(); return toast('Connect GitHub to upload images.', 'warn'); }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.svg,.pdf';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) return toast('File is larger than 5 MB — please compress it first.', 'err');
      const ext = (file.name.match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
      const name = `${Date.now()}-${file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'file'}${ext}`;
      const rel = 'assets/uploads/' + name;
      try {
        setStatus('busy', 'Uploading…');
        const bytes = new Uint8Array(await file.arrayBuffer());
        await gh.putFile(rel, b64encodeBytes(bytes), `Upload ${name} via admin`);
        overrides[rel] = URL.createObjectURL(file);
        setAt(path, rel);
        toast('Uploaded ' + name, 'ok');
        changed(true);
      } catch (e) {
        setStatus(dirty ? 'dirty' : 'ok', dirty ? 'Unpublished changes' : 'Ready');
        toast(e.message, 'err');
      }
    };
    input.click();
  }

  function validate() {
    const seen = new Set();
    for (const p of content.pages) {
      const s = p.slug || '';
      if (seen.has(s)) return `Two pages use the same URL “/${s}”.`;
      seen.add(s);
      if (s && !/^[a-z0-9][a-z0-9-]*$/.test(s)) return `Invalid slug “${s}” — use lowercase letters, numbers and dashes.`;
      if (window.NZ.RESERVED.includes(s)) return `“/${s}” is reserved — choose another page URL.`;
    }
    return null;
  }

  /* ================= settings modal ================= */
  const modal = $('#settings-modal');
  const form = $('#settings-form');
  function openSettings() {
    const c = gh.cfg();
    ['owner', 'repo', 'branch', 'root', 'token'].forEach((k) => (form.elements[k].value = c[k] || ''));
    modal.hidden = false;
    form.elements[c.token ? 'owner' : 'token'].focus();
  }
  function closeSettings() { modal.hidden = true; }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = {};
    ['owner', 'repo', 'branch', 'root', 'token'].forEach((k) => (v[k] = form.elements[k].value.trim()));
    store.set(GH_KEY, v);
    closeSettings();
    toast('GitHub settings saved.', 'ok');
  });
  modal.addEventListener('click', (e) => { if (e.target === modal) closeSettings(); });

  /* ================= block menu ================= */
  const menu = $('#block-menu');
  let menuAt = 0;
  function openMenu(btn, at) {
    menuAt = at;
    menu.innerHTML = Object.entries(SCHEMA)
      .map(([t, s]) => `<button data-act="block-add" data-type="${t}"><span class="a-glyph">${esc(s.glyph)}</span>${esc(s.label)}</button>`)
      .join('');
    menu.hidden = false;
    const r = btn.getBoundingClientRect();
    const h = menu.offsetHeight;
    menu.style.left = Math.min(r.left, innerWidth - menu.offsetWidth - 8) + 'px';
    menu.style.top = (r.bottom + h + 8 > innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
  }
  const closeMenu = () => (menu.hidden = true);

  /* ================= events ================= */
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.slug !== undefined) {
      const pg = content.pages[pageIndex()];
      const slug = el.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '');
      const taken = content.pages.some((p, i) => i !== pageIndex() && p.slug === slug) || window.NZ.RESERVED.includes(slug);
      el.classList.toggle('invalid', !slug || taken);
      if (!slug || taken) return;
      pg.slug = slug;
      view = 'page:' + slug;
      renderSidebar();
      return changed(false);
    }
    const path = el.dataset.path;
    if (!path) return;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'number') v = Number(v);
    setAt(path, v);
    const th = document.querySelector(`[data-thumb="${CSS.escape(path)}"]`);
    if (th) th.innerHTML = thumb(v, th.dataset.kind);
    if (/^pages\.\d+\.(title|icon)$/.test(path)) renderSidebar();
    if (el.tagName === 'TEXTAREA') el.rows = Math.min(10, Math.max(2, el.value.split('\n').length + 1));
    changed(false);
  });
  document.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT' && e.target.dataset.path) changed(false); });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) { if (!e.target.closest('#block-menu')) closeMenu(); return; }
    const act = btn.dataset.act;
    const pi = pageIndex();
    const blocks = pi >= 0 ? content.pages[pi].blocks : null;
    const bi = Number(btn.dataset.bi);

    switch (act) {
      case 'open':
        view = btn.dataset.target;
        renderEditor();
        $('#editor').scrollTop = 0;
        pushPreview();
        break;
      case 'block-menu':
        e.stopPropagation();
        openMenu(btn, Number(btn.dataset.at));
        break;
      case 'block-add':
        blocks.splice(menuAt, 0, blank(btn.dataset.type));
        closeMenu();
        changed(true);
        setTimeout(() => {
          const el = document.querySelectorAll('.a-block')[menuAt];
          if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); const f = el.querySelector('input, textarea'); if (f) f.focus({ preventScroll: true }); }
        });
        break;
      case 'block-move': {
        const to = bi + Number(btn.dataset.dir);
        if (to < 0 || to >= blocks.length) return;
        [blocks[bi], blocks[to]] = [blocks[to], blocks[bi]];
        collapsed.clear();
        changed(true);
        break;
      }
      case 'block-dup':
        blocks.splice(bi + 1, 0, JSON.parse(JSON.stringify(blocks[bi])));
        collapsed.clear();
        changed(true);
        break;
      case 'block-del':
        if (!confirm(`Delete this ${SCHEMA[blocks[bi].type] ? SCHEMA[blocks[bi].type].label : ''} block?`)) return;
        blocks.splice(bi, 1);
        collapsed.clear();
        changed(true);
        break;
      case 'collapse':
        collapsed.has(btn.dataset.key) ? collapsed.delete(btn.dataset.key) : collapsed.add(btn.dataset.key);
        renderEditor();
        break;
      case 'item-add': {
        const list = getAt(btn.dataset.path) || (setAt(btn.dataset.path, []), getAt(btn.dataset.path));
        list.push(btn.dataset.type === 'nav' ? { label: '', url: '', highlight: false } : blankItem(btn.dataset.type));
        changed(true);
        break;
      }
      case 'item-move': {
        const list = getAt(btn.dataset.path);
        const i = Number(btn.dataset.ii);
        const to = i + Number(btn.dataset.dir);
        if (to < 0 || to >= list.length) return;
        [list[i], list[to]] = [list[to], list[i]];
        changed(true);
        break;
      }
      case 'item-del':
        getAt(btn.dataset.path).splice(Number(btn.dataset.ii), 1);
        changed(true);
        break;
      case 'upload':
        upload(btn.dataset.path);
        break;
      case 'page-add': {
        const title = prompt('New page title:');
        if (!title) return;
        let slug = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page';
        while (content.pages.some((p) => p.slug === slug)) slug += '-2';
        while (window.NZ.RESERVED.includes(slug)) slug += '-page';
        const pg = { slug, title, icon: '📄', cover: '', description: '', blocks: [{ type: 'text', text: '' }] };
        content.pages.push(pg);
        openProps = pg;
        view = 'page:' + slug;
        changed(true);
        toast(`Page created at /${slug}. Link to it with “/${slug}”.`, 'ok');
        break;
      }
      case 'page-del': {
        const pg = content.pages[pi];
        if (!confirm(`Delete page “${pg.title}” (/${pg.slug})? This can't be undone after publishing.`)) return;
        content.pages.splice(pi, 1);
        view = 'page:';
        changed(true);
        break;
      }
      case 'publish': publish(); break;
      case 'settings': openSettings(); break;
      case 'close-modal': closeSettings(); break;
      case 'gh-pull': pullFromGitHub(); break;
      case 'export': {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2) + '\n'], { type: 'application/json' }));
        a.download = 'content.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        break;
      }
      case 'toggle-preview':
        $('#layout').classList.toggle(innerWidth <= 1100 ? 'show-preview' : 'no-preview');
        pushPreview();
        break;
      case 'device':
        $('#preview-pane').classList.toggle('mobile', btn.dataset.device === 'mobile');
        break;
      case 'discard-draft':
        if (!confirm('Discard your local draft and reload the published content?')) return;
        store.del(DRAFT_KEY);
        location.reload();
        break;
    }
  });

  $('#import-file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      content = normalize(JSON.parse(await f.text()));
      view = 'page:';
      changed(true);
      toast('Imported ' + f.name, 'ok');
    } catch (err) {
      toast('Invalid JSON: ' + err.message, 'err');
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); publish(); }
    if (e.key === 'Escape') { closeMenu(); closeSettings(); }
  });
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('resize', closeMenu);
  $('#editor').addEventListener('scroll', closeMenu);

  /* ================= toasts ================= */
  function toast(msg, kind = 'info') {
    const t = document.createElement('div');
    t.className = 'a-toast ' + kind;
    t.innerHTML = esc(msg);
    if (msg.includes('local draft')) t.innerHTML += ' <button class="a-mini" data-act="discard-draft">Discard</button>';
    $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), kind === 'err' ? 7000 : 4000);
    setTimeout(() => t.remove(), kind === 'err' ? 7600 : 4600);
  }

  /* ================= boot ================= */
  (async function boot() {
    const draft = store.get(DRAFT_KEY);
    if (draft && draft.content) {
      content = normalize(draft.content);
      baseSha = draft.baseSha || null;
      dirty = true;
      setStatus('dirty', 'Unpublished changes');
      toast('Restored your local draft.', 'info');
    } else {
      try {
        const r = await fetch('/data/content.json', { cache: 'no-cache' });
        content = normalize(await r.json());
        setStatus('ok', 'Ready');
      } catch (e) {
        content = normalize({});
        setStatus('dirty', 'Could not load content.json');
      }
      // If connected, remember the sha so publishing can detect conflicting edits.
      if (gh.cfg().token) gh.api('GET', 'data/content.json').then((d) => { if (d && !baseSha) baseSha = d.sha; }).catch(() => {});
    }
    renderEditor();
    pushPreview();
    if (!gh.cfg().token) setTimeout(() => toast('Tip: connect GitHub (⚙︎) to publish changes directly from here.', 'info'), 600);
  })();
})();
