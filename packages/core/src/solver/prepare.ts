// Solver stage 1 (SPEC §5): turn Students and Rules into blocks and Keep apart edges, then run the
// quick checks.
//
// A block is a set of Students that must share a Group: a Good pair chain narrowed to the free pool,
// or a single Student. Chains are built from every Good pair passed in, including Pairs through
// Students outside the pool (Absent ones), so an Absent member never breaks a chain. Keep apart
// Pairs become edges between blocks. Search and spread only ever move whole blocks, so Good pairs
// hold by construction and Keep apart by checking edges.
//
// Quick checks, in order, each a structured Conflict that names its cause:
// - `apart-inside-chain`: a Keep apart pair inside one block (prevented on entry; defensive);
// - `chain-too-big`: a block bigger than the Target size (or the largest Group without one);
// - `apart-clique`: more mutually-Keep-apart blocks than Groups (pigeonhole, exact max clique).

export interface SolverPair {
  readonly id: string;
  readonly a: number;
  readonly b: number;
  readonly created: number;
}

export interface Prepared {
  /** Group sizes, in order. */
  readonly split: readonly number[];
  /** Student ids per block. */
  readonly blocks: readonly (readonly number[])[];
  /** Keep apart edges between block indices (symmetric). */
  readonly adj: readonly ReadonlySet<number>[];
}

/**
 * A structured reason no grouping exists. Every quick check lists the Pairs behind it in `pairIds`
 * (for "Show the Rules involved", #17); `no-solution` is explained separately.
 */
export type SolverConflict =
  /** A Keep apart Pair whose two Students are in one Good pair chain (prevented on entry; defensive). */
  | {
      readonly kind: "apart-inside-chain";
      /** The Keep apart Pair. */
      readonly pairId: string;
      /** The Keep apart Pair first, then the chain's Good pairs. */
      readonly pairIds: readonly string[];
    }
  /** A chain's Students in the pool are more than the Target size. */
  | {
      readonly kind: "chain-too-big";
      /** The chain's Students in the pool. */
      readonly students: readonly number[];
      /** The Target size (or the largest Group when no Target size was given). */
      readonly limit: number;
      /** The chain's Good pairs (including any through Students outside the pool). */
      readonly pairIds: readonly string[];
    }
  /** More blocks that must all be kept apart from each other than there are Groups. */
  | {
      readonly kind: "apart-clique";
      /** One entry per block in the clique: its Students (a single Student, or a chain). */
      readonly blocks: readonly (readonly number[])[];
      /** The number of Groups. */
      readonly groups: number;
      /** The Keep apart Pairs between the clique's blocks. */
      readonly pairIds: readonly string[];
    }
  /** The search proved there is no grouping that matches the Split and keeps every Rule. */
  | { readonly kind: "no-solution" };

export type PrepareResult =
  | { readonly ok: true; readonly prepared: Prepared }
  | { readonly ok: false; readonly conflict: SolverConflict };

/**
 * Builds blocks (union-find over Good pairs) and Keep apart edges, then runs the quick checks.
 * Keep apart Pairs that mention a Student not in `students` are ignored. `target` is the Target
 * size for the `chain-too-big` check; without it the largest Group is the limit.
 */
export function prepare(
  students: readonly number[],
  split: readonly number[],
  goodPairs: readonly SolverPair[],
  keepApart: readonly SolverPair[],
  target?: number,
): PrepareResult {
  // Union-find over every Student mentioned, in the pool or not.
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    let p = parent.get(x);
    if (p === undefined) {
      parent.set(x, x);
      return x;
    }
    while (p !== x) {
      const grand = parent.get(p)!;
      parent.set(x, grand);
      x = p;
      p = parent.get(x)!;
    }
    return x;
  };
  for (const p of goodPairs) {
    const ra = find(p.a);
    const rb = find(p.b);
    if (ra !== rb) parent.set(ra, rb);
  }

  const blockOfRoot = new Map<number, number>();
  const blocks: number[][] = [];
  const blockOf = new Map<number, number>();
  for (const s of students) {
    const root = find(s);
    let block = blockOfRoot.get(root);
    if (block === undefined) {
      block = blocks.length;
      blockOfRoot.set(root, block);
      blocks.push([]);
    }
    blocks[block]!.push(s);
    blockOf.set(s, block);
  }
  const chainPairIds = (block: number): string[] =>
    goodPairs.filter((p) => blockOfRoot.get(find(p.a)) === block).map((p) => p.id);

  const adj = blocks.map(() => new Set<number>());
  for (const p of keepApart) {
    const x = blockOf.get(p.a);
    const y = blockOf.get(p.b);
    if (x === undefined || y === undefined) continue;
    if (x === y) {
      return { ok: false, conflict: { kind: "apart-inside-chain", pairId: p.id, pairIds: [p.id, ...chainPairIds(x)] } };
    }
    adj[x]!.add(y);
    adj[y]!.add(x);
  }

  const limit = target ?? Math.max(0, ...split);
  let biggest = -1;
  blocks.forEach((b, i) => {
    if (b.length > limit && (biggest < 0 || b.length > blocks[biggest]!.length)) biggest = i;
  });
  if (biggest >= 0) {
    return {
      ok: false,
      conflict: { kind: "chain-too-big", students: blocks[biggest]!, limit, pairIds: chainPairIds(biggest) },
    };
  }

  const groups = split.length;
  const clique = maxClique(adj, groups);
  if (clique.length > groups) {
    const inClique = new Set(clique);
    const pairIds = keepApart
      .filter((p) => {
        const x = blockOf.get(p.a);
        const y = blockOf.get(p.b);
        return x !== undefined && y !== undefined && inClique.has(x) && inClique.has(y);
      })
      .map((p) => p.id);
    return { ok: false, conflict: { kind: "apart-clique", blocks: clique.map((b) => blocks[b]!), groups, pairIds } };
  }

  return { ok: true, prepared: { split, blocks, adj } };
}

/**
 * An exact maximum clique of the graph (branch and bound), as vertex indices in ascending order.
 * Only vertices with at least `minDegree` neighbours are considered, so cliques smaller than
 * `minDegree + 1` may be missed (the pigeonhole check only cares about cliques bigger than the
 * number of Groups, so it passes that number).
 */
export function maxClique(adj: readonly ReadonlySet<number>[], minDegree = 0): number[] {
  const candidates = adj
    .map((_, i) => i)
    .filter((i) => adj[i]!.size >= minDegree)
    .sort((x, y) => adj[y]!.size - adj[x]!.size);
  let best: number[] = [];
  const current: number[] = [];
  const grow = (cand: readonly number[]) => {
    if (cand.length === 0) {
      if (current.length > best.length) best = current.slice();
      return;
    }
    for (let i = 0; i < cand.length; i++) {
      if (current.length + cand.length - i <= best.length) return;
      const v = cand[i]!;
      current.push(v);
      grow(cand.slice(i + 1).filter((u) => adj[v]!.has(u)));
      current.pop();
    }
  };
  grow(candidates);
  return best.sort((x, y) => x - y);
}
