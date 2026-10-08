/* Public site runtime: loads data/content.json, routes between pages, theme toggle, small interactions. */
(function () {
  'use strict';
  const { renderShell } = window.NZ;
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
    return decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g, '').replace(/(^|\/)index\.html$/, ''));
  }

  /* ---------- render ---------- */
  function setMeta(sel, attr, value) {
    const el = document.querySelector(sel);
    if (el) el.setAttribute(attr, value);
  }

  function render() {
    const site = content.site || {};
    const v = renderShell(content, currentSlug());

    $('#nav-brand').innerHTML = v.navBrand;
    $('#nav-links').innerHTML = v.navLinks;
    $('#footer').innerHTML = v.footer;

    const cover = $('#cover');
    cover.hidden = v.coverHidden;
    cover.classList.toggle('cover-gradient', v.coverGradient);
    cover.innerHTML = v.cover;
    $('#page-head').classList.toggle('has-cover', !v.coverHidden);
    $('#page-head').classList.toggle('no-icon', !v.iconHtml);
    $('#page-icon').innerHTML = v.iconHtml;
    $('#page-icon').hidden = !v.iconHtml;
    $('#page-title').innerHTML = v.titleHtml;
    $('#page-title').hidden = v.hideTitle;
    $('#crumbs').innerHTML = v.crumbs;
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
    reveal();
  }

  /* ---------- interactions ---------- */
  // SPA navigation for internal page links.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    const url = new URL(a.getAttribute('href'), location.href);
    if (url.origin !== location.origin || /\.[a-z0-9]+$/i.test(url.pathname)) return;
    if (url.hash && url.pathname === location.pathname) return;
    e.preventDefault();
    if (PREVIEW) params.set('p', url.pathname.replace(/^\/+|\/+$/g, ''));
    else history.pushState({}, '', url.pathname + url.hash);
    render();
    scrollToHash(url.hash);
  });
  window.addEventListener('popstate', () => { render(); scrollToHash(location.hash); });

  function scrollToHash(hash) {
    const el = hash && document.getElementById(decodeURIComponent(hash.slice(1)));
    if (el) el.scrollIntoView();
    else window.scrollTo(0, 0);
  }

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
      b.style.transitionDelay = Math.min(i, 8) * 30 + 'ms';
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
    // Admin panel pushes the draft content into this iframe.
    window.addEventListener('message', (e) => {
      if (e.origin !== location.origin || !e.data || e.data.type !== 'nz-preview') return;
      content = e.data.content;
      if (e.data.slug !== undefined) params.set('p', e.data.slug);
      if (e.data.theme) applyTheme(e.data.theme);
      render();
    });
    parent.postMessage({ type: 'nz-ready' }, location.origin);
  } else if ($('#nz-data')) {
    // Pre-rendered by scripts/build.js: the HTML is already in place, only keep the content for client-side navigation.
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
