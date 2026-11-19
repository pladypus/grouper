// The solver with Pairs (#16): quick checks, the research's hand-made cases, every result keeping
// every Rule, spread close to uniform, and speed at 40 Present.

import { describe, expect, it } from "vitest";
import { deriveSplit } from "../split";
import { maxClique, seededRng, solve, type Rng, type SolveInput, type SolverPair, type SolveResult } from "./index";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function pairs(list: ReadonlyArray<readonly [number, number]>, prefix = "p"): SolverPair[] {
  return list.map(([a, b], i) => ({ id: `${prefix}${i}`, a, b, created: i }));
}

/** The ids `pairs` gives its first `n` Pairs, newest first (the order explain lists them in). */
const newestFirst = (n: number, prefix = "p") => range(n).reverse().map((i) => `${prefix}${i}`);

/** Every Pair among each other ("mutually kept apart"). */
function allPairs(students: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  students.forEach((a, i) => students.slice(i + 1).forEach((b) => out.push([a, b])));
  return out;
}

/** Throws unless `result` is Groups matching the Split, using every Student once, keeping every Rule. */
function expectValid(input: SolveInput, result: SolveResult): number[][] {
  if (!result.ok) throw new Error(`expected groups, got ${result.conflict.kind}`);
  const { groups } = result;
  expect(groups.map((g) => g.length)).toEqual(input.split);
  expect(groups.flat().sort((a, b) => a - b)).toEqual([...input.students].sort((a, b) => a - b));
  const groupOf = new Map<number, number>();
  groups.forEach((g, k) => g.forEach((s) => groupOf.set(s, k)));
  // Good pairs (and chains through Students outside the pool) hold among pool members.
  const chainOf = chainRoots(input.goodPairs ?? []);
  for (const a of input.students) {
    for (const b of input.students) {
      if (a < b && chainOf(a) === chainOf(b)) expect(groupOf.get(a)).toBe(groupOf.get(b));
    }
  }
  for (const p of input.keepApart ?? []) {
    if (groupOf.has(p.a) && groupOf.has(p.b)) expect(groupOf.get(p.a)).not.toBe(groupOf.get(p.b));
  }
  return groups;
}

function chainRoots(goodPairs: readonly SolverPair[]): (s: number) => number {
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    while (parent.has(x) && parent.get(x) !== x) x = parent.get(x)!;
    return x;
  };
  for (const p of goodPairs) {
    const ra = find(p.a);
    const rb = find(p.b);
    if (ra !== rb) parent.set(ra, rb);
  }
  return find;
}

/** Whether any grouping keeps every Rule, by brute force (small instances only). */
function feasibleByEnumeration(input: SolveInput): boolean {
  const { students, split } = input;
  const chainOf = chainRoots(input.goodPairs ?? []);
  const apart = (input.keepApart ?? []).filter((p) => students.includes(p.a) && students.includes(p.b));
  const assign = new Map<number, number>();
  const free = [...split];
  const place = (i: number): boolean => {
    if (i === students.length) return true;
    const s = students[i]!;
    for (let k = 0; k < split.length; k++) {
      if (free[k] === 0) continue;
      const clash = [...assign].some(
        ([t, kt]) =>
          (kt === k && apart.some((p) => (p.a === s && p.b === t) || (p.a === t && p.b === s))) ||
          (kt !== k && chainOf(t) === chainOf(s)),
      );
      if (clash) continue;
      assign.set(s, k);
      free[k]!--;
      if (place(i + 1)) return true;
      assign.delete(s);
      free[k]!++;
    }
    return false;
  };
  return place(0);
}

function randomInstance(rng: Rng, n: number, target: number, goodCount: number, apartCount: number): SolveInput {
  const pick = (): [number, number] => {
    const a = Math.floor(rng() * n);
    let b = Math.floor(rng() * (n - 1));
    if (b >= a) b++;
    return [a, b];
  };
  const goodPairs = pairs(Array.from({ length: goodCount }, pick), "g");
  const chainOf = chainRoots(goodPairs);
  // Like entry-time refusal: no Keep apart pair inside a chain.
  const keepApart = pairs(
    Array.from({ length: apartCount }, pick).filter(([a, b]) => chainOf(a) !== chainOf(b)),
    "k",
  );
  return { students: range(n), split: deriveSplit(n, target), goodPairs, keepApart, rng };
}

