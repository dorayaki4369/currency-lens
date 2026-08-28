import type { ConversionPopupData } from "../entrypoints/content/components/ConversionPopup";
import type { PopupPreviewData } from "../entrypoints/popup/App";
import type { DetectedCurrency } from "../lib/currency-detection";
import { convertCurrencyBatch } from "../lib/rates";

export const PREVIEW_CONFIG: PopupPreviewData["config"] = {
  favorites: ["JPY", "EUR", "GBP"],
  showCurrencyCode: true,
  showCurrencyIcon: true,
  symbolOverrides: {
    $: "USD",
    "＄": "USD",
    "💲": "USD",
    "¥": "JPY",
    "￥": "JPY",
    "💴": "JPY",
  },
  theme: "light",
};

export const PREVIEW_RATES: PopupPreviewData["rates"] = {
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

export const PREVIEW_DETECTION: DetectedCurrency = {
  amount: 249,
  currencyCode: "USD",
  index: 0,
  originalText: "$249.00",
};

export const PREVIEW_CONVERSION_DATA: ConversionPopupData = {
  base: PREVIEW_RATES.base,
  fetchedAt: PREVIEW_RATES.fetchedAt,
  isStale: PREVIEW_RATES.isStale,
  results: convertCurrencyBatch(
    {
      base: PREVIEW_RATES.base,
      fetchedAt: PREVIEW_RATES.fetchedAt,
      rates: PREVIEW_RATES.rates,
      sourceTimestamp: PREVIEW_RATES.sourceTimestamp,
    },
    [
      {
        amount: PREVIEW_DETECTION.amount,
        currencyCode: PREVIEW_DETECTION.currencyCode,
      },
    ],
    PREVIEW_CONFIG.favorites,
  ),
  sourceTimestamp: PREVIEW_RATES.sourceTimestamp,
};
