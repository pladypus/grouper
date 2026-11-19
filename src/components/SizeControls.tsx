import { currentSplit, MIN_TARGET_SIZE, NEED_TWO_PRESENT_MESSAGE, splitInputText, splitText, type Roster } from "../lib";
import { useId, useState } from "react";
import { useRosters } from "../state";

export interface SizeControlsProps {
  roster: Roster;
  /** Id of the board notice that shows `splitError`, for aria-describedby. */
  splitErrorId: string;
  splitError: string | null;
  /** The Split refusal goes on the board so the bar never changes height (SPEC §8). */
  onSplitError: (message: string | null) => void;
}

const linkClass = "px-1 text-accent underline";
const smallButtonClass = "rounded-md border border-line bg-panel px-2.5 py-1 text-ink hover:border-mute";

/** SPEC §8 top bar item 4: the "Number of students in group" stepper, the Split in words, and "Edit". */
export function SizeControls({ roster, splitErrorId, splitError, onSplitError }: SizeControlsProps) {
  const { state, stepTarget, editSplit, resetSplit } = useRosters();
  const labelId = useId();
  /** The sizes being typed in "Edit", or null when not editing. */
  const [draft, setDraft] = useState<string | null>(null);
  const split = currentSplit(state.board, roster);
  const edited = state.board.editedSplit !== null;

  const stopEditing = () => {
    setDraft(null);
    onSplitError(null);
  };

  return (
    <div className="flex flex-col gap-0.5">
      <span id={labelId} className="text-xs font-semibold uppercase tracking-[.04em] text-mute">
        Number of students in group
      </span>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <div role="group" aria-labelledby={labelId} className="inline-flex items-center overflow-hidden rounded-lg border border-line">
          <button
            type="button"
            aria-label="Fewer"
            disabled={roster.target <= MIN_TARGET_SIZE}
            onClick={() => stepTarget(-1)}
            className="size-8 bg-field text-lg disabled:cursor-not-allowed disabled:opacity-40"
          >
            −
          </button>
          <output aria-labelledby={labelId} className="min-w-[34px] text-center text-lg font-extrabold">
            {roster.target}
          </output>
          <button type="button" aria-label="More" onClick={() => stepTarget(1)} className="size-8 bg-field text-lg">
            +
          </button>
        </div>
        {draft === null ? (
          <span className="text-sm text-mute">
            {split.length === 0 ? (
              NEED_TWO_PRESENT_MESSAGE
            ) : (
              <>
                {splitText(split)}
                {edited && " (edited)"}{" "}
                <button type="button" className={linkClass} onClick={() => setDraft(splitInputText(split))}>
                  Edit
                </button>
                {edited && (
                  <button type="button" className={linkClass} onClick={resetSplit}>
                    Automatic
                  </button>
                )}
              </>
            )}
          </span>
        ) : (
          <form
            className="flex items-center gap-1.5 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              const refusal = editSplit(draft);
              if (refusal) onSplitError(refusal);
              else stopEditing();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") stopEditing();
            }}
          >
            <input
              aria-label="Group sizes, comma separated"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              aria-invalid={splitError ? true : undefined}
              aria-describedby={splitError ? splitErrorId : undefined}
              className="w-[130px] rounded-md border border-line bg-field px-2 py-1"
            />
            <button type="submit" className={smallButtonClass}>
              Save
            </button>
            <button type="button" className={smallButtonClass} onClick={stopEditing}>
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
