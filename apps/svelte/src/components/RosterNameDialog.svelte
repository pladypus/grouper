<script lang="ts">
  import { getStore } from "../state.svelte";
  import Modal from "./Modal.svelte";

  interface Props {
    mode: "new" | "rename";
  }

  // New Roster name and Rename Roster. Refusals ("There's already a Roster called…") show inline.
  const { mode }: Props = $props();
  const store = getStore();
  const id = $props.id();

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
    // A new Roster is empty, so go straight to adding its Students.
    if (creating) store.openStudents("edit");
  }

  const buttonClass = "rounded-md border border-line bg-panel px-3 py-1.5 hover:border-mute";
  const primaryClass = "rounded-md border border-accent bg-accent px-3 py-1.5 font-semibold text-accent-ink";
</script>

<Modal title={mode === "new" ? "New Roster" : "Rename Roster"} onclose={close}>
  <form {onsubmit}>
    <label for="{id}-name" class="mb-1 block text-sm font-semibold">Roster name</label>
    <input
      id="{id}-name"
      bind:value={name}
      oninput={() => (error = null)}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      autocomplete="off"
      class="w-full rounded-md border border-line bg-field px-2 py-1.5"
      {@attach (input) => {
        input.focus();
        input.select();
      }}
    />
    {#if error}
      <p id="{id}-error" role="alert" class="mt-2 rounded-md border border-bad-line bg-bad-soft px-2.5 py-1.5 text-bad">
        {error}
      </p>
    {/if}
    <div class="mt-4 flex justify-end gap-2">
      <button type="button" class={buttonClass} onclick={close}>Cancel</button>
      <button type="submit" class={primaryClass}>{mode === "new" ? "Create" : "Rename"}</button>
    </div>
  </form>
</Modal>
