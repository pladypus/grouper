# Research: front-end stack, browser storage and drag-and-drop

Ticket: #3 — "Which front-end stack and browser storage should the site use?"
Researched: 2026-11-18. Terms follow `GLOSSARY.md`.

## Recommendation (summary)

| Concern | Choice |
| --- | --- |
| Stack | **Svelte 5 + Vite** (plain Vite SPA, *not* SvelteKit), plain JavaScript or light TypeScript |
| Storage | **localStorage**, JSON, one namespaced key per Roster; call `navigator.storage.persist()`; treat **Export** as the real backup |
| Drag-and-drop | **SortableJS** (`group` option across Group lists), with `forceFallback: true` for identical mouse/touch behaviour; state updated in `onEnd`, DOM owned by Svelte |
| Deploy | **GitHub Actions** publishing source using the official Pages actions (Vite's documented workflow), `base: '/random-group-generator/'` |

Close runner-up: **Preact + HTM with no build step**, deployed from a branch. Choose it if the
owner would rather never touch Node/npm (see "Trade-offs").

## 1. Hosting constraints (GitHub Pages)

- Project site URL is `https://<owner>.github.io/<repositoryname>`
  ([What is GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)).
  So this site will live at `https://pladypus.github.io/random-group-generator/`.
- **Consequence for storage:** the browser origin is `https://pladypus.github.io` — shared by
  *every* project Pages site under the same account. localStorage/IndexedDB are per origin
  ([MDN localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage): storage is keyed by
  scheme/host/port), so another `pladypus.github.io/*` site could read or clobber this app's keys.
  Mitigation: prefix all keys (e.g. `rgg:`), or give the site a custom domain to get its own origin.
- Two publishing sources: deploy from a branch (`/` or `/docs`) — "the simpler option" when you
  don't need a build — or a **GitHub Actions workflow**, recommended "for builds other than Jekyll"
  ([Configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)).
- Limits: site ≤ 1 GB, soft 100 GB/month bandwidth, deployments time out after 10 minutes; the
  10-builds/hour soft limit does not apply to custom Actions workflows
  ([GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)).
  None of these matter for an app this size.
- Pages is not yet enabled on the repo (`GET /repos/.../pages` → 404 on 2026-11-18); enabling it
  with source "GitHub Actions" is a one-time settings step.

## 2. Stack options

### Plain HTML/JS (no framework, no build)
- Deploy: branch publishing, zero tooling.
- Cost: the UI has many interdependent views of one state (Rosters, Students, Present/Absent,
  Apart rules, Clusters, Split, Groups, Locks, projector view). Hand-written DOM syncing for that
  is where small vanilla apps rot. Not recommended unless the UI stays very small.

### Preact + HTM, no build (runner-up)
- Preact "is packaged to be used directly in the browser, and doesn't require any build or tools";
  import from a CDN as an ES module and use HTM (tagged templates) instead of JSX; import maps
  for scaling ([Preact getting started](https://preactjs.com/guide/v10/getting-started/)).
- Deploy: branch publishing — commit the files, done. No Node, no lockfile, no Dependabot churn.
- Cost: runtime dependency on a CDN (or vendored files), no type checking, templates in strings,
  no component-scoped CSS out of the box.

### Svelte 5 + Vite (recommended)
- Svelte docs recommend SvelteKit but explicitly support plain Vite: `npm create vite@latest`,
  pick `svelte`; `npm run build` emits HTML/JS/CSS to `dist`; "Vite is often used in standalone
  mode to build single page apps" ([Svelte getting started](https://svelte.dev/docs/svelte/getting-started)).
  This app has no routing need beyond maybe a projector view toggle, so SvelteKit's router/adapters
  are unnecessary weight.
- Why Svelte over Preact/Vue/React for this owner: components read as HTML + a `<script>` + scoped
  `<style>`, closest to plain web code; reactive state without hooks rules; compiled output is
  small. (Vue + Vite is an equally valid choice; React adds the most concepts for the least gain here.)
- Cost: needs Node/npm locally and in CI, and occasional dependency upgrades.

### Build/deploy path for any Vite-based choice
Vite's static-deploy guide ([vite.dev/guide/static-deploy](https://vite.dev/guide/static-deploy)):
- Set `base: '/random-group-generator/'` in `vite.config.js` (project pages need `/<REPO>/`).
- Add `.github/workflows/deploy.yml`: on push to `main` (+ manual dispatch), permissions
  `contents: read`, `pages: write`, `id-token: write`, concurrency of one; steps
  `actions/checkout` → `actions/setup-node` (LTS, npm cache) → `npm ci` → `npm run build` →
  `actions/configure-pages` → `actions/upload-pages-artifact` (`path: ./dist`) → `actions/deploy-pages`.
  The guide currently pins checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5,
  deploy-pages v5 by commit SHA — copy the file from the guide rather than retyping it.
- GitHub recommends a deployment protection rule so only the default branch deploys to the
  `github-pages` environment ([publishing source docs](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)).

## 3. Storage: localStorage vs IndexedDB

Data size estimate: a Roster of ~35 Students with Rules, Clusters, Present/Absent and the current
Groups/Locks is a few KB of JSON. Ten Rosters is well under 100 KB.

| | localStorage | IndexedDB |
| --- | --- | --- |
| Capacity | 5 MiB per origin (10 MiB max on all browsers); `QuotaExceededError` when full ([MDN quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)) | Up to ~60% of disk (Chrome, Safari); Firefox best-effort min(10% disk, 10 GiB) ([same](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)) |
| API | Synchronous, strings only (store JSON) ([MDN localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)) | Async, structured objects, transactions; noticeably more code or a wrapper library |
| Eviction | Same rules for both — see below | Same |

Eviction facts that apply to **both** (MDN quotas page):
- Default is *best-effort*: kept while under quota, device has space, and the user doesn't clear it.
  Under storage pressure browsers evict whole origins, least-recently-used first; eviction is
  all-or-nothing per origin.
- **Safari** with tracking prevention: "If an origin has no user interaction … in the last seven days
  of browser use, its data created from script will be deleted." WebKit confirms this covers both
  IndexedDB and LocalStorage, and that web apps **added to the home screen** have their own counter
  and are not expected to lose first-party data
  ([WebKit blog](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)).
  A Teacher on an iPad who doesn't open the site for a week of Safari use can lose every Roster.
- `navigator.storage.persist()` asks for persistent mode (only evicted by the user); Baseline since
  Dec 2021, HTTPS only ([MDN persist](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)).
  Firefox shows a permission prompt; Chrome and Safari grant/deny silently based on engagement
  (MDN quotas page). It is a request, not a guarantee.
- Private/incognito windows clear localStorage when the last private tab closes (MDN localStorage).

**Conclusion:** IndexedDB's extra capacity is irrelevant at these sizes and it gets *no* better
durability, so localStorage wins on simplicity. Durability has to come from **Export**:
- Store `rgg:roster:<id>` per Roster plus an `rgg:index` key; include a `schemaVersion` field so
  Import and future migrations can upgrade old files.
- Call `persist()` once after the first Roster is saved; show its result.
- Make Export a first-class action (single Roster and "export all"), and remind the Teacher when
  data has changed since the last Export.
- Export via `Blob` + `<a download>`; Import via `<input type="file">`. `showSaveFilePicker()` is
  experimental / not Baseline ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker)),
  so at most use it as a Chromium-only nicety.
- Wrap every `setItem` in `try/catch` for `QuotaExceededError`/`SecurityError`.

## 4. Drag-and-drop for Manual moves (mouse and touch)

- **Native HTML Drag and Drop API** — MDN describes it in mouse terms only
  ([MDN HTML DnD](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)).
  caniuse shows iOS Safari supports it only from 15, Chrome Android supports it, but
  **Samsung Internet and Firefox for Android do not** ([caniuse dragndrop](https://caniuse.com/dragndrop)).
  Classroom smartboards often run Android-based browsers, so native DnD alone is not safe.
- **Pointer Events** — one event model for mouse, pen and touch; Baseline widely available since
  July 2020; needs `touch-action: none` on drag handles so the browser doesn't turn the gesture into
  a pan (`pointercancel`), and `setPointerCapture()` to keep tracking off-element
  ([MDN Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)).
  A hand-written drag (~100–150 lines: ghost element, `elementFromPoint` hit-testing, auto-scroll)
  is feasible and dependency-free, but auto-scroll and edge cases are the owner's to maintain.
- **SortableJS** (recommended) — MIT, no dependencies, "Supports touch devices and modern browsers";
  lists sharing a `group` value can exchange items; `forceFallback` uses its own non-native drag on
  every device for consistent behaviour; `delayOnTouchOnly` avoids accidental drags while scrolling
  on touch; `onEnd`/`onAdd` report `from`, `to`, `oldIndex`, `newIndex`; optional Swap plugin
  ([SortableJS README](https://github.com/SortableJS/Sortable)). Each Group becomes one Sortable list.
  - Framework caveat: SortableJS moves DOM nodes itself, which fights Svelte/Preact's DOM ownership.
    Standard pattern: in `onEnd`, undo the DOM move (put the node back) and apply the move to app
    state, letting the framework re-render. Keep this in one small wrapper component.
  - Locked Groups: set `disabled`/`put: false` on that Group's list so Manual moves can't enter or leave it
    (if the map decides Locks should block Manual moves).
- **Non-drag fallback (recommended alongside):** tap a Student, then tap the target Group. Works on
  every pointer, is easier on a large smartboard than a long drag, and gives a keyboard-accessible path.

## 5. Projector view, print, copy-as-text

No stack dependency: a projector view is a CSS layout (large type, high contrast, optional
Fullscreen API); print uses `@media print` styles; copy-as-text builds a plain-text string and
writes it with the Clipboard API (`navigator.clipboard.writeText`, HTTPS only — Pages serves HTTPS).

## Trade-offs

- **Svelte + Vite**: best developer ergonomics and structure as features grow; cost is Node/npm,
  a lockfile, an Actions workflow, and periodic dependency updates.
- **Preact + HTM no-build**: nothing to install or build, deploy = push; cost is weaker tooling
  (no types, no scoped CSS, string templates) and reliance on a CDN or vendored module files.
- **localStorage**: simplest possible persistence; durability is no worse than IndexedDB but is
  still *not* durable on Safari/iPad without regular use, so Export is mandatory, not optional.
- **SortableJS**: proven touch support with little code; cost is the DOM-ownership workaround
  and one runtime dependency.

## Open questions surfaced

1. Shared origin: accept `pladypus.github.io` (namespaced keys; any other Pages site on the account can
   read the data) or use a custom domain for an isolated origin?
2. Should the app nudge iPad/iOS Teachers to "Add to Home Screen" to escape Safari's 7-day eviction?
   (Possibly make it a minimal PWA/manifest.)
3. Export file format: one Roster per file vs a whole-workspace backup file (or both), and versioning.
4. Do Locks block Manual moves into/out of a Locked Group?
5. Is tap-to-move required as an accessibility path alongside drag?
