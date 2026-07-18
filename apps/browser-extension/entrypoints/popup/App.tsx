import type { CurrencyCode } from "@cl/currency";
import { currencies } from "@cl/currency";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCurrencyMetadata,
  getCurrencySymbolDefinition,
  isKnownCurrencyCode,
  MAX_FAVORITE_CURRENCIES,
  type Config,
} from "../../lib/currency";
import { messageTypes, sendMessage, type GetRatesResponse } from "../../lib/messages";

type RatesData = Extract<GetRatesResponse, { success: true }>["data"];

const AMBIGUOUS_SYMBOLS = ["$", "¥", "£"] as const;
const PRIORITY_CURRENCIES: readonly CurrencyCode[] = [
  "USD",
  "EUR",
  "JPY",
  "GBP",
  "CNY",
  "AUD",
  "CAD",
  "CHF",
];

export interface PopupPreviewData {
  readonly config: Config;
  readonly rates: RatesData;
}

interface AppProps {
  readonly preview?: PopupPreviewData;
}

/** Renders the extension control panel and persists validated user preferences. */
function App({ preview }: AppProps) {
  const [savedConfig, setSavedConfig] = useState<Config | null>(preview?.config ?? null);
  const [draft, setDraft] = useState<Config | null>(preview?.config ?? null);
  const [rates, setRates] = useState<RatesData | null>(preview?.rates ?? null);
  const [loading, setLoading] = useState(preview === undefined);
  const [ratesLoading, setRatesLoading] = useState(preview === undefined);
  const [error, setError] = useState<string | null>(null);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const loadRates = useCallback(async () => {
    if (preview) {
      setRates(preview.rates);
      return;
    }
    setRatesLoading(true);
    setRatesError(null);
    try {
      const response = await sendMessage({ type: messageTypes.GET_RATES });
      if (response.success) {
        setRates(response.data);
      } else {
        setRatesError(response.error);
      }
    } catch (caughtError: unknown) {
      setRatesError(getErrorMessage(caughtError, "Couldn’t load exchange rates."));
    } finally {
      setRatesLoading(false);
    }
  }, [preview]);

  useEffect(() => {
    if (preview) {
      return undefined;
    }

    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const response = await sendMessage({ type: messageTypes.GET_CONFIG });
        if (!active) {
          return;
        }
        if (response.success) {
          setSavedConfig(response.data);
          setDraft(response.data);
        } else {
          setError(response.error);
        }
      } catch (caughtError: unknown) {
        if (active) {
          setError(getErrorMessage(caughtError, "Couldn’t load your settings."));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    void loadRates();
    return () => {
      active = false;
    };
  }, [loadRates, preview]);

  const sortedCurrencies = useMemo(() => {
    const priority = new Map(PRIORITY_CURRENCIES.map((code, index) => [code, index]));
    return currencies.toSorted((left, right) => {
      const leftPriority = priority.get(left.code) ?? Number.POSITIVE_INFINITY;
      const rightPriority = priority.get(right.code) ?? Number.POSITIVE_INFINITY;
      return leftPriority - rightPriority || left.code.localeCompare(right.code);
    });
  }, []);

  const dirty = Boolean(
    draft && savedConfig && JSON.stringify(draft) !== JSON.stringify(savedConfig),
  );
  const isSaving = saveState === "saving";

  const updateDraft = useCallback(
    (update: (current: Config) => Config) => {
      if (isSaving) {
        return;
      }
      setDraft((current) => (current ? update(current) : current));
      setSaveState("idle");
    },
    [isSaving],
  );

  const handleAddFavorite = () => {
    if (!draft || !isKnownCurrencyCode(selectedCurrency)) {
      return;
    }
    if (
      draft.favorites.includes(selectedCurrency) ||
      draft.favorites.length >= MAX_FAVORITE_CURRENCIES
    ) {
      return;
    }
    updateDraft((current) => ({
      ...current,
      favorites: [...current.favorites, selectedCurrency],
    }));
    setSelectedCurrency("");
  };

  const handleRemoveFavorite = (currencyCode: CurrencyCode) => {
    updateDraft((current) => ({
      ...current,
      favorites: current.favorites.filter((favorite) => favorite !== currencyCode),
    }));
  };

  const handleMoveFavorite = (index: number, direction: -1 | 1) => {
    updateDraft((current) => ({
      ...current,
      favorites: moveItem(current.favorites, index, index + direction),
    }));
  };

  const handleSymbolOverride = (symbol: string, value: string) => {
    updateDraft((current) => {
      const symbolOverrides = { ...current.symbolOverrides };
      if (isKnownCurrencyCode(value)) {
        symbolOverrides[symbol] = value;
      } else {
        delete symbolOverrides[symbol];
      }
      return { ...current, symbolOverrides };
    });
  };

  const handleSave = async () => {
    if (!draft || preview) {
      return;
    }
    setSaveState("saving");
    setError(null);
    try {
      const response = await sendMessage({
        type: messageTypes.SET_CONFIG,
        payload: draft,
      });
      if (response.success) {
        setSavedConfig(response.data);
        setDraft(response.data);
        setSaveState("saved");
      } else {
        setError(response.error);
        setSaveState("idle");
      }
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError, "Couldn’t save your settings."));
      setSaveState("idle");
    }
  };

  const theme = draft?.theme ?? "system";
  return (
    <main aria-busy={isSaving} className={`cl-popup cl-root cl-theme-${theme}`}>
      <header className="cl-popup__hero">
        <div className="cl-brand-lockup">
          <span aria-hidden="true" className="cl-aperture">
            <span className="cl-aperture__core" />
          </span>
          <div>
            <p className="cl-eyebrow">Instant exchange view</p>
            <h1>Currency Lens</h1>
          </div>
        </div>
        <RateStatus loading={ratesLoading} rates={rates} />
      </header>

      {error !== null ? (
        <div className="cl-notice cl-notice--error" role="alert">
          {error}
        </div>
      ) : null}

      {loading || !draft ? (
        <PopupSkeleton />
      ) : (
        <>
          <RatePulse
            error={ratesError}
            loading={ratesLoading}
            onRetry={() => void loadRates()}
            rates={rates}
            targets={draft.favorites}
          />

          <section className="cl-panel" aria-labelledby="targets-heading">
            <div className="cl-section-heading">
              <div>
                <p className="cl-eyebrow">Conversion targets</p>
                <h2 id="targets-heading">Favorite currencies</h2>
              </div>
              <span className="cl-count-badge">
                {draft.favorites.length}/{MAX_FAVORITE_CURRENCIES}
              </span>
            </div>
            <p className="cl-section-copy">
              Every selected price is converted into each currency below, in this order.
            </p>

            <FavoriteList
              disabled={isSaving}
              favorites={draft.favorites}
              onMove={handleMoveFavorite}
              onRemove={handleRemoveFavorite}
            />

            <div className="cl-add-currency">
              <label className="cl-field-label" htmlFor="currency-select">
                Add a target
              </label>
              <div className="cl-field-row">
                <select
                  disabled={isSaving || draft.favorites.length >= MAX_FAVORITE_CURRENCIES}
                  id="currency-select"
                  onChange={(event) => setSelectedCurrency(event.target.value)}
                  value={selectedCurrency}
                >
                  <option value="">Choose currency…</option>
                  {sortedCurrencies.map((currency) => (
                    <option
                      disabled={draft.favorites.includes(currency.code)}
                      key={currency.code}
                      value={currency.code}
                    >
                      {currency.code} · {currency.countries.join(", ")}
                    </option>
                  ))}
                </select>
                <button
                  className="cl-button cl-button--secondary"
                  disabled={isSaving || selectedCurrency.length === 0}
                  onClick={handleAddFavorite}
                  type="button"
                >
                  Add
                </button>
              </div>
            </div>
          </section>

          <section className="cl-panel" aria-labelledby="reading-heading">
            <div className="cl-section-heading">
              <div>
                <p className="cl-eyebrow">Reading rules</p>
                <h2 id="reading-heading">Ambiguous symbols</h2>
              </div>
            </div>
            <p className="cl-section-copy">
              Locale detection is automatic. Override the symbols you encounter most.
            </p>
            <div className="cl-symbol-grid">
              {AMBIGUOUS_SYMBOLS.map((symbol) => (
                <SymbolOverride
                  disabled={isSaving}
                  key={symbol}
                  onChange={handleSymbolOverride}
                  symbol={symbol}
                  value={draft.symbolOverrides[symbol] ?? ""}
                />
              ))}
            </div>
          </section>

          <section className="cl-panel" aria-labelledby="display-heading">
            <div className="cl-section-heading">
              <div>
                <p className="cl-eyebrow">Interface</p>
                <h2 id="display-heading">Display</h2>
              </div>
            </div>
            <label className="cl-select-field">
              <span>Theme</span>
              <select
                disabled={isSaving}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "light" || value === "dark" || value === "system") {
                    updateDraft((current) => ({ ...current, theme: value }));
                  }
                }}
                value={draft.theme}
              >
                <option value="system">Follow system</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <div className="cl-toggle-list">
              <Toggle
                checked={draft.showCurrencyIcon}
                disabled={isSaving}
                label="Show currency symbols"
                onChange={(checked) =>
                  updateDraft((current) => ({
                    ...current,
                    showCurrencyIcon: checked,
                  }))
                }
              />
              <Toggle
                checked={draft.showCurrencyCode}
                disabled={isSaving}
                label="Show ISO currency codes"
                onChange={(checked) =>
                  updateDraft((current) => ({
                    ...current,
                    showCurrencyCode: checked,
                  }))
                }
              />
            </div>
          </section>

          <footer className="cl-popup__footer">
            <p>Select a price on any page, then open the lens beside your selection.</p>
            <button
              className="cl-button cl-button--primary"
              disabled={!dirty || saveState === "saving"}
              onClick={() => void handleSave()}
              type="button"
            >
              {getSaveButtonLabel(saveState, dirty)}
            </button>
          </footer>
        </>
      )}
    </main>
  );
}

