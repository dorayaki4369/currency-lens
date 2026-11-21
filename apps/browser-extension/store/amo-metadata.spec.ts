import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  type AmoSettings,
  amoSettingsSchema,
  createAmoMetadata,
  readAmoMetadata,
  writeAmoMetadata,
} from "@/store/amo-metadata";

const SETTINGS: AmoSettings = {
  categories: { firefox: ["search-tools"] },
  default_locale: "en-US",
  tags: ["shopping"],
};

describe("createAmoMetadata", () => {
  it("keys each listing field by AMO locale and keeps the AMO settings", () => {
    const metadata = createAmoMetadata(
      {
        en: {
          description: "English body",
          name: "English name",
          summary: "English summary",
        },
        ja: { description: "日本語の本文", name: "日本語の名前", summary: "日本語の要約" },
      },
      SETTINGS,
    );

    expect(metadata).toEqual({
      ...SETTINGS,
      description: { "en-US": "English body", ja: "日本語の本文" },
      name: { "en-US": "English name", ja: "日本語の名前" },
      summary: { "en-US": "English summary", ja: "日本語の要約" },
    });
  });
});

describe("amoSettingsSchema", () => {
  it("rejects categories that are not grouped under the firefox application", () => {
    expect(
      amoSettingsSchema.safeParse({ ...SETTINGS, categories: ["search-tools"] }).success,
    ).toBe(false);
  });

  it("rejects a default locale that has no listing text", () => {
    expect(amoSettingsSchema.safeParse({ ...SETTINGS, default_locale: "fr" }).success).toBe(
      false,
    );
  });
});

describe("readAmoMetadata", () => {
  it("builds the metadata from the manifest messages and listing files", async () => {
    const metadata = await readAmoMetadata();
    const englishMessages = JSON.parse(
      await readFile(
        new URL("../public/_locales/en/messages.json", import.meta.url),
        "utf8",
      ),
    ) as { extensionName: { message: string } };
    const englishDescription = await readFile(
      new URL("./listing/description.en.txt", import.meta.url),
      "utf8",
    );

    expect(metadata.name["en-US"]).toBe(englishMessages.extensionName.message);
    expect(metadata.description["en-US"]).toBe(englishDescription.trimEnd());
  });
});

describe("writeAmoMetadata", () => {
  let directory: string | undefined;

  afterEach(async () => {
    if (directory !== undefined) {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("writes the metadata as JSON to the given path", async () => {
    directory = await mkdtemp(join(tmpdir(), "amo-metadata-"));
    const outputPath = join(directory, "amo-metadata.json");

    await writeAmoMetadata(outputPath);

    expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual(await readAmoMetadata());
  });

  it("requires an output path", async () => {
    await expect(writeAmoMetadata(undefined)).rejects.toThrow("Usage:");
  });
});
