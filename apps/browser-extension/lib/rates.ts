import type { CurrencyCode } from "@cl/currency";
import { z } from "zod/v4";
import {
  MAX_FAVORITE_CURRENCIES,
  currencyCodeSchema,
  getCurrencyMetadata,
} from "./currency";

export const MAX_CONVERSION_AMOUNTS = 3;
export const RATE_STALE_AFTER_MS = 24 * 60 * 60 * 1_000;

const MAX_CRYPTO_FRACTION_DIGITS = 8;
const MIN_CRYPTO_FRACTION_DIGITS = 5;
const RATE_FETCH_TIMEOUT_MS = 10_000;
const rateCodeSchema = z.string().regex(/^[A-Z0-9][A-Z0-9_]{1,31}$/u);
const rateValuePattern = /^(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/u;

export const exchangeRateValueSchema = z
  .union([z.number().positive(), z.string().min(1)])
  .transform(normalizeExchangeRate);

export const latestRatesApiResponseSchema = z
  .object({
    base: currencyCodeSchema,
    rates: z.record(rateCodeSchema, exchangeRateValueSchema),
    timestamp: z.number().int().positive().max(10_000_000_000),
  })
  .strict()
  .superRefine(validateUnitBaseRate);

export const exchangeRateCacheSchema = z
  .object({
    base: currencyCodeSchema,
    rates: z.record(rateCodeSchema, exchangeRateValueSchema),
    sourceTimestamp: z.number().int().nonnegative(),
    fetchedAt: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine(validateUnitBaseRate);

export const rateWarningSchema = z
  .object({
    code: z.literal("RATES_STALE"),
    message: z.string().min(1),
  })
  .strict();

export const convertedResultSchema = z
  .object({
    status: z.literal("converted"),
    sourceIndex: z
      .number()
      .int()
      .min(0)
      .max(MAX_CONVERSION_AMOUNTS - 1),
    amount: z.number().positive(),
    fromCurrency: currencyCodeSchema,
    toCurrency: currencyCodeSchema,
    convertedAmount: z.string(),
    rate: z.string(),
    fractionDigits: z.number().int().min(0).max(MAX_CRYPTO_FRACTION_DIGITS),
  })
  .strict();

export const unavailableResultSchema = z
  .object({
    status: z.literal("unavailable"),
    sourceIndex: z
      .number()
      .int()
      .min(0)
      .max(MAX_CONVERSION_AMOUNTS - 1),
    amount: z.number().positive(),
    fromCurrency: currencyCodeSchema,
    toCurrency: currencyCodeSchema,
    reason: z.literal("RATE_UNAVAILABLE"),
  })
  .strict();

export const conversionResultSchema = z.discriminatedUnion("status", [
  convertedResultSchema,
  unavailableResultSchema,
]);

export type ExchangeRateCache = z.infer<typeof exchangeRateCacheSchema>;
export type RateWarning = z.infer<typeof rateWarningSchema>;
export type ConversionResult = z.infer<typeof conversionResultSchema>;

export interface ConversionAmount {
  readonly amount: number;
  readonly currencyCode: CurrencyCode;
}

export interface RateSnapshot {
  readonly base: CurrencyCode;
  readonly sourceTimestamp: number;
  readonly fetchedAt: number;
  readonly isStale: boolean;
  readonly warnings: readonly RateWarning[];
}

/** Validates an API response and converts its source timestamp from seconds to milliseconds. */
export function createExchangeRateCache(
  body: unknown,
  fetchedAt: number = Date.now(),
): ExchangeRateCache {
  const response = latestRatesApiResponseSchema.parse(body);
  return exchangeRateCacheSchema.parse({
    base: response.base,
    rates: response.rates,
    sourceTimestamp: response.timestamp * 1_000,
    fetchedAt,
  });
}

/** Fetches and validates rates without modifying an existing last-good cache. */
export async function fetchExchangeRateCache(
  endpoint: string,
  fetchImplementation: typeof fetch = fetch,
  fetchedAt: number = Date.now(),
): Promise<ExchangeRateCache> {
  const response = await fetchImplementation(new URL(endpoint), {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(RATE_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Exchange-rate API returned HTTP ${response.status}`);
  }

  const body: unknown = await response.json();
  return createExchangeRateCache(body, fetchedAt);
}

/** Returns whether the source data is more than 24 hours old. */
export function isExchangeRateCacheStale(
  cache: ExchangeRateCache,
  now: number = Date.now(),
): boolean {
  return now - cache.sourceTimestamp > RATE_STALE_AFTER_MS;
}

/** Builds timestamp metadata and machine-readable warnings for message responses. */
export function getRateSnapshot(
  cache: ExchangeRateCache,
  now: number = Date.now(),
): RateSnapshot {
  const isStale = isExchangeRateCacheStale(cache, now);
  return {
    base: cache.base,
    sourceTimestamp: cache.sourceTimestamp,
    fetchedAt: cache.fetchedAt,
    isStale,
    warnings: isStale
      ? [
          {
            code: "RATES_STALE",
            message: "Exchange rates are more than 24 hours old.",
          },
        ]
      : [],
  };
}

/** Converts up to three amounts into up to five targets while retaining unavailable pairs. */
export function convertCurrencyBatch(
  cache: ExchangeRateCache,
  amounts: readonly ConversionAmount[],
  targetCurrencies: readonly CurrencyCode[],
): ConversionResult[] {
  validateConversionBatch(amounts, targetCurrencies);

  return amounts.flatMap((source, sourceIndex) =>
    targetCurrencies.map((targetCurrency) =>
      convertCurrencyPair(cache, source, sourceIndex, targetCurrency),
    ),
  );
}

/** Formats a converted value according to ISO minor units, capping crypto precision at eight digits. */
export function formatCurrencyAmount(
  value: number,
  currencyCode: CurrencyCode,
): { readonly value: string; readonly fractionDigits: number } {
  if (!Number.isFinite(value)) {
    throw new RangeError("Converted amount must be finite");
  }

  const metadata = getCurrencyMetadata(currencyCode);
  if (!metadata) {
    throw new RangeError(`Unsupported currency: ${currencyCode}`);
  }

  const fractionDigits = Math.min(
    metadata.minorUnit ?? MAX_CRYPTO_FRACTION_DIGITS,
    MAX_CRYPTO_FRACTION_DIGITS,
  );
  const fixedValue = value.toFixed(fractionDigits);
  const formattedValue =
    metadata.number === null && fractionDigits >= MIN_CRYPTO_FRACTION_DIGITS
      ? trimTrailingFractionZeros(fixedValue)
      : fixedValue;

  return { value: formattedValue, fractionDigits };
}

/** Converts one currency pair or returns an explicit unavailable result. */
function convertCurrencyPair(
  cache: ExchangeRateCache,
  source: ConversionAmount,
  sourceIndex: number,
  toCurrency: CurrencyCode,
): ConversionResult {
  const fromRate = readRate(cache, source.currencyCode);
  const toRate = readRate(cache, toCurrency);
  if (fromRate === null || toRate === null) {
    return {
      status: "unavailable",
      sourceIndex,
      amount: source.amount,
      fromCurrency: source.currencyCode,
      toCurrency,
      reason: "RATE_UNAVAILABLE",
    };
  }

  const rate = toRate / fromRate;
  const formatted = formatCurrencyAmount(source.amount * rate, toCurrency);
  return {
    status: "converted",
    sourceIndex,
    amount: source.amount,
    fromCurrency: source.currencyCode,
    toCurrency,
    convertedAmount: formatted.value,
    rate: rate.toString(),
    fractionDigits: formatted.fractionDigits,
  };
}

/** Reads a finite positive rate from the validated cache. */
function readRate(cache: ExchangeRateCache, currencyCode: CurrencyCode): number | null {
  const value = cache.rates[currencyCode];
  if (value === undefined) {
    return null;
  }

  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/** Enforces the batch limits independently of message-boundary validation. */
function validateConversionBatch(
  amounts: readonly ConversionAmount[],
  targetCurrencies: readonly CurrencyCode[],
): void {
  if (amounts.length > MAX_CONVERSION_AMOUNTS) {
    throw new RangeError(`At most ${MAX_CONVERSION_AMOUNTS} amounts can be converted`);
  }
  if (targetCurrencies.length > MAX_FAVORITE_CURRENCIES) {
    throw new RangeError(`At most ${MAX_FAVORITE_CURRENCIES} targets can be converted`);
  }
  if (new Set(targetCurrencies).size !== targetCurrencies.length) {
    throw new RangeError("Target currencies must be unique");
  }
  if (amounts.some((source) => !Number.isFinite(source.amount) || source.amount <= 0)) {
    throw new RangeError("Amounts must be positive finite numbers");
  }
}

/** Normalizes a number-or-string API rate into a stable positive string. */
function normalizeExchangeRate(value: number | string, context: z.RefinementCtx): string {
  if (typeof value === "string" && !rateValuePattern.test(value)) {
    context.addIssue({ code: "custom", message: "Exchange rates must be decimal numbers" });
    return z.NEVER;
  }
  const rate = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(rate) || rate <= 0) {
    context.addIssue({
      code: "custom",
      message: "Exchange rates must be positive finite numbers",
    });
    return z.NEVER;
  }
  return typeof value === "number" ? value.toString() : value;
}

/** Rejects incomplete or internally inconsistent base-rate datasets. */
function validateUnitBaseRate(
  value: { readonly base: CurrencyCode; readonly rates: Readonly<Record<string, string>> },
  context: z.RefinementCtx,
): void {
  const baseRate = value.rates[value.base];
  if (baseRate === undefined || Number(baseRate) !== 1) {
    context.addIssue({
      code: "custom",
      path: ["rates", value.base],
      message: "The base currency rate must be present and equal to 1",
    });
  }
}

/** Removes insignificant fractional zeros from crypto-like display values. */
function trimTrailingFractionZeros(value: string): string {
  if (!value.includes(".")) {
    return value;
  }
  return value.replace(/(?:\.0+|(?<fraction>\.\d*?[1-9])0+)$/u, "$<fraction>");
}
