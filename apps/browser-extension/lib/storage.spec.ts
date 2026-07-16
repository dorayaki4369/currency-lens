import { beforeEach, describe, expect, it, vi } from "vitest";
import { currencyCodeSchema } from "./currency";
import { createExchangeRateCache } from "./rates";
import { getConfig, getDefaultConfig, getExchangeRateCache, setConfig } from "./storage";

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
  it("returns a fresh default when stored data fails runtime validation", async () => {
    syncState["config"] = { favorites: ["NOT_A_CURRENCY"] };
    await expect(getConfig()).resolves.toEqual(getDefaultConfig());
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
      showCurrencyIcon: false,
      showCurrencyCode: true,
    });
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
