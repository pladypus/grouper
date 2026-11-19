<script lang="ts">
  import { boardLayout, groupFlags, groupMembers } from "@grouper/core";
  import { getStore } from "../state.svelte";
  import GroupCard from "./GroupCard.svelte";

  // The Group cards. Off phones the container is measured (ResizeObserver) and boardLayout picks the
  // column count and card size; flex-wrap + justify-center centres an incomplete last row.
  const store = getStore();
  const board = $derived(store.board);
  const roster = $derived(store.roster!);
  const phone = $derived(store.phone);
  /** The Rules each Group breaks (SPEC §7), re-checked on every change and never stored. */
  const flags = $derived(groupFlags(board, roster));

  let tiles: HTMLDivElement;
  let space = $state({ width: 0, height: 0 });

  $effect(() => {
    if (phone) return;
    const measure = () => {
      space = { width: tiles.clientWidth, height: tiles.clientHeight };
    };
    measure();
    // jsdom (tests) has no ResizeObserver and no layout: cards then go unsized.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(tiles);
    return () => observer.disconnect();
  });

  const layout = $derived(boardLayout(space.width, space.height, board.groups.length));
  // Whole pixels so rounding never pushes a card onto the next row.
  const size = $derived(
    !phone && layout.cardWidth > 0 && layout.cardHeight > 0
      ? { width: Math.floor(layout.cardWidth), height: Math.floor(layout.cardHeight) }
      : null,
  );
</script>

<div
  bind:this={tiles}
  class={phone ? "flex flex-col gap-[14px]" : "flex min-h-0 flex-1 flex-wrap content-start justify-center gap-[14px]"}
>
  {#each board.groups as group, index (group.id)}
    <GroupCard {group} {index} members={groupMembers(board, group, roster)} flags={flags[group.id] ?? []} {size} {phone} />
  {/each}
</div>
