import type { CurrencyCode } from "@cl/currency";
import { useEffect } from "react";
import {
  type ConversionPhase,
  type HeldAmount,
  useHeldAmount,
} from "@/components/conversion/ConvertedAmount";
import { selectQuickConversionTarget, type Config } from "@/lib/currency";
import type { DetectedCurrency } from "@/lib/currency-detection";
import { formatCurrencyAmount, type UiLocale } from "@/lib/i18n";
import type { ConvertCurrenciesResponse } from "@/lib/messages";
import type { QuickConversion } from "@/entrypoints/content/components/FloatingIcon";
import { useConversion } from "@/entrypoints/content/hooks/useConversion";

type ConvertedResult = Extract<
  Extract<ConvertCurrenciesResponse, { success: true }>["data"]["results"][number],
  { status: "converted" }
>;

/** Converts the selected amount into the top conversion target shown on the selection trigger. */
export function useQuickConversion(
  detection: DetectedCurrency | undefined,
  config: Pick<Config, "favorites"> | null,
  locale: UiLocale,
): QuickConversion | null {
  const { convert, data, error, reset } = useConversion();
  const amount = detection?.amount;
  const sourceCurrency = detection?.currencyCode;
  const targetCurrency =
    sourceCurrency === undefined || config === null
      ? null
      : selectQuickConversionTarget(config.favorites, sourceCurrency);

  useEffect(() => {
    if (amount === undefined || sourceCurrency === undefined || targetCurrency === null) {
      reset();
      return;
    }
    void convert({ amount, currencyCode: sourceCurrency }, [targetCurrency]);
  }, [amount, convert, reset, sourceCurrency, targetCurrency]);

  // A result from an earlier selection must not label the current one.
  const result = data?.results.find(
    (candidate) =>
      candidate.amount === amount &&
      candidate.fromCurrency === sourceCurrency &&
      candidate.toCurrency === targetCurrency,
  );
  const current = result?.status === "converted" ? toQuickConversion(result, locale) : null;
  // Until the current selection's result or failure arrives, the previous amount rolls into it.
  const held = useHeldAmount(current, getConversionPhase(targetCurrency, result, error));
  return selectShownConversion(held, targetCurrency);
}

/** Treats a missing result without an error as a conversion still on its way. */
function getConversionPhase(
  targetCurrency: CurrencyCode | null,
  result: unknown,
  error: string | null,
): ConversionPhase {
  if (targetCurrency === null) {
    return "idle";
  }
  return result === undefined && error === null ? "pending" : "settled";
}

/** Formats a converted result with the target currency's symbol and fraction digits. */
function toQuickConversion(result: ConvertedResult, locale: UiLocale): QuickConversion {
  return {
    amount: {
      text: formatCurrencyAmount(
        result.convertedAmount,
        result.toCurrency,
        result.fractionDigits,
        locale,
      ),
      value: Number(result.convertedAmount),
    },
    currencyCode: result.toCurrency,
    pending: false,
  };
}

/** Shows a held amount only while it still belongs to the current conversion target. */
function selectShownConversion(
  held: HeldAmount<QuickConversion>,
  targetCurrency: CurrencyCode | null,
): QuickConversion | null {
  if (held.amount === null || held.amount.currencyCode !== targetCurrency) {
    return null;
  }
  return held.held ? { ...held.amount, pending: true } : held.amount;
}
