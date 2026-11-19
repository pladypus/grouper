// #18: Manual move. Swap two Students by tap / keyboard or by drag; Groups that break a Pair are
// flagged until a later swap or a Reshuffle fixes them. Shuffle gets a seeded rng so every run is the same.
import {
  addPair,
  addStudent,
  chainSplitFlagMessage,
  createRoster,
  DROP_ONTO_STUDENT_MESSAGE,
  EMPTY_APP_STATE,
  goodPairSplitFlagMessage,
  keepApartFlagMessage,
  saveAppState,
  seededRng,
  selectedInstruction,
  SELECTION_CANCELLED_MESSAGE,
  swappedAnnouncement,
  updateRoster,
  type AppState,
  type StorageLike,
} from "@grouper/core";
import { DndContext } from "@dnd-kit/core";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { GroupCard, type MoveView } from "./components/GroupCard";

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

const NAMES = "Ana Ben Cal Dee Eli Fay Gus Hal Ivy Jo Kim Lu".split(" ");
const id = (name: string) => `s${NAMES.indexOf(name) + 1}`;

/** "Period 2" with 12 Present Students (ids s1…s12) and the given Pairs, plus an empty "Period 5". */
function savedRoster(pairs: ["good pair" | "keep apart", string, string][] = []): AppState {
  let state = EMPTY_APP_STATE;
  for (const [rid, name] of [
    ["p5", "Period 5"],
    ["p2", "Period 2"],
  ] as const) {
    const r = createRoster(state, name, () => rid);
    if (!r.ok) throw new Error(r.message);
    state = r.state;
  }
  state = updateRoster(state, "p2", (roster) => {
    for (const s of NAMES) {
      const added = addStudent(roster, s, () => id(s));
      if (!added.ok) throw new Error(added.message);
      roster = added.roster;
    }
    pairs.forEach(([type, a, b], i) => {
      const added = addPair(roster, type, id(a), id(b), () => `pair${i}`);
      if (!added.ok) throw new Error(added.message);
      roster = added.roster;
    });
    return roster;
  });
  return state;
}

let storage: MemoryStorage;

function renderApp(state: AppState = savedRoster()) {
  saveAppState(storage, state);
  let n = 0;
  return render(<App storage={storage} newId={() => `id${++n}`} rng={seededRng(1)} />);
}

const click = (el: HTMLElement) => fireEvent.click(el);
const shuffle = () =>
  click(within(screen.getByRole("banner")).getByRole("button", { name: /^(Shuffle|Reshuffle)$/ }));
const cards = () => screen.queryAllByRole("region");
const cardNames = () =>
  cards().map((c) => within(c).getAllByRole("listitem").map((li) => li.querySelector("span.truncate")!.textContent!));
const cardOf = (name: string) => cardNames().findIndex((names) => names.includes(name));
const student = (name: string) => screen.getByRole("button", { name });
/** The first Student in another card than `name`, and one in the same card. */
const otherCard = (name: string) => cardNames().find((_, i) => i !== cardOf(name))![0]!;
const sameCard = (name: string) => cardNames()[cardOf(name)]!.find((n) => n !== name)!;
/** The polite Manual move live region. */
const liveRegion = () =>
  screen.getAllByRole("status").find((el) => el.getAttribute("aria-live") === "polite" && el.classList.contains("sr-only"))!;
/** The "⚠ …" warning lines on the card holding `name`. */
const warnings = (name: string) =>
  Array.from(cards()[cardOf(name)]!.querySelectorAll("p")).map((p) => p.textContent);
