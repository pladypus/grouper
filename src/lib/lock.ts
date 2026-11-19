// Locks (spec: shuffle-rules.md steps 1–3, lock-and-manual-move.md#lock): the Lock toggle, its labels, and the checks a Reshuffle runs
// on Locked Groups before the solver sees the free pool (shuffle.ts calls `planLocks`).
//
// Wiring (UI):
// - Lock toggle in each Group header → `board = toggleLock(board, group.id)`; label it with
//   `lockToggleLabel(group, index)` and `aria-pressed={group.locked}`; the pill reads
//   `lockPillText(group)` ("Locked" solid when Locked). Locked look: ring in the Group's own colour,
//   tinted body, solid pill. Locking never marks the Groups out of date;
// - Reshuffle button: after the label, `keepsLockedText(board)` ("keeps 2 Locked") when non-null;
// - while a Student is selected or dragged, fade back every Group where `group.locked`.

import { groupTitle, type Board, type Group, type GroupId } from "./groups";
import { goodPairChains, listNames, pairText } from "./rules";
import type { Pair, Roster, Student, StudentId } from "./roster";

/** The pill on a Locked Group's header (solid). */
export const LOCKED_PILL_TEXT = "Locked";
/** The pill on an unlocked Group's header (the pressable Lock toggle, outlined). */
export const LOCK_PILL_TEXT = "Lock";

/** Flips a Group's Lock. Unknown ids leave the Board unchanged. Doesn't mark the Groups out of date. */
export function toggleLock(board: Board, groupId: GroupId): Board {
  return setLocked(board, groupId, !board.groups.find((g) => g.id === groupId)?.locked);
}

/** Locks or unlocks a Group. Returns `board` itself when nothing changes. */
export function setLocked(board: Board, groupId: GroupId, locked: boolean): Board {
  const at = board.groups.findIndex((g) => g.id === groupId);
  if (at < 0 || board.groups[at]!.locked === locked) return board;
  return { ...board, groups: board.groups.map((g, i) => (i === at ? { ...g, locked } : g)) };
}

/** How many Groups are Locked. */
export function lockedCount(board: Board): number {
  return board.groups.filter((g) => g.locked).length;
}

/** The Reshuffle button's extra text, "keeps 2 Locked", or null when no Group is Locked. */
export function keepsLockedText(board: Board): string | null {
  const n = lockedCount(board);
  return n === 0 ? null : `keeps ${n} Locked`;
}

/** "Locked" or "Lock": the header pill's text. */
export function lockPillText(group: Group): string {
  return group.locked ? LOCKED_PILL_TEXT : LOCK_PILL_TEXT;
}

/** Accessible name for the Lock toggle: "Lock Group 2" / "Unlock Group 2" (pair with aria-pressed). */
export function lockToggleLabel(group: Group, index: number): string {
  return `${group.locked ? "Unlock" : "Lock"} ${groupTitle(index)}`;
}

/**
 * Toast after a Reshuffle that released Locks: "Lock released: Ana would have been alone in a
 * Locked Group." Several at once: "Locks released: Ana and Ben would each have been alone in a
 * Locked Group."
 */
export function lockReleasedMessage(names: readonly string[]): string {
  if (names.length === 1) return `Lock released: ${names[0]} would have been alone in a Locked Group.`;
  return `Locks released: ${listNames(names)} would each have been alone in a Locked Group.`;
}

/** Conflict (`lone-leftover`): "Only Ana is left outside the Locked Groups, and a group of 1 isn't allowed. …" */
export function loneLeftoverMessage(name: string): string {
  return `Only ${name} is left outside the Locked Groups, and a group of 1 isn't allowed. Unlock a Group or mark someone else Present.`;
}

/**
 * Conflict (`chain-cut-by-lock`): "Ana is in Locked Group 2, but Dee, linked to Ana by a Good pair,
 * isn't. Unlock Group 2 or delete the pair." When they're linked through Absent Students the links
 * are named: "… but Eli, linked to Ana by Good pairs (Ana & Dee, Dee & Eli), isn't. Unlock Group 2
 * or delete one of those pairs."
 */
export function chainCutByLockMessage(
  locked: string,
  groupIndex: number,
  free: string,
  links: readonly (readonly [string, string])[],
): string {
  const group = groupTitle(groupIndex);
  if (links.length <= 1) {
    return `${locked} is in Locked ${group}, but ${free}, linked to ${locked} by a Good pair, isn't. Unlock ${group} or delete the pair.`;
  }
  const named = links.map(([x, y]) => pairText(x, y)).join(", ");
  return `${locked} is in Locked ${group}, but ${free}, linked to ${locked} by Good pairs (${named}), isn't. Unlock ${group} or delete one of those pairs.`;
}

// ---------------------------------------------------------------------------------------------
// Reshuffle around Locks

