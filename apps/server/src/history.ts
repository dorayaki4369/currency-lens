import { currencyIdentifierSchema, oxrLatestResponseSchema } from "@cl/oxr/schema";
import { z } from "zod/v4";

export const HOURLY_HISTORY_KEY = "history/hourly.tsv";
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
const monthSchema = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/);
const hourlyHeaderSchema = z.strictObject({
  version: z.literal(1),
  start: z.iso.datetime(),
});
const monthlyHeaderSchema = z.strictObject({ version: z.literal(1), month: monthSchema });

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

type RateSeries = (number | null)[];
export type HourlyHistory = z.infer<typeof hourlyHeaderSchema> & {
  rates: Record<string, RateSeries>;
};
export type MonthlyHistory = z.infer<typeof monthlyHeaderSchema> & {
  rates: Record<string, RateSeries>;
};
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
  const symbols = new Set(query.symbols);
  const hourly = await readHourlyHistory(bucket, symbols);
  if (query.resolution === "hourly") {
    return hourlyResponse(hourly, query.symbols, nowMs);
  }

  const today = toDateString(nowMs);
  const start = addDays(today, -(DAILY_SLOT_COUNT - 1));
  const months = await Promise.all(
    monthsBetween(start, today).map((month) => readMonthlyHistory(bucket, month, symbols)),
  );
  return dailyResponse(
    months.filter((month) => month !== null),
    hourly,
    query.symbols,
    today,
  );
}

/** Keys of aggregate files that were invalid and have been rebuilt from scratch. */
export type HistoryUpdateResult = { rebuiltKeys: string[] };

/**
 * Folds the newest snapshot into the aggregates and repairs a bounded number of
 * missing slots and days from the archived snapshots. Invalid aggregate files
 * are rebuilt, since every value in them can be derived again from the archive.
 */
export async function updateHistory(
  bucket: R2Bucket,
  snapshot: RateSnapshot,
  nowMs: number,
): Promise<HistoryUpdateResult> {
  const rebuiltKeys: string[] = [];
  const readOrRebuild = async <T>(
    key: string,
    read: () => Promise<T | null>,
  ): Promise<T | null> => {
    try {
      return await read();
    } catch (error) {
      if (!(error instanceof InvalidStoredHistoryError)) {
        throw error;
      }
      rebuiltKeys.push(key);
      return null;
    }
  };

  const slotMs = floorToHour(snapshot.timestampMs);
  const hourly = alignHourlyHistory(
    await readOrRebuild(HOURLY_HISTORY_KEY, () => readHourlyHistory(bucket)),
    slotMs,
  );
  setHourlySlot(hourly, slotMs, snapshot.rates);
  const repairs = await Promise.all(
    missingHourlySlots(hourly, MAX_HOURLY_REPAIRS_PER_RUN, slotMs / HOUR_MS).map(
      async (missingMs) => ({
        missingMs,
        repaired: await findSnapshotForHour(bucket, missingMs),
      }),
    ),
  );
  for (const { missingMs, repaired } of repairs) {
    if (repaired !== null) {
      setHourlySlot(hourly, missingMs, repaired.rates);
    }
  }
  await writeSeriesFile(
    bucket,
    HOURLY_HISTORY_KEY,
    { version: 1, start: hourly.start },
    hourly.rates,
  );

  const today = toDateString(nowMs);
  const months = new MonthlyHistoryCache(async (month) => {
    const key = monthlyHistoryKey(month);
    const stored = await readOrRebuild(key, () => readMonthlyHistory(bucket, month));
    // An invalid file is replaced even when no close can be recovered in this run.
    return { stored, dirty: rebuiltKeys.includes(key) };
  });
  const recentDates = Array.from({ length: RECENT_DAYS_TO_CHECK }, (_, index) =>
    addDays(today, -(index + 1)),
  );
  await Promise.all(recentDates.map((date) => fillDay(months, bucket, date)));

  // A rebuilt month lost older closes, so the backfill restarts from the newest day.
  const state = await readOrRebuild(BACKFILL_STATE_KEY, () =>
    readJson(bucket, BACKFILL_STATE_KEY, backfillStateSchema),
  );
  const lostMonth = () => rebuiltKeys.some((key) => key.startsWith("history/daily/"));
  const restartDate = addDays(today, -(RECENT_DAYS_TO_CHECK + 1));
  const restarted = state === null || lostMonth();
  const oldestDate = addDays(today, -(DAILY_SLOT_COUNT - 1));
  const backfillDates: string[] = [];
  // After passing the oldest served day the backfill cycles back to the newest
  // one, so days missed while aggregation was failing are found again.
  let nextDate = restarted || state.nextDate < oldestDate ? restartDate : state.nextDate;
  while (backfillDates.length < MAX_BACKFILL_DAYS_PER_RUN && nextDate >= oldestDate) {
    backfillDates.push(nextDate);
    nextDate = addDays(nextDate, -1);
  }
  await Promise.all(backfillDates.map((date) => fillDay(months, bucket, date)));
  // A month found invalid by this batch also lost the closes newer than the cursor.
  if (!restarted && lostMonth()) {
    nextDate = restartDate;
  }
  await months.flush((month, history) =>
    writeSeriesFile(bucket, monthlyHistoryKey(month), { version: 1, month }, history.rates),
  );
  if (state?.nextDate !== nextDate) {
    await writeJson(bucket, BACKFILL_STATE_KEY, { version: 1, nextDate });
  }

  return { rebuiltKeys };
}

