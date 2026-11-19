// Pairs (Rules, SPEC §3): Good pair chains, adding and deleting Pairs with the entry-time
// refusals, the Pairs drawer's lists, and the board's oversize-chain warning.
//
// Wiring (both UIs):
// - top bar: `pairsLabel(roster)` + " ›" opens the Pairs drawer;
// - drawer: pick two Students, then ＋ Good pair / ＋ Keep apart → `addPair(roster, type, a, b, newId)`;
//   on refusal show `message` as a red line; list `pairsByType(roster)`, each with a delete button →
//   `deletePair(roster, pair.id)`;
// - board: one warning line per `oversizeChains(roster)` entry (`.message`); Shuffle stays enabled.
// Pair edits mark Groups out of date through `boardAfterRosterChange` (groups.ts).

import {
  nextPairCreated,
  UNKNOWN_STUDENT_MESSAGE,
  type IdGenerator,
  type Pair,
  type PairId,
  type PairType,
  type Result,
  type Roster,
  type StudentId,
} from "./roster";

/** How each kind is named on screen: headings, buttons ("＋ Good pair") and messages. */
export const PAIR_TYPE_LABELS: Readonly<Record<PairType, string>> = {
  "good pair": "Good pair",
  "keep apart": "Keep apart",
};

/** Both kinds, in the order the drawer shows them. */
export const PAIR_TYPES: readonly PairType[] = ["good pair", "keep apart"];

export const PAIR_EXISTS_MESSAGE = "That pair already exists.";
export const PICK_TWO_STUDENTS_MESSAGE = "Pick two different Students.";

// ---------------------------------------------------------------------------------------------
// Sentences

/** "Ana", "Ana and Ben", "Ana, Ben and Cal". */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** "Ana & Ben" (how a Pair is written everywhere). */
export function pairText(a: string, b: string): string {
  return `${a} & ${b}`;
}

/** Refusal: the two Students already have a Pair of the other kind. "Ana & Ben are already a Keep apart pair. Delete it first." */
export function pairOfOtherKindMessage(a: string, b: string, existing: PairType): string {
  const kind = existing === "good pair" ? "Good pair" : "Keep apart pair";
  return `${pairText(a, b)} are already a ${kind}. Delete it first.`;
}

/**
 * Refusal for a Keep apart pair inside one chain, naming the Good pairs that link them:
 * "Ana and Eli are linked by Good pairs (Ana & Dee, Dee & Eli), so they can't be kept apart."
 */
export function linkedByGoodPairsMessage(a: string, b: string, links: readonly (readonly [string, string])[]): string {
  return `${a} and ${b} are linked by Good pairs (${links.map(([x, y]) => pairText(x, y)).join(", ")}), so they can't be kept apart.`;
}

/** Refusal for a Good pair that would join a Keep apart pair: "This Good pair would put Ana and Ben together, but they're set to keep apart." */
export function joinsKeepApartMessage(a: string, b: string): string {
  return `This Good pair would put ${a} and ${b} together, but they're set to keep apart.`;
}

/** Board warning: "Ana, Ben and Cal are joined by Good pairs (3 students), but the number in each group is 2." */
export function oversizeChainMessage(names: readonly string[], target: number): string {
  return `${listNames(names)} are joined by Good pairs (${names.length} students), but the number in each group is ${target}.`;
}

/** Conflict (`chain-too-big`): "Ana, Dee and Eli are joined by Good pairs, so they need a group of 3, but the number in each group is 2." */
export function chainTooBigMessage(names: readonly string[], target: number): string {
  return `${listNames(names)} are joined by Good pairs, so they need a group of ${names.length}, but the number in each group is ${target}.`;
}

/** Conflict (`apart-clique`): "These 11 students must all be kept apart, but there are only 10 groups: Ana, Ben, …." */
export function apartCliqueMessage(names: readonly string[], groups: number): string {
  const only = groups === 1 ? "there is only 1 group" : `there are only ${groups} groups`;
  return `These ${names.length} students must all be kept apart, but ${only}: ${names.join(", ")}.`;
}

/** The top-bar button, "5 Pairs" / "1 Pair" (the UI adds the "›"). */
export function pairsLabel(roster: Roster): string {
  const n = roster.pairs.length;
  return `${n} ${n === 1 ? "Pair" : "Pairs"}`;
}

// ---------------------------------------------------------------------------------------------
// Chains

/** A Good pair chain: Students who must share a Group, and the Good pairs that join them. */
export interface Chain {
  /** In Roster order. */
  readonly students: readonly StudentId[];
  /** Every Good pair in the chain, in creation order. */
  readonly pairs: readonly Pair[];
}

