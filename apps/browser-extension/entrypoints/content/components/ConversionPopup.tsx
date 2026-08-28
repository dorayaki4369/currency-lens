import type { CurrencyCode } from "@cl/currency";
import { useCallback, useEffect, useId, useRef, type CSSProperties } from "react";
import { Clock3, X } from "../../shared/Icons";
import type { DetectedCurrency } from "../../../lib/currency-detection";
import { translate, type UiLocale } from "../../../lib/i18n";
import type { ConversionResult } from "../../../lib/rates";

export interface ConversionPopupData {
  readonly base: CurrencyCode;
  readonly fetchedAt: number;
  readonly isStale: boolean;
  readonly results: readonly ConversionResult[];
  readonly sourceTimestamp: number;
}

export type ConversionDismissReason = "close-button" | "escape" | "outside-pointer";

interface ConversionPopupProps {
  readonly data: ConversionPopupData | null;
  readonly detection: DetectedCurrency | null;
  readonly error: string | null;
  readonly floatingStyles: CSSProperties;
  readonly loading: boolean;
  readonly locale: UiLocale;
  readonly onClose: (reason: ConversionDismissReason) => void;
  readonly setFloating: (element: HTMLElement | null) => void;
  readonly showCurrencyCode: boolean;
  readonly showCurrencyIcon: boolean;
  readonly visible: boolean;
}

