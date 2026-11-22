// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RateChart, type RateChartSeries } from "@/components/rates/RateChart";
import type { RateSeries } from "@/lib/rate-series";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const DAY_MS = 86_400_000;
const START = Date.parse("2026-10-22T00:00:00.000Z");
const RED = { line: "var(--trend-red-line)", tag: "var(--trend-red-tag)" };
const INDIGO = { line: "var(--rate-series-1-line)", tag: "var(--rate-series-1-tag)" };
const AMBER = { line: "var(--rate-series-2-line)", tag: "var(--rate-series-2-tag)" };

/** Builds daily points from plain values. */
function daily(values: readonly (number | null)[]): RateSeries {
  return values.map((value, index) => ({ time: START + index * DAY_MS, value }));
}

/** Renders a single-currency chart of daily rates. */
function renderRateChart(series: readonly RateChartSeries[], mode: "percent" | "rate") {
  return render(
    <RateChart
      area={mode === "rate"}
      label="Chart"
      locale="en"
      mode={mode}
      period="1M"
      series={series}
    />,
  );
}

/** Reads the hidden label that sets the right axis's width. */
function readAxisWidthSample(): string | null | undefined {
  return document.querySelector('[data-slot="rate-chart-y-axis"]')?.firstElementChild
    ?.firstElementChild?.textContent;
}

