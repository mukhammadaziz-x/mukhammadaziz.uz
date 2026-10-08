/* Shared renderer — used by the public site, the admin preview and the build script (scripts/build.js). */
(function (global) {
  'use strict';

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
  const unesc = (s) => s.replace(/&(amp|lt|gt|quot|#39);/g, (m) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" })[m]);

  // Only http(s), mailto, tel and relative URLs are allowed; anything else (javascript:, data:) becomes "#".
  function safeUrl(u) {
    u = String(u ?? '').trim();
    if (!u) return '#';
    const scheme = u.match(/^([a-z][a-z0-9+.-]*):/i);
    if (scheme && !/^(https?|mailto|tel)$/i.test(scheme[1])) return '#';
    return u;
  }

  // Image sources may also be blob: URLs (admin preview of freshly uploaded files).
  const src = (u) => (/^blob:/i.test(String(u ?? '')) ? esc(u) : esc(safeUrl(u)));

  const ORIGIN = typeof location !== 'undefined' ? location.origin : '';
  const isExternal = (u) => /^https?:\/\//i.test(u) && !(ORIGIN && u.startsWith(ORIGIN));
  const linkAttrs = (u) => {
    const url = safeUrl(u);
    return `href="${esc(url)}"` + (isExternal(url) || /\.pdf$/i.test(url) ? ' target="_blank" rel="noopener"' : '');
  };

  // Mini markdown: **bold**, *italic*, ~~strike~~, `code`, [text](url), ==highlight==
  function inline(s) {
    let h = esc(s);
    h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
    h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => `<a ${linkAttrs(unesc(u))}>${t}</a>`);
    h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    h = h.replace(/~~([^~]+)~~/g, '<s>$1</s>');
    h = h.replace(/==([^=]+)==/g, '<mark>$1</mark>');
    return h.replace(/\n/g, '<br>');
  }

  const paragraphs = (s) =>
    String(s ?? '')
      .split(/\n\s*\n/)
      .filter((p) => p.trim())
      .map((p) => `<p>${inline(p.trim())}</p>`)
      .join('');

  const slugify = (s) =>
    String(s ?? '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '');

  // Brands whose Simple Icons color is black — inverted in dark theme so they stay visible.
  const MONO = new Set(['github', 'x', 'notion', 'threads', 'medium', 'vercel', 'apple', 'tiktok', 'nextdotjs', 'express', 'githubcopilot', 'openai', 'unsplash']);

  // Icon value can be: an emoji/text, "si:<simple-icons slug>", or an image path/URL.
  function icon(v, cls = '') {
    v = String(v ?? '').trim();
    if (!v) return '';
    if (v.startsWith('si:')) {
      const slug = v.slice(3).replace(/[^a-z0-9./-]/gi, '');
      const mono = MONO.has(slug.split('/')[0]) ? ' ico-mono' : '';
      return `<img class="ico ${cls}${mono}" src="https://cdn.simpleicons.org/${slug}" alt="" loading="lazy">`;
    }
    if (isImage(v)) return `<img class="ico ${cls}" src="${src(v)}" alt="" loading="lazy">`;
    return `<span class="ico ${cls} ico-emoji">${esc(v)}</span>`;
  }
  const isImage = (v) => /^(https?:\/\/|blob:|\/|\.\/|assets\/)/i.test(v) || /\.(png|jpe?g|svg|gif|webp|avif|ico)(\?.*)?$/i.test(v);

  const color = (c) => (c && c !== 'default' ? ` c-${esc(c)}` : '');
  const wrap = (tag, url, cls, inner) =>
    url ? `<a class="${cls}" ${linkAttrs(url)}>${inner}</a>` : `<${tag} class="${cls}">${inner}</${tag}>`;
  const items = (b) => (Array.isArray(b.items) ? b.items : []);

  const BLOCKS = {
    h1: (b) => `<h1 class="b-h1" id="${slugify(b.text)}">${inline(b.text)}</h1>`,
    h2: (b) => `<h2 class="b-h2" id="${slugify(b.text)}">${inline(b.text)}</h2>`,
    h3: (b) => `<h3 class="b-h3" id="${slugify(b.text)}">${inline(b.text)}</h3>`,
    text: (b) => `<div class="b-text${color(b.color)}">${paragraphs(b.text)}</div>`,
    bullets: (b) => {
      const tag = b.ordered ? 'ol' : 'ul';
      const lis = String(b.text ?? '').split('\n').filter((l) => l.trim()).map((l) => `<li>${inline(l.replace(/^\s*[-*•]\s*/, ''))}</li>`);
      return `<${tag} class="b-list">${lis.join('')}</${tag}>`;
    },
    callout: (b) =>
      `<div class="b-callout${color(b.color || 'gray')}">${icon(b.icon || '💡', 'callout-ico')}<div class="callout-body">${paragraphs(b.text)}</div></div>`,
    quote: (b) =>
      `<blockquote class="b-quote">${paragraphs(b.text)}${b.author ? `<cite>— ${inline(b.author)}</cite>` : ''}</blockquote>`,
    toggle: (b) =>
      `<details class="b-toggle"${b.open ? ' open' : ''}><summary>${inline(b.title)}</summary><div class="toggle-body">${paragraphs(b.text)}</div></details>`,
    divider: () => `<hr class="b-divider">`,
    image: (b) =>
      `<figure class="b-image w-${esc(b.width || 'full')}"><img src="${src(b.src)}" alt="${esc(b.caption)}" loading="lazy">${b.caption ? `<figcaption>${inline(b.caption)}</figcaption>` : ''}</figure>`,
    links: (b) =>
      `<div class="b-links">${items(b)
        .map((i) =>
          wrap('div', i.url, 'link-card spot', `${icon(i.icon, 'link-ico')}<span class="link-main"><span class="link-label">${inline(i.label)}</span>${i.desc ? `<span class="link-desc">${inline(i.desc)}</span>` : ''}</span>${i.url ? '<span class="link-arrow">↗</span>' : ''}`)
        )
        .join('')}</div>`,
    cards: (b) =>
      `<div class="b-cards cols-${esc(b.columns || 3)}">${items(b)
        .map((i) => wrap('div', i.url, 'icon-card spot', `${icon(i.icon, 'card-ico')}<span class="card-title">${inline(i.title)}</span>${i.desc ? `<span class="card-desc">${inline(i.desc)}</span>` : ''}`))
        .join('')}</div>`,
    gallery: (b) =>
      `<div class="b-gallery cols-${esc(b.columns || 2)}">${items(b)
        .map((i) => {
          const tags = String(i.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean);
          return wrap(
            'div',
            i.url,
            'gallery-card spot',
            `<span class="gallery-cover">${i.image ? `<img src="${src(i.image)}" alt="" loading="lazy">` : ''}</span><span class="gallery-body"><span class="gallery-title">${inline(i.title)}</span>${i.desc ? `<span class="gallery-desc">${inline(i.desc)}</span>` : ''}${tags.length ? `<span class="gallery-tags">${tags.map((t, n) => `<span class="pill c-${PILLS[n % PILLS.length]}">${esc(t)}</span>`).join('')}</span>` : ''}</span>`
          );
        })
        .join('')}</div>`,
    badges: (b) => `<div class="b-badges">${items(b).map((i) => wrap('span', i.url, `pill${color(i.color || 'gray')}`, inline(i.label))).join('')}</div>`,
    inline: (b) =>
      `<div class="b-inline">${items(b).map((i) => wrap('span', i.url, 'inline-link', `${icon(i.icon, 'inline-ico')}<span>${inline(i.label)}</span>`)).join('')}</div>`,
    timeline: (b) =>
      `<ol class="b-timeline">${items(b)
        .map(
          (i) =>
            `<li><span class="tl-dot"></span><div class="tl-head"><span class="tl-title">${inline(i.title)}</span>${i.date ? `<span class="tl-date">${esc(i.date)}</span>` : ''}</div>${i.subtitle ? `<div class="tl-sub">${inline(i.subtitle)}</div>` : ''}${i.text ? `<div class="tl-text">${paragraphs(i.text)}</div>` : ''}</li>`
        )
        .join('')}</ol>`,
    progress: (b) =>
      `<div class="b-progress">${items(b)
        .map((i) => {
          const v = Math.max(0, Math.min(100, Number(i.value) || 0));
          return `<div class="pr-row"><div class="pr-head"><span>${inline(i.label)}</span><span class="pr-val">${v}%</span></div><div class="pr-track"><span class="pr-bar" style="--v:${v}%"></span></div></div>`;
        })
        .join('')}</div>`,
    button: (b) => `<div class="b-button"><a class="btn spot" ${linkAttrs(b.url)}>${icon(b.icon, 'btn-ico')}<span>${inline(b.label)}</span></a></div>`,
    // Contact form — submitted to Netlify Forms by site.js (form "contact" is declared statically in index.html).
    form: (b) =>
      `<form class="b-form" name="contact" method="POST" action="/" data-success="${esc(b.success || 'Thanks! Your message has been sent.')}">
        <input type="hidden" name="form-name" value="contact">
        <p class="hp" aria-hidden="true"><label>Leave empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
        <div class="form-row">
          <label><span>${esc(b.nameLabel || 'Name')}</span><input name="name" required autocomplete="name"></label>
          <label><span>${esc(b.emailLabel || 'Email')}</span><input name="email" type="email" required autocomplete="email"></label>
        </div>
        <label><span>${esc(b.messageLabel || 'Message')}</span><textarea name="message" rows="5" required></textarea></label>
        <div class="form-foot"><button class="btn spot" type="submit">${esc(b.button || 'Send message')}</button><span class="form-status" role="status"></span></div>
      </form>`,
  };
  const PILLS = ['blue', 'purple', 'green', 'orange', 'pink', 'yellow', 'red', 'brown'];

  function renderBlocks(blocks, revealed) {
    return (Array.isArray(blocks) ? blocks : [])
      .map((b) => {
        const fn = BLOCKS[b && b.type];
        if (!fn) return '';
        try {
          return `<div class="block block-${b.type}${revealed ? ' in' : ''}">${fn(b)}</div>`;
        } catch (e) {
          console.warn('Block render failed', b, e);
          return '';
        }
      })
      .join('');
  }

  /* ---------- page shell (navbar, cover, header, footer, meta) ---------- */
  const RESERVED = ['admin', 'assets', 'data', 'scripts', 'dist', 'sitemap.xml', 'robots.txt', '404'];
  const pagePath = (slug) => (slug ? '/' + slug : '/');
  const cleanPath = (u) => String(u || '').split('#')[0].replace(/\/+$/, '') || '/';

  function findPage(content, slug) {
    return (content.pages || []).find((p) => (p.slug || '') === (slug || '')) || null;
  }

  // Returns every dynamic piece of a page as HTML strings, so the browser and the build script render identically.
  function renderShell(content, slug, opts = {}) {
    const site = content.site || {};
    const home = findPage(content, '');
    let page = findPage(content, slug);
    const found = !!page;
    if (!page) {
      page = { slug, title: 'Page not found', icon: '🫥', cover: '', blocks: [{ type: 'text', text: "This page doesn't exist. [Go home →](/)" }] };
    }
    const here = pagePath(found ? page.slug : null);
    const ico = page.icon || '';
    const year = new Date().getFullYear();

    const navLinks = (site.nav || [])
      .map((n) => {
        const url = safeUrl(n.url);
        const active = found && !/^https?:/i.test(url) && !url.includes('#') && cleanPath(url) === here;
        return `<a class="nav-link${n.highlight ? ' nav-cta' : ''}${active ? ' active' : ''}" ${linkAttrs(n.url)}${active ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`;
      })
      .join('');

    const coverHidden = page.cover === 'none';
    const cover = page.cover && !coverHidden
      ? `<img src="${src(page.cover)}" alt="">`
      : '<span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span>';

    const crumbs = page.slug && home
      ? `<a href="/">${icon(home.icon, 'crumb-ico')}${esc(home.title)}</a><span class="crumb-sep">/</span><span>${icon(page.icon, 'crumb-ico')}${esc(page.title)}</span>`
      : '';

    const plain = (s) => String(s || '').replace(/[*_`~=]|\[([^\]]*)\]\([^)]*\)/g, '$1');
    return {
      found,
      page,
      navBrand: `${icon(site.brandIcon, 'brand-ico')}<span>${esc(site.brandText || site.title)}</span>`,
      navLinks,
      coverHidden,
      coverGradient: !page.cover,
      cover,
      crumbs,
      iconHtml: ico ? icon(ico, isImage(ico) ? 'page-ico-img' : '') : '',
      titleHtml: inline(page.title || ''),
      hideTitle: !!page.hideTitle,
      blocks: renderBlocks(page.blocks, opts.revealed),
      footer: inline(String(site.footer || '').replace(/\{year\}/g, year)),
      meta: {
        title: !found ? `Not found · ${site.title || ''}` : page.slug ? `${plain(page.title)} · ${site.title || ''}` : site.title || plain(page.title),
        description: page.description || site.description || '',
        image: site.image || '',
        path: here,
      },
    };
  }

  global.NZ = { esc, safeUrl, src, inline, icon, isImage, slugify, renderBlocks, renderShell, findPage, pagePath, RESERVED, BLOCK_TYPES: Object.keys(BLOCKS) };
})(typeof window !== 'undefined' ? window : globalThis);
