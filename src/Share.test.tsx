// #23: the Share menu (Copy as text, Print…, Full screen) and the print layout's hooks.
import {
  addStudent,
  COPY_FAILED_MESSAGE,
  createRoster,
  EMPTY_APP_STATE,
  FULL_SCREEN_FAILED_MESSAGE,
  saveAppState,
  seededRng,
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

const NAMES = "Ana Ben Cal Dee Eli Fay Gus Hal Ivy Jo Kim Lu".split(" ");

/** "Period 2" with 12 Present Students at Target size 4: a Shuffle makes 3 Groups. */
function period2(): AppState {
  const r = createRoster(EMPTY_APP_STATE, "Period 2", () => "p2");
  if (!r.ok) throw new Error(r.message);
  return updateRoster(r.state, "p2", (roster) => {
    NAMES.forEach((name, i) => {
      const added = addStudent(roster, name, () => `s${i + 1}`);
      if (!added.ok) throw new Error(added.message);
      roster = added.roster;
    });
    return roster;
  });
}

let storage: MemoryStorage;
let clipboard: { writeText: ReturnType<typeof vi.fn> } | undefined;

function renderApp() {
  saveAppState(storage, period2());
  let n = 0;
  return render(<App storage={storage} newId={() => `id${++n}`} rng={seededRng(1)} />);
}

const click = (el: HTMLElement) => fireEvent.click(el);
const bar = () => screen.getByRole("banner");
const shareButton = () => within(bar()).getByRole("button", { name: "Share" });
const shuffle = () => click(within(bar()).getByRole("button", { name: /^Shuffle/ }));
const openShare = () => click(shareButton());
const item = (name: RegExp) => screen.getByRole("menuitem", { name });
const cardLines = () =>
  screen
    .getAllByRole("region")
    .map(
      (card, i) =>
        `Group ${i + 1}: ${within(card)
          .getAllByRole("listitem")
          .map((li) => li.querySelector("span.truncate")!.textContent)
          .join(", ")}`,
    );

beforeEach(() => {
  storage = new MemoryStorage();
  clipboard = { writeText: vi.fn(() => Promise.resolve()) };
  vi.stubGlobal("navigator", { ...navigator, clipboard, storage: { persist: () => Promise.resolve(true) } });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 18, 9, 0));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Share button", () => {
  it("sits between the size controls and the Theme button, disabled until there are Groups", () => {
    renderApp();
    const buttons = within(bar()).getAllByRole("button");
    const share = buttons.indexOf(shareButton());
    const theme = buttons.findIndex((b) => b.getAttribute("aria-label")?.startsWith("Theme:"));
    expect(share).toBe(theme - 1);
    expect(buttons.indexOf(within(bar()).getByRole("button", { name: "Edit" }))).toBeLessThan(share);
    expect(shareButton()).toBeDisabled();
    expect(shareButton()).toHaveAttribute("title", "Shuffle first, then share the Groups.");

    shuffle();
    expect(shareButton()).toBeEnabled();
    expect(shareButton()).toHaveAttribute("aria-haspopup", "menu");
  });

  it("opens a menu: Copy as text, Print…, Full screen; arrows move, Esc closes back to the button", () => {
    renderApp();
    shuffle();
    openShare();
    const menu = screen.getByRole("menu", { name: "Share" });
    expect(shareButton()).toHaveAttribute("aria-expanded", "true");
    expect(within(menu).getAllByRole("menuitem").map((b) => b.textContent)).toEqual([
      "Copy as text“Group 1: Ana, Dee, Eli” lines",
      "Print…",
      "Full screenFor the projector; Esc to leave",
    ]);
    expect(item(/^Copy as text/)).toHaveFocus();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(item(/^Print/)).toHaveFocus();
    fireEvent.keyDown(menu, { key: "End" });
    expect(item(/^Full screen/)).toHaveFocus();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(item(/^Copy as text/)).toHaveFocus();
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(shareButton()).toHaveFocus();
  });
});

