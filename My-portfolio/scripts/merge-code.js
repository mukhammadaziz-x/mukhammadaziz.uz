#!/usr/bin/env node
/*
 * Merges the `code` branch (pushed from the owner's computer) into `main` (where Studio commits and Netlify deploys).
 * Run by GitLab CI (.gitlab-ci.yml) on every push to `code` on GitLab, with remote `github`; the GitHub workflow
 * .github/workflows/merge-code.yml runs it by hand as a backup. Can also be run by hand in a clone.
 *
 * Why: Studio commits content.json and uploads straight to `main`. If the computer pushed to `main` as well, every
 * push after a Studio edit would be rejected until a `git pull`. With two branches nobody else writes `code`, so a
 * plain `git push` always works, and this script brings the code to the live site.
 *
 * content.json is merged as JSON (assets/js/merge3.js — the same merge Studio uses), never line by line, so the
 * result is always valid JSON. When both sides changed the same value, the `code` side wins: it is the latest thing
 * the owner asked for. Any other conflicting file stops the merge (nothing is pushed). The merged site is built
 * before pushing; a failing build pushes nothing either.
 *
 * Usage: node My-portfolio/scripts/merge-code.js [remote=origin]
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { merge3 } = require('../assets/js/merge3.js'); // loaded now: the checkout below may switch this file away

const REMOTE = process.argv[2] || 'origin';
const MAIN = 'main';
const CODE = 'code';
const CONTENT = 'My-portfolio/data/content.json';
const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();

const git = (...args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (...args) => {
  try {
    return { ok: true, out: git(...args) };
  } catch (e) {
    return { ok: false, out: String(e.stderr || e.message) };
  }
};
const show = (rev, file) => {
  const r = tryGit('show', `${rev}:${file}`);
  return r.ok ? JSON.parse(r.out) : null;
};
const log = (msg) => console.log(`[merge-code] ${msg}`);

function attempt() {
  git('fetch', '--quiet', REMOTE, MAIN, CODE);
  const main = `${REMOTE}/${MAIN}`;
  const code = `${REMOTE}/${CODE}`;
  if (tryGit('merge-base', '--is-ancestor', code, main).ok) {
    log(`${MAIN} already contains ${CODE} — nothing to do.`);
    return 'done';
  }
  const base = git('merge-base', main, code);
  git('checkout', '--quiet', '-B', MAIN, main);
  const merged = tryGit('merge', '--no-commit', '--no-ff', code);

  // content.json: always the JSON-aware result (even when git merged the lines cleanly).
  const ours = show(code, CONTENT);
  const theirs = show(main, CONTENT);
  if (ours && theirs) {
    const { result, conflicts } = merge3(show(base, CONTENT) || {}, ours, theirs);
    fs.writeFileSync(path.join(REPO, CONTENT), JSON.stringify(result, null, 2) + '\n');
    git('add', CONTENT);
    if (conflicts.length) log(`content.json: ${conflicts.length} value(s) changed on both sides, ${CODE} kept: ${conflicts.join(', ')}`);
  }

  const unresolved = git('diff', '--name-only', '--diff-filter=U').split('\n').filter(Boolean);
  if (unresolved.length) {
    tryGit('merge', '--abort');
    throw new Error(`conflicts outside content.json, nothing pushed: ${unresolved.join(', ')}\n${merged.out}`);
  }

  // The site must still build before it goes live.
  execFileSync('node', ['scripts/build.js'], { cwd: path.join(REPO, 'My-portfolio'), stdio: 'inherit' });
  fs.rmSync(path.join(REPO, 'My-portfolio', 'dist'), { recursive: true, force: true });

  const nothingStaged = tryGit('diff', '--cached', '--quiet').ok && !fs.existsSync(path.join(REPO, '.git', 'MERGE_HEAD'));
  if (!nothingStaged) git('commit', '--quiet', '--no-edit', '-m', `Merge ${CODE} into ${MAIN}`);
  const pushed = tryGit('push', '--quiet', REMOTE, `HEAD:${MAIN}`);
  if (pushed.ok) {
    log(`pushed ${git('rev-parse', '--short', 'HEAD')} to ${MAIN}.`);
    return 'done';
  }
  log(`push rejected (Studio committed meanwhile?) — retrying.\n${pushed.out}`);
  return 'retry';
}

try {
  for (let i = 1; i <= 4; i++) {
    if (attempt() === 'done') process.exit(0);
  }
  console.error('[merge-code] gave up after 4 attempts');
} catch (e) {
  console.error(`[merge-code] FAILED — ${e.message}`);
}
process.exit(1);
