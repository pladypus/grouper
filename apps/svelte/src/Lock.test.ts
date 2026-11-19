import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import {
  addPair,
  addStudent,
  chainCutByLockMessage,
  createRoster,
  deriveSplit,
  EMPTY_APP_STATE,
  keepApartFlagMessage,
  lockedGroupMessage,
  lockReleasedMessage,
  loneLeftoverMessage,
  OUT_OF_DATE_MESSAGE,
  saveAppState,
  seededRng,
  setTargetSize,
  updateRoster,
  type AppState,
  type StorageLike,
} from "@grouper/core";
import { SOURCES, TRIGGERS } from "svelte-dnd-action";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App.svelte";

// #19: Lock Groups and Reshuffle around them. Shuffle gets a seeded rng so every run is the same.

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

const NAMES = "Ana Ben Cal Dee Eli Fay Gus Hal Ivy Jo Kim Lu".split(" ");
const id = (name: string) => `s${NAMES.indexOf(name) + 1}`;

/** "Period 2" with 12 Present Students (ids s1…s12), the given Pairs and Target size (default 4). */
function savedRoster(pairs: ["good pair" | "keep apart", string, string][] = [], target = 4): AppState {
  const r = createRoster(EMPTY_APP_STATE, "Period 2", () => "p2");
  if (!r.ok) throw new Error(r.message);
  return updateRoster(r.state, "p2", (roster) => {
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
    return setTargetSize(roster, target);
  });
}

function renderApp(state: AppState = savedRoster()) {
  const storage = new MemoryStorage();
  saveAppState(storage, state);
  let n = 0;
  render(App, { storage, newId: () => `id${++n}`, rng: seededRng(1), storageManager: null });
}

const click = (el: HTMLElement) => fireEvent.click(el);
/** The top bar's Shuffle / Reshuffle button (its name includes "keeps N Locked" when shown). */
const barShuffle = () => within(screen.getByRole("banner")).getByRole("button", { name: /^(Shuffle|Reshuffle)/ });
const reshuffle = () => click(barShuffle());
const cards = () => screen.queryAllByRole("region");
const cardNames = () =>
  cards().map((c) => within(c).getAllByRole("listitem").map((li) => li.querySelector("span.truncate")!.textContent!));
const cardOf = (name: string) => cardNames().findIndex((names) => names.includes(name));
const student = (name: string) => screen.getByRole("button", { name });
const otherCard = (name: string) => cardNames().find((_, i) => i !== cardOf(name))![0]!;
const lockButton = (i: number) => within(cards()[i]!).getByRole("button", { name: /^(Lock|Unlock) Group \d+$/ });
const toggleLock = (i: number) => click(lockButton(i));
const hues = () => cards().map((c) => c.style.getPropertyValue("--hue"));
const warnings = (i: number) => Array.from(cards()[i]!.querySelectorAll("p")).map((p) => p.textContent!.trim());
async function markAbsent(...names: string[]) {
  await click(screen.getByRole("button", { name: /Present$/ }));
  const list = screen.getByRole("list", { name: "Attendance" });
  for (const name of names) await click(within(list).getByRole("button", { name }));
  await click(screen.getByRole("button", { name: "Done" }));
}

/** The classes the React app uses too. */
const RING = "shadow-[0_0_0_3px_hsl(var(--hue)_var(--hue-s)_var(--hue-l))]";
const TINT = "bg-[hsl(var(--hue)_var(--hue-s)_var(--hue-soft-l))]";

afterEach(() => cleanup());