describe("solver quick checks", () => {
  it("chain-too-big: a chain bigger than the Target size, even when a Group would fit it", () => {
    const goodPairs = pairs([[0, 1], [1, 2]]);
    const result = solve({ students: range(7), split: [2, 2, 3], goodPairs, target: 2 });
    expect(result).toEqual({
      ok: false,
      conflict: { kind: "chain-too-big", students: [0, 1, 2], limit: 2, pairIds: ["p0", "p1"] },
    });
    // Without a Target size the largest Group is the limit.
    expect(solve({ students: range(7), split: [2, 2, 3], goodPairs, rng: seededRng(1) }).ok).toBe(true);
    expect(solve({ students: range(6), split: [2, 2, 2], goodPairs })).toMatchObject({
      ok: false,
      conflict: { kind: "chain-too-big", limit: 2 },
    });
  });

  it("chains run through Students outside the pool (Absent members don't break a chain)", () => {
    // 0 – 9 – 1: 9 is Absent, so 0 and 1 still share a Group; the chain's Pairs include 9's.
    const goodPairs = pairs([[0, 9], [9, 1], [2, 8]]);
    const rng = seededRng(4);
    for (let i = 0; i < 50; i++) {
      const input = { students: range(6), split: [2, 2, 2], goodPairs, rng };
      const groups = expectValid(input, solve(input));
      expect(groups.find((g) => g.includes(0))).toContain(1);
    }
    expect(solve({ students: range(6), split: [3, 3], goodPairs: pairs([[0, 9], [9, 1], [1, 2]]), target: 2 })).toEqual({
      ok: false,
      conflict: { kind: "chain-too-big", students: [0, 1, 2], limit: 2, pairIds: ["p0", "p1", "p2"] },
    });
  });

  it("apart-clique counts a chain as one block", () => {
    // {0,1} is a chain; it, 2 and 3 are all kept apart from each other, in 2 Groups.
    const goodPairs = pairs([[0, 1]], "g");
    const keepApart = pairs([[0, 2], [1, 3], [2, 3], [4, 5]], "k");
    expect(solve({ students: range(6), split: [3, 3], goodPairs, keepApart })).toEqual({
      ok: false,
      conflict: { kind: "apart-clique", blocks: [[0, 1], [2], [3]], groups: 2, pairIds: ["k0", "k1", "k2"] },
    });
  });

  it("apart-inside-chain lists the Keep apart pair, then the chain's Good pairs", () => {
    const result = solve({
      students: range(4),
      split: [2, 2],
      goodPairs: pairs([[0, 1], [1, 2]], "g"),
      keepApart: pairs([[2, 0]], "k"),
    });
    expect(result).toEqual({ ok: false, conflict: { kind: "apart-inside-chain", pairId: "k0", pairIds: ["k0", "g0", "g1"] } });
  });

  it("maxClique finds an exact maximum clique", () => {
    const graph = (n: number, edges: [number, number][]) => {
      const adj = range(n).map(() => new Set<number>());
      for (const [a, b] of edges) {
        adj[a]!.add(b);
        adj[b]!.add(a);
      }
      return adj;
    };
    // Odd wheel W5: triangles only.
    const w5 = graph(6, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [5, 0], [5, 1], [5, 2], [5, 3], [5, 4]]);
    expect(maxClique(w5)).toHaveLength(3);
    expect(maxClique(graph(7, [...allPairs([1, 3, 4, 6]), [0, 1], [2, 3]]))).toEqual([1, 3, 4, 6]);
    expect(maxClique(graph(3, []))).toHaveLength(1);
    expect(maxClique(graph(3, []), 1)).toEqual([]);
  });
});

