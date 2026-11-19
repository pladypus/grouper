import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import {
  chainTooBigMessage,
  EMPTY_BOARD_MESSAGE,
  joinsKeepApartMessage,
  linkedByGoodPairsMessage,
  loadAppState,
  noGroupingMessage,
  OUT_OF_DATE_MESSAGE,
  oversizeChainMessage,
  PAIR_EXISTS_MESSAGE,
  pairOfOtherKindMessage,
  PICK_TWO_STUDENTS_MESSAGE,
  saveAppState,
  seededRng,
  type AppState,
  type Pair,
  type StorageLike,
} from "@grouper/core";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App.svelte";

// #16: Pairs that every Shuffle obeys. The rng is seeded so every run makes the same Groups.

class MemoryStorage implements StorageLike {
  items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

function idGenerator() {
  let n = 0;
  return () => `id${++n}`;
}

const NAMES = ["Ana", "Ben", "Cal", "Dee", "Eli", "Fay", "Gus", "Hal"];
const pair = (type: Pair["type"], a: string, b: string, created: number): Pair => ({
  id: `${a}-${b}`,
  type,
  a: a.toLowerCase(),
  b: b.toLowerCase(),
  created,
});

function start(count: number, { pairs = [] as Pair[], target = 4, absent = [] as string[] } = {}) {
  const state: AppState = {
    rosters: [
      {
        id: "p2",
        name: "Period 2",
        students: NAMES.slice(0, count).map((name) => ({
          id: name.toLowerCase(),
          name,
          present: !absent.includes(name),
        })),
        pairs,
        target,
      },
    ],
    currentId: "p2",
  };
  const storage = new MemoryStorage();
  saveAppState(storage, state);
  render(App, { storage, newId: idGenerator(), rng: seededRng(16), storageManager: null });
  return storage;
}

const savedPairs = (storage: MemoryStorage) => loadAppState(storage).state.rosters[0]!.pairs;
const pairsPill = () => screen.getByRole("button", { name: /^\d+ Pairs?$/ });
const drawer = () => screen.getByRole("dialog", { name: "Pairs" });
const list = (name: "Good pairs" | "Keep apart") => within(drawer()).getByRole("list", { name });
const rows = (name: "Good pairs" | "Keep apart") =>
  within(list(name))
    .getAllByRole("listitem")
    .map((li) => li.textContent!.trim());

async function pick(a: string, b: string) {
  await fireEvent.change(screen.getByRole("combobox", { name: "First Student" }), { target: { value: a.toLowerCase() } });
  await fireEvent.change(screen.getByRole("combobox", { name: "Second Student" }), { target: { value: b.toLowerCase() } });
}

async function addPair(kind: "Good pair" | "Keep apart", a: string, b: string) {
  await pick(a, b);
  await fireEvent.click(screen.getByRole("button", { name: `＋ ${kind}` }));
}

async function openPairs() {
  await fireEvent.click(pairsPill());
}

/** The top bar's Shuffle / Reshuffle (the out-of-date notice has its own Reshuffle). */
const shuffleButton = () => screen.getAllByRole("button", { name: /^(Re)?[Ss]huffle$/ })[0]!;
const groupNames = () =>
  screen
    .queryAllByRole("region")
    .map((card) => within(card).getAllByRole("listitem").map((li) => li.querySelector("span.truncate")!.textContent!));

afterEach(() => cleanup());

describe("Pairs drawer", () => {
  it("counts the Pairs on the top bar and opens the drawer", async () => {
    start(4, { pairs: [pair("good pair", "Ana", "Ben", 1)] });
    expect(pairsPill()).toHaveTextContent("1 Pair");
    await openPairs();
    expect(drawer()).toBeInTheDocument();
    expect(rows("Good pairs")).toEqual(["Ana & Ben"]);
    expect(rows("Keep apart")).toEqual(["None yet"]);
    await fireEvent.click(within(drawer()).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("adds Good pairs and Keep apart pairs, listed by kind in creation order, and saves them", async () => {
    const storage = start(6);
    expect(pairsPill()).toHaveTextContent("0 Pairs");
    await openPairs();
    expect(rows("Good pairs")).toEqual(["None yet"]);

    await addPair("Good pair", "Cal", "Dee");
    await addPair("Keep apart", "Ana", "Ben");
    await addPair("Good pair", "Ana", "Eli");

    expect(rows("Good pairs")).toEqual(["Cal & Dee", "Ana & Eli"]);
    expect(rows("Keep apart")).toEqual(["Ana & Ben"]);
    expect(pairsPill()).toHaveTextContent("3 Pairs");
    // The pickers clear after each add.
    expect(screen.getByRole("combobox", { name: "First Student" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Second Student" })).toHaveValue("");

    const saved = savedPairs(storage);
    expect(saved.map((p) => [p.type, p.a, p.b])).toEqual([
      ["good pair", "cal", "dee"],
      ["keep apart", "ana", "ben"],
      ["good pair", "ana", "eli"],
    ]);
    // Each Pair records its creation order.
    expect(saved.map((p) => p.created)).toEqual([0, 1, 2]);
  });

  it("deletes a Pair", async () => {
    const storage = start(4, { pairs: [pair("good pair", "Ana", "Ben", 1), pair("keep apart", "Cal", "Dee", 2)] });
    await openPairs();
    await fireEvent.click(within(list("Keep apart")).getByRole("button", { name: "Delete Cal & Dee" }));
    expect(rows("Keep apart")).toEqual(["None yet"]);
    expect(rows("Good pairs")).toEqual(["Ana & Ben"]);
    expect(pairsPill()).toHaveTextContent("1 Pair");
    expect(savedPairs(storage).map((p) => p.id)).toEqual(["Ana-Ben"]);
  });

  describe("refuses on entry with the spec's sentences", () => {
    const refusal = () => within(drawer()).getByRole("alert");

    it("needs two different Students", async () => {
      start(4);
      await openPairs();
      await fireEvent.click(screen.getByRole("button", { name: "＋ Good pair" }));
      expect(refusal()).toHaveTextContent(PICK_TWO_STUDENTS_MESSAGE);
      await addPair("Keep apart", "Ana", "Ana");
      expect(refusal()).toHaveTextContent(PICK_TWO_STUDENTS_MESSAGE);
      await fireEvent.change(screen.getByRole("combobox", { name: "Second Student" }), { target: { value: "" } });
      await fireEvent.click(screen.getByRole("button", { name: "＋ Good pair" }));
      expect(refusal()).toHaveTextContent(PICK_TWO_STUDENTS_MESSAGE);
    });

    it("refuses a repeated pair, in either order", async () => {
      const storage = start(4, { pairs: [pair("good pair", "Ana", "Ben", 1)] });
      await openPairs();
      await addPair("Good pair", "Ben", "Ana");
      expect(refusal()).toHaveTextContent(PAIR_EXISTS_MESSAGE);
      expect(screen.getByRole("combobox", { name: "First Student" })).toHaveAttribute("aria-invalid", "true");
      expect(savedPairs(storage)).toHaveLength(1);
    });

    it("refuses a pair already of the other kind", async () => {
      start(4, { pairs: [pair("keep apart", "Ana", "Ben", 1)] });
      await openPairs();
      await addPair("Good pair", "Ana", "Ben");
      expect(refusal()).toHaveTextContent(pairOfOtherKindMessage("Ana", "Ben", "keep apart"));
    });

    it("refuses a Keep apart pair inside one Good pair chain", async () => {
      start(5, { pairs: [pair("good pair", "Ana", "Dee", 1), pair("good pair", "Dee", "Eli", 2)] });
      await openPairs();
      await addPair("Keep apart", "Ana", "Eli");
      expect(refusal()).toHaveTextContent(
        linkedByGoodPairsMessage("Ana", "Eli", [
          ["Ana", "Dee"],
          ["Dee", "Eli"],
        ]),
      );
      expect(rows("Keep apart")).toEqual(["None yet"]);
    });

    it("refuses a Good pair that would join a Keep apart pair into one chain", async () => {
      start(4, { pairs: [pair("good pair", "Ana", "Cal", 1), pair("keep apart", "Ana", "Ben", 2)] });
      await openPairs();
      await addPair("Good pair", "Cal", "Ben");
      expect(refusal()).toHaveTextContent(joinsKeepApartMessage("Ana", "Ben"));
    });

    it("clears the refusal when a Student is picked again", async () => {
      start(4);
      await openPairs();
      await addPair("Good pair", "Ana", "Ana");
      expect(refusal()).toBeInTheDocument();
      await pick("Ana", "Ben");
      expect(within(drawer()).queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  it("marks Groups out of date when Pairs change", async () => {
    start(4);
    await fireEvent.click(shuffleButton());
    expect(screen.queryByText(`⚠ ${OUT_OF_DATE_MESSAGE}`)).not.toBeInTheDocument();
    await openPairs();
    await addPair("Good pair", "Ana", "Ben");
    expect(screen.getByText(`⚠ ${OUT_OF_DATE_MESSAGE}`)).toBeInTheDocument();
  });

  it("removing a Student removes their Pairs, and Undo restores them", async () => {
    start(4, { pairs: [pair("good pair", "Ana", "Ben", 1), pair("keep apart", "Ana", "Cal", 2)] });
    expect(pairsPill()).toHaveTextContent("2 Pairs");
    await fireEvent.click(screen.getByRole("button", { name: /Present/ }));
    await fireEvent.click(screen.getByRole("button", { name: "Edit list" }));
    await fireEvent.click(screen.getByRole("button", { name: "Remove Ana" }));
    expect(within(screen.getByRole("dialog")).getByRole("status")).toHaveTextContent("Removed Ana and 2 pairs.");
    expect(pairsPill()).toHaveTextContent("0 Pairs");
    await fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(pairsPill()).toHaveTextContent("2 Pairs");
    await fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await openPairs();
    expect(rows("Good pairs")).toEqual(["Ana & Ben"]);
    expect(rows("Keep apart")).toEqual(["Ana & Cal"]);
  });
});

describe("Shuffle with Pairs", () => {
  it("keeps every Good pair together and every Keep apart pair apart", async () => {
    start(8, {
      target: 2,
      pairs: [pair("good pair", "Ana", "Hal", 1), pair("keep apart", "Ben", "Cal", 2), pair("keep apart", "Dee", "Eli", 3)],
    });
    for (let i = 0; i < 5; i++) {
      await fireEvent.click(shuffleButton());
      const groups = groupNames();
      expect(groups).toHaveLength(4);
      const groupOf = (name: string) => groups.findIndex((g) => g.includes(name));
      expect(groupOf("Ana")).toBe(groupOf("Hal"));
      expect(groupOf("Ben")).not.toBe(groupOf("Cal"));
      expect(groupOf("Dee")).not.toBe(groupOf("Eli"));
    }
  });

  it("warns on the board while a Present chain is bigger than the Target size, and Shuffle stays enabled", async () => {
    start(6, { target: 2, pairs: [pair("good pair", "Ana", "Ben", 1), pair("good pair", "Ben", "Cal", 2)] });
    const warning = oversizeChainMessage(["Ana", "Ben", "Cal"], 2);
    expect(screen.getByText(warning)).toBeInTheDocument();
    expect(shuffleButton()).toBeEnabled();

    // Live with attendance: an Absent member doesn't break the chain, but makes it fit.
    await fireEvent.click(screen.getByRole("button", { name: /Present/ }));
    await fireEvent.click(screen.getByRole("button", { name: "Ben" }));
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Ben" }));
    expect(screen.getByText(warning)).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Done" }));

    // Live with the Target size.
    await fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Fewer" }));
    expect(screen.getByText(warning)).toBeInTheDocument();

    // Live with Pairs.
    await openPairs();
    await fireEvent.click(screen.getByRole("button", { name: "Delete Ben & Cal" }));
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
  });

  it("shows the Absent-chain case: Present members still share a Group", async () => {
    start(6, { target: 2, absent: ["Ben"], pairs: [pair("good pair", "Ana", "Ben", 1), pair("good pair", "Ben", "Cal", 2)] });
    await fireEvent.click(shuffleButton());
    const groups = groupNames();
    expect(groups.find((g) => g.includes("Ana"))).toContain("Cal");
  });

  it("shows a Conflict in a red notice and leaves the Groups on screen unchanged", async () => {
    start(6, { target: 2 });
    await fireEvent.click(shuffleButton());
    const before = groupNames();
    expect(before).toHaveLength(3);

    await openPairs();
    await addPair("Good pair", "Ana", "Ben");
    await addPair("Good pair", "Ben", "Cal");
    await fireEvent.click(within(drawer()).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await fireEvent.click(shuffleButton());
    expect(screen.getByRole("alert")).toHaveTextContent(chainTooBigMessage(["Ana", "Ben", "Cal"], 2));
    expect(groupNames()).toEqual(before);
    // Still out of date: the Groups don't follow the new Pairs.
    expect(screen.getByText(`⚠ ${OUT_OF_DATE_MESSAGE}`)).toBeInTheDocument();

    // A Roster change clears the notice.
    await openPairs();
    await fireEvent.click(screen.getByRole("button", { name: "Delete Ben & Cal" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the search's Conflict sentence, cleared by the next successful Shuffle", async () => {
    // Two Groups of 3, but Ana is kept apart from everyone except Fay: no grouping works.
    start(6, {
      target: 3,
      pairs: ["Ben", "Cal", "Dee", "Eli"].map((name, i) => pair("keep apart", "Ana", name, i + 1)),
    });
    await fireEvent.click(shuffleButton());
    expect(screen.getByRole("alert")).toHaveTextContent(noGroupingMessage([3, 3]));
    expect(groupNames()).toEqual([]);
    expect(screen.queryByText(EMPTY_BOARD_MESSAGE)).not.toBeInTheDocument();

    // Three Groups of 2 (a board change, not a Roster change) let Ana sit with Fay.
    await fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    await fireEvent.input(screen.getByLabelText("Group sizes, comma separated"), { target: { value: "2, 2, 2" } });
    await fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent(noGroupingMessage([3, 3]));

    await fireEvent.click(shuffleButton());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    const groups = groupNames();
    expect(groups).toHaveLength(3);
    expect(groups.find((g) => g.includes("Ana"))).toEqual(expect.arrayContaining(["Ana", "Fay"]));
  });
});
