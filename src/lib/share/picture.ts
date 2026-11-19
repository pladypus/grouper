// Share → Copy picture (spec: share.md): where everything goes on the 1920×1080 PNG. Pure: the UI hands in
// a measureText function (the canvas's), draws the result and puts it on the clipboard.

import { groupMembers, groupSizeLabel, groupTitle, type Board } from "../groups";
import {
  boardLayout,
  CARD_CHROME_HEIGHT,
  groupColours,
  MIN_NAME_FONT_SIZE,
  nameColumns,
  nameFontSize,
} from "../layout";
import type { Roster } from "../roster";
import { shareDate, shareTitle } from "./text";

/** A 16:9 picture for a slide. */
export const PICTURE_WIDTH = 1920;
export const PICTURE_HEIGHT = 1080;
/** Space around the edge, px. */
export const PICTURE_PADDING = 56;
/** Gap between cards, px. */
export const PICTURE_GAP = 24;
/** Height of the title band above the cards, px. */
export const PICTURE_TITLE_HEIGHT = 88;
/** A card's coloured header, px; the rest of the board's card chrome is the list's padding. */
export const PICTURE_HEADER_HEIGHT = 56;

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const font = (weight: number, size: number) => `${weight} ${size}px ${FONT}`;

/** Always light, whatever the theme (the app's light tokens). */
const INK = "#1e1f24";
const MUTE = "#6b6f7a";
const PAPER = "#ffffff";
const ON_COLOUR = "#ffffff";
const ON_COLOUR_SOFT = "rgba(255,255,255,0.85)";

const CARD_RADIUS = 16;
const LIST_PAD_Y = (CARD_CHROME_HEIGHT - PICTURE_HEADER_HEIGHT) / 2;
const LIST_PAD_X = 12;
const COLUMN_GAP = 12;
const DOT_RADIUS = 5;
const DOT_GAP = 12;
/** A name's chip: horizontal padding in em, and one row's height in em plus px (as on the board). */
const CHIP_PAD_EM = 0.45;
const ROW_EM = 1.64;
const ROW_GAP = 4;

/** Text width in px for a CSS font string, e.g. a canvas context's `measureText(text).width`. */
export type MeasureText = (text: string, font: string) => number;

/** Text drawn with its vertical middle at `y`. Wider than `maxWidth`, it's squeezed to fit. */
export interface PictureText {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly font: string;
  readonly colour: string;
  readonly align: "left" | "right";
  readonly maxWidth: number;
}

/** A rounded card: a coloured header band over a tinted body. */
export interface PictureCard {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
  readonly headerHeight: number;
  readonly header: string;
  readonly tint: string;
}

/** The coloured dot before each name. */
export interface PictureDot {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly colour: string;
}

export interface Picture {
  readonly width: number;
  readonly height: number;
  readonly background: string;
  readonly cards: readonly PictureCard[];
  readonly dots: readonly PictureDot[];
  readonly texts: readonly PictureText[];
}

/**
 * The picture of the Groups on screen: "Period 2 groups" and the date across the top, then the
 * Group cards laid out like the board (boardLayout, an incomplete last row centred), each in its
 * own hue's light colours with a "Group 1 · 4 students" header and its names in card order, sized to fit (nameFontSize,
 * then smaller until the longest name fits its column).
 */
