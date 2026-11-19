import {
  guessHeaderRow,
  guessNameColumns,
  linesFromTable,
  previewNames,
  readNameSource,
  type NamePreview,
  type NameSource,
} from "../lib";
import { useMemo, useState } from "react";

type Rows = readonly (readonly string[])[];

/** The column picker's state for a table (SPEC §12): pass it straight to <ColumnPicker {...table} />. */
export interface TableChoice {
  readonly rows: Rows;
  /** Ticked column indexes, in column order. */
  readonly columns: readonly number[];
  readonly header: boolean;
  readonly onColumnsChange: (columns: number[]) => void;
  readonly onHeaderChange: (header: boolean) => void;
}

export interface NameList {
  /** The paste box's text (a dropped or chosen file's text lands here too). */
  readonly text: string;
  /** The dropped or chosen file's name, kept while its text is in the box (a .csv reads as a table). */
  readonly fileName: string | undefined;
  /** Typing passes no file name (keeping the file's, while there is text); a file passes its own. */
  readonly setText: (text: string, fileName?: string) => void;
  /** The column picker's state when the text is a table (tabs, or a .csv), else null. */
  readonly table: TableChoice | null;
  /** Pass to <AddNamesPreview preview unticked onToggle />. */
  readonly preview: NamePreview;
  readonly unticked: ReadonlySet<string>;
  readonly onToggle: (key: string) => void;
  /** The ticked names to add, in list order. */
  readonly chosen: string[];
  /** Whether there is anything in the box at all. */
  readonly filled: boolean;
}

/**
 * Add names state shared by the Students drawer, the New Roster dialog and list Import:
 * text → lines or table → column choice → preview → ticked names. `existing` is the Roster's
 * Students (or [] for a new Roster), so names already on it are skipped.
 */
export function useNameList(existing: readonly { name: string }[], initial?: { text: string; fileName?: string }): NameList {
  const [text, setTextState] = useState(initial?.text ?? "");
  const [fileName, setFileName] = useState<string | undefined>(initial?.fileName);
  // The Teacher's column choice, remembered for one table shape; a different table is guessed afresh.
  const [choice, setChoice] = useState<{ shape: string; columns: number[]; header: boolean } | null>(null);
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(() => new Set());

  const source: NameSource = useMemo(() => readNameSource(text, fileName), [text, fileName]);

  let table: TableChoice | null = null;
  let lines: readonly string[];
  if (source.kind === "table") {
    const { rows } = source;
    const shape = JSON.stringify(rows[0] ?? []);
    let current = choice?.shape === shape ? choice : null;
    if (!current) {
      const header = guessHeaderRow(rows);
      current = { shape, header, columns: guessNameColumns(rows, header) };
    }
    const { columns, header } = current;
    table = {
      rows,
      columns,
      header,
      onColumnsChange: (next) => setChoice({ shape, header, columns: [...next].sort((a, b) => a - b) }),
      onHeaderChange: (next) => setChoice({ shape, header: next, columns }),
    };
    lines = linesFromTable(rows, columns, header);
  } else {
    lines = source.lines;
  }

  const preview = previewNames(lines, existing);

  return {
    text,
    fileName,
    setText(next, file) {
      setTextState(next);
      setFileName((old) => file ?? (next.trim() === "" ? undefined : old));
    },
    table,
    preview,
    unticked,
    onToggle(key) {
      setUnticked((old) => {
        const next = new Set(old);
        if (!next.delete(key)) next.add(key);
        return next;
      });
    },
    chosen: preview.names.filter((n) => !unticked.has(n.key)).map((n) => n.name),
    filled: text.trim() !== "",
  };
}
