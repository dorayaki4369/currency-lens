import type { ConversionPopupData } from "@/entrypoints/content/components/ConversionPopup";
import type { PopupPreviewData } from "@/entrypoints/popup/App";
import type { DetectedCurrency } from "@/lib/currency-detection";
import { convertCurrencyBatch } from "@/lib/rates";
import { createRandomWalk } from "@/test/random-walk";

export const FIXTURE_CONFIG: PopupPreviewData["config"] = {
  favorites: ["JPY", "EUR", "GBP"],
  symbolOverrides: {
    $: "USD",
    "＄": "USD",
    "¥": "JPY",
    "￥": "JPY",
  },
  theme: "light",
};

export const FIXTURE_RATES: PopupPreviewData["rates"] = {
  base: "USD",
  fetchedAt: Date.now(),
  isStale: false,
  rates: {
    EUR: "0.8621",
    GBP: "0.7428",
    JPY: "149.45",
    USD: "1",
  },
  sourceTimestamp: Date.now() - 7 * 60 * 1_000,
  warnings: [],
};

export const FIXTURE_DETECTION: DetectedCurrency = {
  amount: 249,
  currencyCode: "USD",
  index: 0,
  originalText: "$249.00",
};

export const FIXTURE_CONVERSION_DATA: ConversionPopupData = {
  base: FIXTURE_RATES.base,
  fetchedAt: FIXTURE_RATES.fetchedAt,
  isStale: FIXTURE_RATES.isStale,
  results: convertCurrencyBatch(
    {
      base: FIXTURE_RATES.base,
      fetchedAt: FIXTURE_RATES.fetchedAt,
      rates: FIXTURE_RATES.rates,
      sourceTimestamp: FIXTURE_RATES.sourceTimestamp,
    },
    [
      {
        amount: FIXTURE_DETECTION.amount,
        currencyCode: FIXTURE_DETECTION.currencyCode,
      },
    ],
    FIXTURE_CONFIG.favorites,
  ),
  sourceTimestamp: FIXTURE_RATES.sourceTimestamp,
};

const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;
const DAILY_SLOTS = 366;
const HOURLY_SLOTS = 121;
// A stretch of missing days shows how the chart marks gaps in the archive.
const DAILY_GAP = { end: 249, start: 180 } as const;
const HISTORY_SERIES = [
  { code: "JPY", seed: 7, volatility: 0.0045 },
  { code: "EUR", seed: 11, volatility: 0.003 },
  { code: "GBP", seed: 23, volatility: 0.0032 },
] as const;

/** Deterministic USD-based history that ends at the fixture rates. */
export const FIXTURE_HISTORY: Extract<
  NonNullable<PopupPreviewData["history"]>,
  { readonly kind: "data" }
> = {
  daily: {
    base: "USD",
    rates: Object.fromEntries(
      HISTORY_SERIES.map((series) => [
        series.code,
        createRandomWalk(
          Number(FIXTURE_RATES.rates[series.code]),
          DAILY_SLOTS,
          series.volatility,
          series.seed,
        ).map((value, index) =>
          index >= DAILY_GAP.start && index <= DAILY_GAP.end ? null : value,
        ),
      ]),
    ),
    resolution: "daily",
    start: new Date(
      Math.floor(Date.now() / DAY_MS) * DAY_MS - (DAILY_SLOTS - 1) * DAY_MS,
    ).toISOString(),
  },
  hourly: {
    base: "USD",
    rates: Object.fromEntries(
      HISTORY_SERIES.map((series) => [
        series.code,
        createRandomWalk(
          Number(FIXTURE_RATES.rates[series.code]),
          HOURLY_SLOTS,
          series.volatility / 4,
          series.seed + 100,
        ),
      ]),
    ),
    resolution: "hourly",
    start: new Date(
      Math.floor(Date.now() / HOUR_MS) * HOUR_MS - (HOURLY_SLOTS - 1) * HOUR_MS,
    ).toISOString(),
  },
  kind: "data",
};
