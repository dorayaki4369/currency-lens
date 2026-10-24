import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL("./verify-release-readiness.mjs", import.meta.url),
);
const packageRoot = fileURLToPath(new URL("../", import.meta.url));

describe("verify-release-readiness under Node", () => {
  it("resolves every module without the Vite alias and reaches input validation", async () => {
    const result = await execFileAsync(process.execPath, [scriptPath], {
      cwd: packageRoot,
      env: { PATH: process.env["PATH"] ?? "" },
    }).catch((error: { stderr: string; stdout: string }) => error);
    const output = `${result.stdout}${result.stderr}`;

    expect(output).not.toContain("ERR_MODULE_NOT_FOUND");
    expect(output).toContain("GITHUB_REPOSITORY is required");
  });
});
