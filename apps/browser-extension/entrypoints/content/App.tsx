import { useState, useEffect, useCallback, useMemo } from "react";
import { useSelection } from "./hooks/useSelection";
import { useCurrencyDetection } from "./hooks/useCurrencyDetection";
import { useConversion } from "./hooks/useConversion";
import { FloatingIcon } from "./components/FloatingIcon";
import { ConversionPopup } from "./components/ConversionPopup";
import { calculateIconPosition, calculatePopupPosition } from "../../lib/positioning";
import { sendMessage, messageTypes, type GetConfigResponse } from "../../lib/messages";

type CurrencyCode = string & { readonly brand: unique symbol };

export default function App() {
  const [config, setConfig] = useState<{
    favorites: CurrencyCode[];
    defaultConversions: Record<string, CurrencyCode>;
  } | null>(null);
  const [showIcon, setShowIcon] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  const selectionInfo = useSelection(300);
  const detectedCurrencies = useCurrencyDetection(selectionInfo.text, config?.defaultConversions);
  const { results, loading, error, convert, reset } = useConversion();

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
      setShowPopup(false);
    } else {
      setShowIcon(false);
      setShowPopup(false);
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
    setShowPopup(true);
  }, [config, detectedCurrencies, convert, reset]);

  const handleClosePopup = useCallback(() => {
    setShowPopup(false);
    reset();
  }, [reset]);

  const iconPosition = useMemo(() => {
    if (!selectionInfo.rect) return { top: 0, left: 0 };
    return calculateIconPosition(selectionInfo.rect);
  }, [selectionInfo.rect]);

  const popupPosition = useMemo(() => {
    if (!selectionInfo.rect) return { top: 0, left: 0, placement: "below" as const };
    return calculatePopupPosition(selectionInfo.rect, 300, 200);
  }, [selectionInfo.rect]);

  return (
    <>
      <FloatingIcon position={iconPosition} onClick={handleIconClick} visible={showIcon && !showPopup} />
      <ConversionPopup
        position={popupPosition}
        results={results}
        loading={loading}
        error={error}
        visible={showPopup}
        onClose={handleClosePopup}
      />
    </>
  );
}
