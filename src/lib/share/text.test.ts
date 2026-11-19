import { describe, expect, it } from "vitest";
import { EMPTY_BOARD, type Board } from "../groups";
import { addStudent, newRoster, renameStudent, type Result, type Roster } from "../roster";
import {
  boardStudentCount,
  copiedTextMessage,
  groupsAsText,
  printSubtitle,
  shareDate,
  shareTitle,
} from "./text";

function ok<T extends object>(result: Result<T>): T {
  if (!result.ok) throw new Error(`expected ok, got: ${result.message}`);
  return result;
}

const NAMES = ["Ana", "Ben", "Cal", "Dee", "Eli", "Fay", "Gus"];

/** "Period 2" with NAMES; Student ids are the lower-case names. */
function period2(): Roster {
  let roster = newRoster("r1", "Period 2");
  for (const name of NAMES) roster = ok(addStudent(roster, name, () => name.toLowerCase())).roster;
  return roster;
}

function boardOf(...groups: string[][]): Board {
  return {
    ...EMPTY_BOARD,
    names: Object.fromEntries(NAMES.map((n) => [n.toLowerCase(), n])),
    groups: groups.map((members, i) => ({ id: `g${i + 1}`, members, size: members.length, locked: false, hue: 0 })),
  };
}

const DAY = new Date(2026, 10, 18, 9, 30);

describe("shareDate", () => {
  it("writes day, short month and year whatever the locale", () => {
    expect(shareDate(DAY)).toBe("18 Nov 2026");
    expect(shareDate(new Date(2027, 0, 3))).toBe("3 Jan 2027");
  });
});

describe("groupsAsText", () => {
  it("is a title line with the Roster and date, then one line per Group in card order", () => {
    const board = boardOf(["ana", "dee", "eli", "ben"], ["cal", "fay", "gus"]);
    expect(groupsAsText(board, period2(), DAY)).toBe(
      "Period 2 groups, 18 Nov 2026\nGroup 1: Ana, Dee, Eli, Ben\nGroup 2: Cal, Fay, Gus",
    );
  });

  it("uses current names, and the Shuffle-time name of a removed Student", () => {
    const roster = ok(renameStudent(period2(), "ana", "Anna")).roster;
    const board = boardOf(["ana", "zed"], ["ben", "cal"]);
    const withZed = { ...board, names: { ...board.names, zed: "Zed" } };
    expect(groupsAsText(withZed, roster, DAY).split("\n")[1]).toBe("Group 1: Anna, Zed");
  });
});

describe("toasts and print header", () => {
  it("counts Groups in the copy toast", () => {
    expect(copiedTextMessage(boardOf(["ana", "ben"], ["cal", "dee"], ["eli", "fay"], ["gus", "ana"], ["ben", "cal"]))).toBe(
      "Copied 5 Groups as text.",
    );
    expect(copiedTextMessage(boardOf(["ana", "ben"]))).toBe("Copied 1 Group as text.");
  });

  it("titles the printout with the Roster and gives the date and Student count", () => {
    const board = boardOf(["ana", "dee", "eli", "ben"], ["cal", "fay", "gus"]);
    expect(shareTitle(period2())).toBe("Period 2 groups");
    expect(boardStudentCount(board)).toBe(7);
    expect(printSubtitle(board, DAY)).toBe("18 Nov 2026 · 7 Students");
  });
});
