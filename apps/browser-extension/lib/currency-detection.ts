import { currencies, symbols } from "@cl/currency";
import type { CurrencyCode } from "@cl/currency";

export interface DetectedCurrency {
  amount: number;
  currencyCode: CurrencyCode;
  originalText: string;
  index: number;
}

type MatchType = "symbol-before" | "code-after" | "symbol-after" | "code-before";

/**
 * 通貨シンボルから通貨コードへのマップを構築する
 */
function buildSymbolToCodeMap(): Map<string, string> {
  const map = new Map<string, string>();

  for (const symbolData of symbols) {
    map.set(symbolData.symbol, symbolData.default as string);
    for (const alt of symbolData.alternatives) {
      map.set(alt, symbolData.default as string);
    }
  }

  return map;
}

/**
 * 有効な通貨コードのセットを構築する
 */
function buildCurrencyCodeSet(): Set<string> {
  return new Set(currencies.map((c) => c.code));
}

const symbolToCodeMap = buildSymbolToCodeMap();
const currencyCodeSet = buildCurrencyCodeSet();

/**
 * 金額文字列を数値に変換する。無効な場合は null を返す
 */
function normalizeAmount(amountStr: string): number | null {
  const normalized = amountStr.replace(/,/g, "").replace(/\s/g, "");

  const dotCount = (normalized.match(/\./g) || []).length;
  if (dotCount > 1) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);

  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

/**
 * 通貨シンボルから通貨コードを解決する
 */
function resolveSymbol(symbol: string, defaultConversions?: Record<string, CurrencyCode>): string | undefined {
  return defaultConversions?.[symbol] ?? symbolToCodeMap.get(symbol);
}

/**
 * マッチタイプに応じて通貨コードと金額文字列を抽出する
 */
function extractCurrencyCodeAndAmount(
  type: MatchType,
  match: RegExpExecArray,
  defaultConversions?: Record<string, CurrencyCode>,
): { currencyCode: string | undefined; amountStr: string } {
  if (type === "symbol-before") {
    return { currencyCode: resolveSymbol(match[1], defaultConversions), amountStr: match[2] };
  }
  if (type === "code-after") {
    const currencyCode = currencyCodeSet.has(match[2]) ? match[2] : undefined;
    return { currencyCode, amountStr: match[1] };
  }
  if (type === "symbol-after") {
    return { currencyCode: resolveSymbol(match[2], defaultConversions), amountStr: match[1] };
  }
  // code-before
  const currencyCode = currencyCodeSet.has(match[1]) ? match[1] : undefined;
  return { currencyCode, amountStr: match[2] };
}

/**
 * 1つの正規表現マッチから DetectedCurrency を生成する。無効な場合は null を返す
 */
function toDetectedCurrency(
  match: RegExpExecArray,
  type: MatchType,
  defaultConversions?: Record<string, CurrencyCode>,
): DetectedCurrency | null {
  const { currencyCode, amountStr } = extractCurrencyCodeAndAmount(type, match, defaultConversions);
  if (!currencyCode) return null;

  const amount = normalizeAmount(amountStr);
  if (amount === null || amount <= 0) return null;

  return { amount, currencyCode: currencyCode as CurrencyCode, originalText: match[0], index: match.index };
}

/**
 * 1つのパターンに対してテキスト内の全マッチを収集する
 */
function collectPatternMatches(
  regex: RegExp,
  text: string,
  type: MatchType,
  seen: Set<string>,
  defaultConversions?: Record<string, CurrencyCode>,
): DetectedCurrency[] {
  const results: DetectedCurrency[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const matchKey = `${match.index}-${match[0]}`;
    if (!seen.has(matchKey)) {
      seen.add(matchKey);
      const detected = toDetectedCurrency(match, type, defaultConversions);
      if (detected) results.push(detected);
    }
  }

  return results;
}

/**
 * テキストから通貨情報を検出する
 *
 * @param text - 検出対象のテキスト
 * @param defaultConversions - シンボルから通貨コードへのデフォルトマッピング
 * @returns 検出された通貨情報のリスト（出現順）
 */
export function detectCurrencies(text: string, defaultConversions?: Record<string, CurrencyCode>): DetectedCurrency[] {
  const normalizedText = text.length > 500 ? text.slice(0, 500) : text;
  const seen = new Set<string>();

  const patterns = [
    {
      regex: /([$¥€£₹₽₩฿₪₱₨₫₭₮₴₵₸₺₼₾₿؋֏৳៛])\s*(\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?)/g,
      type: "symbol-before" as const,
    },
    {
      regex: /(\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?)\s*([A-Z]{3})\b/g,
      type: "code-after" as const,
    },
    {
      regex: /(\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?)\s*([$¥€£₹₽₩฿₪₱₨₫₭₮₴₵₸₺₼₾₿؋֏৳៛])/g,
      type: "symbol-after" as const,
    },
    {
      regex: /([A-Z]{3})\s*(\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?)/g,
      type: "code-before" as const,
    },
  ];

  const results = patterns.flatMap(({ regex, type }) =>
    collectPatternMatches(regex, normalizedText, type, seen, defaultConversions),
  );

  return results.sort((a, b) => a.index - b.index);
}
