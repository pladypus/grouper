import { describe, expect, it } from "vitest";
import { EMPTY_BOARD, type Board } from "./groups";
import {
  canMove,
  canSwap,
  cancelSelection,
  DROP_ONTO_STUDENT_MESSAGE,
  dropStudent,
  groupFlags,
  hasFlags,
  NOT_IN_A_GROUP_MESSAGE,
  SELECTION_CANCELLED_MESSAGE,
  swapStudents,
  tapStudent,
} from "./move";
import {
  addStudent,
  newRoster,
  removeStudent,
  setPresent,
  type PairType,
  type Result,
  type Roster,
} from "./roster";
import { addPair, deletePair } from "./rules";
import { shuffle } from "./shuffle";
import { seededRng } from "./solver";

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

/** Adds Pairs given as "ana+dee" (Good pair) or "ana-ben" (Keep apart), with ids p1, p2, …. */
function withPairs(roster: Roster, ...specs: string[]): Roster {
  for (const spec of specs) {
    const [a, b] = spec.split(/[+-]/) as [string, string];
    const type: PairType = spec.includes("+") ? "good pair" : "keep apart";
    roster = ok(addPair(roster, type, a, b, () => `p${roster.pairs.length + 1}`)).roster;
  }
  return roster;
}

/** A Board from member lists; Group ids g1, g2, …; `locked` lists locked Group numbers (1-based). */
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
      hue: 0,
    })),
  };
}

const members = (board: Board) => board.groups.map((g) => g.members);
const messages = (flags: ReturnType<typeof groupFlags>) =>
  Object.fromEntries(Object.entries(flags).map(([id, f]) => [id, f.map((x) => x.message)]));

describe("swapStudents", () => {
  const board = boardOf([
    ["ana", "ben", "cal"],
    ["dee", "eli"],
    ["fay", "gus", "hal"],
  ]);

  it("swaps two Students in different Groups, each taking the other's place", () => {
    const next = ok(swapStudents(board, "ben", "eli")).board;
    expect(members(next)).toEqual([
      ["ana", "eli", "cal"],
      ["dee", "ben"],
      ["fay", "gus", "hal"],
    ]);
    expect(next.groups.map((g) => g.size)).toEqual([3, 2, 3]);
    expect(next.groups[2]).toBe(board.groups[2]);
    expect(next.outOfDate).toBe(false);
    expect(members(board)[0]).toEqual(["ana", "ben", "cal"]);
  });

  it("is a no-op for the same Student or two in the same Group", () => {
    expect(ok(swapStudents(board, "ana", "ana")).board).toBe(board);
    expect(ok(swapStudents(board, "ana", "cal")).board).toBe(board);
  });

  it("refuses Students in no Group", () => {
    expect(swapStudents(board, "ana", "zed")).toEqual({ ok: false, message: NOT_IN_A_GROUP_MESSAGE });
    expect(swapStudents(EMPTY_BOARD, "ana", "ben")).toEqual({ ok: false, message: NOT_IN_A_GROUP_MESSAGE });
  });

  it("refuses swaps into or out of a Locked Group", () => {
    const locked = boardOf(members(board), [2]);
    expect(swapStudents(locked, "ana", "dee")).toEqual({ ok: false, message: "Group 2 is Locked. Unlock it to move Students." });
    expect(swapStudents(locked, "eli", "fay")).toEqual({ ok: false, message: "Group 2 is Locked. Unlock it to move Students." });
    expect(ok(swapStudents(locked, "ana", "fay")).board.groups[1]).toBe(locked.groups[1]);
  });

  it("canMove and canSwap match", () => {
    const locked = boardOf(members(board), [2]);
    expect(canMove(locked, "ana")).toBe(true);
    expect(canMove(locked, "dee")).toBe(false);
    expect(canMove(locked, "zed")).toBe(false);
    expect(canSwap(locked, "ana", "fay")).toBe(true);
    expect(canSwap(locked, "ana", "ben")).toBe(false);
    expect(canSwap(locked, "ana", "dee")).toBe(false);
  });
});

