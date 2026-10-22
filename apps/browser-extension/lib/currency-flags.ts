import { currencies, type CurrencyCode } from "@cl/currency";

/** Lists only flag regions that can be selected by the bundled currency metadata. */
export const currencyFlagRegions: readonly string[] = [
  ...new Set(
    currencies
      .map((currency) => getCurrencyFlagRegion(currency.code))
      .filter((region): region is string => region !== null),
  ),
].toSorted();

/** Avoids assigning a country flag to virtual currencies or currency unions. */
export function getCurrencyFlagRegion(currencyCode: CurrencyCode): string | null {
  if (currencyCode === "CNH") {
    return "CN";
  }
  const currency = currencies.find((candidate) => candidate.code === currencyCode);
  return currency?.countries.find((region) => region === currencyCode.slice(0, 2)) ?? null;
}