interface FavoriteListProps {
  readonly disabled: boolean;
  readonly favorites: readonly CurrencyCode[];
  readonly onMove: (index: number, direction: -1 | 1) => void;
  readonly onRemove: (currencyCode: CurrencyCode) => void;
}

function FavoriteList({ disabled, favorites, onMove, onRemove }: FavoriteListProps) {
  if (favorites.length === 0) {
    return <p className="cl-empty-state">Add a currency to activate conversions.</p>;
  }
  return (
    <ol className="cl-favorite-list">
      {favorites.map((currencyCode, index) => (
        <li className="cl-favorite-item" key={currencyCode}>
          <span aria-hidden="true" className="cl-favorite-item__index">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="cl-currency-mark">{getCurrencyMark(currencyCode)}</span>
          <span className="cl-favorite-item__identity">
            <strong>{currencyCode}</strong>
            <small>{formatRegions(currencyCode)}</small>
          </span>
          <span className="cl-favorite-item__actions">
            <button
              aria-label={`Move ${currencyCode} up`}
              className="cl-mini-button"
              disabled={disabled || index === 0}
              onClick={() => onMove(index, -1)}
              type="button"
            >
              <ArrowIcon direction="up" />
            </button>
            <button
              aria-label={`Move ${currencyCode} down`}
              className="cl-mini-button"
              disabled={disabled || index === favorites.length - 1}
              onClick={() => onMove(index, 1)}
              type="button"
            >
              <ArrowIcon direction="down" />
            </button>
            <button
              aria-label={`Remove ${currencyCode}`}
              className="cl-mini-button cl-mini-button--danger"
              disabled={disabled}
              onClick={() => onRemove(currencyCode)}
              type="button"
            >
              <TrashIcon />
            </button>
          </span>
        </li>
      ))}
    </ol>
  );
}

