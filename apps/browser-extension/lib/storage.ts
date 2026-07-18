import { z } from "zod/v4";
import {
  MAX_FAVORITE_CURRENCIES,
  configSchema,
  currencyCodeSchema,
  type Config,
} from "./currency";
import { exchangeRateCacheSchema, type ExchangeRateCache } from "./rates";

const CONFIG_KEY = "config";
const CACHE_KEY = "exchangeRateCache";

const legacyConfigSchema = z
  .object({
    favorites: z.array(currencyCodeSchema),
    defaultConversions: z.record(z.string(), currencyCodeSchema),
    theme: z.enum(["light", "dark", "system"]),
    showCurrencyIcon: z.boolean(),
    showCurrencyCode: z.boolean(),
  })
  .loose();

const legacyExchangeRateCacheSchema = z
  .object({
    rates: exchangeRateCacheSchema.shape.rates,
    timestamp: z.number().int().nonnegative(),
  })
  .loose();

/** Returns a fresh, runtime-validated configuration for a new installation. */
export function getDefaultConfig(): Config {
  return configSchema.parse({
    favorites: ["USD"],
    symbolOverrides: {},
    theme: "system",
    showCurrencyIcon: true,
    showCurrencyCode: true,
  });
}

/** Reads and validates synchronized configuration, falling back when storage is corrupt. */
export async function getConfig(): Promise<Config> {
  const stored = await browser.storage.sync.get(CONFIG_KEY);
  return parseStoredConfig(stored[CONFIG_KEY]) ?? getDefaultConfig();
}

/** Validates and persists synchronized configuration. */
export async function setConfig(config: Readonly<Config>): Promise<void> {
  const validated = configSchema.parse(config);
  await browser.storage.sync.set({ [CONFIG_KEY]: validated });
}

/** Reads the last valid rate cache without deleting it merely because it is stale. */
export async function getExchangeRateCache(): Promise<ExchangeRateCache | null> {
  const stored = await browser.storage.local.get(CACHE_KEY);
  return parseStoredRateCache(stored[CACHE_KEY]);
}

/** Validates and atomically replaces the last-good rate cache. */
export async function setExchangeRateCache(cache: ExchangeRateCache): Promise<void> {
  const validated = exchangeRateCacheSchema.parse(cache);
  await browser.storage.local.set({ [CACHE_KEY]: validated });
}

/** Explicitly clears the rate cache, primarily for recovery and tests. */
export async function clearExchangeRateCache(): Promise<void> {
  await browser.storage.local.remove(CACHE_KEY);
}

/** Parses current configuration and migrates the previous symbol-mapping field when possible. */
function parseStoredConfig(value: unknown): Config | null {
  const current = configSchema.safeParse(value);
  if (current.success) {
    return current.data;
  }

  const legacy = legacyConfigSchema.safeParse(value);
  if (!legacy.success) {
    return null;
  }

  const favorites = [...new Set(legacy.data.favorites)].slice(0, MAX_FAVORITE_CURRENCIES);
  const migrated = configSchema.safeParse({
    favorites,
    symbolOverrides: legacy.data.defaultConversions,
    theme: legacy.data.theme,
    showCurrencyIcon: legacy.data.showCurrencyIcon,
    showCurrencyCode: legacy.data.showCurrencyCode,
  });
  return migrated.success ? migrated.data : null;
}

/** Preserves the previous cache format while adding source and fetch metadata. */
function parseStoredRateCache(value: unknown): ExchangeRateCache | null {
  const current = exchangeRateCacheSchema.safeParse(value);
  if (current.success) {
    return current.data;
  }

  const legacy = legacyExchangeRateCacheSchema.safeParse(value);
  if (!legacy.success) {
    return null;
  }

  return exchangeRateCacheSchema.parse({
    base: "USD",
    rates: { ...legacy.data.rates, USD: "1" },
    sourceTimestamp: legacy.data.timestamp,
    fetchedAt: legacy.data.timestamp,
  });
}
