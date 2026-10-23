import {
  currencyLocalNames,
  type CurrencyCode,
  type CurrencyLocalNameEntry,
} from "@cl/currency";

export interface SandboxCurrency {
  readonly code: CurrencyCode;
  readonly japaneseName: string;
  readonly englishName: string;
  readonly commonLocalName: string;
  readonly isoSample: string;
  readonly representations: readonly SandboxCurrencyRepresentation[];
  readonly sourceUrl: string;
}

export interface SandboxCurrencyRepresentation {
  readonly locales: readonly SandboxCurrencyLocale[];
  readonly symbolSamples: readonly string[];
  readonly localSample: string;
}

export interface SandboxCurrencyLocale {
  readonly language: string;
  readonly languageName: string;
  readonly regionName: string;
}

interface SandboxCurrencyRow extends Omit<
  SandboxCurrency,
  "commonLocalName" | "representations"
> {
  readonly representations: readonly SandboxCurrencyRepresentationRow[];
}

interface SandboxCurrencyRepresentationRow extends Omit<
  SandboxCurrencyRepresentation,
  "locales" | "localSample"
> {
  readonly localNameLocale: string;
  readonly locales: readonly SandboxCurrencyLocaleRow[];
}

interface SandboxCurrencyLocaleRow extends Omit<SandboxCurrencyLocale, "language"> {}

