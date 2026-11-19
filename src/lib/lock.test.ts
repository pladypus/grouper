import { describe, expect, it } from "vitest";
import { boardAfterRosterChange, EMPTY_BOARD, editSplit, groupMembers, type Board, type Group } from "./groups";
import { GROUP_HUES, groupHue } from "./layout";
import {
  keepsLockedText,
  lockedCount,
  lockPillText,
  lockReleasedMessage,
  lockToggleLabel,
  setLocked,
  toggleLock,
} from "./lock";
import { canMove, groupFlags, swapStudents } from "./move";
import { addStudent, newRoster, removeStudent, setPresent, setTargetSize, type PairType, type Result, type Roster } from "./roster";
import { addPair } from "./rules";
import { shuffle, type ShuffleResult } from "./shuffle";
import { seededRng } from "./solver";

function ok<T extends object>(result: Result<T>): T {
  if (!result.ok) throw new Error(`expected ok, got: ${result.message}`);
  return result;
}

const NAMES = ["Ana", "Ben", "Cal", "Dee", "Eli", "Fay", "Gus", "Hal", "Ian", "Jo", "Kit", "Lu"];

/** A Roster of the first `count` NAMES; Student ids are the lower-case names. Target size 4. */
function classOf(count = NAMES.length): Roster {
  let roster = newRoster("r1", "Period 2");
  for (const name of NAMES.slice(0, count)) roster = ok(addStudent(roster, name, () => name.toLowerCase())).roster;
  return roster;
}

/** Adds Pairs given as "ana+dee" (Good pair) or "ana-ben" (Keep apart), with ids p1, p2, …. */
function withPairs(roster: Roster, ...specs: string[]): Roster {
  for (const spec of specs) {
    const [a, b] = spec.split(/[+-]/) as [string, string];
    const type: PairType = spec.includes("+") ? "good pair" : "keep apart";
    roster = ok(addPair(roster, type, a, b, () => `p${roster.pairs.length + 1}`)).roster;
  }
  return roster;
}

/** A Board from member lists; Group ids g1, g2, …, hues by position; `locked` lists Group numbers (1-based). */
function boardOf(groups: readonly (readonly string[])[], locked: number[] = []): Board {
  const names: Record<string, string> = {};
  for (const n of NAMES) names[n.toLowerCase()] = n;
  return {
    ...EMPTY_BOARD,
    names,
    groups: groups.map((members, i) => ({
      id: `g${i + 1}`,
      members,
      size: members.length,
      locked: locked.includes(i + 1),
      hue: groupHue(i),
    })),
  };
}

const THREE_FOURS = [
  ["ana", "ben", "cal", "dee"],
  ["eli", "fay", "gus", "hal"],
  ["ian", "jo", "kit", "lu"],
];

let seed = 1;
function reshuffle(roster: Roster, board: Board): ShuffleResult {
  let n = 0;
  return shuffle(roster, board, { rng: seededRng(seed++), newId: () => `new${++n}` });
}

function reshuffled(roster: Roster, board: Board): { board: Board; toast?: string } {
  const result = reshuffle(roster, board);
  if (!result.ok) throw new Error(`expected Groups, got: ${result.message}`);
  return result;
}

const sorted = (ids: readonly string[]) => [...ids].sort();

describe("the Lock toggle", () => {
  const board = boardOf(THREE_FOURS);

  it("locks and unlocks a Group without marking the Board out of date", () => {
    const locked = toggleLock(board, "g2");
    expect(locked.groups.map((g) => g.locked)).toEqual([false, true, false]);
    expect(locked.groups[0]).toBe(board.groups[0]);
    expect(locked.outOfDate).toBe(false);
    expect(toggleLock(locked, "g2").groups.map((g) => g.locked)).toEqual([false, false, false]);
    expect(toggleLock(board, "nope")).toBe(board);
    expect(setLocked(locked, "g2", true)).toBe(locked);
  });

  it("labels the Reshuffle button and the Lock pill", () => {
    expect(keepsLockedText(board)).toBeNull();
    const one = toggleLock(board, "g1");
    const two = toggleLock(one, "g3");
    expect(lockedCount(two)).toBe(2);
    expect(keepsLockedText(one)).toBe("keeps 1 Locked");
    expect(keepsLockedText(two)).toBe("keeps 2 Locked");
    expect(lockPillText(one.groups[0]!)).toBe("Locked");
    expect(lockPillText(one.groups[1]!)).toBe("Lock");
    expect(lockToggleLabel(one.groups[0]!, 0)).toBe("Unlock Group 1");
    expect(lockToggleLabel(one.groups[1]!, 1)).toBe("Lock Group 2");
  });

  it("freezes the Group for Manual moves", () => {
    const locked = toggleLock(board, "g2");
    expect(canMove(locked, "eli")).toBe(false);
    expect(swapStudents(locked, "ana", "eli")).toEqual({ ok: false, message: "Group 2 is Locked. Unlock it to move Students." });
  });

  it("words the release toast", () => {
    expect(lockReleasedMessage(["Ana"])).toBe("Lock released: Ana would have been alone in a Locked Group.");
    expect(lockReleasedMessage(["Ana", "Ben"])).toBe("Locks released: Ana and Ben would each have been alone in a Locked Group.");
  });
});

