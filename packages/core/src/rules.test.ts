import { describe, expect, it } from "vitest";
import { boardAfterRosterChange, EMPTY_BOARD } from "./groups";
import {
  addStudent,
  newRoster,
  removeStudent,
  restoreStudent,
  setPresent,
  setTargetSize,
  type IdGenerator,
  type PairType,
  type Result,
  type Roster,
} from "./roster";
import {
  addPair,
  checkPair,
  deletePair,
  goodPairChains,
  goodPairPath,
  listNames,
  oversizeChains,
  PAIR_EXISTS_MESSAGE,
  pairsByType,
  pairsLabel,
  PICK_TWO_STUDENTS_MESSAGE,
  presentChains,
} from "./rules";
import { shuffle } from "./shuffle";
import { seededRng } from "./solver";

function ids(prefix: string): IdGenerator {
  let n = 0;
  return () => `${prefix}${++n}`;
}

function ok<T extends object>(result: Result<T>): T {
  if (!result.ok) throw new Error(`expected ok, got: ${result.message}`);
  return result;
}

const NAMES = ["Ana", "Ben", "Cal", "Dee", "Eli", "Fay", "Gus", "Hal"];

/** A Roster of NAMES; Student ids are the lower-case names. */
function classOf(): Roster {
  let roster = newRoster("r1", "Period 2");
  for (const name of NAMES) roster = ok(addStudent(roster, name, () => name.toLowerCase())).roster;
  return roster;
}

/** Adds Pairs given as "ana+dee" (Good pair) or "ana-ben" (Keep apart); throws on refusal. */
function withPairs(roster: Roster, ...specs: string[]): Roster {
  const newId = ids("p");
  for (const spec of specs) {
    const [a, b] = spec.split(/[+-]/) as [string, string];
    const type: PairType = spec.includes("+") ? "good pair" : "keep apart";
    roster = ok(addPair(roster, type, a, b, () => `${newId()}`)).roster;
  }
  return roster;
}

const refusal = (result: Result<object>) => (result.ok ? null : result.message);

