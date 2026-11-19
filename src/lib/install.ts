// Home Screen app (SPEC §8 First visit, #8): on iOS/iPadOS Safari, before any Roster exists, tip the
// Teacher to add Grouper to the Home Screen, since a Home Screen app keeps its own storage that
// Safari can't clear. These checks are pure; the UI passes in what the browser reports.

/** SPEC §8 First visit: the iOS tip. */
export const IOS_TIP_MESSAGE =
  "Add Grouper to your Home Screen and use it from there, so Safari can't clear your Rosters.";

/** What the browser reports about itself (from `navigator` and `matchMedia`). */
export interface BrowserInfo {
  /** `navigator.userAgent`. */
  readonly userAgent: string;
  /** `navigator.maxTouchPoints`: iPadOS Safari reports a Mac user agent, but with touch. */
  readonly maxTouchPoints: number;
  /** `navigator.standalone`: true in an iOS Home Screen app. */
  readonly standalone?: boolean;
  /** `matchMedia("(display-mode: standalone)").matches`. */
  readonly displayModeStandalone: boolean;
}

// Other iOS browsers are WebKit too, but name themselves in the user agent.
const OTHER_IOS_BROWSERS = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|YaBrowser|GSA\/|DuckDuckGo|Brave/;

/** True for Safari on iPhone, iPod or iPad, including iPadOS Safari that reports itself as a Mac. */
export function isIosSafari({ userAgent, maxTouchPoints }: Pick<BrowserInfo, "userAgent" | "maxTouchPoints">): boolean {
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  return ios && /Safari\//.test(userAgent) && !OTHER_IOS_BROWSERS.test(userAgent);
}

/** True when running as a Home Screen (standalone) app. */
export function isStandalone({ standalone, displayModeStandalone }: Pick<BrowserInfo, "standalone" | "displayModeStandalone">): boolean {
  return standalone === true || displayModeStandalone;
}

/** Whether the platform calls for the iOS tip: iOS/iPadOS Safari, not already a Home Screen app. */
export function wantsIosTip(browser: BrowserInfo): boolean {
  return isIosSafari(browser) && !isStandalone(browser);
}
