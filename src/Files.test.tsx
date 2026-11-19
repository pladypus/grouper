// #20: Export, Backup and Import of Grouper files (spec: export-import.md).
import {
  addPair,
  addStudent,
  clashMessage,
  createRoster,
  EMPTY_APP_STATE,
  NEWER_VERSION_MESSAGE,
  NOT_GROUPER_FILE_MESSAGE,
  repeatedNameMessage,
  saveAppState,
  setPresent,
  SKIPPED_TITLE,
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

function sequentialIds() {
  let n = 0;
  return () => `id${++n}`;
}

/** Saved Rosters by name, each with Students and an optional Good pair between the first two. */
function saved(rosters: Record<string, string[]>, pair = false): AppState {
  let state = EMPTY_APP_STATE;
  for (const [name, students] of Object.entries(rosters)) {
    const created = createRoster(state, name, () => `r-${name}`);
    if (!created.ok) throw new Error(created.message);
    state = updateRoster(created.state, created.roster.id, (roster) => {
      for (const s of students) {
        const r = addStudent(roster, s, () => `${name}-${s}`);
        if (r.ok) roster = r.roster;
      }
      if (pair) {
        const r = addPair(roster, "good pair", roster.students[0]!.id, roster.students[1]!.id, () => `${name}-p`);
        if (r.ok) roster = r.roster;
      }
      // Attendance is browser-only: Ben is Absent here, and exports must not say so.
      const ben = roster.students.find((s) => s.name === "Ben");
      return ben ? setPresent(roster, ben.id, false) : roster;
    });
  }
  return state;
}

let storage: MemoryStorage;
let downloads: { name: string; blob: Blob }[];

function renderApp(state?: AppState) {
  if (state) saveAppState(storage, state);
  return render(<App storage={storage} newId={sequentialIds()} />);
}

function openMenuItem(name: string) {
  fireEvent.click(screen.getByRole("button", { name: "Roster options" }));
  fireEvent.click(screen.getByRole("menuitem", { name }));
}

/** Chooses a file in the (hidden) Import file picker. */
async function chooseFile(name: string, content: string) {
  const input = screen.getByLabelText<HTMLInputElement>("Import file");
  const file = new File([content], name, { type: "application/json" });
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
}

const rosterFile = (name: string, students: string[], pairs: unknown[] = [], version = 1) =>
  JSON.stringify({ grouper: "roster", version, name, exported: "2026-11-18T09:30:00.000Z", students, pairs });

beforeEach(() => {
  storage = new MemoryStorage();
  downloads = [];
  vi.stubGlobal("navigator", { ...navigator, storage: { persist: () => Promise.resolve(true) } });
  // jsdom has no object URLs and doesn't download: record what the <a download> would save.
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Export", () => {
  it("⋯ Export downloads the open Roster as <name>.grouper.json, without attendance", async () => {
    renderApp(saved({ "Period 2": ["Ana", "Ben", "Cal"] }, true));
    openMenuItem("Export");
    expect(downloads.map((d) => d.name)).toEqual(["Period 2.grouper.json"]);
    const file = JSON.parse(await downloads[0]!.blob.text());
    expect(file).toMatchObject({
      grouper: "roster",
      version: 1,
      name: "Period 2",
      students: ["Ana", "Ben", "Cal"],
      pairs: [{ type: "good pair", students: ["Ana", "Ben"] }],
    });
    expect(Object.keys(file)).toEqual(["grouper", "version", "name", "exported", "students", "pairs"]);
  });

  it("Export all Rosters downloads a dated Backup of every Roster", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 18, 14, 0));
    renderApp(saved({ "Period 2": ["Ana"], "Period 3": ["Ben"] }));
    openMenuItem("Export all Rosters");
    vi.useRealTimers();
    expect(downloads.map((d) => d.name)).toEqual(["grouper-backup-2026-11-18.json"]);
    const file = JSON.parse(await downloads[0]!.blob.text());
    expect(file.grouper).toBe("backup");
    expect(file.rosters.map((r: { name: string }) => r.name)).toEqual(["Period 2", "Period 3"]);
  });
});

