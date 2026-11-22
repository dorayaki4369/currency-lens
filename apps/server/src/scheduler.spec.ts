import { afterEach, describe, expect, it, vi } from "vitest";
import { createScheduledHandler, scheduledHandler } from "./scheduler";
import {
  createBindings,
  createMemoryBucket,
  createR2Object,
  createRatesSnapshot,
} from "../test/fixtures";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("scheduledHandler", () => {
  it("stores refreshed rates and logs metadata without logging the payload", async () => {
    const data = createRatesSnapshot();
    const object = createR2Object("2023-11-14T22:13:20.000Z.json");
    const dependencies = {
      fetchLatestRates: vi.fn(async () => data),
      putLatestRates: vi.fn(async () => object),
      updateHistory: vi.fn(async () => ({ rebuiltKeys: [] as string[] })),
      now: () => 1_700_003_600_000,
      log: vi.fn(),
      logError: vi.fn(),
    };
    const handler = createScheduledHandler(dependencies);
    const env = createBindings();

    await handler({} as ScheduledController, env, {} as ExecutionContext);

    expect(dependencies.fetchLatestRates).toHaveBeenCalledWith({
      baseUrl: env.OPEN_EXCHANGE_RATE_API_URL,
      appId: env.OPEN_EXCHANGE_RATE_APP_ID,
    });
    expect(dependencies.putLatestRates).toHaveBeenCalledWith(data, env);
    expect(dependencies.log).toHaveBeenCalledWith("Stored latest exchange rates", {
      key: "2023-11-14T22:13:20.000Z.json",
      size: 123,
      base: "USD",
      sourceTimestamp: 1_700_000_000,
      currencyCount: 3,
    });
    const firstLogCall = dependencies.log.mock.calls.at(0);
    expect(firstLogCall).toBeDefined();
    expect(firstLogCall?.[1]).not.toHaveProperty("rates");
    expect(dependencies.updateHistory).toHaveBeenCalledWith(
      env.DATA_BUCKET,
      { timestampMs: 1_700_000_000_000, rates: { USD: 1, EUR: 0.92, NEW_COIN: 2.5 } },
      1_700_003_600_000,
    );
    expect(dependencies.logError).not.toHaveBeenCalled();
  });

  it("keeps the refreshed rates and logs safe metadata when the history update fails", async () => {
    const dependencies = {
      fetchLatestRates: vi.fn(async () => createRatesSnapshot()),
      putLatestRates: vi.fn(async () => createR2Object()),
      updateHistory: vi.fn(async () => {
        throw new TypeError("History bucket unavailable");
      }),
      now: () => 1_700_003_600_000,
      log: vi.fn(),
      logError: vi.fn(),
    };
    const handler = createScheduledHandler(dependencies);

    await expect(
      handler({} as ScheduledController, createBindings(), {} as ExecutionContext),
    ).resolves.toBeUndefined();

    expect(dependencies.putLatestRates).toHaveBeenCalledOnce();
    expect(dependencies.logError).toHaveBeenCalledWith(
      "Failed to update the exchange rate history",
      {
        name: "TypeError",
        message: "History bucket unavailable",
      },
    );
  });

  it("logs a generic name when the history update rejects with a non-error value", async () => {
    const dependencies = {
      fetchLatestRates: vi.fn(async () => createRatesSnapshot()),
      putLatestRates: vi.fn(async () => createR2Object()),
      updateHistory: vi.fn(() => Promise.reject("unavailable")),
      now: () => 1_700_003_600_000,
      log: vi.fn(),
      logError: vi.fn(),
    };

    await createScheduledHandler(dependencies)(
      {} as ScheduledController,
      createBindings(),
      {} as ExecutionContext,
    );

    expect(dependencies.logError).toHaveBeenCalledWith(
      "Failed to update the exchange rate history",
      {
        name: "UnknownError",
        message: undefined,
      },
    );
  });

  it("uses the production network, storage, and logging boundaries by default", async () => {
    const data = createRatesSnapshot();
    const fetchImplementation = vi.fn(async () =>
      Promise.resolve(new Response(JSON.stringify(data))),
    );
    const bucket = createMemoryBucket();
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetchImplementation);
    const env = createBindings({ bucket });

    await scheduledHandler({} as ScheduledController, env, {} as ExecutionContext);

    expect(fetchImplementation).toHaveBeenCalledOnce();
    expect(bucket.keys()).toEqual(
      expect.arrayContaining([
        "2023-11-14T22:13:20.000Z.json",
        "latest.json",
        "history/hourly.tsv",
      ]),
    );
    expect(logError).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      "Stored latest exchange rates",
      expect.objectContaining({ base: "USD", currencyCount: 3 }),
    );
  });

  it("reports aggregate files that had to be rebuilt", async () => {
    const dependencies = {
      fetchLatestRates: vi.fn(async () => createRatesSnapshot()),
      putLatestRates: vi.fn(async () => createR2Object()),
      updateHistory: vi.fn(async () => ({ rebuiltKeys: ["history/hourly.tsv"] })),
      now: () => 1_700_003_600_000,
      log: vi.fn(),
      logError: vi.fn(),
    };

    await createScheduledHandler(dependencies)(
      {} as ScheduledController,
      createBindings(),
      {} as ExecutionContext,
    );

    expect(dependencies.logError).toHaveBeenCalledWith(
      "Rebuilt invalid exchange rate history files",
      {
        keys: ["history/hourly.tsv"],
      },
    );
  });

  it("logs history failures through the default error boundary", async () => {
    const data = createRatesSnapshot();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(data))),
    );
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const bucket = createMemoryBucket();
    const put = bucket.put.bind(bucket);
    vi.spyOn(bucket, "put").mockImplementation(async (key, value, options) => {
      if (key === "history/hourly.tsv") {
        throw new Error("R2 write failed");
      }
      return put(key, value, options);
    });

    await scheduledHandler(
      {} as ScheduledController,
      createBindings({ bucket }),
      {} as ExecutionContext,
    );

    expect(logError).toHaveBeenCalledWith("Failed to update the exchange rate history", {
      name: "Error",
      message: "R2 write failed",
    });
  });
});
