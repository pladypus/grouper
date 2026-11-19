// Explain (#17, SPEC §5 stage 4): QuickXplain over the Pairs, newest blamed first. The research's
// hand-made cases are in rules.test.ts (through `solve`); here: the preference order, that every
// answer genuinely conflicts and is minimal when within budget, the budget, and speed.

import { describe, expect, it } from "vitest";
import { deriveSplit } from "../split";
import { explain, prepare, randomInt, search, seededRng, solve, type Rng, type SolveInput, type SolverPair } from "./index";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Pairs with ids `${prefix}${created}`, created from `from` on. */
function pairs(list: ReadonlyArray<readonly [number, number]>, prefix = "p", from = 0): SolverPair[] {
  return list.map(([a, b], i) => ({ id: `${prefix}${from + i}`, a, b, created: from + i }));
}

const wheel = (hub: number, rim: readonly number[]): [number, number][] => [
  ...rim.map((r, i) => [r, rim[(i + 1) % rim.length]!] as [number, number]),
  ...rim.map((r) => [hub, r] as [number, number]),
];

/** Whether the Pairs can all be kept (a complete search: no budget). */
function solvable(input: SolveInput, ids: ReadonlySet<string>): boolean {
  const keep = (list: readonly SolverPair[] = []) => list.filter((p) => ids.has(p.id));
  const prep = prepare(input.students, input.split, keep(input.goodPairs), keep(input.keepApart), input.target);
  return prep.ok && search(prep.prepared, seededRng(99)) !== null;
}

/**
 * A class like the research's random stress: 20–40 Present, Target size 2–6, up to 5 chains that fit
 * the Target size, Keep apart pairs (never inside a chain) with three "difficult" Students in many.
 */
function realisticInstance(rng: Rng, maxApart: number): SolveInput {
  const n = [20, 25, 30, 35, 40][randomInt(rng, 5)]!;
  const target = 2 + randomInt(rng, 5);
  const order = range(n).sort(() => rng() - 0.5);
  const chainOf = new Map<number, number>();
  const good: [number, number][] = [];
  let next = 0;
  for (let c = randomInt(rng, 6); c > 0; c--) {
    const size = 2 + randomInt(rng, Math.max(1, target - 1));
    const chain = order.slice(next, next + size);
    next += size;
    chain.forEach((s, i) => {
      chainOf.set(s, c);
      if (i > 0) good.push([chain[i - 1]!, s]);
    });
  }
  const hubs = order.slice(-3);
  const apart: [number, number][] = [];
  const seen = new Set<string>();
  const want = randomInt(rng, maxApart + 1);
  for (let tries = 0; tries < want * 3 && apart.length < want; tries++) {
    const a = rng() < 0.4 ? hubs[randomInt(rng, 3)]! : randomInt(rng, n);
    const b = randomInt(rng, n);
    const key = `${Math.min(a, b)},${Math.max(a, b)}`;
    if (a === b || seen.has(key) || (chainOf.has(a) && chainOf.get(a) === chainOf.get(b))) continue;
    seen.add(key);
    apart.push([a, b]);
  }
  // Pairs entered in a random order: `created` mixes Good pairs and Keep apart.
  const all = [...good.map((p) => ["g", p] as const), ...apart.map((p) => ["k", p] as const)].sort(() => rng() - 0.5);
  const goodPairs: SolverPair[] = [];
  const keepApart: SolverPair[] = [];
  all.forEach(([kind, [a, b]], created) =>
    (kind === "g" ? goodPairs : keepApart).push({ id: `${kind}${created}`, a, b, created }),
  );
  return { students: range(n), split: deriveSplit(n, target), goodPairs, keepApart, target, rng };
}

/** Random instances whose Conflict only search finds (so explain runs), with their explanations. */
function searchConflicts(seed: number, count: number, maxApart: number) {
  const rng = seededRng(seed);
  const found: { input: SolveInput; pairIds: readonly string[] }[] = [];
  for (let i = 0; i < 20_000 && found.length < count; i++) {
    const input = realisticInstance(rng, maxApart);
    const result = solve(input);
    if (!result.ok && result.conflict.kind === "no-solution") found.push({ input, pairIds: result.conflict.pairIds });
  }
  return found;
}

