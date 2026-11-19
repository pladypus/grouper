// Draws Copy picture's layout (lib/share/picture.ts) on a canvas and makes the PNG (spec: share.md).

import type { MeasureText, Picture } from "./lib";

/** A rounded-rectangle path (arcTo, for browsers without `roundRect`). */
function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paint(ctx: CanvasRenderingContext2D, picture: Picture): void {
  ctx.fillStyle = picture.background;
  ctx.fillRect(0, 0, picture.width, picture.height);
  for (const card of picture.cards) {
    ctx.save();
    roundedRect(ctx, card.x, card.y, card.width, card.height, card.radius);
    ctx.clip();
    ctx.fillStyle = card.tint;
    ctx.fillRect(card.x, card.y, card.width, card.height);
    ctx.fillStyle = card.header;
    ctx.fillRect(card.x, card.y, card.width, card.headerHeight);
    ctx.restore();
  }
  for (const dot of picture.dots) {
    ctx.fillStyle = dot.colour;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.textBaseline = "middle";
  for (const t of picture.texts) {
    ctx.font = t.font;
    ctx.fillStyle = t.colour;
    ctx.textAlign = t.align;
    ctx.fillText(t.text, t.x, t.y, t.maxWidth);
  }
}

/**
 * Lays out and draws the picture on a new canvas, measuring text with the canvas itself. Null when
 * the browser has no 2D canvas. Synchronous, so the clipboard write that follows stays inside the
 * click (Safari's user-gesture rule).
 */
export function drawPicture(layout: (measure: MeasureText) => Picture): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const measure: MeasureText = (text, font) => {
    ctx.font = font;
    return ctx.measureText(text).width;
  };
  const picture = layout(measure);
  canvas.width = picture.width; // resets the context, so paint sets every style it uses
  canvas.height = picture.height;
  paint(ctx, picture);
  return canvas;
}

/** The canvas as a PNG. */
export function pngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob gave nothing"))), "image/png"),
  );
}
