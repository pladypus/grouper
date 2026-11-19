<script lang="ts">
  import { browserStorage, resolveTheme, type IdGenerator, type StorageLike } from "@grouper/core";
  import { GrouperStore, setStore, type StoreOptions } from "./state.svelte";
  import TopBar from "./components/TopBar.svelte";
  import Board from "./components/Board.svelte";
  import StudentsDrawer from "./components/StudentsDrawer.svelte";
  import RosterNameDialog from "./components/RosterNameDialog.svelte";
  import DeleteRosterDialog from "./components/DeleteRosterDialog.svelte";
  import Toast from "./components/Toast.svelte";

  interface Props {
    /** Defaults to the browser's localStorage; tests pass a fake, or null for "unavailable". */
    storage?: StorageLike | null;
    newId?: IdGenerator;
    storageManager?: StoreOptions["storageManager"];
  }

  const { storage, newId, storageManager }: Props = $props();

  // Props are read once: the store lives as long as the app.
  // svelte-ignore state_referenced_locally
  const store = setStore(
    new GrouperStore({ storage: storage === undefined ? browserStorage() : storage, newId, storageManager }),
  );

  // Save on every change to the Rosters (store.state is replaced, never mutated).
  $effect(() => {
    void store.state;
    store.save();
  });

  // Apply the theme to <html data-theme>; while on auto, follow the system as it changes.
  $effect(() => {
    const theme = store.theme;
    const query = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(theme, query?.matches ?? false);
    };
    apply();
    if (theme !== "auto" || !query) return;
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  });

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if (store.dialog) store.dialog = null;
    else if (store.drawer) store.closeDrawer();
  }
</script>

<svelte:window {onkeydown} />

<div class="flex h-dvh flex-col">
  <TopBar />
  <Board />
  <Toast />
</div>

{#if store.drawer === "students" && store.roster}
  <StudentsDrawer />
{/if}

{#if store.dialog === "new-roster"}
  <RosterNameDialog mode="new" />
{:else if store.dialog === "rename-roster" && store.roster}
  <RosterNameDialog mode="rename" />
{:else if store.dialog === "delete-roster" && store.roster}
  <DeleteRosterDialog />
{/if}
