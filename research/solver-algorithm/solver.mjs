// Prototype Shuffle solver. Students are ints 0..n-1 (Present only).
// problem = { n, split: [sizes], apart: [[a,b],...], clusters: [[...ids],...], locked: [[...ids],...] }
// Locked groups: their sizes are part of `split`; they are removed first.

export function makeRng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffleInPlace = (a, rng) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---- preprocessing: locks, clusters -> blocks, quick conflict checks ----
export function prepare(p) {
  const conflicts = [];
  const lockedOf = new Map();
  p.locked.forEach((g, gi) => g.forEach(s => lockedOf.set(s, gi)));
  const split = p.split.slice();
  for (const g of p.locked) { const i = split.indexOf(g.length); if (i < 0) conflicts.push({ kind: 'lock-not-in-split', lock: g }); else split.splice(i, 1); }
  // Cluster partly in a Lock, or spread over Locks
  p.clusters.forEach((c, ci) => {
    const ls = new Set(c.map(s => lockedOf.has(s) ? lockedOf.get(s) : 'free'));
    if (ls.size > 1) conflicts.push({ kind: 'cluster-vs-lock', cluster: ci });
  });
  // union-find over free students
  const free = []; for (let s = 0; s < p.n; s++) if (!lockedOf.has(s)) free.push(s);
  const parent = new Map(free.map(s => [s, s]));
  const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const clusterOfRoot = new Map();
  p.clusters.forEach((c, ci) => { const f = c.filter(s => !lockedOf.has(s)); for (let i = 1; i < f.length; i++) parent.set(find(f[i]), find(f[0])); });
  const blocksBy = new Map(); for (const s of free) { const r = find(s); if (!blocksBy.has(r)) blocksBy.set(r, []); blocksBy.get(r).push(s); }
  const blocks = [...blocksBy.values()];
  const blockOf = new Map(); blocks.forEach((b, bi) => b.forEach(s => blockOf.set(s, bi)));
  // apart edges between blocks
  const nb = blocks.length; const adj = Array.from({ length: nb }, () => new Set());
  p.apart.forEach(([a, b], ri) => {
    if (lockedOf.has(a) || lockedOf.has(b)) { if (lockedOf.has(a) && lockedOf.get(a) === lockedOf.get(b)) conflicts.push({ kind: 'apart-inside-lock', apart: ri }); return; }
    const x = blockOf.get(a), y = blockOf.get(b);
    if (x === y) conflicts.push({ kind: 'apart-inside-cluster', apart: ri }); else { adj[x].add(y); adj[y].add(x); }
  });
  // Pigeonhole check: a set of mutually-Apart blocks larger than the number of free Groups can never be placed.
  if (p.cliqueCheck !== false) {
    const clique = maxClique(adj);
    if (clique.length > split.length) conflicts.push({ kind: 'apart-clique', blocks: clique, groups: split.length });
  }
  const maxCap = Math.max(0, ...split);
  blocks.forEach((b, bi) => { if (b.length > maxCap) conflicts.push({ kind: 'cluster-too-big', block: bi, size: b.length, maxCap }); });
  return { split, blocks, adj, conflicts };
}

// Simple exact max clique (branch and bound); fine for <= ~40 vertices with sparse graphs.
export function maxClique(adj) {
  let best = [];
  const rec = (cur, cand) => {
    if (cand.length === 0) { if (cur.length > best.length) best = cur.slice(); return; }
    if (cur.length + cand.length <= best.length) return;
    for (let i = 0; i < cand.length; i++) {
      if (cur.length + cand.length - i <= best.length) return;
      const v = cand[i]; cur.push(v); rec(cur, cand.slice(i + 1).filter(u => adj[v].has(u))); cur.pop();
    }
  };
  rec([], adj.map((_, i) => i).sort((a, b) => adj[b].size - adj[a].size));
  return best;
}

