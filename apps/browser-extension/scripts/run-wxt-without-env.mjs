import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(scriptDirectory);
const wxtBin = join(packageRoot, "node_modules", "wxt", "bin", "wxt.mjs");
const safeWorkingDirectory = await mkdtemp(join(tmpdir(), "currency-lens-wxt-"));
const userArguments = process.argv.slice(2);
const projectCommands = new Set(["build", "clean", "cleanup", "prepare", "zip"]);

/** Adds WXT's project root as the positional argument owned by each project command. */
function createWxtArguments() {
  const [command, ...commandArguments] = userArguments;
  if (command && projectCommands.has(command)) {
    return [command, packageRoot, ...commandArguments];
  }
  if (command === "submit" || command === "publish-extension") {
    return userArguments;
  }

  return [packageRoot, ...userArguments];
}

/**
 * WXT loads environment files from its process working directory before user
 * config is applied. Start it in an empty temporary directory and pass the
 * actual project root explicitly; Vite's envDir is disabled separately.
 */
const child = spawn(process.execPath, [wxtBin, ...createWxtArguments()], {
  cwd: safeWorkingDirectory,
  env: process.env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => child.kill(signal));
}

/** Waits for the delegated CLI and preserves its numeric exit status. */
function waitForChildExit() {
  /** @type {Promise<number>} */
  const completion = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      resolve(code ?? (signal ? 1 : 0));
    });
  });
  return completion;
}

let exitCode = 1;
try {
  exitCode = await waitForChildExit();
} finally {
  await rm(safeWorkingDirectory, { force: true, recursive: true });
}

process.exitCode = exitCode;
