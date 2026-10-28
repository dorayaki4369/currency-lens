import type { CurrencyCode } from "@cl/currency";
import {
  getCurrencyCodes,
  getCurrencyMetadata,
  getCurrencySymbolDefinition,
  getCurrencySymbolDefinitions,
} from "@/lib/currency";
import {
  getCurrencyLocalNameDefinition,
  getCurrencyLocalNameDefinitions,
} from "@/lib/currency-local-names";
import {
  getMagnitudeTokens,
  resolveMagnitude,
  type Magnitude,
} from "@/lib/amount-magnitudes";

export const MAX_DETECTED_AMOUNTS = 3;

const MAX_SELECTION_LENGTH = 1_000;
const NUMBER_SOURCE = String.raw`\p{Nd}+(?:[.,\u00A0\u202F\u2009 ]\p{Nd}+)*`;
// Scripts that join words without spaces, so a neighboring letter does not extend a token.
const UNSPACED_SCRIPT_SOURCE = String.raw`[\p{Script_Extensions=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]`;
// Enough for Korean amounts that combine six magnitudes, such as "1조 2천억 3천만 4천".
const MAX_ADDITIONAL_MAGNITUDES = 8;
const MAGNITUDE_SOURCE = buildMagnitudeSource();
// A number optionally followed by magnitudes, such as "5", "1.5 million", or "3億5000万".
// The bounded repetition keeps backtracking linear for long selections that repeat a magnitude.
const AMOUNT_SOURCE = String.raw`${NUMBER_SOURCE}(?:\s?${MAGNITUDE_SOURCE}(?:\s?(?:${NUMBER_SOURCE}\s?)?${MAGNITUDE_SOURCE}){0,${MAX_ADDITIONAL_MAGNITUDES}}(?:${NUMBER_SOURCE})?)?`;
const AMOUNT_PART_PATTERN = new RegExp(`(${NUMBER_SOURCE})|(${MAGNITUDE_SOURCE})`, "gu");
const GROUPING_SPACE_PATTERN = /[\u00A0\u202F\u2009 ]/gu;
const WORD_CHARACTER_PATTERN = /[\p{L}\p{N}_]/u;
const DIGIT_PATTERN = /\p{N}/u;
const KATAKANA_PATTERN = /\p{Script_Extensions=Katakana}/u;
const UNSPACED_SCRIPT_PATTERN = new RegExp(UNSPACED_SCRIPT_SOURCE, "u");
const DECIMAL_DIGIT_SETS = [
  "0123456789",
  "٠١٢٣٤٥٦٧٨٩",
  "۰۱۲۳۴۵۶۷۸۹",
  "०१२३४५६७८९",
  "০১২৩৪৫৬৭৮৯",
  "༠༡༢༣༤༥༦༧༨༩",
  "၀၁၂၃၄၅၆၇၈၉",
] as const;

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
type TokenKind = "code" | "local-name" | "symbol";

interface DetectionPattern {
  readonly regex: RegExp;
  readonly placement: Placement;
  readonly tokenKind: TokenKind;
}

interface ScaledTerm {
  readonly value: string;
  readonly exponent: number;
}

interface ScaledAmountState {
  readonly completedTerms: ScaledTerm[];
  groupTerms: ScaledTerm[];
  pendingNumber: string | null;
  lastGroupExponent: number;
  lastWithinGroupExponent: number;
}

interface CandidateDetection extends DetectedCurrency {
  readonly amountStart: number;
  readonly amountEnd: number;
}

const detectionPatterns = buildDetectionPatterns();

/**
 * Detects at most three monetary amounts in source order for pure parsing callers.
 * Locale hints only influence ambiguous separators, symbols, and local names.
 * The function has no browser-state dependency.
 */
