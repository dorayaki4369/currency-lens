// @vitest-environment happy-dom

import type { CurrencyCode } from "@cl/currency";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DetectedCurrency } from "@/lib/currency-detection";
import { useConversion } from "@/entrypoints/content/hooks/useConversion";

const DETECTION: DetectedCurrency = {
  amount: 120,
  currencyCode: "USD",
  index: 0,
  originalText: "$120.00",
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useConversion", () => {
  it("does not call the background when no target is configured", async () => {
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>();
    vi.stubGlobal("browser", { runtime: { sendMessage } });
    const { result } = renderHook(() => useConversion());

    await act(async () => {
      await result.current.convert(DETECTION, []);
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(result.current.error).toBe("MISSING_CONVERSION_TARGET");
  });

  it("does not call the background when there is no detected amount", async () => {
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>();
    vi.stubGlobal("browser", { runtime: { sendMessage } });
    const { result } = renderHook(() => useConversion());

    await act(async () => {
      await result.current.convert(null, ["JPY"]);
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ data: null, error: null, loading: false });
  });

  it("sends only parsed amounts and currency codes, never the selected text", async () => {
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>(() =>
      Promise.resolve(successfulConversionResponse(1_752_900_000_000)),
    );
    vi.stubGlobal("browser", { runtime: { sendMessage } });
    const { result } = renderHook(() => useConversion());

    await act(async () => {
      await result.current.convert(DETECTION, ["JPY", "EUR"]);
    });

    expect(sendMessage).toHaveBeenCalledOnce();
    const request: unknown = sendMessage.mock.calls[0]?.[0];
    expect(JSON.stringify(request)).not.toContain("$120.00");
    expect(request).toEqual({
      payload: {
        amounts: [{ amount: 120, currencyCode: "USD" }],
        targetCurrencies: ["JPY", "EUR"] satisfies CurrencyCode[],
      },
      type: "CONVERT_CURRENCIES",
    });
  });

  it("keeps the latest result when an older request resolves last", async () => {
    const firstResponse = Promise.withResolvers<unknown>();
    const secondResponse = Promise.withResolvers<unknown>();
    const sendMessage = vi
      .fn<(message: unknown) => Promise<unknown>>()
      .mockImplementationOnce(() => firstResponse.promise)
      .mockImplementationOnce(() => secondResponse.promise);
    vi.stubGlobal("browser", { runtime: { sendMessage } });
    const { result } = renderHook(() => useConversion());
    let firstRequest = Promise.resolve();
    let secondRequest = Promise.resolve();

    act(() => {
      firstRequest = result.current.convert(DETECTION, ["JPY"]);
      secondRequest = result.current.convert(DETECTION, ["EUR"]);
    });

    await act(async () => {
      secondResponse.resolve(successfulConversionResponse(2_000));
      await secondRequest;
    });
    await act(async () => {
      firstResponse.resolve(successfulConversionResponse(1_000));
      await firstRequest;
    });

    expect(result.current.data?.sourceTimestamp).toBe(2_000);
  });

  it("invalidates a pending result when reset", async () => {
    const response = Promise.withResolvers<unknown>();
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>(
      () => response.promise,
    );
    vi.stubGlobal("browser", { runtime: { sendMessage } });
    const { result } = renderHook(() => useConversion());
    let request = Promise.resolve();

    act(() => {
      request = result.current.convert(DETECTION, ["JPY"]);
      result.current.reset();
    });
    await act(async () => {
      response.resolve(successfulConversionResponse(3_000));
      await request;
    });

    expect(result.current).toMatchObject({ data: null, error: null, loading: false });
  });

  it("reports a validated background failure", async () => {
    vi.stubGlobal("browser", {
      runtime: {
        sendMessage: vi.fn<() => Promise<unknown>>(() =>
          Promise.resolve({ error: "RATE_UNAVAILABLE", success: false }),
        ),
      },
    });
    const { result } = renderHook(() => useConversion());

    await act(async () => {
      await result.current.convert(DETECTION, ["JPY"]);
    });

    expect(result.current).toMatchObject({
      data: null,
      error: "RATE_UNAVAILABLE",
      loading: false,
    });
  });

  it.each([
    ["an Error", new Error("network unavailable"), "network unavailable"],
    ["a non-Error value", "offline", "Currency conversion failed."],
  ])(
    "normalizes %s thrown by the browser boundary",
    async (_description, thrown, error) => {
      vi.stubGlobal("browser", {
        runtime: {
          sendMessage: vi.fn<() => Promise<unknown>>(() => Promise.reject(thrown)),
        },
      });
      const { result } = renderHook(() => useConversion());

      await act(async () => {
        await result.current.convert(DETECTION, ["JPY"]);
      });

      expect(result.current).toMatchObject({ data: null, error, loading: false });
    },
  );

  it("ignores an older rejected request after a newer result", async () => {
    const oldRequest = Promise.withResolvers<unknown>();
    const newRequest = Promise.withResolvers<unknown>();
    const sendMessage = vi
      .fn<(message: unknown) => Promise<unknown>>()
      .mockImplementationOnce(() => oldRequest.promise)
      .mockImplementationOnce(() => newRequest.promise);
    vi.stubGlobal("browser", { runtime: { sendMessage } });
    const { result } = renderHook(() => useConversion());
    let first = Promise.resolve();
    let second = Promise.resolve();

    act(() => {
      first = result.current.convert(DETECTION, ["JPY"]);
      second = result.current.convert(DETECTION, ["EUR"]);
    });
    await act(async () => {
      newRequest.resolve(successfulConversionResponse(4_000));
      await second;
    });
    await act(async () => {
      oldRequest.reject(new Error("late failure"));
      await first;
    });

    expect(result.current.data?.sourceTimestamp).toBe(4_000);
    expect(result.current.error).toBeNull();
  });
});

/** Creates one schema-valid successful background response. */
function successfulConversionResponse(sourceTimestamp: number): unknown {
  return {
    data: {
      base: "USD",
      fetchedAt: 1_753_000_000_000,
      isStale: true,
      results: [
        {
          amount: 120,
          convertedAmount: "18900",
          fractionDigits: 0,
          fromCurrency: "USD",
          rate: "157.5",
          sourceIndex: 0,
          status: "converted",
          toCurrency: "JPY",
        },
      ],
      sourceTimestamp,
      warnings: [],
    },
    success: true,
  };
}
