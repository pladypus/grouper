// App state the React way (SPEC §2): useReducer + context. Every change goes through the pure
// operations in @grouper/core; the reducer only routes actions to them. Commands run the same
// operation first so a refusal ("There's already a Sam…") can be returned to the form that asked.
// The Board (Groups on screen, #15) lives next to the AppState and is never saved; after every
// AppState change the reducer runs boardAfterRosterChange so it goes out of date or clears.

import {
  addStudent,
  boardAfterRosterChange,
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
  type AppState,
  type Board,
  type Rng,
  type IdGenerator,
  type RemovedStudent,
  type Roster,
  type RosterId,
  type StorageLike,
  type StudentId,
} from "@grouper/core";
import { createContext, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from "react";

export interface State {
  readonly app: AppState;
  /** The last removed Student, while their Undo notice is showing. */
  readonly removed: RemovedStudent | null;
  /** The Groups on screen; in memory only (SPEC §3 Group). */
  readonly board: Board;
}

export type Action =
  | { type: "createRoster"; name: string; id: string }
  | { type: "renameRoster"; rosterId: RosterId; name: string }
  | { type: "deleteRoster"; rosterId: RosterId }
  | { type: "selectRoster"; rosterId: RosterId }
  | { type: "addStudent"; name: string; id: string }
  | { type: "renameStudent"; studentId: StudentId; name: string }
  | { type: "removeStudent"; studentId: StudentId }
  | { type: "togglePresent"; studentId: StudentId }
  | { type: "undoRemove" }
  | { type: "dismissUndo" }
  | { type: "stepTarget"; delta: 1 | -1 }
  /** A Board the command already worked out (Shuffle needs randomness, so it can't run in here). */
  | { type: "setBoard"; board: Board }
  | { type: "resetSplit" };

/**
 * Applies one action, then keeps the Board in step with the open Roster (out of date after
 * attendance or Student edits, cleared when another Roster opens).
 */
export function reducer(state: State, action: Action): State {
  const next = applyAction(state, action);
  if (next.app === state.app) return next;
  const board = boardAfterRosterChange(next.board, currentRoster(state.app), currentRoster(next.app));
  return board === next.board ? next : { ...next, board };
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
      return { ...state, board: action.board };
    case "resetSplit":
      return { ...state, board: resetSplit(state.board) };
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
  createRoster(name: string): Refusal;
  renameRoster(name: string): Refusal;
  deleteRoster(): Refusal;
  selectRoster(rosterId: RosterId): void;
  addStudent(name: string): Refusal;
  renameStudent(studentId: StudentId, name: string): Refusal;
  removeStudent(studentId: StudentId): void;
  togglePresent(studentId: StudentId): void;
  undoRemove(): Refusal;
  dismissUndo(): void;
  /** The "Number of students in group" stepper's − and +. */
  stepTarget(delta: 1 | -1): void;
  /** Saves the Split typed in "Edit"; returns the refusal ("A group of 1 isn't allowed.") or null. */
  editSplit(text: string): Refusal;
  /** Back to the derived Split ("Automatic"). */
  resetSplit(): void;
  /** Shuffle / Reshuffle; returns the refusal or null when new Groups are on the Board. */
  shuffle(): Refusal;
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
  /** Randomness for Shuffle; tests pass a seeded one (seededRng from @grouper/core). */
  rng?: Rng;
  children: ReactNode;
}

/** Loads the saved Rosters once, saves after every change, and provides the commands. */
export function RostersProvider({ storage, newId, rng = Math.random, children }: RostersProviderProps) {
  const [loaded] = useState(() => loadAppState(storage));
  const [state, dispatch] = useReducer(reducer, { app: loaded.state, removed: null, board: EMPTY_BOARD });
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
    createRoster(name) {
      const id = newId();
      const r = createRoster(app, name, () => id);
      if (!r.ok) return r.message;
      dispatch({ type: "createRoster", name, id });
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
      if (!r.ok) return r.message;
      dispatch({ type: "setBoard", board: r.board });
      return null;
    },
  };

  return <RostersContext.Provider value={rosters}>{children}</RostersContext.Provider>;
}
