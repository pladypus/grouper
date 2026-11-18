// 40 Students: compare pair co-occurrence rates against exact-uniform rejection sampling, and time each method.
import { makeRng, prepare, solveWithRestarts, mixSets, rejection } from './solver.mjs';
const splitFor = (n, t) => { const k = Math.floor(n / t); const s = Array(k).fill(t); let r = n - k * t; for (let i = 0; r > 0; i = (i + 1) % k, r--) s[i]++; return s; };
const rng = makeRng(5); const n = 40;
const p = { n, split: splitFor(n, 4), clusters: [[0, 1], [2, 3]], locked: [],
  apart: [[4, 5], [4, 6], [4, 7], [5, 6], [8, 9], [10, 11], [12, 13], [0, 14], [2, 15], [16, 17], [18, 19], [20, 21], [4, 22], [5, 23], [24, 25]] };
const prep = prepare(p); const S = 20000;
function cooc(sampler) { const m = new Float64Array(n * n); let t0 = performance.now();
  for (let i = 0; i < S; i++) { const gs = sampler(); for (const g of gs) for (const a of g) for (const b of g) if (a < b) m[a * n + b]++; }
  return { m: m.map(x => x / S), ms: (performance.now() - t0) / S }; }
const toGroups = a => { const gs = prep.split.map(() => []); a.forEach((k, b) => gs[k].push(...prep.blocks[b])); return gs; };
let tries = 0;
const ref = cooc(() => { const r = rejection(p, prep, rng, 1e7); tries += r.tries; const gs = prep.split.map(() => []); r.binOf.forEach((k, s) => gs[k].push(s)); return gs; });
console.log('rejection: mean tries', (tries / S).toFixed(1), 'ms/sample', ref.ms.toFixed(3));
for (const steps of [0, 100, 500, 2000, 5000]) {
  const r = cooc(() => toGroups(mixSets(prep, solveWithRestarts(prep, rng), steps, rng)));
  let maxd = 0, sum = 0, c = 0; for (let i = 0; i < n * n; i++) if (ref.m[i] > 0 || r.m[i] > 0) { const d = Math.abs(r.m[i] - ref.m[i]); maxd = Math.max(maxd, d); sum += d; c++; }
  console.log(`backtracking + ${steps} set-swaps: ms/sample ${r.ms.toFixed(3)}, pair-rate max |diff| ${maxd.toFixed(4)}, mean |diff| ${(sum / c).toFixed(4)} (baseline pair rate ~${(3 / 39).toFixed(3)})`);
}
