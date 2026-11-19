import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import {
  DROP_ONTO_STUDENT_MESSAGE,
  goodPairSplitFlagMessage,
  keepApartFlagMessage,
  saveAppState,
  seededRng,
  selectedInstruction,
  SELECTION_CANCELLED_MESSAGE,
  swappedAnnouncement,
  type AppState,
  type Pair,
  type StorageLike,
} from "@grouper/core";
import { SOURCES, TRIGGERS } from "svelte-dnd-action";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App.svelte";

// #18: Manual move. Swap two Students by tap / keyboard or by drag; Groups that break a Pair are
// flagged. The rng is seeded so every run makes the same Groups.

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

/** Eight Present Students, Target size 4, shuffled into two Groups of 4. */
async function start(pairs: Pair[] = []) {
  const state: AppState = {
    rosters: [
      {
        id: "p2",
        name: "Period 2",
        students: NAMES.map((name) => ({ id: name.toLowerCase(), name, present: true })),
        pairs,
        target: 4,
      },
    ],
    currentId: "p2",
  };
  const storage = new MemoryStorage();
  saveAppState(storage, state);
  render(App, { storage, newId: idGenerator(), rng: seededRng(18), storageManager: null });
  await fireEvent.click(shuffleButton());
}

const shuffleButton = () => screen.getByRole("button", { name: /^(Re)?[Ss]huffle$/ });
const cards = () => screen.getAllByRole("region");
const namesIn = (card: HTMLElement) =>
  within(card)
    .getAllByRole("listitem")
    .map((li) => li.querySelector("span.truncate")!.textContent!);
const groups = () => cards().map(namesIn);
const student = (name: string) => screen.getByRole("button", { name });
const cardOf = (name: string) => cards().find((card) => namesIn(card).includes(name))!;
/** Someone in the other Group from `name`, other than `not`. */
const otherGroupMember = (name: string, not: string[] = []) =>
  namesIn(cards().find((card) => card !== cardOf(name))!).find((n) => !not.includes(n))!;
const sameGroupMember = (name: string, not: string[] = []) =>
  namesIn(cardOf(name)).find((n) => n !== name && !not.includes(n))!;
const flagLines = (card: HTMLElement) =>
  Array.from(card.querySelectorAll("p"))
    .map((p) => p.textContent!.trim())
    .filter((t) => t.startsWith("⚠"));
const selectedNames = () =>
  screen.queryAllByRole("button", { pressed: true }).map((b) => b.querySelector("span.truncate")!.textContent);
/** The polite live region that tells screen readers about the selection and swaps. */
const announced = (text: string) => {
  const region = screen.getByText(text);
  expect(region).toHaveAttribute("role", "status");
};

afterEach(() => cleanup());

