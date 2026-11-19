// Target size → Split (spec: domain-model.md#target-size-split-leftovers-4-6): the derived Split, its text, and
// the Teacher's hand-edited Split.

import type { Result } from "./roster";

/** Shuffle is disabled below this many Present Students. */
export const MIN_PRESENT_TO_SHUFFLE = 2;

export const NEED_TWO_PRESENT_MESSAGE = "Mark at least 2 students Present.";
export const SPLIT_WHOLE_NUMBERS_MESSAGE = "Use whole numbers, e.g. 4, 4, 5.";
export const SPLIT_GROUP_OF_ONE_MESSAGE = "A group of 1 isn't allowed.";

/** "Those sizes add up to 24, but 25 Students are Present." */
export function splitTotalMessage(total: number, presentCount: number): string {
  const present = presentCount === 1 ? "1 Student is" : `${presentCount} Students are`;
  return `Those sizes add up to ${total}, but ${present} Present.`;
}

/** Whether Shuffle can run (and the Split exists) for this many Present Students. */
export function canShuffle(presentCount: number): boolean {
  return presentCount >= MIN_PRESENT_TO_SHUFFLE;
}

/**
 * The derived Split for `presentCount` Students at Target size `target`, smallest Groups first.
 * Fewer Present than the Target size makes one Group of everyone; otherwise floor(n / t) Groups of
 * t, with the Leftovers added one each to Groups in turn (so Groups only grow, never a Group of 1).
 * Empty when fewer than 2 are Present.
 *
 * 25 at 4 → [4,4,4,4,4,5]; 25 at 2 → [2×12, 3]; 27 at 4 → [4,4,4,5,5,5]; 7 at 5 → [7].
 */
export function deriveSplit(presentCount: number, target: number): number[] {
  if (!canShuffle(presentCount)) return [];
  const count = Math.floor(presentCount / target);
  if (count === 0) return [presentCount];
  const sizes = new Array<number>(count).fill(target);
  for (let i = 0; i < presentCount - count * target; i++) sizes[i % count]!++;
  return sizes.sort((a, b) => a - b);
}

export function splitTotal(split: readonly number[]): number {
  return split.reduce((sum, n) => sum + n, 0);
}

/**
 * The Split to Shuffle with: the hand-edited one if there is one and it still adds up to the
 * Present count, otherwise the derived one.
 */
export function activeSplit(presentCount: number, target: number, edited?: readonly number[] | null): number[] {
  if (edited && edited.length > 0 && splitTotal(edited) === presentCount && canShuffle(presentCount)) {
    return [...edited];
  }
  return deriveSplit(presentCount, target);
}

/**
 * The Split in words beside the stepper: "2 groups of 4, 3 groups of 5" (smallest size first),
 * "1 group of 7". Empty string for no Split.
 */
export function splitText(split: readonly number[]): string {
  const counts = new Map<number, number>();
  for (const size of split) counts.set(size, (counts.get(size) ?? 0) + 1);
  return [...counts]
    .sort(([a], [b]) => a - b)
    .map(([size, n]) => `${n} ${n === 1 ? "group" : "groups"} of ${size}`)
    .join(", ");
}

/** What the "Edit" box starts with: "4, 4, 5, 5". */
export function splitInputText(split: readonly number[]): string {
  return split.join(", ");
}

/**
 * Reads the sizes the Teacher typed ("4, 4, 5, 5"; commas, spaces or "+" between them). Refused if
 * a size isn't a whole number ≥ 1, a size is 1, or the total isn't the Present count.
 */
export function parseSplit(text: string, presentCount: number): Result<{ split: number[] }> {
  if (!canShuffle(presentCount)) return { ok: false, message: NEED_TWO_PRESENT_MESSAGE };
  const tokens = text.split(/[\s,+]+/).filter((t) => t !== "");
  const sizes = tokens.map(Number);
  if (sizes.length === 0 || sizes.some((n) => !Number.isInteger(n) || n < 1)) {
    return { ok: false, message: SPLIT_WHOLE_NUMBERS_MESSAGE };
  }
  if (sizes.includes(1)) return { ok: false, message: SPLIT_GROUP_OF_ONE_MESSAGE };
  const total = splitTotal(sizes);
  if (total !== presentCount) return { ok: false, message: splitTotalMessage(total, presentCount) };
  return { ok: true, split: sizes };
}
