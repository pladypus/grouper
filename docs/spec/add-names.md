# Add names (#10)

Adds many Students to a Roster at once. Reached from **Add names** in the Students drawer and from the New Roster dialog's paste box. Both accept pasted text or a dropped/chosen .txt or .csv. Shares its parser and preview with list Import ([Export and Import](export-import.md)).

**Parsing** (`names/parse.ts` in core):
- One name per line. Commas stay inside a name ("Smith, Ana" is one Student) for pasted text and .txt.
- If the text has tabs, or the file is .csv, show the **column picker** ([Export and Import](export-import.md#import)).
- Cleanup: trim, collapse inner spaces, drop blank lines, strip a leading list marker (`1.`, `2)`, `-`, `*`, `•`).
- Lines over 40 characters are flagged "looks like a sentence?" but kept.

**Preview:**
- A checkbox per name, ticked by default (flagged ones too). Unticked names are left out.
- A "Skipped" list: names already on the Roster, repeats within the paste, blank lines.
- Button: **Add N students** (or **Create** in New Roster).

**Duplicates:** compared by name key. A name already on the Roster is skipped and that Student is untouched; a repeat within the paste is added once. Re-pasting a whole class to add late joiners just works.

New Students start Present; Groups on screen go out of date.
