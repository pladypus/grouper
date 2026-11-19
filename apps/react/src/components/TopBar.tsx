import { canDeleteRoster, presentCount } from "@grouper/core";
import ChevronRight from "lucide-react/icons/chevron-right";
import Users from "lucide-react/icons/users";
import { useRosters } from "../state";
import { RosterMenu } from "./RosterMenu";
import { ThemeButton } from "./ThemeButton";

export interface TopBarProps {
  onOpenStudents: () => void;
  onNewRoster: () => void;
  onRenameRoster: () => void;
  onDeleteRoster: () => void;
  onDeleteRefused: () => void;
}

/** One row, fixed height (SPEC §8). Items 3–5 and 7 (Pairs, group size, Share, Shuffle) come later. */
export function TopBar(props: TopBarProps) {
  const { state, roster, selectRoster, storage } = useRosters();
  return (
    <header className="sticky top-0 z-10 flex flex-none flex-wrap items-center gap-x-5 gap-y-2.5 border-b border-line bg-panel px-4 py-2.5">
      {roster && (
        <>
          <div className="flex items-center gap-2">
            <select
              aria-label="Roster"
              value={roster.id}
              onChange={(e) => selectRoster(e.target.value)}
              className="rounded-md border border-line bg-field px-2.5 py-1.5 text-[17px] font-bold"
            >
              {state.app.rosters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <RosterMenu
              canDelete={canDeleteRoster(state.app)}
              onNew={props.onNewRoster}
              onRename={props.onRenameRoster}
              onDelete={props.onDeleteRoster}
              onDeleteRefused={props.onDeleteRefused}
            />
          </div>
          <div className="flex items-center gap-2 border-l border-line pl-5">
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={props.onOpenStudents}
              className="inline-flex items-center gap-[7px] whitespace-nowrap rounded-full border border-line bg-panel px-3 py-[7px] font-semibold hover:border-mute"
            >
              <Users aria-hidden="true" className="size-[18px] flex-none" />
              <span>
                <b className="text-accent">{presentCount(roster)}</b>/{roster.students.length} Present
              </span>
              <ChevronRight aria-hidden="true" className="-ml-0.5 size-3.5 flex-none text-mute" />
            </button>
          </div>
        </>
      )}
      <span className="flex-1" />
      <ThemeButton storage={storage} />
    </header>
  );
}
