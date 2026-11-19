// The Shuffle solver (SPEC §5): pure, dependency-free, synchronous. Takes integer Student ids for
// the free pool and returns Groups that match the Split and keep every Rule, or a Conflict.
//
// Stages: prepare (blocks + Keep apart edges, quick checks) → search (backtracking with restarts)
// → spread (set-swap mixing). Explain (QuickXplain over the Pairs, #17) will run after a
// `no-solution` result. Lock handling and the lone-Leftover check happen in the caller.

import { prepare, type SolverConflict, type SolverPair } from "./prepare";
import { shuffleInPlace, type Rng } from "./rng";
import { search } from "./search";
import { spread, SPREAD_STEPS } from "./spread";

export { maxClique, prepare, type Prepared, type PrepareResult, type SolverConflict, type SolverPair } from "./prepare";
export { randomInt, seededRng, shuffleInPlace, type Rng } from "./rng";
export { FIRST_NODE_BUDGET, NODE_BUDGET_GROWTH, search } from "./search";
export { spread, SPREAD_STEPS } from "./spread";

export interface SolveInput {
  /** The free pool: distinct Student ids. */
  readonly students: readonly number[];
  /** Free Group sizes; must add up to `students.length`. */
  readonly split: readonly number[];
  /** Good pairs may mention Students outside `students` (e.g. Absent ones): chains still run through them. */
  readonly goodPairs?: readonly SolverPair[];
  /** Keep apart Pairs with a Student outside `students` are ignored. */
  readonly keepApart?: readonly SolverPair[];
  /** The Target size, for the `chain-too-big` quick check. Defaults to the largest Group. */
  readonly target?: number;
  /** Defaults to Math.random. */
  readonly rng?: Rng;
  /** Defaults to SPREAD_STEPS. */
  readonly spreadSteps?: number;
}

export type SolveResult =
  /** `groups[i]` has exactly `split[i]` Students, in random order. */
  | { readonly ok: true; readonly groups: number[][] }
  | { readonly ok: false; readonly conflict: SolverConflict };

export function solve(input: SolveInput): SolveResult {
  const { students, split, goodPairs = [], keepApart = [], target, rng = Math.random, spreadSteps = SPREAD_STEPS } = input;
  const total = split.reduce((sum, n) => sum + n, 0);
  if (total !== students.length) {
    // A caller bug, not something the Teacher did.
    throw new Error(`Split adds up to ${total} but there are ${students.length} students`);
  }

  const prep = prepare(students, split, goodPairs, keepApart, target);
  if (!prep.ok) return prep;
  const { prepared } = prep;

  const assign = search(prepared, rng);
  if (!assign) return { ok: false, conflict: { kind: "no-solution" } };
  spread(prepared, assign, spreadSteps, rng);

  const groups: number[][] = split.map(() => []);
  assign.forEach((k, b) => groups[k]!.push(...prepared.blocks[b]!));
  for (const g of groups) shuffleInPlace(g, rng);
  return { ok: true, groups };
}