/**
 * Realistic Conflicts at 40 Present: a Teacher enters a class's Pairs one at a time, in any order,
 * Shuffling after each, and stops at the first Conflict; kept when only search finds it. The class
 * has 4–14 chains that each fit the Target size and up to 40 Keep apart pairs (a third of them
 * about three "difficult" Students). Keep apart alone that sparse at 40 Present almost never clash
 * past the quick checks: what clashes is chains that can't be packed into the Groups, with Keep
 * apart pairs closing the last gaps.
 */
function teacherConflicts(seed: number, count: number): SolveInput[] {
  const rng = seededRng(seed);
  const found: SolveInput[] = [];
  for (let i = 0; i < 20_000 && found.length < count; i++) {
    const n = 40;
    const target = 3 + randomInt(rng, 4);
    const order = range(n).sort(() => rng() - 0.5);
    const chainOf = new Map<number, number>();
    const rules: ["g" | "k", number, number][] = [];
    let next = 0;
    for (let c = 4 + randomInt(rng, 11); c > 0 && next < n - 2; c--) {
      const chain = order.slice(next, next + 2 + randomInt(rng, target - 1));
      next += chain.length;
      chain.forEach((s, j) => {
        chainOf.set(s, c);
        if (j > 0) rules.push(["g", chain[j - 1]!, s]);
      });
    }
    const hubs = order.slice(-3);
    const seen = new Set<string>();
    const apart = randomInt(rng, 41);
    for (let tries = 0; tries < apart * 3 && seen.size < apart; tries++) {
      const a = rng() < 0.35 ? hubs[randomInt(rng, 3)]! : randomInt(rng, n);
      const b = randomInt(rng, n);
      const key = `${Math.min(a, b)},${Math.max(a, b)}`;
      if (a === b || seen.has(key) || (chainOf.has(a) && chainOf.get(a) === chainOf.get(b))) continue;
      seen.add(key);
      rules.push(["k", a, b]);
    }
    rules.sort(() => rng() - 0.5);
    const goodPairs: SolverPair[] = [];
    const keepApart: SolverPair[] = [];
    for (const [created, [kind, a, b]] of rules.entries()) {
      (kind === "g" ? goodPairs : keepApart).push({ id: `${kind}${created}`, a, b, created });
      const input = { students: range(n), split: deriveSplit(n, target), goodPairs: [...goodPairs], keepApart: [...keepApart], target, rng };
      const result = solve(input);
      if (result.ok) continue;
      if (result.conflict.kind === "no-solution") found.push(input);
      break;
    }
  }
  return found;
}

