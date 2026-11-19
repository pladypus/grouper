// App state as Svelte 5 runes. Every domain change goes through a pure @grouper/core operation; this
// module only holds the results, the UI's own bits (open drawer, dialog, Undo) and the storage wiring.

import { getContext, setContext } from "svelte";
import {
  addStudent,
  createRoster,
  currentRoster,
  deleteRoster,
  loadAppState,
  loadTheme,
  nextTheme,
  randomId,
  removeStudent,
  renameRoster,
  renameStudent,
  requestPersistentStorage,
  restoreStudent,
  saveAppState,
  saveTheme,
  selectRoster,
  togglePresent,
  updateRoster,
  type AppState,
  type IdGenerator,
  type RemovedStudent,
  type Roster,
  type StorageLike,
  type StudentId,
  type Theme,
} from "@grouper/core";

export type StudentsMode = "attendance" | "edit";
export type Dialog = "new-roster" | "rename-roster" | "delete-roster" | null;

/** What a form shows after the Teacher submits: nothing, or the refusal sentence from core. */
export type Outcome = { ok: true } | { ok: false; message: string };

export interface StoreOptions {
  /** `browserStorage()` in the app; a fake (or null for "unavailable") in tests. */
  storage: StorageLike | null;
  newId?: IdGenerator;
  /** Passed to requestPersistentStorage; defaults to `navigator.storage`. */
  storageManager?: { persist?: () => Promise<boolean> } | null;
}

export class GrouperStore {
  /** Every Roster and the open one. Replaced, never mutated (core operations return new objects). */
  state = $state.raw<AppState>({ rosters: [], currentId: null });
  /** False when storage couldn't be read or written at startup. */
  available = $state(true);
  /** Result of the last save. */
  lastSaveOk = $state(true);
  theme = $state<Theme>("auto");

  drawer = $state<"students" | null>(null);
  studentsMode = $state<StudentsMode>("attendance");
  dialog = $state<Dialog>(null);
  /** The last removed Student, for the Undo notice. */
  removed = $state.raw<RemovedStudent | null>(null);

  readonly #storage: StorageLike | null;
  readonly #newId: IdGenerator;
  readonly #storageManager: StoreOptions["storageManager"];
  #persistRequested = false;

  constructor({ storage, newId = randomId, storageManager }: StoreOptions) {
    this.#storage = storage;
    this.#newId = newId;
    this.#storageManager =
      storageManager !== undefined ? storageManager : (globalThis.navigator as Navigator | undefined)?.storage;
    const loaded = loadAppState(storage);
    this.state = loaded.state;
    this.available = loaded.available;
    this.theme = loadTheme(storage);
  }

  get roster(): Roster | undefined {
    return currentRoster(this.state);
  }

  /** False while Rosters aren't being saved: show STORAGE_UNAVAILABLE_MESSAGE. */
  get saving(): boolean {
    return this.available && this.lastSaveOk;
  }

  /** Saves the AppState (call after every change). Asks once per session to keep storage. */
  save(): void {
    const result = saveAppState(this.#storage, this.state);
    this.lastSaveOk = result.ok;
    if (result.ok && this.state.rosters.length > 0 && !this.#persistRequested) {
      this.#persistRequested = true;
      requestPersistentStorage(this.#storageManager);
    }
  }

  // --- Rosters -------------------------------------------------------------------------------

  createRoster(name: string): Outcome {
    const result = createRoster(this.state, name, this.#newId);
    if (!result.ok) return result;
    this.state = result.state;
    this.removed = null;
    return { ok: true };
  }

  renameRoster(name: string): Outcome {
    if (!this.state.currentId) return { ok: true };
    const result = renameRoster(this.state, this.state.currentId, name);
    if (!result.ok) return result;
    this.state = result.state;
    return { ok: true };
  }

  deleteRoster(): Outcome {
    if (!this.state.currentId) return { ok: true };
    const result = deleteRoster(this.state, this.state.currentId);
    if (!result.ok) return result;
    this.state = result.state;
    this.removed = null;
    return { ok: true };
  }

  selectRoster(id: string): void {
    this.state = selectRoster(this.state, id);
    this.removed = null;
  }

  // --- Students ------------------------------------------------------------------------------

  addStudent(name: string): Outcome {
    const roster = this.roster;
    if (!roster) return { ok: true };
    const result = addStudent(roster, name, this.#newId);
    if (!result.ok) return result;
    this.#replace(result.roster);
    return { ok: true };
  }

  renameStudent(studentId: StudentId, name: string): Outcome {
    const roster = this.roster;
    if (!roster) return { ok: true };
    const result = renameStudent(roster, studentId, name);
    if (!result.ok) return result;
    this.#replace(result.roster);
    return { ok: true };
  }

  removeStudent(studentId: StudentId): void {
    const roster = this.roster;
    if (!roster) return;
    const result = removeStudent(roster, studentId);
    if (!result.ok) return;
    this.#replace(result.roster);
    this.removed = result.removed;
  }

  undoRemove(): Outcome {
    const removed = this.removed;
    if (!removed) return { ok: true };
    const roster = this.state.rosters.find((r) => r.id === removed.rosterId);
    if (!roster) return { ok: true };
    const result = restoreStudent(roster, removed);
    if (!result.ok) return result;
    this.#replace(result.roster);
    this.removed = null;
    return { ok: true };
  }

  togglePresent(studentId: StudentId): void {
    if (!this.state.currentId) return;
    this.state = updateRoster(this.state, this.state.currentId, (r) => togglePresent(r, studentId));
  }

  // --- UI --------------------------------------------------------------------------------------

  openStudents(mode: StudentsMode = this.studentsMode): void {
    this.studentsMode = mode;
    this.drawer = "students";
  }

  closeDrawer(): void {
    this.drawer = null;
    this.removed = null;
  }

  setStudentsMode(mode: StudentsMode): void {
    this.studentsMode = mode;
    this.removed = null;
  }

  /** Theme button: auto → light → dark → auto, remembered per browser. */
  cycleTheme(): void {
    this.theme = nextTheme(this.theme);
    saveTheme(this.#storage, this.theme);
  }

  #replace(roster: Roster): void {
    this.state = updateRoster(this.state, roster.id, () => roster);
  }
}

const KEY = Symbol("grouper-store");

export function setStore(store: GrouperStore): GrouperStore {
  return setContext(KEY, store);
}

export function getStore(): GrouperStore {
  return getContext<GrouperStore>(KEY);
}
