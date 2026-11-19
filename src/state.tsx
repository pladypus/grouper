// App state the React way (spec: stack-and-hosting.md): useReducer + context. Every change goes through the pure
// operations in src/lib; the reducer only routes actions to them. Commands run the same
// operation first so a refusal ("There's already a Sam…") can be returned to the form that asked.
// The Board (Groups on screen, #15) lives next to the AppState and is never saved; after every
// AppState change the reducer runs boardAfterRosterChange so it goes out of date or clears.

import {
  addNames,
  addPair,
  addStudent,
  deletePair,
  boardAfterRosterChange,
  cancelSelection,
  canMove,
  dropStudent,
  tapStudent,
  toggleLock,
  editSplit,
  EMPTY_BOARD,
  resetSplit,
  setTargetSize,
  shuffle,
  createRoster,
  currentRoster,
  deleteRoster,
  loadAppState,
  removeStudent,
  renameRoster,
  renameStudent,
  requestPersistentStorage,
  restoreStudent,
  saveAppState,
  selectRoster,
  togglePresent,
  updateRoster,
  importRosters,
  type AppState,
  type ClashChoice,
  type ImportedResult,
  type ImportedRoster,
  type Board,
  type Rng,
  type IdGenerator,
  type MoveOutcome,
  type Selection,
  type GroupId,
  type PairId,
  type PairType,
  type ShuffleConflict,
  type RemovedStudent,
  type Roster,
  type RosterId,
  type StorageLike,
  type StudentId,
} from "./lib";
import { createContext, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from "react";

export interface State {
  readonly app: AppState;
  /** The last removed Student, while their Undo notice is showing. */
  readonly removed: RemovedStudent | null;
  /** The Groups on screen; in memory only (spec: domain-model.md#group-5). */
  readonly board: Board;
  /**
   * The last Shuffle's Conflict (spec: conflicts.md), shown in the red notice on the board; the Groups stayed
   * as they were. Cleared by the next successful Shuffle and by any Roster change.
   */
  readonly conflict: ConflictNotice | null;
  /**
   * The Student picked by tap / Enter / Space for a swap (spec: lock-and-manual-move.md#manual-move-swap), or null. Cleared by
   * every Shuffle and Roster switch.
   */
  readonly selected: Selection;
  /** The last Manual move sentence for the polite live region ("Ana selected. …", "Swapped …"). */
  readonly announcement: string;
}

export interface ConflictNotice extends ShuffleConflict {
  /** The plain sentence. */
  readonly message: string;
}

export type Action =
  | { type: "createRoster"; name: string; id: string }
  | { type: "renameRoster"; rosterId: RosterId; name: string }
  | { type: "deleteRoster"; rosterId: RosterId }
  | { type: "selectRoster"; rosterId: RosterId }
  | { type: "addStudent"; name: string; id: string }
  /** Add names (spec: add-names.md): `ids` holds one fresh id per name, used in order for the names added. */
  | { type: "addNames"; names: readonly string[]; ids: readonly string[] }
  | { type: "renameStudent"; studentId: StudentId; name: string }
  | { type: "removeStudent"; studentId: StudentId }
  | { type: "togglePresent"; studentId: StudentId }
  | { type: "addPair"; pairType: PairType; a: StudentId; b: StudentId; id: string }
  | { type: "deletePair"; pairId: PairId }
  | { type: "undoRemove" }
  | { type: "dismissUndo" }
  | { type: "stepTarget"; delta: 1 | -1 }
  /** A Board the command already worked out (Shuffle needs randomness, so it can't run in here). */
  | { type: "setBoard"; board: Board }
  /** A Shuffle that hit a Conflict: the Board stays, the notice shows. */
  | { type: "setConflict"; conflict: ConflictNotice }
  | { type: "resetSplit" }
  /** A Manual move outcome (tap, drop, cancel) the command already worked out. */
  | { type: "move"; outcome: MoveOutcome }
  /** The Lock toggle in a Group header (spec: lock-and-manual-move.md#lock). */
  | { type: "toggleLock"; groupId: GroupId }
  /** Import (spec: export-import.md): the AppState with the imported Rosters added, worked out by the command. */
  | { type: "imported"; app: AppState };

/**
 * Applies one action, then keeps the Board in step with the open Roster (out of date after
 * attendance, Student or Pair edits, cleared when another Roster opens) and drops a stale Conflict.
 */
export function reducer(state: State, action: Action): State {
  let next = applyAction(state, action);
  if (next.app === state.app) return next;
  // Another Roster opened: the selection goes with its Groups.
  if (next.selected !== null && currentRoster(next.app)?.id !== currentRoster(state.app)?.id) {
    next = { ...next, selected: null };
  }
  const board = boardAfterRosterChange(next.board, currentRoster(state.app), currentRoster(next.app));
  return board === next.board && next.conflict === null ? next : { ...next, board, conflict: null };
}

/** Refused operations leave the state unchanged (commands report them). */
function applyAction(state: State, action: Action): State {
  const { app } = state;
  const roster = currentRoster(app);
  switch (action.type) {
    case "createRoster": {
      const r = createRoster(app, action.name, () => action.id);
      return r.ok ? { ...state, app: r.state } : state;
    }
    case "renameRoster": {
      const r = renameRoster(app, action.rosterId, action.name);
      return r.ok ? { ...state, app: r.state } : state;
    }
    case "deleteRoster": {
      const r = deleteRoster(app, action.rosterId);
      return r.ok ? { ...state, app: r.state, removed: null } : state;
    }
    case "selectRoster":
      return { ...state, app: selectRoster(app, action.rosterId), removed: null };
    case "addStudent": {
      if (!roster) return state;
      const r = addStudent(roster, action.name, () => action.id);
      return r.ok ? { ...state, app: updateRoster(app, roster.id, () => r.roster) } : state;
    }
    case "addNames": {
      if (!roster) return state;
      let i = 0;
      const r = addNames(roster, action.names, () => action.ids[i++]!);
      return r.roster === roster ? state : { ...state, app: updateRoster(app, roster.id, () => r.roster) };
    }
    case "renameStudent": {
      if (!roster) return state;
      const r = renameStudent(roster, action.studentId, action.name);
      return r.ok ? { ...state, app: updateRoster(app, roster.id, () => r.roster) } : state;
    }
    case "removeStudent": {
      if (!roster) return state;
      const r = removeStudent(roster, action.studentId);
      return r.ok ? { ...state, app: updateRoster(app, roster.id, () => r.roster), removed: r.removed } : state;
    }
    case "togglePresent":
      if (!roster) return state;
      return { ...state, app: updateRoster(app, roster.id, (x) => togglePresent(x, action.studentId)) };
    case "addPair": {
      if (!roster) return state;
      const r = addPair(roster, action.pairType, action.a, action.b, () => action.id);
      return r.ok ? { ...state, app: updateRoster(app, roster.id, () => r.roster) } : state;
    }
    case "deletePair":
      if (!roster) return state;
      return { ...state, app: updateRoster(app, roster.id, (x) => deletePair(x, action.pairId)) };
    case "undoRemove": {
      const { removed } = state;
      const target = removed && app.rosters.find((x) => x.id === removed.rosterId);
      if (!removed || !target) return { ...state, removed: null };
      const r = restoreStudent(target, removed);
      return r.ok ? { ...state, app: updateRoster(app, target.id, () => r.roster), removed: null } : state;
    }
    case "dismissUndo":
      return state.removed ? { ...state, removed: null } : state;
    case "stepTarget": {
      if (!roster) return state;
      const updated = setTargetSize(roster, roster.target + action.delta);
      if (updated === roster) return state;
      // A new Target size goes back to the derived Split; Groups on screen stay up to date.
      return { ...state, app: updateRoster(app, roster.id, () => updated), board: resetSplit(state.board) };
    }
    case "setBoard":
      return { ...state, board: action.board, conflict: null, selected: null };
    case "setConflict":
      return { ...state, conflict: action.conflict, selected: null };
    case "move":
      return {
        ...state,
        board: action.outcome.board,
        selected: action.outcome.selected,
        announcement: action.outcome.announcement ?? "",
      };
    case "resetSplit":
      return { ...state, board: resetSplit(state.board) };
    case "imported":
      return { ...state, app: action.app, removed: null };
    case "toggleLock": {
      const board = toggleLock(state.board, action.groupId);
      // Locking the selected Student's Group drops the selection: a Locked Group is frozen.
      if (state.selected === null || canMove(board, state.selected)) return { ...state, board };
      return { ...state, board, selected: null, announcement: "" };
    }
  }
}

/** A refusal sentence to show, or null when the change was made. */
export type Refusal = string | null;

export interface Rosters {
  readonly state: State;
  readonly roster: Roster | undefined;
  /** False while the browser isn't saving: show STORAGE_UNAVAILABLE_MESSAGE. */
  readonly saving: boolean;
  readonly storage: StorageLike | null;
  /** New Roster, opened; with `names` (the New Roster dialog's class list) they are added to it. */
  createRoster(name: string, names?: readonly string[]): Refusal;
  renameRoster(name: string): Refusal;
  deleteRoster(): Refusal;
  selectRoster(rosterId: RosterId): void;
  addStudent(name: string): Refusal;
  /** Add names to the open Roster, skipping names already on it; returns how many were added. */
  addNames(names: readonly string[]): number;
  renameStudent(studentId: StudentId, name: string): Refusal;
  removeStudent(studentId: StudentId): void;
  togglePresent(studentId: StudentId): void;
  /** ＋ Good pair / ＋ Keep apart in the Pairs drawer; returns the refusal sentence or null. */
  addPair(type: PairType, a: StudentId, b: StudentId): Refusal;
  deletePair(pairId: PairId): void;
  undoRemove(): Refusal;
  dismissUndo(): void;
  /** The "Number of students in group" stepper's − and +. */
  stepTarget(delta: 1 | -1): void;
  /** Saves the Split typed in "Edit"; returns the refusal ("A group of 1 isn't allowed.") or null. */
  editSplit(text: string): Refusal;
  /** Back to the derived Split ("Automatic"). */
  resetSplit(): void;
  /**
   * Shuffle / Reshuffle. A Conflict goes to `state.conflict` (the board's notice) and returns null.
   * Otherwise returns the toast to show, or null: any other refusal (fewer than 2 Present), or with
   * new Groups the "Lock released: …" toast when a Reshuffle released a Lock.
   */
  shuffle(): Refusal;
  /** The Lock toggle in a Group header (never marks the Groups out of date). */
  toggleLock(groupId: GroupId): void;
  /** Tap, Enter or Space on a Student: select, swap or cancel. Returns the refusal toast or null. */
  tapStudent(studentId: StudentId): Refusal;
  /** ✕ or Esc while a Student is selected. */
  cancelSelection(): void;
  /**
   * The end of a drag: `target` is the Student it was dropped onto, or null for anywhere else.
   * Returns the toast ("Drop onto a Student to swap with them.", a Locked refusal) or null.
   */
  dropStudent(dragged: StudentId, target: StudentId | null): Refusal;
  /**
   * Import (spec: export-import.md): adds the Rosters read from a file (Replace or Keep both on a name clash) and
   * opens the first. Returns what was added and skipped, for the toast and the skipped message.
   */
  importRosters(rosters: readonly ImportedRoster[], choice: ClashChoice): ImportedResult[];
}

const RostersContext = createContext<Rosters | null>(null);

export function useRosters(): Rosters {
  const value = useContext(RostersContext);
  if (!value) throw new Error("useRosters must be used inside <RostersProvider>");
  return value;
}

export interface RostersProviderProps {
  /** Where Rosters are saved; null means storage is unavailable. */
  storage: StorageLike | null;
  newId: IdGenerator;
  /** Randomness for Shuffle; tests pass a seeded one (seededRng from ./lib). */
  rng?: Rng;
  children: ReactNode;
}

/** Loads the saved Rosters once, saves after every change, and provides the commands. */
export function RostersProvider({ storage, newId, rng = Math.random, children }: RostersProviderProps) {
  const [loaded] = useState(() => loadAppState(storage));
  const [state, dispatch] = useReducer(reducer, {
    app: loaded.state,
    removed: null,
    board: EMPTY_BOARD,
    conflict: null,
    selected: null,
    announcement: "",
  });
  const [saveOk, setSaveOk] = useState(true);
  const askedToPersist = useRef(false);

  useEffect(() => {
    const { ok } = saveAppState(storage, state.app);
    setSaveOk(ok);
    if (ok && state.app.rosters.length > 0 && !askedToPersist.current) {
      askedToPersist.current = true;
      requestPersistentStorage(globalThis.navigator?.storage);
    }
  }, [storage, state.app]);

  const { app } = state;
  const roster = currentRoster(app);
  // Each command runs the core operation on the current state to learn whether it's refused; the
  // reducer then makes the same change.
  const rosters: Rosters = {
    state,
    roster,
    saving: loaded.available && saveOk,
    storage,
    createRoster(name, names = []) {
      const id = newId();
      const r = createRoster(app, name, () => id);
      if (!r.ok) return r.message;
      dispatch({ type: "createRoster", name, id });
      // The new Roster is open by now, so the names go onto it.
      if (names.length > 0) dispatch({ type: "addNames", names, ids: names.map(() => newId()) });
      return null;
    },
    renameRoster(name) {
      if (!roster) return null;
      const r = renameRoster(app, roster.id, name);
      if (!r.ok) return r.message;
      dispatch({ type: "renameRoster", rosterId: roster.id, name });
      return null;
    },
    deleteRoster() {
      if (!roster) return null;
      const r = deleteRoster(app, roster.id);
      if (!r.ok) return r.message;
      dispatch({ type: "deleteRoster", rosterId: roster.id });
      return null;
    },
    selectRoster(rosterId) {
      dispatch({ type: "selectRoster", rosterId });
    },
    addStudent(name) {
      if (!roster) return null;
      const id = newId();
      const r = addStudent(roster, name, () => id);
      if (!r.ok) return r.message;
      dispatch({ type: "addStudent", name, id });
      return null;
    },
    addNames(names) {
      if (!roster) return 0;
      const ids = names.map(() => newId());
      let i = 0;
      const { added } = addNames(roster, names, () => ids[i++]!);
      if (added.length > 0) dispatch({ type: "addNames", names, ids });
      return added.length;
    },
    renameStudent(studentId, name) {
      if (!roster) return null;
      const r = renameStudent(roster, studentId, name);
      if (!r.ok) return r.message;
      dispatch({ type: "renameStudent", studentId, name });
      return null;
    },
    removeStudent(studentId) {
      dispatch({ type: "removeStudent", studentId });
    },
    togglePresent(studentId) {
      dispatch({ type: "togglePresent", studentId });
    },
    addPair(type, a, b) {
      if (!roster) return null;
      const id = newId();
      const r = addPair(roster, type, a, b, () => id);
      if (!r.ok) return r.message;
      dispatch({ type: "addPair", pairType: type, a, b, id });
      return null;
    },
    deletePair(pairId) {
      dispatch({ type: "deletePair", pairId });
    },
    undoRemove() {
      const { removed } = state;
      const target = removed && app.rosters.find((x) => x.id === removed.rosterId);
      if (removed && target) {
        const r = restoreStudent(target, removed);
        if (!r.ok) return r.message;
      }
      dispatch({ type: "undoRemove" });
      return null;
    },
    dismissUndo() {
      dispatch({ type: "dismissUndo" });
    },
    stepTarget(delta) {
      dispatch({ type: "stepTarget", delta });
    },
    editSplit(text) {
      if (!roster) return null;
      const r = editSplit(state.board, roster, text);
      if (!r.ok) return r.message;
      dispatch({ type: "setBoard", board: r.board });
      return null;
    },
    resetSplit() {
      dispatch({ type: "resetSplit" });
    },
    shuffle() {
      if (!roster) return null;
      const r = shuffle(roster, state.board, { rng, newId });
      if (!r.ok) {
        if (!r.conflict) return r.message;
        dispatch({ type: "setConflict", conflict: { message: r.message, ...r.conflict } });
        return null;
      }
      dispatch({ type: "setBoard", board: r.board });
      return r.toast ?? null;
    },
    toggleLock(groupId) {
      dispatch({ type: "toggleLock", groupId });
    },
    tapStudent(studentId) {
      if (!roster) return null;
      const outcome = tapStudent(state.board, roster, state.selected, studentId);
      dispatch({ type: "move", outcome });
      return outcome.toast ?? null;
    },
    cancelSelection() {
      dispatch({ type: "move", outcome: cancelSelection(state.board) });
    },
    dropStudent(dragged, target) {
      if (!roster) return null;
      const outcome = dropStudent(state.board, roster, dragged, target);
      dispatch({ type: "move", outcome });
      return outcome.toast ?? null;
    },
    importRosters(imported, choice) {
      const r = importRosters(app, imported, choice, newId);
      dispatch({ type: "imported", app: r.state });
      return r.imported;
    },
  };

  return <RostersContext.Provider value={rosters}>{children}</RostersContext.Provider>;
}
