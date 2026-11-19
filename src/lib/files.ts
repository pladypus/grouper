// Export, Backup and Import of Grouper files (spec: export-import.md). Pure: the UI reads the chosen file's text
// and downloads what the writers return.
//
// Import runs in three steps, each usable on its own:
// 1. `readImportFile({ name, text })`: the ONE place that decides what kind of file this is (the
//    file-type dispatch): a grouper Roster or Backup file (`kind: "grouper"`) or a .txt / .csv name
//    list (`kind: "names"`). Version upgrades and the newer-version / not-Grouper refusals happen here.
// 2. `importClashes(state, rosters)`: the names already taken, for the Replace / Keep both question
//    (one question for every clash in the file).
// 3. `importRosters(state, rosters, choice, newId)`: adds the Rosters, building each through the
//    ordinary Roster operations (`addStudent`, `addPair`), so a repeated name or a Pair that
//    `checkPair` would refuse is skipped and reported instead of dropped silently.
// A name-list Import goes through the Add names parser (or the column picker) and a confirm step in
// the UI; `nameListRoster` then makes an `ImportedRoster` (a name and Students, no Pairs) that joins
// at step 2, so it shares the clash question and the success toast.

import { nameKey, normaliseName, readNameSource, type NameSource } from "./names";
import {
  addStudent,
  newRoster,
  type AppState,
  type IdGenerator,
  type PairType,
  type Roster,
  type RosterId,
} from "./roster";
import { addPair, checkPair, findPair, pairText } from "./rules";

/** The file format version these writers produce and the newest the reader understands. */
export const FILE_VERSION = 1;

/** spec: export-import.md: refusal for a file from a newer Grouper. */
export const NEWER_VERSION_MESSAGE = "This file was made by a newer Grouper; reload the page to update.";
/** spec: export-import.md: refusal for anything that is neither a grouper file nor a name list. */
export const NOT_GROUPER_FILE_MESSAGE = "That file isn't a Grouper file or a list of names.";

/** What the file picker accepts (spec: export-import.md): Grouper files and .txt / .csv name lists. */
export const IMPORT_ACCEPT = ".json,.txt,.csv";

/** Refusal for a .txt / .csv list with nothing in it (invented wording). */
export const EMPTY_NAME_LIST_MESSAGE = "That list has no names in it.";

/** Title of the name-list confirm step (invented wording). */
export const IMPORT_LIST_TITLE = "Import a class list";

/** The confirm step's button: "Import 25 students" (invented wording, after "Add 25 students"). */
export function importListButtonLabel(n: number): string {
  return `Import ${n} ${n === 1 ? "student" : "students"}`;
}

/** Name for a Roster whose file gives none (invented wording; spec: export-import.md doesn't say). */
export const UNNAMED_ROSTER_NAME = "Imported Roster";

// ---------------------------------------------------------------------------------------------
// File shapes (spec: export-import.md)

/** A Pair as written in a file: its kind and the two Students' names. */
export interface FilePair {
  readonly type: PairType;
  readonly students: readonly [string, string];
}

/** One Roster as written in a file: names only, no attendance, Target size or Groups. */
export interface FileRoster {
  readonly name: string;
  readonly students: readonly string[];
  readonly pairs: readonly FilePair[];
}

export interface RosterFile extends FileRoster {
  readonly grouper: "roster";
  readonly version: number;
  readonly exported: string;
}

export interface BackupFile {
  readonly grouper: "backup";
  readonly version: number;
  readonly exported: string;
  readonly rosters: readonly FileRoster[];
}

// ---------------------------------------------------------------------------------------------
// Export and Backup

/** A Roster's Students and Pairs by name, in list and creation order. */
export function fileRoster(roster: Roster): FileRoster {
  const names = new Map(roster.students.map((s) => [s.id, s.name]));
  const pairs = [...roster.pairs]
    .sort((x, y) => x.created - y.created)
    .filter((p) => names.has(p.a) && names.has(p.b))
    .map((p): FilePair => ({ type: p.type, students: [names.get(p.a)!, names.get(p.b)!] }));
  return { name: roster.name, students: roster.students.map((s) => s.name), pairs };
}

/** Export: the `<Roster name>.grouper.json` text, pretty-printed. */
export function exportRoster(roster: Roster, now: Date): string {
  const { name, students, pairs } = fileRoster(roster);
  const file: RosterFile = { grouper: "roster", version: FILE_VERSION, name, exported: now.toISOString(), students, pairs };
  return JSON.stringify(file, null, 2);
}

/** Backup ("Export all Rosters"): every Roster in picker order, pretty-printed. */
export function exportBackup(rosters: readonly Roster[], now: Date): string {
  const file: BackupFile = {
    grouper: "backup",
    version: FILE_VERSION,
    exported: now.toISOString(),
    rosters: rosters.map(fileRoster),
  };
  return JSON.stringify(file, null, 2);
}

