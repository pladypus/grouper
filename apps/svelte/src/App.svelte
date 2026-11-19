<script lang="ts">
  import { APP_NAME } from "@grouper/core";
  // Per-icon import: the package barrel makes Vite and Vitest compile every icon.
  import Shuffle from "@lucide/svelte/icons/shuffle";
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
  <h1 class="flex items-center gap-3 text-5xl font-bold">
    <Shuffle aria-hidden="true" class="size-10" />
    {APP_NAME}
  </h1>
  <p class="text-zinc-600 dark:text-zinc-400">Svelte app placeholder.</p>
</main>
