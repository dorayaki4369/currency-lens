// Builds the AMO listing metadata that `wxt submit --firefox-amo-metadata-file` sends on release.
// Usage: node apps/browser-extension/store/amo-metadata.ts <output.json>
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { z } from "zod";

/** Maps each extension locale to the AMO locale its listing text is published under. */
export const AMO_LOCALES = { en: "en-US", ja: "ja" } as const;

type ExtensionLocale = keyof typeof AMO_LOCALES;
type AmoLocale = (typeof AMO_LOCALES)[ExtensionLocale];
type Translations = Record<AmoLocale, string>;

const LISTING_ROOT = new URL("./listing/", import.meta.url);
const LOCALES_ROOT = new URL("../public/_locales/", import.meta.url);

const messagesSchema = z.object({
  extensionDescription: z.object({ message: z.string().min(1) }),
  extensionName: z.object({ message: z.string().min(1) }),
});

// AMO's edit API takes categories per application and only accepts tags from its fixed list.
export const amoSettingsSchema = z.strictObject({
  categories: z.strictObject({ firefox: z.array(z.string().min(1)).min(1) }),
  default_locale: z.enum(Object.values(AMO_LOCALES)),
  tags: z.array(z.string().min(1)),
});

export type AmoSettings = z.infer<typeof amoSettingsSchema>;

/** The listing sources for one extension locale. */
export interface LocalizedListing {
  readonly description: string;
  readonly name: string;
  readonly summary: string;
}

/** The body of AMO's add-on edit request, as publish-browser-extension sends it. */
export interface AmoMetadata extends AmoSettings {
  readonly description: Translations;
  readonly name: Translations;
  readonly summary: Translations;
}

/** Combines the per-locale listing text with the AMO-only settings. */
export function createAmoMetadata(
  listings: Readonly<Record<ExtensionLocale, LocalizedListing>>,
  settings: AmoSettings,
): AmoMetadata {
  return {
    ...settings,
    description: translate(listings, (listing) => listing.description),
    name: translate(listings, (listing) => listing.name),
    summary: translate(listings, (listing) => listing.summary),
  };
}

/** Reads the repository's listing sources and builds the AMO metadata from them. */
export async function readAmoMetadata(): Promise<AmoMetadata> {
  const [en, ja, settingsText] = await Promise.all([
    readListing("en"),
    readListing("ja"),
    readText(LISTING_ROOT, "amo.json"),
  ]);

  return createAmoMetadata({ en, ja }, amoSettingsSchema.parse(JSON.parse(settingsText)));
}

/** Writes the AMO metadata JSON to the path given on the command line. */
export async function writeAmoMetadata(outputPath: string | undefined): Promise<void> {
  if (outputPath === undefined || outputPath === "") {
    throw new Error(
      "Usage: node apps/browser-extension/store/amo-metadata.ts <output.json>",
    );
  }
  await writeFile(outputPath, `${JSON.stringify(await readAmoMetadata(), null, 2)}\n`);
}

/** Reads the name and summary from the manifest messages and the description from the listing. */
async function readListing(locale: ExtensionLocale): Promise<LocalizedListing> {
  const messages = messagesSchema.parse(
    JSON.parse(await readText(LOCALES_ROOT, `${locale}/messages.json`)),
  );

  return {
    description: (await readText(LISTING_ROOT, `description.${locale}.txt`)).trimEnd(),
    name: messages.extensionName.message,
    summary: messages.extensionDescription.message,
  };
}

/** Keys one listing field by AMO locale. */
function translate(
  listings: Readonly<Record<ExtensionLocale, LocalizedListing>>,
  pick: (listing: LocalizedListing) => string,
): Translations {
  return {
    [AMO_LOCALES.en]: pick(listings.en),
    [AMO_LOCALES.ja]: pick(listings.ja),
  };
}

/** Reads a UTF-8 listing source relative to a directory URL. */
function readText(root: URL, path: string): Promise<string> {
  return readFile(new URL(path, root), "utf8");
}

if (import.meta.main) {
  await writeAmoMetadata(process.argv[2]);
}
