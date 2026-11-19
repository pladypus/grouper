// Drag-to-swap glue for svelte-dnd-action (SPEC §7 Manual move). The library is a sortable list, so
// it only says which zone a drag ended in; which Student it was dropped onto comes from the pointer
// position, tracked here. The library never changes Group membership: GroupCard resets its items
// from the Board after every event, and a drop becomes a swap through the store.

import { tick } from "svelte";
import { DRAGGED_ELEMENT_ID } from "svelte-dnd-action";
import type { StudentId } from "@grouper/core";

/** Each Student's row carries this attribute (the drop target lookup reads it). */
export const STUDENT_ID_ATTRIBUTE = "data-student-id";

/** Hold this long before a touch turns into a drag, so a quick swipe still scrolls the board. */
export const TOUCH_DRAG_DELAY_MS = 200;

let pointer: { x: number; y: number } | null = null;
let stopTracking: (() => void) | null = null;

/**
 * The Student row under a point, by its box: the dragged copy that follows the pointer is skipped,
 * and the dragged Student's own (hidden) slot still counts as them.
 */
export function studentAt(x: number, y: number): StudentId | null {
  for (const row of document.querySelectorAll(`[${STUDENT_ID_ATTRIBUTE}]`)) {
    if (row.closest(`#${DRAGGED_ELEMENT_ID}`)) continue;
    const box = row.getBoundingClientRect();
    if (box.width > 0 && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) {
      return row.getAttribute(STUDENT_ID_ATTRIBUTE);
    }
  }
  return null;
}

/** From drag start: follow the mouse or finger, reporting the Student under it as it changes. */
export function trackPointer(onOver: (id: StudentId | null) => void): void {
  stopTracking?.();
  pointer = null;
  let over: StudentId | null = null;
  const move = (e: MouseEvent | TouchEvent) => {
    const point = "touches" in e ? e.touches[0] : e;
    if (!point) return;
    pointer = { x: point.clientX, y: point.clientY };
    const now = studentAt(pointer.x, pointer.y);
    if (now !== over) onOver((over = now));
  };
  window.addEventListener("mousemove", move);
  window.addEventListener("touchmove", move);
  stopTracking = () => {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("touchmove", move);
    stopTracking = null;
  };
}

/**
 * At the drop: stop tracking and return the Student the pointer was last over, or null. A drag
 * released before the pointer moved again (a touch held, then let go) ends where it started.
 */
export function finishPointer(dragged: StudentId): StudentId | null {
  stopTracking?.();
  const at = pointer;
  pointer = null;
  return at ? studentAt(at.x, at.y) : dragged;
}

/**
 * A mouse released over the row it started on would also click it (and select the Student).
 * Swallow that one click: it is dispatched in the same task as the mouseup that ended the drag.
 */
export function swallowNextClick(): void {
  const stop = (e: Event) => {
    window.removeEventListener("click", stop, { capture: true });
    if (!(e.target instanceof Element) || !e.target.closest(`[${STUDENT_ID_ATTRIBUTE}]`)) return;
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener("click", stop, { capture: true });
  setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 0);
}

/** The copy that follows the pointer: just the name on an accent pill (the same look as React's). */
export const DRAG_OVERLAY_CLASS =
  "cursor-grabbing rounded-[10px] bg-accent px-3 py-1.5 text-xl font-medium text-accent-ink shadow-lg";
/** Inline styles the library positions the copy with; every other copied style is dropped. */
const OVERLAY_KEEP = ["position", "top", "left", "transform", "z-index", "margin", "box-sizing", "transition"];

/** svelte-dnd-action's transformDraggedElement: turns its clone of the row into the name pill. */
export function styleDragOverlay(el: HTMLElement | undefined, name: string): void {
  if (!el || el.dataset.overlay) return;
  el.dataset.overlay = "true";
  for (const prop of Array.from(el.style)) {
    if (!OVERLAY_KEEP.some((keep) => prop.startsWith(keep))) el.style.removeProperty(prop);
  }
  el.removeAttribute(STUDENT_ID_ATTRIBUTE);
  el.className = DRAG_OVERLAY_CLASS;
  el.textContent = name;
}

/**
 * On a row's touchend. svelte-dnd-action holds every touch it picks up (never one that starts on a
 * button itself, like ✕) and, after a quick tap, sends its own click: stop the browser's click
 * then, or the tap would count twice.
 */
export function stopDoubleTap(e: TouchEvent): void {
  const target = e.target as (HTMLElement & { value?: unknown }) | null;
  if (!target) return;
  if (target === e.currentTarget || (target.value === undefined && !target.isContentEditable)) e.preventDefault();
}

/**
 * After a swap or ✕ redraws the cards, put keyboard focus back on that Student's name if it was
 * lost (their row may have moved to another card).
 */
export async function refocusStudent(id: StudentId | null): Promise<void> {
  if (id === null) return;
  await tick();
  const lost = !document.activeElement || document.activeElement === document.body;
  if (lost) document.querySelector<HTMLElement>(`main [${STUDENT_ID_ATTRIBUTE}="${id}"] button`)?.focus();
}
