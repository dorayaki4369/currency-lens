import type { CurrencyCode } from "@cl/currency";
import { z } from "zod/v4";
import { currencyCodeSchema } from "@/lib/currency";

export const RATE_HISTORY_RESOLUTIONS = ["hourly", "daily"] as const;
export const MAX_RATE_HISTORY_SYMBOLS = 6;
export const RATE_HISTORY_CACHE_TTL_MS = 5 * 60 * 1_000;

// The Worker returns 121 hourly or 366 daily slots; the cap only rejects absurd payloads.
const MAX_RATE_HISTORY_SLOTS = 1_000;
const RATE_HISTORY_FETCH_TIMEOUT_MS = 10_000;
const HISTORY_BASE_CURRENCY = "USD";
const rateHistoryCodeSchema = z.string().regex(/^[A-Z0-9][A-Z0-9_]{1,31}$/u);

export const rateHistoryResolutionSchema = z.enum(RATE_HISTORY_RESOLUTIONS);

export const rateHistoryQuerySchema = z
  .object({
    resolution: rateHistoryResolutionSchema,
    symbols: z
      .array(currencyCodeSchema)
      .min(1)
      .max(MAX_RATE_HISTORY_SYMBOLS)
      .refine(
        (symbols) => new Set(symbols).size === symbols.length,
        "History symbols must be unique",
      ),
  })
  .strict();

/** Mirrors the Worker's `GET /v1/history` body; the Worker owns the canonical schema. */
export const rateHistorySchema = z
  .object({
    base: z.literal(HISTORY_BASE_CURRENCY),
    resolution: rateHistoryResolutionSchema,
    start: z.iso.datetime(),
    rates: z.record(
      rateHistoryCodeSchema,
      z.array(z.number().positive().nullable()).min(1).max(MAX_RATE_HISTORY_SLOTS),
    ),
  })
  .strict()
  .superRefine(validateAlignedSeries);

export type RateHistoryResolution = z.infer<typeof rateHistoryResolutionSchema>;
export type RateHistoryQuery = z.infer<typeof rateHistoryQuerySchema>;
export type RateHistory = z.infer<typeof rateHistorySchema>;

/** A history query as callers hold it; the message boundary validates the same shape. */
export interface RateHistoryRequest {
  readonly resolution: RateHistoryResolution;
  readonly symbols: readonly CurrencyCode[];
}

export interface RateHistoryCache {
  readonly get: (
    query: RateHistoryRequest,
    load: () => Promise<RateHistory>,
  ) => Promise<RateHistory>;
}

/**
 * Lists the codes whose USD-based history is needed to draw every target against the base.
 * USD itself is always 1, so it is never requested.
 */
export function getRateHistorySymbols(
  targetCurrencies: readonly CurrencyCode[],
  baseCurrency: CurrencyCode,
): CurrencyCode[] {
  return [...new Set([baseCurrency, ...targetCurrencies])].filter(
    (currencyCode) => currencyCode !== HISTORY_BASE_CURRENCY,
  );
}

/** Builds a key that treats the same symbols in any order as one request. */
export function getRateHistoryKey(query: RateHistoryRequest): string {
  return `${query.resolution}:${[...query.symbols].toSorted().join(",")}`;
}

/** Fetches and validates one history window without retaining it. */
export async function fetchRateHistory(
  endpoint: string,
  query: RateHistoryRequest,
  fetchImplementation: typeof fetch = fetch,
): Promise<RateHistory> {
  const url = new URL(endpoint);
  url.searchParams.set("resolution", query.resolution);
  url.searchParams.set("symbols", query.symbols.join(","));
  const response = await fetchImplementation(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(RATE_HISTORY_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Rate history API returned HTTP ${response.status}`);
  }

  const history = rateHistorySchema.parse(await response.json());
  if (history.resolution !== query.resolution) {
    throw new Error("Rate history API returned a different resolution");
  }
  return history;
}

/** Shares in-flight and recent responses briefly; failures are never cached. */
export function createRateHistoryCache(
  ttlMs: number = RATE_HISTORY_CACHE_TTL_MS,
  now: () => number = Date.now,
): RateHistoryCache {
  const entries = new Map<
    string,
    { readonly expiresAt: number; readonly history: Promise<RateHistory> }
  >();

  return {
    get: (query, load) => {
      const key = getRateHistoryKey(query);
      const cached = entries.get(key);
      if (cached !== undefined && cached.expiresAt > now()) {
        return cached.history;
      }

      const history = load();
      entries.set(key, { expiresAt: now() + ttlMs, history });
      history.catch(() => {
        if (entries.get(key)?.history === history) {
          entries.delete(key);
        }
      });
      return history;
    },
  };
}

/** Rejects series that cannot share one time axis. */
function validateAlignedSeries(
  value: { readonly rates: Readonly<Record<string, readonly (number | null)[]>> },
  context: z.RefinementCtx,
): void {
  const lengths = new Set(Object.values(value.rates).map((series) => series.length));
  if (lengths.size > 1) {
    context.addIssue({
      code: "custom",
      path: ["rates"],
      message: "Every history series must have the same length",
    });
  }
}