describe("Import", () => {
  it("from the first-visit empty state adds the Roster, everyone Present, with a toast", async () => {
    renderApp();
    expect(screen.getByRole("heading", { name: "Welcome to Grouper" })).toBeInTheDocument();
    const pick = vi.spyOn(HTMLInputElement.prototype, "click");
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(pick).toHaveBeenCalled();
    await chooseFile(
      "Period 2.grouper.json",
      rosterFile("Period 2", ["Ana", "Ben", "Cal"], [{ type: "keep apart", students: ["Ana", "Cal"] }]),
    );
    expect(screen.getByRole("combobox", { name: "Roster" })).toHaveDisplayValue("Period 2");
    expect(screen.getByText(`Imported "Period 2": 3 Students, 1 pair.`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /3\/3 Present/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1 Pair/ })).toBeInTheDocument();
  });

  it("round-trips an exported Backup through Import", async () => {
    renderApp(saved({ "Period 2": ["Ana", "Ben"] }, true));
    openMenuItem("Export all Rosters");
    const text = await downloads[0]!.blob.text();
    openMenuItem("Import");
    await chooseFile("grouper-backup.json", text);
    fireEvent.click(screen.getByRole("button", { name: "Keep both" }));
    const picker = screen.getByRole("combobox", { name: "Roster" });
    expect(within(picker).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Period 2",
      "Period 2 (imported)",
    ]);
    expect(picker).toHaveDisplayValue("Period 2 (imported)");
    expect(screen.getByRole("button", { name: /2\/2 Present/ })).toBeInTheDocument();
  });

  it("asks one question for every clash in a Backup; Replace swaps them in place", async () => {
    const state = saved({ "Period 2": ["Ana"], "Period 3": ["Ben"], "Period 4": ["Cal"] });
    renderApp(state);
    openMenuItem("Import");
    const backup = {
      grouper: "backup",
      version: 1,
      exported: "",
      rosters: [
        { name: "Period 2", students: ["Zoe"], pairs: [] },
        { name: "period 4", students: ["Yan", "Xi"], pairs: [] },
        { name: "Period 5", students: [], pairs: [] },
      ],
    };
    await chooseFile("backup.json", JSON.stringify(backup));
    const dialogs = screen.getAllByRole("alertdialog");
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toHaveAccessibleDescription(clashMessage([state.rosters[0]!, state.rosters[2]!]));
    fireEvent.click(within(dialogs[0]!).getByRole("button", { name: "Replace" }));
    const picker = screen.getByRole("combobox", { name: "Roster" });
    expect(within(picker).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Period 2",
      "Period 3",
      "period 4",
      "Period 5",
    ]);
    expect(picker).toHaveDisplayValue("Period 2");
    expect(screen.getByRole("button", { name: /1\/1 Present/ })).toBeInTheDocument();
    expect(screen.getByText("Imported 3 Rosters: 3 Students, 0 pairs.")).toBeInTheDocument();
  });

  it("Cancel on the clash question imports nothing", async () => {
    renderApp(saved({ "Period 2": ["Ana"] }));
    openMenuItem("Import");
    await chooseFile("p.json", rosterFile("Period 2", ["Zoe"]));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(within(screen.getByRole("combobox", { name: "Roster" })).getAllByRole("option")).toHaveLength(1);
  });

  it("lists everything it skipped", async () => {
    renderApp(saved({ "Period 3": ["Ana"] }));
    openMenuItem("Import");
    await chooseFile(
      "Period 2.grouper.json",
      rosterFile(
        "Period 2",
        ["Sam", "Ana", "sam"],
        [
          { type: "good pair", students: ["Ana", "Zed"] },
          { type: "keep apart", students: ["Ana", "Sam"] },
        ],
      ),
    );
    const dialog = await screen.findByRole("dialog", { name: SKIPPED_TITLE });
    expect(within(dialog).getByRole("heading", { name: "Period 2" })).toBeInTheDocument();
    expect(within(dialog).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      repeatedNameMessage("Sam"),
      "Ana & Zed: Zed isn't on the Roster.",
    ]);
    expect(screen.getByText(`Imported "Period 2": 2 Students, 1 pair.`)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    ["a newer version", rosterFile("Period 2", ["Ana"], [], 2), NEWER_VERSION_MESSAGE],
    ["a file that isn't a Grouper file", "Ana\nBen\n", NOT_GROUPER_FILE_MESSAGE],
  ])("refuses %s with a message and adds nothing", async (_, content, message) => {
    renderApp(saved({ "Period 3": ["Ana"] }));
    openMenuItem("Import");
    await chooseFile("x.json", content);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(within(screen.getByRole("combobox", { name: "Roster" })).getAllByRole("option")).toHaveLength(1);
  });
});
