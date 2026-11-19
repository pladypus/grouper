import { describe, expect, it } from "vitest";
import { nextTheme, resolveTheme } from "./theme";

describe("theme", () => {
  it("cycles auto → light → dark → auto", () => {
    expect(nextTheme("auto")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("auto");
  });

  it("auto follows the system", () => {
    expect(resolveTheme("auto", true)).toBe("dark");
    expect(resolveTheme("auto", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
  });
});
