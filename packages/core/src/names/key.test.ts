import { describe, expect, it } from "vitest";
import { duplicateStudentMessage, findByName, nameKey, normaliseName, sameName } from ".";

describe("normaliseName", () => {
  it("trims and collapses inner whitespace, keeping case", () => {
    expect(normaliseName("  Sam   \t B.  ")).toBe("Sam B.");
    expect(normaliseName("Ana\nDee")).toBe("Ana Dee");
  });
});

describe("nameKey", () => {
  it("is lower-case, trimmed and collapsed", () => {
    expect(nameKey("  SAM   b. ")).toBe("sam b.");
  });

  it("treats names differing only in case and spacing as the same", () => {
    expect(sameName("sam ", "Sam")).toBe(true);
    expect(sameName("Sam  B.", "sam b.")).toBe(true);
    expect(sameName("Sam", "Sam B.")).toBe(false);
  });
});

describe("findByName", () => {
  const items = [
    { id: "1", name: "Sam" },
    { id: "2", name: "Ana" },
  ];

  it("finds an item with the same key", () => {
    expect(findByName(items, " SAM ")?.id).toBe("1");
    expect(findByName(items, "Ben")).toBeUndefined();
  });

  it("skips the excepted id", () => {
    expect(findByName(items, "sam", "1")).toBeUndefined();
  });
});

describe("duplicateStudentMessage", () => {
  it("uses the spec's wording", () => {
    expect(duplicateStudentMessage("Sam")).toBe(
      `There's already a Sam on this Roster. Tell them apart with something like "Sam B.".`,
    );
  });
});
