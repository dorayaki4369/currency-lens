import { z } from "zod/v4";
import {
  MAX_FAVORITE_CURRENCIES,
  configSchema,
  currencyCodeSchema,
  isKnownSymbolToken,
  type Config,
} from "@/lib/currency";
import type { CurrencyCode } from "@cl/currency";
import { exchangeRateCacheSchema, type ExchangeRateCache } from "@/lib/rates";
import {
  CHANGE_DIRECTIONS,
  chartColorSettingsSchema,
  hexColorSchema,
  type ChangeDirection,
  type ChartColorSettings,
} from "@/lib/trend-colors";

const CONFIG_KEY = "config";
const CACHE_KEY = "exchangeRateCache";
// Chart colors live beside `config`, not in it: older versions parse `config` strictly and
// would reset every setting if it gained a field.
export const CHART_COLORS_KEY = "chartColors";

const storedSymbolOverridesSchema = z.record(z.string(), currencyCodeSchema);

const previousConfigSchema = configSchema.extend({
  symbolOverrides: storedSymbolOverridesSchema,
  showCurrencyIcon: z.boolean(),
  showCurrencyCode: z.boolean(),
});

const legacySymbolConfigSchema = z
  .object({
    favorites: z.array(currencyCodeSchema),
    defaultConversions: storedSymbolOverridesSchema,
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

const DEFAULT_FAVORITES = ["USD"] as const satisfies readonly CurrencyCode[];

/** Returns a fresh, runtime-validated configuration for a new installation. */
export function getDefaultConfig(): Config {
  return configSchema.parse({
    favorites: [...DEFAULT_FAVORITES],
    symbolOverrides: {},
    theme: "system",
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

/** Reads the chart color choices, treating missing or corrupt storage as no choice. */
export async function getChartColorSettings(): Promise<ChartColorSettings> {
  const stored = await browser.storage.sync.get(CHART_COLORS_KEY);
  return parseStoredChartColorSettings(stored[CHART_COLORS_KEY]);
}

/** Validates and persists the chart color choices. */
export async function setChartColorSettings(settings: ChartColorSettings): Promise<void> {
  const validated = chartColorSettingsSchema.parse(settings);
  await browser.storage.sync.set({ [CHART_COLORS_KEY]: validated });
}

/**
 * Changes one direction's color, or clears it with null, keeping the stored choice for
 * the other direction, and returns the merged result. Updates run one at a time, so
 * saves arriving together from several popups do not read the same value and overwrite
 * each other's direction.
 */
export function updateChartColor(
  direction: ChangeDirection,
  color: string | null,
): Promise<ChartColorSettings> {
  const update = chartColorUpdateQueue.then(() => mergeChartColor(direction, color));
  chartColorUpdateQueue = update.then(
    () => undefined,
    () => undefined,
  );
  return update;
}

let chartColorUpdateQueue: Promise<void> = Promise.resolve();

/** Reads the stored choices, applies one direction's change, and writes them back. */
async function mergeChartColor(
  direction: ChangeDirection,
  color: string | null,
): Promise<ChartColorSettings> {
  const next: ChartColorSettings = { ...(await getChartColorSettings()) };
  if (color === null) {
    delete next[direction];
  } else {
    next[direction] = color;
  }
  await setChartColorSettings(next);
  return chartColorSettingsSchema.parse(next);
}

/**
 * Parses stored chart colors one direction at a time, so one corrupt direction does
 * not discard the other; fields a newer version may have added are dropped.
 */
export function parseStoredChartColorSettings(storedValue: unknown): ChartColorSettings {
  const stored = z.record(z.string(), z.unknown()).safeParse(storedValue);
  if (!stored.success) {
    return {};
  }
  const settings: ChartColorSettings = {};
  for (const direction of CHANGE_DIRECTIONS) {
    const color = hexColorSchema.safeParse(stored.data[direction]);
    if (color.success) {
      settings[direction] = color.data;
    }
  }
  return settings;
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

/** Parses current configuration and removes retired display preferences when possible. */
export function parseStoredConfig(storedValue: unknown): Config | null {
  const value = restoreEmptyFavorites(storedValue);
  const current = configSchema.safeParse(value);
  if (current.success) {
    return current.data;
  }

  const previous = previousConfigSchema.safeParse(value);
  if (previous.success) {
    const migrated = configSchema.safeParse({
      favorites: previous.data.favorites,
      symbolOverrides: dropRetiredSymbols(previous.data.symbolOverrides),
      theme: previous.data.theme,
    });
    return migrated.success ? migrated.data : null;
  }

  const legacy = legacySymbolConfigSchema.safeParse(value);
  if (!legacy.success) {
    return null;
  }

  const favorites = [...new Set(legacy.data.favorites)].slice(0, MAX_FAVORITE_CURRENCIES);
  const migrated = configSchema.safeParse({
    favorites,
    symbolOverrides: dropRetiredSymbols(legacy.data.defaultConversions),
    theme: legacy.data.theme,
  });
  return migrated.success ? migrated.data : null;
}

/** Keeps at least one conversion target when storage holds an empty list from an earlier version. */
function restoreEmptyFavorites(value: unknown): unknown {
  const stored = z
    .object({ favorites: z.array(z.unknown()).length(0) })
    .loose()
    .safeParse(value);
  return stored.success ? { ...stored.data, favorites: [...DEFAULT_FAVORITES] } : value;
}

/** Removes overrides whose symbol earlier versions accepted but the current table no longer has. */
function dropRetiredSymbols(
  overrides: Readonly<Record<string, CurrencyCode>>,
): Record<string, CurrencyCode> {
  return Object.fromEntries(
    Object.entries(overrides).filter(([token]) => isKnownSymbolToken(token)),
  );
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
