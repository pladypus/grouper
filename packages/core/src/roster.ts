// Domain types (SPEC §3) and the pure Roster operations both UIs call.
// Nothing here throws for something the Teacher did: refusals come back as `{ ok: false, message }`
// with the sentence to show. Every operation returns new objects and never mutates its input.

import {
  duplicateRosterMessage,
  duplicateStudentMessage,
  EMPTY_ROSTER_NAME_MESSAGE,
  EMPTY_STUDENT_NAME_MESSAGE,
  findByName,
  normaliseName,
} from "./names";

export type RosterId = string;
export type StudentId = string;
export type PairId = string;

export interface Student {
  readonly id: StudentId;
  /** As first typed: trimmed, inner whitespace collapsed. */
  readonly name: string;
  readonly present: boolean;
}

/** The two kinds of Rule ("Pairs" to Teachers). */
export type PairType = "good pair" | "keep apart";

export interface Pair {
  readonly id: PairId;
  readonly type: PairType;
  /** Two different Student ids on the same Roster. */
  readonly a: StudentId;
  readonly b: StudentId;
  /** Monotonic creation counter, used for blame order. */
  readonly created: number;
}

export interface Roster {
  readonly id: RosterId;
  readonly name: string;
  /** In the order the Teacher sees them. */
  readonly students: readonly Student[];
  readonly pairs: readonly Pair[];
  /** Target size ("Number of students in group"), an integer ≥ 2. Saved per Roster in the browser. */
  readonly target: number;
  /**
   * The creation clock for Pairs: the `created` the next Pair gets (browser-only, SPEC §3). Never
   * goes back, so deleting the newest Pair doesn't reuse its number. Missing (older saves, hand-built
   * Rosters) means one more than the highest `created` on the Roster; read it with `nextPairCreated`.
   */
  readonly pairClock?: number;
}

/** Every Roster in this browser, in picker order, and the one that is open. */
export interface AppState {
  readonly rosters: readonly Roster[];
  /** Id of the open Roster; null only when there are no Rosters (first visit). */
  readonly currentId: RosterId | null;
}

/** Makes a fresh id. Inject a deterministic one in tests. */
export type IdGenerator = () => string;

export type Result<T extends object> = ({ readonly ok: true } & T) | { readonly ok: false; readonly message: string };

export const DEFAULT_TARGET_SIZE = 4;
export const MIN_TARGET_SIZE = 2;

export const ONLY_ROSTER_MESSAGE = "You can't delete your only Roster.";
export const UNKNOWN_ROSTER_MESSAGE = "That Roster no longer exists.";
export const UNKNOWN_STUDENT_MESSAGE = "That Student is no longer on this Roster.";

/** Default id generator: random and unique enough for one browser's Rosters. */
export const randomId: IdGenerator = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

