import { describe, expect, it } from "vitest";
import {
  CHART_COLOR_PALETTE,
  chartColorSettingsSchema,
  getContrastRatio,
  getDefaultTrendColor,
  getRateSeriesColor,
  getReadableTextColor,
  getTrendColorScheme,
  getTrendPalette,
  RATE_SERIES_COLORS,
} from "@/lib/trend-colors";

describe("trend colors", () => {
  it("follows the Japanese and the western convention for rises and falls", () => {
    expect(getTrendColorScheme("ja")).toBe("red-up");
    expect(getTrendColorScheme("en")).toBe("green-up");

    const japanese = getTrendPalette("red-up");
    expect(japanese.up.line).toBe("var(--trend-red-line)");
    expect(japanese.down.accent).toBe("var(--trend-blue-text)");
    expect(japanese.up.tagText).toBe("#ffffff");
    const western = getTrendPalette("green-up");
    expect(western.up.tag).toBe("var(--trend-green-tag)");
    expect(western.down.line).toBe("var(--trend-red-line)");
    expect(western.flat.line).toBe("var(--trend-flat-line)");
    expect(getDefaultTrendColor("up", "red-up").hex).toBe("#ef4444");
    expect(getDefaultTrendColor("down", "red-up").hex).toBe("#3b82f6");
    expect(getDefaultTrendColor("up", "green-up").hex).toBe("#22c55e");
  });

  it("applies a choice to one direction and keeps the default for the other", () => {
    const palette = getTrendPalette("red-up", { up: "#e3b63f" });
    expect(palette.up).toEqual({
      accent: "#e3b63f",
      line: "#e3b63f",
      tag: "#e3b63f",
      tagText: "#000000",
    });
    expect(palette.down.line).toBe("var(--trend-blue-line)");
    expect(getTrendPalette("green-up", { down: "#1e3a8a" }).down.tagText).toBe("#ffffff");
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