describe("Lock toggle", () => {
  it("an outlined “Lock” pill per header; pressing it gives a ring in the Group's colour, a tinted body and a solid “Locked” pill", async () => {
    renderApp();
    await reshuffle();
    expect(cards()).toHaveLength(3);
    cards().forEach((_, i) => {
      const pill = lockButton(i);
      expect(pill).toHaveAccessibleName(`Lock Group ${i + 1}`);
      expect(pill).toHaveAttribute("aria-pressed", "false");
      expect(pill).toHaveTextContent(/^Lock$/);
      expect(pill).toHaveClass("border-current", "bg-transparent", "print:hidden");
    });
    expect(cards()[1]).not.toHaveClass(RING);

    await toggleLock(1);
    const pill = lockButton(1);
    expect(pill).toHaveAccessibleName("Unlock Group 2");
    expect(pill).toHaveAttribute("aria-pressed", "true");
    expect(pill).toHaveTextContent(/^Locked$/);
    expect(pill).toHaveClass("bg-on-c", "text-[hsl(var(--hue)_var(--hue-s)_var(--hue-l))]");
    expect(pill).not.toHaveClass("print:hidden");
    expect(cards()[1]).toHaveClass(RING);
    expect(within(cards()[1]!).getByRole("list")).toHaveClass(TINT);
    expect(within(cards()[0]!).getByRole("list")).not.toHaveClass(TINT);
    // The card keeps its name: the pill isn't part of the heading.
    expect(cards()[1]).toHaveAccessibleName("Group 2 · 4 students");
    // Locking never marks the Groups out of date.
    expect(screen.queryByText(`⚠ ${OUT_OF_DATE_MESSAGE}`)).not.toBeInTheDocument();

    await toggleLock(1);
    expect(lockButton(1)).toHaveAccessibleName("Lock Group 2");
    expect(lockButton(1)).toHaveAttribute("aria-pressed", "false");
    expect(cards()[1]).not.toHaveClass(RING);
  });

  it('the Reshuffle button shows "keeps N Locked" while any Group is Locked', async () => {
    renderApp();
    await reshuffle();
    expect(barShuffle()).toHaveAccessibleName("Reshuffle");
    await toggleLock(0);
    await toggleLock(2);
    expect(barShuffle()).toHaveAccessibleName("Reshuffle keeps 2 Locked");
    expect(within(barShuffle()).getByText("keeps 2 Locked").tagName).toBe("SMALL");
    await toggleLock(0);
    expect(barShuffle()).toHaveAccessibleName("Reshuffle keeps 1 Locked");
    await toggleLock(2);
    expect(barShuffle()).toHaveAccessibleName("Reshuffle");
  });
});

