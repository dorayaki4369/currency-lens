import { describe, expect, it } from "vitest";
import { oxrLatestResponseSchema } from "./schema";

/** Creates an untrusted OXR-shaped payload for schema boundary tests. */
function createPayload() {
  return {
    disclaimer: "Rates are provided for informational purposes.",
    license: "Example license",
    base: "USD",
    rates: {
      USD: 1,
      EUR: 0.92,
    },
    timestamp: 1_700_000_000,
  };
}

describe("oxrLatestResponseSchema", () => {
  it("accepts unknown currency identifiers without requiring every known currency", () => {
    const payload = createPayload();
    const result = oxrLatestResponseSchema.parse({
      ...payload,
      rates: { ...payload.rates, FUTURE_COIN: 0.000_001 },
    });

    expect(result.rates["USD"]).toBe("1");
    expect(result.rates["FUTURE_COIN"]).toBe("0.000001");
  });

  it("accepts and validates string rates already persisted in R2", () => {
    const result = oxrLatestResponseSchema.parse({
      ...createPayload(),
      rates: { USD: "1", ETH: "3.5e-4" },
    });

    expect(result.rates["ETH"]).toBe("3.5e-4");
  });

  it.each([
    { USD: 1, EUR: 0 },
    { USD: 1, EUR: -1 },
    { USD: 1, EUR: "not-a-rate" },
    { USD: 1, eur: 0.9 },
  ])("rejects invalid rate records: %o", (rates) => {
    expect(oxrLatestResponseSchema.safeParse({ ...createPayload(), rates }).success).toBe(
      false,
    );
  });

  it("requires the base currency to be present with a rate of one", () => {
    const missingBase = oxrLatestResponseSchema.safeParse({
      ...createPayload(),
      rates: { EUR: 0.92 },
    });
    const invalidBase = oxrLatestResponseSchema.safeParse({
      ...createPayload(),
      rates: { USD: 0.99, EUR: 0.92 },
    });

    expect(missingBase.success).toBe(false);
    expect(invalidBase.success).toBe(false);
  });
});
