import { afterAll, describe, expect, it, vi } from "vitest";

const run = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("./run-wxt-without-env.ts", () => ({ runWxtCli: run }));

const originalExitCode = process.exitCode;
await import("./run-wxt-without-env.mjs");

afterAll(() => {
  process.exitCode = originalExitCode;
});

describe("run-wxt-without-env wrapper", () => {
  it("delegates to the typed runner with process boundaries", () => {
    expect(run).toHaveBeenCalledOnce();
  });
});