const allWarnings = () => cards().flatMap((c) => Array.from(c.querySelectorAll("p")).map((p) => p.textContent));
const flagged = (card: HTMLElement) => card.classList.contains("border-warn");

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("navigator", { ...navigator, storage: { persist: () => Promise.resolve(true) } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("tap and keyboard swap", () => {
  it("tap selects (solid accent with ✕), tapping a Student in another Group swaps; sizes never change", () => {
    renderApp();
    shuffle();
    const sizes = cardNames().map((n) => n.length);
    const other = otherCard("Ana");
    const anaCard = cardOf("Ana");
    const otherIndex = cardOf(other);

    click(student("Ana"));
    expect(student("Ana")).toHaveAttribute("aria-pressed", "true");
    expect(student("Ana").closest("li")).toHaveClass("bg-accent", "text-accent-ink");
    expect(screen.getByRole("button", { name: "Cancel swap" })).toHaveTextContent("✕");
    expect(liveRegion()).toHaveTextContent(selectedInstruction("Ana"));

    click(student(other));
    expect(cardNames()[anaCard]).toContain(other);
    expect(cardNames()[otherIndex]).toContain("Ana");
    expect(cardNames().map((n) => n.length)).toEqual(sizes);
    expect(liveRegion()).toHaveTextContent(swappedAnnouncement("Ana", other));
    expect(student("Ana")).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "Cancel swap" })).not.toBeInTheDocument();
  });

  it("each Student takes the other's place in the list", () => {
    renderApp();
    shuffle();
    const before = cardNames();
    const other = otherCard("Ana");
    const [a, b] = [cardOf("Ana"), cardOf(other)];
    click(student("Ana"));
    click(student(other));
    const after = cardNames();
    expect(after[a]).toEqual(before[a]!.map((n) => (n === "Ana" ? other : n)));
    expect(after[b]).toEqual(before[b]!.map((n) => (n === other ? "Ana" : n)));
  });

  it("Enter selects and Space swaps from the keyboard; focus stays on the moved Student", async () => {
    const user = userEvent.setup();
    renderApp();
    shuffle();
    const other = otherCard("Ana");
    const otherIndex = cardOf(other);
    student("Ana").focus();
    await user.keyboard("{Enter}");
    expect(student("Ana")).toHaveAttribute("aria-pressed", "true");
    expect(liveRegion()).toHaveTextContent(selectedInstruction("Ana"));

    student(other).focus();
    await user.keyboard(" ");
    expect(cardNames()[otherIndex]).toContain("Ana");
    expect(liveRegion()).toHaveTextContent(swappedAnnouncement("Ana", other));
    expect(student(other)).toHaveFocus();
  });

  it("the same Student, the ✕ or Esc cancels", async () => {
    const user = userEvent.setup();
    renderApp();
    shuffle();
    const before = cardNames();

    click(student("Ana"));
    click(student("Ana"));
    expect(student("Ana")).toHaveAttribute("aria-pressed", "false");
    expect(liveRegion()).toHaveTextContent(SELECTION_CANCELLED_MESSAGE);

    click(student("Ana"));
    click(screen.getByRole("button", { name: "Cancel swap" }));
    expect(student("Ana")).toHaveAttribute("aria-pressed", "false");
    expect(liveRegion()).toHaveTextContent(SELECTION_CANCELLED_MESSAGE);
    expect(student("Ana")).toHaveFocus();

    click(student("Ana"));
    expect(liveRegion()).toHaveTextContent(selectedInstruction("Ana"));
    await user.keyboard("{Escape}");
    expect(student("Ana")).toHaveAttribute("aria-pressed", "false");
    expect(liveRegion()).toHaveTextContent(SELECTION_CANCELLED_MESSAGE);
    expect(cardNames()).toEqual(before);
  });

  it("a Student in the same Group takes over the selection", () => {
    renderApp();
    shuffle();
    const mate = sameCard("Ana");
    click(student("Ana"));
    click(student(mate));
    expect(student("Ana")).toHaveAttribute("aria-pressed", "false");
    expect(student(mate)).toHaveAttribute("aria-pressed", "true");
    expect(liveRegion()).toHaveTextContent(selectedInstruction(mate));
  });

  it("while a Student is selected, names in other Groups carry ⇄ for hover; their own Group's don't", () => {
    renderApp();
    shuffle();
    const hint = (name: string) => student(name).querySelector('[aria-hidden="true"].group-hover\\/chip\\:inline');
    expect(hint(otherCard("Ana"))).toBeNull();
    click(student("Ana"));
    expect(hint(otherCard("Ana"))).toHaveTextContent("⇄");
    expect(hint(otherCard("Ana"))).toHaveClass("hidden");
    expect(hint(sameCard("Ana"))).toBeNull();
    expect(hint("Ana")).toBeNull();
  });

  it("a Reshuffle clears the selection", () => {
    renderApp();
    shuffle();
    click(student("Ana"));
    shuffle();
    expect(student("Ana")).toHaveAttribute("aria-pressed", "false");
  });
});

