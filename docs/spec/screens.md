# Screens (#6)

The [`archive/prototype/main-screen`](https://github.com/pladypus/grouper/tree/archive/prototype/main-screen) tag (`prototype/main-screen.html`, add `?demo` for every card state) is the visual reference; screenshots of the final iterations are `card-iterations/v7-*.png` and `header-iterations/h7-*.png`.

## Top bar (one row, fixed height)
Left to right:
1. **Roster picker**, then a **⋯** menu: New Roster, Rename, Export, Export all Rosters (Backup), Import, Delete Roster, then a divider and **About Grouper** (see [About](#about-66)).
   - Delete asks: "Delete "Period 2" and all its Students and pairs? Export it first if you might want it back." The only Roster can't be deleted ("You can't delete your only Roster.").
2. **"23/25 Present ›"** opens the Students drawer.
3. **"5 Pairs ›"** opens the Pairs drawer.
4. **"Number of students in group"** stepper, the Split in words, and an "Edit" link.
5. **Share** (disabled until there are Groups), see [Share](share.md).
6. **Theme** button: auto / light / dark, remembered per browser. Auto follows the system.
7. **Shuffle** / **Reshuffle** (with "keeps N Locked").

No brand or logo in the bar. Size warnings, Conflicts, the out-of-date notice and Undo notices appear on the board, not in the bar.

**Phones (≤ 760 px wide):** Present and Pairs side by side, the board is one column, and Reshuffle is pinned to the bottom of the screen.

## Board
- Empty state with Students: "Take the roll (✓ Present), then Shuffle."
- Groups fill the space below the bar. The column count is chosen from the measured board size: for each candidate `c` columns (`r = ceil(n/c)` rows, 14 px gaps), score `|ln((w/h)/1.2)| + 0.35 × (r×c − n)` and pick the lowest. An incomplete last row is centred. Recomputed on resize.
- **Group card:** coloured header "Group 1 · 4 students" with the Lock pill; names as a list sized to fit the card (up to about 46 px), computed from the card height, Student count and warning lines; two columns only when a Group has more than 6 Students and the card is wider than tall.
- **Colours:** hues cycle `212, 152, 28, 280, 350, 190, 48, 110, 250, 320`; header `hsl(hue 58% 40%)`, light tint `hsl(hue 58% 94%)` (dark theme: `38% 36%` / `38% 21%`).
- **Locked:** a ring in the Group's own colour, a tinted body, and a solid "Locked" pill.
- **Flagged:** amber outline and a warning line at the bottom.
- Theme tokens (light and dark) are those in the prototype's `:root` block.

## Students drawer
- **Attendance** mode: tap a name to toggle Present/Absent.
- **Edit list** mode: add one name, rename, remove (with Undo), and **Add names** ([Add names](add-names.md)).

## Pairs drawer
- Pick two Students, then **＋ Good pair** or **＋ Keep apart**. Refusals show as a red line with the sentence from [Domain model](domain-model.md#pair-rule-4-6).
- Lists existing Pairs by kind, each deletable.

## New Roster dialog (#10)
- Roster name (required) and an optional "Paste your class list" box (also accepts a dropped or chosen .txt/.csv). Empty box → empty Roster. Filled → the Add names preview, then **Create**.

## First visit
- With no Rosters, the board offers New Roster and Import.
- **iOS tip** (#8): on iOS/iPadOS Safari only, when not running from the Home Screen (`navigator.standalone !== true` and not `display-mode: standalone`), and only while no Roster exists, show a dismissible tip: "Add Grouper to your Home Screen and use it from there, so Safari can't clear your Rosters." Dismissed means gone for good.

## About (#66)
Opened from **About Grouper**, the last item in the ⋯ menu. It's a modal dialog like the others, closed with Close, Esc or a click outside. It shows:
- A header: the app icon, the title "About Grouper", and the subtitle "Random student groups for teachers."
- "Class lists stay in this browser. Nothing is sent to a server.", in a green box with a shield icon.
- A footer row with Close on the right. On the left are two lines:
  - **Source code on GitHub ↗**, linking to https://github.com/pladypus/grouper in a new tab (`target="_blank" rel="noopener noreferrer"`).
  - "Version a47493d · 22 Nov 2026": the short commit and build date, injected at build time (Vite `define`). The commit links to that commit on GitHub, so a Teacher on an older cached build can say which one.

There are no special hiding rules: the dialog only appears when opened, the print layout shows only Groups, and Copy picture is drawn on a canvas. The source link stays out of the static crawler text in `index.html` (#63). The code is MIT-licensed (`LICENSE`, "Copyright (c) 2026 Peter Loftus"; `"license": "MIT"` in `package.json`).

## Toasts
Top-centre, `role="status"`, about 3 s.
