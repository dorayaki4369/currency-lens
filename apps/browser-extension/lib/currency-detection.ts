import type { CurrencyCode } from "@cl/currency";
import {
  getCurrencyCodes,
  getCurrencyMetadata,
  getCurrencySymbolDefinition,
  getCurrencySymbolDefinitions,
} from "./currency";

export const MAX_DETECTED_AMOUNTS = 3;

const MAX_SELECTION_LENGTH = 1_000;
const NUMBER_SOURCE = String.raw`\d+(?:[.,\u00A0\u202F\u2009 ]\d+)*`;
const GROUPING_SPACE_PATTERN = /[\u00A0\u202F\u2009 ]/gu;
const WORD_CHARACTER_PATTERN = /[\p{L}\p{N}_]/u;

export interface DetectedCurrency {
  readonly amount: number;
  readonly currencyCode: CurrencyCode;
  readonly originalText: string;
  readonly index: number;
}

export interface CurrencyDetectionOptions {
  readonly symbolOverrides?: Readonly<Record<string, CurrencyCode>> | undefined;
  readonly pageLocale?: string | undefined;
  readonly browserLocale?: string | undefined;
}

interface NumberSeparators {
  readonly decimal: string;
  readonly group: string;
}

type Placement = "currency-before" | "currency-after";
type TokenKind = "code" | "symbol";

interface DetectionPattern {
  readonly regex: RegExp;
  readonly placement: Placement;
  readonly tokenKind: TokenKind;
}

interface CandidateDetection extends DetectedCurrency {
  readonly amountStart: number;
  readonly amountEnd: number;
}

const detectionPatterns = buildDetectionPatterns();

/**
 * Detects at most three monetary amounts in source order.
 * Locale hints only influence ambiguous separators and symbols; the function has no browser-state dependency.
 */
export function detectCurrencies(
  text: string,
  options: CurrencyDetectionOptions = {},
): DetectedCurrency[] {
  const source = text.slice(0, MAX_SELECTION_LENGTH);
  const detections = detectionPatterns.flatMap((pattern) =>
    collectPatternMatches(source, pattern, options),
  );
  const uniqueDetections = new Map<string, CandidateDetection>();

  for (const detection of detections) {
    const key = `${detection.amountStart}:${detection.amountEnd}`;
    if (!uniqueDetections.has(key)) {
      uniqueDetections.set(key, detection);
    }
  }

  return [...uniqueDetections.values()]
    .toSorted((left, right) => left.amountStart - right.amountStart)
    .slice(0, MAX_DETECTED_AMOUNTS)
    .map(toDetectedCurrency);
}

/** Parses US, European, and space-grouped amount text using optional locale hints. */
export function parseMoneyAmount(
  amountText: string,
  options: Pick<CurrencyDetectionOptions, "pageLocale" | "browserLocale"> = {},
): number | null {
  const normalized = amountText.replace(GROUPING_SPACE_PATTERN, " ");
  if (!/^\d+(?:[., ]\d+)*$/u.test(normalized)) {
    return null;
  }

  const separators = getPreferredNumberSeparators(options);
  const decimalSeparator = determineDecimalSeparator(normalized, separators);
  if (decimalSeparator === undefined) {
    return null;
  }

  const normalizedNumber = normalizeGroupedNumber(normalized, decimalSeparator);
  if (normalizedNumber === null) {
    return null;
  }

  const amount = Number(normalizedNumber);
  return Number.isFinite(amount) ? amount : null;
}

/** Creates code and symbol patterns with longest tokens first to prevent suffix matches. */
function buildDetectionPatterns(): DetectionPattern[] {
  const codeSource = getCurrencyCodes()
    .map(escapeRegularExpression)
    .toSorted((left, right) => right.length - left.length)
    .join("|");
  const symbolSource = getCurrencySymbolDefinitions()
    .map((definition) => escapeRegularExpression(definition.token))
    .join("|");

  return [
    createDetectionPattern(codeSource, "currency-before", "code"),
    createDetectionPattern(codeSource, "currency-after", "code"),
    createDetectionPattern(symbolSource, "currency-before", "symbol"),
    createDetectionPattern(symbolSource, "currency-after", "symbol"),
  ];
}

/** Creates one reusable global pattern for a token kind and placement. */
function createDetectionPattern(
  tokenSource: string,
  placement: Placement,
  tokenKind: TokenKind,
): DetectionPattern {
  const source =
    placement === "currency-before"
      ? `(${tokenSource})\\s*(${NUMBER_SOURCE})`
      : `(${NUMBER_SOURCE})\\s*(${tokenSource})`;

  return { regex: new RegExp(source, "gu"), placement, tokenKind };
}

