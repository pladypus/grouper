# What deploys the site after a Dependabot auto-merge?

Research for [#11](https://github.com/pladypus/grouper/issues/11). Researched 2026-11-18.

## The problem, confirmed

`pladypus/mortgage-calculator` enables auto-merge from a `pull_request` workflow with
`gh pr merge --auto --squash` and `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`. Its deploy
workflow runs on `push` to `main`, `workflow_dispatch`, and a daily `schedule`.

What actually happened there:

- Dependabot PR #4 was merged at 2026-11-10T01:27:09Z, with `mergedBy` = `app/github-actions`
  (`gh pr list -R pladypus/mortgage-calculator --state merged --author app/dependabot --json mergedBy`).
  So the auto-merge feature's eventual merge is attributed to `github-actions[bot]`, the
  identity of the `GITHUB_TOKEN` that enabled it.
- Its merge commit `7cc5e76` has no `push` run of `deploy.yml`. The first deploy of it was the
  `schedule` run at 03:01 that night (`gh run list -R pladypus/mortgage-calculator --workflow deploy.yml`).

GitHub documents why: "When you use the repository's `GITHUB_TOKEN` to perform tasks, events
triggered by the `GITHUB_TOKEN` ... will not create a new workflow run", except that
"`workflow_dispatch` and `repository_dispatch` events always create workflow runs", and
`pull_request` `opened`/`synchronize`/`reopened` create runs that need approval. "Other
`pull_request` activity types (such as `labeled`, `edited`, or `closed`) do not create workflow
runs." ([Triggering a workflow from a workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow);
same rule in [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows):
"With the exception of `workflow_dispatch` and `repository_dispatch`, other `GITHUB_TOKEN`-triggered
events do not create workflow runs at all.")

## Options

| Option | Works? | Cost |
|---|---|---|
| A. `schedule` deploy (mortgage-calculator's way) | Yes, but up to a day late | Daily no-op deploys; schedules can be delayed under load and are disabled after 60 days without activity in a public repo ([events doc, `schedule`](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)), needing mortgage-calculator's undocumented keepalive hack |
| B. `pull_request_target: types: [closed]` + `merged` check | **No** | The `closed` event is caused by the `GITHUB_TOKEN` merge, and `closed` is listed as not creating runs. Also carries `pull_request_target`'s "untrusted code" warning |
| C. `workflow_run` on another workflow | Not directly | No workflow runs *after* the merge to chain from: Verify and the auto-merge workflow both run on the PR before it merges. `workflow_run` could start a write-token workflow when Verify finishes, but that is before the merge, so it would have to do the merge itself and then still dispatch the deploy (option D with more moving parts). Docs warn running untrusted code under `workflow_run` "may lead to security vulnerabilities" |
| D. **`workflow_dispatch` from the auto-merge workflow once the PR is merged** | **Yes** (documented exception) | No secrets. The auto-merge job stays on a runner, polling, until the PR merges (a few minutes; free in a public repo). Needs `actions: write` |
| E. GitHub App installation token for `gh pr merge --auto` | Yes (merge then attributed to the App, so its `push` triggers workflows as usual) | Create and install an App; store its client ID and private key as **Dependabot** secrets, because Dependabot-triggered runs get "a read-only `GITHUB_TOKEN`" and "The only secrets available to the workflow are Dependabot secrets" ([troubleshooting Dependabot on Actions](https://docs.github.com/en/code-security/dependabot/troubleshooting-dependabot/troubleshooting-dependabot-on-github-actions)). Uses [`actions/create-github-app-token@v3`](https://github.com/actions/create-github-app-token) |
| F. Fine-grained PAT for `gh pr merge --auto` | Yes (merge attributed to the owner) | A long-lived personal credential in Dependabot secrets that expires and must be rotated; merges appear as the owner |

The docs recommend E or F in general: "If you do want to trigger a workflow from within a
workflow run, you can use a GitHub App installation access token or a personal access token
instead of `GITHUB_TOKEN`", storing the App ID/private key or the PAT as secrets
([trigger-a-workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)).
That E/F's merge commit fires `push` is inferred from the same rule (only `GITHUB_TOKEN`-caused
events are suppressed) and from #4's attribution; no doc page says so for auto-merge specifically.

## Recommendation: D, dispatch the deploy after the merge

Keep mortgage-calculator's auto-merge workflow, and add a step that waits for the PR to merge and
then runs `gh workflow run deploy.yml`. It relies only on the documented `workflow_dispatch`
exception, needs no secret, App or PAT, and lets `deploy.yml` drop the `schedule` trigger and
keepalive job.

`deploy.yml` triggers:

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
```

`dependabot-auto-merge.yml`:

```yaml
name: Dependabot auto-merge

on: pull_request

permissions:
  contents: write
  pull-requests: write
  actions: write # gh workflow run

# A rebase re-runs this workflow; let only the newest run wait for the merge.
concurrency:
  group: dependabot-auto-merge-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  # A merge made with GITHUB_TOKEN doesn't trigger deploy.yml's push run, but a
  # workflow_dispatch made with it does, so wait for the merge and dispatch the deploy.
  auto-merge:
    if: github.event.pull_request.user.login == 'dependabot[bot]'
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - id: metadata
        uses: dependabot/fetch-metadata@v3
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
      - run: |
          echo "Updating $DEPENDENCIES ($UPDATE_TYPE)"
          gh pr merge --auto --squash "$PR_URL"
        env:
          DEPENDENCIES: ${{ steps.metadata.outputs.dependency-names }}
          UPDATE_TYPE: ${{ steps.metadata.outputs.update-type }}
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
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

Notes:

- `actions: write` is the permission the dispatch endpoint needs: "`POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches` | write" under Actions, usable by installation tokens
  ([permissions required for GitHub Apps](https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps)).
  Dependabot-triggered runs start read-only, but "you can use the `permissions` key in your
  workflow to increase the access for the token" ([troubleshooting](https://docs.github.com/en/code-security/dependabot/troubleshooting-dependabot/troubleshooting-dependabot-on-github-actions)),
  which is how mortgage-calculator already gets `contents: write`.
- `workflow_dispatch` only fires if `deploy.yml` is on the default branch, which it will be
  ([events doc](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch)).
- The auto-merge job is not a required check, so auto-merge does not wait for it; it just watches.
  If Verify fails the PR stays open and the job times out after 30 minutes (red run, a useful signal).
  A failed PR that is later fixed and merged by hand fires `push` normally, since the owner's merge is not `GITHUB_TOKEN`.
- `deploy.yml`'s existing `concurrency: { group: pages, cancel-in-progress: true }` absorbs any double dispatch.

Tradeoffs vs E: D idles a runner for a few minutes per Dependabot PR (monthly, grouped, public
repo, so free) and the deploy shows as `workflow_dispatch` rather than `push`. E is cleaner if more
`push`-triggered workflows appear later, at the price of an App and two Dependabot secrets to look after.
