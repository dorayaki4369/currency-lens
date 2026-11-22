import { describe, expect, it } from "vitest";
import { getRateSeriesColor, getTrendColor, RATE_SERIES_COLORS } from "@/lib/trend-colors";

describe("trend colors", () => {
  it("colors rises green and falls red", () => {
    expect(getTrendColor("up").tag).toBe("var(--trend-green-tag)");
    expect(getTrendColor("down").line).toBe("var(--trend-red-line)");
    expect(getTrendColor("flat").line).toBe("var(--trend-flat-line)");
  });

  it("assigns five distinct series colors and repeats them after the fifth", () => {
    expect(new Set(RATE_SERIES_COLORS.map((color) => color.line)).size).toBe(5);
    expect(getRateSeriesColor(0)).toEqual({
      line: "var(--rate-series-1-line)",
      tag: "var(--rate-series-1-tag)",
    });
    expect(getRateSeriesColor(5)).toBe(getRateSeriesColor(0));
  });
});
