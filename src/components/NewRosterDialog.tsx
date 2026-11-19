import { PASTE_CLASS_LIST_LABEL } from "../lib";
import { useId, useState } from "react";
import { AddNamesFields } from "./AddNamesFields";
import { buttonClass, Modal, primaryClass } from "./Dialog";
import { useNameList } from "./useNameList";

export interface NewRosterDialogProps {
  /**
   * Makes the Roster with the ticked names (none when the box is empty). Returns a refusal to show
   * under the name ("There's already a Roster called…"), or null when it was made.
   */
  onCreate: (name: string, names: readonly string[]) => string | null;
  onClose: () => void;
}

const NO_STUDENTS: readonly { name: string }[] = [];

/**
 * SPEC §8 New Roster dialog: the Roster name and an optional "Paste your class list" box (or a
 * dropped/chosen .txt/.csv). Empty box → an empty Roster; filled → the Add names preview, then Create.
 */
export function NewRosterDialog({ onCreate, onClose }: NewRosterDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const list = useNameList(NO_STUDENTS);
  const inputId = useId();
  const errorId = useId();
  return (
    <Modal title="New Roster" onClose={onClose} wide={list.filled}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const refusal = onCreate(name, list.filled ? list.chosen : []);
          if (refusal) setError(refusal);
          else onClose();
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
        <div className="mt-3">
          <AddNamesFields list={list} label={`${PASTE_CLASS_LIST_LABEL} (optional)`} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={buttonClass} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={primaryClass}>
            Create
          </button>
        </div>
      </form>
    </Modal>
  );
}
