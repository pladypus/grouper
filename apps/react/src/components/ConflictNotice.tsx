import type { ConflictNotice as Conflict } from "../state";

/**
 * SPEC §6: the red notice after a Shuffle that hit a Conflict (the Groups on screen didn't change).
 * The plain sentence comes first; #17 adds the "Show the Rules involved" expander below it, from
 * `conflict.pairIds`.
 */
export function ConflictNotice({ conflict }: { conflict: Conflict }) {
  return (
    <div role="alert" className="mb-2.5 rounded-lg border border-bad-line bg-bad-soft px-3.5 py-2.5 text-bad">
      <p>{conflict.message}</p>
    </div>
  );
}
