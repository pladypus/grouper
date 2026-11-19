// Manual move (SPEC §7): swapping two Students between Groups, the tap/keyboard selection both UIs
// share, and the flags on Groups that break a Rule.
//
// Wiring (both UIs):
// - hold `selected: Selection` (null at first) next to the Board; clear it on every Shuffle, Roster
//   switch, and Esc / ✕;
// - tap, Enter or Space on a Student → `tapStudent(board, roster, selected, id)`; store `board` and
//   `selected`, toast `toast` if set, and put `announcement` in the polite live region;
// - drop at the end of a drag → `dropStudent(board, roster, draggedId, targetIdOrNull)`, same fields;
//   the drag library never reorders lists itself;
// - ⇄ on hover while a Student is selected or dragged: `canSwap(board, fromId, id)`;
//   don't start a drag or selection on a Student where `canMove(board, id)` is false;
// - every Group card: `groupFlags(board, roster)[group.id]`; non-empty → amber outline and one
//   warning line per entry (`.message`). Flags are derived, never stored: a swap that undoes the
//   break, a Pair edit, or a Reshuffle simply changes what this returns.

import { groupTitle, type Board, type Group, type GroupId } from "./groups";
import type { Pair, PairId, Result, Roster, StudentId } from "./roster";
import { goodPairChains, pairText } from "./rules";

export const DROP_ONTO_STUDENT_MESSAGE = "Drop onto a Student to swap with them.";
export const NOT_IN_A_GROUP_MESSAGE = "That Student isn't in a Group.";
export const SELECTION_CANCELLED_MESSAGE = "Swap cancelled.";

/** Refusal (toast) for a swap into or out of a Locked Group: "Group 2 is Locked. Unlock it to move Students." */
export function lockedGroupMessage(index: number): string {
  return `${groupTitle(index)} is Locked. Unlock it to move Students.`;
}

/** Live-region instruction while a Student is selected. */
export function selectedInstruction(name: string): string {
  return `${name} selected. Choose a Student in another Group to swap with, or press Escape to cancel.`;
}

/** Live-region announcement after a swap: "Swapped Ana and Ben." */
export function swappedAnnouncement(a: string, b: string): string {
  return `Swapped ${a} and ${b}.`;
}

/** Flag line for a Keep apart pair in one Group: "Ana & Ben are set to keep apart." */
export function keepApartFlagMessage(a: string, b: string): string {
  return `${pairText(a, b)} are set to keep apart.`;
}

/** Flag line for a Good pair split across Groups: "Ana & Dee are a Good pair, but they're in different Groups." */
export function goodPairSplitFlagMessage(a: string, b: string): string {
  return `${pairText(a, b)} are a Good pair, but they're in different Groups.`;
}

/**
 * Flag line for two Present Students linked only through Students who aren't in a Group (Absent):
 * "Ana and Eli are linked by Good pairs (Ana & Dee, Dee & Eli), but they're in different Groups."
 */
export function chainSplitFlagMessage(a: string, b: string, links: readonly (readonly [string, string])[]): string {
  return `${a} and ${b} are linked by Good pairs (${links.map(([x, y]) => pairText(x, y)).join(", ")}), but they're in different Groups.`;
}

// ---------------------------------------------------------------------------------------------
// Swap

interface Place {
  readonly group: number;
  readonly slot: number;
}

/** Where a Student sits on the Board, or undefined if in no Group. */
function placeOf(board: Board, id: StudentId): Place | undefined {
  for (let group = 0; group < board.groups.length; group++) {
    const slot = board.groups[group]!.members.indexOf(id);
    if (slot >= 0) return { group, slot };
  }
  return undefined;
}

/** The Group a Student is in, if any. */
export function groupOf(board: Board, id: StudentId): Group | undefined {
  const place = placeOf(board, id);
  return place && board.groups[place.group];
}

/** Whether a Student can be picked up or selected: in a Group, and that Group isn't Locked. */
export function canMove(board: Board, id: StudentId): boolean {
  const group = groupOf(board, id);
  return !!group && !group.locked;
}

/** Whether `from` and `to` can swap (for ⇄ on hover): both movable and in different Groups. */
export function canSwap(board: Board, from: StudentId, to: StudentId): boolean {
  const a = placeOf(board, from);
  const b = placeOf(board, to);
  return !!a && !!b && a.group !== b.group && !board.groups[a.group]!.locked && !board.groups[b.group]!.locked;
}

