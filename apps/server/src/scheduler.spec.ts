import { afterEach, describe, expect, it, vi } from "vitest";
import { createScheduledHandler, scheduledHandler } from "./scheduler";
import { createBindings, createR2Object, createRatesSnapshot } from "../test/fixtures";

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
      log: vi.fn(),
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
  });

  it("uses the production network, storage, and logging boundaries by default", async () => {
    const data = createRatesSnapshot();
    const fetchImplementation = vi.fn(async () =>
      Promise.resolve(new Response(JSON.stringify(data))),
    );
    const put = vi.fn(async (key: string) => createR2Object(key));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetchImplementation);
    const env = createBindings({ bucket: { put } as unknown as R2Bucket });

    await scheduledHandler({} as ScheduledController, env, {} as ExecutionContext);

    expect(fetchImplementation).toHaveBeenCalledOnce();
    expect(put).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith(
      "Stored latest exchange rates",
      expect.objectContaining({ base: "USD", currencyCount: 3 }),
    );
  });
});
