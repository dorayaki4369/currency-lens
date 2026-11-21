import type { CurrencyCode } from "./index";

export interface CurrencyMinorUnit {
  /** Text written after the number, such as "¢" or "cents". */
  readonly name: string;
  /** Power of ten that divides the minor unit into the main unit, such as 2 for 1/100. */
  readonly exponent: number;
  /** Currencies that use this name, with the default currency first. */
  readonly codes: readonly CurrencyCode[];
  /** Main-unit symbol whose user interpretation also decides this unit, such as "$" for "¢". */
  readonly symbol?: string;
  /**
   * Whether the name is read only after a main amount, as in "£3 20p" or "3元5角".
   * Short names and words with other common meanings, such as "p" or 分 (minute), need this.
   */
  readonly compoundOnly: boolean;
  /** Characters that turn the name into another word when they follow it, such as 钟 in 分钟. */
  readonly wordContinuations?: readonly string[];
}

// Dollar currencies whose 1/100 unit is called a cent.
const dollarCentCurrencies = [
  "USD",
  "CAD",
  "AUD",
  "NZD",
  "BBD",
  "BMD",
  "BND",
  "BSD",
  "FJD",
  "GYD",
  "HKD",
  "JMD",
  "KYD",
  "LRD",
  "NAD",
  "SBD",
  "SRD",
  "TTD",
  "XCD",
] as const satisfies readonly CurrencyCode[];

// Every currency whose 1/100 unit is called a cent in English or Dutch.
const centCurrencies = [
  ...dollarCentCurrencies,
  "EUR",
  "SGD",
  "BZD",
  "ZAR",
] as const satisfies readonly CurrencyCode[];

const penceCurrencies = [
  "GBP",
  "GIP",
  "FKP",
  "SHP",
] as const satisfies readonly CurrencyCode[];

// Spanish and Portuguese currencies whose 1/100 unit is still written as centavos.
const centavoCurrencies = [
  "MXN",
  "BRL",
  "ARS",
  "BOB",
  "COP",
  "CUP",
  "CVE",
  "DOP",
  "GTQ",
  "HNL",
  "MZN",
  "NIO",
  "PHP",
] as const satisfies readonly CurrencyCode[];

export const currencyMinorUnits: readonly CurrencyMinorUnit[] = [
  // English
  ...defineUnits(["¢"], { codes: dollarCentCurrencies, symbol: "$" }),
  ...defineUnits(["euro cents", "euro cent"], { codes: ["EUR"] }),
  ...defineUnits(["cents", "cent"], { codes: centCurrencies, symbol: "$" }),
  ...defineUnits(["c"], { codes: centCurrencies, symbol: "$", compoundOnly: true }),
  ...defineUnits(["pence", "pennies", "penny"], { codes: penceCurrencies, symbol: "£" }),
  ...defineUnits(["p"], { codes: penceCurrencies, symbol: "£", compoundOnly: true }),
  // German, French, Spanish, Portuguese, and Italian
  ...defineUnits(["Cent"], { codes: ["EUR"] }),
  // "ct" also means carat, as in "1 ct" diamonds.
  ...defineUnits(["ct.", "ct"], { codes: ["EUR"], compoundOnly: true }),
  ...defineUnits(["Rappen"], { codes: ["CHF"] }),
  ...defineUnits(["Rp."], { codes: ["CHF"], compoundOnly: true }),
  ...defineUnits(["centimes", "centime"], { codes: ["EUR", "CHF"] }),
  ...defineUnits(["centesimi", "centesimo"], { codes: ["EUR", "CHF"] }),
  ...defineUnits(["céntimos", "céntimo"], { codes: ["EUR", "PEN"] }),
  ...defineUnits(["cêntimos", "cêntimo"], { codes: ["EUR"] }),
  ...defineUnits(["centavos", "centavo"], { codes: centavoCurrencies }),
  // Russian, Ukrainian, and Belarusian
  ...defineUnits(["копеек", "копейки", "копейка"], { codes: ["RUB", "BYN", "UAH"] }),
  ...defineUnits(["копійок", "копійки", "копійка"], { codes: ["UAH"] }),
  ...defineUnits(["капеек", "капейкі", "капейка"], { codes: ["BYN"] }),
  ...defineUnits(["коп."], { codes: ["RUB", "UAH", "BYN"] }),
  // Polish, Czech, and Turkish
  ...defineUnits(["groszy", "grosze", "grosz"], { codes: ["PLN"] }),
  // "gr" also means grams.
  ...defineUnits(["gr"], { codes: ["PLN"], compoundOnly: true }),
  ...defineUnits(["haléřů", "haléře", "haléř"], { codes: ["CZK"] }),
  ...defineUnits(["hal."], { codes: ["CZK"], compoundOnly: true }),
  ...defineUnits(["kuruş", "kurus"], { codes: ["TRY"] }),
  // South Asian
  ...defineUnits(["paise", "paisa"], { codes: ["INR", "PKR", "NPR"] }),
  ...defineUnits(["पैसे", "पैसा"], { codes: ["INR", "NPR"] }),
  // Japanese and Chinese. 角 also means a corner, as in 5角形, and 分 also means a minute.
  ...defineUnits(["銭"], { codes: ["JPY"] }),
  ...defineUnits(["角"], {
    codes: ["CNY"],
    exponent: 1,
    compoundOnly: true,
    wordContinuations: ["形"],
  }),
  ...defineUnits(["分"], {
    codes: ["CNY"],
    compoundOnly: true,
    wordContinuations: ["钟", "鐘"],
  }),
];

/** Defines names that share one meaning, such as the singular and plural of a unit. */
function defineUnits(
  names: readonly string[],
  unit: Pick<CurrencyMinorUnit, "codes" | "symbol" | "wordContinuations"> &
    Partial<Pick<CurrencyMinorUnit, "exponent" | "compoundOnly">>,
): CurrencyMinorUnit[] {
  return names.map((name) => ({
    name,
    exponent: unit.exponent ?? 2,
    codes: unit.codes,
    ...(unit.symbol === undefined ? {} : { symbol: unit.symbol }),
    compoundOnly: unit.compoundOnly ?? false,
    ...(unit.wordContinuations === undefined
      ? {}
      : { wordContinuations: unit.wordContinuations }),
  }));
}
