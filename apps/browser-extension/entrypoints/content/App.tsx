import { autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DetectedCurrency } from "../../lib/currency-detection";
import type { Config } from "../../lib/currency";
import { messageTypes, sendMessage } from "../../lib/messages";
import { ConversionPopup } from "./components/ConversionPopup";
import { FloatingIcon } from "./components/FloatingIcon";
import { useConversion } from "./hooks/useConversion";
import { useCurrencyDetection } from "./hooks/useCurrencyDetection";
import { useSelection } from "./hooks/useSelection";

const FLOATING_PADDING = 12;

/** Coordinates selection detection, background conversion, and the isolated in-page lens. */
export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [activeDetections, setActiveDetections] = useState<readonly DetectedCurrency[]>([]);
  const selection = useSelection();
  const { convert, data, error, loading, reset } = useConversion();

  const browserLocale = browser.i18n.getUILanguage();
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
    const loadConfig = async () => {
      try {
        const response = await sendMessage({ type: messageTypes.GET_CONFIG });
        if (response.success) {
          setConfig(response.data);
        }
      } catch {
        setConfig(null);
      }
    };
    const handleStorageChange = () => {
      void loadConfig();
    };

    void loadConfig();
    browser.storage.onChanged.addListener(handleStorageChange);
    return () => {
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

  useEffect(() => {
    setShowPopup(false);
    setActiveDetections([]);
    reset();
  }, [reset, selection?.text]);

  const handleClose = useCallback(() => {
    setShowPopup(false);
    setActiveDetections([]);
    reset();
  }, [reset]);

  const handleOpen = useCallback(() => {
    setActiveDetections(detections);
    setShowPopup(true);
    void convert(detections, config?.favorites ?? []);
  }, [config?.favorites, convert, detections]);

  const showTrigger = !showPopup && detections.length > 0 && selection?.rect !== undefined;
  const theme = config?.theme ?? "system";

  return (
    <div className={`cl-root cl-theme-${theme}`}>
      {showTrigger ? (
        <FloatingIcon
          floatingStyles={floatingStyles}
          onClick={handleOpen}
          setFloating={refs.setFloating}
        />
      ) : null}
      <ConversionPopup
        data={data}
        detections={activeDetections}
        error={error}
        floatingStyles={floatingStyles}
        loading={loading}
        onClose={handleClose}
        setFloating={refs.setFloating}
        showCurrencyCode={config?.showCurrencyCode ?? true}
        showCurrencyIcon={config?.showCurrencyIcon ?? true}
        visible={showPopup}
      />
    </div>
  );
}
