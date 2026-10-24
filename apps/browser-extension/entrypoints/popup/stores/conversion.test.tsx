// @vitest-environment happy-dom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PopupConversionProvider,
  type PopupRatesData,
  usePopupConversion,
} from "@/entrypoints/popup/stores/conversion";

const RATES: PopupRatesData = {
  base: "USD",
  fetchedAt: 1_753_000_000_000,
  isStale: false,
  rates: { EUR: "0.86", JPY: "149.45", USD: "1" },
  sourceTimestamp: 1_753_000_000_000,
  warnings: [],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("popup conversion store", () => {
  it("uses preview rates and owns conversion input without browser calls", () => {
    const sendMessage = vi.fn<() => void>();
    vi.stubGlobal("browser", { runtime: { sendMessage } });
    const { result } = renderPopupConversion(RATES);

    act(() => {
      result.current.setSourceAmount("125.50");
      result.current.setSourceCurrency("EUR");
    });

    expect(result.current).toMatchObject({
      rates: { data: RATES, status: "ready" },
      sourceAmount: "125.50",
      sourceCurrency: "EUR",
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("loads rates through the validated runtime boundary", async () => {
    const sendMessage = vi.fn<() => Promise<unknown>>(() =>
      Promise.resolve({ data: RATES, success: true }),
    );
    vi.stubGlobal("browser", { runtime: { sendMessage } });
    const { result } = renderPopupConversion();

    await waitFor(() => expect(result.current.rates.status).toBe("ready"));

    expect(result.current.rates.data).toEqual(RATES);
    expect(sendMessage).toHaveBeenCalledWith({ type: "GET_RATES" });
  });

  it.each([
    [() => Promise.resolve({ error: "Rates unavailable", success: false })],
    [() => Promise.reject(new Error("Browser disconnected"))],
  ])("represents an unavailable rate response explicitly", async (createResponse) => {
    vi.stubGlobal("browser", {
      runtime: { sendMessage: vi.fn<() => Promise<unknown>>(createResponse) },
    });
    const { result } = renderPopupConversion();

    await waitFor(() => expect(result.current.rates.status).toBe("unavailable"));

    expect(result.current.rates.data).toBeNull();
  });

  it("keeps the last successful rates when a refresh fails", async () => {
    const sendMessage = vi
      .fn<() => Promise<unknown>>()
      .mockResolvedValueOnce({ data: RATES, success: true })
      .mockRejectedValueOnce(new Error("Browser disconnected"));
    vi.stubGlobal("browser", { runtime: { sendMessage } });
    const { result } = renderPopupConversion();
    await waitFor(() => expect(result.current.rates.status).toBe("ready"));

    act(() => {
      void result.current.loadRates();
    });

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.rates.status).toBe("ready"));
    expect(result.current.rates.data).toEqual(RATES);
  });

  it("shares one in-flight request between concurrent loads", async () => {
    const response = Promise.withResolvers<unknown>();
    const sendMessage = vi.fn<() => Promise<unknown>>(() => response.promise);
    vi.stubGlobal("browser", { runtime: { sendMessage } });
    const { result } = renderPopupConversion();
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));

    const secondLoad = result.current.loadRates();
    const thirdLoad = result.current.loadRates();

    await act(async () => {
      response.resolve({ data: RATES, success: true });
      await secondLoad;
    });

    expect(secondLoad).toBe(thirdLoad);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(result.current.rates.data).toEqual(RATES);
    expect(result.current.rates.status).toBe("ready");
  });

  it("rejects consumers outside the provider", () => {
    expect(() => renderHook(() => usePopupConversion((state) => state.rates))).toThrow(
      "usePopupConversion must be used within PopupConversionProvider.",
    );
  });
});

/** Renders one popup-scoped store with optional preview rates. */
function renderPopupConversion(previewRates?: PopupRatesData) {
  function StoreWrapper({ children }: { readonly children: ReactNode }) {
    return (
      <PopupConversionProvider previewRates={previewRates}>
        {children}
      </PopupConversionProvider>
    );
  }

  return renderHook(() => usePopupConversion((state) => state), {
    wrapper: StoreWrapper,
  });
}
