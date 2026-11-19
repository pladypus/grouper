import { describe, expect, it, vi } from "vitest";
import {
  addStudent,
  createRoster,
  EMPTY_APP_STATE,
  togglePresent,
  updateRoster,
  type AppState,
  type Roster,
} from "./roster";
import { addPair, deletePair } from "./rules";

const currentRosterOf = (state: AppState): Roster => state.rosters.find((r) => r.id === "id1")!;
import {
  loadAppState,
  loadTheme,
  requestPersistentStorage,
  saveAppState,
  saveTheme,
  STORAGE_UNAVAILABLE_MESSAGE,
  type StorageLike,
} from "./storage";

class FakeStorage implements StorageLike {
  readonly data = new Map<string, string>();
  failWrites = false;
  failReads = false;
  getItem(key: string) {
    if (this.failReads) throw new Error("SecurityError");
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error("QuotaExceededError");
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

function sampleState(): AppState {
  let n = 0;
  const newId = () => `id${++n}`;
  let state = EMPTY_APP_STATE;
  for (const name of ["Period 1", "Period 2"]) {
    const created = createRoster(state, name, newId);
    if (!created.ok) throw new Error(created.message);
    state = created.state;
  }
  for (const name of ["Ana", "Ben"]) {
    state = updateRoster(state, "id1", (r) => {
      const added = addStudent(r, name, newId);
      return added.ok ? added.roster : r;
    });
  }
  return updateRoster(state, "id1", (r) => ({ ...togglePresent(r, "id4"), target: 3 }));
}

describe("storage", () => {
  it("round-trips Rosters with attendance and Target size, order and the last-open Roster", () => {
    const storage = new FakeStorage();
    const state = sampleState();
    expect(saveAppState(storage, state)).toEqual({ ok: true });
    expect(loadAppState(storage)).toEqual({ state, available: true });
  });

  it("stores everything under grouper: keys with the spec's shape and a schema version", () => {
    const storage = new FakeStorage();
    saveAppState(storage, sampleState());
    expect([...storage.data.keys()].sort()).toEqual([
      "grouper:current",
      "grouper:order",
      "grouper:roster:id1",
      "grouper:roster:id2",
      "grouper:schema",
    ]);
    expect(storage.data.get("grouper:schema")).toBe("1");
    expect(storage.data.get("grouper:order")).toBe(`["id1","id2"]`);
    expect(storage.data.get("grouper:current")).toBe("id2");
    expect(JSON.parse(storage.data.get("grouper:roster:id1")!)).toEqual({
      id: "id1",
      name: "Period 1",
      students: [
        { id: "id3", name: "Ana", present: true },
        { id: "id4", name: "Ben", present: false },
      ],
      pairs: [],
      target: 3,
      pairClock: 0,
    });
  });

  it("removes a deleted Roster's key", () => {
    const storage = new FakeStorage();
    const state = sampleState();
    saveAppState(storage, state);
    saveAppState(storage, { rosters: state.rosters.slice(0, 1), currentId: "id1" });
    expect(storage.data.has("grouper:roster:id2")).toBe(false);
  });

  it("loads an empty AppState on first visit", () => {
    expect(loadAppState(new FakeStorage())).toEqual({ state: { rosters: [], currentId: null }, available: true });
  });

  it("falls back to the first Roster when the last-open one is missing", () => {
    const storage = new FakeStorage();
    saveAppState(storage, sampleState());
    storage.data.set("grouper:current", "gone");
    expect(loadAppState(storage).state.currentId).toBe("id1");
  });

  it("skips malformed data instead of failing", () => {
    const storage = new FakeStorage();
    storage.data.set("grouper:order", `["a","b","c","a"]`);
    storage.data.set("grouper:roster:a", "not json");
    storage.data.set(
      "grouper:roster:b",
      JSON.stringify({
        name: " Period  2 ",
        students: [{ id: "s1", name: "Ana" }, { id: "s2" }, { id: "s3", name: "Ben", present: false }],
        pairs: [
          { id: "p1", type: "good pair", a: "s1", b: "s3", created: 1 },
          { id: "p2", type: "good pair", a: "s1", b: "s2", created: 2 },
          { id: "p3", type: "nonsense", a: "s1", b: "s3", created: 3 },
        ],
        target: 1,
      }),
    );
    const { state } = loadAppState(storage);
    expect(state.rosters).toEqual([
      {
        id: "b",
        name: "Period 2",
        students: [
          { id: "s1", name: "Ana", present: true },
          { id: "s3", name: "Ben", present: false },
        ],
        pairs: [{ id: "p1", type: "good pair", a: "s1", b: "s3", created: 1 }],
        target: 4,
        pairClock: 2,
      },
    ]);
    expect(state.currentId).toBe("b");
  });

  it("keeps the Pair clock, so a deleted newest Pair's number isn't reused after a reload", () => {
    const storage = new FakeStorage();
    let state = sampleState();
    let n = 0;
    const newId = () => `p${++n}`;
    state = updateRoster(state, "id1", (r) => {
      const added = addPair(r, "keep apart", "id3", "id4", newId);
      if (!added.ok) throw new Error(added.message);
      return deletePair(added.roster, added.pair.id);
    });
    expect(currentRosterOf(state).pairClock).toBe(1);
    saveAppState(storage, state);
    expect(JSON.parse(storage.data.get("grouper:roster:id1")!).pairClock).toBe(1);
    const loaded = loadAppState(storage).state;
    expect(loaded).toEqual(state);
    const again = addPair(loaded.rosters[0]!, "good pair", "id3", "id4", newId);
    expect(again.ok && again.pair.created).toBe(1);
  });

  it("loads saves from before the Pair clock, starting it one past the newest Pair", () => {
    const storage = new FakeStorage();
    storage.data.set("grouper:order", `["r"]`);
    storage.data.set(
      "grouper:roster:r",
      JSON.stringify({
        id: "r",
        name: "Old",
        students: [{ id: "a", name: "Ana", present: true }, { id: "b", name: "Ben", present: true }],
        pairs: [{ id: "p1", type: "good pair", a: "a", b: "b", created: 7 }],
        target: 4,
      }),
    );
    expect(loadAppState(storage).state.rosters[0]!.pairClock).toBe(8);
    storage.data.set("grouper:roster:r", JSON.stringify({ name: "Old", pairClock: 20, students: [], pairs: [] }));
    expect(loadAppState(storage).state.rosters[0]!.pairClock).toBe(20);
    storage.data.set("grouper:roster:r", JSON.stringify({ name: "Old", pairClock: "x", students: [], pairs: [] }));
    expect(loadAppState(storage).state.rosters[0]!.pairClock).toBe(0);
  });

  it("reports unavailable storage on load without throwing", () => {
    const unreadable = new FakeStorage();
    unreadable.failReads = true;
    expect(loadAppState(unreadable)).toEqual({ state: EMPTY_APP_STATE, available: false });
    expect(loadAppState(null).available).toBe(false);

    const unwritable = new FakeStorage();
    unwritable.failWrites = true;
    expect(loadAppState(unwritable).available).toBe(false);
  });

  it("reports a failed save (full or unavailable) without throwing", () => {
    const storage = new FakeStorage();
    storage.failWrites = true;
    expect(saveAppState(storage, sampleState())).toEqual({ ok: false });
    expect(saveAppState(null, sampleState())).toEqual({ ok: false });
    expect(STORAGE_UNAVAILABLE_MESSAGE).toBe(
      "This browser isn't saving your Rosters. Use Export all Rosters before you close the page.",
    );
  });
});

describe("theme storage", () => {
  it("remembers the Theme and defaults to auto", () => {
    const storage = new FakeStorage();
    expect(loadTheme(storage)).toBe("auto");
    expect(saveTheme(storage, "dark")).toBe(true);
    expect(storage.data.get("grouper:theme")).toBe("dark");
    expect(loadTheme(storage)).toBe("dark");
    storage.data.set("grouper:theme", "purple");
    expect(loadTheme(storage)).toBe("auto");
  });

  it("survives unavailable storage", () => {
    const storage = new FakeStorage();
    storage.failReads = true;
    storage.failWrites = true;
    expect(loadTheme(storage)).toBe("auto");
    expect(saveTheme(storage, "light")).toBe(false);
    expect(loadTheme(null)).toBe("auto");
  });
});

describe("requestPersistentStorage", () => {
  it("calls persist and swallows failures", async () => {
    const persist = vi.fn(() => Promise.reject(new Error("no")));
    requestPersistentStorage({ persist });
    expect(persist).toHaveBeenCalledOnce();
    requestPersistentStorage(undefined);
    requestPersistentStorage({});
    await Promise.resolve();
  });
});
