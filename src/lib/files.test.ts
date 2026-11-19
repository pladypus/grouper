import { describe, expect, it } from "vitest";
import {
  backupFileName,
  buildRoster,
  clashMessage,
  exportBackup,
  exportRoster,
  EMPTY_NAME_LIST_MESSAGE,
  FILE_VERSION,
  IMPORT_ACCEPT,
  importClashes,
  importedMessage,
  importRosters,
  isNameListFileName,
  keepBothName,
  nameListRoster,
  nameListRosterName,
  NEWER_VERSION_MESSAGE,
  NOT_GROUPER_FILE_MESSAGE,
  readImportFile,
  repeatedNameMessage,
  rosterFileName,
  upgradeFile,
  UNNAMED_ROSTER_NAME,
  type ImportedRoster,
} from "./files";
import { addStudent, newRoster, setPresent, type AppState, type IdGenerator, type Result, type Roster } from "./roster";
import { addPair } from "./rules";

function ids(prefix = "id"): IdGenerator {
  let n = 0;
  return () => `${prefix}${++n}`;
}

function ok<T extends object>(result: Result<T>): T {
  if (!result.ok) throw new Error(`expected ok, got: ${result.message}`);
  return result;
}

/** "Period 2": Ana, Ben, Sam B., Ana & Ben Good pair, Ana & Sam B. Keep apart, Ben Absent, Target 3. */
function period2(id = "r1", name = "Period 2"): Roster {
  const newId = ids(`${id}-`);
  let roster = newRoster(id, name);
  for (const n of ["Ana", "Ben", "Sam B."]) roster = ok(addStudent(roster, n, newId)).roster;
  const [ana, ben, sam] = roster.students.map((s) => s.id);
  roster = ok(addPair(roster, "good pair", ana!, ben!, newId)).roster;
  roster = ok(addPair(roster, "keep apart", ana!, sam!, newId)).roster;
  return { ...setPresent(roster, ben!, false), target: 3 };
}

const NOW = new Date("2026-11-18T09:30:00.000Z");

function read(text: string, name = "Period 2.grouper.json") {
  const r = readImportFile({ name, text });
  if (!r.ok) throw new Error(r.message);
  if (r.kind !== "grouper") throw new Error(`read as ${r.kind}`);
  return r;
}

function data(students: string[], pairs: ImportedRoster["pairs"] = [], name = "Period 2"): ImportedRoster {
  return { name, students, pairs, skipped: [] };
}

describe("Export", () => {
  it("writes the spec's Roster file (spec: export-import.md#files): names and Pairs only, pretty-printed", () => {
    const text = exportRoster(period2(), NOW);
    expect(JSON.parse(text)).toEqual({
      grouper: "roster",
      version: 1,
      name: "Period 2",
      exported: "2026-11-18T09:30:00.000Z",
      students: ["Ana", "Ben", "Sam B."],
      pairs: [
        { type: "good pair", students: ["Ana", "Ben"] },
        { type: "keep apart", students: ["Ana", "Sam B."] },
      ],
    });
    expect(text).toContain('\n  "grouper": "roster",');
    expect(text).not.toMatch(/present|target|split|locked/i);
  });

  it("writes the Backup with every Roster in order", () => {
    const text = exportBackup([period2(), newRoster("r2", "Period 3")], NOW);
    expect(JSON.parse(text)).toEqual({
      grouper: "backup",
      version: 1,
      exported: "2026-11-18T09:30:00.000Z",
      rosters: [
        {
          name: "Period 2",
          students: ["Ana", "Ben", "Sam B."],
          pairs: [
            { type: "good pair", students: ["Ana", "Ben"] },
            { type: "keep apart", students: ["Ana", "Sam B."] },
          ],
        },
        { name: "Period 3", students: [], pairs: [] },
      ],
    });
  });

  it("names the files", () => {
    expect(rosterFileName(period2())).toBe("Period 2.grouper.json");
    expect(rosterFileName(newRoster("r", "7/8 Maths"))).toBe("7-8 Maths.grouper.json");
    expect(backupFileName(new Date(2026, 0, 5, 23, 59))).toBe("grouper-backup-2026-01-05.json");
  });
});

