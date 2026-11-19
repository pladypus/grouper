import {
  groupSizeLabel,
  groupTitle,
  nameColumns,
  nameFontSize,
  PHONE_NAME_FONT_SIZE,
  type Group,
  type GroupFlag,
  type MemberView,
  type StudentId,
} from "@grouper/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useCallback, useId, type CSSProperties } from "react";

/** What the Group cards need to draw and drive a Manual move (SPEC §7). */
export interface MoveView {
  /** The selected Student (tap / keyboard), or null. */
  selected: StudentId | null;
  /** The Student being dragged, or null. */
  dragging: StudentId | null;
  /** Whether this Student can be picked up or selected (canMove). */
  canMove(id: StudentId): boolean;
  /** Whether the selected or dragged Student can swap with this one (canSwap), for ⇄. */
  canSwapWith(id: StudentId): boolean;
  onTap(id: StudentId): void;
  onCancel(): void;
}

export interface GroupCardProps {
  group: Group;
  index: number;
  members: readonly MemberView[];
  /** Card size from boardLayout, or null when unmeasured / on phones (the card sizes itself). */
  size: { width: number; height: number } | null;
  phone: boolean;
  /** The Rules this Group breaks after a Manual move (groupFlags); one warning line each. */
  flags: readonly GroupFlag[];
  move: MoveView;
}

/** The Group's own colour, from --hue and the theme's --hue-s / --hue-l (styles.css). */
const hueBg = "bg-[hsl(var(--hue)_var(--hue-s)_var(--hue-l))]";
/** The Group's soft tint (swap targets on hover / under a drag). */
const hueSoftBg = "bg-[hsl(var(--hue)_var(--hue-s)_var(--hue-soft-l))]";
const hueSoftHover = "hover:bg-[hsl(var(--hue)_var(--hue-s)_var(--hue-soft-l))]";

/**
 * SPEC §8 Group card: coloured header "Group 1 · 4 students", names sized to fit the card, and
 * (SPEC §7) an amber outline with one "⚠ …" line per broken Rule.
 */
export function GroupCard({ group, index, members, size, phone, flags, move }: GroupCardProps) {
  const headingId = useId();
  const n = members.length;
  const columns = phone || !size ? 1 : nameColumns(n, size.width, size.height);
  const fontSize = phone
    ? PHONE_NAME_FONT_SIZE
    : nameFontSize({
        cardWidth: size?.width ?? 0,
        cardHeight: size?.height ?? 0,
        memberCount: n,
        warningLines: flags.length,
        columns,
      });
  const style = { "--hue": group.hue, ...(size && !phone ? { width: size.width, height: size.height } : {}) } as CSSProperties;
  const moving = move.selected !== null || move.dragging !== null;
  const flagged = flags.length > 0;

  const listClass = phone
    ? "flex flex-col gap-1 px-3 py-2.5"
    : columns === 2
      ? "grid min-h-0 flex-1 grid-cols-2 content-center gap-x-3 gap-y-1 overflow-hidden px-3 py-2.5"
      : "flex min-h-0 flex-1 flex-col justify-center gap-1 overflow-hidden px-3 py-2.5";

  return (
    <section
      aria-labelledby={headingId}
      style={style}
      className={`flex flex-none flex-col overflow-hidden rounded-[14px] border bg-panel ${
        flagged ? "border-warn shadow-[0_0_0_2px_var(--color-warn)]" : "border-line shadow-[0_1px_3px_rgba(0,0,0,.08)]"
      }${phone ? " w-full" : ""}${moving && group.locked ? " opacity-55" : ""}`}
    >
      {/* A div, not <header>: jsdom and some screen readers would count it as another banner. */}
      <div className={`flex items-center gap-2.5 py-2.5 pl-4 pr-3 text-on-c ${hueBg}`}>
        <h2 id={headingId} className="text-[clamp(17px,1.5vw,24px)] font-extrabold tracking-[.01em]">
          {groupTitle(index)} <span className="text-sm font-semibold opacity-85">· {groupSizeLabel(group)}</span>
        </h2>
      </div>
      <ul className={listClass} style={{ fontSize }}>
        {members.map((m) => (
          <StudentChip key={m.id} member={m} phone={phone} move={move} />
        ))}
      </ul>
      {flags.map((f, i) => (
        <p
          key={i}
          className="flex items-center gap-1.5 border-t border-warn-line bg-warn-soft px-3.5 py-1.5 text-sm text-warn"
        >
          ⚠ {f.message}
        </p>
      ))}
    </section>
  );
}

/**
 * One Student on a card: a button for tap / Enter / Space, a dnd-kit draggable (pick up) and
 * droppable (swap target). dnd-kit only reports where the drag ended; the Board's membership
 * changes only through the drop command, never by the library moving nodes.
 */
function StudentChip({ member: m, phone, move }: { member: MemberView; phone: boolean; move: MoveView }) {
  const movable = move.canMove(m.id);
  const drag = useDraggable({ id: m.id, disabled: !movable });
  const drop = useDroppable({ id: m.id });
  const setRef = useCallback(
    (el: HTMLLIElement | null) => {
      drag.setNodeRef(el);
      drop.setNodeRef(el);
    },
    [drag.setNodeRef, drop.setNodeRef],
  );
  const selected = move.selected === m.id;
  const active = move.selected ?? move.dragging;
  const swappable = active !== null && active !== m.id && move.canSwapWith(m.id);
  const over = swappable && drop.isOver;
  const isDragged = move.dragging === m.id;

  let look = "";
  if (selected) look = " bg-accent text-accent-ink";
  else {
    if (m.faded) look += " text-mute line-through";
    if (over) look += ` ${hueSoftBg}`;
    else if (swappable) look += ` ${hueSoftHover}`;
  }

  return (
    <li
      ref={setRef}
      data-student-id={m.id}
      className={`group/chip flex min-w-0 items-center gap-2 rounded-[10px] px-[.45em] py-[.22em] font-medium leading-[1.2]${
        phone ? " min-h-11" : ""
      }${look}${isDragged ? " opacity-40" : ""}`}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => move.onTap(m.id)}
        {...drag.listeners}
        className={`flex min-w-0 flex-1 touch-manipulation select-none items-center gap-3 rounded-md text-left [-webkit-touch-callout:none] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent${
          !movable ? " cursor-not-allowed" : swappable ? " cursor-pointer" : " cursor-grab"
        }`}
      >
        <span aria-hidden="true" className={`size-2.5 flex-none rounded-full ${hueBg}`} />
        <span className="min-w-0 truncate">{m.name}</span>
        {m.faded && <span className="sr-only">{m.status === "absent" ? " (Absent)" : " (removed)"}</span>}
        {swappable && (
          <span
            aria-hidden="true"
            className={`ml-auto flex-none text-[.7em] text-[hsl(var(--hue)_var(--hue-s)_var(--hue-l))] ${
              over ? "inline" : "hidden group-hover/chip:inline"
            }`}
          >
            ⇄
          </span>
        )}
      </button>
      {selected && (
        <button
          type="button"
          aria-label="Cancel swap"
          onClick={move.onCancel}
          className="ml-auto flex-none rounded px-1 text-[.6em] opacity-80 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-accent-ink"
        >
          ✕
        </button>
      )}
    </li>
  );
}
