import { useMemo } from "react";
import {
  detectCurrencies,
  type CurrencyDetectionOptions,
  type DetectedCurrency,
} from "../../../lib/currency-detection";

/** Memoizes pure money detection for the current selection and locale hints. */
export function useCurrencyDetection(
  text: string,
  options: CurrencyDetectionOptions,
): DetectedCurrency[] {
  const { browserLocale, pageLocale, symbolOverrides } = options;

  return useMemo(() => {
    if (text.length === 0) {
      return [];
    }
    return detectCurrencies(text, { browserLocale, pageLocale, symbolOverrides });
  }, [browserLocale, pageLocale, symbolOverrides, text]);
}
