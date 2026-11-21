import { beforeEach, describe, expect, it, vi } from "vitest";
import { currencyCodeSchema } from "@/lib/currency";
import { createExchangeRateCache } from "@/lib/rates";
import {
  CHART_COLORS_KEY,
  clearExchangeRateCache,
  getChartColorSettings,
  getConfig,
  getDefaultConfig,
  getExchangeRateCache,
  parseStoredConfig,
  setChartColorSettings,
  setConfig,
  updateChartColor,
  setExchangeRateCache,
} from "@/lib/storage";

let syncState: Record<string, unknown>;
let localState: Record<string, unknown>;
let syncStorage: ReturnType<typeof createStorageArea>;
let localStorage: ReturnType<typeof createStorageArea>;

beforeEach(() => {
  syncState = {};
  localState = {};
  syncStorage = createStorageArea(
    () => syncState,
    (state) => {
      syncState = state;
    },
  );
  localStorage = createStorageArea(
    () => localState,
    (state) => {
      localState = state;
    },
  );
  vi.stubGlobal("browser", {
    storage: {
      sync: syncStorage,
      local: localStorage,
    },
  });
});

describe("configuration storage", () => {
  it("returns a current stored configuration unchanged", async () => {
    const config = { ...getDefaultConfig(), theme: "dark" as const };
    syncState["config"] = config;

    await expect(getConfig()).resolves.toEqual(config);
  });

  it("returns a fresh default when stored data fails runtime validation", async () => {
    syncState["config"] = { favorites: ["NOT_A_CURRENCY"] };
    await expect(getConfig()).resolves.toEqual(getDefaultConfig());
  });

  it("removes retired display preferences without resetting current settings", async () => {
    syncState["config"] = {
      favorites: ["USD", "EUR"],
      symbolOverrides: { $: "CAD" },
      theme: "dark",
      showCurrencyIcon: false,
      showCurrencyCode: false,
    };

    await expect(getConfig()).resolves.toEqual({
      favorites: ["USD", "EUR"],
      symbolOverrides: { $: "CAD" },
      theme: "dark",
    });
  });

  it("drops overrides for retired symbols without resetting current settings", async () => {
    syncState["config"] = {
      favorites: ["USD", "EUR"],
      symbolOverrides: { $: "CAD", "💲": "CAD", "💴": "CNY", "💷": "EGP" },
      theme: "dark",
      showCurrencyIcon: false,
      showCurrencyCode: false,
    };

    await expect(getConfig()).resolves.toEqual({
      favorites: ["USD", "EUR"],
      symbolOverrides: { $: "CAD" },
      theme: "dark",
    });
  });

  it("falls back when a previous symbol override is not a current candidate", async () => {
    syncState["config"] = {
      favorites: ["USD"],
      symbolOverrides: { $: "JPY" },
      theme: "dark",
      showCurrencyIcon: true,
      showCurrencyCode: true,
    };

    await expect(getConfig()).resolves.toEqual(getDefaultConfig());
  });

  it("drops retired symbols from the previous defaultConversions field", async () => {
    syncState["config"] = {
      favorites: ["USD"],
      defaultConversions: { "¥": "JPY", "💴": "CNY" },
      theme: "light",
      showCurrencyIcon: true,
      showCurrencyCode: true,
    };

    await expect(getConfig()).resolves.toEqual({
      favorites: ["USD"],
      symbolOverrides: { "¥": "JPY" },
      theme: "light",
    });
  });

  it("migrates the previous defaultConversions field to symbolOverrides", async () => {
    syncState["config"] = {
      favorites: ["USD", "EUR"],
      defaultConversions: { $: "CAD", "¥": "JPY" },
      theme: "dark",
      showCurrencyIcon: false,
      showCurrencyCode: true,
    };

    await expect(getConfig()).resolves.toEqual({
      favorites: ["USD", "EUR"],
      symbolOverrides: { $: "CAD", "¥": "JPY" },
      theme: "dark",
    });
  });

  it.each([
    {
      name: "current",
      stored: { favorites: [], symbolOverrides: { $: "CAD" }, theme: "dark" },
    },
    {
      name: "previous",
      stored: {
        favorites: [],
        symbolOverrides: { $: "CAD" },
        theme: "dark",
        showCurrencyIcon: false,
        showCurrencyCode: false,
      },
    },
    {
      name: "legacy",
      stored: {
        favorites: [],
        defaultConversions: { $: "CAD" },
        theme: "dark",
        showCurrencyIcon: false,
        showCurrencyCode: false,
      },
    },
  ])(
    "restores the default target for an empty $name target list without resetting other settings",
    async ({ stored }) => {
      syncState["config"] = stored;

      await expect(getConfig()).resolves.toEqual({
        favorites: getDefaultConfig().favorites,
        symbolOverrides: { $: "CAD" },
        theme: "dark",
      });
    },
  );

  it("rejects an empty target list before writing storage", async () => {
    await expect(setConfig({ ...getDefaultConfig(), favorites: [] })).rejects.toThrow();
    expect(syncStorage.set).not.toHaveBeenCalled();
  });

  it("rejects more than five favorites before writing storage", async () => {
    const invalidConfig = {
      ...getDefaultConfig(),
      favorites: ["USD", "EUR", "JPY", "GBP", "CAD", "AUD"].map((currencyCode) =>
        currencyCodeSchema.parse(currencyCode),
      ),
    };

    await expect(setConfig(invalidConfig)).rejects.toThrow();
    expect(syncStorage.set).not.toHaveBeenCalled();
  });

  it("validates and persists a current configuration", async () => {
    const config = { ...getDefaultConfig(), theme: "light" as const };

    await expect(setConfig(config)).resolves.toBeUndefined();
    expect(syncState["config"]).toEqual(config);
  });

  it("falls back when a legacy symbol mapping cannot satisfy current candidates", async () => {
    syncState["config"] = {
      favorites: ["USD"],
      defaultConversions: { $: "JPY" },
      theme: "system",
      showCurrencyIcon: true,
      showCurrencyCode: true,
    };

    await expect(getConfig()).resolves.toEqual(getDefaultConfig());
  });
});

