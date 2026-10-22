import type { CurrencyCode } from "@cl/currency";
import { CircleAlert, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
  type ReactNode,
} from "react";
import type { DetectedCurrency } from "@/lib/currency-detection";
import type { CurrencyDropPlacement } from "@/lib/currency-order";
import { translate, type UiLocale } from "@/lib/i18n";
import type { ConversionResult } from "@/lib/rates";
import {
  ConversionEditor,
  parseConversionSourceAmount,
  type ConversionTargetEditing,
} from "@/components/conversion/ConversionEditor";
import { createConversionTargetAmounts } from "@/components/conversion/conversion-target-amounts";
import { RateTimestamp } from "@/components/conversion/RateTimestamp";
import { Stack } from "@/components/layout/Stack";
import { IconButton } from "@/components/ui/icon-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface ConversionPopupData {
  readonly base: CurrencyCode;
  readonly fetchedAt: number;
  readonly isStale: boolean;
  readonly results: readonly ConversionResult[];
  readonly sourceTimestamp: number;
}

export type ConversionDismissReason = "close-button" | "escape" | "outside-pointer";

export type ConversionSource = DetectedCurrency;

interface ConversionPopupProps {
  readonly data: ConversionPopupData | null;
  readonly detection: DetectedCurrency | null;
  readonly error: string | null;
  readonly floatingStyles: CSSProperties;
  readonly loading: boolean;
  readonly locale: UiLocale;
  readonly onClose: (reason: ConversionDismissReason) => void;
  readonly onReorderTarget?:
    | ((
        sourceCurrency: CurrencyCode,
        targetCurrency: CurrencyCode,
        placement: CurrencyDropPlacement,
      ) => void)
    | undefined;
  readonly onSourceChange?: ((source: ConversionSource | null) => void) | undefined;
  readonly settingsSaveFailed?: boolean | undefined;
  readonly setFloating: (element: HTMLElement | null) => void;
  readonly targetCurrencies?: readonly CurrencyCode[] | undefined;
  readonly targetEditing?: ConversionTargetEditing | undefined;
  readonly visible: boolean;
}

/** Displays one selected amount in a native top-layer dialog containing a shadcn card. */
export function ConversionPopup({
  data,
  detection,
  error,
  floatingStyles,
  loading,
  locale,
  onClose,
  onReorderTarget,
  onSourceChange,
  settingsSaveFailed = false,
  setFloating,
  targetCurrencies,
  targetEditing,
  visible,
}: ConversionPopupProps) {
  const titleId = useId();
  const popupReference = useRef<HTMLDialogElement>(null);
  const setReferences = useCallback(
    (element: HTMLDialogElement | null) => {
      popupReference.current = element;
      setFloating(element);
    },
    [setFloating],
  );

  useTopLayerDialog(visible, popupReference);
  useDismissableLayer(visible, popupReference, onClose);

  if (!visible) {
    return null;
  }

  return (
    <dialog
      aria-labelledby={titleId}
      className="inset-auto m-0 w-96 max-h-none max-w-[calc(100vw_-_--spacing(6))] overflow-visible border-0 bg-transparent p-0 text-inherit outline-none backdrop:bg-transparent"
      onCancel={(event) => {
        event.preventDefault();
        onClose("escape");
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose("escape");
        }
      }}
      popover="manual"
      ref={setReferences}
      style={floatingStyles}
      tabIndex={-1}
    >
      <Card className="relative w-full bg-background shadow-lg" spacing="compact">
        <h2 className="sr-only" id={titleId}>
          {translate(locale, "conversionResult")}
        </h2>
        <IconButton
          className="absolute top-2 right-2 z-10"
          label={translate(locale, "closeApp")}
          onClick={() => onClose("close-button")}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" />
        </IconButton>

        <CardContent className="pt-6">
          <ConversionCardBody
            data={data}
            detection={detection}
            error={error}
            loading={loading}
            locale={locale}
            onReorderTarget={onReorderTarget}
            onSourceChange={onSourceChange}
            settingsSaveFailed={settingsSaveFailed}
            targetCurrencies={targetCurrencies}
            targetEditing={targetEditing}
          />
        </CardContent>
      </Card>
    </dialog>
  );
}

type ConversionCardBodyProps = Pick<
  ConversionPopupProps,
  | "data"
  | "detection"
  | "error"
  | "loading"
  | "locale"
  | "onReorderTarget"
  | "onSourceChange"
  | "settingsSaveFailed"
  | "targetCurrencies"
  | "targetEditing"
