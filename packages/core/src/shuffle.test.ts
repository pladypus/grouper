import { describe, expect, it } from "vitest";
import {
  boardAfterRosterChange,
  currentSplit,
  editSplit,
  EMPTY_BOARD,
  groupHeading,
  groupMembers,
  resetSplit,
  shuffleButtonLabel,
  type Board,
} from "./groups";
import { GROUP_HUES } from "./layout";
import {
  addStudent,
  newRoster,
  removeStudent,
  renameStudent,
  setPresent,
  setTargetSize,
  type IdGenerator,
  type Result,
  type Roster,
} from "./roster";
import { noGroupingMessage, shuffle } from "./shuffle";
import { seededRng } from "./solver";

function ids(prefix: string): IdGenerator {
  let n = 0;
  return () => `${prefix}${++n}`;
}

function ok<T extends object>(result: Result<T>): T {
  if (!result.ok) throw new Error(`expected ok, got: ${result.message}`);
  return result;
}

function rosterOf(count: number, id = "r1"): Roster {
  const newId = ids(`${id}s`);
  let roster = newRoster(id, "Period 2");
  for (let i = 0; i < count; i++) roster = ok(addStudent(roster, `Student ${i + 1}`, newId)).roster;
  return roster;
}

const opts = () => ({ rng: seededRng(1), newId: ids("g") });

function shuffled(roster: Roster, board: Board = EMPTY_BOARD): Board {
  return ok(shuffle(roster, board, opts())).board;
}

describe("shuffle", () => {
  it("makes Groups of the Present Students matching the derived Split", () => {
    let roster = rosterOf(27);
    roster = setPresent(roster, roster.students[0]!.id, false);
    roster = setPresent(roster, roster.students[1]!.id, false);
    const board = shuffled(roster);
    expect(board.groups.map((g) => g.size)).toEqual([4, 4, 4, 4, 4, 5]);
    expect(board.groups.map((g) => g.members.length)).toEqual([4, 4, 4, 4, 4, 5]);
    const members = board.groups.flatMap((g) => g.members);
    expect(new Set(members).size).toBe(25);
    expect(members).not.toContain(roster.students[0]!.id);
    expect(board.groups.map((g) => g.id)).toEqual(["g1", "g2", "g3", "g4", "g5", "g6"]);
    expect(board.groups.map((g) => g.hue)).toEqual(GROUP_HUES.slice(0, 6));
    expect(board.groups.every((g) => !g.locked)).toBe(true);
    expect(board.outOfDate).toBe(false);
  });

  it("cycles the hues past ten Groups", () => {
    const board = shuffled(setTargetSize(rosterOf(24), 2));
    expect(board.groups[10]!.hue).toBe(GROUP_HUES[0]);
  });

  it("makes one Group when fewer are Present than the Target size", () => {
    const board = shuffled(setTargetSize(rosterOf(3), 5));
    expect(board.groups.map((g) => g.size)).toEqual([3]);
  });

  it("is refused with fewer than 2 Present, leaving the Board alone", () => {
    let roster = rosterOf(2);
    roster = setPresent(roster, roster.students[0]!.id, false);
    expect(shuffle(roster, EMPTY_BOARD)).toEqual({ ok: false, message: "Mark at least 2 students Present." });
  });

  it("uses the edited Split", () => {
    const roster = rosterOf(10);
    const board = ok(editSplit(EMPTY_BOARD, roster, "2, 8")).board;
    expect(currentSplit(board, roster)).toEqual([2, 8]);
    const after = shuffled(roster, board);
    expect(after.groups.map((g) => g.size)).toEqual([2, 8]);
    expect(after.editedSplit).toEqual([2, 8]);
  });

  it("Reshuffle clears the out-of-date notice", () => {
    const roster = rosterOf(8);
    const stale = { ...shuffled(roster), outOfDate: true };
    expect(shuffled(roster, stale).outOfDate).toBe(false);
  });

  it("words the no-grouping Conflict", () => {
    expect(noGroupingMessage([4, 4, 5, 5, 5])).toBe("No way to make 2 groups of 4 and 3 groups of 5 keeps every pair.");
    expect(noGroupingMessage([4, 4])).toBe("No way to make 2 groups of 4 keeps every pair.");
  });
});

