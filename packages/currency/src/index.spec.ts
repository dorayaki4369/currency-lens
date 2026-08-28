import { describe, expect, it } from "vitest";

import { isCurrencyCode, isCurrencySymbol } from "./index";

describe("currency metadata guards", () => {
  it("accepts supported codes and rejects unknown codes", () => {
    expect(isCurrencyCode("JPY")).toBe(true);
    expect(isCurrencyCode("NOT_A_CURRENCY")).toBe(false);
  });

  it("accepts supported symbols and rejects unknown symbols", () => {
    expect(isCurrencySymbol("¥")).toBe(true);
    expect(isCurrencySymbol("¤¤¤")).toBe(false);
  });
});
