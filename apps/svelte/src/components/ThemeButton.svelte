<script lang="ts">
  import Contrast from "@lucide/svelte/icons/contrast";
  import Moon from "@lucide/svelte/icons/moon";
  import Sun from "@lucide/svelte/icons/sun";
  import { getStore } from "../state.svelte";

  const store = getStore();
  const icons = { auto: Contrast, light: Sun, dark: Moon };
  const Icon = $derived(icons[store.theme]);
</script>

<button
  type="button"
  class="inline-grid size-9 place-items-center rounded-lg border border-line bg-panel hover:border-mute"
  aria-label="Theme: {store.theme}"
  title="Theme: {store.theme} (click to change)"
  onclick={() => store.cycleTheme()}
>
  <Icon aria-hidden="true" class="size-[18px]" />
</button>
