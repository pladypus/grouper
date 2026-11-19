import { describe, expect, it } from "vitest";
import { EMPTY_BOARD, type Board } from "../groups";
import { boardLayout, groupColours, GROUP_HUES, MIN_NAME_FONT_SIZE } from "../layout";
import { addStudent, newRoster, type Result, type Roster } from "../roster";
import {
  PICTURE_GAP,
  PICTURE_HEIGHT,
  PICTURE_PADDING,
  PICTURE_TITLE_HEIGHT,
  PICTURE_WIDTH,
  pictureFileName,
  pictureLayout,
  type MeasureText,
  type Picture,
  type PictureText,
} from "./picture";
import { copiedPictureMessage } from "./text";

function ok<T extends object>(result: Result<T>): T {
  if (!result.ok) throw new Error(`expected ok, got: ${result.message}`);
  return result;
}

const NAMES = "Ana Ben Cal Dee Eli Fay Gus Hal Ivy Jo Kim Lu Mo Ned Oz Pia Quin Rex Sam Tia".split(" ");
const LONG = "Maximiliana Wolfeschlegelsteinhausen";

function rosterWith(names: readonly string[]): Roster {
  let roster = newRoster("r1", "Period 2");
  for (const name of names) roster = ok(addStudent(roster, name, () => name.toLowerCase())).roster;
  return roster;
}

function boardOf(...groups: string[][]): Board {
  return {
    ...EMPTY_BOARD,
    groups: groups.map((members, i) => ({
      id: `g${i + 1}`,
      members: members.map((m) => m.toLowerCase()),
      size: members.length,
      locked: false,
      hue: GROUP_HUES[i % GROUP_HUES.length]!,
    })),
  };
}

/** Like a real font: 0.55 em per character, read from the "<weight> <size>px" font string. */
const measure: MeasureText = (text, font) => text.length * 0.55 * Number(/ ([\d.]+)px/.exec(font)![1]);
const sizeOf = (t: PictureText) => Number(/ ([\d.]+)px/.exec(t.font)![1]);

const DAY = new Date(2026, 10, 18, 9, 30);

/** 5 Groups of 4 from NAMES. */
function fiveGroups(): { board: Board; roster: Roster; picture: Picture } {
  const groups = [0, 1, 2, 3, 4].map((g) => NAMES.slice(g * 4, g * 4 + 4));
  const roster = rosterWith(NAMES);
  const board = boardOf(...groups);
  return { board, roster, picture: pictureLayout(board, roster, DAY, measure) };
}

const named = (picture: Picture, text: string) => picture.texts.find((t) => t.text === text)!;

