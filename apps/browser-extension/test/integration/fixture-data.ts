import type { ConversionPopupData } from "@/entrypoints/content/components/ConversionPopup";
import type { PopupPreviewData } from "@/entrypoints/popup/App";
import type { DetectedCurrency } from "@/lib/currency-detection";
import { convertCurrencyBatch } from "@/lib/rates";

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
