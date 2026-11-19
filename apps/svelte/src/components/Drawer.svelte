<script lang="ts" module>
  export const drawerButtonClass = "rounded-md border border-line bg-panel px-2.5 py-1 hover:border-mute";
  /** A refusal under a form (red line, SPEC §8). */
  export const drawerErrorClass = "my-1.5 rounded-md border border-bad-line bg-bad-soft px-2.5 py-1.5 text-bad";
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { getStore } from "../state.svelte";

  // A side drawer (Students, Pairs): backdrop, titled dialog, "Done". Escape is handled by App.
  const { title, children }: { title: string; children: Snippet } = $props();
  const store = getStore();
  const uid = $props.id();
  const titleId = `${uid}-title`;
</script>

<div class="fixed inset-0 z-10 bg-black/40" aria-hidden="true" onclick={() => store.closeDrawer()}></div>
<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<aside
  role="dialog"
  aria-modal="true"
  aria-labelledby={titleId}
  class="fixed inset-y-0 right-0 z-[11] w-[min(440px,100%)] overflow-auto bg-panel p-4 shadow-[-8px_0_30px_rgba(0,0,0,.25)]"
>
  <!-- A div, not <header>: jsdom and some screen readers would count it as another banner. -->
  <div class="mb-2.5 flex items-center justify-between">
    <h2 id={titleId} class="text-lg font-bold">{title}</h2>
    <button type="button" class={drawerButtonClass} onclick={() => store.closeDrawer()}>Done</button>
  </div>
  {@render children()}
</aside>
