import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

// `pnpm test:e2e` builds this package before Playwright starts.
const outputRoot = new URL("../../.output/chrome-mv3/", import.meta.url);

test("the built popup loads converter and settings screens as lazy route chunks", async () => {
  const popupHtml = await readFile(new URL("popup.html", outputRoot), "utf8");
  const popupEntryPath = popupHtml.match(
    /<script[^>]+src="\/(chunks\/popup-[^"]+\.js)"/u,
  )?.[1];
  expect(popupEntryPath).toBeDefined();
  if (popupEntryPath === undefined) {
    return;
  }

  const popupEntry = await readFile(new URL(popupEntryPath, outputRoot), "utf8");
  const lazyChunkNames = [...popupEntry.matchAll(/import\("\.\/([^"]+\.js)"\)/gu)].flatMap(
    (match) => (match[1] === undefined ? [] : [match[1]]),
  );

  expect(lazyChunkNames.filter((name) => name.startsWith("index-"))).toHaveLength(2);
  expect(lazyChunkNames).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/^currencies-[\w-]+\.js$/u),
      expect.stringMatching(/^display-[\w-]+\.js$/u),
      expect.stringMatching(/^symbols-[\w-]+\.js$/u),
    ]),
  );
});
