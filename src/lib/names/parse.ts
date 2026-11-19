// The list parser shared by Add names (SPEC §11) and list Import (SPEC §12): turns pasted text or a
// .txt/.csv file into either plain lines (one name per line) or a table for the column picker.

import { normaliseName } from "./key";

/** Lines longer than this (after cleanup) are flagged "looks like a sentence?" but kept. */
export const LONG_NAME_LENGTH = 40;

/** A leading list marker: `1.`, `2)`, `-`, `*` or `•`, and any spaces after it. */
const LIST_MARKER = /^(?:\d{1,3}[.)]|[-*•])\s*/;

/** One line as a name: trimmed, inner spaces collapsed, a leading list marker removed. "" if nothing is left. */
export function cleanNameLine(line: string): string {
  return normaliseName(normaliseName(line).replace(LIST_MARKER, ""));
}

/** Whether a cleaned name is long enough to look like a sentence rather than a name. */
export function looksLikeSentence(name: string): boolean {
  return name.length > LONG_NAME_LENGTH;
}

/**
 * What a paste or file holds:
 * - `lines`: one name per line (commas stay inside names, so "Smith, Ana" is one line);
 * - `table`: rows of cells, from tabbed text or a .csv, for the column picker.
 */
export type NameSource =
  | { readonly kind: "lines"; readonly lines: readonly string[] }
  | { readonly kind: "table"; readonly rows: readonly (readonly string[])[] };

/** Splits text into lines (any line ending), without the empty line after a final newline. */
export function splitLines(text: string): string[] {
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > 0 && lines.at(-1) === "") lines.pop();
  return lines;
}

/** Whether a file name is a .csv (case-insensitive). */
export function isCsvFileName(fileName: string | undefined): boolean {
  return !!fileName && /\.csv$/i.test(fileName.trim());
}

/**
 * Reads pasted text or a file's text. Text with a tab is a table split on tabs; a .csv file is a
 * table split on commas (or semicolons, if its first line has more of those); anything else is
 * plain lines.
 */
export function readNameSource(text: string, fileName?: string): NameSource {
  // A spreadsheet export often starts with a byte-order mark.
  const clean = text.replace(/^﻿/, "");
  if (clean.includes("\t")) return { kind: "table", rows: parseDelimited(clean, "\t") };
  if (isCsvFileName(fileName)) {
    const first = splitLines(clean)[0] ?? "";
    const delimiter = count(first, ";") > count(first, ",") ? ";" : ",";
    return { kind: "table", rows: parseDelimited(clean, delimiter) };
  }
  return { kind: "lines", lines: splitLines(clean) };
}

function count(text: string, char: string): number {
  return text.split(char).length - 1;
}

/**
 * Splits delimited text into rows of cells. Cells in double quotes may hold the delimiter, line
 * breaks and doubled quotes (`""`), as spreadsheets write them. Cells are not trimmed. Rows may have
 * different lengths; a final newline doesn't make an empty row.
 */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let atCellStart = true;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
      continue;
    }
    if (c === '"' && atCellStart) {
      quoted = true;
      atCellStart = false;
    } else if (c === delimiter) {
      row.push(cell);
      cell = "";
      atCellStart = true;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      atCellStart = true;
    } else {
      cell += c;
      atCellStart = false;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** The number of columns in a table: its longest row. */
export function columnCount(rows: readonly (readonly string[])[]): number {
  return rows.reduce((n, row) => Math.max(n, row.length), 0);
}

/**
 * A table's names, one line per data row: the ticked columns' cells (in column order) joined with a
 * space. Row 1 is left out when it is a header. A row with nothing in those columns becomes a blank line.
 */
export function linesFromTable(
  rows: readonly (readonly string[])[],
  columns: readonly number[],
  header: boolean,
): string[] {
  const picked = [...new Set(columns)].sort((a, b) => a - b);
  return rows.slice(header ? 1 : 0).map((row) => picked.map((c) => row[c] ?? "").join(" "));
}