/** Collects and validates all matches produced by a single detection pattern. */
function collectPatternMatches(
  text: string,
  pattern: DetectionPattern,
  options: CurrencyDetectionOptions,
): CandidateDetection[] {
  const detections: CandidateDetection[] = [];
  pattern.regex.lastIndex = 0;

  for (let match = pattern.regex.exec(text); match; match = pattern.regex.exec(text)) {
    const detection = createDetection(text, match, pattern, options);
    if (detection) {
      detections.push(detection);
    }
  }

  return detections;
}

/** Converts a regex match into a validated detection or rejects a partial match. */
function createDetection(
  text: string,
  match: RegExpExecArray,
  pattern: DetectionPattern,
  options: CurrencyDetectionOptions,
): CandidateDetection | null {
  const first = match[1];
  const second = match[2];
  if (
    first === undefined ||
    second === undefined ||
    !isMatchBoundaryValid(text, match, pattern.placement)
  ) {
    return null;
  }

  const token = pattern.placement === "currency-before" ? first : second;
  const amountText = pattern.placement === "currency-before" ? second : first;
  const currencyCode = resolveCurrencyToken(token, pattern.tokenKind, options);
  const amount = parseMoneyAmount(amountText, options);

  if (currencyCode === undefined || amount === null || amount <= 0) {
    return null;
  }

  const amountStart =
    pattern.placement === "currency-before"
      ? match.index + match[0].length - amountText.length
      : match.index;

  return {
    amount,
    amountStart,
    amountEnd: amountStart + amountText.length,
    currencyCode,
    originalText: match[0],
    index: match.index,
  };
}

/** Removes private match-span metadata before returning the public detection contract. */
function toDetectedCurrency(candidate: CandidateDetection): DetectedCurrency {
  return {
    amount: candidate.amount,
    currencyCode: candidate.currencyCode,
    originalText: candidate.originalText,
    index: candidate.index,
  };
}

/** Ensures neither the currency token nor amount is a suffix of a longer token. */
function isMatchBoundaryValid(
  text: string,
  match: RegExpExecArray,
  placement: Placement,
): boolean {
  const start = match.index;
  const end = start + match[0].length;

  if (placement === "currency-before") {
    return isCurrencyStartBoundary(text, start) && isAmountEndBoundary(text, end);
  }

  return isAmountStartBoundary(text, start) && isCurrencyEndBoundary(text, end);
}

/** Rejects a currency token that begins inside a larger word-like token. */
function isCurrencyStartBoundary(text: string, start: number): boolean {
  const previous = text[start - 1];
  return previous === undefined || !WORD_CHARACTER_PATTERN.test(previous);
}

/** Rejects a currency token that ends inside a larger word-like token. */
function isCurrencyEndBoundary(text: string, end: number): boolean {
  const next = text[end];
  return next === undefined || !WORD_CHARACTER_PATTERN.test(next);
}

/** Rejects an amount whose beginning is a trailing fragment of another number. */
function isAmountStartBoundary(text: string, start: number): boolean {
  const previous = text[start - 1];
  if (previous === undefined) {
    return true;
  }
  if (WORD_CHARACTER_PATTERN.test(previous)) {
    return false;
  }
  return !/[.,]/u.test(previous) || !/\d/u.test(text[start - 2] ?? "");
}

/** Rejects an amount whose end is a leading fragment of another number or word. */
function isAmountEndBoundary(text: string, end: number): boolean {
  const next = text[end];
  if (next === undefined) {
    return true;
  }
  if (WORD_CHARACTER_PATTERN.test(next)) {
    return false;
  }
  return !/[.,]/u.test(next) || !/\d/u.test(text[end + 1] ?? "");
}

/** Resolves an explicit code or a locale-sensitive symbol to a supported currency. */
function resolveCurrencyToken(
  token: string,
  tokenKind: TokenKind,
  options: CurrencyDetectionOptions,
): CurrencyCode | undefined {
  if (tokenKind === "code") {
    return getCurrencyCodes().find((currencyCode) => currencyCode === token);
  }

  const definition = getCurrencySymbolDefinition(token);
  if (definition === undefined) {
    return undefined;
  }

  const override = options.symbolOverrides?.[token];
  if (override !== undefined && definition.currencyCodes.includes(override)) {
    return override;
  }

  for (const region of getLocaleRegions(options)) {
    const localeCurrency = definition.currencyCodes.find(
      (currencyCode) =>
        getCurrencyMetadata(currencyCode)?.countries.includes(region) === true,
    );
    if (localeCurrency !== undefined) {
      return localeCurrency;
    }
  }

  return definition.defaultCurrency;
}

/** Returns explicit locale regions first and likely regions only as fallback. */
function getLocaleRegions(options: CurrencyDetectionOptions): string[] {
  const locales = [options.pageLocale, options.browserLocale].filter(
    (locale): locale is string => Boolean(locale),
  );
  const explicitRegions = locales.flatMap((locale) => getLocaleRegion(locale, false));
  const likelyRegions = locales.flatMap((locale) => getLocaleRegion(locale, true));
  return [...new Set([...explicitRegions, ...likelyRegions])];
}

