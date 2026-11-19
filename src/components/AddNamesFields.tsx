import { AddNamesPreview } from "./AddNamesPreview";
import { ColumnPicker } from "./ColumnPicker";
import { NameListInput } from "./NameListInput";
import type { NameList } from "./useNameList";

export interface AddNamesFieldsProps {
  /** From useNameList. */
  list: NameList;
  /** The paste box's label. */
  label: string;
  autoFocus?: boolean;
}

/**
 * The paste box, then (once it has text) the column picker for a table and the preview. The
 * submit button is the caller's: "Add N students" in the Students drawer, "Create" in New Roster.
 */
export function AddNamesFields({ list, label, autoFocus }: AddNamesFieldsProps) {
  return (
    <>
      <NameListInput label={label} value={list.text} fileName={list.fileName} onChange={list.setText} autoFocus={autoFocus} />
      {list.table && <ColumnPicker {...list.table} />}
      {list.filled && <AddNamesPreview preview={list.preview} unticked={list.unticked} onToggle={list.onToggle} />}
    </>
  );
}
