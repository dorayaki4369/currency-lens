import { currencyIdentifierSchema, oxrLatestResponseSchema } from "@cl/oxr/schema";
import { z } from "zod/v4";

export const HOURLY_HISTORY_KEY = "history/hourly.json";
export const BACKFILL_STATE_KEY = "history/backfill.json";
export const HOURLY_SLOT_COUNT = 121;
export const DAILY_SLOT_COUNT = 366;
export const MAX_HISTORY_SYMBOLS = 6;

/** Bounds per scheduled run keep R2 operations and CPU time within Workers Free limits. */
const MAX_HOURLY_REPAIRS_PER_RUN = 6;
const MAX_BACKFILL_DAYS_PER_RUN = 4;
/** Completed days rechecked every run so a failed aggregation recovers from the archive. */
const RECENT_DAYS_TO_CHECK = 3;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const LEGACY_SNAPSHOT_PREFIX = "latest/";

const rateSeriesSchema = z.array(z.number().positive().nullable());

const hourlyHistorySchema = z.strictObject({
  version: z.literal(1),
  start: z.iso.datetime(),
  rates: z.record(currencyIdentifierSchema, rateSeriesSchema.length(HOURLY_SLOT_COUNT)),
});

const monthlyHistorySchema = z
  .strictObject({
    version: z.literal(1),
    month: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/),
    rates: z.record(currencyIdentifierSchema, rateSeriesSchema),
  })
  .superRefine((history, context) => {
    const dayCount = daysInMonth(history.month);
    for (const [currency, series] of Object.entries(history.rates)) {
      if (series.length !== dayCount) {
        context.addIssue({
          code: "custom",
          message: `Expected ${dayCount} daily rates`,
          path: ["rates", currency],
        });
      }
    }
  });

const backfillStateSchema = z.strictObject({
  version: z.literal(1),
  nextDate: z.iso.date(),
});

export const historyQuerySchema = z.object({
  resolution: z.enum(["hourly", "daily"]),
  symbols: z
    .string()
    .transform((value) => value.split(","))
    .pipe(z.array(currencyIdentifierSchema).min(1).max(MAX_HISTORY_SYMBOLS))
    .refine(
      (symbols) => new Set(symbols).size === symbols.length,
      "Symbols must be unique",
    ),
});

export type HourlyHistory = z.infer<typeof hourlyHistorySchema>;
export type MonthlyHistory = z.infer<typeof monthlyHistorySchema>;
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
export type RateSnapshot = { timestampMs: number; rates: Record<string, number> };

/** The public `/v1/history` body: aligned USD-based series starting at `start`. */
export type HistoryResponse = {
  base: "USD";
  resolution: HistoryQuery["resolution"];
  start: string;
  rates: Record<string, (number | null)[]>;
};

/** Indicates that an R2 history file could not be trusted. */
export class InvalidStoredHistoryError extends Error {
  public constructor(key: string, options?: ErrorOptions) {
    super(`Stored rate history is invalid: ${key}`, options);
    this.name = "InvalidStoredHistoryError";
  }
}

/** Builds the public response for one resolution from the stored aggregates. */
export async function readHistory(
  bucket: R2Bucket,
  query: HistoryQuery,
  nowMs: number,
): Promise<HistoryResponse> {
  const hourly = await readJson(bucket, HOURLY_HISTORY_KEY, hourlyHistorySchema);
  if (query.resolution === "hourly") {
    return hourlyResponse(hourly, query.symbols, nowMs);
  }

  const today = toDateString(nowMs);
  const start = addDays(today, -(DAILY_SLOT_COUNT - 1));
  const months = await Promise.all(
    monthsBetween(start, today).map((month) =>
      readJson(bucket, monthlyHistoryKey(month), monthlyHistorySchema),
    ),
  );
  return dailyResponse(
    months.filter((month) => month !== null),
    hourly,
    query.symbols,
    today,
  );
}

/**
 * Folds the newest snapshot into the aggregates and repairs a bounded number of
 * missing slots and days from the archived snapshots.
 */
