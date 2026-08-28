import type { ChildProcess, spawn as spawnProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import type {
  mkdtemp as createTemporaryDirectory,
  rm as removeDirectory,
} from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import {
  createCommand,
  parseUserArguments,
  runWxtWithoutEnv,
  waitForChildExit,
} from "./run-wxt-without-env.ts";

describe("run-wxt-without-env internals", () => {
  it("removes the local endpoint option and argument delimiter", () => {
    expect(parseUserArguments(["--use-local-api-endpoint", "--", "build"])).toEqual({
      useLocalApiEndpoint: true,
      userArguments: ["build"],
    });
    expect(parseUserArguments(["zip"])).toEqual({
      useLocalApiEndpoint: false,
      userArguments: ["zip"],
    });
  });

  it("routes publishing, project, and default commands to their owning CLI", () => {
    const publish = createCommand(["submit", "--help"]);
    const project = createCommand(["build", "--browser", "firefox"]);
    const fallback = createCommand([]);

    expect(publish.bin).toContain("publish-browser-extension");
    expect(publish.arguments).toEqual(["--help"]);
    expect(project.bin).toMatch(/wxt\.mjs$/u);
    expect(project.arguments.at(0)).toBe("build");
    expect(project.arguments.at(1)).toMatch(/apps\/browser-extension$/u);
    expect(fallback.arguments).toEqual([
      expect.stringMatching(/apps\/browser-extension$/u),
    ]);
  });

  it("runs from a temporary directory, forwards signals, and preserves the child status", async () => {
    const { child, kill } = createChild();
    const environment: Record<string, string | undefined> = {};
    const mkdtemp = vi.fn(async () => "/tmp/safe-wxt");
    const rm = vi.fn(async () => undefined);
    const spawn = vi.fn(() => {
      queueMicrotask(() => child.emit("exit", 7, null));
      return child;
    }) as unknown as typeof spawnProcess;
    const signalHandlers = new Map<string, () => void>();
    const runtime = {
      once: vi.fn((signal: "SIGINT" | "SIGTERM", listener: () => void) => {
        signalHandlers.set(signal, listener);
      }),
      emitWarning: vi.fn<(warning: string) => void>(),
    };

    await expect(
      runWxtWithoutEnv(
        ["--use-local-api-endpoint", "--", "build"],
        environment,
        mkdtemp as unknown as typeof createTemporaryDirectory,
        rm as unknown as typeof removeDirectory,
        spawn,
        runtime,
      ),
    ).resolves.toBe(7);

    expect(environment["API_ENDPOINT"]).toBe("http://localhost:8787");
    expect(spawn).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining([expect.stringMatching(/wxt\.mjs$/u), "build"]),
      expect.objectContaining({ cwd: "/tmp/safe-wxt", env: environment }),
    );
    signalHandlers.get("SIGINT")?.();
    signalHandlers.get("SIGTERM")?.();
    expect(kill).toHaveBeenCalledWith("SIGINT");
    expect(kill).toHaveBeenCalledWith("SIGTERM");
    expect(rm).toHaveBeenCalledWith("/tmp/safe-wxt", {
      force: true,
      recursive: true,
    });
  });

  it("cleans up and preserves a child startup failure", async () => {
    const { child } = createChild();
    const remove = vi.fn(async () => Promise.reject(new Error("cleanup denied")));
    const emitWarning = vi.fn<(warning: string) => void>();

    await expect(
      runWxtWithoutEnv(
        [],
        {},
        vi.fn(async () => "/tmp/safe-wxt") as unknown as typeof createTemporaryDirectory,
        remove as unknown as typeof removeDirectory,
        vi.fn(() => {
          queueMicrotask(() => child.emit("error", new Error("spawn failed")));
          return child;
        }) as unknown as typeof spawnProcess,
        { once: vi.fn(), emitWarning },
      ),
    ).rejects.toThrow("spawn failed");
    expect(emitWarning).toHaveBeenCalledWith(
      "The temporary WXT working directory could not be removed.",
    );
  });

  it.each([
    [null, "SIGTERM", 1],
    [null, null, 0],
  ] as const)("maps child exit (%s, %s) to %s", async (code, signal, expected) => {
    const child = new EventEmitter() as ChildProcess;
    queueMicrotask(() => child.emit("exit", code, signal));

    await expect(waitForChildExit(child)).resolves.toBe(expected);
  });
});

/** Creates an observable child-process stand-in. */
function createChild(): {
  readonly child: ChildProcess;
  readonly kill: ReturnType<typeof vi.fn<ChildProcess["kill"]>>;
} {
  const child = new EventEmitter() as ChildProcess;
  const kill = vi.fn<ChildProcess["kill"]>(() => true);
  child.kill = kill;
  return { child, kill };
}
