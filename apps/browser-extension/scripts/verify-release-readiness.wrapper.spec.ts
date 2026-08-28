import { describe, expect, it, vi } from "vitest";

const boundaries = vi.hoisted(() => ({
  runProcess: vi.fn<() => Promise<void>>(async () => undefined),
}));

vi.mock("./verify-release-readiness.ts", () => ({
  runReleaseReadinessProcess: boundaries.runProcess,
}));

await import("./verify-release-readiness.mjs");

describe("verify-release-readiness wrapper", () => {
  it("delegates process boundaries to the typed CLI implementation", () => {
    expect(boundaries.runProcess).toHaveBeenCalledOnce();
  });
});
