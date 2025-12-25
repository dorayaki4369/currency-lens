import { OxrLatestResponse } from "@cl/oxr/schema";

function makeKey(timestamp: number): string {
  const date = new Date(timestamp);

  return `${date.toISOString()}.json`;
}

export async function putOxrLatestResponse(data: OxrLatestResponse, env: CloudflareBindings): Promise<R2Object> {
  const timestamp = data.timestamp * 1000;
  const key = makeKey(timestamp);

  return env.DATA_BUCKET.put(key, JSON.stringify(data), {
    customMetadata: {
      url: env.OPEN_EXCHANGE_RATE_API_URL,
      timestamp: timestamp.toString(),
      datetime: new Date(timestamp).toISOString(),
      base: data.base,
    },
  });
}