/** A Locked Group that survives step 1, with its position on the Board before the Reshuffle. */
export interface KeptLock {
  /** Absent and removed members dropped (size then matches); the same object if none were. */
  readonly group: Group;
  readonly index: number;
}

export type LockPlan =
  | {
      readonly ok: true;
      /** Locked Groups kept, in Board order. */
      readonly locks: readonly KeptLock[];
      /** Present Students not in a kept Lock, in Roster order. */
      readonly pool: readonly Student[];
      /** Students whose Lock was released because they'd have been alone in it. */
      readonly released: readonly StudentId[];
    }
  | {
      readonly ok: false;
      readonly kind: "lone-leftover" | "chain-cut-by-lock";
      readonly message: string;
      /** For `chain-cut-by-lock`: the Good pairs linking the Locked Student to the free one. */
      readonly pairIds: readonly string[];
    };

/**
 * spec: shuffle-rules.md steps 1–3 for the Present Students:
 * 1. drop Absent or removed Students from each Locked Group; a Locked Group left with one Student is
 *    released (they rejoin the pool), one left with none just goes;
 * 2. the free pool is every Present Student not in a kept Lock; exactly 1 is a Conflict;
 * 3. a Good pair chain with Present members both in a kept Lock and in the pool is a Conflict naming
 *    the Lock and the chain. Keep apart across a Lock always holds, and Rules broken inside or
 *    between Locked Groups are carried over (no Conflict).
 */
export function planLocks(board: Board, roster: Roster): LockPlan {
  const present = roster.students.filter((s) => s.present);
  const presentIds = new Set(present.map((s) => s.id));
  const locks: KeptLock[] = [];
  const released: StudentId[] = [];
  board.groups.forEach((group, index) => {
    if (!group.locked) return;
    const members = group.members.filter((id) => presentIds.has(id));
    if (members.length === 1) released.push(members[0]!);
    if (members.length < 2) return;
    locks.push({ index, group: members.length === group.members.length ? group : { ...group, members, size: members.length } });
  });

  const lockOf = new Map<StudentId, number>();
  for (const { group, index } of locks) for (const id of group.members) lockOf.set(id, index);
  const pool = present.filter((s) => !lockOf.has(s.id));
  const nameOf = (id: StudentId) => roster.students.find((s) => s.id === id)?.name ?? "";

  if (pool.length === 1) {
    return { ok: false, kind: "lone-leftover", message: loneLeftoverMessage(pool[0]!.name), pairIds: [] };
  }

  const free = new Set(pool.map((s) => s.id));
  for (const chain of goodPairChains(roster)) {
    const cut = chainCut(chain.pairs, chain.students, lockOf, free, presentIds);
    if (!cut) continue;
    const { from, to, path } = cut;
    const links: [string, string][] = [];
    let at = from;
    for (const step of path) {
      const next = step.a === at ? step.b : step.a;
      links.push([nameOf(at), nameOf(next)]);
      at = next;
    }
    return {
      ok: false,
      kind: "chain-cut-by-lock",
      message: chainCutByLockMessage(nameOf(from), lockOf.get(from)!, nameOf(to), links),
      pairIds: path.map((p) => p.id),
    };
  }

  return { ok: true, locks, pool, released };
}

/**
 * The fewest Good pairs from a Present Student in a Lock to a free one in this chain (walking only
 * through Students who aren't Present), or null when the chain doesn't span a Lock and the pool.
 */
function chainCut(
  pairs: readonly Pair[],
  students: readonly StudentId[],
  lockOf: ReadonlyMap<StudentId, number>,
  free: ReadonlySet<StudentId>,
  present: ReadonlySet<StudentId>,
): { from: StudentId; to: StudentId; path: Pair[] } | null {
  const sources = students.filter((id) => lockOf.has(id));
  if (sources.length === 0 || !students.some((id) => free.has(id))) return null;
  const edges = new Map<StudentId, Pair[]>();
  for (const p of pairs) {
    for (const s of [p.a, p.b]) {
      if (!edges.has(s)) edges.set(s, []);
      edges.get(s)!.push(p);
    }
  }
  const via = new Map<StudentId, Pair | null>(sources.map((id) => [id, null]));
  const queue = [...sources];
  for (let i = 0; i < queue.length; i++) {
    const s = queue[i]!;
    for (const p of edges.get(s) ?? []) {
      const t = p.a === s ? p.b : p.a;
      if (via.has(t)) continue;
      via.set(t, p);
      if (free.has(t)) {
        const path: Pair[] = [];
        let at = t;
        for (let step = via.get(at); step; step = via.get(at)) {
          path.unshift(step);
          at = step.a === at ? step.b : step.a;
        }
        return { from: at, to: t, path };
      }
      if (!present.has(t)) queue.push(t);
    }
  }
  return null;
}
