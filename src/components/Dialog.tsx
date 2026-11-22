import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export interface ModalProps {
  title: string;
  role?: "dialog" | "alertdialog";
  onClose: () => void;
  children: ReactNode;
  /** Id of the element that describes the dialog (alertdialog's message). */
  describedBy?: string;
  /** A wider dialog, for tables and lists (New Roster with a class list). */
  wide?: boolean;
  /** A narrower dialog, for a few short lines (About). */
  narrow?: boolean;
  /** Drawn before the title (About's app mark). */
  icon?: ReactNode;
  /** A muted line under the title; it also describes the dialog. */
  subtitle?: string;
}

/** A centred modal with a dimmed backdrop. Escape or a backdrop click closes it. Scrolls when tall. */
export function Modal({ title, role = "dialog", onClose, children, describedBy, wide, narrow, icon, subtitle }: ModalProps) {
  const titleId = useId();
  const subtitleId = useId();
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
        aria-describedby={[subtitle ? subtitleId : null, describedBy].filter(Boolean).join(" ") || undefined}
        className={`relative max-h-[calc(100dvh-2rem)] w-full overflow-auto rounded-xl bg-panel p-5 shadow-2xl ${
          wide ? "max-w-xl" : narrow ? "max-w-sm" : "max-w-md"
        }`}
      >
        {/* The icon/subtitle header (About only) uses a deliberate 20px rhythm, not the plain header's mb-3. */}
        {icon || subtitle ? (
          <div className="mb-5 flex items-center gap-3 max-[359px]:items-start">
            {icon}
            <div>
              <h2 id={titleId} className="text-lg font-bold leading-tight">
                {title}
              </h2>
              {subtitle && (
                <p id={subtitleId} className="mt-0.5 text-balance text-sm text-mute">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        ) : (
          <h2 id={titleId} className="mb-3 text-lg font-bold">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}

export const buttonClass = "rounded-md border border-line bg-panel px-3 py-1.5 hover:border-mute";
export const primaryClass =
  "rounded-md border border-accent bg-accent px-3 py-1.5 font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-50";
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

interface ClashDialogProps {
  title: string;
  message: string;
  onReplace: () => void;
  onKeepBoth: () => void;
  onClose: () => void;
}

/** Import's name-clash question (spec: export-import.md): Replace or Keep both, one question for every clash. */
export function ClashDialog({ title, message, onReplace, onKeepBoth, onClose }: ClashDialogProps) {
  const messageId = useId();
  return (
    <Modal title={title} role="alertdialog" onClose={onClose} describedBy={messageId}>
      <p id={messageId}>{message}</p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" className={buttonClass} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={buttonClass} onClick={onReplace}>
          Replace
        </button>
        <button type="button" className={primaryClass} onClick={onKeepBoth} autoFocus>
          Keep both
        </button>
      </div>
    </Modal>
  );
}

interface ListDialogProps {
  title: string;
  /** One section per heading, each with its lines. */
  sections: readonly { heading: string; lines: readonly string[] }[];
  onClose: () => void;
}

/** A read-only list with an OK button (what an Import skipped). */
export function ListDialog({ title, sections, onClose }: ListDialogProps) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="max-h-[60vh] overflow-auto">
        {sections.map((s) => (
          <section key={s.heading} className="mb-3">
            <h3 className="font-semibold">{s.heading}</h3>
            <ul className="ml-5 list-disc">
              {s.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <button type="button" className={primaryClass} onClick={onClose} autoFocus>
          OK
        </button>
      </div>
    </Modal>
  );
}
