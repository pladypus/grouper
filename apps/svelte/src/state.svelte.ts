// App state as Svelte 5 runes. Every domain change goes through a pure @grouper/core operation; this
// module only holds the results, the UI's own bits (open drawer, dialog, Undo) and the storage wiring.

import { getContext, setContext } from "svelte";
import {
  addStudent,
  boardAfterRosterChange,
  createRoster,
  currentRoster,
  deleteRoster,
  editSplit,
  EMPTY_BOARD,
  isPhoneWidth,
  loadAppState,
  loadTheme,
  nextTheme,
  randomId,
  removeStudent,
  renameRoster,
  renameStudent,
  requestPersistentStorage,
  resetSplit,
  restoreStudent,
  saveAppState,
  saveTheme,
  selectRoster,
  setTargetSize,
  shuffle,
  togglePresent,
  updateRoster,
  type AppState,
  type Board,
  type IdGenerator,
  type RemovedStudent,
  type Rng,
  type Roster,
  type StorageLike,
  type StudentId,
  type Theme,
} from "@grouper/core";

export type StudentsMode = "attendance" | "edit";
export type Dialog = "new-roster" | "rename-roster" | "delete-roster" | null;

/** Id of the board notice showing a refused Split, for the Edit box's aria-describedby. */
export const SPLIT_ERROR_ID = "split-error";

/** What a form shows after the Teacher submits: nothing, or the refusal sentence from core. */
export type Outcome = { ok: true } | { ok: false; message: string };

export interface StoreOptions {
  /** `browserStorage()` in the app; a fake (or null for "unavailable") in tests. */
  storage: StorageLike | null;
  newId?: IdGenerator;
  /** The Shuffle's randomness; defaults to Math.random (tests pass a seeded one). */
  rng?: Rng;
  /** Passed to requestPersistentStorage; defaults to `navigator.storage`. */
  storageManager?: { persist?: () => Promise<boolean> } | null;
}

export class GrouperStore {
  #state = $state.raw<AppState>({ rosters: [], currentId: null });
  /** The Groups on screen. Never saved; kept in step with the open Roster by the `state` setter. */
  board = $state.raw<Board>(EMPTY_BOARD);
  /** False when storage couldn't be read or written at startup. */
  available = $state(true);
  /** Result of the last save. */
  lastSaveOk = $state(true);
  theme = $state<Theme>("auto");

  drawer = $state<"students" | null>(null);
  studentsMode = $state<StudentsMode>("attendance");
  dialog = $state<Dialog>(null);
  /** The last removed Student, while their Undo notice is showing. */
  removed = $state.raw<RemovedStudent | null>(null);
  /** The toast's message (SPEC §8 Toasts), or null. */
  toast = $state<string | null>(null);

  /** The Split "Edit" box is open. */
  splitEditing = $state(false);
  /** The refusal from the last Split "Edit" Save, shown on the board. */
  splitError = $state<string | null>(null);
  /** The viewport width, bound to the window by App: phones get one column and a pinned Reshuffle. */
  viewportWidth = $state(typeof window === "undefined" ? 1024 : window.innerWidth);

  readonly #storage: StorageLike | null;
  readonly #newId: IdGenerator;
  readonly #rng: Rng | undefined;
  readonly #storageManager: StoreOptions["storageManager"];
  #persistRequested = false;

  constructor({ storage, newId = randomId, rng, storageManager }: StoreOptions) {
    this.#storage = storage;
    this.#newId = newId;
    this.#rng = rng;
    this.#storageManager =
      storageManager !== undefined ? storageManager : (globalThis.navigator as Navigator | undefined)?.storage;
    const loaded = loadAppState(storage);
    this.state = loaded.state;
    this.available = loaded.available;
    this.theme = loadTheme(storage);
  }

  /** Every Roster and the open one. Replaced, never mutated (core operations return new objects). */
  get state(): AppState {
    return this.#state;
  }

  /** Every AppState change comes through here, so the Board follows the open Roster (SPEC §7 Lifecycle). */
  set state(next: AppState) {
    const before = currentRoster(this.#state);
    const after = currentRoster(next);
    this.board = boardAfterRosterChange(this.board, before, after);
    if (before?.id !== after?.id) {
      this.splitEditing = false;
      this.splitError = null;
    }
    this.#state = next;
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

  // --- Groups --------------------------------------------------------------------------------

  /** One column and a pinned Reshuffle at phone width (SPEC §8). */
  get phone(): boolean {
    return isPhoneWidth(this.viewportWidth);
  }

  /** The stepper: Target size ± 1 (saved per Roster), then back to the derived Split. */
  changeTarget(delta: number): void {
    const roster = this.roster;
    if (!roster) return;
    this.state = updateRoster(this.state, roster.id, (r) => setTargetSize(r, r.target + delta));
    this.board = resetSplit(this.board);
  }

  /** "Automatic": back to the derived Split. */
  resetSplit(): void {
    this.board = resetSplit(this.board);
  }

  openSplitEdit(): void {
    this.splitEditing = true;
    this.splitError = null;
  }

  closeSplitEdit(): void {
    this.splitEditing = false;
    this.splitError = null;
  }

  /** Split "Edit" → Save: keeps the typed sizes for the next Shuffle, or shows the refusal. */
  saveSplit(text: string): Outcome {
    const roster = this.roster;
    if (!roster) return { ok: true };
    const result = editSplit(this.board, roster, text);
    if (!result.ok) {
      this.splitError = result.message;
      return result;
    }
    this.board = result.board;
    this.closeSplitEdit();
    return { ok: true };
  }

  /** Shuffle / Reshuffle: new Groups for the Present Students, or the refusal as a toast. */
  shuffle(): Outcome {
    const roster = this.roster;
    if (!roster) return { ok: true };
    const result = shuffle(roster, this.board, { rng: this.#rng, newId: this.#newId });
    if (!result.ok) {
      this.showToast(result.message);
      return result;
    }
    this.board = result.board;
    return { ok: true };
  }

  // --- UI --------------------------------------------------------------------------------------

  openStudents(mode: StudentsMode): void {
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

  showToast(message: string): void {
    this.toast = message;
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
