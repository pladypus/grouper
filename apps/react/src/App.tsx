import {
  browserStorage,
  deleteRosterConfirmMessage,
  ONLY_ROSTER_MESSAGE,
  randomId,
  type IdGenerator,
  type StorageLike,
} from "@grouper/core";
import { useCallback, useState } from "react";
import { Board } from "./components/Board";
import { ConfirmDialog, NameDialog } from "./components/Dialog";
import { StudentsDrawer, type StudentsMode } from "./components/StudentsDrawer";
import { Toast } from "./components/Toast";
import { TopBar } from "./components/TopBar";
import { RostersProvider, useRosters } from "./state";

export interface AppProps {
  /** Where Rosters are saved; defaults to the browser's localStorage (null if unavailable). */
  storage?: StorageLike | null;
  /** Id generator for new Rosters and Students; tests can pass a deterministic one. */
  newId?: IdGenerator;
}

export default function App({ storage, newId = randomId }: AppProps) {
  const [store] = useState(() => (storage === undefined ? browserStorage() : storage));
  return (
    <RostersProvider storage={store} newId={newId}>
      <Main />
    </RostersProvider>
  );
}

type Dialog = "new" | "rename" | "delete" | null;

function Main() {
  const { roster, createRoster, renameRoster, deleteRoster, dismissUndo } = useRosters();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [drawer, setDrawer] = useState<StudentsMode | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const closeDialog = useCallback(() => setDialog(null), []);
  const clearToast = useCallback(() => setToast(null), []);
  const closeDrawer = useCallback(() => {
    dismissUndo();
    setDrawer(null);
  }, [dismissUndo]);

  return (
    <div className="flex h-dvh flex-col">
      <TopBar
        onOpenStudents={() => setDrawer("attendance")}
        onNewRoster={() => setDialog("new")}
        onRenameRoster={() => setDialog("rename")}
        onDeleteRoster={() => setDialog("delete")}
        onDeleteRefused={() => setToast(ONLY_ROSTER_MESSAGE)}
      />
      <Board onNewRoster={() => setDialog("new")} onAddStudents={() => setDrawer("edit")} />
      {roster && drawer && <StudentsDrawer mode={drawer} onModeChange={setDrawer} onClose={closeDrawer} />}
      {dialog === "new" && (
        <NameDialog
          title="New Roster"
          label="Roster name"
          submitLabel="Create"
          onSubmit={(name) => {
            const refusal = createRoster(name);
            // A new Roster is empty, so go straight to adding its Students.
            if (!refusal) setDrawer("edit");
            return refusal;
          }}
          onClose={closeDialog}
        />
      )}
      {dialog === "rename" && roster && (
        <NameDialog
          title="Rename Roster"
          label="Roster name"
          submitLabel="Rename"
          initialName={roster.name}
          onSubmit={renameRoster}
          onClose={closeDialog}
        />
      )}
      {dialog === "delete" && roster && (
        <ConfirmDialog
          title="Delete Roster"
          message={deleteRosterConfirmMessage(roster)}
          confirmLabel="Delete Roster"
          onConfirm={() => {
            const refusal = deleteRoster();
            if (refusal) setToast(refusal);
          }}
          onClose={closeDialog}
        />
      )}
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
