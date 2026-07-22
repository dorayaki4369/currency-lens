import { afterEach, describe, expect, it, vi } from "vitest";
import { RATE_REFRESH_ALARM_NAME, RATE_REFRESH_PERIOD_MINUTES } from "./rate-refresh";

const TEST_RATE_ENDPOINT = "https://cl.dryk.net/v1/latest";

interface BackgroundListeners {
  installed?: () => void;
  startup?: () => void;
  alarm?: (alarm: { name: string }) => void;
  message?: RuntimeMessageListener;
}

type RuntimeMessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response?: unknown) => void,
) => boolean | void;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("background lifecycle", () => {
  it("ensures lifecycle alarms and shares concurrent refresh work", async () => {
    const responseResolvers: Array<(response: Response) => void> = [];
    const fetchRates = vi.fn(
      (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Promise<Response>((resolve) => {
          responseResolvers.push(resolve);
        }),
    );
    const harness = installBrowserHarness(fetchRates);

    await import("../entrypoints/background");
    await vi.waitFor(() => expect(harness.alarmGet).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(harness.localGet).toHaveBeenCalledTimes(1));

    harness.listeners.installed?.();
    harness.listeners.startup?.();

    await vi.waitFor(() => expect(harness.alarmGet).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(harness.localGet).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(fetchRates).toHaveBeenCalledTimes(1));
    const requestedRateEndpoint = fetchRates.mock.calls[0]?.[0];
    if (!(requestedRateEndpoint instanceof URL)) {
      throw new TypeError("Expected the rate request to use a URL instance.");
    }
    expect(requestedRateEndpoint.href).toBe(TEST_RATE_ENDPOINT);

    responseResolvers[0]?.(createRateResponse());
    await vi.waitFor(() => expect(harness.localSet).toHaveBeenCalledTimes(1));

    harness.listeners.alarm?.({ name: "another-alarm" });
    expect(fetchRates).toHaveBeenCalledTimes(1);

    harness.listeners.alarm?.({ name: RATE_REFRESH_ALARM_NAME });
    await vi.waitFor(() => expect(fetchRates).toHaveBeenCalledTimes(2));
    responseResolvers[1]?.(createRateResponse());
    await vi.waitFor(() => expect(harness.localSet).toHaveBeenCalledTimes(2));
  });

  it("retains the last-good cache when a scheduled refresh fails", async () => {
    const initialState = createFreshLocalState();
    const fetchRates = vi.fn(() => Promise.reject(new Error("offline")));
    const harness = installBrowserHarness(fetchRates, initialState);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await import("../entrypoints/background");
    await vi.waitFor(() => expect(harness.alarmGet).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(harness.localGet).toHaveBeenCalledTimes(1));

    harness.listeners.alarm?.({ name: RATE_REFRESH_ALARM_NAME });

    await vi.waitFor(() => expect(fetchRates).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1));
    expect(harness.localSet).not.toHaveBeenCalled();
    expect(harness.readLocalState()).toEqual(initialState);
  });

  it("validates messages and converts against the retained cache", async () => {
    const fetchRates = vi.fn(() => Promise.resolve(createRateResponse()));
    const harness = installBrowserHarness(fetchRates);
    const { handleMessage } = await import("../entrypoints/background");
    await vi.waitFor(() => expect(harness.localGet).toHaveBeenCalledTimes(1));

    const sendResponse = vi.fn();
    expect(harness.listeners.message?.({ type: "GET_CONFIG" }, {}, sendResponse)).toBe(
      true,
    );
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1));
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ success: true }));

    await expect(handleMessage({ type: "UNKNOWN" })).resolves.toEqual({
      success: false,
      error: "Invalid message format",
    });
    await expect(
      handleMessage({
        type: "CONVERT_CURRENCIES",
        payload: {
          amounts: [{ amount: 10, currencyCode: "USD" }],
          targetCurrencies: ["EUR"],
        },
      }),
    ).resolves.toMatchObject({
      success: true,
      data: {
        isStale: false,
        results: [
          {
            status: "converted",
            fromCurrency: "USD",
            toCurrency: "EUR",
            convertedAmount: "9.00",
          },
        ],
      },
    });
    expect(fetchRates).not.toHaveBeenCalled();
  });
});

/** Installs a minimal WebExtension environment and exposes its observable boundaries. */
function installBrowserHarness(
  fetchImplementation: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  initialState: Record<string, unknown> = createFreshLocalState(),
) {
  const listeners: BackgroundListeners = {};
  const alarmGet = vi.fn(() =>
    Promise.resolve({
      name: RATE_REFRESH_ALARM_NAME,
      periodInMinutes: RATE_REFRESH_PERIOD_MINUTES,
    }),
  );
  let localState = structuredClone(initialState);
  const localGet = vi.fn((key: string) => Promise.resolve({ [key]: localState[key] }));
  const localSet = vi.fn((values: Record<string, unknown>) => {
    localState = { ...localState, ...values };
    return Promise.resolve();
  });

  vi.stubGlobal("fetch", fetchImplementation);
  vi.stubGlobal("browser", {
    runtime: {
      onMessage: {
        addListener: vi.fn((listener: RuntimeMessageListener) => {
          listeners.message = listener;
        }),
      },
      onInstalled: {
        addListener: vi.fn((listener: () => void) => {
          listeners.installed = listener;
        }),
      },
      onStartup: {
        addListener: vi.fn((listener: () => void) => {
          listeners.startup = listener;
        }),
      },
    },
    alarms: {
      get: alarmGet,
      create: vi.fn(),
      onAlarm: {
        addListener: vi.fn((listener: (alarm: { name: string }) => void) => {
          listeners.alarm = listener;
        }),
      },
    },
    storage: {
      sync: {
        get: vi.fn(() => Promise.resolve({})),
        set: vi.fn(() => Promise.resolve()),
      },
      local: {
        get: localGet,
        set: localSet,
        remove: vi.fn(() => Promise.resolve()),
      },
    },
  });
  vi.stubGlobal("defineBackground", (setup: () => void) => {
    setup();
    return setup;
  });

  return {
    listeners,
    alarmGet,
    localGet,
    localSet,
    readLocalState: () => localState,
  };
}

/** Creates a valid API response for completing one deferred refresh. */
function createRateResponse(): Response {
  return new Response(
    JSON.stringify({
      base: "USD",
      rates: { USD: "1", EUR: "0.9" },
      timestamp: Math.floor(Date.now() / 1_000),
    }),
    { status: 200 },
  );
}

/** Creates recent last-good data so module initialization performs no network refresh. */
function createFreshLocalState(): Record<string, unknown> {
  const now = Date.now();
  return {
    exchangeRateCache: {
      base: "USD",
      rates: { USD: "1", EUR: "0.9" },
      sourceTimestamp: now,
      fetchedAt: now,
    },
  };
}
