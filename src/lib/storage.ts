// localStorage adapter (spec: storage.md). Every key starts with `grouper:`. Every read and write is wrapped
// in try/catch: when storage is unavailable or full the app keeps working for the session and the UI
// shows STORAGE_UNAVAILABLE_MESSAGE. The Storage object is a parameter so tests can pass a fake.

import { normaliseName } from "./names";
import {
  DEFAULT_TARGET_SIZE,
  nextPairCreated,
  type AppState,
  type Pair,
  type Roster,
  type RosterId,
  type Student,
} from "./roster";
import { isTheme, type Theme } from "./theme";

/** The part of the Web Storage API the adapter uses (`window.localStorage` satisfies it). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const STORAGE_PREFIX = "grouper:";
export const SCHEMA_VERSION = 1;

export const STORAGE_KEYS = {
  roster: (id: RosterId) => `${STORAGE_PREFIX}roster:${id}`,
  order: `${STORAGE_PREFIX}order`,
  current: `${STORAGE_PREFIX}current`,
  theme: `${STORAGE_PREFIX}theme`,
  schema: `${STORAGE_PREFIX}schema`,
  iosTipDismissed: `${STORAGE_PREFIX}ios-tip-dismissed`,
} as const;

/** spec: storage.md: the notice shown while Rosters aren't being saved. */
export const STORAGE_UNAVAILABLE_MESSAGE =
  "This browser isn't saving your Rosters. Use Export all Rosters before you close the page.";

/**
 * The browser's localStorage, or null if it can't be reached (merely touching `localStorage`
 * throws in some privacy modes).
 */
