import { describe, expect, it } from "vitest";
import { currencyLocalNames } from "@cl/currency";
import { currencyCodeSchema } from "@/lib/currency";
import { detectCurrencies, parseMoneyAmount } from "@/lib/currency-detection";

describe("parseMoneyAmount", () => {
  it("parses US and European separators from explicit page locales", () => {
    expect(parseMoneyAmount("1,234.56", { pageLocale: "en-US" })).toBe(1_234.56);
    expect(parseMoneyAmount("1.234,56", { pageLocale: "de-DE" })).toBe(1_234.56);
    expect(parseMoneyAmount("1.234", { pageLocale: "de-DE" })).toBe(1_234);
    expect(parseMoneyAmount("1,234", { pageLocale: "de-DE" })).toBe(1.234);
  });

  it("parses regular, non-breaking, and narrow-space grouping", () => {
    expect(parseMoneyAmount("1 234,50", { pageLocale: "fr-FR" })).toBe(1_234.5);
    expect(parseMoneyAmount("1\u00A0234,50", { pageLocale: "fr-FR" })).toBe(1_234.5);
    expect(parseMoneyAmount("1\u202F234.50", { pageLocale: "en-US" })).toBe(1_234.5);
  });

  it("rejects malformed grouping instead of parsing a trailing fragment", () => {
    expect(parseMoneyAmount("1,23,456", { pageLocale: "en-US" })).toBeNull();
    expect(parseMoneyAmount("12 34,56", { pageLocale: "fr-FR" })).toBeNull();
  });

  it("rejects non-money text, mixed grouping, and numeric overflow", () => {
    expect(parseMoneyAmount("12 dollars")).toBeNull();
    expect(parseMoneyAmount("1 234,567.89")).toBeNull();
    expect(parseMoneyAmount("9".repeat(400))).toBeNull();
  });

  it("infers unambiguous decimals and conventional three-digit grouping", () => {
    expect(parseMoneyAmount("0.5")).toBe(0.5);
    expect(parseMoneyAmount("1234.56")).toBe(1_234.56);
    expect(parseMoneyAmount("1,234")).toBe(1_234);
    expect(parseMoneyAmount("1,234,567")).toBe(1_234_567);
    expect(parseMoneyAmount("1,234", { pageLocale: "en-US" })).toBe(1_234);
  });

  it("ignores invalid locale hints and tries the next locale", () => {
    expect(
      parseMoneyAmount("1,25", { pageLocale: "not_a_locale", browserLocale: "de-DE" }),
    ).toBe(1.25);
  });
});

