import type { CurrencyCode } from "@cl/currency";
import { ChevronRight } from "lucide-react";
import type { CSSProperties, MouseEvent } from "react";
import { getCurrencyDisplayName, translate, type UiLocale } from "@/lib/i18n";
import { AppLogo } from "@/components/layout/AppLogo";
import {
  ConvertedAmount,
  type AmountSnapshot,
} from "@/components/conversion/ConvertedAmount";
import { CurrencyIcon } from "@/components/currency/CurrencyIcon";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";

export interface QuickConversion {
  readonly amount: AmountSnapshot;
  readonly currencyCode: CurrencyCode;
  /** True while a newer conversion for the current selection replaces this amount. */
  readonly pending: boolean;
}

interface FloatingIconProps {
  readonly floatingStyles: CSSProperties;
  readonly locale: UiLocale;
  readonly onClick: () => void;
  readonly quickConversion?: QuickConversion | null | undefined;
  readonly setFloating: (element: HTMLButtonElement | null) => void;
}

const TRIGGER_CLASS_NAME =
  "cursor-pointer rounded-md bg-slate-950 text-slate-50 shadow-lg ring-1 ring-white/10 hover:bg-slate-800 focus-visible:ring-sky-400";

/** Shows the top conversion beside a detected selection, or the app logo until one is available. */
export function FloatingIcon({
  floatingStyles,
  locale,
  onClick,
  quickConversion,
  setFloating,
}: FloatingIconProps) {
  if (quickConversion === null || quickConversion === undefined) {
    return (
      <IconButton
        className={TRIGGER_CLASS_NAME}
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

  // A held amount belongs to the previous selection, so it is not announced as the result.
  const busyLabel = quickConversion.pending
    ? translate(locale, "loadingConversion")
    : undefined;
  return (
    <Button
      aria-busy={quickConversion.pending ? true : undefined}
      aria-label={
        busyLabel ??
        translate(locale, "quickConversion", {
          amount: quickConversion.amount.text,
          currency: getCurrencyDisplayName(quickConversion.currencyCode, locale),
        })
      }
      className={`group gap-1.5 text-[13px] has-[>svg]:pr-1.5 has-[>svg]:pl-2 font-semibold tabular-nums ${TRIGGER_CLASS_NAME}`}
      data-slot="quick-conversion"
      onClick={onClick}
      onMouseDown={preservePageSelection}
      ref={setFloating}
      size="sm"
      style={floatingStyles}
      type="button"
    >
      <CurrencyIcon className="size-5" currencyCode={quickConversion.currencyCode} />
      <ConvertedAmount amount={quickConversion.amount} busyLabel={busyLabel} rollIn />
      <ChevronRight
        aria-hidden="true"
        className="text-slate-400 group-hover:text-slate-100 motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-safe:group-hover:translate-x-0.5"
      />
    </Button>
  );
}

/** Keeps the host-page selection active while the trigger is pressed. */
function preservePageSelection(event: MouseEvent<HTMLButtonElement>): void {
  event.preventDefault();
}