export function detectCurrencies(
  text: string,
  options: CurrencyDetectionOptions = {},
): DetectedCurrency[] {
  const source = text.slice(0, MAX_SELECTION_LENGTH);
  const detections = detectionPatterns.flatMap((pattern) =>
    collectPatternMatches(source, pattern, options),
  );
  const orderedDetections = detections.toSorted(
    (left, right) =>
      left.amountStart - right.amountStart || right.amountEnd - left.amountEnd,
  );
  const acceptedDetections: CandidateDetection[] = [];

  // Pattern priority breaks ties, and the longest amount wins over overlapping fragments such as "5" in "$5K".
  for (const detection of orderedDetections) {
    const previous = acceptedDetections.at(-1);
    if (previous === undefined || detection.amountStart >= previous.amountEnd) {
      acceptedDetections.push(detection);
    }
  }

  return acceptedDetections.slice(0, MAX_DETECTED_AMOUNTS).map(toDetectedCurrency);
}

/** Parses US, European, and space-grouped amount text using optional locale hints. */
export function parseMoneyAmount(
  amountText: string,
  options: Pick<CurrencyDetectionOptions, "pageLocale" | "browserLocale"> = {},
): number | null {
  const normalizedNumber = normalizeMoneyNumber(amountText, options);
  if (normalizedNumber === null) {
    return null;
  }

  const amount = Number(normalizedNumber);
  return Number.isFinite(amount) ? amount : null;
}

/**
 * Builds the magnitude alternation, requiring a word boundary after spaced words.
 * The boundary appears once per group because each Unicode property class enlarges the
 * compiled pattern, and repeating it per token made the first detection take about a second.
 */
function buildMagnitudeSource(): string {
  const tokens = getMagnitudeTokens().toSorted(
    (left, right) => right.token.length - left.token.length,
  );
  const spacedSource = tokens
    .filter(({ spaced }) => spaced)
    .map(({ token }) => escapeRegularExpression(token))
    .join("|");
  const attachedSource = tokens
    .filter(({ spaced }) => !spaced)
    .map(({ token }) => escapeRegularExpression(token))
    .join("|");
  // A spaced word may still touch an unspaced script, as in "5k円".
  return String.raw`(?:(?:${spacedSource})(?!(?!${UNSPACED_SCRIPT_SOURCE})[\p{L}\p{M}\p{N}_])|${attachedSource})`;
}

/** Converts separator-grouped amount text into a dot-decimal string without rounding. */
function normalizeMoneyNumber(
  amountText: string,
  options: Pick<CurrencyDetectionOptions, "pageLocale" | "browserLocale">,
): string | null {
  const normalized = normalizeDecimalDigits(amountText).replace(
    GROUPING_SPACE_PATTERN,
    " ",
  );
  if (!/^\d+(?:[., ]\d+)*$/u.test(normalized)) {
    return null;
  }

  const separators = getPreferredNumberSeparators(options);
  const decimalSeparator = determineDecimalSeparator(normalized, separators);
  if (decimalSeparator === undefined) {
    return null;
  }

  return normalizeGroupedNumber(normalized, decimalSeparator);
}

/**
 * Parses an amount that may contain magnitudes, such as "1.5 million" or "3億5千万".
 * Group magnitudes must descend, and within-group magnitudes must descend inside a group.
 */
function parseScaledAmount(
  amountText: string,
  options: CurrencyDetectionOptions,
): number | null {
  const language = getPrimaryLanguage(options);
  const state: ScaledAmountState = {
    completedTerms: [],
    groupTerms: [],
    pendingNumber: null,
    lastGroupExponent: Number.POSITIVE_INFINITY,
    lastWithinGroupExponent: Number.POSITIVE_INFINITY,
  };

  for (const [, numberText, magnitudeText] of amountText.matchAll(AMOUNT_PART_PATTERN)) {
    if (numberText !== undefined) {
      state.pendingNumber = normalizeMoneyNumber(numberText, options);
      if (state.pendingNumber === null) {
        return null;
      }
    } else if (!applyMagnitude(state, resolveMagnitude(magnitudeText!, language))) {
      return null;
    }
  }

  if (state.pendingNumber !== null) {
    state.groupTerms.push({ value: state.pendingNumber, exponent: 0 });
  }

  // Exponent notation shifts the decimal point exactly, so "1.1" and 8 become 110000000.
  const amount = [...state.completedTerms, ...state.groupTerms].reduce(
    (sum, term) => sum + Number(`${term.value}e${term.exponent}`),
    0,
  );
  return Number.isFinite(amount) ? amount : null;
}

