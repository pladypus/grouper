import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";
import { AboutDialog } from "./components/AboutDialog";
import { formatBuildDate } from "./buildInfo";
import type { StorageLike } from "./lib";

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

const click = (el: HTMLElement) => fireEvent.click(el);

describe("About Grouper (spec: screens.md#about-66)", () => {
  it("opens from the last item of the ⋯ menu, takes focus, and closes with Esc or the ✕", () => {
    render(<App storage={new MemoryStorage()} newId={sequentialIds()} />);
    click(screen.getByRole("button", { name: "New Roster" }));
    const create = screen.getByRole("dialog", { name: "New Roster" });
    fireEvent.change(within(create).getByLabelText("Roster name"), { target: { value: "Period 2" } });
    click(within(create).getByRole("button", { name: "Create" }));
    click(screen.getByRole("button", { name: "Done" }));

    click(screen.getByRole("button", { name: "Roster options" }));
    const items = screen.getAllByRole("menuitem");
    expect(items.at(-1)).toHaveTextContent("About Grouper");
    click(items.at(-1)!);

    const about = screen.getByRole("dialog", { name: "About Grouper" });
    expect(about).toHaveTextContent("Random student groups for teachers.");
    expect(about).toHaveTextContent("Class lists stay in this browser.Nothing is sent to a server.");
    // Sighted Teachers see just "Grouper"; screen readers hear "About Grouper" for the heading and the dialog.
    const heading = within(about).getByRole("heading", { name: "About Grouper" });
    expect(heading.querySelector('[aria-hidden="true"]')).toHaveTextContent(/^Grouper$/);
    expect(about).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "About Grouper" })).not.toBeInTheDocument();

    click(screen.getByRole("button", { name: "Roster options" }));
    click(screen.getByRole("menuitem", { name: "About Grouper" }));
    click(within(screen.getByRole("dialog", { name: "About Grouper" })).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "About Grouper" })).not.toBeInTheDocument();
  });

  it("links to the source code in a new tab", () => {
    render(<AboutDialog onClose={() => {}} build={{ commit: "a47493d", date: "2026-11-22T10:00:00Z" }} />);
    const source = screen.getByRole("link", { name: /^Source code on GitHub/ });
    expect(source).toHaveAttribute("href", "https://github.com/pladypus/grouper");
    expect(source).toHaveAttribute("target", "_blank");
    expect(source).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows the build's commit, linked, and its date", () => {
    render(<AboutDialog onClose={() => {}} build={{ commit: "a47493d", date: "2026-11-22T10:00:00Z" }} />);
    expect(screen.getByText(/^Version/).closest("p")).toHaveTextContent("Version a47493d · built 22 Nov 2026");
    expect(screen.getByRole("link", { name: /^Commit a47493d on GitHub/ })).toHaveAttribute(
      "href",
      "https://github.com/pladypus/grouper/commit/a47493d",
    );
  });

  it("says dev when the build had no git commit", () => {
    render(<AboutDialog onClose={() => {}} build={{ commit: null, date: "2026-11-22T10:00:00Z" }} />);
    expect(screen.getByText(/^Version/).closest("p")).toHaveTextContent("Version dev · built 22 Nov 2026");
  });

  it("formats the build date in UTC", () => {
    expect(formatBuildDate("2026-01-05T23:30:00Z")).toBe("5 Jan 2026");
  });
});
