// Random stress: 40 Present, Apart rules never inside a Cluster (realistic input), random Locks.
import { makeRng, prepare, solve, solveWithRestarts, mix, explain } from './solver.mjs';
const now = () => performance.now();
const splitFor = (n, t) => { const k = Math.floor(n / t); const s = Array(k).fill(t); let r = n - k * t; for (let i = 0; r > 0; i = (i + 1) % k, r--) s[i]++; return s; };
const rng = makeRng(Number(process.argv[2] || 3));
const N = Number(process.argv[3] || 4000);
const pick = a => a[Math.floor(rng() * a.length)];
let nonMin = 0, worst = { ms: 0 }, worstMus = { ms: 0 }, feas = 0, inf = 0, gaveUp = 0; const buckets = {};
for (let it = 0; it < N; it++) {
  const n = pick([20, 25, 30, 35, 40]); const target = pick([2, 3, 4, 5, 6]);
  const ids = [...Array(n).keys()].sort(() => rng() - 0.5);
  const clusters = []; let p = 0; const nCl = Math.floor(rng() * 6);
  for (let c = 0; c < nCl; c++) { const sz = 2 + Math.floor(rng() * Math.max(1, target - 1)); clusters.push(ids.slice(p, p + sz)); p += sz; }
  const same = (a, b) => clusters.some(c => c.includes(a) && c.includes(b));
  const nApart = Math.floor(rng() * Number(process.argv[4] || 80)); const apart = []; const seen = new Set();
  // skewed: some "difficult" students get many Apart rules
  const hubs = ids.slice(-3);
  for (let t = 0; t < nApart * 3 && apart.length < nApart; t++) {
    const a = rng() < 0.4 ? pick(hubs) : Math.floor(rng() * n), b = Math.floor(rng() * n);
    const k = Math.min(a, b) + ',' + Math.max(a, b); if (a === b || seen.has(k) || same(a, b)) continue; seen.add(k); apart.push([a, b]);
  }
  const split = splitFor(n, target); const locked = [];
  if (rng() < 0.3) { // lock one group made of free students that are not in clusters and not mutually Apart
    const free = ids.slice(p).filter(s => !hubs.includes(s)); const g = []; for (const s of free) { if (g.length === split[0]) break; if (g.every(o => !seen.has(Math.min(o, s) + ',' + Math.max(o, s)))) g.push(s); }
    if (g.length === split[0]) locked.push(g);
  }
  const prob = { n, split, apart, clusters, locked };
  const t0 = now(); const prep = prepare(prob); const st = { nodes: 0, restarts: 0 }; let sol;
  try { sol = prep.conflicts.length ? null : solveWithRestarts(prep, rng, st, 2e7); } catch { gaveUp++; console.log('GAVE UP', JSON.stringify(prob)); continue; }
  if (sol) mix(prep, sol, 2000, rng);
  const ms = now() - t0;
  if (ms > worst.ms) worst = { ms, nodes: st.nodes, restarts: st.restarts, n, target, nApart: apart.length, clusters: clusters.length, feasible: !!sol };
  if (sol) feas++; else {
    inf++; const t1 = now(); const s2 = { nodes: 0, calls: 0 }; let m;
    try { m = explain(prob, rng, s2, 20000); if (!s2.minimal) nonMin++; } catch { console.log('MUS GAVE UP'); }
    const mms = now() - t1; if (mms > worstMus.ms) worstMus = { ms: mms, calls: s2.calls, nodes: s2.nodes, musSize: m?.length, rules: apart.length + clusters.length };
    const key = prep.conflicts.length ? prep.conflicts[0].kind : 'search'; buckets[key] = (buckets[key] || 0) + 1;
  }
}
console.log({ N, maxApart: Number(process.argv[4] || 80), feas, inf, gaveUp, nonMinimalExplanations: nonMin, conflictSources: buckets, worstShuffle: worst, worstExplain: worstMus });
