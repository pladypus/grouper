// #23: the Share menu (Copy as text, Print…, Full screen) and the print layout's hooks.
import {
  addStudent,
  COPY_FAILED_MESSAGE,
  createRoster,
  EMPTY_APP_STATE,
  FULL_SCREEN_FAILED_MESSAGE,
  PICTURE_DOWNLOADED_MESSAGE,
  PICTURE_FAILED_MESSAGE,
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

  it("opens a menu: Copy picture, Copy as text, Print…, Full screen; arrows move, Esc closes back to the button", () => {
    renderApp();
    shuffle();
    openShare();
    const menu = screen.getByRole("menu", { name: "Share" });
    expect(shareButton()).toHaveAttribute("aria-expanded", "true");
    expect(within(menu).getAllByRole("menuitem").map((b) => b.textContent)).toEqual([
      "Copy pictureA 16:9 picture of the Groups, for a slide",
      "Copy as text“Group 1: Ana, Dee, Eli” lines",
      "Print…",
      "Full screenFor the projector; Esc to leave",
    ]);
    expect(item(/^Copy picture/)).toHaveFocus();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(item(/^Copy as text/)).toHaveFocus();
    fireEvent.keyDown(menu, { key: "End" });
    expect(item(/^Full screen/)).toHaveFocus();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(item(/^Copy picture/)).toHaveFocus();
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(shareButton()).toHaveFocus();
  });
});

describe("Copy picture", () => {
  const png = new Blob(["png"], { type: "image/png" });
  let draws: { op: string; args: unknown[]; fillStyle: unknown; font: unknown }[];
  let canvases: HTMLCanvasElement[];
  let downloads: { name: string; blob: Blob }[];
  let items: { data: Record<string, Promise<Blob>> }[];

  /** jsdom has no 2D canvas: a fake context that records each drawing call with the style it used. */
  function fakeCanvas() {
    draws = [];
    canvases = [];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
      canvases.push(this);
      const ctx: Record<string, unknown> = { fillStyle: "", font: "10px sans-serif" };
      const record =
        (op: string) =>
        (...args: unknown[]) =>
          void draws.push({ op, args, fillStyle: ctx.fillStyle, font: ctx.font });
      for (const op of ["fillRect", "fillText", "beginPath", "moveTo", "arcTo", "arc", "closePath", "clip", "fill", "save", "restore"])
        ctx[op] = record(op);
      ctx.measureText = (text: string) => ({ width: text.length * 0.55 * Number(/([\d.]+)px/.exec(String(ctx.font))![1]) });
      return ctx as unknown as RenderingContext;
    } as never);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) => done(png));
  }

  /** ClipboardItem and clipboard.write, which `write` decides the outcome of. */
  function fakeClipboard(write: () => Promise<void> = () => Promise.resolve()) {
    items = [];
    vi.stubGlobal(
      "ClipboardItem",
      class {
        constructor(public data: Record<string, Promise<Blob>>) {
          items.push(this);
        }
      },
    );
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { ...clipboard, write: vi.fn(write) },
      storage: { persist: () => Promise.resolve(true) },
    });
  }

  beforeEach(() => {
    fakeCanvas();
    downloads = [];
    const blobs = new Map<string, Blob>();
    URL.createObjectURL = vi.fn((blob: Blob) => {
      const url = `blob:test/${blobs.size}`;
      blobs.set(url, blob);
      return url;
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push({ name: this.download, blob: blobs.get(this.href)! });
    });
  });

  const texts = () => draws.filter((d) => d.op === "fillText").map((d) => d.args[0]);

  it("draws a 1920×1080 picture of the Groups and puts it on the clipboard as image/png", async () => {
    fakeClipboard();
    renderApp();
    shuffle();
    openShare();
    await act(async () => click(item(/^Copy picture/)));

    expect([canvases[0]!.width, canvases[0]!.height]).toEqual([1920, 1080]);
    expect(texts().slice(0, 2)).toEqual(["Period 2 groups", "18 Nov 2026"]);
    const names = cardLines().flatMap((line) => line.replace(/^Group \d: /, "").split(", "));
    expect(texts().filter((t) => names.includes(t as string))).toEqual(names);
    expect(texts()).toEqual(expect.arrayContaining(["Group 1", "Group 2", "Group 3", "· 4 students"]));

    expect(navigator.clipboard.write).toHaveBeenCalledOnce();
    expect(Object.keys(items[0]!.data)).toEqual(["image/png"]);
    await expect(items[0]!.data["image/png"]).resolves.toBe(png);
    expect(downloads).toEqual([]);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByText("Copied a picture of 3 Groups. Paste it into your slide.")).toBeInTheDocument();
  });

  it("stays light in the dark theme", async () => {
    fakeClipboard();
    renderApp();
    click(within(bar()).getByRole("button", { name: /^Theme: auto/ }));
    click(within(bar()).getByRole("button", { name: /^Theme: light/ }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    shuffle();
    openShare();
    await act(async () => click(item(/^Copy picture/)));
    expect(draws[0]).toMatchObject({ op: "fillRect", args: [0, 0, 1920, 1080], fillStyle: "#ffffff" });
    expect(draws.find((d) => d.args[0] === "Period 2 groups")!.fillStyle).toBe("#1e1f24");
  });

  it("downloads '<Roster> groups YYYY-MM-DD.png' when the browser refuses the clipboard", async () => {
    fakeClipboard(() => Promise.reject(new Error("denied")));
    renderApp();
    shuffle();
    openShare();
    await act(async () => click(item(/^Copy picture/)));
    expect(downloads).toEqual([{ name: "Period 2 groups 2026-11-18.png", blob: png }]);
    expect(screen.getByText(PICTURE_DOWNLOADED_MESSAGE)).toBeInTheDocument();
  });

  it("downloads it where there's no ClipboardItem at all", async () => {
    renderApp();
    shuffle();
    openShare();
    await act(async () => click(item(/^Copy picture/)));
    expect(downloads.map((d) => d.name)).toEqual(["Period 2 groups 2026-11-18.png"]);
    expect(screen.getByText(PICTURE_DOWNLOADED_MESSAGE)).toBeInTheDocument();
  });

  it("says so when the browser can't draw", async () => {
    fakeClipboard();
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    renderApp();
    shuffle();
    openShare();
    await act(async () => click(item(/^Copy picture/)));
    expect(navigator.clipboard.write).not.toHaveBeenCalled();
    expect(downloads).toEqual([]);
    expect(screen.getByText(PICTURE_FAILED_MESSAGE)).toBeInTheDocument();
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
