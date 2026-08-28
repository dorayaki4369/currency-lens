import { afterEach, describe, expect, it, vi } from "vitest";
import type { CurrencyCode } from "@cl/currency";
import { currencyCodeSchema } from "./currency";
import {
  RATE_STALE_AFTER_MS,
  convertCurrencyBatch,
  createExchangeRateCache,
  fetchExchangeRateCache,
  formatCurrencyAmount,
  getRateSnapshot,
  isExchangeRateCacheStale,
} from "./rates";

const SOURCE_TIMESTAMP_SECONDS = 1_700_000_000;
const SOURCE_TIMESTAMP_MS = SOURCE_TIMESTAMP_SECONDS * 1_000;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

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

describe("fetchExchangeRateCache", () => {
  it("requests and validates a successful API response", async () => {
    const fetchRates = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            base: "USD",
            rates: { USD: "1", EUR: "0.9" },
            timestamp: SOURCE_TIMESTAMP_SECONDS,
          }),
        ),
      ),
    );

    await expect(
      fetchExchangeRateCache("https://rates.example/v1/latest", fetchRates, 42),
    ).resolves.toEqual({
      base: "USD",
      rates: { USD: "1", EUR: "0.9" },
      sourceTimestamp: SOURCE_TIMESTAMP_MS,
      fetchedAt: 42,
    });
    expect(fetchRates).toHaveBeenCalledWith(
      new URL("https://rates.example/v1/latest"),
      expect.objectContaining({ method: "GET", headers: { Accept: "application/json" } }),
    );
  });

  it("rejects non-success responses before parsing their body", async () => {
    const response = new Response("unavailable", { status: 503 });
    const json = vi.spyOn(response, "json");

    await expect(
      fetchExchangeRateCache("https://rates.example/v1/latest", () =>
        Promise.resolve(response),
      ),
    ).rejects.toThrow("HTTP 503");
    expect(json).not.toHaveBeenCalled();
  });

  it("uses the global fetch implementation and current time by default", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-28T00:00:00Z"));
    const fetchRates = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            base: "USD",
            rates: { USD: "1" },
            timestamp: SOURCE_TIMESTAMP_SECONDS,
          }),
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchRates);

    const cache = await fetchExchangeRateCache("https://rates.example/v1/latest");
    expect(cache.fetchedAt).toBe(Date.now());
    expect(fetchRates).toHaveBeenCalledOnce();
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

  it("checks freshness against the current time by default", () => {
    vi.useFakeTimers();
    vi.setSystemTime(SOURCE_TIMESTAMP_MS + RATE_STALE_AFTER_MS + 1);
    expect(isExchangeRateCacheStale(makeCache())).toBe(true);
    expect(getRateSnapshot(makeCache()).isStale).toBe(true);
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

  it("supports one source with the full five-target limit", () => {
    const results = convertCurrencyBatch(
      makeCache(),
      [{ amount: 1, currencyCode: code("USD") }],
      [code("USD"), code("EUR"), code("JPY"), code("KWD"), code("BTC")],
    );

    expect(results).toHaveLength(5);
    expect(results[0]).toMatchObject({ sourceIndex: 0, toCurrency: "USD" });
    expect(results[results.length - 1]).toMatchObject({
      sourceIndex: 0,
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
        ],
        [code("EUR")],
      ),
    ).toThrow(/At most 1 amount/u);
  });

  it("rejects too many, duplicate, and invalid conversion inputs", () => {
    expect(() =>
      convertCurrencyBatch(
        makeCache(),
        [{ amount: 1, currencyCode: code("USD") }],
        [code("USD"), code("EUR"), code("JPY"), code("KWD"), code("BTC"), code("ETH")],
      ),
    ).toThrow(/At most 5 targets/u);
    expect(() =>
      convertCurrencyBatch(
        makeCache(),
        [{ amount: 1, currencyCode: code("USD") }],
        [code("EUR"), code("EUR")],
      ),
    ).toThrow(/unique/u);
    expect(() =>
      convertCurrencyBatch(
        makeCache(),
        [{ amount: Number.NaN, currencyCode: code("USD") }],
        [code("EUR")],
      ),
    ).toThrow(/positive finite/u);
    expect(() =>
      convertCurrencyBatch(
        makeCache(),
        [{ amount: 0, currencyCode: code("USD") }],
        [code("EUR")],
      ),
    ).toThrow(/positive finite/u);
  });

  it("treats invalid retained rate values as unavailable defensively", () => {
    const invalidCache = {
      ...makeCache(),
      rates: { USD: "1", EUR: "Infinity", JPY: "0" },
    } as ReturnType<typeof makeCache>;

    expect(
      convertCurrencyBatch(
        invalidCache,
        [{ amount: 1, currencyCode: code("USD") }],
        [code("EUR"), code("JPY")],
      ),
    ).toEqual([
      expect.objectContaining({ status: "unavailable", toCurrency: "EUR" }),
      expect.objectContaining({ status: "unavailable", toCurrency: "JPY" }),
    ]);
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
    expect(formatCurrencyAmount(1.2, code("XAU"))).toEqual({
      value: "1.20000000",
      fractionDigits: 8,
    });
  });

  it("rejects non-finite values", () => {
    expect(() => formatCurrencyAmount(Number.POSITIVE_INFINITY, code("USD"))).toThrow(
      /finite/u,
    );
  });

  it("normalizes exponent rates while rejecting numeric overflow", () => {
    expect(
      createExchangeRateCache({
        base: "USD",
        rates: { USD: "1", EUR: "9e-1" },
        timestamp: SOURCE_TIMESTAMP_SECONDS,
      }).rates["EUR"],
    ).toBe("9e-1");
    expect(() =>
      createExchangeRateCache({
        base: "USD",
        rates: { USD: "1", EUR: "1e9999" },
        timestamp: SOURCE_TIMESTAMP_SECONDS,
      }),
    ).toThrow(/positive finite/u);
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
