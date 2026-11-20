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
  /** Whether the name is too short to stand alone and is read only after a main amount, as in "£3 20p". */
  readonly compoundOnly: boolean;
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

// Every currency whose 1/100 unit is called a cent in English.
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

export const currencyMinorUnits: readonly CurrencyMinorUnit[] = [
  { name: "¢", exponent: 2, codes: dollarCentCurrencies, symbol: "$", compoundOnly: false },
  { name: "euro cents", exponent: 2, codes: ["EUR"], compoundOnly: false },
  { name: "euro cent", exponent: 2, codes: ["EUR"], compoundOnly: false },
  { name: "cents", exponent: 2, codes: centCurrencies, symbol: "$", compoundOnly: false },
  { name: "cent", exponent: 2, codes: centCurrencies, symbol: "$", compoundOnly: false },
  { name: "c", exponent: 2, codes: centCurrencies, symbol: "$", compoundOnly: true },
  { name: "pence", exponent: 2, codes: penceCurrencies, symbol: "£", compoundOnly: false },
  {
    name: "pennies",
    exponent: 2,
    codes: penceCurrencies,
    symbol: "£",
    compoundOnly: false,
  },
  { name: "penny", exponent: 2, codes: penceCurrencies, symbol: "£", compoundOnly: false },
  { name: "p", exponent: 2, codes: penceCurrencies, symbol: "£", compoundOnly: true },
];
