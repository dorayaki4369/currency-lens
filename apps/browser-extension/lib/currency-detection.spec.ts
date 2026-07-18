import { describe, expect, it } from "vitest";
import { currencyCodeSchema } from "./currency";
import { detectCurrencies, parseMoneyAmount } from "./currency-detection";

describe("parseMoneyAmount", () => {
  it("parses US and European separators from explicit page locales", () => {
    expect(parseMoneyAmount("1,234.56", { pageLocale: "en-US" })).toBe(1_234.56);
    expect(parseMoneyAmount("1.234,56", { pageLocale: "de-DE" })).toBe(1_234.56);
    expect(parseMoneyAmount("1.234", { pageLocale: "de-DE" })).toBe(1_234);
    expect(parseMoneyAmount("1,234", { pageLocale: "de-DE" })).toBe(1.234);
  });

  it("parses regular, non-breaking, and narrow-space grouping", () => {
    expect(parseMoneyAmount("1 234,50", { pageLocale: "fr-FR" })).toBe(1_234.5);
    expect(parseMoneyAmount("1\u00A0234,50", { pageLocale: "fr-FR" })).toBe(1_234.5);
    expect(parseMoneyAmount("1\u202F234.50", { pageLocale: "en-US" })).toBe(1_234.5);
  });

  it("rejects malformed grouping instead of parsing a trailing fragment", () => {
    expect(parseMoneyAmount("1,23,456", { pageLocale: "en-US" })).toBeNull();
    expect(parseMoneyAmount("12 34,56", { pageLocale: "fr-FR" })).toBeNull();
  });
});

describe("detectCurrencies", () => {
  it("detects code and symbol forms before and after amounts", () => {
    const detected = detectCurrencies("USD 1,234.56; 2.345,67 EUR; £3 456.78", {
      pageLocale: "en-US",
    });

    expect(detected.map(({ amount, currencyCode }) => ({ amount, currencyCode }))).toEqual([
      { amount: 1_234.56, currencyCode: "USD" },
      { amount: 2_345.67, currencyCode: "EUR" },
      { amount: 3_456.78, currencyCode: "GBP" },
    ]);
  });

  it("matches multi-character symbols before shorter suffix symbols", () => {
    const detected = detectCurrencies("R$ 1.234,56; 1\u202F234,00 zł; CA$100", {
      pageLocale: "pt-BR",
    });

    expect(detected.map(({ amount, currencyCode }) => ({ amount, currencyCode }))).toEqual([
      { amount: 1_234.56, currencyCode: "BRL" },
      { amount: 1_234, currencyCode: "PLN" },
      { amount: 100, currencyCode: "CAD" },
    ]);
  });

  it("detects country-qualified dollar symbols instead of their shorter suffix", () => {
    const detected = detectCurrencies("US$100; CA$200; AU$300");

    expect(
      detected.map(({ amount, currencyCode, originalText }) => ({
        amount,
        currencyCode,
        originalText,
      })),
    ).toEqual([
      { amount: 100, currencyCode: "USD", originalText: "US$100" },
      { amount: 200, currencyCode: "CAD", originalText: "CA$200" },
      { amount: 300, currencyCode: "AUD", originalText: "AU$300" },
    ]);
  });

  it("detects common Asia-Pacific dollar symbols", () => {
    expect(
      detectCurrencies("A$100; HK$200; NZ$300").map(({ currencyCode }) => currencyCode),
    ).toEqual(["AUD", "HKD", "NZD"]);
    expect(
      detectCurrencies("S$100; SG$200").map(({ currencyCode }) => currencyCode),
    ).toEqual(["SGD", "SGD"]);
  });

  it("resolves the ambiguous C$ symbol by locale and user override", () => {
    expect(detectCurrencies("C$100", { pageLocale: "en-CA" })[0]?.currencyCode).toBe("CAD");
    expect(detectCurrencies("C$100", { pageLocale: "es-NI" })[0]?.currencyCode).toBe("NIO");

    const symbolOverrides = { C$: currencyCodeSchema.parse("NIO") };
    expect(
      detectCurrencies("C$100", { pageLocale: "en-CA", symbolOverrides })[0]?.currencyCode,
    ).toBe("NIO");
  });

  it("does not accept suffix fragments of longer codes, symbols, or malformed amounts", () => {
    expect(
      detectCurrencies("NOTUSD 100; 100 kroner; 1,23,456 USD; invoice123 USD"),
    ).toEqual([]);
  });

  it("uses page and browser regions to resolve ambiguous symbols", () => {
    expect(
      detectCurrencies("$1,234.56", { pageLocale: "en-CA", browserLocale: "en-US" })[0]
        ?.currencyCode,
    ).toBe("CAD");
    expect(
      detectCurrencies("$1,234.56", { pageLocale: "en", browserLocale: "en-AU" })[0]
        ?.currencyCode,
    ).toBe("AUD");
  });

  it("gives a valid symbol override precedence over locale inference", () => {
    const symbolOverrides = { $: currencyCodeSchema.parse("NZD") };
    expect(
      detectCurrencies("$25.00", { pageLocale: "en-US", symbolOverrides })[0]?.currencyCode,
    ).toBe("NZD");
  });

  it("prefers an explicit code when symbol and code surround the same amount", () => {
    expect(detectCurrencies("$100 CAD", { pageLocale: "en-US" })).toEqual([
      {
        amount: 100,
        currencyCode: "CAD",
        index: 1,
        originalText: "100 CAD",
      },
    ]);
  });

  it("returns only the first three amounts in source order", () => {
    const detected = detectCurrencies("USD 1, EUR 2, GBP 3, JPY 4");
    expect(detected.map(({ currencyCode }) => currencyCode)).toEqual(["USD", "EUR", "GBP"]);
  });
});
