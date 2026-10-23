import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const TEST_TIMEOUT_MILLISECONDS = 120_000;
const SUITE_TIMEOUT_MILLISECONDS = 180_000;
const repositoryRoot = fileURLToPath(new URL(".", import.meta.url));

/** Runs critical flows against the built extension loaded into Chromium. */
export default defineConfig({
  forbidOnly: true,
  fullyParallel: false,
  globalTimeout: SUITE_TIMEOUT_MILLISECONDS,
  outputDir: resolve(tmpdir(), "currency-lens-playwright-e2e"),
  reporter: "line",
  retries: 0,
  testDir: resolve(repositoryRoot, "apps/browser-extension/test/e2e"),
  testMatch: "**/*.spec.ts",
  timeout: TEST_TIMEOUT_MILLISECONDS,
  use: {
    locale: "ja-JP",
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  workers: 1,
});