function byCreated(pairs: readonly Pair[]): Pair[] {
  return [...pairs].sort((x, y) => x.created - y.created);
}

/** Good pairs between Students who are both still on the Roster. */
function liveGoodPairs(roster: Roster): Pair[] {
  const ids = new Set(roster.students.map((s) => s.id));
  return roster.pairs.filter((p) => p.type === "good pair" && ids.has(p.a) && ids.has(p.b));
}

/** Union-find over the Roster's Good pairs: Student id → chain root. */
function chainRoots(roster: Roster, extra?: Pair): (id: StudentId) => StudentId {
  const parent = new Map<StudentId, StudentId>();
  const find = (x: StudentId): StudentId => {
    let root = x;
    while (parent.has(root) && parent.get(root) !== root) root = parent.get(root)!;
    while (x !== root) {
      const next = parent.get(x)!;
      parent.set(x, root);
      x = next;
    }
    return root;
  };
  for (const p of extra ? [...liveGoodPairs(roster), extra] : liveGoodPairs(roster)) {
    const ra = find(p.a);
    const rb = find(p.b);
    if (ra !== rb) parent.set(ra, rb);
  }
  return find;
}

/**
 * Every chain of the Roster's Good pairs (Present or not), each with at least 2 Students. Chains
 * come in the Roster order of their first Student.
 */
export function goodPairChains(roster: Roster): Chain[] {
  const find = chainRoots(roster);
  const pairs = byCreated(liveGoodPairs(roster));
  const byRoot = new Map<StudentId, { students: StudentId[]; pairs: Pair[] }>();
  for (const p of pairs) {
    const root = find(p.a);
    if (!byRoot.has(root)) byRoot.set(root, { students: [], pairs: [] });
    byRoot.get(root)!.pairs.push(p);
  }
  const chains: Chain[] = [];
  const seen = new Set<StudentId>();
  for (const s of roster.students) {
    const chain = byRoot.get(find(s.id));
    if (!chain) continue;
    chain.students.push(s.id);
    if (!seen.has(find(s.id))) {
      seen.add(find(s.id));
      chains.push(chain);
    }
  }
  return chains;
}

/**
 * The chains narrowed to Present Students (SPEC §3): Absent members never break a chain, so the
 * Present ones still share a Group. Only chains with at least 2 Present Students; `pairs` keeps the
 * whole chain's Good pairs.
 */
export function presentChains(roster: Roster): Chain[] {
  const present = new Set(roster.students.filter((s) => s.present).map((s) => s.id));
  return goodPairChains(roster)
    .map((c) => ({ students: c.students.filter((id) => present.has(id)), pairs: c.pairs }))
    .filter((c) => c.students.length >= 2);
}

/**
 * The Good pairs that link two Students, in order from `from` to `to` (fewest links), or null if
 * they aren't in one chain.
 */
