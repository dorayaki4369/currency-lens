// @vitest-environment happy-dom

import type { CurrencyCode } from "@cl/currency";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DetectedCurrency } from "../lib/currency-detection";
import {
  ConversionPopup,
  type ConversionPopupData,
} from "../entrypoints/content/components/ConversionPopup";
import { useConversion } from "../entrypoints/content/hooks/useConversion";

const DETECTIONS: readonly DetectedCurrency[] = [
  {
    amount: 120,
    currencyCode: "USD",
    index: 0,
    originalText: "$120.00",
  },
];

const CONVERSION_DATA: ConversionPopupData = {
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
    {
      amount: 120,
      fromCurrency: "USD",
      reason: "RATE_UNAVAILABLE",
      sourceIndex: 0,
      status: "unavailable",
      toCurrency: "EUR",
    },
  ],
  sourceTimestamp: 1_752_900_000_000,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ConversionPopup", () => {
  it("groups every target under its source and explains stale or missing rates", () => {
    render(
      <ConversionPopup
        data={CONVERSION_DATA}
        detections={DETECTIONS}
        error={null}
        floatingStyles={{}}
        loading={false}
        onClose={vi.fn<() => void>()}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        showCurrencyCode
        showCurrencyIcon
        visible
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Currency Lens" });
    expect(dialog.textContent).toContain("$120.00");
    expect(dialog.textContent).toContain("18,900");
    expect(dialog.textContent).toContain("Rate unavailable");
    expect(dialog.textContent).toContain("more than 24 hours old");
  });

  it("closes from the keyboard", () => {
    const onClose = vi.fn<() => void>();
    render(
      <ConversionPopup
        data={CONVERSION_DATA}
        detections={DETECTIONS}
        error={null}
        floatingStyles={{}}
        loading={false}
        onClose={onClose}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        showCurrencyCode
        showCurrencyIcon
        visible
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps a target currency identifiable when both display preferences are off", () => {
    render(
      <ConversionPopup
        data={CONVERSION_DATA}
        detections={DETECTIONS}
        error={null}
        floatingStyles={{}}
        loading={false}
        onClose={vi.fn<() => void>()}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        showCurrencyCode={false}
        showCurrencyIcon={false}
        visible
      />,
    );

    expect(screen.getByText("JPY")).toBeDefined();
    expect(screen.getByText("EUR")).toBeDefined();
  });

  it("shows codes for targets whose visible currency marks collide", () => {
    const collidingMarkData: ConversionPopupData = {
      ...CONVERSION_DATA,
      isStale: false,
      results: [
        {
          amount: 120,
          convertedAmount: "120.00",
          fractionDigits: 2,
          fromCurrency: "EUR",
          rate: "1",
          sourceIndex: 0,
          status: "converted",
          toCurrency: "USD",
        },
        {
          amount: 120,
          convertedAmount: "165.60",
          fractionDigits: 2,
          fromCurrency: "EUR",
          rate: "1.38",
          sourceIndex: 0,
          status: "converted",
          toCurrency: "CAD",
        },
      ],
    };
    render(
      <ConversionPopup
        data={collidingMarkData}
        detections={DETECTIONS}
        error={null}
        floatingStyles={{}}
        loading={false}
        onClose={vi.fn<() => void>()}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        showCurrencyCode={false}
        showCurrencyIcon
        visible
      />,
    );

    expect(screen.getAllByText("USD")).toHaveLength(2);
    expect(screen.getByText("CAD")).toBeDefined();
  });

  it("does not restore insignificant crypto zeros trimmed by the conversion layer", () => {
    const cryptoData: ConversionPopupData = {
      ...CONVERSION_DATA,
      isStale: false,
      results: [
        {
          amount: 120,
          convertedAmount: "1.2",
          fractionDigits: 8,
          fromCurrency: "USD",
          rate: "0.01",
          sourceIndex: 0,
          status: "converted",
          toCurrency: "BTC",
        },
      ],
    };
    render(
      <ConversionPopup
        data={cryptoData}
        detections={DETECTIONS}
        error={null}
        floatingStyles={{}}
        loading={false}
        onClose={vi.fn<() => void>()}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        showCurrencyCode
        showCurrencyIcon
        visible
      />,
    );

    expect(screen.getByText("1.2")).toBeDefined();
    expect(screen.queryByText("1.20000000")).toBeNull();
  });
});

describe("useConversion", () => {
  it("sends only parsed amounts and currency codes, never the selected text", async () => {
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>(() =>
      Promise.resolve({
        success: true,
        data: { ...CONVERSION_DATA, warnings: [] },
      }),
    );
    vi.stubGlobal("browser", { runtime: { sendMessage } });
    const { result } = renderHook(() => useConversion());

    await act(async () => {
      await result.current.convert(DETECTIONS, ["JPY", "EUR"]);
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
    let requestCount = 0;
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>(() => {
      requestCount += 1;
      return requestCount === 1 ? firstResponse.promise : secondResponse.promise;
    });
    vi.stubGlobal("browser", { runtime: { sendMessage } });
    const { result } = renderHook(() => useConversion());
    let firstRequest = Promise.resolve();
    let secondRequest = Promise.resolve();

    act(() => {
      firstRequest = result.current.convert(DETECTIONS, ["JPY"]);
    });
    act(() => {
      secondRequest = result.current.convert(DETECTIONS, ["EUR"]);
    });

    await act(async () => {
      secondResponse.resolve(successfulConversionResponse(2_000));
      await secondRequest;
    });
    expect(result.current.data?.sourceTimestamp).toBe(2_000);

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
      request = result.current.convert(DETECTIONS, ["JPY"]);
    });
    act(() => {
      result.current.reset();
    });

    await act(async () => {
      response.resolve(successfulConversionResponse(3_000));
      await request;
    });
    expect(result.current).toMatchObject({
      data: null,
      error: null,
      loading: false,
    });
  });
});

function successfulConversionResponse(sourceTimestamp: number): unknown {
  return {
    data: { ...CONVERSION_DATA, sourceTimestamp, warnings: [] },
    success: true,
  };
}
