import type { CurrencyCode } from "@cl/currency";
import { autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { Config } from "@/lib/currency";
import type { DetectedCurrency } from "@/lib/currency-detection";
import { getUiLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  ConversionPopup,
  type ConversionDismissReason,
} from "@/entrypoints/content/components/ConversionPopup";
import { FloatingIcon } from "@/entrypoints/content/components/FloatingIcon";
import { useConversion } from "@/entrypoints/content/hooks/useConversion";
import { useConversionSession } from "@/entrypoints/content/hooks/useConversionSession";
import { useCurrencyDetection } from "@/entrypoints/content/hooks/useCurrencyDetection";
import { useSelection } from "@/entrypoints/content/hooks/useSelection";
import { ConfigStoreProvider, useConfigStore } from "@/stores/config";

// Floating UI offsets and DOMRect coordinates are expressed in CSS pixels.
const FLOATING_PADDING = 12;
const EMPTY_SYMBOL_OVERRIDES: Readonly<Record<string, CurrencyCode>> = {};

/** Installs the synchronized configuration store for the isolated in-page lens. */
export default function App() {
  return (
    <ConfigStoreProvider>
      <ContentApplication />
    </ConfigStoreProvider>
  );
}

/** Coordinates selection detection, background conversion, and the local interaction. */
function ContentApplication() {
  const config = useConfigStore((state) => state.config);
  const saveState = useConfigStore((state) => state.saveState);
  const handleAddTarget = useConfigStore((state) => state.addFavorite);
  const handleRemoveTarget = useConfigStore((state) => state.removeFavorite);
  const handleReorderTarget = useConfigStore((state) => state.reorderFavorite);
  const {
    activeDetection,
    isOpen: showPopup,
    open: openPopup,
    reset: resetPopupState,
    sourceDraftIsDirty,
    sourceDraftIsValid,
    synchronizeDetection,
    updateSource,
  } = useConversionSession();
  const triggerReference = useRef<HTMLButtonElement | null>(null);
  const shouldRestoreTriggerFocus = useRef(false);
  const selection = useSelection();
  const selectionText = selection?.text;
  const selectionRect = selection?.rect;
  const previousSelectionText = useRef(selectionText);
  const conversionFingerprint = useRef<string | null>(null);
  const { convert, data, error, loading, reset } = useConversion();

  const browserLocale = browser.i18n.getUILanguage();
  const uiLocale = getUiLocale(browserLocale);
  const pageLocale = document.documentElement.lang || browserLocale;
  const detectionOptions = useMemo(
    () => ({
      browserLocale,
      pageLocale,
      symbolOverrides: config?.symbolOverrides ?? EMPTY_SYMBOL_OVERRIDES,
    }),
    [browserLocale, config?.symbolOverrides, pageLocale],
  );
  const detections = useCurrencyDetection(selectionText ?? "", detectionOptions);
  const middleware = useMemo(
    () => [
      offset(10),
      flip({ padding: FLOATING_PADDING }),
      shift({ padding: FLOATING_PADDING }),
    ],
    [],
  );
  const { floatingStyles, refs } = useFloating({
    middleware,
    placement: "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    const rect = selectionRect;
    if (!rect) {
      return;
    }
    refs.setReference({
      getBoundingClientRect: () => rect,
      getClientRects: () => [rect],
    });
  }, [refs, selectionRect]);

  useLayoutEffect(() => {
    const selectionChanged = previousSelectionText.current !== selectionText;
    previousSelectionText.current = selectionText;
    if (!selectionChanged || showPopup) {
      return;
    }
    shouldRestoreTriggerFocus.current = false;
    resetPopupState();
    reset();
  }, [reset, resetPopupState, selectionText, showPopup]);

  useEffect(() => {
    if (!showPopup && shouldRestoreTriggerFocus.current) {
      triggerReference.current?.focus();
      shouldRestoreTriggerFocus.current = false;
    }
  }, [showPopup]);

  useEffect(() => {
    if (!showPopup || !sourceDraftIsValid || activeDetection === null || config === null) {
      conversionFingerprint.current = null;
      return;
    }
    const nextFingerprint = createConversionFingerprint(activeDetection, config.favorites);
    if (conversionFingerprint.current === nextFingerprint) {
      return;
    }
    conversionFingerprint.current = nextFingerprint;
    void convert(activeDetection, config.favorites);
  }, [activeDetection, config, convert, showPopup, sourceDraftIsValid]);

  useEffect(() => {
    const currentDetection = detections[0];
    if (showPopup && !sourceDraftIsDirty && currentDetection !== undefined) {
      synchronizeDetection(currentDetection);
    }
  }, [detections, showPopup, sourceDraftIsDirty, synchronizeDetection]);

  const handleClose = useCallback(
    (reason: ConversionDismissReason) => {
      shouldRestoreTriggerFocus.current = reason !== "outside-pointer";
      resetPopupState();
      reset();
    },
    [reset, resetPopupState],
  );

  const handleOpen = useCallback(
    (detection: DetectedCurrency) => {
      shouldRestoreTriggerFocus.current = true;
      openPopup(detection);
    },
    [openPopup],
  );

  const handleSourceChange = useCallback(
    (source: DetectedCurrency | null) => {
      updateSource(source);
      reset();
    },
    [reset, updateSource],
  );

  const handleSetTrigger = useCallback(
    (element: HTMLButtonElement | null) => {
      triggerReference.current = element;
      refs.setFloating(element);
    },
    [refs],
  );

  const triggerDetection =
    config !== null && !showPopup && selectionRect !== undefined
      ? detections[0]
      : undefined;
  const theme = getContentTheme(config);
  const targetEditing = useMemo(
    () => ({ onAdd: handleAddTarget, onRemove: handleRemoveTarget }),
    [handleAddTarget, handleRemoveTarget],
  );

  return (
    <div className={cn(`theme-${theme}`, theme === "dark" && "dark")} data-theme={theme}>
      {triggerDetection !== undefined ? (
        <FloatingIcon
          floatingStyles={floatingStyles}
          locale={uiLocale}
          onClick={() => handleOpen(triggerDetection)}
          setFloating={handleSetTrigger}
        />
      ) : null}
      <ConversionPopup
        data={data}
        detection={activeDetection}
        error={error}
        floatingStyles={floatingStyles}
        loading={loading}
        locale={uiLocale}
        onClose={handleClose}
        onReorderTarget={handleReorderTarget}
        onSourceChange={handleSourceChange}
        settingsSaveFailed={saveState === "error"}
        setFloating={refs.setFloating}
        targetCurrencies={config?.favorites}
        targetEditing={targetEditing}
        visible={showPopup}
      />
    </div>
  );
}

/** Selects the document theme while configuration is still loading. */
function getContentTheme(config: Config | null): Config["theme"] {
  return config?.theme ?? "system";
}

/** Identifies conversion payloads while treating target reordering as display-only. */
function createConversionFingerprint(
  detection: DetectedCurrency,
  targetCurrencies: readonly CurrencyCode[],
): string {
  return JSON.stringify([
    detection.amount,
    detection.currencyCode,
    targetCurrencies.toSorted(),
  ]);
}
