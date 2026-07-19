import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(scriptDirectory);
const wxtBin = join(packageRoot, "node_modules", "wxt", "bin", "wxt.mjs");
const publishExtensionBin = fileURLToPath(
  import.meta.resolve("publish-browser-extension/cli"),
);
const safeWorkingDirectory = await mkdtemp(join(tmpdir(), "currency-lens-wxt-"));
const rawUserArguments = process.argv.slice(2);
const localApiEndpointOption = "--use-local-api-endpoint";
const useLocalApiEndpoint = rawUserArguments[0] === localApiEndpointOption;
const argumentsAfterOptions = useLocalApiEndpoint
  ? rawUserArguments.slice(1)
  : rawUserArguments;
const userArguments =
  argumentsAfterOptions[0] === "--"
    ? argumentsAfterOptions.slice(1)
    : argumentsAfterOptions;
const projectCommands = new Set(["build", "clean", "cleanup", "prepare", "zip"]);
const publishCommands = new Set(["publish-extension", "submit"]);

if (useLocalApiEndpoint) {
  process.env.API_ENDPOINT = "http://localhost:8787";
}

/** Selects the dedicated publishing CLI without resolving project config. */
function createCommand() {
  const [command, ...commandArguments] = userArguments;
  if (command && publishCommands.has(command)) {
    return { arguments: commandArguments, bin: publishExtensionBin };
  }

  return { arguments: createWxtArguments(), bin: wxtBin };
}

/** Adds WXT's project root as the positional argument owned by each project command. */
function createWxtArguments() {
  const [command, ...commandArguments] = userArguments;
  if (command && projectCommands.has(command)) {
    return [command, packageRoot, ...commandArguments];
  }

  return [packageRoot, ...userArguments];
}

/**
 * WXT loads environment files from its process working directory before user
 * config is applied. Start it in an empty temporary directory and pass the
 * actual project root explicitly; Vite's envDir is disabled separately.
 */
const command = createCommand();
const child = spawn(process.execPath, [command.bin, ...command.arguments], {
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
