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
import type { ConversionResult } from "../lib/rates";
import {
  ConversionPopup,
  type ConversionDismissReason,
  type ConversionPopupData,
} from "../entrypoints/content/components/ConversionPopup";
import { useConversion } from "../entrypoints/content/hooks/useConversion";

const DETECTION: DetectedCurrency = {
  amount: 120,
  currencyCode: "USD",
  index: 0,
  originalText: "$120.00",
};

const CONVERTED_RESULT: Extract<ConversionResult, { status: "converted" }> = {
  amount: 120,
  convertedAmount: "18900",
  fractionDigits: 0,
  fromCurrency: "USD",
  rate: "157.5",
  sourceIndex: 0,
  status: "converted",
  toCurrency: "JPY",
};

const CONVERSION_DATA: ConversionPopupData = {
  base: "USD",
  fetchedAt: 1_753_000_000_000,
  isStale: true,
  results: [
    CONVERTED_RESULT,
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
  it("does not render or register dismissal behavior while hidden", () => {
    const onClose = vi.fn<(reason: ConversionDismissReason) => void>();
    const { rerender } = render(
      <ConversionPopup
        data={null}
        detection={null}
        error={null}
        floatingStyles={{}}
        loading={false}
        locale="en"
        onClose={onClose}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        showCurrencyCode
        showCurrencyIcon
        visible={false}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    rerender(
      <ConversionPopup
        data={null}
        detection={null}
        error={null}
        floatingStyles={{}}
        loading={false}
        locale="en"
        onClose={onClose}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        showCurrencyCode
        showCurrencyIcon
        visible
      />,
    );
    expect(screen.getByRole("dialog")).toBeDefined();

    rerender(
      <ConversionPopup
        data={null}
        detection={null}
        error={null}
        floatingStyles={{}}
        loading={false}
        locale="en"
        onClose={onClose}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        showCurrencyCode
        showCurrencyIcon
        visible={false}
      />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.pointerDown(document.body);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows a localized loading state before conversion completes", () => {
    render(
      <ConversionPopup
        data={null}
        detection={DETECTION}
        error={null}
        floatingStyles={{ inset: "10px" }}
        loading
        locale="ja"
        onClose={vi.fn<() => void>()}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        showCurrencyCode
        showCurrencyIcon
        visible
      />,
    );

    expect(screen.getByRole("status", { name: "通貨を換算中" })).toBeDefined();
    expect(screen.getByRole("dialog").style.inset).toBe("10px");
  });

  it("groups every target under its source and explains stale or missing rates", () => {
    render(
      <ConversionPopup
        data={CONVERSION_DATA}
        detection={DETECTION}
        error={null}
        floatingStyles={{}}
        loading={false}
        locale="en"
        onClose={vi.fn<() => void>()}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        showCurrencyCode
        showCurrencyIcon
        visible
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Currency Lens" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Close Currency Lens" }),
    );
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
        detection={DETECTION}
        error={null}
        floatingStyles={{}}
        loading={false}
        locale="en"
        onClose={onClose}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        showCurrencyCode
        showCurrencyIcon
        visible
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledWith("escape");
  });

  it("ignores unrelated keys and closes from its button", () => {
    const onClose = vi.fn<(reason: ConversionDismissReason) => void>();
    render(
      <ConversionPopup
        data={CONVERSION_DATA}
        detection={DETECTION}
        error={null}
        floatingStyles={{}}
        loading={false}
        locale="en"
        onClose={onClose}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        showCurrencyCode
        showCurrencyIcon
        visible
      />,
    );

    fireEvent.keyDown(document, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Close Currency Lens" }));
    expect(onClose).toHaveBeenCalledWith("close-button");
  });

  it("preserves the outside click target by reporting a distinct dismissal reason", () => {
    const onClose = vi.fn<(reason: ConversionDismissReason) => void>();
    render(
      <>
        <button type="button">Outside control</button>
        <ConversionPopup
          data={CONVERSION_DATA}
          detection={DETECTION}
          error={null}
          floatingStyles={{}}
          loading={false}
          locale="en"
          onClose={onClose}
          setFloating={vi.fn<(element: HTMLElement | null) => void>()}
          showCurrencyCode
          showCurrencyIcon
          visible
        />
      </>,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside control" }));
    expect(onClose).toHaveBeenCalledWith("outside-pointer");
  });

  it("does not dismiss for a pointer event inside the card", () => {
    const onClose = vi.fn<(reason: ConversionDismissReason) => void>();
    render(
      <ConversionPopup
        data={CONVERSION_DATA}
        detection={DETECTION}
        error={null}
        floatingStyles={{}}
        loading={false}
        locale="en"
        onClose={onClose}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        showCurrencyCode
        showCurrencyIcon
        visible
      />,
    );

    fireEvent.pointerDown(screen.getByRole("dialog"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps a target currency identifiable when both display preferences are off", () => {
    render(
      <ConversionPopup
        data={CONVERSION_DATA}
        detection={DETECTION}
        error={null}
        floatingStyles={{}}
        loading={false}
        locale="en"
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
        detection={DETECTION}
        error={null}
        floatingStyles={{}}
        loading={false}
        locale="en"
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

  it("can show only a non-colliding currency mark", () => {
    const singleResultData: ConversionPopupData = {
      ...CONVERSION_DATA,
      isStale: false,
      results: [CONVERSION_DATA.results[0]!],
    };
    render(
      <ConversionPopup
        data={singleResultData}
        detection={DETECTION}
        error={null}
        floatingStyles={{}}
        loading={false}
        locale="en"
        onClose={vi.fn<() => void>()}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        showCurrencyCode={false}
        showCurrencyIcon
        visible
      />,
    );

    expect(screen.queryByText("JPY")).toBeNull();
    expect(screen.getByText("¥")).toBeDefined();
    expect(screen.queryByText(/24 hours/u)).toBeNull();
  });

  it("ignores conversion results belonging to any later source amount", () => {
    const mixedSourceData: ConversionPopupData = {
      ...CONVERSION_DATA,
      isStale: false,
      results: [
        CONVERSION_DATA.results[0]!,
        { ...CONVERSION_DATA.results[0]!, sourceIndex: 1, toCurrency: "GBP" },
      ],
    };
    render(
      <ConversionPopup
        data={mixedSourceData}
        detection={DETECTION}
        error={null}
        floatingStyles={{}}
        loading={false}
        locale="en"
        onClose={vi.fn<() => void>()}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        showCurrencyCode
        showCurrencyIcon
        visible
      />,
    );

    expect(screen.queryByText("GBP")).toBeNull();
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
        detection={DETECTION}
        error={null}
        floatingStyles={{}}
        loading={false}
        locale="en"
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

  it("explains when no conversion target has been configured", () => {
    render(
      <ConversionPopup
        data={null}
        detection={DETECTION}
        error="MISSING_CONVERSION_TARGET"
        floatingStyles={{}}
        loading={false}
        locale="en"
        onClose={vi.fn<() => void>()}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        showCurrencyCode
        showCurrencyIcon
        visible
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "Add at least one conversion target",
    );
  });

  it("shows a retryable error without leaking the background message", () => {
    render(
      <ConversionPopup
        data={null}
        detection={DETECTION}
        error="internal background detail"
        floatingStyles={{}}
        loading={false}
        locale="en"
        onClose={vi.fn<() => void>()}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        showCurrencyCode
        showCurrencyIcon
        visible
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Couldn’t focus the rates");
    expect(alert.textContent).toContain("Try selecting the price again");
    expect(alert.textContent).not.toContain("internal background detail");
  });

  it.each([
    ["data", null, DETECTION],
    ["detection", CONVERSION_DATA, null],
  ])("shows the empty state when %s is absent", (_description, data, detection) => {
    render(
      <ConversionPopup
        data={data}
        detection={detection}
        error={null}
        floatingStyles={{}}
        loading={false}
        locale="en"
        onClose={vi.fn<() => void>()}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        showCurrencyCode
        showCurrencyIcon
        visible
      />,
    );

    expect(screen.getByText("No supported monetary amount was found.")).toBeDefined();
  });

  it("falls back safely when currency formatting fails", () => {
    vi.spyOn(Intl.NumberFormat.prototype, "formatToParts").mockImplementation(() => {
      throw new Error("Intl currency formatting failed");
    });
    const malformedBoundaryData: ConversionPopupData = {
      ...CONVERSION_DATA,
      isStale: false,
      results: [
        {
          ...CONVERTED_RESULT,
          convertedAmount: "not-a-number",
        },
      ],
    };
    render(
      <ConversionPopup
        data={malformedBoundaryData}
        detection={DETECTION}
        error={null}
        floatingStyles={{}}
        loading={false}
        locale="en"
        onClose={vi.fn<() => void>()}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        showCurrencyCode
        showCurrencyIcon
        visible
      />,
    );

    expect(screen.getByText("J")).toBeDefined();
    expect(screen.getByText("not-a-number")).toBeDefined();
  });

  it("falls back to the first code character when Intl omits a currency part", () => {
    const formatToParts = vi
      .spyOn(Intl.NumberFormat.prototype, "formatToParts")
      .mockReturnValue([{ type: "integer", value: "0" }]);
    render(
      <ConversionPopup
        data={{
          ...CONVERSION_DATA,
          isStale: false,
          results: [CONVERSION_DATA.results[0]!],
        }}
        detection={DETECTION}
        error={null}
        floatingStyles={{}}
        loading={false}
        locale="en"
        onClose={vi.fn<() => void>()}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        showCurrencyCode={false}
        showCurrencyIcon
        visible
      />,
    );

    expect(formatToParts).toHaveBeenCalled();
    expect(screen.getByText("J")).toBeDefined();
  });

  it("rounds a value when it has more significant decimals than requested", () => {
    const roundedData: ConversionPopupData = {
      ...CONVERSION_DATA,
      isStale: false,
      results: [
        {
          ...CONVERTED_RESULT,
          convertedAmount: "1.2345",
          fractionDigits: 2,
        },
      ],
    };
    render(
      <ConversionPopup
        data={roundedData}
        detection={DETECTION}
        error={null}
        floatingStyles={{}}
        loading={false}
        locale="en"
        onClose={vi.fn<() => void>()}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        showCurrencyCode
        showCurrencyIcon
        visible
      />,
    );

    expect(screen.getByText("1.23")).toBeDefined();
  });
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
      Promise.resolve({
        success: true,
        data: { ...CONVERSION_DATA, warnings: [] },
      }),
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
      firstRequest = result.current.convert(DETECTION, ["JPY"]);
    });
    act(() => {
      secondRequest = result.current.convert(DETECTION, ["EUR"]);
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
      request = result.current.convert(DETECTION, ["JPY"]);
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

function successfulConversionResponse(sourceTimestamp: number): unknown {
  return {
    data: { ...CONVERSION_DATA, sourceTimestamp, warnings: [] },
    success: true,
  };
}
