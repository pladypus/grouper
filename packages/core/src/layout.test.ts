import { describe, expect, it } from "vitest";
import {
  boardLayout,
  groupColours,
  groupHue,
  isPhoneWidth,
  MAX_NAME_FONT_SIZE,
  MIN_NAME_FONT_SIZE,
  nameColumns,
  nameFontSize,
} from "./layout";

describe("boardLayout", () => {
  it("picks the column count with the best card shape and fewest empty slots", () => {
    // 1600×800, 6 Groups: 3×2 gives cards ~524×393 (aspect 1.33), no empty slots.
    expect(boardLayout(1600, 800, 6)).toMatchObject({ columns: 3, rows: 2 });
    // A tall narrow board stacks.
    expect(boardLayout(400, 1600, 3)).toMatchObject({ columns: 1, rows: 3 });
    // A wide short board goes in one row.
    expect(boardLayout(2000, 300, 4)).toMatchObject({ columns: 4, rows: 1 });
  });

  it("matches the spec's score by brute force", () => {
    const score = (w: number, h: number, n: number, c: number) => {
      const r = Math.ceil(n / c);
      const cw = (w - (c - 1) * 14) / c;
      const ch = (h - (r - 1) * 14) / r;
      return Math.abs(Math.log(cw / ch / 1.2)) + 0.35 * (r * c - n);
    };
    for (const [w, h] of [[1280, 640], [1920, 960], [1024, 700], [800, 900]] as const) {
      for (let n = 1; n <= 14; n++) {
        const { columns, rows, cardWidth, cardHeight } = boardLayout(w, h, n);
        const best = Math.min(...Array.from({ length: n }, (_, i) => score(w, h, n, i + 1)));
        expect(score(w, h, n, columns)).toBeCloseTo(best);
        expect(rows).toBe(Math.ceil(n / columns));
        expect(cardWidth * columns + 14 * (columns - 1)).toBeCloseTo(w);
        expect(cardHeight * rows + 14 * (rows - 1)).toBeCloseTo(h);
      }
    }
  });

  it("copes with no Groups or no space", () => {
    expect(boardLayout(1000, 600, 0)).toMatchObject({ columns: 1, rows: 0 });
    expect(boardLayout(0, 0, 3).columns).toBe(1);
  });

  it("knows a phone", () => {
    expect(isPhoneWidth(760)).toBe(true);
    expect(isPhoneWidth(761)).toBe(false);
  });
});

describe("Group colours", () => {
  it("cycles the hues", () => {
    expect([0, 1, 9, 10].map(groupHue)).toEqual([212, 152, 320, 212]);
  });

  it("gives header and tint per theme", () => {
    expect(groupColours(212, "light")).toEqual({ header: "hsl(212 58% 40%)", tint: "hsl(212 58% 94%)" });
    expect(groupColours(212, "dark")).toEqual({ header: "hsl(212 38% 36%)", tint: "hsl(212 38% 21%)" });
  });
});

describe("names", () => {
  it("uses two columns only for more than 6 on a card wider than tall", () => {
    expect(nameColumns(7, 500, 400)).toBe(2);
    expect(nameColumns(6, 500, 400)).toBe(1);
    expect(nameColumns(7, 400, 500)).toBe(1);
  });

  it("sizes names to fit, between 15 and 46 px", () => {
    expect(nameFontSize({ cardWidth: 1000, cardHeight: 1000, memberCount: 4 })).toBe(MAX_NAME_FONT_SIZE);
    expect(nameFontSize({ cardWidth: 100, cardHeight: 100, memberCount: 9 })).toBe(MIN_NAME_FONT_SIZE);
    // 500×400, 4 names: height (400 − 76) / (4 × 1.95) ≈ 41.5; width 42.5.
    expect(nameFontSize({ cardWidth: 500, cardHeight: 400, memberCount: 4 })).toBeCloseTo(324 / 7.8);
    // A warning line takes 32 px.
    expect(nameFontSize({ cardWidth: 500, cardHeight: 400, memberCount: 4, warningLines: 1 })).toBeCloseTo(292 / 7.8);
    // Two columns halve the rows and the width per name.
    expect(nameFontSize({ cardWidth: 600, cardHeight: 400, memberCount: 8, columns: 2 })).toBeCloseTo(25.5);
  });
});
