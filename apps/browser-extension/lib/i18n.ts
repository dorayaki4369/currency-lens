import { de } from "@/lib/locales/de";
import { en, type LocaleDictionary, type TranslationKey } from "@/lib/locales/en";
import { es } from "@/lib/locales/es";
import { fr } from "@/lib/locales/fr";
import { ja } from "@/lib/locales/ja";
import { ko } from "@/lib/locales/ko";
import { ptBR } from "@/lib/locales/pt-BR";
import { zhCN } from "@/lib/locales/zh-CN";
import { zhTW } from "@/lib/locales/zh-TW";

export type { TranslationKey } from "@/lib/locales/en";

export const SUPPORTED_UI_LOCALES = [
  "en",
  "ja",
  "zh-CN",
  "zh-TW",
  "ko",
  "es",
  "fr",
  "de",
  "pt-BR",
] as const;

export type UiLocale = (typeof SUPPORTED_UI_LOCALES)[number];

const MAX_STANDARD_CONVERTED_AMOUNT_CHARACTERS = 14;

const dictionaries: Readonly<Record<UiLocale, LocaleDictionary>> = {
  de,
  en,
  es,
  fr,
  ja,
  ko,
  "pt-BR": ptBR,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
};

/** Locales chosen by the primary language subtag alone. */
const LOCALES_BY_LANGUAGE: Readonly<Record<string, UiLocale>> = {
  de: "de",
  en: "en",
  es: "es",
  fr: "fr",
  ja: "ja",
  ko: "ko",
  pt: "pt-BR",
};

/** Chinese regions that conventionally write Traditional Chinese. */
const TRADITIONAL_CHINESE_REGIONS = new Set(["hk", "mo", "tw"]);

/** Resolves the browser language to one of the UI locales shipped by the extension. */
export function resolveUiLocale(language: string | undefined): UiLocale {
  const [primary = "", ...subtags] = (language ?? "").toLowerCase().split(/[-_]/u);
  if (primary === "zh") {
    return isTraditionalChinese(subtags) ? "zh-TW" : "zh-CN";
  }
  return LOCALES_BY_LANGUAGE[primary] ?? "en";
}

/** Prefers an explicit script subtag, then falls back to the region's usual script. */
function isTraditionalChinese(subtags: readonly string[]): boolean {
  if (subtags.includes("hant")) {
    return true;
  }
  if (subtags.includes("hans")) {
    return false;
  }
  return subtags.some((subtag) => TRADITIONAL_CHINESE_REGIONS.has(subtag));
}

/** Returns the best available browser language without assuming extension globals exist. */
export function getUiLocale(language?: string): UiLocale {
  if (language !== undefined) {
    return resolveUiLocale(language);
  }
  if (typeof browser !== "undefined") {
    return resolveUiLocale(browser.i18n.getUILanguage());
  }
  return resolveUiLocale(typeof navigator === "undefined" ? undefined : navigator.language);
}

/** Formats a typed message and replaces named placeholders with display values. */
export function translate(
  locale: UiLocale,
  key: TranslationKey,
  replacements: Readonly<Record<string, number | string>> = {},
): string {
  let message: string = dictionaries[locale].messages[key];
  for (const [name, value] of Object.entries(replacements)) {
    message = message.replaceAll(`{${name}}`, String(value));
  }
  return message;
}

/** Returns a localized currency name while keeping private or unsupported codes readable. */
export function getCurrencyDisplayName(currencyCode: string, locale: UiLocale): string {
  const overrides: Readonly<Record<string, string>> = dictionaries[locale].currencyNames;
  const override = overrides[currencyCode];
  if (override !== undefined) {
    return override;
  }
  try {
    return (
      new Intl.DisplayNames([locale], { type: "currency" }).of(currencyCode) ?? currencyCode
    );
  } catch {
    return currencyCode;
  }
}

/** Returns localized region names for compact currency metadata. */
export function getRegionDisplayNames(
  regionCodes: readonly string[],
  locale: UiLocale,
  limit = 3,
): string {
  try {
    const displayNames = new Intl.DisplayNames([locale], { type: "region" });
    return regionCodes
      .slice(0, limit)
      .map((regionCode) => displayNames.of(regionCode) ?? regionCode)
      .join(" · ");
  } catch {
    return regionCodes.slice(0, limit).join(" · ");
  }
}

/** Formats a converted amount with the target currency's narrow symbol and its own fraction digits. */
export function formatCurrencyAmount(
  value: string,
  currencyCode: string,
  fractionDigits: number,
  locale: UiLocale,
): string {
  const digits = {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  };
  const numericValue = Number(value);
  try {
    return new Intl.NumberFormat(locale, {
      ...digits,
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
      style: "currency",
    }).format(numericValue);
  } catch {
    // Intl accepts only three-letter codes, so codes such as DASH are appended instead.
    return `${new Intl.NumberFormat(locale, digits).format(numericValue)} ${currencyCode}`;
  }
}

/** Uses a two-decimal mantissa when the standard two-decimal display is too wide. */
export function formatConvertedAmount(value: string, locale: UiLocale): string {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return value;
  }
  try {
    const formatter = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
    const standardText = formatter.format(numericValue);
    return standardText.length <= MAX_STANDARD_CONVERTED_AMOUNT_CHARACTERS
      ? standardText
      : numericValue.toExponential(2).replace("e", "E");
  } catch {
    return value;
  }
}
