export interface Position {
  top: number;
  left: number;
}

export interface PopupPosition extends Position {
  placement: "above" | "below";
}

const POPUP_OFFSET = 8;
const ICON_SIZE = 24;
const ICON_OFFSET = 4;

export function calculateIconPosition(selectionRect: DOMRect): Position {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  return {
    top: selectionRect.top + scrollY - ICON_SIZE - ICON_OFFSET,
    left: selectionRect.right + scrollX + ICON_OFFSET,
  };
}

export function calculatePopupPosition(selectionRect: DOMRect, popupWidth: number, popupHeight: number): PopupPosition {
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  const spaceAbove = selectionRect.top;
  const spaceBelow = viewportHeight - selectionRect.bottom;

  let top: number;
  let placement: "above" | "below";

  if (spaceAbove >= popupHeight + POPUP_OFFSET) {
    top = selectionRect.top + scrollY - popupHeight - POPUP_OFFSET;
    placement = "above";
  } else if (spaceBelow >= popupHeight + POPUP_OFFSET) {
    top = selectionRect.bottom + scrollY + POPUP_OFFSET;
    placement = "below";
  } else {
    if (spaceBelow > spaceAbove) {
      top = selectionRect.bottom + scrollY + POPUP_OFFSET;
      placement = "below";
    } else {
      top = selectionRect.top + scrollY - popupHeight - POPUP_OFFSET;
      placement = "above";
    }
  }

  const selectionCenter = selectionRect.left + selectionRect.width / 2;
  let left = selectionCenter + scrollX - popupWidth / 2;

  const minLeft = scrollX + POPUP_OFFSET;
  const maxLeft = scrollX + viewportWidth - popupWidth - POPUP_OFFSET;

  left = Math.max(minLeft, Math.min(left, maxLeft));

  return { top, left, placement };
}
