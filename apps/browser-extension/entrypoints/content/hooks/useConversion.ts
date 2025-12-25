import { useState, useCallback } from "react";
import { sendMessage, messageTypes, type ConvertCurrencyResponse } from "../../../lib/messages";
import type { DetectedCurrency } from "../../../lib/currencyDetection";
import type { ConversionResult } from "../components/ConversionPopup";

type CurrencyCode = string & { readonly brand: unique symbol };

export interface ConversionState {
  results: ConversionResult[];
  loading: boolean;
  error: string | null;
}

export function useConversion() {
  const [state, setState] = useState<ConversionState>({
    results: [],
    loading: false,
    error: null,
  });

  const convert = useCallback(async (detectedCurrencies: DetectedCurrency[], targetCurrency: CurrencyCode) => {
    if (detectedCurrencies.length === 0) {
      setState({
        results: [],
        loading: false,
        error: null,
      });
      return;
    }

    setState({
      results: [],
      loading: true,
      error: null,
    });

    try {
      const conversionPromises = detectedCurrencies.map(async (detected) => {
        const response = (await sendMessage({
          type: messageTypes.CONVERT_CURRENCY,
          payload: {
            amount: detected.amount,
            fromCurrency: detected.currencyCode as CurrencyCode,
            toCurrency: targetCurrency,
          },
        })) as ConvertCurrencyResponse;

        if (!response.success || !response.data) {
          throw new Error(response.error || "Conversion failed");
        }

        return {
          fromCurrency: detected.currencyCode,
          fromAmount: detected.amount,
          toCurrency: targetCurrency,
          toAmount: response.data.convertedAmount,
          originalText: detected.originalText,
        };
      });

      const results = await Promise.all(conversionPromises);

      setState({
        results,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState({
        results: [],
        loading: false,
        error: error instanceof Error ? error.message : "Failed to convert currency",
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      results: [],
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    convert,
    reset,
  };
}
