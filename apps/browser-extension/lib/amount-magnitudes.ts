/**
 * Magnitude words that scale an amount, such as 万, million, or lakh.
 * A group magnitude closes a section ("3億5000万"), while a within-group magnitude
 * only scales a number inside the current section ("5千万").
 */
export type MagnitudeRank = "group" | "within-group";

export interface Magnitude {
  readonly exponent: number;
  readonly rank: MagnitudeRank;
}

export interface MagnitudeToken {
  readonly token: string;
  /** Whether the token is written as a separate word that must end at a word boundary. */
  readonly spaced: boolean;
}

interface MagnitudeDefinition {
  readonly tokens: readonly string[];
  readonly exponent: number;
  readonly rank: MagnitudeRank;
  readonly spaced: boolean;
  /** Exponent used by long-scale languages, where "billion" means 10^12. */
  readonly longScaleExponent?: number;
}

const LONG_SCALE_LANGUAGES: ReadonlySet<string> = new Set(["de", "fr"]);

const magnitudeDefinitions: readonly MagnitudeDefinition[] = [
  // Chinese and Japanese
  { tokens: ["百"], exponent: 2, rank: "within-group", spaced: false },
  { tokens: ["千"], exponent: 3, rank: "within-group", spaced: false },
  { tokens: ["万", "萬"], exponent: 4, rank: "group", spaced: false },
  { tokens: ["億", "亿"], exponent: 8, rank: "group", spaced: false },
  { tokens: ["兆"], exponent: 12, rank: "group", spaced: false },
  // Korean
  { tokens: ["백"], exponent: 2, rank: "within-group", spaced: false },
  { tokens: ["천"], exponent: 3, rank: "within-group", spaced: false },
  { tokens: ["만"], exponent: 4, rank: "group", spaced: false },
  { tokens: ["억"], exponent: 8, rank: "group", spaced: false },
  { tokens: ["조"], exponent: 12, rank: "group", spaced: false },
  // Thai
  { tokens: ["พัน"], exponent: 3, rank: "within-group", spaced: false },
  { tokens: ["หมื่น"], exponent: 4, rank: "within-group", spaced: false },
  { tokens: ["แสน"], exponent: 5, rank: "within-group", spaced: false },
  { tokens: ["ล้าน"], exponent: 6, rank: "group", spaced: false },
  // Words written with spaces, grouped by value
  {
    tokens: [
      "thousand",
      "thousands",
      "k",
      "Tsd.",
      "Tausend",
      "mille",
      "mil",
      "mila",
      "duizend",
      "tys.",
      "тыс.",
      "тысяч",
      "тысячи",
      "тис.",
      "bin",
      "ribu",
      "rb",
      "nghìn",
      "ngàn",
      "\u0939\u091C\u093C\u093E\u0930",
      "\u0939\u095B\u093E\u0930",
      "हजार",
      "ألف",
    ],
    exponent: 3,
    rank: "within-group",
    spaced: true,
  },
  { tokens: ["lakh", "lakhs", "लाख"], exponent: 5, rank: "group", spaced: true },
  {
    tokens: [
      "million",
      "millions",
      "m",
      "M",
      "mn",
      "Mio.",
      "Million",
      "Millionen",
      "millón",
      "millones",
      "milhão",
      "milhões",
      "mi",
      "milione",
      "milioni",
      "mln",
      "miljoen",
      "miljoenen",
      "млн",
      "миллион",
      "миллиона",
      "миллионов",
      "milyon",
      "juta",
      "jt",
      "triệu",
      "مليون",
    ],
    exponent: 6,
    rank: "group",
    spaced: true,
  },
  {
    tokens: [
      "crore",
      "crores",
      "\u0915\u0930\u094B\u0921\u093C",
      "\u0915\u0930\u094B\u095C",
    ],
    exponent: 7,
    rank: "group",
    spaced: true,
  },
  {
    tokens: [
      "b",
      "bn",
      "Mrd.",
      "Milliarde",
      "Milliarden",
      "milliard",
      "milliards",
      "Md",
      "Mds",
      "mil millones",
      "mil milhões",
      "bilhão",
      "bilhões",
      "bi",
      "miliardo",
      "miliardi",
      "mld",
      "miljard",
      "miljarden",
      "млрд",
      "миллиард",
      "миллиарда",
      "миллиардов",
      "milyar",
      "miliar",
      "tỷ",
      "tỉ",
      "مليار",
    ],
    exponent: 9,
    rank: "group",
    spaced: true,
  },
  {
    tokens: ["billion", "billions"],
    exponent: 9,
    rank: "group",
    spaced: true,
    longScaleExponent: 12,
  },
  {
    tokens: [
      "tn",
      "Bio.",
      "Billionen",
      "billón",
      "billones",
      "bilião",
      "biliões",
      "трлн",
      "trilyon",
      "triliun",
    ],
    exponent: 12,
    rank: "group",
    spaced: true,
  },
  {
    tokens: ["trillion", "trillions"],
    exponent: 12,
    rank: "group",
    spaced: true,
    longScaleExponent: 18,
  },
];

const definitionByToken = new Map(
  magnitudeDefinitions.flatMap((definition) =>
    withCapitalizedVariants(definition).map((token) => [token, definition] as const),
  ),
);

/** Returns every magnitude token, including capitalized variants of spaced words. */
export function getMagnitudeTokens(): MagnitudeToken[] {
  return [...definitionByToken].map(([token, definition]) => ({
    token,
    spaced: definition.spaced,
  }));
}

/** Resolves a magnitude token, using the language to choose short or long scale. */
export function resolveMagnitude(token: string, language: string | undefined): Magnitude {
  // Callers only pass tokens matched from getMagnitudeTokens, so every token has a definition.
  const definition = definitionByToken.get(token)!;
  const exponent =
    definition.longScaleExponent !== undefined &&
    language !== undefined &&
    LONG_SCALE_LANGUAGES.has(language)
      ? definition.longScaleExponent
      : definition.exponent;

  return { exponent, rank: definition.rank };
}

/** Adds sentence-case forms such as "Million" for words that are usually lowercase. */
function withCapitalizedVariants(definition: MagnitudeDefinition): string[] {
  if (!definition.spaced) {
    return [...definition.tokens];
  }

  const capitalized = definition.tokens.map(
    (token) => token.charAt(0).toUpperCase() + token.slice(1),
  );
  return [...new Set([...definition.tokens, ...capitalized])];
}
