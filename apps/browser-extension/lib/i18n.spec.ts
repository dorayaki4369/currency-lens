import { readdir } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatConvertedAmount,
  formatCurrencyAmount,
  getCurrencyDisplayName,
  getRegionDisplayNames,
  getUiLocale,
  resolveUiLocale,
  SUPPORTED_UI_LOCALES,
  translate,
  type TranslationKey,
} from "@/lib/i18n";
import { en } from "@/lib/locales/en";

/** Lists the named placeholders of a message so translations cannot drop or rename them. */
function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/gu)].map((match) => match[1] ?? "").toSorted();
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("UI localization", () => {
  it.each([
    ["ja-JP", "ja"],
    ["en-GB", "en"],
    ["ko-KR", "ko"],
    ["es-419", "es"],
    ["fr-CA", "fr"],
    ["de-AT", "de"],
    ["pt-BR", "pt-BR"],
    ["pt-PT", "pt-BR"],
    ["zh", "zh-CN"],
    ["zh-CN", "zh-CN"],
    ["zh_CN", "zh-CN"],
    ["zh-SG", "zh-CN"],
    ["zh-TW", "zh-TW"],
    ["zh-HK", "zh-TW"],
    ["zh-Hant", "zh-TW"],
    ["zh-Hans-HK", "zh-CN"],
    ["it-IT", "en"],
    ["", "en"],
    [undefined, "en"],
  ] as const)("resolves the browser language %s to %s", (language, locale) => {
    expect(resolveUiLocale(language)).toBe(locale);
  });

  it.each(SUPPORTED_UI_LOCALES)(
    "keeps every %s message and its placeholders aligned with English",
    (locale) => {
      for (const key of Object.keys(en.messages) as TranslationKey[]) {
        const message = translate(locale, key);
        expect(message.trim(), `${locale}.${key}`).not.toBe("");
        expect(placeholders(message), `${locale}.${key}`).toEqual(
          placeholders(en.messages[key]),
        );
      }
    },
  );

  it("ships no manifest locale without a UI dictionary", async () => {
    const manifestLocales = await readdir(new URL("../public/_locales", import.meta.url));

    expect(manifestLocales.toSorted()).toEqual(
      SUPPORTED_UI_LOCALES.map((locale) => locale.replace("-", "_")).toSorted(),
    );
  });

  it.each(SUPPORTED_UI_LOCALES)("names every overridden currency in %s", (locale) => {
    for (const currencyCode of Object.keys(en.currencyNames)) {
      expect(
        getCurrencyDisplayName(currencyCode, locale),
        `${locale}.${currencyCode}`,
      ).not.toBe("");
    }
  });

  it("formats named placeholders in both shipped languages", () => {
    expect(
      translate("en", "reorderCurrency", { currency: "JPY", position: 1, total: 3 }),
    ).toBe("Reorder JPY, position 1 of 3");
    expect(
      translate("ja", "reorderCurrency", { currency: "JPY", position: 1, total: 3 }),
    ).toBe("JPY を並べ替え、3件中1番目");
    expect(translate("ja", "addTarget")).toBe("換算通貨を追加");
  });

  it("reads an explicit, extension, navigator, or missing browser language", () => {
    expect(getUiLocale("ja-JP")).toBe("ja");

    vi.stubGlobal("browser", { i18n: { getUILanguage: () => "ja" } });
    expect(getUiLocale()).toBe("ja");

    vi.stubGlobal("browser", undefined);
    vi.stubGlobal("navigator", { language: "en-CA" });
    expect(getUiLocale()).toBe("en");

    vi.stubGlobal("navigator", undefined);
    expect(getUiLocale()).toBe("en");
  });

  it("localizes ISO currencies and regions while preserving private-code fallbacks", () => {
    expect(getCurrencyDisplayName("JPY", "ja")).toContain("円");
    expect(getCurrencyDisplayName("VEF_BLKMKT", "ja")).toBe("VEF_BLKMKT");
    expect(getRegionDisplayNames(["JP"], "ja")).toBe("日本");
  });

  it("uses source codes when display-name lookup has no value", () => {
    const missingDisplayNames = vi.fn(function MissingDisplayNames() {
      return { of: () => undefined };
    });
    vi.stubGlobal("Intl", { DisplayNames: missingDisplayNames });

    expect(getCurrencyDisplayName("USD", "en")).toBe("USD");
    expect(getRegionDisplayNames(["US", "CA", "MX", "JP"], "en", 2)).toBe("US · CA");
    expect(missingDisplayNames).toHaveBeenCalledTimes(2);
  });

  it("falls back to source region codes when display-name construction fails", () => {
    vi.spyOn(Intl, "DisplayNames").mockImplementation(() => {
      throw new RangeError("unsupported locale data");
    });

    expect(getCurrencyDisplayName("USD", "en")).toBe("USD");
    expect(getRegionDisplayNames(["US", "CA", "MX"], "en", 2)).toBe("US · CA");
  });
});

describe("formatCurrencyAmount", () => {
  it.each([
    ["6962.4", "JPY", 0, "en", "¥6,962"],
    ["6962.4", "JPY", 0, "ja", "￥6,962"],
    ["6.46", "USD", 2, "en", "$6.46"],
    ["10", "CAD", 2, "en", "$10.00"],
    ["1530000000", "JPY", 0, "en", "¥1,530,000,000"],
  ] as const)(
    "formats %s %s with the currency's narrow symbol and digits",
    (value, currencyCode, fractionDigits, locale, expected) => {
      expect(formatCurrencyAmount(value, currencyCode, fractionDigits, locale)).toBe(
        expected,
      );
    },
  );

  it("keeps the code for currencies that Intl displays without a symbol", () => {
    expect(formatCurrencyAmount("0.00029085", "BTC", 8, "en")).toBe("BTC\u00a00.00029085");
  });

  it("appends codes that Intl cannot format as a currency", () => {
    expect(formatCurrencyAmount("1.5", "DASH", 4, "en")).toBe("1.5000 DASH");
  });
});

describe("formatConvertedAmount", () => {
  it.each([
    ["15000", "15,000.00"],
    ["1.2", "1.20"],
    ["1.2345", "1.23"],
  ])("formats %s with exactly two decimal places", (value, expected) => {
    expect(formatConvertedAmount(value, "en")).toBe(expected);
  });

  it.each([
    ["999999999.99", "999,999,999.99"],
    ["1000000000", "1.00E+9"],
    ["1267165358", "1.27E+9"],
    ["1267165358.42", "1.27E+9"],
    ["-1267165358.4", "-1.27E+9"],
  ])(
    "uses a two-decimal exponent only when the standard display of %s is too wide",
    (value, expected) => {
      expect(formatConvertedAmount(value, "en")).toBe(expected);
    },
  );

  it("returns the original value when the number formatter rejects its options", () => {
    vi.spyOn(Intl, "NumberFormat").mockImplementationOnce(function rejectNumberFormat() {
      throw new RangeError("Unsupported formatting options");
    });

    expect(formatConvertedAmount("1234.56", "en")).toBe("1234.56");
  });
});
