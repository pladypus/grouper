import {
  groupSizeLabel,
  groupTitle,
  lockPillText,
  lockToggleLabel,
  nameColumns,
  nameFontSize,
  PHONE_NAME_FONT_SIZE,
  type Group,
  type GroupFlag,
  type MemberView,
  type StudentId,
} from "../lib";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import Lock from "lucide-react/icons/lock";
import LockOpen from "lucide-react/icons/lock-open";
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
  /** The header's Lock toggle (SPEC §7 Lock). */
  onToggleLock: () => void;
}

/** The Group's own colour, from --hue and the theme's --hue-s / --hue-l (styles.css). */
const hueBg = "bg-[hsl(var(--hue)_var(--hue-s)_var(--hue-l))]";
/** The Group's soft tint (swap targets on hover / under a drag). */
const hueSoftBg = "bg-[hsl(var(--hue)_var(--hue-s)_var(--hue-soft-l))]";
const hueSoftHover = "hover:bg-[hsl(var(--hue)_var(--hue-s)_var(--hue-soft-l))]";
/** A Locked card's ring in the Group's own colour (an amber flag ring wins). */
const hueRing =
  "border-[hsl(var(--hue)_var(--hue-s)_var(--hue-l))] shadow-[0_0_0_3px_hsl(var(--hue)_var(--hue-s)_var(--hue-l))]";

const pillBase =
  "inline-flex flex-none items-center gap-1.5 rounded-full border-[1.5px] px-3 py-[5px] text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-c";
/** Unlocked: an outlined "Lock" pill; hidden in print (SPEC §9). */
const pillOff = `${pillBase} border-current bg-transparent opacity-90 hover:bg-white/15 hover:opacity-100 print:hidden`;
/** Locked: a solid "Locked" pill in the Group's colour. */
const pillOn = `${pillBase} border-on-c bg-on-c text-[hsl(var(--hue)_var(--hue-s)_var(--hue-l))]`;

/**
 * SPEC §8 Group card: coloured header "Group 1 · 4 students" with the Lock pill, names sized to fit
 * the card, and (SPEC §7) an amber outline with one "⚠ …" line per broken Rule. Locked: a ring in
 * the Group's colour, a tinted body and a solid "Locked" pill; faded back while a Student is moving.
 */
export function GroupCard({ group, index, members, size, phone, flags, move, onToggleLock }: GroupCardProps) {
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

  // On paper, one column of names at 14pt whatever the screen measured (`!` beats the inline size).
  const listClass = `${
    phone
      ? "flex flex-col gap-1 px-3 py-2.5"
      : columns === 2
        ? "grid min-h-0 flex-1 grid-cols-2 content-center gap-x-3 gap-y-1 overflow-hidden px-3 py-2.5"
        : "flex min-h-0 flex-1 flex-col justify-center gap-1 overflow-hidden px-3 py-2.5"
  } print:flex print:flex-col print:justify-start print:gap-0 print:py-1.5 print:text-[14pt]!`;

  return (
    <section
      aria-labelledby={headingId}
      style={style}
      // On paper the card sizes itself in a three-across grid and never splits across pages (SPEC §9).
      className={`flex flex-none flex-col overflow-hidden rounded-[14px] border bg-panel print:h-auto! print:w-auto! print:break-inside-avoid print:rounded-lg print:opacity-100 print:shadow-none ${
        flagged
          ? "border-warn shadow-[0_0_0_2px_var(--color-warn)]"
          : group.locked
            ? `${hueRing} print:border-2`
            : "border-line shadow-[0_1px_3px_rgba(0,0,0,.08)]"
      }${phone ? " w-full" : ""}${moving && group.locked ? " opacity-55" : ""}`}
    >
      {/* A div, not <header>: jsdom and some screen readers would count it as another banner. */}
      <div className={`flex items-center gap-2.5 py-2.5 pl-4 pr-3 text-on-c print:flex-wrap print:gap-y-1 print:py-1.5 print:pl-2.5 ${hueBg}`}>
        <h2 id={headingId} className="mr-auto text-[clamp(17px,1.5vw,24px)] font-extrabold tracking-[.01em] print:whitespace-nowrap print:text-[14pt]">
          {groupTitle(index)} <span className="text-sm font-semibold opacity-85">· {groupSizeLabel(group)}</span>
        </h2>
        <button
          type="button"
          aria-pressed={group.locked}
          aria-label={lockToggleLabel(group, index)}
          title={group.locked ? "Locked: Reshuffle keeps this Group" : "Lock: Reshuffle keeps this Group"}
          onClick={onToggleLock}
          className={group.locked ? pillOn : pillOff}
        >
          {group.locked ? (
            <Lock aria-hidden="true" className="size-4" />
          ) : (
            <LockOpen aria-hidden="true" className="size-4" />
          )}
          {lockPillText(group)}
        </button>
      </div>
      <ul className={`${listClass}${group.locked ? ` ${hueSoftBg}` : ""}`} style={{ fontSize }}>
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
  if (selected) look = " bg-accent text-accent-ink print:bg-transparent print:text-ink"; // a pending swap isn't printed
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
          className="ml-auto flex-none rounded print:hidden px-1 text-[.6em] opacity-80 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-accent-ink"
        >
          ✕
        </button>
      )}
    </li>
  );
}
