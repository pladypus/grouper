import {
  canShuffle,
  keepsLockedText,
  NEED_TWO_PRESENT_MESSAGE,
  presentCount,
  shuffleButtonLabel,
  type Roster,
} from "../lib";
import { useRosters } from "../state";

const baseClass =
  "inline-flex items-center justify-center rounded-[10px] bg-accent text-xl font-extrabold leading-[1.1] text-accent-ink disabled:cursor-not-allowed disabled:opacity-50";
/** Top bar: "keeps N Locked" sits small under the label. */
const barClass = `${baseClass} flex-col px-7 py-[9px]`;
/** Phones: pinned to the bottom of the screen (spec: screens.md#top-bar-one-row-fixed-height), "keeps N Locked" beside the label. */
const pinnedClass = `${baseClass} fixed inset-x-3 bottom-3 z-20 flex-row gap-2.5 p-3.5 shadow-[0_8px_24px_rgba(0,0,0,.25)]`;

/**
 * spec: screens.md#top-bar-one-row-fixed-height item 7: Shuffle with no Groups, Reshuffle after ("keeps 2 Locked" when any Group
 * is Locked); disabled below 2 Present.
 */
export function ShuffleButton({ roster, phone, onShuffle }: { roster: Roster; phone: boolean; onShuffle: () => void }) {
  const { state } = useRosters();
  const enabled = canShuffle(presentCount(roster));
  const keeps = keepsLockedText(state.board);
  return (
    <button
      type="button"
      disabled={!enabled}
      title={enabled ? undefined : NEED_TWO_PRESENT_MESSAGE}
      onClick={onShuffle}
      className={phone ? pinnedClass : barClass}
    >
      {shuffleButtonLabel(state.board)}
      {keeps && (
        <>
          {" "}
          <small className="text-xs font-medium opacity-85">{keeps}</small>
        </>
      )}
    </button>
  );
}
