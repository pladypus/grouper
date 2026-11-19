// Name key and display-name normalisation (spec: domain-model.md#student-7).
// Two names with the same key are the same Student. Roster names are compared the same way.

/** A name as it is shown: trimmed, with each run of whitespace collapsed to one space. Case is kept. */
export function normaliseName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** The comparison key for a name: normalised and lower-cased. "  sam  " and "Sam" share a key. */
export function nameKey(raw: string): string {
  return normaliseName(raw).toLowerCase();
}

/** Whether two names are the same name, ignoring case and spacing. */
export function sameName(a: string, b: string): boolean {
  return nameKey(a) === nameKey(b);
}

/**
 * Finds the first item whose name has the same key as `raw`, skipping the item whose id is
 * `exceptId` (so renaming something to a re-cased version of its own name is allowed).
 */
export function findByName<T extends { id: string; name: string }>(
  items: readonly T[],
  raw: string,
  exceptId?: string,
): T | undefined {
  const key = nameKey(raw);
  return items.find((item) => item.id !== exceptId && nameKey(item.name) === key);
}
