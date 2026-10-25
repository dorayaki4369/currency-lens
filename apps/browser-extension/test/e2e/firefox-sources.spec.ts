import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { z } from "zod/v4";
import wxtConfig from "../../wxt.config";

// `pnpm test:e2e` runs `zip:firefox` before Playwright starts.
const outputRoot = new URL("../../.output/", import.meta.url);
const packageJsonUrl = new URL("../../package.json", import.meta.url);
const packageJsonSchema = z.object({ version: z.string().min(1) });
const execFileAsync = promisify(execFile);

test("the Firefox sources archive contains every configured source and no secrets or build output", async () => {
  const files = await listSourcesArchive();

  for (const pattern of wxtConfig.zip?.includeSources ?? []) {
    const directory = pattern.endsWith("/**") ? pattern.slice(0, -"**".length) : undefined;
    const isIncluded = files.some((file) =>
      directory === undefined ? file === pattern : file.startsWith(directory),
    );
    expect(isIncluded, `${pattern} is missing from the sources archive`).toBe(true);
  }
  expect(
    files.filter((file) =>
      /(?:^|\/)(?:\.env|\.dev\.vars|node_modules|\.output|\.wxt)(?:$|[./])/u.test(file),
    ),
  ).toEqual([]);
});

/** Lists the entries of the sources ZIP built for the current extension version. */
async function listSourcesArchive(): Promise<string[]> {
  const { version } = packageJsonSchema.parse(
    JSON.parse(await readFile(packageJsonUrl, "utf8")),
  );
  const archiveName = (await readdir(outputRoot)).find((name) =>
    name.endsWith(`-${version}-sources.zip`),
  );
  expect(archiveName, `no sources ZIP for ${version}`).toBeDefined();

  const { stdout } = await execFileAsync("unzip", [
    "-Z1",
    fileURLToPath(new URL(archiveName ?? "", outputRoot)),
  ]);
  return stdout.split("\n").filter((line) => line !== "");
}
