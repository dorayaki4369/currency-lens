import { EventEmitter } from "node:events";
import type { ChildProcess, spawn } from "node:child_process";
import { oxrLatestResponseSchema } from "@cl/oxr/schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMockLatestResponse,
  createWorkerCommand,
  isLatestRatesRequest,
  type MockUpstream,
  parseUserArguments,
  readListeningPort,
  resolveRateSource,
  runServerDev,
  startMockOpenExchangeRates,
  waitForChildExit,
} from "./dev.ts";
import { MOCK_RATES } from "./mock-rates.ts";

const NOW = Date.UTC(2026, 10, 22, 12, 0, 0);
const MOCK_URL = "http://127.0.0.1:4321/api";

/** A child process stand-in whose exit the test controls. */
function createFakeChild(): ChildProcess {
  const child = new EventEmitter() as ChildProcess;
  child.kill = vi.fn(() => true);
  return child;
}

/** Wires runServerDev to fakes and exposes what it did. */
function createHarness() {
  const child = createFakeChild();
  const kill = vi.fn<ChildProcess["kill"]>(() => true);
  child.kill = kill;
  const spawnChild = vi.fn(() => child) as unknown as typeof spawn;
  const close = vi.fn(async () => undefined);
  const startMockUpstream = vi.fn(
    async (): Promise<MockUpstream> => ({ url: MOCK_URL, close }),
  );
  const signalListeners = new Map<string, () => void>();
  const runtime = {
    once: vi.fn((signal: string, listener: () => void) => {
      signalListeners.set(signal, listener);
    }),
  };
  return { child, kill, spawnChild, close, startMockUpstream, signalListeners, runtime };
}

describe("resolveRateSource", () => {
  it.each([undefined, "", "  ", "mock", " mock "])("uses the mock for %j", (value) => {
    expect(resolveRateSource({ RATE_SOURCE: value })).toBe("mock");
  });

  it("uses the real API only when asked explicitly", () => {
    expect(resolveRateSource({ RATE_SOURCE: "live" })).toBe("live");
  });

  it("rejects an unknown source instead of silently spending API quota", () => {
    expect(() => resolveRateSource({ RATE_SOURCE: "real" })).toThrow(
      'RATE_SOURCE must be "mock" or "live", but was "real".',
    );
  });
});

describe("parseUserArguments", () => {
  it("drops the package-manager delimiter", () => {
    expect(parseUserArguments(["--", "--port", "8788"])).toEqual(["--port", "8788"]);
  });

  it("keeps arguments without the delimiter", () => {
    expect(parseUserArguments(["--port", "8788"])).toEqual(["--port", "8788"]);
  });
});

describe("createWorkerCommand", () => {
  it("points the Worker at the mock with a dummy App ID and its own local R2", () => {
    const command = createWorkerCommand(
      ["--port", "8788"],
      { OPEN_EXCHANGE_RATE_APP_ID: "real-secret", PATH: "/bin" },
      MOCK_URL,
    );

    expect(command.arguments).toEqual([
      "dev",
      "--env-file",
      "/dev/null",
      "--test-scheduled",
      "--persist-to",
      ".wrangler/mock-state",
      "--var",
      `OPEN_EXCHANGE_RATE_API_URL:${MOCK_URL}`,
      "--port",
      "8788",
    ]);
    expect(command.environment).toEqual({
      OPEN_EXCHANGE_RATE_APP_ID: "currency-lens-mock",
      PATH: "/bin",
    });
  });

  it("keeps the configured App ID and default local R2 for the real API", () => {
    const environment = { OPEN_EXCHANGE_RATE_APP_ID: "real-secret" };
    const command = createWorkerCommand([], environment, undefined);

    expect(command.arguments).toEqual([
      "dev",
      "--env-file",
      "/dev/null",
      "--test-scheduled",
    ]);
    expect(command.environment).toBe(environment);
  });
});

describe("createMockLatestResponse", () => {
  it("passes the Worker's upstream schema with a fresh source time", () => {
    const response = oxrLatestResponseSchema.parse(createMockLatestResponse(NOW + 999));

    expect(response.timestamp).toBe(NOW / 1_000);
    expect(response.base).toBe("USD");
    expect(Object.keys(response.rates)).toEqual(Object.keys(MOCK_RATES));
  });
});