export function goodPairPath(roster: Roster, from: StudentId, to: StudentId): Pair[] | null {
  if (from === to) return [];
  const edges = new Map<StudentId, Pair[]>();
  for (const p of byCreated(liveGoodPairs(roster))) {
    for (const s of [p.a, p.b]) {
      if (!edges.has(s)) edges.set(s, []);
      edges.get(s)!.push(p);
    }
  }
  const via = new Map<StudentId, Pair | null>([[from, null]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const s = queue[i]!;
    for (const p of edges.get(s) ?? []) {
      const t = p.a === s ? p.b : p.a;
      if (via.has(t)) continue;
      via.set(t, p);
      if (t === to) {
        const path: Pair[] = [];
        for (let at = to; at !== from; ) {
          const step = via.get(at)!;
          path.unshift(step);
          at = step.a === at ? step.b : step.a;
        }
        return path;
      }
      queue.push(t);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Adding and deleting Pairs

function nameMap(roster: Roster): Map<StudentId, string> {
  return new Map(roster.students.map((s) => [s.id, s.name]));
}

/** "Ana and Eli are linked by Good pairs (Ana & Dee, Dee & Eli), …" for two Students in one chain, written from `a` to `b`. */
export function keepApartInsideChainMessage(roster: Roster, a: StudentId, b: StudentId): string {
  const names = nameMap(roster);
  const links: [string, string][] = [];
  let at = a;
  for (const p of goodPairPath(roster, a, b) ?? []) {
    const next = p.a === at ? p.b : p.a;
    links.push([names.get(at) ?? "", names.get(next) ?? ""]);
    at = next;
  }
  return linkedByGoodPairsMessage(names.get(a) ?? "", names.get(b) ?? "", links);
}

/** The Pair between these two Students (either order), if any. */
export function findPair(roster: Roster, a: StudentId, b: StudentId): Pair | undefined {
  return roster.pairs.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));
}

/**
 * Checks a new Pair without adding it (SPEC §3). Refused when the two Students are the same or not
 * on the Roster, already have a Pair (of either kind), or when the Pair would put a Keep apart pair
 * inside one Good pair chain.
 */
export function checkPair(roster: Roster, type: PairType, a: StudentId, b: StudentId): Result<object> {
  if (a === b) return { ok: false, message: PICK_TWO_STUDENTS_MESSAGE };
  const names = nameMap(roster);
  if (!names.has(a) || !names.has(b)) return { ok: false, message: UNKNOWN_STUDENT_MESSAGE };

  const existing = findPair(roster, a, b);
  if (existing) {
    if (existing.type === type) return { ok: false, message: PAIR_EXISTS_MESSAGE };
    return { ok: false, message: pairOfOtherKindMessage(names.get(existing.a)!, names.get(existing.b)!, existing.type) };
  }

  const find = chainRoots(roster);
  if (type === "keep apart") {
    if (find(a) === find(b)) return { ok: false, message: keepApartInsideChainMessage(roster, a, b) };
    return { ok: true };
  }

  // A Good pair joins chain(a) and chain(b): refuse if a Keep apart pair spans the two.
  const ra = find(a);
  const rb = find(b);
  const clash = byCreated(roster.pairs).find(
    (p) =>
      p.type === "keep apart" &&
      names.has(p.a) &&
      names.has(p.b) &&
      ((find(p.a) === ra && find(p.b) === rb) || (find(p.a) === rb && find(p.b) === ra)),
  );
  if (clash) return { ok: false, message: joinsKeepApartMessage(names.get(clash.a)!, names.get(clash.b)!) };
  return { ok: true };
}

/** Adds a Pair (＋ Good pair / ＋ Keep apart), stamped with the Roster's Pair clock. Refusals as in `checkPair`. */
export function addPair(
  roster: Roster,
  type: PairType,
  a: StudentId,
  b: StudentId,
  newId: IdGenerator,
): Result<{ roster: Roster; pair: Pair }> {
  const check = checkPair(roster, type, a, b);
  if (!check.ok) return check;
  const created = nextPairCreated(roster);
  const pair: Pair = { id: newId(), type, a, b, created };
  return { ok: true, pair, roster: { ...roster, pairs: [...roster.pairs, pair], pairClock: created + 1 } };
}

/** Deletes a Pair. Unknown ids leave the Roster unchanged. The Pair clock doesn't go back. */
export function deletePair(roster: Roster, pairId: PairId): Roster {
  if (!roster.pairs.some((p) => p.id === pairId)) return roster;
  return { ...roster, pairs: roster.pairs.filter((p) => p.id !== pairId), pairClock: nextPairCreated(roster) };
}

// ---------------------------------------------------------------------------------------------
// The Pairs drawer and the board

/** One row in the Pairs drawer. */
export interface PairView {
  readonly pair: Pair;
  /** The two Students' current names, in the Pair's order. */
  readonly names: readonly [string, string];
  /** "Ana & Ben". */
  readonly label: string;
}

/** The Pairs drawer's two lists, each in creation order (oldest first). */
export interface PairsByType {
  readonly goodPairs: readonly PairView[];
  readonly keepApart: readonly PairView[];
}

export function pairView(roster: Roster, pair: Pair): PairView {
  const names = nameMap(roster);
  const pairNames = [names.get(pair.a) ?? "", names.get(pair.b) ?? ""] as const;
  return { pair, names: pairNames, label: pairText(...pairNames) };
}

/** Existing Pairs listed by kind for the drawer. */
export function pairsByType(roster: Roster): PairsByType {
  const views = byCreated(roster.pairs).map((p) => pairView(roster, p));
  return {
    goodPairs: views.filter((v) => v.pair.type === "good pair"),
    keepApart: views.filter((v) => v.pair.type === "keep apart"),
  };
}

/** A Present chain bigger than the Target size, with the board's warning sentence. */
export interface OversizeChain extends Chain {
  readonly message: string;
}

/**
 * Present chains bigger than the Target size (SPEC §3): show each `message` on the board as soon as
 * it applies. Shuffle stays enabled (and reports the Conflict).
 */
export function oversizeChains(roster: Roster): OversizeChain[] {
  const names = nameMap(roster);
  return presentChains(roster)
    .filter((c) => c.students.length > roster.target)
    .map((c) => ({ ...c, message: oversizeChainMessage(c.students.map((id) => names.get(id)!), roster.target) }));
}
