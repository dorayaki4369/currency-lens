// Builds the AMO listing metadata that `wxt submit --firefox-amo-metadata-file` sends on release.
// Usage: node apps/browser-extension/store/amo-metadata.ts <output.json>
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { z } from "zod";

/**
 * Maps each extension locale, named as its `_locales` directory, to the AMO locales its listing
 * text is published under. AMO has no plain Spanish, so one text serves every Spanish region.
 */
export const AMO_LOCALES = {
  de: ["de"],
  en: ["en-US"],
  es: ["es-ES", "es-MX", "es-AR", "es-CL"],
  fr: ["fr"],
  ja: ["ja"],
  ko: ["ko"],
  pt_BR: ["pt-BR"],
  zh_CN: ["zh-CN"],
  zh_TW: ["zh-TW"],
} as const;

/**
 * The AMO locales that carry the support email and URL. They are the same in every language, so
 * they are published only for English, which is the default locale, and for Japanese.
 */
export const SUPPORT_LOCALES = ["en-US", "ja"] as const;

type ExtensionLocale = keyof typeof AMO_LOCALES;
type AmoLocale = (typeof AMO_LOCALES)[ExtensionLocale][number];
type Translations = Record<AmoLocale, string>;
type SupportTranslations = Record<(typeof SUPPORT_LOCALES)[number], string>;

const LISTING_ROOT = new URL("./listing/", import.meta.url);
const LOCALES_ROOT = new URL("../public/_locales/", import.meta.url);
// The support email is the contact address of the privacy policy that the Worker serves.
const PRIVACY_POLICY_PATH = new URL("../../server/public/privacy.html", import.meta.url);

const messagesSchema = z.object({
  extensionDescription: z.object({ message: z.string().min(1) }),
  extensionName: z.object({ message: z.string().min(1) }),
});

// AMO's edit API takes categories per application and only accepts tags from its fixed list.
export const amoSettingsSchema = z.strictObject({
  categories: z.strictObject({ firefox: z.array(z.string().min(1)).min(1) }),
  default_locale: z.enum(Object.values(AMO_LOCALES).flat()),
  support_url: z.url({ protocol: /^https$/ }),
  tags: z.array(z.string().min(1)),
});

export type AmoSettings = z.infer<typeof amoSettingsSchema>;

const supportEmailSchema = z.email();

/** The listing sources for one extension locale. */
export interface LocalizedListing {
  readonly description: string;
  readonly name: string;
  readonly summary: string;
}

/** The body of AMO's add-on edit request, as publish-browser-extension sends it. */
export interface AmoMetadata extends Omit<AmoSettings, "support_url"> {
  readonly description: Translations;
  readonly name: Translations;
  readonly summary: Translations;
  readonly support_email: SupportTranslations;
  readonly support_url: SupportTranslations;
}

/** Combines the per-locale listing text with the AMO-only settings and the support contact. */
export function createAmoMetadata(
  listings: Readonly<Record<ExtensionLocale, LocalizedListing>>,
  settings: AmoSettings,
  supportEmail: string,
): AmoMetadata {
  const { support_url: supportUrl, ...rest } = settings;
  return {
    ...rest,
    description: translate(listings, (listing) => listing.description),
    name: translate(listings, (listing) => listing.name),
    summary: translate(listings, (listing) => listing.summary),
    support_email: translateSupport(supportEmail),
    support_url: translateSupport(supportUrl),
  };
}

/** Reads the one contact address that the privacy policy links with `mailto:`. */
export function parseSupportEmail(privacyPolicyHtml: string): string {
  const addresses = new Set(
    Array.from(privacyPolicyHtml.matchAll(/href="mailto:([^"?]+)"/g), (match) => match[1]),
  );
  if (addresses.size !== 1) {
    throw new Error(
      `The privacy policy must link exactly one contact address, but it links ${addresses.size}.`,
    );
  }
  return supportEmailSchema.parse([...addresses][0]);
}

/** Reads the repository's listing sources and builds the AMO metadata from them. */
export async function readAmoMetadata(): Promise<AmoMetadata> {
  const [de, en, es, fr, ja, ko, ptBR, zhCN, zhTW, settingsText, privacyPolicyHtml] =
    await Promise.all([
      readListing("de"),
      readListing("en"),
      readListing("es"),
      readListing("fr"),
      readListing("ja"),
      readListing("ko"),
      readListing("pt_BR"),
      readListing("zh_CN"),
      readListing("zh_TW"),
      readText(LISTING_ROOT, "amo.json"),
      readFile(PRIVACY_POLICY_PATH, "utf8"),
    ]);

  return createAmoMetadata(
    { de, en, es, fr, ja, ko, pt_BR: ptBR, zh_CN: zhCN, zh_TW: zhTW },
    amoSettingsSchema.parse(JSON.parse(settingsText)),
    parseSupportEmail(privacyPolicyHtml),
  );
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

/** Keys one listing field by every AMO locale in `AMO_LOCALES`. */
function translate(
  listings: Readonly<Record<ExtensionLocale, LocalizedListing>>,
  pick: (listing: LocalizedListing) => string,
): Translations {
  const text = (locale: ExtensionLocale) => pick(listings[locale]);
  return {
    de: text("de"),
    "en-US": text("en"),
    "es-AR": text("es"),
    "es-CL": text("es"),
    "es-ES": text("es"),
    "es-MX": text("es"),
    fr: text("fr"),
    ja: text("ja"),
    ko: text("ko"),
    "pt-BR": text("pt_BR"),
    "zh-CN": text("zh_CN"),
    "zh-TW": text("zh_TW"),
  };
}

/** Keys a language-independent support value by every AMO locale in `SUPPORT_LOCALES`. */
function translateSupport(value: string): SupportTranslations {
  return { "en-US": value, ja: value };
}

/** Reads a UTF-8 listing source relative to a directory URL. */
function readText(root: URL, path: string): Promise<string> {
  return readFile(new URL(path, root), "utf8");
}

if (import.meta.main) {
  await writeAmoMetadata(process.argv[2]);
}