/** `Period 2.grouper.json`. Characters no file system allows become "-". */
export function rosterFileName(roster: Roster): string {
  return `${roster.name.replace(/[/\\:*?"<>|]/g, "-")}.grouper.json`;
}

/** `grouper-backup-2026-11-18.json`, using the Teacher's local date. */
export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `grouper-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

// ---------------------------------------------------------------------------------------------
// Import step 1: read the file

/** A chosen file: its name (for the extension and default Roster name) and its text. */
export interface ImportSource {
  readonly name: string;
  readonly text: string;
}

/**
 * A Roster read from a file, before it is added. Names are as written in the file (not yet
 * de-duplicated); `importRosters` does the lenient part. `skipped` holds what reading already
 * had to leave out (entries that aren't names or Pairs).
 */
export interface ImportedRoster {
  readonly name: string;
  readonly students: readonly string[];
  readonly pairs: readonly FilePair[];
  readonly skipped: readonly string[];
}

export type ImportRead =
  | {
      readonly ok: true;
      /** A grouper file. */
      readonly kind: "grouper";
      /** True for a Backup ("Export all Rosters"), false for one Roster. */
      readonly backup: boolean;
      readonly rosters: readonly ImportedRoster[];
    }
  | {
      readonly ok: true;
      /**
       * A .txt / .csv name list (spec: export-import.md#import item 3), for the confirm step. `source` is the Add
       * names parser's reading: plain lines for .txt, a table for the column picker for .csv (or
       * tabbed text). `text` and `fileName` are what `useNameList` takes to show it.
       */
      readonly kind: "names";
      /** The default Roster name: the file name without its extension. */
      readonly name: string;
      readonly fileName: string;
      readonly text: string;
      readonly source: NameSource;
    }
  | { readonly ok: false; readonly message: string };

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Upgrades, one version at a time: `UPGRADES[v]` turns a version-v file into a version-(v + 1) file.
 * Empty while version 1 is the only one; add an entry here with each new FILE_VERSION.
 */
const UPGRADES: Readonly<Record<number, (file: Json) => Json>> = {};

/** Brings an older file up to FILE_VERSION. Exported for tests. */
export function upgradeFile(file: Json, upgrades: Readonly<Record<number, (file: Json) => Json>> = UPGRADES): Json {
  let current = file;
  for (let v = current.version as number; v < FILE_VERSION; v++) {
    const step = upgrades[v];
    if (!step) throw new Error(`No upgrade from file version ${v}`);
    current = { ...step(current), version: v + 1 };
  }
  return current;
}

/**
 * Import step 1, and the only file-type dispatch: works out what the file is and reads it. A JSON
 * object with a `grouper` field is a grouper file whatever its extension; otherwise a .txt or .csv
 * file is a name list; anything else is refused.
 */
export function readImportFile(source: ImportSource): ImportRead {
  const json = parseJson(source.text);
  if (isObject(json) && "grouper" in json) return readGrouperFile(json, source.name);
  if (isNameListFileName(source.name)) return readNameListFile(source);
  return { ok: false, message: NOT_GROUPER_FILE_MESSAGE };
}

/** Whether a file name is a .txt or .csv name list (case-insensitive). */
export function isNameListFileName(fileName: string): boolean {
  return /\.(txt|csv)$/i.test(fileName.trim());
}

/** `Period 2.csv` → "Period 2": the file name without its extension (spec: export-import.md), or a default. */
export function nameListRosterName(fileName: string): string {
  return normaliseName(fileName.replace(/\.[^.]*$/, "")) || UNNAMED_ROSTER_NAME;
}

function readNameListFile({ name, text }: ImportSource): ImportRead {
  if (text.replace(/^﻿/, "").trim() === "") return { ok: false, message: EMPTY_NAME_LIST_MESSAGE };
  const source = readNameSource(text, name);
  return { ok: true, kind: "names", name: nameListRosterName(name), fileName: name, text, source };
}

/**
 * The Roster a confirmed name-list Import adds (spec: export-import.md#import item 3): the Roster name and the
 * names ticked in the Add names preview, no Pairs. It joins Import at step 2 (the clash question).
 */
export function nameListRoster(name: string, names: readonly string[]): ImportedRoster {
  return { name, students: [...names], pairs: [], skipped: [] };
}

function readGrouperFile(json: Json, fileName: string): ImportRead {
  const notGrouper = { ok: false, message: NOT_GROUPER_FILE_MESSAGE } as const;
  if (json.grouper !== "roster" && json.grouper !== "backup") return notGrouper;
  const { version } = json;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) return notGrouper;
  if (version > FILE_VERSION) return { ok: false, message: NEWER_VERSION_MESSAGE };
  const file = upgradeFile(json);

  if (file.grouper === "roster") {
    const roster = readFileRoster(file, defaultRosterName(fileName));
    return roster ? { ok: true, kind: "grouper", backup: false, rosters: [roster] } : notGrouper;
  }
  if (!Array.isArray(file.rosters)) return notGrouper;
  const rosters: ImportedRoster[] = [];
  for (const entry of file.rosters) {
    const roster = isObject(entry) ? readFileRoster(entry, UNNAMED_ROSTER_NAME) : null;
    if (!roster) return notGrouper;
    rosters.push(roster);
  }
  return { ok: true, kind: "grouper", backup: true, rosters };
}

/** `Period 2.grouper.json` → "Period 2". */
function defaultRosterName(fileName: string): string {
  return normaliseName(fileName.replace(/(\.grouper)?\.json$/i, "")) || UNNAMED_ROSTER_NAME;
}

/** One Roster's name, Students and Pairs; null if the shape is wrong (no Students list). */
function readFileRoster(value: Json, fallbackName: string): ImportedRoster | null {
  if (!Array.isArray(value.students)) return null;
  if (value.pairs !== undefined && !Array.isArray(value.pairs)) return null;
  const skipped: string[] = [];
  const name = (typeof value.name === "string" && normaliseName(value.name)) || fallbackName;

  const students: string[] = [];
  let unreadable = 0;
  for (const s of value.students) {
    if (typeof s === "string" && normaliseName(s) !== "") students.push(s);
    else unreadable++;
  }
  if (unreadable > 0) skipped.push(unreadableStudentsMessage(unreadable));

  const pairs: FilePair[] = [];
  let badPairs = 0;
  for (const p of (value.pairs as unknown[] | undefined) ?? []) {
    const pair = readFilePair(p);
    if (pair) pairs.push(pair);
    else badPairs++;
  }
  if (badPairs > 0) skipped.push(unreadablePairsMessage(badPairs));
  return { name, students, pairs, skipped };
}

function readFilePair(value: unknown): FilePair | null {
  if (!isObject(value) || (value.type !== "good pair" && value.type !== "keep apart")) return null;
  const s = value.students;
  if (!Array.isArray(s) || s.length !== 2 || typeof s[0] !== "string" || typeof s[1] !== "string") return null;
  return { type: value.type, students: [s[0], s[1]] };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------------------------
// Import step 2: name clashes

/** The Rosters in this browser whose names the import would take, in picker order. */
export function importClashes(state: AppState, rosters: readonly ImportedRoster[]): Roster[] {
  const keys = new Set(rosters.map((r) => nameKey(r.name)));
  return state.rosters.filter((r) => keys.has(nameKey(r.name)));
}

/** "Replace" swaps each clashing Roster for the imported one; "keep both" renames the import. */
export type ClashChoice = "replace" | "keep both";

/** Title of the clash question (invented wording). */
export const CLASH_TITLE = "Roster already here";

/** The clash question (invented wording; spec: export-import.md gives the choices, not the sentence). */
export function clashMessage(clashes: readonly Roster[]): string {
  if (clashes.length === 1) {
    const { name } = clashes[0]!;
    return `There's already a Roster called "${name}". Replace it, or keep both and save the new one as "${name} (imported)"?`;
  }
  const names = clashes.map((r) => `"${r.name}"`).join(", ");
  return `These Rosters are already here: ${names}. Replace them, or keep both and save the new ones with "(imported)" after their names?`;
}