describe("RateChart", () => {
  it("draws the line, gradient area, axis tag, ticks, and dates for one rate", () => {
    renderRateChart(
      [{ code: "JPY", color: RED, points: daily([150, 151, 149, 152]) }],
      "rate",
    );

    const chart = screen.getByRole("slider", { name: "Chart" });
    expect(chart.getAttribute("aria-valuemax")).toBe("3");
    expect(chart.getAttribute("aria-valuenow")).toBe("3");
    expect(chart.getAttribute("aria-valuetext")).toBe("Oct 25, 2026: JPY 152.00");
    const paths = chart.querySelectorAll("path");
    expect(paths).toHaveLength(2);
    expect(paths[0]?.getAttribute("fill")).toMatch(/^url\(#rate-area-/u);
    expect(paths[1]?.style.stroke).toBe(RED.line);
    const tag = document.querySelector<HTMLElement>('[data-slot="rate-chart-tag"]');
    expect(tag?.textContent).toBe("152.00");
    expect(tag?.style.backgroundColor).toBe(RED.tag);
    expect(document.querySelector('[data-slot="rate-chart-x-axis"]')?.textContent).toBe(
      "10/2210/2410/25",
    );
    expect(document.querySelector('[data-slot="rate-chart-zero"]')).toBeNull();
    expect(document.querySelector('[data-slot="rate-chart-cursor"]')).toBeNull();
  });

  it("sizes the right axis from the mode's widest label, not from the values", () => {
    const { unmount } = renderRateChart(
      [{ code: "EUR", color: RED, points: daily([0.86, 0.87]) }],
      "rate",
    );
    expect(readAxisWidthSample()).toBe("88,888.88");
    unmount();

    renderRateChart([{ code: "EUR", color: RED, points: daily([0, 1.5]) }], "percent");
    expect(readAxisWidthSample()).toBe("−88.88%");
    const tag = document.querySelector<HTMLElement>('[data-slot="rate-chart-tag"]');
    // Tags take the column's width from its inset, never from their own text.
    expect(tag?.style.width).toBe("");
    expect(tag?.parentElement?.className).toContain(
      "*:data-[slot=rate-chart-tag]:right-0.5",
    );
  });

  it("overlays percentage lines with a zero line, real rates on hover, and gap markers", () => {
    const gapped = [0, 1, ...Array.from({ length: 20 }, () => null), -1, 2];
    renderRateChart(
      [
        {
          code: "JPY",
          color: INDIGO,
          points: daily(gapped),
          rates: daily(gapped.map((value) => (value === null ? null : 150 + value))),
        },
        {
          code: "EUR",
          color: AMBER,
          points: daily(gapped.map((value) => (value === null ? null : -value))),
        },
      ],
      "percent",
    );

    expect(document.querySelector('[data-slot="rate-chart-zero"]')).not.toBeNull();
    expect(document.querySelectorAll('[data-slot="rate-chart-tag"]')).toHaveLength(2);
    const gap = document.querySelector('[data-slot="rate-chart-gap"]');
    expect(gap?.textContent).toBe("No data");
    expect(screen.getByRole("slider").querySelectorAll("path")).toHaveLength(2);

    const chart = screen.getByRole("slider");
    fireEvent.pointerMove(chart, { clientX: 0 });
    const tooltip = document.querySelector<HTMLElement>('[data-slot="rate-chart-tooltip"]');
    expect(tooltip?.textContent).toBe("Oct 22, 2026JPY0.00%150.00EUR0.00%");
    expect(tooltip?.style.left).toBe("10px");
    expect(document.querySelectorAll('[data-slot="rate-chart-dot"]')).toHaveLength(2);

    fireEvent.pointerMove(chart, { clientX: 120 });
    expect(
      document.querySelector('[data-slot="rate-chart-tooltip"]')?.textContent,
    ).toContain("No data");
    expect(document.querySelectorAll('[data-slot="rate-chart-dot"]')).toHaveLength(0);

    fireEvent.pointerMove(chart, { clientX: 280 });
    expect(
      document.querySelector<HTMLElement>('[data-slot="rate-chart-tooltip"]')?.style.right,
    ).toBe("10px");
    fireEvent.pointerLeave(chart);
    expect(document.querySelector('[data-slot="rate-chart-cursor"]')).toBeNull();
  });

  it("leaves a series without values off the axis tags", () => {
    renderRateChart(
      [
        { code: "JPY", color: INDIGO, points: daily([0, 1]) },
        { code: "GBP", color: AMBER, points: daily([null, null]) },
      ],
      "percent",
    );
    expect(document.querySelectorAll('[data-slot="rate-chart-tag"]')).toHaveLength(1);
  });

  it("hides the gap label when the gap is too narrow to hold it", () => {
    renderRateChart(
      [
        {
          code: "JPY",
          color: RED,
          points: daily([
            1,
            ...Array.from({ length: 30 }, (_, index) => (index === 10 ? null : 2)),
          ]),
        },
      ],
      "rate",
    );
    expect(document.querySelector('[data-slot="rate-chart-gap"]')?.textContent).toBe("");
  });

  it("moves a keyboard cursor while focused and clears it on blur", () => {
    renderRateChart([{ code: "JPY", color: RED, points: daily([1, 2, 3, 4]) }], "rate");
    const chart = screen.getByRole("slider");

    fireEvent.focus(chart);
    expect(chart.getAttribute("aria-valuenow")).toBe("3");
    expect(document.querySelector('[data-slot="rate-chart-cursor"]')).not.toBeNull();
    const press = (key: string) => fireEvent.keyDown(chart, { key });
    press("ArrowLeft");
    press("ArrowDown");
    expect(chart.getAttribute("aria-valuenow")).toBe("1");
    press("ArrowRight");
    expect(chart.getAttribute("aria-valuenow")).toBe("2");
    press("Home");
    press("ArrowLeft");
    expect(chart.getAttribute("aria-valuenow")).toBe("0");
    press("End");
    press("ArrowUp");
    expect(chart.getAttribute("aria-valuenow")).toBe("3");
    press("Tab");
    expect(chart.getAttribute("aria-valuenow")).toBe("3");

    fireEvent.blur(chart);
    expect(document.querySelector('[data-slot="rate-chart-cursor"]')).toBeNull();
    press("ArrowLeft");
    expect(chart.getAttribute("aria-valuenow")).toBe("2");
    fireEvent.focus(chart);
    expect(chart.getAttribute("aria-valuenow")).toBe("2");
  });

  it("moves through every raw slot and jumps a tenth of the period with page keys", () => {
    const values = Array.from({ length: 366 }, (_, index) => 100 + index);
    renderRateChart([{ code: "JPY", color: RED, points: daily(values) }], "rate");
    const chart = screen.getByRole("slider");
    expect(chart.getAttribute("aria-valuemax")).toBe("365");
    expect(chart.querySelectorAll("path")[1]?.getAttribute("d")?.match(/C/gu)).toHaveLength(
      365,
    );

    fireEvent.focus(chart);
    fireEvent.keyDown(chart, { key: "PageDown" });
    expect(chart.getAttribute("aria-valuenow")).toBe("328");
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(chart.getAttribute("aria-valuetext")).toMatch(/: JPY 427\.00$/u);
    fireEvent.keyDown(chart, { key: "PageUp" });
    fireEvent.keyDown(chart, { key: "PageUp" });
    expect(chart.getAttribute("aria-valuenow")).toBe("365");
    fireEvent.keyDown(chart, { key: "Home" });
    fireEvent.keyDown(chart, { key: "PageDown" });
    expect(chart.getAttribute("aria-valuenow")).toBe("0");
  });

  it("sizes the plot from the rendered width", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
    renderRateChart([{ code: "JPY", color: RED, points: daily([1, 2]) }], "rate");
    expect(screen.getByRole("slider").querySelector("svg")?.getAttribute("width")).toBe(
      "200",
    );
  });

  it("renders nothing without a value to draw", () => {
    const { container } = renderRateChart(
      [{ code: "JPY", color: RED, points: daily([null, null]) }],
      "rate",
    );
    expect(container.innerHTML).toBe("");
  });
});