describe("round trip", () => {
  it("a Roster file imports back with the same Students and Pairs, everyone Present", () => {
    const original = period2();
    const file = read(exportRoster(original, NOW));
    expect(file.backup).toBe(false);
    const { state, imported } = importRosters({ rosters: [], currentId: null }, file.rosters, "keep both", ids("n"));
    const roster = imported[0]!.roster;
    expect(imported[0]!.skipped).toEqual([]);
    expect(state.currentId).toBe(roster.id);
    expect(roster.name).toBe("Period 2");
    expect(roster.students.map((s) => [s.name, s.present])).toEqual([
      ["Ana", true],
      ["Ben", true],
      ["Sam B.", true],
    ]);
    expect(roster.target).toBe(4);
    expect(JSON.parse(exportRoster(roster, NOW))).toEqual(JSON.parse(exportRoster(original, NOW)));
    expect(roster.pairs.map((p) => p.created)).toEqual([0, 1]);
  });

  it("a Backup imports back every Roster", () => {
    const rosters = [period2("r1", "Period 2"), period2("r2", "Period 3")];
    const file = read(exportBackup(rosters, NOW), "grouper-backup-2026-11-18.json");
    expect(file.backup).toBe(true);
    const { imported } = importRosters({ rosters: [], currentId: null }, file.rosters, "keep both", ids("n"));
    expect(imported.map((r) => JSON.parse(exportRoster(r.roster, NOW)))).toEqual(
      rosters.map((r) => JSON.parse(exportRoster(r, NOW))),
    );
  });
});

describe("reading a file", () => {
  const roster = { grouper: "roster", version: 1, name: "P", exported: "", students: ["Ana"], pairs: [] };

  it("refuses a newer version with the spec's message", () => {
    const r = readImportFile({ name: "x.json", text: JSON.stringify({ ...roster, version: FILE_VERSION + 1 }) });
    expect(r).toEqual({ ok: false, message: NEWER_VERSION_MESSAGE });
    expect(NEWER_VERSION_MESSAGE).toBe("This file was made by a newer Grouper; reload the page to update.");
  });

  it.each([
    ["not JSON", "hello"],
    ["JSON but not grouper", '{"name":"x"}'],
    ["an array", "[1,2]"],
    ["an unknown grouper kind", JSON.stringify({ ...roster, grouper: "groups" })],
    ["no version", JSON.stringify({ ...roster, version: undefined })],
    ["version 0", JSON.stringify({ ...roster, version: 0 })],
    ["no Students list", JSON.stringify({ ...roster, students: "Ana" })],
    ["a Backup without rosters", JSON.stringify({ grouper: "backup", version: 1 })],
    ["a Backup with a broken Roster", JSON.stringify({ grouper: "backup", version: 1, rosters: [{ name: "x" }] })],
  ])("refuses %s as not a Grouper file", (_, text) => {
    expect(readImportFile({ name: "x.json", text })).toEqual({ ok: false, message: NOT_GROUPER_FILE_MESSAGE });
  });

  it("reads a grouper file whatever its extension, and tolerates a BOM", () => {
    expect(read("﻿" + JSON.stringify(roster), "download.txt").rosters[0]!.students).toEqual(["Ana"]);
  });

  it("falls back to the file name (or a default) when the Roster has no name", () => {
    expect(read(JSON.stringify({ ...roster, name: " " }), "Year 9.grouper.json").rosters[0]!.name).toBe("Year 9");
    const backup = { grouper: "backup", version: 1, rosters: [{ students: [] }] };
    expect(read(JSON.stringify(backup)).rosters[0]!.name).toBe(UNNAMED_ROSTER_NAME);
  });

  it("reports Students and Pairs it can't read", () => {
    const text = JSON.stringify({
      ...roster,
      students: ["Ana", 3, "", "Ben"],
      pairs: [{ type: "best friends", students: ["Ana", "Ben"] }, { type: "good pair", students: ["Ana"] }],
    });
    const r = read(text).rosters[0]!;
    expect(r.students).toEqual(["Ana", "Ben"]);
    expect(r.pairs).toEqual([]);
    expect(r.skipped).toEqual(["2 entries in the Students list aren't names.", "2 pairs couldn't be read."]);
  });

  it("upgrades older versions step by step through the hook", () => {
    const upgrades = {
      [-1]: (f: Record<string, unknown>) => ({ ...f, students: ["upgraded"] }),
      0: (f: Record<string, unknown>) => ({ ...f, name: `${String(f.name)} v1` }),
    };
    expect(upgradeFile({ version: -1, name: "P" }, upgrades)).toEqual({ version: 1, name: "P v1", students: ["upgraded"] });
    expect(upgradeFile({ version: 1, name: "P" })).toEqual({ version: 1, name: "P" });
  });
});

