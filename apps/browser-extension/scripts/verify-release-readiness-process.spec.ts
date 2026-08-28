import type {
  verifyRatesApiContract,
  waitForWorkerDeployment,
} from "./release-readiness.ts";

import { afterEach, describe, expect, it, vi } from "vitest";

const boundaries = vi.hoisted(() => ({
  verifyApi: vi.fn<typeof verifyRatesApiContract>(),
  waitForDeployment: vi.fn<typeof waitForWorkerDeployment>(),
}));

vi.mock("./release-readiness.ts", () => ({
  verifyRatesApiContract: boundaries.verifyApi,
  waitForWorkerDeployment: boundaries.waitForDeployment,
}));

import { runReleaseReadinessProcess } from "./verify-release-readiness.ts";

const originalExitCode = process.exitCode;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  process.exitCode = originalExitCode;
});

describe("runReleaseReadinessProcess", () => {
  it("uses current CI configuration and process output", async () => {
    vi.stubEnv("GITHUB_REPOSITORY", "owner/repository");
    vi.stubEnv("SOURCE_SHA", "e".repeat(40));
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    vi.stubEnv("API_ENDPOINT", "https://cl.dryk.net");
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    boundaries.waitForDeployment.mockResolvedValue({
      id: 41,
      name: "Workers Builds: currency-lens",
      status: "completed",
      conclusion: "success",
      details_url: null,
      app: { slug: "cloudflare-workers-and-pages" },
    });
    boundaries.verifyApi.mockResolvedValue([
      {
        path: "v1/latest",
        url: "https://cl.dryk.net/v1/latest",
        base: "USD",
        timestamp: 1_700_000_000,
        rateCount: 185,
      },
    ]);

    await runReleaseReadinessProcess();

    expect(boundaries.waitForDeployment).toHaveBeenCalledWith(
      expect.objectContaining({ repository: "owner/repository" }),
    );
    expect(boundaries.verifyApi).toHaveBeenCalledWith({
      apiEndpoint: "https://cl.dryk.net",
    });
  });
});
