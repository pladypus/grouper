# Grouper: build spec

Grouper is a static website where a Teacher keeps class Rosters and Shuffles the Present Students into random Groups that obey every Rule. This spec collects every decision from the [planning map](https://github.com/pladypus/grouper/issues/1) so the site can be built with nothing left to decide.

Capitalised terms (Roster, Student, Present, Group, Target size, Split, Leftovers, Good pair, Keep apart, Conflict, Shuffle, Lock, Manual move, Export, Backup, Import, Add names) mean exactly what [GLOSSARY.md](GLOSSARY.md) says. UI labels the Teacher sees are in "quotes".

Each section cites the ticket it comes from. A few small gaps no ticket covered are filled in [Choices made while writing this spec](#14-choices-made-while-writing-this-spec); everything there is cheap to change.

---

## 1. Product in one paragraph

A Teacher opens https://grouper.pladypus.dev, picks a Roster ("Period 2"), takes the roll, sets "Number of students in group", and presses Shuffle. Colour-coded Group cards fill the screen, big enough to read on a projector. The Teacher can Lock Groups they like and Reshuffle the rest, swap two Students by hand, and Share the result as a picture, text, or printout. Rosters live only in the Teacher's browser; Export, Backup, and Import move them between browsers and Teachers.

**Users:** the owner plus a few colleagues. No accounts, no server, no sync.

**Out of scope:** avoiding repeat groupings across sessions (grouping history); shared or server-side data, accounts, sync; soft or preference Rules (every Rule is strict).

---

## 2. Stack and hosting (#3, #8, #11)

| Concern | Decision |
|---|---|
| Framework | **React 19**, picked by a bake-off ([below](#framework-bake-off), [ADR 0001](docs/adr/0001-react.md)). A plain Vite single-page app (no Next), TypeScript. |
| State | No state library: `useReducer` + context (`src/state.tsx`). The domain operations (shuffle, swap, lock, Pair checks) are pure functions in core (`src/lib/`) that the reducer calls. |
| Styling | Tailwind v4 via `@tailwindcss/vite`. The prototype's theme tokens become `@theme` variables (light and dark); Group hues are set per card as CSS custom properties. The print layout uses `print:` variants. |
| Icons | Lucide (`lucide-react`). |
| Drag and drop | dnd-kit (`@dnd-kit/core`), on mouse and touch. App state owns Group membership; a drop is turned into a swap, and the library never reorders lists by itself. Tap-to-swap is the fallback. |
| Storage | `localStorage`, JSON, all keys prefixed `grouper:` (see [§10](#10-storage-and-keeping-data-safe-8)). |
| Offline | Web app manifest + icon, and a service worker that precaches the built app (`vite-plugin-pwa`, `registerType: 'autoUpdate'`). New versions take effect on the next launch, with no update prompt. |
| Solver | Hand-written, dependency-free, runs synchronously on the main thread (no Web Worker). |
| Tests | Vitest. Core logic gets unit tests; UI gets component tests with Testing Library in jsdom (`@testing-library/react`). |
| Hosting | GitHub Pages from `pladypus/grouper`, Pages source = GitHub Actions, custom domain `grouper.pladypus.dev` (so Vite `base: '/'`). |

### Framework bake-off

Research #3 chose Svelte on the assumption that the owner was a non-specialist, but the owner's other web projects are React 19 + Tailwind v4. So the first slice (#12, #14, #15, #16, #18, #19) was built twice, as `apps/react` and `apps/svelte` over a shared `packages/core` in npm workspaces, and compared in [`docs/bake-off.md`](docs/bake-off.md). The owner picked React (#26, [ADR 0001](docs/adr/0001-react.md)), the Svelte app was deleted, and the repo was flattened to one Vite app at the root ([§13](#13-suggested-module-layout)). Everything after the pick (#17, #20–#25) is built once.

### Repo upkeep (copied from the owner's `mortgage-calculator` repo when the build starts)

- `.github/dependabot.yml`: monthly npm + GitHub Actions updates, 7-day cooldown, grouped.
- `verify.yml`: on pull requests, job `test-and-build` runs `npm ci`, `npm test`, `npm run build`.
- `deploy.yml`: Vite's documented Pages workflow (checkout → setup-node → `npm ci` → `npm run build` → configure-pages → upload-pages-artifact `./dist` → deploy-pages), with `npm test` before the build so a broken main can't deploy. Triggers are only:

  ```yaml
  on:
    push:
      branches: [main]
    workflow_dispatch:
  ```

  No schedule, no keepalive.
- `dependabot-auto-merge.yml`: `gh pr merge --auto --squash`, then a step that waits for the merge and dispatches the deploy, because a merge made with `GITHUB_TOKEN` fires no `push` run but `workflow_dispatch` is exempt:

  ```yaml
  permissions:
    contents: write
    pull-requests: write
    actions: write # gh workflow run

  concurrency:
    group: dependabot-auto-merge-${{ github.event.pull_request.number }}
    cancel-in-progress: true

  # job has timeout-minutes: 30; after the gh pr merge --auto --squash step:
        - name: Deploy once merged
          run: |
            while :; do
              case "$(gh pr view "$PR_URL" --json state --jq .state)" in
                MERGED) exec gh workflow run deploy.yml --ref main ;;
                CLOSED) echo "PR closed without merging"; exit 0 ;;
              esac
              sleep 30
            done
          env:
            PR_URL: ${{ github.event.pull_request.html_url }}
            GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  ```
- A `main` ruleset requiring squash-merged PRs and the `test-and-build` check, switched on once planning stops committing straight to `main`. Repo settings (auto-merge, delete merged branches) are already on.

---

## 3. Domain model

### Roster
- `id` (generated), `name` (non-empty, trimmed; unique among this browser's Rosters, compared like Student names), `students`, `pairs`, plus browser-only state: each Student's attendance, the Target size, and the creation clock for Pairs.

### Student (#7)
- `id` (generated, internal), `name` as first typed (trimmed, inner spaces collapsed), `present` (boolean).
- **Name key**: lower-case, trimmed, runs of whitespace collapsed to one space. Two names with the same key are the same Student. Adding a duplicate is refused: "There's already a Sam on this Roster. Tell them apart with something like "Sam B."."
- New Students (typed, Added, or Imported) start Present.
- Removing a Student also removes their Pairs, with an Undo notice ("Removed Sam and 2 pairs. Undo").
- Renaming is allowed in Edit list, under the same uniqueness rule.

### Pair (Rule) (#4, #6)
- `id`, `type`: `good pair` | `keep apart`, two different Student ids, `created` (monotonic counter used for blame order).
- At most one Pair per two Students. Entering a second is refused: "That pair already exists." or "Ana & Ben are already a Keep apart pair. Delete it first."
- **Chains:** Good pairs that share a Student chain together (union-find over Good pairs). A chain is computed from all of the Roster's Good pairs, then narrowed to Present members for a Shuffle; Absent members never break it.
- **Contradictions are refused on entry**, so a Roster never holds self-contradicting Rules. A new Pair is refused if, after adding it, any Keep apart pair has both Students in one chain:
  - adding Keep apart: "Ana and Eli are linked by Good pairs (Ana & Dee, Dee & Eli), so they can't be kept apart."
  - adding a Good pair: "This Good pair would put Ana and Ben together, but they're set to keep apart."

### Target size, Split, Leftovers (#4, #6)
- Target size is an integer ≥ 2, shown as "Number of students in group". Default 4.
- **Derived Split** for `n` Present Students (n ≥ 2) and Target size `t`:
  - if `n < t`: one Group of `n`;
  - else `g = floor(n / t)` Groups of `t`, and the `n mod t` Leftovers are added one each to Groups in turn (round-robin), so Groups only ever grow.
  - Examples: 25 at 4 → 5×4 + 1×5. 25 at 2 → 11×2 + 1×3. 27 at 4 → 3×4 + 3×5. 7 at 5 → 1×7.
- The Split is shown in words beside the stepper: "2 groups of 4, 3 groups of 5". Smallest size first.
- **Editing the Split** ("Edit" link): the Teacher types sizes ("4, 4, 5, 5"). Refused with a message if any size is not a whole number ≥ 1 ("Use whole numbers, e.g. 4, 4, 5."), any size is 1 ("A group of 1 isn't allowed."), or the sum isn't the Present count ("Those sizes add up to 24, but 25 Students are Present.").
- With fewer than 2 Present Students there is no Split and Shuffle is disabled ("Mark at least 2 students Present.").
- **Oversize chain warning:** whenever a Present chain is bigger than the Target size, a warning shows on the board as soon as it applies: "Ana, Ben and Cal are joined by Good pairs (3 students), but the number in each group is 2." Shuffle stays enabled and reports the Conflict.

### Group (#5)
- An ordered list of Groups, each with `members` (Student ids), `size` (fixed at creation), `locked` (boolean), and a stable colour.
- Groups and Locks are **temporary**: in memory only, gone on reload, never saved or exported.

---

## 4. Shuffle rules (#2, #4, #5)

A Shuffle (first time) or Reshuffle (Groups exist) produces Groups that satisfy **every** Rule among Present Students, or reports a Conflict and leaves the screen's Groups unchanged.

Inputs: Present Students, the Roster's Pairs, the Target size, the Teacher's edited Split (if any), and the current Locked Groups.

1. **Locks first.**
   - Drop Absent or deleted Students from each Locked Group. If a Locked Group would be left with one Student, release that Lock and put the Student back in the pool. Toast: "Lock released: Ana would have been alone in a Locked Group."
   - Locked Groups keep their members and size exactly.
2. **Split for the rest.** The free pool is every Present Student not in a Locked Group.
   - With no Locks, use the Teacher's edited Split if there is one and it still sums to the Present count; otherwise the derived Split.
   - With Locks, re-derive the Split for the free pool from the Target size (a hand-edited Split is redone for the unlocked part).
   - A free pool of exactly 1 Student is a Conflict ("Only Ana is left outside the Locked Groups, and a group of 1 isn't allowed. Unlock a Group or mark someone else Present."). A free pool of 0 is fine.
3. **Rules across Locks.**
   - Keep apart: a free Student is never placed in a Locked Group (automatic, since Locked Groups don't change), so these always hold.
   - A chain with some Present members Locked and some free is a Conflict naming the Lock and the chain ("Ana is in Locked Group 2, but Dee, linked to Ana by a Good pair, isn't. Unlock Group 2 or delete the pair.").
   - A Rule broken *inside* or *between* Locked Groups (a flagged Group the Teacher Locked) is carried over unchanged, still flagged. It is not a Conflict.
4. **Solve** the free pool into the free Split with the solver ([§5](#5-solver)).
5. **Result.** Locked Groups keep their place and colour; new Groups fill the remaining positions in order. Groups are numbered by position (Group 1, Group 2 …). The out-of-date notice and any Manual-move flags on unlocked Groups clear.

---

## 5. Solver (#2)

A pure module (`src/lib/solver/`), about 200 lines, no dependencies, fully unit-tested. Takes integer Student ids. Reference prototype: [`research/solver-algorithm/solver.mjs`](https://github.com/pladypus/grouper/blob/research/solver-algorithm/research/solver-algorithm/solver.mjs) on the `research/solver-algorithm` branch; findings in [`research/solver-algorithm.md`](https://github.com/pladypus/grouper/blob/research/solver-algorithm/research/solver-algorithm.md).

```ts
solve(input: {
  students: number[];                 // the free pool
  split: number[];                    // free Group sizes
  goodPairs: { id: string; a: number; b: number; created: number }[];
  keepApart: { id: string; a: number; b: number; created: number }[];
  rng?: () => number;                 // injectable for tests
}): { ok: true; groups: number[][] } | { ok: false; conflict: Conflict }
```

(Lock handling, chain-vs-Lock and lone-Leftover checks from [§4](#4-shuffle-rules-2-4-5) run in the caller before `solve`.)

1. **Preprocess.** Union-find Good pairs into blocks (only Present members). Keep apart Pairs become edges between blocks. Quick checks, each producing a structured Conflict:
   - `chain-too-big`: a block bigger than the **Target size** (not the largest Group in the Split; e.g. a chain of 3 at Target size 2 is a Conflict even when the Split has a Group of 3).
   - `apart-clique` (pigeonhole): an exact maximum clique (branch and bound) of the Keep apart block graph larger than the number of Groups.
   - `apart-inside-chain`: defensive only; entry-time refusal and Import prevent it.
2. **Find one grouping.** Complete randomized backtracking: MRV, ties by DSatur (most Keep apart edges), then larger block, then random; candidate Groups in random order; only one of several interchangeable Groups is tried (the same free seats and kept apart from the same unplaced blocks, e.g. empty Groups of the same size); forward checking both ways (every unplaced block still has a Group it fits, and every Group with free seats can still be filled), plus a pigeonhole check with sizes and a check that the unplaced block sizes can fill the free seats exactly (so chains that can't be packed are ruled out quickly); randomized restarts with node budget starting at 1000 and ×1.5 each restart, unbounded, so running out of options **proves** a Conflict.
3. **Spread.** 300 Metropolis steps: pick two different Groups, pick a random subset of blocks in each (each block with probability ½), swap the subsets if their total sizes match and no Keep apart edge breaks. This removes backtracking's bias.
4. **Explain** (only when the search proves a Conflict and no quick check fired): QuickXplain over the Pairs, with the Split as fixed background and preference order **newest Pair blamed first**. Each re-solve gets a node budget (500); running out counts as "this Pair is needed", so the result always genuinely conflicts but may occasionally not be the smallest set. No progress UI.

**Performance targets** (40 Present Students): Shuffle well under 10 ms; explanation under 10 ms with realistic Rules (≤ 40 Keep apart) and under 1 s with dense ones.

**Tests must cover:** the hand-made cases in the research table (11 mutually apart / 10 Groups; odd wheel W5 / 3 Groups; 25 at size 2 with two chains of 3; one Student apart from everyone at size 2; tight but feasible); every returned grouping satisfies every Rule and matches the Split; spread is close to uniform on small instances checked against exact enumeration (chi²/df < 2).

---

## 6. Conflicts (#4)

When a Shuffle hits a Conflict, no Groups change. The board shows a red notice:

- **A plain sentence first.** Quick checks and the [§4](#4-shuffle-rules-2-4-5) checks produce their own sentence:
  - `chain-too-big`: "Ana, Dee and Eli are joined by Good pairs, so they need a group of 3, but the number in each group is 2."
  - `apart-clique`: "These 11 students must all be kept apart, but there are only 10 groups: Ana, Ben, …"
  - chain cut by a Lock, lone Leftover: as in [§4](#4-shuffle-rules-2-4-5).
  - found by search: "No way to make 2 groups of 4 and 3 groups of 5 keeps every pair."
- **"Show the Rules involved"** expander listing the clashing Pairs (for a quick check, the Pairs behind it: the chain's Good pairs, the clique's Keep apart pairs). Each Pair links into the Pairs drawer with that Pair highlighted, to edit or delete.
- No "ignore for this Shuffle", no Rule on/off switch.

---

## 7. Lock and Manual move (#5)

### Lock
- Each Group header has a Lock toggle. A Locked Group is **frozen**: swaps into or out of it are refused with a toast ("Group 2 is Locked. Unlock it to move Students.").
- A flagged Group can be Locked; it keeps its warning and Reshuffle carries it over unchanged.
- The Reshuffle button shows "keeps N Locked" when any Group is Locked.

### Manual move (swap)
- Only ever a **swap** of two Students in different Groups, so sizes and the Split never change.
- **Drag:** drop a Student onto another Student. Dropping elsewhere does nothing (toast: "Drop onto a Student to swap with them.").
- **Tap-tap / keyboard:** tap (or Enter/Space on) a Student to select them: the name turns solid accent with a ✕ to cancel. Tap a Student in another Group to swap; tap the same Student, the ✕, or press Esc to cancel. Screen readers get the instruction via a live region.
- While a Student is selected or being dragged, Locked Groups fade back and swappable names show ⇄ on hover.
- **Breaking a Rule is allowed but flagged.** After every change, every unlocked and Locked Group is re-checked; a Group containing a Keep apart pair, or holding part of a Present chain whose other members are elsewhere, gets an amber outline and a warning line naming the Pair ("Ana & Ben are set to keep apart."). A later swap that undoes the break clears the flag.

### Lifecycle
- Any Roster edit (attendance, Students, Pairs) leaves the Groups on screen as they are and shows: "⚠ The Roster changed since these Groups were made, so they're out of date. [Reshuffle]". Absent or removed Students stay visible in their Group, faded, until the Reshuffle.
- Changing the Target size or the Split does not mark Groups out of date; it only affects the next Shuffle.
- Switching Roster clears the Groups.

---

## 8. Screens (#6)

The [`prototype/main-screen`](https://github.com/pladypus/grouper/tree/prototype/main-screen) branch (`prototype/main-screen.html`, add `?demo` for every card state) is the visual reference; screenshots of the final iterations are `card-iterations/v7-*.png` and `header-iterations/h7-*.png`.

### Top bar (one row, fixed height)
Left to right:
1. **Roster picker**, then a **⋯** menu: New Roster, Rename, Export, Export all Rosters (Backup), Import, Delete Roster.
   - Delete asks: "Delete "Period 2" and all its Students and pairs? Export it first if you might want it back." The only Roster can't be deleted ("You can't delete your only Roster.").
2. **"23/25 Present ›"** opens the Students drawer.
3. **"5 Pairs ›"** opens the Pairs drawer.
4. **"Number of students in group"** stepper, the Split in words, and an "Edit" link.
5. **Share** (disabled until there are Groups), see [§9](#9-share-print-copy-full-screen-9).
6. **Theme** button: auto / light / dark, remembered per browser. Auto follows the system.
7. **Shuffle** / **Reshuffle** (with "keeps N Locked").

No brand or logo in the bar. Size warnings, Conflicts, the out-of-date notice and Undo notices appear on the board, not in the bar.

**Phones (≤ 760 px wide):** Present and Pairs side by side, the board is one column, and Reshuffle is pinned to the bottom of the screen.

### Board
- Empty state with Students: "Take the roll (✓ Present), then Shuffle."
- Groups fill the space below the bar. The column count is chosen from the measured board size: for each candidate `c` columns (`r = ceil(n/c)` rows, 14 px gaps), score `|ln((w/h)/1.2)| + 0.35 × (r×c − n)` and pick the lowest. An incomplete last row is centred. Recomputed on resize.
- **Group card:** coloured header "Group 1 · 4 students" with the Lock pill; names as a list sized to fit the card (up to about 46 px), computed from the card height, Student count and warning lines; two columns only when a Group has more than 6 Students and the card is wider than tall.
- **Colours:** hues cycle `212, 152, 28, 280, 350, 190, 48, 110, 250, 320`; header `hsl(hue 58% 40%)`, light tint `hsl(hue 58% 94%)` (dark theme: `38% 36%` / `38% 21%`).
- **Locked:** a ring in the Group's own colour, a tinted body, and a solid "Locked" pill.
- **Flagged:** amber outline and a warning line at the bottom.
- Theme tokens (light and dark) are those in the prototype's `:root` block.

### Students drawer
- **Attendance** mode: tap a name to toggle Present/Absent.
- **Edit list** mode: add one name, rename, remove (with Undo), and **Add names** ([§11](#11-add-names-10)).

### Pairs drawer
- Pick two Students, then **＋ Good pair** or **＋ Keep apart**. Refusals show as a red line with the sentence from [§3](#3-domain-model).
- Lists existing Pairs by kind, each deletable.

### New Roster dialog (#10)
- Roster name (required) and an optional "Paste your class list" box (also accepts a dropped or chosen .txt/.csv). Empty box → empty Roster. Filled → the Add names preview, then **Create**.

### First visit
- With no Rosters, the board offers New Roster and Import.
- **iOS tip** (#8): on iOS/iPadOS Safari only, when not running from the Home Screen (`navigator.standalone !== true` and not `display-mode: standalone`), and only while no Roster exists, show a dismissible tip: "Add Grouper to your Home Screen and use it from there, so Safari can't clear your Rosters." Dismissed means gone for good.

### Toasts
Top-centre, `role="status"`, about 3 s.

---

## 9. Share, print, copy, full screen (#9)

The [`prototype/print-copy`](https://github.com/pladypus/grouper/tree/prototype/print-copy) branch is the reference (`?variant=A` with C's Copy picture; `?print` for the print layout).

**Share** menu:
- **Copy picture:** a 16:9 PNG (1920×1080) of the Groups, always light whatever the theme: title "Period 2 groups", the date, and coloured Group cards laid out like the board with names sized to fit. Drawn to a canvas and written with `navigator.clipboard.write([new ClipboardItem({'image/png': blob})])`; if that isn't available or fails, the PNG downloads as `Period 2 groups YYYY-MM-DD.png`.
- **Copy as text:** plain text:
  ```
  Period 2 groups, 18 Nov 2026
  Group 1: Ana, Dee, Eli, Ben
  Group 2: …
  ```
- **Print…:** opens the browser's print dialog.
- **Full screen:** browser full screen (`requestFullscreen`), top bar included; Esc leaves.
- After a copy, a toast says what was copied: "Copied a picture of 5 Groups. Paste it into your slide." / "Copied 5 Groups as text."

**Print layout** (`@media print`, also via Ctrl+P), A4 portrait, light ink on white with Group colours kept:
- Header: "<Roster> groups", the date, the number of Students.
- Group cards three across, coloured header, names about 14 pt; `break-inside: avoid`.
- Hidden: top bar, notices, drawers, unpressed Lock buttons. A Locked Group keeps its "Locked" pill.

No separate projector or present mode.

---

## 10. Storage and keeping data safe (#3, #8)

| Key | Value |
|---|---|
| `grouper:roster:<id>` | One Roster: `{id, name, students:[{id, name, present}], pairs:[{id, type, a, b, created}], target, split?, pairClock}`. `pairClock` is the Roster's creation clock for Pairs (the next Pair's `created`), so deleting the newest Pair never reuses its number; a save without it loads with the clock one past the highest `created`. |
| `grouper:order` | Array of Roster ids in picker order |
| `grouper:current` | Id of the Roster last open |
| `grouper:theme` | `auto` \| `light` \| `dark` |
| `grouper:ios-tip-dismissed` | `1` once dismissed |
| `grouper:schema` | Storage schema version (`1`), for future migrations |

- Every read and write is wrapped in try/catch. If storage is unavailable or full, the app still works for the session and shows a notice: "This browser isn't saving your Rosters. Use Export all Rosters before you close the page."
- Saves happen on every change.
- The first time a Roster is saved, call `navigator.storage.persist()` silently and ignore the result.
- **No** Backup reminders and no "last backup" indicator. Export all Rosters is simply available.
- On iOS, a Home Screen app's storage is separate from Safari's; Teachers move Rosters with Backup and Import. No special UI for this.

---

## 11. Add names (#10)

Adds many Students to a Roster at once. Reached from **Add names** in the Students drawer and from the New Roster dialog's paste box. Both accept pasted text or a dropped/chosen .txt or .csv. Shares its parser and preview with list Import ([§12](#12-export-and-import-7)).

**Parsing** (`names/parse.ts` in core):
- One name per line. Commas stay inside a name ("Smith, Ana" is one Student) for pasted text and .txt.
- If the text has tabs, or the file is .csv, show the **column picker** ([§12](#12-export-and-import-7)).
- Cleanup: trim, collapse inner spaces, drop blank lines, strip a leading list marker (`1.`, `2)`, `-`, `*`, `•`).
- Lines over 40 characters are flagged "looks like a sentence?" but kept.

**Preview:**
- A checkbox per name, ticked by default (flagged ones too). Unticked names are left out.
- A "Skipped" list: names already on the Roster, repeats within the paste, blank lines.
- Button: **Add N students** (or **Create** in New Roster).

**Duplicates:** compared by name key. A name already on the Roster is skipped and that Student is untouched; a repeat within the paste is added once. Re-pasting a whole class to add late joiners just works.

New Students start Present; Groups on screen go out of date.

---

## 12. Export and Import (#7)

### Files

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

### Import
Via `<input type=file accept=".json,.txt,.csv">` from the ⋯ menu. Always **adds** Rosters; never overwrites without asking.

1. **Roster file** → adds one Roster.
2. **Backup file** → adds every Roster in it.
3. **.txt / .csv name list** → one new Roster:
   - .txt: one name per line (the [§11](#11-add-names-10) parser).
   - .csv (or tabbed text): a preview table; the Teacher ticks the name column(s) (several are joined with a space, e.g. First + Last) and says whether row 1 is a header. The app pre-ticks a likely column: a header matching `name`, `student`, `first`, `last` (case-insensitive), else the column with the most distinct non-numeric values.
   - Confirm step: the resulting names (the [§11](#11-add-names-10) preview) and the Roster name, defaulting to the filename without its extension, editable.

**Roster name clash:** the Teacher chooses **Replace** or **Keep both** (saved as "<name> (imported)", then "(imported 2)" …). For a Backup, one question covers every clash.

**Versions:** older `version`s are upgraded on Import. A newer version is refused: "This file was made by a newer Grouper; reload the page to update." Anything that is neither a grouper file nor a .txt/.csv list is refused: "That file isn't a Grouper file or a list of names."

**Lenient, but nothing dropped silently:**
- A repeated name (by name key) is kept once, and Pairs point at that Student.
- A Pair naming a Student not on the Roster, repeating another Pair, or contradicting the Pairs accepted so far (the [§3](#3-domain-model) entry check, in file order) is dropped.
- After Import, a message lists everything skipped. Accepted consequence: two real "Sam"s merge into one and are reported; the Teacher re-adds the second as "Sam B.".
- Imported Students all start Present. Pair `created` order follows file order.

Toast on success: "Imported "Period 2": 25 Students, 5 pairs."

---

## 13. Suggested module layout

One Vite app at the repo root (flattened from the bake-off's workspaces at #26):

```
package.json       one app: scripts dev, build, test, preview
index.html         Vite entry
vite.config.ts     Vite + Vitest config (jsdom for every test)
src/
  main.tsx, App.tsx, state.tsx (useReducer + context), styles.css, *.test.tsx
  components/      *.tsx
  lib/             core: framework-free, imported through the barrel src/lib/index.ts
    solver/        prepare, maxClique, search, mix, explain (pure, tested)
    shuffle.ts     Locks, Split around Locks, calls solver, builds Groups (pure, tested)
    split.ts       derived Split, Split text, Split edit validation (pure, tested)
    rules.ts       chains, entry-time contradiction check, Manual-move flags (pure, tested)
    roster.ts      pure Roster operations: add/rename/remove Student, attendance (pure, tested)
    groups.ts, move.ts, lock.ts, layout.ts, theme.ts   Board, swap, Lock, layout, theme (pure, tested)
    names/         name key, list parser, column guess (pure, tested)
    files.ts       Export/Backup writers, Import reader + upgrade + leniency report (pure, tested)
    share/         text, canvas picture, clipboard/download
    storage.ts     localStorage adapter with try/catch and schema version
```

UI files import core as `./lib` (from `src/`) or `../lib` (from `src/components/`). Core never imports from the UI.

Components: TopBar, Board, GroupCard, StudentsDrawer, PairsDrawer, NewRosterDialog, AddNamesPreview, ColumnPicker, ImportDialog, ConflictNotice, Toast, IosTip.

Everything in core except `storage.ts` is UI-free and covered by Vitest. The UI has Testing Library component tests beside `App.tsx`.

---

## 14. Choices made while writing this spec

These were not settled by a ticket. Each follows from the decisions above and is cheap to change.

- **Attendance is saved in the browser** with the Roster (so a reload doesn't lose the roll), but never exported.
- **Target size is saved per Roster** in the browser, default 4. A hand-edited Split is not saved; it lasts until the Present count changes or the page reloads.
- **TypeScript** throughout.
- **Leftover distribution** is round-robin, one per Group (27 at 4 → 3×4 + 3×5), and fewer Present than the Target size makes one Group of everyone.
- **A Rule broken inside a Locked Group** (flagged, then Locked) is carried over, not a Conflict. The research prototype reported `apart-inside-lock`; #5's "a flagged Group can be Locked and Reshuffle carries it over unchanged" overrides it.
- **Locked Groups keep their position and colour** on Reshuffle.
- **Switching Roster clears the Groups**; changing Target size or Split doesn't mark them out of date.
- **Spread steps** fixed at 300 (research range 200–500).
- **Storage-unavailable notice** and the exact Import refusal wording.
- **CSV column guess** heuristic.

---

## 15. Build tickets

The build is split into vertical slices. Each is a GitHub issue labelled `ready-for-agent` (#26 is `ready-for-human`), with native "blocked by" links. Start with any ticket whose blockers are closed. Tickets marked **both** were built in both bake-off apps ([§2](#framework-bake-off)) and now live once in the flattened React app; every remaining ticket is built once in the single-app layout ([§13](#13-suggested-module-layout)).

| Ticket | Blocked by |
|---|---|
| #12 Scaffold the monorepo and deploy a placeholder site (**both**, done) | none |
| #13 Repo upkeep: Dependabot, auto-merge with deploy, main ruleset | #12 |
| #14 Rosters and Students saved in the browser (**both**, done) | #12 |
| #15 Shuffle Present Students into Groups, no Rules yet (**both**, done) | #14 |
| #16 Pairs that every Shuffle obeys (**both**, done) | #15 |
| #18 Manual move: swap two Students by drag or tap (**both**, done) | #16 |
| #19 Lock Groups and Reshuffle around them (**both**, done) | #18 |
| #26 Pick React or Svelte and flatten the repo (done: React) | #19 |
| #17 Explain a Conflict with the Rules involved | #16, #26 |
| #20 Export, Backup and Import of Grouper files | #16, #26 |
| #21 Add names: paste or drop a class list into a Roster | #14, #26 |
| #22 Import a .txt or .csv list as a new Roster | #20, #21 |
| #23 Share menu: Copy as text, Print, Full screen | #15, #26 |
| #24 Copy picture of the Groups | #23 |
| #25 Works offline and as a Home Screen app | #14, #26 |