function refuse(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

// ---------------------------------------------------------------------------------------------
// Rosters (the AppState)

export const EMPTY_APP_STATE: AppState = { rosters: [], currentId: null };

/** The open Roster, or undefined on first visit. */
export function currentRoster(state: AppState): Roster | undefined {
  return state.rosters.find((r) => r.id === state.currentId);
}

/**
 * Checks a Roster name: non-empty and not taken by another Roster. Returns the normalised name; a
 * refusal names the existing Roster as written.
 */
export function checkRosterName(
  state: AppState,
  rawName: string,
  exceptId?: RosterId,
): Result<{ name: string }> {
  const name = normaliseName(rawName);
  if (name === "") return refuse(EMPTY_ROSTER_NAME_MESSAGE);
  const taken = findByName(state.rosters, name, exceptId);
  if (taken) return refuse(duplicateRosterMessage(taken.name));
  return { ok: true, name };
}

/** A new, empty Roster with the default Target size (not yet in any AppState). */
export function newRoster(id: RosterId, name: string): Roster {
  return { id, name: normaliseName(name), students: [], pairs: [], target: DEFAULT_TARGET_SIZE, pairClock: 0 };
}

/** New Roster: appended to the picker and made the open Roster. */
export function createRoster(
  state: AppState,
  rawName: string,
  newId: IdGenerator,
): Result<{ state: AppState; roster: Roster }> {
  const check = checkRosterName(state, rawName);
  if (!check.ok) return check;
  const roster = newRoster(newId(), check.name);
  return { ok: true, roster, state: { rosters: [...state.rosters, roster], currentId: roster.id } };
}

export function renameRoster(state: AppState, rosterId: RosterId, rawName: string): Result<{ state: AppState }> {
  const roster = state.rosters.find((r) => r.id === rosterId);
  if (!roster) return refuse(UNKNOWN_ROSTER_MESSAGE);
  const check = checkRosterName(state, rawName, rosterId);
  if (!check.ok) return check;
  return { ok: true, state: replaceRoster(state, { ...roster, name: check.name }) };
}

/** SPEC §8: the confirmation shown before Delete Roster. */
export function deleteRosterConfirmMessage(roster: Roster): string {
  return `Delete "${roster.name}" and all its Students and pairs? Export it first if you might want it back.`;
}

/**
 * Delete Roster (after the Teacher confirmed). The only Roster can't be deleted. If the open Roster
 * is deleted, the next one in the picker opens (or the previous one, if it was last).
 */
export function deleteRoster(state: AppState, rosterId: RosterId): Result<{ state: AppState }> {
  const index = state.rosters.findIndex((r) => r.id === rosterId);
  if (index < 0) return refuse(UNKNOWN_ROSTER_MESSAGE);
  if (state.rosters.length === 1) return refuse(ONLY_ROSTER_MESSAGE);
  const rosters = state.rosters.filter((r) => r.id !== rosterId);
  const currentId =
    state.currentId === rosterId ? rosters[Math.min(index, rosters.length - 1)]!.id : state.currentId;
  return { ok: true, state: { rosters, currentId } };
}

/** Whether Delete Roster is allowed (to disable the menu item). */
export function canDeleteRoster(state: AppState): boolean {
  return state.rosters.length > 1;
}

/** Opens another Roster from the picker. Unknown ids leave the state unchanged. */
export function selectRoster(state: AppState, rosterId: RosterId): AppState {
  if (!state.rosters.some((r) => r.id === rosterId)) return state;
  return { ...state, currentId: rosterId };
}

/** Puts an updated Roster back into the AppState, keeping its place in the picker. */
export function replaceRoster(state: AppState, roster: Roster): AppState {
  return { ...state, rosters: state.rosters.map((r) => (r.id === roster.id ? roster : r)) };
}

/**
 * Applies a Roster operation to the Roster with this id and puts the result back.
 * Handy in reducers: `updateRoster(state, id, (r) => togglePresent(r, studentId))`.
 */
export function updateRoster(state: AppState, rosterId: RosterId, update: (roster: Roster) => Roster): AppState {
  const roster = state.rosters.find((r) => r.id === rosterId);
  return roster ? replaceRoster(state, update(roster)) : state;
}

// ---------------------------------------------------------------------------------------------
// Students

/**
 * Checks a Student name: non-empty and unique on this Roster. Returns the normalised name; a refusal
 * names the existing Student as written ("There's already a Sam…" when " sam " is typed).
 */
export function checkStudentName(
  roster: Roster,
  rawName: string,
  exceptId?: StudentId,
): Result<{ name: string }> {
  const name = normaliseName(rawName);
  if (name === "") return refuse(EMPTY_STUDENT_NAME_MESSAGE);
  const taken = findByName(roster.students, name, exceptId);
  if (taken) return refuse(duplicateStudentMessage(taken.name));
  return { ok: true, name };
}

/** Adds one Student at the end of the list. New Students start Present. */
export function addStudent(
  roster: Roster,
  rawName: string,
  newId: IdGenerator,
): Result<{ roster: Roster; student: Student }> {
  const check = checkStudentName(roster, rawName);
  if (!check.ok) return check;
  const student: Student = { id: newId(), name: check.name, present: true };
  return { ok: true, student, roster: { ...roster, students: [...roster.students, student] } };
}

export function renameStudent(roster: Roster, studentId: StudentId, rawName: string): Result<{ roster: Roster }> {
  if (!roster.students.some((s) => s.id === studentId)) return refuse(UNKNOWN_STUDENT_MESSAGE);
  const check = checkStudentName(roster, rawName, studentId);
  if (!check.ok) return check;
  return {
    ok: true,
    roster: {
      ...roster,
      students: roster.students.map((s) => (s.id === studentId ? { ...s, name: check.name } : s)),
    },
  };
}

/** What Undo needs to put a removed Student back exactly as they were. */
export interface RemovedStudent {
  readonly rosterId: RosterId;
  readonly student: Student;
  /** Their position in the Roster's Student list before removal. */
  readonly index: number;
  /** The Pairs that were removed with them. */
  readonly pairs: readonly Pair[];
}

/** Removes a Student and every Pair they are in. Keep `removed` for the Undo notice. */
export function removeStudent(
  roster: Roster,
  studentId: StudentId,
): Result<{ roster: Roster; removed: RemovedStudent }> {
  const index = roster.students.findIndex((s) => s.id === studentId);
  if (index < 0) return refuse(UNKNOWN_STUDENT_MESSAGE);
  const inPair = (p: Pair) => p.a === studentId || p.b === studentId;
  return {
    ok: true,
    removed: { rosterId: roster.id, student: roster.students[index]!, index, pairs: roster.pairs.filter(inPair) },
    roster: {
      ...roster,
      students: roster.students.filter((s) => s.id !== studentId),
      pairs: roster.pairs.filter((p) => !inPair(p)),
    },
  };
}

/** The Undo notice text, e.g. "Removed Sam and 2 pairs." (the UI adds the Undo button). */
export function removedStudentMessage(removed: RemovedStudent): string {
  const n = removed.pairs.length;
  if (n === 0) return `Removed ${removed.student.name}.`;
  return `Removed ${removed.student.name} and ${n} ${n === 1 ? "pair" : "pairs"}.`;
}

/**
 * Undo for removeStudent: puts the Student back at their old position with their attendance and
 * their Pairs (those whose other Student is still on the Roster). Refused if the name has been
 * taken in the meantime.
 */
export function restoreStudent(roster: Roster, removed: RemovedStudent): Result<{ roster: Roster }> {
  const { student } = removed;
  if (roster.students.some((s) => s.id === student.id)) return { ok: true, roster };
  const check = checkStudentName(roster, student.name);
  if (!check.ok) return check;
  const students = [...roster.students];
  students.splice(Math.min(removed.index, students.length), 0, student);
  const ids = new Set(students.map((s) => s.id));
  const pairIds = new Set(roster.pairs.map((p) => p.id));
  const back = removed.pairs.filter((p) => ids.has(p.a) && ids.has(p.b) && !pairIds.has(p.id));
  const pairs = [...roster.pairs, ...back].sort((x, y) => x.created - y.created);
  return { ok: true, roster: { ...roster, students, pairs } };
}

/** The `created` the next Pair on this Roster gets: the Pair clock, never below one past the newest Pair. */
export function nextPairCreated(roster: Roster): number {
  let next = roster.pairClock ?? 0;
  for (const p of roster.pairs) next = Math.max(next, p.created + 1);
  return next;
}

// ---------------------------------------------------------------------------------------------
// Attendance

/** Marks a Student Present or Absent. Unknown ids leave the Roster unchanged. */
export function setPresent(roster: Roster, studentId: StudentId, present: boolean): Roster {
  const student = roster.students.find((s) => s.id === studentId);
  if (!student || student.present === present) return roster;
  return { ...roster, students: roster.students.map((s) => (s.id === studentId ? { ...s, present } : s)) };
}

/** Attendance mode tap: Present ↔ Absent. */
export function togglePresent(roster: Roster, studentId: StudentId): Roster {
  const student = roster.students.find((s) => s.id === studentId);
  return student ? setPresent(roster, studentId, !student.present) : roster;
}

export function presentStudents(roster: Roster): Student[] {
  return roster.students.filter((s) => s.present);
}

export function presentCount(roster: Roster): number {
  return presentStudents(roster).length;
}

/** The top-bar label, e.g. "23/25 Present" (the UI adds the "›"). */
export function attendanceLabel(roster: Roster): string {
  return `${presentCount(roster)}/${roster.students.length} Present`;
}

// ---------------------------------------------------------------------------------------------
// Target size

/**
 * The "Number of students in group" stepper. Rounds to a whole number and never goes below 2 (the
 * stepper's − is disabled at MIN_TARGET_SIZE). Returns the same Roster when nothing changes or `n`
 * isn't a number. Groups on screen don't go out of date (SPEC §7).
 */
export function setTargetSize(roster: Roster, n: number): Roster {
  if (!Number.isFinite(n)) return roster;
  const target = Math.max(MIN_TARGET_SIZE, Math.round(n));
  return target === roster.target ? roster : { ...roster, target };
}
