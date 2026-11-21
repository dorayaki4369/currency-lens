import type { HistoryResponse } from "../src/history";
import { type OxrLatestResponse, oxrLatestResponseSchema } from "@cl/oxr/schema";

/** Creates a validated rate snapshot shared by Worker boundary tests. */
export function createRatesSnapshot(): OxrLatestResponse {
  return oxrLatestResponseSchema.parse({
    disclaimer: "Example disclaimer",
    license: "Example license",
    base: "USD",
    rates: { USD: 1, EUR: 0.92, NEW_COIN: 2.5 },
    timestamp: 1_700_000_000,
  });
}

/** Creates the minimum Worker bindings required by the server tests. */
export function createBindings(options?: {
  appId?: string;
  bucket?: R2Bucket;
}): CloudflareBindings {
  return {
    OPEN_EXCHANGE_RATE_API_URL: "https://openexchangerates.org/api",
    OPEN_EXCHANGE_RATE_APP_ID: options?.appId ?? "secret-app-id",
    DATA_BUCKET: options?.bucket ?? ({} as R2Bucket),
  };
}

/** Creates the R2 object metadata consumed by scheduler logging. */
export function createR2Object(key = "archive.json"): R2Object {
  return {
    key,
    size: 123,
    customMetadata: {},
  } as R2Object;
}

/** The fixed clock used by history tests: 2026-11-21T09:30:00Z. */
export const HISTORY_NOW_MS = Date.UTC(2026, 10, 21, 9, 30);

/** Creates a small public history body for route tests. */
export function createHistoryResponse(): HistoryResponse {
  return {
    base: "USD",
    resolution: "hourly",
    start: "2026-11-16T09:00:00.000Z",
    rates: { JPY: [149.5, null] },
  };
}

export type MemoryBucket = R2Bucket & {
  /** Lists every stored key in lexical order. */
  keys: () => string[];
  /** Reads a stored body, decoding history series files into `{ ...header, rates }`. */
  read: (key: string) => unknown;
  /** Stores a body directly; objects for history series files are encoded line by line. */
  seed: (key: string, body: unknown) => void;
};

/** Returns whether a key holds a line-oriented history series file. */
function isSeriesKey(key: string): boolean {
  return key.startsWith("history/") && key.endsWith(".tsv");
}

/** Encodes `{ ...header, rates }` the way the Worker writes series files. */
function encodeSeries(
  body: { rates?: Record<string, unknown> } & Record<string, unknown>,
): string {
  const { rates = {}, ...header } = body;
  const lines = Object.entries(rates).map(
    ([code, series]) => `${code}\t${JSON.stringify(series)}`,
  );
  return [JSON.stringify(header), ...lines].join("\n");
}

/** Decodes a series file into `{ ...header, rates }`. */
function decodeSeries(text: string): unknown {
  const [headerLine = "{}", ...lines] = text.split("\n");
  const rates = Object.fromEntries(
    lines.map((line) => {
      const separator = line.indexOf("\t");
      return [line.slice(0, separator), JSON.parse(line.slice(separator + 1)) as unknown];
    }),
  );
  return { ...(JSON.parse(headerLine) as object), rates };
}

/**
 * Creates an in-memory R2 bucket that implements the get, put and list
 * semantics the Worker relies on (lexical order, prefix, startAfter, limit).
 */
export function createMemoryBucket(): MemoryBucket {
  const objects = new Map<string, string>();
  const sortedKeys = () => [...objects.keys()].toSorted();

  const bucket = {
    async get(key: string) {
      const body = objects.get(key);
      if (body === undefined) {
        return null;
      }
      return { key, json: async () => JSON.parse(body) as unknown, text: async () => body };
    },
    async put(key: string, value: string) {
      objects.set(key, value);
      return createR2Object(key);
    },
    async list(options: R2ListOptions = {}) {
      const matching = sortedKeys().filter(
        (key) =>
          key.startsWith(options.prefix ?? "") &&
          (options.startAfter === undefined || key > options.startAfter),
      );
      const limit = options.limit ?? 1000;
      return {
        objects: matching.slice(0, limit).map((key) => createR2Object(key)),
        truncated: matching.length > limit,
        delimitedPrefixes: [],
      };
    },
    keys: sortedKeys,
    read: (key: string) => {
      const body = objects.get(key) ?? "null";
      return isSeriesKey(key) ? decodeSeries(body) : (JSON.parse(body) as unknown);
    },
    seed: (key: string, body: unknown) => {
      if (typeof body === "string") {
        objects.set(key, body);
      } else if (isSeriesKey(key)) {
        objects.set(key, encodeSeries(body as Record<string, unknown>));
      } else {
        objects.set(key, JSON.stringify(body));
      }
    },
  };

  return bucket as unknown as MemoryBucket;
}

/** Creates an archived OXR snapshot body for the given source time. */
export function createSnapshotBody(
  timestampMs: number,
  rates: Record<string, number>,
): unknown {
  return {
    disclaimer: "Example disclaimer",
    license: "Example license",
    base: "USD",
    rates: { USD: 1, ...rates },
    timestamp: Math.floor(timestampMs / 1000),
  };
}