describe("Reshuffle around Locks", () => {
  it("Locked Groups keep their position, colour and members; only the free Students are reshuffled", async () => {
    renderApp(savedRoster([], 3));
    await reshuffle();
    const before = cardNames();
    const beforeHues = hues();
    await toggleLock(1);
    await toggleLock(3);
    await reshuffle();
    const after = cardNames();
    expect(after).toHaveLength(4);
    expect(after[1]).toEqual(before[1]);
    expect(after[3]).toEqual(before[3]);
    expect(hues()).toEqual(beforeHues);
    expect(lockButton(1)).toHaveAttribute("aria-pressed", "true");
    expect(lockButton(3)).toHaveAttribute("aria-pressed", "true");
    expect(lockButton(0)).toHaveAttribute("aria-pressed", "false");
    // The free Students fill the other positions.
    expect([...after[0]!, ...after[2]!].sort()).toEqual([...before[0]!, ...before[2]!].sort());
    // Further Reshuffles move the free Students around and never touch the Locked Groups.
    const seen = new Set([JSON.stringify([after[0], after[2]])]);
    for (let i = 0; i < 4; i++) {
      await reshuffle();
      expect(cardNames()[1]).toEqual(before[1]);
      expect(cardNames()[3]).toEqual(before[3]);
      seen.add(JSON.stringify([cardNames()[0], cardNames()[2]]));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("re-splits the free Students from the Target size (a hand-edited Split is redone for the unlocked part)", async () => {
    renderApp();
    await reshuffle();
    await click(screen.getByRole("button", { name: "Edit" }));
    await fireEvent.input(screen.getByLabelText("Group sizes, comma separated"), { target: { value: "6, 6" } });
    await click(screen.getByRole("button", { name: "Save" }));
    await reshuffle();
    expect(cardNames().map((n) => n.length)).toEqual([6, 6]);
    const locked = cardNames()[0];
    await toggleLock(0);
    await reshuffle();
    expect(cardNames()[0]).toEqual(locked);
    expect(cardNames().slice(1).map((n) => n.length)).toEqual(deriveSplit(6, 4));
  });

  it("an Absent Student drops out of their Locked Group, which stays Locked", async () => {
    renderApp();
    await reshuffle();
    const [first, ...rest] = cardNames()[0]!;
    await toggleLock(0);
    await markAbsent(first!);
    // Faded in place until the Reshuffle.
    expect(cardNames()[0]).toEqual([first, ...rest]);
    expect(student(`${first} (Absent)`).closest("li")).toHaveClass("line-through");
    await reshuffle();
    expect(cardNames()[0]).toEqual(rest);
    expect(lockButton(0)).toHaveAttribute("aria-pressed", "true");
    expect(cards()[0]).toHaveAccessibleName("Group 1 · 3 students");
  });

  it("a Locked Group left with one Student is released with the toast, and they rejoin the pool", async () => {
    renderApp(savedRoster([], 2));
    await reshuffle();
    const [stays, goes] = cardNames()[2]!;
    await toggleLock(2);
    await markAbsent(goes!);
    await reshuffle();
    expect(screen.getByText(lockReleasedMessage([stays!]))).toBeInTheDocument();
    expect(screen.getByText(`Lock released: ${stays} would have been alone in a Locked Group.`)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Unlock/ })).not.toBeInTheDocument();
    expect(barShuffle()).toHaveAccessibleName("Reshuffle");
    expect(cardNames().flat()).toContain(stays);
    expect(cardNames().flat()).toHaveLength(11);
  });

  it('Conflict: one free Student left over ("Only Ana is left outside the Locked Groups…"); the Groups stay', async () => {
    renderApp();
    await reshuffle();
    await toggleLock(0);
    await toggleLock(1);
    const [left, ...absent] = cardNames()[2]!;
    await markAbsent(...absent);
    const before = cardNames();
    await reshuffle();
    expect(within(screen.getByRole("main")).getByRole("alert")).toHaveTextContent(loneLeftoverMessage(left!));
    expect(within(screen.getByRole("main")).getByRole("alert")).toHaveTextContent(
      `Only ${left} is left outside the Locked Groups, and a group of 1 isn't allowed. Unlock a Group or mark someone else Present.`,
    );
    expect(cardNames()).toEqual(before);
    expect(lockButton(0)).toHaveAttribute("aria-pressed", "true");
  });

  it("Conflict: a Present Good pair chain partly Locked and partly free, naming the Lock and the chain", async () => {
    renderApp(savedRoster([["good pair", "Ana", "Dee"]]));
    await reshuffle();
    // Swap Dee out of Ana's Group, then Lock Ana's.
    const other = otherCard("Ana");
    await click(student("Dee"));
    await click(student(other));
    const at = cardOf("Ana");
    expect(cardOf("Dee")).not.toBe(at);
    await toggleLock(at);
    const before = cardNames();
    await reshuffle();
    const alert = within(screen.getByRole("main")).getByRole("alert");
    expect(alert).toHaveTextContent(chainCutByLockMessage("Ana", at, "Dee", [["Ana", "Dee"]]));
    expect(alert).toHaveTextContent(
      `Ana is in Locked Group ${at + 1}, but Dee, linked to Ana by a Good pair, isn't. Unlock Group ${at + 1} or delete the pair.`,
    );
    expect(cardNames()).toEqual(before);

    // Unlocking clears the way: the next Reshuffle works and drops the notice.
    await toggleLock(at);
    await reshuffle();
    expect(within(screen.getByRole("main")).queryByRole("alert")).not.toBeInTheDocument();
    expect(cardOf("Ana")).toBe(cardOf("Dee"));
  });

  it("a flagged Group can be Locked; Reshuffle carries it over unchanged, still flagged, not a Conflict", async () => {
    renderApp(savedRoster([["keep apart", "Ana", "Ben"]]));
    await reshuffle();
    // Swap Ben into Ana's Group: flagged.
    const mate = cardNames()[cardOf("Ana")]!.find((n) => n !== "Ana")!;
    await click(student("Ben"));
    await click(student(mate));
    const at = cardOf("Ana");
    expect(cardOf("Ben")).toBe(at);
    const flag = `⚠ ${keepApartFlagMessage("Ana", "Ben")}`;
    expect(warnings(at)).toEqual([flag]);
    await toggleLock(at);
    expect(cards()[at]).toHaveClass("border-warn");
    expect(lockButton(at)).toHaveTextContent("Locked");
    const before = cardNames()[at];
    await reshuffle();
    expect(within(screen.getByRole("main")).queryByRole("alert")).not.toBeInTheDocument();
    expect(cardNames()[at]).toEqual(before);
    expect(warnings(at)).toEqual([flag]);
    expect(lockButton(at)).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Locked Groups refuse Manual moves", () => {
  it('tapping a Student in a Locked Group is refused with "Group 2 is Locked. Unlock it to move Students."', async () => {
    renderApp();
    await reshuffle();
    await toggleLock(1);
    const inLocked = cardNames()[1]![0]!;
    const before = cardNames();
    await click(student(inLocked));
    expect(screen.getByText(lockedGroupMessage(1))).toBeInTheDocument();
    expect(screen.getByText("Group 2 is Locked. Unlock it to move Students.")).toBeInTheDocument();
    expect(student(inLocked)).toHaveAttribute("aria-pressed", "false");
    expect(student(inLocked)).toHaveClass("cursor-not-allowed");
    expect(cardNames()).toEqual(before);
  });

  it("while a Student is selected, Locked Groups fade back; swapping into one is refused", async () => {
    renderApp();
    await reshuffle();
    await toggleLock(1);
    const free = cardNames()[0]![0]!;
    const inLocked = cardNames()[1]![0]!;
    const before = cardNames();
    expect(cards()[1]).not.toHaveClass("opacity-55");
    await click(student(free));
    expect(cards()[1]).toHaveClass("opacity-55");
    expect(cards()[0]).not.toHaveClass("opacity-55");
    expect(cards()[2]).not.toHaveClass("opacity-55");
    await click(student(inLocked));
    expect(screen.getByText(lockedGroupMessage(1))).toBeInTheDocument();
    expect(cardNames()).toEqual(before);
    expect(cards()[1]).not.toHaveClass("opacity-55");
  });

  it("Locking the selected Student's Group drops the selection", async () => {
    renderApp();
    await reshuffle();
    const name = cardNames()[0]![0]!;
    await click(student(name));
    expect(student(name)).toHaveAttribute("aria-pressed", "true");
    await toggleLock(0);
    expect(student(name)).toHaveAttribute("aria-pressed", "false");
    expect(cards()[0]).not.toHaveClass("opacity-55");
  });

  describe("by drag", () => {
    /** Puts a Student's row at a fixed box on screen (jsdom has no layout). */
    function placeRow(name: string, left: number, top: number) {
      student(name).closest("li")!.getBoundingClientRect = () => new DOMRect(left, top, 200, 30);
    }

    /** What svelte-dnd-action does over a pointer drag: consider at the start, then finalize at the drop. */
    async function drag(name: string, to: { x: number; y: number }) {
      const zone = student(name).closest("ul")!;
      const dragged = id(name);
      await fireEvent(
        zone,
        new CustomEvent("consider", {
          detail: { items: [], info: { trigger: TRIGGERS.DRAG_STARTED, id: dragged, source: SOURCES.POINTER } },
        }),
      );
      await fireEvent.mouseMove(window, { clientX: to.x, clientY: to.y });
      return () =>
        fireEvent(
          zone,
          new CustomEvent("finalize", {
            detail: { items: [], info: { trigger: TRIGGERS.DROPPED_INTO_ZONE, id: dragged, source: SOURCES.POINTER } },
          }),
        );
    }

    it("a drag never starts from a Locked Group", async () => {
      renderApp();
      await reshuffle();
      await toggleLock(1);
      const inLocked = cardNames()[1]![0]!;
      const target = cardNames()[0]![0]!;
      const before = cardNames();
      placeRow(target, 500, 100);
      const drop = await drag(inLocked, { x: 520, y: 110 });
      expect(student(inLocked).closest("li")).not.toHaveClass("opacity-40");
      expect(cards()[1]).not.toHaveClass("opacity-55");
      expect(student(target).closest("li")).not.toHaveTextContent("⇄");
      await drop();
      expect(cardNames()).toEqual(before);
    });

    it("while dragging, Locked Groups fade back; dropping onto one is refused with the toast", async () => {
      renderApp();
      await reshuffle();
      await toggleLock(1);
      const before = cardNames();
      const free = cardNames()[0]![0]!;
      const target = cardNames()[1]![0]!;
      placeRow(target, 500, 100);
      const drop = await drag(free, { x: 520, y: 110 });
      expect(cards()[1]).toHaveClass("opacity-55");
      expect(student(target).closest("li")).not.toHaveTextContent("⇄");
      await drop();
      expect(screen.getByText(lockedGroupMessage(1))).toBeInTheDocument();
      expect(cardNames()).toEqual(before);
      expect(cards()[1]).not.toHaveClass("opacity-55");
    });
  });
});
