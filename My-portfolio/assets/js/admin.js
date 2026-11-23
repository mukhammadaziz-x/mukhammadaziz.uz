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
    video: (k, label = 'Video') => ({ k, t: 'video', label, ph: '⬆ upload an MP4  ·  or paste a YouTube / Vimeo link' }),
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
    video: { label: 'Video', glyph: '🎬', desc: 'Upload an MP4 or paste a YouTube / Vimeo link', fields: [F.video('src', 'Video'), F.image('poster', 'Poster image (made automatically on upload)'), F.text('caption', 'Caption'), F.select('width', 'Width', ['full', 'medium', 'small'])] },
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
  let baseContent = null; // content.json as loaded / last published — the common base for merging

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
    // An older version of a file by its blob sha (the base a saved draft was made from).
    async blobJson(sha, c = session) {
      const r = await fetch(`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/git/blobs/${encodeURIComponent(sha)}`, {
        cache: 'force-cache',
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${c.token}`, 'X-GitHub-Api-Version': '2022-11-28' },
      });
      if (!r.ok) throw new Error(`GitHub ${r.status}`);
      return JSON.parse(b64decode((await r.json()).content));
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

  /* merge3:start */
  // Three-way merge of content.json: base = the version this editor loaded, ours = the editor's version,
  // theirs = what GitHub holds now (e.g. a commit pushed from a computer meanwhile). Changes from both sides are
  // combined; when both changed the same value differently, ours wins and the path is listed in `conflicts`.
  // Arrays: elements with a unique identity (page slug, card url/title, badge label…) are matched by it;
  // other arrays (blocks) are aligned with an LCS diff, like `git merge` does for lines.
  function merge3(base, ours, theirs) {
    const conflicts = [];
    const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
    const canon = (v) =>
      JSON.stringify(v, (k, x) => (isObj(x) ? Object.keys(x).sort().reduce((o, key) => ((o[key] = x[key]), o), {}) : x));
    const eq = (a, b) => canon(a) === canon(b);
    const ID_KEYS = ['slug', 'url', 'title', 'label', 'name', 'src', 'image'];
    const idKey = (arrays) =>
      ID_KEYS.find((k) => arrays.every((a) => a.every((x) => isObj(x) && typeof x[k] === 'string') && new Set(a.map((x) => x[k])).size === a.length)) || null;

    function merge(b, o, t, path) {
      if (eq(o, t)) return o;
      if (eq(b, o)) return t;
      if (eq(b, t)) return o;
      if (isObj(o) && isObj(t)) {
        const bb = isObj(b) ? b : {};
        const out = {};
        for (const k of new Set([...Object.keys(o), ...Object.keys(t)])) {
          const v = merge(bb[k], o[k], t[k], `${path}.${k}`);
          if (v !== undefined) out[k] = v;
        }
        return out;
      }
      if (Array.isArray(o) && Array.isArray(t)) {
        const bb = Array.isArray(b) ? b : [];
        const key = idKey([bb, o, t]);
        return key ? mergeById(bb, o, t, key, path) : mergeSequence(bb, o, t, path);
      }
      conflicts.push(path || '/');
      return o;
    }

    function mergeById(b, o, t, key, path) {
      const by = (a) => new Map(a.map((x) => [x[key], x]));
      const B = by(b);
      const O = by(o);
      const T = by(t);
      const merged = new Map();
      for (const id of new Set([...O.keys(), ...T.keys(), ...B.keys()])) {
        const v = merge(B.get(id), O.get(id), T.get(id), `${path}[${key}=${id}]`);
        if (v !== undefined) merged.set(id, v);
      }
      // Our order; an element only theirs has goes right after its predecessor in their order.
      const order = o.map((x) => x[key]).filter((id) => merged.has(id));
      t.forEach((x, i) => {
        if (!merged.has(x[key]) || order.includes(x[key])) return;
        let at = 0;
        for (let j = i - 1; j >= 0; j--) {
          const p = order.indexOf(t[j][key]);
          if (p >= 0) { at = p + 1; break; }
        }
        order.splice(at, 0, x[key]);
      });
      return order.map((id) => merged.get(id));
    }

    // For each base index: the index of the same element in `side` (LCS), or -1 when the side removed/changed it.
    function align(b, side) {
      const B = b.map(canon);
      const S = side.map(canon);
      const L = Array.from({ length: B.length + 1 }, () => new Array(S.length + 1).fill(0));
      for (let i = B.length - 1; i >= 0; i--) for (let j = S.length - 1; j >= 0; j--) L[i][j] = B[i] === S[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
      const map = new Array(B.length).fill(-1);
      for (let i = 0, j = 0; i < B.length && j < S.length; ) {
        if (B[i] === S[j]) map[i++] = j++;
        else if (L[i + 1][j] >= L[i][j + 1]) i++;
        else j++;
      }
      return map;
    }
    // Elements a side inserted, grouped by the gap they sit in (gap i = right before base[i]).
    function gaps(b, side, map) {
      const g = Array.from({ length: b.length + 1 }, () => []);
      const matched = new Map(map.map((s, i) => [s, i]).filter(([s]) => s >= 0));
      let gap = 0;
      side.forEach((x, s) => (matched.has(s) ? (gap = matched.get(s) + 1) : g[gap].push(x)));
      return g;
    }
    function mergeSequence(b, o, t, path) {
      const mo = align(b, o);
      const mt = align(b, t);
      const go = gaps(b, o, mo);
      const gt = gaps(b, t, mt);
      const out = [];
      for (let i = 0; i <= b.length; i++) {
        const keptO = i < b.length && mo[i] >= 0;
        const keptT = i < b.length && mt[i] >= 0;
        if (i < b.length && !keptO && !keptT && go[i].length === 1 && gt[i].length === 1) {
          out.push(merge(b[i], go[i][0], gt[i][0], `${path}[${i}]`)); // both sides edited this element
          continue;
        }
        out.push(...go[i]);
        for (const x of gt[i]) if (!go[i].some((y) => eq(x, y))) out.push(x);
        if (keptO && keptT) out.push(b[i]); // removed (or edited) by either side → not kept
      }
      return out;
    }

    return { result: merge(base, ours, theirs, ''), conflicts };
  }
  /* merge3:end */

  const clone = (v) => JSON.parse(JSON.stringify(v));
  // Combines this editor's changes with what GitHub holds now; returns a toast-ready note.
  function mergeRemote(remoteJson) {
    const { result, conflicts } = merge3(baseContent || {}, clone(content), remoteJson);
    content = normalize(result);
    baseContent = clone(remoteJson);
    return conflicts.length
      ? `Merged with newer changes from GitHub; ${conflicts.length} place(s) were changed on both sides — your version was kept.`
      : 'Merged with newer changes from GitHub — nothing was lost.';
  }

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
      baseContent = clone(content);
    } else {
      // Fallback: the published copy (drafts are not included in it).
      content = normalize(await fetch('/data/content.json', { cache: 'no-cache' }).then((r) => r.json()).catch(() => ({})));
      toast('Loaded the published copy — drafts are missing until GitHub is reachable.', 'warn');
    }
    const draft = store.get(DRAFT_KEY);
    if (draft && draft.content) {
      if (draft.baseSha && draft.baseSha === baseSha) {
        content = normalize(draft.content);
        dirty = true;
        toast('Restored your unpublished changes.', 'info', true);
      } else {
        // The site changed since the draft was saved (a publish elsewhere, or a push from a computer):
        // combine both instead of making the owner choose which one to lose.
        const draftBase = draft.base || (draft.baseSha && remote ? await gh.blobJson(draft.baseSha).catch(() => null) : null);
        if (draftBase && remote) {
          const { result, conflicts } = merge3(draftBase, draft.content, remote.json);
          content = normalize(result);
          dirty = true;
          toast(
            `Restored your unpublished changes and combined them with newer changes from GitHub${conflicts.length ? ` (${conflicts.length} place(s) changed on both sides — yours kept)` : ''}.`,
            'info',
            true
          );
        } else if (confirm(`You have unpublished local changes from ${new Date(draft.savedAt).toLocaleString()}, but the site changed since then. Restore your local changes anyway?`)) {
          content = normalize(draft.content);
          dirty = true;
          toast('Restored your unpublished changes.', 'info', true);
        } else store.del(DRAFT_KEY);
      }
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
    if (!first || first === 'none') return `<span class="muted">${t === 'icon' ? '·' : '—'}</span>`;
    if (t === 'video') return `<span class="ico a-thumb-ico ico-emoji">${/youtu\.?be|vimeo\.com/i.test(first) ? '▶️' : '🎬'}</span>`;
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
      case 'video':
        input = `<div class="a-media"><span class="a-thumb" data-thumb="${p}" data-kind="${f.t}">${thumb(value, f.t)}</span>
          <input id="${id}" data-path="${p}" value="${esc(value)}"${ph}>
          <button type="button" class="a-mini" data-act="upload" data-path="${p}" data-kind="${f.t}" title="Upload ${f.t === 'video' ? 'video' : 'image'}">⬆</button></div>`;
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
    if (e.data.type !== 'nz-navigate') return;
    const slug = String(e.data.slug || '');
    if (content.pages.some((p) => (p.slug || '') === slug)) {
      view = 'page:' + slug;
      collapsed.clear();
      renderEditor();
      $('#editor').scrollTop = 0;
    } else if (/^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*$/.test(slug) && !RESERVED.includes(slug.split('/')[0])) {
      // A link to a page that doesn't exist yet (e.g. a new project card): offer to create it right there.
      if (!confirm(`/${slug} doesn't exist yet. Create this page now?`)) return;
      const cut = slug.lastIndexOf('/');
      const parent = cut > 0 && content.pages.some((p) => p.slug === slug.slice(0, cut)) ? slug.slice(0, cut) : '';
      openPageModal(parent);
      const seg = parent ? slug.slice(cut + 1) : slug;
      pageForm.elements.slug.value = seg;
      slugTouched = true;
      pageForm.elements.title.value = seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
  });

  /* ================= persistence ================= */
  let saveTimer = null;
  function changed(structural) {
    dirty = true;
    setStatus('dirty', 'Unpublished changes');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.set(DRAFT_KEY, { content, baseSha, base: baseContent, savedAt: Date.now() }), 300);
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
      let note = '';
      for (let attempt = 1; ; attempt++) {
        const remote = await gh.getJson('data/content.json');
        if (remote && baseSha && remote.sha !== baseSha) {
          // GitHub changed since this editor loaded (e.g. a push from a computer): merge, never overwrite.
          note = mergeRemote(remote.json);
          baseSha = remote.sha;
          renderEditor();
          pushPreview();
          const issue = validate();
          if (issue) throw new Error(`${note} ${issue}`);
        }
        try {
          const res = await gh.putFile('data/content.json', b64encode(JSON.stringify(content, null, 2) + '\n'), 'Update site content via Studio', remote ? remote.sha : undefined);
          baseSha = res.content.sha;
          baseContent = clone(content);
          break;
        } catch (e) {
          // 409: someone committed between our read and write — read again and merge again.
          if (attempt < 3 && /GitHub 409/.test(e.message)) continue;
          throw e;
        }
      }
      dirty = false;
      store.del(DRAFT_KEY);
      setStatus('ok', 'Published');
      toast(`Published! Netlify will redeploy the site in about a minute.${note ? ' ' + note : ''}`, 'ok');
    } catch (e) {
      setStatus('dirty', 'Unpublished changes');
      toast(e.message, 'err');
    } finally {
      publishing = false;
    }
  }

  /* pdf-thumb:start */
  // Renders the first page of a PDF to a PNG blob in the browser (pdf.js from cdnjs, loaded on first use).
  // Browsers can't show a PDF inside <img>, so PDFs uploaded into image fields get this preview instead.
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/';
  let pdfjsLib = null;
  async function pdfToPng(file, maxWidth = 1400) {
    if (!pdfjsLib) {
      pdfjsLib = await import(PDFJS + 'pdf.min.mjs');
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.mjs';
    }
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    try {
      const page = await pdf.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(3, maxWidth / base.width) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; // transparent PDF backgrounds would turn black in some viewers
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      return await new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('Could not render the PDF'))), 'image/png'));
    } finally {
      pdf.destroy();
    }
  }
  /* pdf-thumb:end */

  /* video-poster:start */
  // Grabs a frame from the first second of a video as a JPEG poster. Also proves the browser can play the file:
  // formats it can't decode (e.g. iPhone HEVC .mov) are rejected here, before anything is uploaded.
  async function videoPoster(file, maxWidth = 1280) {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    try {
      await new Promise((ok, fail) => {
        v.onloadeddata = ok;
        v.onerror = () => fail(new Error('This video can’t be played in a browser — export it as MP4 (H.264) or WebM.'));
        v.src = url;
      });
      const t = Math.min(1, (v.duration || 0) / 10); // not the very first frame, which is often black
      if (t > 0) await new Promise((ok) => { v.onseeked = ok; v.currentTime = t; });
      const scale = Math.min(1, maxWidth / v.videoWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(v.videoWidth * scale);
      canvas.height = Math.round(v.videoHeight * scale);
      canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('Could not make a poster'))), 'image/jpeg', 0.85));
      return { blob, width: v.videoWidth, height: v.videoHeight, duration: v.duration };
    } finally {
      v.removeAttribute('src');
      v.load();
      URL.revokeObjectURL(url);
    }
  }
  /* video-poster:end */

  /* video-compress:start */
  // GitHub's API refuses big uploads ("input too large"), so large videos are re-encoded in the browser first
  // (Mediabunny + WebCodecs, hardware-accelerated where available): H.264 MP4, short side ≤ 720 px, with the
  // bitrate chosen so the result lands under targetBytes. Audio is copied as-is when possible (Chrome on Linux
  // can't encode AAC), otherwise re-encoded. Returns { blob, audioLost }.
  const MEDIABUNNY = 'https://cdn.jsdelivr.net/npm/mediabunny@1.65.2/dist/bundles/mediabunny.min.mjs';
  let mediabunny = null;
  async function compressVideo(file, targetBytes, onProgress) {
    if (!mediabunny) mediabunny = await import(MEDIABUNNY);
    const { Input, Output, BlobSource, BufferTarget, Mp4OutputFormat, Conversion, Quality, ALL_FORMATS } = mediabunny;
    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const duration = await input.computeDuration();
    if (!(duration > 0)) throw new Error('Could not read the length of this video.');
    const audioBps = 192000; // budget for a copied audio track
    const videoBps = Math.min(2500000, Math.floor((targetBytes * 8 * 0.9) / duration) - audioBps); // 10% headroom
    if (videoBps < 350000) {
      throw new Error(`This video is too long (${Math.round(duration / 60)} min) to keep good quality on the site — upload it to YouTube and paste the link instead.`);
    }
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
    const conversion = await Conversion.init({
      input,
      output,
      video: (track) => {
        const w = track.displayWidth;
        const h = track.displayHeight;
        return { ...(w <= h ? { width: Math.min(w, 720) } : { height: Math.min(h, 720) }), codec: 'avc', quality: new Quality({ bitrate: videoBps }) };
      },
    });
    if (!conversion.isValid) {
      throw new Error(`This browser can’t convert this video (${conversion.discardedTracks.map((t) => t.reason).join(', ')}). Try Chrome, or upload it to YouTube and paste the link.`);
    }
    const audioLost = conversion.discardedTracks.some((d) => d.track.isAudioTrack());
    if (onProgress) conversion.onProgress = onProgress;
    await conversion.execute();
    return { blob: new Blob([output.target.buffer], { type: 'video/mp4' }), audioLost };
  }
  /* video-compress:end */

  const VIDEO_UPLOAD_MB = 15; // bigger files are compressed first — GitHub's API rejects large uploads
  const VIDEO_INPUT_MAX_MB = 500;
  function uploadVideo(path) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/mp4,video/webm,.mp4,.m4v,.webm,.mov';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      const MB = 1048576;
      if (file.size > VIDEO_INPUT_MAX_MB * MB) {
        return toast(`Video is ${(file.size / MB).toFixed(0)} MB — too big to process here. Upload it to YouTube and paste the link instead.`, 'err');
      }
      const base = `${Date.now()}-${file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'video'}`;
      let ext = /\.webm$/i.test(file.name) ? '.webm' : '.mp4';
      try {
        setStatus('busy', 'Checking the video…');
        const poster = await videoPoster(file);
        let data = file;
        let note = '';
        if (file.size > VIDEO_UPLOAD_MB * MB) {
          setStatus('busy', 'Compressing video… 0%');
          const res = await compressVideo(file, VIDEO_UPLOAD_MB * MB, (p) => setStatus('busy', `Compressing video… ${Math.round(p * 100)}%`));
          data = res.blob;
          ext = '.mp4';
          note = ` — compressed ${(file.size / MB).toFixed(0)} → ${(data.size / MB).toFixed(1)} MB` + (res.audioLost ? ' (this browser could not keep the sound — use YouTube if it matters)' : '');
          if (data.size > VIDEO_UPLOAD_MB * 1.15 * MB) throw new Error(`Even compressed the video is ${(data.size / MB).toFixed(1)} MB — upload it to YouTube and paste the link instead.`);
        }
        const rel = `assets/uploads/${base}${ext}`;
        setStatus('busy', `Uploading video (${(data.size / MB).toFixed(1)} MB)…`);
        await gh.putFile(rel, b64encodeBytes(new Uint8Array(await data.arrayBuffer())), `Upload ${base}${ext} via Studio`);
        overrides[rel] = URL.createObjectURL(data);
        setAt(path, rel);
        // Fill the poster next to the video field if it's empty.
        const owner = getAt(path.replace(/\.[^.]+$/, ''));
        if (owner && typeof owner === 'object' && !String(owner.poster || '').trim()) {
          const posterRel = `assets/uploads/${base}-poster.jpg`;
          await gh.putFile(posterRel, b64encodeBytes(new Uint8Array(await poster.blob.arrayBuffer())), `Upload ${base}-poster.jpg (video poster) via Studio`);
          overrides[posterRel] = URL.createObjectURL(poster.blob);
          owner.poster = posterRel;
        }
        // Portrait (phone) videos look better narrower.
        if (owner && owner.type === 'video' && poster.height > poster.width && (!owner.width || owner.width === 'full')) owner.width = 'medium';
        toast(`Uploaded ${base}${ext}${note}`, note.includes('could not') ? 'err' : 'ok');
        changed(true);
      } catch (e) {
        setStatus(dirty ? 'dirty' : 'ok', dirty ? 'Unpublished changes' : 'Up to date');
        toast(e.message, 'err');
      }
    };
    input.click();
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
      const base = `${Date.now()}-${file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'file'}`;
      const name = base + ext;
      let rel = 'assets/uploads/' + name;
      try {
        setStatus('busy', 'Uploading…');
        await gh.putFile(rel, b64encodeBytes(new Uint8Array(await file.arrayBuffer())), `Upload ${name} via Studio`);
        overrides[rel] = URL.createObjectURL(file);
        let note = '';
        if (ext === '.pdf') {
          // Show the PDF's first page as the picture; the card itself links to the PDF.
          const pdfRel = rel;
          try {
            setStatus('busy', 'Making a preview of the PDF…');
            const png = await pdfToPng(file);
            const pngRel = `assets/uploads/${base}.png`;
            await gh.putFile(pngRel, b64encodeBytes(new Uint8Array(await png.arrayBuffer())), `Upload ${base}.png (PDF preview) via Studio`);
            overrides[pngRel] = URL.createObjectURL(png);
            rel = pngRel;
            // Gallery / card items have a "url" field next to the image: fill it with the PDF if it's empty.
            const owner = getAt(path.replace(/\.[^.]+$/, ''));
            if (owner && typeof owner === 'object' && 'url' in owner && !/\.url$/.test(path) && !String(owner.url || '').trim()) owner.url = pdfRel;
            note = ' — the first page is used as the picture, the card opens the PDF';
          } catch (e) {
            console.warn('PDF preview failed', e);
            note = ' — could not make a preview, upload a PNG/JPG of it for the picture';
          }
        }
        // Covers can hold several images (a collage): uploads are appended there.
        const cur = String(getAt(path) || '').trim();
        setAt(path, /\.cover$/.test(path) && cur && cur !== 'none' ? `${cur}, ${rel}` : rel);
        toast('Uploaded ' + name + note, note.includes('could not') ? 'err' : 'ok');
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
    const isProject = v.parent === PROJECTS_SLUG;
    const pg = {
      slug,
      title: v.title.trim(),
      icon: isProject ? '🚀' : '📄',
      cover: '',
      description: '',
      draft: !!v.draft,
      fullWidth: !!v.fullWidth,
      blocks: isProject ? projectTemplate() : [{ type: 'text', text: '' }],
    };
    content.pages.push(pg);
    Object.defineProperty(pg, '__new', { value: true, configurable: true }); // not serialized
    const carded = isProject && addProjectCard(pg);
    pageModal.hidden = true;
    view = 'page:' + slug;
    collapsed.clear();
    changed(true);
    toast(
      isProject
        ? `Created /${slug} from the project template${carded ? ' and added its card to Projects' : ''} — replace the sample texts.`
        : `Created /${slug}. Link to it from another page with a “Page links” block.`,
      'ok'
    );
  });

  // A subpage of /projects starts as a full case study: the sections every project page uses, with sample
  // texts to overwrite. Unneeded blocks are deleted with ✕.
  const PROJECTS_SLUG = 'projects';
  const projectTemplate = () => [
    { type: 'callout', icon: '📌', color: 'gray', text: '**Role:** Software Engineer\n**When:** 2026\n**Stack:** Python, FastAPI, PostgreSQL' },
    { type: 'text', text: 'What the project is, who uses it and which problem it solves — two or three sentences.\n\nThen what you built and the hardest part of it.' },
    { type: 'h1', text: 'Stack' },
    { type: 'badges', items: [{ label: 'Python', color: 'blue', url: '' }, { label: 'PostgreSQL', color: 'blue', url: '' }, { label: 'Docker', color: 'blue', url: '' }] },
    { type: 'h1', text: 'What I built' },
    {
      type: 'cards',
      columns: '2',
      items: [
        { icon: '⚙️', title: 'Main feature', desc: 'What it does for the user.', url: '' },
        { icon: '🛂', title: 'Admin tools', desc: 'What the admin can see and do.', url: '' },
      ],
    },
    { type: 'h1', text: 'Problems and how I solved them' },
    { type: 'toggle', open: true, title: 'The hardest problem', text: '**Problem.** What went wrong or what was hard.\n\n**Solution.** What you built, and the result (a number if you have one).' },
    { type: 'h1', text: 'In numbers' },
    {
      type: 'cards',
      columns: '3',
      items: [
        { icon: '🎯', title: '0 errors', desc: 'What the number measures.', url: '' },
        { icon: '⚡', title: '< 1 s', desc: 'What the number measures.', url: '' },
        { icon: '🧪', title: '100+ tests', desc: 'What the number measures.', url: '' },
      ],
    },
    { type: 'video', src: '', poster: '', caption: '', width: 'full' },
    { type: 'button', icon: '📬', label: 'Want something like this? Let’s talk', url: '/contact' },
  ];
  // Adds a card for a new project to the first gallery on /projects (unless one already links to it).
  function addProjectCard(pg) {
    const list = content.pages.find((p) => p.slug === PROJECTS_SLUG);
    const gallery = list && (list.blocks || []).find((b) => b.type === 'gallery');
    if (!gallery) return false;
    gallery.items = gallery.items || [];
    const url = '/' + pg.slug;
    if (gallery.items.some((i) => (i.url || '').replace(/\/+$/, '') === url)) return false;
    gallery.items.push({ image: '', title: pg.title, desc: '', tags: '', url });
    return true;
  }

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
        if (btn.dataset.kind === 'video') uploadVideo(btn.dataset.path);
        else upload(btn.dataset.path);
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
