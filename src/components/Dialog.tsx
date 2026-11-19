import { useEffect, useId, useRef, useState, type ReactNode } from "react";

interface ModalProps {
  title: string;
  role?: "dialog" | "alertdialog";
  onClose: () => void;
  children: ReactNode;
  /** Id of the element that describes the dialog (alertdialog's message). */
  describedBy?: string;
}

/** A centred modal with a dimmed backdrop. Escape or a backdrop click closes it. */
function Modal({ title, role = "dialog", onClose, children, describedBy }: ModalProps) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-30 grid place-items-center p-4 print:hidden">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={onClose} />
      <div
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        className="relative w-full max-w-md rounded-xl bg-panel p-5 shadow-2xl"
      >
        <h2 id={titleId} className="mb-3 text-lg font-bold">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

const buttonClass = "rounded-md border border-line bg-panel px-3 py-1.5 hover:border-mute";
const primaryClass = "rounded-md border border-accent bg-accent px-3 py-1.5 font-semibold text-accent-ink";
const dangerClass = "rounded-md border border-bad bg-bad px-3 py-1.5 font-semibold text-panel";

interface NameDialogProps {
  title: string;
  label: string;
  submitLabel: string;
  initialName?: string;
  /** Returns a refusal sentence to show, or null when the name was accepted. */
  onSubmit: (name: string) => string | null;
  onClose: () => void;
}

/** New Roster name and Rename Roster. Refusals ("There's already a Roster called…") show inline. */
export function NameDialog({ title, label, submitLabel, initialName = "", onSubmit, onClose }: NameDialogProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.select(), []);
  return (
    <Modal title={title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const refusal = onSubmit(name);
          if (refusal) setError(refusal);
          else onClose();
        }}
      >
        <label htmlFor={inputId} className="mb-1 block text-sm font-semibold">
          {label}
        </label>
        <input
          ref={input}
          id={inputId}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
          className="w-full rounded-md border border-line bg-field px-2 py-1.5"
        />
        {error && (
          <p id={errorId} role="alert" className="mt-2 rounded-md border border-bad-line bg-bad-soft px-2.5 py-1.5 text-bad">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={buttonClass} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={primaryClass}>
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** Asks before something that can't be undone (Delete Roster). */
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onClose }: ConfirmDialogProps) {
  const messageId = useId();
  return (
    <Modal title={title} role="alertdialog" onClose={onClose} describedBy={messageId}>
      <p id={messageId}>{message}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className={buttonClass} onClick={onClose} autoFocus>
          Cancel
        </button>
        <button
          type="button"
          className={dangerClass}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