/** "Period 2 (imported)", then "Period 2 (imported 2)", … until no Roster has the name. */
export function keepBothName(name: string, taken: readonly { name: string }[]): string {
  const keys = new Set(taken.map((r) => nameKey(r.name)));
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? `${name} (imported)` : `${name} (imported ${n})`;
    if (!keys.has(nameKey(candidate))) return candidate;
  }
}

// ---------------------------------------------------------------------------------------------
// Import step 3: add the Rosters

/** What happened to one imported Roster, for the toast and the skipped-items message. */
export interface ImportedResult {
  readonly roster: Roster;
  /** Everything left out, one sentence each, in file order. */
  readonly skipped: readonly string[];
}

/**
 * Builds a Roster from file data through the ordinary operations: Students via `addStudent` (a
 * repeated name is kept once) and Pairs via `addPair` in file order (one naming an unknown Student,
 * repeating another Pair or contradicting the Pairs accepted so far is dropped). Every Student starts
 * Present; Pair `created` follows file order.
 */
export function buildRoster(id: RosterId, name: string, data: ImportedRoster, newId: IdGenerator): ImportedResult {
  let roster = newRoster(id, name);
  const skipped = [...data.skipped];

  const repeated = new Set<string>();
  for (const raw of data.students) {
    const r = addStudent(roster, raw, newId);
    if (r.ok) roster = r.roster;
    else repeated.add(nameKey(raw));
  }
  const byKey = new Map(roster.students.map((s) => [nameKey(s.name), s]));
  for (const key of repeated) skipped.push(repeatedNameMessage(byKey.get(key)!.name));

  for (const pair of data.pairs) {
    const [rawA, rawB] = pair.students;
    const a = byKey.get(nameKey(rawA));
    const b = byKey.get(nameKey(rawB));
    const label = pairText(a?.name ?? normaliseName(rawA), b?.name ?? normaliseName(rawB));
    if (!a || !b) {
      const missing = [!a ? normaliseName(rawA) : null, !b && nameKey(rawA) !== nameKey(rawB) ? normaliseName(rawB) : null];
      skipped.push(unknownStudentPairMessage(label, missing.filter((x): x is string => !!x)));
      continue;
    }
    if (a.id === b.id) {
      skipped.push(samePairStudentMessage(label));
      continue;
    }
    const existing = findPair(roster, a.id, b.id);
    if (existing) {
      skipped.push(repeatedPairMessage(label, existing.type === pair.type ? null : existing.type));
      continue;
    }
    const check = checkPair(roster, pair.type, a.id, b.id);
    if (!check.ok) {
      skipped.push(`${label}: ${check.message}`);
      continue;
    }
    const r = addPair(roster, pair.type, a.id, b.id, newId);
    if (r.ok) roster = r.roster;
  }
  return { roster, skipped };
}

