// Solver stage 2 (spec: solver.md): find one grouping by complete randomized backtracking with restarts.
//
// Blocks are placed one at a time into Groups (here "bins", indexed like the Split):
// - next block: fewest Groups it still fits (MRV), ties by most Keep apart edges (DSatur), then the
//   larger block, then random;
// - candidate Groups in random order, trying only one of several interchangeable Groups (the same
//   free seats, kept apart from the same unplaced blocks; e.g. empty Groups of the same size);
// - forward checking both ways: every unplaced block still fits somewhere, and every Group with
//   free seats can still be filled by blocks that could go there;
// - a pigeonhole check with sizes: unplaced blocks that pairwise can't share a Group (Keep apart,
//   or together bigger than any Group's free seats; found greedily, largest first) can't outnumber
//   the Groups with free seats;
// - a packing check: the unplaced block sizes must fill the free seats exactly, Keep apart aside.
// The last three keep proofs short for chains that can't be packed into the Groups (e.g. a chain of
// 2 left over after 10 chains of 3 in 10 Groups of 4), which explain's re-solves meet often.
// Each attempt has a node budget (1000, ×1.5 per restart, unbounded), so the search is complete:
// returning null proves there is no grouping.

import type { Prepared } from "./prepare";
import { shuffleInPlace, type Rng } from "./rng";

export const FIRST_NODE_BUDGET = 1000;
export const NODE_BUDGET_GROWTH = 1.5;

/** Returned when an attempt runs out of nodes (as opposed to proving there is no grouping). */
export const OUT_OF_BUDGET = "budget";

/**
 * Whether blocks of these sizes (largest first) can fill Groups with these free seats exactly when
 * Keep apart is ignored: a relaxation, so false proves there is no grouping. Best-fit decreasing
 * settles almost every case; the rest are searched Group by Group (largest free first), memoized
 * in `memo` by the sizes left and the free seats.
 */
function packable(sizes: readonly number[], free: readonly number[], memo: Map<string, boolean>): boolean {
  const seats = free.filter((f) => f > 0);
  const greedy = seats.slice();
  let placed = 0;
  for (const s of sizes) {
    let k = -1;
    for (let j = 0; j < greedy.length; j++) if (greedy[j]! >= s && (k < 0 || greedy[j]! < greedy[k]!)) k = j;
    if (k < 0) break;
    greedy[k]! -= s;
    placed++;
  }
  if (placed === sizes.length) return true;

  const counts: number[] = [];
  for (const s of sizes) counts[s] = (counts[s] ?? 0) + 1;
  const fill = (left: readonly number[]): boolean => {
    if (left.length === 0) return counts.every((c) => !c);
    const key = `${counts.join(",")}|${left.join(",")}`;
    const known = memo.get(key);
    if (known !== undefined) return known;
    const [f, ...rest] = left as [number, ...number[]];
    // Choose sizes for the first Group, largest first, adding up to exactly f.
    const choose = (need: number, max: number): boolean => {
      if (need === 0) return fill(rest);
      for (let s = Math.min(need, max); s >= 1; s--) {
        if (!counts[s]) continue;
        counts[s]!--;
        const ok = choose(need - s, s);
        counts[s]!++;
        if (ok) return true;
      }
      return false;
    };
    const ok = choose(f, f);
    memo.set(key, ok);
    return ok;
  };
  return fill(seats.sort((x, y) => y - x));
}

