import HousePlus from "lucide-react/icons/house-plus";
import X from "lucide-react/icons/x";
import { useState } from "react";
import {
  IOS_TIP_MESSAGE,
  loadIosTipDismissed,
  saveIosTipDismissed,
  wantsIosTip,
  type BrowserInfo,
  type StorageLike,
} from "../lib";

/** What this browser reports about itself, for the iOS tip. */
export function currentBrowser(): BrowserInfo {
  const nav = globalThis.navigator as (Navigator & { standalone?: boolean }) | undefined;
  let displayModeStandalone = false;
  try {
    displayModeStandalone = globalThis.matchMedia?.("(display-mode: standalone)").matches ?? false;
  } catch {
    // No matchMedia: not standalone.
  }
  return {
    userAgent: nav?.userAgent ?? "",
    maxTouchPoints: nav?.maxTouchPoints ?? 0,
    standalone: nav?.standalone,
    displayModeStandalone,
  };
}

export interface IosTipProps {
  /** Where the dismissal is remembered. */
  storage: StorageLike | null;
  /** The browser to judge; defaults to this one. */
  browser?: BrowserInfo;
}

/**
 * spec: screens.md#first-visit (#8): in iOS/iPadOS Safari, outside the Home Screen app, a dismissible tip to
 * add Grouper to the Home Screen. Render it only while no Roster exists. Dismissed means gone for
 * good (and at least for this session if storage can't be written).
 */
export function IosTip({ storage, browser }: IosTipProps) {
  const [show, setShow] = useState(() => wantsIosTip(browser ?? currentBrowser()) && !loadIosTipDismissed(storage));
  if (!show) return null;
  return (
    <aside
      aria-label="Home Screen tip"
      className="mb-2.5 flex items-center gap-2.5 rounded-lg border border-accent bg-accent-soft py-2 pl-3.5 pr-2 text-ink"
    >
      <HousePlus aria-hidden="true" className="size-5 flex-none text-accent" />
      <p className="flex-1">{IOS_TIP_MESSAGE}</p>
      <button
        type="button"
        aria-label="Dismiss tip"
        onClick={() => {
          saveIosTipDismissed(storage);
          setShow(false);
        }}
        className="grid size-9 flex-none place-items-center rounded-md text-mute hover:bg-panel hover:text-ink"
      >
        <X aria-hidden="true" className="size-5" />
      </button>
    </aside>
  );
}
