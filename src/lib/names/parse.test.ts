import { describe, expect, it } from "vitest";
import {
  cleanNameLine,
  linesFromTable,
  looksLikeSentence,
  parseDelimited,
  previewNames,
  readNameSource,
  splitLines,
} from ".";

describe("cleanNameLine", () => {
  it("trims and collapses spaces, keeping case and commas", () => {
    expect(cleanNameLine("   Sam    B.  ")).toBe("Sam B.");
    expect(cleanNameLine("Smith, Ana")).toBe("Smith, Ana");
  });

  it("strips a leading list marker", () => {
    expect(cleanNameLine("1. Ana")).toBe("Ana");
    expect(cleanNameLine("12) Ben")).toBe("Ben");
    expect(cleanNameLine("- Cal")).toBe("Cal");
    expect(cleanNameLine("* Dee")).toBe("Dee");
    expect(cleanNameLine("•\tEli")).toBe("Eli");
    expect(cleanNameLine("  3.Fay")).toBe("Fay");
  });

  it("strips only one marker and leaves names that merely contain digits or dashes", () => {
    expect(cleanNameLine("1. - Ana")).toBe("- Ana");
    expect(cleanNameLine("Mary-Jane")).toBe("Mary-Jane");
    expect(cleanNameLine("Ana 2")).toBe("Ana 2");
  });

  it("leaves nothing for a blank line or a bare marker", () => {
    expect(cleanNameLine("   ")).toBe("");
    expect(cleanNameLine("-")).toBe("");
    expect(cleanNameLine("4.")).toBe("");
  });
});

describe("looksLikeSentence", () => {
  it("flags names over 40 characters", () => {
    expect(looksLikeSentence("a".repeat(40))).toBe(false);
    expect(looksLikeSentence("a".repeat(41))).toBe(true);
  });
});

describe("splitLines", () => {
  it("splits on any line ending and ignores a final newline", () => {
    expect(splitLines("Ana\r\nBen\rCal\nDee\n")).toEqual(["Ana", "Ben", "Cal", "Dee"]);
    expect(splitLines("")).toEqual([]);
  });
});

describe("readNameSource", () => {
  it("reads pasted text and .txt as one name per line, commas kept", () => {
    expect(readNameSource("Smith, Ana\nJones, Ben\n")).toEqual({ kind: "lines", lines: ["Smith, Ana", "Jones, Ben"] });
    expect(readNameSource("Smith, Ana", "class.txt")).toEqual({ kind: "lines", lines: ["Smith, Ana"] });
  });

  it("reads tabbed text as a table", () => {
    expect(readNameSource("First\tLast\nAna\tSmith\n")).toEqual({
      kind: "table",
      rows: [
        ["First", "Last"],
        ["Ana", "Smith"],
      ],
    });
  });

  it("reads a .csv as a table split on commas, or semicolons when the first line has more", () => {
    expect(readNameSource("﻿Name,Year\nAna,7\n", "Class.CSV")).toEqual({
      kind: "table",
      rows: [
        ["Name", "Year"],
        ["Ana", "7"],
      ],
    });
    expect(readNameSource("Name;Year\n\"Smith, Ana\";7", "class.csv")).toEqual({
      kind: "table",
      rows: [
        ["Name", "Year"],
        ["Smith, Ana", "7"],
      ],
    });
  });
});

describe("parseDelimited", () => {
  it("handles quoted cells with delimiters, newlines and doubled quotes", () => {
    expect(parseDelimited('a,"b, c","say ""hi""","two\nlines"\r\nd,,e\n', ",")).toEqual([
      ["a", "b, c", 'say "hi"', "two\nlines"],
      ["d", "", "e"],
    ]);
  });

  it("keeps a final row without a newline and ragged rows", () => {
    expect(parseDelimited("a\tb\nc", "\t")).toEqual([["a", "b"], ["c"]]);
  });
});

describe("linesFromTable", () => {
  const rows = [
    ["Last", "First", "Year"],
    ["Smith", "Ana", "7"],
    ["Jones", "", "7"],
    ["", ""],
  ];

  it("joins the ticked columns with a space, in column order, skipping the header", () => {
    expect(linesFromTable(rows, [1, 0], true)).toEqual(["Smith Ana", "Jones ", " "]);
    expect(linesFromTable(rows, [1], false)).toEqual(["First", "Ana", "", ""]);
  });
});

describe("previewNames", () => {
  it("lists new names once, in order, and what was skipped", () => {
    const preview = previewNames(
      ["", "1. Ana", "ben", "", "  ", "-", "Cal", "ANA", "Dee", "  ", ""],
      [{ name: "Ben" }],
    );
    expect(preview.names.map((n) => n.name)).toEqual(["Ana", "Cal", "Dee"]);
    expect(preview.names[0]).toEqual({ name: "Ana", key: "ana", flagged: false });
    expect(preview.skipped).toEqual([
      { name: "ben", reason: "on roster" },
      { name: "ANA", reason: "repeat" },
    ]);
    // Blank lines inside the list (a bare marker too), not at its ends.
    expect(preview.blankLines).toBe(3);
  });

  it("flags long lines but keeps them", () => {
    const long = "Please put Ana and Ben in different groups today";
    expect(previewNames([long], []).names).toEqual([{ name: long, key: long.toLowerCase(), flagged: true }]);
  });
});