export function pictureLayout(board: Board, roster: Roster, date: Date, measure: MeasureText): Picture {
  const texts: PictureText[] = [];
  const dots: PictureDot[] = [];
  const cards: PictureCard[] = [];
  const pad = PICTURE_PADDING;
  const inner = PICTURE_WIDTH - 2 * pad;

  // Title band: the title on the left, the date on the right; a long title is squeezed, not overlapped.
  const titleY = pad + 24;
  const dateFont = font(400, 32);
  const dateText = shareDate(date);
  const dateWidth = measure(dateText, dateFont);
  texts.push({
    text: shareTitle(roster),
    x: pad,
    y: titleY,
    font: font(700, 48),
    colour: INK,
    align: "left",
    maxWidth: Math.max(1, inner - dateWidth - 40),
  });
  texts.push({ text: dateText, x: PICTURE_WIDTH - pad, y: titleY, font: dateFont, colour: MUTE, align: "right", maxWidth: inner });

  const top = pad + PICTURE_TITLE_HEIGHT;
  const areaHeight = PICTURE_HEIGHT - top - pad;
  const n = board.groups.length;
  const { columns, cardWidth, cardHeight } = boardLayout(inner, areaHeight, n, PICTURE_GAP);

  board.groups.forEach((group, i) => {
    const row = Math.floor(i / columns);
    const inRow = Math.min(columns, n - row * columns);
    const offset = ((columns - inRow) * (cardWidth + PICTURE_GAP)) / 2;
    const x = pad + offset + (i % columns) * (cardWidth + PICTURE_GAP);
    const y = top + row * (cardHeight + PICTURE_GAP);
    const { header, tint } = groupColours(group.hue, "light");
    cards.push({ x, y, width: cardWidth, height: cardHeight, radius: CARD_RADIUS, headerHeight: PICTURE_HEADER_HEIGHT, header, tint });

    // Header: "Group 1" bold, then "· 4 students" smaller, as on the card.
    const headY = y + PICTURE_HEADER_HEIGHT / 2;
    const headInner = cardWidth - 2 * 16;
    const titleFont = font(800, 30);
    const title = `${groupTitle(i)} `;
    const titleWidth = Math.min(measure(title, titleFont), headInner);
    texts.push({ text: title.trimEnd(), x: x + 16, y: headY, font: titleFont, colour: ON_COLOUR, align: "left", maxWidth: headInner });
    if (headInner - titleWidth > 40) {
      texts.push({
        text: `· ${groupSizeLabel(group)}`,
        x: x + 16 + titleWidth,
        y: headY,
        font: font(600, 20),
        colour: ON_COLOUR_SOFT,
        align: "left",
        maxWidth: headInner - titleWidth,
      });
    }

    // Names, in one or two columns, centred in the space under the header.
    const names = groupMembers(board, group, roster).map((m) => m.name);
    if (names.length === 0) return;
    const cols = nameColumns(names.length, cardWidth, cardHeight);
    const columnWidth = (cardWidth - 2 * LIST_PAD_X - (cols - 1) * COLUMN_GAP) / cols;
    const room = (size: number) => columnWidth - 2 * CHIP_PAD_EM * size - 2 * DOT_RADIUS - DOT_GAP;
    const widest = (size: number) => Math.max(...names.map((name) => measure(name, font(500, size))));
    let size = nameFontSize({ cardWidth, cardHeight, memberCount: names.length, columns: cols });
    while (size > MIN_NAME_FONT_SIZE && widest(size) > room(size)) size = Math.max(MIN_NAME_FONT_SIZE, size - 0.5);

    const rows = Math.ceil(names.length / cols);
    const step = ROW_EM * size + ROW_GAP;
    const listTop = y + PICTURE_HEADER_HEIGHT + LIST_PAD_Y;
    const listHeight = cardHeight - PICTURE_HEADER_HEIGHT - 2 * LIST_PAD_Y;
    const firstY = listTop + Math.max(0, (listHeight - rows * step) / 2) + step / 2;
    names.forEach((name, j) => {
      const left = x + LIST_PAD_X + (j % cols) * (columnWidth + COLUMN_GAP) + CHIP_PAD_EM * size;
      const rowY = firstY + Math.floor(j / cols) * step;
      dots.push({ x: left + DOT_RADIUS, y: rowY, radius: DOT_RADIUS, colour: header });
      texts.push({
        text: name,
        x: left + 2 * DOT_RADIUS + DOT_GAP,
        y: rowY,
        font: font(500, size),
        colour: INK,
        align: "left",
        maxWidth: Math.max(1, room(size)),
      });
    });
  });

  return { width: PICTURE_WIDTH, height: PICTURE_HEIGHT, background: PAPER, cards, dots, texts };
}

/** "Period 2 groups 2026-11-18.png", using the Teacher's local date; characters no file system allows become "-". */
export function pictureFileName(roster: Roster, date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${shareTitle(roster).replace(/[/\\:*?"<>|]/g, "-")} ${day}.png`;
}