describe("tap / keyboard swap", () => {
  it("selects a Student (solid accent with ✕) and swaps with a Student in another Group", async () => {
    await start();
    const before = groups();
    const ana = "Ana";
    const other = otherGroupMember(ana);

    await fireEvent.click(student(ana));
    expect(student(ana)).toHaveAttribute("aria-pressed", "true");
    expect(student(ana).closest("li")).toHaveClass("bg-accent", "text-accent-ink");
    expect(screen.getByRole("button", { name: "Cancel swap" })).toBeInTheDocument();
    expect(selectedNames()).toEqual([ana]);
    announced(selectedInstruction(ana));

    await fireEvent.click(student(other));
    expect(selectedNames()).toEqual([]);
    expect(screen.queryByRole("button", { name: "Cancel swap" })).not.toBeInTheDocument();
    announced(swappedAnnouncement(ana, other));

    // Each takes the other's place; Group sizes never change.
    const after = groups();
    expect(after.map((g) => g.length)).toEqual(before.map((g) => g.length));
    const swap = (n: string) => (n === ana ? other : n === other ? ana : n);
    expect(after).toEqual(before.map((g) => g.map(swap)));
    expect(cards().map((c) => within(c).getByRole("heading").textContent)).toEqual([
      "Group 1 · 4 students",
      "Group 2 · 4 students",
    ]);
  });

  it("works from the keyboard: Tab to a name, Enter or Space selects, Escape cancels", async () => {
    await start();
    const user = userEvent.setup();
    const ana = "Ana";
    const other = otherGroupMember(ana);
    const before = groups();

    student(ana).focus();
    await user.keyboard("{Enter}");
    expect(selectedNames()).toEqual([ana]);
    announced(selectedInstruction(ana));

    await user.keyboard("{Escape}");
    expect(selectedNames()).toEqual([]);
    announced(SELECTION_CANCELLED_MESSAGE);
    expect(groups()).toEqual(before);

    student(ana).focus();
    await user.keyboard(" ");
    student(other).focus();
    await user.keyboard(" ");
    expect(selectedNames()).toEqual([]);
    announced(swappedAnnouncement(ana, other));
    await waitFor(() => expect(student(other)).toHaveFocus());
    expect(groups()).not.toEqual(before);
  });

  it("cancels on the same Student, the ✕ or Esc, and moves the selection within a Group", async () => {
    await start();
    const before = groups();
    const ana = "Ana";

    await fireEvent.click(student(ana));
    await fireEvent.click(student(ana));
    expect(selectedNames()).toEqual([]);
    announced(SELECTION_CANCELLED_MESSAGE);

    await fireEvent.click(student(ana));
    await fireEvent.click(screen.getByRole("button", { name: "Cancel swap" }));
    await waitFor(() => expect(student(ana)).toHaveFocus());
    expect(selectedNames()).toEqual([]);

    await fireEvent.click(student(ana));
    await fireEvent.keyDown(window, { key: "Escape" });
    expect(selectedNames()).toEqual([]);

    // Another Student in the same Group takes over the selection.
    const mate = sameGroupMember(ana);
    await fireEvent.click(student(ana));
    await fireEvent.click(student(mate));
    expect(selectedNames()).toEqual([mate]);
    announced(selectedInstruction(mate));

    expect(groups()).toEqual(before);
  });

  it("shows ⇄ only on names in other Groups while a Student is selected", async () => {
    await start();
    const ana = "Ana";
    const swapMarks = (card: HTMLElement) =>
      Array.from(card.querySelectorAll("li")).filter((li) => li.textContent!.includes("⇄")).length;
    expect(cards().map(swapMarks)).toEqual([0, 0]);

    await fireEvent.click(student(ana));
    const mine = cardOf(ana);
    const theirs = cards().find((c) => c !== mine)!;
    expect(swapMarks(mine)).toBe(0);
    expect(swapMarks(theirs)).toBe(4);
    // Shown on hover / focus only.
    expect(theirs.querySelector("li span[aria-hidden]:last-child")).toHaveClass("hidden", "group-hover/chip:inline");
  });

  it("clears the selection on Reshuffle", async () => {
    await start();
    await fireEvent.click(student("Ana"));
    await fireEvent.click(shuffleButton());
    expect(selectedNames()).toEqual([]);
  });
});

