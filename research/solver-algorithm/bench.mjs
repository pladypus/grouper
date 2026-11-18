import { makeRng, prepare, solve, mix, rejection, explain } from './solver.mjs';
const now = () => performance.now();
export function splitFor(n, t) { const k = Math.floor(n / t); const s = Array(k).fill(t); let r = n - k * t; for (let i = 0; r > 0; i = (i + 1) % k, r--) s[i]++; return s; }
function randInstance(rng, n, target, nApart, clusterSizes) {
  const ids = [...Array(n).keys()]; for (let i = n-1;i>0;i--){const j=Math.floor(rng()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
  const clusters = []; let p = 0; for (const c of clusterSizes) { clusters.push(ids.slice(p, p + c)); p += c; }
  const apart = []; const key = new Set(); while (apart.length < nApart) { const a = Math.floor(rng()*n), b = Math.floor(rng()*n); if (a===b) continue; const k = a<b?a+','+b:b+','+a; if (key.has(k)) continue; key.add(k); apart.push([a,b]); }
  return { n, split: splitFor(n, target), apart, clusters, locked: [] };
}
function run(label, p, rng) {
  const t0 = now(); const prep = prepare(p); const st = { nodes: 0 };
  let sol = prep.conflicts.length ? null : solve(prep, rng, st);
  const t1 = now(); let mus = null, t2 = t1, ms = { nodes: 0, calls: 0 };
  if (!sol) { mus = explain(p, rng, ms); t2 = now(); }
  else mix(prep, sol, 2000, rng);
  const t3 = now();
  return { label, feasible: !!sol, solveMs: +(t1-t0).toFixed(2), nodes: st.nodes, musSize: mus?.length, musMs: +(t2-t1).toFixed(1), musCalls: ms.calls, musNodes: ms.nodes, totalMs: +(t3-t0).toFixed(2), quick: prep.conflicts.map(c=>c.kind).join(',') };
}
const rng = makeRng(42);
const rows = [];
for (const target of [2,3,4,5]) for (const nApart of [20,40,60,100,150]) for (const cl of [[], [2,2,3], [3,3,3,4]]) {
  let worst = 0, worstNodes = 0, feas = 0, inf = 0, worstMus = 0, worstMusNodes=0, worstAcc = 0, accTot=0, accN=0, rejFail=0;
  for (let r = 0; r < 30; r++) {
    const p = randInstance(rng, 40, target, nApart, cl);
    const res = run('', p, rng); worst = Math.max(worst, res.solveMs); worstNodes = Math.max(worstNodes, res.nodes);
    if (res.feasible) { feas++; const rj = rejection(p, prepare(p), rng, 100000); if (!rj.binOf) rejFail++; accTot += rj.tries; accN++; worstAcc = Math.max(worstAcc, rj.tries); }
    else { inf++; worstMus = Math.max(worstMus, res.musMs); worstMusNodes = Math.max(worstMusNodes, res.musNodes); }
  }
  rows.push({ target, nApart, clusters: cl.join('+')||'-', feas, inf, worstSolveMs: +worst.toFixed(2), worstNodes, worstMusMs: +worstMus.toFixed(1), worstMusNodes, rejMeanTries: accN? Math.round(accTot/accN):'-', rejGaveUp: rejFail });
}
console.table(rows);
const cases = [];
{ const apart=[]; for (let i=0;i<11;i++) for (let j=i+1;j<11;j++) apart.push([i,j]);
  for (let i=0;i<30;i++) apart.push([11+i%29, 11+(i*7+3)%29]);
  cases.push(['11-clique Apart, 10 groups of 4 (+30 noise)', { n:40, split: splitFor(40,4), apart: apart.filter(([a,b])=>a!==b), clusters: [], locked: [] }]); }
{ const clusters=[]; for (let i=0;i<11;i++) clusters.push([3*i,3*i+1,3*i+2]);
  cases.push(['11 Clusters of 3, 10 groups of 4', { n:40, split: splitFor(40,4), apart: [[33,34],[35,36],[0,39]], clusters, locked: [] }]); }
cases.push(['Apart pair inside a Cluster', { n:40, split: splitFor(40,4), apart: [[1,2],[5,6]], clusters: [[0,1,2]], locked: [] }]);
{ const apart=[]; for (let j=1;j<40;j++) apart.push([0,j]);
  cases.push(['One Student Apart from all others', { n:40, split: splitFor(40,2), apart, clusters: [], locked: [] }]); }
cases.push(['Cluster half inside a Locked Group', { n:40, split: splitFor(40,4), apart: [], clusters: [[0,10]], locked: [[0,1,2,3]] }]);
{ const apart=[]; for (let i=0;i<10;i++) for (let j=i+1;j<10;j++) apart.push([i,j]);
  for (let i=0;i<10;i++) apart.push([10+i, 20+i]);
  cases.push(['10-clique Apart, 10 groups of 4 (tight, feasible)', { n:40, split: splitFor(40,4), apart, clusters: [[10,11,12],[30,31]], locked: [] }]); }
{ // Clusters of 3 with 2 Apart-linked: sizes 25 @ target 2 -> 12x2+1x3; cluster of 3 fits only the one 3-group; two such clusters -> conflict
  cases.push(['25 Present @2, two Clusters of 3', { n:25, split: splitFor(25,2), apart: [[6,7],[8,9]], clusters: [[0,1,2],[3,4,5]], locked: [] }]); }
console.table(cases.map(([l,p]) => run(l, p, rng)));
for (const [l,p] of cases) { const prep = prepare(p); if (prep.conflicts.length) { console.log(l, '-> quick check:', JSON.stringify(prep.conflicts)); continue; } if (solve(prep, rng)) continue; const m = explain(p, rng); console.log(l, '-> minimal conflicting Rules (' + m.length + '):', m.slice(0,12).map(x=>x.t+JSON.stringify(x.r)).join(' '), m.length>12?'...':''); }
