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
    addTarget: "Add a target",
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
    conversionMissingTarget:
      "Add at least one conversion target in Currency Lens settings.",
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
      "Convert selected prices into your chosen currencies without leaving the page.",
    finishTargetEditing: "Finish editing conversion targets",
    interfaceEyebrow: "Interface",
    loadingApp: "Loading Currency Lens",
    loadingConversion: "Converting currency",
    openApp: "Open Currency Lens",
    openSettings: "Open settings",
    popupBack: "Back",
    ratesFrom: "Rates from {timestamp}",
    ratesStale: "Using the last available rates. They are at least 24 hours old.",
    removeCurrency: "Remove {currency}",
    reorderCurrency: "Reorder {currency}, position {position} of {total}",
    reorderInstructions:
      "Drag a reorder handle, or use the up and down arrow keys, to reorder converted currencies.",
    reorderMoved: "{currency} moved to position {position} of {total}.",
    sourceAmount: "Amount",
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
    targetEmpty: "Add a currency to activate conversions.",
    targetsHeading: "Conversion targets",
  },
  ja: {
    addTarget: "換算通貨を追加",
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
    conversionMissingTarget:
      "Currency Lens の設定で換算後の通貨を1件以上追加してください。",
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
    extensionDescription: "選択した金額を、ページを離れずに指定通貨へ換算します。",
    finishTargetEditing: "換算後の編集を終了",
    interfaceEyebrow: "インターフェース",
    loadingApp: "Currency Lens を読み込み中",
    loadingConversion: "通貨を換算中",
    openApp: "Currency Lens を開く",
    openSettings: "設定を開く",
    popupBack: "戻る",
    ratesFrom: "{timestamp} 時点のレート",
    ratesStale: "24時間以上前に取得したレートを表示しています。",
    removeCurrency: "{currency} を削除",
    reorderCurrency: "{currency} を並べ替え、{total}件中{position}番目",
    reorderInstructions:
      "並べ替えハンドルをドラッグするか、上下矢印キーで換算後の順序を変更します。",
    reorderMoved: "{currency} を{total}件中{position}番目へ移動しました。",
    sourceAmount: "金額",
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
    targetEmpty: "換算を有効にする通貨を追加してください。",
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