const sandboxCurrencyRows = [
  {
    code: "AED",
    japaneseName: "アラブ首長国連邦ディルハム",
    englishName: "United Arab Emirates dirham",
    isoSample: "AED 100",
    representations: [
      {
        localNameLocale: "ar-AE",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "アラブ首長国連邦",
          },
        ],
        symbolSamples: ["‏100 د.إ.‏"],
      },
    ],
    sourceUrl: "https://ar.wikipedia.org/wiki/درهم_إماراتي",
  },
  {
    code: "AFN",
    japaneseName: "アフガニスタン アフガニー",
    englishName: "Afghan afghani",
    isoSample: "AFN 100",
    representations: [
      {
        localNameLocale: "ps-AF",
        locales: [
          {
            languageName: "パシュトゥー語",
            regionName: "アフガニスタン",
          },
        ],
        symbolSamples: ["؋ ۱۰۰"],
      },
      {
        localNameLocale: "fa-AF",
        locales: [
          {
            languageName: "ペルシア語",
            regionName: "アフガニスタン",
          },
        ],
        symbolSamples: ["؋ ۱۰۰"],
      },
    ],
    sourceUrl: "https://ps.wikipedia.org/wiki/افغانۍ",
  },
  {
    code: "ALL",
    japaneseName: "アルバニア レク",
    englishName: "Albanian lek",
    isoSample: "ALL 100",
    representations: [
      {
        localNameLocale: "sq-AL",
        locales: [
          {
            languageName: "アルバニア語",
            regionName: "アルバニア",
          },
        ],
        symbolSamples: ["100 Lekë"],
      },
    ],
    sourceUrl: "https://sq.wikipedia.org/wiki/Leku_shqiptar",
  },
  {
    code: "AMD",
    japaneseName: "アルメニア ドラム",
    englishName: "Armenian dram",
    isoSample: "AMD 100",
    representations: [
      {
        localNameLocale: "hy-AM",
        locales: [
          {
            languageName: "アルメニア語",
            regionName: "アルメニア",
          },
        ],
        symbolSamples: ["100 ֏"],
      },
    ],
    sourceUrl: "https://hy.wikipedia.org/wiki/Հայկական_դրամ",
  },
  {
    code: "AOA",
    japaneseName: "アンゴラ クワンザ",
    englishName: "Angolan kwanza",
    isoSample: "AOA 100",
    representations: [
      {
        localNameLocale: "pt-AO",
        locales: [
          {
            languageName: "ポルトガル語",
            regionName: "アンゴラ",
          },
        ],
        symbolSamples: ["100 Kz"],
      },
    ],
    sourceUrl: "https://pt.wikipedia.org/wiki/Kwanza",
  },
  {
    code: "ARS",
    japaneseName: "アルゼンチン ペソ",
    englishName: "Argentine peso",
    isoSample: "ARS 100",
    representations: [
      {
        localNameLocale: "es-AR",
        locales: [
          {
            languageName: "スペイン語",
            regionName: "アルゼンチン",
          },
        ],
        symbolSamples: ["$ 100"],
      },
    ],
    sourceUrl: "https://es.wikipedia.org/wiki/Peso_(moneda_de_Argentina)",
  },
  {
    code: "AUD",
    japaneseName: "オーストラリア ドル",
    englishName: "Australian dollar",
    isoSample: "AUD 100",
    representations: [
      {
        localNameLocale: "en-AU",
        locales: [
          {
            languageName: "英語",
            regionName: "オーストラリア",
          },
          {
            languageName: "英語",
            regionName: "ココス(キーリング)諸島",
          },
          {
            languageName: "英語",
            regionName: "クリスマス島",
          },
          {
            languageName: "英語",
            regionName: "キリバス",
          },
          {
            languageName: "英語",
            regionName: "ノーフォーク島",
          },
          {
            languageName: "英語",
            regionName: "ナウル",
          },
          {
            languageName: "英語",
            regionName: "ツバル",
          },
        ],
        symbolSamples: ["$100"],
      },
      {
        localNameLocale: "en-HM",
        locales: [
          {
            languageName: "英語",
            regionName: "ハード島・マクドナルド諸島",
          },
        ],
        symbolSamples: ["A$ 100", "$100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Australian_dollar",
  },
  {
    code: "AWG",
    japaneseName: "アルバ フロリン",
    englishName: "Aruban florin",
    isoSample: "AWG 100",
    representations: [
      {
        localNameLocale: "nl-AW",
        locales: [
          {
            languageName: "オランダ語",
            regionName: "アルバ",
          },
        ],
        symbolSamples: ["Afl. 100"],
      },
    ],
    sourceUrl: "https://nl.wikipedia.org/wiki/Arubaanse_florin",
  },
  {
    code: "AZN",
    japaneseName: "アゼルバイジャン マナト",
    englishName: "Azerbaijani manat",
    isoSample: "AZN 100",
    representations: [
      {
        localNameLocale: "az-AZ",
        locales: [
          {
            languageName: "アゼルバイジャン語",
            regionName: "アゼルバイジャン",
          },
        ],
        symbolSamples: ["100 ₼"],
      },
    ],
    sourceUrl: "https://az.wikipedia.org/wiki/Azərbaycan_manatı",
  },
  {
    code: "BAM",
    japaneseName: "ボスニア・ヘルツェゴビナ 兌換マルク (BAM)",
    englishName: "Bosnia and Herzegovina convertible mark",
    isoSample: "BAM 100",
    representations: [
      {
        localNameLocale: "bs-BA",
        locales: [
          {
            languageName: "ボスニア語",
            regionName: "ボスニア・ヘルツェゴビナ",
          },
          {
            languageName: "セルビア語 (ラテン文字)",
            regionName: "ボスニア・ヘルツェゴビナ",
          },
        ],
        symbolSamples: ["100 KM"],
      },
      {
        localNameLocale: "bs-Cyrl-BA",
        locales: [
          {
            languageName: "ボスニア語 (キリル文字)",
            regionName: "ボスニア・ヘルツェゴビナ",
          },
        ],
        symbolSamples: ["100 КМ", "100 KM"],
      },
      {
        localNameLocale: "hr-BA",
        locales: [
          {
            languageName: "クロアチア語",
            regionName: "ボスニア・ヘルツェゴビナ",
          },
        ],
        symbolSamples: ["100 KM"],
      },
      {
        localNameLocale: "sr-BA",
        locales: [
          {
            languageName: "セルビア語",
            regionName: "ボスニア・ヘルツェゴビナ",
          },
        ],
        symbolSamples: ["100 КМ", "100 KM"],
      },
    ],
    sourceUrl: "https://bs.wikipedia.org/wiki/Konvertibilna_marka",
  },
  {
    code: "BBD",
    japaneseName: "バルバドス ドル",
    englishName: "Barbadian dollar",
    isoSample: "BBD 100",
    representations: [
      {
        localNameLocale: "en-BB",
        locales: [
          {
            languageName: "英語",
            regionName: "バルバドス",
          },
        ],
        symbolSamples: ["$100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Barbadian_dollar",
  },
  {
    code: "BDT",
    japaneseName: "バングラデシュ タカ",
    englishName: "Bangladeshi taka",
    isoSample: "BDT 100",
    representations: [
      {
        localNameLocale: "bn-BD",
        locales: [
          {
            languageName: "ベンガル語",
            regionName: "バングラデシュ",
          },
        ],
        symbolSamples: ["১০০৳"],
      },
    ],
    sourceUrl: "https://bn.wikipedia.org/wiki/বাংলাদেশী_টাকা",
  },
  {
    code: "BHD",
    japaneseName: "バーレーン ディナール",
    englishName: "Bahraini dinar",
    isoSample: "BHD 100",
    representations: [
      {
        localNameLocale: "ar-BH",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "バーレーン",
          },
        ],
        symbolSamples: ["‏١٠٠ د.ب.‏"],
      },
    ],
    sourceUrl: "https://ar.wikipedia.org/wiki/دينار_بحريني",
  },
  {
    code: "BIF",
    japaneseName: "ブルンジ フラン",
    englishName: "Burundian franc",
    isoSample: "BIF 100",
    representations: [
      {
        localNameLocale: "fr-BI",
        locales: [
          {
            languageName: "フランス語",
            regionName: "ブルンジ",
          },
        ],
        symbolSamples: ["100 FBu"],
      },
      {
        localNameLocale: "rn-BI",
        locales: [
          {
            languageName: "ルンディ語",
            regionName: "ブルンジ",
          },
        ],
        symbolSamples: ["FBu 100"],
      },
      {
        localNameLocale: "en-BI",
        locales: [
          {
            languageName: "英語",
            regionName: "ブルンジ",
          },
        ],
        symbolSamples: ["FBu 100"],
      },
    ],
    sourceUrl: "https://fr.wikipedia.org/wiki/Franc_burundais",
  },
  {
    code: "BMD",
    japaneseName: "バミューダ ドル",
    englishName: "Bermudian dollar",
    isoSample: "BMD 100",
    representations: [
      {
        localNameLocale: "en-BM",
        locales: [
          {
            languageName: "英語",
            regionName: "バミューダ",
          },
        ],
        symbolSamples: ["$100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Bermudian_dollar",
  },
  {
    code: "BND",
    japaneseName: "ブルネイ ドル",
    englishName: "Brunei dollar",
    isoSample: "BND 100",
    representations: [
      {
        localNameLocale: "ms-BN",
        locales: [
          {
            languageName: "マレー語",
            regionName: "ブルネイ",
          },
        ],
        symbolSamples: ["$ 100"],
      },
    ],
    sourceUrl: "https://ms.wikipedia.org/wiki/Ringgit_Brunei",
  },
  {
    code: "BOB",
    japaneseName: "ボリビア ボリビアーノ",
    englishName: "Bolivian boliviano",
    isoSample: "BOB 100",
    representations: [
      {
        localNameLocale: "es-BO",
        locales: [
          {
            languageName: "スペイン語",
            regionName: "ボリビア",
          },
        ],
        symbolSamples: ["Bs 100"],
      },
      {
        localNameLocale: "qu-BO",
        locales: [
          {
            languageName: "ケチュア語",
            regionName: "ボリビア",
          },
        ],
        symbolSamples: ["Bs 100"],
      },
    ],
    sourceUrl: "https://es.wikipedia.org/wiki/Boliviano_(moneda)",
  },
  {
    code: "BRL",
    japaneseName: "ブラジル レアル",
    englishName: "Brazilian real",
    isoSample: "BRL 100",
    representations: [
      {
        localNameLocale: "pt-BR",
        locales: [
          {
            languageName: "ポルトガル語",
            regionName: "ブラジル",
          },
        ],
        symbolSamples: ["R$ 100"],
      },
    ],
    sourceUrl: "https://pt.wikipedia.org/wiki/Real_(moeda_brasileira)",
  },
  {
    code: "BSD",
    japaneseName: "バハマ ドル",
    englishName: "Bahamian dollar",
    isoSample: "BSD 100",
    representations: [
      {
        localNameLocale: "en-BS",
        locales: [
          {
            languageName: "英語",
            regionName: "バハマ",
          },
        ],
        symbolSamples: ["$100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Bahamian_dollar",
  },
  {
    code: "BTN",
    japaneseName: "ブータン ニュルタム",
    englishName: "Bhutanese ngultrum",
    isoSample: "BTN 100",
    representations: [
      {
        localNameLocale: "dz-BT",
        locales: [
          {
            languageName: "ゾンカ語",
            regionName: "ブータン",
          },
        ],
        symbolSamples: ["Nu. ༡༠༠"],
      },
    ],
    sourceUrl: "https://dz.wikipedia.org/wiki/འབྲུག་གི་དངུལ་ཀྲམ།",
  },
  {
    code: "BWP",
    japaneseName: "ボツワナ プラ",
    englishName: "Botswana pula",
    isoSample: "BWP 100",
    representations: [
      {
        localNameLocale: "tn-BW",
        locales: [
          {
            languageName: "ツワナ語",
            regionName: "ボツワナ",
          },
        ],
        symbolSamples: ["P 100"],
      },
      {
        localNameLocale: "en-BW",
        locales: [
          {
            languageName: "英語",
            regionName: "ボツワナ",
          },
        ],
        symbolSamples: ["P 100"],
      },
    ],
    sourceUrl: "https://tn.wikipedia.org/wiki/Botswana_pula",
  },
  {
    code: "BYN",
    japaneseName: "ベラルーシ ルーブル",
    englishName: "Belarusian ruble",
    isoSample: "BYN 100",
    representations: [
      {
        localNameLocale: "be-BY",
        locales: [
          {
            languageName: "ベラルーシ語",
            regionName: "ベラルーシ",
          },
        ],
        symbolSamples: ["100 Br"],
      },
      {
        localNameLocale: "ru-BY",
        locales: [
          {
            languageName: "ロシア語",
            regionName: "ベラルーシ",
          },
        ],
        symbolSamples: ["100 Br"],
      },
    ],
    sourceUrl: "https://be.wikipedia.org/wiki/Беларускі_рубель",
  },
  {
    code: "BZD",
    japaneseName: "ベリーズ ドル",
    englishName: "Belize dollar",
    isoSample: "BZD 100",
    representations: [
      {
        localNameLocale: "en-BZ",
        locales: [
          {
            languageName: "英語",
            regionName: "ベリーズ",
          },
        ],
        symbolSamples: ["$100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Belize_dollar",
  },
  {
    code: "CAD",
    japaneseName: "カナダ ドル",
    englishName: "Canadian dollar",
    isoSample: "CAD 100",
    representations: [
      {
        localNameLocale: "en-CA",
        locales: [
          {
            languageName: "英語",
            regionName: "カナダ",
          },
        ],
        symbolSamples: ["$100"],
      },
      {
        localNameLocale: "fr-CA",
        locales: [
          {
            languageName: "フランス語",
            regionName: "カナダ",
          },
        ],
        symbolSamples: ["100 $"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Canadian_dollar",
  },
  {
    code: "CDF",
    japaneseName: "コンゴ フラン",
    englishName: "Congolese franc",
    isoSample: "CDF 100",
    representations: [
      {
        localNameLocale: "fr-CD",
        locales: [
          {
            languageName: "フランス語",
            regionName: "コンゴ民主共和国(キンシャサ)",
          },
        ],
        symbolSamples: ["100 FC"],
      },
    ],
    sourceUrl: "https://fr.wikipedia.org/wiki/Franc_congolais",
  },
  {
    code: "CHF",
    japaneseName: "スイス フラン",
    englishName: "Swiss franc",
    isoSample: "CHF 100",
    representations: [
      {
        localNameLocale: "de-CH",
        locales: [
          {
            languageName: "ドイツ語",
            regionName: "スイス",
          },
          {
            languageName: "ドイツ語",
            regionName: "リヒテンシュタイン",
          },
        ],
        symbolSamples: ["CHF 100", "Fr. 100"],
      },
      {
        localNameLocale: "gsw-CH",
        locales: [
          {
            languageName: "スイスドイツ語",
            regionName: "スイス",
          },
          {
            languageName: "スイスドイツ語",
            regionName: "リヒテンシュタイン",
          },
        ],
        symbolSamples: ["100 CHF"],
      },
      {
        localNameLocale: "fr-CH",
        locales: [
          {
            languageName: "フランス語",
            regionName: "スイス",
          },
        ],
        symbolSamples: ["100 CHF"],
      },
      {
        localNameLocale: "it-CH",
        locales: [
          {
            languageName: "イタリア語",
            regionName: "スイス",
          },
        ],
        symbolSamples: ["CHF 100"],
      },
    ],
    sourceUrl: "https://de.wikipedia.org/wiki/Schweizer_Franken",
  },
  {
    code: "CLP",
    japaneseName: "チリ ペソ",
    englishName: "Chilean peso",
    isoSample: "CLP 100",
    representations: [
      {
        localNameLocale: "es-CL",
        locales: [
          {
            languageName: "スペイン語",
            regionName: "チリ",
          },
        ],
        symbolSamples: ["$100"],
      },
    ],
    sourceUrl: "https://es.wikipedia.org/wiki/Peso_(moneda_de_Chile)",
  },
  {
    code: "CNY",
    japaneseName: "中国人民元",
    englishName: "Renminbi",
    isoSample: "CNY 100",
    representations: [
      {
        localNameLocale: "zh-CN",
        locales: [
          {
            languageName: "中国語",
            regionName: "中国",
          },
        ],
        symbolSamples: ["¥100"],
      },
    ],
    sourceUrl: "https://zh.wikipedia.org/wiki/人民币",
  },
  {
    code: "COP",
    japaneseName: "コロンビア ペソ",
    englishName: "Colombian peso",
    isoSample: "COP 100",
    representations: [
      {
        localNameLocale: "es-CO",
        locales: [
          {
            languageName: "スペイン語",
            regionName: "コロンビア",
          },
        ],
        symbolSamples: ["$ 100"],
      },
    ],
    sourceUrl: "https://es.wikipedia.org/wiki/Peso_(moneda_de_Colombia)",
  },
  {
    code: "CRC",
    japaneseName: "コスタリカ コロン",
    englishName: "Costa Rican colón",
    isoSample: "CRC 100",
    representations: [
      {
        localNameLocale: "es-CR",
        locales: [
          {
            languageName: "スペイン語",
            regionName: "コスタリカ",
          },
        ],
        symbolSamples: ["₡100"],
      },
    ],
    sourceUrl: "https://es.wikipedia.org/wiki/Colón_(moneda_de_Costa_Rica)",
  },
  {
    code: "CUP",
    japaneseName: "キューバ ペソ",
    englishName: "Cuban peso",
    isoSample: "CUP 100",
    representations: [
      {
        localNameLocale: "es-CU",
        locales: [
          {
            languageName: "スペイン語",
            regionName: "キューバ",
          },
        ],
        symbolSamples: ["$100"],
      },
    ],
    sourceUrl: "https://es.wikipedia.org/wiki/Peso_(moneda_de_Cuba)",
  },
  {
    code: "CVE",
    japaneseName: "カーボベルデ エスクード",
    englishName: "Cape Verdean escudo",
    isoSample: "CVE 100",
    representations: [
      {
        localNameLocale: "pt-CV",
        locales: [
          {
            languageName: "ポルトガル語",
            regionName: "カーボベルデ",
          },
        ],
        symbolSamples: ["100$00", "100 ​"],
      },
    ],
    sourceUrl: "https://pt.wikipedia.org/wiki/Escudo_cabo-verdiano",
  },
  {
    code: "CZK",
    japaneseName: "チェコ コルナ",
    englishName: "Czech koruna",
    isoSample: "CZK 100",
    representations: [
      {
        localNameLocale: "cs-CZ",
        locales: [
          {
            languageName: "チェコ語",
            regionName: "チェコ",
          },
        ],
        symbolSamples: ["100 Kč"],
      },
    ],
    sourceUrl: "https://cs.wikipedia.org/wiki/Koruna_česká",
  },
  {
    code: "DJF",
    japaneseName: "ジブチ フラン",
    englishName: "Djiboutian franc",
    isoSample: "DJF 100",
    representations: [
      {
        localNameLocale: "fr-DJ",
        locales: [
          {
            languageName: "フランス語",
            regionName: "ジブチ",
          },
        ],
        symbolSamples: ["100 Fdj"],
      },
      {
        localNameLocale: "ar-DJ",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "ジブチ",
          },
        ],
        symbolSamples: ["‏١٠٠ Fdj"],
      },
    ],
    sourceUrl: "https://fr.wikipedia.org/wiki/Franc_Djibouti",
  },
  {
    code: "DKK",
    japaneseName: "デンマーク クローネ",
    englishName: "Danish krone",
    isoSample: "DKK 100",
    representations: [
      {
        localNameLocale: "da-DK",
        locales: [
          {
            languageName: "デンマーク語",
            regionName: "デンマーク",
          },
        ],
        symbolSamples: ["100 kr."],
      },
      {
        localNameLocale: "fo-FO",
        locales: [
          {
            languageName: "フェロー語",
            regionName: "フェロー諸島",
          },
        ],
        symbolSamples: ["100 kr"],
      },
    ],
    sourceUrl: "https://da.wikipedia.org/wiki/Danske_kroner",
  },
  {
    code: "DOP",
    japaneseName: "ドミニカ ペソ",
    englishName: "Dominican peso",
    isoSample: "DOP 100",
    representations: [
      {
        localNameLocale: "es-DO",
        locales: [
          {
            languageName: "スペイン語",
            regionName: "ドミニカ共和国",
          },
        ],
        symbolSamples: ["RD$ 100", "$100"],
      },
    ],
    sourceUrl: "https://es.wikipedia.org/wiki/Peso_dominicano",
  },
  {
    code: "DZD",
    japaneseName: "アルジェリア ディナール",
    englishName: "Algerian dinar",
    isoSample: "DZD 100",
    representations: [
      {
        localNameLocale: "ar-DZ",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "アルジェリア",
          },
        ],
        symbolSamples: ["‏100 د.ج.‏"],
      },
      {
        localNameLocale: "fr-DZ",
        locales: [
          {
            languageName: "フランス語",
            regionName: "アルジェリア",
          },
        ],
        symbolSamples: ["100 DA"],
      },
    ],
    sourceUrl: "https://ar.wikipedia.org/wiki/دينار_جزائري",
  },
  {
    code: "EGP",
    japaneseName: "エジプト ポンド",
    englishName: "Egyptian pound",
    isoSample: "EGP 100",
    representations: [
      {
        localNameLocale: "ar-EG",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "エジプト",
          },
        ],
        symbolSamples: ["‏١٠٠ ج.م.‏", "‏١٠٠ E£"],
      },
    ],
    sourceUrl: "https://ar.wikipedia.org/wiki/جنيه_مصري",
  },
  {
    code: "ERN",
    japaneseName: "エリトリア ナクファ",
    englishName: "Eritrean nakfa",
    isoSample: "ERN 100",
    representations: [
      {
        localNameLocale: "ti-ER",
        locales: [
          {
            languageName: "ティグリニア語",
            regionName: "エリトリア",
          },
        ],
        symbolSamples: ["Nfk 100"],
      },
      {
        localNameLocale: "en-ER",
        locales: [
          {
            languageName: "英語",
            regionName: "エリトリア",
          },
        ],
        symbolSamples: ["Nfk 100"],
      },
      {
        localNameLocale: "ar-ER",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "エリトリア",
          },
        ],
        symbolSamples: ["‏١٠٠ Nfk"],
      },
    ],
    sourceUrl: "https://ti.wikipedia.org/wiki/ናቕፋ_(ባጤራ)",
  },
  {
    code: "ETB",
    japaneseName: "エチオピア ブル",
    englishName: "Ethiopian birr",
    isoSample: "ETB 100",
    representations: [
      {
        localNameLocale: "am-ET",
        locales: [
          {
            languageName: "アムハラ語",
            regionName: "エチオピア",
          },
        ],
        symbolSamples: ["ብር 100"],
      },
    ],
    sourceUrl: "https://am.wikipedia.org/wiki/የኢትዮጵያ_ብር",
  },
  {
    code: "EUR",
    japaneseName: "ユーロ",
    englishName: "Euro",
    isoSample: "EUR 100",
    representations: [
      {
        localNameLocale: "de-DE",
        locales: [
          {
            languageName: "ドイツ語",
            regionName: "ドイツ",
          },
          {
            languageName: "ドイツ語",
            regionName: "ベルギー",
          },
          {
            languageName: "ドイツ語",
            regionName: "ルクセンブルク",
          },
          {
            languageName: "ルクセンブルク語",
            regionName: "ルクセンブルク",
          },
        ],
        symbolSamples: ["100 €"],
      },
      {
        localNameLocale: "ca-AD",
        locales: [
          {
            languageName: "カタロニア語",
            regionName: "アンドラ",
          },
          {
            languageName: "スペイン語",
            regionName: "セウタ・メリリャ",
          },
          {
            languageName: "スペイン語",
            regionName: "スペイン",
          },
          {
            languageName: "スペイン語",
            regionName: "カナリア諸島",
          },
          {
            languageName: "フランス語",
            regionName: "ベルギー",
          },
          {
            languageName: "フランス語",
            regionName: "サン・バルテルミー",
          },
          {
            languageName: "フランス語",
            regionName: "フランス",
          },
          {
            languageName: "フランス語",
            regionName: "仏領ギアナ",
          },
          {
            languageName: "フランス語",
            regionName: "グアドループ",
          },
          {
            languageName: "フランス語",
            regionName: "ルクセンブルク",
          },
          {
            languageName: "フランス語",
            regionName: "モナコ",
          },
          {
            languageName: "フランス語",
            regionName: "サン・マルタン",
          },
          {
            languageName: "フランス語",
            regionName: "マルティニーク",
          },
          {
            languageName: "フランス語",
            regionName: "サンピエール島・ミクロン島",
          },
          {
            languageName: "フランス語",
            regionName: "レユニオン",
          },
          {
            languageName: "フランス語",
            regionName: "仏領極南諸島",
          },
          {
            languageName: "フランス語",
            regionName: "マヨット",
          },
          {
            languageName: "ポルトガル語",
            regionName: "ポルトガル",
          },
        ],
        symbolSamples: ["100 €"],
      },
      {
        localNameLocale: "de-AT",
        locales: [
          {
            languageName: "ドイツ語",
            regionName: "オーストリア",
          },
        ],
        symbolSamples: ["€ 100"],
      },
      {
        localNameLocale: "it-IT",
        locales: [
          {
            languageName: "イタリア語",
            regionName: "イタリア",
          },
          {
            languageName: "イタリア語",
            regionName: "サンマリノ",
          },
          {
            languageName: "イタリア語",
            regionName: "バチカン市国",
          },
          {
            languageName: "アルバニア語",
            regionName: "コソボ",
          },
          {
            languageName: "スウェーデン語",
            regionName: "オーランド諸島",
          },
          {
            languageName: "スウェーデン語",
            regionName: "フィンランド",
          },
        ],
        symbolSamples: ["100 €"],
      },
      {
        localNameLocale: "nl-BE",
        locales: [
          {
            languageName: "オランダ語",
            regionName: "ベルギー",
          },
          {
            languageName: "オランダ語",
            regionName: "オランダ",
          },
        ],
        symbolSamples: ["€ 100"],
      },
      {
        localNameLocale: "bg-BG",
        locales: [
          {
            languageName: "ブルガリア語",
            regionName: "ブルガリア",
          },
        ],
        symbolSamples: ["100 €"],
      },
      {
        localNameLocale: "el-CY",
        locales: [
          {
            languageName: "ギリシャ語",
            regionName: "キプロス",
          },
          {
            languageName: "ギリシャ語",
            regionName: "ギリシャ",
          },
        ],
        symbolSamples: ["100 €"],
      },
      {
        localNameLocale: "tr-CY",
        locales: [
          {
            languageName: "トルコ語",
            regionName: "キプロス",
          },
        ],
        symbolSamples: ["€100"],
      },
      {
        localNameLocale: "et-EE",
        locales: [
          {
            languageName: "エストニア語",
            regionName: "エストニア",
          },
        ],
        symbolSamples: ["100 €"],
      },
      {
        localNameLocale: "fi-FI",
        locales: [
          {
            languageName: "フィンランド語",
            regionName: "フィンランド",
          },
        ],
        symbolSamples: ["100 €"],
      },
      {
        localNameLocale: "hr-HR",
        locales: [
          {
            languageName: "クロアチア語",
            regionName: "クロアチア",
          },
        ],
        symbolSamples: ["100 €"],
      },
      {
        localNameLocale: "en-IE",
        locales: [
          {
            languageName: "英語",
            regionName: "アイルランド",
          },
          {
            languageName: "英語",
            regionName: "マルタ",
          },
        ],
        symbolSamples: ["€100"],
      },
      {
        localNameLocale: "ga-IE",
        locales: [
          {
            languageName: "アイルランド語",
            regionName: "アイルランド",
          },
        ],
        symbolSamples: ["€100"],
      },
      {
        localNameLocale: "lt-LT",
        locales: [
          {
            languageName: "リトアニア語",
            regionName: "リトアニア",
          },
        ],
        symbolSamples: ["100 €"],
      },
      {
        localNameLocale: "lv-LV",
        locales: [
          {
            languageName: "ラトビア語",
            regionName: "ラトビア",
          },
        ],
        symbolSamples: ["100 €"],
      },
      {
        localNameLocale: "sr-Latn-ME",
        locales: [
          {
            languageName: "セルビア語 (ラテン文字)",
            regionName: "モンテネグロ",
          },
          {
            languageName: "セルビア語 (ラテン文字)",
            regionName: "コソボ",
          },
        ],
        symbolSamples: ["100 €"],
      },
      {
        localNameLocale: "mt-MT",
        locales: [
          {
            languageName: "マルタ語",
            regionName: "マルタ",
          },
        ],
        symbolSamples: ["€100"],
      },
      {
        localNameLocale: "sl-SI",
        locales: [
          {
            languageName: "スロベニア語",
            regionName: "スロベニア",
          },
        ],
        symbolSamples: ["100 €"],
      },
      {
        localNameLocale: "sk-SK",
        locales: [
          {
            languageName: "スロバキア語",
            regionName: "スロバキア",
          },
        ],
        symbolSamples: ["100 €"],
      },
      {
        localNameLocale: "sr-XK",
        locales: [
          {
            languageName: "セルビア語",
            regionName: "コソボ",
          },
        ],
        symbolSamples: ["100 €"],
      },
    ],
    sourceUrl: "https://de.wikipedia.org/wiki/Euro",
  },
  {
    code: "FJD",
    japaneseName: "フィジー ドル",
    englishName: "Fijian dollar",
    isoSample: "FJD 100",
    representations: [
      {
        localNameLocale: "en-FJ",
        locales: [
          {
            languageName: "英語",
            regionName: "フィジー",
          },
        ],
        symbolSamples: ["$100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Fijian_dollar",
  },
  {
    code: "FKP",
    japaneseName: "フォークランド（マルビナス）諸島 ポンド",
    englishName: "Falkland Islands pound",
    isoSample: "FKP 100",
    representations: [
      {
        localNameLocale: "en-FK",
        locales: [
          {
            languageName: "英語",
            regionName: "フォークランド諸島",
          },
        ],
        symbolSamples: ["£100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Falkland_Islands_pound",
  },
  {
    code: "GBP",
    japaneseName: "英国ポンド",
    englishName: "Sterling",
    isoSample: "GBP 100",
    representations: [
      {
        localNameLocale: "en-GB",
        locales: [
          {
            languageName: "英語",
            regionName: "イギリス",
          },
          {
            languageName: "英語",
            regionName: "サウスジョージア・サウスサンドウィッチ諸島",
          },
          {
            languageName: "英語",
            regionName: "トリスタン・ダ・クーニャ",
          },
        ],
        symbolSamples: ["£100"],
      },
      {
        localNameLocale: "en-GG",
        locales: [
          {
            languageName: "英語",
            regionName: "ガーンジー",
          },
          {
            languageName: "英語",
            regionName: "マン島",
          },
          {
            languageName: "英語",
            regionName: "ジャージー",
          },
        ],
        symbolSamples: ["£100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Pound_sterling",
  },
  {
    code: "GEL",
    japaneseName: "ジョージア ラリ",
    englishName: "Georgian lari",
    isoSample: "GEL 100",
    representations: [
      {
        localNameLocale: "ka-GE",
        locales: [
          {
            languageName: "ジョージア語",
            regionName: "ジョージア",
          },
        ],
        symbolSamples: ["100 ₾"],
      },
    ],
    sourceUrl: "https://ka.wikipedia.org/wiki/ლარი",
  },
  {
    code: "GHS",
    japaneseName: "ガーナ セディ",
    englishName: "Ghanaian cedi",
    isoSample: "GHS 100",
    representations: [
      {
        localNameLocale: "en-GH",
        locales: [
          {
            languageName: "英語",
            regionName: "ガーナ",
          },
        ],
        symbolSamples: ["GH₵ 100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Ghanaian_cedi",
  },
  {
    code: "GIP",
    japaneseName: "ジブラルタル ポンド",
    englishName: "Gibraltar pound",
    isoSample: "GIP 100",
    representations: [
      {
        localNameLocale: "en-GI",
        locales: [
          {
            languageName: "英語",
            regionName: "ジブラルタル",
          },
        ],
        symbolSamples: ["£100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Gibraltar_pound",
  },
  {
    code: "GMD",
    japaneseName: "ガンビア ダラシ",
    englishName: "Gambian dalasi",
    isoSample: "GMD 100",
    representations: [
      {
        localNameLocale: "en-GM",
        locales: [
          {
            languageName: "英語",
            regionName: "ガンビア",
          },
        ],
        symbolSamples: ["D 100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Gambian_dalasi",
  },
  {
    code: "GNF",
    japaneseName: "ギニア フラン",
    englishName: "Guinean franc",
    isoSample: "GNF 100",
    representations: [
      {
        localNameLocale: "fr-GN",
        locales: [
          {
            languageName: "フランス語",
            regionName: "ギニア",
          },
        ],
        symbolSamples: ["100 FG"],
      },
    ],
    sourceUrl: "https://fr.wikipedia.org/wiki/Franc_guinéen",
  },
  {
    code: "GTQ",
    japaneseName: "グアテマラ ケツァル",
    englishName: "Guatemalan quetzal",
    isoSample: "GTQ 100",
    representations: [
      {
        localNameLocale: "es-GT",
        locales: [
          {
            languageName: "スペイン語",
            regionName: "グアテマラ",
          },
        ],
        symbolSamples: ["Q 100"],
      },
    ],
    sourceUrl: "https://es.wikipedia.org/wiki/Quetzal_(moneda)",
  },
  {
    code: "GYD",
    japaneseName: "ガイアナ ドル",
    englishName: "Guyanese dollar",
    isoSample: "GYD 100",
    representations: [
      {
        localNameLocale: "en-GY",
        locales: [
          {
            languageName: "英語",
            regionName: "ガイアナ",
          },
        ],
        symbolSamples: ["$100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Guyanese_dollar",
  },
  {
    code: "HKD",
    japaneseName: "香港ドル",
    englishName: "Hong Kong dollar",
    isoSample: "HKD 100",
    representations: [
      {
        localNameLocale: "zh-HK",
        locales: [
          {
            languageName: "中国語",
            regionName: "中華人民共和国香港特別行政区",
          },
        ],
        symbolSamples: ["HK$ 100", "$100"],
      },
      {
        localNameLocale: "zh-Hant-HK",
        locales: [
          {
            languageName: "繁体中国語",
            regionName: "中華人民共和国香港特別行政区",
          },
        ],
        symbolSamples: ["HK$ 100", "$100"],
      },
      {
        localNameLocale: "en-HK",
        locales: [
          {
            languageName: "英語",
            regionName: "中華人民共和国香港特別行政区",
          },
        ],
        symbolSamples: ["HK$ 100", "$100"],
      },
    ],
    sourceUrl: "https://zh.wikipedia.org/wiki/港元",
  },
  {
    code: "HNL",
    japaneseName: "ホンジュラス レンピラ",
    englishName: "Honduran lempira",
    isoSample: "HNL 100",
    representations: [
      {
        localNameLocale: "es-HN",
        locales: [
          {
            languageName: "スペイン語",
            regionName: "ホンジュラス",
          },
        ],
        symbolSamples: ["L 100"],
      },
    ],
    sourceUrl: "https://es.wikipedia.org/wiki/Lempira_(moneda)",
  },
  {
    code: "HTG",
    japaneseName: "ハイチ グールド",
    englishName: "Haitian gourde",
    isoSample: "HTG 100",
    representations: [
      {
        localNameLocale: "ht-HT",
        locales: [
          {
            languageName: "ハイチ・クレオール語",
            regionName: "ハイチ",
          },
        ],
        symbolSamples: ["100 G"],
      },
      {
        localNameLocale: "fr-HT",
        locales: [
          {
            languageName: "フランス語",
            regionName: "ハイチ",
          },
        ],
        symbolSamples: ["100 G"],
      },
    ],
    sourceUrl: "https://ht.wikipedia.org/wiki/Goud",
  },
  {
    code: "HUF",
    japaneseName: "ハンガリー フォリント",
    englishName: "Hungarian forint",
    isoSample: "HUF 100",
    representations: [
      {
        localNameLocale: "hu-HU",
        locales: [
          {
            languageName: "ハンガリー語",
            regionName: "ハンガリー",
          },
        ],
        symbolSamples: ["100 Ft"],
      },
    ],
    sourceUrl: "https://hu.wikipedia.org/wiki/Magyar_forint",
  },
  {
    code: "IDR",
    japaneseName: "インドネシア ルピア",
    englishName: "Indonesian rupiah",
    isoSample: "IDR 100",
    representations: [
      {
        localNameLocale: "id-ID",
        locales: [
          {
            languageName: "インドネシア語",
            regionName: "インドネシア",
          },
        ],
        symbolSamples: ["Rp 100"],
      },
    ],
    sourceUrl: "https://id.wikipedia.org/wiki/Rupiah",
  },
  {
    code: "ILS",
    japaneseName: "イスラエル新シェケル",
    englishName: "Israeli new shekel",
    isoSample: "ILS 100",
    representations: [
      {
        localNameLocale: "he-IL",
        locales: [
          {
            languageName: "ヘブライ語",
            regionName: "イスラエル",
          },
        ],
        symbolSamples: ["‏100 ‏₪"],
      },
      {
        localNameLocale: "ar-IL",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "イスラエル",
          },
          {
            languageName: "アラビア語",
            regionName: "パレスチナ自治区",
          },
        ],
        symbolSamples: ["‏١٠٠ ₪"],
      },
    ],
    sourceUrl: "https://he.wikipedia.org/wiki/שקל_חדש",
  },
  {
    code: "INR",
    japaneseName: "インド ルピー",
    englishName: "Indian rupee",
    isoSample: "INR 100",
    representations: [
      {
        localNameLocale: "hi-IN",
        locales: [
          {
            languageName: "ヒンディー語",
            regionName: "インド",
          },
        ],
        symbolSamples: ["₹100"],
      },
      {
        localNameLocale: "dz-BT",
        locales: [
          {
            languageName: "ゾンカ語",
            regionName: "ブータン",
          },
        ],
        symbolSamples: ["₹༡༠༠"],
      },
      {
        localNameLocale: "en-IN",
        locales: [
          {
            languageName: "英語",
            regionName: "インド",
          },
        ],
        symbolSamples: ["₹100"],
      },
    ],
    sourceUrl: "https://hi.wikipedia.org/wiki/भारतीय_रुपया",
  },
  {
    code: "IQD",
    japaneseName: "イラク ディナール",
    englishName: "Iraqi dinar",
    isoSample: "IQD 100",
    representations: [
      {
        localNameLocale: "ar-IQ",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "イラク",
          },
        ],
        symbolSamples: ["‏١٠٠ د.ع.‏"],
      },
    ],
    sourceUrl: "https://ar.wikipedia.org/wiki/دينار_عراقي",
  },
  {
    code: "IRR",
    japaneseName: "イラン リアル",
    englishName: "Iranian rial",
    isoSample: "IRR 100",
    representations: [
      {
        localNameLocale: "fa-IR",
        locales: [
          {
            languageName: "ペルシア語",
            regionName: "イラン",
          },
        ],
        symbolSamples: ["‎ریال ۱۰۰"],
      },
    ],
    sourceUrl: "https://fa.wikipedia.org/wiki/ریال_ایران",
  },
  {
    code: "ISK",
    japaneseName: "アイスランド クローナ",
    englishName: "Icelandic króna",
    isoSample: "ISK 100",
    representations: [
      {
        localNameLocale: "is-IS",
        locales: [
          {
            languageName: "アイスランド語",
            regionName: "アイスランド",
          },
        ],
        symbolSamples: ["100 kr."],
      },
    ],
    sourceUrl: "https://is.wikipedia.org/wiki/Íslensk_króna",
  },
  {
    code: "JMD",
    japaneseName: "ジャマイカ ドル",
    englishName: "Jamaican dollar",
    isoSample: "JMD 100",
    representations: [
      {
        localNameLocale: "en-JM",
        locales: [
          {
            languageName: "英語",
            regionName: "ジャマイカ",
          },
        ],
        symbolSamples: ["$100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Jamaican_dollar",
  },
  {
    code: "JOD",
    japaneseName: "ヨルダン ディナール",
    englishName: "Jordanian dinar",
    isoSample: "JOD 100",
    representations: [
      {
        localNameLocale: "ar-JO",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "ヨルダン",
          },
          {
            languageName: "アラビア語",
            regionName: "パレスチナ自治区",
          },
        ],
        symbolSamples: ["‏١٠٠ د.أ.‏"],
      },
    ],
    sourceUrl: "https://ar.wikipedia.org/wiki/دينار_أردني",
  },
  {
    code: "JPY",
    japaneseName: "日本円",
    englishName: "Japanese yen",
    isoSample: "JPY 100",
    representations: [
      {
        localNameLocale: "ja-JP",
        locales: [
          {
            languageName: "日本語",
            regionName: "日本",
          },
        ],
        symbolSamples: ["￥100"],
      },
    ],
    sourceUrl: "https://ja.wikipedia.org/wiki/円_(通貨)",
  },
  {
    code: "KES",
    japaneseName: "ケニア シリング",
    englishName: "Kenyan shilling",
    isoSample: "KES 100",
    representations: [
      {
        localNameLocale: "sw-KE",
        locales: [
          {
            languageName: "スワヒリ語",
            regionName: "ケニア",
          },
        ],
        symbolSamples: ["Ksh 100"],
      },
      {
        localNameLocale: "en-KE",
        locales: [
          {
            languageName: "英語",
            regionName: "ケニア",
          },
        ],
        symbolSamples: ["Ksh 100"],
      },
    ],
    sourceUrl: "https://sw.wikipedia.org/wiki/Shilingi_ya_Kenya",
  },
  {
    code: "KGS",
    japaneseName: "キルギス ソム",
    englishName: "Kyrgyz som",
    isoSample: "KGS 100",
    representations: [
      {
        localNameLocale: "ky-KG",
        locales: [
          {
            languageName: "キルギス語",
            regionName: "キルギス",
          },
        ],
        symbolSamples: ["100 сом", "100 ⃀"],
      },
      {
        localNameLocale: "ru-KG",
        locales: [
          {
            languageName: "ロシア語",
            regionName: "キルギス",
          },
        ],
        symbolSamples: ["100 сом", "100 ⃀"],
      },
    ],
    sourceUrl: "https://ky.wikipedia.org/wiki/Кыргыз_сому",
  },
  {
    code: "KHR",
    japaneseName: "カンボジア リエル",
    englishName: "Cambodian riel",
    isoSample: "KHR 100",
    representations: [
      {
        localNameLocale: "km-KH",
        locales: [
          {
            languageName: "クメール語",
            regionName: "カンボジア",
          },
        ],
        symbolSamples: ["100៛"],
      },
    ],
    sourceUrl: "https://km.wikipedia.org/wiki/រៀល_(រូបិយវត្ថុ)",
  },
  {
    code: "KMF",
    japaneseName: "コモロ フラン",
    englishName: "Comorian franc",
    isoSample: "KMF 100",
    representations: [
      {
        localNameLocale: "ar-KM",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "コモロ",
          },
        ],
        symbolSamples: ["‏١٠٠ CF"],
      },
      {
        localNameLocale: "fr-KM",
        locales: [
          {
            languageName: "フランス語",
            regionName: "コモロ",
          },
        ],
        symbolSamples: ["100 CF", "100 FC"],
      },
    ],
    sourceUrl: "https://ar.wikipedia.org/wiki/فرنك_قمري",
  },
  {
    code: "KPW",
    japaneseName: "北朝鮮ウォン",
    englishName: "North Korean won",
    isoSample: "KPW 100",
    representations: [
      {
        localNameLocale: "ko-KP",
        locales: [
          {
            languageName: "韓国語",
            regionName: "北朝鮮",
          },
        ],
        symbolSamples: ["KPW 100", "₩100"],
      },
    ],
    sourceUrl: "https://ko.wikipedia.org/wiki/조선민주주의인민공화국_원",
  },
  {
    code: "KRW",
    japaneseName: "韓国ウォン",
    englishName: "South Korean won",
    isoSample: "KRW 100",
    representations: [
      {
        localNameLocale: "ko-KR",
        locales: [
          {
            languageName: "韓国語",
            regionName: "韓国",
          },
        ],
        symbolSamples: ["₩100"],
      },
    ],
    sourceUrl: "https://ko.wikipedia.org/wiki/대한민국_원",
  },
  {
    code: "KWD",
    japaneseName: "クウェート ディナール",
    englishName: "Kuwaiti dinar",
    isoSample: "KWD 100",
    representations: [
      {
        localNameLocale: "ar-KW",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "クウェート",
          },
        ],
        symbolSamples: ["‏١٠٠ د.ك.‏"],
      },
    ],
    sourceUrl: "https://ar.wikipedia.org/wiki/دينار_كويتي",
  },
  {
    code: "KYD",
    japaneseName: "ケイマン諸島 ドル",
    englishName: "Cayman Islands dollar",
    isoSample: "KYD 100",
    representations: [
      {
        localNameLocale: "en-KY",
        locales: [
          {
            languageName: "英語",
            regionName: "ケイマン諸島",
          },
        ],
        symbolSamples: ["$100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Cayman_Islands_dollar",
  },
  {
    code: "KZT",
    japaneseName: "カザフスタン テンゲ",
    englishName: "Kazakhstani tenge",
    isoSample: "KZT 100",
    representations: [
      {
        localNameLocale: "kk-KZ",
        locales: [
          {
            languageName: "カザフ語",
            regionName: "カザフスタン",
          },
        ],
        symbolSamples: ["100 ₸"],
      },
      {
        localNameLocale: "ru-KZ",
        locales: [
          {
            languageName: "ロシア語",
            regionName: "カザフスタン",
          },
        ],
        symbolSamples: ["100 ₸"],
      },
    ],
    sourceUrl: "https://kk.wikipedia.org/wiki/Қазақстан_теңгесі",
  },
  {
    code: "LAK",
    japaneseName: "ラオス キープ",
    englishName: "Lao kip",
    isoSample: "LAK 100",
    representations: [
      {
        localNameLocale: "lo-LA",
        locales: [
          {
            languageName: "ラオ語",
            regionName: "ラオス",
          },
        ],
        symbolSamples: ["₭100"],
      },
    ],
    sourceUrl: "https://lo.wikipedia.org/wiki/ກີບ_(ສະກຸນເງິນ)",
  },
  {
    code: "LBP",
    japaneseName: "レバノン ポンド",
    englishName: "Lebanese pound",
    isoSample: "LBP 100",
    representations: [
      {
        localNameLocale: "ar-LB",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "レバノン",
          },
        ],
        symbolSamples: ["‏١٠٠ ل.ل.‏", "‏١٠٠ L£"],
      },
    ],
    sourceUrl: "https://ar.wikipedia.org/wiki/ليرة_لبنانية",
  },
  {
    code: "LKR",
    japaneseName: "スリランカ ルピー",
    englishName: "Sri Lankan rupee",
    isoSample: "LKR 100",
    representations: [
      {
        localNameLocale: "si-LK",
        locales: [
          {
            languageName: "シンハラ語",
            regionName: "スリランカ",
          },
        ],
        symbolSamples: ["රු. 100"],
      },
      {
        localNameLocale: "ta-LK",
        locales: [
          {
            languageName: "タミル語",
            regionName: "スリランカ",
          },
        ],
        symbolSamples: ["Rs. 100", "Rs 100"],
      },
    ],
    sourceUrl: "https://si.wikipedia.org/wiki/ශ්‍රී_ලංකා_රුපියල",
  },
  {
    code: "LRD",
    japaneseName: "リベリア ドル",
    englishName: "Liberian dollar",
    isoSample: "LRD 100",
    representations: [
      {
        localNameLocale: "en-LR",
        locales: [
          {
            languageName: "英語",
            regionName: "リベリア",
          },
        ],
        symbolSamples: ["$100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Liberian_dollar",
  },
  {
    code: "LSL",
    japaneseName: "レソト ロティ",
    englishName: "Lesotho loti",
    isoSample: "LSL 100",
    representations: [
      {
        localNameLocale: "en-LS",
        locales: [
          {
            languageName: "英語",
            regionName: "レソト",
          },
        ],
        symbolSamples: ["M100", "LSL 100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Lesotho_loti",
  },
  {
    code: "LYD",
    japaneseName: "リビア ディナール",
    englishName: "Libyan dinar",
    isoSample: "LYD 100",
    representations: [
      {
        localNameLocale: "ar-LY",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "リビア",
          },
        ],
        symbolSamples: ["‏100 د.ل.‏"],
      },
    ],
    sourceUrl: "https://ar.wikipedia.org/wiki/دينار_ليبي",
  },
  {
    code: "MAD",
    japaneseName: "モロッコ ディルハム",
    englishName: "Moroccan dirham",
    isoSample: "MAD 100",
    representations: [
      {
        localNameLocale: "ar-MA",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "モロッコ",
          },
          {
            languageName: "アラビア語",
            regionName: "西サハラ",
          },
        ],
        symbolSamples: ["‏100 د.م.‏"],
      },
      {
        localNameLocale: "fr-MA",
        locales: [
          {
            languageName: "フランス語",
            regionName: "モロッコ",
          },
        ],
        symbolSamples: ["100 MAD"],
      },
      {
        localNameLocale: "tzm-MA",
        locales: [
          {
            languageName: "中央アトラス・タマジクト語",
            regionName: "モロッコ",
          },
        ],
        symbolSamples: ["100 MAD"],
      },
    ],
    sourceUrl: "https://ar.wikipedia.org/wiki/درهم_مغربي",
  },
  {
    code: "MDL",
    japaneseName: "モルドバ レイ",
    englishName: "Moldovan leu",
    isoSample: "MDL 100",
    representations: [
      {
        localNameLocale: "ro-MD",
        locales: [
          {
            languageName: "ルーマニア語",
            regionName: "モルドバ",
          },
        ],
        symbolSamples: ["100 L"],
      },
    ],
    sourceUrl: "https://ro.wikipedia.org/wiki/Leu_moldovenesc",
  },
  {
    code: "MGA",
    japaneseName: "マダガスカル アリアリ",
    englishName: "Malagasy ariary",
    isoSample: "MGA 100",
    representations: [
      {
        localNameLocale: "mg-MG",
        locales: [
          {
            languageName: "マダガスカル語",
            regionName: "マダガスカル",
          },
        ],
        symbolSamples: ["Ar 100"],
      },
      {
        localNameLocale: "fr-MG",
        locales: [
          {
            languageName: "フランス語",
            regionName: "マダガスカル",
          },
        ],
        symbolSamples: ["100 Ar"],
      },
      {
        localNameLocale: "en-MG",
        locales: [
          {
            languageName: "英語",
            regionName: "マダガスカル",
          },
        ],
        symbolSamples: ["Ar 100"],
      },
    ],
    sourceUrl: "https://mg.wikipedia.org/wiki/Ariary",
  },
  {
    code: "MKD",
    japaneseName: "マケドニア デナル",
    englishName: "Macedonian denar",
    isoSample: "MKD 100",
    representations: [
      {
        localNameLocale: "mk-MK",
        locales: [
          {
            languageName: "マケドニア語",
            regionName: "北マケドニア",
          },
        ],
        symbolSamples: ["100 ден."],
      },
    ],
    sourceUrl: "https://mk.wikipedia.org/wiki/Македонски_денар",
  },
  {
    code: "MMK",
    japaneseName: "ミャンマー チャット",
    englishName: "Burmese kyat",
    isoSample: "MMK 100",
    representations: [
      {
        localNameLocale: "my-MM",
        locales: [
          {
            languageName: "ミャンマー語",
            regionName: "ミャンマー (ビルマ)",
          },
        ],
        symbolSamples: ["၁၀၀ K"],
      },
    ],
    sourceUrl: "https://my.wikipedia.org/wiki/မြန်မာကျပ်ငွေ",
  },
  {
    code: "MNT",
    japaneseName: "モンゴル トグログ",
    englishName: "Mongolian tögrög",
    isoSample: "MNT 100",
    representations: [
      {
        localNameLocale: "mn-MN",
        locales: [
          {
            languageName: "モンゴル語",
            regionName: "モンゴル",
          },
        ],
        symbolSamples: ["₮ 100"],
      },
    ],
    sourceUrl: "https://mn.wikipedia.org/wiki/Төгрөг",
  },
  {
    code: "MOP",
    japaneseName: "マカオ パタカ",
    englishName: "Macanese pataca",
    isoSample: "MOP 100",
    representations: [
      {
        localNameLocale: "zh-MO",
        locales: [
          {
            languageName: "中国語",
            regionName: "中華人民共和国マカオ特別行政区",
          },
        ],
        symbolSamples: ["MOP 100"],
      },
      {
        localNameLocale: "zh-Hant-MO",
        locales: [
          {
            languageName: "繁体中国語",
            regionName: "中華人民共和国マカオ特別行政区",
          },
        ],
        symbolSamples: ["MOP$ 100"],
      },
      {
        localNameLocale: "yue-MO",
        locales: [
          {
            languageName: "広東語",
            regionName: "中華人民共和国マカオ特別行政区",
          },
        ],
        symbolSamples: ["MOP 100"],
      },
      {
        localNameLocale: "pt-MO",
        locales: [
          {
            languageName: "ポルトガル語",
            regionName: "中華人民共和国マカオ特別行政区",
          },
        ],
        symbolSamples: ["100 MOP$"],
      },
    ],
    sourceUrl: "https://zh.wikipedia.org/wiki/澳門元",
  },
  {
    code: "MRU",
    japaneseName: "モーリタニア ウギア",
    englishName: "Mauritanian ouguiya",
    isoSample: "MRU 100",
    representations: [
      {
        localNameLocale: "ar-MR",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "モーリタニア",
          },
        ],
        symbolSamples: ["‏١٠٠ أ.م."],
      },
    ],
    sourceUrl: "https://ar.wikipedia.org/wiki/أوقية_موريتانية",
  },
  {
    code: "MUR",
    japaneseName: "モーリシャス ルピー",
    englishName: "Mauritian rupee",
    isoSample: "MUR 100",
    representations: [
      {
        localNameLocale: "fr-MU",
        locales: [
          {
            languageName: "フランス語",
            regionName: "モーリシャス",
          },
        ],
        symbolSamples: ["100 Rs"],
      },
      {
        localNameLocale: "en-MU",
        locales: [
          {
            languageName: "英語",
            regionName: "モーリシャス",
          },
        ],
        symbolSamples: ["Rs 100"],
      },
    ],
    sourceUrl: "https://fr.wikipedia.org/wiki/Roupie_mauricienne",
  },
  {
    code: "MVR",
    japaneseName: "モルディブ ルフィア",
    englishName: "Maldivian rufiyaa",
    isoSample: "MVR 100",
    representations: [
      {
        localNameLocale: "dv-MV",
        locales: [
          {
            languageName: "ディベヒ語",
            regionName: "モルディブ",
          },
        ],
        symbolSamples: ["ރ. 100", "MVR 100"],
      },
    ],
    sourceUrl: "https://dv.wikipedia.org/wiki/ދިވެހި_ރުފިޔާ",
  },
  {
    code: "MWK",
    japaneseName: "マラウィ クワチャ",
    englishName: "Malawian kwacha",
    isoSample: "MWK 100",
    representations: [
      {
        localNameLocale: "ny-MW",
        locales: [
          {
            languageName: "ニャンジャ語",
            regionName: "マラウイ",
          },
        ],
        symbolSamples: ["MWK 100"],
      },
      {
        localNameLocale: "en-MW",
        locales: [
          {
            languageName: "英語",
            regionName: "マラウイ",
          },
        ],
        symbolSamples: ["MK 100"],
      },
    ],
    sourceUrl: "https://ny.wikipedia.org/wiki/Kwacha_ya_Malaŵi",
  },
  {
    code: "MXN",
    japaneseName: "メキシコ ペソ",
    englishName: "Mexican peso",
    isoSample: "MXN 100",
    representations: [
      {
        localNameLocale: "es-MX",
        locales: [
          {
            languageName: "スペイン語",
            regionName: "メキシコ",
          },
        ],
        symbolSamples: ["$100"],
      },
    ],
    sourceUrl: "https://es.wikipedia.org/wiki/Peso_(moneda_de_México)",
  },
  {
    code: "MYR",
    japaneseName: "マレーシア リンギット",
    englishName: "Malaysian ringgit",
    isoSample: "MYR 100",
    representations: [
      {
        localNameLocale: "ms-MY",
        locales: [
          {
            languageName: "マレー語",
            regionName: "マレーシア",
          },
        ],
        symbolSamples: ["RM 100"],
      },
    ],
    sourceUrl: "https://ms.wikipedia.org/wiki/Ringgit",
  },
  {
    code: "MZN",
    japaneseName: "モザンビーク メティカル",
    englishName: "Mozambican metical",
    isoSample: "MZN 100",
    representations: [
      {
        localNameLocale: "pt-MZ",
        locales: [
          {
            languageName: "ポルトガル語",
            regionName: "モザンビーク",
          },
        ],
        symbolSamples: ["100 MTn"],
      },
    ],
    sourceUrl: "https://pt.wikipedia.org/wiki/Metical",
  },
  {
    code: "NAD",
    japaneseName: "ナミビア ドル",
    englishName: "Namibian dollar",
    isoSample: "NAD 100",
    representations: [
      {
        localNameLocale: "en-NA",
        locales: [
          {
            languageName: "英語",
            regionName: "ナミビア",
          },
        ],
        symbolSamples: ["$100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Namibian_dollar",
  },
  {
    code: "NGN",
    japaneseName: "ナイジェリア ナイラ",
    englishName: "Nigerian naira",
    isoSample: "NGN 100",
    representations: [
      {
        localNameLocale: "en-NG",
        locales: [
          {
            languageName: "英語",
            regionName: "ナイジェリア",
          },
        ],
        symbolSamples: ["₦100"],
      },
      {
        localNameLocale: "yo-NG",
        locales: [
          {
            languageName: "ヨルバ語",
            regionName: "ナイジェリア",
          },
        ],
        symbolSamples: ["₦100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Nigerian_naira",
  },
  {
    code: "NIO",
    japaneseName: "ニカラグア コルドバ オロ",
    englishName: "Nicaraguan córdoba",
    isoSample: "NIO 100",
    representations: [
      {
        localNameLocale: "es-NI",
        locales: [
          {
            languageName: "スペイン語",
            regionName: "ニカラグア",
          },
        ],
        symbolSamples: ["C$ 100"],
      },
    ],
    sourceUrl: "https://es.wikipedia.org/wiki/Córdoba_(moneda_de_Nicaragua)",
  },
  {
    code: "NOK",
    japaneseName: "ノルウェー クローネ",
    englishName: "Norwegian krone",
    isoSample: "NOK 100",
    representations: [
      {
        localNameLocale: "nb-NO",
        locales: [
          {
            languageName: "ノルウェー語(ブークモール)",
            regionName: "ノルウェー",
          },
          {
            languageName: "ノルウェー語(ブークモール)",
            regionName: "スバールバル諸島・ヤンマイエン島",
          },
          {
            languageName: "ノルウェー語(ニーノシュク)",
            regionName: "ノルウェー",
          },
          {
            languageName: "ノルウェー語",
            regionName: "ブーベ島",
          },
          {
            languageName: "ノルウェー語",
            regionName: "ノルウェー",
          },
        ],
        symbolSamples: ["100 kr"],
      },
    ],
    sourceUrl: "https://no.wikipedia.org/wiki/Norsk_krone",
  },
  {
    code: "NPR",
    japaneseName: "ネパール ルピー",
    englishName: "Nepalese rupee",
    isoSample: "NPR 100",
    representations: [
      {
        localNameLocale: "ne-NP",
        locales: [
          {
            languageName: "ネパール語",
            regionName: "ネパール",
          },
        ],
        symbolSamples: ["नेरू १००", "रू १००"],
      },
    ],
    sourceUrl: "https://ne.wikipedia.org/wiki/नेपाली_रुपैयाँ",
  },
  {
    code: "NZD",
    japaneseName: "ニュージーランド ドル",
    englishName: "New Zealand dollar",
    isoSample: "NZD 100",
    representations: [
      {
        localNameLocale: "en-NZ",
        locales: [
          {
            languageName: "英語",
            regionName: "ニュージーランド",
          },
          {
            languageName: "英語",
            regionName: "クック諸島",
          },
          {
            languageName: "英語",
            regionName: "ニウエ",
          },
          {
            languageName: "英語",
            regionName: "ピトケアン諸島",
          },
          {
            languageName: "英語",
            regionName: "トケラウ",
          },
        ],
        symbolSamples: ["$100"],
      },
      {
        localNameLocale: "mi-NZ",
        locales: [
          {
            languageName: "マオリ語",
            regionName: "ニュージーランド",
          },
        ],
        symbolSamples: ["$ 100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/New_Zealand_dollar",
  },
  {
    code: "OMR",
    japaneseName: "オマーン リアル",
    englishName: "Omani rial",
    isoSample: "OMR 100",
    representations: [
      {
        localNameLocale: "ar-OM",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "オマーン",
          },
        ],
        symbolSamples: ["‏١٠٠ ر.ع.‏"],
      },
    ],
    sourceUrl: "https://ar.wikipedia.org/wiki/ريال_عماني",
  },
  {
    code: "PAB",
    japaneseName: "パナマ バルボア",
    englishName: "Panamanian balboa",
    isoSample: "PAB 100",
    representations: [
      {
        localNameLocale: "es-PA",
        locales: [
          {
            languageName: "スペイン語",
            regionName: "パナマ",
          },
        ],
        symbolSamples: ["B/. 100"],
      },
    ],
    sourceUrl: "https://es.wikipedia.org/wiki/Balboa_(moneda_de_Panamá)",
  },
  {
    code: "PEN",
    japaneseName: "ペルー ソル",
    englishName: "Peruvian sol",
    isoSample: "PEN 100",
    representations: [
      {
        localNameLocale: "es-PE",
        locales: [
          {
            languageName: "スペイン語",
            regionName: "ペルー",
          },
        ],
        symbolSamples: ["S/ 100"],
      },
      {
        localNameLocale: "qu-PE",
        locales: [
          {
            languageName: "ケチュア語",
            regionName: "ペルー",
          },
        ],
        symbolSamples: ["S/ 100"],
      },
    ],
    sourceUrl: "https://es.wikipedia.org/wiki/Sol_(moneda_de_Perú)",
  },
  {
    code: "PGK",
    japaneseName: "パプアニューギニア キナ",
    englishName: "Papua New Guinean kina",
    isoSample: "PGK 100",
    representations: [
      {
        localNameLocale: "en-PG",
        locales: [
          {
            languageName: "英語",
            regionName: "パプアニューギニア",
          },
        ],
        symbolSamples: ["K 100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Papua_New_Guinean_kina",
  },
  {
    code: "PHP",
    japaneseName: "フィリピン ペソ",
    englishName: "Philippine peso",
    isoSample: "PHP 100",
    representations: [
      {
        localNameLocale: "fil-PH",
        locales: [
          {
            languageName: "フィリピノ語",
            regionName: "フィリピン",
          },
        ],
        symbolSamples: ["₱100"],
      },
      {
        localNameLocale: "en-PH",
        locales: [
          {
            languageName: "英語",
            regionName: "フィリピン",
          },
        ],
        symbolSamples: ["₱100"],
      },
    ],
    sourceUrl: "https://tl.wikipedia.org/wiki/Piso_ng_Pilipinas",
  },
  {
    code: "PKR",
    japaneseName: "パキスタン ルピー",
    englishName: "Pakistani rupee",
    isoSample: "PKR 100",
    representations: [
      {
        localNameLocale: "ur-PK",
        locales: [
          {
            languageName: "ウルドゥー語",
            regionName: "パキスタン",
          },
        ],
        symbolSamples: ["Rs 100"],
      },
      {
        localNameLocale: "en-PK",
        locales: [
          {
            languageName: "英語",
            regionName: "パキスタン",
          },
        ],
        symbolSamples: ["Rs 100"],
      },
    ],
    sourceUrl: "https://ur.wikipedia.org/wiki/پاکستانی_روپیہ",
  },
  {
    code: "PLN",
    japaneseName: "ポーランド ズウォティ",
    englishName: "Polish złoty",
    isoSample: "PLN 100",
    representations: [
      {
        localNameLocale: "pl-PL",
        locales: [
          {
            languageName: "ポーランド語",
            regionName: "ポーランド",
          },
        ],
        symbolSamples: ["100 zł"],
      },
    ],
    sourceUrl: "https://pl.wikipedia.org/wiki/Złoty",
  },
  {
    code: "PYG",
    japaneseName: "パラグアイ グアラニ",
    englishName: "Paraguayan guaraní",
    isoSample: "PYG 100",
    representations: [
      {
        localNameLocale: "es-PY",
        locales: [
          {
            languageName: "スペイン語",
            regionName: "パラグアイ",
          },
        ],
        symbolSamples: ["Gs. 100", "₲ 100"],
      },
    ],
    sourceUrl: "https://es.wikipedia.org/wiki/Guaraní_(moneda)",
  },
  {
    code: "QAR",
    japaneseName: "カタール リアル",
    englishName: "Qatari riyal",
    isoSample: "QAR 100",
    representations: [
      {
        localNameLocale: "ar-QA",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "カタール",
          },
        ],
        symbolSamples: ["‏١٠٠ ر.ق.‏"],
      },
    ],
    sourceUrl: "https://ar.wikipedia.org/wiki/ريال_قطري",
  },
  {
    code: "RON",
    japaneseName: "ルーマニア レイ",
    englishName: "Romanian leu",
    isoSample: "RON 100",
    representations: [
      {
        localNameLocale: "ro-RO",
        locales: [
          {
            languageName: "ルーマニア語",
            regionName: "ルーマニア",
          },
        ],
        symbolSamples: ["100 RON", "100 lei"],
      },
    ],
    sourceUrl: "https://ro.wikipedia.org/wiki/Leu_românesc",
  },
  {
    code: "RSD",
    japaneseName: "セルビア ディナール",
    englishName: "Serbian dinar",
    isoSample: "RSD 100",
    representations: [
      {
        localNameLocale: "sr-RS",
        locales: [
          {
            languageName: "セルビア語",
            regionName: "セルビア",
          },
        ],
        symbolSamples: ["100 RSD"],
      },
      {
        localNameLocale: "sr-Latn-RS",
        locales: [
          {
            languageName: "セルビア語 (ラテン文字)",
            regionName: "セルビア",
          },
        ],
        symbolSamples: ["100 RSD"],
      },
    ],
    sourceUrl: "https://sr.wikipedia.org/wiki/Српски_динар",
  },
  {
    code: "RUB",
    japaneseName: "ロシア ルーブル",
    englishName: "Russian ruble",
    isoSample: "RUB 100",
    representations: [
      {
        localNameLocale: "ru-RU",
        locales: [
          {
            languageName: "ロシア語",
            regionName: "ロシア",
          },
        ],
        symbolSamples: ["100 ₽"],
      },
    ],
    sourceUrl: "https://ru.wikipedia.org/wiki/Российский_рубль",
  },
  {
    code: "RWF",
    japaneseName: "ルワンダ フラン",
    englishName: "Rwandan franc",
    isoSample: "RWF 100",
    representations: [
      {
        localNameLocale: "rw-RW",
        locales: [
          {
            languageName: "キニアルワンダ語",
            regionName: "ルワンダ",
          },
        ],
        symbolSamples: ["Frw 100", "FRw 100", "RF 100"],
      },
      {
        localNameLocale: "en-RW",
        locales: [
          {
            languageName: "英語",
            regionName: "ルワンダ",
          },
        ],
        symbolSamples: ["RF 100"],
      },
      {
        localNameLocale: "fr-RW",
        locales: [
          {
            languageName: "フランス語",
            regionName: "ルワンダ",
          },
        ],
        symbolSamples: ["100 RF", "100 FR"],
      },
    ],
    sourceUrl: "https://rw.wikipedia.org/wiki/Amafaranga_y'u_Rwanda",
  },
  {
    code: "SAR",
    japaneseName: "サウジ リヤル",
    englishName: "Saudi riyal",
    isoSample: "SAR 100",
    representations: [
      {
        localNameLocale: "ar-SA",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "サウジアラビア",
          },
        ],
        symbolSamples: ["‏١٠٠ ر.س.‏"],
      },
    ],
    sourceUrl: "https://ar.wikipedia.org/wiki/ريال_سعودي",
  },
  {
    code: "SBD",
    japaneseName: "ソロモン諸島 ドル",
    englishName: "Solomon Islands dollar",
    isoSample: "SBD 100",
    representations: [
      {
        localNameLocale: "en-SB",
        locales: [
          {
            languageName: "英語",
            regionName: "ソロモン諸島",
          },
        ],
        symbolSamples: ["$100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Solomon_Islands_dollar",
  },
  {
    code: "SCR",
    japaneseName: "セーシェル ルピー",
    englishName: "Seychellois rupee",
    isoSample: "SCR 100",
    representations: [
      {
        localNameLocale: "fr-SC",
        locales: [
          {
            languageName: "フランス語",
            regionName: "セーシェル",
          },
        ],
        symbolSamples: ["100 SR"],
      },
      {
        localNameLocale: "en-SC",
        locales: [
          {
            languageName: "英語",
            regionName: "セーシェル",
          },
        ],
        symbolSamples: ["SR 100"],
      },
    ],
    sourceUrl: "https://fr.wikipedia.org/wiki/Roupie_seychelloise",
  },
  {
    code: "SDG",
    japaneseName: "スーダン ポンド",
    englishName: "Sudanese pound",
    isoSample: "SDG 100",
    representations: [
      {
        localNameLocale: "ar-SD",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "スーダン",
          },
        ],
        symbolSamples: ["‏١٠٠ ج.س."],
      },
      {
        localNameLocale: "en-SD",
        locales: [
          {
            languageName: "英語",
            regionName: "スーダン",
          },
        ],
        symbolSamples: ["SDG 100"],
      },
    ],
    sourceUrl: "https://ar.wikipedia.org/wiki/جنيه_سوداني",
  },
  {
    code: "SEK",
    japaneseName: "スウェーデン クローナ",
    englishName: "Swedish krona",
    isoSample: "SEK 100",
    representations: [
      {
        localNameLocale: "sv-SE",
        locales: [
          {
            languageName: "スウェーデン語",
            regionName: "スウェーデン",
          },
        ],
        symbolSamples: ["100 kr"],
      },
    ],
    sourceUrl: "https://sv.wikipedia.org/wiki/Svensk_krona",
  },
  {
    code: "SGD",
    japaneseName: "シンガポール ドル",
    englishName: "Singapore dollar",
    isoSample: "SGD 100",
    representations: [
      {
        localNameLocale: "en-SG",
        locales: [
          {
            languageName: "英語",
            regionName: "シンガポール",
          },
        ],
        symbolSamples: ["$100"],
      },
      {
        localNameLocale: "zh-SG",
        locales: [
          {
            languageName: "中国語",
            regionName: "シンガポール",
          },
        ],
        symbolSamples: ["SGD 100", "$100"],
      },
      {
        localNameLocale: "ms-SG",
        locales: [
          {
            languageName: "マレー語",
            regionName: "シンガポール",
          },
        ],
        symbolSamples: ["$100"],
      },
      {
        localNameLocale: "ta-SG",
        locales: [
          {
            languageName: "タミル語",
            regionName: "シンガポール",
          },
        ],
        symbolSamples: ["$ 100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Singapore_dollar",
  },
  {
    code: "SHP",
    japaneseName: "セントヘレナ ポンド",
    englishName: "Saint Helena pound",
    isoSample: "SHP 100",
    representations: [
      {
        localNameLocale: "en-SH",
        locales: [
          {
            languageName: "英語",
            regionName: "セントヘレナ",
          },
        ],
        symbolSamples: ["£100"],
      },
      {
        localNameLocale: "en-AC",
        locales: [
          {
            languageName: "英語",
            regionName: "アセンション島",
          },
        ],
        symbolSamples: ["SHP 100", "£100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Saint_Helena_pound",
  },
  {
    code: "SLE",
    japaneseName: "シエラレオネ レオン",
    englishName: "Sierra Leonean leone",
    isoSample: "SLE 100",
    representations: [
      {
        localNameLocale: "en-SL",
        locales: [
          {
            languageName: "英語",
            regionName: "シエラレオネ",
          },
        ],
        symbolSamples: ["Le 100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Sierra_Leonean_leone",
  },
  {
    code: "SOS",
    japaneseName: "ソマリア シリング",
    englishName: "Somali shilling",
    isoSample: "SOS 100",
    representations: [
      {
        localNameLocale: "so-SO",
        locales: [
          {
            languageName: "ソマリ語",
            regionName: "ソマリア",
          },
        ],
        symbolSamples: ["So.Sh 100", "Sh.So. 100"],
      },
      {
        localNameLocale: "ar-SO",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "ソマリア",
          },
        ],
        symbolSamples: ["‏١٠٠ S"],
      },
    ],
    sourceUrl: "https://so.wikipedia.org/wiki/Shilin_Soomaali",
  },
  {
    code: "SRD",
    japaneseName: "スリナム ドル",
    englishName: "Surinamese dollar",
    isoSample: "SRD 100",
    representations: [
      {
        localNameLocale: "nl-SR",
        locales: [
          {
            languageName: "オランダ語",
            regionName: "スリナム",
          },
        ],
        symbolSamples: ["$ 100"],
      },
    ],
    sourceUrl: "https://nl.wikipedia.org/wiki/Surinaamse_dollar",
  },
  {
    code: "SSP",
    japaneseName: "南スーダン ポンド",
    englishName: "South Sudanese pound",
    isoSample: "SSP 100",
    representations: [
      {
        localNameLocale: "en-SS",
        locales: [
          {
            languageName: "英語",
            regionName: "南スーダン",
          },
        ],
        symbolSamples: ["£100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/South_Sudanese_pound",
  },
  {
    code: "STN",
    japaneseName: "サントメ・プリンシペ ドブラ",
    englishName: "São Tomé and Príncipe dobra",
    isoSample: "STN 100",
    representations: [
      {
        localNameLocale: "pt-ST",
        locales: [
          {
            languageName: "ポルトガル語",
            regionName: "サントメ・プリンシペ",
          },
        ],
        symbolSamples: ["100 Db"],
      },
    ],
    sourceUrl: "https://pt.wikipedia.org/wiki/Dobra_são-tomense",
  },
  {
    code: "SYP",
    japaneseName: "シリア ポンド",
    englishName: "Syrian pound",
    isoSample: "SYP 100",
    representations: [
      {
        localNameLocale: "ar-SY",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "シリア",
          },
        ],
        symbolSamples: ["‏١٠٠ ل.س.‏", "‏١٠٠ £"],
      },
    ],
    sourceUrl: "https://ar.wikipedia.org/wiki/ليرة_سورية",
  },
  {
    code: "SZL",
    japaneseName: "エスワティニ リランゲニ",
    englishName: "Swazi lilangeni",
    isoSample: "SZL 100",
    representations: [
      {
        localNameLocale: "ss-SZ",
        locales: [
          {
            languageName: "スワジ語",
            regionName: "エスワティニ",
          },
        ],
        symbolSamples: ["E100"],
      },
      {
        localNameLocale: "en-SZ",
        locales: [
          {
            languageName: "英語",
            regionName: "エスワティニ",
          },
        ],
        symbolSamples: ["E100"],
      },
    ],
    sourceUrl: "https://ss.wikipedia.org/wiki/Umbuso_weSwatini#Lilangeni",
  },
  {
    code: "THB",
    japaneseName: "タイ バーツ",
    englishName: "Thai baht",
    isoSample: "THB 100",
    representations: [
      {
        localNameLocale: "th-TH",
        locales: [
          {
            languageName: "タイ語",
            regionName: "タイ",
          },
        ],
        symbolSamples: ["฿100"],
      },
    ],
    sourceUrl: "https://th.wikipedia.org/wiki/บาท_(สกุลเงิน)",
  },
  {
    code: "TJS",
    japaneseName: "タジキスタン ソモニ",
    englishName: "Tajikistani somoni",
    isoSample: "TJS 100",
    representations: [
      {
        localNameLocale: "tg-TJ",
        locales: [
          {
            languageName: "タジク語",
            regionName: "タジキスタン",
          },
        ],
        symbolSamples: ["100 сом."],
      },
    ],
    sourceUrl: "https://tg.wikipedia.org/wiki/Сомонӣ",
  },
  {
    code: "TMT",
    japaneseName: "トルクメニスタン マナト",
    englishName: "Turkmenistani manat",
    isoSample: "TMT 100",
    representations: [
      {
        localNameLocale: "tk-TM",
        locales: [
          {
            languageName: "トルクメン語",
            regionName: "トルクメニスタン",
          },
        ],
        symbolSamples: ["100 TMT"],
      },
    ],
    sourceUrl: "https://tk.wikipedia.org/wiki/Türkmenistan_manady",
  },
  {
    code: "TND",
    japaneseName: "チュニジア ディナール",
    englishName: "Tunisian dinar",
    isoSample: "TND 100",
    representations: [
      {
        localNameLocale: "ar-TN",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "チュニジア",
          },
        ],
        symbolSamples: ["‏100 د.ت.‏"],
      },
      {
        localNameLocale: "fr-TN",
        locales: [
          {
            languageName: "フランス語",
            regionName: "チュニジア",
          },
        ],
        symbolSamples: ["100 DT"],
      },
    ],
    sourceUrl: "https://ar.wikipedia.org/wiki/دينار_تونسي",
  },
  {
    code: "TOP",
    japaneseName: "トンガ パ・アンガ",
    englishName: "Tongan paʻanga",
    isoSample: "TOP 100",
    representations: [
      {
        localNameLocale: "to-TO",
        locales: [
          {
            languageName: "トンガ語",
            regionName: "トンガ",
          },
        ],
        symbolSamples: ["T$ 100"],
      },
      {
        localNameLocale: "en-TO",
        locales: [
          {
            languageName: "英語",
            regionName: "トンガ",
          },
        ],
        symbolSamples: ["T$ 100"],
      },
    ],
    sourceUrl: "https://to.wikipedia.org/wiki/Paʻanga",
  },
  {
    code: "TRY",
    japaneseName: "トルコ リラ",
    englishName: "Turkish lira",
    isoSample: "TRY 100",
    representations: [
      {
        localNameLocale: "tr-TR",
        locales: [
          {
            languageName: "トルコ語",
            regionName: "トルコ",
          },
        ],
        symbolSamples: ["₺100"],
      },
    ],
    sourceUrl: "https://tr.wikipedia.org/wiki/Türk_lirası",
  },
  {
    code: "TTD",
    japaneseName: "トリニダード・トバゴ ドル",
    englishName: "Trinidad and Tobago dollar",
    isoSample: "TTD 100",
    representations: [
      {
        localNameLocale: "en-TT",
        locales: [
          {
            languageName: "英語",
            regionName: "トリニダード・トバゴ",
          },
        ],
        symbolSamples: ["$100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Trinidad_and_Tobago_dollar",
  },
  {
    code: "TWD",
    japaneseName: "新台湾ドル",
    englishName: "New Taiwan dollar",
    isoSample: "TWD 100",
    representations: [
      {
        localNameLocale: "zh-TW",
        locales: [
          {
            languageName: "中国語",
            regionName: "台湾",
          },
        ],
        symbolSamples: ["NT$ 100"],
      },
      {
        localNameLocale: "zh-Hant-TW",
        locales: [
          {
            languageName: "繁体中国語",
            regionName: "台湾",
          },
        ],
        symbolSamples: ["$100"],
      },
    ],
    sourceUrl: "https://zh.wikipedia.org/wiki/新臺幣",
  },
  {
    code: "TZS",
    japaneseName: "タンザニア シリング",
    englishName: "Tanzanian shilling",
    isoSample: "TZS 100",
    representations: [
      {
        localNameLocale: "sw-TZ",
        locales: [
          {
            languageName: "スワヒリ語",
            regionName: "タンザニア",
          },
        ],
        symbolSamples: ["TSh 100"],
      },
      {
        localNameLocale: "en-TZ",
        locales: [
          {
            languageName: "英語",
            regionName: "タンザニア",
          },
        ],
        symbolSamples: ["TSh 100"],
      },
    ],
    sourceUrl: "https://sw.wikipedia.org/wiki/Shilingi_ya_Tanzania",
  },
  {
    code: "UAH",
    japaneseName: "ウクライナ フリヴニャ",
    englishName: "Ukrainian hryvnia",
    isoSample: "UAH 100",
    representations: [
      {
        localNameLocale: "uk-UA",
        locales: [
          {
            languageName: "ウクライナ語",
            regionName: "ウクライナ",
          },
        ],
        symbolSamples: ["100 ₴"],
      },
      {
        localNameLocale: "ru-UA",
        locales: [
          {
            languageName: "ロシア語",
            regionName: "ウクライナ",
          },
        ],
        symbolSamples: ["100 ₴"],
      },
    ],
    sourceUrl: "https://uk.wikipedia.org/wiki/Гривня",
  },
  {
    code: "UGX",
    japaneseName: "ウガンダ シリング",
    englishName: "Ugandan shilling",
    isoSample: "UGX 100",
    representations: [
      {
        localNameLocale: "en-UG",
        locales: [
          {
            languageName: "英語",
            regionName: "ウガンダ",
          },
        ],
        symbolSamples: ["USh 100"],
      },
      {
        localNameLocale: "sw-UG",
        locales: [
          {
            languageName: "スワヒリ語",
            regionName: "ウガンダ",
          },
        ],
        symbolSamples: ["USh 100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Ugandan_shilling",
  },
  {
    code: "USD",
    japaneseName: "米ドル",
    englishName: "United States dollar",
    isoSample: "USD 100",
    representations: [
      {
        localNameLocale: "en-US",
        locales: [
          {
            languageName: "英語",
            regionName: "アメリカ合衆国",
          },
          {
            languageName: "英語",
            regionName: "米領サモア",
          },
          {
            languageName: "英語",
            regionName: "グアム",
          },
          {
            languageName: "英語",
            regionName: "マーシャル諸島",
          },
          {
            languageName: "英語",
            regionName: "北マリアナ諸島",
          },
          {
            languageName: "英語",
            regionName: "プエルトリコ",
          },
          {
            languageName: "英語",
            regionName: "合衆国領有小離島",
          },
          {
            languageName: "英語",
            regionName: "米領ヴァージン諸島",
          },
        ],
        symbolSamples: ["$100"],
      },
      {
        localNameLocale: "nl-BQ",
        locales: [
          {
            languageName: "オランダ語",
            regionName: "オランダ領カリブ",
          },
        ],
        symbolSamples: ["$ 100"],
      },
      {
        localNameLocale: "en-DG",
        locales: [
          {
            languageName: "英語",
            regionName: "ディエゴガルシア島",
          },
          {
            languageName: "英語",
            regionName: "ミクロネシア連邦",
          },
          {
            languageName: "英語",
            regionName: "英領インド洋地域",
          },
          {
            languageName: "英語",
            regionName: "パラオ",
          },
          {
            languageName: "英語",
            regionName: "タークス・カイコス諸島",
          },
          {
            languageName: "英語",
            regionName: "英領ヴァージン諸島",
          },
          {
            languageName: "英語",
            regionName: "ジンバブエ",
          },
        ],
        symbolSamples: ["US$ 100", "$100"],
      },
      {
        localNameLocale: "es-EC",
        locales: [
          {
            languageName: "スペイン語",
            regionName: "エクアドル",
          },
          {
            languageName: "スペイン語",
            regionName: "プエルトリコ",
          },
          {
            languageName: "スペイン語",
            regionName: "エルサルバドル",
          },
        ],
        symbolSamples: ["$100"],
      },
      {
        localNameLocale: "qu-EC",
        locales: [
          {
            languageName: "ケチュア語",
            regionName: "エクアドル",
          },
        ],
        symbolSamples: ["$ 100"],
      },
      {
        localNameLocale: "fr-HT",
        locales: [
          {
            languageName: "フランス語",
            regionName: "ハイチ",
          },
        ],
        symbolSamples: ["100 $US", "100 $"],
      },
      {
        localNameLocale: "ht-HT",
        locales: [
          {
            languageName: "ハイチ・クレオール語",
            regionName: "ハイチ",
          },
        ],
        symbolSamples: ["100 $US", "100 $"],
      },
      {
        localNameLocale: "es-PA",
        locales: [
          {
            languageName: "スペイン語",
            regionName: "パナマ",
          },
        ],
        symbolSamples: ["USD 100", "$100"],
      },
      {
        localNameLocale: "pt-TL",
        locales: [
          {
            languageName: "ポルトガル語",
            regionName: "東ティモール",
          },
        ],
        symbolSamples: ["100 US$", "100 $"],
      },
      {
        localNameLocale: "sn-ZW",
        locales: [
          {
            languageName: "ショナ語",
            regionName: "ジンバブエ",
          },
        ],
        symbolSamples: ["US$ 100", "$100"],
      },
      {
        localNameLocale: "nd-ZW",
        locales: [
          {
            languageName: "北ンデベレ語",
            regionName: "ジンバブエ",
          },
        ],
        symbolSamples: ["US$ 100", "$100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/United_States_dollar",
  },
  {
    code: "UYU",
    japaneseName: "ウルグアイ ペソ",
    englishName: "Uruguayan peso",
    isoSample: "UYU 100",
    representations: [
      {
        localNameLocale: "es-UY",
        locales: [
          {
            languageName: "スペイン語",
            regionName: "ウルグアイ",
          },
        ],
        symbolSamples: ["$ 100"],
      },
    ],
    sourceUrl: "https://es.wikipedia.org/wiki/Peso_Uruguayo",
  },
  {
    code: "UZS",
    japaneseName: "ウズベキスタン スム",
    englishName: "Uzbekistani sum",
    isoSample: "UZS 100",
    representations: [
      {
        localNameLocale: "uz-UZ",
        locales: [
          {
            languageName: "ウズベク語",
            regionName: "ウズベキスタン",
          },
        ],
        symbolSamples: ["100 soʻm"],
      },
      {
        localNameLocale: "uz-Cyrl-UZ",
        locales: [
          {
            languageName: "ウズベク語 (キリル文字)",
            regionName: "ウズベキスタン",
          },
        ],
        symbolSamples: ["100 сўм"],
      },
    ],
    sourceUrl: "https://uz.wikipedia.org/wiki/Soʻm",
  },
  {
    code: "VES",
    japaneseName: "ベネズエラ ボリバル",
    englishName: "Venezuelan bolívar",
    isoSample: "VES 100",
    representations: [
      {
        localNameLocale: "es-VE",
        locales: [
          {
            languageName: "スペイン語",
            regionName: "ベネズエラ",
          },
        ],
        symbolSamples: ["Bs. 100"],
      },
    ],
    sourceUrl: "https://es.wikipedia.org/wiki/Bolívar_(moneda)",
  },
  {
    code: "VND",
    japaneseName: "ベトナム ドン",
    englishName: "Vietnamese đồng",
    isoSample: "VND 100",
    representations: [
      {
        localNameLocale: "vi-VN",
        locales: [
          {
            languageName: "ベトナム語",
            regionName: "ベトナム",
          },
        ],
        symbolSamples: ["100 ₫"],
      },
    ],
    sourceUrl: "https://vi.wikipedia.org/wiki/Đồng_(đơn_vị_tiền_tệ)",
  },
  {
    code: "VUV",
    japaneseName: "バヌアツ バツ",
    englishName: "Vanuatu vatu",
    isoSample: "VUV 100",
    representations: [
      {
        localNameLocale: "fr-VU",
        locales: [
          {
            languageName: "フランス語",
            regionName: "バヌアツ",
          },
        ],
        symbolSamples: ["100 VT"],
      },
      {
        localNameLocale: "en-VU",
        locales: [
          {
            languageName: "英語",
            regionName: "バヌアツ",
          },
        ],
        symbolSamples: ["VT 100"],
      },
    ],
    sourceUrl: "https://fr.wikipedia.org/wiki/Vatu",
  },
  {
    code: "WST",
    japaneseName: "サモア タラ",
    englishName: "Samoan tālā",
    isoSample: "WST 100",
    representations: [
      {
        localNameLocale: "en-WS",
        locales: [
          {
            languageName: "英語",
            regionName: "サモア",
          },
        ],
        symbolSamples: ["WS$ 100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Samoan_tālā",
  },
  {
    code: "XAF",
    japaneseName: "中央アフリカ CFA フラン",
    englishName: "Central African CFA franc",
    isoSample: "XAF 100",
    representations: [
      {
        localNameLocale: "fr-CM",
        locales: [
          {
            languageName: "フランス語",
            regionName: "カメルーン",
          },
          {
            languageName: "フランス語",
            regionName: "中央アフリカ共和国",
          },
          {
            languageName: "フランス語",
            regionName: "コンゴ共和国(ブラザビル)",
          },
          {
            languageName: "フランス語",
            regionName: "ガボン",
          },
          {
            languageName: "フランス語",
            regionName: "赤道ギニア",
          },
          {
            languageName: "フランス語",
            regionName: "チャド",
          },
        ],
        symbolSamples: ["100 FCFA"],
      },
      {
        localNameLocale: "sg-CF",
        locales: [
          {
            languageName: "サンゴ語",
            regionName: "中央アフリカ共和国",
          },
        ],
        symbolSamples: ["FCFA 100"],
      },
      {
        localNameLocale: "en-CM",
        locales: [
          {
            languageName: "英語",
            regionName: "カメルーン",
          },
        ],
        symbolSamples: ["FCFA 100"],
      },
      {
        localNameLocale: "es-GQ",
        locales: [
          {
            languageName: "スペイン語",
            regionName: "赤道ギニア",
          },
        ],
        symbolSamples: ["FCFA 100"],
      },
      {
        localNameLocale: "pt-GQ",
        locales: [
          {
            languageName: "ポルトガル語",
            regionName: "赤道ギニア",
          },
        ],
        symbolSamples: ["100 FCFA"],
      },
      {
        localNameLocale: "ar-TD",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "チャド",
          },
        ],
        symbolSamples: ["‏١٠٠ FCFA"],
      },
    ],
    sourceUrl: "https://fr.wikipedia.org/wiki/Franc_CFA_(CEMAC)",
  },
  {
    code: "XCD",
    japaneseName: "東カリブ ドル",
    englishName: "Eastern Caribbean dollar",
    isoSample: "XCD 100",
    representations: [
      {
        localNameLocale: "en-AG",
        locales: [
          {
            languageName: "英語",
            regionName: "アンティグア・バーブーダ",
          },
          {
            languageName: "英語",
            regionName: "アンギラ",
          },
          {
            languageName: "英語",
            regionName: "ドミニカ国",
          },
          {
            languageName: "英語",
            regionName: "グレナダ",
          },
          {
            languageName: "英語",
            regionName: "セントクリストファー・ネーヴィス",
          },
          {
            languageName: "英語",
            regionName: "セントルシア",
          },
          {
            languageName: "英語",
            regionName: "モントセラト",
          },
          {
            languageName: "英語",
            regionName: "セントビンセント及びグレナディーン諸島",
          },
        ],
        symbolSamples: ["$100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Eastern_Caribbean_dollar",
  },
  {
    code: "XCG",
    japaneseName: "カリブ ギルダー",
    englishName: "Caribbean guilder",
    isoSample: "XCG 100",
    representations: [
      {
        localNameLocale: "nl-CW",
        locales: [
          {
            languageName: "オランダ語",
            regionName: "キュラソー",
          },
          {
            languageName: "オランダ語",
            regionName: "シント・マールテン",
          },
        ],
        symbolSamples: ["Cg 100"],
      },
      {
        localNameLocale: "en-SX",
        locales: [
          {
            languageName: "英語",
            regionName: "シント・マールテン",
          },
        ],
        symbolSamples: ["Cg 100"],
      },
      {
        localNameLocale: "pap-CW",
        locales: [
          {
            languageName: "パピアメント語",
            regionName: "キュラソー",
          },
        ],
        symbolSamples: ["Cg 100"],
      },
    ],
    sourceUrl:
      "https://www.centralbank.cw/functions/banknotes-coins/caribbean-guilder/frequently-asked-questions",
  },
  {
    code: "XOF",
    japaneseName: "西アフリカ CFA フラン",
    englishName: "West African CFA franc",
    isoSample: "XOF 100",
    representations: [
      {
        localNameLocale: "fr-SN",
        locales: [
          {
            languageName: "フランス語",
            regionName: "セネガル",
          },
          {
            languageName: "フランス語",
            regionName: "ブルキナファソ",
          },
          {
            languageName: "フランス語",
            regionName: "ベナン",
          },
          {
            languageName: "フランス語",
            regionName: "コートジボワール",
          },
          {
            languageName: "フランス語",
            regionName: "マリ",
          },
          {
            languageName: "フランス語",
            regionName: "ニジェール",
          },
          {
            languageName: "フランス語",
            regionName: "トーゴ",
          },
        ],
        symbolSamples: ["100 F CFA"],
      },
      {
        localNameLocale: "pt-GW",
        locales: [
          {
            languageName: "ポルトガル語",
            regionName: "ギニアビサウ",
          },
        ],
        symbolSamples: ["100 F CFA"],
      },
      {
        localNameLocale: "wo-SN",
        locales: [
          {
            languageName: "ウォロフ語",
            regionName: "セネガル",
          },
        ],
        symbolSamples: ["F CFA 100"],
      },
    ],
    sourceUrl: "https://fr.wikipedia.org/wiki/Franc_CFA_(UEMOA)",
  },
  {
    code: "XPF",
    japaneseName: "CFP フラン",
    englishName: "CFP franc",
    isoSample: "XPF 100",
    representations: [
      {
        localNameLocale: "fr-PF",
        locales: [
          {
            languageName: "フランス語",
            regionName: "仏領ポリネシア",
          },
          {
            languageName: "フランス語",
            regionName: "ニューカレドニア",
          },
          {
            languageName: "フランス語",
            regionName: "ウォリス・フツナ",
          },
        ],
        symbolSamples: ["100 FCFP"],
      },
    ],
    sourceUrl: "https://fr.wikipedia.org/wiki/Franc_Pacifique",
  },
  {
    code: "YER",
    japaneseName: "イエメン リアル",
    englishName: "Yemeni rial",
    isoSample: "YER 100",
    representations: [
      {
        localNameLocale: "ar-YE",
        locales: [
          {
            languageName: "アラビア語",
            regionName: "イエメン",
          },
        ],
        symbolSamples: ["‏١٠٠ ر.ي.‏"],
      },
    ],
    sourceUrl: "https://ar.wikipedia.org/wiki/ريال_يمني",
  },
  {
    code: "ZAR",
    japaneseName: "南アフリカ ランド",
    englishName: "South African rand",
    isoSample: "ZAR 100",
    representations: [
      {
        localNameLocale: "af-ZA",
        locales: [
          {
            languageName: "アフリカーンス語",
            regionName: "南アフリカ",
          },
        ],
        symbolSamples: ["R 100"],
      },
      {
        localNameLocale: "en-LS",
        locales: [
          {
            languageName: "英語",
            regionName: "レソト",
          },
        ],
        symbolSamples: ["R 100"],
      },
      {
        localNameLocale: "en-NA",
        locales: [
          {
            languageName: "英語",
            regionName: "ナミビア",
          },
        ],
        symbolSamples: ["ZAR 100", "R 100"],
      },
      {
        localNameLocale: "en-ZA",
        locales: [
          {
            languageName: "英語",
            regionName: "南アフリカ",
          },
        ],
        symbolSamples: ["R100"],
      },
    ],
    sourceUrl: "https://af.wikipedia.org/wiki/Suid-Afrikaanse_rand",
  },
  {
    code: "ZMW",
    japaneseName: "ザンビア クワチャ",
    englishName: "Zambian kwacha",
    isoSample: "ZMW 100",
    representations: [
      {
        localNameLocale: "en-ZM",
        locales: [
          {
            languageName: "英語",
            regionName: "ザンビア",
          },
        ],
        symbolSamples: ["K 100", "ZK 100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Zambian_kwacha",
  },
  {
    code: "ZWG",
    japaneseName: "ジンバブエ ゴールド",
    englishName: "Zimbabwe gold",
    isoSample: "ZWG 100",
    representations: [
      {
        localNameLocale: "en-ZW",
        locales: [
          {
            languageName: "英語",
            regionName: "ジンバブエ",
          },
        ],
        symbolSamples: ["ZiG100", "ZWG 100"],
      },
    ],
    sourceUrl: "https://en.wikipedia.org/wiki/Zimbabwe_Gold",
  },
] as const satisfies readonly SandboxCurrencyRow[];

const localNamesByCode: ReadonlyMap<CurrencyCode, readonly CurrencyLocalNameEntry[]> =
  new Map(currencyLocalNames.map((currency) => [currency.code, currency.names]));

/** Combines sandbox-only labels with package-owned local currency names. */
export const sandboxCurrencies: readonly SandboxCurrency[] =
  sandboxCurrencyRows.map(createSandboxCurrency);

/** Adds package-owned local names to one sandbox-only currency row. */
function createSandboxCurrency(row: SandboxCurrencyRow): SandboxCurrency {
  const localNames = localNamesByCode.get(row.code)!;
  return {
    ...row,
    commonLocalName: localNames[0]!.name,
    representations: row.representations.map((representation) =>
      createSandboxRepresentation(representation, localNames),
    ),
  };
}

/** Adds one package-owned amount sample to its sandbox display row. */
function createSandboxRepresentation(
  representation: SandboxCurrencyRepresentationRow,
  localNames: readonly CurrencyLocalNameEntry[],
): SandboxCurrencyRepresentation {
  const { localNameLocale, ...sandboxRepresentation } = representation;
  const localName = localNames.find((candidate) =>
    candidate.locales.includes(localNameLocale),
  )!;
  return {
    ...sandboxRepresentation,
    locales: sandboxRepresentation.locales.map((locale, index) =>
      createSandboxLocale(locale, localName.locales[index]!),
    ),
    localSample: localName.sample,
  };
}

/** Adds a package-owned locale tag to one sandbox display label. */
function createSandboxLocale(
  locale: SandboxCurrencyLocaleRow,
  language: string,
): SandboxCurrencyLocale {
  return { ...locale, language };
}
