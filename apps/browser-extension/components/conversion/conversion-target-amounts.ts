import type { CurrencyCode } from "@cl/currency";
import { formatConvertedAmount, type UiLocale } from "@/lib/i18n";
import type { ConversionResult } from "@/lib/rates";

export type ConversionTargetAmount =
  | { readonly status: "converted"; readonly text: string; readonly value: number }
  | { readonly status: "loading" }
  | { readonly status: "placeholder" }
  | { readonly status: "unavailable" };

interface CreateConversionTargetAmountsOptions {
  readonly currencyCodes: readonly CurrencyCode[];
  readonly loading: boolean;
  readonly locale: UiLocale;
  readonly results: readonly ConversionResult[];
  readonly sourceIsValid: boolean;
}

/** Builds the display state for every configured conversion target. */
export function createConversionTargetAmounts({
  currencyCodes,
  loading,
  locale,
  results,
  sourceIsValid,
}: CreateConversionTargetAmountsOptions): ReadonlyMap<
  CurrencyCode,
  ConversionTargetAmount
> {
  const resultsByCurrency = new Map(
    results.map((result) => [result.toCurrency, result] as const),
  );
  return new Map(
    currencyCodes.map((currencyCode) => [
      currencyCode,
      createConversionTargetAmount(
        resultsByCurrency.get(currencyCode),
        sourceIsValid,
        loading,
        locale,
      ),
    ]),
  );
}

/** Selects one target's mutually exclusive placeholder, loading, converted, or unavailable state. */
function createConversionTargetAmount(
  result: ConversionResult | undefined,
  sourceIsValid: boolean,
  loading: boolean,
  locale: UiLocale,
): ConversionTargetAmount {
  if (!sourceIsValid) {
    return { status: "placeholder" };
  }
  if (loading) {
    return { status: "loading" };
  }
  if (result?.status !== "converted") {
    return { status: "unavailable" };
  }
  return {
    status: "converted",
    text: formatConvertedAmount(result.convertedAmount, locale),
    value: Number(result.convertedAmount),
  };
}
