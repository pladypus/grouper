import { presentCount, removedStudentMessage, type Student } from "../lib";
import Pencil from "lucide-react/icons/pencil";
import X from "lucide-react/icons/x";
import { useEffect, useId, useRef, useState } from "react";
import { useRosters } from "../state";
import { Drawer, drawerButtonClass as buttonClass, drawerErrorClass as errorClass } from "./Drawer";

export type StudentsMode = "attendance" | "edit";

export interface StudentsDrawerProps {
  mode: StudentsMode;
  onModeChange: (mode: StudentsMode) => void;
  onClose: () => void;
}

const fieldClass = "min-w-0 flex-1 rounded-md border border-line bg-field px-2 py-1.5";

/** SPEC §8 Students drawer: Attendance (tap to toggle) and Edit list (add, rename, remove). */
export function StudentsDrawer({ mode, onModeChange, onClose }: StudentsDrawerProps) {
  const { dismissUndo } = useRosters();

  const switchMode = (next: StudentsMode) => {
    dismissUndo();
    onModeChange(next);
  };

  const segClass = (on: boolean) =>
    `flex-1 border px-2 py-2 first:rounded-l-lg last:rounded-r-lg last:border-l-0 ${
      on ? "border-ink bg-ink text-panel" : "border-line bg-panel"
    }`;

  return (
    <Drawer title="Students" onClose={onClose}>
      <div className="mb-3 flex" role="group" aria-label="Mode">
        <button type="button" aria-pressed={mode === "attendance"} className={segClass(mode === "attendance")} onClick={() => switchMode("attendance")}>
          Attendance
        </button>
        <button type="button" aria-pressed={mode === "edit"} className={segClass(mode === "edit")} onClick={() => switchMode("edit")}>
          Edit list
        </button>
      </div>
      {mode === "attendance" ? <Attendance /> : <EditList />}
    </Drawer>
  );
}

function Attendance() {
  const { roster, togglePresent } = useRosters();
  if (!roster) return null;
  if (roster.students.length === 0) {
    return <p className="text-mute">No Students yet. Add them in Edit list.</p>;
  }
  return (
    <>
      <p className="text-sm text-mute">
        Tap a name to mark them Absent or Present. {presentCount(roster)} of {roster.students.length} Present.
      </p>
      <ul className="my-2.5 flex flex-wrap gap-2" aria-label="Attendance">
        {roster.students.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              aria-pressed={s.present}
              onClick={() => togglePresent(s.id)}
              className={`rounded-[10px] border px-3.5 py-2.5 text-base ${
                s.present ? "border-ok bg-ok-soft" : "border-line bg-off text-mute line-through"
              }`}
            >
              {s.name}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function EditList() {
  const { roster, state, addStudent, undoRemove } = useRosters();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const errorId = useId();
  if (!roster) return null;
  const { removed } = state;

  return (
    <>
      {removed && (
        <div role="status" className="mb-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-lg bg-accent-soft px-3.5 py-2.5">
          {removedStudentMessage(removed)}
          <button type="button" className={buttonClass} onClick={() => setUndoError(undoRemove())}>
            Undo
          </button>
          {undoError && <p className="w-full text-bad">{undoError}</p>}
        </div>
      )}
      <form
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const refusal = addStudent(name);
          setError(refusal);
          if (!refusal) setName("");
        }}
      >
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          aria-label="Student name"
          placeholder="Add a Student"
          autoComplete="off"
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={fieldClass}
        />
        <button type="submit" className={buttonClass}>
          Add
        </button>
      </form>
      {error && (
        <p id={errorId} role="alert" className={errorClass}>
          {error}
        </p>
      )}
      <ul className="my-2.5" aria-label="Students">
        {roster.students.map((s) =>
          editing === s.id ? (
            <RenameRow key={s.id} student={s} onDone={() => setEditing(null)} />
          ) : (
            <StudentRow key={s.id} student={s} onRename={() => setEditing(s.id)} />
          ),
        )}
      </ul>
    </>
  );
}

const rowClass = "flex items-center gap-1.5 border-b border-line px-1 py-1.5";
const iconButtonClass = "inline-flex items-center gap-1 rounded px-1 text-mute";

function StudentRow({ student, onRename }: { student: Student; onRename: () => void }) {
  const { removeStudent } = useRosters();
  return (
    <li className={rowClass}>
      <span className="flex-1">{student.name}</span>
      <button type="button" className={`${iconButtonClass} hover:text-ink`} aria-label={`Rename ${student.name}`} onClick={onRename}>
        <Pencil aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        className={`${iconButtonClass} hover:text-bad`}
        aria-label={`Remove ${student.name}`}
        onClick={() => removeStudent(student.id)}
      >
        <X aria-hidden="true" className="size-4" />
        Remove
      </button>
    </li>
  );
}

function RenameRow({ student, onDone }: { student: Student; onDone: () => void }) {
  const { renameStudent } = useRosters();
  const [name, setName] = useState(student.name);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.select(), []);
  return (
    <li className="border-b border-line px-1 py-1.5">
      <form
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const refusal = renameStudent(student.id, name);
          if (refusal) setError(refusal);
          else onDone();
        }}
      >
        <input
          ref={input}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onDone();
            }
          }}
          aria-label={`New name for ${student.name}`}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={fieldClass}
        />
        <button type="submit" className={buttonClass}>
          Save
        </button>
        <button type="button" className={buttonClass} onClick={onDone}>
          Cancel
        </button>
      </form>
      {error && (
        <p id={errorId} role="alert" className={errorClass}>
          {error}
        </p>
      )}
    </li>
  );
}
