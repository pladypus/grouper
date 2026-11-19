// #17: "Show the Rules involved" under a Conflict lists the clashing Pairs (newest first) and each
// one opens the Pairs drawer with that Pair highlighted, ready to edit or delete.
import {
  addPair,
  addStudent,
  apartCliqueMessage,
  chainTooBigMessage,
  createRoster,
  EMPTY_APP_STATE,
  noGroupingMessage,
  saveAppState,
  seededRng,
  setTargetSize,
  SHOW_RULES_INVOLVED,
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

const NAMES = ["Ana", "Ben", "Cal", "Dee", "Eli", "Fay"];
const id = (name: string) => `s${NAMES.indexOf(name) + 1}`;

/** One saved Roster "Period 2" with NAMES, all Present, these Pairs (in this order) and Target size. */
function savedRoster(pairs: readonly [PairType, string, string][], target: number): AppState {
  const created = createRoster(EMPTY_APP_STATE, "Period 2", () => "p2");
  if (!created.ok) throw new Error(created.message);
  return updateRoster(created.state, "p2", (roster) => {
    for (const name of NAMES) {
      const r = addStudent(roster, name, () => id(name));
      if (!r.ok) throw new Error(r.message);
      roster = r.roster;
    }
    pairs.forEach(([type, a, b], i) => {
      const r = addPair(roster, type, id(a), id(b), () => `saved${i}`);
      if (!r.ok) throw new Error(r.message);
      roster = r.roster;
    });
    return setTargetSize(roster, target);
  });
}

let storage: MemoryStorage;
let scrolled: HTMLElement[];

function renderApp(state: AppState) {
  saveAppState(storage, state);
  let n = 0;
  return render(<App storage={storage} newId={() => `id${++n}`} rng={seededRng(1)} />);
}

const click = (el: HTMLElement) => fireEvent.click(el);
const bar = () => within(screen.getByRole("banner"));
const shuffle = () => click(bar().getByRole("button", { name: /^(Shuffle|Reshuffle)$/ }));
const notice = () => within(screen.getByRole("alert"));
const expander = () => screen.getByText(SHOW_RULES_INVOLVED).closest("details")!;
/** The Pairs listed under "Show the Rules involved". */
const involved = () =>
  within(expander())
    .getAllByRole("button")
    .map((b) => b.textContent);
const drawer = () => within(screen.getByRole("dialog", { name: "Pairs" }));
const rowOf = (label: string) => drawer().getByRole("button", { name: `Delete ${label}` }).closest("li")!;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("navigator", { ...navigator, storage: { persist: () => Promise.resolve(true) } });
  scrolled = [];
  // jsdom has no layout, so no scrollIntoView: record which element asked to be shown.
  Element.prototype.scrollIntoView = function (this: HTMLElement) {
    scrolled.push(this);
  };
});

describe("Show the Rules involved", () => {
  it("lists the clashing Pairs newest first; each opens the Pairs drawer with that Pair highlighted, scrolled to and focused", () => {
    // 6 Present at 2: Ana is kept apart from everyone, so nobody can share her Group. Ben & Cal
    // doesn't matter.
    renderApp(
      savedRoster(
        [
          ["keep apart", "Ben", "Cal"],
          ["keep apart", "Ana", "Ben"],
          ["keep apart", "Ana", "Cal"],
          ["keep apart", "Ana", "Dee"],
          ["keep apart", "Ana", "Eli"],
          ["keep apart", "Ana", "Fay"],
        ],
        2,
      ),
    );
    shuffle();
    expect(screen.getByRole("alert")).toHaveTextContent(noGroupingMessage([2, 2, 2]));

    // Collapsed at first; opening it shows the Pairs, newest first, with their kind.
    expect(expander().open).toBe(false);
    click(notice().getByText(SHOW_RULES_INVOLVED));
    expect(expander().open).toBe(true);
    expect(involved()).toEqual([
      "Ana & Fay (Keep apart)",
      "Ana & Eli (Keep apart)",
      "Ana & Dee (Keep apart)",
      "Ana & Cal (Keep apart)",
      "Ana & Ben (Keep apart)",
    ]);
    // No way to ignore a Rule or switch one off.
    expect(notice().queryByRole("checkbox")).not.toBeInTheDocument();
    expect(notice().queryByRole("switch")).not.toBeInTheDocument();
    expect(notice().queryByRole("button", { name: /ignore/i })).not.toBeInTheDocument();

    click(notice().getByRole("button", { name: "Ana & Dee (Keep apart)" }));
    const row = rowOf("Ana & Dee");
    expect(row).toHaveAttribute("aria-current", "true");
    expect(row).toHaveFocus();
    expect(scrolled).toEqual([row]);
    // Only that Pair is highlighted.
    expect(rowOf("Ana & Ben")).not.toHaveAttribute("aria-current");

    // Deleting it fixes the Conflict: the notice goes, and the next Shuffle makes Groups.
    click(within(row).getByRole("button", { name: "Delete Ana & Dee" }));
    click(drawer().getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    shuffle();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getAllByRole("region")).toHaveLength(3);
  });

  it("opening the Pairs drawer from the top bar highlights nothing", () => {
    renderApp(savedRoster([["good pair", "Ana", "Ben"], ["good pair", "Ben", "Cal"]], 2));
    shuffle();
    click(notice().getByText(SHOW_RULES_INVOLVED));
    click(notice().getByRole("button", { name: "Ben & Cal (Good pair)" }));
    expect(rowOf("Ben & Cal")).toHaveAttribute("aria-current", "true");
    click(drawer().getByRole("button", { name: "Done" }));

    click(bar().getByRole("button", { name: /^\d+ Pairs?$/ }));
    expect(rowOf("Ben & Cal")).not.toHaveAttribute("aria-current");
    expect(rowOf("Ana & Ben")).not.toHaveAttribute("aria-current");
  });

  it("for a chain too big, lists the chain's Good pairs", () => {
    renderApp(savedRoster([["keep apart", "Dee", "Eli"], ["good pair", "Ana", "Ben"], ["good pair", "Ben", "Cal"]], 2));
    shuffle();
    expect(screen.getByRole("alert")).toHaveTextContent(chainTooBigMessage(["Ana", "Ben", "Cal"], 2));
    expect(involved()).toEqual(["Ben & Cal (Good pair)", "Ana & Ben (Good pair)"]);
  });

  it("for more Students who must be kept apart than Groups, lists their Keep apart pairs", () => {
    // 6 Present at 3 make 2 Groups; Ana, Ben and Cal must all be kept apart.
    renderApp(
      savedRoster(
        [
          ["keep apart", "Ana", "Ben"],
          ["good pair", "Dee", "Eli"],
          ["keep apart", "Ana", "Cal"],
          ["keep apart", "Ben", "Cal"],
        ],
        3,
      ),
    );
    shuffle();
    expect(screen.getByRole("alert")).toHaveTextContent(apartCliqueMessage(["Ana", "Ben", "Cal"], 2));
    expect(involved()).toEqual(["Ben & Cal (Keep apart)", "Ana & Cal (Keep apart)", "Ana & Ben (Keep apart)"]);
  });
});
