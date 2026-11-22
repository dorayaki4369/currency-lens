import { describe, expect, it } from "vitest";
import {
  CHART_COLOR_PALETTE,
  chartColorSettingsSchema,
  getContrastRatio,
  getDefaultTrendColor,
  getRateSeriesColor,
  getReadableTextColor,
  getTrendPalette,
  RATE_SERIES_COLORS,
} from "@/lib/trend-colors";

describe("trend colors", () => {
  it("colors rises green and falls red by default", () => {
    const palette = getTrendPalette();
    expect(palette.up.tag).toBe("var(--trend-green-tag)");
    expect(palette.up.tagText).toBe("#ffffff");
    expect(palette.down.line).toBe("var(--trend-red-line)");
    expect(palette.down.accent).toBe("var(--trend-red-text)");
    expect(palette.flat.line).toBe("var(--trend-flat-line)");
    expect(getDefaultTrendColor("up").hex).toBe("#22c55e");
    expect(getDefaultTrendColor("down").hex).toBe("#ef4444");
  });

  it("applies a choice to one direction and keeps the default for the other", () => {
    const palette = getTrendPalette({ up: "#e3b63f" });
    expect(palette.up).toEqual({
      accent: "#e3b63f",
      line: "#e3b63f",
      tag: "#e3b63f",
      tagText: "#000000",
    });
    expect(palette.down.line).toBe("var(--trend-red-line)");
    expect(getTrendPalette({ down: "#1e3a8a" }).down.tagText).toBe("#ffffff");
  });

  it("keeps tag text readable on every swatch and on extreme colors", () => {
    for (const hex of [
      ...CHART_COLOR_PALETTE.map((swatch) => swatch.hex),
      "#000000",
      "#ffffff",
      "#767676",
    ]) {
      expect(getContrastRatio(hex, getReadableTextColor(hex))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("accepts only #rrggbb choices and stores them in lowercase", () => {
    expect(chartColorSettingsSchema.parse({ up: "#E3B63F" })).toEqual({ up: "#e3b63f" });
    expect(chartColorSettingsSchema.safeParse({ down: "red" }).success).toBe(false);
    expect(chartColorSettingsSchema.safeParse({ up: "#fff" }).success).toBe(false);
  });

  it("offers seventeen distinct swatches", () => {
    expect(new Set(CHART_COLOR_PALETTE.map((swatch) => swatch.hex)).size).toBe(17);
  });

  it("assigns five distinct series colors and repeats them after the fifth", () => {
    expect(new Set(RATE_SERIES_COLORS.map((color) => color.line)).size).toBe(5);
    expect(getRateSeriesColor(0)).toEqual({
      line: "var(--rate-series-1-line)",
      tag: "var(--rate-series-1-tag)",
      tagText: "#ffffff",
    });
    expect(getRateSeriesColor(5)).toBe(getRateSeriesColor(0));
  });
});
