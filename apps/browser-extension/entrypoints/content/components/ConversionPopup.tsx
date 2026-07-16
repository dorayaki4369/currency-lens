import type { CurrencyCode } from "@cl/currency";
import { useCallback, useEffect, useId, useRef, type CSSProperties } from "react";
import type { DetectedCurrency } from "../../../lib/currency-detection";
import type { ConversionResult } from "../../../lib/rates";

export interface ConversionPopupData {
  readonly base: CurrencyCode;
  readonly fetchedAt: number;
  readonly isStale: boolean;
  readonly results: readonly ConversionResult[];
  readonly sourceTimestamp: number;
}

interface ConversionPopupProps {
  readonly data: ConversionPopupData | null;
  readonly detections: readonly DetectedCurrency[];
  readonly error: string | null;
  readonly floatingStyles: CSSProperties;
  readonly loading: boolean;
  readonly onClose: () => void;
  readonly setFloating: (element: HTMLElement | null) => void;
  readonly showCurrencyCode: boolean;
  readonly showCurrencyIcon: boolean;
  readonly visible: boolean;
}

/** Displays all source-by-target conversions in an isolated, accessible lens card. */
export function ConversionPopup({
  data,
  detections,
  error,
  floatingStyles,
  loading,
  onClose,
  setFloating,
  showCurrencyCode,
  showCurrencyIcon,
  visible,
}: ConversionPopupProps) {
  const titleId = useId();
  const popupReference = useRef<HTMLDivElement>(null);
  const setReferences = useCallback(
    (element: HTMLDivElement | null) => {
      popupReference.current = element;
      setFloating(element);
    },
    [setFloating],
  );

  useDismissableLayer(visible, popupReference, onClose);

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
            <p className="cl-eyebrow">Selection found</p>
            <h2 className="cl-conversion-card__title" id={titleId}>
              Currency Lens
            </h2>
          </div>
        </div>
        <button
          aria-label="Close Currency Lens"
          className="cl-icon-button"
          onClick={onClose}
          type="button"
        >
          <CloseIcon />
        </button>
      </header>

      <div className="cl-conversion-card__body">
        {loading ? <ConversionSkeleton /> : null}
        {!loading && error !== null ? <ErrorState message={error} /> : null}
        {!loading && error === null && data !== null ? (
          <ConversionGroups
            data={data}
            detections={detections}
            showCurrencyCode={showCurrencyCode}
            showCurrencyIcon={showCurrencyIcon}
          />
        ) : null}
        {!loading && error === null && data === null ? (
          <p className="cl-empty-state">No supported monetary amount was found.</p>
        ) : null}
      </div>
    </section>
  );
}

interface ConversionGroupsProps {
  readonly data: ConversionPopupData;
  readonly detections: readonly DetectedCurrency[];
  readonly showCurrencyCode: boolean;
  readonly showCurrencyIcon: boolean;
}

/** Groups the flattened batch response back under each selected source amount. */
function ConversionGroups({
  data,
  detections,
  showCurrencyCode,
  showCurrencyIcon,
}: ConversionGroupsProps) {
  return (
    <>
      {data.isStale ? (
        <div className="cl-notice cl-notice--warning" role="status">
          <ClockIcon />
          Using the last available rates. They are more than 24 hours old.
        </div>
      ) : null}

      <div className="cl-conversion-groups">
        {detections.map((detection, sourceIndex) => {
          const results = data.results.filter(
            (result) => result.sourceIndex === sourceIndex,
          );
          const collidingCurrencyMarks = getCollidingCurrencyMarks(results);
          return (
            <article className="cl-conversion-group" key={detection.index}>
              <header className="cl-conversion-group__source">
                <span className="cl-source-text">{detection.originalText}</span>
                <span className="cl-code-pill">{detection.currencyCode}</span>
              </header>
              <div className="cl-result-list">
                {results.map((result) => (
                  <ConversionRow
                    key={`${result.sourceIndex}-${result.toCurrency}`}
                    result={result}
                    showCurrencyCode={showCurrencyCode}
                    showCurrencyCodeForCollision={collidingCurrencyMarks.has(
                      getCurrencyMark(result.toCurrency),
                    )}
                    showCurrencyIcon={showCurrencyIcon}
                  />
                ))}
              </div>
            </article>
          );
        })}
      </div>

      <footer className="cl-conversion-card__footer">
        <span className="cl-live-dot" />
        Rates from {formatTimestamp(data.sourceTimestamp)}
      </footer>
    </>
  );
}

interface ConversionRowProps {
  readonly result: ConversionResult;
  readonly showCurrencyCode: boolean;
  readonly showCurrencyCodeForCollision: boolean;
  readonly showCurrencyIcon: boolean;
}

/** Renders a successful target value or an explicit unavailable pair. */
function ConversionRow({
  result,
  showCurrencyCode,
  showCurrencyCodeForCollision,
  showCurrencyIcon,
}: ConversionRowProps) {
  const mark = getCurrencyMark(result.toCurrency);
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
          {formatDecimal(result.convertedAmount, result.fractionDigits)}
        </strong>
      ) : (
        <span className="cl-result-row__unavailable">Rate unavailable</span>
      )}
    </div>
  );
}

/** Finds narrow symbols that identify more than one target in the same result list. */
function getCollidingCurrencyMarks(
  results: readonly ConversionResult[],
): ReadonlySet<string> {
  const currenciesByMark = new Map<string, Set<CurrencyCode>>();
  for (const result of results) {
    const mark = getCurrencyMark(result.toCurrency);
    const currencies = currenciesByMark.get(mark) ?? new Set<CurrencyCode>();
    currencies.add(result.toCurrency);
    currenciesByMark.set(mark, currencies);
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
  onClose: () => void,
): void {
  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      const popup = popupReference.current;
      if (popup && !event.composedPath().includes(popup)) {
        onClose();
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
function getCurrencyMark(currencyCode: CurrencyCode): string {
  try {
    const currencyPart = new Intl.NumberFormat(undefined, {
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
function formatDecimal(value: string, fractionDigits: number): string {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return value;
  }
  const decimalPointIndex = value.indexOf(".");
  const significantFractionDigits =
    decimalPointIndex === -1 ? 0 : value.length - decimalPointIndex - 1;
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: Math.min(significantFractionDigits, fractionDigits),
  }).format(numericValue);
}

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function ConversionSkeleton() {
  return (
    <div aria-label="Converting currencies" className="cl-skeleton" role="status">
      <span className="cl-skeleton__line cl-skeleton__line--short" />
      <span className="cl-skeleton__line" />
      <span className="cl-skeleton__line" />
    </div>
  );
}

function ErrorState({ message }: { readonly message: string }) {
  return (
    <div className="cl-error-state" role="alert">
      <span aria-hidden="true" className="cl-error-state__mark">
        !
      </span>
      <div>
        <strong>Couldn’t focus the rates</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="m5.5 5.5 9 9m0-9-9 9" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l2.8 1.8" />
    </svg>
  );
}
