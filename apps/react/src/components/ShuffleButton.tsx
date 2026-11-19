import { canShuffle, NEED_TWO_PRESENT_MESSAGE, presentCount, shuffleButtonLabel, type Roster } from "@grouper/core";
import { useRosters } from "../state";

const baseClass =
  "inline-flex items-center justify-center rounded-[10px] bg-accent text-xl font-extrabold leading-[1.1] text-accent-ink disabled:cursor-not-allowed disabled:opacity-50";
const barClass = `${baseClass} px-7 py-[9px]`;
/** Phones: pinned to the bottom of the screen (SPEC §8). */
const pinnedClass = `${baseClass} fixed inset-x-3 bottom-3 z-20 p-3.5 shadow-[0_8px_24px_rgba(0,0,0,.25)]`;

/** SPEC §8 top bar item 7: Shuffle with no Groups, Reshuffle after; disabled below 2 Present. */
export function ShuffleButton({ roster, phone, onShuffle }: { roster: Roster; phone: boolean; onShuffle: () => void }) {
  const { state } = useRosters();
  const enabled = canShuffle(presentCount(roster));
  return (
    <button
      type="button"
      disabled={!enabled}
      title={enabled ? undefined : NEED_TWO_PRESENT_MESSAGE}
      onClick={onShuffle}
      className={phone ? pinnedClass : barClass}
    >
      {shuffleButtonLabel(state.board)}
    </button>
  );
}
