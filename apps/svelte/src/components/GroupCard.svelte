<script lang="ts">
  import {
    canSwap,
    groupSizeLabel,
    groupTitle,
    nameColumns,
    nameFontSize,
    PHONE_NAME_FONT_SIZE,
    type Group,
    type GroupFlag,
    type MemberView,
  } from "@grouper/core";
  import {
    dndzone,
    SHADOW_ITEM_MARKER_PROPERTY_NAME,
    SHADOW_PLACEHOLDER_ITEM_ID,
    SOURCES,
    TRIGGERS,
    type DndEvent,
  } from "svelte-dnd-action";
  import {
    finishPointer,
    refocusStudent,
    stopDoubleTap,
    styleDragOverlay,
    swallowNextClick,
    TOUCH_DRAG_DELAY_MS,
    trackPointer,
  } from "../drag";
  import { getStore } from "../state.svelte";

  interface Props {
    group: Group;
    index: number;
    members: readonly MemberView[];
    /** The Rules this Group breaks (groupFlags), one warning line each. */
    flags: readonly GroupFlag[];
    /** Card size from boardLayout, or null when unmeasured / on phones (the card sizes itself). */
    size: { width: number; height: number } | null;
    phone: boolean;
  }

  // SPEC §8 Group card: coloured header "Group 1 · 4 students", names sized to fit the card, an amber
  // outline and warning lines when flagged. SPEC §7 Manual move: tap a name to select it (solid
  // accent with ✕), or drag it onto a Student in another Group.
  const { group, index, members, flags, size, phone }: Props = $props();
  const store = getStore();
  const headingId = $derived(`group-${group.id}-heading`);

  /** The Group's own colour, from --hue and the theme's --hue-s / --hue-l (styles.css). */
  const hueBg = "bg-[hsl(var(--hue)_var(--hue-s)_var(--hue-l))]";
  /** Its light tint: under the name being dragged over, or on hover while choosing a swap. */
  const hueSoftBg = "bg-[hsl(var(--hue)_var(--hue-s)_var(--hue-soft-l))]";
  const hueSoftHover = "hover:bg-[hsl(var(--hue)_var(--hue-s)_var(--hue-soft-l))]";

  const columns = $derived(phone || !size ? 1 : nameColumns(members.length, size.width, size.height));
  const fontSize = $derived(
    phone
      ? PHONE_NAME_FONT_SIZE
      : nameFontSize({
          cardWidth: size?.width ?? 0,
          cardHeight: size?.height ?? 0,
          memberCount: members.length,
          warningLines: flags.length,
          columns,
        }),
  );
  const style = $derived(
    `--hue: ${group.hue};` + (size && !phone ? ` width: ${size.width}px; height: ${size.height}px;` : ""),
  );
  const listClass = $derived(
    phone
      ? "flex flex-col gap-1 px-3 py-2.5"
      : columns === 2
        ? "grid min-h-0 flex-1 grid-cols-2 content-center gap-x-3 gap-y-1 overflow-hidden px-3 py-2.5"
        : "flex min-h-0 flex-1 flex-col justify-center gap-1 overflow-hidden px-3 py-2.5",
  );
  /** The Student selected or being dragged, or null. */
  const moving = $derived(store.moving);

  function rowLook(member: MemberView, selected: boolean, swappable: boolean, over: boolean): string {
    if (selected) return " bg-accent text-accent-ink";
    let look = member.faded ? " text-mute line-through" : "";
    if (over) look += ` ${hueSoftBg}`;
    else if (swappable) look += ` ${hueSoftHover}`;
    return look;
  }

  // svelte-dnd-action's items: always the Board's members, in order. While one of them is dragged its
  // slot holds the library's placeholder item (drawn faded), so the library can lift the original row
  // out. Whatever the library proposes in consider / finalize is dropped by resetting from the Board.
  interface Row {
    id: string;
    member: MemberView;
    [SHADOW_ITEM_MARKER_PROPERTY_NAME]?: boolean;
  }
  const boardRows = (): Row[] =>
    members.map((member) =>
      member.id === store.dragging
        ? { id: SHADOW_PLACEHOLDER_ITEM_ID, member, [SHADOW_ITEM_MARKER_PROPERTY_NAME]: true }
        : { id: member.id, member },
    );
  let rows = $derived(boardRows());

  function onconsider(e: CustomEvent<DndEvent<Row>>) {
    const { trigger, id, source } = e.detail.info;
    if (trigger === TRIGGERS.DRAG_STARTED && source === SOURCES.POINTER && store.dragging === null) {
      store.startDrag(id);
      trackPointer((over) => (store.dragOver = over));
    }
    rows = boardRows();
  }

  function onfinalize(e: CustomEvent<DndEvent<Row>>) {
    // The library tells both the zone it ended over and the one it came from; drop once.
    const dragged = store.dragging;
    if (dragged !== null && e.detail.info.id === dragged) {
      swallowNextClick();
      store.drop(finishPointer(dragged));
    }
    rows = boardRows();
  }