describe("addPair", () => {
  it("adds a Pair with a monotonic creation order", () => {
    const roster = classOf();
    const first = ok(addPair(roster, "good pair", "ana", "ben", () => "p1"));
    expect(first.pair).toEqual({ id: "p1", type: "good pair", a: "ana", b: "ben", created: 0 });
    const second = ok(addPair(first.roster, "keep apart", "cal", "dee", () => "p2"));
    expect(second.pair.created).toBe(1);
    expect(second.roster.pairs.map((p) => p.id)).toEqual(["p1", "p2"]);
    // Deleting the newest Pair doesn't reuse its number.
    const deleted = deletePair(second.roster, "p2");
    expect(ok(addPair(deleted, "keep apart", "eli", "fay", () => "p3")).pair.created).toBe(2);
    expect(roster.pairs).toEqual([]);
  });

  it("refuses a repeated pair, either way round", () => {
    const roster = withPairs(classOf(), "ana+ben", "cal-dee");
    expect(refusal(addPair(roster, "good pair", "ben", "ana", ids("x")))).toBe(PAIR_EXISTS_MESSAGE);
    expect(refusal(addPair(roster, "keep apart", "cal", "dee", ids("x")))).toBe("That pair already exists.");
  });

  it("refuses a pair already of the other kind", () => {
    const roster = withPairs(classOf(), "ana+ben", "cal-dee");
    expect(refusal(addPair(roster, "keep apart", "ana", "ben", ids("x")))).toBe(
      "Ana & Ben are already a Good pair. Delete it first.",
    );
    expect(refusal(addPair(roster, "good pair", "dee", "cal", ids("x")))).toBe(
      "Cal & Dee are already a Keep apart pair. Delete it first.",
    );
  });

  it("refuses a Keep apart pair inside a chain, naming the Good pairs that link them", () => {
    const roster = withPairs(classOf(), "ana+dee", "dee+eli", "eli+fay");
    expect(refusal(addPair(roster, "keep apart", "ana", "eli", ids("x")))).toBe(
      "Ana and Eli are linked by Good pairs (Ana & Dee, Dee & Eli), so they can't be kept apart.",
    );
    expect(refusal(addPair(roster, "keep apart", "fay", "ana", ids("x")))).toBe(
      "Fay and Ana are linked by Good pairs (Fay & Eli, Eli & Dee, Dee & Ana), so they can't be kept apart.",
    );
    expect(addPair(roster, "keep apart", "ana", "ben", ids("x")).ok).toBe(true);
  });

  it("refuses a Good pair that would join a Keep apart pair into one chain", () => {
    const roster = withPairs(classOf(), "ana-ben", "ana+cal", "ben+dee");
    expect(refusal(addPair(roster, "good pair", "cal", "dee", ids("x")))).toBe(
      "This Good pair would put Ana and Ben together, but they're set to keep apart.",
    );
    expect(addPair(roster, "good pair", "cal", "eli", ids("x")).ok).toBe(true);
  });

  it("refuses the same Student twice or a Student not on the Roster", () => {
    expect(refusal(addPair(classOf(), "good pair", "ana", "ana", ids("x")))).toBe(PICK_TWO_STUDENTS_MESSAGE);
    expect(refusal(addPair(classOf(), "good pair", "ana", "zed", ids("x")))).toBe(
      "That Student is no longer on this Roster.",
    );
  });

  it("checks without adding", () => {
    const roster = withPairs(classOf(), "ana+ben");
    expect(checkPair(roster, "good pair", "ana", "cal")).toEqual({ ok: true });
    expect(checkPair(roster, "good pair", "ana", "ben")).toEqual({ ok: false, message: PAIR_EXISTS_MESSAGE });
  });

  it("chains through Absent Students too when checking (Absent members don't break a chain)", () => {
    const roster = setPresent(withPairs(classOf(), "ana+dee", "dee+eli"), "dee", false);
    expect(refusal(addPair(roster, "keep apart", "ana", "eli", ids("x")))).toContain("are linked by Good pairs");
  });
});

describe("deletePair", () => {
  it("deletes by id and leaves unknown ids alone", () => {
    const roster = withPairs(classOf(), "ana+ben", "cal-dee");
    expect(deletePair(roster, "p1").pairs.map((p) => p.id)).toEqual(["p2"]);
    expect(deletePair(roster, "nope")).toBe(roster);
  });

  it("marks Groups out of date", () => {
    const roster = classOf();
    const board = ok(shuffle(roster, EMPTY_BOARD, { rng: seededRng(1), newId: ids("g") })).board;
    const added = withPairs(roster, "ana+ben");
    expect(boardAfterRosterChange(board, roster, added).outOfDate).toBe(true);
    const fresh = ok(shuffle(added, board, { rng: seededRng(1), newId: ids("g") })).board;
    expect(boardAfterRosterChange(fresh, added, deletePair(added, "p1")).outOfDate).toBe(true);
  });
});

describe("removing a Student", () => {
  it("removes their Pairs, and Undo restores them", () => {
    const roster = withPairs(classOf(), "ana+ben", "ben-cal", "dee+eli");
    const { roster: after, removed } = ok(removeStudent(roster, "ben"));
    expect(after.pairs.map((p) => p.id)).toEqual(["p3"]);
    expect(pairsLabel(after)).toBe("1 Pair");
    expect(ok(restoreStudent(after, removed)).roster.pairs).toEqual(roster.pairs);
  });
});

