import { useCallback, useEffect, useState } from "react";

const DEFAULT_DEBOUNCE_MS = 180;
const MAX_SELECTION_LENGTH = 1_000;

export interface SelectionInfo {
  readonly text: string;
  readonly rect: DOMRect;
}

/** Tracks short, visible document selections while ignoring editable controls. */
export function useSelection(
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
): SelectionInfo | null {
  const [selectionInfo, setSelectionInfo] = useState<SelectionInfo | null>(null);

  const readSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setSelectionInfo(null);
      return;
    }

    const range = selection.getRangeAt(0);
    if (isEditableSelection(range.commonAncestorContainer)) {
      setSelectionInfo(null);
      return;
    }

    const text = selection.toString().trim();
    const rect = range.getBoundingClientRect();
    if (
      text.length === 0 ||
      text.length > MAX_SELECTION_LENGTH ||
      (rect.width === 0 && rect.height === 0)
    ) {
      setSelectionInfo(null);
      return;
    }

    setSelectionInfo({ text, rect });
  }, []);

  useEffect(() => {
    let timeoutId: number | undefined;
    const handleSelectionChange = () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(readSelection, debounceMs);
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [debounceMs, readSelection]);

  return selectionInfo;
}

/** Returns whether the selection belongs to a control where highlighting is part of editing. */
function isEditableSelection(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement;
  if (element === null) {
    return false;
  }
  if (element.closest("input, textarea, select") !== null) {
    return true;
  }

  let currentElement: Element | null = element;
  while (currentElement !== null) {
    if (currentElement instanceof HTMLElement) {
      if (currentElement.isContentEditable) {
        return true;
      }

      // Empty contenteditable is editable in browsers, but some DOM test runtimes
      // expose it as inherited. Keep the platform-property check authoritative.
      const contentEditable = currentElement.getAttribute("contenteditable");
      if (contentEditable !== null) {
        const normalizedValue = contentEditable.trim().toLowerCase();
        if (normalizedValue === "false") {
          return false;
        }
        if (
          normalizedValue === "" ||
          normalizedValue === "true" ||
          normalizedValue === "plaintext-only"
        ) {
          return true;
        }
      }
    }
    currentElement = currentElement.parentElement;
  }

  return false;
}
