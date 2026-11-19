<script lang="ts">
  import { deleteRosterConfirmMessage } from "@grouper/core";
  import { getStore } from "../state.svelte";
  import Modal from "./Modal.svelte";

  // Asks before Delete Roster, which can't be undone.
  const store = getStore();
  const messageId = $props.id();

  function close() {
    store.dialog = null;
  }

  function confirm() {
    const result = store.deleteRoster();
    if (!result.ok) store.showToast(result.message);
    close();
  }

  const buttonClass = "rounded-md border border-line bg-panel px-3 py-1.5 hover:border-mute";
  const dangerClass = "rounded-md border border-bad bg-bad px-3 py-1.5 font-semibold text-panel";
</script>

<Modal title="Delete Roster" role="alertdialog" onclose={close} describedBy={messageId}>
  <p id={messageId}>{store.roster ? deleteRosterConfirmMessage(store.roster) : ""}</p>
  <div class="mt-4 flex justify-end gap-2">
    <button type="button" class={buttonClass} onclick={close} {@attach (button) => button.focus()}>Cancel</button>
    <button type="button" class={dangerClass} onclick={confirm}>Delete Roster</button>
  </div>
</Modal>
