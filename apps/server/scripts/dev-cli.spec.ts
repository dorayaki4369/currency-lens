import type { ChildProcess, spawn as spawnProcess } from "node:child_process";
import { EventEmitter } from "node:events";

import { afterEach, describe, expect, it, vi } from "vitest";

const boundaries = vi.hoisted(() => ({
  spawn: vi.fn<typeof spawnProcess>(),
}));

vi.mock("node:child_process", () => ({ spawn: boundaries.spawn }));

import { runServerDevCli } from "./dev.ts";

const originalExitCode = process.exitCode;
const originalRateSource = process.env["RATE_SOURCE"];

afterEach(() => {
  process.exitCode = originalExitCode;
  if (originalRateSource === undefined) {
    delete process.env["RATE_SOURCE"];
  } else {
    process.env["RATE_SOURCE"] = originalRateSource;
  }
  vi.restoreAllMocks();
});

describe("runServerDevCli", () => {
  it("runs the launcher against the current process boundaries with a real mock server", async () => {
    delete process.env["RATE_SOURCE"];
    const child = new EventEmitter() as ChildProcess;
    child.kill = vi.fn<ChildProcess["kill"]>(() => true);
    let mockUrl = "";
    boundaries.spawn.mockImplementation((_command, args) => {
      mockUrl =
        args
          .find((argument) => argument.startsWith("OPEN_EXCHANGE_RATE_API_URL:"))
          ?.slice("OPEN_EXCHANGE_RATE_API_URL:".length) ?? "";
      queueMicrotask(() => child.emit("exit", 0, null));
      return child;
    });
    vi.spyOn(process, "once").mockImplementation(() => process);

    await runServerDevCli();

    expect(boundaries.spawn).toHaveBeenCalledOnce();
    expect(mockUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/api$/);
    expect(process.exitCode).toBe(0);
  });
});
