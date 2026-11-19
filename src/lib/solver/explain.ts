// Solver stage 4 (spec: solver.md): explain a Conflict that the search proved, by finding a small set of
// clashing Pairs with QuickXplain (Junker, AAAI 2004) over the Pairs, with the Split as fixed
// background (Locked Groups are already out of the pool).
//
// QuickXplain takes the Pairs in preference order and returns the conflict that fits in the
// shortest prefix of that order. The order is newest Pair first (by `created`), so the Pairs the
// Teacher added last are the ones blamed: when a new Pair made the Rules clash, it is in the answer.
//
// Each re-solve gets a node budget. A re-solve that runs out counts as "solvable", which only ever
// keeps a Pair in the answer ("this Pair is needed"): the answer always genuinely conflicts (every
// "conflicts" verdict is a proof) but may then not be the smallest set.

import { prepare, type SolverPair } from "./prepare";
import type { Rng } from "./rng";
import { OUT_OF_BUDGET, searchWithin } from "./search";

/** Nodes each re-solve may spend before it counts as "solvable". */
export const EXPLAIN_NODE_BUDGET = 500;

export interface ExplainInput {
  /** The free pool. */
  readonly students: readonly number[];
  /** Free Group sizes. */
  readonly split: readonly number[];
  readonly goodPairs?: readonly SolverPair[];
  readonly keepApart?: readonly SolverPair[];
  /** The Target size, as given to `solve`. */
  readonly target?: number;
  /** Defaults to Math.random. */
  readonly rng?: Rng;
  /** Defaults to EXPLAIN_NODE_BUDGET. */
  readonly nodeBudget?: number;
}

export interface Explanation {
  /** The clashing Pairs, newest first. Empty when the Pairs don't conflict after all. */
  readonly pairIds: readonly string[];
  /**
   * False when a re-solve ran out of nodes: the Pairs still genuinely conflict, but removing one of
   * them might not make a grouping possible.
   */
  readonly minimal: boolean;
}

interface Rule extends SolverPair {
  readonly good: boolean;
}

/**
 * The clashing Pairs behind a Conflict among the given Pairs (QuickXplain, newest blamed first).
 * Meant for a Conflict the search proved (`no-solution`); Pairs that can't matter (a Keep apart
 * with a Student outside the pool, a chain with no Student in it) are never blamed.
 */
export function explain(input: ExplainInput): Explanation {
  const { students, split, goodPairs = [], keepApart = [], target, rng = Math.random } = input;
  const nodeBudget = input.nodeBudget ?? EXPLAIN_NODE_BUDGET;
  let minimal = true;

  const consistent = (rules: readonly Rule[], budget = nodeBudget): boolean => {
    const good = rules.filter((r) => r.good);
    const apart = rules.filter((r) => !r.good);
    const prep = prepare(students, split, good, apart, target);
    // A quick check is a proof too.
    if (!prep.ok) return false;
    const assign = searchWithin(prep.prepared, rng, budget);
    if (assign === OUT_OF_BUDGET) {
      minimal = false;
      return true;
    }
    return assign !== null;
  };

  // Newest first; ties (none in practice: `created` is a counter) by id for a stable answer.
  const rules = relevantRules(students, goodPairs, keepApart).sort(
    (x, y) => y.created - x.created || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0),
  );
  // The whole set gets a complete search, so every answer rests on a proof.
  if (rules.length === 0 || consistent(rules, Infinity)) return { pairIds: [], minimal };

  // QuickXplain: `background` is known to clash with all of `candidates`; returns the part of
  // `candidates` that is needed, preferring the earlier (newer) ones. `added` says whether the
  // background just grew, so it is worth checking on its own.
  const qx = (background: readonly Rule[], added: boolean, candidates: readonly Rule[]): Rule[] => {
    if (added && !consistent(background)) return [];
    if (candidates.length === 1) return [...candidates];
    const half = Math.ceil(candidates.length / 2);
    const first = candidates.slice(0, half);
    const second = candidates.slice(half);
    const fromSecond = qx([...background, ...first], first.length > 0, second);
    const fromFirst = qx([...background, ...fromSecond], fromSecond.length > 0, first);
    return [...fromFirst, ...fromSecond];
  };

  return { pairIds: qx([], false, rules).map((r) => r.id), minimal };
}

/** Keep apart Pairs with both Students in the pool, and Good pairs whose chain reaches the pool. */
function relevantRules(
  students: readonly number[],
  goodPairs: readonly SolverPair[],
  keepApart: readonly SolverPair[],
): Rule[] {
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    let root = x;
    while (parent.has(root) && parent.get(root) !== root) root = parent.get(root)!;
    parent.set(x, root);
    return root;
  };
  for (const p of goodPairs) {
    const ra = find(p.a);
    const rb = find(p.b);
    if (ra !== rb) parent.set(ra, rb);
  }
  const pool = new Set(students);
  const reached = new Set([...pool].map(find));
  return [
    ...goodPairs.filter((p) => reached.has(find(p.a))).map((p) => ({ ...p, good: true })),
    ...keepApart.filter((p) => pool.has(p.a) && pool.has(p.b)).map((p) => ({ ...p, good: false })),
  ];
}
