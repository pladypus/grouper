# Grouper

A static website where a Teacher keeps class Rosters and Shuffles the Present Students into random Groups that obey every Rule. Live at **https://grouper.pladypus.dev**.

- Take the roll, set "Number of students in group", and Shuffle: colour-coded Group cards sized for a projector.
- Good pairs (always together) and Keep apart pairs that every Shuffle obeys; when it can't, a Conflict notice shows the Rules involved.
- Lock Groups you like and Reshuffle the rest; swap two Students by drag or tap.
- Share as text, a printout, or a picture for a slide; full screen for the projector.
- Rosters live only in the browser. Export, Backup and Import move them between browsers and Teachers; paste or import a class list to add names.
- Works offline and can be added to the Home Screen.

No accounts, no server, no sync.

## Develop

Node comes from the Nix flake (Node 22, the same as CI). With [direnv](https://direnv.net/), `direnv allow` once; otherwise prefix commands with `nix develop -c`.

```sh
npm ci
npm run dev       # Vite dev server
npm test          # Vitest: lib unit tests and Testing Library component tests (jsdom)
npm run build     # type-check and build to dist/
npm run preview   # serve the built app, service worker included
```

`nix run` installs dependencies if needed and starts the dev server.

## Layout

```
src/
  lib/          framework-free domain logic (never imports the UI; the UI imports it as ./lib):
                solver, Split, Rules, Lock, Manual move,
                names, files (Export/Import), share, storage. Pure and unit-tested.
  components/   React components
  state.tsx     app state: useReducer + context, commands that call lib
  App.tsx, main.tsx, styles.css (Tailwind v4 theme tokens)
public/         icons for the web app manifest, robots.txt, sitemap.xml
```

## Docs

- [docs/spec/](docs/spec/README.md): how Grouper behaves, including the exact wording the Teacher sees, one file per area. Code comments cite it as `spec: screens.md#board`.
- [GLOSSARY.md](GLOSSARY.md): the domain terms (Roster, Present, Split, Good pair, Conflict…). Capitalised terms in code and docs mean exactly this.
- [docs/adr/](docs/adr/): decisions, e.g. [0001 React](docs/adr/0001-react.md).
- Planning: the [Wayfinder map](https://github.com/pladypus/grouper/issues/1) and its tickets; research and prototypes are kept as `archive/*` tags.

## Deploy and upkeep

- Every change to `main` goes through a squash-merged PR that passes the `test-and-build` check.
- A push to `main` deploys to GitHub Pages (`.github/workflows/deploy.yml`).
- Dependabot opens monthly grouped updates. They auto-merge once the check passes, then dispatch a deploy.