describe("startMockOpenExchangeRates", () => {
  let upstream: MockUpstream | undefined;

  afterEach(async () => {
    await upstream?.close();
    upstream = undefined;
  });

  it("serves latest.json the way the OXR client requests it", async () => {
    upstream = await startMockOpenExchangeRates(() => NOW);

    const response = await fetch(`${upstream.url}/latest.json?app_id=currency-lens-mock`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(await response.json()).toEqual(createMockLatestResponse(NOW));
  });

  it("answers other paths with 404", async () => {
    upstream = await startMockOpenExchangeRates(() => NOW);

    const response = await fetch(`${upstream.url}/historical/2026-01-01.json`);

    expect(response.status).toBe(404);
  });

  it("uses the current time by default", async () => {
    upstream = await startMockOpenExchangeRates();
    const before = Math.floor(Date.now() / 1_000);

    const body = (await (await fetch(`${upstream.url}/latest.json`)).json()) as {
      timestamp: number;
    };

    expect(body.timestamp).toBeGreaterThanOrEqual(before);
  });
});

describe("runServerDev", () => {
  it("starts the mock before Wrangler and stops it after Wrangler exits", async () => {
    const harness = createHarness();

    const exitCode = runServerDev(["--"], { OPEN_EXCHANGE_RATE_APP_ID: "secret" }, harness);
    await vi.waitFor(() => expect(harness.spawnChild).toHaveBeenCalledOnce());
    const [, args, options] = vi.mocked(harness.spawnChild).mock.calls[0] as unknown as [
      string,
      string[],
      { env: Record<string, string | undefined>; stdio: string },
    ];
    harness.child.emit("exit", 0, null);

    await expect(exitCode).resolves.toBe(0);
    expect(harness.startMockUpstream).toHaveBeenCalledOnce();
    expect(args).toContain(`OPEN_EXCHANGE_RATE_API_URL:${MOCK_URL}`);
    expect(options.env["OPEN_EXCHANGE_RATE_APP_ID"]).toBe("currency-lens-mock");
    expect(options.stdio).toBe("inherit");
    expect(harness.close).toHaveBeenCalledOnce();
  });

  it("does not start the mock for the real API", async () => {
    const harness = createHarness();

    const exitCode = runServerDev([], { RATE_SOURCE: "live" }, harness);
    harness.child.emit("exit", 3, null);

    await expect(exitCode).resolves.toBe(3);
    expect(harness.startMockUpstream).not.toHaveBeenCalled();
  });

  it("forwards termination signals to Wrangler", async () => {
    const harness = createHarness();

    const exitCode = runServerDev([], { RATE_SOURCE: "live" }, harness);
    harness.signalListeners.get("SIGINT")?.();
    harness.signalListeners.get("SIGTERM")?.();
    harness.child.emit("exit", null, "SIGINT");

    await expect(exitCode).resolves.toBe(1);
    expect(harness.kill).toHaveBeenCalledWith("SIGINT");
    expect(harness.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("stops the mock even when Wrangler cannot start", async () => {
    const harness = createHarness();

    const exitCode = runServerDev([], {}, harness);
    await vi.waitFor(() => expect(harness.spawnChild).toHaveBeenCalledOnce());
    harness.child.emit("error", new Error("spawn failed"));

    await expect(exitCode).rejects.toThrow("spawn failed");
    expect(harness.close).toHaveBeenCalledOnce();
  });

  it("refuses an unknown source before starting anything", async () => {
    const harness = createHarness();

    await expect(runServerDev([], { RATE_SOURCE: "real" }, harness)).rejects.toThrow(
      "RATE_SOURCE",
    );
    expect(harness.startMockUpstream).not.toHaveBeenCalled();
    expect(harness.spawnChild).not.toHaveBeenCalled();
  });
});

describe("isLatestRatesRequest", () => {
  it.each([
    ["/api/latest.json?app_id=x", true],
    ["/api/latest.json", true],
    ["/api/currencies.json", false],
    [undefined, false],
  ])("classifies %j", (url, expected) => {
    expect(isLatestRatesRequest(url)).toBe(expected);
  });
});

describe("readListeningPort", () => {
  it("returns the TCP port", () => {
    expect(readListeningPort({ address: "127.0.0.1", family: "IPv4", port: 4321 })).toBe(
      4321,
    );
  });

  it.each([null, "/tmp/socket"])("rejects a non-TCP address %j", (address) => {
    expect(() => readListeningPort(address)).toThrow("no TCP address");
  });
});

describe("waitForChildExit", () => {
  it("treats a clean signal-less exit without a code as success", async () => {
    const child = createFakeChild();

    const exitCode = waitForChildExit(child);
    child.emit("exit", null, null);

    await expect(exitCode).resolves.toBe(0);
  });
});
