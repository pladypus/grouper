import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import {
  EMPTY_BOARD_MESSAGE,
  loadAppState,
  NEED_TWO_PRESENT_MESSAGE,
  nameFontSize,
  OUT_OF_DATE_MESSAGE,
  saveAppState,
  seededRng,
  SPLIT_GROUP_OF_ONE_MESSAGE,
  SPLIT_WHOLE_NUMBERS_MESSAGE,
  splitTotalMessage,
  type AppState,
  type StorageLike,
} from "@grouper/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App.svelte";

// #15: Shuffle Present Students into Groups. The rng is seeded so every run makes the same Groups.

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

function seeded(state: AppState): MemoryStorage {
  const storage = new MemoryStorage();
  saveAppState(storage, state);
  return storage;
}

function start<S extends StorageLike>(storage: S): S {
  render(App, { storage, newId: idGenerator(), rng: seededRng(15), storageManager: null });
  return storage;
}

const NAMES = ["Ana", "Ben", "Cal", "Dee", "Eli", "Fay", "Gus", "Hal", "Ivy", "Jo", "Kai", "Lu"];
const student = (name: string, present = true) => ({ id: name.toLowerCase(), name, present });
const roster = (id: string, name: string, count: number, absent: string[] = []) => ({
  id,
  name,
  students: NAMES.slice(0, count).map((n) => student(n, !absent.includes(n))),
  pairs: [],
  target: 4,
});

const shuffleButton = () => screen.getByRole("button", { name: /^(Re)?[Ss]huffle$/ });
const groupCards = () => screen.queryAllByRole("region");
/** A card's names (screen-reader suffixes like " (Absent)" stripped). */
const namesIn = (card: HTMLElement) =>
  within(card).getAllByRole("listitem").map((li) => li.querySelector("span.truncate")!.textContent!);
const headings = () => groupCards().map((c) => within(c).getByRole("heading").textContent);