interface RatePulseProps {
  readonly error: string | null;
  readonly loading: boolean;
  readonly onRetry: () => void;
  readonly rates: RatesData | null;
  readonly targets: readonly CurrencyCode[];
}

function RatePulse({ error, loading, onRetry, rates, targets }: RatePulseProps) {
  return (
    <section className="cl-rate-pulse" aria-labelledby="rate-pulse-heading">
      <div className="cl-rate-pulse__heading">
        <div>
          <p className="cl-eyebrow">Rate pulse</p>
          <h2 id="rate-pulse-heading">
            {rates !== null ? `1 ${rates.base}` : "Latest reference rates"}
          </h2>
        </div>
        {rates !== null ? <time>{formatTimestamp(rates.sourceTimestamp)}</time> : null}
      </div>
      {loading ? <span className="cl-rate-pulse__loading">Focusing rates…</span> : null}
      {!loading && error !== null ? (
        <div className="cl-inline-error" role="alert">
          <span>{error}</span>
          <button onClick={onRetry} type="button">
            Retry
          </button>
        </div>
      ) : null}
      {!loading && error === null && rates !== null ? (
        <div className="cl-rate-strip">
          {targets.length === 0 ? (
            <span className="cl-rate-strip__empty">Add targets to see the pulse.</span>
          ) : (
            targets.map((currencyCode) => (
              <div className="cl-rate-tile" key={currencyCode}>
                <span>{currencyCode}</span>
                <strong>{formatRate(rates.rates[currencyCode])}</strong>
              </div>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}

function SymbolOverride({
  disabled,
  onChange,
  symbol,
  value,
}: {
  readonly disabled: boolean;
  readonly onChange: (symbol: string, value: string) => void;
  readonly symbol: string;
  readonly value: string;
}) {
  const definition = getCurrencySymbolDefinition(symbol);
  return (
    <label className="cl-symbol-field">
      <span className="cl-symbol-field__mark">{symbol}</span>
      <select
        aria-label={`Currency represented by ${symbol}`}
        disabled={disabled}
        onChange={(event) => onChange(symbol, event.target.value)}
        value={value}
      >
        <option value="">Automatic</option>
        {definition?.currencyCodes.map((currencyCode) => (
          <option key={currencyCode} value={currencyCode}>
            {currencyCode}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly label: string;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label className="cl-toggle">
      <span>{label}</span>
      <input
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span aria-hidden="true" className="cl-toggle__track">
        <span />
      </span>
    </label>
  );
}

function RateStatus({
  loading,
  rates,
}: {
  readonly loading: boolean;
  readonly rates: RatesData | null;
}) {
  let label = "Offline";
  if (loading) {
    label = "Syncing";
  } else if (rates?.isStale === true) {
    label = "Last known";
  } else if (rates !== null) {
    label = "Rates ready";
  }
  return (
    <span className={`cl-status ${rates?.isStale === true ? "cl-status--stale" : ""}`}>
      <span className="cl-live-dot" />
      {label}
    </span>
  );
}

function PopupSkeleton() {
  return (
    <div aria-label="Loading Currency Lens" className="cl-popup-skeleton" role="status">
      <span />
      <span />
      <span />
    </div>
  );
}

function moveItem(
  items: readonly CurrencyCode[],
  fromIndex: number,
  toIndex: number,
): CurrencyCode[] {
  if (toIndex < 0 || toIndex >= items.length) {
    return [...items];
  }
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  if (item === undefined) {
    return nextItems;
  }
  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

function formatRate(value: string | undefined): string {
  if (value === undefined || value.length === 0) {
    return "—";
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "—";
  }
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: numericValue < 0.01 ? 6 : numericValue < 1 ? 4 : 2,
  }).format(numericValue);
}

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(timestamp);
}

function formatRegions(currencyCode: CurrencyCode): string {
  return getCurrencyMetadata(currencyCode)?.countries.slice(0, 3).join(" · ") ?? "Global";
}

function getCurrencyMark(currencyCode: CurrencyCode): string {
  try {
    return (
      new Intl.NumberFormat(undefined, {
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

function getSaveButtonLabel(
  saveState: "idle" | "saving" | "saved",
  dirty: boolean,
): string {
  if (saveState === "saving") {
    return "Saving…";
  }
  if (saveState === "saved" && !dirty) {
    return "Saved";
  }
  return dirty ? "Save changes" : "Up to date";
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function ArrowIcon({ direction }: { readonly direction: "up" | "down" }) {
  const path = direction === "up" ? "m5 12 5-5 5 5" : "m5 8 5 5 5-5";
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d={path} />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M6.5 6.5v8m3.5-8v8m3.5-8v8M5 4.5h10M8 4.5V3h4v1.5M6 4.5l.6 12h6.8l.6-12" />
    </svg>
  );
}

export default App;