export async function updateHistory(
  bucket: R2Bucket,
  snapshot: RateSnapshot,
  nowMs: number,
): Promise<void> {
  const stored = await readJson(bucket, HOURLY_HISTORY_KEY, hourlyHistorySchema);
  const hourly = alignHourlyHistory(stored, floorToHour(snapshot.timestampMs));
  setHourlySlot(hourly, floorToHour(snapshot.timestampMs), snapshot.rates);
  const repairs = await Promise.all(
    missingHourlySlots(hourly, MAX_HOURLY_REPAIRS_PER_RUN).map(async (slotMs) => ({
      slotMs,
      snapshot: await findSnapshotForHour(bucket, slotMs),
    })),
  );
  for (const { slotMs, snapshot: repaired } of repairs) {
    if (repaired !== null) {
      setHourlySlot(hourly, slotMs, repaired.rates);
    }
  }
  await writeJson(bucket, HOURLY_HISTORY_KEY, hourly);

  const today = toDateString(nowMs);
  const state = await readJson(bucket, BACKFILL_STATE_KEY, backfillStateSchema);
  const oldestDate = addDays(today, -(DAILY_SLOT_COUNT - 1));
  const recentDates = Array.from({ length: RECENT_DAYS_TO_CHECK }, (_, index) =>
    addDays(today, -(index + 1)),
  );
  const backfillDates: string[] = [];
  let nextDate = state?.nextDate ?? addDays(today, -(RECENT_DAYS_TO_CHECK + 1));
  while (backfillDates.length < MAX_BACKFILL_DAYS_PER_RUN && nextDate >= oldestDate) {
    backfillDates.push(nextDate);
    nextDate = addDays(nextDate, -1);
  }

  const months = new MonthlyHistoryCache(bucket);
  await Promise.all(
    [...recentDates, ...backfillDates].map((date) => fillDay(months, bucket, date)),
  );
  await months.flush();
  if (state?.nextDate !== nextDate) {
    await writeJson(bucket, BACKFILL_STATE_KEY, { version: 1, nextDate });
  }
}

/** Converts a validated OXR response into numeric rates keyed by its source time. */
export function toRateSnapshot(
  data: z.infer<typeof oxrLatestResponseSchema>,
): RateSnapshot {
  return {
    timestampMs: data.timestamp * 1000,
    rates: Object.fromEntries(
      Object.entries(data.rates).map(([code, rate]) => [code, Number(rate)]),
    ),
  };
}

/** Shifts a stored hourly window so that it ends at `endSlotMs`, creating it when absent. */
export function alignHourlyHistory(
  stored: HourlyHistory | null,
  endSlotMs: number,
): HourlyHistory {
  const startMs = endSlotMs - (HOURLY_SLOT_COUNT - 1) * HOUR_MS;
  const shift = stored ? Math.round((Date.parse(stored.start) - startMs) / HOUR_MS) : 0;
  const rates: HourlyHistory["rates"] = {};
  for (const [currency, series] of Object.entries(stored?.rates ?? {})) {
    rates[currency] = Array.from(
      { length: HOURLY_SLOT_COUNT },
      (_, index) => series[index - shift] ?? null,
    );
  }

  return { version: 1, start: new Date(startMs).toISOString(), rates };
}

/** Writes every rate of one snapshot into its hourly slot, ignoring slots outside the window. */
export function setHourlySlot(
  history: HourlyHistory,
  slotMs: number,
  rates: Record<string, number>,
): void {
  const index = Math.round((slotMs - Date.parse(history.start)) / HOUR_MS);
  if (index < 0 || index >= HOURLY_SLOT_COUNT) {
    return;
  }

  for (const [currency, rate] of Object.entries(rates)) {
    const series = (history.rates[currency] ??= Array.from(
      { length: HOURLY_SLOT_COUNT },
      () => null,
    ));
    series[index] = rate;
  }
}

/** Lists the newest slots that have no rate for any currency, up to `limit`. */
export function missingHourlySlots(history: HourlyHistory, limit: number): number[] {
  const startMs = Date.parse(history.start);
  const series = Object.values(history.rates);
  const missing: number[] = [];
  for (
    let index = HOURLY_SLOT_COUNT - 1;
    index >= 0 && missing.length < limit;
    index -= 1
  ) {
    if (series.every((values) => values[index] === null)) {
      missing.push(startMs + index * HOUR_MS);
    }
  }

  return missing;
}

