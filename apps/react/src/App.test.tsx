import { STORAGE_KEYS, STORAGE_UNAVAILABLE_MESSAGE, type StorageLike } from "@grouper/core";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

/** An in-memory Storage; `failWrites` makes every write throw, like a full or blocked store. */
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
    if (this.failWrites) throw new DOMException("full", "QuotaExceededError");
    this.data.delete(key);
  }
}

function sequentialIds() {
  let n = 0;
  return () => `id${++n}`;
}

let storage: MemoryStorage;
let persist: ReturnType<typeof vi.fn>;

function renderApp(store: StorageLike | null = storage) {
  return render(<App storage={store} newId={sequentialIds()} />);
}

const typeInto = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } });
const click = (el: HTMLElement) => fireEvent.click(el);

function newRoster(name: string) {
  const dialog = screen.getByRole("dialog", { name: "New Roster" });
  typeInto(within(dialog).getByLabelText("Roster name"), name);
  click(within(dialog).getByRole("button", { name: "Create" }));
}

function addStudent(name: string) {
  typeInto(screen.getByRole("textbox", { name: "Student name" }), name);
  click(screen.getByRole("button", { name: "Add" }));
}

function openMenuItem(name: string) {
  click(screen.getByRole("button", { name: "Roster options" }));
  click(screen.getByRole("menuitem", { name }));
}

/** First visit → New Roster "Period 2" with Ana, Ben, Cal, then the drawer is closed. */
function setUpPeriod2() {
  const view = renderApp();
  click(screen.getByRole("button", { name: "New Roster" }));
  newRoster("Period 2");
  for (const name of ["Ana", "Ben", "Cal"]) addStudent(name);
  click(screen.getByRole("button", { name: "Done" }));
  return view;
}

