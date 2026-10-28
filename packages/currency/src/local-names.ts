import type { CurrencyCode } from "./index";

export interface CurrencyLocalName {
  readonly code: CurrencyCode;
  readonly names: readonly CurrencyLocalNameEntry[];
}

export interface CurrencyLocalNameEntry {
  readonly name: string;
  readonly sample: string;
  readonly locales: readonly string[];
}

export const currencyLocalNames = [
  {
    code: "AED",
    names: [
      {
        name: "درهم",
        sample: "100 درهم",
        locales: ["ar-AE"],
      },
    ],
  },
  {
    code: "AFN",
    names: [
      {
        name: "افغانۍ",
        sample: "۱۰۰ افغانۍ",
        locales: ["ps-AF"],
      },
      {
        name: "افغانی",
        sample: "۱۰۰ افغانی",
        locales: ["fa-AF"],
      },
    ],
  },
  {
    code: "ALL",
    names: [
      {
        name: "lekë",
        sample: "100 lekë",
        locales: ["sq-AL"],
      },
    ],
  },
  {
    code: "AMD",
    names: [
      {
        name: "դրամ",
        sample: "100 դրամ",
        locales: ["hy-AM"],
      },
    ],
  },
  {
    code: "AOA",
    names: [
      {
        name: "kwanzas",
        sample: "100 kwanzas",
        locales: ["pt-AO"],
      },
    ],
  },
  {
    code: "ARS",
    names: [
      {
        name: "pesos",
        sample: "100 pesos",
        locales: ["es-AR"],
      },
    ],
  },
  {
    code: "AUD",
    names: [
      {
        name: "dollars",
        sample: "100 dollars",
        locales: ["en-AU", "en-CC", "en-CX", "en-KI", "en-NF", "en-NR", "en-TV"],
      },
      {
        name: "dollars",
        sample: "100 dollars",
        locales: ["en-HM"],
      },
      {
        name: "豪ドル",
        sample: "100豪ドル",
        locales: ["ja-JP"],
      },
      {
        name: "オーストラリアドル",
        sample: "100オーストラリアドル",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "AWG",
    names: [
      {
        name: "florin",
        sample: "100 florin",
        locales: ["nl-AW"],
      },
    ],
  },
  {
    code: "AZN",
    names: [
      {
        name: "manat",
        sample: "100 manat",
        locales: ["az-AZ"],
      },
    ],
  },
  {
    code: "BAM",
    names: [
      {
        name: "konvertibilnih maraka",
        sample: "100 konvertibilnih maraka",
        locales: ["bs-BA", "sr-Latn-BA"],
      },
      {
        name: "конвертибилних марака",
        sample: "100 конвертибилних марака",
        locales: ["bs-Cyrl-BA"],
      },
      {
        name: "konvertibilnih maraka",
        sample: "100 konvertibilnih maraka",
        locales: ["hr-BA"],
      },
      {
        name: "конвертибилних марака",
        sample: "100 конвертибилних марака",
        locales: ["sr-BA"],
      },
    ],
  },
  {
    code: "BBD",
    names: [
      {
        name: "dollars",
        sample: "100 dollars",
        locales: ["en-BB"],
      },
    ],
  },
  {
    code: "BDT",
    names: [
      {
        name: "টাকা",
        sample: "১০০ টাকা",
        locales: ["bn-BD"],
      },
    ],
  },
  {
    code: "BHD",
    names: [
      {
        name: "دينار",
        sample: "١٠٠ دينار",
        locales: ["ar-BH"],
      },
    ],
  },
  {
    code: "BIF",
    names: [
      {
        name: "francs",
        sample: "100 francs",
        locales: ["fr-BI"],
      },
      {
        name: "FBu",
        sample: "FBu 100",
        locales: ["rn-BI"],
      },
      {
        name: "francs",
        sample: "100 francs",
        locales: ["en-BI"],
      },
    ],
  },
  {
    code: "BMD",
    names: [
      {
        name: "dollars",
        sample: "100 dollars",
        locales: ["en-BM"],
      },
    ],
  },
  {
    code: "BND",
    names: [
      {
        name: "dolar",
        sample: "100 dolar",
        locales: ["ms-BN"],
      },
    ],
  },
  {
    code: "BOB",
    names: [
      {
        name: "bolivianos",
        sample: "100 bolivianos",
        locales: ["es-BO"],
      },
      {
        name: "boliviano",
        sample: "100 boliviano",
        locales: ["qu-BO"],
      },
    ],
  },
  {
    code: "BRL",
    names: [
      {
        name: "reais",
        sample: "100 reais",
        locales: ["pt-BR"],
      },
      {
        name: "レアル",
        sample: "100レアル",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "BSD",
    names: [
      {
        name: "dollars",
        sample: "100 dollars",
        locales: ["en-BS"],
      },
    ],
  },
  {
    code: "BTN",
    names: [
      {
        name: "དངུལ་ཀྲམ",
        sample: "༡༠༠ དངུལ་ཀྲམ",
        locales: ["dz-BT"],
      },
    ],
  },
  {
    code: "BWP",
    names: [
      {
        name: "pula",
        sample: "100 pula",
        locales: ["tn-BW"],
      },
      {
        name: "pula",
        sample: "100 pula",
        locales: ["en-BW"],
      },
    ],
  },
  {
    code: "BYN",
    names: [
      {
        name: "рублёў",
        sample: "100 рублёў",
        locales: ["be-BY"],
      },
      {
        name: "рублей",
        sample: "100 рублей",
        locales: ["ru-BY"],
      },
    ],
  },
  {
    code: "BZD",
    names: [
      {
        name: "dollars",
        sample: "100 dollars",
        locales: ["en-BZ"],
      },
    ],
  },
  {
    code: "CAD",
    names: [
      {
        name: "dollars",
        sample: "100 dollars",
        locales: ["en-CA"],
      },
      {
        name: "dollars",
        sample: "100 dollars",
        locales: ["fr-CA"],
      },
      {
        name: "カナダドル",
        sample: "100カナダドル",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "CDF",
    names: [
      {
        name: "francs",
        sample: "100 francs",
        locales: ["fr-CD"],
      },
    ],
  },
  {
    code: "CHF",
    names: [
      {
        name: "Franken",
        sample: "100 Franken",
        locales: ["de-CH", "de-LI"],
      },
      {
        name: "Franke",
        sample: "100 Franke",
        locales: ["gsw-CH", "gsw-LI"],
      },
      {
        name: "francs",
        sample: "100 francs",
        locales: ["fr-CH"],
      },
      {
        name: "franchi",
        sample: "100 franchi",
        locales: ["it-CH"],
      },
      {
        name: "スイスフラン",
        sample: "100スイスフラン",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "CLP",
    names: [
      {
        name: "pesos",
        sample: "100 pesos",
        locales: ["es-CL"],
      },
    ],
  },
  {
    code: "CNY",
    names: [
      {
        name: "元",
        sample: "100元",
        locales: ["zh-CN"],
      },
      {
        name: "人民元",
        sample: "100人民元",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "COP",
    names: [
      {
        name: "pesos",
        sample: "100 pesos",
        locales: ["es-CO"],
      },
    ],
  },
  {
    code: "CRC",
    names: [
      {
        name: "colones",
        sample: "100 colones",
        locales: ["es-CR"],
      },
    ],
  },
  {
    code: "CUP",
    names: [
      {
        name: "pesos",
        sample: "100 pesos",
        locales: ["es-CU"],
      },
    ],
  },
  {
    code: "CVE",
    names: [
      {
        name: "escudos",
        sample: "100 escudos",
        locales: ["pt-CV"],
      },
    ],
  },
  {
    code: "CZK",
    names: [
      {
        name: "korun",
        sample: "100 korun",
        locales: ["cs-CZ"],
      },
    ],
  },
  {
    code: "DJF",
    names: [
      {
        name: "francs",
        sample: "100 francs",
        locales: ["fr-DJ"],
      },
      {
        name: "فرنك",
        sample: "١٠٠ فرنك",
        locales: ["ar-DJ"],
      },
    ],
  },
  {
    code: "DKK",
    names: [
      {
        name: "kroner",
        sample: "100 kroner",
        locales: ["da-DK"],
      },
      {
        name: "krónur",
        sample: "100 krónur",
        locales: ["fo-FO"],
      },
    ],
  },
  {
    code: "DOP",
    names: [
      {
        name: "pesos",
        sample: "100 pesos",
        locales: ["es-DO"],
      },
    ],
  },
  {
    code: "DZD",
    names: [
      {
        name: "دينار",
        sample: "100 دينار",
        locales: ["ar-DZ"],
      },
      {
        name: "dinars",
        sample: "100 dinars",
        locales: ["fr-DZ"],
      },
    ],
  },
  {
    code: "EGP",
    names: [
      {
        name: "جنيه",
        sample: "١٠٠ جنيه",
        locales: ["ar-EG"],
      },
    ],
  },
  {
    code: "ERN",
    names: [
      {
        name: "ናቕፋ",
        sample: "100 ናቕፋ",
        locales: ["ti-ER"],
      },
      {
        name: "nakfa",
        sample: "100 nakfa",
        locales: ["en-ER"],
      },
      {
        name: "ناكفا",
        sample: "١٠٠ ناكفا",
        locales: ["ar-ER"],
      },
    ],
  },
  {
    code: "ETB",
    names: [
      {
        name: "ብር",
        sample: "100 ብር",
        locales: ["am-ET"],
      },
    ],
  },
  {
    code: "EUR",
    names: [
      {
        name: "Euro",
        sample: "100 Euro",
        locales: ["de-DE", "de-BE", "de-LU", "lb-LU"],
      },
      {
        name: "euros",
        sample: "100 euros",
        locales: [
          "ca-AD",
          "es-EA",
          "es-ES",
          "es-IC",
          "fr-BE",
          "fr-BL",
          "fr-FR",
          "fr-GF",
          "fr-GP",
          "fr-LU",
          "fr-MC",
          "fr-MF",
          "fr-MQ",
          "fr-PM",
          "fr-RE",
          "fr-TF",
          "fr-YT",
          "pt-PT",
        ],
      },
      {
        name: "Euro",
        sample: "100 Euro",
        locales: ["de-AT"],
      },
      {
        name: "euro",
        sample: "100 euro",
        locales: ["it-IT", "it-SM", "it-VA", "sq-XK", "sv-AX", "sv-FI"],
      },
      {
        name: "euro",
        sample: "100 euro",
        locales: ["nl-BE", "nl-NL"],
      },
      {
        name: "евро",
        sample: "100 евро",
        locales: ["bg-BG"],
      },
      {
        name: "ευρώ",
        sample: "100 ευρώ",
        locales: ["el-CY", "el-GR"],
      },
      {
        name: "avro",
        sample: "100 avro",
        locales: ["tr-CY"],
      },
      {
        name: "eurot",
        sample: "100 eurot",
        locales: ["et-EE"],
      },
      {
        name: "euroa",
        sample: "100 euroa",
        locales: ["fi-FI"],
      },
      {
        name: "eura",
        sample: "100 eura",
        locales: ["hr-HR"],
      },
      {
        name: "euros",
        sample: "100 euros",
        locales: ["en-IE", "en-MT"],
      },
      {
        name: "euro",
        sample: "100 euro",
        locales: ["ga-IE"],
      },
      {
        name: "eurų",
        sample: "100 eurų",
        locales: ["lt-LT"],
      },
      {
        name: "eiro",
        sample: "100 eiro",
        locales: ["lv-LV"],
      },
      {
        name: "evra",
        sample: "100 evra",
        locales: ["sr-Latn-ME", "sr-Latn-XK"],
      },
      {
        name: "ewro",
        sample: "100 ewro",
        locales: ["mt-MT"],
      },
      {
        name: "evrov",
        sample: "100 evrov",
        locales: ["sl-SI"],
      },
      {
        name: "eur",
        sample: "100 eur",
        locales: ["sk-SK"],
      },
      {
        name: "евра",
        sample: "100 евра",
        locales: ["sr-XK"],
      },
      {
        name: "ユーロ",
        sample: "100ユーロ",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "FJD",
    names: [
      {
        name: "dollars",
        sample: "100 dollars",
        locales: ["en-FJ"],
      },
    ],
  },
  {
    code: "FKP",
    names: [
      {
        name: "pounds",
        sample: "100 pounds",
        locales: ["en-FK"],
      },
    ],
  },
  {
    code: "GBP",
    names: [
      {
        name: "pounds",
        sample: "100 pounds",
        locales: ["en-GB", "en-GS", "en-TA"],
      },
      {
        name: "pounds",
        sample: "100 pounds",
        locales: ["en-GG", "en-IM", "en-JE"],
      },
      {
        name: "ポンド",
        sample: "100ポンド",
        locales: ["ja-JP"],
      },
      {
        name: "英ポンド",
        sample: "100英ポンド",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "GEL",
    names: [
      {
        name: "ლარი",
        sample: "100 ლარი",
        locales: ["ka-GE"],
      },
    ],
  },
  {
    code: "GHS",
    names: [
      {
        name: "cedis",
        sample: "100 cedis",
        locales: ["en-GH"],
      },
    ],
  },
  {
    code: "GIP",
    names: [
      {
        name: "pounds",
        sample: "100 pounds",
        locales: ["en-GI"],
      },
    ],
  },
  {
    code: "GMD",
    names: [
      {
        name: "dalasis",
        sample: "100 dalasis",
        locales: ["en-GM"],
      },
    ],
  },
  {
    code: "GNF",
    names: [
      {
        name: "francs",
        sample: "100 francs",
        locales: ["fr-GN"],
      },
    ],
  },
  {
    code: "GTQ",
    names: [
      {
        name: "quetzales",
        sample: "100 quetzales",
        locales: ["es-GT"],
      },
    ],
  },
  {
    code: "GYD",
    names: [
      {
        name: "dollars",
        sample: "100 dollars",
        locales: ["en-GY"],
      },
    ],
  },
  {
    code: "HKD",
    names: [
      {
        name: "港元",
        sample: "100港元",
        locales: ["zh-HK"],
      },
      {
        name: "港元",
        sample: "100港元",
        locales: ["zh-Hant-HK"],
      },
      {
        name: "dollars",
        sample: "100 dollars",
        locales: ["en-HK"],
      },
      {
        name: "香港ドル",
        sample: "100香港ドル",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "HNL",
    names: [
      {
        name: "lempiras",
        sample: "100 lempiras",
        locales: ["es-HN"],
      },
    ],
  },
  {
    code: "HTG",
    names: [
      {
        name: "goud",
        sample: "100 goud",
        locales: ["ht-HT"],
      },
      {
        name: "gourdes",
        sample: "100 gourdes",
        locales: ["fr-HT"],
      },
    ],
  },
  {
    code: "HUF",
    names: [
      {
        name: "forint",
        sample: "100 forint",
        locales: ["hu-HU"],
      },
    ],
  },
  {
    code: "IDR",
    names: [
      {
        name: "rupiah",
        sample: "100 rupiah",
        locales: ["id-ID"],
      },
      {
        name: "ルピア",
        sample: "100ルピア",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "ILS",
    names: [
      {
        name: "שקלים",
        sample: "100 שקלים",
        locales: ["he-IL"],
      },
      {
        name: "شيكل",
        sample: "١٠٠ شيكل",
        locales: ["ar-IL", "ar-PS"],
      },
    ],
  },
  {
    code: "INR",
    names: [
      {
        name: "रुपये",
        sample: "100 रुपये",
        locales: ["hi-IN"],
      },
      {
        name: "རུ་པི",
        sample: "༡༠༠ རུ་པི",
        locales: ["dz-BT"],
      },
      {
        name: "rupees",
        sample: "100 rupees",
        locales: ["en-IN"],
      },
      {
        name: "ルピー",
        sample: "100ルピー",
        locales: ["ja-JP"],
      },
      {
        name: "インドルピー",
        sample: "100インドルピー",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "IQD",
    names: [
      {
        name: "دينار",
        sample: "١٠٠ دينار",
        locales: ["ar-IQ"],
      },
    ],
  },
  {
    code: "IRR",
    names: [
      {
        name: "ریال",
        sample: "۱۰۰ ریال",
        locales: ["fa-IR"],
      },
    ],
  },
  {
    code: "ISK",
    names: [
      {
        name: "krónur",
        sample: "100 krónur",
        locales: ["is-IS"],
      },
    ],
  },
  {
    code: "JMD",
    names: [
      {
        name: "dollars",
        sample: "100 dollars",
        locales: ["en-JM"],
      },
    ],
  },
  {
    code: "JOD",
    names: [
      {
        name: "دينار",
        sample: "١٠٠ دينار",
        locales: ["ar-JO", "ar-PS"],
      },
    ],
  },
  {
    code: "JPY",
    names: [
      {
        name: "円",
        sample: "100円",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "KES",
    names: [
      {
        name: "shilingi",
        sample: "shilingi 100",
        locales: ["sw-KE"],
      },
      {
        name: "shillings",
        sample: "100 shillings",
        locales: ["en-KE"],
      },
    ],
  },
  {
    code: "KGS",
    names: [
      {
        name: "сом",
        sample: "100 сом",
        locales: ["ky-KG"],
      },
      {
        name: "сомов",
        sample: "100 сомов",
        locales: ["ru-KG"],
      },
    ],
  },
  {
    code: "KHR",
    names: [
      {
        name: "រៀល",
        sample: "100 រៀល",
        locales: ["km-KH"],
      },
    ],
  },
  {
    code: "KMF",
    names: [
      {
        name: "فرنك",
        sample: "١٠٠ فرنك",
        locales: ["ar-KM"],
      },
      {
        name: "francs",
        sample: "100 francs",
        locales: ["fr-KM"],
      },
    ],
  },
  {
    code: "KPW",
    names: [
      {
        name: "원",
        sample: "100원",
        locales: ["ko-KP"],
      },
    ],
  },
  {
    code: "KRW",
    names: [
      {
        name: "원",
        sample: "100원",
        locales: ["ko-KR"],
      },
      {
        name: "ウォン",
        sample: "100ウォン",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "KWD",
    names: [
      {
        name: "دينار",
        sample: "١٠٠ دينار",
        locales: ["ar-KW"],
      },
    ],
  },
  {
    code: "KYD",
    names: [
      {
        name: "dollars",
        sample: "100 dollars",
        locales: ["en-KY"],
      },
    ],
  },
  {
    code: "KZT",
    names: [
      {
        name: "теңге",
        sample: "100 теңге",
        locales: ["kk-KZ"],
      },
      {
        name: "тенге",
        sample: "100 тенге",
        locales: ["ru-KZ"],
      },
    ],
  },
  {
    code: "LAK",
    names: [
      {
        name: "ກີບ",
        sample: "100 ກີບ",
        locales: ["lo-LA"],
      },
    ],
  },
  {
    code: "LBP",
    names: [
      {
        name: "ليرة",
        sample: "١٠٠ ليرة",
        locales: ["ar-LB"],
      },
    ],
  },
  {
    code: "LKR",
    names: [
      {
        name: "රුපියල්",
        sample: "රුපියල් 100",
        locales: ["si-LK"],
      },
      {
        name: "ரூபாய்",
        sample: "100 ரூபாய்",
        locales: ["ta-LK"],
      },
    ],
  },
  {
    code: "LRD",
    names: [
      {
        name: "dollars",
        sample: "100 dollars",
        locales: ["en-LR"],
      },
    ],
  },
  {
    code: "LSL",
    names: [
      {
        name: "maloti",
        sample: "100 maloti",
        locales: ["en-LS"],
      },
    ],
  },
  {
    code: "LYD",
    names: [
      {
        name: "دينار",
        sample: "100 دينار",
        locales: ["ar-LY"],
      },
    ],
  },
  {
    code: "MAD",
    names: [
      {
        name: "درهم",
        sample: "100 درهم",
        locales: ["ar-MA", "ar-EH"],
      },
      {
        name: "dirhams",
        sample: "100 dirhams",
        locales: ["fr-MA"],
      },
      {
        name: "Derhem",
        sample: "100 Derhem",
        locales: ["tzm-MA"],
      },
    ],
  },
  {
    code: "MDL",
    names: [
      {
        name: "de lei",
        sample: "100 de lei",
        locales: ["ro-MD"],
      },
    ],
  },
  {
    code: "MGA",
    names: [
      {
        name: "ariary",
        sample: "100 ariary",
        locales: ["mg-MG"],
      },
      {
        name: "ariarys",
        sample: "100 ariarys",
        locales: ["fr-MG"],
      },
      {
        name: "ariary",
        sample: "100 ariary",
        locales: ["en-MG"],
      },
    ],
  },
  {
    code: "MKD",
    names: [
      {
        name: "денари",
        sample: "100 денари",
        locales: ["mk-MK"],
      },
    ],
  },
  {
    code: "MMK",
    names: [
      {
        name: "ကျပ်",
        sample: "ကျပ် ၁၀၀",
        locales: ["my-MM"],
      },
    ],
  },
  {
    code: "MNT",
    names: [
      {
        name: "төгрөг",
        sample: "100 төгрөг",
        locales: ["mn-MN"],
      },
    ],
  },
  {
    code: "MOP",
    names: [
      {
        name: "元",
        sample: "100元",
        locales: ["zh-MO"],
      },
      {
        name: "元",
        sample: "100元",
        locales: ["zh-Hant-MO"],
      },
      {
        name: "蚊",
        sample: "100蚊",
        locales: ["yue-MO"],
      },
      {
        name: "patacas",
        sample: "100 patacas",
        locales: ["pt-MO"],
      },
    ],
  },
  {
    code: "MRU",
    names: [
      {
        name: "أوقية",
        sample: "١٠٠ أوقية",
        locales: ["ar-MR"],
      },
    ],
  },
  {
    code: "MUR",
    names: [
      {
        name: "roupies",
        sample: "100 roupies",
        locales: ["fr-MU"],
      },
      {
        name: "rupees",
        sample: "100 rupees",
        locales: ["en-MU"],
      },
    ],
  },
  {
    code: "MVR",
    names: [
      {
        name: "ރުފިޔާ",
        sample: "100 ރުފިޔާ",
        locales: ["dv-MV"],
      },
    ],
  },
  {
    code: "MWK",
    names: [
      {
        name: "kwacha",
        sample: "100 kwacha",
        locales: ["ny-MW"],
      },
      {
        name: "kwacha",
        sample: "100 kwacha",
        locales: ["en-MW"],
      },
    ],
  },
  {
    code: "MXN",
    names: [
      {
        name: "pesos",
        sample: "100 pesos",
        locales: ["es-MX"],
      },
      {
        name: "メキシコペソ",
        sample: "100メキシコペソ",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "MYR",
    names: [
      {
        name: "ringgit",
        sample: "100 ringgit",
        locales: ["ms-MY"],
      },
      {
        name: "リンギット",
        sample: "100リンギット",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "MZN",
    names: [
      {
        name: "meticais",
        sample: "100 meticais",
        locales: ["pt-MZ"],
      },
    ],
  },
  {
    code: "NAD",
    names: [
      {
        name: "dollars",
        sample: "100 dollars",
        locales: ["en-NA"],
      },
    ],
  },
  {
    code: "NGN",
    names: [
      {
        name: "naira",
        sample: "100 naira",
        locales: ["en-NG"],
      },
      {
        name: "náírà",
        sample: "100 náírà",
        locales: ["yo-NG"],
      },
    ],
  },
  {
    code: "NIO",
    names: [
      {
        name: "córdobas",
        sample: "100 córdobas",
        locales: ["es-NI"],
      },
    ],
  },
  {
    code: "NOK",
    names: [
      {
        name: "kroner",
        sample: "100 kroner",
        locales: ["nb-NO", "nb-SJ", "nn-NO", "no-BV", "no-NO"],
      },
    ],
  },
  {
    code: "NPR",
    names: [
      {
        name: "रुपैयाँ",
        sample: "१०० रुपैयाँ",
        locales: ["ne-NP"],
      },
    ],
  },
  {
    code: "NZD",
    names: [
      {
        name: "dollars",
        sample: "100 dollars",
        locales: ["en-NZ", "en-CK", "en-NU", "en-PN", "en-TK"],
      },
      {
        name: "tāra",
        sample: "100 tāra",
        locales: ["mi-NZ"],
      },
      {
        name: "NZドル",
        sample: "100NZドル",
        locales: ["ja-JP"],
      },
      {
        name: "ニュージーランドドル",
        sample: "100ニュージーランドドル",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "OMR",
    names: [
      {
        name: "ريال",
        sample: "١٠٠ ريال",
        locales: ["ar-OM"],
      },
    ],
  },
  {
    code: "PAB",
    names: [
      {
        name: "balboas",
        sample: "100 balboas",
        locales: ["es-PA"],
      },
    ],
  },
  {
    code: "PEN",
    names: [
      {
        name: "soles",
        sample: "100 soles",
        locales: ["es-PE"],
      },
      {
        name: "sol",
        sample: "100 sol",
        locales: ["qu-PE"],
      },
    ],
  },
  {
    code: "PGK",
    names: [
      {
        name: "kina",
        sample: "100 kina",
        locales: ["en-PG"],
      },
    ],
  },
  {
    code: "PHP",
    names: [
      {
        name: "piso",
        sample: "100 piso",
        locales: ["fil-PH"],
      },
      {
        name: "pesos",
        sample: "100 pesos",
        locales: ["en-PH"],
      },
      {
        name: "フィリピンペソ",
        sample: "100フィリピンペソ",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "PKR",
    names: [
      {
        name: "روپے",
        sample: "100 روپے",
        locales: ["ur-PK"],
      },
      {
        name: "rupees",
        sample: "100 rupees",
        locales: ["en-PK"],
      },
    ],
  },
  {
    code: "PLN",
    names: [
      {
        name: "złotych",
        sample: "100 złotych",
        locales: ["pl-PL"],
      },
    ],
  },
  {
    code: "PYG",
    names: [
      {
        name: "guaraníes",
        sample: "100 guaraníes",
        locales: ["es-PY"],
      },
    ],
  },
  {
    code: "QAR",
    names: [
      {
        name: "ريال",
        sample: "١٠٠ ريال",
        locales: ["ar-QA"],
      },
    ],
  },
  {
    code: "RON",
    names: [
      {
        name: "de lei",
        sample: "100 de lei",
        locales: ["ro-RO"],
      },
    ],
  },
  {
    code: "RSD",
    names: [
      {
        name: "динара",
        sample: "100 динара",
        locales: ["sr-RS"],
      },
      {
        name: "dinara",
        sample: "100 dinara",
        locales: ["sr-Latn-RS"],
      },
    ],
  },
  {
    code: "RUB",
    names: [
      {
        name: "рублей",
        sample: "100 рублей",
        locales: ["ru-RU"],
      },
      {
        name: "ルーブル",
        sample: "100ルーブル",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "RWF",
    names: [
      {
        name: "amafaranga",
        sample: "amafaranga 100",
        locales: ["rw-RW"],
      },
      {
        name: "francs",
        sample: "100 francs",
        locales: ["en-RW"],
      },
      {
        name: "francs",
        sample: "100 francs",
        locales: ["fr-RW"],
      },
    ],
  },
  {
    code: "SAR",
    names: [
      {
        name: "ريال",
        sample: "١٠٠ ريال",
        locales: ["ar-SA"],
      },
    ],
  },
  {
    code: "SBD",
    names: [
      {
        name: "dollars",
        sample: "100 dollars",
        locales: ["en-SB"],
      },
    ],
  },
  {
    code: "SCR",
    names: [
      {
        name: "roupies",
        sample: "100 roupies",
        locales: ["fr-SC"],
      },
      {
        name: "rupees",
        sample: "100 rupees",
        locales: ["en-SC"],
      },
    ],
  },
  {
    code: "SDG",
    names: [
      {
        name: "جنيه",
        sample: "١٠٠ جنيه",
        locales: ["ar-SD"],
      },
      {
        name: "pounds",
        sample: "100 pounds",
        locales: ["en-SD"],
      },
    ],
  },
  {
    code: "SEK",
    names: [
      {
        name: "kronor",
        sample: "100 kronor",
        locales: ["sv-SE"],
      },
    ],
  },
  {
    code: "SGD",
    names: [
      {
        name: "dollars",
        sample: "100 dollars",
        locales: ["en-SG"],
      },
      {
        name: "新元",
        sample: "100新元",
        locales: ["zh-SG"],
      },
      {
        name: "dolar",
        sample: "100 dolar",
        locales: ["ms-SG"],
      },
      {
        name: "டாலர்கள்",
        sample: "100 டாலர்கள்",
        locales: ["ta-SG"],
      },
      {
        name: "シンガポールドル",
        sample: "100シンガポールドル",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "SHP",
    names: [
      {
        name: "pounds",
        sample: "100 pounds",
        locales: ["en-SH"],
      },
      {
        name: "pounds",
        sample: "100 pounds",
        locales: ["en-AC"],
      },
    ],
  },
  {
    code: "SLE",
    names: [
      {
        name: "leones",
        sample: "100 leones",
        locales: ["en-SL"],
      },
    ],
  },
  {
    code: "SOS",
    names: [
      {
        name: "shilin",
        sample: "100 shilin",
        locales: ["so-SO"],
      },
      {
        name: "شلن",
        sample: "١٠٠ شلن",
        locales: ["ar-SO"],
      },
    ],
  },
  {
    code: "SRD",
    names: [
      {
        name: "dollar",
        sample: "100 dollar",
        locales: ["nl-SR"],
      },
    ],
  },
  {
    code: "SSP",
    names: [
      {
        name: "pounds",
        sample: "100 pounds",
        locales: ["en-SS"],
      },
    ],
  },
  {
    code: "STN",
    names: [
      {
        name: "dobras",
        sample: "100 dobras",
        locales: ["pt-ST"],
      },
    ],
  },
  {
    code: "SYP",
    names: [
      {
        name: "ليرة",
        sample: "١٠٠ ليرة",
        locales: ["ar-SY"],
      },
    ],
  },
  {
    code: "SZL",
    names: [
      {
        name: "emalangeni",
        sample: "100 emalangeni",
        locales: ["ss-SZ"],
      },
      {
        name: "emalangeni",
        sample: "100 emalangeni",
        locales: ["en-SZ"],
      },
    ],
  },
  {
    code: "THB",
    names: [
      {
        name: "บาท",
        sample: "100 บาท",
        locales: ["th-TH"],
      },
      {
        name: "バーツ",
        sample: "100バーツ",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "TJS",
    names: [
      {
        name: "сомонӣ",
        sample: "100 сомонӣ",
        locales: ["tg-TJ"],
      },
    ],
  },
  {
    code: "TMT",
    names: [
      {
        name: "manat",
        sample: "100 manat",
        locales: ["tk-TM"],
      },
    ],
  },
  {
    code: "TND",
    names: [
      {
        name: "دينار",
        sample: "100 دينار",
        locales: ["ar-TN"],
      },
      {
        name: "dinars",
        sample: "100 dinars",
        locales: ["fr-TN"],
      },
    ],
  },
  {
    code: "TOP",
    names: [
      {
        name: "Paʻanga",
        sample: "Paʻanga 100",
        locales: ["to-TO"],
      },
      {
        name: "paʻanga",
        sample: "100 paʻanga",
        locales: ["en-TO"],
      },
    ],
  },
  {
    code: "TRY",
    names: [
      {
        name: "lira",
        sample: "100 lira",
        locales: ["tr-TR"],
      },
      {
        name: "トルコリラ",
        sample: "100トルコリラ",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "TTD",
    names: [
      {
        name: "dollars",
        sample: "100 dollars",
        locales: ["en-TT"],
      },
    ],
  },
  {
    code: "TWD",
    names: [
      {
        name: "元",
        sample: "100元",
        locales: ["zh-TW"],
      },
      {
        name: "元",
        sample: "100元",
        locales: ["zh-Hant-TW"],
      },
      {
        name: "台湾ドル",
        sample: "100台湾ドル",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "TZS",
    names: [
      {
        name: "shilingi",
        sample: "shilingi 100",
        locales: ["sw-TZ"],
      },
      {
        name: "shillings",
        sample: "100 shillings",
        locales: ["en-TZ"],
      },
    ],
  },
  {
    code: "UAH",
    names: [
      {
        name: "гривень",
        sample: "100 гривень",
        locales: ["uk-UA"],
      },
      {
        name: "гривен",
        sample: "100 гривен",
        locales: ["ru-UA"],
      },
    ],
  },
  {
    code: "UGX",
    names: [
      {
        name: "shillings",
        sample: "100 shillings",
        locales: ["en-UG"],
      },
      {
        name: "shilingi",
        sample: "shilingi 100",
        locales: ["sw-UG"],
      },
    ],
  },
  {
    code: "USD",
    names: [
      {
        name: "dollars",
        sample: "100 dollars",
        locales: ["en-US", "en-AS", "en-GU", "en-MH", "en-MP", "en-PR", "en-UM", "en-VI"],
      },
      {
        name: "dollar",
        sample: "100 dollar",
        locales: ["nl-BQ"],
      },
      {
        name: "dollars",
        sample: "100 dollars",
        locales: ["en-DG", "en-FM", "en-IO", "en-PW", "en-TC", "en-VG", "en-ZW"],
      },
      {
        name: "dólares",
        sample: "100 dólares",
        locales: ["es-EC", "es-PR", "es-SV"],
      },
      {
        name: "dólar",
        sample: "100 dólar",
        locales: ["qu-EC"],
      },
      {
        name: "dollars",
        sample: "100 dollars",
        locales: ["fr-HT"],
      },
      {
        name: "dola",
        sample: "100 dola",
        locales: ["ht-HT"],
      },
      {
        name: "dólares",
        sample: "100 dólares",
        locales: ["es-PA"],
      },
      {
        name: "dólares",
        sample: "100 dólares",
        locales: ["pt-TL"],
      },
      {
        name: "dora",
        sample: "100 dora",
        locales: ["sn-ZW"],
      },
      {
        name: "dola",
        sample: "100 dola",
        locales: ["nd-ZW"],
      },
      {
        name: "ドル",
        sample: "100ドル",
        locales: ["ja-JP"],
      },
      {
        name: "米ドル",
        sample: "100米ドル",
        locales: ["ja-JP"],
      },
      {
        name: "USドル",
        sample: "100USドル",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "UYU",
    names: [
      {
        name: "pesos",
        sample: "100 pesos",
        locales: ["es-UY"],
      },
    ],
  },
  {
    code: "UZS",
    names: [
      {
        name: "soʻm",
        sample: "100 soʻm",
        locales: ["uz-UZ"],
      },
      {
        name: "сўм",
        sample: "100 сўм",
        locales: ["uz-Cyrl-UZ"],
      },
    ],
  },
  {
    code: "VES",
    names: [
      {
        name: "bolívares",
        sample: "100 bolívares",
        locales: ["es-VE"],
      },
    ],
  },
  {
    code: "VND",
    names: [
      {
        name: "đồng",
        sample: "100 đồng",
        locales: ["vi-VN"],
      },
      {
        name: "ベトナムドン",
        sample: "100ベトナムドン",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "VUV",
    names: [
      {
        name: "vatus",
        sample: "100 vatus",
        locales: ["fr-VU"],
      },
      {
        name: "vatu",
        sample: "100 vatu",
        locales: ["en-VU"],
      },
    ],
  },
  {
    code: "WST",
    names: [
      {
        name: "tala",
        sample: "100 tala",
        locales: ["en-WS"],
      },
    ],
  },
  {
    code: "XAF",
    names: [
      {
        name: "francs CFA",
        sample: "100 francs CFA",
        locales: ["fr-CM", "fr-CF", "fr-CG", "fr-GA", "fr-GQ", "fr-TD"],
      },
      {
        name: "farânga CFA",
        sample: "100 farânga CFA",
        locales: ["sg-CF"],
      },
      {
        name: "CFA francs",
        sample: "100 CFA francs",
        locales: ["en-CM"],
      },
      {
        name: "francos CFA",
        sample: "100 francos CFA",
        locales: ["es-GQ"],
      },
      {
        name: "francos CFA",
        sample: "100 francos CFA",
        locales: ["pt-GQ"],
      },
      {
        name: "فرنك CFA",
        sample: "١٠٠ فرنك CFA",
        locales: ["ar-TD"],
      },
    ],
  },
  {
    code: "XCD",
    names: [
      {
        name: "dollars",
        sample: "100 dollars",
        locales: ["en-AG", "en-AI", "en-DM", "en-GD", "en-KN", "en-LC", "en-MS", "en-VC"],
      },
    ],
  },
  {
    code: "XCG",
    names: [
      {
        name: "gulden",
        sample: "100 gulden",
        locales: ["nl-CW", "nl-SX"],
      },
      {
        name: "guilders",
        sample: "100 guilders",
        locales: ["en-SX"],
      },
      {
        name: "florin",
        sample: "100 florin",
        locales: ["pap-CW"],
      },
    ],
  },
  {
    code: "XOF",
    names: [
      {
        name: "francs CFA",
        sample: "100 francs CFA",
        locales: ["fr-SN", "fr-BF", "fr-BJ", "fr-CI", "fr-ML", "fr-NE", "fr-TG"],
      },
      {
        name: "francos CFA",
        sample: "100 francos CFA",
        locales: ["pt-GW"],
      },
      {
        name: "Franc CFA",
        sample: "100 Franc CFA",
        locales: ["wo-SN"],
      },
    ],
  },
  {
    code: "XPF",
    names: [
      {
        name: "francs CFP",
        sample: "100 francs CFP",
        locales: ["fr-PF", "fr-NC", "fr-WF"],
      },
    ],
  },
  {
    code: "YER",
    names: [
      {
        name: "ريال",
        sample: "١٠٠ ريال",
        locales: ["ar-YE"],
      },
    ],
  },
  {
    code: "ZAR",
    names: [
      {
        name: "rand",
        sample: "100 rand",
        locales: ["af-ZA"],
      },
      {
        name: "rand",
        sample: "100 rand",
        locales: ["en-LS"],
      },
      {
        name: "rand",
        sample: "100 rand",
        locales: ["en-NA"],
      },
      {
        name: "rand",
        sample: "100 rand",
        locales: ["en-ZA"],
      },
      {
        name: "南アフリカランド",
        sample: "100南アフリカランド",
        locales: ["ja-JP"],
      },
    ],
  },
  {
    code: "ZMW",
    names: [
      {
        name: "kwacha",
        sample: "100 kwacha",
        locales: ["en-ZM"],
      },
    ],
  },
  {
    code: "ZWG",
    names: [
      {
        name: "ZiG",
        sample: "ZiG100",
        locales: ["en-ZW"],
      },
    ],
  },
] as const satisfies readonly CurrencyLocalName[];