</script>

<section
  aria-labelledby={headingId}
  {style}
  class="flex flex-none flex-col overflow-hidden rounded-[14px] border bg-panel {flags.length > 0
    ? 'border-warn shadow-[0_0_0_2px_var(--color-warn)]'
    : 'border-line shadow-[0_1px_3px_rgba(0,0,0,.08)]'}{phone ? ' w-full' : ''}{moving !== null && group.locked
    ? ' opacity-55'
    : ''}"
>
  <!-- A div, not <header>: jsdom and some screen readers would count it as another banner. -->
  <div class="flex items-center gap-2.5 py-2.5 pl-4 pr-3 text-on-c {hueBg}">
    <!-- The space sits outside the span so the card's accessible name is "Group 1 · 4 students". -->
    <h2 id={headingId} class="text-[clamp(17px,1.5vw,24px)] font-extrabold tracking-[.01em]">
      {groupTitle(index)}{" "}<span class="text-sm font-semibold opacity-85">{`· ${groupSizeLabel(group)}`}</span>
    </h2>
  </div>
  <ul
    class={listClass}
    style="font-size: {fontSize}px"
    use:dndzone={{
      items: rows,
      type: "student",
      // canMove: nothing in a Locked Group can be picked up.
      dragDisabled: group.locked,
      morphDisabled: true,
      dropAnimationDisabled: true,
      dropTargetStyle: {},
      zoneTabIndex: -1,
      zoneItemTabIndex: -1,
      autoAriaDisabled: true,
      delayTouchStart: TOUCH_DRAG_DELAY_MS,
      transformDraggedElement: (el, data) => styleDragOverlay(el, (data as Row | undefined)?.member.name ?? ""),
    }}
    {onconsider}
    {onfinalize}
  >
    {#each rows as row (row.id)}
      {@const member = row.member}
      {@const selected = store.selected === member.id}
      {@const swappable = moving !== null && moving !== member.id && canSwap(store.board, moving, member.id)}
      {@const over = swappable && store.dragOver === member.id}
      <!-- ontouchend: after a quick tap the library sends its own click, so stop the browser's one. -->
      <li
        data-student-id={member.id}
        class="group/chip flex min-w-0 items-center gap-2 rounded-[10px] px-[.45em] py-[.22em] font-medium leading-[1.2]{phone
          ? ' min-h-11'
          : ''}{rowLook(member, selected, swappable, over)}{row[SHADOW_ITEM_MARKER_PROPERTY_NAME]
          ? ' visible! opacity-40'
          : ''}"
        ontouchend={stopDoubleTap}
      >
        <button
          type="button"
          aria-pressed={selected}
          class="flex min-w-0 flex-1 touch-manipulation select-none items-center gap-3 rounded-md text-left [-webkit-touch-callout:none] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent{group.locked
            ? ' cursor-not-allowed'
            : swappable
              ? ' cursor-pointer'
              : ' cursor-grab'}"
          onclick={() => {
            store.tapStudent(member.id);
            refocusStudent(member.id);
          }}
        >
          <!-- svelte-dnd-action won't start a drag on a press that lands on a <button> itself, so this
               span fills the button and takes the press. -->
          <span class="flex min-w-0 flex-1 items-center gap-3 self-stretch">
            <span aria-hidden="true" class="size-2.5 flex-none rounded-full {hueBg}"></span>
            <span class="min-w-0 truncate">{member.name}</span>
            {#if member.faded}
              <span class="sr-only">{member.status === "absent" ? " (Absent)" : " (removed)"}</span>
            {/if}
            {#if swappable}
              <span
                aria-hidden="true"
                class="ml-auto flex-none text-[.7em] text-[hsl(var(--hue)_var(--hue-s)_var(--hue-l))] {over
                  ? 'inline'
                  : 'hidden group-hover/chip:inline'}">⇄</span
              >
            {/if}
          </span>
        </button>
        {#if selected}
          <button
            type="button"
            aria-label="Cancel swap"
            class="ml-auto flex-none rounded px-1 text-[.6em] opacity-80 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-accent-ink"
            onclick={() => {
              store.cancelSelection();
              refocusStudent(member.id);
            }}>✕</button
          >
        {/if}
      </li>
    {/each}
  </ul>
  {#each flags as flag, i (i)}
    <p class="flex items-center gap-1.5 border-t border-warn-line bg-warn-soft px-3.5 py-1.5 text-sm text-warn">
      {`⚠ ${flag.message}`}
    </p>
  {/each}
</section>