describe("detectCurrencies", () => {
  it("detects every local-language amount supported by the currency package", () => {
    for (const currency of currencyLocalNames) {
      for (const localName of currency.names) {
        for (const locale of localName.locales) {
          expect(
            detectCurrencies(localName.sample, { pageLocale: locale }),
            `${currency.code}: ${localName.sample} (${locale})`,
          ).toMatchObject([
            {
              amount: 100,
              currencyCode: currency.code,
              originalText: localName.sample,
            },
          ]);
        }
      }
    }
  });

  it("uses the documented default when a local unit name has no locale hint", () => {
    expect(detectCurrencies("100 dollars")).toMatchObject([
      { amount: 100, currencyCode: "AUD", originalText: "100 dollars" },
    ]);
    expect(detectCurrencies("100 dollars", { pageLocale: "ja-JP" })).toMatchObject([
      { amount: 100, currencyCode: "AUD", originalText: "100 dollars" },
    ]);
  });

  it("detects code and symbol forms before and after amounts", () => {
    const detected = detectCurrencies("USD 1,234.56; 2.345,67 EUR; £3 456.78", {
      pageLocale: "en-US",
    });

    expect(detected.map(({ amount, currencyCode }) => ({ amount, currencyCode }))).toEqual([
      { amount: 1_234.56, currencyCode: "USD" },
      { amount: 2_345.67, currencyCode: "EUR" },
      { amount: 3_456.78, currencyCode: "GBP" },
    ]);
  });

  it("matches multi-character symbols before shorter suffix symbols", () => {
    const detected = detectCurrencies("R$ 1.234,56; 1\u202F234,00 zł; CA$100", {
      pageLocale: "pt-BR",
    });

    expect(detected.map(({ amount, currencyCode }) => ({ amount, currencyCode }))).toEqual([
      { amount: 1_234.56, currencyCode: "BRL" },
      { amount: 1_234, currencyCode: "PLN" },
      { amount: 100, currencyCode: "CAD" },
    ]);
  });

  it("detects country-qualified dollar symbols instead of their shorter suffix", () => {
    const detected = detectCurrencies("US$100; CA$200; AU$300");

    expect(
      detected.map(({ amount, currencyCode, originalText }) => ({
        amount,
        currencyCode,
        originalText,
      })),
    ).toEqual([
      { amount: 100, currencyCode: "USD", originalText: "US$100" },
      { amount: 200, currencyCode: "CAD", originalText: "CA$200" },
      { amount: 300, currencyCode: "AUD", originalText: "AU$300" },
    ]);
  });

  it("detects common Asia-Pacific dollar symbols", () => {
    expect(
      detectCurrencies("A$100; HK$200; NZ$300").map(({ currencyCode }) => currencyCode),
    ).toEqual(["AUD", "HKD", "NZD"]);
    expect(
      detectCurrencies("S$100; SG$200").map(({ currencyCode }) => currencyCode),
    ).toEqual(["SGD", "SGD"]);
  });

  it("resolves the ambiguous C$ symbol by locale and user override", () => {
    expect(detectCurrencies("C$100", { pageLocale: "en-CA" })[0]?.currencyCode).toBe("CAD");
    expect(detectCurrencies("C$100", { pageLocale: "es-NI" })[0]?.currencyCode).toBe("NIO");

    const symbolOverrides = { C$: currencyCodeSchema.parse("NIO") };
    expect(
      detectCurrencies("C$100", { pageLocale: "en-CA", symbolOverrides })[0]?.currencyCode,
    ).toBe("NIO");
  });

  it("does not accept suffix fragments of longer codes, symbols, or malformed amounts", () => {
    expect(detectCurrencies("NOTUSD 100; 100 money; 1,23,456 USD; invoice123 USD")).toEqual(
      [],
    );
  });

  it("accepts an amount at the start and rejects word-adjacent amount endings", () => {
    expect(detectCurrencies("100 USD")[0]).toMatchObject({
      amount: 100,
      currencyCode: "USD",
    });
    expect(detectCurrencies("USD 100items")).toEqual([]);
  });

  it("rejects zero-valued detections", () => {
    expect(detectCurrencies("USD 0; 0 EUR")).toEqual([]);
  });

  it("uses page and browser regions to resolve ambiguous symbols", () => {
    expect(
      detectCurrencies("$1,234.56", { pageLocale: "en-CA", browserLocale: "en-US" })[0]
        ?.currencyCode,
    ).toBe("CAD");
    expect(
      detectCurrencies("$1,234.56", { pageLocale: "en", browserLocale: "en-AU" })[0]
        ?.currencyCode,
    ).toBe("AUD");
  });

  it("ignores invalid locale tags when resolving an ambiguous symbol", () => {
    expect(detectCurrencies("$10", { pageLocale: "not_a_locale" })[0]?.currencyCode).toBe(
      "USD",
    );
  });

  it("gives a valid symbol override precedence over locale inference", () => {
    const symbolOverrides = { $: currencyCodeSchema.parse("NZD") };
    expect(
      detectCurrencies("$25.00", { pageLocale: "en-US", symbolOverrides })[0]?.currencyCode,
    ).toBe("NZD");
  });

  it("prefers an explicit code when symbol and code surround the same amount", () => {
    expect(detectCurrencies("$100 CAD", { pageLocale: "en-US" })).toEqual([
      {
        amount: 100,
        currencyCode: "CAD",
        index: 1,
        originalText: "100 CAD",
      },
    ]);
  });

  it.each([
    ["5万円", "ja-JP", 50_000, "JPY"],
    ["1.5万円", "ja-JP", 15_000, "JPY"],
    ["3億円", "ja-JP", 300_000_000, "JPY"],
    ["2兆円", "ja-JP", 2_000_000_000_000, "JPY"],
    ["3億5000万円", "ja-JP", 350_000_000, "JPY"],
    ["1億2千万円", "ja-JP", 120_000_000, "JPY"],
    ["1万5000円", "ja-JP", 15_000, "JPY"],
    ["1万 5000円", "ja-JP", 15_000, "JPY"],
    ["USD 1万 5000", "ja-JP", 15_000, "USD"],
    ["1만 5000원", "ko-KR", 15_000, "KRW"],
    ["5千円", "ja-JP", 5_000, "JPY"],
    ["3百万円", "ja-JP", 3_000_000, "JPY"],
    ["¥5万", "ja-JP", 50_000, "JPY"],
    ["JPY 1.1億", "ja-JP", 110_000_000, "JPY"],
    ["5万元", "zh-CN", 50_000, "CNY"],
    ["3亿元", "zh-CN", 300_000_000, "CNY"],
    ["1.2萬港元", "zh-HK", 12_000, "HKD"],
    ["5만원", "ko-KR", 50_000, "KRW"],
    ["3억 5천만 원", "ko-KR", 350_000_000, "KRW"],
    ["₩1조", "ko-KR", 1_000_000_000_000, "KRW"],
    ["1조 2천억 3천만 4천 원", "ko-KR", 1_200_030_004_000, "KRW"],
    ["$1 million", "en-US", 1_000_000, "USD"],
    ["$1.5 billion", "en-US", 1_500_000_000, "USD"],
    ["$1 Billion", "en-US", 1_000_000_000, "USD"],
    ["$2 trillion", "en-US", 2_000_000_000_000, "USD"],
    ["USD 10 thousand", "en-US", 10_000, "USD"],
    ["$5k", "en-US", 5_000, "USD"],
    ["$5K", "en-US", 5_000, "USD"],
    ["$2.5M", "en-US", 2_500_000, "USD"],
    ["$3bn", "en-US", 3_000_000_000, "USD"],
    ["$5 mil", "en-US", 5_000, "USD"],
    ["USD 2 million 500 thousand", "en-US", 2_500_000, "USD"],
    ["₹5 lakh", "en-IN", 500_000, "INR"],
    ["₹2 crore", "en-IN", 20_000_000, "INR"],
    ["5 लाख ₹", "hi-IN", 500_000, "INR"],
    ["3 Mio. €", "de-DE", 3_000_000, "EUR"],
    ["1,5 Mrd. EUR", "de-DE", 1_500_000_000, "EUR"],
    ["1 Billion EUR", "de-DE", 1_000_000_000_000, "EUR"],
    ["2 milliards €", "fr-FR", 2_000_000_000, "EUR"],
    ["1 billion €", "fr-FR", 1_000_000_000_000, "EUR"],
    ["5 M€", "fr-FR", 5_000_000, "EUR"],
    ["€3 millones", "es-ES", 3_000_000, "EUR"],
    ["USD 2 mil millones", "es-MX", 2_000_000_000, "USD"],
    ["1 billón USD", "es-MX", 1_000_000_000_000, "USD"],
    ["R$ 5 milhões", "pt-BR", 5_000_000, "BRL"],
    ["R$ 2 bilhões", "pt-BR", 2_000_000_000, "BRL"],
    ["€2 milioni", "it-IT", 2_000_000, "EUR"],
    ["5 miliardi EUR", "it-IT", 5_000_000_000, "EUR"],
    ["€3 miljoen", "nl-NL", 3_000_000, "EUR"],
    ["₽5 млн", "ru-RU", 5_000_000, "RUB"],
    ["10 тыс. ₽", "ru-RU", 10_000, "RUB"],
    ["5 mln zł", "pl-PL", 5_000_000, "PLN"],
    ["₺5 milyon", "tr-TR", 5_000_000, "TRY"],
    ["Rp 5 juta", "id-ID", 5_000_000, "IDR"],
    ["5 triệu đồng", "vi-VN", 5_000_000, "VND"],
    ["5ล้านบาท", "th-TH", 5_000_000, "THB"],
    ["5 مليون درهم", "ar-AE", 5_000_000, "AED"],
  ])("detects the magnitude word in %s (%s)", (text, pageLocale, amount, currencyCode) => {
    expect(detectCurrencies(text, { pageLocale })).toMatchObject([
      { amount, currencyCode, originalText: text },
    ]);
  });

  it.each([
    ["5万ドル", 50_000, "USD"],
    ["1.5万米ドル", 15_000, "USD"],
    ["3億5000万ユーロ", 350_000_000, "EUR"],
    ["5千ポンド", 5_000, "GBP"],
    ["10万豪ドル", 100_000, "AUD"],
    ["2億人民元", 200_000_000, "CNY"],
    ["5万USD", 50_000, "USD"],
    ["USD 5千", 5_000, "USD"],
    ["5k円", 5_000, "JPY"],
    ["1.5M円", 1_500_000, "JPY"],
    ["3 millionドル", 3_000_000, "USD"],
  ])("combines any magnitude with any currency in %s", (text, amount, currencyCode) => {
    expect(detectCurrencies(text, { pageLocale: "ja-JP" })).toMatchObject([
      { amount, currencyCode, originalText: text },
    ]);
  });

  it.each([
    ["価格は500円です", "ja-JP", 500, "JPY", "500円"],
    ["約5万円です", "ja-JP", 50_000, "JPY", "5万円"],
    ["価格は¥500です", "ja-JP", 500, "JPY", "¥500"],
    ["3000円以上で送料無料", "ja-JP", 3_000, "JPY", "3000円"],
    ["100円OFF", "ja-JP", 100, "JPY", "100円"],
    ["5万ドルを送金", "ja-JP", 50_000, "USD", "5万ドル"],
    ["单价USD100起", "zh-CN", 100, "USD", "USD100"],
    ["价格500元起", "zh-CN", 500, "CNY", "500元"],
    ["가격은 5000원이에요", "ko-KR", 5_000, "KRW", "5000원"],
    ["ราคา500บาท", "th-TH", 500, "THB", "500บาท"],
    ["100円abc", "ja-JP", 100, "JPY", "100円"],
    ["ショップ100ドル", "ja-JP", 100, "USD", "100ドル"],
  ])(
    "detects %s between words of a script written without spaces",
    (text, pageLocale, amount, currencyCode, originalText) => {
      expect(detectCurrencies(text, { pageLocale })).toMatchObject([
        { amount, currencyCode, originalText },
      ]);
    },
  );

  it("keeps rejecting fragments of longer words next to unspaced scripts", () => {
    expect(detectCurrencies("100ドルショップ", { pageLocale: "ja-JP" })).toEqual([]);
    expect(detectCurrencies("紀元2000年", { pageLocale: "zh-CN" })).toEqual([]);
    expect(detectCurrencies("abc100円", { pageLocale: "ja-JP" })).toEqual([]);
    expect(detectCurrencies("100円5", { pageLocale: "ja-JP" })).toEqual([]);
  });

  it("prefers an explicit code when symbol and code surround a scaled amount", () => {
    expect(detectCurrencies("$1 million CAD", { pageLocale: "en-US" })).toMatchObject([
      { amount: 1_000_000, currencyCode: "CAD", originalText: "1 million CAD" },
    ]);
  });

  it("detects Japanese currency names on pages in other languages", () => {
    expect(
      detectCurrencies("5万ドル", { pageLocale: "en-US", browserLocale: "en-US" }),
    ).toMatchObject([{ amount: 50_000, currencyCode: "USD" }]);
  });

  it("reads billion by the page language before the browser language", () => {
    expect(
      detectCurrencies("$1 billion", { pageLocale: "en-US", browserLocale: "de-DE" }),
    ).toMatchObject([{ amount: 1_000_000_000 }]);
    expect(detectCurrencies("$1 billion", { browserLocale: "de-DE" })).toMatchObject([
      { amount: 1_000_000_000_000 },
    ]);
  });

  it("does not join a spaced number after a word magnitude", () => {
    // Spaced words are not written with a bare remainder, so the number belongs to the next phrase.
    expect(detectCurrencies("$5 million 2024", { pageLocale: "en-US" })).toMatchObject([
      { amount: 5_000_000, currencyCode: "USD", originalText: "$5 million" },
    ]);
  });

  it("does not treat the start of a longer word as a magnitude", () => {
    expect(detectCurrencies("$5 man", { pageLocale: "en-US" })).toMatchObject([
      { amount: 5, currencyCode: "USD", originalText: "$5" },
    ]);
    expect(detectCurrencies("$5 millionaire", { pageLocale: "en-US" })).toMatchObject([
      { amount: 5, currencyCode: "USD", originalText: "$5" },
    ]);
  });

  it("rejects out-of-order magnitudes, missing currencies, and overflow", () => {
    expect(detectCurrencies("5万3億円", { pageLocale: "ja-JP" })).toEqual([]);
    expect(detectCurrencies("5千3千円", { pageLocale: "ja-JP" })).toEqual([]);
    expect(detectCurrencies("1億万円", { pageLocale: "ja-JP" })).toEqual([]);
    expect(detectCurrencies("5万千円", { pageLocale: "ja-JP" })).toEqual([]);
    expect(detectCurrencies("1,23,456万円", { pageLocale: "ja-JP" })).toEqual([]);
    expect(detectCurrencies("5万", { pageLocale: "ja-JP" })).toEqual([]);
    expect(detectCurrencies("1千5万円", { pageLocale: "ja-JP" })).toEqual([]);
    expect(detectCurrencies("$5 thousand 3 million", { pageLocale: "en-US" })).toEqual([]);
    expect(detectCurrencies("1万20000円", { pageLocale: "ja-JP" })).toEqual([]);
    expect(detectCurrencies("1万 10000円", { pageLocale: "ja-JP" })).toEqual([]);
    expect(detectCurrencies("1万5千3000円", { pageLocale: "ja-JP" })).toEqual([]);
    expect(detectCurrencies(`${"9".repeat(300)}兆円`, { pageLocale: "ja-JP" })).toEqual([]);
  });

  it("returns only the first three amounts in source order", () => {
    const detected = detectCurrencies("USD 1, EUR 2, GBP 3, JPY 4");
    expect(detected.map(({ currencyCode }) => currencyCode)).toEqual(["USD", "EUR", "GBP"]);
  });
});

