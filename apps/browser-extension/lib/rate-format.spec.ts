import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatAxisWidthSample,
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

describe("axis width samples", () => {
  it("reserves two-digit changes for percent charts and rates below 100,000", () => {
    expect(formatAxisWidthSample("percent", "en")).toBe("−88.88%");
    expect(formatAxisWidthSample("percent", "ja")).toBe("−88.88%");
    expect(formatAxisWidthSample("rate", "en")).toBe("88,888.88");
    expect(formatAxisWidthSample("rate", "ja")).toBe("88,888.88");
  });
});

describe("chart times", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("labels the x axis in the viewer's time zone at each period's granularity", () => {
    vi.stubEnv("TZ", "Asia/Tokyo");
    expect(formatChartTick(DAY, "1M", "ja")).toBe("7/22");
    expect(formatChartTick(DAY, "YTD", "en")).toBe("7/22");
    expect(formatChartTick(DAY, "5D", "en")).toBe("7/22");
    expect(formatChartTick(DAY, "1Y", "ja")).toBe("2026/7");
    expect(formatChartTick(DAY, "1D", "ja")).toBe("9:00");

    vi.stubEnv("TZ", "America/New_York");
    expect(formatChartTick(DAY, "1M", "ja")).toBe("7/21");
    expect(formatChartTick(DAY, "1D", "en")).toBe("8:00 PM");
  });

  it("names the hovered slot and the start of a shortened change in local time", () => {
    vi.stubEnv("TZ", "Asia/Tokyo");
    expect(formatChartTime(DAY, "daily", "en")).toBe("Jul 22, 2026");
    expect(formatChartTime(DAY, "hourly", "en")).toBe("Jul 22, 9:00 AM");
    expect(formatChangeStart(DAY, "daily", "ja")).toBe("7/22");
    expect(formatChangeStart(DAY, "hourly", "ja")).toBe("7/22 9:00");

    vi.stubEnv("TZ", "America/New_York");
    expect(formatChartTime(DAY, "daily", "en")).toBe("Jul 21, 2026");
    expect(formatChangeStart(DAY, "daily", "ja")).toBe("7/21");
  });
});
