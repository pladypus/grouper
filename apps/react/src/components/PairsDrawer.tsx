import {
  PAIR_TYPE_LABELS,
  PAIR_TYPES,
  pairsByType,
  PICK_TWO_STUDENTS_MESSAGE,
  type PairType,
  type PairView,
} from "@grouper/core";
import X from "lucide-react/icons/x";
import { useId, useState } from "react";
import { useRosters } from "../state";
import { Drawer, drawerErrorClass } from "./Drawer";

/** Each list's heading and what the kind means (from the main-screen prototype). */
const LISTS: Record<PairType, { heading: string; hint: string }> = {
  "good pair": { heading: "Good pairs", hint: "always in the same Group" },
  "keep apart": { heading: "Keep apart", hint: "never in the same Group" },
};

const selectClass = "min-w-0 rounded-md border border-line bg-field px-2 py-1.5";
const addClass: Record<PairType, string> = {
  "good pair": "flex-1 rounded-md border border-ok bg-panel p-2 font-semibold text-ok",
  "keep apart": "flex-1 rounded-md border border-bad bg-panel p-2 font-semibold text-bad",
};

/** SPEC §8 Pairs drawer: pick two Students, ＋ Good pair / ＋ Keep apart; the Pairs listed by kind, each deletable. */
export function PairsDrawer({ onClose }: { onClose: () => void }) {
  const { roster, addPair } = useRosters();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  if (!roster) return null;
  const lists = pairsByType(roster);

  const add = (type: PairType) => {
    const refusal = a && b ? addPair(type, a, b) : PICK_TWO_STUDENTS_MESSAGE;
    setError(refusal);
    if (!refusal) {
      setA("");
      setB("");
    }
  };

  const picker = (label: string, value: string, set: (id: string) => void) => (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => {
        set(e.target.value);
        setError(null);
      }}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      className={selectClass}
    >
      <option value="">Student…</option>
      {roster.students.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );

  return (
    <Drawer title="Pairs" onClose={onClose}>
      <div className="mt-1.5 mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 rounded-[10px] bg-bg p-2.5">
        {picker("First Student", a, setA)}
        <span aria-hidden="true">&amp;</span>
        {picker("Second Student", b, setB)}
        <div className="col-span-full flex gap-1.5">
          {PAIR_TYPES.map((type) => (
            <button key={type} type="button" className={addClass[type]} onClick={() => add(type)}>
              ＋ {PAIR_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p id={errorId} role="alert" className={drawerErrorClass}>
          {error}
        </p>
      )}
      <PairList type="good pair" pairs={lists.goodPairs} />
      <PairList type="keep apart" pairs={lists.keepApart} />
    </Drawer>
  );
}

function PairList({ type, pairs }: { type: PairType; pairs: readonly PairView[] }) {
  const { deletePair } = useRosters();
  const { heading, hint } = LISTS[type];
  return (
    <div>
      <h3 className="mt-3.5 mb-1 font-bold">
        {heading} <small className="font-normal text-mute">{hint}</small>
      </h3>
      <ul aria-label={heading}>
        {pairs.length === 0 ? (
          <li className="px-2 py-1.5 text-mute">None yet</li>
        ) : (
          pairs.map((v) => (
            <li key={v.pair.id} className="flex items-center justify-between gap-1.5 rounded-md px-2 py-1.5 hover:bg-bg">
              <span>{v.label}</span>
              <button
                type="button"
                aria-label={`Delete ${v.label}`}
                onClick={() => deletePair(v.pair.id)}
                className="inline-flex items-center rounded px-1 text-mute hover:text-bad"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
