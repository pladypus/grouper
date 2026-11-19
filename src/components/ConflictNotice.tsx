import { conflictPairs, PAIR_TYPE_LABELS, SHOW_RULES_INVOLVED, type PairId, type Roster } from "../lib";
import type { ConflictNotice as Conflict } from "../state";

export interface ConflictNoticeProps {
  roster: Roster;
  conflict: Conflict;
  /** Opens the Pairs drawer with this Pair highlighted, to edit or delete it. */
  onShowPair: (pairId: PairId) => void;
}

/**
 * spec: conflicts.md: the red notice after a Shuffle that hit a Conflict (the Groups on screen didn't change).
 * The plain sentence first, then "Show the Rules involved": the clashing Pairs, newest first, each a
 * link into the Pairs drawer. No "ignore" button and no Rule on/off switch.
 */
export function ConflictNotice({ roster, conflict, onShowPair }: ConflictNoticeProps) {
  const pairs = conflictPairs(roster, conflict.pairIds);
  return (
    <div role="alert" className="mb-2.5 rounded-lg border border-bad-line bg-bad-soft px-3.5 py-2.5 text-bad print:hidden">
      <p>{conflict.message}</p>
      {pairs.length > 0 && (
        <details className="mt-1.5">
          <summary className="cursor-pointer font-semibold">{SHOW_RULES_INVOLVED}</summary>
          <ul className="mt-1 flex flex-col gap-0.5">
            {pairs.map((v) => (
              <li key={v.pair.id}>
                <button
                  type="button"
                  onClick={() => onShowPair(v.pair.id)}
                  className="rounded px-1 text-left text-ink underline decoration-bad-line underline-offset-2 hover:decoration-bad"
                >
                  {v.label} <small className="text-mute">({PAIR_TYPE_LABELS[v.pair.type]})</small>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
