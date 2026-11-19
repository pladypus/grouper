<script lang="ts">
  import { deleteRosterConfirmMessage } from "@grouper/core";
  import { getStore } from "../state.svelte";
  import Modal from "./Modal.svelte";

  const store = getStore();
  let error = $state<string | null>(null);

  function close() {
    store.dialog = null;
  }

  function confirm() {
    const result = store.deleteRoster();
    if (!result.ok) {
      error = result.message;
      return;
    }
    close();
  }
</script>

<Modal title="Delete Roster" role="alertdialog" onclose={close}>
  {#if store.roster}
    <p class="mb-4">{deleteRosterConfirmMessage(store.roster)}</p>
  {/if}
  {#if error}
    <p role="alert" class="mb-4 rounded-md border border-bad-line bg-bad-soft px-2.5 py-1.5 text-bad">{error}</p>
  {/if}
  <div class="flex justify-end gap-2">
    <button
      type="button"
      class="rounded-md border border-line bg-panel px-3 py-1.5 hover:border-mute"
      onclick={close}
      {@attach (button) => button.focus()}
    >
      Cancel
    </button>
    <button type="button" class="rounded-md bg-bad px-4 py-1.5 font-semibold text-panel hover:opacity-90" onclick={confirm}>
      Delete Roster
    </button>
  </div>
</Modal>
