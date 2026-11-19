<script lang="ts">
  import { STORAGE_UNAVAILABLE_MESSAGE } from "@grouper/core";
  import Plus from "@lucide/svelte/icons/plus";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import { getStore } from "../state.svelte";

  const store = getStore();

  const emptyState =
    "grid flex-1 place-items-center rounded-[14px] border-2 border-dashed border-line p-10 text-center text-[22px] text-mute";
  const primary =
    "inline-flex items-center gap-2 rounded-[10px] bg-accent px-5 py-2.5 text-lg font-bold text-accent-ink hover:opacity-90";
</script>

<main class="flex min-h-0 flex-1 flex-col overflow-auto px-4 pt-3 pb-4">
  {#if !store.saving}
    <p
      role="alert"
      class="mb-2.5 flex items-center gap-2.5 rounded-lg border border-warn-line bg-warn-soft px-3.5 py-2.5 text-warn"
    >
      <TriangleAlert aria-hidden="true" class="size-4 flex-none" />
      <span>{STORAGE_UNAVAILABLE_MESSAGE}</span>
    </p>
  {/if}

  {#if !store.roster}
    <div class={emptyState}>
      <div class="flex flex-col items-center gap-4">
        <h1 class="text-2xl font-bold text-ink">Welcome to Grouper</h1>
        <p>Make a Roster for your class to get started.</p>
        <button type="button" class={primary} onclick={() => (store.dialog = "new-roster")}>
          <Plus aria-hidden="true" class="size-5" />New Roster
        </button>
      </div>
    </div>
  {:else if store.roster.students.length === 0}
    <div class={emptyState}>
      <div class="flex flex-col items-center gap-4">
        <p>No Students on {store.roster.name} yet.</p>
        <button type="button" class={primary} onclick={() => store.openStudents("edit")}>
          <Plus aria-hidden="true" class="size-5" />Add Students
        </button>
      </div>
    </div>
  {:else}
    <div class={emptyState}>Take the roll (✓ Present), then Shuffle.</div>
  {/if}
</main>
