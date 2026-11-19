// Shuffle / Reshuffle (SPEC §4): Present Students + Split → solver → Groups on the Board.
//
// Still to come, each slotting in before `solve`:
// - #16: the Roster's Pairs among the free pool become `goodPairs` / `keepApart`, with the
//   chain-too-big and apart-clique quick checks and the Conflict sentences;
// - #19: Locked Groups keep their members, position and hue; the free pool is everyone else and
//   its Split is re-derived from the Target size.

import { EMPTY_BOARD, type Board, type Group } from "./groups";
import { groupHue } from "./layout";
import { presentStudents, randomId, type IdGenerator, type Result, type Roster, type StudentId } from "./roster";
import { solve, type Rng, type SolverConflict } from "./solver";
import { activeSplit, canShuffle, NEED_TWO_PRESENT_MESSAGE, splitText } from "./split";

export interface ShuffleOptions {
  /** Defaults to Math.random. */
  readonly rng?: Rng;
  /** Group ids. Defaults to randomId. */
  readonly newId?: IdGenerator;
}

/** The search found no grouping: "No way to make 2 groups of 4 and 3 groups of 5 keeps every pair." */
export function noGroupingMessage(split: readonly number[]): string {
  const words = splitText(split);
  const i = words.lastIndexOf(", ");
  const list = i < 0 ? words : `${words.slice(0, i)} and ${words.slice(i + 2)}`;
  return `No way to make ${list} keeps every pair.`;
}

function conflictMessage(conflict: SolverConflict, split: readonly number[]): string {
  switch (conflict.kind) {
    case "apart-inside-chain":
    case "no-solution":
      return noGroupingMessage(split);
  }
}

/**
 * Shuffles the open Roster's Present Students into new Groups matching the current Split (the
 * hand-edited one if it still fits, else derived). On success the Board has fresh Groups, numbered
 * and coloured by position, and is no longer out of date; the edited Split is kept. Refused (Board
 * unchanged) with fewer than 2 Present, or with a Conflict.
 */
export function shuffle(roster: Roster, board: Board, options: ShuffleOptions = {}): Result<{ board: Board }> {
  const { rng = Math.random, newId = randomId } = options;
  const present = presentStudents(roster);
  if (!canShuffle(present.length)) return { ok: false, message: NEED_TWO_PRESENT_MESSAGE };

  const split = activeSplit(present.length, roster.target, board.editedSplit);
  const ids: StudentId[] = present.map((s) => s.id);
  const result = solve({ students: ids.map((_, i) => i), split, rng });
  if (!result.ok) return { ok: false, message: conflictMessage(result.conflict, split) };

  const groups: Group[] = result.groups.map((members, i) => ({
    id: newId(),
    members: members.map((m) => ids[m]!),
    size: members.length,
    locked: false,
    hue: groupHue(i),
  }));
  const names: Record<StudentId, string> = {};
  for (const s of present) names[s.id] = s.name;
  return { ok: true, board: { ...EMPTY_BOARD, editedSplit: board.editedSplit, groups, names } };
}
