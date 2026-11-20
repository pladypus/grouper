# Lock and Manual move (#5)

## Lock
- Each Group header has a Lock toggle. A Locked Group is **frozen**: swaps into or out of it are refused with a toast ("Group 2 is Locked. Unlock it to move Students.").
- A flagged Group can be Locked; it keeps its warning and Reshuffle carries it over unchanged.
- The Reshuffle button shows "keeps N Locked" when any Group is Locked.

## Manual move (swap)
- Only ever a **swap** of two Students in different Groups, so sizes and the Split never change.
- **Drag:** drop a Student onto another Student. Dropping elsewhere does nothing (toast: "Drop onto a Student to swap with them.").
- **Tap-tap / keyboard:** tap (or Enter/Space on) a Student to select them: the name turns solid accent with a ✕ to cancel. Tap a Student in another Group to swap; tap the same Student, the ✕, or press Esc to cancel. Screen readers get the instruction via a live region.
- While a Student is selected or being dragged, Locked Groups fade back and swappable names show ⇄ on hover.
- **Breaking a Rule is allowed but flagged.** After every change, every unlocked and Locked Group is re-checked; a Group containing a Keep apart pair, or holding part of a Present chain whose other members are elsewhere, gets an amber outline and a warning line naming the Pair ("Ana & Ben are set to keep apart."). A later swap that undoes the break clears the flag.

## Lifecycle
- Any Roster edit (attendance, Students, Pairs) leaves the Groups on screen as they are and shows: "⚠ The Roster changed since these Groups were made, so they're out of date. [Reshuffle]". Absent or removed Students stay visible in their Group, faded, until the Reshuffle.
- Changing the Target size or the Split does not mark Groups out of date; it only affects the next Shuffle.
- Switching Roster clears the Groups.
