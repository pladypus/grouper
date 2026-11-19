// Solver stage 2 (SPEC §5): find one grouping by complete randomized backtracking with restarts.
//
// Blocks are placed one at a time into Groups (here "bins", indexed like the Split):
// - next block: fewest Groups it still fits (MRV), ties by most Keep apart edges (DSatur), then the
//   larger block, then random;
// - candidate Groups in random order, trying only one of several interchangeable empty Groups of
//   the same size;
// - forward checking both ways: every unplaced block still fits somewhere, and every Group with
//   free seats can still be filled by blocks that could go there.
// Each attempt has a node budget (1000, ×1.5 per restart, unbounded), so the search is complete:
// returning null proves there is no grouping.

import type { Prepared } from "./prepare";
import { shuffleInPlace, type Rng } from "./rng";

export const FIRST_NODE_BUDGET = 1000;
export const NODE_BUDGET_GROWTH = 1.5;

/** Returned when an attempt runs out of nodes (as opposed to proving there is no grouping). */
const OUT_OF_BUDGET = "budget";

/** One attempt: block → Group index, null if proved impossible, or OUT_OF_BUDGET. */
function attempt(
  { split, blocks, adj }: Prepared,
  rng: Rng,
  nodeBudget: number,
): number[] | null | typeof OUT_OF_BUDGET {
  const nb = blocks.length;
  const nbin = split.length;
  const free = split.slice();
  const assign: number[] = new Array<number>(nb).fill(-1);
  const inBin: number[][] = split.map(() => []);
  const tiebreak = blocks.map(() => rng());
  let nodes = 0;

  const fits = (b: number, k: number): boolean =>
    free[k]! >= blocks[b]!.length && !inBin[k]!.some((o) => adj[b]!.has(o));

  const rec = (left: number): boolean | typeof OUT_OF_BUDGET => {
    if (++nodes > nodeBudget) return OUT_OF_BUDGET;
    if (left === 0) return true;

    // Every Group with free seats must still be fillable.
    for (let k = 0; k < nbin; k++) {
      if (free[k] === 0) continue;
      let supply = 0;
      for (let b = 0; b < nb && supply < free[k]!; b++) {
        if (assign[b] === -1 && fits(b, k)) supply += blocks[b]!.length;
      }
      if (supply < free[k]!) return false;
    }

    // Choose the next block.
    let best = -1;
    let bestBins: number[] = [];
    for (let b = 0; b < nb; b++) {
      if (assign[b] !== -1) continue;
      const bins: number[] = [];
      for (let k = 0; k < nbin; k++) if (fits(b, k)) bins.push(k);
      if (bins.length === 0) return false;
      if (best === -1 || better(b, bins.length, best, bestBins.length)) {
        best = b;
        bestBins = bins;
      }
    }

    shuffleInPlace(bestBins, rng);
    const triedEmpty = new Set<number>();
    for (const k of bestBins) {
      if (inBin[k]!.length === 0) {
        if (triedEmpty.has(split[k]!)) continue;
        triedEmpty.add(split[k]!);
      }
      assign[best] = k;
      free[k]! -= blocks[best]!.length;
      inBin[k]!.push(best);
      const result = rec(left - 1);
      if (result !== false) return result;
      assign[best] = -1;
      free[k]! += blocks[best]!.length;
      inBin[k]!.pop();
    }
    return false;
  };

  const better = (b: number, bins: number, best: number, bestBins: number): boolean => {
    if (bins !== bestBins) return bins < bestBins;
    if (adj[b]!.size !== adj[best]!.size) return adj[b]!.size > adj[best]!.size;
    if (blocks[b]!.length !== blocks[best]!.length) return blocks[b]!.length > blocks[best]!.length;
    return tiebreak[b]! < tiebreak[best]!;
  };

  const result = rec(nb);
  if (result === OUT_OF_BUDGET) return OUT_OF_BUDGET;
  return result ? assign : null;
}

/**
 * Finds one grouping (block index → Group index), or null when none exists. Assumes the Split's
 * total equals the number of Students in the blocks.
 */
export function search(prepared: Prepared, rng: Rng): number[] | null {
  let budget = FIRST_NODE_BUDGET;
  for (;;) {
    const result = attempt(prepared, rng, budget);
    if (result !== OUT_OF_BUDGET) return result;
    budget = Math.ceil(budget * NODE_BUDGET_GROWTH);
  }
}
