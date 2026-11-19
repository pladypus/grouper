import {
  boardLayout,
  canMove,
  canSwap,
  EMPTY_BOARD_MESSAGE,
  groupFlags,
  groupMembers,
  hasGroups,
  OUT_OF_DATE_MESSAGE,
  oversizeChains,
  STORAGE_UNAVAILABLE_MESSAGE,
  type Board as BoardState,
  type PairId,
  type Roster,
  type StudentId,
} from "../lib";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
} from "@dnd-kit/core";
import Plus from "lucide-react/icons/plus";
import TriangleAlert from "lucide-react/icons/triangle-alert";
import UserPlus from "lucide-react/icons/user-plus";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRosters } from "../state";
import { ConflictNotice } from "./ConflictNotice";
import { GroupCard, type MoveView } from "./GroupCard";

export interface BoardProps {
  phone: boolean;
  splitErrorId: string;
  splitError: string | null;
  onShuffle: () => void;
  onNewRoster: () => void;
  onAddStudents: () => void;
  /** Shows a toast (a Manual move refusal, "Drop onto a Student to swap with them."). */
  onToast: (message: string) => void;
  /** "Show the Rules involved" → a Pair: open the Pairs drawer with it highlighted. */
  onShowPair: (pairId: PairId) => void;
}

const emptyClass =
  "grid flex-1 place-items-center rounded-[14px] border-2 border-dashed border-line p-10 text-center text-[22px] text-mute";
const actionClass =
  "mt-4 inline-flex items-center gap-2 rounded-[10px] bg-accent px-5 py-2.5 text-lg font-bold text-accent-ink";

/** The area below the top bar: notices, then the Groups or an empty state. */
export function Board({
  phone,
  splitErrorId,
  splitError,
  onShuffle,
  onNewRoster,
  onAddStudents,
  onToast,
  onShowPair,
}: BoardProps) {
  const { roster, saving, state } = useRosters();
  const { board, conflict } = state;
  const showGroups = !!roster && hasGroups(board);
  return (
    // On phones the pinned Reshuffle covers the bottom 84 px, so leave room for it.
    <main className={`flex min-h-0 flex-1 flex-col overflow-auto px-4 pt-3 ${phone && roster ? "pb-[84px]" : "pb-4"}`}>
      {/* Manual move instructions and results for screen readers (SPEC §7); always rendered. */}
      <p role="status" aria-live="polite" className="sr-only">
        {showGroups ? state.announcement : ""}
      </p>
      {!saving && (
        <p
          role="alert"
          className="mb-2.5 flex items-center gap-2.5 rounded-lg border border-warn-line bg-warn-soft px-3.5 py-2.5 text-warn"
        >
          <TriangleAlert aria-hidden="true" className="size-4 flex-none" />
          {STORAGE_UNAVAILABLE_MESSAGE}
        </p>
      )}
      {roster && splitError && (
        <p id={splitErrorId} role="alert" className="mb-2.5 rounded-lg border border-bad-line bg-bad-soft px-3.5 py-2.5 text-bad">
          {splitError}
        </p>
      )}
      {roster &&
        oversizeChains(roster).map((chain) => (
          <p
            key={chain.students.join(" ")}
            role="status"
            className="mb-2.5 flex items-center gap-2.5 rounded-lg border border-warn-line bg-warn-soft px-3.5 py-2.5 text-warn"
          >
            <TriangleAlert aria-hidden="true" className="size-4 flex-none" />
            {chain.message}
          </p>
        ))}
      {roster && conflict && <ConflictNotice roster={roster} conflict={conflict} onShowPair={onShowPair} />}
      {showGroups && board.outOfDate && (
        <div
          role="status"
          className="mb-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-lg border border-warn-line bg-warn-soft px-3.5 py-2.5"
        >
          <span>⚠ {OUT_OF_DATE_MESSAGE}</span>
          <button
            type="button"
            onClick={onShuffle}
            className="rounded-md border border-line bg-panel px-2.5 py-1 font-semibold hover:border-mute"
          >
            Reshuffle
          </button>
        </div>
      )}
      {!roster ? (
        <section className={emptyClass} aria-labelledby="welcome">
          <div>
            <h1 id="welcome" className="text-[26px] font-bold text-ink">
              Welcome to Grouper
            </h1>
            <p className="mt-1">Make a Roster for your class to get started.</p>
            <button type="button" className={actionClass} onClick={onNewRoster}>
              <Plus aria-hidden="true" className="size-5" />
              New Roster
            </button>
          </div>
        </section>
      ) : showGroups ? (
        <Groups board={board} roster={roster} phone={phone} onToast={onToast} />
      ) : roster.students.length === 0 ? (
        <div className={emptyClass}>
          <div>
            <p>No Students on this Roster yet.</p>
            <button type="button" className={actionClass} onClick={onAddStudents}>
              <UserPlus aria-hidden="true" className="size-5" />
              Add Students
            </button>
          </div>
        </div>
      ) : conflict ? null : (
        <div className={emptyClass}>{EMPTY_BOARD_MESSAGE}</div>
      )}
    </main>
  );
}

