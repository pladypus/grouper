# Stack and hosting (#3, #8, #11)

| Concern | Decision |
|---|---|
| Framework | **React 19**, picked by a bake-off ([below](#framework-bake-off), [ADR 0001](../adr/0001-react.md)). A plain Vite single-page app (no Next), TypeScript. |
| State | No state library: `useReducer` + context (`src/state.tsx`). The domain operations (shuffle, swap, lock, Pair checks) are pure functions in core (`src/lib/`) that the reducer calls. |
| Styling | Tailwind v4 via `@tailwindcss/vite`. The prototype's theme tokens become `@theme` variables (light and dark); Group hues are set per card as CSS custom properties. The print layout uses `print:` variants. |
| Icons | Lucide (`lucide-react`). |
| Drag and drop | dnd-kit (`@dnd-kit/core`), on mouse and touch. App state owns Group membership; a drop is turned into a swap, and the library never reorders lists by itself. Tap-to-swap is the fallback. |
| Storage | `localStorage`, JSON, all keys prefixed `grouper:` (see [Storage](storage.md)). |
| Offline | Web app manifest + icon, and a service worker that precaches the built app (`vite-plugin-pwa`, `registerType: 'autoUpdate'`). New versions take effect on the next launch, with no update prompt. |
| Solver | Hand-written, dependency-free, runs synchronously on the main thread (no Web Worker). |
| Tests | Vitest. Core logic gets unit tests; UI gets component tests with Testing Library in jsdom (`@testing-library/react`). |
| Hosting | GitHub Pages from `pladypus/grouper`, Pages source = GitHub Actions, custom domain `grouper.pladypus.dev` (so Vite `base: '/'`). |
| Crawlers | School web filters categorise a domain by crawling it without running JS (#63), so `index.html` describes Grouper as a classroom tool for teachers on its own: a descriptive title, meta description, canonical link, Open Graph/Twitter tags, `WebApplication` JSON-LD with `applicationCategory: EducationalApplication`, and a few paragraphs of static text inside `#root` that React replaces when it mounts. `public/` serves a `robots.txt` that allows everything and a one-URL `sitemap.xml`. The manifest description uses the same wording. |

**TypeScript** throughout.

## Framework bake-off

Research #3 chose Svelte on the assumption that the owner was a non-specialist, but the owner's other web projects are React 19 + Tailwind v4. So the first slice (#12, #14, #15, #16, #18, #19) was built twice, as `apps/react` and `apps/svelte` over a shared `packages/core` in npm workspaces, and compared in [`docs/bake-off.md`](https://github.com/pladypus/grouper/blob/8efcda7/docs/bake-off.md). The owner picked React (#26, [ADR 0001](../adr/0001-react.md)), the Svelte app was deleted, and the repo was flattened to one Vite app at the root ([README Layout](../../README.md#layout)). Everything after the pick (#17, #20–#25) is built once.

## Repo upkeep (copied from the owner's `mortgage-calculator` repo when the build starts)

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
