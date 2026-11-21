import { afterEach, describe, expect, it, vi } from "vitest";
import type { OxrLatestResponse } from "@cl/oxr/schema";
import type { HistoryResponse } from "./history";
import { app as workerApp, createApp } from "./index";
import {
  createBindings,
  createHistoryResponse,
  createMemoryBucket,
  createR2Object,
  createRatesSnapshot,
  HISTORY_NOW_MS,
} from "../test/fixtures";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Creates replaceable Worker dependencies with observable defaults. */
function createDependencies() {
  return {
    getLatestRates: vi.fn(
      async (): Promise<OxrLatestResponse | null> => createRatesSnapshot(),
    ),
    fetchLatestRates: vi.fn(async () => createRatesSnapshot()),
    putLatestRates: vi.fn(async () => createR2Object()),
    readHistory: vi.fn(async (): Promise<HistoryResponse> => createHistoryResponse()),
    getResponseCache: vi.fn((): Cache | undefined => undefined),
    now: () => HISTORY_NOW_MS,
    logError: vi.fn(),
  };
}

describe("latest rates API", () => {
  it("serves the current v1 route and preserves the legacy route", async () => {
    const app = createApp(createDependencies());

    const [currentResponse, legacyResponse] = await Promise.all([
      app.request("/v1/latest", {}, createBindings()),
      app.request("/latest", {}, createBindings()),
    ]);

    expect(currentResponse.status).toBe(200);
    expect(legacyResponse.status).toBe(200);
    await expect(currentResponse.json()).resolves.toEqual(await legacyResponse.json());
  });

  it("returns the validated R2 snapshot and its source timestamp", async () => {
    const dependencies = createDependencies();
    const app = createApp(dependencies);

    const response = await app.request(
      "/latest",
      { headers: { Origin: "chrome-extension://extension-id" } },
      createBindings(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "chrome-extension://extension-id",
    );
    await expect(response.json()).resolves.toEqual({
      base: "USD",
      rates: { USD: "1", EUR: "0.92", NEW_COIN: "2.5" },
      timestamp: 1_700_000_000,
    });
    expect(dependencies.fetchLatestRates).not.toHaveBeenCalled();
  });

  it("serves the stored snapshot when the OXR secret is unavailable", async () => {
    const dependencies = createDependencies();
    const app = createApp(dependencies);

    const response = await app.request("/v1/latest", {}, createBindings({ appId: "" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      base: "USD",
      rates: { USD: "1", EUR: "0.92", NEW_COIN: "2.5" },
      timestamp: 1_700_000_000,
    });
    expect(dependencies.fetchLatestRates).not.toHaveBeenCalled();
    expect(dependencies.putLatestRates).not.toHaveBeenCalled();
  });

  it("does not expose CORS access to ordinary web origins", async () => {
    const app = createApp(createDependencies());

    const response = await app.request(
      "/latest",
      { headers: { Origin: "https://example.com" } },
      createBindings(),
    );

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("answers extension CORS preflight requests for GET only", async () => {
    const app = createApp(createDependencies());

    const response = await app.request(
      "/latest",
      {
        method: "OPTIONS",
        headers: {
          Origin: "moz-extension://extension-id",
          "Access-Control-Request-Method": "GET",
        },
      },
      createBindings(),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "moz-extension://extension-id",
    );
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET");
  });

  it("returns 503 for an empty bucket when the OXR secret is unavailable", async () => {
    const dependencies = createDependencies();
    dependencies.getLatestRates.mockResolvedValueOnce(null);
    const app = createApp(dependencies);

    const response = await app.request("/latest", {}, createBindings({ appId: "" }));

    expect(response.status).toBe(503);
    expect(dependencies.fetchLatestRates).not.toHaveBeenCalled();
    expect(dependencies.putLatestRates).not.toHaveBeenCalled();
  });

  it("fetches and persists a seed snapshot when R2 is empty", async () => {
    const dependencies = createDependencies();
    dependencies.getLatestRates.mockResolvedValueOnce(null);
    const app = createApp(dependencies);
    const env = createBindings();

    const response = await app.request("/latest", {}, env);

    expect(response.status).toBe(200);
    expect(dependencies.fetchLatestRates).toHaveBeenCalledWith({
      baseUrl: env.OPEN_EXCHANGE_RATE_API_URL,
      appId: env.OPEN_EXCHANGE_RATE_APP_ID,
    });
    expect(dependencies.putLatestRates).toHaveBeenCalledWith(createRatesSnapshot(), env);
  });

  it("coalesces concurrent fetch-on-miss requests into one upstream call", async () => {
    const dependencies = createDependencies();
    dependencies.getLatestRates.mockResolvedValue(null);
    const app = createApp(dependencies);
    const env = createBindings();

    const responses = await Promise.all([
      app.request("/latest", {}, env),
      app.request("/latest", {}, env),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(dependencies.fetchLatestRates).toHaveBeenCalledTimes(1);
    expect(dependencies.putLatestRates).toHaveBeenCalledTimes(1);
  });

  it("returns a stable 503 when an R2 payload is invalid", async () => {
    const dependencies = createDependencies();
    dependencies.getLatestRates.mockRejectedValueOnce(
      new Error("invalid persisted payload"),
    );
    const app = createApp(dependencies);

    const response = await app.request("/latest", {}, createBindings());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Rates not available",
    });
    expect(dependencies.fetchLatestRates).not.toHaveBeenCalled();
    expect(dependencies.logError).toHaveBeenCalledWith(
      "Failed to read the latest exchange rates from R2",
      { name: "Error", message: "invalid persisted payload" },
    );
  });

  it("logs an unknown failure without exposing the rejected value", async () => {
    const dependencies = createDependencies();
    dependencies.getLatestRates.mockRejectedValueOnce("sensitive failure value");
    const app = createApp(dependencies);

    const response = await app.request("/latest", {}, createBindings());

    expect(response.status).toBe(503);
    expect(dependencies.logError).toHaveBeenCalledWith(
      "Failed to read the latest exchange rates from R2",
      { name: "UnknownError" },
    );
  });

  it("uses the default logger when the R2 boundary throws", async () => {
    const persistedFailure = new Error("R2 unavailable");
    const get = vi.fn(async () => Promise.reject(persistedFailure));
    const logError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = createApp();

    const response = await app.request(
      "/latest",
      {},
      createBindings({ bucket: { get } as unknown as R2Bucket }),
    );

    expect(response.status).toBe(503);
    expect(logError).toHaveBeenCalledWith(
      "Failed to read the latest exchange rates from R2",
      { name: "Error", message: "R2 unavailable" },
    );
  });

  it("returns 503 when fetch-on-miss cannot seed R2", async () => {
    const dependencies = createDependencies();
    dependencies.getLatestRates.mockResolvedValueOnce(null);
    dependencies.fetchLatestRates.mockRejectedValueOnce(new Error("upstream unavailable"));
    const app = createApp(dependencies);

    const response = await app.request("/latest", {}, createBindings());

    expect(response.status).toBe(503);
    expect(dependencies.putLatestRates).not.toHaveBeenCalled();
    expect(dependencies.logError).toHaveBeenCalledWith(
      "Failed to seed the latest exchange rates",
      { name: "Error", message: "upstream unavailable" },
    );
  });

  it("returns 503 when fetch-on-miss cannot persist the seed", async () => {
    const dependencies = createDependencies();
    dependencies.getLatestRates.mockResolvedValueOnce(null);
    dependencies.putLatestRates.mockRejectedValueOnce(new Error("R2 write unavailable"));
    const app = createApp(dependencies);

    const response = await app.request("/latest", {}, createBindings());

    expect(response.status).toBe(503);
    expect(dependencies.fetchLatestRates).toHaveBeenCalledOnce();
    expect(dependencies.logError).toHaveBeenCalledWith(
      "Failed to seed the latest exchange rates",
      { name: "Error", message: "R2 write unavailable" },
    );
  });
});

/** Creates a Cache API stand-in whose stored responses can be inspected. */
function createCache(cached?: Response) {
  return {
    match: vi.fn(async () => cached),
    put: vi.fn(async () => undefined),
  };
}

describe("rate history API", () => {
  it("rejects malformed queries before reading R2", async () => {
    const dependencies = createDependencies();
    const app = createApp(dependencies);

    const response = await app.request(
      "/v1/history?resolution=daily&symbols=jpy",
      {},
      createBindings(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid history query" });
    expect(dependencies.readHistory).not.toHaveBeenCalled();
  });

  it("serves the requested series to extension origins and stores them in the edge cache", async () => {
    const dependencies = createDependencies();
    const cache = createCache();
    dependencies.getResponseCache.mockReturnValue(cache as unknown as Cache);
    const env = createBindings();
    const app = createApp(dependencies);

    const response = await app.request(
      "/v1/history?resolution=hourly&symbols=JPY,EUR",
      { headers: { Origin: "moz-extension://extension-id" } },
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "moz-extension://extension-id",
    );
    await expect(response.json()).resolves.toEqual(createHistoryResponse());
    expect(dependencies.readHistory).toHaveBeenCalledWith(
      env.DATA_BUCKET,
      { resolution: "hourly", symbols: ["JPY", "EUR"] },
      HISTORY_NOW_MS,
    );
    const [, stored] = cache.put.mock.calls.at(0) as unknown as [Request, Response];
    expect(stored.headers.get("Cache-Control")).toBe("public, max-age=300");
  });

  it("answers from the edge cache without reading R2", async () => {
    const dependencies = createDependencies();
    dependencies.getResponseCache.mockReturnValue(
      createCache(new Response(JSON.stringify({ cached: true }))) as unknown as Cache,
    );
    const app = createApp(dependencies);

    const response = await app.request(
      "/v1/history?resolution=daily&symbols=JPY",
      {},
      createBindings(),
    );

    await expect(response.json()).resolves.toEqual({ cached: true });
    expect(dependencies.readHistory).not.toHaveBeenCalled();
  });

  it("returns 503 and logs safe metadata when the stored history cannot be read", async () => {
    const dependencies = createDependencies();
    dependencies.readHistory.mockRejectedValue(new Error("Corrupt history"));
    const app = createApp(dependencies);

    const response = await app.request(
      "/v1/history?resolution=daily&symbols=JPY",
      {},
      createBindings(),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "History not available" });
    expect(dependencies.logError).toHaveBeenCalledWith(
      "Failed to read the exchange rate history from R2",
      { name: "Error", message: "Corrupt history" },
    );
  });

  it("reads R2 through the default boundaries, with and without the Workers cache", async () => {
    const bucket = createMemoryBucket();
    const env = createBindings({ bucket });
    const cache = createCache();

    const uncached = await workerApp.request(
      "/v1/history?resolution=hourly&symbols=JPY",
      {},
      env,
    );
    vi.stubGlobal("caches", { default: cache });
    const cachedRun = await workerApp.request(
      "/v1/history?resolution=daily&symbols=JPY",
      {},
      env,
    );

    expect(uncached.status).toBe(200);
    await expect(uncached.json()).resolves.toMatchObject({
      base: "USD",
      resolution: "hourly",
      rates: {},
    });
    expect(cachedRun.status).toBe(200);
    expect(cache.put).toHaveBeenCalledOnce();
  });

  it("normalizes the cache key and keeps serving when the edge cache fails", async () => {
    const dependencies = createDependencies();
    const cache = {
      match: vi.fn(async () => {
        throw new Error("Cache read failed");
      }),
      put: vi.fn(async () => {
        throw new Error("Cache write failed");
      }),
    };
    dependencies.getResponseCache.mockReturnValue(cache as unknown as Cache);
    const app = createApp(dependencies);

    const response = await app.request(
      "/v1/history?symbols=JPY,EUR&resolution=hourly&extra=1",
      {},
      createBindings(),
    );

    expect(response.status).toBe(200);
    const [cacheKey] = cache.match.mock.calls.at(0) as unknown as [Request];
    expect(new URL(cacheKey.url).search).toBe("?resolution=hourly&symbols=EUR%2CJPY");
    expect(dependencies.logError).toHaveBeenCalledWith(
      "Failed to read the history response cache",
      {
        name: "Error",
        message: "Cache read failed",
      },
    );
    expect(dependencies.logError).toHaveBeenCalledWith(
      "Failed to store the history response cache",
      {
        name: "Error",
        message: "Cache write failed",
      },
    );
  });
});