async function stepper(name: "Fewer" | "More") {
  await fireEvent.click(screen.getByRole("button", { name }));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("stepper and Split", () => {
  it("shows the Split in words, steps the Target size down to 2 and saves it per Roster", async () => {
    const storage = start(seeded({ rosters: [roster("p2", "Period 2", 10)], currentId: "p2" }));
    expect(screen.getByRole("group", { name: "Number of students in group" })).toHaveTextContent("4");
    expect(screen.getByText(/2 groups of 5/)).toBeInTheDocument();

    await stepper("Fewer");
    expect(screen.getByText(/2 groups of 3, 1 group of 4/)).toBeInTheDocument();
    await stepper("Fewer");
    expect(screen.getByText(/5 groups of 2/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fewer" })).toBeDisabled();

    await stepper("More");
    await stepper("More");
    await stepper("More");
    expect(screen.getByText(/2 groups of 5/)).toBeInTheDocument();
    expect(loadAppState(storage).state.rosters[0]!.target).toBe(5);
  });

  it("edits the Split, refusing bad sizes with the spec's messages, and Shuffles with it", async () => {
    start(seeded({ rosters: [roster("p2", "Period 2", 10)], currentId: "p2" }));
    await fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const input = screen.getByLabelText("Group sizes, comma separated");
    expect(input).toHaveValue("5, 5");

    const trySave = async (text: string) => {
      await fireEvent.input(input, { target: { value: text } });
      await fireEvent.click(screen.getByRole("button", { name: "Save" }));
    };
    await trySave("4, 4, 2.5");
    expect(screen.getByRole("alert")).toHaveTextContent(SPLIT_WHOLE_NUMBERS_MESSAGE);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(SPLIT_WHOLE_NUMBERS_MESSAGE);
    await trySave("9, 1");
    expect(screen.getByRole("alert")).toHaveTextContent(SPLIT_GROUP_OF_ONE_MESSAGE);
    await trySave("4, 4");
    expect(screen.getByRole("alert")).toHaveTextContent(splitTotalMessage(8, 10));
    expect(screen.getByRole("alert")).toHaveTextContent("Those sizes add up to 8, but 10 Students are Present.");

    await trySave("3, 3, 4");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Group sizes, comma separated")).not.toBeInTheDocument();
    expect(screen.getByText(/2 groups of 3, 1 group of 4 \(edited\)/)).toBeInTheDocument();

    await fireEvent.click(shuffleButton());
    expect(headings().map((h) => h!.replace(/^Group \d+ · /, "")).sort()).toEqual([
      "3 students",
      "3 students",
      "4 students",
    ]);
    // "Automatic" goes back to the derived Split, and the Groups stay up to date.
    await fireEvent.click(screen.getByRole("button", { name: "Automatic" }));
    expect(screen.getByText("2 groups of 5")).toBeInTheDocument();
    expect(screen.queryByText(`⚠ ${OUT_OF_DATE_MESSAGE}`)).not.toBeInTheDocument();

    // So does changing the Target size.
    await fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    await fireEvent.input(screen.getByLabelText("Group sizes, comma separated"), { target: { value: "4 6" } });
    await fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText(/1 group of 4, 1 group of 6 \(edited\)/)).toBeInTheDocument();
    await stepper("More");
    expect(screen.getByText("2 groups of 5")).toBeInTheDocument();
  });

  it("Cancel closes the Edit box without changing the Split", async () => {
    start(seeded({ rosters: [roster("p2", "Period 2", 10)], currentId: "p2" }));
    await fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    await fireEvent.input(screen.getByLabelText("Group sizes, comma separated"), { target: { value: "x" } });
    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText(/2 groups of 5/)).toBeInTheDocument();
  });
});

describe("Shuffle", () => {
  it("is disabled with fewer than 2 Present, then makes Groups of every Present Student", async () => {
    start(seeded({ rosters: [roster("p2", "Period 2", 9, ["Ben", "Cal", "Dee", "Eli", "Fay", "Gus", "Hal", "Ivy"])], currentId: "p2" }));
    expect(shuffleButton()).toHaveTextContent("Shuffle");
    expect(shuffleButton()).toBeDisabled();
    expect(shuffleButton()).toHaveAttribute("title", NEED_TWO_PRESENT_MESSAGE);
    expect(screen.getByText(NEED_TWO_PRESENT_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText(EMPTY_BOARD_MESSAGE)).toBeInTheDocument();

    // Take the roll: everyone but Ivy.
    await fireEvent.click(screen.getByRole("button", { name: "1/9 Present" }));
    for (const name of ["Ben", "Cal", "Dee", "Eli", "Fay", "Gus", "Hal"]) {
      await fireEvent.click(screen.getByRole("button", { name }));
    }
    await fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByText(/2 groups of 4/)).toBeInTheDocument();
    expect(shuffleButton()).toBeEnabled();

    await fireEvent.click(shuffleButton());
    expect(screen.queryByText(EMPTY_BOARD_MESSAGE)).not.toBeInTheDocument();
    const cards = groupCards();
    expect(headings()).toEqual(["Group 1 · 4 students", "Group 2 · 4 students"]);
    expect(within(cards[0]!).getByRole("heading")).toHaveTextContent("Group 1 · 4 students");
    expect(cards.flatMap(namesIn).sort()).toEqual(["Ana", "Ben", "Cal", "Dee", "Eli", "Fay", "Gus", "Hal"]);
    // Header hues cycle by position.
    expect(cards[0]!.style.getPropertyValue("--hue")).toBe("212");
    expect(cards[1]!.style.getPropertyValue("--hue")).toBe("152");

    expect(shuffleButton()).toHaveTextContent("Reshuffle");
    const before = cards.map(namesIn);
    await fireEvent.click(shuffleButton());
    const after = groupCards().map(namesIn);
    expect(after.flat().sort()).toEqual(before.flat().sort());
    expect(after).not.toEqual(before);
  });

  it("puts fewer Present than the Target size into one Group", async () => {
    start(seeded({ rosters: [roster("p2", "Period 2", 3)], currentId: "p2" }));
    expect(screen.getByText(/1 group of 3/)).toBeInTheDocument();
    await fireEvent.click(shuffleButton());
    expect(headings()).toEqual(["Group 1 · 3 students"]);
    expect(groupCards()[0]).toHaveAccessibleName("Group 1 · 3 students");
  });
});

describe("lifecycle", () => {
  it("fades Absent and removed Students and shows the out-of-date notice until Reshuffle", async () => {
    start(seeded({ rosters: [roster("p2", "Period 2", 8)], currentId: "p2" }));
    await fireEvent.click(shuffleButton());
    const before = groupCards().map(namesIn);

    // Target size changes don't make the Groups out of date.
    await stepper("More");
    await stepper("Fewer");
    expect(screen.queryByText(`⚠ ${OUT_OF_DATE_MESSAGE}`)).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "8/8 Present" }));
    await fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Ana" }));
    await fireEvent.click(screen.getByRole("button", { name: "Edit list" }));
    await fireEvent.click(screen.getByRole("button", { name: "Remove Ben" }));
    await fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(groupCards().map(namesIn)).toEqual(before);
    const notice = screen.getByText(`⚠ ${OUT_OF_DATE_MESSAGE}`).parentElement!;
    const ana = screen.getByText("Ana").closest("li")!;
    expect(ana).toHaveClass("line-through");
    expect(ana).toHaveTextContent("Ana (Absent)");
    const ben = screen.getByText("Ben").closest("li")!;
    expect(ben).toHaveClass("line-through");
    expect(ben).toHaveTextContent("Ben (removed)");
    expect(screen.getByText("Cal").closest("li")).not.toHaveClass("line-through");

    await fireEvent.click(within(notice).getByRole("button", { name: "Reshuffle" }));
    expect(screen.queryByText(`⚠ ${OUT_OF_DATE_MESSAGE}`)).not.toBeInTheDocument();
    const names = groupCards().flatMap(namesIn);
    expect(names).not.toContain("Ana");
    expect(names).not.toContain("Ben");
    expect(names).toHaveLength(6);
  });

  it("clears the Groups when switching Roster, and never saves them", async () => {
    const storage = start(
      seeded({ rosters: [roster("p2", "Period 2", 8), roster("p5", "Period 5", 6)], currentId: "p2" }),
    );
    await fireEvent.click(shuffleButton());
    expect(groupCards()).toHaveLength(2);
    for (const value of storage.items.values()) expect(value).not.toMatch(/members|hue/);

    const picker = screen.getByRole("combobox", { name: "Roster" });
    await fireEvent.change(picker, { target: { value: "p5" } });
    expect(groupCards()).toHaveLength(0);
    expect(screen.getByText(EMPTY_BOARD_MESSAGE)).toBeInTheDocument();
    await fireEvent.change(picker, { target: { value: "p2" } });
    expect(groupCards()).toHaveLength(0);
    expect(shuffleButton()).toHaveTextContent("Shuffle");

    // A reload starts with no Groups.
    await fireEvent.click(shuffleButton());
    cleanup();
    start(storage);
    expect(groupCards()).toHaveLength(0);
    expect(screen.getByText(EMPTY_BOARD_MESSAGE)).toBeInTheDocument();
  });
});

