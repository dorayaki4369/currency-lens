import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  AMO_LOCALES,
  type AmoSettings,
  amoSettingsSchema,
  createAmoMetadata,
  parseSupportEmail,
  readAmoMetadata,
  SUPPORT_LOCALES,
  writeAmoMetadata,
} from "@/store/amo-metadata";

const SETTINGS: AmoSettings = {
  categories: { firefox: ["search-tools"] },
  default_locale: "en-US",
  support_url: "https://example.com",
  tags: ["shopping"],
};
const SUPPORT_EMAIL = "support@example.com";

describe("createAmoMetadata", () => {
  it("keys each listing field by AMO locale and keeps the AMO settings", () => {
    const metadata = createAmoMetadata(
      {
        de: labelledListing("de"),
        en: labelledListing("en"),
        es: labelledListing("es"),
        fr: labelledListing("fr"),
        ja: labelledListing("ja"),
        ko: labelledListing("ko"),
        pt_BR: labelledListing("pt_BR"),
        zh_CN: labelledListing("zh_CN"),
        zh_TW: labelledListing("zh_TW"),
      },
      SETTINGS,
      SUPPORT_EMAIL,
    );

    expect(metadata).toEqual({
      categories: SETTINGS.categories,
      default_locale: SETTINGS.default_locale,
      tags: SETTINGS.tags,
      description: {
        de: "de body",
        "en-US": "en body",
        "es-AR": "es body",
        "es-CL": "es body",
        "es-ES": "es body",
        "es-MX": "es body",
        fr: "fr body",
        ja: "ja body",
        ko: "ko body",
        "pt-BR": "pt_BR body",
        "zh-CN": "zh_CN body",
        "zh-TW": "zh_TW body",
      },
      name: expect.objectContaining({ "en-US": "en name", "zh-TW": "zh_TW name" }),
      summary: expect.objectContaining({ "es-MX": "es summary", ja: "ja summary" }),
      support_email: { "en-US": SUPPORT_EMAIL, ja: SUPPORT_EMAIL },
      support_url: { "en-US": "https://example.com", ja: "https://example.com" },
    });
  });

  it("publishes a translation for every AMO locale it maps", () => {
    const listing = { description: "body", name: "name", summary: "summary" };
    const metadata = createAmoMetadata(
      {
        de: listing,
        en: listing,
        es: listing,
        fr: listing,
        ja: listing,
        ko: listing,
        pt_BR: listing,
        zh_CN: listing,
        zh_TW: listing,
      },
      SETTINGS,
      SUPPORT_EMAIL,
    );

    expect(Object.keys(metadata.description).toSorted()).toEqual(
      Object.values(AMO_LOCALES).flat().toSorted(),
    );
  });
});

describe("parseSupportEmail", () => {
  it("reads the address the privacy policy links", () => {
    expect(
      parseSupportEmail(
        '<a href="mailto:support@example.com">support@example.com</a>, <a href="mailto:support@example.com?subject=Hi">again</a>',
      ),
    ).toBe(SUPPORT_EMAIL);
  });

  it("rejects a policy without a contact address", () => {
    expect(() => parseSupportEmail("<p>No contact.</p>")).toThrow("links 0");
  });

  it("rejects a policy with two different contact addresses", () => {
    expect(() =>
      parseSupportEmail(
        '<a href="mailto:a@example.com"></a><a href="mailto:b@example.com"></a>',
      ),
    ).toThrow("links 2");
  });

  it("rejects a link that is not an email address", () => {
    expect(() => parseSupportEmail('<a href="mailto:support"></a>')).toThrow();
  });
});

describe("amoSettingsSchema", () => {
  it("rejects categories that are not grouped under the firefox application", () => {
    expect(
      amoSettingsSchema.safeParse({ ...SETTINGS, categories: ["search-tools"] }).success,
    ).toBe(false);
  });

  it("rejects a support URL that is not HTTPS", () => {
    expect(
      amoSettingsSchema.safeParse({ ...SETTINGS, support_url: "http://example.com" })
        .success,
    ).toBe(false);
  });

  it("rejects a default locale that has no listing text", () => {
    expect(amoSettingsSchema.safeParse({ ...SETTINGS, default_locale: "it" }).success).toBe(
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

  it("takes the support email from the privacy policy the Worker serves", async () => {
    const metadata = await readAmoMetadata();
    const privacyPolicy = await readFile(
      new URL("../../server/public/privacy.html", import.meta.url),
      "utf8",
    );

    for (const locale of SUPPORT_LOCALES) {
      expect(privacyPolicy).toContain(`mailto:${metadata.support_email[locale]}"`);
    }
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

/** Builds listing text whose fields name the locale they came from. */
function labelledListing(label: string) {
  return {
    description: `${label} body`,
    name: `${label} name`,
    summary: `${label} summary`,
  };
}
