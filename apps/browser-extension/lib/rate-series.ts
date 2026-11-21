import type { RateHistory, RateHistoryResolution } from "@/lib/rate-history";

export const RATE_PERIODS = ["1D", "5D", "1M", "6M", "YTD", "1Y"] as const;

export type RatePeriod = (typeof RATE_PERIODS)[number];
export type TrendDirection = "down" | "flat" | "up";

export interface RatePoint {
  readonly time: number;
  readonly value: number | null;
}

export type RateSeries = readonly RatePoint[];

export interface RateChange {
  readonly difference: number;
  readonly direction: TrendDirection;
  readonly first: { readonly time: number; readonly value: number };
  readonly last: { readonly time: number; readonly value: number };
  /** False when the period's first slot has no value, so the change starts later. */
  readonly measuredFromPeriodStart: boolean;
  readonly percent: number;
}

const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;
const USD = "USD";
const PERIOD_RESOLUTIONS = {
  "1D": "hourly",
  "5D": "hourly",
  "1M": "daily",
  "6M": "daily",
  YTD: "daily",
  "1Y": "daily",
} as const satisfies Record<RatePeriod, RateHistoryResolution>;
// Slot counts include both ends, so one day of hourly slots spans 25 points.
const PERIOD_SLOT_COUNTS = {
  "1D": 25,
  "5D": 121,
  "1M": 31,
  "6M": 184,
  "1Y": 366,
} as const satisfies Record<Exclude<RatePeriod, "YTD">, number>;

/** Selects the history resolution that covers a period. */
export function getPeriodResolution(period: RatePeriod): RateHistoryResolution {
  return PERIOD_RESOLUTIONS[period];
}

/**
 * Derives `1 base = value code` for every slot from the USD-based history.
 * A missing series on either side leaves that slot empty.
 */
export function getCrossRateSeries(
  history: RateHistory,
  currencyCode: string,
  baseCurrency: string,
): RateSeries {
  const slotCount = Object.values(history.rates)[0]?.length ?? 0;
  const start = Date.parse(history.start);
  const step = history.resolution === "hourly" ? HOUR_MS : DAY_MS;
  return Array.from({ length: slotCount }, (_, index) => {
    const numerator = readUsdRate(history, currencyCode, index);
    const denominator = readUsdRate(history, baseCurrency, index);
    return {
      time: start + index * step,
      value: numerator === null || denominator === null ? null : numerator / denominator,
    };
  });
}

/** Keeps the trailing slots that belong to a period, or the current UTC year for YTD. */
export function slicePeriod(series: RateSeries, period: RatePeriod): RateSeries {
  if (period === "YTD") {
    const latest = series.at(-1);
    if (latest === undefined) {
      return [];
    }
    const yearStart = Date.UTC(new Date(latest.time).getUTCFullYear(), 0, 1);
    return series.filter((point) => point.time >= yearStart);
  }
  return series.slice(-PERIOD_SLOT_COUNTS[period]);
}

/** Reports whether a series has at least one value to draw. */
export function hasRateValues(series: RateSeries): boolean {
  return series.some((point) => point.value !== null);
}

/** Expresses each value as a percentage change from the first available value. */
export function toPercentChangeSeries(series: RateSeries): RateSeries {
  const first = findValuedPoint(series);
  return series.map((point) => ({
    time: point.time,
    value:
      point.value === null || first === null ? null : (point.value / first.value - 1) * 100,
  }));
}

/** Measures the change between the first and last available values of a period. */
export function getRateChange(series: RateSeries): RateChange | null {
  const first = findValuedPoint(series);
  const last = findValuedPoint(series.toReversed());
  if (first === null || last === null) {
    return null;
  }

  const difference = last.value - first.value;
  return {
    difference,
    direction: difference > 0 ? "up" : difference < 0 ? "down" : "flat",
    first,
    last,
    measuredFromPeriodStart: series[0]?.value !== null,
    percent: (difference / first.value) * 100,
  };
}

/** Finds the first point that carries a value. */
function findValuedPoint(
  series: RateSeries,
): { readonly time: number; readonly value: number } | null {
  for (const point of series) {
    if (point.value !== null) {
      return { time: point.time, value: point.value };
    }
  }
  return null;
}

/** Reads one USD-based rate, treating USD as the constant 1. */
function readUsdRate(history: RateHistory, currencyCode: string, index: number) {
  if (currencyCode === USD) {
    return 1;
  }
  return history.rates[currencyCode]?.[index] ?? null;
}