describe("detectCurrencies with minor units", () => {
  it("converts standalone minor amounts into the main unit", () => {
    expect(detectCurrencies("50¢", { pageLocale: "en-US" })).toEqual([
      { amount: 0.5, currencyCode: "USD", originalText: "50¢", index: 0 },
    ]);
    expect(detectCurrencies("only 25 cents", { pageLocale: "en-US" })).toEqual([
      { amount: 0.25, currencyCode: "USD", originalText: "25 cents", index: 5 },
    ]);
    expect(detectCurrencies("1 cent")[0]).toMatchObject({
      amount: 0.01,
      currencyCode: "USD",
    });
    expect(detectCurrencies("3.5 cents")[0]?.amount).toBeCloseTo(0.035);
    expect(detectCurrencies("99 pence")[0]).toMatchObject({
      amount: 0.99,
      currencyCode: "GBP",
    });
    expect(detectCurrencies("1 penny")[0]).toMatchObject({
      amount: 0.01,
      currencyCode: "GBP",
    });
    expect(detectCurrencies("20 pennies")[0]).toMatchObject({
      amount: 0.2,
      currencyCode: "GBP",
    });
    expect(detectCurrencies("20 euro cents")[0]).toMatchObject({
      amount: 0.2,
      currencyCode: "EUR",
      originalText: "20 euro cents",
    });
  });

  it("reads cents by the $ interpretation, then the region, then USD", () => {
    const dollarOverride = { $: currencyCodeSchema.parse("CAD") };
    expect(
      detectCurrencies("50¢", { pageLocale: "en-US", symbolOverrides: dollarOverride })[0]
        ?.currencyCode,
    ).toBe("CAD");
    expect(
      detectCurrencies("50 cents", {
        pageLocale: "en-IE",
        symbolOverrides: dollarOverride,
      })[0]?.currencyCode,
    ).toBe("CAD");
    expect(detectCurrencies("50 cents", { pageLocale: "en-IE" })[0]?.currencyCode).toBe(
      "EUR",
    );
    expect(detectCurrencies("50 cent", { pageLocale: "en-AU" })[0]?.currencyCode).toBe(
      "AUD",
    );
    expect(detectCurrencies("50 cents", { pageLocale: "ja-JP" })[0]?.currencyCode).toBe(
      "USD",
    );

    // A $ interpretation without cents, such as MXN, leaves cents to the region.
    const pesoOverride = { $: currencyCodeSchema.parse("MXN") };
    expect(
      detectCurrencies("50¢", { pageLocale: "en-NZ", symbolOverrides: pesoOverride })[0]
        ?.currencyCode,
    ).toBe("NZD");

    const poundOverride = { "£": currencyCodeSchema.parse("GIP") };
    expect(
      detectCurrencies("50 pence", { symbolOverrides: poundOverride })[0]?.currencyCode,
    ).toBe("GIP");
  });

  it("does not read single-letter units or longer words as standalone minor amounts", () => {
    expect(detectCurrencies("1080p video at 50c each", { pageLocale: "en-US" })).toEqual(
      [],
    );
    expect(detectCurrencies("50 centimes; 50 Cent; 5 pennyweight")).toEqual([]);
    expect(detectCurrencies("0 cents")).toEqual([]);
  });

  it("joins a main amount and a following minor amount into one amount", () => {
    expect(detectCurrencies("pay $5 and 50 cents now", { pageLocale: "en-US" })).toEqual([
      { amount: 5.5, currencyCode: "USD", originalText: "$5 and 50 cents", index: 4 },
    ]);
    expect(detectCurrencies("5 dollars 5 cents", { pageLocale: "en-US" })).toEqual([
      { amount: 5.05, currencyCode: "USD", originalText: "5 dollars 5 cents", index: 0 },
    ]);
    expect(detectCurrencies("£3 20p")).toEqual([
      { amount: 3.2, currencyCode: "GBP", originalText: "£3 20p", index: 0 },
    ]);
    expect(detectCurrencies("€2 50c")[0]).toMatchObject({
      amount: 2.5,
      currencyCode: "EUR",
    });
    expect(
      detectCurrencies("USD 1,234 & 5 cents", { pageLocale: "en-US" })[0],
    ).toMatchObject({
      amount: 1_234.05,
      currencyCode: "USD",
    });
    expect(
      detectCurrencies("10 pounds, 99 pence", { pageLocale: "en-GB" })[0],
    ).toMatchObject({
      amount: 10.99,
      currencyCode: "GBP",
    });
    expect(detectCurrencies("$0 and 50 cents")[0]).toMatchObject({ amount: 0.5 });
  });

  it("does not split one number into main and minor parts", () => {
    expect(detectCurrencies("$50 cents")[0]).toMatchObject({
      amount: 0.5,
      currencyCode: "USD",
    });
    expect(detectCurrencies("£350 p")).toEqual([
      { amount: 350, currencyCode: "GBP", originalText: "£350", index: 0 },
    ]);
  });

  it("uses the explicit main currency for the minor amount", () => {
    const symbolOverrides = { $: currencyCodeSchema.parse("USD") };
    expect(detectCurrencies("CAD 5 and 50 cents", { symbolOverrides })).toEqual([
      { amount: 5.5, currencyCode: "CAD", originalText: "CAD 5 and 50 cents", index: 0 },
    ]);
    expect(detectCurrencies("CAD 50 cents", { pageLocale: "en-US" })).toEqual([
      { amount: 0.5, currencyCode: "CAD", originalText: "CAD 50 cents", index: 0 },
    ]);
    expect(detectCurrencies("€50 cents", { pageLocale: "en-US" })).toEqual([
      { amount: 0.5, currencyCode: "EUR", originalText: "€50 cents", index: 0 },
    ]);
    expect(
      detectCurrencies("$50 cents", {
        symbolOverrides: { $: currencyCodeSchema.parse("CAD") },
      })[0],
    ).toMatchObject({ amount: 0.5, currencyCode: "CAD" });
    // Pence do not belong to USD, so the code does not qualify them.
    expect(detectCurrencies("USD 50 pence")).toMatchObject([
      { amount: 0.5, currencyCode: "GBP", originalText: "50 pence" },
    ]);
  });

  it("reads digit grouping in a minor amount as one number", () => {
    expect(detectCurrencies("$5,000 cents", { pageLocale: "en-US" })).toEqual([
      { amount: 50, currencyCode: "USD", originalText: "$5,000 cents", index: 0 },
    ]);
    expect(detectCurrencies("$5 000 cents", { pageLocale: "fr-FR" })[0]).toMatchObject({
      amount: 50,
      currencyCode: "USD",
    });
    expect(detectCurrencies("$1,234,050 cents", { pageLocale: "en-US" })[0]).toMatchObject({
      amount: 12_340.5,
    });
    expect(detectCurrencies("$5, 50 cents")[0]).toMatchObject({ amount: 5.5 });
  });

  it("ignores leading zeros in a minor amount", () => {
    expect(detectCurrencies("$5 and 005 cents")[0]).toMatchObject({ amount: 5.05 });
    expect(detectCurrencies("$5 and 00050 cents")[0]).toMatchObject({ amount: 5.5 });
  });

  it("does not join parts whose value cannot be represented", () => {
    // Fullwidth digits are not supported as amounts.
    expect(detectCurrencies("£3 ２０p")).toEqual([]);
    const detections = detectCurrencies(`$${"9".repeat(400)} and 50 cents`);
    expect(detections.length).toBeGreaterThan(0);
    expect(detections.every(({ amount }) => Number.isFinite(amount))).toBe(true);
  });

  it("keeps the parts separate when they cannot form one amount", () => {
    // Pence do not belong to USD.
    expect(detectCurrencies("USD 5 and 50 pence")).toMatchObject([
      { amount: 5, currencyCode: "USD" },
      { amount: 0.5, currencyCode: "GBP" },
    ]);
    // A minor amount must be below one main unit.
    expect(detectCurrencies("$5 and 150 cents")).toMatchObject([
      { amount: 5, currencyCode: "USD" },
      { amount: 1.5, currencyCode: "USD" },
    ]);
    // The main amount must be a whole number.
    expect(detectCurrencies("$1.234 and 5 cents", { pageLocale: "en-US" })[0]?.amount).toBe(
      1.234,
    );
    expect(
      detectCurrencies("$1,234.567,890 and 5 cents", { pageLocale: "en-US" })[0]?.amount,
    ).toBe(0.05);
    expect(detectCurrencies("$0 and 0 cents")).toEqual([]);
    expect(detectCurrencies("x$5 and 50 cents")[0]).toMatchObject({ amount: 0.5 });
  });
});