describe("chart color storage", () => {
  it("keeps chart colors outside the strict config that older versions parse", async () => {
    // An older version would reject this config and fall back to every default.
    expect(
      parseStoredConfig({ ...getDefaultConfig(), chartColors: { up: "#e3b63f" } }),
    ).toBeNull();

    await setConfig(getDefaultConfig());
    await setChartColorSettings({ up: "#E3B63F" });

    expect(syncState).toEqual({
      [CHART_COLORS_KEY]: { up: "#e3b63f" },
      config: getDefaultConfig(),
    });
    await expect(getChartColorSettings()).resolves.toEqual({ up: "#e3b63f" });
    await expect(getConfig()).resolves.toEqual(getDefaultConfig());
  });

  it("treats missing or corrupt colors as no choice and ignores newer fields", async () => {
    await expect(getChartColorSettings()).resolves.toEqual({});
    syncState = { [CHART_COLORS_KEY]: { up: "yellow" } };
    await expect(getChartColorSettings()).resolves.toEqual({});
    syncState = { [CHART_COLORS_KEY]: { down: "#3B82F6", flat: "#000000" } };
    await expect(getChartColorSettings()).resolves.toEqual({ down: "#3b82f6" });
    // One corrupt direction does not discard the other.
    syncState = { [CHART_COLORS_KEY]: { down: "blue", up: "#E3B63F" } };
    await expect(getChartColorSettings()).resolves.toEqual({ up: "#e3b63f" });
    syncState = { [CHART_COLORS_KEY]: "#e3b63f" };
    await expect(getChartColorSettings()).resolves.toEqual({});
    await expect(setChartColorSettings({ up: "red" })).rejects.toThrow();
  });
});

describe("chart color updates", () => {
  it("changes one direction while keeping the other stored choice", async () => {
    syncState = { [CHART_COLORS_KEY]: { down: "#71717a" } };

    await expect(updateChartColor("up", "#E3B63F")).resolves.toEqual({
      down: "#71717a",
      up: "#e3b63f",
    });
    await expect(updateChartColor("down", null)).resolves.toEqual({ up: "#e3b63f" });
    expect(syncState).toEqual({ [CHART_COLORS_KEY]: { up: "#e3b63f" } });
  });
});

describe("rate storage", () => {
  it("keeps stale but valid data available as the last-good cache", async () => {
    const cache = createExchangeRateCache(
      { base: "USD", rates: { USD: "1", EUR: "0.9" }, timestamp: 1_600_000_000 },
      1_600_000_005_000,
    );
    localState["exchangeRateCache"] = cache;

    await expect(getExchangeRateCache()).resolves.toEqual(cache);
    expect(localStorage.remove).not.toHaveBeenCalled();
  });

  it("does not expose malformed cached API data", async () => {
    localState["exchangeRateCache"] = { rates: { USD: "nope" } };
    await expect(getExchangeRateCache()).resolves.toBeNull();
  });

  it("keeps the previous cache format available during migration", async () => {
    localState["exchangeRateCache"] = {
      rates: { EUR: "0.9" },
      timestamp: 1_700_000_000_000,
    };

    await expect(getExchangeRateCache()).resolves.toEqual({
      base: "USD",
      rates: { EUR: "0.9", USD: "1" },
      sourceTimestamp: 1_700_000_000_000,
      fetchedAt: 1_700_000_000_000,
    });
  });

  it("validates replacement caches and clears them explicitly", async () => {
    const cache = createExchangeRateCache(
      { base: "USD", rates: { USD: "1", EUR: "0.9" }, timestamp: 1_700_000_000 },
      1_700_000_005_000,
    );

    await expect(setExchangeRateCache(cache)).resolves.toBeUndefined();
    expect(localState["exchangeRateCache"]).toEqual(cache);

    await expect(clearExchangeRateCache()).resolves.toBeUndefined();
    expect(localState).not.toHaveProperty("exchangeRateCache");
  });
});

/** Creates a minimal async WebExtension storage area backed by test state. */
function createStorageArea(
  readState: () => Record<string, unknown>,
  writeState: (state: Record<string, unknown>) => void,
) {
  return {
    get: vi.fn(async (key: string) => ({ [key]: readState()[key] })),
    set: vi.fn(async (values: Record<string, unknown>) => {
      writeState({ ...readState(), ...values });
    }),
    remove: vi.fn(async (key: string) => {
      const next = { ...readState() };
      delete next[key];
      writeState(next);
    }),
  };
}
