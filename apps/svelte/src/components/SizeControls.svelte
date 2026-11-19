<script lang="ts">
  import { currentSplit, MIN_TARGET_SIZE, NEED_TWO_PRESENT_MESSAGE, splitInputText, splitText } from "@grouper/core";
  import { getStore, SPLIT_ERROR_ID } from "../state.svelte";

  // SPEC §8 top bar item 4: the "Number of students in group" stepper, the Split in words, and
  // "Edit". A refused Split shows on the board (Board.svelte), so the bar never changes height.
  const store = getStore();
  const roster = $derived(store.roster!);
  const split = $derived(currentSplit(store.board, roster));
  const edited = $derived(store.board.editedSplit !== null);
  const labelId = $props.id();

  /** The sizes being typed in "Edit". */
  let draft = $state("");

  function edit() {
    draft = splitInputText(split);
    store.openSplitEdit();
  }

  function save(event: SubmitEvent) {
    event.preventDefault();
    store.saveSplit(draft);
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    store.closeSplitEdit();
  }

  const linkClass = "px-1 text-accent underline";
  const smallButtonClass = "rounded-md border border-line bg-panel px-2.5 py-1 text-ink hover:border-mute";
</script>

<div class="flex flex-col gap-0.5">
  <span id={labelId} class="text-xs font-semibold uppercase tracking-[.04em] text-mute">
    Number of students in group
  </span>
  <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1">
    <div role="group" aria-labelledby={labelId} class="inline-flex items-center overflow-hidden rounded-lg border border-line">
      <button
        type="button"
        aria-label="Fewer"
        disabled={roster.target <= MIN_TARGET_SIZE}
        onclick={() => store.changeTarget(-1)}
        class="size-8 bg-field text-lg disabled:cursor-not-allowed disabled:opacity-40"
      >
        −
      </button>
      <output aria-labelledby={labelId} class="min-w-[34px] text-center text-lg font-extrabold">
        {roster.target}
      </output>
      <button type="button" aria-label="More" onclick={() => store.changeTarget(1)} class="size-8 bg-field text-lg">
        +
      </button>
    </div>
    {#if !store.splitEditing}
      <span class="text-sm text-mute">
        {#if split.length === 0}
          {NEED_TWO_PRESENT_MESSAGE}
        {:else}
          {splitText(split)}{edited ? " (edited)" : ""}
          <button type="button" class={linkClass} onclick={edit}>Edit</button>
          {#if edited}
            <button type="button" class={linkClass} onclick={() => store.resetSplit()}>Automatic</button>
          {/if}
        {/if}
      </span>
    {:else}
      <form class="flex items-center gap-1.5 text-sm" onsubmit={save}>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          aria-label="Group sizes, comma separated"
          bind:value={draft}
          {onkeydown}
          autofocus
          aria-invalid={store.splitError ? true : undefined}
          aria-describedby={store.splitError ? SPLIT_ERROR_ID : undefined}
          class="w-[130px] rounded-md border border-line bg-field px-2 py-1"
        />
        <button type="submit" class={smallButtonClass}>Save</button>
        <button type="button" class={smallButtonClass} onclick={() => store.closeSplitEdit()}>Cancel</button>
      </form>
    {/if}
  </div>
</div>
