import { describe, expect, it } from "vitest";
import { isIosSafari, isStandalone, wantsIosTip, type BrowserInfo } from "./install";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  ipadMiniSafari:
    "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  // iPadOS Safari asks for desktop sites, so it reports a Mac; only touch support gives it away.
  ipadOrMacSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0.0.0 Mobile/15E148 Safari/604.1",
  iphoneFirefox:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/140.0 Mobile/15E148 Safari/605.1.15",
  // An in-app web view (no "Safari/" token).
  iphoneWebView:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
  windowsChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
};

const browser = (userAgent: string, more: Partial<BrowserInfo> = {}): BrowserInfo => ({
  userAgent,
  maxTouchPoints: 0,
  displayModeStandalone: false,
  ...more,
});

describe("isIosSafari", () => {
  it("is true for iPhone and iPad Safari", () => {
    expect(isIosSafari(browser(UA.iphoneSafari, { maxTouchPoints: 5 }))).toBe(true);
    expect(isIosSafari(browser(UA.ipadMiniSafari, { maxTouchPoints: 5 }))).toBe(true);
  });

  it("is true for iPadOS Safari reporting a Mac, but not for a Mac", () => {
    expect(isIosSafari(browser(UA.ipadOrMacSafari, { maxTouchPoints: 5 }))).toBe(true);
    expect(isIosSafari(browser(UA.ipadOrMacSafari, { maxTouchPoints: 0 }))).toBe(false);
  });

  it("is false for other iOS browsers and web views", () => {
    expect(isIosSafari(browser(UA.iphoneChrome, { maxTouchPoints: 5 }))).toBe(false);
    expect(isIosSafari(browser(UA.iphoneFirefox, { maxTouchPoints: 5 }))).toBe(false);
    expect(isIosSafari(browser(UA.iphoneWebView, { maxTouchPoints: 5 }))).toBe(false);
  });

  it("is false off Apple devices", () => {
    expect(isIosSafari(browser(UA.androidChrome, { maxTouchPoints: 5 }))).toBe(false);
    expect(isIosSafari(browser(UA.windowsChrome, { maxTouchPoints: 10 }))).toBe(false);
  });
});

describe("isStandalone", () => {
  it("follows navigator.standalone or display-mode: standalone", () => {
    expect(isStandalone({ standalone: true, displayModeStandalone: false })).toBe(true);
    expect(isStandalone({ standalone: false, displayModeStandalone: true })).toBe(true);
    expect(isStandalone({ standalone: undefined, displayModeStandalone: false })).toBe(false);
    expect(isStandalone({ standalone: false, displayModeStandalone: false })).toBe(false);
  });
});

describe("wantsIosTip", () => {
  it("wants the tip in iOS Safari, not in the Home Screen app", () => {
    const iphone = { maxTouchPoints: 5 };
    expect(wantsIosTip(browser(UA.iphoneSafari, iphone))).toBe(true);
    expect(wantsIosTip(browser(UA.iphoneSafari, { ...iphone, standalone: true }))).toBe(false);
    expect(wantsIosTip(browser(UA.iphoneSafari, { ...iphone, displayModeStandalone: true }))).toBe(false);
    expect(wantsIosTip(browser(UA.windowsChrome))).toBe(false);
  });
});
