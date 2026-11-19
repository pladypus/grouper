<script lang="ts">
  import { canDeleteRoster, ONLY_ROSTER_MESSAGE } from "@grouper/core";
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
  import { getStore, type Dialog } from "../state.svelte";

  // The ⋯ menu beside the Roster picker (SPEC §8 top bar item 1). Export and Import come later.
  const store = getStore();
  const menuId = $props.id();
  let open = $state(false);
  let button = $state<HTMLButtonElement>();
  let menu = $state<HTMLDivElement>();
  const canDelete = $derived(canDeleteRoster(store.state));

  function close(refocus = true) {
    open = false;
    if (refocus) button?.focus();
  }

  $effect(() => {
    if (!open || !menu) return;
    menu.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu?.contains(target) && !button?.contains(target)) open = false;
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  });

  function onkeydown(event: KeyboardEvent) {
    const items = [...(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") close();
    else if (event.key === "Tab") open = false;
    else if (event.key === "ArrowDown") items[(index + 1) % items.length]?.focus();
    else if (event.key === "ArrowUp") items[(index - 1 + items.length) % items.length]?.focus();
    else if (event.key === "Home") items[0]?.focus();
    else if (event.key === "End") items.at(-1)?.focus();
    else return;
    event.preventDefault();
  }

  function choose(dialog: Dialog) {
    close(false);
    store.dialog = dialog;
  }

  function chooseDelete() {
    close(false);
    if (canDelete) store.dialog = "delete-roster";
    else store.showToast(ONLY_ROSTER_MESSAGE);
  }

  const itemClass =
    "block w-full rounded-lg px-3 py-2 text-left font-semibold hover:bg-bg focus:bg-bg focus:outline-none";
</script>

<div class="relative">
  <button
    bind:this={button}
    type="button"
    aria-label="Roster options"
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls={open ? menuId : undefined}
    onclick={() => (open = !open)}
    class="inline-grid size-9 place-items-center rounded-lg border border-line bg-panel hover:border-mute"
  >
    <Ellipsis aria-hidden="true" class="size-[18px]" />
  </button>
  {#if open}
    <div
      bind:this={menu}
      id={menuId}
      role="menu"
      tabindex="-1"
      aria-label="Roster options"
      {onkeydown}
      class="absolute left-0 top-full z-20 mt-1 flex w-56 flex-col gap-0.5 rounded-xl border border-line bg-panel p-1.5 shadow-xl"
    >
      <button type="button" role="menuitem" tabindex="-1" class={itemClass} onclick={() => choose("new-roster")}>
        New Roster
      </button>
      <button type="button" role="menuitem" tabindex="-1" class={itemClass} onclick={() => choose("rename-roster")}>
        Rename
      </button>
      <button
        type="button"
        role="menuitem"
        tabindex="-1"
        aria-disabled={!canDelete || undefined}
        class="{itemClass} {canDelete ? 'text-bad' : 'text-mute'}"
        onclick={chooseDelete}
      >
        Delete Roster
      </button>
    </div>
  {/if}
</div>
