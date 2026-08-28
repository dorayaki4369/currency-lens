import type { CurrencyCode } from "@cl/currency";
import { currencies } from "@cl/currency";
import {
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getAmbiguousCurrencySymbolGroups,
  getCurrencyMetadata,
  isKnownCurrencyCode,
  MAX_FAVORITE_CURRENCIES,
  type Config,
} from "../../lib/currency";
import {
  getCurrencyDisplayName,
  getRegionDisplayNames,
  getUiLocale,
  translate,
  type UiLocale,
} from "../../lib/i18n";
import { messageTypes, sendMessage, type GetRatesResponse } from "../../lib/messages";
import { ChevronRight, GripVertical, SlidersHorizontal, Trash2 } from "../shared/Icons";
import { useConfigSettings } from "../shared/useConfigSettings";

type RatesData = Extract<GetRatesResponse, { success: true }>["data"];

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
  readonly locale?: UiLocale | undefined;
  readonly rates: RatesData;
}

interface AppProps {
  readonly preview?: PopupPreviewData;
}

type DropPlacement = "after" | "before";

interface DropTarget {
  readonly currencyCode: CurrencyCode;
  readonly placement: DropPlacement;
}

/** Renders a compact control panel whose validated settings save immediately. */
function App({ preview }: AppProps) {
  const locale = preview?.locale ?? getUiLocale();
  const { config, error, loading, saveState, updateConfig } = useConfigSettings({
    previewConfig: preview?.config,
  });
  const [rates, setRates] = useState<RatesData | null>(preview?.rates ?? null);
  const [ratesLoading, setRatesLoading] = useState(preview === undefined);
  const [selectedCurrency, setSelectedCurrency] = useState("");

  const loadRates = useCallback(async () => {
    if (preview !== undefined) {
      setRates(preview.rates);
      return;
    }
    setRatesLoading(true);
    try {
      const response = await sendMessage({ type: messageTypes.GET_RATES });
      setRates(response.success ? response.data : null);
    } catch {
      setRates(null);
    } finally {
      setRatesLoading(false);
    }
  }, [preview]);

  useEffect(() => {
    void loadRates();
  }, [loadRates]);

  const sortedCurrencies = useMemo(() => {
    const priority = new Map(PRIORITY_CURRENCIES.map((code, index) => [code, index]));
    return currencies.toSorted((left, right) => {
      const leftPriority = priority.get(left.code) ?? Number.POSITIVE_INFINITY;
      const rightPriority = priority.get(right.code) ?? Number.POSITIVE_INFINITY;
      return leftPriority - rightPriority || left.code.localeCompare(right.code);
    });
  }, []);
  const favorites = config?.favorites ?? [];

  const handleAddFavorite = () => {
    if (
      !isKnownCurrencyCode(selectedCurrency) ||
      favorites.includes(selectedCurrency) ||
      favorites.length >= MAX_FAVORITE_CURRENCIES
    ) {
      return;
    }
    updateConfig((current) => ({
      ...current,
      favorites: [...current.favorites, selectedCurrency],
    }));
    setSelectedCurrency("");
  };

  const handleRemoveFavorite = (currencyCode: CurrencyCode) => {
    updateConfig((current) => ({
      ...current,
      favorites: current.favorites.filter((favorite) => favorite !== currencyCode),
    }));
  };

  const handleReorderFavorite = (
    sourceCurrency: CurrencyCode,
    targetCurrency: CurrencyCode,
    placement: DropPlacement,
  ) => {
    updateConfig((current) => ({
      ...current,
      favorites: moveItemRelative(
        current.favorites,
        sourceCurrency,
        targetCurrency,
        placement,
      ),
    }));
  };

  const handleOpenSymbolSettings = async () => {
    if (preview !== undefined) {
      return;
    }
    await browser.runtime.openOptionsPage();
    window.close();
  };

  const theme = config?.theme ?? "system";
  return (
    <main aria-busy={loading} className={`cl-popup cl-root cl-theme-${theme}`}>
      <header className="cl-popup__hero">
        <Brand locale={locale} />
        <RateStatus loading={ratesLoading} locale={locale} rates={rates} />
      </header>

      {error !== null ? (
        <div className="cl-notice cl-notice--error" role="alert">
          {translate(locale, "autoSaveError")}
        </div>
      ) : null}

      {loading ? <PopupSkeleton locale={locale} /> : null}
      {!loading && config === null ? (
        <p className="cl-empty-state">{translate(locale, "autoSaveError")}</p>
      ) : null}
      {!loading && config !== null ? (
        <>
          <section className="cl-panel" aria-labelledby="targets-heading">
            <div className="cl-section-heading">
              <h2 id="targets-heading">{translate(locale, "targetsHeading")}</h2>
              <span className="cl-count-badge">
                {translate(locale, "targetCount", {
                  current: config.favorites.length,
                  maximum: MAX_FAVORITE_CURRENCIES,
                })}
              </span>
            </div>
            <p className="cl-section-copy">{translate(locale, "targetDescription")}</p>

            <FavoriteList
              favorites={config.favorites}
              locale={locale}
              onReorder={handleReorderFavorite}
              onRemove={handleRemoveFavorite}
            />

            <div className="cl-add-currency">
              <label className="cl-field-label" htmlFor="currency-select">
                {translate(locale, "addTarget")}
              </label>
              <div className="cl-field-row">
                <select
                  disabled={config.favorites.length >= MAX_FAVORITE_CURRENCIES}
                  id="currency-select"
                  onChange={(event) => setSelectedCurrency(event.target.value)}
                  value={selectedCurrency}
                >
                  <option value="">{translate(locale, "targetChoose")}</option>
                  {sortedCurrencies.map((currency) => (
                    <option
                      disabled={config.favorites.includes(currency.code)}
                      key={currency.code}
                      value={currency.code}
                    >
                      {currency.code} · {getCurrencyDisplayName(currency.code, locale)}
                    </option>
                  ))}
                </select>
                <button
                  className="cl-button cl-button--secondary"
                  disabled={selectedCurrency.length === 0}
                  onClick={handleAddFavorite}
                  type="button"
                >
                  {translate(locale, "add")}
                </button>
              </div>
            </div>
          </section>

          <section className="cl-panel cl-panel--compact" aria-labelledby="symbols-heading">
            <div className="cl-section-heading">
              <div>
                <h2 id="symbols-heading">
                  {translate(locale, "conversionSettingsHeading")}
                </h2>
                <p className="cl-section-copy cl-section-copy--flush">
                  {translate(locale, "ambiguousSummary", {
                    count: getAmbiguousCurrencySymbolGroups().length,
                  })}
                </p>
              </div>
              <SlidersHorizontal aria-hidden="true" className="cl-section-icon" />
            </div>
            <button
              className="cl-navigation-button"
              onClick={() => void handleOpenSymbolSettings()}
              type="button"
            >
              <span>{translate(locale, "conversionSettingsOpen")}</span>
              <ChevronRight aria-hidden="true" />
            </button>
          </section>

          <section className="cl-panel" aria-labelledby="display-heading">
            <div className="cl-section-heading">
              <h2 id="display-heading">{translate(locale, "displayHeading")}</h2>
            </div>
            <p className="cl-section-copy">{translate(locale, "displayDescription")}</p>
            <label className="cl-select-field">
              <span>{translate(locale, "displayTheme")}</span>
              <select
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "light" || value === "dark" || value === "system") {
                    updateConfig((current) => ({ ...current, theme: value }));
                  }
                }}
                value={config.theme}
              >
                <option value="system">{translate(locale, "displayThemeSystem")}</option>
                <option value="light">{translate(locale, "displayThemeLight")}</option>
                <option value="dark">{translate(locale, "displayThemeDark")}</option>
              </select>
            </label>
            <div className="cl-toggle-list">
              <Toggle
                checked={config.showCurrencyIcon}
                label={translate(locale, "displayToggleIcon")}
                onChange={(checked) =>
                  updateConfig((current) => ({ ...current, showCurrencyIcon: checked }))
                }
              />
              <Toggle
                checked={config.showCurrencyCode}
                label={translate(locale, "displayToggleCode")}
                onChange={(checked) =>
                  updateConfig((current) => ({ ...current, showCurrencyCode: checked }))
                }
              />
            </div>
          </section>

          <footer className="cl-popup__footer">
            <p>{translate(locale, "popupDescription")}</p>
            <AutoSaveStatus locale={locale} saveState={saveState} />
          </footer>
        </>
      ) : null}
    </main>
  );
}

