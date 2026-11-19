import { columnCount, HEADER_ROW_LABEL, NO_COLUMN_MESSAGE, PICK_COLUMNS_MESSAGE } from "../lib";
import { useId } from "react";

export interface ColumnPickerProps {
  /** The table's rows, as read by readNameSource. */
  rows: readonly (readonly string[])[];
  /** Ticked column indexes (several are joined with a space). */
  columns: readonly number[];
  /** Whether row 1 is a header (left out of the names). */
  header: boolean;
  onColumnsChange: (columns: number[]) => void;
  onHeaderChange: (header: boolean) => void;
  /** How many rows to show in the sample table (default 5, plus the header). */
  sampleRows?: number;
}

/**
 * SPEC §12 column picker, for tabbed text or a .csv: a sample of the table with a checkbox above each
 * column, and "Row 1 is a header". Controlled; `useNameList` makes the first guess.
 */
export function ColumnPicker({ rows, columns, header, onColumnsChange, onHeaderChange, sampleRows = 5 }: ColumnPickerProps) {
  const headerId = useId();
  const width = columnCount(rows);
  const head = header ? (rows[0] ?? []) : [];
  const sample = rows.slice(header ? 1 : 0, (header ? 1 : 0) + sampleRows);
  const ticked = new Set(columns);
  const columnName = (c: number) => head[c]?.trim() || `Column ${c + 1}`;
  const toggle = (c: number) =>
    onColumnsChange(ticked.has(c) ? columns.filter((x) => x !== c) : [...columns, c].sort((a, b) => a - b));

  return (
    <fieldset className="my-2.5 min-w-0 rounded-lg border border-line p-2.5">
      <legend className="px-1 text-sm font-semibold">Name columns</legend>
      <p className="mb-2 text-sm text-mute">{PICK_COLUMNS_MESSAGE}</p>
      <label htmlFor={headerId} className="mb-2 flex items-center gap-2 text-sm">
        <input id={headerId} type="checkbox" checked={header} onChange={(e) => onHeaderChange(e.target.checked)} />
        {HEADER_ROW_LABEL}
      </label>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {Array.from({ length: width }, (_, c) => (
                <th
                  key={c}
                  scope="col"
                  className={`border border-line px-2 py-1 text-left font-semibold ${ticked.has(c) ? "bg-accent-soft" : ""}`}
                >
                  <label className="flex items-center gap-1.5 whitespace-nowrap">
                    <input type="checkbox" checked={ticked.has(c)} onChange={() => toggle(c)} />
                    {columnName(c)}
                  </label>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sample.map((row, r) => (
              <tr key={r}>
                {Array.from({ length: width }, (_, c) => (
                  <td
                    key={c}
                    className={`max-w-40 truncate border border-line px-2 py-1 ${ticked.has(c) ? "bg-accent-soft" : "text-mute"}`}
                  >
                    {row[c] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {columns.length === 0 && (
        <p role="alert" className="mt-2 text-sm text-bad">
          {NO_COLUMN_MESSAGE}
        </p>
      )}
    </fieldset>
  );
}