/**
 * The Group cards. Off phones the container is measured (ResizeObserver) and boardLayout picks the
 * column count and card size; flex-wrap + justify-center centres an incomplete last row.
 *
 * Manual move (SPEC §7): tap / Enter / Space selects and swaps, ✕ or Esc cancels, and dnd-kit drags
 * a Student onto another (mouse, or touch after a short hold so taps still select and the page
 * still scrolls). dnd-kit never moves nodes: the drop goes to the dropStudent command and the cards
 * redraw from the new Board. Flags are worked out from the Board on every render.
 */
function Groups({
  board,
  roster,
  phone,
  onToast,
}: {
  board: BoardState;
  roster: Roster;
  phone: boolean;
  onToast: (message: string) => void;
}) {
  const { state, tapStudent, cancelSelection, dropStudent, toggleLock } = useRosters();
  const { selected } = state;
  const ref = useRef<HTMLDivElement>(null);
  const [space, setSpace] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState<StudentId | null>(null);
  // The Student to keep focus on when a swap or ✕ redraws the cards under the keyboard.
  const refocus = useRef<StudentId | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || phone) return;
    const measure = () =>
      setSpace((s) => (s.width === el.clientWidth && s.height === el.clientHeight ? s : { width: el.clientWidth, height: el.clientHeight }));
    measure();
    // jsdom (tests) has no ResizeObserver and no layout: cards then go unsized.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [phone]);

  useLayoutEffect(() => {
    const id = refocus.current;
    refocus.current = null;
    const lost = !document.activeElement || document.activeElement === document.body;
    if (id !== null && lost) ref.current?.querySelector<HTMLElement>(`[data-student-id="${id}"] button`)?.focus();
  });

  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      refocus.current = selected;
      cancelSelection();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected, cancelSelection]);

  // A mouse drag starts after 6 px of movement and a touch drag after a 200 ms hold, so a plain
  // click or tap stays a tap (select / swap) and a quick swipe still scrolls the page.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const layout = boardLayout(space.width, space.height, board.groups.length);
  // Whole pixels so rounding never pushes a card onto the next row.
  const size =
    !phone && layout.cardWidth > 0 && layout.cardHeight > 0
      ? { width: Math.floor(layout.cardWidth), height: Math.floor(layout.cardHeight) }
      : null;
  const flags = groupFlags(board, roster);
  const active = selected ?? dragging;
  const move: MoveView = {
    selected,
    dragging,
    canMove: (id) => canMove(board, id),
    canSwapWith: (id) => active !== null && canSwap(board, active, id),
    onTap(id) {
      refocus.current = id;
      const toast = tapStudent(id);
      if (toast) onToast(toast);
    },
    onCancel() {
      refocus.current = selected;
      cancelSelection();
    },
  };
  const draggedName =
    dragging === null ? "" : (roster.students.find((s) => s.id === dragging)?.name ?? board.names[dragging] ?? "");

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      accessibility={{ announcements: SILENT, screenReaderInstructions: { draggable: "" } }}
      onDragStart={(e) => setDragging(String(e.active.id))}
      onDragCancel={() => setDragging(null)}
      onDragEnd={(e) => {
        setDragging(null);
        const toast = dropStudent(String(e.active.id), e.over ? String(e.over.id) : null);
        if (toast) onToast(toast);
      }}
    >
      <div
        ref={ref}
        className={phone ? "flex flex-col gap-[14px]" : "flex min-h-0 flex-1 flex-wrap content-start justify-center gap-[14px]"}
      >
        {board.groups.map((g, i) => (
          <GroupCard
            key={g.id}
            group={g}
            index={i}
            members={groupMembers(board, g, roster)}
            size={size}
            phone={phone}
            flags={flags[g.id] ?? []}
            move={move}
            onToggleLock={() => toggleLock(g.id)}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragging !== null && (
          <div className="cursor-grabbing rounded-[10px] bg-accent px-3 py-1.5 text-xl font-medium text-accent-ink shadow-lg">
            {draggedName}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

/** Keyboard and screen-reader users swap by tap / Enter / Space and hear our live region; dnd-kit stays quiet. */
const SILENT: Announcements = {
  onDragStart: () => undefined,
  onDragMove: () => undefined,
  onDragOver: () => undefined,
  onDragEnd: () => undefined,
  onDragCancel: () => undefined,
};

