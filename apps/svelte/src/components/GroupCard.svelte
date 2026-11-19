<script lang="ts">
  import {
    groupSizeLabel,
    groupTitle,
    nameColumns,
    nameFontSize,
    PHONE_NAME_FONT_SIZE,
    type Group,
    type MemberView,
  } from "@grouper/core";

  interface Props {
    group: Group;
    index: number;
    members: readonly MemberView[];
    /** Card size from boardLayout, or null when unmeasured / on phones (the card sizes itself). */
    size: { width: number; height: number } | null;
    phone: boolean;
  }

  // SPEC §8 Group card: coloured header "Group 1 · 4 students", names sized to fit the card.
  const { group, index, members, size, phone }: Props = $props();
  const headingId = $derived(`group-${group.id}-heading`);

  /** The Group's own colour, from --hue and the theme's --hue-s / --hue-l (styles.css). */
  const hueBg = "bg-[hsl(var(--hue)_var(--hue-s)_var(--hue-l))]";

  const columns = $derived(phone || !size ? 1 : nameColumns(members.length, size.width, size.height));
  const fontSize = $derived(
    phone
      ? PHONE_NAME_FONT_SIZE
      : nameFontSize({
          cardWidth: size?.width ?? 0,
          cardHeight: size?.height ?? 0,
          memberCount: members.length,
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
</script>

<section
  aria-labelledby={headingId}
  {style}
  class="flex flex-none flex-col overflow-hidden rounded-[14px] border border-line bg-panel shadow-[0_1px_3px_rgba(0,0,0,.08)]{phone
    ? ' w-full'
    : ''}"
>
  <!-- A div, not <header>: jsdom and some screen readers would count it as another banner. -->
  <div class="flex items-center gap-2.5 py-2.5 pl-4 pr-3 text-on-c {hueBg}">
    <!-- The space sits outside the span so the card's accessible name is "Group 1 · 4 students". -->
    <h2 id={headingId} class="text-[clamp(17px,1.5vw,24px)] font-extrabold tracking-[.01em]">
      {groupTitle(index)}{" "}<span class="text-sm font-semibold opacity-85">{`· ${groupSizeLabel(group)}`}</span>
    </h2>
  </div>
  <ul class={listClass} style="font-size: {fontSize}px">
    {#each members as member (member.id)}
      <li
        class="flex min-w-0 items-center gap-3 rounded-[10px] px-[.45em] py-[.22em] font-medium leading-[1.2]{phone
          ? ' min-h-11'
          : ''}{member.faded ? ' text-mute line-through' : ''}"
      >
        <span aria-hidden="true" class="size-2.5 flex-none rounded-full {hueBg}"></span>
        <span class="min-w-0 truncate">{member.name}</span>
        {#if member.faded}
          <span class="sr-only">{member.status === "absent" ? " (Absent)" : " (removed)"}</span>
        {/if}
      </li>
    {/each}
  </ul>
</section>
