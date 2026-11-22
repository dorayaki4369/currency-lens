import { describe, expect, it, vi } from "vitest";
import {
  alignHourlyHistory,
  BACKFILL_STATE_KEY,
  dailyResponse,
  historyQuerySchema,
  HOURLY_HISTORY_KEY,
  HOURLY_SLOT_COUNT,
  hourlyResponse,
  InvalidStoredHistoryError,
  missingHourlySlots,
  monthsBetween,
  readHistory,
  setHourlySlot,
  toRateSnapshot,
  updateHistory,
  type HourlyHistory,
  type MonthlyHistory,
} from "./history";
import {
  createMemoryBucket,
  createRatesSnapshot,
  createSnapshotBody,
  HISTORY_NOW_MS,
} from "../test/fixtures";

const HOUR_MS = 3_600_000;
const NOW_SLOT_MS = Date.UTC(2026, 10, 21, 9);

/** Creates an hourly window ending at `NOW_SLOT_MS` with the given series. */
function createHourly(rates: HourlyHistory["rates"] = {}): HourlyHistory {
  return alignHourlyHistory(
    { ...alignHourlyHistory(null, NOW_SLOT_MS), rates },
    NOW_SLOT_MS,
  );
}

/** Creates a series with one value at `index` and nulls elsewhere. */
function seriesWith(length: number, entries: Record<number, number>): (number | null)[] {
  return Array.from({ length }, (_, index) => entries[index] ?? null);
}

