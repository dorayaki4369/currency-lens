import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CLOUDFLARE_APP_SLUG,
  CLOUDFLARE_CHECK_NAME,
  EXTENSION_SMOKE_TEST_ORIGIN,
  evaluateWorkerDeployment,
  verifyRatesApiContract,
  waitForWorkerDeployment,
} from "./release-readiness.ts";

const TEST_REPOSITORY = "dorayaki4369/currency-lens";
const TEST_COMMIT_SHA = "b".repeat(40);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("release readiness validation", () => {
  it("returns the successful check run selected by deployment evaluation", () => {
    const checkRun = createCheckRun({ id: 20, conclusion: "success" });

    expect(evaluateWorkerDeployment([checkRun])).toEqual({
      status: "success",
      checkRun,
    });
  });

  it("describes a completed check which has no conclusion", () => {
    expect(
      evaluateWorkerDeployment([createCheckRun({ id: 21, conclusion: null })]),
    ).toEqual({
      status: "failure",
      message: `${CLOUDFLARE_CHECK_NAME} completed with no conclusion.`,
    });
  });

  it("ignores a matching check whose GitHub App metadata is absent", () => {
    const checkRun = { ...createCheckRun({ id: 22, conclusion: "success" }), app: null };

    expect(evaluateWorkerDeployment([checkRun])).toEqual({
      status: "pending",
      message: `Waiting for ${CLOUDFLARE_CHECK_NAME} to be created.`,
    });
  });

  it("uses platform fetch, time, and non-blocking sleep defaults", async () => {
    vi.useFakeTimers();
    const fetchImplementation = createSequenceFetch([
      createCheckRunsResponse([]),
      createCheckRunsResponse([createCheckRun({ id: 23, conclusion: "success" })]),
    ]);
    vi.stubGlobal("fetch", fetchImplementation);

    const deploymentPromise = waitForWorkerDeployment({
      repository: TEST_REPOSITORY,
      commitSha: TEST_COMMIT_SHA,
      githubToken: "test-token",
      pollIntervalMs: 5,
    });
    await vi.advanceTimersByTimeAsync(5);

    await expect(deploymentPromise).resolves.toMatchObject({ id: 23 });
  });

  it("caps a polling delay at the remaining deployment deadline", async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const now = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(8);
    const fetchImplementation = createSequenceFetch([
      createCheckRunsResponse([]),
      createCheckRunsResponse([createCheckRun({ id: 24, conclusion: "success" })]),
    ]);

    await expect(
      waitForWorkerDeployment({
        repository: TEST_REPOSITORY,
        commitSha: TEST_COMMIT_SHA,
        githubToken: "test-token",
        fetchImplementation,
        sleep,
        now,
        timeoutMs: 10,
        pollIntervalMs: 100,
      }),
    ).resolves.toMatchObject({ id: 24 });
    expect(sleep).toHaveBeenCalledWith(2);
  });

  it("rejects a non-successful GitHub Checks response", async () => {
    await expect(
      waitForWorkerDeployment({
        repository: TEST_REPOSITORY,
        commitSha: TEST_COMMIT_SHA,
        githubToken: "test-token",
        fetchImplementation: async () => new Response(null, { status: 403 }),
      }),
    ).rejects.toThrow("GitHub Checks API returned HTTP 403");
  });

  it("rejects malformed GitHub check-run data at the network boundary", async () => {
    await expect(
      waitForWorkerDeployment({
        repository: TEST_REPOSITORY,
        commitSha: TEST_COMMIT_SHA,
        githubToken: "test-token",
        fetchImplementation: async () =>
          new Response(JSON.stringify({ check_runs: [{ id: "invalid" }] })),
      }),
    ).rejects.toThrow();
  });

  it.each([
    [{ repository: "missing-slash" }, "owner/name"],
    [{ commitSha: "short" }, "full Git commit SHA"],
    [{ githubToken: " " }, "GITHUB_TOKEN is required"],
    [{ timeoutMs: -1 }, "timeout must be a non-negative safe integer"],
    [{ timeoutMs: Number.POSITIVE_INFINITY }, "non-negative safe integer"],
    [{ pollIntervalMs: 0 }, "poll interval must be a positive safe integer"],
    [{ pollIntervalMs: 1.5 }, "positive safe integer"],
    [{ requestTimeoutMs: 0 }, "request timeout must be a positive safe integer"],
    [{ requestTimeoutMs: Number.NaN }, "positive safe integer"],
  ] as const)("rejects invalid deployment option %o", async (override, message) => {
    await expect(
      waitForWorkerDeployment({
        repository: TEST_REPOSITORY,
        commitSha: TEST_COMMIT_SHA,
        githubToken: "test-token",
        fetchImplementation: vi.fn(),
        ...override,
      }),
    ).rejects.toThrow(message);
  });

  it("uses platform fetch when verifying deployed rate routes", async () => {
    const fetchImplementation = vi.fn(async () => createRatesResponse());
    vi.stubGlobal("fetch", fetchImplementation);

    await expect(
      verifyRatesApiContract({ apiEndpoint: "https://cl.dryk.net/releases/" }),
    ).resolves.toHaveLength(2);
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it.each([
    new Response(JSON.stringify(createRatesBody()), {
      headers: {
        "Access-Control-Allow-Origin": EXTENSION_SMOKE_TEST_ORIGIN,
      },
    }),
    new Response(JSON.stringify(createRatesBody()), {
      headers: {
        "Access-Control-Allow-Origin": EXTENSION_SMOKE_TEST_ORIGIN,
        "Content-Type": "text/plain",
      },
    }),
  ])("rejects a successful response without a JSON content type", async (response) => {
    await expect(
      verifyRatesApiContract({
        apiEndpoint: "https://cl.dryk.net",
        fetchImplementation: async () => response.clone(),
      }),
    ).rejects.toThrow("did not return JSON");
  });

  it.each([
    ["not a URL", "absolute URL"],
    ["http://cl.dryk.net", "must use HTTPS"],
    ["https://user:password@cl.dryk.net", "must not contain credentials"],
    ["https://cl.dryk.net?query=true", "must not contain a query or fragment"],
    ["https://cl.dryk.net#fragment", "must not contain a query or fragment"],
  ])("rejects unsafe production endpoint %s", async (apiEndpoint, message) => {
    await expect(
      verifyRatesApiContract({ apiEndpoint, fetchImplementation: vi.fn() }),
    ).rejects.toThrow(message);
  });
});

/** Creates one Cloudflare check-run payload with valid defaults. */
function createCheckRun(options: { id: number; conclusion: string | null }) {
  return {
    id: options.id,
    name: CLOUDFLARE_CHECK_NAME,
    status: "completed",
    conclusion: options.conclusion,
    details_url: null,
    app: { slug: CLOUDFLARE_APP_SLUG },
  };
}

/** Encodes a GitHub Checks API response. */
function createCheckRunsResponse(checkRuns: readonly unknown[]): Response {
  return new Response(JSON.stringify({ check_runs: checkRuns }));
}

/** Returns each prepared response once in polling order. */
function createSequenceFetch(responses: readonly Response[]): typeof fetch {
  let responseIndex = 0;
  return () => Promise.resolve(responses[responseIndex++]?.clone() ?? new Response());
}

/** Creates a valid rates response with extension CORS access. */
function createRatesResponse(): Response {
  return new Response(JSON.stringify(createRatesBody()), {
    headers: {
      "Access-Control-Allow-Origin": EXTENSION_SMOKE_TEST_ORIGIN,
      "Content-Type": "application/json",
    },
  });
}

/** Creates the smallest current public rates payload. */
function createRatesBody() {
  return {
    base: "USD",
    rates: { USD: "1", EUR: "0.92" },
    timestamp: 1_700_000_000,
  };
}
