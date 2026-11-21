import { describe, expect, it } from "vitest";
import {
  formatChangeStart,
  formatChartTick,
  formatChartTime,
  formatRate,
  formatSignedPercent,
  formatSignedRate,
  getRateFractionDigits,
} from "@/lib/rate-format";

const DAY = Date.parse("2026-07-22T00:00:00.000Z");

describe("rate numbers", () => {
  it("adds decimals as the magnitude shrinks", () => {
    expect([149.45, 1.2345, 0.8621, 0.0045, 4.5e-8, 0].map(getRateFractionDigits)).toEqual([
      2, 3, 4, 5, 10, 4,
    ]);
  });

  it("formats rates and signed changes in the UI locale", () => {
    expect(formatRate(1234.5, "en")).toBe("1,234.50");
    expect(formatRate(0.86, "ja", 2)).toBe("0.86");
    expect(formatSignedRate(0.0265, "en", 4)).toBe("+0.0265");
    expect(formatSignedRate(-1.5, "en", 2)).toBe("−1.50");
    expect(formatSignedRate(0, "en", 2)).toBe("0.00");
    expect(formatSignedRate(-0.001, "en", 2)).toBe("0.00");
    expect(formatSignedPercent(3.714, "ja")).toBe("+3.71%");
    expect(formatSignedPercent(-2.34, "en", 1)).toBe("−2.3%");
  });
});

describe("chart times", () => {
  it("labels the x axis at each period's granularity", () => {
    expect(formatChartTick(DAY, "1M", "ja")).toBe("7/22");
    expect(formatChartTick(DAY, "YTD", "en")).toBe("7/22");
    expect(formatChartTick(DAY, "1Y", "ja")).toBe("2026/7");
    expect(formatChartTick(DAY, "5D", "en")).toMatch(/^7\/2[12]$/u);
    expect(formatChartTick(DAY, "1D", "ja")).toMatch(/^\d{1,2}:00$/u);
  });

  it("names the hovered slot and the start of a shortened change", () => {
    expect(formatChartTime(DAY, "daily", "en")).toBe("Jul 22, 2026");
    expect(formatChartTime(DAY, "hourly", "en")).toMatch(/^Jul 2[12],? \d{1,2}:00/u);
    expect(formatChangeStart(DAY, "daily", "ja")).toBe("7/22");
    expect(formatChangeStart(DAY, "hourly", "ja")).toMatch(/^7\/2[12] \d{1,2}:00$/u);
  });
});
