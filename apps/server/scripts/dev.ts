import { type ChildProcess, spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { MOCK_RATES } from "./mock-rates.ts";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const wranglerBin = join(packageRoot, "node_modules", "wrangler", "bin", "wrangler.js");
const RATE_SOURCE_VARIABLE = "RATE_SOURCE";
const APP_ID_VARIABLE = "OPEN_EXCHANGE_RATE_APP_ID";
const MOCK_APP_ID = "currency-lens-mock";
// Mock rates live in their own local R2 so they never mix with rates fetched from the real API.
const MOCK_STATE_DIRECTORY = ".wrangler/mock-state";
const MOCK_LATEST_PATH = "/api/latest.json";
const MILLISECONDS_PER_SECOND = 1_000;
const BASE_WRANGLER_ARGUMENTS = ["dev", "--env-file", "/dev/null", "--test-scheduled"];
const forwardedSignals = ["SIGINT", "SIGTERM"] as const;

/** Where the local Worker fetches exchange rates from. */
export type RateSource = "mock" | "live";

type Environment = Record<string, string | undefined>;

/** A running stand-in for the Open Exchange Rates API. */
export type MockUpstream = {
  readonly url: string;
  readonly close: () => Promise<void>;
};

type Runtime = {
  once: (signal: (typeof forwardedSignals)[number], listener: () => void) => unknown;
};

type Dependencies = {
  readonly spawnChild: typeof spawn;
  readonly startMockUpstream: () => Promise<MockUpstream>;
  readonly runtime: Runtime;
};

type WorkerCommand = {
  readonly arguments: readonly string[];
  readonly environment: Environment;
};

/** Runs the local Worker against the current Node process. */
export async function runServerDevCli(): Promise<void> {
  process.exitCode = await runServerDev(process.argv.slice(2), process.env, {
    spawnChild: spawn,
    startMockUpstream: () => startMockOpenExchangeRates(),
    runtime: process,
  });
}

/**
 * Starts `wrangler dev`, first starting the mock upstream unless the real API was requested,
 * and returns Wrangler's exit status.
 */
export async function runServerDev(
  rawUserArguments: readonly string[],
  environment: Environment,
  dependencies: Dependencies,
): Promise<number> {
  const source = resolveRateSource(environment);
  const upstream = source === "mock" ? await dependencies.startMockUpstream() : undefined;
  const command = createWorkerCommand(
    parseUserArguments(rawUserArguments),
    environment,
    upstream?.url,
  );
  const child = dependencies.spawnChild(
    process.execPath,
    [wranglerBin, ...command.arguments],
    {
      cwd: packageRoot,
      env: command.environment,
      stdio: "inherit",
    },
  );

  for (const signal of forwardedSignals) {
    dependencies.runtime.once(signal, () => child.kill(signal));
  }

  try {
    return await waitForChildExit(child);
  } finally {
    await upstream?.close();
  }
}

/** Reads the requested rate source, defaulting to the mock so development spends no API quota. */
export function resolveRateSource(environment: Environment): RateSource {
  const value = environment[RATE_SOURCE_VARIABLE]?.trim() ?? "";
  if (value === "" || value === "mock") {
    return "mock";
  }
  if (value === "live") {
    return "live";
  }

  throw new Error(`${RATE_SOURCE_VARIABLE} must be "mock" or "live", but was "${value}".`);
}

/** Removes the package-manager argument delimiter before forwarding CLI arguments. */
export function parseUserArguments(rawUserArguments: readonly string[]): readonly string[] {
  return rawUserArguments[0] === "--" ? rawUserArguments.slice(1) : rawUserArguments;
}

/**
 * Builds the Wrangler invocation. With a mock upstream, the Worker points at it with a dummy
 * App ID, and the real App ID is kept out of the child process.
 */
export function createWorkerCommand(
  userArguments: readonly string[],
  environment: Environment,
  mockUpstreamUrl: string | undefined,
): WorkerCommand {
  if (mockUpstreamUrl === undefined) {
    return {
      arguments: [...BASE_WRANGLER_ARGUMENTS, ...userArguments],
      environment,
    };
  }

  const { [APP_ID_VARIABLE]: _realAppId, ...mockEnvironment } = environment;
  return {
    arguments: [
      ...BASE_WRANGLER_ARGUMENTS,
      "--persist-to",
      MOCK_STATE_DIRECTORY,
      "--var",
      `OPEN_EXCHANGE_RATE_API_URL:${mockUpstreamUrl}`,
      "--var",
      `${APP_ID_VARIABLE}:${MOCK_APP_ID}`,
      ...userArguments,
    ],
    environment: mockEnvironment,
  };
}

/** Creates a latest-rates response whose source time is now, so the extension treats it as fresh. */
export function createMockLatestResponse(nowMilliseconds: number) {
  return {
    disclaimer:
      "Currency Lens local mock. These rates are approximate and not for real use.",
    license: "Currency Lens local mock",
    base: "USD",
    rates: MOCK_RATES,
    timestamp: Math.floor(nowMilliseconds / MILLISECONDS_PER_SECOND),
  };
}

/** Serves the latest-rates endpoint of Open Exchange Rates on an ephemeral loopback port. */
export async function startMockOpenExchangeRates(
  now: () => number = Date.now,
): Promise<MockUpstream> {
  const server = createServer((request, response) => {
    if (!isLatestRatesRequest(request.url)) {
      response.statusCode = 404;
      response.end();
      return;
    }

    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(createMockLatestResponse(now())));
  });
  const port = await listenOnLoopback(server);

  return {
    url: `http://127.0.0.1:${port}/api`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

/** Returns whether a request targets the latest-rates endpoint, ignoring its query. */
export function isLatestRatesRequest(requestUrl: string | undefined): boolean {
  return new URL(requestUrl ?? "/", "http://localhost").pathname === MOCK_LATEST_PATH;
}

/** Extracts the TCP port a listening server is bound to. */
export function readListeningPort(address: ReturnType<Server["address"]>): number {
  if (address === null || typeof address === "string") {
    throw new Error("The mock Open Exchange Rates server has no TCP address.");
  }
  return address.port;
}

/** Waits for the delegated CLI and preserves its numeric exit status. */
export function waitForChildExit(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      resolve(code ?? (signal === null ? 0 : 1));
    });
  });
}

/** Binds the server to a free loopback port and returns that port. */
function listenOnLoopback(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve(readListeningPort(server.address()));
    });
  });
}
