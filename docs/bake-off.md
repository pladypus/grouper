# Bake-off report: React vs Svelte

A side-by-side comparison of `apps/react` and `apps/svelte` for [#26](https://github.com/pladypus/grouper/issues/26) ([SPEC §2 Framework bake-off](../SPEC.md#framework-bake-off)). Both apps implement the same slice (#12 scaffold, #14 Rosters, #15 Shuffle, #16 Pairs, #18 Manual move, #19 Lock) over the same `packages/core`, with the same Tailwind v4 styles, Lucide icons and test approach. Only the framework, the state approach and the drag library differ:

| | React | Svelte |
|---|---|---|
| Framework | React 19.3 | Svelte 5.58 (runes) |
| State | `useReducer` + context (`src/state.tsx`) | a runes class store (`src/state.svelte.ts`) |
| Drag | `@dnd-kit/core` 6.3 | `svelte-dnd-action` 0.9.80 |

This report measures and describes. It does not recommend; the pick is the owner's.

## Summary

| Measure | React | Svelte |
|---|---|---|
| App source lines (excl. tests, excl. core) | 2,083 | 1,903 |
| App test lines | 1,798 | 1,702 |
| Tests | 66 in 5 files | 62 in 5 files |
| Test run, wall time (median of 3) | 3.45 s | 2.97 s |
| Production JS, raw / gzip | 327.6 kB / 101.3 kB | 157.7 kB / 53.7 kB |
| Production CSS, raw / gzip | 22.1 kB / 5.4 kB | 23.3 kB / 5.7 kB |
| Build time, `npm run build` (median of 3) | 0.66 s | 3.40 s |
| Direct dependencies (runtime / dev) | 5 / 13 | 4 / 12 |
| Installed packages (runtime tree / all) | 12 / 124 | 23 / 139 |
| Touch drag | Hold 200 ms, 8 px tolerance; no app-side drag glue | Hold 200 ms; needs a 119-line `drag.ts` plus a few workarounds |
| Verified on a real touch device | No | No |

Shared core (`packages/core`, not counted above): 2,442 source lines, 2,266 test lines, 183 tests.

Measured on 2026-11-19 at commit `5ccba8e` (main after #45), Node 22.23.4, npm 10.9.9, Intel i7-9700K (8 cores), via `nix develop`.

## Lines of code per feature

Lines are raw lines (blank lines and comments included) as counted by `git diff --numstat`. Each feature is the net change (added minus deleted) that feature's squash-merged PR made to the app, so later PRs editing earlier files are counted against the later feature. The six rows sum exactly to today's file sizes. "Source" is everything under `src/` except tests (`.tsx` / `.svelte` / `.ts` and `styles.css`); "Tests" is `*.test.*` and `test-setup.ts`. Config files outside `src/` (package.json, vite/ts/svelte config, index.html) are listed separately: React 75 lines, Svelte 79.

| Feature | PRs (React / Svelte) | React source | Svelte source | React tests | Svelte tests |
|---|---|---:|---:|---:|---:|
| Scaffold / shell (#12) | #27 / #27 | 30 | 23 | 16 | 11 |
| Rosters & Students (#14) | #31 / #33 | 1,050 | 923 | 307 | 319 |
| Shuffle / board (#15) | #35 / #37 | 412 | 370 | 344 | 324 |
| Pairs (#16) | #39 / #40 | 234 | 200 | 334 | 340 |
| Manual move (#18) | #42 / #43 | 285 | 332 | 453 | 318 |
| Lock (#19) | #44 / #45 | 72 | 55 | 344 | 390 |
| **Total** | | **2,083** | **1,903** | **1,798** | **1,702** |

Gross churn (lines added / deleted in source) shows a similar pattern: React +2,217 / −134, Svelte +1,973 / −70.

Notes:

- Svelte source is smaller in every feature except Manual move, where `drag.ts` (119 lines of glue around svelte-dnd-action) is counted.
- Svelte keeps markup, logic and component-scoped behaviour in one `.svelte` file. React splits dialogs into one `Dialog.tsx` (136 lines); Svelte uses three smaller files (`Modal`, `RosterNameDialog`, `DeleteRosterDialog`, 125 lines together).
- The state modules are about the same size: `state.tsx` 410 lines, `state.svelte.ts` 431 lines.
- The core package (shared by both, not in the table): 2,442 source lines, 2,266 test lines.

## Production bundle

`npm run build -w apps/<app>`, then `wc -c` and `gzip -c | wc -c` (default gzip level) on each file in `dist/`. Each app emits one JS and one CSS file.

| File | React raw | React gzip | Svelte raw | Svelte gzip |
|---|---:|---:|---:|---:|
| JS | 327,556 B | 101,279 B | 157,663 B | 53,742 B |
| CSS | 22,081 B | 5,396 B | 23,334 B | 5,698 B |
| index.html | 425 B | 300 B | 424 B | 295 B |
| **Total** | **350,062 B** | **106,975 B** | **181,421 B** | **59,735 B** |

Svelte's gzipped JS is about 53% of React's (47.5 kB less). Vite reports 80 modules for React and 181 for Svelte (Svelte's runtime ships as many small modules).

### Dependencies

| | React | Svelte |
|---|---|---|
| Direct runtime | `react`, `react-dom`, `@dnd-kit/core`, `lucide-react`, `@grouper/core` | `svelte`, `svelte-dnd-action`, `@lucide/svelte`, `@grouper/core` |
| Direct dev | 13 | 12 |
| Runtime tree (unique installed packages, `npm ls --omit=dev --all`) | 12 | 23 |
| Full tree incl. dev | 124 | 139 |

The Svelte runtime tree is larger because the `svelte` package also carries its compiler's dependencies (acorn, esrap, `@jridgewell/*`, …); these are build-time only and do not end up in the bundle.

## Tests

Both apps use Vitest 5 + jsdom + Testing Library. Each was run 3 times with `npm test -w apps/<app>` (wall time, including npm start-up).

| | React | Svelte |
|---|---|---|
| Test files | 5 | 5 |
| Tests | 66 | 62 |
| Wall time, runs | 3.66 / 3.45 / 3.39 s | 3.83 / 2.90 / 2.97 s |
| Wall time, median | 3.45 s | 2.97 s |
| Vitest-reported duration, median | 2.99 s | 2.21 s |

Tests per file (one file per feature):

| Feature | React | Svelte |
|---|---:|---:|
| Rosters & Students (`App.test`) | 13 | 12 |
| Shuffle (`Shuffle.test` / `Groups.test`) | 15 | 10 |
| Pairs (`Pairs.test`) | 8 | 16 |
| Manual move (`Move.test`) | 16 | 10 |
| Lock (`Lock.test`) | 14 | 14 |

The counts differ because each agent split assertions into `it` blocks differently; both cover the same SPEC behaviour.

One difference in how drag is tested:

- **React:** tests drive dnd-kit with real `mousedown` / `mousemove` / `mouseup` and `touchstart` / `touchmove` / `touchend` events, with `getBoundingClientRect` stubbed so `pointerWithin` can find the names in jsdom. The library itself runs in the tests.
- **Svelte:** tests dispatch svelte-dnd-action's `consider` / `finalize` events directly (with `TRIGGERS.DRAG_STARTED` / `DROPPED_INTO_ZONE`), plus stubbed row boxes for `drag.ts`. The library's own pointer handling is not run in the tests.

## Build time

`npm run build -w apps/<app>` from a clean `dist/`, 3 runs each.

| | React (`tsc -b && vite build`) | Svelte (`svelte-check && vite build`) |
|---|---|---|
| Runs | 0.73 / 0.66 / 0.64 s | 3.40 / 3.34 / 3.41 s |
| Median | 0.66 s | 3.40 s |
| Type-check step alone (median of 3) | `tsc -b --force` 0.42 s | `svelte-check` 2.75 s |
| `vite build` alone (median of 3) | 0.55 s | 0.92 s |

Most of the gap is the type-check: React uses TypeScript 7 (the native compiler), while `svelte-check` 4.7.8 declares a peer of `typescript ^5 || ^6`, so npm installs TypeScript 6.0.3 under `apps/svelte/node_modules` for it (see Awkward parts).

## Drag on touch

There was no real touch device available for this report. Both apps were checked in headless Firefox by the agents that built them. **The owner should try both on an iPad and a phone** before deciding: hold-to-drag timing, scrolling while a finger is on a name, and how the dragged pill follows the finger are things headless runs cannot show.

| | React / dnd-kit | Svelte / svelte-dnd-action |
|---|---|---|
| Touch drag start | 200 ms hold, 8 px tolerance (`TouchSensor`) | 200 ms hold (`delayTouchStart`) |
| Mouse drag start | after 6 px of movement (`MouseSensor`) | library's fixed 3 px threshold (not configurable) |
| Drop target | dnd-kit reports the Student under the pointer (`useDroppable` per name, `pointerWithin`) | library only reports the target list; `drag.ts` tracks the pointer and finds the Student under it at drop |
| Dragged copy | `<DragOverlay>` renders the name pill | library clones the row; `styleDragOverlay` strips it to the name pill |
| Screen-reader output | dnd-kit's announcements silenced; the app's own live region speaks | `autoAriaDisabled`; the library still adds a hidden `role="alert"` div to `<body>` |
| Verified in headless Firefox | mouse drag, drop elsewhere, tap | mouse drag, touch tap, touch hold-and-drag (via puppeteer) |
| Touch hold-and-drag in headless | worked only after defining `window.TouchEvent`, which headless desktop Firefox lacks (real touch browsers define it) | worked |

App code needed for drag:

- **React:** sensors and `DndContext` in `Board.tsx`, `useDraggable` / `useDroppable` on each name in `GroupCard.tsx`. No separate drag module.
- **Svelte:** `use:dndzone` in `GroupCard.svelte` plus `src/drag.ts` (119 lines): pointer tracking and hit-testing for the drop target, a click swallower after mouse release, a touch-end handler to stop a double tap, and the overlay restyle. svelte-dnd-action is a sortable-list library, so the app also resets the list items from the Board after every `consider` / `finalize` event, so the library never moves anyone itself.

## Awkward parts

### Both

- **`<header>` inside cards and drawers became a second banner landmark** (jsdom counts it, and some screen readers do too). Both apps switched those to `<div>`s, with a comment saying why.
- **Lucide's root import** made the test run take about 13 s because Vite and Vitest compile every icon. Both apps import each icon by its own path instead.
- **No `ResizeObserver` or layout in jsdom.** Both Board components skip the observer when it is missing (cards render unsized in tests), and drag tests stub `getBoundingClientRect`.

### React

- **Shuffle cannot run in the reducer** because it uses randomness and reducers must be pure. Commands run Shuffle and pass the finished Board to the reducer (`state.tsx`).
- **Commands run each core operation twice:** once in the command to learn whether it is refused (so the refusal sentence can go back to the form), then again in the reducer to make the change (`state.tsx`, comment at line 289).
- **dnd-kit's built-in announcements** had to be silenced (`SILENT` in `Board.tsx`) so they don't talk over the app's own Manual move live region.
- **Headless touch testing** needed `window.TouchEvent` defined by hand (see Drag on touch). This affects only headless desktop Firefox.

### Svelte

- **`svelte-check` pins TypeScript 6** (peer `^5 || ^6`), while the rest of the repo is on TypeScript 7. npm installs a second TypeScript under `apps/svelte/node_modules`, and the type-check step takes about 2.75 s against React's 0.42 s.
- **svelte-dnd-action is a sortable list, not drag-onto-item**, so it needed `drag.ts`:
  - it only reports which list a drop ended in, so `drag.ts` tracks the pointer and finds the Student under it at drop;
  - a mouse released over the starting row also fires a click (which would select the Student), so one click is swallowed;
  - after a quick touch tap the library sends its own click as well as the browser's, so `stopDoubleTap` cancels one;
  - the library won't start a drag on a press that lands on a `<button>`, so a `<span>` fills each name button and takes the press;
  - the library's proposed item order is thrown away on every event and reset from the Board, with its placeholder item for the dragged row.
- **The library adds a hidden `role="alert"` div to `<body>`**, so tests that look for the app's alerts scope the query to `<main>` (`within(screen.getByRole("main"))` in `Lock.test.ts`).
- **The store's `state` setter runs `boardAfterRosterChange` on every state set** (`state.svelte.ts`, line 141), including changes that don't touch the open Roster. This is how the Board follows the Roster without an effect, at the cost of re-checking the Board on every change.
- **Four `svelte-ignore` comments** silence compiler warnings: `state_referenced_locally` twice (props read once on purpose in `App.svelte` and `RosterNameDialog.svelte`) and two a11y warnings (`a11y_autofocus` in `SizeControls.svelte`, `a11y_no_noninteractive_element_to_interactive_role` in `Drawer.svelte`).

## How to reproduce

```sh
nix develop -c npm ci
nix develop -c npm run build -w apps/react      # and -w apps/svelte
gzip -c apps/react/dist/assets/*.js | wc -c     # per file, raw with wc -c
nix develop -c npm test -w apps/react           # and -w apps/svelte, 3 runs each
git diff --numstat <pr-commit>~1 <pr-commit> -- apps/react   # per-feature lines
```

To try them: `npm run dev -w apps/react` and `npm run dev -w apps/svelte`.