>;

/** Selects exactly one mutually exclusive body state. */
function ConversionCardBody({
  data,
  detection,
  error,
  loading,
  locale,
  onReorderTarget,
  onSourceChange,
  settingsSaveFailed = false,
  targetCurrencies,
  targetEditing,
}: ConversionCardBodyProps) {
  if (detection === null) {
    if (loading) {
      return <ConversionSkeleton locale={locale} />;
    }
    if (error !== null) {
      return <ErrorState error={error} locale={locale} />;
    }
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {translate(locale, "conversionEmpty")}
      </p>
    );
  }
  return (
    <ConversionDetails
      data={data}
      detection={detection}
      error={error}
      loading={loading}
      locale={locale}
      onReorderTarget={onReorderTarget}
      onSourceChange={onSourceChange}
      settingsSaveFailed={settingsSaveFailed}
      targetCurrencies={targetCurrencies}
      targetEditing={targetEditing}
    />
  );
}

interface ConversionDetailsProps {
  readonly data: ConversionPopupData | null;
  readonly detection: DetectedCurrency;
  readonly error: string | null;
  readonly loading: boolean;
  readonly locale: UiLocale;
  readonly onReorderTarget?: ConversionPopupProps["onReorderTarget"];
  readonly onSourceChange?: ((source: ConversionSource | null) => void) | undefined;
  readonly settingsSaveFailed: boolean;
  readonly targetCurrencies?: readonly CurrencyCode[] | undefined;
  readonly targetEditing?: ConversionTargetEditing | undefined;
}

type RatePresentation = Pick<ConversionPopupData, "isStale" | "sourceTimestamp">;

/** Renders the source amount and ordered conversion results. */
function ConversionDetails({
  data,
  detection,
  error,
  loading,
  locale,
  onReorderTarget,
  onSourceChange,
  settingsSaveFailed,
  targetCurrencies,
  targetEditing,
}: ConversionDetailsProps) {
  const [amountText, setAmountText] = useState(String(detection.amount));
  const [currencyCode, setCurrencyCode] = useState(detection.currencyCode);
  const lastRatePresentation = useRef<RatePresentation | null>(
    data === null
      ? null
      : {
          isStale: data.isStale,
          sourceTimestamp: data.sourceTimestamp,
        },
  );
  const sourceAmount = parseConversionSourceAmount(amountText);
  const sourceIsValid = sourceAmount !== null;
  const sourceResults = useMemo(
    () => data?.results.filter((result) => result.sourceIndex === 0) ?? [],
    [data],
  );
  const displayedTargetCurrencies = useMemo(
    () => targetCurrencies ?? sourceResults.map((result) => result.toCurrency),
    [sourceResults, targetCurrencies],
  );
  const targetAmounts = useMemo(
    () =>
      createConversionTargetAmounts({
        currencyCodes: displayedTargetCurrencies,
        loading:
          targetCurrencies !== undefined && error === null && (loading || data === null),
        locale,
        results: sourceResults,
        sourceIsValid,
      }),
    [
      data,
      displayedTargetCurrencies,
      error,
      loading,
      locale,
      sourceIsValid,
      sourceResults,
      targetCurrencies,
    ],
  );
  const targetFallback = sourceIsValid
    ? getConversionTargetFallback(
        data,
        error,
        loading,
        locale,
        targetCurrencies === undefined,
      )
    : undefined;

  useEffect(() => {
    setAmountText(String(detection.amount));
  }, [detection.amount]);

  useEffect(() => {
    setCurrencyCode(detection.currencyCode);
  }, [detection.currencyCode]);

  useEffect(() => {
    if (data !== null) {
      lastRatePresentation.current = {
        isStale: data.isStale,
        sourceTimestamp: data.sourceTimestamp,
      };
    }
  }, [data]);

  const ratePresentation = error === null ? (data ?? lastRatePresentation.current) : null;

  const notifySourceChange = (nextAmountText: string, nextCurrency: CurrencyCode) => {
    const nextAmount = parseConversionSourceAmount(nextAmountText);
    onSourceChange?.(
      nextAmount === null
        ? null
        : {
            ...detection,
            amount: nextAmount,
            currencyCode: nextCurrency,
          },
    );
  };

  return (
    <Stack gap={3}>
      {settingsSaveFailed ? (
        <Alert role="alert" variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{translate(locale, "autoSaveError")}</AlertDescription>
        </Alert>
      ) : null}

      <ConversionEditor
        amountText={amountText}
        currencyCode={currencyCode}
        locale={locale}
        onAmountTextChange={(nextAmountText) => {
          setAmountText(nextAmountText);
          notifySourceChange(nextAmountText, currencyCode);
        }}
        onCurrencyChange={(nextCurrency) => {
          setCurrencyCode(nextCurrency);
          notifySourceChange(amountText, nextCurrency);
        }}
        onReorderTarget={onReorderTarget}
        portalled={false}
        sourceHeadingLevel={3}
        targetAmounts={targetAmounts}
        targetCurrencies={displayedTargetCurrencies}
        targetEditing={targetEditing}
        targetFallback={targetFallback}
        targetFooter={
          sourceIsValid && ratePresentation !== null ? (
            <RateTimestamp
              isStale={ratePresentation.isStale}
              locale={locale}
              sourceTimestamp={ratePresentation.sourceTimestamp}
            />
          ) : undefined
        }
        targetHeadingLevel={3}
        targetTitle={translate(locale, "convertedHeading")}
      />
    </Stack>
  );
}

