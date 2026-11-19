// Shuffle / Reshuffle (SPEC §4): Present Students + Split + Pairs → solver → Groups on the Board.
//
// Still to come, slotting in before `solve`: #19's Locked Groups keep their members, position and
// hue; the free pool is everyone else and its Split is re-derived from the Target size.

import { EMPTY_BOARD, type Board, type Group } from "./groups";
import { groupHue } from "./layout";
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
import { activeSplit, canShuffle, NEED_TWO_PRESENT_MESSAGE, splitText } from "./split";

export interface ShuffleOptions {
  /** Defaults to Math.random. */
  readonly rng?: Rng;
  /** Group ids. Defaults to randomId. */
  readonly newId?: IdGenerator;
}

/** Why a Shuffle found no Groups, for the Conflict notice. */
export interface ShuffleConflict {
  readonly kind: SolverConflict["kind"];
  /**
   * The Pairs behind a quick check (the chain's Good pairs, the clique's Keep apart pairs; for
   * `apart-inside-chain` the Keep apart pair first). Empty for `no-solution`: #17's explanation
   * finds those.
   */
  readonly pairIds: readonly PairId[];
}

export type ShuffleResult =
  | { readonly ok: true; readonly board: Board }
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

/** The plain Conflict sentence (SPEC §6) for a solver Conflict; `ids` maps solver ids to Students. */
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
 * Shuffles the open Roster's Present Students into new Groups matching the current Split (the
 * hand-edited one if it still fits, else derived), keeping every Pair among them (Good pair chains
 * run through Absent Students). On success the Board has fresh Groups, numbered and coloured by
 * position, and is no longer out of date; the edited Split is kept. Refused (Board unchanged) with
 * fewer than 2 Present, or with a Conflict.
 */
export function shuffle(roster: Roster, board: Board, options: ShuffleOptions = {}): ShuffleResult {
  const { rng = Math.random, newId = randomId } = options;
  const present = presentStudents(roster);
  if (!canShuffle(present.length)) return { ok: false, message: NEED_TWO_PRESENT_MESSAGE };

  const split = activeSplit(present.length, roster.target, board.editedSplit);
  // Solver ids: Present Students are 0…n-1 (the pool); Absent ones follow so chains run through them.
  const ids: StudentId[] = [...present, ...roster.students.filter((s) => !s.present)].map((s) => s.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const goodPairs: SolverPair[] = [];
  const keepApart: SolverPair[] = [];
  for (const p of roster.pairs) {
    const a = index.get(p.a);
    const b = index.get(p.b);
    if (a === undefined || b === undefined) continue;
    (p.type === "good pair" ? goodPairs : keepApart).push({ id: p.id, a, b, created: p.created });
  }

  const result = solve({
    students: present.map((_, i) => i),
    split,
    goodPairs,
    keepApart,
    target: roster.target,
    rng,
  });
  if (!result.ok) {
    const { conflict } = result;
    return {
      ok: false,
      message: conflictMessage(roster, conflict, split, ids),
      conflict: { kind: conflict.kind, pairIds: conflict.kind === "no-solution" ? [] : conflict.pairIds },
    };
  }

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
