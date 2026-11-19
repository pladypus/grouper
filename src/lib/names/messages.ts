// User-facing sentences about names, kept here so the UI shows the same words everywhere.

/** SPEC §3: refusal when a Student's name is already on the Roster. */
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