describe("chains", () => {
  it("joins Good pairs that share a Student (union-find)", () => {
    const roster = withPairs(classOf(), "dee+eli", "ana+dee", "fay+gus", "ben-cal");
    expect(goodPairChains(roster).map((c) => ({ students: c.students, pairs: c.pairs.map((p) => p.id) }))).toEqual([
      { students: ["ana", "dee", "eli"], pairs: ["p1", "p2"] },
      { students: ["fay", "gus"], pairs: ["p3"] },
    ]);
  });

  it("narrows to Present members without breaking the chain at an Absent one", () => {
    let roster = withPairs(classOf(), "ana+dee", "dee+eli", "fay+gus");
    roster = setPresent(roster, "dee", false);
    roster = setPresent(roster, "gus", false);
    expect(presentChains(roster).map((c) => c.students)).toEqual([["ana", "eli"]]);
  });

  it("finds the Good pairs linking two Students", () => {
    const roster = withPairs(classOf(), "ana+dee", "dee+eli", "eli+fay", "ana+fay");
    expect(goodPairPath(roster, "dee", "fay")!.map((p) => p.id)).toEqual(["p1", "p4"]);
    expect(goodPairPath(roster, "ana", "ben")).toBeNull();
  });
});

describe("the Pairs drawer", () => {
  it("counts Pairs for the top-bar button", () => {
    expect(pairsLabel(classOf())).toBe("0 Pairs");
    expect(pairsLabel(withPairs(classOf(), "ana+ben"))).toBe("1 Pair");
    expect(pairsLabel(withPairs(classOf(), "ana+ben", "cal-dee", "eli-fay", "gus+hal", "ana-cal"))).toBe("5 Pairs");
  });

  it("lists Pairs by kind, oldest first, with current names", () => {
    const roster = withPairs(classOf(), "ana+ben", "cal-dee", "eli+fay");
    const lists = pairsByType(roster);
    expect(lists.goodPairs.map((v) => v.label)).toEqual(["Ana & Ben", "Eli & Fay"]);
    expect(lists.keepApart.map((v) => [v.pair.id, v.names, v.label])).toEqual([["p2", ["Cal", "Dee"], "Cal & Dee"]]);
  });
});

describe("oversize-chain warning", () => {
  it("warns as soon as a Present chain is bigger than the Target size", () => {
    let roster = setTargetSize(withPairs(classOf(), "ana+ben", "ben+cal"), 3);
    expect(oversizeChains(roster)).toEqual([]);
    roster = setTargetSize(roster, 2);
    expect(oversizeChains(roster).map((c) => c.message)).toEqual([
      "Ana, Ben and Cal are joined by Good pairs (3 students), but the number in each group is 2.",
    ]);
    expect(oversizeChains(setPresent(roster, "ben", false))).toEqual([]);
  });

  it("lists names", () => {
    expect(listNames(["Ana"])).toBe("Ana");
    expect(listNames(["Ana", "Ben"])).toBe("Ana and Ben");
    expect(listNames(["Ana", "Ben", "Cal", "Dee"])).toBe("Ana, Ben, Cal and Dee");
  });
});

