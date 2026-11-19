// #16: Pairs that every Shuffle obeys. Shuffle gets a seeded rng so every run is the same.
import {
  addPair,
  addStudent,
  chainTooBigMessage,
  createRoster,
  EMPTY_APP_STATE,
  EMPTY_BOARD_MESSAGE,
  joinsKeepApartMessage,
  linkedByGoodPairsMessage,
  noGroupingMessage,
  OUT_OF_DATE_MESSAGE,
  oversizeChainMessage,
  PAIR_EXISTS_MESSAGE,
  pairOfOtherKindMessage,
  PICK_TWO_STUDENTS_MESSAGE,
  saveAppState,
  seededRng,
  setTargetSize,
  updateRoster,
  type AppState,
  type PairType,
  type StorageLike,
} from "./lib";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const NAMES = ["Ana", "Ben", "Cal", "Dee", "Eli", "Fay", "Gus", "Hal"];
const id = (name: string) => `s${NAMES.indexOf(name) + 1}`;

/** One saved Roster "Period 2" with the given Students (ids s1…), all Present, and these Pairs. */
function savedRoster(
  names: readonly string[] = NAMES,
  pairs: readonly [PairType, string, string][] = [],
  target?: number,
): AppState {
  const created = createRoster(EMPTY_APP_STATE, "Period 2", () => "p2");
  if (!created.ok) throw new Error(created.message);
  return updateRoster(created.state, "p2", (roster) => {
    for (const name of names) {
      const r = addStudent(roster, name, () => id(name));
      if (!r.ok) throw new Error(r.message);
      roster = r.roster;
    }
    pairs.forEach(([type, a, b], i) => {
      const r = addPair(roster, type, id(a), id(b), () => `saved${i}`);
      if (!r.ok) throw new Error(r.message);
      roster = r.roster;
    });
    return target === undefined ? roster : setTargetSize(roster, target);
  });
}

let storage: MemoryStorage;

function renderApp(state: AppState = savedRoster(), seed = 1) {
  saveAppState(storage, state);
  let n = 0;
  return render(<App storage={storage} newId={() => `id${++n}`} rng={seededRng(seed)} />);
}

const click = (el: HTMLElement) => fireEvent.click(el);
const bar = () => within(screen.getByRole("banner"));
const barShuffle = () => bar().getByRole("button", { name: /^(Shuffle|Reshuffle)$/ });
const pairsPill = () => bar().getByRole("button", { name: /^\d+ Pairs?$/ });
const drawer = () => within(screen.getByRole("dialog", { name: "Pairs" }));
const openPairs = () => click(pairsPill());
const closePairs = () => click(drawer().getByRole("button", { name: "Done" }));
const pick = (label: "First Student" | "Second Student", name: string) =>
  fireEvent.change(drawer().getByRole("combobox", { name: label }), { target: { value: name ? id(name) : "" } });
/** Picks two Students in the open Pairs drawer and presses ＋ Good pair or ＋ Keep apart. */
function addInDrawer(type: PairType, a: string, b: string) {
  pick("First Student", a);
  pick("Second Student", b);
  click(drawer().getByRole("button", { name: type === "good pair" ? "＋ Good pair" : "＋ Keep apart" }));
}
const listed = (list: "Good pairs" | "Keep apart") =>
  within(drawer().getByRole("list", { name: list }))
    .getAllByRole("listitem")
    .map((li) => li.textContent);
/** Each Group card's names. */
const cardNames = () =>
  screen
    .queryAllByRole("region")
    .map((c) => within(c).getAllByRole("listitem").map((li) => li.querySelector("span.truncate")!.textContent!));
const cardOf = (name: string) => cardNames().findIndex((names) => names.includes(name));

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("navigator", { ...navigator, storage: { persist: () => Promise.resolve(true) } });
});

