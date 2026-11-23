import {
  DAILY_SLOT_COUNT,
  formatSeriesFile,
  HOURLY_HISTORY_KEY,
  HOURLY_SLOT_COUNT,
  monthlyHistoryKey,
} from "../src/history";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
/** Spreads the currencies' wave phases so their trends differ: EUR falls, GBP and JPY rise. */
const PHASE_PER_CODE_UNIT = 0.4;

/** One aggregate file to store in the Worker's R2 bucket. */
export interface HistorySeedObject {
  readonly key: string;
  readonly body: string;
}

/** The part of an R2 bucket that seeding writes through. */
export interface HistorySeedBucket {
  put(key: string, body: string): Promise<unknown>;
}

/**
 * Builds hourly and daily aggregates of deterministic synthetic rates that end at `latestRates`,
 * so a local Worker serves charts with real lines instead of the empty state. Every value is a
 * fixed wave of the time before `nowMs`, so the shape stays the same from run to run.
 */
export function createHistorySeed(
  latestRates: Readonly<Record<string, number>>,
  nowMs: number,
): HistorySeedObject[] {
  const currencies = Object.entries(latestRates);
  return [createHourlySeed(currencies, nowMs), ...createDailySeeds(currencies, nowMs)];
}

/** Stores every seed object in the bucket. */
export async function writeHistorySeed(
  bucket: HistorySeedBucket,
  objects: readonly HistorySeedObject[],
): Promise<void> {
  await Promise.all(objects.map((object) => bucket.put(object.key, object.body)));
}

/** Fills the whole hourly window, whose last slot is the current hour. */
function createHourlySeed(
  currencies: readonly (readonly [string, number])[],
  nowMs: number,
): HistorySeedObject {
  const endSlotMs = Math.floor(nowMs / HOUR_MS) * HOUR_MS;
  const startMs = endSlotMs - (HOURLY_SLOT_COUNT - 1) * HOUR_MS;
  const rates = Object.fromEntries(
    currencies.map(([code, latest]) => [
      code,
      Array.from({ length: HOURLY_SLOT_COUNT }, (_, index) =>
        syntheticRate(code, latest, (endSlotMs - (startMs + index * HOUR_MS)) / DAY_MS),
      ),
    ]),
  );
  return {
    key: HOURLY_HISTORY_KEY,
    body: formatSeriesFile({ version: 1, start: new Date(startMs).toISOString() }, rates),
  };
}

/**
 * Fills the closes of every completed UTC day the daily response covers. Today stays empty,
 * as in production, because the Worker takes today's point from the hourly window.
 */
function createDailySeeds(
  currencies: readonly (readonly [string, number])[],
  nowMs: number,
): HistorySeedObject[] {
  const todayMs = Math.floor(nowMs / DAY_MS) * DAY_MS;
  const months = new Map<string, Record<string, (number | null)[]>>();
  for (let daysAgo = DAILY_SLOT_COUNT - 1; daysAgo >= 1; daysAgo -= 1) {
    const date = new Date(todayMs - daysAgo * DAY_MS);
    const month = date.toISOString().slice(0, 7);
    const rates = months.get(month) ?? {};
    months.set(month, rates);
    for (const [code, latest] of currencies) {
      const series = (rates[code] ??= Array.from(
        { length: daysInMonth(date) },
        () => null,
      ));
      series[date.getUTCDate() - 1] = syntheticRate(code, latest, daysAgo);
    }
  }
  return [...months].map(([month, rates]) => ({
    key: monthlyHistoryKey(month),
    body: formatSeriesFile({ version: 1, month }, rates),
  }));
}

/** A smooth wave of the days before now that equals `latest` now, rounded like stored rates. */
function syntheticRate(code: string, latest: number, daysAgo: number): number {
  const phase =
    Array.from(code).reduce((sum, character) => sum + character.charCodeAt(0), 0) *
    PHASE_PER_CODE_UNIT;
  const wave = (days: number) =>
    0.012 * Math.sin(days / 4.7 + phase) +
    0.004 * Math.sin(days / 1.3 + 2 * phase) +
    0.04 * Math.sin(days / 58 + 3 * phase);
  return Number((latest * (1 + wave(daysAgo) - wave(0))).toPrecision(6));
}

/** Returns the number of days in the UTC month of `date`. */
function daysInMonth(date: Date): number {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}
