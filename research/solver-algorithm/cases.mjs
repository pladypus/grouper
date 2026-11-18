import { makeRng, prepare, solve, explain } from './solver.mjs';
const now = () => performance.now();
const splitFor = (n, t) => { const k = Math.floor(n / t); const s = Array(k).fill(t); let r = n - k * t; for (let i = 0; r > 0; i = (i + 1) % k, r--) s[i]++; return s; };
const noClique = process.argv.includes('--no-clique');
const rng = makeRng(7);
const cases = [];
{ const apart=[]; for (let i=0;i<11;i++) for (let j=i+1;j<11;j++) apart.push([i,j]);
  for (let i=0;i<30;i++) { const a=11+i%29, b=11+(i*7+3)%29; if (a!==b) apart.push([a,b]); }
  cases.push(['11 mutually-Apart Students, 10 groups of 4 (+30 other Apart rules)', { n:40, split: splitFor(40,4), apart, clusters: [], locked: [] }]); }
{ const apart=[]; for (let i=0;i<5;i++) for (let j=i+1;j<5;j++) apart.push([i,j]);
  cases.push(['5 mutually-Apart Students, 25 Present @ target 5 (5 groups) - feasible', { n:25, split: splitFor(25,5), apart, clusters: [], locked: [] }]); }
{ // odd wheel: no 4-clique, but needs 4 groups; 3 groups of size 13/13/14 -> W5 (hub + 5-cycle) is 4-chromatic
  const apart=[[0,1],[1,2],[2,3],[3,4],[4,0],[5,0],[5,1],[5,2],[5,3],[5,4]];
  cases.push(['Odd wheel W5 (needs 4 groups, max clique 3), 40 Present in 3 groups', { n:40, split: splitFor(40,13), apart, clusters: [], locked: [] }]); }
{ const clusters=[]; for (let i=0;i<11;i++) clusters.push([3*i,3*i+1,3*i+2]);
  cases.push(['11 Clusters of 3, 10 groups of 4', { n:40, split: splitFor(40,4), apart: [[33,34],[35,36],[0,39]], clusters, locked: [] }]); }
cases.push(['Apart pair inside a Cluster', { n:40, split: splitFor(40,4), apart: [[1,2],[5,6]], clusters: [[0,1,2]], locked: [] }]);
{ const apart=[]; for (let j=1;j<40;j++) apart.push([0,j]);
  cases.push(['One Student Apart from all 39 others, groups of 2', { n:40, split: splitFor(40,2), apart, clusters: [], locked: [] }]); }
cases.push(['Cluster half inside a Locked Group', { n:40, split: splitFor(40,4), apart: [], clusters: [[0,10]], locked: [[0,1,2,3]] }]);
{ const apart=[]; for (let i=0;i<10;i++) for (let j=i+1;j<10;j++) apart.push([i,j]);
  for (let i=0;i<10;i++) apart.push([10+i, 20+i]);
  cases.push(['10 mutually-Apart, 10 groups of 4, + Clusters (tight, feasible)', { n:40, split: splitFor(40,4), apart, clusters: [[10,11,12],[30,31]], locked: [] }]); }
cases.push(['25 Present @2 (12x2+1x3), two Clusters of 3', { n:25, split: splitFor(25,2), apart: [[6,7],[8,9]], clusters: [[0,1,2],[3,4,5]], locked: [] }]);
{ // Locked groups + many rules, feasible
  const apart=[]; for (let i=0;i<40;i++) apart.push([i,(i*17+9)%40]);
  cases.push(['3 Locked Groups + 40 Apart + 3 Clusters, target 4', { n:40, split: splitFor(40,4), apart: apart.filter(([a,b])=>a!==b && !(a<12&&b<12&&(a>>2)===(b>>2)) && ![[20,21],[22,23,24],[30,31]].some(c=>c.includes(a)&&c.includes(b))), clusters: [[20,21],[22,23,24],[30,31]], locked: [[0,1,2,3],[4,5,6,7],[8,9,10,11]] }]); }
for (const [label, p0] of cases) {
  const p = { ...p0, cliqueCheck: !noClique };
  const t0 = now(); const prep = prepare(p); const st = { nodes: 0 }; let sol = null, status;
  try { sol = prep.conflicts.length ? null : solve(prep, rng, st, 5e6); status = sol ? 'groups' : 'conflict'; } catch { status = 'GAVE UP (5M nodes)'; }
  const t1 = now(); let expl = '';
  if (status === 'conflict') {
    const ms = { nodes: 0, calls: 0 }; let mus; try { mus = explain(p, rng, ms); } catch {}
    const t2 = now();
    expl = mus ? `MUS ${mus.length} rules in ${(t2-t1).toFixed(1)}ms (${ms.calls} solver calls, ${ms.nodes} nodes): ` + mus.slice(0,10).map(x=>x.t+JSON.stringify(x.r)).join(' ') + (mus.length>10?' ...':'') : 'MUS gave up';
    if (prep.conflicts.length) expl = 'quick check: ' + prep.conflicts.map(c=>c.kind).join(',') + ' | ' + expl;
  }
  console.log(`- ${label}\n    ${status} in ${(t1-t0).toFixed(2)}ms, ${st.nodes} nodes ${expl ? '\n    ' + expl : ''}`);
}
