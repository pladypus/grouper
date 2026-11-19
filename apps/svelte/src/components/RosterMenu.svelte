<script lang="ts">
  import { canDeleteRoster, ONLY_ROSTER_MESSAGE } from "@grouper/core";
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
  import Pencil from "@lucide/svelte/icons/pencil";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import { getStore, type Dialog } from "../state.svelte";

  const store = getStore();
  let open = $state(false);

  function choose(dialog: Dialog) {
    open = false;
    store.dialog = dialog;
  }

  function onkeydown(event: KeyboardEvent) {
    if (open && event.key === "Escape") {
      event.stopPropagation();
      open = false;
    }
  }

  const item =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold hover:bg-bg disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent";
</script>

<svelte:window {onkeydown} />

<div class="relative">
  <button
    type="button"
    class="inline-grid size-9 place-items-center rounded-lg border border-line bg-panel hover:border-mute"
    aria-label="Roster options"
    aria-haspopup="menu"
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    <Ellipsis aria-hidden="true" class="size-[18px]" />
  </button>
  {#if open}
    <!-- Click outside closes the menu. -->
    <div class="fixed inset-0 z-20" aria-hidden="true" onclick={() => (open = false)}></div>
    <div
      role="menu"
      aria-label="Roster options"
      class="absolute left-0 top-full z-21 mt-1 flex w-60 flex-col gap-0.5 rounded-xl border border-line bg-panel p-1.5 shadow-lg"
    >
      <button type="button" role="menuitem" class={item} onclick={() => choose("new-roster")}>
        <Plus aria-hidden="true" class="size-4 flex-none" />New Roster
      </button>
      <button type="button" role="menuitem" class={item} onclick={() => choose("rename-roster")}>
        <Pencil aria-hidden="true" class="size-4 flex-none" />Rename
      </button>
      {#if canDeleteRoster(store.state)}
        <button type="button" role="menuitem" class="{item} text-bad" onclick={() => choose("delete-roster")}>
          <Trash2 aria-hidden="true" class="size-4 flex-none" />Delete Roster
        </button>
      {:else}
        <button
          type="button"
          role="menuitem"
          class="{item} items-start text-bad"
          disabled
          aria-label="Delete Roster"
          aria-describedby="only-roster"
        >
          <Trash2 aria-hidden="true" class="mt-0.5 size-4 flex-none" />
          <span>
            Delete Roster
            <span id="only-roster" class="block text-xs font-normal text-mute">{ONLY_ROSTER_MESSAGE}</span>
          </span>
        </button>
      {/if}
    </div>
  {/if}
</div>
