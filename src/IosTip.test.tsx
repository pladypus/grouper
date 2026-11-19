import { IOS_TIP_MESSAGE, STORAGE_KEYS, type StorageLike } from "./lib";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { IosTip } from "./components/IosTip";

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  failWrites = false;
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException("full", "QuotaExceededError");
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const WINDOWS_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

let storage: MemoryStorage;

/** Pretends to be a browser: its user agent, touch points, navigator.standalone and display mode. */
function stubBrowser(userAgent: string, { maxTouchPoints = 5, standalone = false, displayModeStandalone = false } = {}) {
  vi.stubGlobal("navigator", {
    ...navigator,
    userAgent,
    maxTouchPoints,
    standalone,
    storage: { persist: () => Promise.resolve(true) },
  });
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(display-mode: standalone)" && displayModeStandalone,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

const tip = () => screen.queryByRole("complementary", { name: "Home Screen tip" });
const click = (el: HTMLElement) => fireEvent.click(el);

function sequentialIds() {
  let n = 0;
  return () => `id${++n}`;
}

const renderApp = () => render(<App storage={storage} newId={sequentialIds()} />);

beforeEach(() => {
  storage = new MemoryStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("iOS Home Screen tip", () => {
  it("shows on the first visit in iPhone Safari, with the spec's wording", () => {
    stubBrowser(IPHONE_SAFARI);
    renderApp();
    expect(tip()).toHaveTextContent(IOS_TIP_MESSAGE);
    expect(IOS_TIP_MESSAGE).toBe(
      "Add Grouper to your Home Screen and use it from there, so Safari can't clear your Rosters.",
    );
  });

  it("shows in iPadOS Safari that reports itself as a Mac, but not on a Mac", () => {
    stubBrowser(MAC_SAFARI, { maxTouchPoints: 5 });
    const { unmount } = renderApp();
    expect(tip()).toBeInTheDocument();
    unmount();

    stubBrowser(MAC_SAFARI, { maxTouchPoints: 0 });
    renderApp();
    expect(tip()).not.toBeInTheDocument();
  });

  it("doesn't show off iOS", () => {
    stubBrowser(WINDOWS_CHROME, { maxTouchPoints: 0 });
    renderApp();
    expect(screen.getByRole("heading", { name: "Welcome to Grouper" })).toBeInTheDocument();
    expect(tip()).not.toBeInTheDocument();
  });

  it("doesn't show in the Home Screen app", () => {
    stubBrowser(IPHONE_SAFARI, { standalone: true });
    const { unmount } = renderApp();
    expect(tip()).not.toBeInTheDocument();
    unmount();

    stubBrowser(IPHONE_SAFARI, { displayModeStandalone: true });
    renderApp();
    expect(tip()).not.toBeInTheDocument();
  });

  it("goes away once a Roster exists and doesn't come back while one does", () => {
    stubBrowser(IPHONE_SAFARI);
    const { unmount } = renderApp();
    expect(tip()).toBeInTheDocument();
    click(screen.getByRole("button", { name: "New Roster" }));
    const dialog = screen.getByRole("dialog", { name: "New Roster" });
    fireEvent.change(within(dialog).getByLabelText("Roster name"), { target: { value: "Period 2" } });
    click(within(dialog).getByRole("button", { name: "Create" }));
    expect(tip()).not.toBeInTheDocument();

    unmount(); // a reload, with a Roster saved
    renderApp();
    expect(tip()).not.toBeInTheDocument();
  });

  it("is dismissed for good", () => {
    stubBrowser(IPHONE_SAFARI);
    const { unmount } = renderApp();
    click(within(tip()!).getByRole("button", { name: "Dismiss tip" }));
    expect(tip()).not.toBeInTheDocument();
    expect(storage.getItem(STORAGE_KEYS.iosTipDismissed)).toBe("1");

    unmount(); // a reload
    renderApp();
    expect(tip()).not.toBeInTheDocument();
  });

  it("still hides for the session when the dismissal can't be saved", () => {
    storage.failWrites = true;
    render(
      <IosTip storage={storage} browser={{ userAgent: IPHONE_SAFARI, maxTouchPoints: 5, displayModeStandalone: false }} />,
    );
    click(screen.getByRole("button", { name: "Dismiss tip" }));
    expect(tip()).not.toBeInTheDocument();
  });
});
