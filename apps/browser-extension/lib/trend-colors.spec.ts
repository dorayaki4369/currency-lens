import { describe, expect, it } from "vitest";
import {
  getRateSeriesColor,
  getTrendColor,
  getTrendColorScheme,
  RATE_SERIES_COLORS,
} from "@/lib/trend-colors";

describe("trend colors", () => {
  it("follows the Japanese and the western convention for rises and falls", () => {
    expect(getTrendColorScheme("ja")).toBe("red-up");
    expect(getTrendColorScheme("en")).toBe("green-up");
    expect(getTrendColor("up", "red-up").line).toBe("var(--trend-red-line)");
    expect(getTrendColor("down", "red-up").text).toBe("var(--trend-blue-text)");
    expect(getTrendColor("up", "green-up").tag).toBe("var(--trend-green-tag)");
    expect(getTrendColor("down", "green-up").line).toBe("var(--trend-red-line)");
    expect(getTrendColor("flat", "green-up").line).toBe("var(--trend-flat-line)");
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
