import { describe, expect, it, vi } from "vitest";

import type {
  verifyRatesApiContract,
  waitForWorkerDeployment,
} from "./release-readiness.ts";
import {
  requireEnvironmentVariable,
  runReleaseReadinessCli,
  verifyReleaseReadiness,
} from "./verify-release-readiness.ts";

describe("verify-release-readiness CLI", () => {
  it("trims and forwards required configuration while reporting progress", async () => {
    const waitForDeployment = vi.fn<typeof waitForWorkerDeployment>(async (options) => {
      options.reportStatus?.("Deployment pending.");
      return {
        id: 32,
        name: "Workers Builds: currency-lens",
        status: "completed",
        conclusion: "success",
        details_url: null,
        app: { slug: "cloudflare-workers-and-pages" },
      };
    });
    const verifyApiContract = vi.fn<typeof verifyRatesApiContract>(async () => [
      {
        path: "latest",
        url: "https://cl.dryk.net/latest",
        rateCount: 185,
        base: "USD",
        timestamp: 1_700_000_000,
      },
    ]);
    const writeOutput = vi.fn<(output: string) => void>();

    await verifyReleaseReadiness(
      {
        GITHUB_REPOSITORY: " owner/repository ",
        SOURCE_SHA: ` ${"d".repeat(40)} `,
        GITHUB_TOKEN: " token ",
        API_ENDPOINT: " https://cl.dryk.net ",
      },
      waitForDeployment,
      verifyApiContract,
      writeOutput,
    );

    expect(waitForDeployment).toHaveBeenCalledWith(
      expect.objectContaining({
        repository: "owner/repository",
        commitSha: "d".repeat(40),
        githubToken: "token",
      }),
    );
    expect(verifyApiContract).toHaveBeenCalledWith({
      apiEndpoint: "https://cl.dryk.net",
    });
    expect(writeOutput).toHaveBeenCalledWith("Deployment pending.\n");
    expect(writeOutput).toHaveBeenCalledWith(
      expect.stringContaining("Verified https://cl.dryk.net/latest"),
    );
  });

  it.each([undefined, " "])("rejects a missing required value %s", (rawValue) => {
    expect(() => requireEnvironmentVariable("REQUIRED_VALUE", rawValue)).toThrow(
      "REQUIRED_VALUE is required",
    );
  });

  it("leaves a successful CLI status unchanged", async () => {
    const runtime = { exitCode: undefined };
    const writeError = vi.fn<(output: string) => void>();

    await runReleaseReadinessCli(() => Promise.resolve(), writeError, runtime);

    expect(runtime.exitCode).toBeUndefined();
    expect(writeError).not.toHaveBeenCalled();
  });

  it.each([
    [new Error("deployment failed"), "deployment failed"],
    ["unknown rejection", "Unexpected release check failure."],
  ])("reports a failed CLI run", async (failure, expectedMessage) => {
    const runtime = { exitCode: undefined as number | undefined };
    const writeError = vi.fn<(output: string) => void>();

    await runReleaseReadinessCli(() => Promise.reject(failure), writeError, runtime);

    expect(runtime.exitCode).toBe(1);
    expect(writeError).toHaveBeenCalledWith(
      `Release readiness check failed: ${expectedMessage}\n`,
    );
  });
});
