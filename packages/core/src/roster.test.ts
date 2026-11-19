import { describe, expect, it } from "vitest";
import {
  addStudent,
  attendanceLabel,
  canDeleteRoster,
  createRoster,
  currentRoster,
  DEFAULT_TARGET_SIZE,
  deleteRoster,
  deleteRosterConfirmMessage,
  EMPTY_APP_STATE,
  newRoster,
  ONLY_ROSTER_MESSAGE,
  presentCount,
  removedStudentMessage,
  removeStudent,
  renameRoster,
  renameStudent,
  restoreStudent,
  selectRoster,
  setPresent,
  setTargetSize,
  togglePresent,
  updateRoster,
  type AppState,
  type IdGenerator,
  type Pair,
  type Result,
  type Roster,
} from "./roster";

function ids(prefix = "id"): IdGenerator {
  let n = 0;
  return () => `${prefix}${++n}`;
}

function ok<T extends object>(result: Result<T>): T {
  if (!result.ok) throw new Error(`expected ok, got: ${result.message}`);
  return result;
}

function rosterWith(names: string[], pairs: Array<[number, number, Pair["type"]]> = []): Roster {
  const newId = ids("s");
  let roster = newRoster("r1", "Period 2");
  for (const name of names) roster = ok(addStudent(roster, name, newId)).roster;
  return {
    ...roster,
    pairs: pairs.map(([a, b, type], i) => ({
      id: `p${i + 1}`,
      type,
      a: roster.students[a]!.id,
      b: roster.students[b]!.id,
      created: i + 1,
    })),
  };
}

function stateWith(...names: string[]): AppState {
  const newId = ids("r");
  let state = EMPTY_APP_STATE;
  for (const name of names) state = ok(createRoster(state, name, newId)).state;
  return state;
}

describe("Rosters", () => {
  it("creates a Roster, appends it, opens it, with the default Target size", () => {
    const { state, roster } = ok(createRoster(stateWith("Period 1"), "  Period   2 ", ids("x")));
    expect(roster).toEqual({ id: "x1", name: "Period 2", students: [], pairs: [], target: DEFAULT_TARGET_SIZE });
    expect(state.rosters.map((r) => r.name)).toEqual(["Period 1", "Period 2"]);
    expect(currentRoster(state)).toBe(roster);
  });

  it("refuses an empty or duplicate Roster name, compared like Student names", () => {
    const state = stateWith("Period 2");
    expect(createRoster(state, "   ", ids())).toEqual({ ok: false, message: "Type a name for the Roster." });
    expect(createRoster(state, " period  2", ids())).toEqual({
      ok: false,
      message: `There's already a Roster called "Period 2". Choose a different name.`,
    });
  });

  it("renames a Roster, allowing a re-cased version of its own name", () => {
    const state = stateWith("Period 1", "Period 2");
    expect(ok(renameRoster(state, "r2", "PERIOD 2")).state.rosters[1]!.name).toBe("PERIOD 2");
    expect(renameRoster(state, "r2", "period 1").ok).toBe(false);
  });

  it("deletes a Roster and opens its neighbour", () => {
    const state = selectRoster(stateWith("A", "B", "C"), "r2");
    const after = ok(deleteRoster(state, "r2")).state;
    expect(after.rosters.map((r) => r.id)).toEqual(["r1", "r3"]);
    expect(after.currentId).toBe("r3");
    expect(ok(deleteRoster(selectRoster(state, "r3"), "r3")).state.currentId).toBe("r2");
    expect(ok(deleteRoster(state, "r1")).state.currentId).toBe("r2");
  });

  it("refuses to delete the only Roster", () => {
    const state = stateWith("Period 2");
    expect(canDeleteRoster(state)).toBe(false);
    expect(deleteRoster(state, "r1")).toEqual({ ok: false, message: ONLY_ROSTER_MESSAGE });
    expect(ONLY_ROSTER_MESSAGE).toBe("You can't delete your only Roster.");
  });

  it("words the delete confirmation like the spec", () => {
    expect(deleteRosterConfirmMessage(newRoster("r", "Period 2"))).toBe(
      `Delete "Period 2" and all its Students and pairs? Export it first if you might want it back.`,
    );
  });

  it("updates one Roster in place", () => {
    const state = stateWith("A", "B");
    const after = updateRoster(state, "r1", (r) => ({ ...r, target: 3 }));
    expect(after.rosters[0]!.target).toBe(3);
    expect(after.rosters[1]).toBe(state.rosters[1]);
    expect(updateRoster(state, "nope", (r) => r)).toBe(state);
  });
});

