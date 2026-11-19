import { EMPTY_ROSTER_NAME_MESSAGE, IMPORT_LIST_TITLE, importListButtonLabel, normaliseName } from "../lib";
import { useId, useState } from "react";
import { AddNamesPreview } from "./AddNamesPreview";
import { ColumnPicker } from "./ColumnPicker";
import { buttonClass, Modal, primaryClass } from "./Dialog";
import { useNameList } from "./useNameList";

export interface ImportListDialogProps {
  /** The file's text and name, from `readImportFile`'s `kind: "names"` result. */
  text: string;
  fileName: string;
  /** The default Roster name: the file name without its extension. */
  defaultName: string;
  /** The Roster name and the ticked names; the caller adds them (asking about a name clash). */
  onImport: (name: string, names: readonly string[]) => void;
  onClose: () => void;
}

const NO_STUDENTS: readonly { name: string }[] = [];

/**
 * SPEC §12 Import item 3, the confirm step for a .txt / .csv list: the Roster name (defaulting to
 * the file name, editable), the column picker for a table, and the Add names preview.
 */
export function ImportListDialog({ text, fileName, defaultName, onImport, onClose }: ImportListDialogProps) {
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);
  const list = useNameList(NO_STUDENTS, { text, fileName });
  const count = list.chosen.length;
  const inputId = useId();
  const errorId = useId();
  return (
    <Modal title={IMPORT_LIST_TITLE} onClose={onClose} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (normaliseName(name) === "") setError(EMPTY_ROSTER_NAME_MESSAGE);
          else if (count > 0) onImport(name, list.chosen);
        }}
      >
        <label htmlFor={inputId} className="mb-1 block text-sm font-semibold">
          Roster name
        </label>
        <input
          id={inputId}
          value={name}
          autoFocus
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
          className="w-full rounded-md border border-line bg-field px-2 py-1.5"
        />
        {error && (
          <p id={errorId} role="alert" className="mt-2 rounded-md border border-bad-line bg-bad-soft px-2.5 py-1.5 text-bad">
            {error}
          </p>
        )}
        {list.table && <ColumnPicker {...list.table} />}
        <AddNamesPreview preview={list.preview} unticked={list.unticked} onToggle={list.onToggle} />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={buttonClass} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={count === 0} className={primaryClass}>
            {importListButtonLabel(count)}
          </button>
        </div>
      </form>
    </Modal>
  );
}
