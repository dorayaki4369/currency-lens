// @vitest-environment happy-dom

import type { CurrencyCode } from "@cl/currency";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RatesScreen, type RatesScreenProps } from "@/components/rates/RatesScreen";
import {
  RateHistoryProvider,
  type RateHistoryPreview,
  useRateHistoryStore,
} from "@/stores/rate-history";
import { readAccessibleText } from "@/test/accessible-text";
import {
  getSegmentedThumb,
  POPUP_HISTORY,
  readPopupMessageType,
  stubPopupBrowser,
} from "@/test/popup";

const RATE_TIME = { isStale: false, sourceTimestamp: 1_753_000_000_000 };
const FAVORITES: readonly CurrencyCode[] = ["JPY", "EUR", "GBP"];

// Daily points carry their local date, so the dates below assume a fixed time zone.
beforeEach(() => {
  vi.stubEnv("TZ", "America/New_York");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** Chooses a stored selection from outside the screen, as a target trend does. */
function SelectionSetter({ selection }: { readonly selection: CurrencyCode }) {
  const setSelection = useRateHistoryStore((state) => state.setSelection);
  return (
    <button onClick={() => setSelection(selection)} type="button">
      Choose {selection}
    </button>
  );
}

/** Renders the screen inside a fresh history provider. */
function renderRates(
  props: Partial<RatesScreenProps> = {},
  // Null requests history from the background instead of a fixed preview.
  preview: RateHistoryPreview | null = POPUP_HISTORY,
) {
  const onBaseCurrencyChange = vi.fn<(currencyCode: CurrencyCode) => void>();
  const view = render(
    <RateHistoryProvider preview={preview ?? undefined}>
      <SelectionSetter selection="CHF" />
      <RatesScreen
        baseCurrency="USD"
        favorites={FAVORITES}
        locale="en"
        onBaseCurrencyChange={onBaseCurrencyChange}
        rateTime={RATE_TIME}
        {...props}
      />
    </RateHistoryProvider>,
  );
  return { ...view, onBaseCurrencyChange };
}

describe("RatesScreen", () => {
  it("starts at one month of every target's change against the base", async () => {
    renderRates();
    await screen.findByRole("slider", { name: "Change against USD chart, past month" });

    expect(screen.getByRole("heading", { level: 2, name: "Base" })).toBeDefined();
    expect(screen.getByRole("heading", { level: 2, name: "Rates" })).toBeDefined();
    expect(screen.getByRole("combobox", { name: "Base" }).textContent).toContain("USD");
    expect(
      within(screen.getByRole("radiogroup", { name: "Currency to show" }))
        .getAllByRole("radio")
        .map((item) => item.textContent),
    ).toEqual(["ALL", "JPY", "EUR", "GBP"]);
    expect(screen.getByRole("radio", { name: "1M" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(screen.getAllByRole("listitem").map((item) => readAccessibleText(item))).toEqual(
      ["JPY+5.27%", "EUR−3.37%", "GBP+0.54%since 7/25"],
    );
    expect(
      screen.getByRole("slider", { name: "Change against USD chart, past month" }),
    ).toBeDefined();
    expect(screen.getByRole("link", { name: "Open Exchange Rates" })).toBeDefined();
  });

  it("nests its headings and keeps the base list inside a conversion card", async () => {
    const { onBaseCurrencyChange } = renderRates({
      headingLevel: 3,
      portalled: false,
      rateTime: null,
    });

    expect(screen.getByRole("heading", { level: 3, name: "Base" })).toBeDefined();
    expect(screen.getByRole("heading", { level: 3, name: "Rates" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Open Exchange Rates" })).toBeNull();

    const trigger = screen.getByRole("combobox", { name: "Base" });
    fireEvent.click(trigger);
    const search = await screen.findByPlaceholderText("Code, name, or region");
    expect(trigger.parentElement?.contains(search)).toBe(true);
    fireEvent.change(search, { target: { value: "Euro" } });
    fireEvent.click(await screen.findByRole("option", { name: /^EUR\b/u }));
    expect(onBaseCurrencyChange).toHaveBeenCalledWith("EUR");
  });

  it("shows one cross rate and keeps its summary while hourly history loads", async () => {
    renderRates();
    await screen.findByRole("slider", { name: "Change against USD chart, past month" });
    fireEvent.click(screen.getByRole("radio", { name: "JPY" }));

    const summary = document.querySelector('[data-slot="rate-summary"]');
    expect(readAccessibleText(summary)).toBe("1 USD = 149.75 JPY +7.50 (+5.27%)");
    const thumb = getSegmentedThumb("Period");

    fireEvent.click(screen.getByRole("radio", { name: "1D" }));
    expect(screen.getByRole("status", { name: "Loading rate history" })).toBeDefined();
    expect(document.querySelector('[data-slot="rate-summary"]')).toBe(summary);
    await screen.findByRole("slider", { name: "USD to JPY chart, past day" });
    expect(readAccessibleText(summary)).toContain("−2.40 (−1.61%)");
    expect(getSegmentedThumb("Period")).toBe(thumb);

    fireEvent.click(screen.getByRole("radio", { name: "GBP" }));
    expect(screen.getByText(/^Rate history isn’t available yet\./u)).toBeDefined();
  });

  it("shows every target when the stored selection is not among them", () => {
    renderRates();
    fireEvent.click(screen.getByRole("button", { name: "Choose CHF" }));

    expect(
      screen.getByRole("radio", { name: "All currencies" }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("explains when only the base itself is a target", () => {
    renderRates({ favorites: ["USD"] });

    expect(
      screen.getByText("Add a conversion target other than USD to see its rates."),
    ).toBeDefined();
    expect(screen.queryByRole("radiogroup", { name: "Period" })).toBeNull();
  });

  it.each([
    [{ kind: "empty" } as const, /^Rate history isn’t available yet\./u],
    [{ kind: "error" } as const, /^Couldn’t load the rate history\./u],
  ])(
    "explains a %o history state while keeping the period choice",
    async (preview, text) => {
      renderRates({}, preview);

      expect(await screen.findByText(text)).toBeDefined();
      expect(screen.getByRole("radiogroup", { name: "Period" })).toBeDefined();
      expect(screen.queryByRole("slider")).toBeNull();
    },
  );

  it("keeps the chart footprint while history loads", () => {
    renderRates({}, { kind: "loading" });

    expect(screen.getByRole("status", { name: "Loading rate history" })).toBeDefined();
  });

  it("requests a failed history window again from the retry button", async () => {
    let attempts = 0;
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) => {
      expect(readPopupMessageType(message)).toBe("GET_RATE_HISTORY");
      attempts += 1;
      return attempts === 1
        ? Promise.resolve({ error: "Rate history API returned HTTP 503", success: false })
        : Promise.resolve({ data: POPUP_HISTORY.daily, success: true });
    });
    stubPopupBrowser(sendMessage);
    renderRates({}, null);

    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(3));
    expect(sendMessage).toHaveBeenLastCalledWith({
      payload: { resolution: "daily", symbols: ["JPY", "EUR", "GBP"] },
      type: "GET_RATE_HISTORY",
    });
  });

  it("dates today's point from the current time before rates arrive", async () => {
    vi.spyOn(Date, "now").mockReturnValue(RATE_TIME.sourceTimestamp);
    renderRates({ rateTime: null });

    expect(
      await screen.findByRole("slider", { name: "Change against USD chart, past month" }),
    ).toBeDefined();
    expect(Date.now).toHaveBeenCalled();
  });
});