/** Applies one magnitude to the pending number, returning false for an out-of-order amount. */
function applyMagnitude(state: ScaledAmountState, magnitude: Magnitude): boolean {
  if (magnitude.rank === "within-group") {
    if (
      state.pendingNumber === null ||
      magnitude.exponent >= state.lastWithinGroupExponent ||
      magnitude.exponent >= state.lastGroupExponent
    ) {
      return false;
    }
    state.groupTerms.push({ value: state.pendingNumber, exponent: magnitude.exponent });
    state.lastWithinGroupExponent = magnitude.exponent;
    state.pendingNumber = null;
    return true;
  }

  if (state.pendingNumber !== null) {
    state.groupTerms.push({ value: state.pendingNumber, exponent: 0 });
  }
  if (state.groupTerms.length === 0 || magnitude.exponent >= state.lastGroupExponent) {
    return false;
  }
  state.completedTerms.push(
    ...state.groupTerms.map((term) => ({
      value: term.value,
      exponent: term.exponent + magnitude.exponent,
    })),
  );
  state.groupTerms = [];
  state.pendingNumber = null;
  state.lastGroupExponent = magnitude.exponent;
  state.lastWithinGroupExponent = Number.POSITIVE_INFINITY;
  return true;
}

/** Returns the language of the first valid locale hint for long-scale magnitudes. */
function getPrimaryLanguage(options: CurrencyDetectionOptions): string | undefined {
  for (const locale of [options.pageLocale, options.browserLocale]) {
    if (locale === undefined || locale.length === 0) {
      continue;
    }

    try {
      return new Intl.Locale(locale).language;
    } catch {
      // An invalid page locale is only a hint, so the browser locale may still be used.
    }
  }

  return undefined;
}

