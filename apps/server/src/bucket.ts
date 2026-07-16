import { type OxrLatestResponse, oxrLatestResponseSchema } from "@cl/oxr/schema";

const LATEST_OBJECT_KEY = "latest.json";

/** Indicates that R2 contained data which could not be trusted as OXR data. */
export class InvalidStoredRatesError extends Error {
  public constructor(options?: ErrorOptions) {
    super("Stored exchange rates are invalid", options);
    this.name = "InvalidStoredRatesError";
  }
}

/** Builds the immutable archive key for an OXR source timestamp in milliseconds. */
function makeKey(timestamp: number): string {
  const date = new Date(timestamp);

  return `${date.toISOString()}.json`;
}

/** Stores a validated OXR response as both the latest and an archived snapshot. */
export async function putOxrLatestResponse(
  data: OxrLatestResponse,
  env: CloudflareBindings,
): Promise<R2Object> {
  const sourceTimestampMs = data.timestamp * 1000;
  const key = makeKey(sourceTimestampMs);
  const body = JSON.stringify(data);
  const metadata = {
    customMetadata: {
      url: env.OPEN_EXCHANGE_RATE_API_URL,
      sourceTimestamp: data.timestamp.toString(),
      sourceDatetime: new Date(sourceTimestampMs).toISOString(),
      base: data.base,
    },
  };

  const archivedObject = await env.DATA_BUCKET.put(key, body, metadata);
  await env.DATA_BUCKET.put(LATEST_OBJECT_KEY, body, metadata);
  return archivedObject;
}

/** Reads and validates the latest R2 snapshot at the storage trust boundary. */
export async function getLatestOxrResponse(
  env: CloudflareBindings,
): Promise<OxrLatestResponse | null> {
  const obj = await env.DATA_BUCKET.get(LATEST_OBJECT_KEY);
  if (!obj) return null;

  let json: unknown;
  try {
    json = await obj.json();
  } catch (error) {
    throw new InvalidStoredRatesError({ cause: error });
  }

  const result = oxrLatestResponseSchema.safeParse(json);
  if (!result.success) {
    throw new InvalidStoredRatesError({ cause: result.error });
  }

  return result.data;
}