describe("flags", () => {
  it("a swap that puts a Keep apart pair together flags that Group; swapping back clears it", () => {
    renderApp(savedRoster([["keep apart", "Ana", "Ben"]]));
    shuffle();
    expect(allWarnings()).toEqual([]);
    expect(cardOf("Ana")).not.toBe(cardOf("Ben"));

    const mate = sameCard("Ana");
    click(student("Ben"));
    click(student(mate));
    const card = cards()[cardOf("Ana")]!;
    expect(flagged(card)).toBe(true);
    expect(card).toHaveClass("shadow-[0_0_0_2px_var(--color-warn)]");
    expect(warnings("Ana")).toEqual([`⚠ ${keepApartFlagMessage("Ana", "Ben")}`]);
    const line = within(card).getByText(`⚠ ${keepApartFlagMessage("Ana", "Ben")}`);
    expect(line).toHaveClass("border-t", "border-warn-line", "bg-warn-soft", "text-warn");
    expect(cards().filter(flagged)).toHaveLength(1);

    click(student("Ben"));
    click(student(mate));
    expect(allWarnings()).toEqual([]);
    expect(cards().filter(flagged)).toHaveLength(0);
  });

  it("splitting a Good pair flags both Groups; a Reshuffle clears the flags", () => {
    renderApp(savedRoster([["good pair", "Cal", "Dee"]]));
    shuffle();
    expect(cardOf("Cal")).toBe(cardOf("Dee"));
    click(student("Cal"));
    click(student(otherCard("Cal")));
    const message = `⚠ ${goodPairSplitFlagMessage("Cal", "Dee")}`;
    expect(warnings("Cal")).toEqual([message]);
    expect(warnings("Dee")).toEqual([message]);
    expect(cards().filter(flagged)).toHaveLength(2);

    shuffle();
    expect(allWarnings()).toEqual([]);
    expect(cards().filter(flagged)).toHaveLength(0);
  });

  it("a Present chain split around an Absent Student names the linking Pairs", () => {
    // Ana & Ben & Cal chain; Ben is Absent, so Ana and Cal are linked through him.
    let state = savedRoster([
      ["good pair", "Ana", "Ben"],
      ["good pair", "Ben", "Cal"],
    ]);
    state = updateRoster(state, "p2", (r) => ({
      ...r,
      students: r.students.map((s) => (s.name === "Ben" ? { ...s, present: false } : s)),
    }));
    renderApp(state);
    shuffle();
    expect(cardOf("Ana")).toBe(cardOf("Cal"));
    click(student("Ana"));
    click(student(otherCard("Ana")));
    expect(warnings("Ana")).toEqual([
      `⚠ ${chainSplitFlagMessage("Ana", "Cal", [
        ["Ana", "Ben"],
        ["Ben", "Cal"],
      ])}`,
    ]);
  });
});

