import { type ChildProcess, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = dirname(scriptDirectory);
const wxtBin = join(packageRoot, "node_modules", "wxt", "bin", "wxt.mjs");
const publishExtensionBin = fileURLToPath(
  import.meta.resolve("publish-browser-extension/cli"),
);
const localApiEndpointOption = "--use-local-api-endpoint";
const projectCommands = new Set(["build", "clean", "cleanup", "prepare", "zip"]);
const publishCommands = new Set(["publish-extension", "submit"]);
const forwardedSignals = ["SIGINT", "SIGTERM"] as const;

type Environment = Record<string, string | undefined>;
type WrapperRuntime = {
  once: (signal: (typeof forwardedSignals)[number], listener: () => void) => unknown;
  emitWarning: (warning: string) => void;
};

type Command = {
  readonly arguments: readonly string[];
  readonly bin: string;
};

/** Runs the safe wrapper against the current Node process. */
export async function runWxtCli(): Promise<void> {
  process.exitCode = await runWxtWithoutEnv(
    process.argv.slice(2),
    process.env,
    mkdtemp,
    rm,
    spawn,
    process,
  );
}

/** Starts the delegated CLI from a safe working directory and returns its exit status. */
export async function runWxtWithoutEnv(
  rawUserArguments: readonly string[],
  environment: Environment,
  createTemporaryDirectory: typeof mkdtemp,
  removeDirectory: typeof rm,
  spawnChild: typeof spawn,
  runtime: WrapperRuntime,
): Promise<number> {
  // WXT checks its working directory before project config can disable environment discovery.
  const safeWorkingDirectory = await createTemporaryDirectory(
    join(tmpdir(), "currency-lens-wxt-"),
  );
  const { useLocalApiEndpoint, userArguments } = parseUserArguments(rawUserArguments);
  if (useLocalApiEndpoint) {
    environment["API_ENDPOINT"] = "http://localhost:8787";
  }

  const command = createCommand(userArguments);
  const child = spawnChild(process.execPath, [command.bin, ...command.arguments], {
    cwd: safeWorkingDirectory,
    env: environment,
    stdio: "inherit",
  });

  for (const signal of forwardedSignals) {
    runtime.once(signal, () => child.kill(signal));
  }

  try {
    return await waitForChildExit(child);
  } finally {
    await cleanupSafeWorkingDirectory(
      safeWorkingDirectory,
      removeDirectory,
      runtime.emitWarning.bind(runtime),
    );
  }
}

/** Removes wrapper-only options before forwarding CLI arguments. */
export function parseUserArguments(rawUserArguments: readonly string[]): {
  readonly useLocalApiEndpoint: boolean;
  readonly userArguments: readonly string[];
} {
  const useLocalApiEndpoint = rawUserArguments[0] === localApiEndpointOption;
  const argumentsAfterOptions = useLocalApiEndpoint
    ? rawUserArguments.slice(1)
    : rawUserArguments;
  const userArguments =
    argumentsAfterOptions[0] === "--"
      ? argumentsAfterOptions.slice(1)
      : argumentsAfterOptions;

  return { useLocalApiEndpoint, userArguments };
}

/** Selects the dedicated publishing CLI without resolving project config. */
export function createCommand(userArguments: readonly string[]): Command {
  const [command, ...commandArguments] = userArguments;
  if (command !== undefined && publishCommands.has(command)) {
    return { arguments: commandArguments, bin: publishExtensionBin };
  }

  return { arguments: createWxtArguments(userArguments), bin: wxtBin };
}

/** Adds WXT's project root as the positional argument owned by each project command. */
export function createWxtArguments(userArguments: readonly string[]): readonly string[] {
  const [command, ...commandArguments] = userArguments;
  if (command !== undefined && projectCommands.has(command)) {
    return [command, packageRoot, ...commandArguments];
  }

  return [packageRoot, ...userArguments];
}

/** Waits for the delegated CLI and preserves its numeric exit status. */
export function waitForChildExit(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      resolve(code ?? (signal === null ? 0 : 1));
    });
  });
}

/** Keeps a successful command authoritative when temporary cleanup is denied. */
export async function cleanupSafeWorkingDirectory(
  safeWorkingDirectory: string,
  removeDirectory: typeof rm,
  emitWarning: (warning: string) => void,
): Promise<void> {
  try {
    await removeDirectory(safeWorkingDirectory, { force: true, recursive: true });
  } catch {
    emitWarning("The temporary WXT working directory could not be removed.");
  }
}
