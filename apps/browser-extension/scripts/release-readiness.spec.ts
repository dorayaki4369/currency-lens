import { describe, expect, it, vi } from "vitest";
import {
  CLOUDFLARE_APP_SLUG,
  CLOUDFLARE_CHECK_NAME,
  CURRENT_RATES_API_PATH,
  EXTENSION_SMOKE_TEST_ORIGIN,
  LEGACY_RATES_API_PATH,
  evaluateWorkerDeployment,
  verifyRatesApiContract,
  waitForWorkerDeployment,
} from "./release-readiness.ts";

const TEST_REPOSITORY = "dorayaki4369/currency-lens";
const TEST_COMMIT_SHA = "a".repeat(40);

describe("release readiness", () => {
  it("uses the newest matching Cloudflare check run", () => {
    expect(
      evaluateWorkerDeployment([
        createCheckRun({ id: 10, conclusion: "success" }),
        createCheckRun({ id: 11, status: "in_progress", conclusion: null }),
      ]),
    ).toEqual({
      status: "pending",
      message: `${CLOUDFLARE_CHECK_NAME} is in_progress.`,
    });
  });

  it("ignores a similarly named check from another GitHub App", () => {
    expect(
      evaluateWorkerDeployment([
        createCheckRun({
          id: 11,
          conclusion: "success",
          appSlug: "github-actions",
        }),
      ]),
    ).toEqual({
      status: "pending",
      message: `Waiting for ${CLOUDFLARE_CHECK_NAME} to be created.`,
    });
  });

  it("waits for the exact commit check and returns its successful run", async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const fetchImplementation = createSequenceFetch([
      createCheckRunsResponse([]),
      createCheckRunsResponse([createCheckRun({ id: 12, conclusion: "success" })]),
    ]);

    await expect(
      waitForWorkerDeployment({
        repository: TEST_REPOSITORY,
        commitSha: TEST_COMMIT_SHA,
        githubToken: "test-token",
        fetchImplementation,
        sleep,
      }),
    ).resolves.toMatchObject({ id: 12, conclusion: "success" });
    expect(sleep).toHaveBeenCalledOnce();
  });

  it("fails when the newest Cloudflare deployment failed", async () => {
    const fetchImplementation = createSequenceFetch([
      createCheckRunsResponse([createCheckRun({ id: 13, conclusion: "failure" })]),
    ]);

    await expect(
      waitForWorkerDeployment({
        repository: TEST_REPOSITORY,
        commitSha: TEST_COMMIT_SHA,
        githubToken: "test-token",
        fetchImplementation,
      }),
    ).rejects.toThrow(`${CLOUDFLARE_CHECK_NAME} completed with failure.`);
  });

  it("times out when Cloudflare did not create a check for the commit", async () => {
    const fetchImplementation = createSequenceFetch([createCheckRunsResponse([])]);

    await expect(
      waitForWorkerDeployment({
        repository: TEST_REPOSITORY,
        commitSha: TEST_COMMIT_SHA,
        githubToken: "test-token",
        fetchImplementation,
        timeoutMs: 0,
      }),
    ).rejects.toThrow(`Timed out waiting for ${CLOUDFLARE_CHECK_NAME}`);
  });

  it("aborts a Checks API request which does not respond", async () => {
    await expect(
      waitForWorkerDeployment({
        repository: TEST_REPOSITORY,
        commitSha: TEST_COMMIT_SHA,
        githubToken: "test-token",
        fetchImplementation: fetchUntilAborted,
        requestTimeoutMs: 5,
      }),
    ).rejects.toThrow("Checks API request aborted.");
  });

  it("validates current and legacy routes with the shipped client schema", async () => {
    const requestedUrls: string[] = [];
    const fetchImplementation: typeof fetch = (input) => {
      requestedUrls.push(readRequestUrl(input));
      return Promise.resolve(createRatesResponse());
    };

    await expect(
      verifyRatesApiContract({
        apiEndpoint: "https://cl.dryk.net",
        fetchImplementation,
      }),
    ).resolves.toEqual([
      {
        path: CURRENT_RATES_API_PATH,
        url: "https://cl.dryk.net/v1/latest",
        base: "USD",
        timestamp: 1_700_000_000,
        rateCount: 2,
      },
      {
        path: LEGACY_RATES_API_PATH,
        url: "https://cl.dryk.net/latest",
        base: "USD",
        timestamp: 1_700_000_000,
        rateCount: 2,
      },
    ]);
    expect(requestedUrls).toEqual([
      "https://cl.dryk.net/v1/latest",
      "https://cl.dryk.net/latest",
    ]);
  });

  it("rejects a deployed response that the extension cannot parse", async () => {
    await expect(
      verifyRatesApiContract({
        apiEndpoint: "https://cl.dryk.net",
        fetchImplementation: fetchInvalidRates,
      }),
    ).rejects.toThrow("does not satisfy the browser extension API contract");
  });

  it("rejects a backward-incompatible top-level field", async () => {
    await expect(
      verifyRatesApiContract({
        apiEndpoint: "https://cl.dryk.net",
        fetchImplementation: fetchRatesWithExtraField,
      }),
    ).rejects.toThrow("does not satisfy the browser extension API contract");
  });

  it("rejects a response which omits extension CORS access", async () => {
    await expect(
      verifyRatesApiContract({
        apiEndpoint: "https://cl.dryk.net",
        fetchImplementation: fetchRatesWithoutCors,
      }),
    ).rejects.toThrow("did not allow the browser extension origin");
  });

  it("rejects an unsuccessful API response before parsing its body", async () => {
    await expect(
      verifyRatesApiContract({
        apiEndpoint: "https://cl.dryk.net",
        fetchImplementation: fetchUnavailableRates,
      }),
    ).rejects.toThrow("returned HTTP 503");
  });
});

