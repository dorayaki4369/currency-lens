import { useState, useEffect, useCallback, useMemo } from "react";
import { useSelection } from "./hooks/useSelection";
import { useCurrencyDetection } from "./hooks/useCurrencyDetection";
import { useConversion } from "./hooks/useConversion";
import type { CurrencyCode } from "@cl/currency";
import { FloatingIcon } from "./components/FloatingIcon";
import { calculatePopupPosition } from "../../lib/positioning";
import {
  sendMessage,
  messageTypes,
  type GetConfigResponse,
} from "../../lib/messages";
import { computePosition, offset } from "@floating-ui/react-dom";

export default function App() {
  const [config, setConfig] = useState<{
    favorites: CurrencyCode[];
    defaultConversions: Record<string, CurrencyCode>;
  } | null>(null);
  const [showIcon, setShowIcon] = useState(false);

  const selectionInfo = useSelection(300);
  if (!selectionInfo) {
    return null;
  }

  const detectedCurrencies = useCurrencyDetection(
    selectionInfo.text,
    config?.defaultConversions,
  );
  const { convert, reset } = useConversion();

  useEffect(() => {
    sendMessage({ type: messageTypes.GET_CONFIG })
      .then((response) => {
        const configResponse = response as GetConfigResponse;
        if (configResponse.success && configResponse.data) {
          setConfig({
            favorites: configResponse.data.favorites,
            defaultConversions: configResponse.data.defaultConversions,
          });
        }
      })
      .catch((err) => {
        console.error("Failed to get config:", err);
      });
  }, []);

  useEffect(() => {
    if (detectedCurrencies.length > 0 && selectionInfo.rect) {
      setShowIcon(true);
    } else {
      setShowIcon(false);
      reset();
    }
  }, [detectedCurrencies, selectionInfo.rect, reset]);

  const handleIconClick = useCallback(() => {
    if (!config || config.favorites.length === 0) {
      reset();
      setShowPopup(false);
      return;
    }

    const targetCurrency = config.favorites[0];
    convert(detectedCurrencies, targetCurrency);
  }, [config, detectedCurrencies, convert, reset]);

  const popupPosition = useMemo(() => {
    if (!selectionInfo.rect)
      return { top: 0, left: 0, placement: "below" as const };
    return calculatePopupPosition(selectionInfo.rect, 300, 200);
  }, [selectionInfo.rect]);

  const virtualEl = {
    getBoundingClientRect: () => selectionInfo.rect,
  };

  const { refs, floatingStyles } = computePosition(virtualEl, {
    placement: popupPosition.placement === "above" ? "top" : "bottom",
    strategy: "fixed",
    middleware: [offset(8)],
  });

  return (
    <>
      {showIcon && (
        <FloatingIcon
          setFloating={refs.setFloating}
          floatingStyles={floatingStyles}
          onClick={handleIconClick}
        />
      )}
      {/* <ConversionPopup
        position={popupPosition}
        results={results}
        loading={loading}
        error={error}
        visible={showPopup}
        onClose={handleClosePopup}
      /> */}
    </>
  );
}