describe("Students", () => {
  it("adds a Student, normalised and Present", () => {
    const { roster, student } = ok(addStudent(newRoster("r", "P"), "  Sam   B. ", ids()));
    expect(student).toEqual({ id: "id1", name: "Sam B.", present: true });
    expect(roster.students).toEqual([student]);
  });

  it("refuses a duplicate ignoring case and spacing, with the Sam B. hint", () => {
    const roster = rosterWith(["Sam"]);
    expect(addStudent(roster, " sam ", ids())).toEqual({
      ok: false,
      message: `There's already a Sam on this Roster. Tell them apart with something like "Sam B.".`,
    });
    expect(addStudent(roster, "", ids())).toEqual({ ok: false, message: "Type the Student's name." });
  });

  it("renames under the same uniqueness rule", () => {
    const roster = rosterWith(["Sam", "Ana"]);
    expect(ok(renameStudent(roster, "s1", "SAM")).roster.students[0]!.name).toBe("SAM");
    expect(renameStudent(roster, "s1", "ana").ok).toBe(false);
  });

  it("removes a Student with their Pairs and restores them in place on Undo", () => {
    const roster = setPresent(
      rosterWith(["Ana", "Ben", "Cal", "Dee"], [
        [0, 1, "good pair"],
        [2, 3, "keep apart"],
        [1, 2, "keep apart"],
      ]),
      "s2",
      false,
    );
    const { roster: after, removed } = ok(removeStudent(roster, "s2"));
    expect(after.students.map((s) => s.name)).toEqual(["Ana", "Cal", "Dee"]);
    expect(after.pairs.map((p) => p.id)).toEqual(["p2"]);
    expect(removedStudentMessage(removed)).toBe("Removed Ben and 2 pairs.");

    expect(ok(restoreStudent(after, removed)).roster).toEqual(roster);
  });

  it("words the Undo notice for zero and one pair", () => {
    const roster = rosterWith(["Ana", "Ben", "Cal"], [[0, 1, "good pair"]]);
    expect(removedStudentMessage(ok(removeStudent(roster, "s3")).removed)).toBe("Removed Cal.");
    expect(removedStudentMessage(ok(removeStudent(roster, "s2")).removed)).toBe("Removed Ben and 1 pair.");
  });

  it("on Undo skips Pairs whose other Student has gone, and refuses a name now taken", () => {
    const roster = rosterWith(["Ana", "Ben"], [[0, 1, "good pair"]]);
    const { roster: withoutBen, removed } = ok(removeStudent(roster, "s2"));
    const withoutBoth = ok(removeStudent(withoutBen, "s1")).roster;
    expect(ok(restoreStudent(withoutBoth, removed)).roster.pairs).toEqual([]);

    const retyped = ok(addStudent(withoutBen, "ben", ids("n"))).roster;
    expect(restoreStudent(retyped, removed).ok).toBe(false);
  });

  it("refuses unknown Student ids", () => {
    expect(removeStudent(rosterWith([]), "x").ok).toBe(false);
    expect(renameStudent(rosterWith([]), "x", "Sam").ok).toBe(false);
  });
});

describe("attendance", () => {
  it("toggles Present/Absent and counts Present", () => {
    let roster = rosterWith(["Ana", "Ben", "Cal"]);
    expect(attendanceLabel(roster)).toBe("3/3 Present");
    roster = togglePresent(roster, "s2");
    expect(roster.students[1]!.present).toBe(false);
    expect(presentCount(roster)).toBe(2);
    expect(attendanceLabel(roster)).toBe("2/3 Present");
    roster = togglePresent(roster, "s2");
    expect(presentCount(roster)).toBe(3);
  });

  it("leaves the Roster unchanged when nothing changes", () => {
    const roster = rosterWith(["Ana"]);
    expect(setPresent(roster, "s1", true)).toBe(roster);
    expect(togglePresent(roster, "nope")).toBe(roster);
  });
});

describe("setTargetSize", () => {
  it("sets a whole number of at least 2", () => {
    const roster = rosterWith(["Ana"]);
    expect(setTargetSize(roster, 5).target).toBe(5);
    expect(setTargetSize(roster, 1).target).toBe(2);
    expect(setTargetSize(roster, 3.4).target).toBe(3);
    expect(setTargetSize(roster, DEFAULT_TARGET_SIZE)).toBe(roster);
    expect(setTargetSize(roster, Number.NaN)).toBe(roster);
  });
});
