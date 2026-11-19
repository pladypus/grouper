# Grouper: build spec

Grouper is a static website where a Teacher keeps class Rosters and Shuffles the Present Students into random Groups that obey every Rule. This spec collects every decision from the [planning map](https://github.com/pladypus/grouper/issues/1) so the site can be built with nothing left to decide.

Capitalised terms (Roster, Student, Present, Group, Target size, Split, Leftovers, Good pair, Keep apart, Conflict, Shuffle, Lock, Manual move, Export, Backup, Import, Add names) mean exactly what [GLOSSARY.md](../../GLOSSARY.md) says. UI labels the Teacher sees are in "quotes".

Each file cites the ticket it comes from. A few small gaps no ticket covered were filled while writing this spec; they are marked "(choice, cheap to change)".

## Product in one paragraph

A Teacher opens https://grouper.pladypus.dev, picks a Roster ("Period 2"), takes the roll, sets "Number of students in group", and presses Shuffle. Colour-coded Group cards fill the screen, big enough to read on a projector. The Teacher can Lock Groups they like and Reshuffle the rest, swap two Students by hand, and Share the result as a picture, text, or printout. Rosters live only in the Teacher's browser; Export, Backup, and Import move them between browsers and Teachers.

**Users:** the owner plus a few colleagues. No accounts, no server, no sync.

**Out of scope:** avoiding repeat groupings across sessions (grouping history); shared or server-side data, accounts, sync; soft or preference Rules (every Rule is strict).

## Files

- [stack-and-hosting.md](stack-and-hosting.md): framework, state, styling, storage, offline, tests, hosting; the framework bake-off; repo upkeep.
- [domain-model.md](domain-model.md): Roster, Student, Pair (Rule), Target size / Split / Leftovers, Group, and the refusal sentences.
- [shuffle-rules.md](shuffle-rules.md): what a Shuffle or Reshuffle does, step by step, around Locks.
- [solver.md](solver.md): the solver's interface, its four stages, performance targets and required tests.
- [conflicts.md](conflicts.md): the red Conflict notice and its sentences.
- [lock-and-manual-move.md](lock-and-manual-move.md): Lock, swapping Students, flagged Groups, and when Groups go out of date.
- [screens.md](screens.md): top bar, board, Group cards, drawers, New Roster dialog, first visit, toasts.
- [share.md](share.md): Share menu (Copy picture, Copy as text, Print…, Full screen) and the print layout.
- [storage.md](storage.md): `localStorage` keys and keeping data safe.
- [add-names.md](add-names.md): pasting or dropping a class list into a Roster.
- [export-import.md](export-import.md): Roster and Backup files, and Import.

The module layout is in the repo [README](../../README.md#layout); the build tickets are the [GitHub issues](https://github.com/pladypus/grouper/issues).

## Citing the spec from code

Code comments cite the spec as `spec: <file>`, or `spec: <file>#<anchor>` for one heading, with the file relative to `docs/spec/` and the anchor as GitHub generates it from the heading, e.g. `spec: screens.md#board` or `spec: domain-model.md#student-7`. Markdown docs link to the file instead.
