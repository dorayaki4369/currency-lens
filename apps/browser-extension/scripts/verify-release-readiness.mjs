import { verifyRatesApiContract, waitForWorkerDeployment } from "./release-readiness.ts";

/** Verifies deployment ordering and the live client contract before store credentials exist. */
async function main() {
  const repository = requireEnvironmentVariable(
    "GITHUB_REPOSITORY",
    process.env.GITHUB_REPOSITORY,
  );
  const commitSha = requireEnvironmentVariable("SOURCE_SHA", process.env.SOURCE_SHA);
  const githubToken = requireEnvironmentVariable("GITHUB_TOKEN", process.env.GITHUB_TOKEN);
  const apiEndpoint = requireEnvironmentVariable("API_ENDPOINT", process.env.API_ENDPOINT);

  const deployment = await waitForWorkerDeployment({
    repository,
    commitSha,
    githubToken,
    reportStatus: (message) => process.stdout.write(`${message}\n`),
  });
  process.stdout.write(
    `Cloudflare deployed ${commitSha} successfully (check run ${deployment.id}).\n`,
  );

  const verifiedRoutes = await verifyRatesApiContract({ apiEndpoint });
  for (const route of verifiedRoutes) {
    process.stdout.write(
      `Verified ${route.url}: ${route.rateCount} ${route.base}-based rates at ${route.timestamp}.\n`,
    );
  }
}

/**
 * Reads required process configuration without loading an environment file.
 * @param {string} name
 * @param {string | undefined} rawValue
 */
function requireEnvironmentVariable(name, rawValue) {
  const value = rawValue?.trim();
  if (value === undefined || value === "") {
    throw new Error(`${name} is required.`);
  }
  return value;
}

try {
  await main();
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Unexpected release check failure.";
  process.stderr.write(`Release readiness check failed: ${message}\n`);
  process.exitCode = 1;
}