/** Creates one GitHub check-run payload with safe defaults. */
function createCheckRun(
  overrides: Readonly<{
    id: number;
    status?: string;
    conclusion: string | null;
    appSlug?: string;
  }>,
) {
  return {
    id: overrides.id,
    name: CLOUDFLARE_CHECK_NAME,
    status: overrides.status ?? "completed",
    conclusion: overrides.conclusion,
    details_url: "https://dash.cloudflare.com/build",
    app: { slug: overrides.appSlug ?? CLOUDFLARE_APP_SLUG },
  };
}

/** Encodes a check-runs API response. */
function createCheckRunsResponse(checkRuns: readonly unknown[]): Response {
  return new Response(JSON.stringify({ check_runs: checkRuns }), {
    headers: { "Content-Type": "application/json" },
  });
}

/** Returns each prepared response once, matching the release poll sequence. */
function createSequenceFetch(responses: readonly Response[]): typeof fetch {
  let responseIndex = 0;
  return () => {
    const response = responses[responseIndex];
    if (!response) {
      return Promise.reject(new Error("Unexpected release check request."));
    }
    responseIndex += 1;
    return Promise.resolve(response);
  };
}

/** Creates a JSON response with extension CORS access. */
function createRatesResponse(body: unknown = createRatesBody()): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Access-Control-Allow-Origin": EXTENSION_SMOKE_TEST_ORIGIN,
      "Content-Type": "application/json",
    },
  });
}

/** Returns the URL represented by any fetch input without default object stringification. */
function readRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  return input instanceof URL ? input.href : input.url;
}

/** Returns data which intentionally omits the required timestamp. */
function fetchInvalidRates(): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify({ base: "USD", rates: {} }), {
      headers: {
        "Access-Control-Allow-Origin": EXTENSION_SMOKE_TEST_ORIGIN,
        "Content-Type": "application/json",
      },
    }),
  );
}

/** Returns an otherwise valid response with a breaking strict-schema addition. */
function fetchRatesWithExtraField(): Promise<Response> {
  return Promise.resolve(
    createRatesResponse({
      base: "USD",
      rates: { USD: "1", EUR: "0.92" },
      timestamp: 1_700_000_000,
      metadata: {},
    }),
  );
}

/** Returns valid JSON without the extension origin CORS grant. */
function fetchRatesWithoutCors(): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(createRatesBody()), {
      headers: { "Content-Type": "application/json" },
    }),
  );
}

/** Returns an upstream-style outage response. */
function fetchUnavailableRates(): Promise<Response> {
  return Promise.resolve(new Response("Unavailable", { status: 503 }));
}

/** Rejects only when the release checker aborts its bounded GitHub request. */
function fetchUntilAborted(
  _input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const signal = init?.signal;
  if (!signal) {
    return Promise.reject(new Error("Expected a request timeout signal."));
  }

  return new Promise((_resolve, reject) => {
    signal.addEventListener(
      "abort",
      () => reject(new Error("Checks API request aborted.")),
      { once: true },
    );
  });
}

/** Creates a valid current API body. */
function createRatesBody() {
  return {
    base: "USD",
    rates: { USD: "1", EUR: "0.92" },
    timestamp: 1_700_000_000,
  };
}
