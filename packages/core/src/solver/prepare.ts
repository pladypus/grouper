// Solver stage 1 (SPEC §5): turn Students and Rules into blocks and Keep apart edges.
//
// A block is a set of Students that must share a Group: a Good pair chain narrowed to the free pool,
// or a single Student. Keep apart Pairs become edges between blocks. Search and spread only ever
// move whole blocks, so Good pairs hold by construction and Keep apart by checking edges.
//
// Quick checks still to come with #16: `chain-too-big` (needs the Target size) and `apart-clique`
// (exact max clique of the block graph vs the number of Groups). They slot in after the blocks and
// edges are built, before search.

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

/** A structured reason no grouping exists. Later tickets add `chain-too-big` and `apart-clique`. */
export type SolverConflict =
  /** A Keep apart Pair whose two Students are in one Good pair chain (prevented on entry; defensive). */
  | { readonly kind: "apart-inside-chain"; readonly pairId: string }
  /** The search proved there is no grouping that matches the Split and keeps every Rule. */
  | { readonly kind: "no-solution" };

export type PrepareResult =
  | { readonly ok: true; readonly prepared: Prepared }
  | { readonly ok: false; readonly conflict: SolverConflict };

/**
 * Builds blocks (union-find over Good pairs) and Keep apart edges. Pairs that mention a Student not
 * in `students` (Absent, or in a Locked Group) are ignored.
 */
export function prepare(
  students: readonly number[],
  split: readonly number[],
  goodPairs: readonly SolverPair[],
  keepApart: readonly SolverPair[],
): PrepareResult {
  const index = new Map(students.map((s, i) => [s, i]));
  const parent = students.map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]!]!;
      x = parent[x]!;
    }
    return x;
  };
  for (const p of goodPairs) {
    const a = index.get(p.a);
    const b = index.get(p.b);
    if (a !== undefined && b !== undefined) parent[find(a)] = find(b);
  }

  const blockOfRoot = new Map<number, number>();
  const blocks: number[][] = [];
  const blockOf: number[] = [];
  students.forEach((s, i) => {
    const root = find(i);
    let block = blockOfRoot.get(root);
    if (block === undefined) {
      block = blocks.length;
      blockOfRoot.set(root, block);
      blocks.push([]);
    }
    blocks[block]!.push(s);
    blockOf[i] = block;
  });

  const adj = blocks.map(() => new Set<number>());
  for (const p of keepApart) {
    const a = index.get(p.a);
    const b = index.get(p.b);
    if (a === undefined || b === undefined) continue;
    const x = blockOf[a]!;
    const y = blockOf[b]!;
    if (x === y) return { ok: false, conflict: { kind: "apart-inside-chain", pairId: p.id } };
    adj[x]!.add(y);
    adj[y]!.add(x);
  }

  return { ok: true, prepared: { split, blocks, adj } };
}
