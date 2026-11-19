// #15: Shuffle Present Students into Groups. Shuffle gets a seeded rng so every run is the same.
import {
  addStudent,
  BOARD_GAP,
  boardLayout,
  createRoster,
  EMPTY_APP_STATE,
  EMPTY_BOARD_MESSAGE,
  NEED_TWO_PRESENT_MESSAGE,
  OUT_OF_DATE_MESSAGE,
  PHONE_NAME_FONT_SIZE,
  saveAppState,
  seededRng,
  setPresent,
  updateRoster,
  type AppState,
  type StorageLike,
} from "./lib";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const NAMES = "Ana Ben Cal Dee Eli Fay Gus Hal Ivy Jo Kim Lu Max Ned Oli Pam Quin Ray Sol Tess Uma Val Wes Xan Yuri".split(" ");

/** Saved Rosters "Period 2" (25 Students, ids s1…s25) and "Period 5" (Zed, Amy), Period 2 open. */
function savedRosters(absent: string[] = []): AppState {
  let state = EMPTY_APP_STATE;
  for (const [id, name, students] of [
    ["p5", "Period 5", ["Zed", "Amy"]],
    ["p2", "Period 2", NAMES],
  ] as const) {
    const r = createRoster(state, name, () => id);
    if (!r.ok) throw new Error(r.message);
    state = r.state;
    for (const s of students) {
      state = updateRoster(state, id, (roster) => {
        const added = addStudent(roster, s, () => `s${NAMES.indexOf(s) + 1 || s}`);
        if (!added.ok) throw new Error(added.message);
        return setPresent(added.roster, added.student.id, !absent.includes(s));
      });
    }
  }
  return state;
}

let storage: MemoryStorage;

function renderApp(state: AppState = savedRosters(), seed = 1) {
  saveAppState(storage, state);
  let n = 0;
  return render(<App storage={storage} newId={() => `id${++n}`} rng={seededRng(seed)} />);
}

const click = (el: HTMLElement) => fireEvent.click(el);
const barShuffle = () => within(screen.getByRole("banner")).getByRole("button", { name: /^(Shuffle|Reshuffle)$/ });
const cards = () => screen.queryAllByRole("region");
/** Each card's names (screen-reader suffixes like " (Absent)" stripped). */
const cardNames = () =>
  cards().map((c) => within(c).getAllByRole("listitem").map((li) => li.querySelector("span.truncate")!.textContent));
const stepperValue = () => screen.getByRole("status", { name: "Number of students in group" });
const sizeGroup = () => screen.getByRole("group", { name: "Number of students in group" });
const openStudents = () => click(screen.getByRole("button", { name: /Present$/ }));

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("navigator", { ...navigator, storage: { persist: () => Promise.resolve(true) } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.innerWidth = 1024;
});

