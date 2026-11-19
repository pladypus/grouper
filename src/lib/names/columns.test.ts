import { describe, expect, it } from "vitest";
import { guessHeaderRow, guessNameColumns } from ".";

describe("guessHeaderRow", () => {
  it("is true when a row-1 cell reads like a name header", () => {
    expect(guessHeaderRow([["ID", "Student Name"], ["1", "Ana"]])).toBe(true);
    expect(guessHeaderRow([["First", "SURNAME"]])).toBe(true);
    expect(guessHeaderRow([["Ana", "7"], ["Ben", "8"]])).toBe(false);
    expect(guessHeaderRow([])).toBe(false);
  });
});

describe("guessNameColumns", () => {
  it("picks a Name column by header, case-insensitively", () => {
    const rows = [
      ["Year", "name", "Email"],
      ["7", "Ana", "ana@school"],
      ["7", "Ben", "ben@school"],
    ];
    expect(guessNameColumns(rows, true)).toEqual([1]);
  });

  it("ticks First and Last together, in column order", () => {
    const rows = [
      ["Last name", "First name", "Year"],
      ["Smith", "Ana", "7"],
    ];
    expect(guessNameColumns(rows, true)).toEqual([0, 1]);
    expect(guessNameColumns([["First"], ["Ana"]], true)).toEqual([0]);
  });

  it("passes over a numeric column even if its header says Student", () => {
    const rows = [
      ["Student ID", "Student"],
      ["00123", "Ana"],
      ["00124", "Ben"],
    ];
    expect(guessNameColumns(rows, true)).toEqual([1]);
  });

  it("falls back to the column with the most distinct non-numeric values", () => {
    const rows = [
      ["1", "7B", "Ana"],
      ["2", "7B", "Ben"],
      ["3", "7B", "Cal"],
    ];
    expect(guessNameColumns(rows, false)).toEqual([2]);
    // With a header that names nothing useful, too.
    expect(guessNameColumns([["No.", "Form", "Who"], ...rows], true)).toEqual([2]);
  });

  it("takes the leftmost column on a tie and nothing for an empty table", () => {
    expect(guessNameColumns([["Ana", "Ben"]], false)).toEqual([0]);
    expect(guessNameColumns([], false)).toEqual([]);
  });
});
