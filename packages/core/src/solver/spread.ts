// Solver stage 3 (SPEC §5): spread. Backtracking alone is biased (it fills Groups in a pattern), so
// the grouping it found is mixed by Metropolis steps: pick two different Groups, pick a random subset
// of blocks in each (each block with probability ½), and swap the subsets if their total sizes match
// and no Keep apart edge breaks. The proposal is symmetric, so every valid grouping reachable this
// way is equally likely in the long run. Sizes never change, so the result still matches the Split.

import type { Prepared } from "./prepare";
import { randomInt, type Rng } from "./rng";

/** SPEC §14: fixed at 300 (research range 200–500). */
export const SPREAD_STEPS = 300;

/** Mixes `assign` (block index → Group index) in place and returns it. */
export function spread({ split, blocks, adj }: Prepared, assign: number[], steps: number, rng: Rng): number[] {
  const nbin = split.length;
  if (nbin < 2) return assign;
  const members: number[][] = split.map(() => []);
  assign.forEach((k, b) => members[k]!.push(b));

  const size = (bs: readonly number[]) => bs.reduce((sum, b) => sum + blocks[b]!.length, 0);
  const clash = (xs: readonly number[], ys: readonly number[]) => xs.some((x) => ys.some((y) => adj[x]!.has(y)));

  for (let step = 0; step < steps; step++) {
    const g = randomInt(rng, nbin);
    let h = randomInt(rng, nbin - 1);
    if (h >= g) h++;
    const out: number[] = [];
    const stay: number[] = [];
    const inn: number[] = [];
    const stayH: number[] = [];
    for (const b of members[g]!) (rng() < 0.5 ? out : stay).push(b);
    for (const b of members[h]!) (rng() < 0.5 ? inn : stayH).push(b);
    if ((out.length === 0 && inn.length === 0) || size(out) !== size(inn)) continue;
    if (clash(out, stayH) || clash(inn, stay)) continue;
    members[g] = stay.concat(inn);
    members[h] = stayH.concat(out);
    for (const b of out) assign[b] = h;
    for (const b of inn) assign[b] = g;
  }
  return assign;
}
