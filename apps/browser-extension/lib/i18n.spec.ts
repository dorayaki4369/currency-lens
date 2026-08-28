import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCurrencyDisplayName,
  getRegionDisplayNames,
  getUiLocale,
  resolveUiLocale,
  translate,
} from "./i18n";

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
    expect(translate("en", "targetCount", { current: 3, maximum: 5 })).toBe("3/5");
    expect(translate("ja", "ratesFrom", { timestamp: "2026/08/27" })).toBe(
      "2026/08/27 時点のレート",
    );
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
