import { STORAGE_UNAVAILABLE_MESSAGE } from "@grouper/core";
import Plus from "lucide-react/icons/plus";
import TriangleAlert from "lucide-react/icons/triangle-alert";
import UserPlus from "lucide-react/icons/user-plus";
import { useRosters } from "../state";

export interface BoardProps {
  onNewRoster: () => void;
  onAddStudents: () => void;
}

const emptyClass =
  "grid flex-1 place-items-center rounded-[14px] border-2 border-dashed border-line p-10 text-center text-[22px] text-mute";
const actionClass =
  "mt-4 inline-flex items-center gap-2 rounded-[10px] bg-accent px-5 py-2.5 text-lg font-bold text-accent-ink";

/** The area below the top bar: notices, then the empty states (Groups come with #15). */
export function Board({ onNewRoster, onAddStudents }: BoardProps) {
  const { roster, saving } = useRosters();
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-auto px-4 pb-4 pt-3">
      {!saving && (
        <p
          role="alert"
          className="mb-2.5 flex items-center gap-2.5 rounded-lg border border-warn-line bg-warn-soft px-3.5 py-2.5 text-warn"
        >
          <TriangleAlert aria-hidden="true" className="size-4 flex-none" />
          {STORAGE_UNAVAILABLE_MESSAGE}
        </p>
      )}
      {!roster ? (
        <section className={emptyClass} aria-labelledby="welcome">
          <div>
            <h1 id="welcome" className="text-[26px] font-bold text-ink">
              Welcome to Grouper
            </h1>
            <p className="mt-1">Make a Roster for your class to get started.</p>
            <button type="button" className={actionClass} onClick={onNewRoster}>
              <Plus aria-hidden="true" className="size-5" />
              New Roster
            </button>
          </div>
        </section>
      ) : roster.students.length === 0 ? (
        <div className={emptyClass}>
          <div>
            <p>No Students on this Roster yet.</p>
            <button type="button" className={actionClass} onClick={onAddStudents}>
              <UserPlus aria-hidden="true" className="size-5" />
              Add Students
            </button>
          </div>
        </div>
      ) : (
        <div className={emptyClass}>Take the roll (✓ Present), then Shuffle.</div>
      )}
    </main>
  );
}
