import type { CurrencyCode } from "@cl/currency";
import { describe, expect, it } from "vitest";
import { createConversionTargetAmounts } from "@/components/conversion/conversion-target-amounts";
import type { ConversionResult } from "@/lib/rates";

const CONVERTED_RESULT: Extract<ConversionResult, { status: "converted" }> = {
  amount: 1,
  convertedAmount: "0.86",
  fractionDigits: 2,
  fromCurrency: "USD",
  rate: "0.86",
  sourceIndex: 0,
  status: "converted",
  toCurrency: "EUR",
};

const TARGET_CURRENCIES = ["EUR", "JPY"] satisfies readonly CurrencyCode[];

describe("createConversionTargetAmounts", () => {
  it("uses placeholders for every target when the source amount is invalid", () => {
    const amounts = createConversionTargetAmounts({
      currencyCodes: TARGET_CURRENCIES,
      loading: true,
      locale: "en",
      results: [CONVERTED_RESULT],
      sourceIsValid: false,
    });

    expect([...amounts.values()]).toEqual([
      { status: "placeholder" },
      { status: "placeholder" },
    ]);
  });

  it("uses loading states while valid conversions are pending", () => {
    const amounts = createConversionTargetAmounts({
      currencyCodes: TARGET_CURRENCIES,
      loading: true,
      locale: "en",
      results: [CONVERTED_RESULT],
      sourceIsValid: true,
    });

    expect([...amounts.values()]).toEqual([{ status: "loading" }, { status: "loading" }]);
  });

  it("formats converted results and marks missing results unavailable", () => {
    const amounts = createConversionTargetAmounts({
      currencyCodes: TARGET_CURRENCIES,
      loading: false,
      locale: "en",
      results: [CONVERTED_RESULT],
      sourceIsValid: true,
    });

    expect(amounts.get("EUR")).toEqual({
      status: "converted",
      text: "0.86",
      value: 0.86,
    });
    expect(amounts.get("JPY")).toEqual({ status: "unavailable" });
  });
});
