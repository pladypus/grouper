import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import Ellipsis from "lucide-react/icons/ellipsis";

export interface RosterMenuProps {
  canDelete: boolean;
  onNew: () => void;
  onRename: () => void;
  onDelete: () => void;
  /** Delete Roster pressed while it's not allowed (the only Roster). */
  onDeleteRefused: () => void;
}

/** The ⋯ menu beside the Roster picker (SPEC §8 top bar item 1). Export and Import come later. */
export function RosterMenu({ canDelete, onNew, onRename, onDelete, onDeleteRefused }: RosterMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") close();
    else if (e.key === "Tab") setOpen(false);
    else if (e.key === "ArrowDown") items[(index + 1) % items.length]?.focus();
    else if (e.key === "ArrowUp") items[(index - 1 + items.length) % items.length]?.focus();
    else if (e.key === "Home") items[0]?.focus();
    else if (e.key === "End") items.at(-1)?.focus();
    else return;
    e.preventDefault();
  };

  const choose = (action: () => void) => () => {
    close(false);
    action();
  };

  const itemClass =
    "block w-full rounded-lg px-3 py-2 text-left font-semibold hover:bg-bg focus:bg-bg focus:outline-none";

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-label="Roster options"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(!open)}
        className="inline-grid size-9 place-items-center rounded-lg border border-line bg-panel hover:border-mute"
      >
        <Ellipsis aria-hidden="true" className="size-[18px]" />
      </button>
      {open && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label="Roster options"
          onKeyDown={onKeyDown}
          className="absolute left-0 top-full z-20 mt-1 flex w-56 flex-col gap-0.5 rounded-xl border border-line bg-panel p-1.5 shadow-xl"
        >
          <button type="button" role="menuitem" tabIndex={-1} className={itemClass} onClick={choose(onNew)}>
            New Roster
          </button>
          <button type="button" role="menuitem" tabIndex={-1} className={itemClass} onClick={choose(onRename)}>
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            aria-disabled={!canDelete || undefined}
            className={`${itemClass} ${canDelete ? "text-bad" : "text-mute"}`}
            onClick={choose(canDelete ? onDelete : onDeleteRefused)}
          >
            Delete Roster
          </button>
        </div>
      )}
    </div>
  );
}
