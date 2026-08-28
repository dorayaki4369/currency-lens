import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchLatestRate,
  OxrHttpError,
  OxrNetworkError,
  OxrResponseError,
  OxrTimeoutError,
} from "./index";

const config = {
  baseUrl: "https://openexchangerates.example/api",
  appId: "secret-app-id",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

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
  it("authenticates with an app ID query parameter and validates the response", async () => {
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
    expect(url.searchParams.get("app_id")).toBe("secret-app-id");
    expect(url.searchParams.get("show_alternative")).toBe("true");
    expect(url.searchParams.get("prettyprint")).toBe("0");
    expect(new Headers(init?.headers).get("Authorization")).toBeNull();
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(result.rates["NEW_COIN"]).toBe("2.5");
  });

  it("normalizes a base URL which already has a trailing slash", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify(createResponseBody())),
    );

    await fetchLatestRate(
      { ...config, baseUrl: `${config.baseUrl}/?ignored=true#ignored` },
      fetchMock,
    );

    const input = fetchMock.mock.calls.at(0)?.[0];
    if (!(input instanceof URL)) {
      throw new Error("Expected OXR to be called with a URL");
    }
    expect(input.href).toContain("/api/latest.json?app_id=secret-app-id");
    expect(input.href).not.toContain("ignored");
  });

  it("uses the platform fetch implementation when none is injected", async () => {
    const fetchMock = vi.fn(async () =>
      Promise.resolve(new Response(JSON.stringify(createResponseBody()))),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchLatestRate(config)).resolves.toMatchObject({ base: "USD" });
    expect(fetchMock).toHaveBeenCalledOnce();
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

  it("describes an HTTP failure even when the server omits status text", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 500 }));

    await expect(
      fetchLatestRate(config, fetchMock as unknown as typeof fetch),
    ).rejects.toEqual(
      expect.objectContaining<Partial<OxrHttpError>>({
        message: "Open Exchange Rates returned HTTP 500",
        statusText: "",
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

  it("reports a timeout while decoding a response body", async () => {
    const fetchMock = vi.fn(
      async (_input: Parameters<typeof fetch>[0], init?: RequestInit) =>
        ({
          ok: true,
          json: () =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
                once: true,
              });
            }),
        }) as Response,
    );

    await expect(
      fetchLatestRate({ ...config, timeoutMs: 5 }, fetchMock as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(OxrTimeoutError);
  });

  it.each([0, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects an invalid timeout of %s milliseconds",
    async (timeoutMs) => {
      await expect(fetchLatestRate({ ...config, timeoutMs }, vi.fn())).rejects.toThrow(
        "timeoutMs must be a positive safe integer",
      );
    },
  );
});
