// The localized copy of the store promo images. Lines in `headline` and `body` are joined
// with <br>, and the last headline line is highlighted in the brand color.
import type { UiLocale } from "../lib/i18n.ts";

export interface PromoCopy {
  /** Fonts that draw the locale's script with its own glyph forms on macOS and Ubuntu. */
  readonly fontFamily: string;
  readonly selectAndConvert: PromoPageCopy;
  readonly currencyPicker: PromoPageCopy;
  readonly toolbarPopup: Omit<PromoPageCopy, "bullets">;
}

interface PromoPageCopy {
  readonly headline: readonly string[];
  readonly body: readonly string[];
  readonly bullets: readonly string[];
}

const LATIN_FONTS = `"Helvetica Neue","Noto Sans","Noto Sans CJK JP",system-ui,sans-serif`;

/** Builds every locale's copy for the given number of supported currencies. */
export function promoCopy(currencyCount: number): Readonly<Record<UiLocale, PromoCopy>> {
  const n = currencyCount;
  return {
    en: {
      fontFamily: LATIN_FONTS,
      selectAndConvert: {
        headline: ["Select a price.", "See it converted."],
        body: [
          "Select a price on any site and click the button.",
          "Check it in your own currency without leaving the page.",
        ],
        bullets: [
          `${n} currencies supported`,
          "Exchange rates refreshed every hour",
          "Up to 5 currencies at once",
          "Rate history charts from 1 day to 1 year",
          "Detects “$”, “USD”, and “dollars” alike",
        ],
      },
      currencyPicker: {
        headline: [`Pick from ${n}`, "currencies."],
        body: [
          "Search by code, name, or region and add up to five target currencies. Convert into cryptocurrencies and precious metals as well as fiat money.",
        ],
        bullets: [
          "Bitcoin, Ethereum, and other cryptocurrencies",
          "Gold, silver, platinum, and palladium",
          "Choose what “$” and “¥” mean to you",
        ],
      },
      toolbarPopup: {
        headline: ["Convert anytime,", "from the toolbar."],
        body: ["Type an amount to convert it", "into all your currencies at once."],
      },
    },
    ja: {
      fontFamily: `"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans CJK JP",system-ui,sans-serif`,
      selectAndConvert: {
        headline: ["選択した金額を、", "その場で換算。"],
        body: [
          "海外サイトの価格を選択して、ボタンを押すだけ。",
          "ページを離れずに、いつもの通貨で確かめられます。",
        ],
        bullets: [
          `${n}の通貨に対応`,
          "1時間ごとに更新される最新レートで換算",
          "最大5通貨へ一度に換算",
          "1日から1年までのレートの推移をグラフで確認",
          "「$」「USD」「円」のどの書き方の金額も検出",
        ],
      },
      currencyPicker: {
        headline: [`${n}の通貨から、`, "換算先を選べる。"],
        body: [
          "通貨コード、通貨名、地域名で検索して、換算先を最大5通貨まで登録できます。法定通貨のほか、暗号資産や貴金属にも換算できます。",
        ],
        bullets: [
          "ビットコイン、イーサリアムなどの暗号資産にも対応",
          "金・銀・プラチナ・パラジウムにも対応",
          "「$」「¥」がどの通貨を指すかも設定可能",
        ],
      },
      toolbarPopup: {
        headline: ["ツールバーから、", "いつでも換算。"],
        body: ["金額を入力するだけで、", "登録した通貨へまとめて換算します。"],
      },
    },
    "zh-CN": {
      fontFamily: `"PingFang SC","Noto Sans CJK SC",system-ui,sans-serif`,
      selectAndConvert: {
        headline: ["选中价格，", "当场换算。"],
        body: [
          "在海外网站上选中价格，点击按钮即可。",
          "无需离开页面，就能用熟悉的货币查看。",
        ],
        bullets: [
          `支持 ${n} 种货币`,
          "使用每小时更新的最新汇率",
          "一次换算为最多 5 种货币",
          "用图表查看 1 天到 1 年的汇率走势",
          "“$”“USD”“元”等写法都能识别",
        ],
      },
      currencyPicker: {
        headline: [`从 ${n} 种货币中，`, "选择目标货币。"],
        body: [
          "按货币代码、名称或地区搜索，最多可添加 5 种目标货币。除法定货币外，还能换算为加密货币和贵金属。",
        ],
        bullets: [
          "支持比特币、以太坊等加密货币",
          "支持金、银、铂、钯",
          "可设置“$”“¥”代表哪种货币",
        ],
      },
      toolbarPopup: {
        headline: ["在工具栏中，", "随时换算。"],
        body: ["只需输入金额，", "即可一次换算为已添加的所有货币。"],
      },
    },
    "zh-TW": {
      fontFamily: `"PingFang TC","Noto Sans CJK TC",system-ui,sans-serif`,
      selectAndConvert: {
        headline: ["選取價格，", "當場換算。"],
        body: [
          "在海外網站上選取價格，按下按鈕即可。",
          "不必離開頁面，就能用熟悉的貨幣確認。",
        ],
        bullets: [
          `支援 ${n} 種貨幣`,
          "使用每小時更新的最新匯率",
          "一次換算成最多 5 種貨幣",
          "用圖表查看 1 天到 1 年的匯率走勢",
          "「$」「USD」「元」等寫法都能辨識",
        ],
      },
      currencyPicker: {
        headline: [`從 ${n} 種貨幣中，`, "選擇目標貨幣。"],
        body: [
          "依貨幣代碼、名稱或地區搜尋，最多可新增 5 種目標貨幣。除了法定貨幣，也能換算成加密貨幣和貴金屬。",
        ],
        bullets: [
          "支援比特幣、以太坊等加密貨幣",
          "支援金、銀、鉑、鈀",
          "可設定「$」「¥」代表哪種貨幣",
        ],
      },
      toolbarPopup: {
        headline: ["從工具列，", "隨時換算。"],
        body: ["只要輸入金額，", "就能一次換算成已新增的所有貨幣。"],
      },
    },
    ko: {
      fontFamily: `"Apple SD Gothic Neo","Noto Sans CJK KR",system-ui,sans-serif`,
      selectAndConvert: {
        headline: ["선택한 가격을", "바로 환산."],
        body: [
          "해외 사이트에서 가격을 선택하고 버튼만 누르세요.",
          "페이지를 벗어나지 않고 익숙한 통화로 확인할 수 있습니다.",
        ],
        bullets: [
          `${n}개 통화 지원`,
          "1시간마다 갱신되는 최신 환율로 환산",
          "최대 5개 통화로 한 번에 환산",
          "1일부터 1년까지의 환율 추이를 차트로 확인",
          "‘$’, ‘USD’, ‘원’ 등 어떤 표기도 인식",
        ],
      },
      currencyPicker: {
        headline: [`${n}개 통화 중에서`, "환산 통화 선택."],
        body: [
          "통화 코드, 이름, 지역으로 검색해 환산 통화를 최대 5개까지 추가할 수 있습니다. 법정 통화는 물론 암호화폐와 귀금속으로도 환산합니다.",
        ],
        bullets: [
          "비트코인, 이더리움 등 암호화폐 지원",
          "금, 은, 백금, 팔라듐 지원",
          "‘$’, ‘¥’가 어떤 통화인지 설정 가능",
        ],
      },
      toolbarPopup: {
        headline: ["툴바에서", "언제든 환산."],
        body: ["금액만 입력하면", "추가한 모든 통화로 한 번에 환산합니다."],
      },
    },
    es: {
      fontFamily: LATIN_FONTS,
      selectAndConvert: {
        headline: ["Selecciona un precio.", "Conviértelo al instante."],
        body: [
          "Selecciona un precio en cualquier web y pulsa el botón.",
          "Consúltalo en tu divisa sin salir de la página.",
        ],
        bullets: [
          `${n} divisas compatibles`,
          "Tipos de cambio actualizados cada hora",
          "Hasta 5 divisas a la vez",
          "Gráficos de tipos de cambio de 1 día a 1 año",
          "Reconoce «$», «USD» y «dólares» por igual",
        ],
      },
      currencyPicker: {
        headline: [`Elige entre ${n}`, "divisas."],
        body: [
          "Busca por código, nombre o región y añade hasta cinco divisas de destino. Convierte también a criptomonedas y metales preciosos.",
        ],
        bullets: [
          "Bitcoin, Ethereum y otras criptomonedas",
          "Oro, plata, platino y paladio",
          "Elige qué significan «$» y «¥» para ti",
        ],
      },
      toolbarPopup: {
        headline: ["Convierte cuando quieras", "desde la barra."],
        body: ["Escribe un importe y conviértelo", "a todas tus divisas a la vez."],
      },
    },
    fr: {
      fontFamily: LATIN_FONTS,
      selectAndConvert: {
        headline: ["Sélectionnez un prix,", "il est converti."],
        body: [
          "Sélectionnez un prix sur n’importe quel site, puis cliquez sur le bouton.",
          "Consultez-le dans votre devise sans quitter la page.",
        ],
        bullets: [
          `${n} devises prises en charge`,
          "Taux de change actualisés toutes les heures",
          "Jusqu’à 5 devises à la fois",
          "Graphiques des taux, de 1 jour à 1 an",
          "Reconnaît « $ », « USD » et « euros »",
        ],
      },
      currencyPicker: {
        headline: [`Choisissez parmi`, `${n} devises.`],
        body: [
          "Recherchez par code, nom ou région et ajoutez jusqu’à cinq devises cibles. Convertissez aussi en cryptomonnaies et en métaux précieux.",
        ],
        bullets: [
          "Bitcoin, Ethereum et autres cryptomonnaies",
          "Or, argent, platine et palladium",
          "Choisissez la devise désignée par « $ » et « ¥ »",
        ],
      },
      toolbarPopup: {
        headline: ["Convertissez à tout moment", "depuis la barre d’outils."],
        body: [
          "Saisissez un montant pour le convertir",
          "dans toutes vos devises à la fois.",
        ],
      },
    },
    de: {
      fontFamily: LATIN_FONTS,
      selectAndConvert: {
        headline: ["Preis markieren.", "Sofort umgerechnet."],
        body: [
          "Markiere einen Preis auf einer beliebigen Website und klicke auf die Schaltfläche.",
          "So siehst du ihn in deiner Währung, ohne die Seite zu verlassen.",
        ],
        bullets: [
          `${n} Währungen unterstützt`,
          "Stündlich aktualisierte Wechselkurse",
          "Bis zu 5 Währungen auf einmal",
          "Kursverlauf von 1 Tag bis 1 Jahr als Diagramm",
          "Erkennt „$“, „USD“ und „Euro“ gleichermaßen",
        ],
      },
      currencyPicker: {
        headline: [`Aus ${n} Währungen`, "frei wählen."],
        body: [
          "Suche nach Code, Name oder Region und füge bis zu fünf Zielwährungen hinzu. Neben Landeswährungen auch in Kryptowährungen und Edelmetalle umrechnen.",
        ],
        bullets: [
          "Bitcoin, Ethereum und weitere Kryptowährungen",
          "Gold, Silber, Platin und Palladium",
          "Lege fest, wofür „$“ und „¥“ stehen",
        ],
      },
      toolbarPopup: {
        headline: ["Jederzeit umrechnen,", "direkt in der Symbolleiste."],
        body: [
          "Gib einen Betrag ein und rechne ihn",
          "in alle deine Währungen auf einmal um.",
        ],
      },
    },
    "pt-BR": {
      fontFamily: LATIN_FONTS,
      selectAndConvert: {
        headline: ["Selecione um preço.", "Veja convertido na hora."],
        body: [
          "Selecione um preço em qualquer site e clique no botão.",
          "Confira na sua moeda sem sair da página.",
        ],
        bullets: [
          `${n} moedas compatíveis`,
          "Cotações atualizadas a cada hora",
          "Até 5 moedas de uma vez",
          "Gráficos de cotações de 1 dia a 1 ano",
          "Reconhece “$”, “USD” e “reais”",
        ],
      },
      currencyPicker: {
        headline: [`Escolha entre ${n}`, "moedas."],
        body: [
          "Pesquise por código, nome ou região e adicione até cinco moedas de destino. Converta também para criptomoedas e metais preciosos.",
        ],
        bullets: [
          "Bitcoin, Ethereum e outras criptomoedas",
          "Ouro, prata, platina e paládio",
          "Defina o que “$” e “¥” significam para você",
        ],
      },
      toolbarPopup: {
        headline: ["Converta a qualquer hora", "pela barra de ferramentas."],
        body: ["Digite um valor para convertê-lo", "em todas as suas moedas de uma vez."],
      },
    },
  };
}
