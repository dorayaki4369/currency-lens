import { currencies, symbols, type CurrencyCode } from "@cl/currency";
import { z } from "zod/v4";

export const MAX_FAVORITE_CURRENCIES = 5;

const currencyCodeSet: ReadonlySet<string> = new Set(
  currencies.map((currency) => currency.code),
);

export const currencyCodeSchema = z
  .string()
  .refine(isKnownCurrencyCode, "Unsupported currency code");

const favoriteCurrenciesSchema = z
  .array(currencyCodeSchema)
  .max(MAX_FAVORITE_CURRENCIES)
  .refine(
    (codes) => new Set(codes).size === codes.length,
    "Favorite currencies must be unique",
  );

const symbolOverridesSchema = z
  .record(z.string().min(1).max(16), currencyCodeSchema)
  .superRefine(validateSymbolOverrides);

export const configSchema = z
  .object({
    favorites: favoriteCurrenciesSchema,
    symbolOverrides: symbolOverridesSchema,
    theme: z.enum(["light", "dark", "system"]),
    showCurrencyIcon: z.boolean(),
    showCurrencyCode: z.boolean(),
  })
  .strict();

export type Config = z.infer<typeof configSchema>;

export interface CurrencySymbolDefinition {
  readonly token: string;
  readonly defaultCurrency: CurrencyCode;
  readonly currencyCodes: readonly CurrencyCode[];
}

export interface CurrencyMetadata {
  readonly code: CurrencyCode;
  readonly countries: readonly string[];
  readonly minorUnit: number | null;
  readonly number: number | null;
}

const symbolDefinitions = buildSymbolDefinitions();
const symbolDefinitionByToken = new Map(
  symbolDefinitions.map((definition) => [definition.token, definition]),
);

/** Returns whether a string is a currency supported by this extension. */
export function isKnownCurrencyCode(code: string): code is CurrencyCode {
  return currencyCodeSet.has(code);
}

/** Returns immutable metadata for a supported currency. */
export function getCurrencyMetadata(code: CurrencyCode): CurrencyMetadata | undefined {
  return currencies.find((currency) => currency.code === code);
}

/** Returns every supported currency code for constructing detection patterns. */
export function getCurrencyCodes(): readonly CurrencyCode[] {
  return currencies.map((currency) => currency.code);
}

/** Returns the known symbol tokens, including multi-character alternatives. */
export function getCurrencySymbolDefinitions(): readonly CurrencySymbolDefinition[] {
  return symbolDefinitions;
}

/** Returns the symbol definition associated with an exact token. */
export function getCurrencySymbolDefinition(
  token: string,
): CurrencySymbolDefinition | undefined {
  return symbolDefinitionByToken.get(token);
}

/** Builds a normalized symbol table and merges duplicate source entries. */
function buildSymbolDefinitions(): CurrencySymbolDefinition[] {
  const definitions = new Map<
    string,
    { defaultCurrency: CurrencyCode; currencyCodes: CurrencyCode[] }
  >();

  for (const symbol of symbols) {
    const defaultCurrency = symbol.default;
    if (!isKnownCurrencyCode(defaultCurrency)) {
      continue;
    }

    const candidates: CurrencyCode[] = [];
    for (const candidate of symbol.codes) {
      if (isKnownCurrencyCode(candidate)) {
        candidates.push(candidate);
      }
    }
    const tokens: readonly string[] = [symbol.symbol, ...symbol.alternatives];

    for (const token of tokens) {
      const existing = definitions.get(token);
      if (!existing) {
        definitions.set(token, {
          defaultCurrency,
          currencyCodes: [...new Set([defaultCurrency, ...candidates])],
        });
        continue;
      }

      existing.currencyCodes = [...new Set([...existing.currencyCodes, ...candidates])];
    }
  }

  const result: CurrencySymbolDefinition[] = [];
  for (const [token, definition] of definitions) {
    result.push({ token, ...definition });
  }
  return result.toSorted((left, right) => right.token.length - left.token.length);
}

/** Ensures overrides refer to known symbols and one of each symbol's candidate currencies. */
function validateSymbolOverrides(
  overrides: Record<string, CurrencyCode>,
  context: z.RefinementCtx,
): void {
  if (Object.keys(overrides).length > 32) {
    context.addIssue({
      code: "custom",
      message: "At most 32 symbol overrides are allowed",
    });
  }

  for (const [token, currencyCode] of Object.entries(overrides)) {
    const definition = symbolDefinitionByToken.get(token);
    if (!definition) {
      context.addIssue({
        code: "custom",
        path: [token],
        message: "Unknown currency symbol",
      });
      continue;
    }

    if (!definition.currencyCodes.includes(currencyCode)) {
      context.addIssue({
        code: "custom",
        path: [token],
        message: `${currencyCode} is not a candidate for ${token}`,
      });
    }
  }
}
