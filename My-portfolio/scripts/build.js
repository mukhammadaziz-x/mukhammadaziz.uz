#!/usr/bin/env node
/*
 * Pre-renders every page from data/content.json into dist/:
 *   /            → dist/index.html
 *   /<slug>      → dist/<slug>/index.html
 *   (not found)  → dist/404.html
 * plus sitemap.xml and robots.txt. Uses the same renderer as the browser (assets/js/render.js).
 * Run by Netlify on every deploy (see netlify.toml). Local: node scripts/build.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist');
// Source-only files that must not be published. index.html and _redirects are generated below.
const SKIP = new Set(['dist', 'scripts', 'node_modules', 'netlify.toml', 'package.json', 'index.html', '_redirects', '.gitignore']);

const fail = (msg) => {
  console.error('✗ Build failed: ' + msg);
  process.exit(1);
};

/* ---------- load renderer + content ---------- */
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js/render.js'), 'utf8'), ctx, { filename: 'render.js' });
const NZ = ctx.NZ;
const { esc } = NZ;

let content;
try {
  content = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/content.json'), 'utf8'));
} catch (e) {
  fail('data/content.json is not valid JSON — ' + e.message);
}
const site = content.site || {};
const pages = Array.isArray(content.pages) ? content.pages : [];
const siteUrl = String(site.url || '').replace(/\/+$/, '');

const seen = new Set();
for (const p of pages) {
  const s = p.slug || '';
  if (seen.has(s)) fail(`two pages use the same URL "/${s}"`);
  seen.add(s);
  if (s && !/^[a-z0-9][a-z0-9-]*$/.test(s)) fail(`invalid slug "${s}" (use lowercase letters, numbers, dashes)`);
  if (NZ.RESERVED.includes(s)) fail(`slug "${s}" is reserved`);
}
if (!seen.has('')) fail('there is no home page (a page with an empty slug)');

/* ---------- copy static files ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const name of fs.readdirSync(ROOT)) {
  if (SKIP.has(name)) continue;
  fs.cpSync(path.join(ROOT, name), path.join(OUT, name), { recursive: true });
}

/* ---------- render pages ---------- */
const template = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const absolute = (u) => (!u || /^https?:\/\//i.test(u) ? u : siteUrl + '/' + String(u).replace(/^\/+/, ''));
// JSON safe to embed inside <script>.
const embedded = JSON.stringify(content).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16));

function renderHtml(slug) {
  const v = NZ.renderShell(content, slug, { revealed: true });
  let h = template;
  const set = (re, fn) => {
    if (!re.test(h)) fail(`index.html is missing the expected markup ${re}`);
    h = h.replace(re, fn);
  };
  const url = siteUrl ? siteUrl + v.meta.path : '';
  const image = absolute(site.image || '');

  set(/<html lang="en" class="theme-[a-z]+">/, () => `<html lang="en" class="theme-${site.defaultTheme === 'light' ? 'light' : 'dark'}">`);
  set(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(v.meta.title)}</title>`);
  set(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${esc(v.meta.description)}">`);
  set(/<meta property="og:title" content="[^"]*">/, () => `<meta property="og:title" content="${esc(v.meta.title)}">`);
  set(/<meta property="og:description" content="[^"]*">/, () => `<meta property="og:description" content="${esc(v.meta.description)}">`);
  if (image) set(/<meta property="og:image" content="[^"]*">/, () => `<meta property="og:image" content="${esc(image)}">`);
  if (url) {
    set(/<meta property="og:url" content="[^"]*">/, () => `<meta property="og:url" content="${esc(url)}">`);
    set(/<link rel="canonical" href="[^"]*">/, () => (v.found ? `<link rel="canonical" href="${esc(url)}">` : ''));
  }
  if (!v.found) set(/<meta name="description"/, () => `<meta name="robots" content="noindex">\n  <meta name="description"`);

  set(/<a id="nav-brand" class="nav-brand" href="\/"><\/a>/, () => `<a id="nav-brand" class="nav-brand" href="/">${v.navBrand}</a>`);
  set(/<div id="nav-links" class="nav-links"><\/div>/, () => `<div id="nav-links" class="nav-links">${v.navLinks}</div>`);
  set(/<header id="cover" class="cover cover-gradient"><\/header>/, () =>
    `<header id="cover" class="cover${v.coverGradient ? ' cover-gradient' : ''}"${v.coverHidden ? ' hidden' : ''}>${v.cover}</header>`);
  set(/<div id="page-head" class="page-head">/, () =>
    `<div id="page-head" class="page-head${v.coverHidden ? '' : ' has-cover'}${v.iconHtml ? '' : ' no-icon'}">`);
  set(/<div id="crumbs" class="crumbs"><\/div>/, () => `<div id="crumbs" class="crumbs">${v.crumbs}</div>`);
  set(/<div id="page-icon" class="page-icon"><\/div>/, () => `<div id="page-icon" class="page-icon"${v.iconHtml ? '' : ' hidden'}>${v.iconHtml}</div>`);
  set(/<h1 id="page-title" class="page-title"><\/h1>/, () => `<h1 id="page-title" class="page-title"${v.hideTitle ? ' hidden' : ''}>${v.titleHtml}</h1>`);
  set(/<article id="blocks" class="blocks">[\s\S]*?<\/article>/, () => `<article id="blocks" class="blocks">${v.blocks}</article>`);
  set(/<footer id="footer" class="footer"><\/footer>/, () => `<footer id="footer" class="footer">${v.footer}</footer>`);
  set(/<script src="\/assets\/js\/render\.js"><\/script>/, () =>
    `<script id="nz-data" type="application/json">${embedded}</script>\n  <script src="/assets/js/render.js"></script>`);
  return h;
}

const write = (rel, data) => {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
};

for (const p of pages) write(p.slug ? `${p.slug}/index.html` : 'index.html', renderHtml(p.slug || ''));
write('404.html', renderHtml('__not-found__'));

/* ---------- routing, sitemap, robots ---------- */
// No catch-all: every page is a real file, unknown URLs get 404.html with a real 404 status.
write('_redirects', '/admin  /admin.html  200\n');

if (siteUrl) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = pages.map((p) => `  <url><loc>${esc(siteUrl + NZ.pagePath(p.slug))}</loc><lastmod>${today}</lastmod></url>`).join('\n');
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  write('robots.txt', `User-agent: *\nDisallow: /admin\nDisallow: /admin.html\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
} else {
  write('robots.txt', 'User-agent: *\nDisallow: /admin\nDisallow: /admin.html\n');
}

console.log(`✓ Built ${pages.length} page(s) → ${pages.map((p) => NZ.pagePath(p.slug)).join('  ')}`);
