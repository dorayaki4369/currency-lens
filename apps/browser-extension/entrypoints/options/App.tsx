import { currencies, type CurrencyCode } from "@cl/currency";
import { useMemo, useState } from "react";
import {
  getAmbiguousCurrencySymbolGroups,
  isKnownCurrencyCode,
  type AmbiguousCurrencySymbolGroup,
  type Config,
} from "../../lib/currency";
import {
  getCurrencyDisplayName,
  getRegionDisplayNames,
  getUiLocale,
  translate,
  type UiLocale,
} from "../../lib/i18n";
import { Search, X } from "../shared/Icons";
import { useConfigSettings } from "../shared/useConfigSettings";

const MIXED_OVERRIDE_VALUE = "__mixed_alias_settings__";

export interface OptionsPreviewData {
  readonly config: Config;
  readonly locale?: UiLocale | undefined;
}

interface AppProps {
  readonly preview?: OptionsPreviewData;
}

/** Renders complete symbol mappings and the searchable bundled currency catalog. */
function App({ preview }: AppProps) {
  const locale = preview?.locale ?? getUiLocale();
  const { config, error, loading, saveState, updateConfig } = useConfigSettings({
    previewConfig: preview?.config,
  });
  const [query, setQuery] = useState("");
  const ambiguousGroups = useMemo(() => getAmbiguousCurrencySymbolGroups(), []);
  const visibleCurrencies = useMemo(() => filterCurrencies(query, locale), [locale, query]);

  const handleSymbolOverride = (group: AmbiguousCurrencySymbolGroup, value: string) => {
    updateConfig((current) => {
      const symbolOverrides = { ...current.symbolOverrides };
      for (const token of group.tokens) {
        if (isKnownCurrencyCode(value) && group.currencyCodes.includes(value)) {
          symbolOverrides[token] = value;
        } else {
          delete symbolOverrides[token];
        }
      }
      return { ...current, symbolOverrides };
    });
  };

  const theme = config?.theme ?? "system";
  return (
    <main className={`cl-options cl-root cl-theme-${theme}`}>
      <header className="cl-options__header">
        <div className="cl-options__brand">
          <span aria-hidden="true" className="cl-aperture">
            <span className="cl-aperture__core" />
          </span>
          <div>
            <p className="cl-eyebrow">{translate(locale, "optionsEyebrow")}</p>
            <h1>{translate(locale, "optionsTitle")}</h1>
          </div>
        </div>
        <button
          aria-label={translate(locale, "optionsBack")}
          className="cl-options__close"
          onClick={() => window.close()}
          type="button"
        >
          <X aria-hidden="true" />
          <span>{translate(locale, "optionsBack")}</span>
        </button>
      </header>

      {error !== null ? (
        <div className="cl-notice cl-notice--error" role="alert">
          {translate(locale, "autoSaveError")}
        </div>
      ) : null}

      {loading ? <OptionsSkeleton locale={locale} /> : null}
      {!loading && config !== null ? (
        <div className="cl-options__layout">
          <section className="cl-options-panel" aria-labelledby="ambiguous-heading">
            <div className="cl-options-panel__heading">
              <div>
                <h2 id="ambiguous-heading">{translate(locale, "ambiguousHeading")}</h2>
                <p>{translate(locale, "ambiguousDescription")}</p>
              </div>
              <span className="cl-count-badge">
                {translate(locale, "optionsSymbolCount", {
                  count: ambiguousGroups.length,
                })}
              </span>
            </div>
            <ul aria-labelledby="ambiguous-heading" className="cl-symbol-list">
              {ambiguousGroups.map((group) => (
                <li key={group.tokens.join("")}>
                  <SymbolMappingRow
                    group={group}
                    locale={locale}
                    onChange={handleSymbolOverride}
                    value={getGroupOverride(config, group)}
                  />
                </li>
              ))}
            </ul>
            <AutoSaveStatus locale={locale} saveState={saveState} />
          </section>

          <section className="cl-options-panel" aria-labelledby="currencies-heading">
            <div className="cl-options-panel__heading">
              <div>
                <h2 id="currencies-heading">{translate(locale, "optionsAllCurrencies")}</h2>
                <p>{translate(locale, "optionsAllCurrenciesDescription")}</p>
              </div>
              <span className="cl-count-badge">
                {translate(locale, "optionsCurrencyCount", { count: currencies.length })}
              </span>
            </div>
            <label className="cl-options-search">
              <span className="cl-visually-hidden">
                {translate(locale, "optionsSearchCurrency")}
              </span>
              <Search aria-hidden="true" />
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder={translate(locale, "optionsSearchPlaceholder")}
                type="search"
                value={query}
              />
            </label>
            <ul aria-labelledby="currencies-heading" className="cl-currency-catalog">
              {visibleCurrencies.map((currency) => (
                <li key={currency.code}>
                  <span className="cl-currency-mark">
                    {getCurrencyMark(currency.code, locale)}
                  </span>
                  <span>
                    <strong>{currency.code}</strong>
                    <small>{getCurrencyDisplayName(currency.code, locale)}</small>
                  </span>
                  <small className="cl-currency-catalog__regions">
                    {getRegionDisplayNames(currency.countries, locale, 2)}
                  </small>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function SymbolMappingRow({
  group,
  locale,
  onChange,
  value,
}: {
  readonly group: AmbiguousCurrencySymbolGroup;
  readonly locale: UiLocale;
  readonly onChange: (group: AmbiguousCurrencySymbolGroup, value: string) => void;
  readonly value: string;
}) {
  return (
    <label className="cl-symbol-row">
      <span className="cl-symbol-row__tokens">
        {group.tokens.map((token) => (
          <code key={token}>{token}</code>
        ))}
      </span>
      <select
        aria-label={group.tokens.join(" ")}
        onChange={(event) => onChange(group, event.target.value)}
        value={value}
      >
        {value === MIXED_OVERRIDE_VALUE ? (
          <option disabled value={MIXED_OVERRIDE_VALUE}>
            {translate(locale, "ambiguousMixed")}
          </option>
        ) : null}
        <option value="">
          {translate(locale, "ambiguousAutomatic", {
            currency: `${group.defaultCurrency} · ${getCurrencyDisplayName(
              group.defaultCurrency,
              locale,
            )}`,
          })}
        </option>
        {group.currencyCodes.map((currencyCode) => (
          <option key={currencyCode} value={currencyCode}>
            {currencyCode} · {getCurrencyDisplayName(currencyCode, locale)}
          </option>
        ))}
      </select>
    </label>
  );
}

function AutoSaveStatus({
  locale,
  saveState,
}: {
  readonly locale: UiLocale;
  readonly saveState: "error" | "idle" | "saved" | "saving";
}) {
  if (saveState === "error") {
    return null;
  }
  return (
    <span aria-live="polite" className="cl-auto-save-status cl-auto-save-status--options">
      <span className="cl-live-dot" />
      {translate(locale, saveState === "saving" ? "saveSaving" : "saveSaved")}
    </span>
  );
}

function OptionsSkeleton({ locale }: { readonly locale: UiLocale }) {
  return (
    <div
      aria-label={translate(locale, "loadingApp")}
      className="cl-options-skeleton"
      role="status"
    >
      <span />
      <span />
    </div>
  );
}

/** Distinguishes automatic, consistent, and partially migrated alias settings. */
function getGroupOverride(config: Config, group: AmbiguousCurrencySymbolGroup): string {
  const values = group.tokens.map((token) => config.symbolOverrides[token]);
  if (values.every((value) => value === undefined)) {
    return "";
  }
  const [firstValue] = values;
  return firstValue !== undefined && values.every((value) => value === firstValue)
    ? firstValue
    : MIXED_OVERRIDE_VALUE;
}

/** Filters all bundled currencies by localized name, code, or localized region. */
function filterCurrencies(query: string, locale: UiLocale) {
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  if (normalizedQuery.length === 0) {
    return currencies;
  }
  return currencies.filter((currency) => {
    const searchText = [
      currency.code,
      getCurrencyDisplayName(currency.code, locale),
      getRegionDisplayNames(currency.countries, locale, Number.POSITIVE_INFINITY),
    ]
      .join(" ")
      .toLocaleLowerCase(locale);
    return searchText.includes(normalizedQuery);
  });
}

/** Produces a localized currency glyph while retaining non-ISO code fallbacks. */
function getCurrencyMark(currencyCode: CurrencyCode, locale: UiLocale): string {
  try {
    return (
      new Intl.NumberFormat(locale, {
        currency: currencyCode,
        currencyDisplay: "narrowSymbol",
        style: "currency",
      })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value ?? currencyCode.slice(0, 1)
    );
  } catch {
    return currencyCode.slice(0, 1);
  }
}

export default App;