/** Creates code, symbol, and local-name patterns with longest tokens first. */
function buildDetectionPatterns(): DetectionPattern[] {
  const codeSource = getCurrencyCodes()
    .map(escapeRegularExpression)
    .toSorted((left, right) => right.length - left.length)
    .join("|");
  const symbolSource = getCurrencySymbolDefinitions()
    .map((definition) => escapeRegularExpression(definition.token))
    .join("|");
  const localNameSource = getCurrencyLocalNameDefinitions()
    .map((definition) => escapeRegularExpression(definition.token))
    .toSorted((left, right) => right.length - left.length)
    .join("|");

  return [
    createDetectionPattern(codeSource, "currency-before", "code"),
    createDetectionPattern(codeSource, "currency-after", "code"),
    createDetectionPattern(localNameSource, "currency-before", "local-name"),
    createDetectionPattern(localNameSource, "currency-after", "local-name"),
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
      ? `(${tokenSource})\\s*(${AMOUNT_SOURCE})`
      : `(${AMOUNT_SOURCE})\\s*(${tokenSource})`;

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
    !isMatchBoundaryValid(text, match, pattern)
  ) {
    return null;
  }

  const token = pattern.placement === "currency-before" ? first : second;
  const amountText = pattern.placement === "currency-before" ? second : first;
  const currencyCode = resolveCurrencyToken(token, pattern.tokenKind, options);
  const amount = parseScaledAmount(amountText, options);

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

/** Ensures neither the currency token nor amount is a fragment of a longer token. */
function isMatchBoundaryValid(
  text: string,
  match: RegExpExecArray,
  pattern: DetectionPattern,
): boolean {
  const start = match.index;
  const end = start + match[0].length;
  const previous = text[start - 1];
  const next = text[end];
  const isEndValid = isWordBoundary(next, match[0].at(-1)!);

  // A local name such as 元 before an amount may be the end of a word, as in 紀元2000年.
  if (pattern.placement === "currency-before" && pattern.tokenKind === "local-name") {
    return isStrictWordBoundary(previous) && isEndValid;
  }

  return isWordBoundary(previous, match[0][0]!) && isEndValid;
}

/**
 * Accepts a neighbor that separates words. Scripts written without spaces, such as
 * Japanese, Chinese, and Thai, may touch a match, as in 価格は500円です, except where
 * Katakana continues a Katakana token, as in 100ドルショップ.
 */
function isWordBoundary(neighbor: string | undefined, edge: string): boolean {
  if (isStrictWordBoundary(neighbor)) {
    return true;
  }
  if (DIGIT_PATTERN.test(neighbor!)) {
    return false;
  }
  if (KATAKANA_PATTERN.test(neighbor!) && KATAKANA_PATTERN.test(edge)) {
    return false;
  }

  return UNSPACED_SCRIPT_PATTERN.test(neighbor!) || UNSPACED_SCRIPT_PATTERN.test(edge);
}

/** Accepts only the start or end of text, whitespace, and punctuation as a boundary. */
function isStrictWordBoundary(neighbor: string | undefined): boolean {
  return neighbor === undefined || !WORD_CHARACTER_PATTERN.test(neighbor);
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

  if (tokenKind === "local-name") {
    // Local-name patterns are built exclusively from this table, so every match has a definition.
    const definition = getCurrencyLocalNameDefinition(token)!;

    for (const region of getLocaleRegions(options)) {
      const localeCurrency = definition.currencies.find((currency) =>
        currency.regions.includes(region),
      );
      if (localeCurrency !== undefined) {
        return localeCurrency.code;
      }
    }

    return definition.defaultCurrency;
  }

  // Symbol patterns are built exclusively from this table, so every match has a definition.
  const definition = getCurrencySymbolDefinition(token)!;

  const override = options.symbolOverrides?.[token];
  if (override !== undefined && definition.currencyCodes.includes(override)) {
    return override;
  }

  for (const region of getLocaleRegions(options)) {
    const localeCurrency = definition.currencyCodes.find((currencyCode) =>
      getCurrencyMetadata(currencyCode).countries.includes(region),
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
  if (dotCount === 0 && commaCount === 0) {
    return null;
  }

  const separator = dotCount > 0 ? "." : ",";
  const count = separator === "." ? dotCount : commaCount;
  if (count > 1) {
    return normalizeGroupedInteger(amountText) === null ? undefined : null;
  }

  return determineSingleDecimalSeparator(amountText, separator, preferred);
}

/** Resolves one punctuation mark using locale hints and common grouping conventions. */
function determineSingleDecimalSeparator(
  amountText: string,
  separator: "." | ",",
  preferred: NumberSeparators | undefined,
): "." | "," | null {
  const [integerPart = "", fractionPart = ""] = amountText.split(separator);
  if (amountText.includes(" ")) {
    return separator;
  }
  if (preferred?.decimal === separator) {
    return separator;
  }
  if (preferred?.group === separator && normalizeGroupedInteger(amountText) !== null) {
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

  const normalizedInteger = normalizeGroupedInteger(integerPart);
  if (normalizedInteger === null) {
    return null;
  }

  return fractionPart === undefined
    ? normalizedInteger
    : `${normalizedInteger}.${fractionPart}`;
}

/** Validates one consistent thousands separator and removes it from an integer. */
function normalizeGroupedInteger(integerPart: string): string | null {
  if (/^\d+$/u.test(integerPart)) {
    return integerPart;
  }

  const separators = [...new Set(integerPart.replace(/\d/gu, "").split(""))];
  if (separators.length !== 1) {
    return null;
  }

  const separator = separators[0]!;

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

/** Converts decimal digits used by sandbox locales to their ASCII equivalents. */
function normalizeDecimalDigits(value: string): string {
  return Array.from(value)
    .map((character) => {
      for (const digits of DECIMAL_DIGIT_SETS) {
        const digit = digits.indexOf(character);
        if (digit >= 0) {
          return String(digit);
        }
      }
      return character;
    })
    .join("");
}

/** Escapes arbitrary currency tokens for use inside a regular-expression alternation. */
function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
