import {
  boardLayout,
  EMPTY_BOARD_MESSAGE,
  groupMembers,
  hasGroups,
  OUT_OF_DATE_MESSAGE,
  oversizeChains,
  STORAGE_UNAVAILABLE_MESSAGE,
  type Board as BoardState,
  type Roster,
} from "@grouper/core";
import Plus from "lucide-react/icons/plus";
import TriangleAlert from "lucide-react/icons/triangle-alert";
import UserPlus from "lucide-react/icons/user-plus";
import { useLayoutEffect, useRef, useState } from "react";
import { useRosters } from "../state";
import { ConflictNotice } from "./ConflictNotice";
import { GroupCard } from "./GroupCard";

export interface BoardProps {
  phone: boolean;
  splitErrorId: string;
  splitError: string | null;
  onShuffle: () => void;
  onNewRoster: () => void;
  onAddStudents: () => void;
}

const emptyClass =
  "grid flex-1 place-items-center rounded-[14px] border-2 border-dashed border-line p-10 text-center text-[22px] text-mute";
const actionClass =
  "mt-4 inline-flex items-center gap-2 rounded-[10px] bg-accent px-5 py-2.5 text-lg font-bold text-accent-ink";

/** The area below the top bar: notices, then the Groups or an empty state. */
export function Board({ phone, splitErrorId, splitError, onShuffle, onNewRoster, onAddStudents }: BoardProps) {
  const { roster, saving, state } = useRosters();
  const { board, conflict } = state;
  const showGroups = !!roster && hasGroups(board);
  return (
    // On phones the pinned Reshuffle covers the bottom 84 px, so leave room for it.
    <main className={`flex min-h-0 flex-1 flex-col overflow-auto px-4 pt-3 ${phone && roster ? "pb-[84px]" : "pb-4"}`}>
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
      {roster && conflict && <ConflictNotice conflict={conflict} />}
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
        <Groups board={board} roster={roster} phone={phone} />
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
 */
function Groups({ board, roster, phone }: { board: BoardState; roster: Roster; phone: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [space, setSpace] = useState({ width: 0, height: 0 });

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

  const layout = boardLayout(space.width, space.height, board.groups.length);
  // Whole pixels so rounding never pushes a card onto the next row.
  const size =
    !phone && layout.cardWidth > 0 && layout.cardHeight > 0
      ? { width: Math.floor(layout.cardWidth), height: Math.floor(layout.cardHeight) }
      : null;

  return (
    <div
      ref={ref}
      className={phone ? "flex flex-col gap-[14px]" : "flex min-h-0 flex-1 flex-wrap content-start justify-center gap-[14px]"}
    >
      {board.groups.map((g, i) => (
        <GroupCard key={g.id} group={g} index={i} members={groupMembers(board, g, roster)} size={size} phone={phone} />
      ))}
    </div>
  );
}