describe("explain", () => {
  it("blames the newest Pairs when the Rules clash in more than one way", () => {
    // Two separate odd wheels (each needs 4 Groups) in 3 Groups: the newer wheel is blamed.
    const old = pairs(wheel(5, [0, 1, 2, 3, 4]), "old", 0);
    const recent = pairs(wheel(11, [6, 7, 8, 9, 10]), "new", 10);
    const input = { students: range(30), split: deriveSplit(30, 10), keepApart: [...old, ...recent], rng: seededRng(1) };
    expect(explain(input)).toEqual({ pairIds: recent.map((p) => p.id).reverse(), minimal: true });
    // Entered the other way round, the other wheel is blamed.
    const swapped = [...pairs(wheel(5, [0, 1, 2, 3, 4]), "new", 10), ...pairs(wheel(11, [6, 7, 8, 9, 10]), "old", 0)];
    expect(explain({ ...input, keepApart: swapped }).pairIds).toEqual(range(10).map((i) => `new${19 - i}`));
  });

  it("names the newest Pair that made the Rules clash", () => {
    // Ana (0) kept apart from 1…4, at Target size 2 in 3 Groups of 2: fine until the 5th.
    const keepApart = pairs([[0, 1], [0, 2], [0, 3], [0, 4], [0, 5]]);
    const input = { students: range(6), split: [2, 2, 2], keepApart, rng: seededRng(2) };
    expect(solvable(input, new Set(["p0", "p1", "p2", "p3"]))).toBe(true);
    expect(explain(input).pairIds[0]).toBe("p4");
  });

  it("never blames Pairs that can't matter: Keep apart with an Absent Student, chains with nobody Present", () => {
    // 0 kept apart from 1…3 in 2 Groups of 2 (pool 0…3); Pairs about 4…6 are outside the pool.
    const keepApart = pairs([[0, 1], [0, 2], [0, 3], [0, 4], [5, 6]]);
    const goodPairs = pairs([[4, 5], [5, 6]], "g", 10);
    const input = { students: range(4), split: [2, 2], keepApart, goodPairs, rng: seededRng(3) };
    expect(explain(input).pairIds).toEqual(["p2", "p1", "p0"]);
  });

  it("follows chains through Absent Students", () => {
    // Chain 0 – 9 – 1 (9 Absent) fills one Group of 2, so 2 and 3 must share the other, but they're
    // kept apart.
    const goodPairs = pairs([[0, 9], [9, 1]], "g");
    const keepApart = pairs([[2, 3]], "k", 5);
    const input = { students: range(4), split: [2, 2], goodPairs, keepApart, rng: seededRng(4) };
    expect(solve(input)).toMatchObject({ ok: false, conflict: { kind: "no-solution" } });
    expect(explain(input).pairIds).toEqual(["k5", "g1", "g0"]);
  });

  it("returns nothing when the Pairs don't clash after all", () => {
    const keepApart = pairs([[0, 1]]);
    expect(explain({ students: range(4), split: [2, 2], keepApart, rng: seededRng(5) })).toEqual({ pairIds: [], minimal: true });
    expect(explain({ students: range(4), split: [2, 2] })).toEqual({ pairIds: [], minimal: true });
  });

  it("every answer genuinely clashes, and dropping any one Pair makes a grouping possible (within budget)", () => {
    const conflicts = [
      ...searchConflicts(11, 40, 40).map((c) => c.input),
      ...searchConflicts(12, 20, 80).map((c) => c.input),
      ...teacherConflicts(13, 15),
    ];
    expect(conflicts.length).toBe(75);
    let minimalChecked = 0;
    for (const input of conflicts) {
      const { pairIds, minimal } = explain({ ...input, rng: seededRng(1) });
      const set = new Set(pairIds);
      expect(set.size).toBe(pairIds.length);
      expect(pairIds.length).toBeGreaterThan(0);
      expect(solvable(input, set)).toBe(false);
      // Newest first.
      const created = new Map([...(input.goodPairs ?? []), ...(input.keepApart ?? [])].map((p) => [p.id, p.created]));
      const order = pairIds.map((id) => created.get(id)!);
      expect(order).toEqual([...order].sort((x, y) => y - x));
      if (!minimal) continue;
      minimalChecked++;
      for (const id of pairIds) expect(solvable(input, new Set(pairIds.filter((x) => x !== id)))).toBe(true);
    }
    expect(minimalChecked).toBeGreaterThan(60);
  }, 60_000);

  it("a re-solve that runs out of nodes keeps its Pair: still a genuine clash, just maybe not the smallest", () => {
    // Odd wheel in 3 Groups plus a chain and extra Keep apart pairs that don't matter.
    const keepApart = pairs([...wheel(5, [0, 1, 2, 3, 4]), [6, 7], [8, 9]]);
    const goodPairs = pairs([[10, 11]], "g", 20);
    const input = { students: range(15), split: deriveSplit(15, 5), keepApart, goodPairs, rng: seededRng(6) };
    const starved = explain({ ...input, nodeBudget: 1 });
    expect(starved.minimal).toBe(false);
    expect(starved.pairIds.length).toBeGreaterThanOrEqual(10);
    expect(solvable(input, new Set(starved.pairIds))).toBe(false);
    expect(explain(input)).toEqual({ pairIds: range(10).map((i) => `p${9 - i}`), minimal: true });
  });

  it("explains realistic Rules (40 Present, ≤ 40 Keep apart) in under 10 ms", () => {
    // The research's hand-made Conflicts that search finds, on random Students of a class of 40,
    // with other Keep apart pairs around them (up to 40 in all) and the Pairs entered in any order.
    const rng = seededRng(21);
    const conflicts: SolveInput[] = [];
    for (let i = 0; conflicts.length < 60 && i < 1000; i++) {
      const order = range(40).sort(() => rng() - 0.5);
      const at = (list: readonly (readonly [number, number])[]) => list.map(([a, b]) => [order[a]!, order[b]!] as const);
      const shape = i % 3;
      const target = [13, 4, 2][shape]!;
      const good: (readonly [number, number])[] =
        shape === 1 ? at(range(11).flatMap((c) => [[3 * c, 3 * c + 1], [3 * c + 1, 3 * c + 2]] as const)) : [];
      const apart: (readonly [number, number])[] =
        shape === 0 ? at(wheel(5, [0, 1, 2, 3, 4])) : shape === 2 ? at(range(30).map((j) => [0, j + 1] as const)) : [];
      // Shape 2: one Student kept apart from 30 others, and 9 more Keep apart pairs about the rest.
      const noise = 40 - apart.length;
      const inChain = new Map(good.flatMap(([a, b]) => [[a, a], [b, a]]));
      for (let tries = 0; tries < noise * 3 && apart.length < 40; tries++) {
        const a = randomInt(rng, 40);
        const b = randomInt(rng, 40);
        if (a === b || apart.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) continue;
        if (shape === 2 && (a === order[0] || b === order[0])) continue;
        if (inChain.has(a) && inChain.has(b) && Math.floor(order.indexOf(a) / 3) === Math.floor(order.indexOf(b) / 3)) continue;
        apart.push([a, b]);
      }
      const entered = [...good.map((p) => ["g", p] as const), ...apart.map((p) => ["k", p] as const)].sort(() => rng() - 0.5);
      const goodPairs: SolverPair[] = [];
      const keepApart: SolverPair[] = [];
      entered.forEach(([kind, [a, b]], created) => (kind === "g" ? goodPairs : keepApart).push({ id: `${kind}${created}`, a, b, created }));
      const input = { students: range(40), split: deriveSplit(40, target), goodPairs, keepApart, target, rng };
      const result = solve(input);
      if (!result.ok && result.conflict.kind === "no-solution") conflicts.push(input);
    }
    expect(conflicts.length).toBe(60);
    expect(worstExplainMs(conflicts)).toBeLessThan(10);
  });

  it("explains random Rules quickly: 95% under 10 ms with ≤ 40 Keep apart, all under 1 s even when dense", () => {
    // The research's random stress (20–40 Present, so up to 40 Keep apart can be dense) and classes
    // with many chains: harder than real classes, so only the spec's bound for dense Rules is firm.
    const realistic = searchConflicts(31, 150, 40).map((c) => c.input);
    const times = realistic.map((input) => worstExplainMs([input])).sort((x, y) => x - y);
    expect(times[Math.floor(times.length * 0.95)]).toBeLessThan(10);
    const dense = [...realistic, ...searchConflicts(32, 40, 80).map((c) => c.input), ...teacherConflicts(33, 20)];
    expect(worstExplainMs(dense)).toBeLessThan(1000);
  }, 60_000);
});

/** The slowest explanation, after a warm-up; each timed as the best of 3 to ignore a stray GC pause. */
function worstExplainMs(inputs: readonly SolveInput[]): number {
  for (const input of inputs.slice(0, 5)) explain(input);
  let worst = 0;
  for (const input of inputs) {
    let best = Infinity;
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      explain(input);
      best = Math.min(best, performance.now() - start);
    }
    worst = Math.max(worst, best);
  }
  return worst;
}