/** Converts a validated OXR response into numeric rates keyed by its source time. */
export function toRateSnapshot(
  data: z.infer<typeof oxrLatestResponseSchema>,
): RateSnapshot {
  return {
    timestampMs: data.timestamp * 1000,
    rates: Object.fromEntries(
      Object.entries(data.rates).map(([code, rate]) => [code, roundRate(Number(rate))]),
    ),
  };
}

/** Six significant digits are ample for charts and halve the size of the aggregate files. */
function roundRate(rate: number): number {
  return Number(rate.toPrecision(6));
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

/**
 * Lists up to `limit` slots that have no rate for any currency. Half of the
 * budget goes to the newest gaps; the rest rotates through the older ones so
 * that unrecoverable recent gaps cannot starve them. `rotation` counts runs,
 * and each run advances by the older budget so that successive runs visit
 * every older gap.
 */
export function missingHourlySlots(
  history: HourlyHistory,
  limit: number,
  rotation = 0,
): number[] {
  const startMs = Date.parse(history.start);
  const series = Object.values(history.rates);
  const missing: number[] = [];
  for (let index = HOURLY_SLOT_COUNT - 1; index >= 0; index -= 1) {
    if (series.every((values) => values[index] === null)) {
      missing.push(startMs + index * HOUR_MS);
    }
  }
  if (missing.length <= limit) {
    return missing;
  }

  const newestCount = Math.ceil(limit / 2);
  const olderBudget = limit - newestCount;
  const older = missing.slice(newestCount);
  const offset = (rotation * olderBudget) % older.length;
  return [
    ...missing.slice(0, newestCount),
    ...[...older.slice(offset), ...older.slice(0, offset)].slice(0, olderBudget),
  ];
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

  /** `load` marks a month dirty when its stored file must be replaced regardless of edits. */
  public constructor(
    private readonly load: (
      month: string,
    ) => Promise<{ stored: MonthlyHistory | null; dirty: boolean }>,
  ) {}

  /** Returns the month's entry, starting an empty month when it is not stored yet. */
  public get(month: string): Promise<MonthlyHistoryEntry> {
    let entry = this.entries.get(month);
    if (entry === undefined) {
      entry = this.load(month).then(({ stored, dirty }) => ({
        history: stored ?? { version: 1, month, rates: {} },
        dirty,
      }));
      this.entries.set(month, entry);
    }

    return entry;
  }

  /** Writes every changed month. */
  public async flush(
    write: (month: string, history: MonthlyHistory) => Promise<void>,
  ): Promise<void> {
    const entries = await Promise.all(this.entries.values());
    await Promise.all(
      entries
        .filter((entry) => entry.dirty)
        .map((entry) => write(entry.history.month, entry.history)),
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

/** Reads the hourly aggregate, parsing only the selected currencies when a set is given. */
async function readHourlyHistory(
  bucket: R2Bucket,
  symbols?: ReadonlySet<string>,
): Promise<HourlyHistory | null> {
  const file = await readSeriesFile(
    bucket,
    HOURLY_HISTORY_KEY,
    hourlyHeaderSchema,
    symbols,
  );
  return file === null
    ? null
    : {
        ...file.header,
        rates: checkLengths(HOURLY_HISTORY_KEY, file.rates, HOURLY_SLOT_COUNT),
      };
}

/** Reads one month of closes, parsing only the selected currencies when a set is given. */
async function readMonthlyHistory(
  bucket: R2Bucket,
  month: string,
  symbols?: ReadonlySet<string>,
): Promise<MonthlyHistory | null> {
  const key = monthlyHistoryKey(month);
  const file = await readSeriesFile(bucket, key, monthlyHeaderSchema, symbols);
  if (file === null) {
    return null;
  }
  if (file.header.month !== month) {
    throw new InvalidStoredHistoryError(key);
  }

  return { ...file.header, rates: checkLengths(key, file.rates, daysInMonth(month)) };
}

/** Rejects a file whose series do not cover its whole window. */
function checkLengths(
  key: string,
  rates: Record<string, RateSeries>,
  length: number,
): Record<string, RateSeries> {
  if (Object.values(rates).some((series) => series.length !== length)) {
    throw new InvalidStoredHistoryError(key);
  }

  return rates;
}

/**
 * Reads a line-oriented aggregate: a JSON header line followed by one
 * `CODE<TAB>[values]` line per currency. Only lines for `symbols` are parsed
 * and validated when it is given, so a response does not pay for every currency.
 */
async function readSeriesFile<Header>(
  bucket: R2Bucket,
  key: string,
  headerSchema: z.ZodType<Header>,
  symbols?: ReadonlySet<string>,
): Promise<{ header: Header; rates: Record<string, RateSeries> } | null> {
  const object = await bucket.get(key);
  if (object === null) {
    return null;
  }

  try {
    const [headerLine = "", ...lines] = (await object.text()).split("\n");
    const header = headerSchema.parse(JSON.parse(headerLine));
    const rates: Record<string, RateSeries> = {};
    for (const line of lines) {
      const separator = line.indexOf("\t");
      const code = currencyIdentifierSchema.parse(line.slice(0, Math.max(separator, 0)));
      if (symbols === undefined || symbols.has(code)) {
        rates[code] = rateSeriesSchema.parse(JSON.parse(line.slice(separator + 1)));
      }
    }
    return { header, rates };
  } catch (error) {
    throw new InvalidStoredHistoryError(key, { cause: error });
  }
}

/** Writes a line-oriented aggregate in the format `readSeriesFile` reads. */
async function writeSeriesFile(
  bucket: R2Bucket,
  key: string,
  header: unknown,
  rates: Record<string, RateSeries>,
): Promise<void> {
  await bucket.put(key, formatSeriesFile(header, rates), {
    httpMetadata: { contentType: "text/plain; charset=utf-8" },
  });
}

/** Formats a JSON header line and one `CODE<TAB>[values]` line per currency. */
export function formatSeriesFile(
  header: unknown,
  rates: Record<string, RateSeries>,
): string {
  const lines = Object.entries(rates).map(
    ([code, series]) => `${code}\t${JSON.stringify(series)}`,
  );
  return [JSON.stringify(header), ...lines].join("\n");
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
export function monthlyHistoryKey(month: string): string {
  return `history/daily/${month}.tsv`;
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
