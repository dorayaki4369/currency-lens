import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(new URL("./run-wxt-without-env.mjs", import.meta.url));
const packageRoot = fileURLToPath(new URL("../", import.meta.url));

describe("run-wxt-without-env", () => {
  it("runs submit through the publishing CLI without resolving a project from the safe cwd", async () => {
    const { stderr, stdout } = await execFileAsync(
      process.execPath,
      [scriptPath, "--", "submit", "--help"],
      { cwd: packageRoot },
    );
    const output = `${stdout}${stderr}`;

    expect(output).toContain("publish-extension/");
    expect(output).toContain("--chrome-zip");
    expect(output).not.toContain("Entrypoints directory not found");
  });
});