// ---- complete randomized backtracking: returns assignment (block -> bin) or null; stats.nodes ----
export function solve({ split, blocks, adj }, rng, stats = { nodes: 0 }, nodeLimit = Infinity) {
  const nb = blocks.length, nbin = split.length;
  const res = split.slice(); const assign = new Int32Array(nb).fill(-1);
  const binBlocks = Array.from({ length: nbin }, () => []);
  const tiebreak = blocks.map(() => rng());
  const order = Array.from({ length: nbin }, (_, i) => i);
  const okFor = (b, k) => res[k] >= blocks[b].length && !binBlocks[k].some(o => adj[b].has(o));
  // multiset of remaining block sizes vs residual capacities: cheap exact-fill check when all blocks size 1 is trivial; otherwise rely on search
  function rec(left) {
    if (++stats.nodes > nodeLimit) throw new Error('limit');
    if (left === 0) return true;
    // dual forward check: every Group with free seats must still be fillable by the blocks that could go there
    for (let k = 0; k < nbin; k++) {
      if (res[k] === 0) continue; let supply = 0;
      for (let b = 0; b < nb && supply < res[k]; b++) if (assign[b] === -1 && okFor(b, k)) supply += blocks[b].length;
      if (supply < res[k]) return false;
    }
    // MRV: pick unassigned block with fewest feasible bins (ties: larger block, then random)
    let best = -1, bestCnt = Infinity, bestBins = null;
    for (let b = 0; b < nb; b++) {
      if (assign[b] !== -1) continue;
      const bins = []; for (let k = 0; k < nbin; k++) if (okFor(b, k)) bins.push(k);
      if (bins.length === 0) return false; // forward check
      // MRV, then DSatur-style: most Apart edges, then bigger block, then random
      const better = bins.length < bestCnt || (bins.length === bestCnt && (adj[b].size > adj[best].size || (adj[b].size === adj[best].size && (blocks[b].length > blocks[best].length || (blocks[b].length === blocks[best].length && tiebreak[b] < tiebreak[best])))));
      if (better) { best = b; bestCnt = bins.length; bestBins = bins; }
    }
    shuffleInPlace(bestBins, rng);
    // symmetry breaking: empty bins with equal capacity are interchangeable -> try one
    const seenEmpty = new Set();
    for (const k of bestBins) {
      if (binBlocks[k].length === 0) { if (seenEmpty.has(split[k])) continue; seenEmpty.add(split[k]); }
      assign[best] = k; res[k] -= blocks[best].length; binBlocks[k].push(best);
      if (rec(left - 1)) return true;
      assign[best] = -1; res[k] += blocks[best].length; binBlocks[k].pop();
    }
    return false;
  }
  return rec(nb) ? Array.from(assign) : null;
}

// Randomized restarts with geometrically growing node budgets (Gomes et al. 2000). Still complete:
// the budget grows without bound, so a run eventually exhausts the tree and proves a Conflict.
export function solveWithRestarts(prep, rng, stats = { nodes: 0, restarts: 0 }, maxNodes = Infinity) {
  let budget = 1000;
  for (;;) {
    const st = { nodes: 0 };
    try { const r = solve(prep, rng, st, Math.min(budget, maxNodes - stats.nodes)); stats.nodes += st.nodes; return r; }
    catch { stats.nodes += st.nodes; stats.restarts++; if (stats.nodes >= maxNodes) throw new Error('limit'); budget = Math.ceil(budget * 1.5); }
  }
}

// ---- MCMC mixing: swap two equal-size blocks in different bins if still valid (symmetric proposal -> uniform stationary dist on reachable set) ----
export function mix({ blocks, adj }, assign, steps, rng) {
  const nb = blocks.length; const members = new Map();
  assign.forEach((k, b) => { if (!members.has(k)) members.set(k, new Set()); members.get(k).add(b); });
  const conflictsWith = (b, k, except) => { for (const o of members.get(k)) if (o !== except && adj[b].has(o)) return true; return false; };
  for (let t = 0; t < steps; t++) {
    const x = Math.floor(rng() * nb), y = Math.floor(rng() * nb);
    const kx = assign[x], ky = assign[y];
    if (kx === ky || blocks[x].length !== blocks[y].length) continue;
    if (conflictsWith(x, ky, y) || conflictsWith(y, kx, x)) continue;
    members.get(kx).delete(x); members.get(ky).delete(y); members.get(kx).add(y); members.get(ky).add(x);
    assign[x] = ky; assign[y] = kx;
  }
  return assign;
}

