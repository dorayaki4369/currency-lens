import { type OxrLatestResponse, oxrLatestResponseSchema } from "./schema";

export type Config = {
  baseUrl: string;
  appId: string;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;

/** Resolves the authenticated latest-rates endpoint relative to the configured API path. */
function createLatestRatesUrl(baseUrl: string, appId: string): URL {
  const normalizedBaseUrl = new URL(baseUrl);
  if (!normalizedBaseUrl.pathname.endsWith("/")) {
    normalizedBaseUrl.pathname += "/";
  }
  normalizedBaseUrl.search = "";
  normalizedBaseUrl.hash = "";

  const url = new URL("latest.json", normalizedBaseUrl);
  url.searchParams.set("app_id", appId);
  url.searchParams.set("show_alternative", "true");
  url.searchParams.set("prettyprint", "0");
  return url;
}

/** Represents a non-successful response returned by the OXR API. */
export class OxrHttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly statusText: string,
  ) {
    super(
      `Open Exchange Rates returned HTTP ${status}${statusText ? ` ${statusText}` : ""}`,
    );
    this.name = "OxrHttpError";
  }
}

/** Represents an OXR request that exceeded its configured deadline. */
export class OxrTimeoutError extends Error {
  public constructor(
    public readonly timeoutMs: number,
    options?: ErrorOptions,
  ) {
    super(`Open Exchange Rates request timed out after ${timeoutMs}ms`, options);
    this.name = "OxrTimeoutError";
  }
}

/** Represents a response body that cannot be decoded or validated. */
export class OxrResponseError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OxrResponseError";
  }
}

/** Represents a network failure before an HTTP response was received. */
export class OxrNetworkError extends Error {
  public constructor(options?: ErrorOptions) {
    super("Open Exchange Rates request failed", options);
    this.name = "OxrNetworkError";
  }
}

/**
 * Fetches and validates the latest OXR rates within a bounded amount of time.
 */
export async function fetchLatestRate(
  config: Config,
  fetchImplementation: typeof fetch = fetch,
): Promise<OxrLatestResponse> {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("timeoutMs must be a positive safe integer");
  }

  const signal = AbortSignal.timeout(timeoutMs);
  const url = createLatestRatesUrl(config.baseUrl, config.appId);
  let response: Response;

  try {
    response = await fetchImplementation(url, {
      method: "GET",
      signal,
      headers: {
        Accept: "application/json",
      },
    });
  } catch (error) {
    if (signal.aborted) {
      throw new OxrTimeoutError(timeoutMs, { cause: error });
    }
    throw new OxrNetworkError({ cause: error });
  }

  if (!response.ok) {
    throw new OxrHttpError(response.status, response.statusText);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    if (signal.aborted) {
      throw new OxrTimeoutError(timeoutMs, { cause: error });
    }
    throw new OxrResponseError("Open Exchange Rates returned invalid JSON", {
      cause: error,
    });
  }

  const result = oxrLatestResponseSchema.safeParse(body);
  if (!result.success) {
    throw new OxrResponseError(
      "Open Exchange Rates response did not match the expected schema",
      { cause: result.error },
    );
  }

  return result.data;
}
