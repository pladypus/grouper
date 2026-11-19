<script lang="ts">
  import {
    PAIR_TYPE_LABELS,
    PAIR_TYPES,
    pairsByType,
    PICK_TWO_STUDENTS_MESSAGE,
    type PairType,
  } from "@grouper/core";
  import X from "@lucide/svelte/icons/x";
  import { getStore } from "../state.svelte";
  import Drawer, { drawerErrorClass } from "./Drawer.svelte";

  // SPEC §8 Pairs drawer: pick two Students, then ＋ Good pair or ＋ Keep apart; the existing Pairs
  // listed by kind, each deletable.
  const store = getStore();
  const roster = $derived(store.roster!);
  const lists = $derived(pairsByType(roster));
  const uid = $props.id();
  const errorId = `${uid}-error`;

  let a = $state("");
  let b = $state("");
  let error = $state<string | null>(null);

  function add(type: PairType) {
    const result = a && b ? store.addPair(type, a, b) : { ok: false as const, message: PICK_TWO_STUDENTS_MESSAGE };
    error = result.ok ? null : result.message;
    if (result.ok) a = b = "";
  }

  /** Each list's heading and what the kind means (from the main-screen prototype). */
  const LISTS: Record<PairType, { heading: string; hint: string }> = {
    "good pair": { heading: "Good pairs", hint: "always in the same Group" },
    "keep apart": { heading: "Keep apart", hint: "never in the same Group" },
  };

  const selectClass = "min-w-0 rounded-md border border-line bg-field px-2 py-1.5";
  const addClass: Record<PairType, string> = {
    "good pair": "flex-1 rounded-md border border-ok bg-panel p-2 font-semibold text-ok",
    "keep apart": "flex-1 rounded-md border border-bad bg-panel p-2 font-semibold text-bad",
  };
</script>

{#snippet picker(label: string, value: string, set: (id: string) => void)}
  <select
    aria-label={label}
    {value}
    onchange={(event) => {
      set(event.currentTarget.value);
      error = null;
    }}
    aria-invalid={error ? true : undefined}
    aria-describedby={error ? errorId : undefined}
    class={selectClass}
  >
    <option value="">Student…</option>
    {#each roster.students as student (student.id)}
      <option value={student.id}>{student.name}</option>
    {/each}
  </select>
{/snippet}

<Drawer title="Pairs">
  <div class="mt-1.5 mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 rounded-[10px] bg-bg p-2.5">
    {@render picker("First Student", a, (id) => (a = id))}
    <span aria-hidden="true">&amp;</span>
    {@render picker("Second Student", b, (id) => (b = id))}
    <div class="col-span-full flex gap-1.5">
      {#each PAIR_TYPES as type (type)}
        <button type="button" class={addClass[type]} onclick={() => add(type)}>＋ {PAIR_TYPE_LABELS[type]}</button>
      {/each}
    </div>
  </div>
  {#if error}
    <p id={errorId} role="alert" class={drawerErrorClass}>{error}</p>
  {/if}
  {#each PAIR_TYPES as type (type)}
    {@const pairs = type === "good pair" ? lists.goodPairs : lists.keepApart}
    <div>
      <h3 class="mt-3.5 mb-1 font-bold">
        {LISTS[type].heading} <small class="font-normal text-mute">{LISTS[type].hint}</small>
      </h3>
      <ul aria-label={LISTS[type].heading}>
        {#each pairs as view (view.pair.id)}
          <li class="flex items-center justify-between gap-1.5 rounded-md px-2 py-1.5 hover:bg-bg">
            <span>{view.label}</span>
            <button
              type="button"
              aria-label="Delete {view.label}"
              onclick={() => store.deletePair(view.pair.id)}
              class="inline-flex items-center rounded px-1 text-mute hover:text-bad"
            >
              <X aria-hidden="true" class="size-4" />
            </button>
          </li>
        {:else}
          <li class="px-2 py-1.5 text-mute">None yet</li>
        {/each}
      </ul>
    </div>
  {/each}
</Drawer>