describe("pictureLayout", () => {
  it("is 1920×1080 and always light: white paper, ink text, light Group colours", () => {
    const { picture } = fiveGroups();
    expect([picture.width, picture.height]).toEqual([1920, 1080]);
    expect(picture.background).toBe("#ffffff");
    expect(named(picture, "Ana").colour).toBe("#1e1f24");
    expect(picture.cards.map((c) => [c.header, c.tint])).toEqual(
      GROUP_HUES.slice(0, 5).map((h) => {
        const { header, tint } = groupColours(h, "light");
        return [header, tint];
      }),
    );
  });

  it("titles it '<Roster> groups' on the left with the date on the right", () => {
    const { picture } = fiveGroups();
    const title = named(picture, "Period 2 groups");
    const date = named(picture, "18 Nov 2026");
    expect(title).toMatchObject({ x: PICTURE_PADDING, align: "left" });
    expect(date).toMatchObject({ x: PICTURE_WIDTH - PICTURE_PADDING, align: "right", y: title.y });
    expect(title.maxWidth + measure(date.text, date.font)).toBeLessThan(PICTURE_WIDTH - 2 * PICTURE_PADDING);
  });

  it("lays the cards out like the board, centring an incomplete last row, all inside the picture", () => {
    const { picture } = fiveGroups();
    const areaWidth = PICTURE_WIDTH - 2 * PICTURE_PADDING;
    const top = PICTURE_PADDING + PICTURE_TITLE_HEIGHT;
    const layout = boardLayout(areaWidth, PICTURE_HEIGHT - top - PICTURE_PADDING, 5, PICTURE_GAP);
    expect(layout.columns).toBe(3);
    const [c1, c2, c3, c4, c5] = picture.cards.map((c) => ({ ...c }));
    expect(c1).toMatchObject({ x: PICTURE_PADDING, y: top, width: layout.cardWidth, height: layout.cardHeight });
    expect(c2!.x).toBeCloseTo(c1!.x + layout.cardWidth + PICTURE_GAP);
    expect(c3!.x + c3!.width).toBeCloseTo(PICTURE_WIDTH - PICTURE_PADDING);
    expect(c4!.y).toBeCloseTo(top + layout.cardHeight + PICTURE_GAP);
    // The last row's two cards sit in the middle.
    expect(c4!.x - PICTURE_PADDING).toBeCloseTo(PICTURE_WIDTH - PICTURE_PADDING - (c5!.x + c5!.width));
    expect(c5!.y + c5!.height).toBeCloseTo(PICTURE_HEIGHT - PICTURE_PADDING);
  });

  it("heads each card 'Group n · k students' and lists its names in card order inside it", () => {
    const { picture } = fiveGroups();
    expect(picture.texts.filter((t) => t.text.startsWith("Group ")).map((t) => t.text)).toEqual([
      "Group 1",
      "Group 2",
      "Group 3",
      "Group 4",
      "Group 5",
    ]);
    expect(picture.texts.filter((t) => t.text === "· 4 students")).toHaveLength(5);
    const card = picture.cards[1]!;
    const names = ["Eli", "Fay", "Gus", "Hal"].map((n) => named(picture, n));
    for (const t of names) {
      expect(t.x).toBeGreaterThan(card.x);
      expect(t.x + t.maxWidth).toBeLessThanOrEqual(card.x + card.width);
      expect(t.y).toBeGreaterThan(card.y + card.headerHeight);
      expect(t.y).toBeLessThan(card.y + card.height);
    }
    expect(names.map((t) => t.y)).toEqual([...names.map((t) => t.y)].sort((a, b) => a - b));
    // A dot in the Group's colour before each name.
    expect(picture.dots.filter((d) => d.colour === card.header)).toHaveLength(4);
  });

  it("sizes names to fit: a long name makes its card's names smaller, never below the minimum", () => {
    const roster = rosterWith([...NAMES.slice(0, 7), LONG]);
    const board = boardOf(["Ana", "Ben", "Cal", "Dee"], ["Eli", "Fay", "Gus", LONG]);
    const picture = pictureLayout(board, roster, DAY, measure);
    const short = sizeOf(named(picture, "Ana"));
    const long = named(picture, LONG);
    expect(sizeOf(long)).toBeLessThan(short);
    expect(sizeOf(long)).toBeGreaterThanOrEqual(MIN_NAME_FONT_SIZE);
    expect(sizeOf(named(picture, "Eli"))).toBe(sizeOf(long));
    expect(measure(long.text, long.font)).toBeLessThanOrEqual(long.maxWidth);
  });

  it("puts a Group of more than 6 on a wide card in two columns", () => {
    const roster = rosterWith(NAMES);
    const board = boardOf(NAMES.slice(0, 10), NAMES.slice(10));
    const picture = pictureLayout(board, roster, DAY, measure);
    const [ana, ben, cal] = ["Ana", "Ben", "Cal"].map((n) => named(picture, n));
    expect(ben!.y).toBe(ana!.y);
    expect(ben!.x).toBeGreaterThan(ana!.x);
    expect(cal!.x).toBe(ana!.x);
  });

  it("draws a single Group as one card filling the space", () => {
    const roster = rosterWith(NAMES.slice(0, 3));
    const picture = pictureLayout(boardOf(NAMES.slice(0, 3)), roster, DAY, measure);
    expect(picture.cards).toHaveLength(1);
    expect(picture.cards[0]!.width).toBe(PICTURE_WIDTH - 2 * PICTURE_PADDING);
    expect(named(picture, "· 3 students")).toBeDefined();
  });
});

describe("pictureFileName and the toast", () => {
  it("names the download '<Roster> groups YYYY-MM-DD.png'", () => {
    expect(pictureFileName(rosterWith([]), new Date(2026, 0, 5))).toBe("Period 2 groups 2026-01-05.png");
    expect(pictureFileName(newRoster("r", "Art/Design: 7"), DAY)).toBe("Art-Design- 7 groups 2026-11-18.png");
  });

  it("says how many Groups were copied", () => {
    expect(copiedPictureMessage(fiveGroups().board)).toBe("Copied a picture of 5 Groups. Paste it into your slide.");
    expect(copiedPictureMessage(boardOf(["Ana"]))).toBe("Copied a picture of 1 Group. Paste it into your slide.");
  });
});
