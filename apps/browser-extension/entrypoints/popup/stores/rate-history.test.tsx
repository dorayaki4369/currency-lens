// @vitest-environment happy-dom

import type { CurrencyCode } from "@cl/currency";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RateHistory, RateHistoryResolution } from "@/lib/rate-history";
import {
  PopupRateHistoryProvider,
  type RateHistoryPreview,
  usePopupRateHistory,
  useRateHistory,
} from "@/entrypoints/popup/stores/rate-history";

const DAILY: RateHistory = {
  base: "USD",
  resolution: "daily",
  start: "2026-01-01T00:00:00.000Z",
  rates: { EUR: [0.86, 0.87], JPY: [150, 151] },
};
const HOURLY: RateHistory = { ...DAILY, resolution: "hourly" };
const JPY_EUR: readonly CurrencyCode[] = ["JPY", "EUR"];
const JPY_GBP: readonly CurrencyCode[] = ["JPY", "GBP"];
const NOTHING: readonly CurrencyCode[] = [];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Renders the history hook for one query inside a fresh provider. */
function renderHistory(
  resolution: RateHistoryResolution,
  symbols: readonly CurrencyCode[],
  preview?: RateHistoryPreview,
) {
  return renderHook(
    ({ query }) => ({
      entry: useRateHistory(query.resolution, query.symbols),
      period: usePopupRateHistory((state) => state.period),
      selection: usePopupRateHistory((state) => state.selection),
      setPeriod: usePopupRateHistory((state) => state.setPeriod),
      setSelection: usePopupRateHistory((state) => state.setSelection),
    }),
    {
      initialProps: { query: { resolution, symbols } },
      wrapper: ({ children }: { readonly children: ReactNode }) => (
        <PopupRateHistoryProvider preview={preview}>{children}</PopupRateHistoryProvider>
      ),
    },
  );
}

describe("popup rate history store", () => {
  it("loads each window once through the validated runtime boundary", async () => {
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>(() =>
      Promise.resolve({ data: DAILY, success: true }),
    );
    vi.stubGlobal("browser", { runtime: { sendMessage } });
    const { rerender, result } = renderHistory("daily", JPY_EUR);

    expect(result.current.entry).toEqual({ data: null, status: "loading" });
    await waitFor(() => expect(result.current.entry.status).toBe("ready"));
    expect(result.current.entry.data).toEqual(DAILY);
    expect(sendMessage).toHaveBeenCalledWith({
      payload: { resolution: "daily", symbols: ["JPY", "EUR"] },
      type: "GET_RATE_HISTORY",
    });

    rerender({ query: { resolution: "daily", symbols: ["EUR", "JPY"] } });
    expect(result.current.entry.data).toEqual(DAILY);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("never shows a late response for a selection the user already left", async () => {
    const responses = new Map<string, PromiseWithResolvers<unknown>>();
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) => {
      const pending = Promise.withResolvers<unknown>();
      responses.set(JSON.stringify(message), pending);
      return pending.promise;
    });
    vi.stubGlobal("browser", { runtime: { sendMessage } });
    const { rerender, result } = renderHistory("daily", JPY_EUR);
    rerender({ query: { resolution: "daily", symbols: JPY_GBP } });

    const [first] = responses.values();
    first?.resolve({ data: DAILY, success: true });
    await act(() => Promise.resolve());
    expect(result.current.entry).toEqual({ data: null, status: "loading" });

    const gbp = { ...DAILY, rates: { GBP: [0.74, 0.75], JPY: [150, 151] } };
    [...responses.values()][1]?.resolve({ data: gbp, success: true });
    await waitFor(() => expect(result.current.entry.data).toEqual(gbp));
  });

  it("shares one in-flight request between components", async () => {
    const response = Promise.withResolvers<unknown>();
    const sendMessage = vi.fn<() => Promise<unknown>>(() => response.promise);
    vi.stubGlobal("browser", { runtime: { sendMessage } });
    const { result } = renderHook(
      () => [useRateHistory("daily", JPY_EUR), useRateHistory("daily", JPY_EUR)],
      {
        wrapper: ({ children }: { readonly children: ReactNode }) => (
          <PopupRateHistoryProvider>{children}</PopupRateHistoryProvider>
        ),
      },
    );

    expect(sendMessage).toHaveBeenCalledTimes(1);
    response.resolve({ data: DAILY, success: true });
    await waitFor(() => expect(result.current[0]?.status).toBe("ready"));
  });

  it.each([
    ["a failure response", () => Promise.resolve({ error: "offline", success: false })],
    ["a runtime error", () => Promise.reject(new Error("disconnected"))],
  ])("turns %s into an error and retries on the next request", async (_name, fail) => {
    const sendMessage = vi.fn<() => Promise<unknown>>(fail);
    vi.stubGlobal("browser", { runtime: { sendMessage } });
    const { rerender, result } = renderHistory("hourly", JPY_EUR);

    await waitFor(() => expect(result.current.entry.status).toBe("error"));
    expect(result.current.entry.data).toBeNull();

    sendMessage.mockResolvedValue({ data: HOURLY, success: true });
    rerender({ query: { resolution: "hourly", symbols: JPY_GBP } });
    rerender({ query: { resolution: "hourly", symbols: JPY_EUR } });
    await waitFor(() => expect(result.current.entry.status).toBe("ready"));
    expect(sendMessage).toHaveBeenCalledTimes(3);
  });

  it("serves previews without the network and keeps only requested symbols", async () => {
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>();
    vi.stubGlobal("browser", { runtime: { sendMessage } });
    const data = renderHistory("hourly", ["JPY", "GBP"], {
      daily: DAILY,
      hourly: HOURLY,
      kind: "data",
    });
    await waitFor(() => expect(data.result.current.entry.status).toBe("ready"));
    expect(data.result.current.entry.data?.rates).toEqual({ JPY: [150, 151] });

    const empty = renderHistory("daily", JPY_EUR, { kind: "empty" });
    await waitFor(() => expect(empty.result.current.entry.status).toBe("ready"));
    expect(empty.result.current.entry.data).toMatchObject({
      rates: {},
      resolution: "daily",
    });

    const failed = renderHistory("daily", JPY_EUR, { kind: "error" });
    await waitFor(() => expect(failed.result.current.entry.status).toBe("error"));

    const loading = renderHistory("daily", JPY_EUR, { kind: "loading" });
    await act(() => Promise.resolve());
    expect(loading.result.current.entry.status).toBe("loading");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("remembers the chart period and selection for the popup", () => {
    const { result } = renderHistory("daily", NOTHING, { kind: "empty" });
    expect([result.current.period, result.current.selection]).toEqual(["1M", "*"]);

    act(() => {
      result.current.setPeriod("1Y");
      result.current.setSelection("JPY");
    });
    expect([result.current.period, result.current.selection]).toEqual(["1Y", "JPY"]);
  });

  it("requires the provider", () => {
    expect(() => renderHook(() => usePopupRateHistory((state) => state.period))).toThrow(
      "usePopupRateHistory must be used within PopupRateHistoryProvider.",
    );
  });
});
