<script lang="ts">
  import { presentCount } from "@grouper/core";
  // Per-icon imports: the package barrel makes Vite and Vitest compile every icon.
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Users from "@lucide/svelte/icons/users";
  import { getStore } from "../state.svelte";
  import RosterMenu from "./RosterMenu.svelte";
  import ThemeButton from "./ThemeButton.svelte";

  const store = getStore();
</script>

<header
  class="sticky top-0 z-5 flex flex-none flex-wrap items-center gap-x-5 gap-y-2.5 border-b border-line bg-panel px-4 py-2.5 max-[760px]:px-3"
>
  {#if store.roster}
    {@const roster = store.roster}
    <div class="flex items-center gap-2">
      <select
        aria-label="Roster"
        class="rounded-md border border-line bg-field px-2.5 py-1.5 text-[17px] font-bold"
        value={roster.id}
        onchange={(event) => store.selectRoster(event.currentTarget.value)}
      >
        {#each store.state.rosters as option (option.id)}
          <option value={option.id}>{option.name}</option>
        {/each}
      </select>
      <RosterMenu />
    </div>
    <div
      class="flex items-center gap-2 border-l border-line pl-5 max-[760px]:order-last max-[760px]:basis-full max-[760px]:border-l-0 max-[760px]:pl-0"
    >
      <button
        type="button"
        class="inline-flex items-center gap-[7px] whitespace-nowrap rounded-full border border-line bg-panel px-3 py-[7px] font-semibold hover:border-mute max-[760px]:flex-1 max-[760px]:justify-center"
        aria-haspopup="dialog"
        onclick={() => store.openStudents()}
      >
        <Users aria-hidden="true" class="size-[18px] flex-none" />
        <span><b class="text-accent">{presentCount(roster)}</b>/{roster.students.length} Present</span>
        <ChevronRight aria-hidden="true" class="-ml-0.5 size-3.5 flex-none text-mute" />
      </button>
    </div>
  {/if}
  <span class="flex-1"></span>
  <ThemeButton />
</header>
