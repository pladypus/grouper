import { canDeleteRoster, pairsLabel, presentCount } from "../lib";
import ChevronRight from "lucide-react/icons/chevron-right";
import Link2 from "lucide-react/icons/link-2";
import Users from "lucide-react/icons/users";
import { useRosters } from "../state";
import { RosterMenu } from "./RosterMenu";
import { ShuffleButton } from "./ShuffleButton";
import { SizeControls } from "./SizeControls";
import { ThemeButton } from "./ThemeButton";

export interface TopBarProps {
  phone: boolean;
  splitErrorId: string;
  splitError: string | null;
  onSplitError: (message: string | null) => void;
  onShuffle: () => void;
  onOpenStudents: () => void;
  onOpenPairs: () => void;
  onNewRoster: () => void;
  onRenameRoster: () => void;
  onExportRoster: () => void;
  onExportAll: () => void;
  onImport: () => void;
  onDeleteRoster: () => void;
  onDeleteRefused: () => void;
}

/** The "23/25 Present ›" and "5 Pairs ›" buttons. */
const pillClass =
  "inline-flex items-center gap-[7px] whitespace-nowrap rounded-full border border-line bg-panel px-3 py-[7px] font-semibold hover:border-mute";

/** One row, fixed height (SPEC §8). Item 5 (Share) comes later. */
export function TopBar(props: TopBarProps) {
  const { state, roster, selectRoster, storage } = useRosters();
  const zoneClass = props.phone ? "flex items-center gap-2" : "flex items-center gap-2 border-l border-line pl-5";
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
              onExport={props.onExportRoster}
              onExportAll={props.onExportAll}
              onImport={props.onImport}
              onDelete={props.onDeleteRoster}
              onDeleteRefused={props.onDeleteRefused}
            />
          </div>
          <div className={zoneClass}>
            <button type="button" aria-haspopup="dialog" onClick={props.onOpenStudents} className={pillClass}>
              <Users aria-hidden="true" className="size-[18px] flex-none" />
              <span>
                <b className="text-accent">{presentCount(roster)}</b>/{roster.students.length} Present
              </span>
              <ChevronRight aria-hidden="true" className="-ml-0.5 size-3.5 flex-none text-mute" />
            </button>
            <button type="button" aria-haspopup="dialog" onClick={props.onOpenPairs} className={pillClass}>
              <Link2 aria-hidden="true" className="size-[18px] flex-none" />
              <span>{pairsLabel(roster)}</span>
              <ChevronRight aria-hidden="true" className="-ml-0.5 size-3.5 flex-none text-mute" />
            </button>
          </div>
          <div className={zoneClass}>
            {/* Keyed so switching Roster closes an open "Edit". */}
            <SizeControls
              key={roster.id}
              roster={roster}
              splitErrorId={props.splitErrorId}
              splitError={props.splitError}
              onSplitError={props.onSplitError}
            />
          </div>
        </>
      )}
      <span className="flex-1" />
      <ThemeButton storage={storage} />
      {roster && <ShuffleButton roster={roster} phone={props.phone} onShuffle={props.onShuffle} />}
    </header>
  );
}
