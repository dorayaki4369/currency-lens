// @vitest-environment happy-dom

import type { CurrencyCode } from "@cl/currency";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TargetTrend } from "@/components/rates/TargetTrend";
import { ChartColorsProvider } from "@/stores/chart-colors";
import {
  RateHistoryProvider,
  type RateHistoryPreview,
  useRateHistoryStore,
} from "@/stores/rate-history";
import { POPUP_HISTORY } from "@/test/popup";

const FAVORITES: readonly CurrencyCode[] = ["JPY", "EUR"];

afterEach(cleanup);

/** Shows the stored selection, which a trend sets before it opens the rates. */
function StoredSelection() {
  return <output>{useRateHistoryStore((state) => state.selection)}</output>;
}

/** Renders one trend cell inside a fresh history provider. */
function renderTrend(
  currencyCode: CurrencyCode,
  preview: RateHistoryPreview = POPUP_HISTORY,
) {
  const onOpenRates = vi.fn<() => void>();
  render(
    <RateHistoryProvider preview={preview}>
      <ChartColorsProvider preview={{}}>
        <TargetTrend
          currencyCode={currencyCode}
          favorites={FAVORITES}
          locale="en"
          onOpenRates={onOpenRates}
          sourceCurrency="USD"
        />
        <StoredSelection />
      </ChartColorsProvider>
    </RateHistoryProvider>,
  );
  return onOpenRates;
}

describe("TargetTrend", () => {
  it("draws the past month against the source and opens that currency's rates", async () => {
    const onOpenRates = renderTrend("JPY");
    const trend = screen.getByRole("button", { name: "Open JPY rates" });
    // History loads after the first paint; until then the trend is a dashed placeholder.
    expect(trend.querySelector('[data-slot="sparkline-placeholder"]')).not.toBeNull();
    await vi.waitFor(() => expect(trend.querySelectorAll("path")).toHaveLength(2));
    expect(trend.querySelectorAll("path")[1]?.style.stroke).toBe("var(--trend-green-line)");
    expect(screen.getByRole("status").textContent).toBe("*");

    fireEvent.click(trend);
    expect(screen.getByRole("status").textContent).toBe("JPY");
    expect(onOpenRates).toHaveBeenCalledOnce();
  });

  it("leaves an empty cell for a target that equals the source", () => {
    renderTrend("USD");

    expect(screen.queryByRole("button")).toBeNull();
    expect(document.querySelector('[data-slot="sparkline-spacer"]')).not.toBeNull();
  });

  it("draws a flat placeholder without history", async () => {
    renderTrend("EUR", { kind: "error" });
    const trend = screen.getByRole("button", { name: "Open EUR rates" });

    await vi.waitFor(() =>
      expect(trend.querySelector('[data-slot="sparkline-placeholder"]')).not.toBeNull(),
    );
  });
});
