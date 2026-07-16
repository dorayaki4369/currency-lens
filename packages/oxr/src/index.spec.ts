import { describe, expect, it, vi } from "vitest";
import {
  fetchLatestRate,
  OxrNetworkError,
  OxrResponseError,
  OxrTimeoutError,
} from "./index";

const config = {
  baseUrl: "https://openexchangerates.example/api",
  appId: "secret-app-id",
};

/** Creates the smallest valid upstream OXR response. */
function createResponseBody() {
  return {
    disclaimer: "Example disclaimer",
    license: "Example license",
    base: "USD",
    rates: { USD: 1, NEW_COIN: 2.5 },
    timestamp: 1_700_000_000,
  };
}

describe("fetchLatestRate", () => {
  it("authenticates, requests alternative currencies, and validates the response", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify(createResponseBody()), { status: 200 }),
    );

    const result = await fetchLatestRate(config, fetchMock);

    const firstCall = fetchMock.mock.calls.at(0);
    expect(firstCall).toBeDefined();
    if (!firstCall) {
      throw new Error("Expected fetch to be called");
    }

    const [input, init] = firstCall;
    const inputUrl =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(inputUrl);
    expect(url.pathname).toBe("/api/latest.json");
    expect(url.searchParams.get("show_alternative")).toBe("true");
    expect(url.searchParams.get("prettyprint")).toBe("0");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Token secret-app-id");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(result.rates["NEW_COIN"]).toBe("2.5");
  });

  it("rejects non-successful HTTP responses before parsing the body", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("rate limited", {
          status: 429,
          statusText: "Too Many Requests",
        }),
    );

    await expect(
      fetchLatestRate(config, fetchMock as unknown as typeof fetch),
    ).rejects.toEqual(
      expect.objectContaining({
        name: "OxrHttpError",
        status: 429,
      }),
    );
  });

  it("rejects a successful response containing invalid JSON", async () => {
    const fetchMock = vi.fn(async () => new Response("{", { status: 200 }));

    await expect(
      fetchLatestRate(config, fetchMock as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(OxrResponseError);
  });

  it("rejects JSON that does not satisfy the OXR response contract", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ error: true }), { status: 200 }),
    );

    await expect(
      fetchLatestRate(config, fetchMock as unknown as typeof fetch),
    ).rejects.toThrow("did not match the expected schema");
  });

  it("distinguishes network failures from response failures", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("network unavailable");
    });

    await expect(
      fetchLatestRate(config, fetchMock as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(OxrNetworkError);
  });

  it("aborts requests that exceed the configured timeout", async () => {
    const fetchMock = vi.fn(
      async (_input: Parameters<typeof fetch>[0], init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            reject(new Error("Expected an abort signal"));
            return;
          }

          if (signal.aborted) {
            reject(signal.reason);
            return;
          }

          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
    );

    await expect(
      fetchLatestRate({ ...config, timeoutMs: 5 }, fetchMock as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(OxrTimeoutError);
  });
});
