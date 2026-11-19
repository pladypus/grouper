// Shuffle / Reshuffle (spec: shuffle-rules.md): Locks first (lock.ts `planLocks`), then the free pool's Split, then
// the solver. Locked Groups keep their place and colour; new Groups fill the other positions.

import { EMPTY_BOARD, type Board, type Group } from "./groups";
import { GROUP_HUES, groupHue } from "./layout";
import { lockReleasedMessage, planLocks, type KeptLock } from "./lock";
import {
  presentStudents,
  randomId,
  type IdGenerator,
  type PairId,
  type Roster,
  type StudentId,
} from "./roster";
import { apartCliqueMessage, chainTooBigMessage, keepApartInsideChainMessage } from "./rules";
import { solve, type Rng, type SolverConflict, type SolverPair } from "./solver";
import { activeSplit, canShuffle, deriveSplit, NEED_TWO_PRESENT_MESSAGE, splitText } from "./split";

export interface ShuffleOptions {
  /** Defaults to Math.random. */
  readonly rng?: Rng;
  /** Group ids. Defaults to randomId. */
  readonly newId?: IdGenerator;
}

/** Why a Shuffle found no Groups, for the Conflict notice. */
export interface ShuffleConflict {
  /**
   * A solver Conflict, or one of the Lock checks in spec: shuffle-rules.md: `lone-leftover` (exactly one Present Student
   * outside the Locked Groups) or `chain-cut-by-lock` (a Present chain partly Locked, partly free).
   */
  readonly kind: SolverConflict["kind"] | "lone-leftover" | "chain-cut-by-lock";
  /**
   * The Pairs behind the Conflict, for "Show the Rules involved": for a quick check the chain's Good
   * pairs or the clique's Keep apart pairs (for `apart-inside-chain` the Keep apart pair first; for
   * `chain-cut-by-lock` the Good pairs linking the Locked Student to the free one); for
   * `no-solution` the clashing Pairs explain found, newest first. Empty for `lone-leftover`.
   */
  readonly pairIds: readonly PairId[];
}

export type ShuffleResult =
  | {
      readonly ok: true;
      readonly board: Board;
      /** Set when a Lock was released: toast "Lock released: Ana would have been alone in a Locked Group." */
      readonly toast?: string;
    }
  /**
   * Refused; the Board stays as it was. `conflict` is set when the Rules can't all be kept: show
   * `message` in the red Conflict notice on the board. Without it (fewer than 2 Present) the
   * Shuffle button should have been disabled.
   */
  | { readonly ok: false; readonly message: string; readonly conflict?: ShuffleConflict };

/** The search found no grouping: "No way to make 2 groups of 4 and 3 groups of 5 keeps every pair." */
export function noGroupingMessage(split: readonly number[]): string {
  const words = splitText(split);
  const i = words.lastIndexOf(", ");
  const list = i < 0 ? words : `${words.slice(0, i)} and ${words.slice(i + 2)}`;
  return `No way to make ${list} keeps every pair.`;
}

/** The plain Conflict sentence (spec: conflicts.md) for a solver Conflict; `ids` maps solver ids to Students. */
function conflictMessage(
  roster: Roster,
  conflict: SolverConflict,
  split: readonly number[],
  ids: readonly StudentId[],
): string {
  const names = new Map(roster.students.map((s) => [s.id, s.name]));
  const nameOf = (i: number) => names.get(ids[i]!) ?? "";
  switch (conflict.kind) {
    case "apart-inside-chain": {
      const pair = roster.pairs.find((p) => p.id === conflict.pairId);
      return pair ? keepApartInsideChainMessage(roster, pair.a, pair.b) : noGroupingMessage(split);
    }
    case "chain-too-big":
      return chainTooBigMessage(conflict.students.map(nameOf), conflict.limit);
    case "apart-clique": {
      // Name each block by its Students in the clique's Keep apart pairs (a chain with two such
      // members reads "Ana & Dee").
      const involved = new Set<StudentId>();
      for (const p of roster.pairs) {
        if (conflict.pairIds.includes(p.id)) involved.add(p.a).add(p.b);
      }
      const blockNames = conflict.blocks.map((block) => {
        const inPairs = block.filter((i) => involved.has(ids[i]!));
        return (inPairs.length > 0 ? inPairs : block).map(nameOf).join(" & ");
      });
      return apartCliqueMessage(blockNames, conflict.groups);
    }
    case "no-solution":
      return noGroupingMessage(split);
  }
}