describe("solver: the research's hand-made cases", () => {
  const timed = (input: SolveInput) => {
    const start = Date.now();
    const result = solve(input);
    return { result, ms: Date.now() - start };
  };

  it("11 mutually kept-apart Students, 10 Groups (+30 other Keep apart pairs): pigeonhole", () => {
    const apart = allPairs(range(11));
    for (let i = 0; i < 30; i++) {
      const a = 11 + (i % 29);
      const b = 11 + ((i * 7 + 3) % 29);
      if (a !== b) apart.push([a, b]);
    }
    const { result, ms } = timed({ students: range(40), split: deriveSplit(40, 4), keepApart: pairs(apart), target: 4 });
    expect(result.ok).toBe(false);
    if (result.ok || result.conflict.kind !== "apart-clique") throw new Error("expected apart-clique");
    expect(result.conflict.blocks).toEqual(range(11).map((s) => [s]));
    expect(result.conflict.groups).toBe(10);
    expect(result.conflict.pairIds).toHaveLength(55);
    expect(ms).toBeLessThan(50);
  });

  it("5 mutually kept-apart Students, 25 Present at 5 (5 Groups): feasible", () => {
    const input = { students: range(25), split: deriveSplit(25, 5), keepApart: pairs(allPairs(range(5))), rng: seededRng(2) };
    expectValid(input, solve(input));
  });

  it("odd wheel W5 in 3 Groups: max clique is 3, but search proves there's no grouping; the 10 wheel Pairs clash", () => {
    const keepApart = pairs([[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [5, 0], [5, 1], [5, 2], [5, 3], [5, 4]]);
    const { result, ms } = timed({ students: range(40), split: deriveSplit(40, 13), keepApart, rng: seededRng(3) });
    expect(result).toEqual({ ok: false, conflict: { kind: "no-solution", pairIds: newestFirst(10) } });
    expect(ms).toBeLessThan(100);
  });

  it("11 chains of 3 in 10 Groups of 4: search proves there's no grouping; all but the oldest Good pair clash", () => {
    const goodPairs = pairs(range(11).flatMap((i) => [[3 * i, 3 * i + 1], [3 * i + 1, 3 * i + 2]] as [number, number][]));
    const keepApart = pairs([[33, 34], [35, 36], [0, 39]], "k");
    const { result, ms } = timed({ students: range(40), split: deriveSplit(40, 4), goodPairs, keepApart, target: 4, rng: seededRng(4) });
    // 10 whole chains of 3 fill every Group but one seat each, so the newer Good pair of the oldest
    // chain (a chain of 2) can't fit; the Keep apart pairs don't matter.
    expect(result).toEqual({ ok: false, conflict: { kind: "no-solution", pairIds: newestFirst(22).slice(0, 21) } });
    expect(ms).toBeLessThan(100);
  });

  it("a Keep apart pair inside a chain", () => {
    const result = solve({
      students: range(40),
      split: deriveSplit(40, 4),
      goodPairs: pairs([[0, 1], [1, 2]], "g"),
      keepApart: pairs([[1, 2], [5, 6]], "k"),
    });
    expect(result).toMatchObject({ ok: false, conflict: { kind: "apart-inside-chain", pairId: "k0" } });
  });

  it("one Student kept apart from all 39 others, groups of 2: no grouping; all 39 Pairs clash", () => {
    const keepApart = pairs(range(39).map((i) => [0, i + 1] as [number, number]));
    const { result, ms } = timed({ students: range(40), split: deriveSplit(40, 2), keepApart, target: 2, rng: seededRng(5) });
    expect(result).toEqual({ ok: false, conflict: { kind: "no-solution", pairIds: newestFirst(39) } });
    expect(ms).toBeLessThan(100);
  });

  it("10 mutually kept-apart in 10 Groups of 4, plus chains: tight but feasible", () => {
    const apart = allPairs(range(10));
    for (let i = 0; i < 10; i++) apart.push([10 + i, 20 + i]);
    const goodPairs = pairs([[10, 11], [11, 12], [30, 31]], "g");
    const input = { students: range(40), split: deriveSplit(40, 4), goodPairs, keepApart: pairs(apart, "k"), target: 4, rng: seededRng(6) };
    for (let i = 0; i < 20; i++) expectValid(input, solve(input));
  });

  it("25 Present at 2 (12×2 + 1×3) with two chains of 3: chain too big for the Target size", () => {
    const goodPairs = pairs([[0, 1], [1, 2], [3, 4], [4, 5]], "g");
    const keepApart = pairs([[6, 7], [8, 9]], "k");
    const split = deriveSplit(25, 2);
    expect(split).toEqual([...new Array<number>(11).fill(2), 3]);
    expect(solve({ students: range(25), split, goodPairs, keepApart, target: 2 })).toMatchObject({
      ok: false,
      conflict: { kind: "chain-too-big", students: [0, 1, 2], limit: 2, pairIds: ["g0", "g1"] },
    });
  });

  it("…and without a Target size (only the Split): both chains' Good pairs clash", () => {
    const goodPairs = pairs([[0, 1], [1, 2], [3, 4], [4, 5]], "g");
    const keepApart = pairs([[6, 7], [8, 9]], "k");
    expect(solve({ students: range(25), split: deriveSplit(25, 2), goodPairs, keepApart, rng: seededRng(8) })).toEqual({
      ok: false,
      conflict: { kind: "no-solution", pairIds: newestFirst(4, "g") },
    });
  });
});

describe("solver with Rules: every result keeps every Rule", () => {
  it("over many seeds and random instances at 40 Present", () => {
    const rng = seededRng(2024);
    let solved = 0;
    for (let i = 0; i < 300; i++) {
      const target = 2 + (i % 4);
      const input = randomInstance(rng, 40, target, i % 8, (i * 7) % 45);
      const result = solve({ ...input, target });
      if (result.ok) {
        expectValid(input, result);
        solved++;
      }
    }
    expect(solved).toBeGreaterThan(200);
  });

  it("finds Groups exactly when some grouping exists (checked by brute force on small instances)", () => {
    const rng = seededRng(77);
    const seen = { ok: 0, conflict: 0 };
    for (let i = 0; i < 400; i++) {
      const n = 4 + (i % 6);
      const input = randomInstance(rng, n, 2 + (i % 3), i % 4, i % 7);
      const result = solve(input);
      expect(result.ok).toBe(feasibleByEnumeration(input));
      if (result.ok) expectValid(input, result);
      seen[result.ok ? "ok" : "conflict"]++;
    }
    expect(seen.ok).toBeGreaterThan(50);
    expect(seen.conflict).toBeGreaterThan(20);
  });
});

describe("solver with Rules: spread", () => {
  /** Labelled-Group key: each Group's members sorted, Groups kept in Split order. */
  const keyOf = (groups: number[][]) => groups.map((g) => [...g].sort((a, b) => a - b).join(",")).join("|");

  function enumerateValid(input: SolveInput): string[] {
    const { students, split } = input;
    const out: string[] = [];
    const groups: number[][] = split.map(() => []);
    const rec = (i: number) => {
      if (i === students.length) {
        const result: SolveResult = { ok: true, groups: groups.map((g) => [...g]) };
        try {
          expectValid(input, result);
          out.push(keyOf(groups));
        } catch {
          // not valid
        }
        return;
      }
      for (let k = 0; k < split.length; k++) {
        if (groups[k]!.length === split[k]) continue;
        groups[k]!.push(students[i]!);
        rec(i + 1);
        groups[k]!.pop();
      }
    };
    rec(0);
    return out;
  }

  it.each([
    {
      name: "a chain of 3 and Keep apart pairs",
      input: { students: range(8), split: [2, 3, 3], goodPairs: pairs([[0, 1], [1, 2]], "g"), keepApart: pairs([[0, 3], [4, 5], [5, 6]], "k") },
    },
    {
      name: "a Good pair and a path of Keep apart pairs",
      input: { students: range(9), split: [3, 3, 3], goodPairs: pairs([[0, 1]], "g"), keepApart: pairs([[0, 3], [4, 5], [5, 6], [2, 7]], "k") },
    },
  ])("is close to uniform over every valid grouping (chi²/df < 2) with $name", ({ input }: { input: SolveInput }) => {
    const outcomes = enumerateValid(input);
    expect(outcomes.length).toBeGreaterThan(5);
    const rng = seededRng(99);
    const draws = outcomes.length * 150;
    const counts = new Map<string, number>();
    for (let i = 0; i < draws; i++) {
      const result = solve({ ...input, rng });
      const key = keyOf(expectValid(input, result));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(outcomes.length);
    const expected = draws / outcomes.length;
    const chi2 = outcomes.reduce((sum, k) => sum + ((counts.get(k) ?? 0) - expected) ** 2 / expected, 0);
    expect(chi2 / (outcomes.length - 1)).toBeLessThan(2);
  });
});

describe("solver with Rules: speed", () => {
  it("40 Present Students with realistic Pairs shuffle well under 10 ms", () => {
    const rng = seededRng(8);
    const instances = Array.from({ length: 50 }, (_, i) => randomInstance(rng, 40, 4, 6, 20 + (i % 20)));
    for (const input of instances.slice(0, 10)) solve({ ...input, target: 4 }); // warm up
    let worst = 0;
    const start = Date.now();
    for (const input of instances) {
      const t = Date.now();
      solve({ ...input, target: 4 });
      worst = Math.max(worst, Date.now() - t);
    }
    expect((Date.now() - start) / instances.length).toBeLessThan(5);
    expect(worst).toBeLessThan(50);
  });
});
