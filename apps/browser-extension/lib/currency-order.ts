import { currencies as supportedCurrencies, type CurrencyCode } from "@cl/currency";

export type CurrencyDropPlacement = "after" | "before";

/** Orders currency codes lexicographically for candidate and catalog lists. */
export function compareCurrencyCodes(left: CurrencyCode, right: CurrencyCode): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

/** Provides the supported currency codes in the shared UI display order. */
export const CURRENCY_CODES_BY_ISO_CODE: readonly CurrencyCode[] = supportedCurrencies
  .map((currency) => currency.code)
  .toSorted(compareCurrencyCodes);

/** Inserts one currency before or after another without mutating the current order. */
export function moveCurrencyRelative(
  currencies: readonly CurrencyCode[],
  sourceCurrency: CurrencyCode,
  targetCurrency: CurrencyCode,
  placement: CurrencyDropPlacement,
): CurrencyCode[] {
  const nextCurrencies = currencies.filter((currency) => currency !== sourceCurrency);
  const targetIndex = nextCurrencies.indexOf(targetCurrency);
  nextCurrencies.splice(targetIndex + (placement === "after" ? 1 : 0), 0, sourceCurrency);
  return nextCurrencies;
}
