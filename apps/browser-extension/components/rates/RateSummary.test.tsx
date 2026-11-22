// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RateChangeLegend, RateSummary } from "@/components/rates/RateSummary";
import type { RateChange } from "@/lib/rate-series";
import { getTrendPalette } from "@/lib/trend-colors";
import { readAccessibleText } from "@/test/accessible-text";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Reports whether reduced motion is requested, as the rolling numbers ask. */
function stubReducedMotion(reduce: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduce, media: query }));
}

/** Lists the roll direction of every rolling number inside an element. */
function readRollDirections(element: Element | null): (string | undefined)[] {
  return [
    ...(element?.querySelectorAll<HTMLElement>('[data-slot="animated-number"]') ?? []),
  ].map((number) => number.dataset["direction"]);
}

const DEFAULT_PALETTE = getTrendPalette();
// A light user choice: it may color the arrow but never the text.
const YELLOW_UP = getTrendPalette({ up: "#e3b63f" });

const RISE: RateChange = {
  difference: 0.0265,
  direction: "up",
  first: { time: 0, value: 0.8356 },
  last: { time: 1, value: 0.8621 },
  measuredFromPeriodStart: true,
  percent: 3.714,
};

describe("RateSummary", () => {
  it("states the latest cross rate and the period change in the trend color", () => {
    render(
      <RateSummary
        baseCurrency="USD"
        change={RISE}
        currencyCode="EUR"
        locale="ja"
        palette={YELLOW_UP}
        sinceLabel={null}
      />,
    );

    const summary = document.querySelector('[data-slot="rate-summary"]');
    expect(readAccessibleText(summary)).toBe("1 USD = 0.8621 EUR +0.0265 (+3.71%)");
    const arrow = document.querySelector<SVGElement>('[data-slot="trend-arrow"]');
    expect(arrow?.getAttribute("aria-hidden")).toBe("true");
    expect(arrow?.dataset["direction"]).toBe("up");
    expect(arrow?.style.color).toBe("#e3b63f");
  });

  it("uses a neutral arrow for an unchanged rate", () => {
    render(
      <RateSummary
        baseCurrency="USD"
        change={{ ...RISE, difference: 0, direction: "flat", percent: 0 }}
        currencyCode="EUR"
        locale="en"
        palette={DEFAULT_PALETTE}
        sinceLabel="since 7/22"
      />,
    );
    expect(
      document.querySelector<SVGElement>('[data-slot="trend-arrow"]')?.style.color,
    ).toBe("var(--trend-flat-text)");
    expect(readAccessibleText(document.body)).toContain("0.0000 (0.00%) since 7/22");
  });

  it("rolls the change toward the new values while the rate switches in place", () => {
    stubReducedMotion(false);
    const fall: RateChange = {
      ...RISE,
      difference: -0.01,
      direction: "down",
      last: { time: 1, value: 0.85 },
      percent: -1.16,
    };
    const props = {
      baseCurrency: "USD",
      currencyCode: "EUR",
      locale: "en",
      palette: DEFAULT_PALETTE,
      sinceLabel: null,
    } as const;
    const { rerender } = render(<RateSummary {...props} change={RISE} />);
    const summary = document.querySelector('[data-slot="rate-summary"]');
    expect(readRollDirections(summary)).toEqual([undefined, undefined]);

    rerender(<RateSummary {...props} change={fall} />);
    expect(readRollDirections(summary)).toEqual(["down", "down"]);
    expect(readAccessibleText(summary)).toBe("1 USD = 0.8500 EUR −0.0100 (−1.16%)");

    rerender(<RateSummary {...props} change={RISE} />);
    expect(readRollDirections(summary)).toEqual(["up", "up"]);
  });

  it("swaps the numbers without rolling when reduced motion is requested", () => {
    stubReducedMotion(true);
    const props = {
      baseCurrency: "USD",
      currencyCode: "EUR",
      locale: "en",
      palette: DEFAULT_PALETTE,
      sinceLabel: null,
    } as const;
    const { rerender } = render(<RateSummary {...props} change={RISE} />);
    rerender(<RateSummary {...props} change={{ ...RISE, percent: 1 }} />);

    const summary = document.querySelector('[data-slot="rate-summary"]');
    expect(readRollDirections(summary)).toEqual([undefined, undefined]);
    expect(readAccessibleText(summary)).toContain("(+1.00%)");
  });
});

describe("RateChangeLegend", () => {
  it("lists each line with its color, change, and a later start when needed", () => {
    render(
      <RateChangeLegend
        caption="対 USD の変化率"
        items={[
          {
            change: { ...RISE, direction: "down", percent: -4.9 },
            color: { line: "var(--rate-series-1-line)", tag: "x", tagText: "#fff" },
            currencyCode: "JPY",
            sinceLabel: null,
          },
          {
            change: RISE,
            color: { line: "var(--rate-series-2-line)", tag: "x", tagText: "#fff" },
            currencyCode: "EUR",
            sinceLabel: "7/22 から",
          },
          {
            change: null,
            color: { line: "var(--rate-series-3-line)", tag: "x", tagText: "#fff" },
            currencyCode: "GBP",
            sinceLabel: null,
          },
          {
            change: RISE,
            color: { line: "var(--rate-series-4-line)", tag: "x", tagText: "#fff" },
            currencyCode: "CAD",
            sinceLabel: null,
          },
        ]}
        locale="ja"
        palette={DEFAULT_PALETTE}
      />,
    );

    expect(screen.getByText("対 USD の変化率")).toBeDefined();
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => readAccessibleText(item))).toEqual([
      "JPY−4.90%",
      "EUR+3.71%7/22 から",
      "GBPデータなし",
      "CAD+3.71%",
    ]);
    const arrows = [
      ...document.querySelectorAll<SVGElement>('[data-slot="trend-arrow"]'),
    ].map((arrow) => [arrow.dataset["direction"], arrow.style.color]);
    expect(arrows[0]).toEqual(["down", "var(--trend-red-text)"]);
    expect(arrows[1]).toEqual(["up", "var(--trend-green-text)"]);
    // The percentage keeps the normal text color; its hidden label carries the plain value.
    expect(
      screen
        .getByText("−4.90%")
        .closest('[data-slot="animated-number"]')
        ?.parentElement?.getAttribute("style"),
    ).toBeNull();
    expect(screen.getByRole("list").style.gridTemplateColumns).toBe(
      "repeat(4, minmax(0, 1fr))",
    );
  });
});
