import { describe, expect, it } from "vitest";
import { APP_NAME } from "./index";

describe("core", () => {
  it("names the app", () => {
    expect(APP_NAME).toBe("Grouper");
  });
});
