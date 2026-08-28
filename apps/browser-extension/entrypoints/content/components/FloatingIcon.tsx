import type { CSSProperties, MouseEvent } from "react";
import { translate, type UiLocale } from "../../../lib/i18n";

interface FloatingIconProps {
  readonly floatingStyles: CSSProperties;
  readonly locale: UiLocale;
  readonly onClick: () => void;
  readonly setFloating: (element: HTMLButtonElement | null) => void;
}

/** Renders the compact aperture control beside a detected selection. */
export function FloatingIcon({
  floatingStyles,
  locale,
  onClick,
  setFloating,
}: FloatingIconProps) {
  return (
    <button
      aria-label={translate(locale, "convertSelection")}
      className="cl-lens-trigger"
      onClick={onClick}
      onMouseDown={preservePageSelection}
      ref={setFloating}
      style={floatingStyles}
      title={translate(locale, "openApp")}
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