/** One attempt: block → Group index, null if proved impossible, or OUT_OF_BUDGET. */
function attempt(
  { split, blocks, adj }: Prepared,
  rng: Rng,
  nodeBudget: number,
  packMemo: Map<string, boolean>,
): number[] | null | typeof OUT_OF_BUDGET {
  const nb = blocks.length;
  const nbin = split.length;
  const free = split.slice();
  const assign: number[] = new Array<number>(nb).fill(-1);
  const inBin: number[][] = split.map(() => []);
  const tiebreak = blocks.map(() => rng());
  let nodes = 0;

  const size = blocks.map((b) => b.length);
  const bySize = blocks.map((_, b) => b).sort((x, y) => size[y]! - size[x]!);
  const singles = size.every((s) => s === 1);
  const neighbours = adj.map((s) => [...s]);
  // blocked[b * nbin + k]: how many of b's Keep apart neighbours are in Group k.
  const blocked = new Int32Array(nb * nbin);
  const fits = (b: number, k: number): boolean => free[k]! >= size[b]! && blocked[b * nbin + k] === 0;
  const place = (b: number, k: number, step: 1 | -1) => {
    assign[b] = step === 1 ? k : -1;
    free[k]! -= step * size[b]!;
    if (step === 1) inBin[k]!.push(b);
    else inBin[k]!.pop();
    for (const o of neighbours[b]!) blocked[o * nbin + k]! += step;
  };

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

    // Blocks that pairwise can't share a Group (a Keep apart edge, or too big together for any
    // Group's free seats) each need their own Group. Greedy, largest first.
    let maxFree = 0;
    let open = 0;
    for (let k = 0; k < nbin; k++) {
      if (free[k]! > 0) open++;
      if (free[k]! > maxFree) maxFree = free[k]!;
    }
    const apart: number[] = [];
    for (const b of bySize) {
      if (assign[b] !== -1) continue;
      let alone = true;
      for (const o of apart) {
        if (size[b]! + size[o]! <= maxFree && !adj[b]!.has(o)) {
          alone = false;
          break;
        }
      }
      if (alone) {
        apart.push(b);
        if (apart.length > open) return false;
      }
    }

    // The unplaced blocks must be able to fill the free seats exactly, even ignoring Keep apart
    // (always true when every block is a single Student).
    if (!singles) {
      const sizes: number[] = [];
      for (const b of bySize) if (assign[b] === -1) sizes.push(size[b]!);
      if (!packable(sizes, free, packMemo)) return false;
    }

    // Choose the next block.
    let best = -1;
    let bestCount = 0;
    for (let b = 0; b < nb; b++) {
      if (assign[b] !== -1) continue;
      let count = 0;
      for (let k = 0; k < nbin; k++) if (fits(b, k)) count++;
      if (count === 0) return false;
      if (best === -1 || better(b, count, best, bestCount)) {
        best = b;
        bestCount = count;
      }
    }
    const bestBins: number[] = [];
    for (let k = 0; k < nbin; k++) if (fits(best, k)) bestBins.push(k);

    shuffleInPlace(bestBins, rng);
    const tried = new Set<string>();
    for (const k of bestBins) {
      // Two Groups with the same free seats that the same unplaced blocks are kept apart from are
      // interchangeable from here on: try only one.
      if (bestBins.length > 1) {
        let key = `${free[k]}`;
        for (let b = 0; b < nb; b++) if (assign[b] === -1 && b !== best && blocked[b * nbin + k]! > 0) key += `,${b}`;
        if (tried.has(key)) continue;
        tried.add(key);
      }
      place(best, k, 1);
      const result = rec(left - 1);
      if (result !== false) return result;
      place(best, k, -1);
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
  return searchWithin(prepared, rng, Infinity) as number[] | null;
}

/**
 * `search` with a cap on the nodes spent over all restarts: the grouping, null when none exists
 * (proved), or OUT_OF_BUDGET ("budget") when the cap ran out first (nothing proved). Explain's
 * re-solves use it.
 */
export function searchWithin(prepared: Prepared, rng: Rng, maxNodes: number): number[] | null | typeof OUT_OF_BUDGET {
  let budget = FIRST_NODE_BUDGET;
  let left = maxNodes;
  const packMemo = new Map<string, boolean>();
  for (;;) {
    const cap = Math.min(budget, left);
    const result = attempt(prepared, rng, cap, packMemo);
    if (result !== OUT_OF_BUDGET) return result;
    left -= cap;
    if (left <= 0) return OUT_OF_BUDGET;
    budget = Math.ceil(budget * NODE_BUDGET_GROWTH);
  }
}