describe("leniency", () => {
  it("keeps a repeated name once and points Pairs at that Student", () => {
    const r = buildRoster("r", "P", data(["Sam", "Ana", " sam ", "SAM"], [{ type: "good pair", students: ["sam", "Ana"] }]), ids());
    expect(r.roster.students.map((s) => s.name)).toEqual(["Sam", "Ana"]);
    expect(r.roster.pairs).toHaveLength(1);
    expect(r.roster.pairs[0]!.a).toBe(r.roster.students[0]!.id);
    expect(r.skipped).toEqual([repeatedNameMessage("Sam")]);
  });

  it("drops Pairs naming unknown Students, repeating, or contradicting earlier ones, in file order", () => {
    const r = buildRoster(
      "r",
      "P",
      data(
        ["Ana", "Ben", "Dee", "Eli"],
        [
          { type: "good pair", students: ["Ana", "Zed"] },
          { type: "good pair", students: ["Ana", "Dee"] },
          { type: "good pair", students: ["Dee", "Eli"] },
          { type: "keep apart", students: ["Ana", "Ben"] },
          { type: "good pair", students: ["dee", "ana"] },
          { type: "good pair", students: ["Ana", "Ben"] },
          { type: "keep apart", students: ["Ana", "Eli"] },
          { type: "keep apart", students: ["Ben", "Ben"] },
          { type: "good pair", students: ["Xi", "Yu"] },
          { type: "good pair", students: ["Ben", "Eli"] },
        ],
      ),
      ids(),
    );
    const names = new Map(r.roster.students.map((s) => [s.id, s.name]));
    expect(r.roster.pairs.map((p) => [p.type, names.get(p.a), names.get(p.b), p.created])).toEqual([
      ["good pair", "Ana", "Dee", 0],
      ["good pair", "Dee", "Eli", 1],
      ["keep apart", "Ana", "Ben", 2],
    ]);
    expect(r.skipped).toEqual([
      "Ana & Zed: Zed isn't on the Roster.",
      "Dee & Ana: that pair is in the file more than once.",
      "Ana & Ben: already a Keep apart pair earlier in the file.",
      "Ana & Eli: Ana and Eli are linked by Good pairs (Ana & Dee, Dee & Eli), so they can't be kept apart.",
      "Ben & Ben: a pair needs two different Students.",
      "Xi & Yu: Xi and Yu aren't on the Roster.",
      "Ben & Eli: This Good pair would put Ana and Ben together, but they're set to keep apart.",
    ]);
  });
});

describe("name clashes", () => {
  const state: AppState = { rosters: [period2("a", "Period 2"), period2("b", "Period 3")], currentId: "b" };

  it("lists the Rosters whose names are taken", () => {
    expect(importClashes(state, [data([], [], "period 2"), data([], [], "Period 9")]).map((r) => r.id)).toEqual(["a"]);
    expect(clashMessage([state.rosters[0]!])).toBe(
      `There's already a Roster called "Period 2". Replace it, or keep both and save the new one as "Period 2 (imported)"?`,
    );
  });

  it("names a kept copy (imported), then (imported 2) …", () => {
    expect(keepBothName("Period 2", [{ name: "Period 2" }])).toBe("Period 2 (imported)");
    expect(keepBothName("Period 2", [{ name: "Period 2" }, { name: "period 2 (IMPORTED)" }])).toBe("Period 2 (imported 2)");
  });

  it("Keep both adds every Roster, renaming the clashes", () => {
    const first = importRosters(state, [data(["Zoe"], [], "Period 2")], "keep both", ids("x"));
    const second = importRosters(first.state, [data(["Zoe"], [], "Period 2")], "keep both", ids("y"));
    expect(second.state.rosters.map((r) => r.name)).toEqual([
      "Period 2",
      "Period 3",
      "Period 2 (imported)",
      "Period 2 (imported 2)",
    ]);
    expect(second.state.currentId).toBe(second.imported[0]!.roster.id);
  });

  it("Replace swaps the clashing Roster in place; a repeat within the file is kept as (imported)", () => {
    const r = importRosters(
      state,
      [data(["Zoe"], [], "period 3"), data(["Yan"], [], "Period 3"), data([], [], "Period 4")],
      "replace",
      ids("x"),
    );
    expect(r.state.rosters.map((x) => [x.name, x.students.map((s) => s.name)])).toEqual([
      ["Period 2", ["Ana", "Ben", "Sam B."]],
      ["period 3", ["Zoe"]],
      ["Period 3 (imported)", ["Yan"]],
      ["Period 4", []],
    ]);
    expect(r.state.rosters.some((x) => x.id === "b")).toBe(false);
  });
});

