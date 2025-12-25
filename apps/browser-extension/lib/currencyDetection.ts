import { currencies, symbols } from "@cl/currency";

export interface DetectedCurrency {
  amount: number;
  currencyCode: string;
  originalText: string;
  index: number;
}

type CurrencyCode = string & { readonly brand: unique symbol };

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

function buildCurrencyCodeSet(): Set<string> {
  return new Set(currencies.map((c) => c.code));
}

const symbolToCodeMap = buildSymbolToCodeMap();
const currencyCodeSet = buildCurrencyCodeSet();

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

export function detectCurrencies(text: string, defaultConversions?: Record<string, CurrencyCode>): DetectedCurrency[] {
  const results: DetectedCurrency[] = [];

  if (text.length > 500) {
    text = text.slice(0, 500);
  }

  const patterns = [
    {
      regex: /([$¥€£₹₽₩฿₪₱₨₫₭₮₴₵₸₺₼₾₿؋֏৳៛])\s*([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]+)?)/g,
      type: "symbol-before" as const,
    },
    {
      regex: /([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]+)?)\s*([A-Z]{3})\b/g,
      type: "code-after" as const,
    },
    {
      regex: /([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]+)?)\s*([$¥€£₹₽₩฿₪₱₨₫₭₮₴₵₸₺₼₾₿؋֏৳៛])/g,
      type: "symbol-after" as const,
    },
    {
      regex: /([A-Z]{3})\s*([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]+)?)/g,
      type: "code-before" as const,
    },
  ];

  const seen = new Set<string>();

  for (const { regex, type } of patterns) {
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const matchKey = `${match.index}-${match[0]}`;
      if (seen.has(matchKey)) {
        continue;
      }
      seen.add(matchKey);

      let currencyCode: string | undefined;
      let amountStr: string;

      if (type === "symbol-before") {
        const symbol = match[1];
        amountStr = match[2];
        currencyCode = defaultConversions?.[symbol] || symbolToCodeMap.get(symbol);
      } else if (type === "code-after") {
        amountStr = match[1];
        const code = match[2];
        if (currencyCodeSet.has(code)) {
          currencyCode = code;
        }
      } else if (type === "symbol-after") {
        amountStr = match[1];
        const symbol = match[2];
        currencyCode = defaultConversions?.[symbol] || symbolToCodeMap.get(symbol);
      } else if (type === "code-before") {
        const code = match[1];
        amountStr = match[2];
        if (currencyCodeSet.has(code)) {
          currencyCode = code;
        }
      }

      if (!currencyCode) {
        continue;
      }

      const amount = normalizeAmount(amountStr);
      if (amount === null || amount <= 0) {
        continue;
      }

      results.push({
        amount,
        currencyCode,
        originalText: match[0],
        index: match.index,
      });
    }
  }

  return results.sort((a, b) => a.index - b.index);
}
