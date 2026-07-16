import { describe, expect, it } from "vitest";
import type { CurrencyCode } from "@cl/currency";
import { currencyCodeSchema } from "./currency";
import {
  RATE_STALE_AFTER_MS,
  convertCurrencyBatch,
  createExchangeRateCache,
  formatCurrencyAmount,
  getRateSnapshot,
} from "./rates";

const SOURCE_TIMESTAMP_SECONDS = 1_700_000_000;
const SOURCE_TIMESTAMP_MS = SOURCE_TIMESTAMP_SECONDS * 1_000;

describe("createExchangeRateCache", () => {
  it("validates API data and preserves source and fetch timestamps separately", () => {
    const cache = createExchangeRateCache(
      {
        base: "USD",
        rates: { USD: 1, EUR: "0.9", JPY: 150 },
        timestamp: SOURCE_TIMESTAMP_SECONDS,
      },
      SOURCE_TIMESTAMP_MS + 5_000,
    );

    expect(cache).toEqual({
      base: "USD",
      rates: { USD: "1", EUR: "0.9", JPY: "150" },
      sourceTimestamp: SOURCE_TIMESTAMP_MS,
      fetchedAt: SOURCE_TIMESTAMP_MS + 5_000,
    });
  });

  it("rejects invalid API rates before they can replace a last-good cache", () => {
    expect(() =>
      createExchangeRateCache({
        base: "USD",
        rates: { USD: "1", EUR: "not-a-rate" },
        timestamp: SOURCE_TIMESTAMP_SECONDS,
      }),
    ).toThrow();
  });

  it("rejects a missing or non-unit base rate instead of silently repairing it", () => {
    expect(() =>
      createExchangeRateCache({
        base: "USD",
        rates: { EUR: "0.5" },
        timestamp: SOURCE_TIMESTAMP_SECONDS,
      }),
    ).toThrow(/base currency rate/u);
    expect(() =>
      createExchangeRateCache({
        base: "USD",
        rates: { USD: "2", EUR: "1" },
        timestamp: SOURCE_TIMESTAMP_SECONDS,
      }),
    ).toThrow(/base currency rate/u);
  });
});

describe("getRateSnapshot", () => {
  it("warns only after source data exceeds 24 hours", () => {
    const cache = makeCache();

    expect(getRateSnapshot(cache, SOURCE_TIMESTAMP_MS + RATE_STALE_AFTER_MS).isStale).toBe(
      false,
    );
    expect(
      getRateSnapshot(cache, SOURCE_TIMESTAMP_MS + RATE_STALE_AFTER_MS + 1),
    ).toMatchObject({
      isStale: true,
      warnings: [{ code: "RATES_STALE" }],
    });
  });
});

describe("convertCurrencyBatch", () => {
  it("uses fiat minor units and capped crypto precision", () => {
    const cache = makeCache();
    const results = convertCurrencyBatch(
      cache,
      [{ amount: 123.45, currencyCode: code("USD") }],
      [code("JPY"), code("KWD"), code("BTC"), code("ETH")],
    );

    expect(results).toEqual([
      expect.objectContaining({
        status: "converted",
        toCurrency: "JPY",
        convertedAmount: "18518",
        fractionDigits: 0,
      }),
      expect.objectContaining({
        status: "converted",
        toCurrency: "KWD",
        convertedAmount: "37.035",
        fractionDigits: 3,
      }),
      expect.objectContaining({
        status: "converted",
        toCurrency: "BTC",
        convertedAmount: "0.00185175",
        fractionDigits: 8,
      }),
      expect.objectContaining({
        status: "converted",
        toCurrency: "ETH",
        convertedAmount: "0.061725",
        fractionDigits: 8,
      }),
    ]);
  });

  it("returns explicit unavailable entries without discarding other conversions", () => {
    const results = convertCurrencyBatch(
      makeCache(),
      [{ amount: 10, currencyCode: code("USD") }],
      [code("EUR"), code("CAD")],
    );

    expect(results[0]).toMatchObject({ status: "converted", toCurrency: "EUR" });
    expect(results[1]).toEqual({
      status: "unavailable",
      sourceIndex: 0,
      amount: 10,
      fromCurrency: "USD",
      toCurrency: "CAD",
      reason: "RATE_UNAVAILABLE",
    });
  });

  it("supports the full three-by-five conversion limit", () => {
    const results = convertCurrencyBatch(
      makeCache(),
      [
        { amount: 1, currencyCode: code("USD") },
        { amount: 2, currencyCode: code("EUR") },
        { amount: 3, currencyCode: code("JPY") },
      ],
      [code("USD"), code("EUR"), code("JPY"), code("KWD"), code("BTC")],
    );

    expect(results).toHaveLength(15);
    expect(results[0]).toMatchObject({ sourceIndex: 0, toCurrency: "USD" });
    expect(results[results.length - 1]).toMatchObject({
      sourceIndex: 2,
      toCurrency: "BTC",
    });
  });

  it("rejects a batch beyond the public limits", () => {
    expect(() =>
      convertCurrencyBatch(
        makeCache(),
        [
          { amount: 1, currencyCode: code("USD") },
          { amount: 2, currencyCode: code("USD") },
          { amount: 3, currencyCode: code("USD") },
          { amount: 4, currencyCode: code("USD") },
        ],
        [code("EUR")],
      ),
    ).toThrow(/At most 3 amounts/u);
  });
});

describe("formatCurrencyAmount", () => {
  it("retains fixed fiat digits while trimming insignificant crypto zeros", () => {
    expect(formatCurrencyAmount(1.2, code("USD"))).toEqual({
      value: "1.20",
      fractionDigits: 2,
    });
    expect(formatCurrencyAmount(1.2, code("CNH"))).toEqual({
      value: "1.20",
      fractionDigits: 2,
    });
    expect(formatCurrencyAmount(1.2, code("BTC"))).toEqual({
      value: "1.2",
      fractionDigits: 8,
    });
  });
});

/** Parses a fixture code through the same runtime schema as production boundaries. */
function code(value: string): CurrencyCode {
  return currencyCodeSchema.parse(value);
}

/** Creates a representative validated cache for conversion tests. */
function makeCache() {
  return createExchangeRateCache(
    {
      base: "USD",
      rates: {
        USD: "1",
        EUR: "0.9",
        JPY: "150",
        KWD: "0.3",
        BTC: "0.000015",
        ETH: "0.0005",
      },
      timestamp: SOURCE_TIMESTAMP_SECONDS,
    },
    SOURCE_TIMESTAMP_MS + 5_000,
  );
}
