import type { UiLocale } from "@/lib/i18n";
import type { RateHistoryResolution } from "@/lib/rate-history";
import type { RatePeriod } from "@/lib/rate-series";

const MINUS_SIGN = "−";
const MAX_RATE_FRACTION_DIGITS = 10;

/** Chooses enough decimals to show day-to-day movement at the value's magnitude. */
export function getRateFractionDigits(value: number): number {
  const magnitude = Math.abs(value);
  if (magnitude >= 100) {
    return 2;
  }
  if (magnitude >= 1) {
    return 3;
  }
  if (magnitude >= 0.01) {
    return 4;
  }
  // Tiny cross rates, such as crypto per yen, keep three significant digits.
  return magnitude === 0
    ? 4
    : Math.min(MAX_RATE_FRACTION_DIGITS, Math.ceil(-Math.log10(magnitude)) + 2);
}

/** Formats a rate with fixed decimals in the UI locale. */
export function formatRate(
  value: number,
  locale: UiLocale,
  fractionDigits: number = getRateFractionDigits(value),
): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value);
}

/** Formats a rate difference with an explicit sign. */
export function formatSignedRate(
  value: number,
  locale: UiLocale,
  fractionDigits: number,
): string {
  // Values that round to zero carry no sign, so "−0.00" never appears.
  const rounded = Number(value.toFixed(fractionDigits));
  return `${getSign(rounded)}${formatRate(Math.abs(rounded), locale, fractionDigits)}`;
}

/** Formats a percentage change with an explicit sign. */
export function formatSignedPercent(
  value: number,
  locale: UiLocale,
  fractionDigits = 2,
): string {
  return `${formatSignedRate(value, locale, fractionDigits)}%`;
}

/** Formats an x-axis label at the granularity that suits the period. */
export function formatChartTick(
  time: number,
  period: RatePeriod,
  locale: UiLocale,
): string {
  if (period === "1D") {
    return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(
      time,
    );
  }
  // Points carry the moment their value represents, so every label uses local time.
  const options: Intl.DateTimeFormatOptions =
    period === "1Y"
      ? { month: "numeric", year: "numeric" }
      : { day: "numeric", month: "numeric" };
  return new Intl.DateTimeFormat(locale, options).format(time);
}

/** Formats the time of one slot for the hover card. */
export function formatChartTime(
  time: number,
  resolution: RateHistoryResolution,
  locale: UiLocale,
): string {
  const options: Intl.DateTimeFormatOptions =
    resolution === "hourly"
      ? { day: "numeric", hour: "numeric", minute: "2-digit", month: "short" }
      : { dateStyle: "medium" };
  return new Intl.DateTimeFormat(locale, options).format(time);
}

/** Formats the slot a change is measured from when the period start has no data. */
export function formatChangeStart(
  time: number,
  resolution: RateHistoryResolution,
  locale: UiLocale,
): string {
  const options: Intl.DateTimeFormatOptions =
    resolution === "hourly"
      ? { day: "numeric", hour: "numeric", minute: "2-digit", month: "numeric" }
      : { day: "numeric", month: "numeric" };
  return new Intl.DateTimeFormat(locale, options).format(time);
}

/** Returns the visible sign for a signed number; zero has none. */
function getSign(value: number): string {
  if (value > 0) {
    return "+";
  }
  return value < 0 ? MINUS_SIGN : "";
}
