import { describe, expect, it, vi } from "vitest";
import type { OxrLatestResponse } from "@cl/oxr/schema";
import { createApp } from "./index";
import { createBindings, createR2Object, createRatesSnapshot } from "../test/fixtures";

/** Creates replaceable Worker dependencies with observable defaults. */
function createDependencies() {
  return {
    getLatestRates: vi.fn(
      async (): Promise<OxrLatestResponse | null> => createRatesSnapshot(),
    ),
    fetchLatestRates: vi.fn(async () => createRatesSnapshot()),
    putLatestRates: vi.fn(async () => createR2Object()),
    logError: vi.fn(),
  };
}

describe("GET /latest", () => {
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
