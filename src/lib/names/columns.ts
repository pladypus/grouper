// The column picker's first guess (SPEC §12 Import, §14 "CSV column guess"): whether row 1 is a
// header, and which column(s) hold the names. The Teacher can change both.

import { columnCount } from "./parse";

type Rows = readonly (readonly string[])[];

const NAME_HEADER = /\b(?:names?|student|students|pupil|pupils|first|last|given|forename|surname|family)\b/i;
const FIRST_HEADER = /\b(?:first|given|forename)\b/i;
const LAST_HEADER = /\b(?:last|surname|family)\b/i;
const FULL_HEADER = /\bnames?\b/i;
const STUDENT_HEADER = /\b(?:students?|pupils?)\b/i;

/** A cell that is a number, a date or an id like "00123" rather than a name. */
function isNumeric(cell: string): boolean {
  return /^[\d\s.,:/\\#+-]+$/.test(cell.trim());
}

/** Whether row 1 looks like a header: one of its cells reads like "Name", "Student", "First"… */
export function guessHeaderRow(rows: Rows): boolean {
  return (rows[0] ?? []).some((cell) => NAME_HEADER.test(cell));
}

/** Whether most of a column's non-empty data cells are words, not numbers. */
function isTextColumn(rows: Rows, column: number): boolean {
  const cells = rows.map((r) => (r[column] ?? "").trim()).filter((c) => c !== "");
  if (cells.length === 0) return false;
  return cells.filter((c) => !isNumeric(c)).length * 2 > cells.length;
}

/**
 * The likely name column(s), in column order. With a header: First + Last name columns when there is
 * a "First" one, else the first "Name" column, else the first "Student" column (only text columns
 * count, so "Student ID" is passed over). Otherwise, or if no header matches, the column with the
 * most distinct non-numeric values (the leftmost on a tie). Empty only for an empty table.
 */
export function guessNameColumns(rows: Rows, header: boolean): number[] {
  const width = columnCount(rows);
  const data = header ? rows.slice(1) : rows;
  const columns = Array.from({ length: width }, (_, i) => i);
  if (header) {
    const head = rows[0] ?? [];
    const text = columns.filter((c) => isTextColumn(data, c));
    const find = (pattern: RegExp) => text.find((c) => pattern.test(head[c] ?? ""));
    const first = find(FIRST_HEADER);
    if (first !== undefined) {
      const last = find(LAST_HEADER);
      return last === undefined ? [first] : [first, last].sort((a, b) => a - b);
    }
    const full = find(FULL_HEADER) ?? find(STUDENT_HEADER) ?? find(LAST_HEADER);
    if (full !== undefined) return [full];
  }
  let best: number | undefined;
  let bestCount = -1;
  for (const c of columns) {
    const distinct = new Set(
      data.map((r) => (r[c] ?? "").trim().toLowerCase()).filter((cell) => cell !== "" && !isNumeric(cell)),
    ).size;
    if (distinct > bestCount) {
      best = c;
      bestCount = distinct;
    }
  }
  return best === undefined ? [] : [best];
}
