import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import {
  saveAppState,
  STORAGE_KEYS,
  STORAGE_UNAVAILABLE_MESSAGE,
  type AppState,
  type StorageLike,
} from "@grouper/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.svelte";

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

/** Storage that reads fine but is full: every write throws. */
class FullStorage extends MemoryStorage {
  override setItem(): void {
    throw new DOMException("full", "QuotaExceededError");
  }
}

function idGenerator() {
  let n = 0;
  return () => `id${++n}`;
}

function start(storage: StorageLike | null = new MemoryStorage()) {
  render(App, { storage, newId: idGenerator(), storageManager: null });
  return storage;
}

function seeded(state: AppState): MemoryStorage {
  const storage = new MemoryStorage();
  saveAppState(storage, state);
  return storage;
}

const student = (id: string, name: string, present = true) => ({ id, name, present });
const roster = (id: string, name: string, students: ReturnType<typeof student>[] = []) => ({
  id,
  name,
  students,
  pairs: [],
  target: 4,
});

const PERIOD_2 = roster("p2", "Period 2", [student("a", "Ana"), student("b", "Ben"), student("c", "Cal", false)]);

async function createRoster(name: string) {
  await fireEvent.input(screen.getByLabelText("Roster name"), { target: { value: name } });
  await fireEvent.click(screen.getByRole("button", { name: "Create" }));
}

async function addStudent(name: string) {
  await fireEvent.input(screen.getByLabelText("Student name"), { target: { value: name } });
  await fireEvent.click(screen.getByRole("button", { name: "Add" }));
}

async function openMenu() {
  await fireEvent.click(screen.getByRole("button", { name: "Roster options" }));
  return screen.getByRole("menu");
}

