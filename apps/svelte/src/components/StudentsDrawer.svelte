<script lang="ts">
  import { presentCount, removedStudentMessage, type Student } from "@grouper/core";
  import Pencil from "@lucide/svelte/icons/pencil";
  import X from "@lucide/svelte/icons/x";
  import { getStore, type StudentsMode } from "../state.svelte";

  const store = getStore();
  const roster = $derived(store.roster!);

  let newName = $state("");
  let addError = $state<string | null>(null);
  let undoError = $state<string | null>(null);
  let renaming = $state<{ id: string; name: string; error: string | null } | null>(null);

  function setMode(mode: StudentsMode) {
    store.setStudentsMode(mode);
    renaming = null;
    addError = null;
    undoError = null;
  }

  function add(event: SubmitEvent) {
    event.preventDefault();
    const result = store.addStudent(newName);
    if (!result.ok) {
      addError = result.message;
      return;
    }
    newName = "";
    addError = null;
  }

  function startRename(student: Student) {
    renaming = { id: student.id, name: student.name, error: null };
  }

  function saveRename(event: SubmitEvent) {
    event.preventDefault();
    if (!renaming) return;
    const result = store.renameStudent(renaming.id, renaming.name);
    if (!result.ok) renaming.error = result.message;
    else renaming = null;
  }

  function remove(student: Student) {
    if (renaming?.id === student.id) renaming = null;
    undoError = null;
    store.removeStudent(student.id);
  }

  function undo() {
    const result = store.undoRemove();
    undoError = result.ok ? null : result.message;
  }

  const focus = (input: HTMLInputElement) => {
    input.focus();
    input.select();
  };

  const seg = "flex-1 border border-line bg-panel p-2 aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-panel";
  const field = "min-w-0 flex-1 rounded-md border border-line bg-field px-2 py-[5px]";
  const button = "rounded-md border border-line bg-panel px-2.5 py-1 hover:border-mute";
  const refusal = "mt-1.5 rounded-md border border-bad-line bg-bad-soft px-2.5 py-1.5 text-bad";
</script>

<div class="fixed inset-0 z-10 bg-black/40" aria-hidden="true" onclick={() => store.closeDrawer()}></div>
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="students-title"
  class="fixed inset-y-0 right-0 z-11 w-[min(440px,100%)] overflow-auto bg-panel p-4 shadow-[-8px_0_30px_rgba(0,0,0,.25)]"
>
  <header class="mb-2.5 flex items-center justify-between">
    <h2 id="students-title" class="text-lg font-bold">Students</h2>
    <button type="button" class={button} onclick={() => store.closeDrawer()}>Done</button>
  </header>

  <div class="mb-3 flex" role="group" aria-label="Mode">
    <button
      type="button"
      class="{seg} rounded-l-lg"
      aria-pressed={store.studentsMode === "attendance"}
      onclick={() => setMode("attendance")}>Attendance</button
    >
    <button
      type="button"
      class="{seg} rounded-r-lg border-l-0"
      aria-pressed={store.studentsMode === "edit"}
      onclick={() => setMode("edit")}>Edit list</button
    >
  </div>

  {#if store.studentsMode === "attendance"}
    {#if roster.students.length === 0}
      <p class="text-mute">No Students yet. Add them in Edit list.</p>
    {:else}
      <p class="text-sm text-mute">
        Tap a name to mark them Absent or Present. {presentCount(roster)} of {roster.students.length} Present.
      </p>
      <div class="my-2.5 flex flex-wrap gap-2">
        {#each roster.students as student (student.id)}
          <button
            type="button"
            class="rounded-[10px] border px-3.5 py-2.5 text-base aria-pressed:border-ok aria-pressed:bg-ok-soft aria-[pressed=false]:border-line aria-[pressed=false]:bg-off aria-[pressed=false]:text-mute aria-[pressed=false]:line-through"
            aria-pressed={student.present}
            onclick={() => store.togglePresent(student.id)}>{student.name}</button
          >
        {/each}
      </div>
    {/if}
  {:else}
    {#if store.removed}
      <div
        role="status"
        class="mb-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-lg bg-accent-soft px-3.5 py-2.5"
      >
        <span>{removedStudentMessage(store.removed)}</span>
        <button type="button" class={button} onclick={undo}>Undo</button>
      </div>
      {#if undoError}
        <p role="alert" class={refusal}>{undoError}</p>
      {/if}
    {/if}

    <form class="flex gap-1.5" onsubmit={add} novalidate>
      <input
        class={field}
        aria-label="Student name"
        placeholder="Add a Student"
        bind:value={newName}
        oninput={() => (addError = null)}
        aria-invalid={addError ? "true" : undefined}
        {@attach (input) => input.focus()}
      />
      <button type="submit" class={button}>Add</button>
    </form>
    {#if addError}
      <p role="alert" class={refusal}>{addError}</p>
    {/if}

    <ul class="my-2.5" aria-label="Students on {roster.name}">
      {#each roster.students as student (student.id)}
        <li class="border-b border-line px-1 py-1.5">
          {#if renaming?.id === student.id}
            <form class="flex gap-1.5" onsubmit={saveRename} novalidate>
              <input
                class={field}
                aria-label="New name for {student.name}"
                bind:value={renaming.name}
                oninput={() => renaming && (renaming.error = null)}
                aria-invalid={renaming.error ? "true" : undefined}
                {@attach focus}
              />
              <button type="submit" class={button}>Save</button>
              <button type="button" class={button} onclick={() => (renaming = null)}>Cancel</button>
            </form>
            {#if renaming.error}
              <p role="alert" class={refusal}>{renaming.error}</p>
            {/if}
          {:else}
            <div class="flex items-center gap-1">
              <span class="flex-1">{student.name}</span>
              <button
                type="button"
                class="inline-flex items-center gap-1 px-1 text-mute hover:text-ink"
                aria-label="Rename {student.name}"
                onclick={() => startRename(student)}
              >
                <Pencil aria-hidden="true" class="size-4" />Rename
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1 px-1 text-mute hover:text-bad"
                aria-label="Remove {student.name} from the Roster"
                onclick={() => remove(student)}
              >
                <X aria-hidden="true" class="size-4" />Remove
              </button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
