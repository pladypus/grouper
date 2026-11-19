# Domain model

## Roster
- `id` (generated), `name` (non-empty, trimmed; unique among this browser's Rosters, compared like Student names), `students`, `pairs`, plus browser-only state: each Student's attendance, the Target size, and the creation clock for Pairs.

## Student (#7)
- `id` (generated, internal), `name` as first typed (trimmed, inner spaces collapsed), `present` (boolean).
- **Name key**: lower-case, trimmed, runs of whitespace collapsed to one space. Two names with the same key are the same Student. Adding a duplicate is refused: "There's already a Sam on this Roster. Tell them apart with something like "Sam B."."
- New Students (typed, Added, or Imported) start Present.
- Removing a Student also removes their Pairs, with an Undo notice ("Removed Sam and 2 pairs. Undo").
- Renaming is allowed in Edit list, under the same uniqueness rule.

## Pair (Rule) (#4, #6)
- `id`, `type`: `good pair` | `keep apart`, two different Student ids, `created` (monotonic counter used for blame order).
- At most one Pair per two Students. Entering a second is refused: "That pair already exists." or "Ana & Ben are already a Keep apart pair. Delete it first."
- **Chains:** Good pairs that share a Student chain together (union-find over Good pairs). A chain is computed from all of the Roster's Good pairs, then narrowed to Present members for a Shuffle; Absent members never break it.
- **Contradictions are refused on entry**, so a Roster never holds self-contradicting Rules. A new Pair is refused if, after adding it, any Keep apart pair has both Students in one chain:
  - adding Keep apart: "Ana and Eli are linked by Good pairs (Ana & Dee, Dee & Eli), so they can't be kept apart."
  - adding a Good pair: "This Good pair would put Ana and Ben together, but they're set to keep apart."

## Target size, Split, Leftovers (#4, #6)
- Target size is an integer ≥ 2, shown as "Number of students in group". Default 4.
- **Target size is saved per Roster** in the browser, default 4. A hand-edited Split is not saved; it lasts until the Present count changes or the page reloads (choice, cheap to change).
- **Derived Split** for `n` Present Students (n ≥ 2) and Target size `t`:
  - if `n < t`: one Group of `n`;
  - else `g = floor(n / t)` Groups of `t`, and the `n mod t` Leftovers are added one each to Groups in turn (round-robin), so Groups only ever grow.
  - Examples: 25 at 4 → 5×4 + 1×5. 25 at 2 → 11×2 + 1×3. 27 at 4 → 3×4 + 3×5. 7 at 5 → 1×7.
  - **Leftover distribution** is round-robin, one per Group (27 at 4 → 3×4 + 3×5), and fewer Present than the Target size makes one Group of everyone (choice, cheap to change).
- The Split is shown in words beside the stepper: "2 groups of 4, 3 groups of 5". Smallest size first.
- **Editing the Split** ("Edit" link): the Teacher types sizes ("4, 4, 5, 5"). Refused with a message if any size is not a whole number ≥ 1 ("Use whole numbers, e.g. 4, 4, 5."), any size is 1 ("A group of 1 isn't allowed."), or the sum isn't the Present count ("Those sizes add up to 24, but 25 Students are Present.").
- With fewer than 2 Present Students there is no Split and Shuffle is disabled ("Mark at least 2 students Present.").
- **Oversize chain warning:** whenever a Present chain is bigger than the Target size, a warning shows on the board as soon as it applies: "Ana, Ben and Cal are joined by Good pairs (3 students), but the number in each group is 2." Shuffle stays enabled and reports the Conflict.

## Group (#5)
- An ordered list of Groups, each with `members` (Student ids), `size` (fixed at creation), `locked` (boolean), and a stable colour.
- Groups and Locks are **temporary**: in memory only, gone on reload, never saved or exported.
