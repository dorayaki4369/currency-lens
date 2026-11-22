import { describe, expect, it } from "vitest";
import { DAILY_SLOT_COUNT, HOURLY_SLOT_COUNT, readHistory } from "../src/history";
import { createHistorySeed, writeHistorySeed } from "./history-seed";
import { createMemoryBucket, HISTORY_NOW_MS } from "./fixtures";

const LATEST_RATES = { EUR: 0.8621, GBP: 0.7428, JPY: 149.45 };

/** Returns the relative change from the first value to the last. */
function change(series: readonly (number | null)[]): number {
  return series.at(-1)! / series[0]! - 1;
}

describe("history seed", () => {
  it("serves complete hourly and daily windows that end at the latest rates", async () => {
    const bucket = createMemoryBucket();
    await writeHistorySeed(bucket, createHistorySeed(LATEST_RATES, HISTORY_NOW_MS));
    const symbols = ["EUR", "GBP", "JPY"];

    const hourly = await readHistory(
      bucket,
      { resolution: "hourly", symbols },
      HISTORY_NOW_MS,
    );
    const daily = await readHistory(
      bucket,
      { resolution: "daily", symbols },
      HISTORY_NOW_MS,
    );

    for (const [code, latest] of Object.entries(LATEST_RATES)) {
      expect(hourly.rates[code]).toHaveLength(HOURLY_SLOT_COUNT);
      expect(hourly.rates[code]).not.toContain(null);
      expect(hourly.rates[code]?.at(-1)).toBe(latest);
      expect(daily.rates[code]).toHaveLength(DAILY_SLOT_COUNT);
      expect(daily.rates[code]).not.toContain(null);
      expect(daily.rates[code]?.at(-1)).toBe(latest);
    }
    // The month before now shows both directions, so the charts use both trend colors.
    const lastMonth = (code: string) => daily.rates[code]!.slice(-31);
    expect(change(lastMonth("EUR"))).toBeLessThan(0);
    expect(change(lastMonth("JPY"))).toBeGreaterThan(0);
  });

  it("builds the same files for the same clock", () => {
    expect(createHistorySeed(LATEST_RATES, HISTORY_NOW_MS)).toEqual(
      createHistorySeed(LATEST_RATES, HISTORY_NOW_MS),
    );
  });
});
