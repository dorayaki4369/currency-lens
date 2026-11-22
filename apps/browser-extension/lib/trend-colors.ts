import type { TrendDirection } from "@/lib/rate-series";

export interface ChartColor {
  /** Stroke and fill for lines and areas. */
  readonly line: string;
  /** Darker fill behind white axis-tag text. */
  readonly tag: string;
}

export interface TrendColor extends ChartColor {
  /** Text color that keeps at least 4.5:1 contrast on the card. */
  readonly text: string;
}

// Values reference theme tokens in assets/style.css so light and dark themes both apply.
const RED: TrendColor = {
  line: "var(--trend-red-line)",
  tag: "var(--trend-red-tag)",
  text: "var(--trend-red-text)",
};
const GREEN: TrendColor = {
  line: "var(--trend-green-line)",
  tag: "var(--trend-green-tag)",
  text: "var(--trend-green-text)",
};
const FLAT: TrendColor = {
  line: "var(--trend-flat-line)",
  tag: "var(--trend-flat-tag)",
  text: "var(--trend-flat-text)",
};

/** Series colors for the ALL view, kept clear of the green and red trend colors. */
export const RATE_SERIES_COLORS: readonly ChartColor[] = [1, 2, 3, 4, 5].map((slot) => ({
  line: `var(--rate-series-${String(slot)}-line)`,
  tag: `var(--rate-series-${String(slot)}-tag)`,
}));

/** Returns the color for a direction: green for rises and red for falls in every language. */
export function getTrendColor(direction: TrendDirection): TrendColor {
  if (direction === "flat") {
    return FLAT;
  }
  return direction === "up" ? GREEN : RED;
}

/** Returns the series color for a position, repeating the palette if needed. */
export function getRateSeriesColor(index: number): ChartColor {
  return RATE_SERIES_COLORS[index % RATE_SERIES_COLORS.length]!;
}
