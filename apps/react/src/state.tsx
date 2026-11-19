// App state the React way (SPEC §2): useReducer + context. Every change goes through the pure
// operations in @grouper/core; the reducer only routes actions to them. Commands run the same
// operation first so a refusal ("There's already a Sam…") can be returned to the form that asked.

import {
  addStudent,
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
  | { type: "dismissUndo" };

/** Applies one action. Refused operations leave the state unchanged (commands report them). */
export function reducer(state: State, action: Action): State {
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
      return r.ok ? { app: r.state, removed: null } : state;
    }
    case "selectRoster":
      return { app: selectRoster(app, action.rosterId), removed: null };
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
      return r.ok ? { app: updateRoster(app, roster.id, () => r.roster), removed: r.removed } : state;
    }
    case "togglePresent":
      if (!roster) return state;
      return { ...state, app: updateRoster(app, roster.id, (x) => togglePresent(x, action.studentId)) };
    case "undoRemove": {
      const { removed } = state;
      const target = removed && app.rosters.find((x) => x.id === removed.rosterId);
      if (!removed || !target) return { ...state, removed: null };
      const r = restoreStudent(target, removed);
      return r.ok ? { app: updateRoster(app, target.id, () => r.roster), removed: null } : state;
    }
    case "dismissUndo":
      return state.removed ? { ...state, removed: null } : state;
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
  children: ReactNode;
}

/** Loads the saved Rosters once, saves after every change, and provides the commands. */
export function RostersProvider({ storage, newId, children }: RostersProviderProps) {
  const [loaded] = useState(() => loadAppState(storage));
  const [state, dispatch] = useReducer(reducer, { app: loaded.state, removed: null });
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
  };

  return <RostersContext.Provider value={rosters}>{children}</RostersContext.Provider>;
}
