import type { CSSProperties, MouseEvent } from "react";
import { translate, type UiLocale } from "@/lib/i18n";
import { AppLogo } from "@/components/layout/AppLogo";
import { IconButton } from "@/components/ui/icon-button";

interface FloatingIconProps {
  readonly floatingStyles: CSSProperties;
  readonly locale: UiLocale;
  readonly onClick: () => void;
  readonly setFloating: (element: HTMLButtonElement | null) => void;
}

/** Renders the app logo as the conversion trigger beside a detected selection. */
export function FloatingIcon({
  floatingStyles,
  locale,
  onClick,
  setFloating,
}: FloatingIconProps) {
  return (
    <IconButton
      className="cursor-pointer rounded-md bg-slate-950 shadow-lg hover:bg-slate-900 focus-visible:ring-sky-400"
      label={translate(locale, "convertSelection")}
      onClick={onClick}
      onMouseDown={preservePageSelection}
      ref={setFloating}
      size="icon-sm"
      style={floatingStyles}
      type="button"
    >
      <AppLogo className="size-4" />
    </IconButton>
  );
}

/** Keeps the host-page selection active while the trigger is pressed. */
function preservePageSelection(event: MouseEvent<HTMLButtonElement>): void {
  event.preventDefault();
}
