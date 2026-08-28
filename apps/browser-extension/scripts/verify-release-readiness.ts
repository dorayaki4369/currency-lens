import process from "node:process";

import { verifyRatesApiContract, waitForWorkerDeployment } from "./release-readiness.ts";

type Environment = Record<string, string | undefined>;
type WaitForDeployment = typeof waitForWorkerDeployment;
type VerifyApiContract = typeof verifyRatesApiContract;
type OutputWriter = (output: string) => unknown;
type CliRuntime = { exitCode: number | string | null | undefined };

/** Runs release verification against the current CI process boundaries. */
export async function runReleaseReadinessProcess(): Promise<void> {
  await runReleaseReadinessCli(
    () =>
      verifyReleaseReadiness(
        process.env,
        waitForWorkerDeployment,
        verifyRatesApiContract,
        process.stdout.write.bind(process.stdout),
      ),
    process.stderr.write.bind(process.stderr),
    process,
  );
}

/** Verifies deployment ordering and the live client contract before store credentials exist. */
export async function verifyReleaseReadiness(
  environment: Readonly<Environment>,
  waitForDeployment: WaitForDeployment,
  verifyApiContract: VerifyApiContract,
  writeOutput: OutputWriter,
): Promise<void> {
  const repository = requireEnvironmentVariable(
    "GITHUB_REPOSITORY",
    environment["GITHUB_REPOSITORY"],
  );
  const commitSha = requireEnvironmentVariable("SOURCE_SHA", environment["SOURCE_SHA"]);
  const githubToken = requireEnvironmentVariable(
    "GITHUB_TOKEN",
    environment["GITHUB_TOKEN"],
  );
  const apiEndpoint = requireEnvironmentVariable(
    "API_ENDPOINT",
    environment["API_ENDPOINT"],
  );

  const deployment = await waitForDeployment({
    repository,
    commitSha,
    githubToken,
    reportStatus: (message) => writeOutput(`${message}\n`),
  });
  writeOutput(
    `Cloudflare deployed ${commitSha} successfully (check run ${deployment.id}).\n`,
  );

  const verifiedRoutes = await verifyApiContract({ apiEndpoint });
  for (const route of verifiedRoutes) {
    writeOutput(
      `Verified ${route.url}: ${route.rateCount} ${route.base}-based rates at ${route.timestamp}.\n`,
    );
  }
}

/** Reads required process configuration without loading an environment file. */
export function requireEnvironmentVariable(
  name: string,
  rawValue: string | undefined,
): string {
  const value = rawValue?.trim();
  if (value === undefined || value === "") {
    throw new Error(`${name} is required.`);
  }
  return value;
}

/** Converts command failures into one stable stderr line and process status. */
export async function runReleaseReadinessCli(
  run: () => Promise<void>,
  writeError: OutputWriter,
  runtime: CliRuntime,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected release check failure.";
    writeError(`Release readiness check failed: ${message}\n`);
    runtime.exitCode = 1;
  }
}