// ---- MCMC v2: pick two Groups; pick a random subset of blocks from each (each block w.p. 1/2); swap them if the
// sizes match and no Apart rule breaks. The proposal is symmetric (the two Groups' total block count is unchanged,
// so the reverse move has the same probability), so the uniform distribution over valid groupings is stationary.
// Unlike v1 it can trade one Cluster of 2 for two single Students.
export function mixSets({ split, blocks, adj }, assign, steps, rng) {
  const nbin = split.length; const members = Array.from({ length: nbin }, () => []);
  assign.forEach((k, b) => members[k].push(b));
  for (let t = 0; t < steps; t++) {
    const g = Math.floor(rng() * nbin); let h = Math.floor(rng() * (nbin - 1)); if (h >= g) h++;
    const A = [], Ar = [], B = [], Br = [];
    for (const b of members[g]) (rng() < 0.5 ? A : Ar).push(b);
    for (const b of members[h]) (rng() < 0.5 ? B : Br).push(b);
    const sz = xs => xs.reduce((s, b) => s + blocks[b].length, 0);
    if ((A.length === 0 && B.length === 0) || sz(A) !== sz(B)) continue;
    const clash = (xs, ys) => xs.some(x => ys.some(y => adj[x].has(y)));
    if (clash(A, Br) || clash(B, Ar)) continue;
    members[g] = Ar.concat(B); members[h] = Br.concat(A);
    for (const b of A) assign[b] = h; for (const b of B) assign[b] = g;
  }
  return assign;
}

// ---- rejection sampling: shuffle, cut by split, accept if valid. Exactly uniform. ----
export function rejection(p, prep, rng, maxTries) {
  const { split, blocks, adj } = prep; const free = blocks.flat(); const blockOf = new Map(); blocks.forEach((b, i) => b.forEach(s => blockOf.set(s, i)));
  for (let t = 1; t <= maxTries; t++) {
    shuffleInPlace(free, rng); let i = 0; let ok = true; const binOf = new Map();
    for (let k = 0; k < split.length && ok; k++) { for (let j = 0; j < split[k]; j++) binOf.set(free[i++], k); }
    for (const b of blocks) { const k = binOf.get(b[0]); if (b.some(s => binOf.get(s) !== k)) { ok = false; break; } }
    if (ok) for (const [a, c] of p.apart) if (binOf.has(a) && binOf.get(a) === binOf.get(c)) { ok = false; break; }
    if (ok) return { tries: t, binOf };
  }
  return { tries: maxTries, binOf: null };
}

// ---- feasibility of a sub-problem (for MUS) ----
export function feasible(p, rng, stats, budget = 5e6) { const prep = prepare(p); if (prep.conflicts.length) return false; return solveWithRestarts(prep, rng, stats, stats.nodes + budget) !== null; }

// Deletion-based minimal unsatisfiable subset over Rules (Apart rules + Clusters). Locks & Split are background.
// Each deletion test gets a node budget; a test that runs out counts as "still needed" (rule kept), so the
// result is always a genuinely conflicting subset, just possibly not minimal. stats.minimal reports which.
export function explain(p, rng, stats = { nodes: 0, calls: 0 }, perCallBudget = 5e6) {
  stats.minimal = true;
  let rules = [...p.apart.map((r, i) => ({ t: 'apart', i, r })), ...p.clusters.map((r, i) => ({ t: 'cluster', i, r }))];
  const build = rs => ({ ...p, apart: rs.filter(x => x.t === 'apart').map(x => x.r), clusters: rs.filter(x => x.t === 'cluster').map(x => x.r) });
  for (let j = 0; j < rules.length;) {
    const trial = rules.slice(0, j).concat(rules.slice(j + 1)); stats.calls++;
    let f; try { f = feasible(build(trial), rng, stats, perCallBudget); } catch { f = true; stats.minimal = false; }
    if (!f) rules = trial; else j++;
  }
  return rules;
}