/**
 * Import step 3: always adds Rosters (spec: export-import.md). With "replace", an imported Roster takes the place
 * in the picker of the Roster that had its name; with "keep both" (or a clash with another Roster
 * from the same file) it is saved as "<name> (imported)", "(imported 2)" … The first imported Roster
 * opens.
 */
export function importRosters(
  state: AppState,
  rosters: readonly ImportedRoster[],
  choice: ClashChoice,
  newId: IdGenerator,
): { state: AppState; imported: ImportedResult[] } {
  let list = [...state.rosters];
  const before = new Set(state.rosters.map((r) => r.id));
  const imported: ImportedResult[] = [];
  for (const data of rosters) {
    const name = normaliseName(data.name) || UNNAMED_ROSTER_NAME;
    const clash = list.find((r) => nameKey(r.name) === nameKey(name));
    const replace = clash && choice === "replace" && before.has(clash.id);
    const finalName = !clash || replace ? name : keepBothName(name, list);
    const result = buildRoster(newId(), finalName, data, newId);
    imported.push(result);
    if (replace) {
      before.delete(clash.id);
      list = list.map((r) => (r.id === clash.id ? result.roster : r));
    } else {
      list.push(result.roster);
    }
  }
  const currentId = imported[0]?.roster.id ?? state.currentId;
  return { state: { rosters: list, currentId }, imported };
}

// ---------------------------------------------------------------------------------------------
// Sentences (invented wording except the toast, which is from spec: export-import.md)

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** spec: export-import.md toast: `Imported "Period 2": 25 Students, 5 pairs.`; for several Rosters, a total. */
export function importedMessage(imported: readonly ImportedResult[]): string {
  const students = imported.reduce((n, r) => n + r.roster.students.length, 0);
  const pairs = imported.reduce((n, r) => n + r.roster.pairs.length, 0);
  const counts = `${count(students, "Student", "Students")}, ${count(pairs, "pair", "pairs")}.`;
  if (imported.length === 1) return `Imported "${imported[0]!.roster.name}": ${counts}`;
  return `Imported ${count(imported.length, "Roster", "Rosters")}: ${counts}`;
}

/** Title of the skipped-items message. */
export const SKIPPED_TITLE = "Some things weren't imported";

export function repeatedNameMessage(name: string): string {
  return `${name} is in the file more than once, so was added once. If they're two people, add the second as "${name} B.".`;
}

export function unknownStudentPairMessage(label: string, missing: readonly string[]): string {
  const who = missing.length === 1 ? `${missing[0]} isn't` : `${missing.join(" and ")} aren't`;
  return `${label}: ${who} on the Roster.`;
}

export function samePairStudentMessage(label: string): string {
  return `${label}: a pair needs two different Students.`;
}

export function repeatedPairMessage(label: string, otherKind: PairType | null): string {
  if (otherKind === null) return `${label}: that pair is in the file more than once.`;
  const kind = otherKind === "good pair" ? "Good pair" : "Keep apart pair";
  return `${label}: already a ${kind} earlier in the file.`;
}

export function unreadableStudentsMessage(n: number): string {
  return `${count(n, "entry", "entries")} in the Students list ${n === 1 ? "isn't a name" : "aren't names"}.`;
}

export function unreadablePairsMessage(n: number): string {
  return `${count(n, "pair", "pairs")} couldn't be read.`;
}
