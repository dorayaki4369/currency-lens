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
