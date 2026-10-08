/* Studio (admin panel): login, block editor for data/content.json, live preview and GitHub publishing. */
(function () {
  'use strict';
  const { esc, icon, slugify, RESERVED } = window.NZ;
  const $ = (s, r = document) => r.querySelector(s);

  /* ================= schema ================= */
  const COLORS = ['default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];
  const F = {
    text: (k, label, ph) => ({ k, t: 'text', label, ph }),
    area: (k, label, ph) => ({ k, t: 'textarea', label, ph }),
    url: (k = 'url', label = 'Link') => ({ k, t: 'url', label, ph: '/page  ·  https://…  ·  /#section' }),
    icon: (k = 'icon', label = 'Icon') => ({ k, t: 'icon', label, ph: '🚀  ·  si:github  ·  assets/…png' }),
    image: (k, label = 'Image') => ({ k, t: 'image', label, ph: 'assets/images/…  or  https://…' }),
    color: (k = 'color', label = 'Color') => ({ k, t: 'select', label, opts: COLORS }),
    select: (k, label, opts) => ({ k, t: 'select', label, opts }),
    check: (k, label) => ({ k, t: 'check', label }),
    num: (k, label) => ({ k, t: 'number', label }),
  };
  const MD = '**bold**, *italic*, `code`, [link](url). Blank line = new paragraph, "- " / "1. " = list.';

  const SCHEMA = {
    text: { label: 'Text', glyph: '¶', desc: 'Paragraphs and lists', fields: [F.area('text', 'Text', MD), F.color('color', 'Text color')] },
    h1: { label: 'Heading 1', glyph: 'H1', desc: 'Big section heading', fields: [F.text('text', 'Heading'), F.check('underline', 'Line under the heading')] },
    h2: { label: 'Heading 2', glyph: 'H2', desc: 'Medium heading', fields: [F.text('text', 'Heading'), F.check('underline', 'Line under the heading')] },
    h3: { label: 'Heading 3', glyph: 'H3', desc: 'Small heading', fields: [F.text('text', 'Heading'), F.check('underline', 'Line under the heading')] },
    linklist: { label: 'Page links', glyph: '🔗', desc: 'Notion-style list of links to pages or sites', items: [F.url('url', 'Page or URL'), F.icon('icon', 'Icon (empty = page icon)'), F.text('prefix', 'Muted prefix', 'e.g. Telegram'), F.text('label', 'Label (empty = page title)')] },
    database: { label: 'Table', glyph: '▦', desc: 'Notion database: Name · Tags · Note', fields: [F.text('title', 'Table title (optional)'), F.text('tagColors', 'Tag colors', 'easy=orange, medium=blue, advanced=green')], items: [F.text('name', 'Name'), F.url('url', 'Opens page'), F.icon('icon', 'Icon'), F.text('tags', 'Tags', 'comma, separated'), F.text('note', 'Note')], rowPage: true },
    columns: { label: 'Columns', glyph: '▥', desc: 'Side-by-side columns of blocks', columns: true },
    callout: { label: 'Callout', glyph: '💡', desc: 'Box with icon — can hold other blocks', fields: [F.icon('icon', 'Icon (empty = none)'), F.color('color', 'Background'), F.area('text', 'Text', MD)], children: true },
    bookmark: { label: 'Bookmark', glyph: '🔖', desc: 'Link preview card', fields: [F.url('url', 'URL'), F.text('title', 'Title'), F.text('desc', 'Description'), F.image('image', 'Preview image')] },
    image: { label: 'Image', glyph: '🖼', desc: 'Picture, click to zoom', fields: [F.image('src'), F.text('caption', 'Caption'), F.select('width', 'Width', ['full', 'medium', 'small'])] },
    quote: { label: 'Quote', glyph: '❝', desc: 'Quote or highlighted list', fields: [F.area('text', 'Quote', MD), F.text('author', 'Author')] },
    toggle: { label: 'Toggle', glyph: '▸', desc: 'Collapsible section', fields: [F.text('title', 'Title'), F.area('text', 'Hidden text', MD), F.check('open', 'Open by default')], children: true },
    bullets: { label: 'List', glyph: '•', desc: 'Bulleted or numbered list', fields: [F.area('text', 'Items', 'One item per line'), F.check('ordered', 'Numbered list')] },
    divider: { label: 'Divider', glyph: '—', desc: 'Horizontal line', fields: [] },
    button: { label: 'Button', glyph: '⏺', desc: 'Call to action', fields: [F.text('label', 'Label'), F.url(), F.icon()] },
    links: { label: 'Link cards', glyph: '▤', desc: 'Big clickable rows with subtitle', items: [F.icon(), F.text('label', 'Label'), F.text('desc', 'Subtitle'), F.url()] },
    cards: { label: 'Icon cards', glyph: '▦', desc: 'Grid of cards with icon', fields: [F.select('columns', 'Columns', ['2', '3', '4'])], items: [F.icon(), F.text('title', 'Title'), F.area('desc', 'Description'), F.url()] },
    gallery: { label: 'Gallery', glyph: '🗂', desc: 'Image cards with tags', fields: [F.select('columns', 'Columns', ['1', '2', '3', '4'])], items: [F.image('image', 'Cover image'), F.text('title', 'Title'), F.text('desc', 'Description'), F.text('tags', 'Tags', 'comma, separated'), F.url()] },
    badges: { label: 'Badges', glyph: '🏷', desc: 'Colored pills', items: [F.text('label', 'Label'), F.color(), F.url()] },
    inline: { label: 'Inline links', glyph: '↔', desc: 'Links in one row', items: [F.icon(), F.text('label', 'Label'), F.url()] },
    timeline: { label: 'Timeline', glyph: '⏱', desc: 'Experience / education', items: [F.text('date', 'Date', '2024 — 2025'), F.text('title', 'Title'), F.text('subtitle', 'Subtitle'), F.area('text', 'Description')] },
    progress: { label: 'Skill bars', glyph: '▬', desc: 'Percent bars', items: [F.text('label', 'Skill'), F.num('value', 'Percent')] },
    form: { label: 'Contact form', glyph: '✉', desc: 'Messages arrive in Netlify → Forms', fields: [F.text('button', 'Button text', 'Send message'), F.text('success', 'Message after sending', 'Thanks! Your message has been sent.')] },
  };

  const SITE_FIELDS = [
    F.text('title', 'Site title (browser tab / SEO)'),
    F.area('description', 'SEO description'),
    F.url('url', 'Site URL (for sitemap & share links)'),
    F.image('image', 'Share image (Telegram / social previews)'),
    F.icon('brandIcon', 'Navbar icon'),
    F.text('brandText', 'Navbar text'),
    F.select('defaultTheme', 'Default theme', ['dark', 'light']),
    F.area('footer', 'Footer (empty = none)', MD + ' {year} = current year.'),
  ];
  const NAV_FIELDS = [F.icon(), F.text('label', 'Label'), F.url(), F.check('highlight', 'Highlighted')];
  const PAGE_FIELDS = [
    F.text('title', 'Title'),
    F.icon('icon', 'Page icon (emoji, si:…, or photo)'),
    { k: 'cover', t: 'image', label: 'Cover', ph: 'empty = gradient · none = no cover · several images, comma separated = collage' },
    F.area('description', 'SEO description'),
    F.check('draft', 'Draft — not published, links to it are hidden'),
    F.check('fullWidth', 'Full width'),
    F.check('hideTitle', 'Hide title'),
  ];

  const blankItem = (type) => {
    const it = {};
    SCHEMA[type].items.forEach((f) => (it[f.k] = f.t === 'check' ? false : f.t === 'number' ? 50 : f.t === 'select' ? f.opts[0] : ''));
    return it;
  };
  const blank = (type) => {
    const s = SCHEMA[type];
    const b = { type };
    (s.fields || []).forEach((f) => (b[f.k] = f.t === 'check' ? false : f.t === 'select' ? f.opts[0] : ''));
    if (type === 'cards') b.columns = '3';
    if (type === 'gallery') b.columns = '2';
    if (type === 'callout') b.icon = '💡';
    if (s.items) b.items = [blankItem(type)];
    if (s.children) b.children = [];
    if (s.columns) b.columns = [{ blocks: [] }, { blocks: [] }];
    return b;
  };

  /* ================= state ================= */
  const DRAFT_KEY = 'nz-draft';
  const SESSION_KEY = 'nz-session';
  const FAILS_KEY = 'nz-fails';
  const IDLE_LIMIT = 60 * 60 * 1000; // auto log-out after an hour without activity
  const DEFAULT_REPO = { owner: 'mukhammadaziz-x', repo: 'mukhammadaziz.uz', branch: 'main', root: 'My-portfolio' };

  let session = null; // { user, owner, repo, branch, root, token }
  let vault = null; // contents of data/auth.json
  let content = null;
  let baseSha = null;
  let dirty = false;
  let view = 'page:';
  const collapsed = new Set();
  const overrides = {}; // uploaded-but-not-yet-deployed images → blob URLs for the preview

  const store = {
    get(k, s = localStorage) { try { return JSON.parse(s.getItem(k)); } catch (e) { return null; } },
    set(k, v, s = localStorage) { try { s.setItem(k, JSON.stringify(v)); } catch (e) { toast('Could not save locally: ' + e.message, 'err'); } },
    del(k, s = localStorage) { try { s.removeItem(k); } catch (e) {} },
  };

  const getAt = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), content);
  function setAt(path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    keys.reduce((o, k) => o[k], content)[last] = value;
  }
  const pageIndex = () => content.pages.findIndex((p) => 'page:' + (p.slug || '') === view);
  const sortedPages = () => content.pages.map((p, i) => ({ p, i })).sort((a, b) => (a.p.slug || '').localeCompare(b.p.slug || ''));

  /* ================= crypto vault (login) ================= */
  // The GitHub token is encrypted with AES-256-GCM using a key derived from login + password (PBKDF2-SHA256).
  const ITERATIONS = 600000;
  const te = new TextEncoder();
  const toB64 = (buf) => b64encodeBytes(new Uint8Array(buf));
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function deriveKey(user, password, salt, iterations) {
    const base = await crypto.subtle.importKey('raw', te.encode(user.trim().toLowerCase() + '\n' + password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(user, password, secret) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(user, password, salt, ITERATIONS);
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(secret)));
    return { v: 1, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, cipher: 'AES-256-GCM', salt: toB64(salt), iv: toB64(iv), data: toB64(data) };
  }
  async function unseal(v, user, password) {
    const key = await deriveKey(user, password, fromB64(v.salt), v.iterations || ITERATIONS);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(v.iv) }, key, fromB64(v.data));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  /* ================= GitHub ================= */
  function b64encodeBytes(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  const b64encode = (str) => b64encodeBytes(te.encode(str));
  const b64decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

  const gh = {
    repoPath(rel, c) {
      const root = String(c.root || '').replace(/^\/+|\/+$/g, '');
      return (root ? root + '/' : '') + rel;
    },
    async api(method, rel, body, c = session) {
      if (!c || !c.token) throw new Error('Not signed in.');
      const p = gh.repoPath(rel, c).split('/').map(encodeURIComponent).join('/');
      const url = `https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${p}` + (method === 'GET' ? `?ref=${encodeURIComponent(c.branch)}` : '');
      const r = await fetch(url, {
        method,
        cache: 'no-store',
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${c.token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (r.status === 404 && method === 'GET') return null;
      const data = await r.json().catch(() => ({}));
      if (r.status === 401) throw new Error('GitHub rejected the token (expired or revoked). Update it in 👤 Account.');
      if (!r.ok) throw new Error(`GitHub ${r.status}: ${data.message || r.statusText}`);
      return data;
    },
    async getJson(rel, c) {
      const d = await gh.api('GET', rel, null, c);
      return d ? { sha: d.sha, json: JSON.parse(b64decode(d.content)) } : null;
    },
    putFile(rel, b64, message, sha, c = session) {
      return gh.api('PUT', rel, { message, content: b64, branch: c.branch, ...(sha ? { sha } : {}) }, c);
    },
  };

  /* ================= gate: login & first-time setup ================= */
  const gateForm = $('#gate-form');
  let gateMode = 'login';
  const gateError = (msg) => ($('#gate-error').textContent = msg || '');

  function showGate(mode) {
    gateMode = mode;
    const setup = mode === 'setup';
    $('#gate').hidden = false;
    $('#app').hidden = true;
    $('#setup-fields').hidden = !setup;
    $('#gate-title').textContent = setup ? 'Set up your Studio' : 'Sign in';
    $('#gate-sub').textContent = setup ? 'Choose a login and a strong password. You only do this once.' : 'Studio for your site.';
    $('#gate-btn').textContent = setup ? 'Create login' : 'Sign in';
    gateForm.elements.password.autocomplete = setup ? 'new-password' : 'current-password';
    $('#gate-foot').innerHTML = setup ? '' : 'Forgot the password? Delete <code>data/auth.json</code> in GitHub and open this page again to set up a new one.';
    if (setup) {
      const old = store.get('nz-gh') || {}; // token saved by an older version of the admin
      for (const k of ['owner', 'repo', 'branch', 'root']) gateForm.elements[k].value = old[k] ?? DEFAULT_REPO[k];
      gateForm.elements.token.value = old.token || '';
    }
    gateForm.elements.username.focus();
  }

  function lockedFor() {
    const f = store.get(FAILS_KEY) || {};
    return Math.max(0, (f.until || 0) - Date.now());
  }
  function registerFail() {
    const f = store.get(FAILS_KEY) || { n: 0 };
    f.n = (f.n || 0) + 1;
    if (f.n >= 5) f.until = Date.now() + Math.min(15 * 60, 30 * 2 ** (f.n - 5)) * 1000;
    store.set(FAILS_KEY, f);
  }

  gateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    gateError('');
    const v = Object.fromEntries(new FormData(gateForm));
    const btn = $('#gate-btn');
    const wait = lockedFor();
    if (wait) return gateError(`Too many attempts. Try again in ${Math.ceil(wait / 1000)} s.`);
    if (!window.crypto || !crypto.subtle) return gateError('This page must be opened over HTTPS.');

    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = gateMode === 'setup' ? 'Encrypting…' : 'Unlocking…';
    try {
      if (gateMode === 'setup') {
        if (v.username.trim().length < 3) throw new Error('Login must be at least 3 characters.');
        if (v.password.length < 10) throw new Error('Password must be at least 10 characters.');
        if (v.password !== v.password2) throw new Error('Passwords do not match.');
        if (!v.token.trim()) throw new Error('Paste your GitHub token.');
        const cfg = { owner: v.owner.trim(), repo: v.repo.trim(), branch: v.branch.trim() || 'main', root: v.root.trim(), token: v.token.trim() };
        const probe = await gh.api('GET', 'data/content.json', null, cfg);
        if (!probe) throw new Error('data/content.json was not found with these repository settings.');
        const existing = await gh.api('GET', 'data/auth.json', null, cfg);
        const sealed = await seal(v.username, v.password, cfg);
        await gh.putFile('data/auth.json', b64encode(JSON.stringify(sealed, null, 2) + '\n'), 'Set up Studio login', existing && existing.sha, cfg);
        store.del('nz-gh');
        vault = sealed;
        startSession({ ...cfg, user: v.username.trim() });
        toast('Login created. From now on sign in with your login and password.', 'ok');
      } else {
        let cfg;
        try {
          cfg = await unseal(vault, v.username, v.password);
        } catch (err) {
          registerFail();
          throw new Error('Wrong login or password.');
        }
        store.del(FAILS_KEY);
        startSession({ ...cfg, user: v.username.trim() });
      }
      gateForm.reset();
    } catch (err) {
      gateError(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });

  function startSession(s) {
    setSession(s);
    enterStudio();
  }
  function setSession(s) {
    session = s;
    store.set(SESSION_KEY, { ...s, active: Date.now() }, sessionStorage);
    $('#who').textContent = s.user;
  }
  function logout() {
    store.del(SESSION_KEY, sessionStorage);
    session = null;
    dirty = false; // unpublished changes stay saved in localStorage
    location.reload();
  }
  // Idle timeout.
  const touch = () => session && store.set(SESSION_KEY, { ...session, active: Date.now() }, sessionStorage);
  ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, touch, { passive: true }));
  setInterval(() => {
    const s = store.get(SESSION_KEY, sessionStorage);
    if (session && (!s || Date.now() - s.active > IDLE_LIMIT)) logout();
  }, 60 * 1000);

  /* ================= studio boot ================= */
  async function enterStudio() {
    $('#gate').hidden = true;
    $('#app').hidden = false;
    $('#who').textContent = session.user;
    setStatus('busy', 'Loading…');
    let remote = null;
    try {
      remote = await gh.getJson('data/content.json');
    } catch (e) {
      toast(e.message, 'err');
    }
    if (remote) {
      content = normalize(remote.json);
      baseSha = remote.sha;
    } else {
      // Fallback: the published copy (drafts are not included in it).
      content = normalize(await fetch('/data/content.json', { cache: 'no-cache' }).then((r) => r.json()).catch(() => ({})));
      toast('Loaded the published copy — drafts are missing until GitHub is reachable.', 'warn');
    }
    const draft = store.get(DRAFT_KEY);
    if (draft && draft.content) {
      const same = draft.baseSha && draft.baseSha === baseSha;
      if (same || confirm(`You have unpublished local changes from ${new Date(draft.savedAt).toLocaleString()}, but the site changed since then. Restore your local changes anyway?`)) {
        content = normalize(draft.content);
        dirty = true;
        toast('Restored your unpublished changes.', 'info', true);
      } else store.del(DRAFT_KEY);
    }
    setStatus(dirty ? 'dirty' : 'ok', dirty ? 'Unpublished changes' : 'Up to date');
    renderEditor();
    pushPreview();
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

  /* ================= rendering: editor ================= */
  function renderSidebar() {
    $('#page-list').innerHTML = sortedPages()
      .map(({ p }) => {
        const v = 'page:' + (p.slug || '');
        const depth = p.slug ? p.slug.split('/').length : 0;
        return `<button class="a-side-item${view === v ? ' active' : ''}${p.draft ? ' is-draft' : ''}" data-act="open" data-target="${esc(v)}" style="--depth:${depth}" title="/${esc(p.slug || '')}">
          <span class="a-side-ico">${icon(p.icon || '📄', 'side-ico')}</span><span class="a-side-name">${esc(p.title || 'Untitled')}</span>${p.draft ? '<i class="a-dot" title="Draft"></i>' : ''}</button>`;
      })
      .join('');
    document.querySelector('.a-side-item[data-target="site"]').classList.toggle('active', view === 'site');
    $('#page-urls').innerHTML = sortedPages().map(({ p }) => `<option value="/${esc(p.slug || '')}">${esc(p.title)}</option>`).join('');
  }

  const thumb = (v, t) => {
    const first = String(v || '').split(',')[0].trim();
    if (!first || first === 'none') return `<span class="muted">${t === 'image' ? '—' : '·'}</span>`;
    return icon(overrides[first] || first, 'a-thumb-ico');
  };

  function field(f, path, value) {
    const id = 'f-' + path.replace(/\./g, '-');
    const p = esc(path);
    const ph = f.ph ? ` placeholder="${esc(f.ph)}"` : '';
    let input;
    switch (f.t) {
      case 'textarea':
        input = `<textarea id="${id}" data-path="${p}" rows="${Math.min(12, Math.max(2, String(value ?? '').split('\n').length + 1))}"${ph}>${esc(value)}</textarea>`;
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
          <button type="button" class="a-mini" data-act="upload" data-path="${p}" title="Upload image">⬆</button></div>`;
        break;
      case 'url':
        input = `<input id="${id}" data-path="${p}" value="${esc(value)}"${ph} list="page-urls" spellcheck="false">`;
        break;
      default:
        input = `<input id="${id}" data-path="${p}" value="${esc(value)}"${ph}>`;
    }
    return `<label class="a-field" for="${id}"><span>${esc(f.label)}</span>${input}</label>`;
  }

  function renderEditor() {
    const ed = $('#editor');
    const scroll = ed.scrollTop;
    if (view === 'site') {
      const s = content.site;
      ed.innerHTML = `
        <div class="a-head"><h1>⚙️ Site settings</h1></div>
        <section class="a-card">${SITE_FIELDS.map((f) => field(f, 'site.' + f.k, s[f.k])).join('')}</section>
        <h3 class="a-sub">Navbar links</h3>
        <section class="a-card">${itemsEditor(s.nav || [], 'site.nav', NAV_FIELDS, 'nav')}</section>`;
    } else {
      const pi = pageIndex();
      if (pi < 0) {
        view = 'page:';
        return renderEditor();
      }
      const pg = content.pages[pi];
      const base = `pages.${pi}`;
      ed.innerHTML = `
        <div class="a-head">
          <h1>${icon(pg.icon || '📄', 'head-ico')} <span>${esc(pg.title || 'Untitled')}</span>${pg.draft ? '<span class="draft-pill">draft</span>' : ''}</h1>
          <div class="a-head-actions">
            ${pg.draft ? '' : `<a class="a-btn ghost" href="/${esc(pg.slug || '')}" target="_blank" rel="noopener" title="Open the live page">↗</a>`}
            <button class="a-btn ghost" data-act="page-new" data-parent="${esc(pg.slug || '')}" title="Create a page inside this one">＋ Subpage</button>
            ${pg.slug ? `<button class="a-btn ghost danger" data-act="page-del">Delete</button>` : ''}
          </div>
        </div>
        <details class="a-card a-page-props"${pg.__new ? ' open' : ''}>
          <summary>Page properties <span class="muted small">/${esc(pg.slug || '')}</span></summary>
          ${pg.slug ? `<label class="a-field"><span>URL</span><div class="a-slug"><span>/</span><input data-slug value="${esc(pg.slug)}" spellcheck="false"></div></label>` : '<p class="muted small">This is the home page (<code>/</code>).</p>'}
          ${PAGE_FIELDS.filter((f) => pg.slug || f.k !== 'draft').map((f) => field(f, `${base}.${f.k}`, pg[f.k])).join('')}
        </details>
        ${blockList(pg.blocks, `${base}.blocks`)}`;
      delete pg.__new;
    }
    ed.scrollTop = scroll;
    renderSidebar();
  }

  const addBar = (lp, at) => `<div class="a-add"><button class="a-add-btn" data-act="block-menu" data-list="${esc(lp)}" data-at="${at}" title="Add a block here">＋</button></div>`;
  const blockList = (list, lp) => `<div class="a-blocks">${addBar(lp, 0)}${(list || []).map((b, i) => blockEditor(b, lp, i) + addBar(lp, i + 1)).join('')}</div>`;

  function blockEditor(b, lp, i) {
    const path = `${lp}.${i}`;
    const s = SCHEMA[b.type];
    const actions = `<span class="a-actions">
      <button class="a-mini" data-act="block-move" data-list="${esc(lp)}" data-i="${i}" data-dir="-1" title="Move up">↑</button>
      <button class="a-mini" data-act="block-move" data-list="${esc(lp)}" data-i="${i}" data-dir="1" title="Move down">↓</button>
      <button class="a-mini" data-act="block-dup" data-list="${esc(lp)}" data-i="${i}" title="Duplicate">⧉</button>
      <button class="a-mini danger" data-act="block-del" data-list="${esc(lp)}" data-i="${i}" title="Delete">✕</button></span>`;
    if (!s) return `<div class="a-block"><div class="a-block-head"><b>Unknown block “${esc(b.type)}”</b>${actions}</div></div>`;
    let body = (s.fields || []).map((f) => field(f, `${path}.${f.k}`, b[f.k])).join('');
    if (s.items) body += itemsEditor(b.items || [], `${path}.items`, s.items, b.type);
    if (s.children) body += `<div class="a-nest"><div class="a-nest-label">Blocks inside</div>${blockList(b.children, `${path}.children`)}</div>`;
    if (s.columns) {
      const cols = Array.isArray(b.columns) ? b.columns : [];
      body += `<div class="a-cols">${cols
        .map(
          (c, ci) => `<div class="a-col"><div class="a-col-head"><span>Column ${ci + 1}</span>
            <button class="a-mini danger" data-act="col-del" data-path="${esc(path)}" data-ci="${ci}" title="Remove column">✕</button></div>
            ${blockList(c.blocks, `${path}.columns.${ci}.blocks`)}</div>`
        )
        .join('')}</div>${cols.length < 5 ? `<button class="a-btn ghost small" data-act="col-add" data-path="${esc(path)}">＋ Column</button>` : ''}`;
    }
    return `<div class="a-block${collapsed.has(path) ? ' collapsed' : ''}${s.children || s.columns ? ' is-container' : ''}">
      <div class="a-block-head">
        <button class="a-collapse" data-act="collapse" data-key="${esc(path)}" title="Collapse">${collapsed.has(path) ? '▸' : '▾'}</button>
        <span class="a-glyph">${esc(s.glyph)}</span><b>${esc(s.label)}</b>
        <span class="a-summary">${esc(summaryOf(b))}</span>
        ${actions}
      </div>
      <div class="a-block-body">${body}</div>
    </div>`;
  }
  function summaryOf(b) {
    const t = b.text || b.title || b.label || b.src || b.url || '';
    if (t) return String(t).replace(/\s+/g, ' ').slice(0, 70);
    if (b.items) return `${b.items.length} item${b.items.length === 1 ? '' : 's'}`;
    if (Array.isArray(b.columns)) return `${b.columns.length} columns`;
    return '';
  }

  function itemsEditor(list, path, fields, type) {
    const rowPage = SCHEMA[type] && SCHEMA[type].rowPage;
    return `<div class="a-items">${list
      .map(
        (it, ii) => `<div class="a-item">
          <div class="a-item-head"><span class="muted small">#${ii + 1}</span>
            <span class="a-actions">
              ${rowPage && !it.url ? `<button class="a-mini" data-act="row-page" data-path="${esc(path)}.${ii}" title="Create a subpage for this row">📄＋</button>` : ''}
              <button class="a-mini" data-act="item-move" data-path="${esc(path)}" data-ii="${ii}" data-dir="-1" title="Move up">↑</button>
              <button class="a-mini" data-act="item-move" data-path="${esc(path)}" data-ii="${ii}" data-dir="1" title="Move down">↓</button>
              <button class="a-mini danger" data-act="item-del" data-path="${esc(path)}" data-ii="${ii}" title="Remove">✕</button>
            </span></div>
          <div class="a-item-fields">${fields.map((f) => field(f, `${path}.${ii}.${f.k}`, it[f.k])).join('')}</div>
        </div>`
      )
      .join('')}
      <button class="a-btn ghost small" data-act="item-add" data-path="${esc(path)}" data-type="${esc(type)}">＋ Add ${type === 'database' ? 'row' : 'item'}</button></div>`;
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
  function withOverrides(c) {
    if (!Object.keys(overrides).length) return c;
    return JSON.parse(JSON.stringify(c), (k, v) => (typeof v === 'string' && overrides[v] ? overrides[v] : v));
  }
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data || !content) return;
    if (e.data.type === 'nz-ready') pushPreview();
    // Clicking a page link inside the preview opens that page in the editor too.
    if (e.data.type === 'nz-navigate' && content.pages.some((p) => (p.slug || '') === e.data.slug)) {
      view = 'page:' + e.data.slug;
      collapsed.clear();
      renderEditor();
      $('#editor').scrollTop = 0;
    }
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

  function validate() {
    const seen = new Set();
    for (const p of content.pages) {
      const s = p.slug || '';
      if (seen.has(s)) return `Two pages use the same URL “/${s}”.`;
      seen.add(s);
      if (s && !s.split('/').every((seg) => /^[a-z0-9][a-z0-9-]*$/.test(seg))) return `Invalid URL “/${s}” — use lowercase letters, numbers, dashes and “/”.`;
      if (s && RESERVED.includes(s.split('/')[0])) return `“/${s}” is reserved — choose another URL.`;
    }
    if (content.pages.find((p) => !p.slug).draft) return 'The home page cannot be a draft.';
    return null;
  }

  let publishing = false;
  async function publish() {
    if (publishing || !session || !content) return;
    const problem = validate();
    if (problem) return toast(problem, 'err');
    publishing = true;
    setStatus('busy', 'Publishing…');
    try {
      const remote = await gh.api('GET', 'data/content.json');
      const remoteSha = remote ? remote.sha : undefined;
      if (baseSha && remoteSha && remoteSha !== baseSha && !confirm('content.json was changed on GitHub since you loaded it. Overwrite it with your version?')) {
        setStatus('dirty', 'Unpublished changes');
        return;
      }
      const res = await gh.putFile('data/content.json', b64encode(JSON.stringify(content, null, 2) + '\n'), 'Update site content via Studio', remoteSha);
      baseSha = res.content.sha;
      dirty = false;
      store.del(DRAFT_KEY);
      setStatus('ok', 'Published');
      toast('Published! Netlify will redeploy the site in about a minute.', 'ok');
    } catch (e) {
      setStatus('dirty', 'Unpublished changes');
      toast(e.message, 'err');
    } finally {
      publishing = false;
    }
  }

  function upload(path) {
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
        await gh.putFile(rel, b64encodeBytes(new Uint8Array(await file.arrayBuffer())), `Upload ${name} via Studio`);
        overrides[rel] = URL.createObjectURL(file);
        // Covers can hold several images (a collage): uploads are appended there.
        const cur = String(getAt(path) || '').trim();
        setAt(path, /\.cover$/.test(path) && cur && cur !== 'none' ? `${cur}, ${rel}` : rel);
        toast('Uploaded ' + name, 'ok');
        changed(true);
      } catch (e) {
        setStatus(dirty ? 'dirty' : 'ok', dirty ? 'Unpublished changes' : 'Up to date');
        toast(e.message, 'err');
      }
    };
    input.click();
  }

  /* ================= pages ================= */
  const pageModal = $('#page-modal');
  const pageForm = $('#page-form');
  const toSlug = (s) => slugify(String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '')).replace(/[^a-z0-9-]/g, '');
  let slugTouched = false;
  function openPageModal(parent) {
    pageForm.reset();
    slugTouched = false;
    pageForm.elements.parent.innerHTML =
      '<option value="">(top level)</option>' +
      sortedPages()
        .filter(({ p }) => p.slug)
        .map(({ p }) => `<option value="${esc(p.slug)}">${esc('— '.repeat(p.slug.split('/').length - 1) + p.title)}  /${esc(p.slug)}</option>`)
        .join('');
    pageForm.elements.parent.value = parent || '';
    updatePrefix();
    pageModal.hidden = false;
    pageForm.elements.title.focus();
  }
  const updatePrefix = () => ($('#new-prefix').textContent = '/' + (pageForm.elements.parent.value ? pageForm.elements.parent.value + '/' : ''));
  pageForm.elements.parent.addEventListener('change', updatePrefix);
  pageForm.elements.title.addEventListener('input', () => {
    if (!slugTouched) pageForm.elements.slug.value = toSlug(pageForm.elements.title.value);
  });
  pageForm.elements.slug.addEventListener('input', () => (slugTouched = true));
  pageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(pageForm));
    const seg = String(v.slug).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    const slug = (v.parent ? v.parent + '/' : '') + seg;
    if (!seg) return toast('Enter a URL for the page.', 'err');
    if (content.pages.some((p) => p.slug === slug)) return toast(`/${slug} already exists.`, 'err');
    if (RESERVED.includes(slug.split('/')[0])) return toast(`/${slug} is reserved.`, 'err');
    const pg = { slug, title: v.title.trim(), icon: '📄', cover: '', description: '', draft: !!v.draft, fullWidth: !!v.fullWidth, blocks: [{ type: 'text', text: '' }] };
    content.pages.push(pg);
    Object.defineProperty(pg, '__new', { value: true, configurable: true }); // not serialized
    pageModal.hidden = true;
    view = 'page:' + slug;
    collapsed.clear();
    changed(true);
    toast(`Created /${slug}. Link to it from another page with a “Page links” block.`, 'ok');
  });

  // Rename a page: its subpages move along and every link to it is updated.
  function renamePage(from, to) {
    const reLink = new RegExp('(^|[\\s(\\[])/' + from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[/#)\\s,])', 'g');
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      for (const k of Object.keys(node)) {
        if (typeof node[k] === 'string') node[k] = node[k].replace(reLink, `$1/${to}`);
        else walk(node[k]);
      }
    };
    content.pages.forEach((p) => {
      if (p.slug === from || (p.slug || '').startsWith(from + '/')) p.slug = to + p.slug.slice(from.length);
    });
    walk(content);
  }

  /* ================= account ================= */
  const accModal = $('#account-modal');
  const accForm = $('#account-form');
  function openAccount() {
    accForm.reset();
    accForm.elements.username.value = session.user;
    accModal.hidden = false;
  }
  accForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(accForm));
    if (v.username.trim().length < 3) return toast('Login must be at least 3 characters.', 'err');
    if (v.password.length < 10) return toast('Enter a new password of at least 10 characters (it re-encrypts the token).', 'err');
    if (v.password !== v.password2) return toast('Passwords do not match.', 'err');
    const btn = accForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const cfg = { owner: session.owner, repo: session.repo, branch: session.branch, root: session.root, token: v.token.trim() || session.token };
      const existing = await gh.api('GET', 'data/auth.json', null, cfg);
      const sealed = await seal(v.username, v.password, cfg);
      await gh.putFile('data/auth.json', b64encode(JSON.stringify(sealed, null, 2) + '\n'), 'Update Studio login', existing && existing.sha, cfg);
      vault = sealed;
      setSession({ ...cfg, user: v.username.trim() });
      accModal.hidden = true;
      toast('Saved. The new login works everywhere after the next deploy (about a minute).', 'ok');
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      btn.disabled = false;
    }
  });
  [pageModal, accModal].forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) m.hidden = true; }));

  /* ================= block menu ================= */
  const menu = $('#block-menu');
  const menuFilter = $('#menu-filter');
  let menuList = '';
  let menuAt = 0;
  let menuOpenedAt = 0;
  function renderMenu() {
    const q = menuFilter.value.trim().toLowerCase();
    $('#menu-list').innerHTML =
      Object.entries(SCHEMA)
        .filter(([t, s]) => !q || (t + ' ' + s.label + ' ' + s.desc).toLowerCase().includes(q))
        .map(([t, s]) => `<button data-act="block-add" data-type="${t}"><span class="a-glyph">${esc(s.glyph)}</span><span><b>${esc(s.label)}</b><small>${esc(s.desc)}</small></span></button>`)
        .join('') || '<div class="muted small" style="padding:8px">No such block</div>';
  }
  function openMenu(btn, lp, at) {
    menuList = lp;
    menuAt = at;
    menuOpenedAt = Date.now();
    menuFilter.value = '';
    renderMenu();
    menu.hidden = false;
    const r = btn.getBoundingClientRect();
    const h = menu.offsetHeight;
    menu.style.left = Math.max(8, Math.min(r.left - 8, innerWidth - menu.offsetWidth - 8)) + 'px';
    menu.style.top = (r.bottom + h + 8 > innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
    menuFilter.focus();
  }
  const closeMenu = () => (menu.hidden = true);
  menuFilter.addEventListener('input', renderMenu);
  menuFilter.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = $('#menu-list button');
      if (first) first.click();
    }
  });
  function addBlock(type) {
    getAt(menuList).splice(menuAt, 0, blank(type));
    closeMenu();
    collapsed.clear();
    changed(true);
    const newPath = `${menuList}.${menuAt}`;
    setTimeout(() => {
      const el = document.querySelector(`[data-key="${CSS.escape(newPath)}"]`);
      const block = el && el.closest('.a-block');
      if (!block) return;
      block.scrollIntoView({ block: 'center', behavior: 'smooth' });
      block.classList.add('flash');
      const f = block.querySelector('.a-block-body input, .a-block-body textarea');
      if (f) f.focus({ preventScroll: true });
    });
  }

  /* ================= events ================= */
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!content || !el.closest('#editor')) return;
    if (el.dataset.slug !== undefined) {
      const val = el.value;
      const ok = val.split('/').every((seg) => /^[a-z0-9][a-z0-9-]*$/.test(seg)) && !RESERVED.includes(val.split('/')[0]);
      const taken = content.pages.some((p, i) => i !== pageIndex() && p.slug === val);
      el.classList.toggle('invalid', !ok || taken);
      return;
    }
    const path = el.dataset.path;
    if (!path) return;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'number') v = Number(v);
    setAt(path, v);
    const th = document.querySelector(`[data-thumb="${CSS.escape(path)}"]`);
    if (th) th.innerHTML = thumb(v, th.dataset.kind);
    if (el.tagName === 'TEXTAREA') el.rows = Math.min(12, Math.max(2, el.value.split('\n').length + 1));
    if (/^pages\.\d+\.(title|icon|draft)$/.test(path)) {
      renderSidebar();
      if (el.type === 'checkbox') return changed(true);
    }
    changed(false);
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (!content || !el.closest('#editor')) return;
    if (el.dataset.slug !== undefined) {
      const pg = content.pages[pageIndex()];
      if (el.classList.contains('invalid') || !el.value || el.value === pg.slug) {
        el.value = pg.slug;
        el.classList.remove('invalid');
        return;
      }
      const from = pg.slug;
      renamePage(from, el.value);
      view = 'page:' + el.value;
      toast(`Moved /${from} → /${el.value} and updated the links to it.`, 'ok');
      return changed(true);
    }
    if (el.tagName === 'SELECT' && el.dataset.path) changed(false);
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) {
      if (!e.target.closest('#block-menu')) closeMenu();
      return;
    }
    const act = btn.dataset.act;
    const list = btn.dataset.list ? getAt(btn.dataset.list) : null;
    const i = Number(btn.dataset.i);

    switch (act) {
      case 'open':
        view = btn.dataset.target;
        collapsed.clear();
        renderEditor();
        $('#editor').scrollTop = 0;
        pushPreview();
        break;
      case 'block-menu':
        e.stopPropagation();
        openMenu(btn, btn.dataset.list, Number(btn.dataset.at));
        break;
      case 'block-add':
        addBlock(btn.dataset.type);
        break;
      case 'block-move': {
        const to = i + Number(btn.dataset.dir);
        if (to < 0 || to >= list.length) return;
        [list[i], list[to]] = [list[to], list[i]];
        collapsed.clear();
        changed(true);
        break;
      }
      case 'block-dup':
        list.splice(i + 1, 0, JSON.parse(JSON.stringify(list[i])));
        collapsed.clear();
        changed(true);
        break;
      case 'block-del': {
        const s = SCHEMA[list[i].type];
        if (!confirm(`Delete this ${s ? s.label : ''} block${s && (s.children || s.columns) ? ' and everything inside it' : ''}?`)) return;
        list.splice(i, 1);
        collapsed.clear();
        changed(true);
        break;
      }
      case 'collapse':
        collapsed.has(btn.dataset.key) ? collapsed.delete(btn.dataset.key) : collapsed.add(btn.dataset.key);
        renderEditor();
        break;
      case 'col-add':
        getAt(btn.dataset.path).columns.push({ blocks: [] });
        changed(true);
        break;
      case 'col-del': {
        const cols = getAt(btn.dataset.path).columns;
        const ci = Number(btn.dataset.ci);
        if (cols.length <= 1) return toast('A columns block needs at least one column — delete the block instead.', 'warn');
        if (cols[ci].blocks.length && !confirm('Remove this column and its blocks?')) return;
        cols.splice(ci, 1);
        changed(true);
        break;
      }
      case 'item-add': {
        let items = getAt(btn.dataset.path);
        if (!items) {
          setAt(btn.dataset.path, []);
          items = getAt(btn.dataset.path);
        }
        items.push(btn.dataset.type === 'nav' ? { icon: '', label: '', url: '', highlight: false } : blankItem(btn.dataset.type));
        changed(true);
        break;
      }
      case 'item-move': {
        const items = getAt(btn.dataset.path);
        const ii = Number(btn.dataset.ii);
        const to = ii + Number(btn.dataset.dir);
        if (to < 0 || to >= items.length) return;
        [items[ii], items[to]] = [items[to], items[ii]];
        changed(true);
        break;
      }
      case 'item-del':
        getAt(btn.dataset.path).splice(Number(btn.dataset.ii), 1);
        changed(true);
        break;
      case 'row-page': {
        // Create a draft subpage for a table row and link the row to it.
        const row = getAt(btn.dataset.path);
        const parent = view.slice(5);
        let slug = (parent ? parent + '/' : '') + (toSlug(row.name || '') || 'page');
        while (content.pages.some((p) => p.slug === slug)) slug += '-2';
        content.pages.push({ slug, title: row.name || 'Untitled', icon: row.icon || '', cover: 'none', description: '', draft: true, blocks: [{ type: 'text', text: '' }] });
        row.url = '/' + slug;
        changed(true);
        toast(`Created draft page /${slug}.`, 'ok');
        break;
      }
      case 'upload':
        upload(btn.dataset.path);
        break;
      case 'page-new':
        openPageModal(btn.dataset.parent !== undefined ? btn.dataset.parent : view.startsWith('page:') ? view.slice(5) : '');
        break;
      case 'page-del': {
        const pg = content.pages[pageIndex()];
        const subs = content.pages.filter((p) => (p.slug || '').startsWith(pg.slug + '/'));
        if (!confirm(`Delete “${pg.title}” (/${pg.slug})${subs.length ? ` and its ${subs.length} subpage(s)` : ''}?`)) return;
        content.pages = content.pages.filter((p) => p !== pg && !subs.includes(p));
        view = 'page:' + pg.slug.split('/').slice(0, -1).join('/');
        if (!content.pages.some((p) => 'page:' + (p.slug || '') === view)) view = 'page:';
        changed(true);
        break;
      }
      case 'publish':
        publish();
        break;
      case 'account':
        openAccount();
        break;
      case 'logout':
        if (dirty && !confirm('You have unpublished changes. They stay saved in this browser. Log out?')) return;
        logout();
        break;
      case 'close-modal':
        btn.closest('.a-modal').hidden = true;
        break;
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
        if (!confirm('Discard your unpublished changes and reload the published content?')) return;
        store.del(DRAFT_KEY);
        dirty = false;
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
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      publish();
    }
    if (e.key === 'Escape') {
      closeMenu();
      pageModal.hidden = true;
      accModal.hidden = true;
    }
  });
  window.addEventListener('beforeunload', (e) => {
    if (dirty && session) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  // Scrolling the editor closes the menu — but not the scroll that may come with the click that opened it.
  const closeMenuOnScroll = () => Date.now() - menuOpenedAt > 400 && closeMenu();
  window.addEventListener('resize', closeMenuOnScroll);
  $('#editor').addEventListener('scroll', closeMenuOnScroll);

  /* ================= toasts ================= */
  function toast(msg, kind = 'info', withDiscard = false) {
    const t = document.createElement('div');
    t.className = 'a-toast ' + kind;
    t.innerHTML = esc(msg) + (withDiscard ? ' <button class="a-mini" data-act="discard-draft">Discard</button>' : '');
    $('#toasts').appendChild(t);
    const life = kind === 'err' || withDiscard ? 8000 : 4500;
    setTimeout(() => t.classList.add('out'), life);
    setTimeout(() => t.remove(), life + 600);
  }

  /* ================= boot ================= */
  (async function boot() {
    const s = store.get(SESSION_KEY, sessionStorage);
    if (s && s.token && Date.now() - s.active < IDLE_LIMIT) {
      session = s;
      return enterStudio();
    }
    vault = await fetch('/data/auth.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    showGate(vault && vault.data ? 'login' : 'setup');
  })();
})();
