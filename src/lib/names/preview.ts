// The Add names preview (SPEC §11): the names that would be added, and what was skipped.

import { nameKey } from "./key";
import { cleanNameLine, looksLikeSentence } from "./parse";

export interface PreviewName {
  /** As it will be added: cleaned (trimmed, collapsed, list marker removed). */
  readonly name: string;
  /** Its name key, unique within the preview; use it to remember ticks. */
  readonly key: string;
  /** Over 40 characters: shown with "looks like a sentence?", still ticked. */
  readonly flagged: boolean;
}

export type SkipReason = "on roster" | "repeat";

export interface SkippedName {
  readonly name: string;
  readonly reason: SkipReason;
}

export interface NamePreview {
  /** The new names, in list order, each once. */
  readonly names: readonly PreviewName[];
  /** Names already on the Roster, and repeats within the list (each listed once per repeat). */
  readonly skipped: readonly SkippedName[];
  /** Lines with no name left after cleanup (blank lines at the very start and end aren't counted). */
  readonly blankLines: number;
}

/**
 * Builds the preview for a list of raw lines against the Students (or any named things) already on
 * the Roster. Pass `[]` for a brand-new Roster.
 */
export function previewNames(lines: readonly string[], existing: readonly { name: string }[]): NamePreview {
  const cleaned = lines.map(cleanNameLine);
  let start = 0;
  let end = cleaned.length;
  while (start < end && cleaned[start] === "") start++;
  while (end > start && cleaned[end - 1] === "") end--;
  const onRoster = new Set(existing.map((s) => nameKey(s.name)));
  const seen = new Set<string>();
  const names: PreviewName[] = [];
  const skipped: SkippedName[] = [];
  let blankLines = 0;
  for (const name of cleaned.slice(start, end)) {
    if (name === "") {
      blankLines++;
      continue;
    }
    const key = nameKey(name);
    if (onRoster.has(key)) skipped.push({ name, reason: "on roster" });
    else if (seen.has(key)) skipped.push({ name, reason: "repeat" });
    else {
      seen.add(key);
      names.push({ name, key, flagged: looksLikeSentence(name) });
    }
  }
  return { names, skipped, blankLines };
}
