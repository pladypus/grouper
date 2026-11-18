import { makeRng, prepare, solve } from './solver.mjs';
const p = {"n":25,"split":[4,3,3,3,3,3,3,3],"apart":[[22,9],[16,1],[0,3],[14,7],[9,10],[0,16],[13,21],[5,9],[12,6],[15,13],[8,5],[12,11],[0,5],[3,1],[14,5],[7,5],[0,13],[2,19],[0,15],[5,23],[14,1],[0,9],[16,24],[22,10],[7,18],[8,18],[0,8],[14,6],[12,15],[3,24],[0,4],[17,3],[14,23],[10,3],[1,10],[6,10],[8,10],[0,2],[0,12],[23,13],[1,9],[6,22],[0,11],[22,20],[23,6],[19,18],[8,22],[5,12],[22,4],[0,19],[7,19],[21,24],[0,24],[13,22],[23,16],[14,0],[8,1],[8,20],[6,13],[24,23],[10,20],[16,10],[10,12],[15,23],[2,12],[8,12],[12,3],[0,7],[0,18],[8,4],[2,3],[6,17],[23,0],[0,21],[22,3],[0,1],[20,15],[21,12]],"clusters":[],"locked":[]};
const prep = prepare(p);
const t0 = performance.now(); let found = null, tries = 0, nodes = 0;
for (let seed = 1; seed <= 2000 && !found; seed++) { tries++; const st = { nodes: 0 }; try { found = solve(prep, makeRng(seed), st, 2000); } catch {} nodes += st.nodes; }
console.log('restarts (2000-node budget):', found ? 'FOUND' : 'none', 'tries', tries, 'nodes', nodes, 'ms', (performance.now() - t0).toFixed(1));
const t1 = performance.now(); const st = { nodes: 0 }; let r; try { r = solve(prep, makeRng(1), st, 1e8); } catch { r = 'limit'; }
console.log('full search:', r === null ? 'PROVED INFEASIBLE' : r === 'limit' ? 'limit' : 'found', st.nodes, 'nodes', ((performance.now() - t1) / 1000).toFixed(1), 's');
