# Export and Import (#7)

## Files

**Export** (one Roster, for handing to another Teacher): `<Roster name>.grouper.json`
```json
{
  "grouper": "roster",
  "version": 1,
  "name": "Period 2",
  "exported": "2026-11-18T09:30:00.000Z",
  "students": ["Ana", "Ben", "Sam B."],
  "pairs": [
    { "type": "good pair", "students": ["Ana", "Ben"] },
    { "type": "keep apart", "students": ["Ana", "Sam B."] }
  ]
}
```

**Backup** ("Export all Rosters"): `grouper-backup-YYYY-MM-DD.json`
```json
{ "grouper": "backup", "version": 1, "exported": "…", "rosters": [ { "name": "…", "students": [], "pairs": [] } ] }
```

Neither holds attendance, Target size, Groups or Locks. Pairs refer to Students by name. Files are written as pretty-printed JSON via Blob + `<a download>`.

## Import
Via `<input type=file accept=".json,.txt,.csv">` from the ⋯ menu. Always **adds** Rosters; never overwrites without asking.

1. **Roster file** → adds one Roster.
2. **Backup file** → adds every Roster in it.
3. **.txt / .csv name list** → one new Roster:
   - .txt: one name per line (the [Add names](add-names.md) parser).
   - .csv (or tabbed text): a preview table; the Teacher ticks the name column(s) (several are joined with a space, e.g. First + Last) and says whether row 1 is a header. The app pre-ticks a likely column: a header matching `name`, `student`, `first`, `last` (case-insensitive), else the column with the most distinct non-numeric values. (This **CSV column guess** heuristic is a choice, cheap to change.)
   - Confirm step: the resulting names (the [Add names](add-names.md) preview) and the Roster name, defaulting to the filename without its extension, editable.

**Roster name clash:** the Teacher chooses **Replace** or **Keep both** (saved as "<name> (imported)", then "(imported 2)" …). For a Backup, one question covers every clash.

**Versions:** older `version`s are upgraded on Import. A newer version is refused: "This file was made by a newer Grouper; reload the page to update." Anything that is neither a grouper file nor a .txt/.csv list is refused: "That file isn't a Grouper file or a list of names." (The exact refusal wording is a choice, cheap to change.)

**Lenient, but nothing dropped silently:**
- A repeated name (by name key) is kept once, and Pairs point at that Student.
- A Pair naming a Student not on the Roster, repeating another Pair, or contradicting the Pairs accepted so far (the [Domain model](domain-model.md#pair-rule-4-6) entry check, in file order) is dropped.
- After Import, a message lists everything skipped. Accepted consequence: two real "Sam"s merge into one and are reported; the Teacher re-adds the second as "Sam B.".
- Imported Students all start Present. Pair `created` order follows file order.

Toast on success: "Imported "Period 2": 25 Students, 5 pairs."
