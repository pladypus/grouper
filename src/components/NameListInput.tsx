import { PASTE_HINT, UNREADABLE_FILE_MESSAGE } from "../lib";
import FileUp from "lucide-react/icons/file-up";
import { useId, useRef, useState, type DragEvent } from "react";

export interface NameListInputProps {
  /** The box's label: "Paste names" (Students drawer) or "Paste your class list" (New Roster). */
  label: string;
  value: string;
  /** Typing passes no file name; a dropped or chosen file passes its text and its name. */
  onChange: (text: string, fileName?: string) => void;
  /** The file being shown, if the text came from one. */
  fileName?: string;
  autoFocus?: boolean;
  rows?: number;
}

/**
 * The Add names paste box (spec: add-names.md): a textarea that also takes a dropped .txt/.csv, and a
 * "Choose a file" button. A file's text replaces the box's text.
 */
export function NameListInput({ label, value, onChange, fileName, autoFocus, rows = 6 }: NameListInputProps) {
  const boxId = useId();
  const hintId = useId();
  const errorId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (file: File | undefined) => {
    if (!file) return;
    try {
      onChange(await file.text(), file.name);
      setError(null);
    } catch {
      setError(UNREADABLE_FILE_MESSAGE);
    }
  };

  const onDragOver = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragging(true);
  };

  const onDrop = (e: DragEvent) => {
    const file = e.dataTransfer.files[0];
    setDragging(false);
    if (!file) return;
    e.preventDefault();
    void load(file);
  };

  return (
    <div>
      <label htmlFor={boxId} className="mb-1 block text-sm font-semibold">
        {label}
      </label>
      <textarea
        id={boxId}
        value={value}
        rows={rows}
        autoFocus={autoFocus}
        spellCheck={false}
        onChange={(e) => {
          onChange(e.target.value);
          setError(null);
        }}
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        className={`block w-full resize-y rounded-md border bg-field px-2 py-1.5 ${
          dragging ? "border-accent outline-2 outline-accent" : "border-line"
        }`}
      />
      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <p id={hintId} className="flex-1 text-sm text-mute">
          {fileName ? `From ${fileName}. ` : ""}
          {PASTE_HINT}
        </p>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1 text-sm hover:border-mute"
        >
          <FileUp aria-hidden="true" className="size-4" />
          Choose a file
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".txt,.csv,text/plain,text/csv"
          aria-label="Choose a .txt or .csv file"
          className="hidden"
          onChange={(e) => {
            void load(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 rounded-md border border-bad-line bg-bad-soft px-2.5 py-1.5 text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
