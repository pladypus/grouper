<script lang="ts">
  import { presentCount, removedStudentMessage, type Student } from "@grouper/core";
  import Pencil from "@lucide/svelte/icons/pencil";
  import X from "@lucide/svelte/icons/x";
  import { getStore, type StudentsMode } from "../state.svelte";

  // SPEC §8 Students drawer: Attendance (tap to toggle) and Edit list (add, rename, remove).
  const store = getStore();
  const roster = $derived(store.roster!);
  const id = $props.id();

  let name = $state("");
  let error = $state<string | null>(null);
  let undoError = $state<string | null>(null);
  let editing = $state<{ id: string; name: string; error: string | null } | null>(null);

  function switchMode(mode: StudentsMode) {
    store.setStudentsMode(mode);
    editing = null;
    error = null;
    undoError = null;
  }

  function add(event: SubmitEvent) {
    event.preventDefault();
    const result = store.addStudent(name);
    error = result.ok ? null : result.message;
    if (result.ok) name = "";
  }

  function startRename(student: Student) {
    editing = { id: student.id, name: student.name, error: null };
  }

  function saveRename(event: SubmitEvent) {
    event.preventDefault();
    if (!editing) return;
    const result = store.renameStudent(editing.id, editing.name);
    if (result.ok) editing = null;
    else editing.error = result.message;
  }

  function remove(student: Student) {
    if (editing?.id === student.id) editing = null;
    undoError = null;
    store.removeStudent(student.id);
  }

  function undo() {
    const result = store.undoRemove();
    undoError = result.ok ? null : result.message;
  }

  const segClass = (on: boolean) =>
    `flex-1 border px-2 py-2 first:rounded-l-lg last:rounded-r-lg last:border-l-0 ${
      on ? "border-ink bg-ink text-panel" : "border-line bg-panel"
    }`;
  const buttonClass = "rounded-md border border-line bg-panel px-2.5 py-1 hover:border-mute";
  const errorClass = "my-1.5 rounded-md border border-bad-line bg-bad-soft px-2.5 py-1.5 text-bad";
  const fieldClass = "min-w-0 flex-1 rounded-md border border-line bg-field px-2 py-1.5";
  const rowClass = "flex items-center gap-1.5 border-b border-line px-1 py-1.5";
  const iconButtonClass = "inline-flex items-center gap-1 rounded px-1 text-mute";
</script>

<div class="fixed inset-0 z-10 bg-black/40" aria-hidden="true" onclick={() => store.closeDrawer()}></div>
<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<aside
  role="dialog"
  aria-modal="true"
  aria-labelledby="{id}-title"
  class="fixed inset-y-0 right-0 z-[11] w-[min(440px,100%)] overflow-auto bg-panel p-4 shadow-[-8px_0_30px_rgba(0,0,0,.25)]"
>
  <header class="mb-2.5 flex items-center justify-between">
    <h2 id="{id}-title" class="text-lg font-bold">Students</h2>
    <button type="button" class={buttonClass} onclick={() => store.closeDrawer()}>Done</button>
  </header>
  <div class="mb-3 flex" role="group" aria-label="Mode">
    <button
      type="button"
      aria-pressed={store.studentsMode === "attendance"}
      class={segClass(store.studentsMode === "attendance")}
      onclick={() => switchMode("attendance")}
    >
      Attendance
    </button>
    <button
      type="button"
      aria-pressed={store.studentsMode === "edit"}
      class={segClass(store.studentsMode === "edit")}
      onclick={() => switchMode("edit")}
    >
      Edit list
    </button>
  </div>

  {#if store.studentsMode === "attendance"}
    {#if roster.students.length === 0}
      <p class="text-mute">No Students yet. Add them in Edit list.</p>
    {:else}
      <p class="text-sm text-mute">
        Tap a name to mark them Absent or Present. {presentCount(roster)} of {roster.students.length} Present.
      </p>
      <ul class="my-2.5 flex flex-wrap gap-2" aria-label="Attendance">
        {#each roster.students as student (student.id)}
          <li>
            <button
              type="button"
              aria-pressed={student.present}
              onclick={() => store.togglePresent(student.id)}
              class="rounded-[10px] border px-3.5 py-2.5 text-base {student.present
                ? 'border-ok bg-ok-soft'
                : 'border-line bg-off text-mute line-through'}"
            >
              {student.name}
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {:else}
    {#if store.removed}
      <div role="status" class="mb-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-lg bg-accent-soft px-3.5 py-2.5">
        {removedStudentMessage(store.removed)}
        <button type="button" class={buttonClass} onclick={undo}>Undo</button>
        {#if undoError}
          <p class="w-full text-bad">{undoError}</p>
        {/if}
      </div>
    {/if}
    <form class="flex items-center gap-1.5" onsubmit={add}>
      <input
        bind:value={name}
        oninput={() => (error = null)}
        aria-label="Student name"
        placeholder="Add a Student"
        autocomplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        class={fieldClass}
        {@attach (input) => input.focus()}
      />
      <button type="submit" class={buttonClass}>Add</button>
    </form>
    {#if error}
      <p id="{id}-error" role="alert" class={errorClass}>{error}</p>
    {/if}
    <ul class="my-2.5" aria-label="Students">
      {#each roster.students as student (student.id)}
        {#if editing?.id === student.id}
          <li class="border-b border-line px-1 py-1.5">
            <form class="flex items-center gap-1.5" onsubmit={saveRename}>
              <input
                bind:value={editing.name}
                oninput={() => editing && (editing.error = null)}
                onkeydown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    editing = null;
                  }
                }}
                aria-label="New name for {student.name}"
                autocomplete="off"
                aria-invalid={editing.error ? true : undefined}
                aria-describedby={editing.error ? `${id}-rename-error` : undefined}
                class={fieldClass}
                {@attach (input) => {
                  input.focus();
                  input.select();
                }}
              />
              <button type="submit" class={buttonClass}>Save</button>
              <button type="button" class={buttonClass} onclick={() => (editing = null)}>Cancel</button>
            </form>
            {#if editing.error}
              <p id="{id}-rename-error" role="alert" class={errorClass}>{editing.error}</p>
            {/if}
          </li>
        {:else}
          <li class={rowClass}>
            <span class="flex-1">{student.name}</span>
            <button
              type="button"
              class="{iconButtonClass} hover:text-ink"
              aria-label="Rename {student.name}"
              onclick={() => startRename(student)}
            >
              <Pencil aria-hidden="true" class="size-4" />
            </button>
            <button
              type="button"
              class="{iconButtonClass} hover:text-bad"
              aria-label="Remove {student.name}"
              onclick={() => remove(student)}
            >
              <X aria-hidden="true" class="size-4" />
              Remove
            </button>
          </li>
        {/if}
      {/each}
    </ul>
  {/if}
</aside>