/** Selects the one non-list target body used for loading, error, or empty data. */
function getConversionTargetFallback(
  data: ConversionPopupData | null,
  error: string | null,
  loading: boolean,
  locale: UiLocale,
  useBoundaryFallback: boolean,
): ReactNode | undefined {
  if (loading && useBoundaryFallback) {
    return <ConversionResultsSkeleton locale={locale} />;
  }
  if (error !== null) {
    return <ErrorState error={error} locale={locale} />;
  }
  if (data === null && useBoundaryFallback) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {translate(locale, "conversionEmpty")}
      </p>
    );
  }
  return undefined;
}

type DialogPresentation = "modal" | "popover";

/** Promotes the dialog to the document top layer without making the host page inert. */
function useTopLayerDialog(
  visible: boolean,
  dialogReference: RefObject<HTMLDialogElement | null>,
): void {
  useLayoutEffect(() => {
    if (!visible) {
      return undefined;
    }
    const dialog = dialogReference.current!;
    const presentation = showDialog(dialog);
    return () => hideDialog(dialog, presentation);
  }, [dialogReference, visible]);
}

/** Uses the Popover API first and retains a native-dialog fallback for older browsers. */
function showDialog(dialog: HTMLDialogElement): DialogPresentation {
  if (typeof dialog.showPopover === "function") {
    try {
      dialog.showPopover();
      dialog.focus({ preventScroll: true });
      return "popover";
    } catch {
      dialog.removeAttribute("popover");
    }
  }
  dialog.showModal();
  dialog.focus({ preventScroll: true });
  return "modal";
}

/** Reverses exactly the presentation mechanism used when the dialog was shown. */
function hideDialog(dialog: HTMLDialogElement, presentation: DialogPresentation): void {
  if (presentation === "popover") {
    dialog.hidePopover();
    return;
  }
  dialog.close();
}

/** Wires Escape and outside-pointer dismissal across the open shadow boundary. */
function useDismissableLayer(
  visible: boolean,
  popupReference: RefObject<HTMLElement | null>,
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

/** Preserves the result-list shape while conversion data is loading. */
function ConversionResultsSkeleton({ locale }: { readonly locale: UiLocale }) {
  return (
    <Stack
      aria-label={translate(locale, "loadingConversion")}
      className="rounded-lg border p-3"
      role="status"
    >
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </Stack>
  );
}

/** Preserves the full conversion-card shape before a source is available. */
function ConversionSkeleton({ locale }: { readonly locale: UiLocale }) {
  return (
    <Stack aria-label={translate(locale, "loadingConversion")} gap={3} role="status">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </Stack>
  );
}

/** Presents a localized conversion failure without leaking boundary details. */
function ErrorState({
  error,
  locale,
}: {
  readonly error: string;
  readonly locale: UiLocale;
}) {
  const isMissingTarget = error === "MISSING_CONVERSION_TARGET";
  return (
    <Alert variant="destructive">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>
        {translate(locale, isMissingTarget ? "conversionMissingTarget" : "conversionError")}
      </AlertTitle>
      {isMissingTarget ? null : (
        <AlertDescription className="text-pretty">
          {translate(locale, "conversionRetry")}
        </AlertDescription>
      )}
    </Alert>
  );
}
