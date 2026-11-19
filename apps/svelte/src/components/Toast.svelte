<script lang="ts" module>
  export const TOAST_MS = 3000;
</script>

<script lang="ts">
  import { getStore } from "../state.svelte";

  const store = getStore();

  // SPEC §8 Toasts: top-centre, role="status", about 3 s. The live region is always rendered.
  $effect(() => {
    if (!store.toast) return;
    const timer = setTimeout(() => (store.toast = null), TOAST_MS);
    return () => clearTimeout(timer);
  });
</script>

<div role="status" class="pointer-events-none fixed left-1/2 top-4 z-40 max-w-[90vw] -translate-x-1/2">
  {#if store.toast}
    <p class="rounded-lg bg-[#111] px-4 py-2.5 text-white shadow-lg">{store.toast}</p>
  {/if}
</div>
