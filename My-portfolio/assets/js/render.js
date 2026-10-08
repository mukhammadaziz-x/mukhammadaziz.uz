/* Shared renderer — used by the public site, the admin preview and the build script (scripts/build.js). */
(function (global) {
  'use strict';

  /* ================= escaping & urls ================= */
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

  /* ================= text ================= */
  // Mini markdown: **bold**, *italic*, ~~strike~~, `code`, [text](url), ==highlight==
  function inline(s) {
    let h = esc(s);
    h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
    h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => `<a ${linkAttrs(unesc(u))}>${t}</a>`);
    h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    h = h.replace(/~~([^~]+)~~/g, '<s>$1</s>');
    h = h.replace(/==([^=]+)==/g, '<mark>$1</mark>');
    return h.replace(/\n/g, '<br>');
  }

  // Paragraphs (blank line = new paragraph) plus "- item" / "1. item" lists.
  function richText(s) {
    let out = '';
    let para = [];
    let list = null;
    const flushP = () => {
      if (para.length) out += `<p>${inline(para.join('\n'))}</p>`;
      para = [];
    };
    const flushL = () => {
      if (list) out += `<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`;
      list = null;
    };
    for (const line of String(s ?? '').split('\n')) {
      const m = line.match(/^\s*(?:([-*•])|(\d+)[.)])\s+(.*)$/);
      if (m) {
        flushP();
        const tag = m[1] ? 'ul' : 'ol';
        if (!list || list.tag !== tag) {
          flushL();
          list = { tag, items: [] };
        }
        list.items.push(m[3]);
      } else if (!line.trim()) {
        flushP();
        flushL();
      } else {
        flushL();
        para.push(line);
      }
    }
    flushP();
    flushL();
    return out;
  }

  const slugify = (s) =>
    String(s ?? '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '');

  /* ================= icons ================= */
  // Brands whose Simple Icons color is black — inverted in dark theme so they stay visible.
  const MONO = new Set(['github', 'x', 'notion', 'threads', 'medium', 'vercel', 'apple', 'tiktok', 'nextdotjs', 'express', 'githubcopilot', 'openai', 'unsplash']);
  const DOC_ICON = '<svg class="ico ico-doc" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.4 1.5h4.9l3.2 3.2v8.4c0 .8-.6 1.4-1.4 1.4H4.4c-.8 0-1.4-.6-1.4-1.4V2.9c0-.8.6-1.4 1.4-1.4z" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="M9.2 1.6v3.2h3.2M5.3 7.6h5.4M5.3 9.9h5.4M5.3 12.1h3.4" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>';

  const isImage = (v) => /^(https?:\/\/|blob:|\/|\.\/|assets\/)/i.test(v) || /\.(png|jpe?g|svg|gif|webp|avif|ico)(\?.*)?$/i.test(v);

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

  /* ================= render context (pages, drafts) ================= */
  let CTX = { pages: new Map(), preview: false };
  const slugOf = (url) => decodeURIComponent(String(url).split(/[?#]/)[0].replace(/^\/+|\/+$/g, ''));
  // The page an internal link like "/python" points to, if any.
  const pageOf = (url) => (/^\/(?!\/)/.test(String(url || '')) ? CTX.pages.get(slugOf(url)) || null : null);
  const isPublicPage = (p) => !!p && !p.draft;
  // Internal page links ("/python", not "/#section" or "/file.pdf").
  const isPageLink = (url) => /^\/[^#?.]+$/.test(String(url || '').trim());
  // Links to draft pages — and to pages that don't exist (drafts are stripped from the published content) —
  // are hidden on the public site; the admin preview shows them with a "draft" mark.
  const hidden = (url) => {
    if (CTX.preview) return false;
    const p = pageOf(url);
    return p ? !!p.draft : isPageLink(url);
  };
  const draftMark = (url) => {
    const p = pageOf(url);
    return p && p.draft ? '<span class="draft-pill">draft</span>' : '';
  };
  const visible = (list) => (Array.isArray(list) ? list : []).filter((i) => i && !hidden(i.url));

  /* ================= blocks ================= */
  const color = (c) => (c && c !== 'default' ? ` c-${esc(c)}` : '');
  const wrap = (tag, url, cls, inner) =>
    url ? `<a class="${cls}" ${linkAttrs(url)}>${inner}</a>` : `<${tag} class="${cls}">${inner}</${tag}>`;
  const PILLS = ['blue', 'purple', 'green', 'orange', 'pink', 'yellow', 'red', 'brown'];
  const hashColor = (s) => {
    let h = 0;
    for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return PILLS[h % PILLS.length];
  };
  const splitTags = (s) => String(s ?? '').split(',').map((t) => t.trim()).filter(Boolean);
  const heading = (tag, b) =>
    `<${tag} class="b-${tag}${b.underline ? ' b-hline' : ''}" id="${slugify(b.text)}">${inline(b.text)}</${tag}>`;

  const BLOCKS = {
    h1: (b) => heading('h1', b),
    h2: (b) => heading('h2', b),
    h3: (b) => heading('h3', b),
    text: (b) => `<div class="b-text${color(b.color)}">${richText(b.text)}</div>`,
    bullets: (b) => {
      const tag = b.ordered ? 'ol' : 'ul';
      const lis = String(b.text ?? '').split('\n').filter((l) => l.trim()).map((l) => `<li>${inline(l.replace(/^\s*[-*•]\s*/, ''))}</li>`);
      return `<${tag} class="b-list">${lis.join('')}</${tag}>`;
    },
    callout: (b) =>
      `<div class="b-callout${color(b.color)}${b.icon ? '' : ' no-icon'}">${icon(b.icon, 'callout-ico')}<div class="callout-body">${richText(b.text)}${renderBlocks(b.children)}</div></div>`,
    quote: (b) => `<blockquote class="b-quote">${richText(b.text)}${b.author ? `<cite>— ${inline(b.author)}</cite>` : ''}</blockquote>`,
    toggle: (b) =>
      `<details class="b-toggle"${b.open ? ' open' : ''}><summary>${inline(b.title)}</summary><div class="toggle-body">${richText(b.text)}${renderBlocks(b.children)}</div></details>`,
    divider: () => `<hr class="b-divider">`,
    image: (b) =>
      b.src
        ? `<figure class="b-image w-${esc(b.width || 'full')}"><img src="${src(b.src)}" alt="${esc(b.caption)}" loading="lazy" data-zoom>${b.caption ? `<figcaption>${inline(b.caption)}</figcaption>` : ''}</figure>`
        : '',
    bookmark: (b) => {
      let host = '';
      try { host = new URL(b.url).hostname; } catch (e) {}
      return `<a class="b-bookmark spot" ${linkAttrs(b.url)}>
        <span class="bm-body"><span class="bm-title">${esc(b.title || host || b.url)}</span>${b.desc ? `<span class="bm-desc">${esc(b.desc)}</span>` : ''}
        <span class="bm-url">${host ? `<img src="https://www.google.com/s2/favicons?domain=${esc(host)}&amp;sz=32" alt="" loading="lazy">` : ''}<span>${esc(b.url)}</span></span></span>
        ${b.image ? `<span class="bm-img"><img src="${src(b.image)}" alt="" loading="lazy"></span>` : ''}</a>`;
    },
    button: (b) => `<div class="b-button"><a class="btn spot" ${linkAttrs(b.url)}>${icon(b.icon, 'btn-ico')}<span>${inline(b.label)}</span></a></div>`,

    // Notion-style list of page links / external links: icon, optional muted prefix, underlined label.
    linklist: (b) =>
      `<div class="b-linklist">${visible(b.items)
        .map((i) => {
          const p = pageOf(i.url);
          const ico = i.icon || (p && p.icon) || (p ? 'doc' : '');
          const label = i.label || (p && p.title) || i.url;
          return wrap(
            'div',
            i.url,
            'll-item',
            `${ico === 'doc' ? DOC_ICON : icon(ico, 'll-ico')}${i.prefix ? `<span class="ll-prefix">${inline(i.prefix)}</span>` : ''}<span class="ll-label">${inline(label)}</span>${draftMark(i.url)}`
          );
        })
        .join('')}</div>`,
    links: (b) =>
      `<div class="b-links">${visible(b.items)
        .map((i) =>
          wrap('div', i.url, 'link-card spot', `${icon(i.icon, 'link-ico')}<span class="link-main"><span class="link-label">${inline(i.label)}</span>${i.desc ? `<span class="link-desc">${inline(i.desc)}</span>` : ''}</span>${i.url ? '<span class="link-arrow">↗</span>' : ''}`)
        )
        .join('')}</div>`,
    cards: (b) =>
      `<div class="b-cards cols-${esc(b.columns || 3)}">${visible(b.items)
        .map((i) => wrap('div', i.url, 'icon-card spot', `${icon(i.icon, 'card-ico')}<span class="card-title">${inline(i.title)}${draftMark(i.url)}</span>${i.desc ? `<span class="card-desc">${inline(i.desc)}</span>` : ''}`))
        .join('')}</div>`,
    gallery: (b) =>
      `<div class="b-gallery cols-${esc(b.columns || 2)}">${visible(b.items)
        .map((i) => {
          const tags = splitTags(i.tags);
          return wrap(
            'div',
            i.url,
            'gallery-card spot',
            `<span class="gallery-cover">${i.image ? `<img src="${src(i.image)}" alt="" loading="lazy">` : ''}</span><span class="gallery-body"><span class="gallery-title">${inline(i.title)}${draftMark(i.url)}</span>${i.desc ? `<span class="gallery-desc">${inline(i.desc)}</span>` : ''}${tags.length ? `<span class="gallery-tags">${tags.map((t) => `<span class="pill c-${hashColor(t)}">${esc(t)}</span>`).join('')}</span>` : ''}</span>`
          );
        })
        .join('')}</div>`,
    badges: (b) => `<div class="b-badges">${visible(b.items).map((i) => wrap('span', i.url, `pill${color(i.color || 'gray')}`, inline(i.label))).join('')}</div>`,
    inline: (b) =>
      `<div class="b-inline">${visible(b.items).map((i) => wrap('span', i.url, 'inline-link', `${icon(i.icon, 'inline-ico')}<span>${inline(i.label)}</span>`)).join('')}</div>`,
    timeline: (b) =>
      `<ol class="b-timeline">${visible(b.items)
        .map(
          (i) =>
            `<li><span class="tl-dot"></span><div class="tl-head"><span class="tl-title">${inline(i.title)}</span>${i.date ? `<span class="tl-date">${esc(i.date)}</span>` : ''}</div>${i.subtitle ? `<div class="tl-sub">${inline(i.subtitle)}</div>` : ''}${i.text ? `<div class="tl-text">${richText(i.text)}</div>` : ''}</li>`
        )
        .join('')}</ol>`,
    progress: (b) =>
      `<div class="b-progress">${visible(b.items)
        .map((i) => {
          const v = Math.max(0, Math.min(100, Number(i.value) || 0));
          return `<div class="pr-row"><div class="pr-head"><span>${inline(i.label)}</span><span class="pr-val">${v}%</span></div><div class="pr-track"><span class="pr-bar" style="--v:${v}%"></span></div></div>`;
        })
        .join('')}</div>`,

    // Notion database (table view): Name · Tags · Note.
    database: (b) => {
      const rows = visible(b.items);
      const colorsMap = {};
      String(b.tagColors ?? '').split(',').forEach((pair) => {
        const [k, c] = pair.split('=').map((x) => (x || '').trim());
        if (k && PILLS.concat('gray').includes(c)) colorsMap[k.toLowerCase()] = c;
      });
      const hasTags = rows.some((r) => splitTags(r.tags).length);
      const hasNote = rows.some((r) => String(r.note ?? '').trim());
      const pill = (t) => `<span class="pill c-${colorsMap[t.toLowerCase()] || hashColor(t)}">${esc(t)}</span>`;
      const body = rows
        .map((r) => {
          const p = pageOf(r.url);
          const ico = r.icon || (p && p.icon);
          const name = `${ico ? icon(ico, 'db-ico') : DOC_ICON}<span>${inline(r.name || (p && p.title) || 'Untitled')}</span>${draftMark(r.url)}`;
          return `<tr><td class="db-name">${r.url ? `<a ${linkAttrs(r.url)}>${name}</a>` : `<span class="db-name-in">${name}</span>`}</td>${hasTags ? `<td class="db-tags">${splitTags(r.tags).map(pill).join('')}</td>` : ''}${hasNote ? `<td class="db-note">${inline(r.note)}</td>` : ''}</tr>`;
        })
        .join('');
      return `<div class="b-db">${b.title ? `<div class="db-title"><svg viewBox="0 0 16 16" class="ico" aria-hidden="true"><path d="M2 3.5h12v9H2zM2 6.5h12M2 9.5h12M6.5 3.5v9" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>${esc(b.title)}</div>` : ''}<div class="db-scroll"><table class="db-table"><thead><tr><th><span class="th-ico">Aa</span>${esc(b.nameLabel || 'Name')}</th>${hasTags ? `<th><span class="th-ico">☰</span>${esc(b.tagsLabel || 'Tags')}</th>` : ''}${hasNote ? `<th><span class="th-ico">≡</span>${esc(b.noteLabel || 'Note')}</th>` : ''}</tr></thead><tbody>${body}</tbody></table></div></div>`;
    },

    columns: (b) => {
      const cols = Array.isArray(b.columns) ? b.columns : [];
      return `<div class="b-columns" style="--cols:${cols.length || 1}">${cols.map((c) => `<div class="b-col">${renderBlocks(c && c.blocks)}</div>`).join('')}</div>`;
    },

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

  let REVEALED = false;
  function renderBlocks(blocks) {
    return (Array.isArray(blocks) ? blocks : [])
      .map((b) => {
        const fn = BLOCKS[b && b.type];
        if (!fn) return '';
        try {
          const html = fn(b);
          return html ? `<div class="block block-${b.type}${REVEALED ? ' in' : ''}">${html}</div>` : '';
        } catch (e) {
          console.warn('Block render failed', b, e);
          return '';
        }
      })
      .join('');
  }

  /* ================= page shell (navbar, cover, header, footer, meta) ================= */
  // First URL segments that pages may not use (they collide with files or routes).
  const RESERVED = ['admin', 'assets', 'data', 'scripts', 'dist', 'p', 'api', 'sitemap.xml', 'robots.txt', '404', 'index'];
  const pagePath = (slug) => (slug ? '/' + slug : '/');
  const cleanPath = (u) => String(u || '').split('#')[0].replace(/\/+$/, '') || '/';
  const findPage = (content, slug) => (content.pages || []).find((p) => (p.slug || '') === (slug || '')) || null;
  const coverList = (c) => String(c ?? '').split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);

  // Returns every dynamic piece of a page as HTML strings, so the browser and the build script render identically.
  function renderShell(content, slug, opts = {}) {
    CTX = { pages: new Map((content.pages || []).map((p) => [p.slug || '', p])), preview: !!opts.preview };
    REVEALED = !!opts.revealed;
    const site = content.site || {};
    let page = findPage(content, slug);
    if (page && page.draft && !opts.preview) page = null;
    const found = !!page;
    if (!page) page = { slug, title: 'Page not found', icon: '🫥', cover: 'none', blocks: [{ type: 'text', text: "This page doesn't exist (yet). [Go home →](/)" }] };

    const here = pagePath(found ? page.slug : null);
    const year = new Date().getFullYear();

    const navLinks = (site.nav || [])
      .filter((n) => !hidden(n.url))
      .map((n) => {
        const url = safeUrl(n.url);
        const active = found && !/^https?:/i.test(url) && !url.includes('#') && cleanPath(url) === here;
        return `<a class="nav-link${n.highlight ? ' nav-cta' : ''}${active ? ' active' : ''}" ${linkAttrs(n.url)}${active ? ' aria-current="page"' : ''}>${icon(n.icon, 'nav-ico')}<span>${esc(n.label)}</span></a>`;
      })
      .join('');

    const covers = coverList(page.cover);
    const coverHidden = covers[0] === 'none';
    const cover = coverHidden
      ? ''
      : covers.length
        ? covers.map((c) => `<img src="${src(c)}" alt="">`).join('')
        : '<span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span>';

    // Breadcrumbs follow the URL: /python/decorators → Home / Python / Decorators.
    const chain = [];
    if (found && page.slug) {
      const parts = page.slug.split('/');
      chain.push(CTX.pages.get(''));
      for (let i = 1; i <= parts.length; i++) chain.push(CTX.pages.get(parts.slice(0, i).join('/')));
    }
    const crumbs = chain
      .filter(Boolean)
      .map((p, i, arr) => {
        const label = `${p.icon ? icon(p.icon, 'crumb-ico') : ''}<span>${esc(p.title)}</span>`;
        return i === arr.length - 1 ? `<span class="crumb">${label}</span>` : `<a class="crumb" href="${esc(pagePath(p.slug))}">${label}</a>`;
      })
      .join('<span class="crumb-sep">/</span>');

    const ico = page.icon || '';
    const plain = (s) => String(s || '').replace(/[*_`~=]|\[([^\]]*)\]\([^)]*\)/g, '$1');
    return {
      found,
      page,
      fullWidth: !!page.fullWidth,
      navBrand: `${icon(site.brandIcon, 'brand-ico')}<span>${esc(site.brandText || site.title)}</span>`,
      navLinks,
      coverHidden,
      coverGradient: !covers.length,
      coverCollage: covers.length > 1,
      cover,
      crumbs,
      iconHtml: ico ? icon(ico, isImage(ico) ? 'page-ico-img' : '') : '',
      titleHtml: inline(page.title || '') + (page.draft ? '<span class="draft-pill big">draft</span>' : ''),
      hideTitle: !!page.hideTitle,
      blocks: renderBlocks(page.blocks),
      footer: inline(String(site.footer || '').replace(/\{year\}/g, year)),
      meta: {
        title: !found ? `Not found · ${site.title || ''}` : page.slug ? `${plain(page.title)} · ${site.title || ''}` : site.title || plain(page.title),
        description: page.description || site.description || '',
        image: site.image || '',
        path: here,
      },
    };
  }

  /* ================= search ================= */
  const SKIP_KEYS = new Set(['type', 'url', 'icon', 'image', 'src', 'color', 'width', 'tagColors', 'cover']);
  function collectText(node, out) {
    if (typeof node === 'string') out.push(node);
    else if (Array.isArray(node)) node.forEach((n) => collectText(n, out));
    else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) if (!SKIP_KEYS.has(k)) collectText(v, out);
    return out;
  }
  function searchIndex(content, preview) {
    const pages = new Map((content.pages || []).map((p) => [p.slug || '', p]));
    return (content.pages || [])
      .filter((p) => preview || !p.draft)
      .map((p) => {
        const parts = (p.slug || '').split('/');
        const parents = parts.slice(0, -1).map((_, i) => pages.get(parts.slice(0, i + 1).join('/'))).filter(Boolean);
        return {
          slug: p.slug || '',
          title: p.title || 'Untitled',
          icon: p.icon || '',
          path: parents.map((x) => x.title).join(' / '),
          text: collectText(p.blocks, []).join(' \n ').replace(/[*_`=~#]|\]\([^)]*\)|\[/g, ''),
        };
      });
  }

  global.NZ = { esc, safeUrl, src, inline, richText, icon, isImage, slugify, renderBlocks, renderShell, searchIndex, findPage, pagePath, isPublicPage, RESERVED, DOC_ICON, BLOCK_TYPES: Object.keys(BLOCKS) };
})(typeof window !== 'undefined' ? window : globalThis);
