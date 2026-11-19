import { describe, expect, it } from "vitest";
import { deriveSplit } from "../split";
import { seededRng, solve, type SolverPair } from "./index";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function pairs(list: Array<[number, number]>): SolverPair[] {
  return list.map(([a, b], i) => ({ id: `p${i}`, a, b, created: i }));
}

function solved(result: ReturnType<typeof solve>): number[][] {
  if (!result.ok) throw new Error(`expected groups, got ${result.conflict.kind}`);
  return result.groups;
}

/** Labelled-Group key: each Group's members sorted, Groups kept in Split order. */
const keyOf = (groups: number[][]) => groups.map((g) => [...g].sort((a, b) => a - b).join(",")).join("|");

/** Every way to fill the Split's Groups (in order) with the students, by brute force. */
function enumerate(students: number[], split: number[]): number[][][] {
  if (split.length === 0) return [[]];
  const [size, ...rest] = split;
  const out: number[][][] = [];
  const choose = (start: number, picked: number[]) => {
    if (picked.length === size) {
      const left = students.filter((s) => !picked.includes(s));
      for (const tail of enumerate(left, rest)) out.push([picked, ...tail]);
      return;
    }
    for (let i = start; i < students.length; i++) choose(i + 1, [...picked, students[i]!]);
  };
  choose(0, []);
  return out;
}

function chiSquarePerDf(counts: Map<string, number>, outcomes: string[], draws: number): number {
  const expected = draws / outcomes.length;
  const chi2 = outcomes.reduce((sum, k) => sum + ((counts.get(k) ?? 0) - expected) ** 2 / expected, 0);
  return chi2 / (outcomes.length - 1);
}

describe("solve", () => {
  it("matches the Split and uses every Student once", () => {
    const rng = seededRng(1);
    for (const [n, t] of [[25, 4], [25, 2], [27, 4], [7, 5], [40, 3], [2, 2]] as const) {
      const split = deriveSplit(n, t);
      const groups = solved(solve({ students: range(n), split, rng }));
      expect(groups.map((g) => g.length)).toEqual(split);
      expect(groups.flat().sort((a, b) => a - b)).toEqual(range(n));
    }
  });

  it("works with any Student ids", () => {
    const groups = solved(solve({ students: [10, 20, 30, 40], split: [2, 2], rng: seededRng(3) }));
    expect(groups.flat().sort((a, b) => a - b)).toEqual([10, 20, 30, 40]);
  });

  it("is repeatable with a seeded RNG and varies across seeds", () => {
    const run = (seed: number) => keyOf(solved(solve({ students: range(20), split: [5, 5, 5, 5], rng: seededRng(seed) })));
    expect(run(7)).toBe(run(7));
    expect(new Set(range(10).map(run)).size).toBeGreaterThan(5);
  });

  it("throws on a Split that doesn't add up (a caller bug)", () => {
    expect(() => solve({ students: range(5), split: [2, 2] })).toThrow();
  });

  it("spreads close to uniformly over every grouping (chi²/df < 2)", () => {
    const split = [2, 2, 3];
    const outcomes = enumerate(range(7), split).map(keyOf);
    expect(outcomes).toHaveLength(210);
    const rng = seededRng(42);
    const draws = outcomes.length * 40;
    const counts = new Map<string, number>();
    for (let i = 0; i < draws; i++) {
      const key = keyOf(solved(solve({ students: range(7), split, rng })));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(outcomes.length);
    expect(chiSquarePerDf(counts, outcomes, draws)).toBeLessThan(2);
  });

  it("solves 40 Present Students well under 10 ms", () => {
    const split = deriveSplit(40, 4);
    const rng = seededRng(5);
    for (let i = 0; i < 20; i++) solve({ students: range(40), split, rng }); // warm up
    const runs = 200;
    const start = Date.now();
    for (let i = 0; i < runs; i++) solve({ students: range(40), split, rng });
    expect((Date.now() - start) / runs).toBeLessThan(5);
  });

  // The seams for Pairs (#16): blocks and Keep apart edges already flow through search and spread.
  describe("with Rules", () => {
    it("keeps Good pair chains together and Keep apart pairs apart", () => {
      const goodPairs = pairs([[0, 1], [1, 2], [5, 6]]);
      const keepApart = pairs([[0, 3], [3, 4], [5, 7], [8, 9]]);
      const rng = seededRng(9);
      for (let i = 0; i < 200; i++) {
        const groups = solved(solve({ students: range(12), split: [4, 4, 4], goodPairs, keepApart, rng }));
        const groupOf = (s: number) => groups.findIndex((g) => g.includes(s));
        expect(groups.map((g) => g.length)).toEqual([4, 4, 4]);
        for (const p of goodPairs) expect(groupOf(p.a)).toBe(groupOf(p.b));
        for (const p of keepApart) expect(groupOf(p.a)).not.toBe(groupOf(p.b));
      }
    });

    it("ignores Pairs with a Student outside the pool", () => {
      const groups = solved(
        solve({ students: [0, 1, 2, 3], split: [2, 2], goodPairs: pairs([[0, 99]]), keepApart: pairs([[1, 98]]) }),
      );
      expect(groups.flat()).toHaveLength(4);
    });

    it("proves there is no grouping when 4 Students must be kept apart in 3 Groups", () => {
      const clique = pairs([[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]);
      expect(solve({ students: range(6), split: [2, 2, 2], keepApart: clique })).toEqual({
        ok: false,
        conflict: { kind: "no-solution" },
      });
    });

    it("reports a Keep apart pair inside a chain", () => {
      expect(
        solve({ students: range(4), split: [2, 2], goodPairs: pairs([[0, 1]]), keepApart: [{ id: "x", a: 1, b: 0, created: 9 }] }),
      ).toEqual({ ok: false, conflict: { kind: "apart-inside-chain", pairId: "x" } });
    });

    it("spreads uniformly over valid groupings with a chain and a Keep apart pair", () => {
      const goodPairs = pairs([[0, 1]]);
      const keepApart = pairs([[2, 3]]);
      const split = [3, 3];
      const valid = enumerate(range(6), split).filter((groups) => {
        const groupOf = (s: number) => groups.findIndex((g) => g.includes(s));
        return groupOf(0) === groupOf(1) && groupOf(2) !== groupOf(3);
      });
      const outcomes = valid.map(keyOf);
      const rng = seededRng(11);
      const draws = outcomes.length * 300;
      const counts = new Map<string, number>();
      for (let i = 0; i < draws; i++) {
        const key = keyOf(solved(solve({ students: range(6), split, goodPairs, keepApart, rng })));
        expect(outcomes).toContain(key);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      expect(chiSquarePerDf(counts, outcomes, draws)).toBeLessThan(2);
    });
  });
});
