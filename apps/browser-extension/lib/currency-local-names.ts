import { currencyLocalNames, type CurrencyCode } from "@cl/currency";

export interface CurrencyLocalNameDefinition {
  readonly token: string;
  readonly defaultCurrency: CurrencyCode;
  readonly currencies: readonly CurrencyLocalNameCurrency[];
}

interface CurrencyLocalNameCurrency {
  readonly code: CurrencyCode;
  readonly regions: readonly string[];
}

/** Returns local currency-unit names and their locale-specific currency candidates. */
export function getCurrencyLocalNameDefinitions(): readonly CurrencyLocalNameDefinition[] {
  return localNameDefinitions;
}

/** Returns the local-name definition associated with an exact token. */
export function getCurrencyLocalNameDefinition(
  token: string,
): CurrencyLocalNameDefinition | undefined {
  return localNameDefinitionByToken.get(token);
}

const localNameDefinitions = buildCurrencyLocalNameDefinitions();
const localNameDefinitionByToken = new Map(
  localNameDefinitions.map((definition) => [definition.token, definition]),
);

/** Groups package-owned local names by token while retaining their documented regions. */
function buildCurrencyLocalNameDefinitions(): CurrencyLocalNameDefinition[] {
  const definitions = new Map<string, Map<CurrencyCode, Set<string>>>();

  for (const currency of currencyLocalNames) {
    for (const localName of currency.names) {
      const currencyDefinitions: Map<CurrencyCode, Set<string>> = definitions.get(
        localName.name,
      ) ?? new Map<CurrencyCode, Set<string>>();
      const regions = currencyDefinitions.get(currency.code) ?? new Set<string>();
      for (const locale of localName.locales) {
        regions.add(getLocaleRegion(locale));
      }
      currencyDefinitions.set(currency.code, regions);
      definitions.set(localName.name, currencyDefinitions);
    }
  }

  return [...definitions].map(([token, currencies]) => ({
    token,
    defaultCurrency: currencies.keys().next().value!,
    currencies: [...currencies].map(([code, regions]) => ({ code, regions: [...regions] })),
  }));
}

/** Reads the explicit region from a package-owned locale. */
function getLocaleRegion(locale: string): string {
  return new Intl.Locale(locale).region!;
}
