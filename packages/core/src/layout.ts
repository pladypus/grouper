// Board layout arithmetic (SPEC §8 Board): column count from the measured space, Group colours,
// and name sizing. Pure numbers in pixels; the UI measures and applies them.

/** Group header hues in degrees, cycled by position. */
export const GROUP_HUES: readonly number[] = [212, 152, 28, 280, 350, 190, 48, 110, 250, 320];

/** The hue of the Group at this position. */
export function groupHue(index: number): number {
  return GROUP_HUES[index % GROUP_HUES.length]!;
}

/** Card colours for a hue: header `hsl(h 58% 40%)`, tint `hsl(h 58% 94%)` (dark: 38% 36% / 38% 21%). */
export function groupColours(hue: number, theme: "light" | "dark"): { header: string; tint: string } {
  return theme === "dark"
    ? { header: `hsl(${hue} 38% 36%)`, tint: `hsl(${hue} 38% 21%)` }
    : { header: `hsl(${hue} 58% 40%)`, tint: `hsl(${hue} 58% 94%)` };
}

/** Gap between cards, px. */
export const BOARD_GAP = 14;
/** At or below this viewport width the board is one column with Reshuffle pinned to the bottom. */
export const PHONE_MAX_WIDTH = 760;
/** The card shape the column choice aims for (width / height). */
export const IDEAL_CARD_ASPECT = 1.2;
/** Score penalty per empty slot in the grid. */
export const EMPTY_SLOT_PENALTY = 0.35;

export function isPhoneWidth(viewportWidth: number): boolean {
  return viewportWidth <= PHONE_MAX_WIDTH;
}

export interface BoardLayout {
  readonly columns: number;
  readonly rows: number;
  /** Card size in px (gaps taken out). */
  readonly cardWidth: number;
  readonly cardHeight: number;
}

/**
 * Picks the column count for `groupCount` cards in a measured board of `width` × `height` px: for
 * each c, r = ceil(n / c) rows, score |ln((w/h) / 1.2)| + 0.35 × (r×c − n) with w, h the card size,
 * lowest wins (ties: fewer columns). The UI centres an incomplete last row and recomputes on resize.
 * On phones (isPhoneWidth) the UI uses one column instead.
 */
export function boardLayout(width: number, height: number, groupCount: number, gap = BOARD_GAP): BoardLayout {
  const n = Math.max(0, Math.floor(groupCount));
  if (n === 0 || width <= 0 || height <= 0) {
    return { columns: 1, rows: n, cardWidth: Math.max(0, width), cardHeight: Math.max(0, height) };
  }
  let best: BoardLayout | null = null;
  let bestScore = Infinity;
  for (let c = 1; c <= n; c++) {
    const r = Math.ceil(n / c);
    const w = (width - (c - 1) * gap) / c;
    const h = (height - (r - 1) * gap) / r;
    if (w <= 0 || h <= 0) continue;
    const score = Math.abs(Math.log(w / h / IDEAL_CARD_ASPECT)) + EMPTY_SLOT_PENALTY * (r * c - n);
    if (score < bestScore) {
      bestScore = score;
      best = { columns: c, rows: r, cardWidth: w, cardHeight: h };
    }
  }
  return best ?? { columns: 1, rows: n, cardWidth: width, cardHeight: (height - (n - 1) * gap) / n };
}

/** Names go in two columns only for a Group of more than 6 on a card wider than tall. */
export function nameColumns(memberCount: number, cardWidth: number, cardHeight: number): 1 | 2 {
  return memberCount > 6 && cardWidth > cardHeight ? 2 : 1;
}

export const MIN_NAME_FONT_SIZE = 15;
export const MAX_NAME_FONT_SIZE = 46;
/** Fixed name size on phones, where cards grow to fit. */
export const PHONE_NAME_FONT_SIZE = 20;
/** Card height taken by the header and list padding, px. */
export const CARD_CHROME_HEIGHT = 76;
/** Height of one warning line at the bottom of a card, px. */
export const WARNING_LINE_HEIGHT = 32;

export interface NameSizeInput {
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly memberCount: number;
  /** Warning lines shown at the bottom of the card (flags, from #18). */
  readonly warningLines?: number;
  /** From nameColumns. */
  readonly columns?: 1 | 2;
}

/**
 * Name font size in px so the list fits the card: the smaller of 8.5% of a column's width and the
 * free height shared by max(3, rows) names at 1.95 em each, clamped to 15–46 px.
 */
export function nameFontSize({ cardWidth, cardHeight, memberCount, warningLines = 0, columns = 1 }: NameSizeInput): number {
  const rows = Math.max(3, Math.ceil(memberCount / columns));
  const byWidth = (cardWidth / columns) * 0.085;
  const byHeight = (cardHeight - CARD_CHROME_HEIGHT - warningLines * WARNING_LINE_HEIGHT) / (rows * 1.95);
  return Math.min(MAX_NAME_FONT_SIZE, Math.max(MIN_NAME_FONT_SIZE, Math.min(byWidth, byHeight)));
}
