# Solver (#2)

A pure module (`src/lib/solver/`), about 200 lines, no dependencies, fully unit-tested. Takes integer Student ids. Reference prototype: [`research/solver-algorithm/solver.mjs`](https://github.com/pladypus/grouper/blob/archive/research/solver-algorithm/research/solver-algorithm/solver.mjs) in the `archive/research/solver-algorithm` tag; findings in [`research/solver-algorithm.md`](https://github.com/pladypus/grouper/blob/archive/research/solver-algorithm/research/solver-algorithm.md).

```ts
solve(input: {
  students: number[];                 // the free pool
  split: number[];                    // free Group sizes
  goodPairs: { id: string; a: number; b: number; created: number }[];
  keepApart: { id: string; a: number; b: number; created: number }[];
  rng?: () => number;                 // injectable for tests
}): { ok: true; groups: number[][] } | { ok: false; conflict: Conflict }
```

(Lock handling, chain-vs-Lock and lone-Leftover checks from [Shuffle rules](shuffle-rules.md) run in the caller before `solve`.)

1. **Preprocess.** Union-find Good pairs into blocks (only Present members). Keep apart Pairs become edges between blocks. Quick checks, each producing a structured Conflict:
   - `chain-too-big`: a block bigger than the **Target size** (not the largest Group in the Split; e.g. a chain of 3 at Target size 2 is a Conflict even when the Split has a Group of 3).
   - `apart-clique` (pigeonhole): an exact maximum clique (branch and bound) of the Keep apart block graph larger than the number of Groups.
   - `apart-inside-chain`: defensive only; entry-time refusal and Import prevent it.
2. **Find one grouping.** Complete randomized backtracking: MRV, ties by DSatur (most Keep apart edges), then larger block, then random; candidate Groups in random order; only one of several interchangeable Groups is tried (the same free seats and kept apart from the same unplaced blocks, e.g. empty Groups of the same size); forward checking both ways (every unplaced block still has a Group it fits, and every Group with free seats can still be filled), plus a pigeonhole check with sizes and a check that the unplaced block sizes can fill the free seats exactly (so chains that can't be packed are ruled out quickly); randomized restarts with node budget starting at 1000 and ×1.5 each restart, unbounded, so running out of options **proves** a Conflict.
3. **Spread.** 300 Metropolis steps: pick two different Groups, pick a random subset of blocks in each (each block with probability ½), swap the subsets if their total sizes match and no Keep apart edge breaks. This removes backtracking's bias. **Spread steps** fixed at 300 (research range 200–500) (choice, cheap to change).
4. **Explain** (only when the search proves a Conflict and no quick check fired): QuickXplain over the Pairs, with the Split as fixed background and preference order **newest Pair blamed first**. Each re-solve gets a node budget (500); running out counts as "this Pair is needed", so the result always genuinely conflicts but may occasionally not be the smallest set. No progress UI.

**Performance targets** (40 Present Students): Shuffle well under 10 ms; explanation under 10 ms with realistic Rules (≤ 40 Keep apart) and under 1 s with dense ones.

**Tests must cover:** the hand-made cases in the research table (11 mutually apart / 10 Groups; odd wheel W5 / 3 Groups; 25 at size 2 with two chains of 3; one Student apart from everyone at size 2; tight but feasible); every returned grouping satisfies every Rule and matches the Split; spread is close to uniform on small instances checked against exact enumeration (chi²/df < 2).
