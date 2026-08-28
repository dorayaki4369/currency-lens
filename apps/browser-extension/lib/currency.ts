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
    "Conversion target currencies must be unique",
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

export interface AmbiguousCurrencySymbolGroup {
  readonly tokens: readonly string[];
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
const ambiguousSymbolGroups = buildAmbiguousSymbolGroups();

/** Returns whether a string is a currency supported by this extension. */
export function isKnownCurrencyCode(code: string): code is CurrencyCode {
  return currencyCodeSet.has(code);
}

/** Returns immutable metadata for a code from the exhaustive bundled currency union. */
export function getCurrencyMetadata(code: CurrencyCode): CurrencyMetadata {
  return currencies.find((currency) => currency.code === code)!;
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

/** Returns every configurable symbol family that can resolve to multiple currencies. */
export function getAmbiguousCurrencySymbolGroups(): readonly AmbiguousCurrencySymbolGroup[] {
  return ambiguousSymbolGroups;
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

/** Connects overlapping source aliases into one configurable ambiguous-symbol family. */
function buildAmbiguousSymbolGroups(): AmbiguousCurrencySymbolGroup[] {
  const tokenFamilies: Set<string>[] = [];

  for (const symbol of symbols) {
    const tokens = [...new Set([symbol.symbol, ...symbol.alternatives])].filter((token) =>
      symbolDefinitionByToken.has(token),
    );
    const overlappingFamilies = tokenFamilies.filter((family) =>
      tokens.some((token) => family.has(token)),
    );
    if (overlappingFamilies.length === 0) {
      tokenFamilies.push(new Set(tokens));
      continue;
    }

    // The preceding length check establishes this family for TypeScript and runtime callers.
    const primaryFamily = overlappingFamilies[0]!;
    for (const token of tokens) {
      primaryFamily.add(token);
    }
    for (const family of overlappingFamilies.slice(1)) {
      for (const token of family) {
        primaryFamily.add(token);
      }
      tokenFamilies.splice(tokenFamilies.indexOf(family), 1);
    }
  }

  const groups: AmbiguousCurrencySymbolGroup[] = [];
  for (const tokenFamily of tokenFamilies) {
    const tokens = [...tokenFamily];
    // Families only contain tokens retained in symbolDefinitionByToken above.
    const definitions = tokens.map((token) => symbolDefinitionByToken.get(token)!);
    const currencyCodes = [
      ...new Set(definitions.flatMap((definition) => definition.currencyCodes)),
    ];
    const defaultCurrency = definitions[0]?.defaultCurrency;
    if (currencyCodes.length <= 1 || defaultCurrency === undefined) {
      continue;
    }

    groups.push({
      tokens,
      defaultCurrency,
      currencyCodes,
    });
  }

  return groups.toSorted((left, right) => left.tokens[0]!.localeCompare(right.tokens[0]!));
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