beforeEach(() => {
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("first visit", () => {
  it("offers New Roster, then opens the new Roster's Students to add names", async () => {
    start();
    expect(screen.getByRole("heading", { name: "Welcome to Grouper" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Roster" })).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "New Roster" }));
    expect(screen.getByRole("dialog", { name: "New Roster" })).toBeInTheDocument();
    await createRoster("  Period   2 ");

    expect(screen.queryByRole("dialog", { name: "New Roster" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Roster" })).toHaveDisplayValue("Period 2");
    const drawer = screen.getByRole("dialog", { name: "Students" });
    expect(within(drawer).getByRole("button", { name: "Edit list" })).toHaveAttribute("aria-pressed", "true");
  });

  it("refuses an empty Roster name", async () => {
    start();
    await fireEvent.click(screen.getByRole("button", { name: "New Roster" }));
    await createRoster("   ");
    expect(screen.getByRole("alert")).toHaveTextContent("Type a name for the Roster.");
  });
});

describe("Students drawer", () => {
  it("adds Students who start Present, refuses duplicates, and takes the roll", async () => {
    start();
    await fireEvent.click(screen.getByRole("button", { name: "New Roster" }));
    await createRoster("Period 2");

    await addStudent("Ana");
    await addStudent("Sam");
    await addStudent("Ben");
    await addStudent("  sam ");
    expect(screen.getByRole("alert")).toHaveTextContent(
      `There's already a Sam on this Roster. Tell them apart with something like "Sam B.".`,
    );
    await addStudent("Sam B.");
    const list = screen.getByRole("list", { name: "Students" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent?.replace("Remove", "").trim())).toEqual([
      "Ana",
      "Sam",
      "Ben",
      "Sam B.",
    ]);

    await fireEvent.click(screen.getByRole("button", { name: "Attendance" }));
    expect(screen.getByRole("button", { name: "Ben" })).toHaveAttribute("aria-pressed", "true");
    await fireEvent.click(screen.getByRole("button", { name: "Ben" }));
    expect(screen.getByRole("button", { name: "Ben" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/3 of 4 Present/)).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog", { name: "Students" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3/4 Present" })).toBeInTheDocument();
    expect(screen.getByText("Take the roll (✓ Present), then Shuffle.")).toBeInTheDocument();
  });

  it("opens from \"23/25 Present\" in Attendance mode", async () => {
    start(seeded({ rosters: [PERIOD_2], currentId: "p2" }));
    await fireEvent.click(screen.getByRole("button", { name: "2/3 Present" }));
    const drawer = screen.getByRole("dialog", { name: "Students" });
    expect(within(drawer).getByRole("button", { name: "Attendance" })).toHaveAttribute("aria-pressed", "true");
    expect(within(drawer).getByRole("button", { name: "Cal" })).toHaveAttribute("aria-pressed", "false");
    await fireEvent.click(within(drawer).getByRole("button", { name: "Cal" }));
    expect(screen.getByRole("button", { name: "3/3 Present" })).toBeInTheDocument();
  });

  it("renames a Student under the same uniqueness rule", async () => {
    start(seeded({ rosters: [PERIOD_2], currentId: "p2" }));
    await fireEvent.click(screen.getByRole("button", { name: "2/3 Present" }));
    await fireEvent.click(screen.getByRole("button", { name: "Edit list" }));

    await fireEvent.click(screen.getByRole("button", { name: "Rename Ben" }));
    const input = screen.getByLabelText("New name for Ben");
    await fireEvent.input(input, { target: { value: "ANA" } });
    await fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("There's already a Ana on this Roster.");

    await fireEvent.input(input, { target: { value: "Benji" } });
    await fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("button", { name: "Rename Benji" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rename Ben" })).not.toBeInTheDocument();
  });

  it("removes a Student with an Undo notice that puts them back in place", async () => {
    start(seeded({ rosters: [PERIOD_2], currentId: "p2" }));
    await fireEvent.click(screen.getByRole("button", { name: "2/3 Present" }));
    await fireEvent.click(screen.getByRole("button", { name: "Edit list" }));

    await fireEvent.click(screen.getByRole("button", { name: "Remove Ben" }));
    expect(screen.queryByRole("button", { name: "Rename Ben" })).not.toBeInTheDocument();
    expect(screen.getByText("Removed Ben.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1/2 Present" })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.queryByText("Removed Ben.")).not.toBeInTheDocument();
    const names = within(screen.getByRole("list", { name: "Students" }))
      .getAllByRole("button", { name: /^Rename / })
      .map((b) => b.getAttribute("aria-label"));
    expect(names).toEqual(["Rename Ana", "Rename Ben", "Rename Cal"]);
    expect(screen.getByRole("button", { name: "2/3 Present" })).toBeInTheDocument();
  });
});

describe("Roster menu", () => {
  it("makes, renames, switches and deletes Rosters", async () => {
    start(seeded({ rosters: [PERIOD_2], currentId: "p2" }));

    // The only Roster can't be deleted.
    let menu = await openMenu();
    const del = within(menu).getByRole("menuitem", { name: "Delete Roster" });
    expect(del).toHaveAttribute("aria-disabled", "true");
    await fireEvent.click(del);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByText("You can't delete your only Roster.").closest("[role=status]")).toBeInTheDocument();

    // Roster names are unique, compared like Student names.
    menu = await openMenu();
    await fireEvent.click(within(menu).getByRole("menuitem", { name: "New Roster" }));
    await createRoster("period 2");
    expect(screen.getByRole("alert")).toHaveTextContent(`There's already a Roster called "Period 2".`);
    await createRoster("Period 5");
    await fireEvent.click(screen.getByRole("button", { name: "Done" }));
    const picker = screen.getByRole("combobox", { name: "Roster" });
    expect(picker).toHaveDisplayValue("Period 5");
    expect(within(picker).getAllByRole("option").map((o) => o.textContent)).toEqual(["Period 2", "Period 5"]);

    menu = await openMenu();
    await fireEvent.click(within(menu).getByRole("menuitem", { name: "Rename" }));
    const name = screen.getByLabelText("Roster name");
    expect(name).toHaveValue("Period 5");
    await fireEvent.input(name, { target: { value: "Period 6" } });
    await fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    expect(picker).toHaveDisplayValue("Period 6");

    await fireEvent.change(picker, { target: { value: "p2" } });
    expect(screen.getByRole("button", { name: "2/3 Present" })).toBeInTheDocument();

    // Delete asks first; Cancel keeps the Roster.
    menu = await openMenu();
    await fireEvent.click(within(menu).getByRole("menuitem", { name: "Delete Roster" }));
    const confirm = screen.getByRole("alertdialog", { name: "Delete Roster" });
    expect(confirm).toHaveTextContent(
      `Delete "Period 2" and all its Students and pairs? Export it first if you might want it back.`,
    );
    await fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(picker).toHaveDisplayValue("Period 2");

    menu = await openMenu();
    await fireEvent.click(within(menu).getByRole("menuitem", { name: "Delete Roster" }));
    await fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete Roster" }));
    expect(within(picker).getAllByRole("option").map((o) => o.textContent)).toEqual(["Period 6"]);
    expect(picker).toHaveDisplayValue("Period 6");
  });
});

describe("storage", () => {
  it("saves every change under grouper: keys and restores it on reload", async () => {
    const storage = start() as MemoryStorage;
    await fireEvent.click(screen.getByRole("button", { name: "New Roster" }));
    await createRoster("Period 2");
    await addStudent("Ana");
    await addStudent("Ben");
    await fireEvent.click(screen.getByRole("button", { name: "Attendance" }));
    await fireEvent.click(screen.getByRole("button", { name: "Ana" }));
    await fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await fireEvent.click(await openMenu().then((m) => within(m).getByRole("menuitem", { name: "New Roster" })));
    await createRoster("Period 5");
    await fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await fireEvent.change(screen.getByRole("combobox", { name: "Roster" }), { target: { value: "id1" } });

    expect([...storage.items.keys()].every((key) => key.startsWith("grouper:"))).toBe(true);
    expect(storage.getItem(STORAGE_KEYS.schema)).toBe("1");
    expect(storage.getItem(STORAGE_KEYS.order)).toBe(JSON.stringify(["id1", "id4"]));
    expect(storage.getItem(STORAGE_KEYS.current)).toBe("id1");

    // Reload.
    cleanup();
    render(App, { storage, newId: idGenerator(), storageManager: null });
    const picker = screen.getByRole("combobox", { name: "Roster" });
    expect(picker).toHaveDisplayValue("Period 2");
    expect(within(picker).getAllByRole("option").map((o) => o.textContent)).toEqual(["Period 2", "Period 5"]);
    expect(screen.getByRole("button", { name: "1/2 Present" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps working for the session and shows the notice when storage is unavailable", async () => {
    start(null);
    expect(screen.getByRole("alert")).toHaveTextContent(STORAGE_UNAVAILABLE_MESSAGE);
    await fireEvent.click(screen.getByRole("button", { name: "New Roster" }));
    await createRoster("Period 2");
    await addStudent("Ana");
    await fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("button", { name: "1/1 Present" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(STORAGE_UNAVAILABLE_MESSAGE);
  });

  it("shows the notice when storage is full", () => {
    start(new FullStorage());
    expect(screen.getByRole("alert")).toHaveTextContent(STORAGE_UNAVAILABLE_MESSAGE);
  });

  it("asks once to keep storage, after the first Roster is saved", async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    render(App, { storage: new MemoryStorage(), newId: idGenerator(), storageManager: { persist } });
    expect(persist).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole("button", { name: "New Roster" }));
    await createRoster("Period 2");
    await addStudent("Ana");
    expect(persist).toHaveBeenCalledTimes(1);
  });
});

describe("theme", () => {
  it("cycles auto, light, dark, remembers the choice, and auto follows the system", async () => {
    let listener: (() => void) | undefined;
    const query = {
      matches: true,
      addEventListener: (_: string, fn: () => void) => (listener = fn),
      removeEventListener: () => (listener = undefined),
    };
    vi.stubGlobal("matchMedia", () => query);
    const storage = start() as MemoryStorage;

    const button = screen.getByRole("button", { name: "Theme: auto" });
    expect(document.documentElement.dataset.theme).toBe("dark");
    query.matches = false;
    listener?.();
    expect(document.documentElement.dataset.theme).toBe("light");

    await fireEvent.click(button);
    expect(button).toHaveAccessibleName("Theme: light");
    expect(listener).toBeUndefined();
    await fireEvent.click(button);
    expect(button).toHaveAccessibleName("Theme: dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(storage.getItem(STORAGE_KEYS.theme)).toBe("dark");

    cleanup();
    start(storage);
    expect(screen.getByRole("button", { name: "Theme: dark" })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Theme: dark" }));
    expect(screen.getByRole("button", { name: "Theme: auto" })).toBeInTheDocument();
  });
});
