import { describe, expect, it } from "vitest";
import {
  activeSplit,
  canShuffle,
  deriveSplit,
  NEED_TWO_PRESENT_MESSAGE,
  parseSplit,
  SPLIT_GROUP_OF_ONE_MESSAGE,
  SPLIT_WHOLE_NUMBERS_MESSAGE,
  splitInputText,
  splitText,
} from "./split";

describe("deriveSplit", () => {
  it.each([
    [25, 4, [4, 4, 4, 4, 4, 5]],
    // SPEC §3 and GLOSSARY write "12×2 + 1×3", which adds up to 27; 25 is 11×2 + 1×3.
    [25, 2, [...new Array<number>(11).fill(2), 3]],
    [27, 4, [4, 4, 4, 5, 5, 5]],
    [7, 5, [7]],
    [8, 4, [4, 4]],
    [11, 4, [5, 6]],
    [2, 2, [2]],
    [3, 2, [3]],
  ])("%i Present at Target size %i", (n, t, expected) => {
    expect(deriveSplit(n, t)).toEqual(expected);
  });

  it("has no Split with fewer than 2 Present", () => {
    expect(deriveSplit(1, 4)).toEqual([]);
    expect(deriveSplit(0, 4)).toEqual([]);
    expect(canShuffle(1)).toBe(false);
    expect(canShuffle(2)).toBe(true);
  });

  it("never makes a Group of 1 or a Group smaller than the Target size", () => {
    for (let t = 2; t <= 8; t++) {
      for (let n = 2; n <= 60; n++) {
        const split = deriveSplit(n, t);
        expect(split.reduce((a, b) => a + b, 0)).toBe(n);
        expect(Math.min(...split)).toBeGreaterThanOrEqual(Math.min(n, t));
        expect(Math.max(...split) - Math.min(...split)).toBeLessThanOrEqual(1); // round-robin
        expect(split).toEqual([...split].sort((a, b) => a - b));
      }
    }
  });
});

describe("splitText", () => {
  it("counts each size, smallest first", () => {
    expect(splitText([4, 4, 5, 5, 5])).toBe("2 groups of 4, 3 groups of 5");
    expect(splitText([5, 4, 5])).toBe("1 group of 4, 2 groups of 5");
    expect(splitText([7])).toBe("1 group of 7");
    expect(splitText([])).toBe("");
  });

  it("prefills the Edit box", () => {
    expect(splitInputText([4, 4, 5])).toBe("4, 4, 5");
  });
});

describe("parseSplit", () => {
  it("accepts sizes separated by commas, spaces or +", () => {
    expect(parseSplit("4, 4, 5, 5", 18)).toEqual({ ok: true, split: [4, 4, 5, 5] });
    expect(parseSplit(" 6 6+6 ", 18)).toEqual({ ok: true, split: [6, 6, 6] });
  });

  it.each(["", "4, x", "4, 2.5", "4, 0", "4, -4", ","])("refuses %j as not whole numbers", (text) => {
    expect(parseSplit(text, 8)).toEqual({ ok: false, message: SPLIT_WHOLE_NUMBERS_MESSAGE });
  });

  it("refuses a group of 1", () => {
    expect(parseSplit("4, 3, 1", 8)).toEqual({ ok: false, message: SPLIT_GROUP_OF_ONE_MESSAGE });
  });

  it("refuses a wrong total", () => {
    expect(parseSplit("4, 4, 4, 4, 4, 4", 25)).toEqual({
      ok: false,
      message: "Those sizes add up to 24, but 25 Students are Present.",
    });
  });

  it("refuses with fewer than 2 Present", () => {
    expect(parseSplit("2", 1)).toEqual({ ok: false, message: NEED_TWO_PRESENT_MESSAGE });
    expect(NEED_TWO_PRESENT_MESSAGE).toBe("Mark at least 2 students Present.");
  });
});

describe("activeSplit", () => {
  it("uses the edited Split while it still adds up", () => {
    expect(activeSplit(10, 4, [2, 8])).toEqual([2, 8]);
    expect(activeSplit(11, 4, [2, 8])).toEqual([5, 6]);
    expect(activeSplit(10, 4, null)).toEqual([5, 5]);
  });
});