describe("historyQuerySchema", () => {
  it("accepts up to six unique currency identifiers", () => {
    expect(
      historyQuerySchema.parse({ resolution: "daily", symbols: "USD,JPY,NEW_COIN" }),
    ).toEqual({
      resolution: "daily",
      symbols: ["USD", "JPY", "NEW_COIN"],
    });
  });

  it.each([
    ["duplicate symbols", { resolution: "daily", symbols: "JPY,JPY" }],
    ["too many symbols", { resolution: "daily", symbols: "A1,B1,C1,D1,E1,F1,G1" }],
    ["malformed symbols", { resolution: "daily", symbols: "jpy" }],
    ["missing symbols", { resolution: "hourly" }],
    ["unknown resolution", { resolution: "weekly", symbols: "JPY" }],
  ])("rejects %s", (_, query) => {
    expect(historyQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe("hourly aggregation", () => {
  it("converts OXR string rates into a numeric snapshot", () => {
    expect(toRateSnapshot(createRatesSnapshot())).toEqual({
      timestampMs: 1_700_000_000_000,
      rates: { USD: 1, EUR: 0.92, NEW_COIN: 2.5 },
    });
  });

  it("shifts stored series so that the window ends at the new slot", () => {
    const stored = createHourly({
      JPY: seriesWith(HOURLY_SLOT_COUNT, { 120: 150, 119: 149 }),
    });

    const shifted = alignHourlyHistory(stored, NOW_SLOT_MS + 2 * HOUR_MS);

    expect(shifted.start).toBe(new Date(NOW_SLOT_MS - 118 * HOUR_MS).toISOString());
    expect(shifted.rates["JPY"]?.slice(-4)).toEqual([149, 150, null, null]);
    expect(shifted.rates["JPY"]).toHaveLength(HOURLY_SLOT_COUNT);
  });

  it("writes snapshot rates into their slot and ignores slots outside the window", () => {
    const history = createHourly();

    setHourlySlot(history, NOW_SLOT_MS, { JPY: 150, EUR: 0.9 });
    setHourlySlot(history, NOW_SLOT_MS + HOUR_MS, { JPY: 151 });
    setHourlySlot(history, NOW_SLOT_MS - HOURLY_SLOT_COUNT * HOUR_MS, { JPY: 1 });

    expect(history.rates["JPY"]?.at(-1)).toBe(150);
    expect(history.rates["EUR"]?.at(-1)).toBe(0.9);
    expect(history.rates["JPY"]?.filter((value) => value !== null)).toEqual([150]);
  });

  it("splits the repair budget between the newest gaps and rotating older ones", () => {
    const history = createHourly({ JPY: seriesWith(HOURLY_SLOT_COUNT, { 120: 150 }) });

    const first = missingHourlySlots(history, 4, 0);
    const next = missingHourlySlots(history, 4, 1);
    const rotated = missingHourlySlots(history, 4, 3);

    expect(first.slice(0, 2)).toEqual([NOW_SLOT_MS - HOUR_MS, NOW_SLOT_MS - 2 * HOUR_MS]);
    expect(first.slice(2)).toEqual([NOW_SLOT_MS - 3 * HOUR_MS, NOW_SLOT_MS - 4 * HOUR_MS]);
    expect(next.slice(2)).toEqual([NOW_SLOT_MS - 5 * HOUR_MS, NOW_SLOT_MS - 6 * HOUR_MS]);
    expect(rotated.slice(2)).toEqual([
      NOW_SLOT_MS - 9 * HOUR_MS,
      NOW_SLOT_MS - 10 * HOUR_MS,
    ]);
  });

  it("returns every empty slot when they fit in the budget", () => {
    const history = createHourly({
      JPY: Array.from({ length: HOURLY_SLOT_COUNT }, (_, index) =>
        index === 100 ? null : 150,
      ),
    });

    expect(missingHourlySlots(history, 6)).toEqual([NOW_SLOT_MS - 20 * HOUR_MS]);
  });

  it("lists the newest empty slots first, up to the limit", () => {
    const history = createHourly({
      JPY: seriesWith(HOURLY_SLOT_COUNT, { 120: 150, 118: 149 }),
    });

    expect(missingHourlySlots(history, 2)).toEqual([
      NOW_SLOT_MS - HOUR_MS,
      NOW_SLOT_MS - 3 * HOUR_MS,
    ]);
  });
});

describe("history responses", () => {
  it("keeps requested hourly series with observations and ends at the current hour", () => {
    const stored = alignHourlyHistory(
      { ...alignHourlyHistory(null, NOW_SLOT_MS - HOUR_MS), rates: {} },
      NOW_SLOT_MS - HOUR_MS,
    );
    setHourlySlot(stored, NOW_SLOT_MS - HOUR_MS, { JPY: 150 });
    stored.rates["EUR"] = Array.from({ length: HOURLY_SLOT_COUNT }, () => null);

    const response = hourlyResponse(stored, ["JPY", "EUR", "GBP"], HISTORY_NOW_MS);

    expect(response.start).toBe(new Date(NOW_SLOT_MS - 120 * HOUR_MS).toISOString());
    expect(Object.keys(response.rates)).toEqual(["JPY"]);
    expect(response.rates["JPY"]?.slice(-2)).toEqual([150, null]);
  });

  it("returns an empty hourly window before any history is stored", () => {
    expect(hourlyResponse(null, ["JPY"], HISTORY_NOW_MS)).toEqual({
      base: "USD",
      resolution: "hourly",
      start: new Date(NOW_SLOT_MS - 120 * HOUR_MS).toISOString(),
      rates: {},
    });
  });

  it("joins monthly closes and ends with today's newest hourly rate", () => {
    const months: MonthlyHistory[] = [
      { version: 1, month: "2025-11", rates: { JPY: seriesWith(30, { 20: 140 }) } },
      {
        version: 1,
        month: "2026-11",
        rates: { JPY: seriesWith(30, { 19: 149 }), EUR: seriesWith(30, {}) },
      },
    ];
    const hourly = createHourly({
      JPY: seriesWith(HOURLY_SLOT_COUNT, { 110: 148, 118: 150 }),
    });

    const response = dailyResponse(months, hourly, ["JPY", "EUR"], "2026-11-21");

    expect(response.start).toBe("2025-11-21T00:00:00.000Z");
    expect(response.rates["JPY"]).toHaveLength(366);
    expect(response.rates["JPY"]?.[0]).toBe(140);
    expect(response.rates["JPY"]?.slice(-2)).toEqual([149, 150]);
    expect(response.rates).not.toHaveProperty("EUR");
  });

  it("leaves today empty when the hourly window has no rate from today", () => {
    const hourly = createHourly({ JPY: seriesWith(HOURLY_SLOT_COUNT, { 100: 147 }) });
    const months: MonthlyHistory[] = [
      { version: 1, month: "2026-11", rates: { JPY: seriesWith(30, { 19: 149 }) } },
    ];

    expect(
      dailyResponse(months, hourly, ["JPY"], "2026-11-21").rates["JPY"]?.at(-1),
    ).toBeNull();
    expect(
      dailyResponse(months, null, ["JPY"], "2026-11-21").rates["JPY"]?.at(-1),
    ).toBeNull();
    expect(dailyResponse(months, hourly, ["GBP"], "2026-11-21").rates).toEqual({});
  });

  it("lists every month that overlaps a range across a year boundary", () => {
    expect(monthsBetween("2025-11-21", "2026-02-01")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("reads hourly and daily responses from the bucket", async () => {
    const bucket = createMemoryBucket();
    bucket.seed(
      HOURLY_HISTORY_KEY,
      createHourly({ JPY: seriesWith(HOURLY_SLOT_COUNT, { 120: 150 }) }),
    );
    bucket.seed("history/daily/2026-11.tsv", {
      version: 1,
      month: "2026-11",
      rates: { JPY: seriesWith(30, { 19: 149 }) },
    });

    const hourly = await readHistory(
      bucket,
      { resolution: "hourly", symbols: ["JPY"] },
      HISTORY_NOW_MS,
    );
    const daily = await readHistory(
      bucket,
      { resolution: "daily", symbols: ["JPY"] },
      HISTORY_NOW_MS,
    );

    expect(hourly.rates["JPY"]?.at(-1)).toBe(150);
    expect(daily.rates["JPY"]?.slice(-2)).toEqual([149, 150]);
  });

  it.each([
    ["malformed JSON", "{"],
    [
      "a schema violation",
      { version: 1, start: "2026-11-21T09:00:00.000Z", rates: { JPY: [1] } },
    ],
  ])("rejects a stored hourly file with %s", async (_, body) => {
    const bucket = createMemoryBucket();
    bucket.seed(HOURLY_HISTORY_KEY, body);

    await expect(
      readHistory(bucket, { resolution: "hourly", symbols: ["JPY"] }, HISTORY_NOW_MS),
    ).rejects.toBeInstanceOf(InvalidStoredHistoryError);
  });

  it("rejects a monthly file whose series length does not match the month", async () => {
    const bucket = createMemoryBucket();
    bucket.seed("history/daily/2026-11.tsv", {
      version: 1,
      month: "2026-11",
      rates: { JPY: [1] },
    });

    await expect(
      readHistory(bucket, { resolution: "daily", symbols: ["JPY"] }, HISTORY_NOW_MS),
    ).rejects.toThrow("Stored rate history is invalid: history/daily/2026-11.tsv");
  });
});

describe("updateHistory", () => {
  it("creates the hourly window, repairs recent hours and backfills days from the archive", async () => {
    const bucket = createMemoryBucket();
    bucket.seed(
      "2026-11-21T07:00:05.000Z.json",
      createSnapshotBody(Date.UTC(2026, 10, 21, 7, 0, 5), { JPY: 149.7 }),
    );
    bucket.seed(
      "2026-11-20T22:00:00.000Z.json",
      createSnapshotBody(Date.UTC(2026, 10, 20, 22), { JPY: 149.2 }),
    );
    bucket.seed(
      "2026-11-20T23:00:00.000Z.json",
      createSnapshotBody(Date.UTC(2026, 10, 20, 23), { JPY: 149.4 }),
    );
    const legacyDayMs = Date.UTC(2026, 10, 16);
    bucket.seed(
      `latest/${legacyDayMs - 3_600_000}/USD.json`,
      createSnapshotBody(legacyDayMs - 3_600_000, { JPY: 1 }),
    );
    bucket.seed(
      `latest/${legacyDayMs + 3_600_000}/USD.json`,
      createSnapshotBody(legacyDayMs + 3_600_000, { JPY: 146 }),
    );
    bucket.seed(
      `latest/${legacyDayMs + 82_800_000}/USD.json`,
      createSnapshotBody(legacyDayMs + 82_800_000, { JPY: 147 }),
    );
    bucket.seed(
      `latest/${legacyDayMs + 90_000_000}/USD.json`,
      createSnapshotBody(legacyDayMs + 90_000_000, { JPY: 2 }),
    );

    await updateHistory(
      bucket,
      { timestampMs: NOW_SLOT_MS + 12_000, rates: { USD: 1, JPY: 150 } },
      HISTORY_NOW_MS,
    );

    const hourly = bucket.read(HOURLY_HISTORY_KEY) as HourlyHistory;
    expect(hourly.rates["JPY"]?.slice(-3)).toEqual([149.7, null, 150]);
    const november = bucket.read("history/daily/2026-11.tsv") as MonthlyHistory;
    expect(november.rates["JPY"]?.[19]).toBe(149.4);
    expect(november.rates["JPY"]?.[15]).toBe(147);
    expect(bucket.read(BACKFILL_STATE_KEY)).toEqual({ version: 1, nextDate: "2026-11-13" });
  });

  it("continues the backfill from the stored cursor and skips days that are already known", async () => {
    const bucket = createMemoryBucket();
    bucket.seed(BACKFILL_STATE_KEY, { version: 1, nextDate: "2026-10-02" });
    bucket.seed("history/daily/2026-11.tsv", {
      version: 1,
      month: "2026-11",
      rates: { JPY: seriesWith(30, { 17: 148, 18: 148.5, 19: 149 }) },
    });
    bucket.seed(
      "2026-10-01T23:00:00.000Z.json",
      createSnapshotBody(Date.UTC(2026, 9, 1, 23), { JPY: 145 }),
    );
    const list = vi.spyOn(bucket, "list");

    await updateHistory(
      bucket,
      { timestampMs: NOW_SLOT_MS, rates: { USD: 1, JPY: 150 } },
      HISTORY_NOW_MS,
    );

    const listedPrefixes = list.mock.calls.map(([options]) => options?.prefix);
    expect(listedPrefixes).not.toContain("2026-11-20T");
    const october = bucket.read("history/daily/2026-10.tsv") as MonthlyHistory;
    expect(october.rates["JPY"]?.[0]).toBe(145);
    expect(october.rates["JPY"]).toHaveLength(31);
    expect(bucket.read(BACKFILL_STATE_KEY)).toEqual({ version: 1, nextDate: "2026-09-28" });
  });

  it("stops backfilling at the oldest served day without rewriting the cursor", async () => {
    const bucket = createMemoryBucket();
    bucket.seed(BACKFILL_STATE_KEY, { version: 1, nextDate: "2025-11-20" });
    const put = vi.spyOn(bucket, "put");

    await updateHistory(
      bucket,
      { timestampMs: NOW_SLOT_MS, rates: { USD: 1, JPY: 150 } },
      HISTORY_NOW_MS,
    );

    expect(put.mock.calls.map(([key]) => key)).toEqual([HOURLY_HISTORY_KEY]);
  });

  it("skips archived snapshots that are missing or invalid", async () => {
    const bucket = createMemoryBucket();
    bucket.seed(BACKFILL_STATE_KEY, { version: 1, nextDate: "2025-11-20" });
    bucket.seed("2026-11-21T08:00:00.000Z.json", "{");
    bucket.seed("2026-11-20T23:00:00.000Z.json", { rates: {} });
    bucket.seed(
      "2026-11-19T23:00:00.000Z.json",
      createSnapshotBody(Date.UTC(2026, 10, 19, 23), { JPY: 149 }),
    );
    const get = bucket.get.bind(bucket);
    vi.spyOn(bucket, "get").mockImplementation(async (key: string) =>
      key === "2026-11-19T23:00:00.000Z.json" ? null : get(key),
    );

    await updateHistory(
      bucket,
      { timestampMs: NOW_SLOT_MS, rates: { USD: 1, JPY: 150 } },
      HISTORY_NOW_MS,
    );

    expect(bucket.keys()).not.toContain("history/daily/2026-11.tsv");
    expect(
      (bucket.read(HOURLY_HISTORY_KEY) as HourlyHistory).rates["JPY"]?.at(-2),
    ).toBeNull();
  });

  it("rebuilds invalid aggregate files and restarts the backfill after losing a month", async () => {
    const bucket = createMemoryBucket();
    bucket.seed(HOURLY_HISTORY_KEY, "{");
    bucket.seed("history/daily/2026-11.tsv", {
      version: 1,
      month: "2026-11",
      rates: { JPY: [1] },
    });
    bucket.seed(BACKFILL_STATE_KEY, { version: 1, nextDate: "2026-01-01" });
    bucket.seed(
      "2026-11-17T23:00:00.000Z.json",
      createSnapshotBody(Date.UTC(2026, 10, 17, 23), { JPY: 148 }),
    );

    const result = await updateHistory(
      bucket,
      { timestampMs: NOW_SLOT_MS, rates: { USD: 1, JPY: 150 } },
      HISTORY_NOW_MS,
    );

    expect(result.rebuiltKeys).toEqual([HOURLY_HISTORY_KEY, "history/daily/2026-11.tsv"]);
    expect((bucket.read(HOURLY_HISTORY_KEY) as HourlyHistory).rates["JPY"]?.at(-1)).toBe(
      150,
    );
    expect(
      (bucket.read("history/daily/2026-11.tsv") as MonthlyHistory).rates["JPY"]?.[16],
    ).toBe(148);
    expect(bucket.read(BACKFILL_STATE_KEY)).toEqual({ version: 1, nextDate: "2026-11-13" });
  });

  it("rotates the hourly repairs over successive runs so that older gaps are retried", async () => {
    const bucket = createMemoryBucket();
    bucket.seed(BACKFILL_STATE_KEY, { version: 1, nextDate: "2025-11-20" });
    // Six newest gaps have no archive; the three oldest gaps can be recovered.
    const unrecoverable = [1, 2, 3, 4, 5, 6];
    const recoverable = [50, 51, 52];
    const gaps = new Set([0, ...unrecoverable, ...recoverable]);
    bucket.seed(HOURLY_HISTORY_KEY, {
      ...createHourly(),
      rates: {
        JPY: Array.from({ length: HOURLY_SLOT_COUNT }, (_, index) =>
          gaps.has(HOURLY_SLOT_COUNT - 1 - index) ? null : 150,
        ),
      },
    });
    for (const hoursAgo of recoverable) {
      const slotMs = NOW_SLOT_MS - hoursAgo * HOUR_MS;
      bucket.seed(
        `${new Date(slotMs).toISOString()}.json`,
        createSnapshotBody(slotMs, { JPY: 140 + hoursAgo }),
      );
    }

    for (const elapsedHours of [0, 1]) {
      // Scheduled runs are sequential; each run reads what the previous one wrote.
      // eslint-disable-next-line no-await-in-loop
      await updateHistory(
        bucket,
        {
          timestampMs: NOW_SLOT_MS + elapsedHours * HOUR_MS,
          rates: { USD: 1, JPY: 150 },
        },
        HISTORY_NOW_MS + elapsedHours * HOUR_MS,
      );
    }

    const series = (bucket.read(HOURLY_HISTORY_KEY) as HourlyHistory).rates["JPY"];
    expect(recoverable.map((hoursAgo) => series?.at(-2 - hoursAgo))).toEqual([
      190, 191, 192,
    ]);
  });

  it.each([
    ["a schema violation", { version: 2 }],
    ["malformed JSON", "{"],
  ])("rebuilds a backfill cursor with %s", async (_, body) => {
    const bucket = createMemoryBucket();
    bucket.seed(BACKFILL_STATE_KEY, body);

    const result = await updateHistory(
      bucket,
      { timestampMs: NOW_SLOT_MS, rates: { USD: 1, JPY: 150 } },
      HISTORY_NOW_MS,
    );

    expect(result.rebuiltKeys).toEqual([BACKFILL_STATE_KEY]);
    expect(bucket.read(BACKFILL_STATE_KEY)).toEqual({ version: 1, nextDate: "2026-11-13" });
  });

  it("propagates storage failures other than invalid files", async () => {
    const bucket = createMemoryBucket();
    vi.spyOn(bucket, "get").mockRejectedValue(new Error("R2 unavailable"));

    await expect(
      updateHistory(
        bucket,
        { timestampMs: NOW_SLOT_MS, rates: { USD: 1 } },
        HISTORY_NOW_MS,
      ),
    ).rejects.toThrow("R2 unavailable");
  });
});

describe("readHistory request-path validation", () => {
  it("validates only the requested series", async () => {
    const bucket = createMemoryBucket();
    const hourly = createHourly({ JPY: seriesWith(HOURLY_SLOT_COUNT, { 120: 150 }) });
    bucket.seed(HOURLY_HISTORY_KEY, {
      ...hourly,
      rates: { ...hourly.rates, EUR: "broken" },
    });

    const response = await readHistory(
      bucket,
      { resolution: "daily", symbols: ["JPY", "GBP"] },
      HISTORY_NOW_MS,
    );

    expect(Object.keys(response.rates)).toEqual(["JPY"]);
    expect(response.rates["JPY"]?.filter((value) => value !== null)).toEqual([150]);
  });

  it("rejects a month stored under another month's key", async () => {
    const bucket = createMemoryBucket();
    bucket.seed("history/daily/2026-10.tsv", {
      version: 1,
      month: "2026-09",
      rates: { JPY: seriesWith(30, { 0: 1 }) },
    });

    await expect(
      readHistory(bucket, { resolution: "daily", symbols: ["JPY"] }, HISTORY_NOW_MS),
    ).rejects.toThrow("Stored rate history is invalid: history/daily/2026-10.tsv");
  });

  it("rejects a requested series with an invalid length", async () => {
    const bucket = createMemoryBucket();
    bucket.seed(HOURLY_HISTORY_KEY, { ...createHourly(), rates: { JPY: [1, 2] } });

    await expect(
      readHistory(bucket, { resolution: "hourly", symbols: ["JPY"] }, HISTORY_NOW_MS),
    ).rejects.toBeInstanceOf(InvalidStoredHistoryError);
  });
});
