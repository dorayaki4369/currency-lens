import type { CurrencyCode } from "@cl/currency";
import { getCurrencyMetadata } from "@/lib/currency";
import { getCurrencyDisplayName, getRegionDisplayNames, type UiLocale } from "@/lib/i18n";

/** Builds the localized name and region keywords shared by every currency search UI. */
export function getCurrencySearchKeywords(
  currencyCode: CurrencyCode,
  locale: UiLocale,
): string[] {
  return [
    getCurrencyDisplayName(currencyCode, locale),
    getRegionDisplayNames(
      getCurrencyMetadata(currencyCode).countries,
      locale,
      Number.POSITIVE_INFINITY,
    ),
  ];
}

/** Matches a search term against a currency code and optional localized metadata. */
export function matchesCurrencySearch(
  currencyCode: string,
  search: string,
  keywords: readonly string[] | undefined,
  locale?: string,
): boolean {
  const normalizedSearch = search.trim().toLocaleLowerCase(locale);
  const searchableText = [currencyCode, ...(keywords ?? [])]
    .join(" ")
    .toLocaleLowerCase(locale);
  return searchableText.includes(normalizedSearch);
}
