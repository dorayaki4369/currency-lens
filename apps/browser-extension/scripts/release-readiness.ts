import { z } from "zod/v4";
import { latestRatesApiResponseSchema } from "../lib/rates.ts";

export const CLOUDFLARE_CHECK_NAME = "Workers Builds: currency-lens";
export const CLOUDFLARE_APP_SLUG = "cloudflare-workers-and-pages";
export const CURRENT_RATES_API_PATH = "v1/latest";
export const LEGACY_RATES_API_PATH = "latest";

const DEFAULT_DEPLOYMENT_TIMEOUT_MS = 15 * 60 * 1_000;
const DEFAULT_POLL_INTERVAL_MS = 10_000;
const API_REQUEST_TIMEOUT_MS = 10_000;
const GITHUB_API_VERSION = "2022-11-28";
export const EXTENSION_SMOKE_TEST_ORIGIN =
  "chrome-extension://cfpmgblhfmfomcgkpkghcgkcfblbpgkm";
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/u;

const githubCheckRunSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  status: z.string(),
  conclusion: z.string().nullable(),
  details_url: z.url().nullable(),
  app: z
    .object({
      slug: z.string(),
    })
    .nullable(),
});

const githubCheckRunsResponseSchema = z.object({
  check_runs: z.array(githubCheckRunSchema),
});

type GithubCheckRun = z.infer<typeof githubCheckRunSchema>;

export type WorkerDeploymentState =
  | { readonly status: "pending"; readonly message: string }
  | {
      readonly status: "success";
      readonly checkRunId: number;
      readonly detailsUrl: string | null;
    }
  | { readonly status: "failure"; readonly message: string };

export interface WaitForWorkerDeploymentOptions {
  readonly repository: string;
  readonly commitSha: string;
  readonly githubToken: string;
  readonly fetchImplementation?: typeof fetch;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly now?: () => number;
  readonly timeoutMs?: number;
  readonly pollIntervalMs?: number;
  readonly requestTimeoutMs?: number;
  readonly reportStatus?: (message: string) => void;
}

export interface VerifyRatesApiOptions {
  readonly apiEndpoint: string;
  readonly fetchImplementation?: typeof fetch;
}

export interface VerifiedRatesRoute {
  readonly path: string;
  readonly url: string;
  readonly base: string;
  readonly timestamp: number;
  readonly rateCount: number;
}

/** Waits until Cloudflare reports a successful deployment for the release commit. */
export async function waitForWorkerDeployment(
  options: Readonly<WaitForWorkerDeploymentOptions>,
): Promise<GithubCheckRun> {
  validateDeploymentOptions(options);

  const fetchImplementation = options.fetchImplementation ?? fetch;
  const sleep = options.sleep ?? sleepFor;
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? DEFAULT_DEPLOYMENT_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const startedAt = now();

  /** Performs one bounded poll, then recurs only after the configured delay. */
  async function poll(): Promise<GithubCheckRun> {
    const checkRuns = await fetchCheckRuns(options, fetchImplementation);
    const state = evaluateWorkerDeployment(checkRuns);

    if (state.status === "success") {
      const matchingCheck = checkRuns.find((checkRun) => checkRun.id === state.checkRunId);
      if (!matchingCheck) {
        throw new Error("The successful Cloudflare check could not be recovered.");
      }
      return matchingCheck;
    }
    if (state.status === "failure") {
      throw new Error(state.message);
    }

    options.reportStatus?.(state.message);
    const elapsedMs = now() - startedAt;
    if (elapsedMs >= timeoutMs) {
      throw new Error(
        `Timed out waiting for ${CLOUDFLARE_CHECK_NAME} on ${options.commitSha}.`,
      );
    }

    await sleep(Math.min(pollIntervalMs, timeoutMs - elapsedMs));
    return poll();
  }

  return poll();
}

/** Interprets the newest Cloudflare check run for one exact commit. */
export function evaluateWorkerDeployment(
  checkRuns: readonly GithubCheckRun[],
): WorkerDeploymentState {
  const latestCheck = checkRuns
    .filter(
      (checkRun) =>
        checkRun.name === CLOUDFLARE_CHECK_NAME &&
        checkRun.app?.slug === CLOUDFLARE_APP_SLUG,
    )
    .toSorted((left, right) => right.id - left.id)[0];

  if (!latestCheck) {
    return {
      status: "pending",
      message: `Waiting for ${CLOUDFLARE_CHECK_NAME} to be created.`,
    };
  }
  if (latestCheck.status !== "completed") {
    return {
      status: "pending",
      message: `${CLOUDFLARE_CHECK_NAME} is ${latestCheck.status}.`,
    };
  }
  if (latestCheck.conclusion === "success") {
    return {
      status: "success",
      checkRunId: latestCheck.id,
      detailsUrl: latestCheck.details_url,
    };
  }

  return {
    status: "failure",
    message: `${CLOUDFLARE_CHECK_NAME} completed with ${latestCheck.conclusion ?? "no conclusion"}.`,
  };
}

