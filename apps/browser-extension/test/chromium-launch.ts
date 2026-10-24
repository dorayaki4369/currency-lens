import { platform } from "node:os";

/** Keeps headless Chromium operable inside managed macOS sandboxes. */
export function getHeadlessChromiumLaunchArguments(): string[] {
  return platform() === "darwin" ? ["--disable-gpu", "--single-process"] : [];
}
