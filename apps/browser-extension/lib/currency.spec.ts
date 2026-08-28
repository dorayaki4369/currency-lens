import { currencies } from "@cl/currency";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configSchema,
  getAmbiguousCurrencySymbolGroups,
  getCurrencyCodes,
  getCurrencyMetadata,
  getCurrencySymbolDefinition,
  getCurrencySymbolDefinitions,
  isKnownCurrencyCode,
} from "./currency";

afterEach(() => {
  vi.doUnmock("@cl/currency");
  vi.resetModules();
});

describe("currency metadata adapters", () => {
  it("keeps every bundled currency code unique", () => {
    expect(new Set(currencies.map((currency) => currency.code)).size).toBe(
      currencies.length,
    );
  });

  it("looks up supported codes, metadata, and exact symbol definitions", () => {
    expect(isKnownCurrencyCode("USD")).toBe(true);
    expect(isKnownCurrencyCode("ZZZ")).toBe(false);
    expect(getCurrencyCodes()).toContain("JPY");
    expect(getCurrencyMetadata("USD")).toMatchObject({ code: "USD", minorUnit: 2 });
    expect(getCurrencySymbolDefinition("$")).toMatchObject({ defaultCurrency: "USD" });
    expect(getCurrencySymbolDefinition("not-a-symbol")).toBeUndefined();
  });

  it("derives ambiguous symbol groups without popup hardcoding", () => {
    const groups = getAmbiguousCurrencySymbolGroups();
    const ambiguousTokens = getCurrencySymbolDefinitions().filter(
      (definition) => definition.currencyCodes.length > 1,
    );

    expect(groups.length).toBeGreaterThan(0);
    expect(groups.flatMap((group) => group.tokens)).toHaveLength(ambiguousTokens.length);
    expect(new Set(groups.flatMap((group) => group.tokens)).size).toBe(
      ambiguousTokens.length,
    );
    expect(groups.some((group) => group.tokens.includes("$"))).toBe(true);
    expect(
      groups.every(
        (group) =>
          group.currencyCodes.length > 1 &&
          group.currencyCodes.includes(group.defaultCurrency),
      ),
    ).toBe(true);
  });
});

describe("configuration validation", () => {
  const baseConfig = {
    favorites: ["USD"],
    symbolOverrides: {},
    theme: "system",
    showCurrencyIcon: true,
    showCurrencyCode: true,
  } as const;

  it("accepts valid settings and rejects duplicates, overflow, and extra fields", () => {
    expect(configSchema.safeParse(baseConfig).success).toBe(true);
    expect(
      configSchema.safeParse({ ...baseConfig, favorites: ["USD", "USD"] }).success,
    ).toBe(false);
    expect(
      configSchema.safeParse({
        ...baseConfig,
        favorites: ["USD", "EUR", "JPY", "GBP", "CAD", "AUD"],
      }).success,
    ).toBe(false);
    expect(configSchema.safeParse({ ...baseConfig, extra: true }).success).toBe(false);
  });

  it("rejects unknown symbols and currencies outside a symbol's candidates", () => {
    expect(
      configSchema.safeParse({
        ...baseConfig,
        symbolOverrides: { "not-a-symbol": "USD" },
      }).success,
    ).toBe(false);
    expect(
      configSchema.safeParse({ ...baseConfig, symbolOverrides: { $: "JPY" } }).success,
    ).toBe(false);
    expect(
      configSchema.safeParse({ ...baseConfig, symbolOverrides: { $: "CAD" } }).success,
    ).toBe(true);
  });

  it("caps the number of symbol overrides", () => {
    const symbolOverrides = Object.fromEntries(
      getCurrencySymbolDefinitions()
        .slice(0, 33)
        .map((definition) => [definition.token, definition.defaultCurrency]),
    );
    expect(Object.keys(symbolOverrides)).toHaveLength(33);
    expect(configSchema.safeParse({ ...baseConfig, symbolOverrides }).success).toBe(false);
  });
});

describe("symbol table normalization", () => {
  it("merges duplicate aliases and joins overlapping symbol families", async () => {
    vi.resetModules();
    vi.doMock("@cl/currency", () => ({
      currencies: [
        { code: "AAA", countries: ["AA"], minorUnit: 2, number: 1 },
        { code: "BBB", countries: ["BB"], minorUnit: 2, number: 2 },
        { code: "CCC", countries: ["CC"], minorUnit: 2, number: 3 },
      ],
      symbols: [
        { symbol: "a", alternatives: ["x"], default: "AAA", codes: ["AAA", "ZZZ"] },
        { symbol: "b", alternatives: ["y"], default: "BBB", codes: ["BBB"] },
        { symbol: "x", alternatives: ["b"], default: "AAA", codes: ["AAA", "BBB"] },
        { symbol: "c", alternatives: [], default: "CCC", codes: ["CCC"] },
        { symbol: "invalid", alternatives: [], default: "ZZZ", codes: ["AAA"] },
      ],
    }));

    const normalized = await import("./currency");
    expect(normalized.getCurrencySymbolDefinition("invalid")).toBeUndefined();
    expect(normalized.getCurrencySymbolDefinition("a")).toEqual({
      token: "a",
      defaultCurrency: "AAA",
      currencyCodes: ["AAA"],
    });
    expect(normalized.getCurrencySymbolDefinition("x")?.currencyCodes).toEqual([
      "AAA",
      "BBB",
    ]);
    expect(normalized.getAmbiguousCurrencySymbolGroups()).toEqual([
      {
        tokens: ["a", "x", "b", "y"],
        defaultCurrency: "AAA",
        currencyCodes: ["AAA", "BBB"],
      },
    ]);
  });
});
