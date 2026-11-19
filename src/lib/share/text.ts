// Share (spec: share.md): the words for Copy as text, its toast, and the print header. Pure; the UI
// writes the text to the clipboard and passes in today's date.

import { groupMembers, groupTitle, type Board } from "../groups";
import type { Roster } from "../roster";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "18 Nov 2026", the same in every locale so a copy reads the same wherever it's pasted. */
export function shareDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** "Period 2 groups": the title of a copy and of the printout. */
export function shareTitle(roster: Roster): string {
  return `${roster.name} groups`;
}

function plural(n: number, one: string): string {
  return `${n} ${n === 1 ? one : `${one}s`}`;
}

/** The number of Students in the Groups on screen, for the printout's header. */
export function boardStudentCount(board: Board): number {
  return board.groups.reduce((sum, g) => sum + g.members.length, 0);
}

/** The printout's line beside the title: "18 Nov 2026 · 25 Students". */
export function printSubtitle(board: Board, date: Date): string {
  return `${shareDate(date)} · ${plural(boardStudentCount(board), "Student")}`;
}

/**
 * Copy as text:
 * ```
 * Period 2 groups, 18 Nov 2026
 * Group 1: Ana, Dee, Eli, Ben
 * ```
 * Each card's names in card order, as on screen and on paper.
 */
export function groupsAsText(board: Board, roster: Roster, date: Date): string {
  const lines = board.groups.map(
    (g, i) => `${groupTitle(i)}: ${groupMembers(board, g, roster).map((m) => m.name).join(", ")}`,
  );
  return [`${shareTitle(roster)}, ${shareDate(date)}`, ...lines].join("\n");
}

/** The toast after Copy as text: "Copied 5 Groups as text." */
export function copiedTextMessage(board: Board): string {
  return `Copied ${plural(board.groups.length, "Group")} as text.`;
}

/** The toast after Copy picture: "Copied a picture of 5 Groups. Paste it into your slide." */
export function copiedPictureMessage(board: Board): string {
  return `Copied a picture of ${plural(board.groups.length, "Group")}. Paste it into your slide.`;
}

/** The toast when the browser can't put a picture on the clipboard and the PNG downloads instead. */
export const PICTURE_DOWNLOADED_MESSAGE = "This browser can't copy pictures, so it was downloaded instead.";

/** The toast when the browser can't draw the picture at all. */
export const PICTURE_FAILED_MESSAGE = "This browser couldn't make the picture. Try Copy as text.";

/** The Share button's tooltip while it's disabled (no Groups yet). */
export const SHARE_NEEDS_GROUPS_MESSAGE = "Shuffle first, then share the Groups.";

/** The toast when the browser refuses the clipboard. */
export const COPY_FAILED_MESSAGE = "This browser wouldn't let Grouper copy. Try again, or use Print….";

/** The toast when the browser refuses full screen (e.g. inside a frame). */
export const FULL_SCREEN_FAILED_MESSAGE = "Full screen is blocked here; press F11.";