describe("tapStudent / dropStudent", () => {
  const roster = classOf();
  const board = boardOf([
    ["ana", "ben"],
    ["cal", "dee"],
    ["eli", "fay"],
  ]);

  it("selects, then swaps with a Student in another Group", () => {
    const first = tapStudent(board, roster, null, "ana");
    expect(first).toEqual({
      board,
      selected: "ana",
      announcement: "Ana selected. Choose a Student in another Group to swap with, or press Escape to cancel.",
    });
    const second = tapStudent(board, roster, "ana", "dee");
    expect(second.selected).toBeNull();
    expect(second.announcement).toBe("Swapped Ana and Dee.");
    expect(members(second.board)).toEqual([
      ["dee", "ben"],
      ["cal", "ana"],
      ["eli", "fay"],
    ]);
  });

  it("cancels on the same Student, Esc or ✕", () => {
    expect(tapStudent(board, roster, "ana", "ana")).toEqual({ board, selected: null, announcement: SELECTION_CANCELLED_MESSAGE });
    expect(cancelSelection(board)).toEqual({ board, selected: null, announcement: SELECTION_CANCELLED_MESSAGE });
  });

  it("moves the selection to another Student in the same Group", () => {
    expect(tapStudent(board, roster, "ana", "ben").selected).toBe("ben");
  });

  it("treats a selection no longer on the Board as nothing selected", () => {
    expect(tapStudent(board, roster, "hal", "ana").selected).toBe("ana");
  });

  it("refuses Locked Groups with a toast and clears the selection", () => {
    const locked = boardOf(members(board), [2]);
    expect(tapStudent(locked, roster, null, "cal")).toEqual({
      board: locked,
      selected: null,
      toast: "Group 2 is Locked. Unlock it to move Students.",
    });
    expect(tapStudent(locked, roster, "ana", "cal")).toEqual({
      board: locked,
      selected: null,
      toast: "Group 2 is Locked. Unlock it to move Students.",
    });
  });

  it("dropping onto a Student swaps; elsewhere toasts", () => {
    const dropped = dropStudent(board, roster, "ben", "fay");
    expect(members(dropped.board)[0]).toEqual(["ana", "fay"]);
    expect(dropped.announcement).toBe("Swapped Ben and Fay.");
    expect(dropStudent(board, roster, "ben", null)).toEqual({ board, selected: null, toast: DROP_ONTO_STUDENT_MESSAGE });
    expect(DROP_ONTO_STUDENT_MESSAGE).toBe("Drop onto a Student to swap with them.");
    expect(dropStudent(board, roster, "ben", "ana")).toEqual({ board, selected: null });
  });
});