describe("Number of students in group", () => {
  it("defaults to 4, shows the Split in words, and steps with − and + (not below 2)", () => {
    renderApp();
    expect(stepperValue()).toHaveTextContent("4");
    expect(screen.getByText("5 groups of 4, 1 group of 5")).toBeInTheDocument();

    click(within(sizeGroup()).getByRole("button", { name: "More" }));
    expect(stepperValue()).toHaveTextContent("5");
    expect(screen.getByText("5 groups of 5")).toBeInTheDocument();

    const fewer = within(sizeGroup()).getByRole("button", { name: "Fewer" });
    click(fewer);
    click(fewer);
    click(fewer);
    expect(stepperValue()).toHaveTextContent("2");
    expect(screen.getByText("11 groups of 2, 1 group of 3")).toBeInTheDocument();
    expect(fewer).toBeDisabled();
  });

  it("is saved per Roster", () => {
    const { unmount } = renderApp();
    click(within(sizeGroup()).getByRole("button", { name: "More" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Roster" }), { target: { value: "p5" } });
    expect(stepperValue()).toHaveTextContent("4");
    expect(screen.getByText("1 group of 2")).toBeInTheDocument();
    unmount();

    let n = 0;
    render(<App storage={storage} newId={() => `x${++n}`} rng={seededRng(1)} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Roster" }), { target: { value: "p2" } });
    expect(stepperValue()).toHaveTextContent("5");
  });
});

describe("Split Edit", () => {
  it("prefills the sizes, refuses bad ones with the spec's messages, and Shuffles with the saved Split", () => {
    renderApp();
    click(screen.getByRole("button", { name: "Edit" }));
    const input = screen.getByRole("textbox", { name: "Group sizes, comma separated" });
    expect(input).toHaveValue("4, 4, 4, 4, 4, 5");

    const save = (text: string) => {
      fireEvent.change(input, { target: { value: text } });
      click(screen.getByRole("button", { name: "Save" }));
    };
    save("4.5, 20.5");
    expect(screen.getByRole("alert")).toHaveTextContent("Use whole numbers, e.g. 4, 4, 5.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Use whole numbers, e.g. 4, 4, 5.");
    save("4, 20, 1");
    expect(screen.getByRole("alert")).toHaveTextContent("A group of 1 isn't allowed.");
    save("5, 5");
    expect(screen.getByRole("alert")).toHaveTextContent("Those sizes add up to 10, but 25 Students are Present.");

    save("8, 8, 9");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Group sizes, comma separated" })).not.toBeInTheDocument();
    expect(screen.getByText(/2 groups of 8, 1 group of 9 \(edited\)/)).toBeInTheDocument();

    click(barShuffle());
    expect(cards().map((c) => within(c).getByRole("heading").textContent)).toEqual([
      "Group 1 · 8 students",
      "Group 2 · 8 students",
      "Group 3 · 9 students",
    ]);
    // Changing the Split doesn't put the Groups out of date.
    click(screen.getByRole("button", { name: "Automatic" }));
    expect(screen.getByText("5 groups of 4, 1 group of 5")).toBeInTheDocument();
    expect(screen.queryByText(`⚠ ${OUT_OF_DATE_MESSAGE}`)).not.toBeInTheDocument();
  });

  it("Cancel closes Edit and drops the refusal", () => {
    renderApp();
    click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Group sizes, comma separated" }), { target: { value: "1" } });
    click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("goes back to the derived Split when the stepper changes", () => {
    renderApp();
    click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Group sizes, comma separated" }), { target: { value: "12 13" } });
    click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText(/1 group of 12, 1 group of 13 \(edited\)/)).toBeInTheDocument();
    click(within(sizeGroup()).getByRole("button", { name: "More" }));
    expect(screen.getByText("5 groups of 5")).toBeInTheDocument();
  });
});

describe("Shuffle", () => {
  it("is disabled with fewer than 2 Present", () => {
    renderApp(savedRosters(NAMES.slice(1)));
    expect(barShuffle()).toBeDisabled();
    expect(barShuffle()).toHaveAttribute("title", NEED_TWO_PRESENT_MESSAGE);
    expect(screen.getByText(NEED_TWO_PRESENT_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("puts every Present Student in exactly one Group matching the Split; the button becomes Reshuffle", () => {
    renderApp(savedRosters(["Ana", "Ben"]));
    expect(screen.getByText(EMPTY_BOARD_MESSAGE)).toBeInTheDocument();
    expect(barShuffle()).toHaveTextContent("Shuffle");

    click(barShuffle());
    expect(screen.queryByText(EMPTY_BOARD_MESSAGE)).not.toBeInTheDocument();
    expect(barShuffle()).toHaveTextContent("Reshuffle");
    // 23 Present at 4: 5 Groups, the 3 Leftovers added round-robin → 4, 4, 5, 5, 5.
    expect(cards().map((c) => within(c).getByRole("heading").textContent)).toEqual([
      "Group 1 · 4 students",
      "Group 2 · 4 students",
      "Group 3 · 5 students",
      "Group 4 · 5 students",
      "Group 5 · 5 students",
    ]);
    const placed = cardNames().flat();
    expect(placed).toHaveLength(23);
    expect(new Set(placed)).toEqual(new Set(NAMES.filter((n) => n !== "Ana" && n !== "Ben")));
  });

  it("is deterministic for a seed, and Reshuffle makes new Groups", () => {
    const first = renderApp(undefined, 7);
    click(barShuffle());
    const groups = cardNames();
    first.unmount();

    renderApp(undefined, 7);
    click(barShuffle());
    expect(cardNames()).toEqual(groups);
    click(barShuffle());
    expect(cardNames()).not.toEqual(groups);
    expect(cardNames().flat()).toHaveLength(25);
  });

  it("colours each card header from the hue cycle", () => {
    renderApp();
    click(barShuffle());
    expect(cards().map((c) => c.style.getPropertyValue("--hue"))).toEqual(["212", "152", "28", "280", "350", "190"]);
  });
});

describe("after a Shuffle", () => {
  it("attendance changes fade the Student and show the out-of-date notice; its Reshuffle clears it", () => {
    renderApp();
    click(barShuffle());
    openStudents();
    click(within(screen.getByRole("list", { name: "Attendance" })).getByRole("button", { name: "Ana" }));
    click(screen.getByRole("button", { name: "Done" }));

    const notice = screen.getByText(`⚠ ${OUT_OF_DATE_MESSAGE}`).parentElement!;
    const ana = screen.getByText("Ana").closest("li")!;
    expect(ana).toHaveClass("line-through");
    expect(ana).toHaveTextContent("Ana (Absent)");
    expect(cardNames().flat()).toHaveLength(25);

    click(within(notice).getByRole("button", { name: "Reshuffle" }));
    expect(screen.queryByText(`⚠ ${OUT_OF_DATE_MESSAGE}`)).not.toBeInTheDocument();
    expect(cardNames().flat()).toHaveLength(24);
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();
  });

  it("a removed Student stays, faded, until the Reshuffle", () => {
    renderApp();
    click(barShuffle());
    openStudents();
    click(screen.getByRole("button", { name: "Edit list" }));
    click(screen.getByRole("button", { name: "Remove Ben" }));
    click(screen.getByRole("button", { name: "Done" }));

    expect(screen.getByText(`⚠ ${OUT_OF_DATE_MESSAGE}`)).toBeInTheDocument();
    const ben = screen.getByText("Ben").closest("li")!;
    expect(ben).toHaveClass("line-through");
    expect(ben).toHaveTextContent("Ben (removed)");
  });

  it("changing the Target size keeps the Groups up to date", () => {
    renderApp();
    click(barShuffle());
    const groups = cardNames();
    click(within(sizeGroup()).getByRole("button", { name: "More" }));
    expect(screen.queryByText(`⚠ ${OUT_OF_DATE_MESSAGE}`)).not.toBeInTheDocument();
    expect(cardNames()).toEqual(groups);
  });

  it("switching Roster clears the Groups, and Groups aren't saved", () => {
    const { unmount } = renderApp();
    click(barShuffle());
    expect(cards()).toHaveLength(6);

    fireEvent.change(screen.getByRole("combobox", { name: "Roster" }), { target: { value: "p5" } });
    expect(cards()).toHaveLength(0);
    expect(barShuffle()).toHaveTextContent("Shuffle");
    fireEvent.change(screen.getByRole("combobox", { name: "Roster" }), { target: { value: "p2" } });
    expect(cards()).toHaveLength(0);

    click(barShuffle());
    unmount();
    let n = 0;
    render(<App storage={storage} newId={() => `x${++n}`} rng={seededRng(1)} />);
    expect(screen.getByText(EMPTY_BOARD_MESSAGE)).toBeInTheDocument();
  });
});

describe("board layout", () => {
  it("sizes the cards from the measured board and recomputes on resize", () => {
    let size = { width: 1200, height: 700 };
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => size.width);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(() => size.height);
    // dnd-kit (#18) also observes, and reads the entries it is called with.
    const observers: ((entries: unknown[]) => void)[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: (entries: unknown[]) => void) {
          observers.push(cb);
        }
        observe() {}
        disconnect() {}
      },
    );

    renderApp();
    click(barShuffle());
    const expected = boardLayout(1200, 700, 6, BOARD_GAP);
    expect(expected.columns).toBe(3);
    for (const card of cards()) {
      expect(card.style.width).toBe(`${Math.floor(expected.cardWidth)}px`);
      expect(card.style.height).toBe(`${Math.floor(expected.cardHeight)}px`);
    }

    size = { width: 500, height: 1400 };
    act(() => observers.forEach((cb) => cb([])));
    const narrow = boardLayout(500, 1400, 6);
    expect(narrow.columns).not.toBe(expected.columns);
    expect(cards()[0]!.style.width).toBe(`${Math.floor(narrow.cardWidth)}px`);
  });

  it("on phones: one column, unsized cards, fixed name size, and Reshuffle pinned to the bottom", () => {
    window.innerWidth = 400;
    renderApp();
    click(barShuffle());
    expect(barShuffle()).toHaveClass("fixed", "bottom-3");
    for (const card of cards()) {
      expect(card.style.width).toBe("");
      expect(card).toHaveClass("w-full");
      expect(within(card).getByRole("list").style.fontSize).toBe(`${PHONE_NAME_FONT_SIZE}px`);
    }

    window.innerWidth = 1024;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(barShuffle()).not.toHaveClass("fixed");
  });
});
