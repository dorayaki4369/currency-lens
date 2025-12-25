import { configSchema } from "./currency";
import type { z } from "zod/v4";

type Config = z.infer<typeof configSchema>;

const CONFIG_KEY = "config";
const CACHE_KEY = "exchangeRateCache";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface ExchangeRateCache {
  rates: Record<string, string>;
  timestamp: number;
}

export function getDefaultConfig(): Config {
  return {
    favorites: ["USD"],
    defaultConversions: {
      $: "USD",
      "¥": "JPY",
      "€": "EUR",
      "£": "GBP",
    },
    theme: "system",
    showCurrencyIcon: true,
    showCurrencyCode: true,
  };
}

export async function getConfig(): Promise<Config> {
  const result = await browser.storage.sync.get(CONFIG_KEY);
  if (result[CONFIG_KEY]) {
    const parsed = configSchema.safeParse(result[CONFIG_KEY]);
    if (parsed.success) {
      return parsed.data;
    }
  }
  return getDefaultConfig();
}

export async function setConfig(config: Config): Promise<void> {
  const validated = configSchema.parse(config);
  await browser.storage.sync.set({ [CONFIG_KEY]: validated });
}

export async function getExchangeRateCache(): Promise<ExchangeRateCache | null> {
  const result = await browser.storage.local.get(CACHE_KEY);
  const cache = result[CACHE_KEY] as ExchangeRateCache | undefined;

  if (!cache) {
    return null;
  }

  const now = Date.now();
  if (now - cache.timestamp > CACHE_TTL_MS) {
    await browser.storage.local.remove(CACHE_KEY);
    return null;
  }

  return cache;
}

export async function setExchangeRateCache(rates: Record<string, string>): Promise<void> {
  const cache: ExchangeRateCache = {
    rates,
    timestamp: Date.now(),
  };
  await browser.storage.local.set({ [CACHE_KEY]: cache });
}

export async function clearExchangeRateCache(): Promise<void> {
  await browser.storage.local.remove(CACHE_KEY);
}
