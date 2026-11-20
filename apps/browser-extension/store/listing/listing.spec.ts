import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { z } from "zod";

// AMO caps names at 50 characters, which is stricter than Chrome's 75.
const MAX_NAME_CHARACTERS = 50;
// Chrome caps the manifest description at 132 characters and shows it as the store summary.
const MAX_SUMMARY_CHARACTERS = 132;
// AMO accepts 3, but its listing guide asks for at most 2 and only 1 when it fits.
const MAX_AMO_CATEGORIES = 2;
const MAX_AMO_TAGS = 10;
const AMO_EXTENSION_CATEGORIES = [
  "alerts-updates",
  "appearance",
  "bookmarks",
  "download-management",
  "feeds-news-blogging",
  "games-entertainment",
  "language-support",
  "photos-music-videos",
  "privacy-security",
  "search-tools",
  "shopping",
  "social-communication",
  "tabs",
  "web-development",
  "other",
] as const;
const LOCALES = ["en", "ja"] as const;

const messagesSchema = z.object({
  extensionDescription: z.object({ message: z.string().min(1) }),
  extensionName: z.object({ message: z.string().min(1) }),
});
const amoSettingsSchema = z.strictObject({
  categories: z.array(z.enum(AMO_EXTENSION_CATEGORIES)).min(1).max(MAX_AMO_CATEGORIES),
  default_locale: z.literal("en-US"),
  tags: z.array(z.string().min(1)).max(MAX_AMO_TAGS),
});

describe("store listing", () => {
  it.each(LOCALES)(
    "keeps the %s name and summary within both stores' limits",
    async (locale) => {
      const messages = messagesSchema.parse(
        JSON.parse(await readText(`../../public/_locales/${locale}/messages.json`)),
      );

      expect(characterCount(messages.extensionName.message)).toBeLessThanOrEqual(
        MAX_NAME_CHARACTERS,
      );
      expect(characterCount(messages.extensionDescription.message)).toBeLessThanOrEqual(
        MAX_SUMMARY_CHARACTERS,
      );
    },
  );

  it.each(LOCALES)("links the privacy policy from the %s description", async (locale) => {
    const description = await readText(`./description.${locale}.txt`);

    expect(description).toContain("https://cl.dryk.net/privacy");
  });

  it("uses AMO categories and tag counts that AMO accepts", async () => {
    const settings: unknown = JSON.parse(await readText("./amo.json"));

    expect(amoSettingsSchema.safeParse(settings).success).toBe(true);
  });
});

/** Reads a listing source relative to this directory. */
function readText(path: string): Promise<string> {
  return readFile(new URL(path, import.meta.url), "utf8");
}

/** Counts user-perceived characters, not UTF-16 code units, so Japanese text is not over-counted. */
function characterCount(text: string): number {
  return Array.from(new Intl.Segmenter().segment(text)).length;
}