describe("board layout", () => {
  function measureBoardAs(size: { width: number; height: number }) {
    vi.spyOn(Element.prototype, "clientWidth", "get").mockImplementation(() => size.width);
    vi.spyOn(Element.prototype, "clientHeight", "get").mockImplementation(() => size.height);
  }

  it("sizes the cards from the measured space and recomputes on resize", async () => {
    const size = { width: 1000, height: 600 };
    measureBoardAs(size);
    const observers: (() => void)[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private callback: () => void) {}
        observe() {
          observers.push(this.callback);
        }
        disconnect() {}
      },
    );
    start(seeded({ rosters: [{ ...roster("p2", "Period 2", 12), target: 2 }], currentId: "p2" }));
    await fireEvent.click(shuffleButton());

    // 6 Groups in 1000 × 600: 3 columns × 2 rows scores best, so cards are 324 × 293 px.
    let cards = groupCards();
    expect(cards).toHaveLength(6);
    for (const card of cards) {
      expect(card.style.width).toBe("324px");
      expect(card.style.height).toBe("293px");
    }
    const list = within(cards[0]!).getByRole("list");
    expect(parseFloat(list.style.fontSize)).toBeCloseTo(nameFontSize({ cardWidth: 324, cardHeight: 293, memberCount: 2 }));
    expect(cards[0]!.parentElement).toHaveClass("flex-wrap", "justify-center");

    // A tall, narrow window: 2 columns × 3 rows.
    size.width = 600;
    size.height = 1000;
    observers.forEach((callback) => callback());
    await Promise.resolve();
    cards = groupCards();
    expect(cards[0]!.style.width).toBe(`${Math.floor((600 - 14) / 2)}px`);
    expect(cards[0]!.style.height).toBe(`${Math.floor((1000 - 28) / 3)}px`);
  });

  it("uses two name columns only for a large Group on a wide card", async () => {
    measureBoardAs({ width: 1000, height: 600 });
    start(seeded({ rosters: [{ ...roster("p2", "Period 2", 12), target: 12 }], currentId: "p2" }));
    await fireEvent.click(shuffleButton());
    expect(within(groupCards()[0]!).getByRole("list")).toHaveClass("grid-cols-2");
  });

  it("on phones, stacks full-width cards with fixed-size names and pins Reshuffle to the bottom", async () => {
    measureBoardAs({ width: 380, height: 600 });
    vi.stubGlobal("innerWidth", 390);
    start(seeded({ rosters: [roster("p2", "Period 2", 8)], currentId: "p2" }));
    expect(shuffleButton()).toHaveClass("fixed", "bottom-3");
    await fireEvent.click(shuffleButton());
    for (const card of groupCards()) {
      expect(card).toHaveClass("w-full");
      expect(card.style.height).toBe("");
      expect(within(card).getByRole("list").style.fontSize).toBe("20px");
    }

    // Back to a wide window.
    vi.stubGlobal("innerWidth", 1280);
    await fireEvent(window, new Event("resize"));
    expect(shuffleButton()).not.toHaveClass("fixed");
    expect(groupCards()[0]!.style.height).not.toBe("");
  });
});
