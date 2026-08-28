import { autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DetectedCurrency } from "../../lib/currency-detection";
import type { Config } from "../../lib/currency";
import { getUiLocale } from "../../lib/i18n";
import { messageTypes, sendMessage } from "../../lib/messages";
import {
  ConversionPopup,
  type ConversionDismissReason,
} from "./components/ConversionPopup";
import { FloatingIcon } from "./components/FloatingIcon";
import { useConversion } from "./hooks/useConversion";
import { useCurrencyDetection } from "./hooks/useCurrencyDetection";
import { useSelection } from "./hooks/useSelection";

const FLOATING_PADDING = 12;

/** Coordinates selection detection, background conversion, and the isolated in-page lens. */
export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [activeDetection, setActiveDetection] = useState<DetectedCurrency | null>(null);
  const triggerReference = useRef<HTMLButtonElement | null>(null);
  const shouldRestoreTriggerFocus = useRef(false);
  const selection = useSelection();
  const { convert, data, error, loading, reset } = useConversion();

  const browserLocale = browser.i18n.getUILanguage();
  const uiLocale = getUiLocale(browserLocale);
  const pageLocale = document.documentElement.lang || browserLocale;
  const detectionOptions = useMemo(
    () => ({
      browserLocale,
      pageLocale,
      symbolOverrides: config?.symbolOverrides ?? {},
    }),
    [browserLocale, config?.symbolOverrides, pageLocale],
  );
  const detections = useCurrencyDetection(selection?.text ?? "", detectionOptions);
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
    let active = true;
    let loadGeneration = 0;
    const loadConfig = async () => {
      const generation = loadGeneration + 1;
      loadGeneration = generation;
      try {
        const response = await sendMessage({ type: messageTypes.GET_CONFIG });
        if (active && generation === loadGeneration && response.success) {
          setConfig(response.data);
        }
      } catch {
        if (active && generation === loadGeneration) {
          setConfig(null);
        }
      }
    };
    const handleStorageChange: Parameters<
      typeof browser.storage.onChanged.addListener
    >[0] = (changes, areaName) => {
      if (areaName === "sync" && Object.hasOwn(changes, "config")) {
        void loadConfig();
      }
    };

    void loadConfig();
    browser.storage.onChanged.addListener(handleStorageChange);
    return () => {
      active = false;
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  useEffect(() => {
    const rect = selection?.rect;
    if (!rect) {
      return;
    }
    refs.setReference({
      getBoundingClientRect: () => rect,
      getClientRects: () => [rect],
    });
  }, [refs, selection?.rect]);

  useLayoutEffect(() => {
    shouldRestoreTriggerFocus.current = false;
    setShowPopup(false);
    setActiveDetection(null);
    reset();
  }, [reset, selection?.text]);

  useEffect(() => {
    if (!showPopup && shouldRestoreTriggerFocus.current) {
      triggerReference.current?.focus();
      shouldRestoreTriggerFocus.current = false;
    }
  }, [showPopup]);

  useEffect(() => {
    if (!showPopup || activeDetection === null || config === null) {
      return;
    }
    void convert(activeDetection, config.favorites);
  }, [activeDetection, config, convert, showPopup]);

  useEffect(() => {
    if (showPopup) {
      setActiveDetection(detections[0] ?? null);
    }
  }, [detections, showPopup]);

  const handleClose = useCallback(
    (reason: ConversionDismissReason) => {
      shouldRestoreTriggerFocus.current = reason !== "outside-pointer";
      setShowPopup(false);
      setActiveDetection(null);
      reset();
    },
    [reset],
  );

  const handleOpen = useCallback((detection: DetectedCurrency) => {
    shouldRestoreTriggerFocus.current = true;
    setActiveDetection(detection);
    setShowPopup(true);
  }, []);

  const handleSetTrigger = useCallback(
    (element: HTMLButtonElement | null) => {
      triggerReference.current = element;
      refs.setFloating(element);
    },
    [refs],
  );

  const triggerDetection =
    config !== null && !showPopup && selection?.rect !== undefined
      ? detections[0]
      : undefined;
  const theme = config?.theme ?? "system";

  return (
    <div className={`cl-root cl-theme-${theme}`}>
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
        setFloating={refs.setFloating}
        showCurrencyCode={config?.showCurrencyCode ?? true}
        showCurrencyIcon={config?.showCurrencyIcon ?? true}
        visible={showPopup}
      />
    </div>
  );
}
