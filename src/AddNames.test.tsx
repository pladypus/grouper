// #21 Add names: paste or drop a class list into the Students drawer or the New Roster dialog.
import {
  addStudent,
  createRoster,
  EMPTY_APP_STATE,
  loadAppState,
  OUT_OF_DATE_MESSAGE,
  saveAppState,
  seededRng,
  setPresent,
  updateRoster,
  type AppState,
  type StorageLike,
} from "./lib";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { ColumnPicker } from "./components/ColumnPicker";

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

let storage: MemoryStorage;

/** Period 2 with Ana (Absent), Ben and Cal. */
function period2(): AppState {
  const r = createRoster(EMPTY_APP_STATE, "Period 2", () => "p2");
  if (!r.ok) throw new Error(r.message);
  let state = r.state;
  for (const name of ["Ana", "Ben", "Cal"]) {
    state = updateRoster(state, "p2", (roster) => {
      const added = addStudent(roster, name, () => `s-${name}`);
      if (!added.ok) throw new Error(added.message);
      return setPresent(added.roster, added.student.id, name !== "Ana");
    });
  }
  return state;
}

function renderApp(state: AppState | null = period2()) {
  if (state) saveAppState(storage, state);
  let n = 0;
  return render(<App storage={storage} newId={() => `id${++n}`} rng={seededRng(1)} />);
}

const click = (el: HTMLElement) => fireEvent.click(el);
const typeInto = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const saved = () => loadAppState(storage).state;
const savedNames = () => saved().rosters.find((r) => r.name === "Period 2")!.students.map((s) => s.name);

function openAddNames() {
  click(screen.getByRole("button", { name: /Present$/ }));
  click(screen.getByRole("button", { name: "Edit list" }));
  click(screen.getByRole("button", { name: "Add names" }));
  return screen.getByRole("form", { name: "Add names" });
}

