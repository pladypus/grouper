<script lang="ts">
  import { EMPTY_BOARD_MESSAGE, hasGroups, OUT_OF_DATE_MESSAGE, STORAGE_UNAVAILABLE_MESSAGE } from "@grouper/core";
  import Plus from "@lucide/svelte/icons/plus";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import UserPlus from "@lucide/svelte/icons/user-plus";
  import { getStore, SPLIT_ERROR_ID } from "../state.svelte";
  import Groups from "./Groups.svelte";

  // The area below the top bar: notices, then the Groups or an empty state (SPEC §8 Board).
  // On phones the pinned Reshuffle covers the bottom 84 px, so leave room for it.
  const store = getStore();
  const showGroups = $derived(!!store.roster && hasGroups(store.board));

  const emptyClass =
    "grid flex-1 place-items-center rounded-[14px] border-2 border-dashed border-line p-10 text-center text-[22px] text-mute";
  const actionClass =
    "mt-4 inline-flex items-center gap-2 rounded-[10px] bg-accent px-5 py-2.5 text-lg font-bold text-accent-ink";
  const badClass = "mb-2.5 rounded-lg border border-bad-line bg-bad-soft px-3.5 py-2.5 text-bad";
</script>

<main class="flex min-h-0 flex-1 flex-col overflow-auto px-4 pt-3 {store.phone && store.roster ? 'pb-[84px]' : 'pb-4'}">
  {#if !store.saving}
    <p
      role="alert"
      class="mb-2.5 flex items-center gap-2.5 rounded-lg border border-warn-line bg-warn-soft px-3.5 py-2.5 text-warn"
    >
      <TriangleAlert aria-hidden="true" class="size-4 flex-none" />
      {STORAGE_UNAVAILABLE_MESSAGE}
    </p>
  {/if}
  {#if store.roster && store.splitError}
    <p id={SPLIT_ERROR_ID} role="alert" class={badClass}>{store.splitError}</p>
  {/if}
  {#if showGroups && store.board.outOfDate}
    <div
      role="status"
      class="mb-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-lg border border-warn-line bg-warn-soft px-3.5 py-2.5"
    >
      <span>⚠ {OUT_OF_DATE_MESSAGE}</span>
      <button
        type="button"
        class="rounded-md border border-line bg-panel px-2.5 py-1 font-semibold hover:border-mute"
        onclick={() => store.shuffle()}
      >
        Reshuffle
      </button>
    </div>
  {/if}
  {#if !store.roster}
    <section class={emptyClass} aria-labelledby="welcome">
      <div>
        <h1 id="welcome" class="text-[26px] font-bold text-ink">Welcome to Grouper</h1>
        <p class="mt-1">Make a Roster for your class to get started.</p>
        <button type="button" class={actionClass} onclick={() => (store.dialog = "new-roster")}>
          <Plus aria-hidden="true" class="size-5" />
          New Roster
        </button>
      </div>
    </section>
  {:else if showGroups}
    <Groups />
  {:else if store.roster.students.length === 0}
    <div class={emptyClass}>
      <div>
        <p>No Students on this Roster yet.</p>
        <button type="button" class={actionClass} onclick={() => store.openStudents("edit")}>
          <UserPlus aria-hidden="true" class="size-5" />
          Add Students
        </button>
      </div>
    </div>
  {:else}
    <div class={emptyClass}>{EMPTY_BOARD_MESSAGE}</div>
  {/if}
</main>
