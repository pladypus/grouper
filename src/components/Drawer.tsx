import { useEffect, useId, type ReactNode } from "react";

export const drawerButtonClass = "rounded-md border border-line bg-panel px-2.5 py-1 hover:border-mute";
/** A refusal under a form (red line, spec: screens.md#pairs-drawer). */
export const drawerErrorClass = "my-1.5 rounded-md border border-bad-line bg-bad-soft px-2.5 py-1.5 text-bad";

export interface DrawerProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** A side drawer (Students, Pairs): backdrop, titled dialog, "Done"; Escape or the backdrop closes it. */
export function Drawer({ title, onClose, children }: DrawerProps) {
  const titleId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-10 bg-black/40 print:hidden" aria-hidden="true" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-y-0 right-0 print:hidden z-[11] w-[min(440px,100%)] overflow-auto bg-panel p-4 shadow-[-8px_0_30px_rgba(0,0,0,.25)]"
      >
        {/* A div, not <header>: jsdom and some screen readers would count it as another banner. */}
        <div className="mb-2.5 flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <button type="button" className={drawerButtonClass} onClick={onClose}>
            Done
          </button>
        </div>
        {children}
      </aside>
    </>
  );
}