/**
 * Swaps two Students in different Groups; each takes the other's place in the list, so Group sizes
 * and the Split never change. The same Student or two in the same Group is a no-op (`board` is
 * returned unchanged). Refused when either is in no Group, or either Group is Locked (toast the
 * message). Breaking a Rule is allowed; `groupFlags` then reports it. Doesn't mark Groups out of date.
 */
export function swapStudents(board: Board, a: StudentId, b: StudentId): Result<{ board: Board }> {
  const pa = placeOf(board, a);
  const pb = placeOf(board, b);
  if (!pa || !pb) return { ok: false, message: NOT_IN_A_GROUP_MESSAGE };
  if (pa.group === pb.group) return { ok: true, board };
  for (const i of [pa.group, pb.group]) {
    if (board.groups[i]!.locked) return { ok: false, message: lockedGroupMessage(i) };
  }
  const groups = board.groups.map((group, i) => {
    if (i === pa.group) return { ...group, members: group.members.map((m, s) => (s === pa.slot ? b : m)) };
    if (i === pb.group) return { ...group, members: group.members.map((m, s) => (s === pb.slot ? a : m)) };
    return group;
  });
  return { ok: true, board: { ...board, groups } };
}

// ---------------------------------------------------------------------------------------------
// Tap / keyboard selection and drop

/** The selected Student (tap-tap / keyboard), or null. */
export type Selection = StudentId | null;

export interface MoveOutcome {
  readonly board: Board;
  readonly selected: Selection;
  /** Show as a toast (a refusal). */
  readonly toast?: string;
  /** Put in the polite live region for screen readers. */
  readonly announcement?: string;
}

function nameOf(board: Board, roster: Roster, id: StudentId): string {
  return roster.students.find((s) => s.id === id)?.name ?? board.names[id] ?? "";
}

function swapOutcome(board: Board, roster: Roster, from: StudentId, to: StudentId): MoveOutcome {
  const result = swapStudents(board, from, to);
  if (!result.ok) return { board, selected: null, toast: result.message };
  if (result.board === board) return { board, selected: null };
  return {
    board: result.board,
    selected: null,
    announcement: swappedAnnouncement(nameOf(board, roster, from), nameOf(board, roster, to)),
  };
}

/**
 * Tap, Enter or Space on a Student:
 * - nothing selected: select them (a Student in a Locked Group is refused with a toast);
 * - the selected Student again: cancel;
 * - another Student in the same Group: select them instead;
 * - a Student in another Group: swap and clear the selection (refused with a toast if a Group is
 *   Locked, which also clears it).
 * A selection that is no longer on the Board counts as nothing selected.
 */
export function tapStudent(board: Board, roster: Roster, selected: Selection, id: StudentId): MoveOutcome {
  const at = placeOf(board, id);
  if (!at) return { board, selected: null };
  const from = selected === null ? undefined : placeOf(board, selected);
  if (selected === id) return { board, selected: null, announcement: SELECTION_CANCELLED_MESSAGE };
  if (!from || from.group === at.group) {
    if (board.groups[at.group]!.locked) return { board, selected: null, toast: lockedGroupMessage(at.group) };
    return { board, selected: id, announcement: selectedInstruction(nameOf(board, roster, id)) };
  }
  return swapOutcome(board, roster, selected!, id);
}

/** Esc or ✕ while a Student is selected. */
export function cancelSelection(board: Board): MoveOutcome {
  return { board, selected: null, announcement: SELECTION_CANCELLED_MESSAGE };
}

/**
 * The end of a drag. `target` is the Student it was dropped onto, or null when dropped anywhere
 * else (toasts "Drop onto a Student to swap with them."). Dropping onto a Student swaps as
 * `swapStudents` does; the selection is always cleared.
 */
export function dropStudent(board: Board, roster: Roster, dragged: StudentId, target: StudentId | null): MoveOutcome {
  if (target === null) return { board, selected: null, toast: DROP_ONTO_STUDENT_MESSAGE };
  return swapOutcome(board, roster, dragged, target);
}

// ---------------------------------------------------------------------------------------------
// Flags