describe("shuffle with Pairs", () => {
  const opts = (seed: number) => ({ rng: seededRng(seed), newId: ids("g") });
  const groupOf = (groups: readonly { members: readonly string[] }[], id: string) =>
    groups.findIndex((g) => g.members.includes(id));

  it("keeps every Present Pair, with chains running through Absent Students", () => {
    let roster = withPairs(classOf(), "ana+dee", "dee+eli", "ben-cal", "cal-fay", "gus-hal");
    roster = setTargetSize(setPresent(roster, "dee", false), 2);
    for (let seed = 0; seed < 200; seed++) {
      const { groups } = ok(shuffle(roster, EMPTY_BOARD, opts(seed))).board;
      expect(groups.flatMap((g) => g.members)).not.toContain("dee");
      expect(groupOf(groups, "ana")).toBe(groupOf(groups, "eli"));
      for (const [a, b] of [["ben", "cal"], ["cal", "fay"], ["gus", "hal"]] as const) {
        expect(groupOf(groups, a)).not.toBe(groupOf(groups, b));
      }
    }
  });

  it("reports a chain bigger than the Target size, leaving the Board alone", () => {
    const roster = setTargetSize(withPairs(classOf(), "ana+dee", "dee+eli"), 2);
    expect(oversizeChains(roster)).toHaveLength(1);
    expect(shuffle(roster, EMPTY_BOARD, opts(1))).toEqual({
      ok: false,
      message: "Ana, Dee and Eli are joined by Good pairs, so they need a group of 3, but the number in each group is 2.",
      conflict: { kind: "chain-too-big", pairIds: ["p1", "p2"] },
    });
  });

  it("reports more Students who must all be kept apart than Groups", () => {
    // 8 Students at 4 → 2 Groups; Ana, Ben and Cal all kept apart.
    const roster = withPairs(classOf(), "ana-ben", "ben-cal", "ana-cal", "dee-eli");
    expect(shuffle(roster, EMPTY_BOARD, opts(1))).toEqual({
      ok: false,
      message: "These 3 students must all be kept apart, but there are only 2 groups: Ana, Ben, Cal.",
      conflict: { kind: "apart-clique", pairIds: ["p1", "p2", "p3"] },
    });
  });

  it("names a chain in the clique by its Students in the Keep apart pairs", () => {
    const roster = withPairs(classOf(), "ana+dee", "ana-ben", "dee-cal", "ben-cal");
    const result = shuffle(roster, EMPTY_BOARD, opts(1));
    expect(!result.ok && result.message).toBe(
      "These 3 students must all be kept apart, but there are only 2 groups: Ana & Dee, Ben, Cal.",
    );
  });

  it("reports what search proves impossible with the Split in words", () => {
    // Ana kept apart from everyone: no Group can hold her.
    const roster = withPairs(classOf(), ...NAMES.slice(1).map((n) => `ana-${n.toLowerCase()}`));
    expect(shuffle(roster, EMPTY_BOARD, opts(1))).toEqual({
      ok: false,
      message: "No way to make 2 groups of 4 keeps every pair.",
      conflict: { kind: "no-solution", pairIds: [] },
    });
  });

  it("reports a Keep apart pair inside a chain (defensive: entry refuses it)", () => {
    const base = withPairs(classOf(), "ana+dee", "dee+eli");
    const roster: Roster = {
      ...base,
      pairs: [...base.pairs, { id: "bad", type: "keep apart", a: "eli", b: "ana", created: 9 }],
    };
    expect(shuffle(roster, EMPTY_BOARD, opts(1))).toEqual({
      ok: false,
      message: "Eli and Ana are linked by Good pairs (Eli & Dee, Dee & Ana), so they can't be kept apart.",
      conflict: { kind: "apart-inside-chain", pairIds: ["bad", "p1", "p2"] },
    });
  });

  it("shuffles 40 Present Students with Pairs well under 10 ms", () => {
    let roster = newRoster("r", "Big");
    for (let i = 0; i < 40; i++) roster = ok(addStudent(roster, `S${i}`, () => `s${i}`)).roster;
    const rng = seededRng(3);
    const newId = ids("p");
    for (let added = 0; added < 30; ) {
      const a = `s${Math.floor(rng() * 40)}`;
      const b = `s${Math.floor(rng() * 40)}`;
      const result = addPair(roster, added % 5 === 0 ? "good pair" : "keep apart", a, b, newId);
      if (result.ok) {
        roster = result.roster;
        added++;
      }
    }
    const options = { rng, newId: ids("g") };
    for (let i = 0; i < 20; i++) ok(shuffle(roster, EMPTY_BOARD, options)); // warm up
    const runs = 200;
    const start = Date.now();
    for (let i = 0; i < runs; i++) ok(shuffle(roster, EMPTY_BOARD, options));
    expect((Date.now() - start) / runs).toBeLessThan(5);
  });
});
