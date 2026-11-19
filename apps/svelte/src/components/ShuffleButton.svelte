<script lang="ts">
  import { canShuffle, keepsLockedText, NEED_TWO_PRESENT_MESSAGE, presentCount, shuffleButtonLabel } from "@grouper/core";
  import { getStore } from "../state.svelte";

  // SPEC §8 top bar item 7: Shuffle with no Groups, Reshuffle after ("keeps 2 Locked" when any Group
  // is Locked); disabled below 2 Present.
  const store = getStore();
  const enabled = $derived(canShuffle(presentCount(store.roster!)));
  const keeps = $derived(keepsLockedText(store.board));

  const baseClass =
    "inline-flex items-center justify-center rounded-[10px] bg-accent text-xl font-extrabold leading-[1.1] text-accent-ink disabled:cursor-not-allowed disabled:opacity-50";
  /** Top bar: "keeps N Locked" sits small under the label. */
  const barClass = `${baseClass} flex-col px-7 py-[9px]`;
  /** Phones: pinned to the bottom of the screen (SPEC §8), "keeps N Locked" beside the label. */
  const pinnedClass = `${baseClass} fixed inset-x-3 bottom-3 z-20 flex-row gap-2.5 p-3.5 shadow-[0_8px_24px_rgba(0,0,0,.25)]`;
</script>

<button
  type="button"
  disabled={!enabled}
  title={enabled ? undefined : NEED_TWO_PRESENT_MESSAGE}
  onclick={() => store.shuffle()}
  class={store.phone ? pinnedClass : barClass}
>
  {shuffleButtonLabel(store.board)}{#if keeps}{" "}<small class="text-xs font-medium opacity-85">{keeps}</small>{/if}
</button>
