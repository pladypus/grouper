import { loadTheme, nextTheme, resolveTheme, saveTheme, type StorageLike, type Theme } from "@grouper/core";
import { useLayoutEffect, useState } from "react";
// Per-icon imports: the package barrel makes Vite and Vitest compile every icon.
import Contrast from "lucide-react/icons/contrast";
import Moon from "lucide-react/icons/moon";
import Sun from "lucide-react/icons/sun";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;
}

/** Applies the resolved theme to <html data-theme>, which the `dark:` variant and tokens follow. */
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = resolveTheme(theme, systemPrefersDark());
}

/** SPEC §8 top bar item 6: auto / light / dark, remembered per browser; auto follows the system. */
export function ThemeButton({ storage }: { storage: StorageLike | null }) {
  const [theme, setTheme] = useState<Theme>(() => loadTheme(storage));

  useLayoutEffect(() => {
    applyTheme(theme);
    if (theme !== "auto" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = () => applyTheme(theme);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [theme]);

  const Icon = { auto: Contrast, light: Sun, dark: Moon }[theme];
  return (
    <button
      type="button"
      className="inline-grid size-9 place-items-center rounded-lg border border-line bg-panel hover:border-mute"
      aria-label={`Theme: ${theme}`}
      title={`Theme: ${theme} (click to change)`}
      onClick={() => {
        const next = nextTheme(theme);
        setTheme(next);
        saveTheme(storage, next);
      }}
    >
      <Icon aria-hidden="true" className="size-[18px]" />
    </button>
  );
}