/**
 * Shuffles the open Roster's Present Students into new Groups, keeping every Pair among them (Good
 * pair chains run through Absent Students) and keeping the Locked Groups (spec: shuffle-rules.md):
 * - Locked Groups lose their Absent or removed members and otherwise stay exactly as they are (id,
 *   members, place, hue, Lock), even if they break a Rule (they stay flagged). One left with a single
 *   Student is released and that Student rejoins the pool (`toast` says so); one left empty goes.
 * - The free pool (every other Present Student) is split by the hand-edited Split if there are no
 *   Locks and it still fits, else the Split derived from the Target size for the pool alone.
 * - New Groups fill the positions the Locked Groups don't hold, in order, with the hues the Locked
 *   Groups don't use.
 * On success the Board is no longer out of date and the edited Split is kept for later. Refused
 * (Board unchanged) with fewer than 2 Present, or with a Conflict (including the Lock checks: one
 * Student left outside the Locks, or a chain cut by a Lock).
 */
export function shuffle(roster: Roster, board: Board, options: ShuffleOptions = {}): ShuffleResult {
  const { rng = Math.random, newId = randomId } = options;
  const present = presentStudents(roster);
  if (!canShuffle(present.length)) return { ok: false, message: NEED_TWO_PRESENT_MESSAGE };

  const plan = planLocks(board, roster);
  if (!plan.ok) return { ok: false, message: plan.message, conflict: { kind: plan.kind, pairIds: plan.pairIds } };
  const { locks, pool, released } = plan;

  const split =
    locks.length === 0 ? activeSplit(pool.length, roster.target, board.editedSplit) : deriveSplit(pool.length, roster.target);
  // Solver ids: the pool is 0…n-1; everyone else follows so chains run through Absent Students
  // (a chain can't reach a Locked Student here: planLocks refused that).
  const inPool = new Set(pool.map((s) => s.id));
  const ids: StudentId[] = [...pool.map((s) => s.id), ...roster.students.filter((s) => !inPool.has(s.id)).map((s) => s.id)];
  const index = new Map(ids.map((id, i) => [id, i]));
  const goodPairs: SolverPair[] = [];
  const keepApart: SolverPair[] = [];
  for (const p of roster.pairs) {
    const a = index.get(p.a);
    const b = index.get(p.b);
    if (a === undefined || b === undefined) continue;
    (p.type === "good pair" ? goodPairs : keepApart).push({ id: p.id, a, b, created: p.created });
  }

  // A free pool of 0 (everyone Present is Locked) is fine: no new Groups.
  const result =
    pool.length === 0
      ? ({ ok: true, groups: [] } as const)
      : solve({ students: pool.map((_, i) => i), split, goodPairs, keepApart, target: roster.target, rng });
  if (!result.ok) {
    const { conflict } = result;
    return {
      ok: false,
      message: conflictMessage(roster, conflict, split, ids),
      conflict: { kind: conflict.kind, pairIds: conflict.pairIds },
    };
  }

  const groups = placeGroups(
    locks,
    result.groups.map((members) => members.map((m) => ids[m]!)),
    newId,
  );
  const names: Record<StudentId, string> = {};
  for (const s of present) names[s.id] = s.name;
  const next: Board = { ...EMPTY_BOARD, editedSplit: board.editedSplit, groups, names };
  if (released.length === 0) return { ok: true, board: next };
  return { ok: true, board: next, toast: lockReleasedMessage(released.map((id) => names[id] ?? "")) };
}

/**
 * Lays out the Board: each Locked Group at its old position where it still fits (Locks keep their
 * order; they only move up when there are fewer Groups than before), new Groups in the gaps in
 * order. Locked Groups keep their hue; each new Group takes its position's hue, or the next one in
 * GROUP_HUES that no other Group has yet (so a new Group never shares a Locked Group's colour while
 * hues are left).
 */
function placeGroups(locks: readonly KeptLock[], free: readonly StudentId[][], newId: IdGenerator): Group[] {
  const total = locks.length + free.length;
  const used = new Set(locks.map((l) => l.group.hue));
  const groups: Group[] = [];
  let nextLock = 0;
  let nextFree = 0;
  for (let position = 0; position < total; position++) {
    const lock = locks[nextLock];
    if (lock && (lock.index <= position || nextFree === free.length)) {
      groups.push(lock.group);
      nextLock++;
      continue;
    }
    const members = free[nextFree++]!;
    let hue = groupHue(position);
    for (let k = 0; k < GROUP_HUES.length; k++) {
      const candidate = groupHue(position + k);
      if (!used.has(candidate)) {
        hue = candidate;
        break;
      }
    }
    used.add(hue);
    groups.push({ id: newId(), members, size: members.length, locked: false, hue });
  }
  return groups;
}