describe("groupFlags", () => {
  it("has an empty entry for every Group when no Rule is broken", () => {
    const roster = withPairs(classOf(), "ana-ben", "cal+dee");
    const flags = groupFlags(boardOf([["ana", "cal", "dee"], ["ben", "eli"]]), roster);
    expect(flags).toEqual({ g1: [], g2: [] });
    expect(hasFlags(flags)).toBe(false);
  });

  it("flags a Group holding a Keep apart pair, and a later swap that undoes it clears the flag", () => {
    const roster = withPairs(classOf(), "ana-ben");
    const board = boardOf([["ana", "cal"], ["ben", "dee"]]);
    const broken = ok(swapStudents(board, "cal", "ben")).board;
    const flags = groupFlags(broken, roster);
    expect(flags).toEqual({ g1: [{ message: "Ana & Ben are set to keep apart.", pairIds: ["p1"] }], g2: [] });
    expect(hasFlags(flags)).toBe(true);
    const fixed = ok(swapStudents(broken, "ben", "dee")).board;
    expect(groupFlags(fixed, roster)).toEqual({ g1: [], g2: [] });
  });

  it("flags both Groups of a split Good pair", () => {
    const roster = withPairs(classOf(), "ana+dee");
    const flags = groupFlags(boardOf([["ana", "ben"], ["cal", "dee"], ["eli", "fay"]]), roster);
    const line = { message: "Ana & Dee are a Good pair, but they're in different Groups.", pairIds: ["p1"] };
    expect(flags).toEqual({ g1: [line], g2: [line], g3: [] });
  });

  it("names only the broken links of a chain split three ways", () => {
    const roster = withPairs(classOf(), "ana+ben", "ben+cal", "cal+dee");
    // Ana & Ben together; Cal alone; Dee elsewhere.
    const flags = messages(groupFlags(boardOf([["ana", "ben"], ["cal", "eli"], ["dee", "fay"]]), roster));
    expect(flags).toEqual({
      g1: ["Ben & Cal are a Good pair, but they're in different Groups."],
      g2: ["Ben & Cal are a Good pair, but they're in different Groups.", "Cal & Dee are a Good pair, but they're in different Groups."],
      g3: ["Cal & Dee are a Good pair, but they're in different Groups."],
    });
  });

  it("follows a chain through an Absent Student, naming the links", () => {
    // Ana + Dee + Eli with Dee Absent: Ana and Eli must still share a Group.
    const roster = setPresent(withPairs(classOf(), "ana+dee", "dee+eli"), "dee", false);
    const board = boardOf([["ana", "ben"], ["eli", "cal", "dee"]]);
    const line = {
      message: "Ana and Eli are linked by Good pairs (Ana & Dee, Dee & Eli), but they're in different Groups.",
      pairIds: ["p1", "p2"],
    };
    expect(groupFlags(board, roster)).toEqual({ g1: [line], g2: [line] });
    // Together (with Absent Dee elsewhere): no flag.
    expect(groupFlags(boardOf([["ana", "eli"], ["ben", "dee"]]), roster)).toEqual({ g1: [], g2: [] });
  });

  it("ignores Absent and removed members and Students in no Group", () => {
    let roster = withPairs(classOf(), "ana-ben", "cal+dee", "eli-fay");
    roster = setPresent(roster, "ben", false);
    roster = ok(removeStudent(roster, "eli")).roster;
    // Ana & Ben together (Ben Absent); Cal and Dee apart but Dee is in no Group; Eli removed.
    const board = boardOf([["ana", "ben", "cal"], ["eli", "fay", "gus"]]);
    expect(groupFlags(board, roster)).toEqual({ g1: [], g2: [] });
  });

  it("follows Pair edits made after the swap", () => {
    let roster = classOf();
    const board = boardOf([["ana", "ben"], ["cal", "dee"]]);
    roster = withPairs(roster, "ana-ben");
    expect(messages(groupFlags(board, roster)).g1).toEqual(["Ana & Ben are set to keep apart."]);
    roster = deletePair(roster, "p1");
    expect(groupFlags(board, roster)).toEqual({ g1: [], g2: [] });
  });

  it("keeps flagging a Locked Group", () => {
    const roster = withPairs(classOf(), "ana-ben");
    expect(messages(groupFlags(boardOf([["ana", "ben"], ["cal", "dee"]], [1]), roster)).g1).toEqual([
      "Ana & Ben are set to keep apart.",
    ]);
  });

  it("orders lines by the oldest Pair they name", () => {
    const roster = withPairs(classOf(), "cal+eli", "ana-ben");
    const flags = messages(groupFlags(boardOf([["ana", "ben", "cal"], ["dee", "eli", "fay"]]), roster));
    expect(flags.g1).toEqual(["Cal & Eli are a Good pair, but they're in different Groups.", "Ana & Ben are set to keep apart."]);
  });

  it("is clear after a Reshuffle", () => {
    const roster = withPairs(classOf(), "ana-ben", "cal+dee");
    const shuffled = shuffle(roster, EMPTY_BOARD, { rng: seededRng(7) });
    if (!shuffled.ok) throw new Error(shuffled.message);
    let board = shuffled.board;
    // Break a Rule by hand, then Reshuffle.
    const g = (id: string) => board.groups.findIndex((x) => x.members.includes(id));
    const other = board.groups.find((_, i) => i !== g("cal"))!.members.find((m) => m !== "dee")!;
    board = ok(swapStudents(board, "cal", other)).board;
    expect(hasFlags(groupFlags(board, roster))).toBe(true);
    const again = shuffle(roster, board, { rng: seededRng(8) });
    if (!again.ok) throw new Error(again.message);
    expect(hasFlags(groupFlags(again.board, roster))).toBe(false);
  });
});