/** Fetches both the current and legacy routes and parses them with the shipped client schema. */
export async function verifyRatesApiContract(
  options: Readonly<VerifyRatesApiOptions>,
): Promise<readonly VerifiedRatesRoute[]> {
  const baseUrl = validateProductionApiEndpoint(options.apiEndpoint);
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const paths = [CURRENT_RATES_API_PATH, LEGACY_RATES_API_PATH] as const;

  return Promise.all(
    paths.map(async (path) => {
      const url = new URL(path, baseUrl).href;
      const response = await fetchImplementation(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Origin: EXTENSION_SMOKE_TEST_ORIGIN,
        },
        signal: AbortSignal.timeout(API_REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`${url} returned HTTP ${response.status}.`);
      }
      const contentType = response.headers.get("content-type");
      if (contentType === null || !contentType.includes("application/json")) {
        throw new Error(`${url} did not return JSON.`);
      }
      if (
        response.headers.get("access-control-allow-origin") !== EXTENSION_SMOKE_TEST_ORIGIN
      ) {
        throw new Error(`${url} did not allow the browser extension origin.`);
      }

      const body: unknown = await response.json();
      const parsed = latestRatesApiResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new Error(`${url} does not satisfy the browser extension API contract.`);
      }

      return {
        path,
        url,
        base: parsed.data.base,
        timestamp: parsed.data.timestamp,
        rateCount: Object.keys(parsed.data.rates).length,
      };
    }),
  );
}

/** Reads and validates GitHub's check-runs response without trusting external JSON. */
async function fetchCheckRuns(
  options: Readonly<WaitForWorkerDeploymentOptions>,
  fetchImplementation: typeof fetch,
): Promise<readonly GithubCheckRun[]> {
  const url = new URL(
    `https://api.github.com/repos/${options.repository}/commits/${options.commitSha}/check-runs`,
  );
  url.searchParams.set("per_page", "100");

  const response = await fetchImplementation(url, {
    method: "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${options.githubToken}`,
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
    },
    signal: AbortSignal.timeout(options.requestTimeoutMs ?? API_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`GitHub Checks API returned HTTP ${response.status}.`);
  }

  const body: unknown = await response.json();
  return githubCheckRunsResponseSchema.parse(body).check_runs;
}

/** Rejects malformed identifiers before they become part of an API request. */
function validateDeploymentOptions(
  options: Readonly<WaitForWorkerDeploymentOptions>,
): void {
  if (!REPOSITORY_PATTERN.test(options.repository)) {
    throw new Error("GITHUB_REPOSITORY must use the owner/name form.");
  }
  if (!COMMIT_SHA_PATTERN.test(options.commitSha)) {
    throw new Error("The release source must be a full Git commit SHA.");
  }
  if (options.githubToken.trim() === "") {
    throw new Error("GITHUB_TOKEN is required to read Cloudflare check runs.");
  }
  if ((options.timeoutMs ?? DEFAULT_DEPLOYMENT_TIMEOUT_MS) < 0) {
    throw new RangeError("Deployment timeout must not be negative.");
  }
  if ((options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS) <= 0) {
    throw new RangeError("Deployment poll interval must be positive.");
  }
  if ((options.requestTimeoutMs ?? API_REQUEST_TIMEOUT_MS) <= 0) {
    throw new RangeError("Checks API request timeout must be positive.");
  }
}

/** Normalizes the same public HTTPS base URL used to build store packages. */
function validateProductionApiEndpoint(endpoint: string): URL {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch (error) {
    throw new Error("API_ENDPOINT must be an absolute URL.", { cause: error });
  }

  if (url.protocol !== "https:") {
    throw new Error("The release API_ENDPOINT must use HTTPS.");
  }
  if (url.username !== "" || url.password !== "") {
    throw new Error("API_ENDPOINT must not contain credentials.");
  }
  if (url.search !== "" || url.hash !== "") {
    throw new Error("API_ENDPOINT must not contain a query or fragment.");
  }

  url.pathname = `${url.pathname.replace(/\/+$/u, "")}/`;
  return url;
}

/** Suspends polling without blocking the runner process. */
function sleepFor(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