/** Displays one selected monetary amount against the configured conversion targets. */
export function ConversionPopup({
  data,
  detection,
  error,
  floatingStyles,
  loading,
  locale,
  onClose,
  setFloating,
  showCurrencyCode,
  showCurrencyIcon,
  visible,
}: ConversionPopupProps) {
  const titleId = useId();
  const popupReference = useRef<HTMLDivElement>(null);
  const closeButtonReference = useRef<HTMLButtonElement>(null);
  const setReferences = useCallback(
    (element: HTMLDivElement | null) => {
      popupReference.current = element;
      setFloating(element);
    },
    [setFloating],
  );

  useDismissableLayer(visible, popupReference, onClose);

  useEffect(() => {
    if (visible) {
      closeButtonReference.current?.focus();
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <section
      aria-labelledby={titleId}
      aria-live="polite"
      className="cl-conversion-card"
      ref={setReferences}
      role="dialog"
      style={floatingStyles}
    >
      <header className="cl-conversion-card__header">
        <div className="cl-brand-lockup cl-brand-lockup--compact">
          <span aria-hidden="true" className="cl-aperture cl-aperture--tiny">
            <span className="cl-aperture__core" />
          </span>
          <div>
            <p className="cl-eyebrow">{translate(locale, "selectionFound")}</p>
            <h2 className="cl-conversion-card__title" id={titleId}>
              {translate(locale, "appName")}
            </h2>
          </div>
        </div>
        <button
          aria-label={translate(locale, "closeApp")}
          className="cl-icon-button"
          onClick={() => onClose("close-button")}
          ref={closeButtonReference}
          type="button"
        >
          <X aria-hidden="true" />
        </button>
      </header>

      <div className="cl-conversion-card__body">
        <ConversionCardBody
          data={data}
          detection={detection}
          error={error}
          loading={loading}
          locale={locale}
          showCurrencyCode={showCurrencyCode}
          showCurrencyIcon={showCurrencyIcon}
        />
      </div>
    </section>
  );
}

type ConversionCardBodyProps = Pick<
  ConversionPopupProps,
  | "data"
  | "detection"
  | "error"
  | "loading"
  | "locale"
  | "showCurrencyCode"
  | "showCurrencyIcon"
>;

/** Selects exactly one mutually exclusive body state for the conversion card. */
function ConversionCardBody({
  data,
  detection,
  error,
  loading,
  locale,
  showCurrencyCode,
  showCurrencyIcon,
}: ConversionCardBodyProps) {
  if (loading) {
    return <ConversionSkeleton locale={locale} />;
  }
  if (error !== null) {
    return <ErrorState error={error} locale={locale} />;
  }
  if (data === null || detection === null) {
    return <p className="cl-empty-state">{translate(locale, "conversionEmpty")}</p>;
  }
  return (
    <ConversionDetails
      data={data}
      detection={detection}
      locale={locale}
      showCurrencyCode={showCurrencyCode}
      showCurrencyIcon={showCurrencyIcon}
    />
  );
}

interface ConversionDetailsProps {
  readonly data: ConversionPopupData;
  readonly detection: DetectedCurrency;
  readonly locale: UiLocale;
  readonly showCurrencyCode: boolean;
  readonly showCurrencyIcon: boolean;
}

/** Renders the single source amount and its ordered conversion-target results. */
function ConversionDetails({
  data,
  detection,
  locale,
  showCurrencyCode,
  showCurrencyIcon,
}: ConversionDetailsProps) {
  const results = data.results.filter((result) => result.sourceIndex === 0);
  const collidingCurrencyMarks = getCollidingCurrencyMarks(results, locale);

  return (
    <div className="cl-conversion-content">
      {data.isStale ? (
        <div className="cl-notice cl-notice--warning" role="status">
          <Clock3 aria-hidden="true" />
          {translate(locale, "ratesStale")}
        </div>
      ) : null}

      <article className="cl-conversion-group">
        <header className="cl-conversion-group__source">
          <span className="cl-source-text">{detection.originalText}</span>
          <span className="cl-code-pill">{detection.currencyCode}</span>
        </header>
        <div className="cl-result-list">
          {results.map((result) => (
            <ConversionRow
              key={result.toCurrency}
              locale={locale}
              result={result}
              showCurrencyCode={showCurrencyCode}
              showCurrencyCodeForCollision={collidingCurrencyMarks.has(
                getCurrencyMark(result.toCurrency, locale),
              )}
              showCurrencyIcon={showCurrencyIcon}
            />
          ))}
        </div>
      </article>

      <footer className="cl-conversion-card__footer">
        <span className="cl-live-dot" />
        {translate(locale, "ratesFrom", {
          timestamp: formatTimestamp(data.sourceTimestamp, locale),
        })}
      </footer>
    </div>
  );
}

interface ConversionRowProps {
  readonly locale: UiLocale;
  readonly result: ConversionResult;
  readonly showCurrencyCode: boolean;
  readonly showCurrencyCodeForCollision: boolean;
  readonly showCurrencyIcon: boolean;
}

/** Renders a successful target value or a localized unavailable result. */
function ConversionRow({
  locale,
  result,
  showCurrencyCode,
  showCurrencyCodeForCollision,
  showCurrencyIcon,
}: ConversionRowProps) {
  const mark = getCurrencyMark(result.toCurrency, locale);
  const shouldShowCurrencyCode =
    showCurrencyCode || !showCurrencyIcon || showCurrencyCodeForCollision;

  return (
    <div className="cl-result-row">
      <div className="cl-result-row__currency">
        {showCurrencyIcon ? (
          <span aria-hidden="true" className="cl-currency-mark">
            {mark}
          </span>
        ) : null}
        {shouldShowCurrencyCode ? <span>{result.toCurrency}</span> : null}
      </div>
      {result.status === "converted" ? (
        <strong className="cl-result-row__value">
          {formatDecimal(result.convertedAmount, result.fractionDigits, locale)}
        </strong>
      ) : (
        <span className="cl-result-row__unavailable">
          {translate(locale, "conversionUnavailable")}
        </span>
      )}
    </div>
  );
}

/** Finds narrow symbols that identify more than one target in the same result list. */
function getCollidingCurrencyMarks(
  results: readonly ConversionResult[],
  locale: UiLocale,
): ReadonlySet<string> {
  const currenciesByMark = new Map<string, Set<CurrencyCode>>();
  for (const result of results) {
    const mark = getCurrencyMark(result.toCurrency, locale);
    const currencyCodes = currenciesByMark.get(mark) ?? new Set<CurrencyCode>();
    currencyCodes.add(result.toCurrency);
    currenciesByMark.set(mark, currencyCodes);
  }

  return new Set(
    [...currenciesByMark.entries()]
      .filter(([, currencyCodes]) => currencyCodes.size > 1)
      .map(([mark]) => mark),
  );
}

/** Wires Escape and outside-pointer dismissal across the open shadow boundary. */
function useDismissableLayer(
  visible: boolean,
  popupReference: React.RefObject<HTMLDivElement | null>,
  onClose: (reason: ConversionDismissReason) => void,
): void {
  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose("escape");
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      const popup = popupReference.current;
      if (popup !== null && !event.composedPath().includes(popup)) {
        onClose("outside-pointer");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [onClose, popupReference, visible]);
}

/** Produces a locale-aware currency glyph without requiring external icon assets. */
function getCurrencyMark(currencyCode: CurrencyCode, locale: UiLocale): string {
  try {
    const currencyPart = new Intl.NumberFormat(locale, {
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
      style: "currency",
    })
      .formatToParts(0)
      .find((part) => part.type === "currency");
    return currencyPart?.value ?? currencyCode.slice(0, 1);
  } catch {
    return currencyCode.slice(0, 1);
  }
}

/** Adds grouping while respecting the precision chosen by the conversion layer. */
function formatDecimal(value: string, fractionDigits: number, locale: UiLocale): string {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return value;
  }
  const decimalPointIndex = value.indexOf(".");
  const significantFractionDigits =
    decimalPointIndex === -1 ? 0 : value.length - decimalPointIndex - 1;
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: Math.min(significantFractionDigits, fractionDigits),
  }).format(numericValue);
}

/** Formats the rate timestamp in the same language as the surrounding card. */
function formatTimestamp(timestamp: number, locale: UiLocale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function ConversionSkeleton({ locale }: { readonly locale: UiLocale }) {
  return (
    <div
      aria-label={translate(locale, "loadingConversion")}
      className="cl-skeleton"
      role="status"
    >
      <span className="cl-skeleton__line cl-skeleton__line--short" />
      <span className="cl-skeleton__line" />
      <span className="cl-skeleton__line" />
    </div>
  );
}

function ErrorState({
  error,
  locale,
}: {
  readonly error: string;
  readonly locale: UiLocale;
}) {
  const isMissingTarget = error === "MISSING_CONVERSION_TARGET";
  return (
    <div className="cl-error-state" role="alert">
      <span aria-hidden="true" className="cl-error-state__mark">
        !
      </span>
      <div>
        <strong>
          {translate(
            locale,
            isMissingTarget ? "conversionMissingTarget" : "conversionError",
          )}
        </strong>
        {isMissingTarget ? null : <p>{translate(locale, "conversionRetry")}</p>}
      </div>
    </div>
  );
}
