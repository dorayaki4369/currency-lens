import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatConvertedAmount,
  getCurrencyDisplayName,
  getRegionDisplayNames,
  getUiLocale,
  resolveUiLocale,
  translate,
} from "@/lib/i18n";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("UI localization", () => {
  it("selects Japanese explicitly and falls back to English", () => {
    expect(resolveUiLocale("ja-JP")).toBe("ja");
    expect(resolveUiLocale("en-GB")).toBe("en");
    expect(resolveUiLocale("fr-FR")).toBe("en");
    expect(resolveUiLocale(undefined)).toBe("en");
  });

  it("formats named placeholders in both shipped languages", () => {
    expect(
      translate("en", "reorderCurrency", { currency: "JPY", position: 1, total: 3 }),
    ).toBe("Reorder JPY, position 1 of 3");
    expect(translate("ja", "ratesFrom", { timestamp: "2026/08/27" })).toBe(
      "2026/08/27 時点のレート",
    );
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
