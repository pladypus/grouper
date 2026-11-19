// User-facing sentences about names, kept here so the UI shows the same words everywhere.

/** spec: domain-model.md: refusal when a Student's name is already on the Roster. */
export function duplicateStudentMessage(name: string): string {
  return `There's already a ${name} on this Roster. Tell them apart with something like "${name} B.".`;
}

/** Refusal when a Roster name is already taken in this browser. */
export function duplicateRosterMessage(name: string): string {
  return `There's already a Roster called "${name}". Choose a different name.`;
}

/** Refusal when a Student's name is empty after trimming. */
export const EMPTY_STUDENT_NAME_MESSAGE = "Type the Student's name.";

/** Refusal when a Roster name is empty after trimming. */
export const EMPTY_ROSTER_NAME_MESSAGE = "Type a name for the Roster.";

// ---------------------------------------------------------------------------------------------
// Add names (spec: add-names.md) and the column picker (spec: export-import.md)

/** The flag beside a line over 40 characters. */
export const LOOKS_LIKE_SENTENCE_MESSAGE = "looks like a sentence?";

/** The New Roster dialog's optional box (spec: screens.md#new-roster-dialog-10). */
export const PASTE_CLASS_LIST_LABEL = "Paste your class list";

/** The Students drawer's box. */
export const PASTE_NAMES_LABEL = "Paste names";

/** The hint under a paste box. */
export const PASTE_HINT = "One name per line. You can also drop a .txt or .csv file here.";

/** The column picker's header-row checkbox. */
export const HEADER_ROW_LABEL = "Row 1 is a header";

/** The column picker's instruction. */
export const PICK_COLUMNS_MESSAGE =
  "Tick the column with the names. Tick two (like first and last name) to join them with a space.";

/** Shown when no column is ticked. */
export const NO_COLUMN_MESSAGE = "Tick at least one column.";

/** A file that couldn't be read as text. */
export const UNREADABLE_FILE_MESSAGE = "That file couldn't be read. Choose a .txt or .csv file.";

function students(n: number): string {
  return `${n} ${n === 1 ? "student" : "students"}`;
}

/** The preview button: "Add 25 students" (spec: add-names.md). */
export function addNamesButtonLabel(n: number): string {
  return `Add ${students(n)}`;
}

/** Why a name was skipped, shown after the name: "Ana (already on the Roster)". */
export function skippedReasonLabel(reason: "on roster" | "repeat"): string {
  return reason === "on roster" ? "already on the Roster" : "repeated in the list";
}

/** "1 blank line" / "3 blank lines". */
export function blankLinesLabel(n: number): string {
  return `${n} blank ${n === 1 ? "line" : "lines"}`;
}

/** The toast after Add names: "Added 25 students." */
export function addedNamesMessage(n: number): string {
  return `Added ${students(n)}.`;
}
