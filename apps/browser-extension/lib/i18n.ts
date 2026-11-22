export const SUPPORTED_UI_LOCALES = ["en", "ja"] as const;

export type UiLocale = (typeof SUPPORTED_UI_LOCALES)[number];

const MAX_STANDARD_CONVERTED_AMOUNT_CHARACTERS = 14;

const currencyDisplayNameOverrides: Readonly<
  Record<UiLocale, Readonly<Record<string, string>>>
> = {
  en: {
    BTC: "Bitcoin",
    BTS: "BitShares",
    CNH: "Chinese Yuan (offshore)",
    DASH: "Dash",
    DOGE: "Dogecoin",
    ETH: "Ethereum",
    LD: "Linden Dollar",
    LTC: "Litecoin",
    NXT: "Nxt",
    STR: "Stellar",
    XAG: "Silver",
    XAU: "Gold",
    XDR: "Special Drawing Rights",
    XMR: "Monero",
    XPD: "Palladium",
    XPT: "Platinum",
    XRP: "XRP",
  },
  ja: {
    BTC: "ビットコイン",
    BTS: "ビットシェアーズ",
    CNH: "中国人民元（オフショア）",
    DASH: "ダッシュ",
    DOGE: "ドージコイン",
    ETH: "イーサリアム",
    LD: "リンデンドル",
    LTC: "ライトコイン",
    NXT: "ネクスト",
    STR: "ステラ",
    XAG: "銀",
    XAU: "金",
    XDR: "特別引出権",
    XMR: "モネロ",
    XPD: "パラジウム",
    XPT: "プラチナ",
    XRP: "XRP",
  },
};

