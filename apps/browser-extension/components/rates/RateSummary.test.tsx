// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RateChangeLegend, RateSummary } from "@/components/rates/RateSummary";
import type { RateChange } from "@/lib/rate-series";
import { getTrendPalette } from "@/lib/trend-colors";

afterEach(cleanup);

const JAPANESE = getTrendPalette("red-up");
// A light user choice: it may color the arrow but never the text.
const YELLOW_UP = getTrendPalette("red-up", { up: "#e3b63f" });

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
        periodLabel="過去1か月"
      />,
    );

    const summary = document.querySelector('[data-slot="rate-summary"]');
    expect(summary?.textContent).toContain("1 USD = 0.8621 EUR");
    expect(summary?.textContent).toContain("+0.0265 (+3.71%) 過去1か月");
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
        palette={getTrendPalette("green-up")}
        periodLabel="since 7/22"
      />,
    );
    expect(
      document.querySelector<SVGElement>('[data-slot="trend-arrow"]')?.style.color,
    ).toBe("var(--trend-flat-text)");
    expect(document.body.textContent).toContain("0.0000 (0.00%) since 7/22");
  });
});

describe("RateChangeLegend", () => {
  it("lists each line with its color, change, and a later start when needed", () => {
    render(
      <RateChangeLegend
        caption="対 USD の変化率（過去1か月）"
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
        palette={JAPANESE}
      />,
    );

    expect(screen.getByText("対 USD の変化率（過去1か月）")).toBeDefined();
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "JPY−4.90%",
      "EUR+3.71%7/22 から",
      "GBPデータなし",
      "CAD+3.71%",
    ]);
    const arrows = [
      ...document.querySelectorAll<SVGElement>('[data-slot="trend-arrow"]'),
    ].map((arrow) => [arrow.dataset["direction"], arrow.style.color]);
    expect(arrows[0]).toEqual(["down", "var(--trend-blue-text)"]);
    expect(arrows[1]).toEqual(["up", "var(--trend-red-text)"]);
    // The percentage keeps the normal text color.
    expect(screen.getByText("−4.90%").getAttribute("style")).toBeNull();
    expect(screen.getByRole("list").style.gridTemplateColumns).toBe(
      "repeat(4, minmax(0, 1fr))",
    );
  });
});
