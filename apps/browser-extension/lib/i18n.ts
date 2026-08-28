export const SUPPORTED_UI_LOCALES = ["en", "ja"] as const;

export type UiLocale = (typeof SUPPORTED_UI_LOCALES)[number];

const messages = {
  en: {
    add: "Add",
    addTarget: "Add a target",
    ambiguousAutomatic: "Automatic · {currency}",
    ambiguousDescription:
      "Choose how symbols with more than one meaning should be interpreted.",
    ambiguousHeading: "Ambiguous symbols",
    ambiguousMixed: "Mixed alias settings · choose a value",
    ambiguousOpen: "Manage all symbol mappings",
    ambiguousSummary: "All {count} ambiguous symbols",
    appName: "Currency Lens",
    autoSaveError: "Couldn’t save your settings.",
    closeApp: "Close Currency Lens",
    conversionEmpty: "No supported monetary amount was found.",
    conversionError: "Couldn’t focus the rates",
    conversionRetry: "Try selecting the price again after rates are available.",
    conversionMissingTarget:
      "Add at least one conversion target in Currency Lens settings.",
    conversionSettingsHeading: "Conversion settings",
    conversionSettingsOpen: "Open conversion settings",
    conversionUnavailable: "Rate unavailable",
    convertSelection: "Convert selected price",
    displayDescription: "Choose the information shown beside converted values.",
    displayHeading: "Display",
    displayTheme: "Theme",
    displayThemeDark: "Dark",
    displayThemeLight: "Light",
    displayThemeSystem: "Follow system",
    displayToggleCode: "Show ISO currency codes",
    displayToggleIcon: "Show currency symbols",
    extensionDescription:
      "Convert selected prices into your chosen currencies without leaving the page.",
    interfaceEyebrow: "Interface",
    loadingApp: "Loading Currency Lens",
    loadingConversion: "Converting currency",
    openApp: "Open Currency Lens",
    optionsAllCurrencies: "Supported currencies",
    optionsAllCurrenciesDescription:
      "Every currency in the bundled currency data is listed here.",
    optionsBack: "Close settings",
    optionsCurrencyCount: "{count} currencies",
    optionsEyebrow: "Detection settings",
    optionsSearchCurrency: "Search currencies",
    optionsSearchPlaceholder: "Code, name, or region",
    optionsSymbolCount: "{count} symbols",
    optionsTitle: "Conversion settings",
    popupDescription:
      "Select a price on any page, then open the lens beside your selection.",
    popupEyebrow: "Instant exchange view",
    rateLastKnown: "Last known",
    rateOffline: "Offline",
    rateReady: "Rates ready",
    rateSyncing: "Syncing",
    ratesFrom: "Rates from {timestamp}",
    ratesStale: "Using the last available rates. They are more than 24 hours old.",
    removeCurrency: "Remove {currency}",
    reorderCurrency: "Reorder {currency}, position {position} of {total}",
    reorderInstructions:
      "Drag the handle, or use the up and down arrow keys, to reorder conversion targets.",
    reorderMoved: "{currency} moved to position {position} of {total}.",
    saveSaved: "Saved automatically",
    saveSaving: "Saving…",
    selectionFound: "Selection found",
    targetChoose: "Choose currency…",
    targetCount: "{current}/{maximum}",
    targetDescription:
      "The selected price is converted into each currency below, in this order.",
    targetEmpty: "Add a currency to activate conversions.",
    targetsHeading: "Conversion targets",
  },
  ja: {
    add: "追加",
    addTarget: "換算先を追加",
    ambiguousAutomatic: "自動判定 · {currency}",
    ambiguousDescription: "複数の通貨を表す記号を、どの通貨として読むか設定します。",
    ambiguousHeading: "曖昧な通貨記号",
    ambiguousMixed: "別表記ごとの設定が混在しています · 選び直してください",
    ambiguousOpen: "すべての記号設定を開く",
    ambiguousSummary: "曖昧な記号 {count} 件",
    appName: "Currency Lens",
    autoSaveError: "設定を保存できませんでした。",
    closeApp: "Currency Lens を閉じる",
    conversionEmpty: "対応している金額が見つかりませんでした。",
    conversionError: "為替レートを取得できませんでした",
    conversionRetry: "レート取得後に、もう一度金額を選択してください。",
    conversionMissingTarget: "Currency Lens の設定で換算先を1件以上追加してください。",
    conversionSettingsHeading: "換算設定",
    conversionSettingsOpen: "換算設定を開く",
    conversionUnavailable: "レートを利用できません",
    convertSelection: "選択した金額を換算",
    displayDescription: "換算結果に表示する情報を選びます。",
    displayHeading: "表示",
    displayTheme: "テーマ",
    displayThemeDark: "ダーク",
    displayThemeLight: "ライト",
    displayThemeSystem: "システム設定に合わせる",
    displayToggleCode: "ISO通貨コードを表示",
    displayToggleIcon: "通貨記号を表示",
    extensionDescription: "選択した金額を、ページを離れずに指定通貨へ換算します。",
    interfaceEyebrow: "インターフェース",
    loadingApp: "Currency Lens を読み込み中",
    loadingConversion: "通貨を換算中",
    openApp: "Currency Lens を開く",
    optionsAllCurrencies: "対応通貨",
    optionsAllCurrenciesDescription:
      "内蔵の通貨データに含まれるすべての通貨を表示しています。",
    optionsBack: "設定を閉じる",
    optionsCurrencyCount: "{count} 通貨",
    optionsEyebrow: "検出設定",
    optionsSearchCurrency: "通貨を検索",
    optionsSearchPlaceholder: "コード・通貨名・地域",
    optionsSymbolCount: "{count} 記号",
    optionsTitle: "換算設定",
    popupDescription: "ページ上の金額を選択し、横に表示されるレンズを開きます。",
    popupEyebrow: "その場で為替換算",
    rateLastKnown: "前回のレート",
    rateOffline: "オフライン",
    rateReady: "レート取得済み",
    rateSyncing: "同期中",
    ratesFrom: "{timestamp} 時点のレート",
    ratesStale: "24時間以上前に取得したレートを表示しています。",
    removeCurrency: "{currency} を削除",
    reorderCurrency: "{currency} を並べ替え、{total}件中{position}番目",
    reorderInstructions:
      "ハンドルをドラッグするか、上下矢印キーで換算先の順序を変更します。",
    reorderMoved: "{currency} を{total}件中{position}番目へ移動しました。",
    saveSaved: "自動保存済み",
    saveSaving: "保存中…",
    selectionFound: "金額を検出",
    targetChoose: "通貨を選択…",
    targetCount: "{current}/{maximum}",
    targetDescription: "選択した金額を、次の通貨へ上から順に換算します。",
    targetEmpty: "換算を有効にする通貨を追加してください。",
    targetsHeading: "換算先通貨",
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
