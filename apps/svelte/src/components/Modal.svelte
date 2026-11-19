<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    role?: "dialog" | "alertdialog";
    onclose: () => void;
    children: Snippet;
  }

  const { title, role = "dialog", onclose, children }: Props = $props();
  const id = $props.id();
</script>

<div class="fixed inset-0 z-30 bg-black/40" aria-hidden="true" onclick={onclose}></div>
<div
  {role}
  aria-modal="true"
  aria-labelledby="{id}-title"
  class="fixed top-[15vh] left-1/2 z-31 w-[min(420px,calc(100%-32px))] -translate-x-1/2 rounded-[14px] bg-panel p-5 shadow-2xl"
>
  <h2 id="{id}-title" class="mb-3 text-lg font-bold">{title}</h2>
  {@render children()}
</div>