/** Selects the requested currencies from the hourly window ending at the current hour. */
export function hourlyResponse(
  stored: HourlyHistory | null,
  symbols: readonly string[],
  nowMs: number,
): HistoryResponse {
  const latestSlotMs = stored
    ? Date.parse(stored.start) + (HOURLY_SLOT_COUNT - 1) * HOUR_MS
    : 0;
  const history = alignHourlyHistory(stored, Math.max(latestSlotMs, floorToHour(nowMs)));
  return {
    base: "USD",
    resolution: "hourly",
    start: history.start,
    rates: pickSeries(history.rates, symbols),
  };
}

/**
 * Joins the monthly closes of the last 366 UTC days and appends today's newest
 * hourly rate as the final, still-moving point.
 */
export function dailyResponse(
  months: readonly MonthlyHistory[],
  hourly: HourlyHistory | null,
  symbols: readonly string[],
  today: string,
): HistoryResponse {
  const start = addDays(today, -(DAILY_SLOT_COUNT - 1));
  const monthByKey = new Map(months.map((month) => [month.month, month]));
  const rates: Record<string, (number | null)[]> = {};
  for (const symbol of symbols) {
    const series = Array.from({ length: DAILY_SLOT_COUNT }, (_, index) => {
      const date = addDays(start, index);
      const value = monthByKey.get(date.slice(0, 7))?.rates[symbol]?.[
        Number(date.slice(8)) - 1
      ];
      return value ?? null;
    });
    series[DAILY_SLOT_COUNT - 1] = latestRateOnDate(hourly, symbol, today);
    if (series.some((value) => value !== null)) {
      rates[symbol] = series;
    }
  }

  return { base: "USD", resolution: "daily", start: `${start}T00:00:00.000Z`, rates };
}

/** Returns the newest hourly rate observed on the given UTC date. */
function latestRateOnDate(
  hourly: HourlyHistory | null,
  symbol: string,
  date: string,
): number | null {
  const series = hourly?.rates[symbol];
  if (!hourly || !series) {
    return null;
  }

  const startMs = Date.parse(hourly.start);
  for (let index = HOURLY_SLOT_COUNT - 1; index >= 0; index -= 1) {
    const value = series[index] ?? null;
    if (value !== null && toDateString(startMs + index * HOUR_MS) === date) {
      return value;
    }
  }

  return null;
}

/** Keeps only requested currencies that have at least one observation. */
function pickSeries(
  rates: Record<string, (number | null)[]>,
  symbols: readonly string[],
): Record<string, (number | null)[]> {
  return Object.fromEntries(
    symbols.flatMap((symbol) => {
      const series = rates[symbol];
      return series !== undefined && series.some((value) => value !== null)
        ? [[symbol, series]]
        : [];
    }),
  );
}

type MonthlyHistoryEntry = { history: MonthlyHistory; dirty: boolean };

/**
 * Loads, edits and writes back monthly files so each month is read and written
 * at most once per run, even when several days are filled concurrently.
 */
class MonthlyHistoryCache {
  private readonly entries = new Map<string, Promise<MonthlyHistoryEntry>>();

  public constructor(private readonly bucket: R2Bucket) {}

  /** Returns the month's entry, starting an empty month when it is not stored yet. */
  public get(month: string): Promise<MonthlyHistoryEntry> {
    let entry = this.entries.get(month);
    if (entry === undefined) {
      entry = readJson(this.bucket, monthlyHistoryKey(month), monthlyHistorySchema).then(
        (stored) => ({ history: stored ?? { version: 1, month, rates: {} }, dirty: false }),
      );
      this.entries.set(month, entry);
    }

    return entry;
  }

  /** Writes every changed month. */
  public async flush(): Promise<void> {
    const entries = await Promise.all(this.entries.values());
    await Promise.all(
      entries
        .filter((entry) => entry.dirty)
        .map((entry) =>
          writeJson(this.bucket, monthlyHistoryKey(entry.history.month), entry.history),
        ),
    );
  }
}

/** Stores the last archived snapshot of a UTC date as that day's close, unless it is already known. */
async function fillDay(
  months: MonthlyHistoryCache,
  bucket: R2Bucket,
  date: string,
): Promise<void> {
  const entry = await months.get(date.slice(0, 7));
  const month = entry.history;
  const dayIndex = Number(date.slice(8)) - 1;
  if (Object.values(month.rates).some((series) => series[dayIndex] !== null)) {
    return;
  }

  const snapshot = await findLastSnapshotOfDay(bucket, date);
  if (snapshot === null) {
    return;
  }

  const dayCount = daysInMonth(month.month);
  for (const [currency, rate] of Object.entries(snapshot.rates)) {
    const series = (month.rates[currency] ??= Array.from({ length: dayCount }, () => null));
    series[dayIndex] = rate;
  }
  entry.dirty = true;
}

