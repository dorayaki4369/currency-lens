import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const OPEN_EXCHANGE_RATES_PORT = 4180;
const WORKER_PORT = 8790;
const WORKER_STARTUP_TIMEOUT_MILLISECONDS = 60_000;
const serverDirectory = fileURLToPath(new URL("../../../server/", import.meta.url));

/** The rates the fake Open Exchange Rates API returns to the local Worker. */
const UPSTREAM_RATES = {
  EUR: 0.8621,
  GBP: 0.7428,
  JPY: 149.45,
  USD: 1,
} as const;

/** The local Worker that E2E forwards the extension's API requests to. */
export const E2E_WORKER_URL = `http://127.0.0.1:${WORKER_PORT}`;

/**
 * Starts the real Worker against an empty local R2 bucket and a fake Open Exchange Rates API,
 * so E2E covers the extension, the Worker, and their shared response contract together.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const upstream = await startOpenExchangeRatesStub();
  const stateDirectory = await mkdtemp(join(tmpdir(), "currency-lens-e2e-worker-"));
  const worker = startWorker(stateDirectory);

  try {
    await waitForWorker(worker);
  } catch (error) {
    await stopAll(worker, upstream, stateDirectory);
    throw error;
  }

  return () => stopAll(worker, upstream, stateDirectory);
}

/** Serves one schema-valid latest-rates response for any Open Exchange Rates request. */
async function startOpenExchangeRatesStub(): Promise<Server> {
  const server = createServer((_request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        base: "USD",
        disclaimer: "Currency Lens E2E",
        license: "Currency Lens E2E",
        rates: UPSTREAM_RATES,
        timestamp: Math.floor(Date.now() / 1_000),
      }),
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(OPEN_EXCHANGE_RATES_PORT, "127.0.0.1", resolve);
  });
  return server;
}

/** Runs `wrangler dev` without environment files, pointing the Worker at the fake upstream. */
function startWorker(stateDirectory: string): ChildProcess {
  const worker = spawn(
    process.execPath,
    [
      "node_modules/wrangler/bin/wrangler.js",
      "dev",
      "--env-file",
      "/dev/null",
      "--ip",
      "127.0.0.1",
      "--port",
      String(WORKER_PORT),
      "--persist-to",
      stateDirectory,
      "--show-interactive-dev-session=false",
      "--var",
      `OPEN_EXCHANGE_RATE_API_URL:http://127.0.0.1:${OPEN_EXCHANGE_RATES_PORT}/api`,
      "--var",
      "OPEN_EXCHANGE_RATE_APP_ID:currency-lens-e2e",
    ],
    {
      cwd: serverDirectory,
      env: { ...process.env, CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  return worker;
}

/** Polls the Worker until it answers, and reports its output when it never becomes ready. */
async function waitForWorker(worker: ChildProcess): Promise<void> {
  let output = "";
  worker.stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  worker.stderr?.on("data", (chunk: Buffer) => (output += chunk.toString()));

  const deadline = Date.now() + WORKER_STARTUP_TIMEOUT_MILLISECONDS;
  while (Date.now() < deadline) {
    if (worker.exitCode !== null) {
      break;
    }
    // Polling must wait for each attempt before deciding whether to try again.
    // eslint-disable-next-line no-await-in-loop
    if (await isWorkerResponding()) {
      return;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`The local Worker did not start.\n${output}`);
}

/** Returns whether the Worker accepts HTTP requests; any status means it is listening. */
async function isWorkerResponding(): Promise<boolean> {
  try {
    await fetch(E2E_WORKER_URL);
    return true;
  } catch {
    return false;
  }
}

/** Stops both servers and removes the Worker's temporary R2 state. */
async function stopAll(
  worker: ChildProcess,
  upstream: Server,
  stateDirectory: string,
): Promise<void> {
  if (worker.exitCode === null) {
    const exited = new Promise((resolve) => worker.once("exit", resolve));
    worker.kill("SIGTERM");
    await exited;
  }
  await new Promise((resolve) => upstream.close(resolve));
  await rm(stateDirectory, { force: true, recursive: true });
}