describe("flags", () => {
  it("flags a Group holding a Keep apart pair, and clears it when a later swap undoes the break", async () => {
    await start([pair("keep apart", "Ana", "Ben", 1)]);
    expect(cardOf("Ana")).not.toBe(cardOf("Ben"));
    expect(cards().map(flagLines)).toEqual([[], []]);

    // Put Ben in with Ana.
    const mate = sameGroupMember("Ana");
    await fireEvent.click(student("Ben"));
    await fireEvent.click(student(mate));
    const flagged = cardOf("Ana");
    expect(cardOf("Ben")).toBe(flagged);
    expect(flagLines(flagged)).toEqual([`⚠ ${keepApartFlagMessage("Ana", "Ben")}`]);
    expect(flagged).toHaveClass("border-warn");
    const clean = cards().find((c) => c !== flagged)!;
    expect(flagLines(clean)).toEqual([]);
    expect(clean).not.toHaveClass("border-warn");

    // Swap Ben back out: the flag goes.
    await fireEvent.click(student("Ben"));
    await fireEvent.click(student(mate));
    expect(cards().map(flagLines)).toEqual([[], []]);
    expect(cards()[0]).not.toHaveClass("border-warn");
  });

  it("flags both Groups when a Good pair is split, and Reshuffle clears the flags", async () => {
    await start([pair("good pair", "Ana", "Ben", 1)]);
    expect(cardOf("Ana")).toBe(cardOf("Ben"));

    await fireEvent.click(student("Ben"));
    await fireEvent.click(student(otherGroupMember("Ben")));
    const line = `⚠ ${goodPairSplitFlagMessage("Ana", "Ben")}`;
    expect(cards().map(flagLines)).toEqual([[line], [line]]);
    for (const card of cards()) expect(card).toHaveClass("border-warn");

    await fireEvent.click(shuffleButton());
    expect(cards().map(flagLines)).toEqual([[], []]);
  });
});

describe("drag", () => {
  /** Puts a Student's row at a fixed box on screen (jsdom has no layout). */
  function placeRow(name: string, left: number, top: number) {
    const li = student(name).closest("li")!;
    li.getBoundingClientRect = () => new DOMRect(left, top, 200, 30);
  }

  /** What svelte-dnd-action does over a pointer drag: consider at the start, then finalize at the drop. */
  async function drag(name: string, to: { x: number; y: number }) {
    const zone = student(name).closest("ul")!;
    const id = name.toLowerCase();
    await fireEvent(
      zone,
      new CustomEvent("consider", {
        detail: { items: [], info: { trigger: TRIGGERS.DRAG_STARTED, id, source: SOURCES.POINTER } },
      }),
    );
    await fireEvent.mouseMove(window, { clientX: to.x, clientY: to.y });
    return async () => {
      await fireEvent(
        zone,
        new CustomEvent("finalize", {
          detail: { items: [], info: { trigger: TRIGGERS.DROPPED_INTO_ZONE, id, source: SOURCES.POINTER } },
        }),
      );
    };
  }

  it("dropping onto a Student in another Group swaps them, showing ⇄ on the target while over it", async () => {
    await start();
    const before = groups();
    const other = otherGroupMember("Ana");
    placeRow(other, 500, 100);

    const drop = await drag("Ana", { x: 520, y: 110 });
    const target = student(other).closest("li")!;
    expect(target).toHaveTextContent("⇄");
    expect(target.querySelector("span[aria-hidden]:last-child")).toHaveClass("inline");
    await drop();

    const swap = (n: string) => (n === "Ana" ? other : n === other ? "Ana" : n);
    expect(groups()).toEqual(before.map((g) => g.map(swap)));
    announced(swappedAnnouncement("Ana", other));
  });

  it("dropping anywhere else does nothing and says to drop onto a Student", async () => {
    await start();
    const before = groups();
    placeRow(otherGroupMember("Ana"), 500, 100);

    const drop = await drag("Ana", { x: 10, y: 600 });
    await drop();

    expect(groups()).toEqual(before);
    expect(screen.getByText(DROP_ONTO_STUDENT_MESSAGE)).toBeInTheDocument();
  });

  it("dropping onto a Student in the same Group changes nothing", async () => {
    await start();
    const before = groups();
    const mate = sameGroupMember("Ana");
    placeRow(mate, 500, 100);

    const drop = await drag("Ana", { x: 510, y: 105 });
    expect(student(mate).closest("li")).not.toHaveTextContent("⇄");
    await drop();

    expect(groups()).toEqual(before);
    expect(screen.queryByText(DROP_ONTO_STUDENT_MESSAGE)).not.toBeInTheDocument();
  });
});
