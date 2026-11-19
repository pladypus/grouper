import { useEffect } from "react";

export const TOAST_MS = 3000;

/** spec: screens.md#toasts: top-centre, role="status", about 3 s. The live region is always rendered. */
export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDone, TOAST_MS);
    return () => clearTimeout(timer);
  }, [message, onDone]);
  return (
    <div role="status" className="pointer-events-none fixed print:hidden left-1/2 top-4 z-40 max-w-[90vw] -translate-x-1/2">
      {message && <p className="rounded-lg bg-[#111] px-4 py-2.5 text-white shadow-lg">{message}</p>}
    </div>
  );
}