export function browserStorage(): StorageLike | null {
  try {
    const storage = (globalThis as { localStorage?: StorageLike }).localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

export interface LoadResult {
  /** The saved Rosters, or an empty AppState (first visit) if nothing could be read. */
  readonly state: AppState;
  /** False when storage can't be read or written: show STORAGE_UNAVAILABLE_MESSAGE. */
  readonly available: boolean;
}

/**
 * Reads every saved Roster in picker order and the last-open Roster. Also records the schema
 * version, which doubles as a check that storage can be written. Never throws.
 */
export function loadAppState(storage: StorageLike | null): LoadResult {
  const empty: LoadResult = { state: { rosters: [], currentId: null }, available: false };
  if (!storage) return empty;
  let order: unknown;
  let current: string | null;
  const rosters: Roster[] = [];
  try {
    order = parseJson(storage.getItem(STORAGE_KEYS.order));
    current = storage.getItem(STORAGE_KEYS.current);
    if (Array.isArray(order)) {
      const seen = new Set<string>();
      for (const id of order) {
        if (typeof id !== "string" || seen.has(id)) continue;
        const roster = readRoster(parseJson(storage.getItem(STORAGE_KEYS.roster(id))), id);
        if (roster) {
          seen.add(id);
          rosters.push(roster);
        }
      }
    }
  } catch {
    return empty;
  }
  const currentId = rosters.some((r) => r.id === current) ? current : (rosters[0]?.id ?? null);
  let available = true;
  try {
    storage.setItem(STORAGE_KEYS.schema, String(SCHEMA_VERSION));
  } catch {
    available = false;
  }
  return { state: { rosters, currentId }, available };
}

export interface SaveResult {
  /** False when the save failed (storage unavailable or full): show STORAGE_UNAVAILABLE_MESSAGE. */
  readonly ok: boolean;
}

/**
 * Saves every Roster (with attendance and Target size), the picker order, the last-open Roster and
 * the schema version, and removes Rosters that are no longer in the AppState. Call after every
 * change. Never throws.
 */
export function saveAppState(storage: StorageLike | null, state: AppState): SaveResult {
  if (!storage) return { ok: false };
  try {
    const previous = parseJson(storage.getItem(STORAGE_KEYS.order));
    const ids = new Set(state.rosters.map((r) => r.id));
    for (const roster of state.rosters) {
      storage.setItem(STORAGE_KEYS.roster(roster.id), JSON.stringify(serialiseRoster(roster)));
    }
    storage.setItem(STORAGE_KEYS.order, JSON.stringify([...ids]));
    if (state.currentId === null) storage.removeItem(STORAGE_KEYS.current);
    else storage.setItem(STORAGE_KEYS.current, state.currentId);
    storage.setItem(STORAGE_KEYS.schema, String(SCHEMA_VERSION));
    if (Array.isArray(previous)) {
      for (const id of previous) {
        if (typeof id === "string" && !ids.has(id)) storage.removeItem(STORAGE_KEYS.roster(id));
      }
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** The remembered Theme, "auto" if none (or storage can't be read). */
export function loadTheme(storage: StorageLike | null): Theme {
  try {
    const value = storage?.getItem(STORAGE_KEYS.theme);
    return isTheme(value) ? value : "auto";
  } catch {
    return "auto";
  }
}

/** Remembers the Theme for this browser. Returns false if it couldn't be saved. */
export function saveTheme(storage: StorageLike | null, theme: Theme): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEYS.theme, theme);
    return true;
  } catch {
    return false;
  }
}

/** True once the iOS Home Screen tip has been dismissed in this browser (false if unreadable). */
export function loadIosTipDismissed(storage: StorageLike | null): boolean {
  try {
    return storage?.getItem(STORAGE_KEYS.iosTipDismissed) === "1";
  } catch {
    return false;
  }
}

/** Remembers for good that the iOS tip was dismissed. Returns false if it couldn't be saved. */
export function saveIosTipDismissed(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEYS.iosTipDismissed, "1");
    return true;
  } catch {
    return false;
  }
}

/**
 * spec: storage.md: the first time a Roster is saved, ask the browser to keep storage (silently, result
 * ignored). Pass `navigator.storage`; missing support and rejections are swallowed.
 */
export function requestPersistentStorage(manager: { persist?: () => Promise<boolean> } | undefined | null): void {
  try {
    manager?.persist?.().catch(() => {});
  } catch {
    // Ignored: persistence is a nice-to-have.
  }
}

// ---------------------------------------------------------------------------------------------

function parseJson(text: string | null): unknown {
  if (text === null) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * spec: storage.md stored shape: `{id, name, students:[{id, name, present}], pairs:[{id, type, a, b, created}], target,
 * pairClock}`. `pairClock` (the creation clock for Pairs, browser-only) came with #16: saves without
 * it still load, with the clock starting one past the newest Pair.
 */
function serialiseRoster(roster: Roster) {
  return {
    id: roster.id,
    name: roster.name,
    students: roster.students.map(({ id, name, present }) => ({ id, name, present })),
    pairs: roster.pairs.map(({ id, type, a, b, created }) => ({ id, type, a, b, created })),
    target: roster.target,
    pairClock: nextPairCreated(roster),
  };
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reads a stored Roster leniently: drops malformed Students and Pairs rather than the whole Roster. */
function readRoster(value: unknown, id: RosterId): Roster | null {
  if (!isObject(value) || typeof value.name !== "string") return null;
  const name = normaliseName(value.name);
  if (name === "") return null;

  const students: Student[] = [];
  const studentIds = new Set<string>();
  for (const s of Array.isArray(value.students) ? value.students : []) {
    if (!isObject(s) || typeof s.id !== "string" || typeof s.name !== "string") continue;
    const studentName = normaliseName(s.name);
    if (studentName === "" || studentIds.has(s.id)) continue;
    studentIds.add(s.id);
    students.push({ id: s.id, name: studentName, present: s.present !== false });
  }

  const pairs: Pair[] = [];
  for (const p of Array.isArray(value.pairs) ? value.pairs : []) {
    if (!isObject(p) || typeof p.id !== "string") continue;
    if (p.type !== "good pair" && p.type !== "keep apart") continue;
    if (typeof p.a !== "string" || typeof p.b !== "string" || p.a === p.b) continue;
    if (!studentIds.has(p.a) || !studentIds.has(p.b)) continue;
    const created = typeof p.created === "number" && Number.isFinite(p.created) ? p.created : 0;
    pairs.push({ id: p.id, type: p.type, a: p.a, b: p.b, created });
  }

  const target =
    typeof value.target === "number" && Number.isInteger(value.target) && value.target >= 2
      ? value.target
      : DEFAULT_TARGET_SIZE;

  const pairClock = nextPairCreated({ id, name, students, pairs, target, pairClock: storedClock(value.pairClock) });
  return { id, name, students, pairs, target, pairClock };
}

function storedClock(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}