describe("Copy as text", () => {
  it("puts a title line and one line per Group on the clipboard and toasts the count", async () => {
    renderApp();
    shuffle();
    openShare();
    await act(async () => click(item(/^Copy as text/)));
    expect(clipboard!.writeText).toHaveBeenCalledWith(["Period 2 groups, 18 Nov 2026", ...cardLines()].join("\n"));
    expect(cardLines()[0]).toMatch(/^Group 1: \w+, \w+, \w+, \w+$/);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByText("Copied 3 Groups as text.")).toBeInTheDocument();
  });

  it("falls back to a selected textarea and execCommand when the Clipboard API is refused", async () => {
    clipboard!.writeText.mockRejectedValue(new Error("denied"));
    let copied = "";
    const exec = vi.fn(() => {
      copied = (document.activeElement as HTMLTextAreaElement).value;
      return true;
    });
    Object.defineProperty(document, "execCommand", { value: exec, configurable: true });
    renderApp();
    shuffle();
    openShare();
    await act(async () => click(item(/^Copy as text/)));
    expect(exec).toHaveBeenCalledWith("copy");
    expect(copied.split("\n")[0]).toBe("Period 2 groups, 18 Nov 2026");
    expect(document.querySelector("textarea")).toBeNull();
    expect(screen.getByText("Copied 3 Groups as text.")).toBeInTheDocument();
  });

  it("says so when the browser won't copy at all", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    Object.defineProperty(document, "execCommand", { value: () => false, configurable: true });
    renderApp();
    shuffle();
    openShare();
    await act(async () => click(item(/^Copy as text/)));
    expect(screen.getByText(COPY_FAILED_MESSAGE)).toBeInTheDocument();
  });
});

describe("Print… and Full screen", () => {
  it("Print… opens the browser's print dialog", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderApp();
    shuffle();
    openShare();
    click(item(/^Print/));
    expect(print).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("Full screen asks for the whole page (top bar included); a refusal toasts", async () => {
    const request = vi.fn(() => Promise.reject(new Error("blocked")));
    Object.defineProperty(document.documentElement, "requestFullscreen", { value: request, configurable: true });
    renderApp();
    shuffle();
    openShare();
    await act(async () => click(item(/^Full screen/)));
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.contexts[0]).toBe(document.documentElement);
    expect(screen.getByText(FULL_SCREEN_FAILED_MESSAGE)).toBeInTheDocument();
  });

  it("offers Exit full screen while the page is full screen", () => {
    Object.defineProperty(document, "fullscreenElement", { value: document.documentElement, configurable: true });
    const exit = vi.fn(() => Promise.resolve());
    Object.defineProperty(document, "exitFullscreen", { value: exit, configurable: true });
    renderApp();
    shuffle();
    openShare();
    click(item(/^Exit full screen/));
    expect(exit).toHaveBeenCalledOnce();
    Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true });
  });
});

describe("print layout", () => {
  it("hides the top bar and adds a paper-only header with the Roster, date and Student count", () => {
    renderApp();
    shuffle();
    expect(bar()).toHaveClass("print:hidden");
    const title = screen.getByRole("heading", { level: 1, name: "Period 2 groups", hidden: true });
    expect(title.parentElement).toHaveClass("hidden", "print:flex");
    expect(title.parentElement).toHaveTextContent("18 Nov 2026 · 12 Students");
  });

  it("lays cards three across at their own size, never split across pages, names at 14pt", () => {
    renderApp();
    shuffle();
    const card = screen.getAllByRole("region")[0]!;
    expect(card.parentElement).toHaveClass("print:grid", "print:grid-cols-3");
    expect(card).toHaveClass("print:w-auto!", "print:h-auto!", "print:break-inside-avoid");
    expect(within(card).getByRole("list")).toHaveClass("print:text-[14pt]!");
  });
});