const newNames = () => within(screen.getByRole("list", { name: "New names" })).getAllByRole("checkbox");
const newNameLabels = () => newNames().map((box) => box.closest("label")!.textContent);

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("navigator", { ...navigator, storage: { persist: () => Promise.resolve(true) } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Add names in the Students drawer", () => {
  it("pastes a list, previews it with a Skipped list, and adds the ticked names as Present Students", () => {
    renderApp();
    const form = openAddNames();
    typeInto(
      within(form).getByLabelText("Paste names"),
      "1. Dee\n- ana\n\nEli\n• Smith, Fay\nDEE\n\n",
    );

    expect(newNameLabels()).toEqual(["Dee", "Eli", "Smith, Fay"]);
    expect(newNames().every((box) => (box as HTMLInputElement).checked)).toBe(true);
    const skipped = within(screen.getByRole("region", { name: "Skipped" }));
    expect(skipped.getByText("ana (already on the Roster)")).toBeInTheDocument();
    expect(skipped.getByText("DEE (repeated in the list)")).toBeInTheDocument();
    expect(skipped.getByText("1 blank line")).toBeInTheDocument();

    // Untick Eli: left out.
    click(within(form).getByRole("checkbox", { name: "Eli" }));
    click(within(form).getByRole("button", { name: "Add 2 students" }));

    expect(screen.getByText("Added 2 students.")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Students" })).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Ana"),
      expect.stringContaining("Ben"),
      expect.stringContaining("Cal"),
      expect.stringContaining("Dee"),
      expect.stringContaining("Smith, Fay"),
    ]);
    const roster = saved().rosters[0]!;
    expect(roster.students.map((s) => [s.name, s.present])).toEqual([
      ["Ana", false],
      ["Ben", true],
      ["Cal", true],
      ["Dee", true],
      ["Smith, Fay", true],
    ]);
  });

  it("flags a line that looks like a sentence but keeps it ticked", () => {
    renderApp();
    const form = openAddNames();
    typeInto(within(form).getByLabelText("Paste names"), "Please seat Ana and Ben apart from now on\nDee");
    const flagged = within(form).getByRole("checkbox", { name: /looks like a sentence\?/ });
    expect(flagged).toBeChecked();
    expect(within(form).getByRole("button", { name: "Add 2 students" })).toBeEnabled();
  });

  it("disables Add when nothing new is ticked, and Cancel goes back to the list", () => {
    renderApp();
    const form = openAddNames();
    expect(within(form).getByRole("button", { name: "Add 0 students" })).toBeDisabled();
    typeInto(within(form).getByLabelText("Paste names"), "Ana\nBen");
    expect(within(form).getByText("No new names")).toBeInTheDocument();
    expect(within(form).getByRole("button", { name: "Add 0 students" })).toBeDisabled();
    click(within(form).getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("textbox", { name: "Student name" })).toBeInTheDocument();
    expect(savedNames()).toEqual(["Ana", "Ben", "Cal"]);
  });

  it("puts the Groups on screen out of date", () => {
    renderApp();
    click(within(screen.getByRole("banner")).getByRole("button", { name: "Shuffle" }));
    expect(screen.queryByText(OUT_OF_DATE_MESSAGE, { exact: false })).not.toBeInTheDocument();
    const form = openAddNames();
    typeInto(within(form).getByLabelText("Paste names"), "Dee\nEli");
    click(within(form).getByRole("button", { name: "Add 2 students" }));
    click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByText(OUT_OF_DATE_MESSAGE, { exact: false })).toBeInTheDocument();
  });

  it("opens the column picker for tabbed text, pre-ticking First and Last name", () => {
    renderApp();
    const form = openAddNames();
    typeInto(
      within(form).getByLabelText("Paste names"),
      "ID\tFirst name\tLast name\n101\tDee\tJones\n102\tEli\tKhan\n103\tana\t\n",
    );
    const picker = within(screen.getByRole("group", { name: "Name columns" }));
    expect(picker.getByRole("checkbox", { name: "Row 1 is a header" })).toBeChecked();
    expect(picker.getByRole("checkbox", { name: "ID" })).not.toBeChecked();
    expect(picker.getByRole("checkbox", { name: "First name" })).toBeChecked();
    expect(picker.getByRole("checkbox", { name: "Last name" })).toBeChecked();
    expect(newNameLabels()).toEqual(["Dee Jones", "Eli Khan"]);
    expect(screen.getByText("ana (already on the Roster)")).toBeInTheDocument();

    click(picker.getByRole("checkbox", { name: "Last name" }));
    expect(newNameLabels()).toEqual(["Dee", "Eli"]);

    click(within(form).getByRole("button", { name: "Add 2 students" }));
    expect(savedNames()).toEqual(["Ana", "Ben", "Cal", "Dee", "Eli"]);
  });

  it("reads a chosen .csv file through the column picker", async () => {
    renderApp();
    const form = openAddNames();
    const file = new File(["Student,Year\nDee,7\nEli,7\n"], "class.csv", { type: "text/csv" });
    await act(async () => {
      fireEvent.change(within(form).getByLabelText("Choose a .txt or .csv file"), { target: { files: [file] } });
    });
    await waitFor(() => expect(screen.getByRole("group", { name: "Name columns" })).toBeInTheDocument());
    expect(within(form).getByText(/From class\.csv/)).toBeInTheDocument();
    expect(newNameLabels()).toEqual(["Dee", "Eli"]);
  });

  it("takes a .txt dropped on the box, keeping commas inside names", async () => {
    renderApp();
    const form = openAddNames();
    const file = new File(["Jones, Dee\nKhan, Eli\n"], "late joiners.txt", { type: "text/plain" });
    await act(async () => {
      fireEvent.drop(within(form).getByLabelText("Paste names"), { dataTransfer: { files: [file], types: ["Files"] } });
    });
    await waitFor(() => expect(newNameLabels()).toEqual(["Jones, Dee", "Khan, Eli"]));
    expect(screen.queryByRole("group", { name: "Name columns" })).not.toBeInTheDocument();
  });
});

