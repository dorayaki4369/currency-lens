import type { ChildProcess, spawn as spawnProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import type { mkdtemp, rm } from "node:fs/promises";

import { afterEach, describe, expect, it, vi } from "vitest";

const boundaries = vi.hoisted(() => ({
  mkdtemp: vi.fn<typeof mkdtemp>(),
  rm: vi.fn<typeof rm>(),
  spawn: vi.fn<typeof spawnProcess>(),
}));

vi.mock("node:child_process", () => ({ spawn: boundaries.spawn }));
vi.mock("node:fs/promises", () => ({
  mkdtemp: boundaries.mkdtemp,
  rm: boundaries.rm,
}));

import { runWxtCli } from "./run-wxt-without-env.ts";

const originalExitCode = process.exitCode;

afterEach(() => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

describe("runWxtCli", () => {
  it("runs the wrapper against the current process boundaries", async () => {
    const child = new EventEmitter() as ChildProcess;
    child.kill = vi.fn<ChildProcess["kill"]>(() => true);
    boundaries.mkdtemp.mockResolvedValue("/tmp/safe-wxt");
    boundaries.rm.mockResolvedValue(undefined);
    boundaries.spawn.mockImplementation(() => {
      queueMicrotask(() => child.emit("exit", 0, null));
      return child;
    });
    vi.spyOn(process, "once").mockImplementation(() => process);

    await runWxtCli();

    expect(boundaries.spawn).toHaveBeenCalledOnce();
    expect(process.exitCode).toBe(0);
  });
});
