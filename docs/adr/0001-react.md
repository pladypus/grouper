# 0001: React for the UI

Status: accepted, 2026-11-19 ([#26](https://github.com/pladypus/grouper/issues/26))

## Context

Research #3 chose Svelte, assuming the owner was new to web frameworks. The owner's other web projects are React 19 + Tailwind v4, so the first slice (#12, #14, #15, #16, #18, #19) was built twice, in `apps/react` and `apps/svelte`, over one shared core, and compared in [the bake-off report](../bake-off.md). The owner ran both locally.

## Decision

React 19 in a plain Vite app: `useReducer` + context for state, dnd-kit (`@dnd-kit/core`) for drag, `lucide-react` for icons, Testing Library for component tests. The Svelte app is deleted and the repo is flattened to one app (core in `src/lib/`, UI in `src/components/`).

Reasons, in the owner's words: "let's stick with react since I'm more familiar with it ... Behavior wise I don't notice any notable difference between the 2."

## Consequences

From the report (measured at `5ccba8e`):

- **Bundle:** the main thing given up. React's production JS is 101.3 kB gzip against Svelte's 53.7 kB, so Svelte's was about half the size. Once #25 adds offline precaching, it is a one-off download per version.
- **Code size:** React's UI is slightly larger (2,083 source lines against 1,903).
- **Drag:** dnd-kit reports the Student under the pointer itself, so no app-side drag glue is needed (Svelte needed a 119-line `drag.ts`), and the tests run the library's real mouse and touch handling.
- **Tooling:** builds stay on TypeScript 7 alone; `tsc -b && vite build` took 0.66 s against Svelte's 3.40 s (`svelte-check` pinned TypeScript 6).
- **Known awkwardness kept:** Shuffle runs in commands, not the reducer (it is random), and commands run each core operation once to learn of a refusal and again in the reducer.
- Every ticket after the pick (#17, #20–#25) is built once, in React.