describe("toast", () => {
  it("counts Students and pairs", () => {
    const one = importRosters({ rosters: [], currentId: null }, read(exportRoster(period2(), NOW)).rosters, "keep both", ids());
    expect(importedMessage(one.imported)).toBe(`Imported "Period 2": 3 Students, 2 pairs.`);
    const two = importRosters(
      { rosters: [], currentId: null },
      [data(["Ana"], [], "A"), data([], [], "B")],
      "keep both",
      ids(),
    );
    expect(importedMessage(two.imported)).toBe("Imported 2 Rosters: 1 Student, 0 pairs.");
  });
});

describe("reading a .txt / .csv name list (#22)", () => {
  it("the file picker accepts Grouper files and name lists", () => {
    expect(IMPORT_ACCEPT).toBe(".json,.txt,.csv");
  });

  it("dispatches a .txt to the Add names parser: one name per line", () => {
    const r = readImportFile({ name: "Period 2.txt", text: "Ana\n2. Ben, Jr\n\nCal\n" });
    expect(r).toEqual({
      ok: true,
      kind: "names",
      name: "Period 2",
      fileName: "Period 2.txt",
      text: "Ana\n2. Ben, Jr\n\nCal\n",
      source: { kind: "lines", lines: ["Ana", "2. Ben, Jr", "", "Cal"] },
    });
  });

  it("dispatches a .csv to the column picker: a table", () => {
    const r = readImportFile({ name: "Year 9.CSV", text: "First,Last\nAna,Lee\n" });
    expect(r).toMatchObject({
      ok: true,
      kind: "names",
      name: "Year 9",
      source: { kind: "table", rows: [["First", "Last"], ["Ana", "Lee"]] },
    });
  });

  it("reads tabbed text in a .txt as a table", () => {
    const r = readImportFile({ name: "list.txt", text: "Ana\tLee\nBen\tOk\n" });
    expect(r).toMatchObject({ ok: true, kind: "names", source: { kind: "table" } });
  });

  it("still reads a grouper file saved as .txt as a grouper file", () => {
    const text = JSON.stringify({ grouper: "roster", version: 1, name: "P", exported: "", students: ["Ana"], pairs: [] });
    expect(readImportFile({ name: "download.txt", text })).toMatchObject({ ok: true, kind: "grouper" });
  });

  it("refuses an empty list, and a plain list that isn't .txt or .csv", () => {
    expect(readImportFile({ name: "empty.txt", text: "﻿ \n\n" })).toEqual({ ok: false, message: EMPTY_NAME_LIST_MESSAGE });
    expect(readImportFile({ name: "names.json", text: "Ana\nBen" })).toEqual({ ok: false, message: NOT_GROUPER_FILE_MESSAGE });
    expect(readImportFile({ name: "names.doc", text: "Ana\nBen" })).toEqual({ ok: false, message: NOT_GROUPER_FILE_MESSAGE });
  });

  it("recognises .txt and .csv names, any case", () => {
    expect(["a.txt", "B.CSV", " c.Txt "].map(isNameListFileName)).toEqual([true, true, true]);
    expect(["a.json", "a.tsv", "txt", "a.txt.json"].map(isNameListFileName)).toEqual([false, false, false, false]);
  });

  it("defaults the Roster name to the file name without its extension", () => {
    expect(nameListRosterName("Period 2.csv")).toBe("Period 2");
    expect(nameListRosterName("  Year  9.v2.txt")).toBe("Year 9.v2");
    expect(nameListRosterName(".txt")).toBe(UNNAMED_ROSTER_NAME);
  });

  it("a confirmed list joins Import as a Roster with Students and no Pairs, everyone Present", () => {
    const state: AppState = { rosters: [newRoster("a", "Period 2")], currentId: "a" };
    const list = nameListRoster("Period 2", ["Ana", "Ben"]);
    expect(list).toEqual({ name: "Period 2", students: ["Ana", "Ben"], pairs: [], skipped: [] });
    expect(importClashes(state, [list]).map((r) => r.id)).toEqual(["a"]);
    const { imported } = importRosters(state, [list], "keep both", ids());
    expect(imported[0]!.roster.name).toBe("Period 2 (imported)");
    expect(imported[0]!.roster.students.map((s) => [s.name, s.present])).toEqual([
      ["Ana", true],
      ["Ben", true],
    ]);
    expect(importedMessage(imported)).toBe(`Imported "Period 2 (imported)": 2 Students, 0 pairs.`);
  });
});