/** One warning line on a Group card. */
export interface GroupFlag {
  readonly message: string;
  /** The Pairs it names (one, or the Good pairs linking two Students through Absent ones). */
  readonly pairIds: readonly PairId[];
}

/**
 * The Rules each Group breaks, re-checked from scratch (call it on every render). Only Present
 * Students who are in a Group count; Absent or removed members never raise a flag.
 * - A Keep apart pair inside one Group flags that Group.
 * - A Present Good pair chain whose members are in different Groups flags each of those Groups,
 *   naming each broken link: a Good pair with both Students in Groups, or the Good pairs linking two
 *   such Students through Students in no Group (Absent). A Group gets only the links it's part of.
 * Every Group on the Board has an entry (empty when it isn't flagged); lines are ordered by the
 * oldest Pair they name.
 */
export function groupFlags(board: Board, roster: Roster): Record<GroupId, readonly GroupFlag[]> {
  const present = new Map(roster.students.filter((s) => s.present).map((s) => [s.id, s.name]));
  const groupIndex = new Map<StudentId, number>();
  board.groups.forEach((g, i) => g.members.forEach((m) => present.has(m) && groupIndex.set(m, i)));

  const lines: { group: number; flag: GroupFlag; created: number }[] = [];
  const name = (id: StudentId) => present.get(id) ?? "";

  for (const p of roster.pairs) {
    if (p.type !== "keep apart") continue;
    const g = groupIndex.get(p.a);
    if (g !== undefined && g === groupIndex.get(p.b)) {
      lines.push({ group: g, created: p.created, flag: { message: keepApartFlagMessage(name(p.a), name(p.b)), pairIds: [p.id] } });
    }
  }

  const allNames = new Map(roster.students.map((s) => [s.id, s.name]));
  for (const chain of goodPairChains(roster)) {
    const edges = new Map<StudentId, Pair[]>();
    for (const p of chain.pairs) {
      for (const s of [p.a, p.b]) {
        if (!edges.has(s)) edges.set(s, []);
        edges.get(s)!.push(p);
      }
    }
    // From each placed Student, walk through unplaced ones to the nearest placed Students; each one
    // reached in another Group is a broken link. Each link is found from both ends; keep one.
    const seen = new Set<string>();
    for (const start of chain.students) {
      const g = groupIndex.get(start);
      if (g === undefined) continue;
      const via = new Map<StudentId, Pair | null>([[start, null]]);
      const queue = [start];
      for (let i = 0; i < queue.length; i++) {
        const s = queue[i]!;
        for (const p of edges.get(s) ?? []) {
          const t = p.a === s ? p.b : p.a;
          if (via.has(t)) continue;
          via.set(t, p);
          const h = groupIndex.get(t);
          if (h === undefined) {
            queue.push(t);
            continue;
          }
          if (h === g) continue;
          const key = start < t ? `${start}|${t}` : `${t}|${start}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const path: Pair[] = [];
          for (let at = t; at !== start; ) {
            const step = via.get(at)!;
            path.unshift(step);
            at = step.a === at ? step.b : step.a;
          }
          let flag: GroupFlag;
          if (path.length === 1) {
            const only = path[0]!;
            flag = { message: goodPairSplitFlagMessage(name(only.a), name(only.b)), pairIds: [only.id] };
          } else {
            const links: [string, string][] = [];
            let at = start;
            for (const step of path) {
              const next = step.a === at ? step.b : step.a;
              links.push([allNames.get(at) ?? "", allNames.get(next) ?? ""]);
              at = next;
            }
            flag = { message: chainSplitFlagMessage(name(start), name(t), links), pairIds: path.map((q) => q.id) };
          }
          const created = Math.min(...path.map((q) => q.created));
          lines.push({ group: g, created, flag }, { group: h, created, flag });
        }
      }
    }
  }

  const out: Record<GroupId, GroupFlag[]> = {};
  for (const g of board.groups) out[g.id] = [];
  lines.sort((x, y) => x.created - y.created);
  for (const line of lines) out[board.groups[line.group]!.id]!.push(line.flag);
  return out;
}

/** Whether any Group is flagged. */
export function hasFlags(flags: Record<GroupId, readonly GroupFlag[]>): boolean {
  return Object.values(flags).some((f) => f.length > 0);
}
