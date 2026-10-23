// @vitest-environment happy-dom

import type { CurrencyCode } from "@cl/currency";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DetectedCurrency } from "@/lib/currency-detection";
import type { CurrencyDropPlacement } from "@/lib/currency-order";
import * as i18n from "@/lib/i18n";
import type { ConversionResult } from "@/lib/rates";
import {
  ConversionPopup,
  type ConversionDismissReason,
  type ConversionPopupData,
  type ConversionSource,
} from "@/entrypoints/content/components/ConversionPopup";

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
  vi.restoreAllMocks();
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
        visible
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInstanceOf(HTMLDialogElement);
    expect(dialog.getAttribute("popover")).toBe("manual");
    expect((dialog as HTMLDialogElement).open).toBe(true);

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
        visible={false}
      />,
    );
    expect((dialog as HTMLDialogElement).open).toBe(false);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.pointerDown(document.body);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("uses a non-modal top-layer popover when the browser supports it", () => {
    const showPopover = vi.fn<(this: HTMLDialogElement) => void>(function showPopover() {
      this.querySelector<HTMLButtonElement>("button")?.focus();
    });
    const hidePopover = vi.fn<(this: HTMLDialogElement) => void>();
    const restorePopoverMethods = replaceDialogPopoverMethods(showPopover, hidePopover);
    let unmount: (() => void) | undefined;

    try {
      ({ unmount } = render(
        <ConversionPopup
          data={CONVERSION_DATA}
          detection={DETECTION}
          error={null}
          floatingStyles={{}}
          loading={false}
          locale="en"
          onClose={vi.fn<() => void>()}
          setFloating={vi.fn<(element: HTMLElement | null) => void>()}
          visible
        />,
      ));
      const dialog = document.querySelector("dialog");
      expect(dialog).toBeInstanceOf(HTMLDialogElement);
      expect(showPopover).toHaveBeenCalledOnce();
      expect(showPopover.mock.instances[0]).toBe(dialog);
      expect(document.activeElement).toBe(screen.getByLabelText("Amount"));

      unmount();
      unmount = undefined;
      expect(hidePopover).toHaveBeenCalledOnce();
      expect(hidePopover.mock.instances[0]).toBe(dialog);
    } finally {
      unmount?.();
      restorePopoverMethods();
    }
  });

  it("falls back to a modal top-layer dialog when showing a popover fails", () => {
    const showPopover = vi.fn<(this: HTMLDialogElement) => void>(() => {
      throw new DOMException("Popover unavailable", "NotSupportedError");
    });
    const restorePopoverMethods = replaceDialogPopoverMethods(
      showPopover,
      vi.fn<(this: HTMLDialogElement) => void>(),
    );
    let unmount: (() => void) | undefined;

    try {
      ({ unmount } = render(
        <ConversionPopup
          data={CONVERSION_DATA}
          detection={DETECTION}
          error={null}
          floatingStyles={{}}
          loading={false}
          locale="en"
          onClose={vi.fn<() => void>()}
          setFloating={vi.fn<(element: HTMLElement | null) => void>()}
          visible
        />,
      ));
      const dialog = screen.getByRole("dialog");
      if (!(dialog instanceof HTMLDialogElement)) {
        throw new TypeError("Expected a native dialog element");
      }
      expect(showPopover).toHaveBeenCalledOnce();
      expect(dialog.open).toBe(true);
      expect(dialog.hasAttribute("popover")).toBe(false);
      expect(document.activeElement).toBe(
        screen.getByRole("spinbutton", { name: "Amount" }),
      );
    } finally {
      unmount?.();
      restorePopoverMethods();
    }
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
        visible
      />,
    );

    expect(screen.getByRole("status", { name: "通貨を換算中" })).toBeDefined();
    const dialog = screen.getByRole("dialog");
    expect(dialog.hasAttribute("aria-live")).toBe(false);
    expect(dialog.style.inset).toBe("10px");
  });

  it("renders boundary loading and error states before a source is available", () => {
    const commonProps = {
      data: null,
      detection: null,
      floatingStyles: {},
      locale: "en" as const,
      onClose: vi.fn<() => void>(),
      setFloating: vi.fn<(element: HTMLElement | null) => void>(),
      visible: true,
    };
    const { rerender } = render(<ConversionPopup {...commonProps} error={null} loading />);

    expect(screen.getByRole("status", { name: "Converting currency" })).toBeDefined();

    rerender(
      <ConversionPopup {...commonProps} error="Background unavailable" loading={false} />,
    );
    expect(screen.getByText("Couldn’t focus the rates")).toBeDefined();
  });

  it("announces a failed target-order save", () => {
    render(
      <ConversionPopup
        data={CONVERSION_DATA}
        detection={DETECTION}
        error={null}
        floatingStyles={{}}
        loading={false}
        locale="ja"
        onClose={vi.fn<() => void>()}
        settingsSaveFailed
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        visible
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain("設定を保存できませんでした。");
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
        onReorderTarget={vi.fn<() => void>()}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        visible
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Conversion result" });
    const sourceSection = screen
      .getByRole("heading", { level: 3, name: "Original" })
      .closest("section");
    const convertedSection = screen
      .getByRole("heading", { level: 3, name: "Converted" })
      .closest("section");
    expect(document.activeElement).not.toBe(screen.getByRole("button", { name: "Close" }));
    expect(dialog.textContent).not.toContain("Currency Lens");
    expect(screen.queryByRole("img", { name: "Currency Lens" })).toBeNull();
    expect(screen.getByRole<HTMLInputElement>("spinbutton", { name: "Amount" }).value).toBe(
      "120",
    );
    expect(sourceSection?.textContent).not.toContain("18,900.00");
    expect(convertedSection?.textContent).toContain("18,900.00");
    expect(screen.queryByRole("button", { name: /^Reorder /u })).toBeNull();
    expect(convertedSection?.textContent).not.toContain("$120.00");
    expect(dialog.textContent).toContain("Rate unavailable");
    expect(dialog.textContent).toContain("at least 24 hours old");
    expect(convertedSection?.querySelector('[role="status"]')).toBe(
      screen.getByRole("status"),
    );
  });

  it("reorders converted currencies with dedicated handles only in edit mode", () => {
    const onReorderTarget =
      vi.fn<
        (
          sourceCurrency: CurrencyCode,
          targetCurrency: CurrencyCode,
          placement: CurrencyDropPlacement,
        ) => void
      >();
    render(
      <ConversionPopup
        data={CONVERSION_DATA}
        detection={DETECTION}
        error={null}
        floatingStyles={{}}
        loading={false}
        locale="en"
        onClose={vi.fn<() => void>()}
        onReorderTarget={onReorderTarget}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        targetCurrencies={["JPY", "EUR"]}
        targetEditing={{ onAdd: vi.fn<() => void>(), onRemove: vi.fn<() => void>() }}
        visible
      />,
    );

    expect(screen.queryByRole("button", { name: /^Reorder /u })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Edit conversion targets" }));

    const jpyHandle = screen.getByRole("button", {
      name: "Reorder JPY, position 1 of 2",
    });
    const eurHandle = screen.getByRole("button", {
      name: "Reorder EUR, position 2 of 2",
    });
    const jpyRow = jpyHandle.closest("li");
    expect(jpyHandle.querySelector('[data-currency-icon="JPY"]')).toBeNull();
    expect(
      jpyHandle.closest("li")?.querySelector('[data-currency-icon="JPY"]'),
    ).not.toBeNull();
    expect(screen.getByText("18,900.00")).toBeDefined();
    if (jpyRow === null) {
      throw new TypeError("Expected a converted currency row");
    }
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 20,
      height: 20,
      left: 0,
      right: 100,
      toJSON: () => ({}),
      top: 0,
      width: 100,
      x: 0,
      y: 0,
    });
    const dataTransfer = {
      dropEffect: "none",
      effectAllowed: "none",
      setData: vi.fn<(format: string, data: string) => void>(),
    };

    fireEvent.dragStart(eurHandle, { dataTransfer });
    const currentJpyRow = screen
      .getByRole("button", { name: "Reorder JPY, position 1 of 2" })
      .closest("li");
    if (currentJpyRow === null) {
      throw new TypeError("Expected the current converted currency row");
    }
    fireEvent(currentJpyRow, createDragEvent("dragover", dataTransfer, 1));
    expect(
      currentJpyRow.querySelector('[data-slot="currency-drop-indicator"]'),
    ).not.toBeNull();
    fireEvent(currentJpyRow, createDragEvent("drop", dataTransfer, 1));

    expect(onReorderTarget).toHaveBeenCalledWith("EUR", "JPY", "before");
  });

  it("keeps target identities mounted while only their amounts enter loading", () => {
    const getCurrencyDisplayName = vi.spyOn(i18n, "getCurrencyDisplayName");
    const onReorderTarget = vi.fn<() => void>();
    const targetCurrencies = ["JPY", "EUR"] as const;
    const targetCurrencySet: ReadonlySet<string> = new Set(targetCurrencies);
    const popupProps = {
      detection: DETECTION,
      error: null,
      floatingStyles: {},
      locale: "en" as const,
      onClose: vi.fn<() => void>(),
      onReorderTarget,
      setFloating: vi.fn<(element: HTMLElement | null) => void>(),
      targetCurrencies,
      visible: true,
    };
    const { rerender } = render(
      <ConversionPopup {...popupProps} data={CONVERSION_DATA} loading={false} />,
    );

    const staleAlert = screen.getByRole("status");
    const rateTimestamp = screen.getByText(/^Rates from /u);
    getCurrencyDisplayName.mockClear();
    rerender(<ConversionPopup {...popupProps} data={null} loading={false} />);

    const convertedSection = screen
      .getByRole("heading", { level: 3, name: "Converted" })
      .closest("section");
    expect(convertedSection?.getAttribute("aria-busy")).toBe("true");
    expect(
      convertedSection?.querySelectorAll(
        '[data-slot="currency-amount"] [aria-busy="true"], [data-slot="currency-amount"] [data-slot="skeleton"][aria-hidden="true"]',
      ),
    ).toHaveLength(2);
    expect(screen.getAllByRole("status", { name: "Converting currency" })).toHaveLength(1);
    expect(screen.getAllByRole("status")).toContain(staleAlert);
    expect(screen.getByText(/^Rates from /u)).toBe(rateTimestamp);

    rerender(<ConversionPopup {...popupProps} data={null} loading />);

    expect(convertedSection?.getAttribute("aria-busy")).toBe("true");
    expect(
      convertedSection?.querySelectorAll(
        '[data-slot="currency-amount"] [aria-busy="true"], [data-slot="currency-amount"] [data-slot="skeleton"][aria-hidden="true"]',
      ),
    ).toHaveLength(2);
    expect(screen.getAllByRole("status", { name: "Converting currency" })).toHaveLength(1);
    expect(screen.getAllByRole("status")).toContain(staleAlert);
    expect(screen.getByText(/^Rates from /u)).toBe(rateTimestamp);
    expect(
      getCurrencyDisplayName.mock.calls.filter(([currencyCode]) =>
        targetCurrencySet.has(currencyCode),
      ),
    ).toHaveLength(0);
  });

  it("edits the source amount and currency while keeping the same column order", async () => {
    const onSourceChange = vi.fn<(source: ConversionSource | null) => void>();
    const { rerender } = render(
      <ConversionPopup
        data={CONVERSION_DATA}
        detection={DETECTION}
        error={null}
        floatingStyles={{}}
        loading={false}
        locale="en"
        onClose={vi.fn<() => void>()}
        onSourceChange={onSourceChange}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        visible
      />,
    );

    const sourceSection = screen
      .getByRole("heading", { name: "Original" })
      .closest("section");
    const sourceRow = sourceSection?.querySelector('[data-slot="currency-value-row"]');
    const targetRow = document.querySelector('[data-currency-code="JPY"]');
    expect(readValueColumnOrder(sourceRow)).toEqual([
      "currency-identity",
      "currency-amount",
    ]);
    expect(readValueColumnOrder(targetRow)).toEqual([
      "currency-identity",
      "currency-amount",
    ]);
    expect(sourceRow?.querySelector('[data-currency-icon="USD"]')).not.toBeNull();
    expect(targetRow?.querySelector('[data-currency-icon="JPY"]')).not.toBeNull();
    expect(screen.getByRole("combobox", { name: "Currency" }).textContent).toContain(
      "US Dollar",
    );
    expect(targetRow?.textContent).toContain("Japanese Yen");

    fireEvent.change(screen.getByRole("spinbutton", { name: "Amount" }), {
      target: { value: "250.5" },
    });
    expect(onSourceChange).toHaveBeenLastCalledWith({
      index: 0,
      amount: 250.5,
      currencyCode: "USD",
      originalText: "$120.00",
    });

    await chooseCurrency("Currency", "EUR", "Euro");
    expect(onSourceChange).toHaveBeenLastCalledWith({
      index: 0,
      amount: 250.5,
      currencyCode: "EUR",
      originalText: "$120.00",
    });

    fireEvent.change(screen.getByRole("spinbutton", { name: "Amount" }), {
      target: { value: "" },
    });
    expect(screen.getByText("Enter an amount greater than 0.")).toBeDefined();
    expect(onSourceChange).toHaveBeenCalledTimes(3);
    expect(onSourceChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("heading", { name: "Converted" })).toBeDefined();
    expect(screen.getAllByText("-")).toHaveLength(2);
    expect(screen.queryByText("18,900.00")).toBeNull();

    rerender(
      <ConversionPopup
        data={CONVERSION_DATA}
        detection={{ ...DETECTION, currencyCode: "CAD" }}
        error={null}
        floatingStyles={{}}
        loading={false}
        locale="en"
        onClose={vi.fn<() => void>()}
        onSourceChange={onSourceChange}
        setFloating={vi.fn<(element: HTMLElement | null) => void>()}
        visible
      />,
    );
    expect(screen.getByRole<HTMLInputElement>("spinbutton", { name: "Amount" }).value).toBe(
      "",
    );
    expect(screen.getByRole("combobox", { name: "Currency" }).textContent).toContain("CAD");
    expect(screen.getByRole("heading", { name: "Converted" })).toBeDefined();
    expect(screen.getAllByText("-")).toHaveLength(2);
  });

  it("closes from Escape within the isolated card and from the document fallback", () => {
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
        visible
      />,
    );

    const amount = screen.getByRole("spinbutton", { name: "Amount" });
    fireEvent.keyDown(amount, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(amount, { key: "Escape" });
    expect(onClose).toHaveBeenCalledWith("escape");
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledWith("escape");

    onClose.mockClear();
    const cancelEvent = new Event("cancel", { cancelable: true });
    fireEvent(screen.getByRole("dialog"), cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(true);
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
        visible
      />,
    );

    fireEvent.keyDown(document, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
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
        visible
      />,
    );

    fireEvent.pointerDown(screen.getByRole("dialog"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("always shows each target's currency icon and ISO identity", () => {
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
        visible
      />,
    );

    expect(readTargetCode("JPY")).toContain("JPY");
    expect(readTargetCode("JPY")).toContain("Japanese Yen");
    expect(readTargetCode("EUR")).toContain("EUR");
    expect(readTargetCode("EUR")).toContain("Euro");
    expect(
      document.querySelector('[data-currency-code="JPY"] [data-currency-icon="JPY"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-currency-code="EUR"] [data-currency-icon="EUR"]'),
    ).not.toBeNull();
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
        visible
      />,
    );

    expect(document.querySelector('[data-currency-code="GBP"]')).toBeNull();
  });

  it("displays crypto results with exactly two decimal places", () => {
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
        visible
      />,
    );

    expect(screen.getByText("1.20")).toBeDefined();
    expect(screen.queryByText("1.2")).toBeNull();
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
        visible
      />,
    );

    expect(screen.getByText("No supported monetary amount was found.")).toBeDefined();
  });

  it("falls back safely when a converted amount cannot be formatted", () => {
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
        visible
      />,
    );

    expect(document.querySelector('[data-currency-icon="JPY"]')).not.toBeNull();
    expect(screen.getByText("not-a-number")).toBeDefined();
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
        visible
      />,
    );

    expect(screen.getByText("1.23")).toBeDefined();
  });
});

