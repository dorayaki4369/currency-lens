import { useMemo } from "react";
import { detectCurrencies, type DetectedCurrency } from "../../../lib/currencyDetection";

type CurrencyCode = string & { readonly brand: unique symbol };

export function useCurrencyDetection(
  text: string,
  defaultConversions?: Record<string, CurrencyCode>,
): DetectedCurrency[] {
  return useMemo(() => {
    if (!text || text.length === 0) {
      return [];
    }

    return detectCurrencies(text, defaultConversions);
  }, [text, defaultConversions]);
}
