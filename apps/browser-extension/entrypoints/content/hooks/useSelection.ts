import { useState, useEffect, useCallback } from "react";

export interface SelectionInfo {
  text: string;
  rect: DOMRect | null;
}

export function useSelection(debounceMs: number = 300): SelectionInfo {
  const [selectionInfo, setSelectionInfo] = useState<SelectionInfo>({
    text: "",
    rect: null,
  });

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
      setSelectionInfo({ text: "", rect: null });
      return;
    }

    const text = selection.toString().trim();

    if (text.length === 0) {
      setSelectionInfo({ text: "", rect: null });
      return;
    }

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setSelectionInfo({
        text,
        rect: rect.width > 0 && rect.height > 0 ? rect : null,
      });
    } catch (error) {
      console.error("Error getting selection rect:", error);
      setSelectionInfo({ text, rect: null });
    }
  }, []);

  useEffect(() => {
    let timeoutId: number | undefined;

    const debouncedHandler = () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        handleSelectionChange();
      }, debounceMs);
    };

    document.addEventListener("selectionchange", debouncedHandler);

    return () => {
      document.removeEventListener("selectionchange", debouncedHandler);
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [debounceMs, handleSelectionChange]);

  return selectionInfo;
}