describe("Pairs drawer", () => {
  it('"0 Pairs ›" opens the drawer; pick two Students, add Pairs of each kind, list them by kind and delete', () => {
    renderApp();
    expect(pairsPill()).toHaveTextContent("0 Pairs");
    openPairs();
    expect(listed("Good pairs")).toEqual(["None yet"]);
    expect(listed("Keep apart")).toEqual(["None yet"]);

    addInDrawer("good pair", "Ana", "Ben");
    expect(listed("Good pairs")).toEqual(["Ana & Ben"]);
    expect(pairsPill()).toHaveTextContent("1 Pair");
    // The pickers reset for the next Pair.
    expect(drawer().getByRole("combobox", { name: "First Student" })).toHaveValue("");
    expect(drawer().getByRole("combobox", { name: "Second Student" })).toHaveValue("");

    addInDrawer("keep apart", "Cal", "Dee");
    addInDrawer("good pair", "Eli", "Fay");
    // Oldest first within each kind.
    expect(listed("Good pairs")).toEqual(["Ana & Ben", "Eli & Fay"]);
    expect(listed("Keep apart")).toEqual(["Cal & Dee"]);
    expect(pairsPill()).toHaveTextContent("3 Pairs");

    click(drawer().getByRole("button", { name: "Delete Ana & Ben" }));
    expect(listed("Good pairs")).toEqual(["Eli & Fay"]);
    expect(pairsPill()).toHaveTextContent("2 Pairs");

    closePairs();
    expect(screen.queryByRole("dialog", { name: "Pairs" })).not.toBeInTheDocument();
    // Saved with a creation order.
    const saved = JSON.parse(storage.getItem("grouper:roster:p2")!);
    expect(saved.pairs.map((p: { type: string; created: number }) => [p.type, p.created])).toEqual([
      ["keep apart", 1],
      ["good pair", 2],
    ]);
  });

  it("refuses with the spec's sentences as a red line, and the line goes when a pick changes", () => {
    renderApp();
    openPairs();
    const refusal = () => drawer().getByRole("alert");

    click(drawer().getByRole("button", { name: "＋ Good pair" }));
    expect(refusal()).toHaveTextContent(PICK_TWO_STUDENTS_MESSAGE);
    addInDrawer("good pair", "Ana", "Ana");
    expect(refusal()).toHaveTextContent(PICK_TWO_STUDENTS_MESSAGE);
    pick("Second Student", "Ben");
    expect(drawer().queryByRole("alert")).not.toBeInTheDocument();

    addInDrawer("good pair", "Ana", "Dee");
    addInDrawer("good pair", "Dee", "Eli");
    // A repeated pair, either order.
    addInDrawer("good pair", "Eli", "Dee");
    expect(refusal()).toHaveTextContent(PAIR_EXISTS_MESSAGE);
    // Already the other kind.
    addInDrawer("keep apart", "Ana", "Dee");
    expect(refusal()).toHaveTextContent(pairOfOtherKindMessage("Ana", "Dee", "good pair"));
    // A Keep apart pair inside one Good pair chain.
    addInDrawer("keep apart", "Ana", "Eli");
    expect(refusal()).toHaveTextContent(
      linkedByGoodPairsMessage("Ana", "Eli", [
        ["Ana", "Dee"],
        ["Dee", "Eli"],
      ]),
    );
    // A Good pair that would join a Keep apart pair's two chains.
    addInDrawer("keep apart", "Ben", "Cal");
    expect(drawer().queryByRole("alert")).not.toBeInTheDocument();
    addInDrawer("good pair", "Ben", "Fay");
    addInDrawer("good pair", "Fay", "Cal");
    expect(refusal()).toHaveTextContent(joinsKeepApartMessage("Ben", "Cal"));
    // Refused Pairs were not added, and the picks stay for a fix.
    expect(listed("Good pairs")).toEqual(["Ana & Dee", "Dee & Eli", "Ben & Fay"]);
    expect(listed("Keep apart")).toEqual(["Ben & Cal"]);
    expect(drawer().getByRole("combobox", { name: "First Student" })).toHaveValue(id("Fay"));
  });

  it("removing a Student removes their Pairs, and Undo brings them back", () => {
    renderApp(
      savedRoster(NAMES, [
        ["good pair", "Ana", "Ben"],
        ["keep apart", "Ben", "Cal"],
        ["good pair", "Dee", "Eli"],
      ]),
    );
    expect(pairsPill()).toHaveTextContent("3 Pairs");
    click(bar().getByRole("button", { name: /Present$/ }));
    const students = within(screen.getByRole("dialog", { name: "Students" }));
    click(students.getByRole("button", { name: "Edit list" }));
    click(students.getByRole("button", { name: "Remove Ben" }));
    expect(students.getByRole("status")).toHaveTextContent("Removed Ben and 2 pairs.");
    expect(pairsPill()).toHaveTextContent("1 Pair");
    click(students.getByRole("button", { name: "Undo" }));
    click(students.getByRole("button", { name: "Done" }));
    expect(pairsPill()).toHaveTextContent("3 Pairs");
    openPairs();
    expect(listed("Good pairs")).toEqual(["Ana & Ben", "Dee & Eli"]);
    expect(listed("Keep apart")).toEqual(["Ben & Cal"]);
  });
});

