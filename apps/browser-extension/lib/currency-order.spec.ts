import type { CurrencyCode } from "@cl/currency";
import { describe, expect, it } from "vitest";
import { compareCurrencyCodes, moveCurrencyRelative } from "@/lib/currency-order";

describe("currency order", () => {
  it("compares currency codes in ascending lexical order", () => {
    const currencyCodes = ["USD", "AED", "JPY"] as const satisfies readonly CurrencyCode[];

    expect(currencyCodes.toSorted(compareCurrencyCodes)).toEqual(["AED", "JPY", "USD"]);
    expect(compareCurrencyCodes("JPY", "JPY")).toBe(0);
  });

  it("moves currencies before and after a target without mutating the input", () => {
    const currencies = ["USD", "JPY", "EUR"] as const;

    expect(moveCurrencyRelative(currencies, "EUR", "USD", "before")).toEqual([
      "EUR",
      "USD",
      "JPY",
    ]);
    expect(moveCurrencyRelative(currencies, "USD", "JPY", "after")).toEqual([
      "JPY",
      "USD",
      "EUR",
    ]);
    expect(currencies).toEqual(["USD", "JPY", "EUR"]);
  });
});
