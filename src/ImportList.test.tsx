// #22: Import a .txt or .csv list as a new Roster (SPEC §12 Import item 3).
import {
  addStudent,
  clashMessage,
  createRoster,
  EMPTY_APP_STATE,
  EMPTY_NAME_LIST_MESSAGE,
  EMPTY_ROSTER_NAME_MESSAGE,
  IMPORT_LIST_TITLE,
  saveAppState,
  updateRoster,
  type AppState,
  type StorageLike,
} from "./lib";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

/** Saved Rosters by name, each with its Students. */
function saved(rosters: Record<string, string[]>): AppState {
  let state = EMPTY_APP_STATE;
  for (const [name, students] of Object.entries(rosters)) {
    const created = createRoster(state, name, () => `r-${name}`);
    if (!created.ok) throw new Error(created.message);
    state = updateRoster(created.state, created.roster.id, (roster) => {
      for (const s of students) {
        const r = addStudent(roster, s, () => `${name}-${s}`);
        if (r.ok) roster = r.roster;
      }
      return roster;
    });
  }
  return state;
}

let storage: MemoryStorage;

function renderApp(state?: AppState) {
  if (state) saveAppState(storage, state);
  return render(<App storage={storage} newId={sequentialIds()} />);
}

function openImport() {
  fireEvent.click(screen.getByRole("button", { name: "Roster options" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Import" }));
}

async function chooseFile(name: string, content: string) {
  const input = screen.getByLabelText<HTMLInputElement>("Import file");
  await act(async () => {
    fireEvent.change(input, { target: { files: [new File([content], name)] } });
  });
}

const picker = () => screen.getByRole("combobox", { name: "Roster" });
const rosterNames = () => within(picker()).getAllByRole("option").map((o) => o.textContent);
const newNames = (dialog: HTMLElement) =>
  within(within(dialog).getByRole("list", { name: "New names" }))
    .getAllByRole("checkbox")
    .map((c) => c.closest("label")!.textContent);

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("navigator", { ...navigator, storage: { persist: () => Promise.resolve(true) } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Import a .txt list", () => {
  it("accepts .txt and .csv alongside Grouper files", () => {
    renderApp();
    expect(screen.getByLabelText("Import file")).toHaveAttribute("accept", ".json,.txt,.csv");
  });

  it("from the first-visit empty state: the Add names preview, the Roster named after the file, everyone Present", async () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await chooseFile("Period 2.txt", "1. Ana\n2. Ben\n\n3. Cal\nana\n");
    const dialog = screen.getByRole("dialog", { name: IMPORT_LIST_TITLE });
    expect(within(dialog).getByRole("textbox", { name: "Roster name" })).toHaveValue("Period 2");
    expect(within(dialog).queryByRole("group", { name: "Name columns" })).not.toBeInTheDocument();
    expect(newNames(dialog)).toEqual(["Ana", "Ben", "Cal"]);
    expect(within(dialog).getByText(/repeated in the list/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Import 3 students" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(picker()).toHaveDisplayValue("Period 2");
    expect(screen.getByText(`Imported "Period 2": 3 Students, 0 pairs.`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /3\/3 Present/ })).toBeInTheDocument();
  });

  it("lets the Teacher rename the Roster and untick names; an empty name is refused", async () => {
    const user = userEvent.setup();
    renderApp(saved({ "Period 1": ["Zoe"] }));
    openImport();
    await chooseFile("class.txt", "Ana\nBen\nCal\n");
    const dialog = screen.getByRole("dialog", { name: IMPORT_LIST_TITLE });
    const name = within(dialog).getByRole("textbox", { name: "Roster name" });
    await user.clear(name);
    await user.click(within(dialog).getByRole("button", { name: "Import 3 students" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(EMPTY_ROSTER_NAME_MESSAGE);
    await user.type(name, "Year 9 Science");
    await user.click(within(dialog).getByRole("checkbox", { name: "Ben" }));
    await user.click(within(dialog).getByRole("button", { name: "Import 2 students" }));
    expect(rosterNames()).toEqual(["Period 1", "Year 9 Science"]);
    expect(picker()).toHaveDisplayValue("Year 9 Science");
    expect(screen.getByText(`Imported "Year 9 Science": 2 Students, 0 pairs.`)).toBeInTheDocument();
  });

  it("Cancel on the confirm step imports nothing", async () => {
    renderApp(saved({ "Period 1": ["Zoe"] }));
    openImport();
    await chooseFile("class.txt", "Ana\n");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(rosterNames()).toEqual(["Period 1"]);
  });

  it("refuses an empty list", async () => {
    renderApp(saved({ "Period 1": ["Zoe"] }));
    openImport();
    await chooseFile("empty.txt", "\n  \n");
    expect(await screen.findByText(EMPTY_NAME_LIST_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("a Roster name clash offers Replace or Keep both; Keep both saves it as (imported)", async () => {
    const state = saved({ "Period 2": ["Zoe"] });
    renderApp(state);
    openImport();
    await chooseFile("Period 2.txt", "Ana\nBen\n");
    fireEvent.click(screen.getByRole("button", { name: "Import 2 students" }));
    const question = screen.getByRole("alertdialog");
    expect(question).toHaveAccessibleDescription(clashMessage(state.rosters));
    fireEvent.click(within(question).getByRole("button", { name: "Keep both" }));
    expect(rosterNames()).toEqual(["Period 2", "Period 2 (imported)"]);
    expect(picker()).toHaveDisplayValue("Period 2 (imported)");
    expect(screen.getByText(`Imported "Period 2 (imported)": 2 Students, 0 pairs.`)).toBeInTheDocument();
  });
});

describe("Import a .csv list", () => {
  const csv = "Student ID,First name,Last name\n101,Ana,Lee\n102,Ben,Ng\n103,Cal,Ruiz\n";

  it("shows the column picker with a guess; ticking First and Last joins them", async () => {
    const user = userEvent.setup();
    renderApp(saved({ "Period 1": ["Zoe"] }));
    openImport();
    await chooseFile("Year 9.csv", csv);
    const dialog = screen.getByRole("dialog", { name: IMPORT_LIST_TITLE });
    const columns = within(dialog).getByRole("group", { name: "Name columns" });
    expect(within(columns).getByRole("checkbox", { name: "Row 1 is a header" })).toBeChecked();
    expect(within(dialog).getByRole("textbox", { name: "Roster name" })).toHaveValue("Year 9");
    // Whatever the guess, tick exactly First name + Last name.
    for (const column of ["Student ID", "First name", "Last name"]) {
      const box = within(columns).getByRole("checkbox", { name: column });
      if ((column !== "Student ID") !== (box as HTMLInputElement).checked) await user.click(box);
    }
    expect(newNames(dialog)).toEqual(["Ana Lee", "Ben Ng", "Cal Ruiz"]);
    await user.click(within(dialog).getByRole("button", { name: "Import 3 students" }));
    expect(picker()).toHaveDisplayValue("Year 9");
    expect(screen.getByRole("button", { name: /3\/3 Present/ })).toBeInTheDocument();
    expect(screen.getByText(`Imported "Year 9": 3 Students, 0 pairs.`)).toBeInTheDocument();
  });

  it("with no column ticked, nothing can be imported", async () => {
    const user = userEvent.setup();
    renderApp(saved({ "Period 1": ["Zoe"] }));
    openImport();
    await chooseFile("Year 9.csv", "Name\nAna\nBen\n");
    const dialog = screen.getByRole("dialog", { name: IMPORT_LIST_TITLE });
    await user.click(within(dialog).getByRole("checkbox", { name: "Name" }));
    expect(within(dialog).getByRole("button", { name: "Import 0 students" })).toBeDisabled();
  });

  it("a Roster name clash: Replace swaps the old Roster for the list", async () => {
    renderApp(saved({ "Period 1": ["Zoe"], "Year 9": ["Yan", "Xi"] }));
    openImport();
    await chooseFile("year 9.csv", "Name\nAna\nBen\nCal\n");
    fireEvent.click(screen.getByRole("button", { name: "Import 3 students" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Replace" }));
    expect(rosterNames()).toEqual(["Period 1", "year 9"]);
    expect(picker()).toHaveDisplayValue("year 9");
    expect(screen.getByRole("button", { name: /3\/3 Present/ })).toBeInTheDocument();
  });
});