describe("Shuffle with Pairs", () => {
  it("every Shuffle keeps every Pair; a chain holds through an Absent Student", () => {
    renderApp(
      savedRoster(
        NAMES,
        [
          ["good pair", "Ana", "Dee"],
          ["good pair", "Dee", "Eli"],
          ["keep apart", "Ben", "Cal"],
          ["keep apart", "Ana", "Fay"],
        ],
        2,
      ),
    );
    // Dee is Absent (7 Present at 2: groups of 2, 2 and 3): Ana and Eli still share a Group.
    click(bar().getByRole("button", { name: /Present$/ }));
    click(within(screen.getByRole("dialog", { name: "Students" })).getByRole("button", { name: "Dee" }));
    click(within(screen.getByRole("dialog", { name: "Students" })).getByRole("button", { name: "Done" }));
    for (let i = 0; i < 12; i++) {
      click(barShuffle());
      expect(cardOf("Dee")).toBe(-1);
      expect(cardOf("Ana")).toBe(cardOf("Eli"));
      expect(cardOf("Ben")).not.toBe(cardOf("Cal"));
      expect(cardOf("Ana")).not.toBe(cardOf("Fay"));
    }
  });

  it("Pair edits mark the Groups out of date", () => {
    renderApp();
    click(barShuffle());
    expect(screen.queryByText(new RegExp(OUT_OF_DATE_MESSAGE.slice(0, 20)))).not.toBeInTheDocument();
    openPairs();
    addInDrawer("keep apart", "Ana", "Ben");
    closePairs();
    expect(screen.getByText(new RegExp(OUT_OF_DATE_MESSAGE.slice(0, 20)))).toBeInTheDocument();
  });

  it("warns as soon as a Present chain is bigger than the Target size; Shuffle stays enabled", () => {
    renderApp();
    openPairs();
    addInDrawer("good pair", "Ana", "Ben");
    addInDrawer("good pair", "Ben", "Cal");
    addInDrawer("good pair", "Cal", "Dee");
    expect(screen.queryByText(/are joined by Good pairs/)).not.toBeInTheDocument();
    addInDrawer("good pair", "Dee", "Eli");
    closePairs();
    const warning = oversizeChainMessage(["Ana", "Ben", "Cal", "Dee", "Eli"], 4);
    expect(screen.getByText(warning)).toBeInTheDocument();
    expect(barShuffle()).toBeEnabled();

    // A bigger Target size clears it; an Absent member narrows the chain.
    click(within(screen.getByRole("group", { name: "Number of students in group" })).getByRole("button", { name: "More" }));
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
    click(within(screen.getByRole("group", { name: "Number of students in group" })).getByRole("button", { name: "Fewer" }));
    expect(screen.getByText(warning)).toBeInTheDocument();
    click(bar().getByRole("button", { name: /Present$/ }));
    click(within(screen.getByRole("dialog", { name: "Students" })).getByRole("button", { name: "Eli" }));
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
  });

  it("a Conflict shows its sentence in a red notice and leaves the Groups unchanged, until a fix and a Reshuffle", () => {
    renderApp();
    click(barShuffle());
    const before = cardNames();
    expect(before).toHaveLength(2);
    // The card's accessible name keeps the space before the "·".
    expect(screen.getByRole("region", { name: "Group 1 · 4 students" })).toBeInTheDocument();

    openPairs();
    for (const [a, b] of [
      ["Ana", "Ben"],
      ["Ben", "Cal"],
      ["Cal", "Dee"],
      ["Dee", "Eli"],
    ]) {
      addInDrawer("good pair", a!, b!);
    }
    closePairs();
    // Pair edits clear nothing yet; Reshuffle hits the chain-too-big quick check.
    click(barShuffle());
    const notice = screen.getByRole("alert");
    expect(notice).toHaveTextContent(chainTooBigMessage(["Ana", "Ben", "Cal", "Dee", "Eli"], 4));
    expect(cardNames()).toEqual(before);
    // Reshuffling again doesn't help.
    click(barShuffle());
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(cardNames()).toEqual(before);

    // Any Roster change clears the notice.
    openPairs();
    click(drawer().getByRole("button", { name: "Delete Dee & Eli" }));
    closePairs();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    click(barShuffle());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(cardNames()).not.toEqual(before);
    expect(new Set([cardOf("Ana"), cardOf("Ben"), cardOf("Cal"), cardOf("Dee")]).size).toBe(1);
  });

  it("a Conflict the search proves reads \"No way to make …\"; the next successful Shuffle clears it", () => {
    // 4 Present at 2: Ana must be kept apart from everyone.
    renderApp(
      savedRoster(
        ["Ana", "Ben", "Cal", "Dee"],
        [
          ["keep apart", "Ana", "Ben"],
          ["keep apart", "Ana", "Cal"],
          ["keep apart", "Ana", "Dee"],
        ],
        2,
      ),
    );
    click(barShuffle());
    expect(screen.getByRole("alert")).toHaveTextContent(noGroupingMessage([2, 2]));
    // No Groups, and the empty-board hint gives way to the notice.
    expect(cardNames()).toEqual([]);
    expect(screen.queryByText(EMPTY_BOARD_MESSAGE)).not.toBeInTheDocument();
    expect(barShuffle()).toHaveTextContent(/^Shuffle$/);

    openPairs();
    click(drawer().getByRole("button", { name: "Delete Ana & Dee" }));
    closePairs();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    click(barShuffle());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(cardOf("Ana")).toBe(cardOf("Dee"));
  });
});
