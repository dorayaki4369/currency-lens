// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RateChangeLegend, RateSummary } from "@/components/rates/RateSummary";
import type { RateChange } from "@/lib/rate-series";
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
        colorScheme="red-up"
        currencyCode="EUR"
        locale="ja"
        sinceLabel={null}
      />,
    );

    const summary = document.querySelector('[data-slot="rate-summary"]');
    expect(readAccessibleText(summary)).toBe("1 USD = 0.8621 EUR +0.0265 (+3.71%)");
    const arrow = screen.getByText("↑");
    expect(arrow.getAttribute("aria-hidden")).toBe("true");
    expect(arrow.style.color).toBe("var(--trend-red-text)");
  });

  it("uses a neutral arrow for an unchanged rate", () => {
    render(
      <RateSummary
        baseCurrency="USD"
        change={{ ...RISE, difference: 0, direction: "flat", percent: 0 }}
        colorScheme="green-up"
        currencyCode="EUR"
        locale="en"
        sinceLabel="since 7/22"
      />,
    );
    expect(screen.getByText("→").style.color).toBe("var(--trend-flat-text)");
    expect(readAccessibleText(document.body)).toContain("0.0000 (0.00%) since 7/22");
  });

  it("rolls the rate and its change toward the new values", () => {
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
      colorScheme: "red-up",
      currencyCode: "EUR",
      locale: "en",
      sinceLabel: null,
    } as const;
    const { rerender } = render(<RateSummary {...props} change={RISE} />);
    const summary = document.querySelector('[data-slot="rate-summary"]');
    expect(readRollDirections(summary)).toEqual([undefined, undefined, undefined]);

    rerender(<RateSummary {...props} change={fall} />);
    expect(readRollDirections(summary)).toEqual(["down", "down", "down"]);
    expect(readAccessibleText(summary)).toBe("1 USD = 0.8500 EUR −0.0100 (−1.16%)");

    rerender(<RateSummary {...props} change={RISE} />);
    expect(readRollDirections(summary)).toEqual(["up", "up", "up"]);
  });

  it("swaps the numbers without rolling when reduced motion is requested", () => {
    stubReducedMotion(true);
    const props = {
      baseCurrency: "USD",
      colorScheme: "red-up",
      currencyCode: "EUR",
      locale: "en",
      sinceLabel: null,
    } as const;
    const { rerender } = render(<RateSummary {...props} change={RISE} />);
    rerender(<RateSummary {...props} change={{ ...RISE, percent: 1 }} />);

    const summary = document.querySelector('[data-slot="rate-summary"]');
    expect(readRollDirections(summary)).toEqual([undefined, undefined, undefined]);
    expect(readAccessibleText(summary)).toContain("(+1.00%)");
  });
});

describe("RateChangeLegend", () => {
  it("lists each line with its color, change, and a later start when needed", () => {
    render(
      <RateChangeLegend
        caption="対 USD の変化率"
        colorScheme="red-up"
        items={[
          {
            change: { ...RISE, direction: "down", percent: -4.9 },
            color: { line: "var(--rate-series-1-line)", tag: "x" },
            currencyCode: "JPY",
            sinceLabel: null,
          },
          {
            change: RISE,
            color: { line: "var(--rate-series-2-line)", tag: "x" },
            currencyCode: "EUR",
            sinceLabel: "7/22 から",
          },
          {
            change: null,
            color: { line: "var(--rate-series-3-line)", tag: "x" },
            currencyCode: "GBP",
            sinceLabel: null,
          },
          {
            change: RISE,
            color: { line: "var(--rate-series-4-line)", tag: "x" },
            currencyCode: "CAD",
            sinceLabel: null,
          },
        ]}
        locale="ja"
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
    // The visually hidden label carries the plain value inside the colored number.
    expect(screen.getByText("−4.90%").closest<HTMLElement>("[style]")?.style.color).toBe(
      "var(--trend-blue-text)",
    );
    expect(screen.getByRole("list").style.gridTemplateColumns).toBe(
      "repeat(4, minmax(0, 1fr))",
    );
  });
});
