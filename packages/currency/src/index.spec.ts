import { describe, expect, it } from "vitest";

import { currencyMinorUnits, isCurrencyCode, isCurrencySymbol } from "./index";

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

describe("currency minor units", () => {
  it("gives each name one definition and links only to known main symbols", () => {
    const names = currencyMinorUnits.map((unit) => unit.name);
    expect(new Set(names).size).toBe(names.length);

    for (const unit of currencyMinorUnits) {
      expect(unit.symbol === undefined || isCurrencySymbol(unit.symbol), unit.name).toBe(
        true,
      );
      expect(unit.codes.length, unit.name).toBeGreaterThan(0);
    }
  });
});
