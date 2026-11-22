// Injected by Vite `define` (vite.config.ts) at build time, and when the dev server or tests start.
declare const __BUILD_COMMIT__: string | null;
declare const __BUILD_DATE__: string;

export const REPO_URL = "https://github.com/pladypus/grouper";

export interface BuildInfo {
  /** Short commit hash, or null when git wasn't available to the build. */
  commit: string | null;
  /** When the build ran (ISO 8601). */
  date: string;
}

export const BUILD_INFO: BuildInfo = { commit: __BUILD_COMMIT__, date: __BUILD_DATE__ };

/** "22 Nov 2026" */
export function formatBuildDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
