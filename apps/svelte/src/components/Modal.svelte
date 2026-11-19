<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    role?: "dialog" | "alertdialog";
    onclose: () => void;
    /** Id of the element that describes the dialog (alertdialog's message). */
    describedBy?: string;
    children: Snippet;
  }

  // A centred modal with a dimmed backdrop. Escape (handled in App) or a backdrop click closes it.
  const { title, role = "dialog", onclose, describedBy, children }: Props = $props();
  const titleId = $props.id();
</script>

<div class="fixed inset-0 z-30 grid place-items-center p-4">
  <div class="absolute inset-0 bg-black/40" aria-hidden="true" onclick={onclose}></div>
  <div
    {role}
    aria-modal="true"
    aria-labelledby={titleId}
    aria-describedby={describedBy}
    class="relative w-full max-w-md rounded-xl bg-panel p-5 shadow-2xl"
  >
    <h2 id={titleId} class="mb-3 text-lg font-bold">{title}</h2>
    {@render children()}
  </div>
</div>