/** Reads a region from a locale, optionally maximizing language-only tags. */
function getLocaleRegion(locale: string, maximize: boolean): string[] {
  try {
    const parsedLocale = new Intl.Locale(locale);
    const region = maximize ? parsedLocale.maximize().region : parsedLocale.region;
    return region === undefined ? [] : [region];
  } catch {
    return [];
  }
}

/** Determines the preferred decimal and grouping separators from the first valid locale hint. */
function getPreferredNumberSeparators(
  options: Pick<CurrencyDetectionOptions, "pageLocale" | "browserLocale">,
): NumberSeparators | undefined {
  for (const locale of [options.pageLocale, options.browserLocale]) {
    if (locale === undefined || locale.length === 0) {
      continue;
    }

    try {
      const parts = new Intl.NumberFormat(locale).formatToParts(12_345.6);
      const decimal = parts.find((part) => part.type === "decimal")?.value;
      const group = parts.find((part) => part.type === "group")?.value;
      if (decimal !== undefined && group !== undefined) {
        return { decimal, group: group.replace(GROUPING_SPACE_PATTERN, " ") };
      }
    } catch {
      // An invalid page locale is only a hint, so the browser locale may still be used.
    }
  }

  return undefined;
}

/** Infers which punctuation character is decimal, preserving ambiguous locale behavior. */
function determineDecimalSeparator(
  amountText: string,
  preferred: NumberSeparators | undefined,
): "." | "," | null | undefined {
  const dotCount = countCharacter(amountText, ".");
  const commaCount = countCharacter(amountText, ",");

  if (dotCount > 0 && commaCount > 0) {
    return amountText.lastIndexOf(".") > amountText.lastIndexOf(",") ? "." : ",";
  }

  const separator = dotCount > 0 ? "." : commaCount > 0 ? "," : null;
  if (separator === null) {
    return null;
  }

  const count = separator === "." ? dotCount : commaCount;
  if (count > 1) {
    return normalizeGroupedInteger(amountText, separator) === null ? undefined : null;
  }

  const [integerPart = "", fractionPart = ""] = amountText.split(separator);
  if (amountText.includes(" ")) {
    return separator;
  }
  if (preferred?.decimal === separator) {
    return separator;
  }
  if (
    preferred?.group === separator &&
    normalizeGroupedInteger(amountText, separator) !== null
  ) {
    return null;
  }
  if (integerPart === "0") {
    return separator;
  }
  if (fractionPart.length === 3 && integerPart.length <= 3) {
    return null;
  }

  return separator;
}

/** Normalizes a validated grouped amount into JavaScript's dot-decimal representation. */
function normalizeGroupedNumber(
  amountText: string,
  decimalSeparator: "." | "," | null,
): string | null {
  const decimalIndex =
    decimalSeparator === null ? -1 : amountText.lastIndexOf(decimalSeparator);
  const integerPart = decimalIndex >= 0 ? amountText.slice(0, decimalIndex) : amountText;
  const fractionPart = decimalIndex >= 0 ? amountText.slice(decimalIndex + 1) : undefined;

  if (decimalSeparator !== null && countCharacter(amountText, decimalSeparator) !== 1) {
    return null;
  }
  if (fractionPart !== undefined && !/^\d+$/u.test(fractionPart)) {
    return null;
  }

  const normalizedInteger = normalizeGroupedInteger(integerPart);
  if (normalizedInteger === null) {
    return null;
  }

  return fractionPart === undefined
    ? normalizedInteger
    : `${normalizedInteger}.${fractionPart}`;
}

/** Validates one consistent thousands separator and removes it from an integer. */
function normalizeGroupedInteger(
  integerPart: string,
  expectedSeparator?: string,
): string | null {
  if (/^\d+$/u.test(integerPart)) {
    return integerPart;
  }

  const separators = [...new Set(integerPart.replace(/\d/gu, "").split(""))];
  if (separators.length !== 1) {
    return null;
  }

  const separator = separators[0];
  if (
    separator === undefined ||
    separator.length === 0 ||
    (expectedSeparator !== undefined && separator !== expectedSeparator)
  ) {
    return null;
  }

  const groupedPattern = new RegExp(
    `^\\d{1,3}(?:${escapeRegularExpression(separator)}\\d{3})+$`,
    "u",
  );
  return groupedPattern.test(integerPart) ? integerPart.split(separator).join("") : null;
}

/** Counts exact occurrences of one separator character. */
function countCharacter(value: string, character: string): number {
  return value.split(character).length - 1;
}

/** Escapes arbitrary currency tokens for use inside a regular-expression alternation. */
function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