beforeEach(() => {
  storage = new MemoryStorage();
  persist = vi.fn(() => Promise.resolve(true));
  vi.stubGlobal("navigator", { ...navigator, storage: { persist } });
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("first visit", () => {
  it("shows an empty state offering New Roster, which creates the Roster and opens Edit list", () => {
    renderApp();
    expect(screen.getByRole("heading", { name: "Welcome to Grouper" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Roster" })).not.toBeInTheDocument();

    click(screen.getByRole("button", { name: "New Roster" }));
    newRoster("  Period   2 ");

    expect(screen.queryByRole("dialog", { name: "New Roster" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Roster" })).toHaveDisplayValue("Period 2");
    const drawer = screen.getByRole("dialog", { name: "Students" });
    expect(within(drawer).getByRole("button", { name: "Edit list" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "0/0 Present" })).toBeInTheDocument();
  });

  it("refuses an empty Roster name", () => {
    renderApp();
    click(screen.getByRole("button", { name: "New Roster" }));
    newRoster("   ");
    expect(screen.getByRole("alert")).toHaveTextContent("Type a name for the Roster.");
    expect(screen.getByRole("dialog", { name: "New Roster" })).toBeInTheDocument();
  });
});

describe("Students drawer", () => {
  it("adds Students who start Present and refuses a duplicate with the Sam B. hint", () => {
    setUpPeriod2();
    expect(screen.getByRole("button", { name: "3/3 Present" })).toBeInTheDocument();

    click(screen.getByRole("button", { name: "3/3 Present" }));
    click(screen.getByRole("button", { name: "Edit list" }));
    addStudent(" sam ");
    addStudent("SAM");
    expect(screen.getByRole("alert")).toHaveTextContent(
      'There\'s already a sam on this Roster. Tell them apart with something like "sam B.".',
    );
    expect(screen.getByRole("textbox", { name: "Student name" })).toHaveValue("SAM");
    addStudent("Sam B.");
    const list = screen.getByRole("list", { name: "Students" });
    expect(within(list).getAllByRole("listitem").map((li) => li.firstChild?.textContent)).toEqual([
      "Ana",
      "Ben",
      "Cal",
      "sam",
      "Sam B.",
    ]);
    expect(screen.getByRole("button", { name: "5/5 Present" })).toBeInTheDocument();
  });

  it("toggles Present/Absent by tapping a name in Attendance mode", () => {
    setUpPeriod2();
    click(screen.getByRole("button", { name: "3/3 Present" }));
    const drawer = screen.getByRole("dialog", { name: "Students" });
    expect(within(drawer).getByRole("button", { name: "Attendance" })).toHaveAttribute("aria-pressed", "true");

    const ben = within(drawer).getByRole("button", { name: "Ben" });
    expect(ben).toHaveAttribute("aria-pressed", "true");
    click(ben);
    expect(ben).toHaveAttribute("aria-pressed", "false");
    expect(within(drawer).getByText(/2 of 3 Present/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2/3 Present" })).toBeInTheDocument();
    click(ben);
    expect(screen.getByRole("button", { name: "3/3 Present" })).toBeInTheDocument();
  });

  it("renames a Student, refusing a name already taken", () => {
    setUpPeriod2();
    click(screen.getByRole("button", { name: "3/3 Present" }));
    click(screen.getByRole("button", { name: "Edit list" }));

    click(screen.getByRole("button", { name: "Rename Ben" }));
    typeInto(screen.getByRole("textbox", { name: "New name for Ben" }), "ana");
    click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("There's already a Ana on this Roster.");

    typeInto(screen.getByRole("textbox", { name: "New name for Ben" }), "Benji");
    click(screen.getByRole("button", { name: "Save" }));
    expect(screen.queryByRole("textbox", { name: "New name for Ben" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Benji" })).toBeInTheDocument();
  });

  it("removes a Student with an Undo notice that puts them back in place", () => {
    setUpPeriod2();
    click(screen.getByRole("button", { name: "3/3 Present" }));
    click(screen.getByRole("button", { name: "Ben" })); // Absent
    click(screen.getByRole("button", { name: "Edit list" }));

    click(screen.getByRole("button", { name: "Remove Ben" }));
    expect(screen.queryByRole("button", { name: "Remove Ben" })).not.toBeInTheDocument();
    expect(screen.getByText("Removed Ben.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2/2 Present" })).toBeInTheDocument();

    click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.queryByText("Removed Ben.")).not.toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Students" });
    expect(within(list).getAllByRole("listitem")[1]).toHaveTextContent("Ben");
    expect(screen.getByRole("button", { name: "2/3 Present" })).toBeInTheDocument();
  });

  it("closes with Done or Escape", () => {
    setUpPeriod2();
    click(screen.getByRole("button", { name: "3/3 Present" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Students" })).not.toBeInTheDocument();
  });
});

describe("Roster menu", () => {
  it("makes, switches, renames and deletes Rosters, keeping names unique", () => {
    setUpPeriod2();
    openMenuItem("New Roster");
    newRoster("period  2");
    expect(screen.getByRole("alert")).toHaveTextContent('There\'s already a Roster called "Period 2".');
    newRoster("Period 5");
    click(screen.getByRole("button", { name: "Done" }));

    const picker = screen.getByRole("combobox", { name: "Roster" });
    expect(picker).toHaveDisplayValue("Period 5");
    expect(within(picker).getAllByRole("option").map((o) => o.textContent)).toEqual(["Period 2", "Period 5"]);
    expect(screen.getByRole("button", { name: "0/0 Present" })).toBeInTheDocument();

    fireEvent.change(picker, { target: { value: "id1" } });
    expect(picker).toHaveDisplayValue("Period 2");
    expect(screen.getByRole("button", { name: "3/3 Present" })).toBeInTheDocument();

    openMenuItem("Rename");
    const rename = screen.getByRole("dialog", { name: "Rename Roster" });
    expect(within(rename).getByLabelText("Roster name")).toHaveValue("Period 2");
    typeInto(within(rename).getByLabelText("Roster name"), "PERIOD 5");
    click(within(rename).getByRole("button", { name: "Rename" }));
    expect(within(rename).getByRole("alert")).toHaveTextContent('There\'s already a Roster called "Period 5".');
    typeInto(within(rename).getByLabelText("Roster name"), "Period 2A");
    click(within(rename).getByRole("button", { name: "Rename" }));
    expect(picker).toHaveDisplayValue("Period 2A");

    openMenuItem("Delete Roster");
    const confirm = screen.getByRole("alertdialog", { name: "Delete Roster" });
    expect(confirm).toHaveAccessibleDescription(
      'Delete "Period 2A" and all its Students and pairs? Export it first if you might want it back.',
    );
    click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(picker).toHaveDisplayValue("Period 2A");

    openMenuItem("Delete Roster");
    click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete Roster" }));
    expect(within(picker).getAllByRole("option").map((o) => o.textContent)).toEqual(["Period 5"]);
  });

  it("won't delete the only Roster", () => {
    vi.useFakeTimers();
    setUpPeriod2();
    click(screen.getByRole("button", { name: "Roster options" }));
    const item = screen.getByRole("menuitem", { name: "Delete Roster" });
    expect(item).toHaveAttribute("aria-disabled", "true");
    click(item);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByText("You can't delete your only Roster.")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByText("You can't delete your only Roster.")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Roster" })).toHaveDisplayValue("Period 2");
  });
});

describe("saving in the browser", () => {
  it("restores Rosters, attendance, order and the last-open Roster after a reload", () => {
    const { unmount } = setUpPeriod2();
    click(screen.getByRole("button", { name: "3/3 Present" }));
    click(screen.getByRole("button", { name: "Cal" })); // Absent
    click(screen.getByRole("button", { name: "Done" }));
    openMenuItem("New Roster");
    newRoster("Period 5");
    addStudent("Dee");
    click(screen.getByRole("button", { name: "Done" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Roster" }), { target: { value: "id1" } });

    expect(storage.getItem(STORAGE_KEYS.schema)).toBe("1");
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.order)!)).toEqual(["id1", "id5"]);
    expect(storage.getItem(STORAGE_KEYS.current)).toBe("id1");
    expect(persist).toHaveBeenCalledTimes(1);

    unmount(); // a reload
    renderApp();
    const picker = screen.getByRole("combobox", { name: "Roster" });
    expect(picker).toHaveDisplayValue("Period 2");
    expect(within(picker).getAllByRole("option").map((o) => o.textContent)).toEqual(["Period 2", "Period 5"]);
    expect(screen.getByRole("button", { name: "2/3 Present" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps working for the session and shows the notice when storage is full", () => {
    storage.failWrites = true;
    renderApp();
    expect(screen.getByRole("alert")).toHaveTextContent(STORAGE_UNAVAILABLE_MESSAGE);
    click(screen.getByRole("button", { name: "New Roster" }));
    newRoster("Period 2");
    addStudent("Ana");
    expect(screen.getByRole("button", { name: "1/1 Present" })).toBeInTheDocument();
    expect(screen.getByText(STORAGE_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
    expect(persist).not.toHaveBeenCalled();
  });

  it("shows the notice when there is no storage at all", () => {
    renderApp(null);
    expect(screen.getByRole("alert")).toHaveTextContent(STORAGE_UNAVAILABLE_MESSAGE);
  });
});

describe("theme button", () => {
  it("cycles auto, light, dark, remembers the choice, and auto follows the system", () => {
    let listener: (() => void) | undefined;
    const query = {
      matches: true,
      addEventListener: (_: string, fn: () => void) => (listener = fn),
      removeEventListener: () => (listener = undefined),
    };
    vi.stubGlobal("matchMedia", () => query);

    const { unmount } = renderApp();
    const button = screen.getByRole("button", { name: "Theme: auto" });
    expect(document.documentElement.dataset.theme).toBe("dark");
    query.matches = false;
    act(() => listener?.());
    expect(document.documentElement.dataset.theme).toBe("light");

    click(button);
    expect(button).toHaveAccessibleName("Theme: light");
    expect(storage.getItem(STORAGE_KEYS.theme)).toBe("light");
    expect(listener).toBeUndefined();

    click(button);
    expect(button).toHaveAccessibleName("Theme: dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    unmount(); // a reload
    renderApp();
    expect(screen.getByRole("button", { name: "Theme: dark" })).toBeInTheDocument();
    click(screen.getByRole("button", { name: "Theme: dark" }));
    expect(screen.getByRole("button", { name: "Theme: auto" })).toBeInTheDocument();
    expect(storage.getItem(STORAGE_KEYS.theme)).toBe("auto");
  });
});
