/* Public site runtime: client-side navigation between pages, search, image zoom, theme, contact form. */
(function () {
  'use strict';
  const { renderShell, searchIndex, icon, esc } = window.NZ;
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const PREVIEW = params.has('preview');
  let content = null;

  /* ---------- theme ---------- */
  const root = document.documentElement;
  function applyTheme(t) {
    root.classList.remove('theme-dark', 'theme-light');
    root.classList.add('theme-' + t);
  }
  $('#theme-toggle').addEventListener('click', () => {
    const next = root.classList.contains('theme-dark') ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('color-preference', next); } catch (e) {}
  });

  /* ---------- routing ---------- */
  function currentSlug() {
    if (params.has('p')) return params.get('p');
    return decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g, '').replace(/(^|\/)index(\.html)?$/, '').replace(/\.html$/, ''));
  }

  /* ---------- render ---------- */
  function setMeta(sel, attr, value) {
    const el = document.querySelector(sel);
    if (el) el.setAttribute(attr, value);
  }

  function render() {
    const site = content.site || {};
    const v = renderShell(content, currentSlug(), { preview: PREVIEW });

    $('#nav-brand').innerHTML = v.navBrand;
    $('#nav-links').innerHTML = v.navLinks;
    $('#crumbs').innerHTML = v.crumbs;
    $('#footer').innerHTML = v.footer;
    $('#footer').hidden = !v.footer;

    const cover = $('#cover');
    cover.hidden = v.coverHidden;
    cover.className = 'cover' + (v.coverGradient ? ' cover-gradient' : '') + (v.coverCollage ? ' cover-collage' : '');
    cover.innerHTML = v.cover;
    $('#page').className = 'page' + (v.fullWidth ? ' full' : '');
    $('#page-head').className = 'page-head' + (v.coverHidden ? '' : ' has-cover') + (v.iconHtml ? '' : ' no-icon');
    $('#page-icon').innerHTML = v.iconHtml;
    $('#page-icon').hidden = !v.iconHtml;
    $('#page-title').innerHTML = v.titleHtml;
    $('#page-title').hidden = v.hideTitle;
    $('#blocks').innerHTML = v.blocks;

    document.title = v.meta.title;
    setMeta('meta[name="description"]', 'content', v.meta.description);
    setMeta('meta[property="og:title"]', 'content', v.meta.title);
    setMeta('meta[property="og:description"]', 'content', v.meta.description);
    if (site.url) {
      setMeta('link[rel="canonical"]', 'href', site.url.replace(/\/+$/, '') + v.meta.path);
      setMeta('meta[property="og:url"]', 'content', site.url.replace(/\/+$/, '') + v.meta.path);
    }

    let saved = null;
    try { saved = localStorage.getItem('color-preference'); } catch (e) {}
    if (!PREVIEW && site.defaultTheme && !saved) applyTheme(site.defaultTheme);
    document.body.classList.remove('menu-open');
    index = null;
    reveal();
  }

  /* ---------- navigation ---------- */
  // Internal page links are handled without a full reload.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    const url = new URL(a.getAttribute('href'), location.href);
    if (url.origin !== location.origin || /\.[a-z0-9]+$/i.test(url.pathname)) return;
    if (url.hash && url.pathname === location.pathname && !PREVIEW) return;
    if (!content) return;
    e.preventDefault();
    go(url.pathname, url.hash);
  });
  function go(pathname, hash = '') {
    if (PREVIEW) {
      params.set('p', pathname.replace(/^\/+|\/+$/g, ''));
      // Let the admin panel follow along (it opens the same page in the editor).
      parent.postMessage({ type: 'nz-navigate', slug: params.get('p') }, location.origin);
    } else history.pushState({}, '', pathname + hash);
    render();
    scrollToHash(hash);
  }
  window.addEventListener('popstate', () => { render(); scrollToHash(location.hash); });

  function scrollToHash(hash) {
    const el = hash && document.getElementById(decodeURIComponent(hash.slice(1)));
    if (el) el.scrollIntoView();
    else window.scrollTo(0, 0);
  }

  /* ---------- search (Ctrl+K, "/", or the magnifier) ---------- */
  const search = $('#search');
  const input = $('#search-input');
  const results = $('#search-results');
  let index = null;
  let hits = [];
  let sel = 0;

  function openSearch() {
    if (!content) return;
    index = index || searchIndex(content, PREVIEW);
    search.hidden = false;
    document.body.classList.add('search-open');
    input.value = '';
    runSearch();
    setTimeout(() => input.focus(), 0);
  }
  function closeSearch() {
    search.hidden = true;
    document.body.classList.remove('search-open');
  }
  const mark = (text, q) => {
    if (!q) return esc(text);
    const i = text.toLowerCase().indexOf(q);
    return i < 0 ? esc(text) : esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  };
  function runSearch() {
    const q = input.value.trim().toLowerCase();
    hits = index
      .map((p) => {
        const t = p.title.toLowerCase();
        const body = p.text.toLowerCase();
        const score = !q ? 1 : t === q ? 100 : t.startsWith(q) ? 60 : t.includes(q) ? 40 : body.includes(q) ? 10 : 0;
        let snippet = '';
        if (q && score === 10) {
          const i = body.indexOf(q);
          snippet = p.text.slice(Math.max(0, i - 40), i + 80).replace(/\s+/g, ' ').trim();
        }
        return { p, score, snippet };
      })
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
    sel = 0;
    results.innerHTML = hits.length
      ? hits
          .map(
            (h, i) => `<a class="sr${i === sel ? ' sel' : ''}" href="${esc(h.p.slug ? '/' + h.p.slug : '/')}">
              <span class="sr-ico">${h.p.icon ? icon(h.p.icon, 'sr-icon') : window.NZ.DOC_ICON}</span>
              <span class="sr-main"><span class="sr-title">${mark(h.p.title, q)}</span>
              ${h.snippet ? `<span class="sr-snip">…${mark(h.snippet, q)}…</span>` : h.p.path ? `<span class="sr-snip">${esc(h.p.path)}</span>` : ''}</span>
              <span class="sr-enter">↵</span></a>`
          )
          .join('')
      : `<div class="sr-empty">No results for “${esc(input.value)}”</div>`;
  }
  function moveSel(d) {
    if (!hits.length) return;
    sel = (sel + d + hits.length) % hits.length;
    results.querySelectorAll('.sr').forEach((el, i) => el.classList.toggle('sel', i === sel));
    results.querySelector('.sr.sel').scrollIntoView({ block: 'nearest' });
  }
  input.addEventListener('input', runSearch);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(-1); }
    if (e.key === 'Enter' && hits[sel]) { e.preventDefault(); closeSearch(); go(hits[sel].p.slug ? '/' + hits[sel].p.slug : '/'); }
  });
  results.addEventListener('click', () => closeSearch());
  search.addEventListener('click', (e) => { if (e.target === search) closeSearch(); });
  $('#search-toggle').addEventListener('click', openSearch);
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); openSearch(); }
    if (e.key === 'Escape') { closeSearch(); closeZoom(); }
  });

  /* ---------- image zoom ---------- */
  let zoom = null;
  document.addEventListener('click', (e) => {
    const img = e.target.closest('img[data-zoom]');
    if (!img) return;
    zoom = document.createElement('div');
    zoom.className = 'zoom';
    zoom.innerHTML = `<img src="${esc(img.currentSrc || img.src)}" alt="${esc(img.alt)}">`;
    zoom.addEventListener('click', closeZoom);
    document.body.appendChild(zoom);
    requestAnimationFrame(() => zoom && zoom.classList.add('on'));
  });
  function closeZoom() {
    if (!zoom) return;
    const z = zoom;
    zoom = null;
    z.classList.remove('on');
    setTimeout(() => z.remove(), 200);
  }

  /* ---------- small interactions ---------- */
  // Spotlight that follows the cursor on cards.
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest && e.target.closest('.spot');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', e.clientX - r.left + 'px');
    el.style.setProperty('--my', e.clientY - r.top + 'px');
  });

  // Reading progress bar.
  const bar = $('#progress');
  const onScroll = () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`;
    document.body.classList.toggle('scrolled', scrollY > 8);
  };
  addEventListener('scroll', onScroll, { passive: true });

  // Fade blocks in as they enter the viewport.
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => es.forEach((en) => en.isIntersecting && (en.target.classList.add('in'), io.unobserve(en.target))), { rootMargin: '0px 0px -40px 0px' })
    : null;
  function reveal() {
    document.querySelectorAll('#blocks .block').forEach((b, i) => {
      if (!io || PREVIEW) return b.classList.add('in');
      b.style.transitionDelay = Math.min(i, 8) * 25 + 'ms';
      io.observe(b);
    });
    onScroll();
  }

  // Mobile menu.
  $('#menu-toggle').addEventListener('click', () => document.body.classList.toggle('menu-open'));

  // Contact form → Netlify Forms.
  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('.b-form');
    if (!form) return;
    e.preventDefault();
    const status = form.querySelector('.form-status');
    const btn = form.querySelector('button[type="submit"]');
    if (PREVIEW) {
      status.textContent = 'The form works on the live site.';
      return;
    }
    btn.disabled = true;
    status.className = 'form-status';
    status.textContent = 'Sending…';
    try {
      const r = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString(),
      });
      if (!r.ok) throw new Error(r.status);
      form.reset();
      status.classList.add('ok');
      status.textContent = form.dataset.success;
    } catch (err) {
      status.classList.add('err');
      status.textContent = 'Could not send the message. Please write to me directly.';
    } finally {
      btn.disabled = false;
    }
  });

  /* ---------- boot ---------- */
  if (PREVIEW) {
    // The admin panel pushes the draft content into this iframe.
    window.addEventListener('message', (e) => {
      if (e.origin !== location.origin || !e.data || e.data.type !== 'nz-preview') return;
      content = e.data.content;
      if (e.data.slug !== undefined) params.set('p', e.data.slug);
      render();
    });
    parent.postMessage({ type: 'nz-ready' }, location.origin);
  } else if ($('#nz-data')) {
    // Pre-rendered by scripts/build.js: the HTML is already in place, only keep the content for navigation and search.
    content = JSON.parse($('#nz-data').textContent);
    onScroll();
  } else {
    fetch('/data/content.json', { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then((c) => {
        content = c;
        render();
        if (location.hash) scrollToHash(location.hash);
      })
      .catch((err) => {
        console.error(err);
        $('#page-title').textContent = 'Could not load content';
      });
  }
})();
