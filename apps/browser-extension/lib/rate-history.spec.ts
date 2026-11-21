import { describe, expect, it, vi } from "vitest";
import {
  createRateHistoryCache,
  fetchRateHistory,
  getRateHistoryKey,
  getRateHistorySymbols,
  rateHistoryQuerySchema,
  rateHistorySchema,
  type RateHistory,
} from "@/lib/rate-history";

const ENDPOINT = "https://cl.dryk.net/v1/history";
const DAILY_HISTORY: RateHistory = {
  base: "USD",
  resolution: "daily",
  start: "2025-11-21T00:00:00.000Z",
  rates: { JPY: [149.1, null, 149.5], EUR: [0.86, 0.87, null] },
};

describe("rate history schema", () => {
  it("accepts the Worker's documented response", () => {
    expect(rateHistorySchema.parse(DAILY_HISTORY)).toEqual(DAILY_HISTORY);
    expect(rateHistorySchema.parse({ ...DAILY_HISTORY, rates: {} }).rates).toEqual({});
  });

  it.each([
    ["a non-USD base", { ...DAILY_HISTORY, base: "EUR" }],
    ["an unknown resolution", { ...DAILY_HISTORY, resolution: "weekly" }],
    ["a start that is not a timestamp", { ...DAILY_HISTORY, start: "yesterday" }],
    ["an extra field", { ...DAILY_HISTORY, timestamp: 1 }],
    ["a non-positive rate", { ...DAILY_HISTORY, rates: { JPY: [0] } }],
    ["an empty series", { ...DAILY_HISTORY, rates: { JPY: [] } }],
    ["a lowercase code", { ...DAILY_HISTORY, rates: { jpy: [1] } }],
    ["series of different lengths", { ...DAILY_HISTORY, rates: { JPY: [1], EUR: [1, 2] } }],
  ])("rejects %s", (_name, body) => {
    expect(rateHistorySchema.safeParse(body).success).toBe(false);
  });

  it("limits queries to one to six unique supported codes", () => {
    expect(isValidQuery(["JPY"])).toBe(true);
    expect(isValidQuery(["JPY", "EUR", "GBP", "CAD", "AUD", "CHF"])).toBe(true);
    expect(isValidQuery([])).toBe(false);
    expect(isValidQuery(["JPY", "EUR", "GBP", "CAD", "AUD", "CHF", "CNY"])).toBe(false);
    expect(isValidQuery(["JPY", "JPY"])).toBe(false);
    expect(isValidQuery(["XXX"])).toBe(false);
  });
});

/** Reports whether an hourly query with these symbols passes validation. */
function isValidQuery(symbols: string[]): boolean {
  return rateHistoryQuerySchema.safeParse({ resolution: "hourly", symbols }).success;
}

describe("rate history symbols", () => {
  it("requests the base and every target once, leaving out USD", () => {
    expect(getRateHistorySymbols(["JPY", "EUR", "USD"], "GBP")).toEqual([
      "GBP",
      "JPY",
      "EUR",
    ]);
    expect(getRateHistorySymbols(["JPY", "EUR"], "JPY")).toEqual(["JPY", "EUR"]);
    expect(getRateHistorySymbols(["USD"], "USD")).toEqual([]);
  });

  it("keys a query by resolution and symbol set regardless of order", () => {
    expect(getRateHistoryKey({ resolution: "daily", symbols: ["JPY", "EUR"] })).toBe(
      getRateHistoryKey({ resolution: "daily", symbols: ["EUR", "JPY"] }),
    );
    expect(getRateHistoryKey({ resolution: "daily", symbols: ["JPY"] })).not.toBe(
      getRateHistoryKey({ resolution: "hourly", symbols: ["JPY"] }),
    );
  });
});

describe("fetchRateHistory", () => {
  it("sends the query and validates the response", async () => {
    const fetchHistory = vi.fn<typeof fetch>(() =>
      Promise.resolve(Response.json(DAILY_HISTORY)),
    );

    await expect(
      fetchRateHistory(
        ENDPOINT,
        { resolution: "daily", symbols: ["JPY", "EUR"] },
        fetchHistory,
      ),
    ).resolves.toEqual(DAILY_HISTORY);

    const [url, init] = fetchHistory.mock.calls[0]!;
    expect(url instanceof URL ? url.href : url).toBe(
      `${ENDPOINT}?resolution=daily&symbols=JPY%2CEUR`,
    );
    expect(init?.headers).toEqual({ Accept: "application/json" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("rejects HTTP failures, invalid bodies, and a mismatched resolution", async () => {
    const query = { resolution: "hourly", symbols: ["JPY"] } as const;
    await expect(
      fetchRateHistory(ENDPOINT, query, () =>
        Promise.resolve(new Response(null, { status: 503 })),
      ),
    ).rejects.toThrow("HTTP 503");
    await expect(
      fetchRateHistory(ENDPOINT, query, () => Promise.resolve(Response.json({}))),
    ).rejects.toThrow();
    await expect(
      fetchRateHistory(ENDPOINT, query, () =>
        Promise.resolve(Response.json(DAILY_HISTORY)),
      ),
    ).rejects.toThrow("different resolution");
  });

  it("uses the global fetch by default", async () => {
    const fetchHistory = vi.fn(() => Promise.resolve(Response.json(DAILY_HISTORY)));
    vi.stubGlobal("fetch", fetchHistory);
    try {
      await fetchRateHistory(ENDPOINT, { resolution: "daily", symbols: ["JPY"] });
      expect(fetchHistory).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("createRateHistoryCache", () => {
  it("shares one response per query until it expires", async () => {
    let now = 0;
    const cache = createRateHistoryCache(1_000, () => now);
    const load = vi.fn(() => Promise.resolve(DAILY_HISTORY));
    const query = { resolution: "daily", symbols: ["JPY", "EUR"] } as const;

    await cache.get(query, load);
    await cache.get({ resolution: "daily", symbols: ["EUR", "JPY"] }, load);
    expect(load).toHaveBeenCalledTimes(1);

    now = 1_000;
    await cache.get(query, load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("forgets failed loads so the next request retries", async () => {
    const cache = createRateHistoryCache();
    const query = { resolution: "hourly", symbols: ["JPY"] } as const;
    const failing = vi.fn(() => Promise.reject(new Error("offline")));

    await expect(cache.get(query, failing)).rejects.toThrow("offline");
    await expect(cache.get(query, () => Promise.resolve(DAILY_HISTORY))).resolves.toBe(
      DAILY_HISTORY,
    );
  });

  it("keeps a newer entry when an expired load fails afterwards", async () => {
    let now = 0;
    const pending = Promise.withResolvers<RateHistory>();
    const cache = createRateHistoryCache(10, () => now);
    const query = { resolution: "daily", symbols: ["JPY"] } as const;
    const first = cache.get(query, () => pending.promise);

    now = 10;
    const second = vi.fn(() => Promise.resolve(DAILY_HISTORY));
    await cache.get(query, second);
    pending.reject(new Error("late failure"));
    await expect(first).rejects.toThrow("late failure");

    await cache.get(query, second);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
