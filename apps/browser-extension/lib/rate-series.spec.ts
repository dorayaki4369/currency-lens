import { describe, expect, it } from "vitest";
import type { RateHistory } from "@/lib/rate-history";
import {
  getCrossRateSeries,
  getPeriodResolution,
  getRateChange,
  hasRateValues,
  RATE_PERIODS,
  slicePeriod,
  toPercentChangeSeries,
  type RateSeries,
} from "@/lib/rate-series";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const START = Date.parse("2026-01-01T00:00:00.000Z");

/** Builds a series with consecutive times from plain values. */
function series(
  values: readonly (number | null)[],
  step = DAY_MS,
  start = START,
): RateSeries {
  return values.map((value, index) => ({ time: start + index * step, value }));
}

describe("periods", () => {
  it("uses hourly history for one and five days and daily history otherwise", () => {
    expect(RATE_PERIODS.map(getPeriodResolution)).toEqual([
      "hourly",
      "hourly",
      "daily",
      "daily",
      "daily",
      "daily",
    ]);
  });

  it("keeps the trailing slots of each fixed period", () => {
    const daily = series(Array.from({ length: 366 }, (_, index) => index));
    const hourly = series(
      Array.from({ length: 121 }, (_, index) => index),
      HOUR_MS,
    );
    expect(slicePeriod(hourly, "1D")).toHaveLength(25);
    expect(slicePeriod(hourly, "5D")).toHaveLength(121);
    expect(slicePeriod(daily, "1M")).toHaveLength(31);
    expect(slicePeriod(daily, "6M")).toHaveLength(184);
    expect(slicePeriod(daily, "1Y")).toHaveLength(366);
    expect(slicePeriod(daily, "1M").at(-1)?.value).toBe(365);
  });

  it("starts YTD at the first UTC day of the latest slot's year", () => {
    const daily = series(
      Array.from({ length: 40 }, (_, index) => index),
      DAY_MS,
      Date.parse("2025-12-15T00:00:00.000Z"),
    );
    const ytd = slicePeriod(daily, "YTD");
    expect(new Date(ytd[0]!.time).toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(ytd).toHaveLength(23);
    expect(slicePeriod([], "YTD")).toEqual([]);
  });
});

describe("getCrossRateSeries", () => {
  const history: RateHistory = {
    base: "USD",
    resolution: "hourly",
    start: "2026-01-01T00:00:00.000Z",
    rates: { EUR: [0.8, 0.9, null], JPY: [160, 180, 150] },
  };

  it("divides the target's USD rate by the base's for each slot", () => {
    expect(getCrossRateSeries(history, "JPY", "EUR")).toEqual([
      { time: START, value: 200 },
      { time: START + HOUR_MS, value: 200 },
      { time: START + 2 * HOUR_MS, value: null },
    ]);
  });

  it("treats USD as 1 on either side and leaves missing currencies empty", () => {
    expect(getCrossRateSeries(history, "USD", "EUR").map((point) => point.value)).toEqual([
      1.25,
      1 / 0.9,
      null,
    ]);
    expect(getCrossRateSeries(history, "JPY", "USD").map((point) => point.value)).toEqual([
      160, 180, 150,
    ]);
    expect(getCrossRateSeries(history, "GBP", "USD").map((point) => point.value)).toEqual([
      null,
      null,
      null,
    ]);
  });

  it("uses one-day steps for daily history and returns nothing without series", () => {
    const daily = { ...history, resolution: "daily" as const };
    expect(getCrossRateSeries(daily, "JPY", "USD")[1]?.time).toBe(START + DAY_MS);
    expect(getCrossRateSeries({ ...history, rates: {} }, "JPY", "USD")).toEqual([]);
  });
});

describe("changes", () => {
  it("measures from the first to the last available value", () => {
    expect(getRateChange(series([null, 100, 110, null]))).toEqual({
      difference: 10,
      direction: "up",
      first: { time: START + DAY_MS, value: 100 },
      last: { time: START + 2 * DAY_MS, value: 110 },
      measuredFromPeriodStart: false,
      percent: 10,
    });
  });

  it("reports falls, flat periods, and periods without values", () => {
    expect(getRateChange(series([100, 90]))).toMatchObject({
      direction: "down",
      measuredFromPeriodStart: true,
      percent: -10,
    });
    expect(getRateChange(series([100, 100]))?.direction).toBe("flat");
    expect(getRateChange(series([null, null]))).toBeNull();
    expect(getRateChange([])).toBeNull();
  });

  it("expresses values as percentages of the first available value", () => {
    const percentages = toPercentChangeSeries(series([null, 200, 210, null, 190])).map(
      (point) => point.value,
    );
    expect(percentages.map((value) => (value === null ? null : Math.round(value)))).toEqual(
      [null, 0, 5, null, -5],
    );
    expect(toPercentChangeSeries(series([null])).map((point) => point.value)).toEqual([
      null,
    ]);
  });

  it("detects whether anything can be drawn", () => {
    expect(hasRateValues(series([null, 1]))).toBe(true);
    expect(hasRateValues(series([null]))).toBe(false);
  });
});
