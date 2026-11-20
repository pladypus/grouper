# Storage and keeping data safe (#3, #8)

| Key | Value |
|---|---|
| `grouper:roster:<id>` | One Roster: `{id, name, students:[{id, name, present}], pairs:[{id, type, a, b, created}], target, pairClock}`. `pairClock` is the Roster's creation clock for Pairs (the next Pair's `created`), so deleting the newest Pair never reuses its number; a save without it loads with the clock one past the highest `created`. |
| `grouper:order` | Array of Roster ids in picker order |
| `grouper:current` | Id of the Roster last open |
| `grouper:theme` | `auto` \| `light` \| `dark` |
| `grouper:ios-tip-dismissed` | `1` once dismissed |
| `grouper:schema` | Storage schema version (`1`), for future migrations |

- **Attendance is saved in the browser** with the Roster (so a reload doesn't lose the roll), but never exported.
- Every read and write is wrapped in try/catch. If storage is unavailable or full, the app still works for the session and shows a notice: "This browser isn't saving your Rosters. Use Export all Rosters before you close the page."
- Saves happen on every change.
- The first time a Roster is saved, call `navigator.storage.persist()` silently and ignore the result.
- **No** Backup reminders and no "last backup" indicator. Export all Rosters is simply available.
- On iOS, a Home Screen app's storage is separate from Safari's; Teachers move Rosters with Backup and Import. No special UI for this.