/** Temporarily adds the Popover API missing from happy-dom. */
function replaceDialogPopoverMethods(
  showPopover: (this: HTMLDialogElement) => void,
  hidePopover: (this: HTMLDialogElement) => void,
): () => void {
  const prototype = HTMLDialogElement.prototype;
  const showDescriptor = Object.getOwnPropertyDescriptor(prototype, "showPopover");
  const hideDescriptor = Object.getOwnPropertyDescriptor(prototype, "hidePopover");
  Object.defineProperties(prototype, {
    hidePopover: { configurable: true, value: hidePopover },
    showPopover: { configurable: true, value: showPopover },
  });

  return () => {
    restoreProperty(prototype, "showPopover", showDescriptor);
    restoreProperty(prototype, "hidePopover", hideDescriptor);
  };
}

/** Restores one prototype method whether it originally existed or not. */
function restoreProperty(
  target: object,
  property: string,
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor === undefined) {
    Reflect.deleteProperty(target, property);
    return;
  }
  Object.defineProperty(target, property, descriptor);
}

/** Supplies pointer coordinates that happy-dom's DragEvent constructor omits. */
function createDragEvent(
  type: "dragover" | "drop",
  dataTransfer: object,
  clientY: number,
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    clientY: { value: clientY },
    dataTransfer: { value: dataTransfer },
  });
  return event;
}

/** Selects a source currency through the visible searchable combobox. */
async function chooseCurrency(
  controlName: string,
  currencyCode: string,
  query = currencyCode,
): Promise<void> {
  const trigger = screen.getByRole("combobox", { name: controlName });
  fireEvent.click(trigger);
  const search = await screen.findByPlaceholderText("Code, name, or region");
  fireEvent.change(search, { target: { value: query } });
  fireEvent.click(
    await screen.findByRole("option", {
      name: new RegExp(`^${currencyCode}\\b`, "u"),
    }),
  );
  await waitFor(() => expect(trigger.textContent).toContain(currencyCode));
}

function readValueColumnOrder(row: Element | null | undefined): Array<string | null> {
  const content = row?.querySelector(':scope > [data-slot="currency-value-content"]');
  return [...(content?.children ?? [])].map((column) => column.getAttribute("data-slot"));
}

function readTargetCode(currencyCode: CurrencyCode): string | null | undefined {
  return document.querySelector(
    `[data-currency-code="${currencyCode}"] [data-slot="currency-identity"]`,
  )?.textContent;
}