describe("Board lifecycle", () => {
  const roster = rosterOf(8);
  const board = shuffled(roster);

  it("labels the button Shuffle, then Reshuffle", () => {
    expect(shuffleButtonLabel(EMPTY_BOARD)).toBe("Shuffle");
    expect(shuffleButtonLabel(board)).toBe("Reshuffle");
  });

  it("heads each card", () => {
    expect(groupHeading(board.groups[1]!, 1)).toBe("Group 2 · 4 students");
  });

  it("goes out of date when attendance changes, and fades the Absent Student", () => {
    const absentId = board.groups[0]!.members[0]!;
    const after = setPresent(roster, absentId, false);
    const next = boardAfterRosterChange(board, roster, after);
    expect(next.outOfDate).toBe(true);
    expect(next.groups).toBe(board.groups);
    const view = groupMembers(next, next.groups[0]!, after);
    expect(view[0]).toMatchObject({ id: absentId, status: "absent", faded: true });
    expect(view.slice(1).every((m) => !m.faded)).toBe(true);
  });

  it("goes out of date when a Student is added or removed, and keeps the removed name faded", () => {
    const removedId = board.groups[0]!.members[0]!;
    const name = roster.students.find((s) => s.id === removedId)!.name;
    const after = ok(removeStudent(roster, removedId)).roster;
    const next = boardAfterRosterChange(board, roster, after);
    expect(next.outOfDate).toBe(true);
    expect(groupMembers(next, next.groups[0]!, after)[0]).toEqual({ id: removedId, name, status: "removed", faded: true });

    const added = ok(addStudent(roster, "Zed", ids("new"))).roster;
    expect(boardAfterRosterChange(board, roster, added).outOfDate).toBe(true);
  });

  it("goes out of date when the Pairs change", () => {
    const [a, b] = roster.students;
    const after: Roster = { ...roster, pairs: [{ id: "p1", type: "keep apart", a: a!.id, b: b!.id, created: 1 }] };
    expect(boardAfterRosterChange(board, roster, after).outOfDate).toBe(true);
  });

  it("stays up to date when the Target size changes or a Student is renamed", () => {
    expect(boardAfterRosterChange(board, roster, setTargetSize(roster, 3))).toBe(board);
    const renamed = ok(renameStudent(roster, roster.students[0]!.id, "Ana")).roster;
    expect(boardAfterRosterChange(board, roster, renamed)).toBe(board);
    expect(groupMembers(board, board.groups.find((g) => g.members.includes(roster.students[0]!.id))!, renamed)).toContainEqual(
      { id: roster.students[0]!.id, name: "Ana", status: "present", faded: false },
    );
  });

  it("stays out of date when attendance is put back", () => {
    const id = roster.students[0]!.id;
    const absent = setPresent(roster, id, false);
    const stale = boardAfterRosterChange(board, roster, absent);
    expect(boardAfterRosterChange(stale, absent, roster).outOfDate).toBe(true);
  });

  it("doesn't go out of date with no Groups", () => {
    const after = setPresent(roster, roster.students[0]!.id, false);
    expect(boardAfterRosterChange(EMPTY_BOARD, roster, after)).toBe(EMPTY_BOARD);
  });

  it("clears the Groups when another Roster opens (or none)", () => {
    expect(boardAfterRosterChange(board, roster, rosterOf(8, "r2"))).toBe(EMPTY_BOARD);
    expect(boardAfterRosterChange(board, roster, undefined)).toBe(EMPTY_BOARD);
  });

  it("drops the edited Split when the Present count changes, not when the Target size does", () => {
    const edited = ok(editSplit(board, roster, "3, 5")).board;
    expect(edited.outOfDate).toBe(false);
    expect(boardAfterRosterChange(edited, roster, setTargetSize(roster, 3)).editedSplit).toEqual([3, 5]);
    const after = setPresent(roster, roster.students[0]!.id, false);
    expect(boardAfterRosterChange(edited, roster, after).editedSplit).toBeNull();
    expect(resetSplit(edited).editedSplit).toBeNull();
  });

  it("refuses a bad Split edit with the spec's message", () => {
    expect(editSplit(board, roster, "4, 5")).toEqual({
      ok: false,
      message: "Those sizes add up to 9, but 8 Students are Present.",
    });
  });
});