describe("New Roster dialog", () => {
  function openNewRoster() {
    click(screen.getByRole("button", { name: "New Roster" }));
    return within(screen.getByRole("dialog", { name: "New Roster" }));
  }

  it("with the box empty makes an empty Roster and opens Edit list", () => {
    renderApp(null);
    const dialog = openNewRoster();
    typeInto(dialog.getByLabelText("Roster name"), "Period 3");
    click(dialog.getByRole("button", { name: "Create" }));
    expect(saved().rosters.map((r) => [r.name, r.students.length])).toEqual([["Period 3", 0]]);
    expect(screen.getByRole("textbox", { name: "Student name" })).toBeInTheDocument();
  });

  it("with a class list shows the preview, then Create makes the Roster with the ticked names", () => {
    renderApp(null);
    const dialog = openNewRoster();
    typeInto(dialog.getByLabelText("Roster name"), "Period 3");
    typeInto(dialog.getByLabelText(/Paste your class list/), "Ana\nBen\nana\nCal");
    expect(newNameLabels()).toEqual(["Ana", "Ben", "Cal"]);
    expect(dialog.getByText("ana (repeated in the list)")).toBeInTheDocument();
    click(dialog.getByRole("checkbox", { name: "Cal" }));
    click(dialog.getByRole("button", { name: "Create" }));

    expect(screen.queryByRole("dialog", { name: "New Roster" })).not.toBeInTheDocument();
    const roster = saved().rosters[0]!;
    expect(roster.name).toBe("Period 3");
    expect(roster.students.map((s) => [s.name, s.present])).toEqual([
      ["Ana", true],
      ["Ben", true],
    ]);
    expect(screen.getByRole("button", { name: "2/2 Present" })).toBeInTheDocument();
  });

  it("keeps the class list when the Roster name is refused", () => {
    renderApp();
    const dialog = openNewRosterFromMenu();
    typeInto(dialog.getByLabelText("Roster name"), "period 2");
    typeInto(dialog.getByLabelText(/Paste your class list/), "Zed");
    click(dialog.getByRole("button", { name: "Create" }));
    expect(dialog.getByRole("alert")).toHaveTextContent(`There's already a Roster called "Period 2".`);
    expect(newNameLabels()).toEqual(["Zed"]);
  });

  function openNewRosterFromMenu() {
    click(screen.getByRole("button", { name: "Roster options" }));
    click(screen.getByRole("menuitem", { name: "New Roster" }));
    return within(screen.getByRole("dialog", { name: "New Roster" }));
  }
});

describe("ColumnPicker", () => {
  const rows = [
    ["Ana", "Smith", "7"],
    ["Ben", "Jones", "8"],
  ];

  function Harness() {
    const [columns, setColumns] = useState<number[]>([0]);
    const [header, setHeader] = useState(false);
    return (
      <>
        <ColumnPicker rows={rows} columns={columns} header={header} onColumnsChange={setColumns} onHeaderChange={setHeader} />
        <output>{JSON.stringify({ columns, header })}</output>
      </>
    );
  }

  it("names columns by number without a header, and by row 1 with one", () => {
    render(<Harness />);
    expect(screen.getByRole("checkbox", { name: "Column 1" })).toBeChecked();
    click(screen.getByRole("checkbox", { name: "Column 2" }));
    expect(screen.getByRole("status")).toHaveTextContent(`{"columns":[0,1],"header":false}`);

    click(screen.getByRole("checkbox", { name: "Row 1 is a header" }));
    expect(screen.getByRole("checkbox", { name: "Ana" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "7" })).not.toBeChecked();
    // Row 1 is no longer in the sample table.
    expect(screen.getAllByRole("cell").map((c) => c.textContent)).toEqual(["Ben", "Jones", "8"]);
  });

  it("asks for a column when none is ticked", () => {
    render(<Harness />);
    click(screen.getByRole("checkbox", { name: "Column 1" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Tick at least one column.");
  });
});
