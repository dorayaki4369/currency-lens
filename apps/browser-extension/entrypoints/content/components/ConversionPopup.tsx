import { useEffect, useRef } from "react";
import type { PopupPosition } from "../../../lib/positioning";

export interface ConversionResult {
  fromCurrency: string;
  fromAmount: number;
  toCurrency: string;
  toAmount: string;
  originalText: string;
}

interface ConversionPopupProps {
  position: PopupPosition;
  results: ConversionResult[];
  loading: boolean;
  error: string | null;
  visible: boolean;
  onClose: () => void;
}

export function ConversionPopup({
  position,
  results,
  loading,
  error,
  visible,
  onClose,
}: ConversionPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [visible, onClose]);

  if (!visible) {
    return null;
  }

  return (
    <div
      ref={popupRef}
      className="fixed z-[999998] bg-white rounded-lg shadow-2xl border border-gray-200 p-4 min-w-[280px] max-w-[400px]"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      {loading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="ml-2 text-gray-600">Converting...</span>
        </div>
      )}

      {error && (
        <div className="text-red-600 text-sm">
          <p className="font-semibold">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && results.length > 0 && (
        <div className="space-y-3">
          {results.map((result, index) => (
            <div
              key={index}
              className="border-b border-gray-100 last:border-0 pb-3 last:pb-0"
            >
              <div className="text-xs text-gray-500 mb-1">
                "{result.originalText}"
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  {result.fromAmount} {result.fromCurrency}
                </div>
                <div className="text-gray-400 mx-2">→</div>
                <div className="text-lg font-semibold text-blue-600">
                  {result.toAmount} {result.toCurrency}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && results.length === 0 && (
        <div className="text-gray-500 text-sm text-center py-2">
          No currency detected
        </div>
      )}
    </div>
  );
}
