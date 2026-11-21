import { z } from "zod/v4";
import type { TranslationKey, UiLocale } from "@/lib/i18n";
import type { TrendDirection } from "@/lib/rate-series";

export type TrendColorScheme = "green-up" | "red-up";
export type ChangeDirection = Exclude<TrendDirection, "flat">;

export interface ChartColor {
  /** Stroke and fill for lines and areas. */
  readonly line: string;
  /** Fill behind axis-tag text. */
  readonly tag: string;
  /** Axis-tag text that keeps at least 4.5:1 contrast on `tag`. */
  readonly tagText: string;
}

export interface TrendColor extends ChartColor {
  /** Color for direction arrows; never used for essential text. */
  readonly accent: string;
}

export type TrendPalette = Readonly<Record<TrendDirection, TrendColor>>;

export const hexColorSchema = z
  .string()
  .regex(/^#[\da-f]{6}$/iu)
  .transform((value) => value.toLowerCase());

/** User choices per direction; a missing direction keeps the locale default. */
export const chartColorSettingsSchema = z.object({
  down: hexColorSchema.optional(),
  up: hexColorSchema.optional(),
});

export type ChartColorSettings = z.infer<typeof chartColorSettingsSchema>;

export interface PaletteColor {
  readonly hex: string;
  readonly nameKey: TranslationKey;
}

/** The swatches offered in the color picker. */
export const CHART_COLOR_PALETTE: readonly PaletteColor[] = [
  { hex: "#c2416b", nameKey: "colorRose" },
  { hex: "#e0457b", nameKey: "colorPink" },
  { hex: "#e0736a", nameKey: "colorSalmon" },
  { hex: "#ef4444", nameKey: "colorRed" },
  { hex: "#ef6b3a", nameKey: "colorVermilion" },
  { hex: "#f08a3c", nameKey: "colorOrange" },
  { hex: "#f2a33a", nameKey: "colorAmber" },
  { hex: "#e3b63f", nameKey: "colorYellow" },
  { hex: "#a8a43f", nameKey: "colorOlive" },
  { hex: "#7fae4a", nameKey: "colorLime" },
  { hex: "#22a55a", nameKey: "colorGreen" },
  { hex: "#14a08a", nameKey: "colorTeal" },
  { hex: "#1d9bc4", nameKey: "colorSky" },
  { hex: "#3b82f6", nameKey: "colorBlue" },
  { hex: "#5b6fd6", nameKey: "colorIndigo" },
  { hex: "#8b5cf6", nameKey: "colorViolet" },
  { hex: "#71717a", nameKey: "colorGray" },
];

const WHITE = "#ffffff";
const BLACK = "#000000";

// Default values reference theme tokens in assets/style.css so both themes apply.
const RED = createThemeTrendColor("red", "#ef4444");
const BLUE = createThemeTrendColor("blue", "#3b82f6");
const GREEN = createThemeTrendColor("green", "#22c55e");
const FLAT: TrendColor = {
  accent: "var(--trend-flat-text)",
  line: "var(--trend-flat-line)",
  tag: "var(--trend-flat-tag)",
  tagText: WHITE,
};
const DEFAULT_COLORS = {
  "green-up": { down: RED, up: GREEN },
  "red-up": { down: BLUE, up: RED },
} as const satisfies Record<TrendColorScheme, Record<ChangeDirection, DefaultTrendColor>>;

interface DefaultTrendColor extends TrendColor {
  /** The light-theme line color, used to match a default against the swatches. */
  readonly hex: string;
}

/** Series colors for the ALL view, kept clear of the red, blue, and green trend colors. */
export const RATE_SERIES_COLORS: readonly ChartColor[] = [1, 2, 3, 4, 5].map((slot) => ({
  line: `var(--rate-series-${String(slot)}-line)`,
  tag: `var(--rate-series-${String(slot)}-tag)`,
  tagText: WHITE,
}));

/**
 * Chooses the reader's convention for rises and falls: red up and blue down in Japan,
 * green up and red down elsewhere.
 */
export function getTrendColorScheme(locale: UiLocale): TrendColorScheme {
  return locale === "ja" ? "red-up" : "green-up";
}

/** Returns the locale default for one direction, before any user choice. */
export function getDefaultTrendColor(
  direction: ChangeDirection,
  scheme: TrendColorScheme,
): DefaultTrendColor {
  return DEFAULT_COLORS[scheme][direction];
}

/** Resolves the colors for every direction, applying the user's choices over the defaults. */
export function getTrendPalette(
  scheme: TrendColorScheme,
  settings: ChartColorSettings = {},
): TrendPalette {
  return {
    down: resolveTrendColor(settings.down, getDefaultTrendColor("down", scheme)),
    flat: FLAT,
    up: resolveTrendColor(settings.up, getDefaultTrendColor("up", scheme)),
  };
}

/** Returns the series color for a position, repeating the palette if needed. */
export function getRateSeriesColor(index: number): ChartColor {
  return RATE_SERIES_COLORS[index % RATE_SERIES_COLORS.length]!;
}

/** Picks white or black text, whichever contrasts more with a #rrggbb background. */
export function getReadableTextColor(background: string): string {
  const luminance = getRelativeLuminance(background);
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05 ? WHITE : BLACK;
}

/** Returns the WCAG contrast ratio between two #rrggbb colors. */
export function getContrastRatio(first: string, second: string): number {
  const [lighter, darker] = [
    getRelativeLuminance(first),
    getRelativeLuminance(second),
  ].toSorted((left, right) => right - left);
  return (lighter! + 0.05) / (darker! + 0.05);
}

/** Uses one chosen color everywhere, or the theme-aware default when none is chosen. */
function resolveTrendColor(
  chosen: string | undefined,
  fallback: DefaultTrendColor,
): TrendColor {
  if (chosen === undefined) {
    return fallback;
  }
  return {
    accent: chosen,
    line: chosen,
    tag: chosen,
    tagText: getReadableTextColor(chosen),
  };
}

/** Builds a default color from its theme tokens. */
function createThemeTrendColor(name: string, hex: string): DefaultTrendColor {
  return {
    accent: `var(--trend-${name}-text)`,
    hex,
    line: `var(--trend-${name}-line)`,
    tag: `var(--trend-${name}-tag)`,
    tagText: WHITE,
  };
}

/** Computes WCAG relative luminance for a #rrggbb color. */
function getRelativeLuminance(hex: string): number {
  const [red, green, blue] = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.040_45 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}
