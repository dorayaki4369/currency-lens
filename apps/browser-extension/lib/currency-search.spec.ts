import { describe, expect, it } from "vitest";
import { getCurrencySearchKeywords, matchesCurrencySearch } from "@/lib/currency-search";

describe("currency search", () => {
  it("matches a currency code without optional metadata", () => {
    expect(matchesCurrencySearch("JPY", " jpy ", undefined)).toBe(true);
    expect(matchesCurrencySearch("JPY", "USD", undefined)).toBe(false);
  });

  it("matches localized names and regions without case sensitivity", () => {
    expect(matchesCurrencySearch("USD", "states", ["US Dollar", "United States"])).toBe(
      true,
    );
  });

  it("builds the same localized name and region keywords for every search UI", () => {
    const keywords = getCurrencySearchKeywords("USD", "en");

    expect(keywords[0]).toBe("US Dollar");
    expect(keywords[1]).toContain("United States");
  });
});
