import type { CSSProperties, MouseEvent } from "react";

interface FloatingIconProps {
  readonly floatingStyles: CSSProperties;
  readonly onClick: () => void;
  readonly setFloating: (element: HTMLElement | null) => void;
}

/** Renders the compact aperture control beside a detected selection. */
export function FloatingIcon({ floatingStyles, onClick, setFloating }: FloatingIconProps) {
  return (
    <button
      aria-label="Convert selected currencies"
      className="cl-lens-trigger"
      onClick={onClick}
      onMouseDown={preservePageSelection}
      ref={setFloating}
      style={floatingStyles}
      title="Open Currency Lens"
      type="button"
    >
      <span aria-hidden="true" className="cl-aperture cl-aperture--small">
        <span className="cl-aperture__core" />
      </span>
    </button>
  );
}

/** Keeps the host-page selection active while the trigger is pressed. */
function preservePageSelection(event: MouseEvent<HTMLButtonElement>): void {
  event.preventDefault();
}