function Brand({ locale }: { readonly locale: UiLocale }) {
  return (
    <div className="cl-brand-lockup">
      <span aria-hidden="true" className="cl-aperture">
        <span className="cl-aperture__core" />
      </span>
      <div>
        <p className="cl-eyebrow">{translate(locale, "popupEyebrow")}</p>
        <h1>{translate(locale, "appName")}</h1>
      </div>
    </div>
  );
}

interface FavoriteListProps {
  readonly favorites: readonly CurrencyCode[];
  readonly locale: UiLocale;
  readonly onReorder: (
    sourceCurrency: CurrencyCode,
    targetCurrency: CurrencyCode,
    placement: DropPlacement,
  ) => void;
  readonly onRemove: (currencyCode: CurrencyCode) => void;
}

/** Renders ordered targets with consistent library icons and localized metadata. */
function FavoriteList({ favorites, locale, onReorder, onRemove }: FavoriteListProps) {
  const draggedCurrency = useRef<CurrencyCode | null>(null);
  const [draggingCurrency, setDraggingCurrency] = useState<CurrencyCode | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [reorderAnnouncement, setReorderAnnouncement] = useState("");

  if (favorites.length === 0) {
    return <p className="cl-empty-state">{translate(locale, "targetEmpty")}</p>;
  }

  /** Clears transient drag feedback without changing the saved order. */
  const finishDragging = () => {
    draggedCurrency.current = null;
    setDraggingCurrency(null);
    setDropTarget(null);
  };

  /** Records the dragged code locally; Firefox requires some transfer data to start dragging. */
  const handleDragStart = (
    event: ReactDragEvent<HTMLButtonElement>,
    currencyCode: CurrencyCode,
  ) => {
    draggedCurrency.current = currencyCode;
    setDraggingCurrency(currencyCode);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", currencyCode);
  };

  /** Shows whether dropping will insert before or after the hovered row. */
  const handleDragOver = (
    event: ReactDragEvent<HTMLLIElement>,
    currencyCode: CurrencyCode,
  ) => {
    const sourceCurrency = draggedCurrency.current;
    if (sourceCurrency === null || sourceCurrency === currencyCode) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTarget({
      currencyCode,
      placement: getDropPlacement(event),
    });
  };

  /** Commits one immediate settings update after the pointer is dropped. */
  const handleDrop = (
    event: ReactDragEvent<HTMLLIElement>,
    targetCurrency: CurrencyCode,
  ) => {
    event.preventDefault();
    const sourceCurrency = draggedCurrency.current;
    if (sourceCurrency === null || sourceCurrency === targetCurrency) {
      finishDragging();
      return;
    }
    const placement = getDropPlacement(event);
    const nextFavorites = moveItemRelative(
      favorites,
      sourceCurrency,
      targetCurrency,
      placement,
    );
    if (!haveSameOrder(favorites, nextFavorites)) {
      onReorder(sourceCurrency, targetCurrency, placement);
      setReorderAnnouncement(
        translate(locale, "reorderMoved", {
          currency: sourceCurrency,
          position: nextFavorites.indexOf(sourceCurrency) + 1,
          total: nextFavorites.length,
        }),
      );
    }
    finishDragging();
  };

  /** Provides an equivalent precise reorder path for keyboard users. */
  const handleReorderKey = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currencyCode: CurrencyCode,
    index: number,
  ) => {
    let direction: -1 | 1;
    if (event.key === "ArrowUp") {
      direction = -1;
    } else if (event.key === "ArrowDown") {
      direction = 1;
    } else {
      return;
    }
    event.preventDefault();
    const targetCurrency = favorites[index + direction];
    if (targetCurrency === undefined) {
      return;
    }
    onReorder(currencyCode, targetCurrency, direction === -1 ? "before" : "after");
    setReorderAnnouncement(
      translate(locale, "reorderMoved", {
        currency: currencyCode,
        position: index + direction + 1,
        total: favorites.length,
      }),
    );
  };

  const instructionsId = "conversion-target-reorder-instructions";
  return (
    <>
      <span className="cl-visually-hidden" id={instructionsId}>
        {translate(locale, "reorderInstructions")}
      </span>
      <ol className="cl-favorite-list">
        {favorites.map((currencyCode, index) => {
          const metadata = getCurrencyMetadata(currencyCode);
          return (
            <li
              className="cl-favorite-item"
              data-dragging={draggingCurrency === currencyCode ? "true" : undefined}
              data-drop-placement={
                dropTarget?.currencyCode === currencyCode ? dropTarget.placement : undefined
              }
              key={currencyCode}
              onDragOver={(event) => handleDragOver(event, currencyCode)}
              onDrop={(event) => handleDrop(event, currencyCode)}
            >
              <button
                aria-describedby={instructionsId}
                aria-label={translate(locale, "reorderCurrency", {
                  currency: currencyCode,
                  position: index + 1,
                  total: favorites.length,
                })}
                className="cl-drag-handle"
                draggable="true"
                onDragEnd={finishDragging}
                onDragStart={(event) => handleDragStart(event, currencyCode)}
                onKeyDown={(event) => handleReorderKey(event, currencyCode, index)}
                type="button"
              >
                <GripVertical aria-hidden="true" />
              </button>
              <span className="cl-currency-mark">
                {getCurrencyMark(currencyCode, locale)}
              </span>
              <span className="cl-favorite-item__identity">
                <strong>{currencyCode}</strong>
                <small>
                  {getCurrencyDisplayName(currencyCode, locale)}
                  {metadata.countries.length === 0
                    ? ""
                    : ` · ${getRegionDisplayNames(metadata.countries, locale)}`}
                </small>
              </span>
              <button
                aria-label={translate(locale, "removeCurrency", { currency: currencyCode })}
                className="cl-mini-button cl-mini-button--danger"
                onClick={() => onRemove(currencyCode)}
                type="button"
              >
                <Trash2 aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>
      <span aria-atomic="true" aria-live="polite" className="cl-visually-hidden">
        {reorderAnnouncement}
      </span>
    </>
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  readonly checked: boolean;
  readonly label: string;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label className="cl-toggle">
      <span>{label}</span>
      <input
        checked={checked}
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
  locale,
  rates,
}: {
  readonly loading: boolean;
  readonly locale: UiLocale;
  readonly rates: RatesData | null;
}) {
  let label = translate(locale, "rateOffline");
  if (loading) {
    label = translate(locale, "rateSyncing");
  } else if (rates?.isStale === true) {
    label = translate(locale, "rateLastKnown");
  } else if (rates !== null) {
    label = translate(locale, "rateReady");
  }
  return (
    <span className={`cl-status ${rates?.isStale === true ? "cl-status--stale" : ""}`}>
      <span className="cl-live-dot" />
      {label}
    </span>
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
    <span aria-live="polite" className="cl-auto-save-status">
      <span className="cl-live-dot" />
      {translate(locale, saveState === "saving" ? "saveSaving" : "saveSaved")}
    </span>
  );
}

function PopupSkeleton({ locale }: { readonly locale: UiLocale }) {
  return (
    <div
      aria-label={translate(locale, "loadingApp")}
      className="cl-popup-skeleton"
      role="status"
    >
      <span />
      <span />
      <span />
    </div>
  );
}

/** Inserts one target before or after another while preserving an immutable list. */
function moveItemRelative(
  items: readonly CurrencyCode[],
  sourceCurrency: CurrencyCode,
  targetCurrency: CurrencyCode,
  placement: DropPlacement,
): CurrencyCode[] {
  const nextItems = items.filter((item) => item !== sourceCurrency);
  const targetIndex = nextItems.indexOf(targetCurrency);
  nextItems.splice(targetIndex + (placement === "after" ? 1 : 0), 0, sourceCurrency);
  return nextItems;
}

/** Calculates the insertion edge from the pointer's vertical position within a row. */
function getDropPlacement(event: ReactDragEvent<HTMLLIElement>): DropPlacement {
  const bounds = event.currentTarget.getBoundingClientRect();
  return event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
}

/** Compares two currency orders without treating a copied array as a change. */
function haveSameOrder(
  left: readonly CurrencyCode[],
  right: readonly CurrencyCode[],
): boolean {
  return left.every((item, index) => item === right[index]);
}

/** Produces a locale-aware currency glyph without external country flags. */
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
