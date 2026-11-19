// The Groups on screen and their lifecycle (SPEC §3 Group, §7 Lifecycle). Pure state both UIs hold
// next to their AppState. It is never saved: a reload starts with EMPTY_BOARD.
//
// Wiring (both UIs):
// - after every change to AppState, `board = boardAfterRosterChange(board, before, after)` with the
//   open Roster before and after (handles out-of-date, switching Roster, the edited Split);
// - Shuffle/Reshuffle button → `shuffle(roster, board)` (shuffle.ts), toasting its `toast` if set;
// - Lock toggle → `toggleLock(board, groupId)` (lock.ts);
// - stepper → `setTargetSize` on the Roster, then `resetSplit(board)`;
// - Split "Edit" → Save → `editSplit(board, roster, text)`.

import {
  presentCount,
  type Roster,
  type Result,
  type Student,
  type StudentId,
} from "./roster";
import { activeSplit, parseSplit } from "./split";

export type GroupId = string;

export interface Group {
  readonly id: GroupId;
  /** Student ids, in display order. Absent or removed Students stay until the next Reshuffle. */
  readonly members: readonly StudentId[];
  /** Fixed when the Group is made (a Reshuffle shrinks a Locked Group that lost Absent or removed members). */
  readonly size: number;
  /** Set by the Lock toggle (`toggleLock`, lock.ts); a Reshuffle keeps a Locked Group (SPEC §4). */
  readonly locked: boolean;
  /** Header hue in degrees, from GROUP_HUES by position; kept by a Locked Group on Reshuffle. */
  readonly hue: number;
}

export interface Board {
  /** In position order (Group 1 first). Empty before the first Shuffle. */
  readonly groups: readonly Group[];
  /** The Roster's attendance, Students or Pairs changed since these Groups were made. */
  readonly outOfDate: boolean;
  /** The Teacher's hand-edited Split, or null for the derived one. Lasts until the Present count changes. */
  readonly editedSplit: readonly number[] | null;
  /** Every member's name as it was at the Shuffle, so a removed Student can still be shown (faded). */
  readonly names: Readonly<Record<StudentId, string>>;
}

export const EMPTY_BOARD: Board = { groups: [], outOfDate: false, editedSplit: null, names: {} };

export const EMPTY_BOARD_MESSAGE = "Take the roll (✓ Present), then Shuffle.";
/** The out-of-date notice; the UI shows it with a ⚠ in front and a Reshuffle button after. */
export const OUT_OF_DATE_MESSAGE = "The Roster changed since these Groups were made, so they're out of date.";

export function hasGroups(board: Board): boolean {
  return board.groups.length > 0;
}

/** "Shuffle" with no Groups, "Reshuffle" after. */
export function shuffleButtonLabel(board: Board): "Shuffle" | "Reshuffle" {
  return hasGroups(board) ? "Reshuffle" : "Shuffle";
}

/** The Split the next Shuffle will use, for the text beside the stepper. */
export function currentSplit(board: Board, roster: Roster): number[] {
  return activeSplit(presentCount(roster), roster.target, board.editedSplit);
}

/** Saves the Split the Teacher typed in "Edit". Groups on screen don't go out of date. */
export function editSplit(board: Board, roster: Roster, text: string): Result<{ board: Board }> {
  const parsed = parseSplit(text, presentCount(roster));
  if (!parsed.ok) return parsed;
  return { ok: true, board: { ...board, editedSplit: parsed.split } };
}

/** Back to the derived Split (call after the stepper changes the Target size, or for an "Automatic" link). */
export function resetSplit(board: Board): Board {
  return board.editedSplit === null ? board : { ...board, editedSplit: null };
}

function sameStudents(a: readonly Student[], b: readonly Student[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(a.map((s) => [s.id, s]));
  return b.every((s) => byId.get(s.id)?.present === s.present);
}

function samePairs(a: Roster, b: Roster): boolean {
  if (a.pairs.length !== b.pairs.length) return false;
  const ids = new Set(a.pairs.map((p) => p.id));
  return b.pairs.every((p) => ids.has(p.id));
}

/**
 * Keeps the Board in step with the open Roster. Call it after every AppState change with the open
 * Roster before and after:
 * - another Roster (or none) is open: EMPTY_BOARD (switching Roster clears the Groups);
 * - attendance, the set of Students, or the Pairs changed: the Groups stay as they are but are out
 *   of date (renaming a Student or changing the Target size doesn't);
 * - the Present count changed: a hand-edited Split is dropped.
 */
export function boardAfterRosterChange(board: Board, before: Roster | undefined, after: Roster | undefined): Board {
  if (!after || !before || before.id !== after.id) return board === EMPTY_BOARD ? board : EMPTY_BOARD;
  if (before === after) return board;
  let next = board;
  if (hasGroups(board) && !board.outOfDate && !(sameStudents(before.students, after.students) && samePairs(before, after))) {
    next = { ...next, outOfDate: true };
  }
  if (next.editedSplit && presentCount(before) !== presentCount(after)) next = { ...next, editedSplit: null };
  return next;
}

/** "Group 1" (Groups are numbered by position). */
export function groupTitle(index: number): string {
  return `Group ${index + 1}`;
}

/** "4 students". */
export function groupSizeLabel(group: Group): string {
  return `${group.size} ${group.size === 1 ? "student" : "students"}`;
}

/** The card header, "Group 1 · 4 students". */
export function groupHeading(group: Group, index: number): string {
  return `${groupTitle(index)} · ${groupSizeLabel(group)}`;
}

export type MemberStatus = "present" | "absent" | "removed";

export interface MemberView {
  readonly id: StudentId;
  /** The current name, or the name at Shuffle time for a removed Student. */
  readonly name: string;
  readonly status: MemberStatus;
  /** Absent or removed since the Shuffle: draw the name faded until the Reshuffle. */
  readonly faded: boolean;
}

/** What a Group card shows for each member. */
export function groupMembers(board: Board, group: Group, roster: Roster): MemberView[] {
  const byId = new Map(roster.students.map((s) => [s.id, s]));
  return group.members.map((id) => {
    const student = byId.get(id);
    const status: MemberStatus = !student ? "removed" : student.present ? "present" : "absent";
    return { id, name: student?.name ?? board.names[id] ?? "", status, faded: status !== "present" };
  });
}