/** Finds the archived snapshot published within the given hour. */
async function findSnapshotForHour(
  bucket: R2Bucket,
  slotMs: number,
): Promise<RateSnapshot | null> {
  const prefix = new Date(slotMs).toISOString().slice(0, 13);
  const listed = await bucket.list({ prefix, limit: 1 });
  const key = listed.objects[0]?.key;
  return key === undefined ? null : readSnapshot(bucket, key);
}

/**
 * Finds the last archived snapshot of a UTC date in the current ISO key format,
 * then in the legacy `latest/{ms}/USD.json` format.
 */
async function findLastSnapshotOfDay(
  bucket: R2Bucket,
  date: string,
): Promise<RateSnapshot | null> {
  const isoListing = await bucket.list({ prefix: `${date}T`, limit: 30 });
  const isoKey = isoListing.objects.at(-1)?.key;
  if (isoKey !== undefined) {
    return readSnapshot(bucket, isoKey);
  }

  const dayStartMs = Date.parse(`${date}T00:00:00.000Z`);
  const legacyListing = await bucket.list({
    prefix: LEGACY_SNAPSHOT_PREFIX,
    startAfter: `${LEGACY_SNAPSHOT_PREFIX}${dayStartMs - 1}`,
    limit: 30,
  });
  const legacyKey = legacyListing.objects
    .map((object) => object.key)
    .findLast((key) => {
      const timestampMs = Number(key.slice(LEGACY_SNAPSHOT_PREFIX.length).split("/")[0]);
      return timestampMs >= dayStartMs && timestampMs < dayStartMs + DAY_MS;
    });
  return legacyKey === undefined ? null : readSnapshot(bucket, legacyKey);
}

/** Reads one archived OXR snapshot; unreadable archives are skipped rather than failing the run. */
async function readSnapshot(bucket: R2Bucket, key: string): Promise<RateSnapshot | null> {
  const object = await bucket.get(key);
  if (!object) {
    return null;
  }

  const result = oxrLatestResponseSchema.safeParse(await object.json().catch(() => null));
  return result.success ? toRateSnapshot(result.data) : null;
}

/** Reads and validates an aggregate file, returning null when it has not been created yet. */
async function readJson<T>(
  bucket: R2Bucket,
  key: string,
  schema: z.ZodType<T>,
): Promise<T | null> {
  const object = await bucket.get(key);
  if (!object) {
    return null;
  }

  let json: unknown;
  try {
    json = await object.json();
  } catch (error) {
    throw new InvalidStoredHistoryError(key, { cause: error });
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    throw new InvalidStoredHistoryError(key, { cause: result.error });
  }

  return result.data;
}

/** Writes an aggregate file as JSON. */
async function writeJson(bucket: R2Bucket, key: string, value: unknown): Promise<void> {
  await bucket.put(key, JSON.stringify(value), {
    httpMetadata: { contentType: "application/json" },
  });
}

/** Returns the R2 key of one month of daily closes. */
function monthlyHistoryKey(month: string): string {
  return `history/daily/${month}.json`;
}

/** Lists the `YYYY-MM` months that overlap the inclusive date range. */
export function monthsBetween(startDate: string, endDate: string): string[] {
  const months: string[] = [];
  let year = Number(startDate.slice(0, 4));
  let month = Number(startDate.slice(5, 7));
  const end = endDate.slice(0, 7);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    months.push(key);
    if (key >= end) {
      return months;
    }
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
}

/** Returns the number of days in a `YYYY-MM` month. */
function daysInMonth(month: string): number {
  return new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  ).getUTCDate();
}

/** Formats an epoch time as its UTC `YYYY-MM-DD` date. */
function toDateString(timeMs: number): string {
  return new Date(timeMs).toISOString().slice(0, 10);
}

/** Moves a `YYYY-MM-DD` date by whole UTC days. */
function addDays(date: string, days: number): string {
  return toDateString(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS);
}

/** Truncates an epoch time to the start of its UTC hour. */
function floorToHour(timeMs: number): number {
  return Math.floor(timeMs / HOUR_MS) * HOUR_MS;
}
