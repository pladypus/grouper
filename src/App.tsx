import {
  browserStorage,
  deleteRosterConfirmMessage,
  ONLY_ROSTER_MESSAGE,
  randomId,
  type IdGenerator,
  type Rng,
  type RosterId,
  type StorageLike,
} from "./lib";
import { useCallback, useState } from "react";
import { Board } from "./components/Board";
import { ConfirmDialog, NameDialog } from "./components/Dialog";
import { PairsDrawer } from "./components/PairsDrawer";
import { StudentsDrawer, type StudentsMode } from "./components/StudentsDrawer";
import { Toast } from "./components/Toast";
import { TopBar } from "./components/TopBar";
import { RostersProvider, useRosters } from "./state";
import { usePhone } from "./usePhone";

export interface AppProps {
  /** Where Rosters are saved; defaults to the browser's localStorage (null if unavailable). */
  storage?: StorageLike | null;
  /** Id generator for new Rosters and Students; tests can pass a deterministic one. */
  newId?: IdGenerator;
  /** Randomness for Shuffle; tests pass a seeded one. Defaults to Math.random. */
  rng?: Rng;
}

export default function App({ storage, newId = randomId, rng }: AppProps) {
  const [store] = useState(() => (storage === undefined ? browserStorage() : storage));
  return (
    <RostersProvider storage={store} newId={newId} rng={rng}>
      <Main />
    </RostersProvider>
  );
}

type Dialog = "new" | "rename" | "delete" | null;

const SPLIT_ERROR_ID = "split-error";

function Main() {
  const { roster, createRoster, renameRoster, deleteRoster, dismissUndo, shuffle } = useRosters();
  const phone = usePhone();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [drawer, setDrawer] = useState<StudentsMode | "pairs" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // The Split "Edit" refusal, shown on the board; tagged with its Roster so switching Roster drops it.
  const [splitRefusal, setSplitRefusal] = useState<{ rosterId: RosterId; message: string } | null>(null);
  const splitError = roster && splitRefusal?.rosterId === roster.id ? splitRefusal.message : null;
  const onSplitError = useCallback(
    (message: string | null) => setSplitRefusal(message && roster ? { rosterId: roster.id, message } : null),
    [roster],
  );
  const runShuffle = () => {
    const refusal = shuffle();
    if (refusal) setToast(refusal);
  };

  const closeDialog = useCallback(() => setDialog(null), []);
  const clearToast = useCallback(() => setToast(null), []);
  const closeDrawer = useCallback(() => {
    dismissUndo();
    setDrawer(null);
  }, [dismissUndo]);

  return (
    <div className="flex h-dvh flex-col print:block print:h-auto">
      <TopBar
        phone={phone}
        splitErrorId={SPLIT_ERROR_ID}
        splitError={splitError}
        onSplitError={onSplitError}
        onShuffle={runShuffle}
        onOpenStudents={() => setDrawer("attendance")}
        onOpenPairs={() => setDrawer("pairs")}
        onNewRoster={() => setDialog("new")}
        onRenameRoster={() => setDialog("rename")}
        onDeleteRoster={() => setDialog("delete")}
        onDeleteRefused={() => setToast(ONLY_ROSTER_MESSAGE)}
        onToast={setToast}
      />
      <Board
        phone={phone}
        splitErrorId={SPLIT_ERROR_ID}
        splitError={splitError}
        onShuffle={runShuffle}
        onNewRoster={() => setDialog("new")}
        onAddStudents={() => setDrawer("edit")}
        onToast={setToast}
      />
      {roster && drawer === "pairs" && <PairsDrawer onClose={closeDrawer} />}
      {roster && (drawer === "attendance" || drawer === "edit") && (
        <StudentsDrawer mode={drawer} onModeChange={setDrawer} onClose={closeDrawer} />
      )}
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
