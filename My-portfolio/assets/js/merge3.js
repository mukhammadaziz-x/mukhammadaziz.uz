/*
 * merge3 — three-way merge of content.json, shared by:
 *   - Studio (admin.js): a saved draft or a Publish meets newer changes on GitHub;
 *   - scripts/merge-content.js: the GitHub Action that merges the `code` branch into `main`.
 * Browser: window.NZMerge.merge3 · Node: require('./merge3.js').merge3
 */
(function (global) {
  'use strict';

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

  const api = { merge3 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.NZMerge = api;
})(typeof window !== 'undefined' ? window : globalThis);