const messages = {
  en: {
    aboutHeading: "About",
    aboutLicense: "License",
    aboutPrivacyPolicy: "Privacy policy",
    aboutRateSource: "Exchange rates",
    aboutReview: "Write a review on {store}",
    aboutSourceCode: "Source code",
    aboutVersion: "Version {version}",
    addTarget: "Add a target",
    ambiguousAutomatic: "Automatic",
    ambiguousDescription:
      "Choose how symbols with more than one meaning should be interpreted.",
    ambiguousHeading: "Currency conversion settings",
    ambiguousMixed: "Mixed alias settings · choose a value",
    ambiguousOpen: "Manage all symbol mappings",
    appName: "Currency Lens",
    autoSaveError: "Couldn’t save your settings.",
    closeApp: "Close",
    conversionEmpty: "No supported monetary amount was found.",
    conversionError: "Couldn’t focus the rates",
    conversionRetry: "Try selecting the price again after rates are available.",
    conversionResult: "Conversion result",
    conversionUnavailable: "Rate unavailable",
    convertedHeading: "Converted",
    convertSelection: "Convert selected price",
    currencyNoResults: "No matching currency found.",
    currencySearchLabel: "Search currencies",
    currencySearchPlaceholder: "Code, name, or region",
    displayDescription: "Choose the display theme for Currency Lens.",
    displayHeading: "Appearance",
    displayTheme: "Theme",
    displayThemeDark: "Dark",
    displayThemeLight: "Light",
    displayThemeSystem: "System",
    editTargets: "Edit conversion targets",
    extensionDescription:
      "Currency converter: select any price on a web page and convert it into up to 5 currencies with live exchange rates.",
    finishTargetEditing: "Finish editing conversion targets",
    interfaceEyebrow: "Interface",
    licensesCount: "{count} packages",
    licensesDescription: "Currency Lens includes the following open source software.",
    licensesHeading: "Open source licenses",
    licensesNoText:
      "This package does not ship a license file. Its declared license is {license}.",
    loadingApp: "Loading Currency Lens",
    loadingConversion: "Converting currency",
    openApp: "Open Currency Lens",
    openInNewTab: "(opens in a new tab)",
    openSettings: "Open settings",
    openRates: "Open {currency} rates",
    period1D: "1D",
    period1M: "1M",
    period1Y: "1Y",
    period5D: "5D",
    period6M: "6M",
    periodYTD: "YTD",
    periodPast1D: "past day",
    periodPast1M: "past month",
    periodPast1Y: "past year",
    periodPast5D: "past 5 days",
    periodPast6M: "past 6 months",
    periodPastYTD: "year to date",
    rateChartLabel: "{base} to {currency} chart, {period}",
    rateChartPercentLabel: "Change against {base} chart, {period}",
    rateChangeSince: "since {date}",
    rateHistoryEmpty:
      "Rate history isn’t available yet. It builds up as rates are collected every hour.",
    rateHistoryError: "Couldn’t load the rate history.",
    rateHistoryLoading: "Loading rate history",
    rateHistoryRetry: "Retry",
    rateHistoryNoData: "No data",
    rateHistoryNoTargets: "Add a conversion target other than {base} to see its rates.",
    ratesAll: "ALL",
    ratesAllCaption: "Change against {base}",
    ratesAllName: "All currencies",
    ratesBaseHeading: "Base",
    ratesCurrencyGroup: "Currency to show",
    ratesHeading: "Rates",
    ratesPeriodGroup: "Period",
    screenConverter: "Convert",
    screenRates: "Rates",
    screenSwitcher: "Screen",
    popupBack: "Back",
    quickConversion: "{amount} ({currency}). Show all conversions",
    ratesStale: "Using the last available rates. They are at least 24 hours old.",
    removeCurrency: "Remove {currency}",
    reorderCurrency: "Reorder {currency}, position {position} of {total}",
    reorderInstructions:
      "Drag a reorder handle, or use the up and down arrow keys, to reorder converted currencies.",
    reorderMoved: "{currency} moved to position {position} of {total}.",
    sourceAmount: "Amount",
    storeChrome: "Chrome Web Store",
    storeFirefox: "Firefox Add-ons",
    sourceAmountInvalid: "Enter an amount greater than 0.",
    sourceCurrency: "Currency",
    sourceHeading: "Original",
    settingsHeading: "Settings",
    supportedCurrenciesCount: "{count} currencies",
    supportedCurrenciesDescription:
      "Every currency in the bundled currency data is listed here.",
    supportedCurrenciesHeading: "Supported currencies",
    targetChoose: "Choose currency…",
    targetDescription:
      "The selected price is converted into each currency below, in this order.",
    targetsHeading: "Conversion targets",
  },
  ja: {
    aboutHeading: "このアプリについて",
    aboutLicense: "ライセンス",
    aboutPrivacyPolicy: "プライバシーポリシー",
    aboutRateSource: "為替レートの提供元",
    aboutReview: "{store}でレビューを書く",
    aboutSourceCode: "ソースコード",
    aboutVersion: "バージョン {version}",
    addTarget: "換算通貨を追加",
    ambiguousAutomatic: "自動判定",
    ambiguousDescription: "複数の通貨を表す記号を、どの通貨として読むか設定します。",
    ambiguousHeading: "通貨変換設定",
    ambiguousMixed: "別表記ごとの設定が混在しています · 選び直してください",
    ambiguousOpen: "すべての記号設定を開く",
    appName: "Currency Lens",
    autoSaveError: "設定を保存できませんでした。",
    closeApp: "閉じる",
    conversionEmpty: "対応している金額が見つかりませんでした。",
    conversionError: "為替レートを取得できませんでした",
    conversionRetry: "レート取得後に、もう一度金額を選択してください。",
    conversionResult: "換算結果",
    conversionUnavailable: "レートを利用できません",
    convertedHeading: "換算後",
    convertSelection: "選択した金額を換算",
    currencyNoResults: "一致する通貨がありません。",
    currencySearchLabel: "通貨を検索",
    currencySearchPlaceholder: "コード・通貨名・地域",
    displayDescription: "Currency Lens の表示テーマを選びます。",
    displayHeading: "外観",
    displayTheme: "テーマ",
    displayThemeDark: "ダーク",
    displayThemeLight: "ライト",
    displayThemeSystem: "システム",
    editTargets: "換算後を編集",
    extensionDescription:
      "通貨換算コンバーター。Webページ上の金額を選択するだけで、最大5通貨へその場で換算します。最新の為替レート対応。",
    finishTargetEditing: "換算後の編集を終了",
    interfaceEyebrow: "インターフェース",
    licensesCount: "{count} 件",
    licensesDescription: "Currency Lens は次のオープンソースソフトウェアを利用しています。",
    licensesHeading: "オープンソースライセンス",
    licensesNoText:
      "このパッケージにはライセンス本文のファイルが含まれていません。宣言されたライセンスは {license} です。",
    loadingApp: "Currency Lens を読み込み中",
    loadingConversion: "通貨を換算中",
    openApp: "Currency Lens を開く",
    openInNewTab: "（新しいタブで開きます）",
    openSettings: "設定を開く",
    openRates: "{currency} のレートを開く",
    period1D: "1日",
    period1M: "1か月",
    period1Y: "1年",
    period5D: "5日",
    period6M: "6か月",
    periodYTD: "YTD",
    periodPast1D: "過去1日",
    periodPast1M: "過去1か月",
    periodPast1Y: "過去1年",
    periodPast5D: "過去5日",
    periodPast6M: "過去6か月",
    periodPastYTD: "YTD",
    rateChartLabel: "{base} に対する {currency} のチャート（{period}）",
    rateChartPercentLabel: "対 {base} の変化率のチャート（{period}）",
    rateChangeSince: "{date} から",
    rateHistoryEmpty:
      "レートの履歴はまだありません。履歴は1時間ごとに取得したレートから作られます。",
    rateHistoryError: "レートの履歴を取得できませんでした。",
    rateHistoryLoading: "レートの履歴を読み込み中",
    rateHistoryRetry: "再読み込み",
    rateHistoryNoData: "データなし",
    rateHistoryNoTargets: "{base} 以外の換算先を追加すると、レートを表示します。",
    ratesAll: "ALL",
    ratesAllCaption: "対 {base} の変化率",
    ratesAllName: "ALL（すべての通貨）",
    ratesBaseHeading: "基準",
    ratesCurrencyGroup: "表示する通貨",
    ratesHeading: "レート",
    ratesPeriodGroup: "期間",
    screenConverter: "換算",
    screenRates: "レート",
    screenSwitcher: "表示する画面",
    popupBack: "戻る",
    quickConversion: "{amount}（{currency}）。すべての換算先を表示",
    ratesStale: "24時間以上前に取得したレートを表示しています。",
    removeCurrency: "{currency} を削除",
    reorderCurrency: "{currency} を並べ替え、{total}件中{position}番目",
    reorderInstructions:
      "並べ替えハンドルをドラッグするか、上下矢印キーで換算後の順序を変更します。",
    reorderMoved: "{currency} を{total}件中{position}番目へ移動しました。",
    sourceAmount: "金額",
    storeChrome: "Chrome ウェブストア",
    storeFirefox: "Firefox Add-ons",
    sourceAmountInvalid: "0より大きい金額を入力してください。",
    sourceCurrency: "通貨",
    sourceHeading: "換算元",
    settingsHeading: "設定",
    supportedCurrenciesCount: "{count} 通貨",
    supportedCurrenciesDescription:
      "内蔵の通貨データに含まれるすべての通貨を表示しています。",
    supportedCurrenciesHeading: "対応通貨一覧",
    targetChoose: "通貨を選択…",
    targetDescription: "選択した金額を、次の通貨へ上から順に換算します。",
    targetsHeading: "換算後",
  },
} as const;

