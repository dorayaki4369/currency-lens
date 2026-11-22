import { describe, expect, it, vi } from "vitest";

const run = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("./dev.ts", () => ({ runServerDevCli: run }));

await import("./dev.mjs");

describe("dev wrapper", () => {
  it("delegates to the typed launcher", () => {
    expect(run).toHaveBeenCalledOnce();
  });
});