describe("Reshuffle around Locks", () => {
  const roster = classOf();

  it("keeps a Locked Group exactly (members, place, hue, id) and re-splits the free Students", () => {
    const board = boardOf(THREE_FOURS, [2]);
    for (let i = 0; i < 20; i++) {
      const next = reshuffled(roster, board);
      expect(next.toast).toBeUndefined();
      expect(next.board.groups).toHaveLength(3);
      expect(next.board.groups[1]).toBe(board.groups[1]);
      const free = [next.board.groups[0]!, next.board.groups[2]!];
      expect(free.every((g) => !g.locked && g.size === 4 && g.id.startsWith("new"))).toBe(true);
      expect(sorted(free.flatMap((g) => g.members))).toEqual(sorted([...THREE_FOURS[0]!, ...THREE_FOURS[2]!]));
      expect(next.board.outOfDate).toBe(false);
    }
  });

  it("gives new Groups their position's hue, never a Locked Group's", () => {
    const board = boardOf(THREE_FOURS, [2]);
    expect(reshuffled(roster, board).board.groups.map((g) => g.hue)).toEqual(GROUP_HUES.slice(0, 3));
    // A Locked Group that moved up keeps its hue; the new Group at its old position takes another.
    const moved: Board = { ...board, groups: board.groups.map((g, i) => (i === 1 ? { ...g, hue: GROUP_HUES[0]! } : g)) };
    const hues = reshuffled(roster, moved).board.groups.map((g) => g.hue);
    expect(hues[1]).toBe(GROUP_HUES[0]);
    expect(new Set(hues).size).toBe(3);
  });

  it("re-derives the free Split from the Target size, ignoring a hand-edited Split", () => {
    const board = ok(editSplit(boardOf(THREE_FOURS, [1]), roster, "6, 6")).board;
    const next = reshuffled(setTargetSize(roster, 2), board).board;
    expect(next.groups.map((g) => g.size)).toEqual([4, 2, 2, 2, 2]);
    expect(next.groups[0]).toBe(board.groups[0]);
    // The edited Split is kept and used again once nothing is Locked.
    expect(next.editedSplit).toEqual([6, 6]);
    expect(reshuffled(roster, toggleLock(next, "g1")).board.groups.map((g) => g.size)).toEqual([6, 6]);
  });

  it("keeps Locked Groups in their places, moving up only when there are fewer Groups", () => {
    // 12 at 3 → four Groups of 3; Lock Groups 2 and 4; at Target size 4 the 6 free make one Group of 6.
    const board = boardOf([["ana", "ben", "cal"], ["dee", "eli", "fay"], ["gus", "hal", "ian"], ["jo", "kit", "lu"]], [2, 4]);
    const next = reshuffled(setTargetSize(roster, 4), board).board;
    expect(next.groups.map((g) => g.id)).toEqual(["new1", "g2", "g4"]);
    expect(next.groups.map((g) => g.hue)).toEqual([GROUP_HUES[0], GROUP_HUES[1], GROUP_HUES[3]]);
    expect(next.groups[0]!.size).toBe(6);
  });

  it("drops Absent and removed Students from a Locked Group, which stays Locked", () => {
    let after = setPresent(roster, "dee", false);
    after = ok(removeStudent(after, "cal")).roster;
    const next = reshuffled(after, boardOf(THREE_FOURS, [1])).board;
    expect(next.groups[0]).toMatchObject({ id: "g1", members: ["ana", "ben"], size: 2, locked: true, hue: GROUP_HUES[0] });
    expect(next.groups.flatMap((g) => g.members)).not.toContain("dee");
  });

  it("releases a Lock that would hold one Student, who rejoins the pool, and says so", () => {
    let after = setPresent(roster, "ben", false);
    after = setPresent(after, "cal", false);
    after = setPresent(after, "dee", false);
    const result = reshuffled(after, boardOf(THREE_FOURS, [1, 2]));
    expect(result.toast).toBe("Lock released: Ana would have been alone in a Locked Group.");
    expect(result.board.groups[1]).toMatchObject({ id: "g2", locked: true });
    const ana = result.board.groups.find((g) => g.members.includes("ana"))!;
    expect(ana.locked).toBe(false);
    expect(result.board.groups.map((g) => g.size)).toEqual([5, 4]);
  });

  it("drops a Locked Group with no one Present left, without a toast", () => {
    let after = roster;
    for (const id of THREE_FOURS[0]!) after = setPresent(after, id, false);
    const result = reshuffled(after, boardOf(THREE_FOURS, [1]));
    expect(result.toast).toBeUndefined();
    expect(result.board.groups.map((g) => g.locked)).toEqual([false, false]);
  });

  it("is a Conflict when exactly one Student is left outside the Locked Groups", () => {
    const board = boardOf(THREE_FOURS, [1, 2]);
    let after = roster;
    for (const id of ["jo", "kit", "lu"]) after = setPresent(after, id, false);
    const result = reshuffle(after, board);
    expect(result).toEqual({
      ok: false,
      message: "Only Ian is left outside the Locked Groups, and a group of 1 isn't allowed. Unlock a Group or mark someone else Present.",
      conflict: { kind: "lone-leftover", pairIds: [] },
    });
  });

  it("is fine with no one left outside the Locked Groups", () => {
    const board = boardOf(THREE_FOURS, [1, 2, 3]);
    expect(reshuffled(roster, board).board.groups).toEqual(board.groups);
  });

  it("is a Conflict when a Present chain is partly Locked and partly free", () => {
    const board = boardOf(THREE_FOURS, [2]);
    expect(reshuffle(withPairs(roster, "fay+ana"), board)).toEqual({
      ok: false,
      message: "Fay is in Locked Group 2, but Ana, linked to Fay by a Good pair, isn't. Unlock Group 2 or delete the pair.",
      conflict: { kind: "chain-cut-by-lock", pairIds: ["p1"] },
    });
    // Linked through an Absent Student: names the links.
    const through = setPresent(withPairs(roster, "ana+lu", "lu+eli"), "lu", false);
    expect(reshuffle(through, board)).toEqual({
      ok: false,
      message:
        "Eli is in Locked Group 2, but Ana, linked to Eli by Good pairs (Eli & Lu, Lu & Ana), isn't. Unlock Group 2 or delete one of those pairs.",
      conflict: { kind: "chain-cut-by-lock", pairIds: ["p2", "p1"] },
    });
  });

  it("allows a chain whose Present members are all Locked, or all free", () => {
    const board = boardOf(THREE_FOURS, [2]);
    expect(reshuffle(withPairs(roster, "eli+fay"), board).ok).toBe(true);
    // Only the Absent end is outside the Lock.
    expect(reshuffle(setPresent(withPairs(roster, "eli+ana"), "ana", false), board).ok).toBe(true);
    for (let i = 0; i < 20; i++) {
      const next = reshuffled(withPairs(roster, "ana+ian", "ben-cal"), board).board;
      const ana = next.groups.find((g) => g.members.includes("ana"))!;
      expect(ana.members).toContain("ian");
      expect(next.groups.find((g) => g.members.includes("ben"))!.members).not.toContain("cal");
    }
  });

  it("allows Keep apart between a Locked Student and a free one", () => {
    expect(reshuffle(withPairs(roster, "eli-ana", "fay-ben"), boardOf(THREE_FOURS, [2])).ok).toBe(true);
  });

  it("carries a flagged Locked Group over unchanged, still flagged", () => {
    // Eli & Fay kept apart, but the Teacher Locked them together; a Good pair Gus & Ian split between two Locks.
    const rules = withPairs(roster, "eli-fay", "gus+ian");
    const board = boardOf(THREE_FOURS, [2, 3]);
    const next = reshuffled(rules, board).board;
    expect(next.groups[1]).toBe(board.groups[1]);
    expect(next.groups[2]).toBe(board.groups[2]);
    const flags = groupFlags(next, rules);
    expect(flags["g2"]!.map((f) => f.message)).toEqual([
      "Eli & Fay are set to keep apart.",
      "Gus & Ian are a Good pair, but they're in different Groups.",
    ]);
    expect(flags["g3"]!.map((f) => f.message)).toEqual(["Gus & Ian are a Good pair, but they're in different Groups."]);
  });

  it("runs the solver's checks on the free pool only, counting only the free Groups", () => {
    // Three mutually kept apart Students fit three Groups, but not the two free ones.
    const apart = withPairs(roster, "ana-ben", "ana-cal", "ben-cal");
    expect(reshuffle(apart, boardOf(THREE_FOURS)).ok).toBe(true);
    expect(reshuffle(apart, boardOf(THREE_FOURS, [2]))).toEqual({
      ok: false,
      message: "These 3 students must all be kept apart, but there are only 2 groups: Ana, Ben, Cal.",
      conflict: { kind: "apart-clique", pairIds: ["p1", "p2", "p3"] },
    });
  });
});

describe("Locked Groups between Reshuffles", () => {
  const roster = classOf();
  const board = boardOf(THREE_FOURS, [1]);

  it("keeps an Absent or removed member in the Locked Group, faded, until the Reshuffle", () => {
    const absent = setPresent(roster, "ben", false);
    const next = boardAfterRosterChange(board, roster, absent);
    expect(next.outOfDate).toBe(true);
    const locked: Group = next.groups[0]!;
    expect(locked).toBe(board.groups[0]);
    expect(groupMembers(next, locked, absent)[1]).toMatchObject({ id: "ben", status: "absent", faded: true });

    const removed = ok(removeStudent(roster, "cal")).roster;
    expect(groupMembers(boardAfterRosterChange(board, roster, removed), locked, removed)[2]).toMatchObject({
      id: "cal",
      name: "Cal",
      status: "removed",
      faded: true,
    });
  });
});