export type TranslationKey = keyof (typeof messages)["en"];

/** Resolves the browser language to one of the UI locales shipped by the extension. */
export function resolveUiLocale(language: string | undefined): UiLocale {
  return language?.toLowerCase().startsWith("ja") === true ? "ja" : "en";
}

/** Returns the best available browser language without assuming extension globals exist. */
export function getUiLocale(language?: string): UiLocale {
  if (language !== undefined) {
    return resolveUiLocale(language);
  }
  if (typeof browser !== "undefined") {
    return resolveUiLocale(browser.i18n.getUILanguage());
  }
  return resolveUiLocale(typeof navigator === "undefined" ? undefined : navigator.language);
}

/** Formats a typed message and replaces named placeholders with display values. */
export function translate(
  locale: UiLocale,
  key: TranslationKey,
  replacements: Readonly<Record<string, number | string>> = {},
): string {
  let message: string = messages[locale][key];
  for (const [name, value] of Object.entries(replacements)) {
    message = message.replaceAll(`{${name}}`, String(value));
  }
  return message;
}

/** Returns a localized currency name while keeping private or unsupported codes readable. */
export function getCurrencyDisplayName(currencyCode: string, locale: UiLocale): string {
  const override = currencyDisplayNameOverrides[locale][currencyCode];
  if (override !== undefined) {
    return override;
  }
  try {
    return (
      new Intl.DisplayNames([locale], { type: "currency" }).of(currencyCode) ?? currencyCode
    );
  } catch {
    return currencyCode;
  }
}

/** Returns localized region names for compact currency metadata. */
export function getRegionDisplayNames(
  regionCodes: readonly string[],
  locale: UiLocale,
  limit = 3,
): string {
  try {
    const displayNames = new Intl.DisplayNames([locale], { type: "region" });
    return regionCodes
      .slice(0, limit)
      .map((regionCode) => displayNames.of(regionCode) ?? regionCode)
      .join(" · ");
  } catch {
    return regionCodes.slice(0, limit).join(" · ");
  }
}

/** Formats a converted amount with the target currency's narrow symbol and its own fraction digits. */
export function formatCurrencyAmount(
  value: string,
  currencyCode: string,
  fractionDigits: number,
  locale: UiLocale,
): string {
  const digits = {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  };
  const numericValue = Number(value);
  try {
    return new Intl.NumberFormat(locale, {
      ...digits,
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
      style: "currency",
    }).format(numericValue);
  } catch {
    // Intl accepts only three-letter codes, so codes such as DASH are appended instead.
    return `${new Intl.NumberFormat(locale, digits).format(numericValue)} ${currencyCode}`;
  }
}

/** Uses a two-decimal mantissa when the standard two-decimal display is too wide. */
export function formatConvertedAmount(value: string, locale: UiLocale): string {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return value;
  }
  try {
    const formatter = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
    const standardText = formatter.format(numericValue);
    return standardText.length <= MAX_STANDARD_CONVERTED_AMOUNT_CHARACTERS
      ? standardText
      : numericValue.toExponential(2).replace("e", "E");
  } catch {
    return value;
  }
}
