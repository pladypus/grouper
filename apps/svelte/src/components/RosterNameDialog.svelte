<script lang="ts">
  import { getStore } from "../state.svelte";
  import Modal from "./Modal.svelte";

  interface Props {
    mode: "new" | "rename";
  }

  const { mode }: Props = $props();
  const store = getStore();

  // svelte-ignore state_referenced_locally
  let name = $state(mode === "rename" ? (store.roster?.name ?? "") : "");
  let error = $state<string | null>(null);

  function close() {
    store.dialog = null;
  }

  function onsubmit(event: SubmitEvent) {
    event.preventDefault();
    const creating = mode === "new";
    const result = creating ? store.createRoster(name) : store.renameRoster(name);
    if (!result.ok) {
      error = result.message;
      return;
    }
    close();
    // A new Roster is empty: go straight to adding its Students.
    if (creating) store.openStudents("edit");
  }

  const focus = (input: HTMLInputElement) => {
    input.focus();
    input.select();
  };
</script>

<Modal title={mode === "new" ? "New Roster" : "Rename Roster"} onclose={close}>
  <form class="flex flex-col gap-3" {onsubmit} novalidate>
    <label class="flex flex-col gap-1">
      <span class="text-sm font-semibold text-mute">Roster name</span>
      <input
        class="rounded-md border border-line bg-field px-2 py-[5px]"
        bind:value={name}
        oninput={() => (error = null)}
        placeholder="e.g. Period 2"
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? "roster-name-error" : undefined}
        {@attach focus}
      />
    </label>
    {#if error}
      <p id="roster-name-error" role="alert" class="rounded-md border border-bad-line bg-bad-soft px-2.5 py-1.5 text-bad">
        {error}
      </p>
    {/if}
    <div class="flex justify-end gap-2">
      <button type="button" class="rounded-md border border-line bg-panel px-3 py-1.5 hover:border-mute" onclick={close}>
        Cancel
      </button>
      <button type="submit" class="rounded-md bg-accent px-4 py-1.5 font-semibold text-accent-ink hover:opacity-90">
        {mode === "new" ? "Create" : "Rename"}
      </button>
    </div>
  </form>
</Modal>
