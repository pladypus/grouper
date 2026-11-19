import { useEffect, useId, useRef, useState, type ComponentType, type KeyboardEvent, type ReactNode } from "react";

/** One row of a Menu. Add a row by adding one of these to the `items` array. */
export interface MenuItem {
  /** Stable key. */
  id: string;
  label: string;
  /** A smaller second line under the label. */
  hint?: string;
  icon?: ComponentType<{ "aria-hidden"?: boolean | "true"; className?: string }>;
  /** Draw a divider above this row. */
  separatorBefore?: boolean;
  onSelect: () => void;
}

export interface MenuProps {
  /** The menu's accessible name (also the trigger's aria-label when `trigger` isn't text). */
  label: string;
  items: readonly MenuItem[];
  /** What's drawn on the trigger button. */
  trigger: ReactNode;
  triggerClass: string;
  /** Sets the trigger's aria-label; leave out when `trigger` is its visible text. */
  triggerLabel?: string;
  disabled?: boolean;
  title?: string;
  /** Which edge of the trigger the menu lines up with. */
  align?: "left" | "right";
}

const itemClass =
  "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left font-semibold hover:bg-bg focus:bg-bg focus:outline-none";

/**
 * A button that opens a list of actions (ARIA menu button): arrows / Home / End move, Esc closes and
 * refocuses the button, Tab or a click outside closes it. Choosing a row closes the menu first.
 */
export function Menu({ label, items, trigger, triggerClass, triggerLabel, disabled, title, align = "left" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const isOpen = open && !disabled;

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  useEffect(() => {
    if (!isOpen) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [isOpen]);

  const onKeyDown = (e: KeyboardEvent) => {
    const rows = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = rows.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") close();
    else if (e.key === "Tab") setOpen(false);
    else if (e.key === "ArrowDown") rows[(index + 1) % rows.length]?.focus();
    else if (e.key === "ArrowUp") rows[(index - 1 + rows.length) % rows.length]?.focus();
    else if (e.key === "Home") rows[0]?.focus();
    else if (e.key === "End") rows.at(-1)?.focus();
    else return;
    e.preventDefault();
  };

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        disabled={disabled}
        title={title}
        onClick={() => setOpen(!open)}
        className={triggerClass}
      >
        {trigger}
      </button>
      {isOpen && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full z-20 mt-1 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-0.5 rounded-xl border border-line bg-panel p-1.5 shadow-xl`}
        >
          {items.map(({ id, label: text, hint, icon: Icon, separatorBefore, onSelect }) => (
            <div key={id} className="contents">
              {separatorBefore && <hr className="mx-1.5 my-1 border-line" />}
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={itemClass}
                onClick={() => {
                  close(false);
                  onSelect();
                }}
              >
                {Icon && <Icon aria-hidden="true" className="mt-0.5 size-[18px] flex-none" />}
                <span>
                  {text}
                  {hint && <small className="block text-[13px] font-normal text-mute">{hint}</small>}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