describe("drag", () => {
  /** Lays the cards' names out on a grid so dnd-kit's pointerWithin can find them in jsdom. */
  function layOut() {
    const rects = new Map<Element, DOMRect>();
    cards().forEach((card, c) =>
      within(card)
        .getAllByRole("listitem")
        .forEach((li, r) => rects.set(li, new DOMRect(c * 300, 100 + r * 50, 280, 40))),
    );
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      return rects.get(this) ?? new DOMRect(0, 0, 0, 0);
    });
    return (name: string) => rects.get(student(name).closest("li")!)!;
  }

  /** Mouse down on `from` and move past the 6 px threshold to (x, y), without letting go. */
  function pickUp(from: string, to: { x: number; y: number }, rect: DOMRect) {
    const start = { clientX: rect.x + 10, clientY: rect.y + 10 };
    fireEvent.mouseDown(student(from), { ...start, button: 0 });
    fireEvent.mouseMove(document, { clientX: start.clientX + 20, clientY: start.clientY });
    fireEvent.mouseMove(document, { clientX: to.x, clientY: to.y });
  }

  /** Mouse down on `from`, move past the 6 px threshold, then release at (x, y). */
  function drag(from: string, to: { x: number; y: number }, rect: DOMRect) {
    pickUp(from, to, rect);
    fireEvent.mouseUp(document, { clientX: to.x, clientY: to.y });
  }

  // dnd-kit swallows clicks on the document for 50 ms after a drag; let that pass between tests.
  afterEach(() => act(() => new Promise((r) => setTimeout(r, 60))));

  it("while dragging, the name under the pointer shows ⇄ and the picked-up name fades", () => {
    renderApp();
    shuffle();
    const rectOf = layOut();
    const other = otherCard("Ana");
    const otherIndex = cardOf(other);
    const neighbour = cardNames()[otherIndex]![1]!;
    const target = rectOf(other);
    pickUp("Ana", { x: target.x + 20, y: target.y + 20 }, rectOf("Ana"));
    expect(student("Ana").closest("li")).toHaveClass("opacity-40");
    const hint = (name: string) => student(name).querySelector('[aria-hidden="true"].text-\\[\\.7em\\]');
    expect(hint(other)).toHaveTextContent("⇄");
    expect(hint(other)).toHaveClass("inline");
    expect(hint(other)).not.toHaveClass("hidden");
    // Other swappable names show ⇄ on hover only.
    expect(hint(neighbour)).toHaveClass("hidden", "group-hover/chip:inline");
    expect(hint(sameCard("Ana"))).toBeNull();
    fireEvent.mouseUp(document, { clientX: target.x + 20, clientY: target.y + 20 });
    expect(cardOf("Ana")).toBe(otherIndex);
    expect(student("Ana").closest("li")).not.toHaveClass("opacity-40");
  });

  it("dropping onto a Student in another Group swaps them; the library never reorders the lists", () => {
    renderApp();
    shuffle();
    const rectOf = layOut();
    const before = cardNames();
    const other = otherCard("Ana");
    const [a, b] = [cardOf("Ana"), cardOf(other)];
    const target = rectOf(other);
    drag("Ana", { x: target.x + 20, y: target.y + 20 }, rectOf("Ana"));
    const after = cardNames();
    expect(after[a]).toEqual(before[a]!.map((n) => (n === "Ana" ? other : n)));
    expect(after[b]).toEqual(before[b]!.map((n) => (n === other ? "Ana" : n)));
    expect(liveRegion()).toHaveTextContent(swappedAnnouncement("Ana", other));
  });

  it('dropping anywhere else does nothing and toasts "Drop onto a Student to swap with them."', () => {
    renderApp();
    shuffle();
    const rectOf = layOut();
    const before = cardNames();
    drag("Ana", { x: 5000, y: 5000 }, rectOf("Ana"));
    expect(cardNames()).toEqual(before);
    expect(screen.getByText(DROP_ONTO_STUDENT_MESSAGE)).toBeInTheDocument();
  });

  it("on touch, a short hold picks the Student up and dropping onto another swaps; a quick tap still selects", async () => {
    renderApp();
    shuffle();
    const rectOf = layOut();
    const other = otherCard("Ana");
    const otherIndex = cardOf(other);
    const from = rectOf("Ana");
    const to = rectOf(other);
    const at = (r: DOMRect) => ({ clientX: r.x + 10, clientY: r.y + 10 });

    fireEvent.touchStart(student("Ana"), { touches: [at(from)] });
    await act(() => new Promise((r) => setTimeout(r, 250)));
    // Touch events keep going to the element the touch started on.
    const ana = student("Ana");
    fireEvent.touchMove(ana, { touches: [at(to)] });
    fireEvent.touchEnd(ana, { changedTouches: [at(to)] });
    expect(cardOf("Ana")).toBe(otherIndex);
    expect(liveRegion()).toHaveTextContent(swappedAnnouncement("Ana", other));
    await act(() => new Promise((r) => setTimeout(r, 60)));

    // A tap shorter than the hold never starts a drag.
    fireEvent.touchStart(student("Ana"), { touches: [at(to)] });
    fireEvent.touchEnd(student("Ana"), { changedTouches: [at(to)] });
    click(student("Ana"));
    expect(student("Ana")).toHaveAttribute("aria-pressed", "true");
  });

  it("a plain click on a draggable name still selects", () => {
    renderApp();
    shuffle();
    layOut();
    fireEvent.mouseDown(student("Ana"), { button: 0, clientX: 10, clientY: 110 });
    fireEvent.mouseUp(document, { clientX: 10, clientY: 110 });
    click(student("Ana"));
    expect(student("Ana")).toHaveAttribute("aria-pressed", "true");
  });

  it("the drop handler swaps even when a Student was selected first, and clears the selection", () => {
    renderApp(savedRoster([["keep apart", "Ana", "Ben"]]));
    shuffle();
    const rectOf = layOut();
    click(student("Gus"));
    const mate = sameCard("Ana");
    const target = rectOf(mate);
    drag("Ben", { x: target.x + 20, y: target.y + 20 }, rectOf("Ben"));
    expect(cardOf("Ben")).toBe(cardOf("Ana"));
    expect(warnings("Ana")).toEqual([`⚠ ${keepApartFlagMessage("Ana", "Ben")}`]);
    expect(student("Gus")).toHaveAttribute("aria-pressed", "false");
  });
});

describe("Locked Groups while moving", () => {
  // No Lock toggle until #19, so render a card directly.
  const members = [
    { id: "a", name: "Ana", status: "present", faded: false },
    { id: "b", name: "Ben", status: "present", faded: false },
  ] as const;
  const view = (selected: string | null): MoveView => ({
    selected,
    dragging: null,
    canMove: () => false,
    canSwapWith: () => false,
    onTap: () => {},
    onCancel: () => {},
  });
  const renderCard = (selected: string | null) =>
    render(
      <DndContext>
        <GroupCard
          group={{ id: "g", members: ["a", "b"], hue: 200, locked: true } as never}
          index={1}
          members={members}
          size={null}
          phone={false}
          flags={[]}
          move={view(selected)}
        />
      </DndContext>,
    );

  it("fade back (opacity .55) only while a Student is selected or dragged", () => {
    const { unmount } = renderCard(null);
    expect(screen.getByRole("region")).not.toHaveClass("opacity-55");
    unmount();
    renderCard("x");
    expect(screen.getByRole("region")).toHaveClass("opacity-55");
    expect(student("Ana")).toHaveClass("cursor-not-allowed");
  });
});
