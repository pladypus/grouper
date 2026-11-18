// How evenly does each method spread over ALL valid groupings? Small instances, enumerated exactly.
import { makeRng, prepare, solveWithRestarts, mix, mixSets, rejection } from './solver.mjs';
const canon = groups => groups.map(g => [...g].sort((a, b) => a - b).join('.')).sort().join('|');
function enumerate(p) { // all valid partitions of 0..n-1 into the split (as canonical strings)
  const out = new Set(); const ids = [...Array(p.n).keys()];
  const perm = (arr, k = 0) => { if (k === arr.length) { let i = 0; const gs = p.split.map(sz => arr.slice(i, i += sz)); if (valid(p, gs)) out.add(canon(gs)); return; }
    for (let j = k; j < arr.length; j++) { [arr[k], arr[j]] = [arr[j], arr[k]]; perm(arr, k + 1); [arr[k], arr[j]] = [arr[j], arr[k]]; } };
  perm(ids); return out;
}
function valid(p, gs) { const g = new Map(); gs.forEach((x, i) => x.forEach(s => g.set(s, i)));
  return p.apart.every(([a, b]) => g.get(a) !== g.get(b)) && p.clusters.every(c => c.every(s => g.get(s) === g.get(c[0]))); }
const toGroups = (prep, assign) => { const gs = prep.split.map(() => []); assign.forEach((k, b) => gs[k].push(...prep.blocks[b])); return gs; };
function measure(name, p, sampler, S) {
  const all = enumerate(p); const cnt = new Map([...all].map(k => [k, 0]));
  for (let i = 0; i < S; i++) { const k = sampler(); if (!cnt.has(k)) throw new Error('invalid sample ' + k); cnt.set(k, cnt.get(k) + 1); }
  const v = [...cnt.values()]; const e = S / v.length; const chi = v.reduce((s, o) => s + (o - e) ** 2 / e, 0);
  return { method: name, valid: v.length, seen: v.filter(x => x > 0).length, min: Math.min(...v), max: Math.max(...v), expected: +e.toFixed(1), 'chi2/df': +(chi / (v.length - 1)).toFixed(2) };
}
const insts = {
  'A: 8 Students, 4 groups of 2, Apart 0-1 2-3 0-2': { n: 8, split: [2, 2, 2, 2], apart: [[0, 1], [2, 3], [0, 2]], clusters: [], locked: [] },
  'B: 9 Students, 3 groups of 3, Apart 0-1 0-2 3-4, Cluster {5,6}': { n: 9, split: [3, 3, 3], apart: [[0, 1], [0, 2], [3, 4]], clusters: [[5, 6]], locked: [] },
  'C: 10 Students, split 3+3+4, Apart star on 0 + 1-2, Cluster {3,4}, {5,6}': { n: 10, split: [3, 3, 4], apart: [[0, 1], [0, 2], [0, 7], [1, 2]], clusters: [[3, 4], [5, 6]], locked: [] },
};
const S = 60000; const rng = makeRng(99);
for (const [name, p] of Object.entries(insts)) {
  const prep = prepare(p); const rows = [];
  rows.push(measure('rejection sampling', p, () => { const r = rejection(p, prep, rng, 1e6); const gs = prep.split.map(() => []); r.binOf.forEach((k, s) => gs[k].push(s)); return canon(gs); }, S));
  rows.push(measure('randomized backtracking only', p, () => canon(toGroups(prep, solveWithRestarts(prep, rng))), S));
  for (const steps of [50, 200, 1000]) rows.push(measure(`backtracking + ${steps} set-swap steps`, p, () => canon(toGroups(prep, mixSets(prep, solveWithRestarts(prep, rng), steps, rng))), S));
  for (const steps of [10, 50, 200]) rows.push(measure(`backtracking + ${steps} swap steps`, p, () => canon(toGroups(prep, mix(prep, solveWithRestarts(prep, rng), steps, rng))), S));
  console.log(name); console.table(rows);
}
