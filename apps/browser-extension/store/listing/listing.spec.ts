import { readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { AMO_LOCALES, readAmoMetadata } from "@/store/amo-metadata";

// AMO caps names at 50 characters, which is stricter than Chrome's 75.
const MAX_NAME_CHARACTERS = 50;
// Chrome caps the manifest description at 132 characters and shows it as the store summary.
const MAX_SUMMARY_CHARACTERS = 132;
// AMO accepts 3, but its listing guide asks for at most 2 and only 1 when it fits.
const MAX_AMO_CATEGORIES = 2;
const MAX_AMO_TAGS = 10;
// https://learn.microsoft.com/microsoft-edge/extensions/publish/publish-extension (Step 7)
const MIN_EDGE_DESCRIPTION_CHARACTERS = 250;
const MAX_EDGE_DESCRIPTION_CHARACTERS = 10_000;
const LOCALES_ROOT = new URL("../../public/_locales/", import.meta.url);
// https://mozilla.github.io/addons-server/topics/api/categories.html (extension type)
const AMO_EXTENSION_CATEGORIES: ReadonlySet<string> = new Set([
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
]);
// GET https://addons.mozilla.org/api/v5/addons/tags/ on 2026-11-21. AMO rejects any other tag,
// and the rejection would stop a release after Chrome has already been submitted.
const AMO_TAGS: ReadonlySet<string> = new Set([
  "ad blocker",
  "anti malware",
  "anti tracker",
  "antivirus",
  "chat",
  "container",
  "content blocker",
  "coupon",
  "dailymotion",
  "dark mode",
  "dndbeyond",
  "download",
  "facebook",
  "google",
  "image search",
  "mp3",
  "music",
  "password manager",
  "pinterest",
  "pixiv",
  "privacy",
  "reddit",
  "roblox",
  "scholar",
  "search",
  "security",
  "shopping",
  "social media",
  "streaming",
  "torrent",
  "translate",
  "twitch",
  "twitter",
  "user scripts",
  "video converter",
  "video downloader",
  "vpn",
  "wayback machine",
  "whatsapp",
  "word counter",
  "youtube",
  "zoom",
]);

describe("store listing", async () => {
  const metadata = await readAmoMetadata();
  const locales = Object.keys(metadata.name) as (keyof typeof metadata.name)[];

  it.each(locales)("keeps the %s name and summary within both stores' limits", (locale) => {
    expect(characterCount(metadata.name[locale])).toBeLessThanOrEqual(MAX_NAME_CHARACTERS);
    expect(characterCount(metadata.summary[locale])).toBeLessThanOrEqual(
      MAX_SUMMARY_CHARACTERS,
    );
  });

  it.each(locales)("keeps URLs out of the %s summary, which AMO rejects", (locale) => {
    expect(metadata.summary[locale]).not.toMatch(/https?:\/\//);
  });

  it.each(locales)("links the privacy policy from the %s description", (locale) => {
    expect(metadata.description[locale]).toContain("https://cl.dryk.net/privacy");
  });

  // Edge requires a description for every language in the package, within these lengths.
  it.each(locales)("keeps the %s description within Edge's length range", (locale) => {
    const length = characterCount(metadata.description[locale]);

    expect(length).toBeGreaterThanOrEqual(MIN_EDGE_DESCRIPTION_CHARACTERS);
    expect(length).toBeLessThanOrEqual(MAX_EDGE_DESCRIPTION_CHARACTERS);
  });

  it("has listing text for every language the package ships", async () => {
    const entries = await readdir(LOCALES_ROOT, { withFileTypes: true });
    const packageLocales = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    expect(packageLocales.toSorted()).toEqual(Object.keys(AMO_LOCALES).toSorted());
  });

  it("uses only AMO categories, within the listing guide's count", () => {
    const categories = metadata.categories.firefox;

    expect(categories.length).toBeLessThanOrEqual(MAX_AMO_CATEGORIES);
    expect(
      categories.filter((category) => !AMO_EXTENSION_CATEGORIES.has(category)),
    ).toEqual([]);
  });

  it("uses only tags from AMO's fixed list", () => {
    expect(metadata.tags.length).toBeLessThanOrEqual(MAX_AMO_TAGS);
    expect(metadata.tags.filter((tag) => !AMO_TAGS.has(tag))).toEqual([]);
  });

  it("publishes listing text for the default locale", () => {
    expect(locales).toContain(metadata.default_locale);
  });
});

/** Counts user-perceived characters, not UTF-16 code units, so Japanese text is not over-counted. */
function characterCount(text: string): number {
  return Array.from(new Intl.Segmenter().segment(text)).length;
}
