// The localized headline of each store promo image. Its lines are joined with <br>, and the
// last line is highlighted in the brand color.
import type { UiLocale } from "../lib/i18n.ts";

export interface PromoCopy {
  /** Fonts that draw the locale's script with its own glyph forms on macOS and Ubuntu. */
  readonly fontFamily: string;
  readonly selectAndConvert: PromoPageCopy;
  readonly currencyCatalog: PromoPageCopy & {
    /** Labels of the fiat, cryptocurrency, and precious metal rows. */
    readonly categories: readonly [string, string, string];
  };
  readonly toolbarPopup: PromoPageCopy;
}

interface PromoPageCopy {
  readonly headline: readonly string[];
}

const LATIN_FONTS = `"Helvetica Neue","Noto Sans","Noto Sans CJK JP",system-ui,sans-serif`;

/** Builds every locale's copy for the given number of supported currencies. */
export function promoCopy(currencyCount: number): Readonly<Record<UiLocale, PromoCopy>> {
  const n = currencyCount;
  return {
    en: {
      fontFamily: LATIN_FONTS,
      selectAndConvert: {
        headline: ["Select a price", "See it converted"],
      },
      currencyCatalog: {
        headline: ["Works with", `${n} currencies`],
        categories: ["Fiat currencies", "Cryptocurrencies", "Precious metals"],
      },
      toolbarPopup: {
        headline: ["Convert anytime", "from the toolbar"],
      },
    },
    ja: {
      fontFamily: `"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans CJK JP",system-ui,sans-serif`,
      selectAndConvert: {
        headline: ["選択した金額を", "その場で換算"],
      },
      currencyCatalog: {
        headline: ["世界の", `${n}通貨に対応`],
        categories: ["各国通貨", "暗号資産", "貴金属"],
      },
      toolbarPopup: {
        headline: ["ツールバーから", "いつでも換算"],
      },
    },
    "zh-CN": {
      fontFamily: `"PingFang SC","Noto Sans CJK SC",system-ui,sans-serif`,
      selectAndConvert: {
        headline: ["选中价格", "当场换算"],
      },
      currencyCatalog: {
        headline: ["支持全球", `${n} 种货币`],
        categories: ["各国货币", "加密货币", "贵金属"],
      },
      toolbarPopup: {
        headline: ["在工具栏中", "随时换算"],
      },
    },
    "zh-TW": {
      fontFamily: `"PingFang TC","Noto Sans CJK TC",system-ui,sans-serif`,
      selectAndConvert: {
        headline: ["選取價格", "當場換算"],
      },
      currencyCatalog: {
        headline: ["支援全球", `${n} 種貨幣`],
        categories: ["各國貨幣", "加密貨幣", "貴金屬"],
      },
      toolbarPopup: {
        headline: ["從工具列", "隨時換算"],
      },
    },
    ko: {
      fontFamily: `"Apple SD Gothic Neo","Noto Sans CJK KR",system-ui,sans-serif`,
      selectAndConvert: {
        headline: ["선택한 가격을", "바로 환산"],
      },
      currencyCatalog: {
        headline: ["전 세계", `${n}개 통화 지원`],
        categories: ["각국 통화", "암호화폐", "귀금속"],
      },
      toolbarPopup: {
        headline: ["툴바에서", "언제든 환산"],
      },
    },
    es: {
      fontFamily: LATIN_FONTS,
      selectAndConvert: {
        headline: ["Elige un precio", "Conviértelo ya"],
      },
      currencyCatalog: {
        headline: ["Compatible con", `${n} divisas`],
        categories: ["Divisas", "Criptomonedas", "Metales preciosos"],
      },
      toolbarPopup: {
        headline: ["Convierte", "desde la barra"],
      },
    },
    fr: {
      fontFamily: LATIN_FONTS,
      selectAndConvert: {
        headline: ["Sélectionnez", "et convertissez"],
      },
      currencyCatalog: {
        headline: ["Compatible avec", `${n} devises`],
        categories: ["Devises", "Cryptomonnaies", "Métaux précieux"],
      },
      toolbarPopup: {
        headline: ["Convertissez", "depuis la barre"],
      },
    },
    de: {
      fontFamily: LATIN_FONTS,
      selectAndConvert: {
        headline: ["Preis markieren", "sofort umrechnen"],
      },
      currencyCatalog: {
        headline: ["Unterstützt", `${n} Währungen`],
        categories: ["Landeswährungen", "Kryptowährungen", "Edelmetalle"],
      },
      toolbarPopup: {
        headline: ["Umrechnen", "per Symbolleiste"],
      },
    },
    "pt-BR": {
      fontFamily: LATIN_FONTS,
      selectAndConvert: {
        headline: ["Escolha um preço", "Converta na hora"],
      },
      currencyCatalog: {
        headline: ["Compatível com", `${n} moedas`],
        categories: ["Moedas", "Criptomoedas", "Metais preciosos"],
      },
      toolbarPopup: {
        headline: ["Converta", "pela barra"],
      },
    },
  };
}
