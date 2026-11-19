// Theme preference (spec: screens.md#top-bar-one-row-fixed-height item 6): auto / light / dark, remembered per browser.

export type Theme = "auto" | "light" | "dark";

export const THEMES: readonly Theme[] = ["auto", "light", "dark"];

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** The Theme button's next choice: auto → light → dark → auto. */
export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]!;
}

/** The theme actually shown: auto follows the system (`matchMedia("(prefers-color-scheme: dark)")`). */
export function resolveTheme(theme: Theme, systemPrefersDark: boolean): "light" | "dark" {
  if (theme === "auto") return systemPrefersDark ? "dark" : "light";
  return theme;
}
