import type { CurrencyCode } from "@cl/currency";
import { useCallback, useRef, useState } from "react";
import type { DetectedCurrency } from "../../../lib/currency-detection";
import {
  messageTypes,
  sendMessage,
  type ConvertCurrenciesResponse,
} from "../../../lib/messages";

type ConversionData = Extract<ConvertCurrenciesResponse, { success: true }>["data"];

export interface ConversionState {
  readonly data: ConversionData | null;
  readonly loading: boolean;
  readonly error: string | null;
}

const INITIAL_STATE: ConversionState = {
  data: null,
  loading: false,
  error: null,
};

/** Owns the single validated batch request used by the in-page lens. */
export function useConversion() {
  const [state, setState] = useState<ConversionState>(INITIAL_STATE);
  const requestGeneration = useRef(0);

  const convert = useCallback(
    async (
      detectedCurrencies: readonly DetectedCurrency[],
      targetCurrencies: readonly CurrencyCode[],
    ) => {
      const generation = requestGeneration.current + 1;
      requestGeneration.current = generation;

      if (detectedCurrencies.length === 0 || targetCurrencies.length === 0) {
        setState({
          data: null,
          loading: false,
          error:
            targetCurrencies.length === 0
              ? "Add at least one target currency in Currency Lens settings."
              : null,
        });
        return;
      }

      setState({ data: null, loading: true, error: null });

      try {
        const response = await sendMessage({
          type: messageTypes.CONVERT_CURRENCIES,
          payload: {
            amounts: detectedCurrencies.map(({ amount, currencyCode }) => ({
              amount,
              currencyCode,
            })),
            targetCurrencies: [...targetCurrencies],
          },
        });
        if (generation !== requestGeneration.current) {
          return;
        }
        setState(
          response.success
            ? { data: response.data, loading: false, error: null }
            : { data: null, loading: false, error: response.error },
        );
      } catch (error: unknown) {
        if (generation !== requestGeneration.current) {
          return;
        }
        setState({
          data: null,
          loading: false,
          error: error instanceof Error ? error.message : "Currency conversion failed.",
        });
      }
    },
    [],
  );

  const reset = useCallback(() => {
    requestGeneration.current += 1;
    setState(INITIAL_STATE);
  }, []);

  return { ...state, convert, reset };
}
