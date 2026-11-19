/**
 * Puts a PNG on the clipboard as `image/png`. Takes the PNG as a promise and calls
 * `clipboard.write` before anything is awaited, so Safari still counts it as part of the click.
 * Resolves to false where the browser has no ClipboardItem or refuses the write.
 */
export async function copyPng(png: Promise<Blob>): Promise<boolean> {
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") return false;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Puts plain text on the clipboard. Uses the async Clipboard API, and falls back to selecting a
 * hidden textarea and `execCommand("copy")` where that API is missing or refused (older browsers,
 * plain http). Resolves to whether the text was copied.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea.
  }
  const focused = document.activeElement as HTMLElement | null;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.opacity = "0";
  document.body.append(area);
  area.focus();
  area.select();
  let copied = false;
  try {
    copied = typeof document.execCommand === "function" && document.execCommand("copy");
  } catch {
    copied = false;
  }
  area.remove();
  focused?.focus();
  return copied;
}
