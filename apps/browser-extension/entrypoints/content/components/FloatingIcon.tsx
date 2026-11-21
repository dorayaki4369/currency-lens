import type { CurrencyCode } from "@cl/currency";
import { ChevronRight } from "lucide-react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { getCurrencyDisplayName, translate, type UiLocale } from "@/lib/i18n";
import { AppLogo } from "@/components/layout/AppLogo";
import {
  ConvertedAmount,
  type AmountSnapshot,
} from "@/components/conversion/ConvertedAmount";
import { CurrencyIcon } from "@/components/currency/CurrencyIcon";
import { Button } from "@/components/ui/button";

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
  "cursor-pointer rounded-md bg-card text-card-foreground shadow-lg hover:bg-accent dark:bg-card dark:hover:bg-accent";

/** Shows the top conversion beside a detected selection, or the app logo until one is available. */
export function FloatingIcon({
  floatingStyles,
  locale,
  onClick,
  quickConversion,
  setFloating,
}: FloatingIconProps) {
  // One button element serves both looks, so focus survives when the content switches.
  const variant =
    quickConversion === null || quickConversion === undefined
      ? getLogoVariant(locale)
      : getQuickConversionVariant(quickConversion, locale);
  return (
    <Button
      {...variant.props}
      onClick={onClick}
      onMouseDown={preservePageSelection}
      ref={setFloating}
      style={floatingStyles}
      type="button"
      variant="outline"
    >
      {variant.children}
    </Button>
  );
}

interface TriggerVariant {
  readonly children: ReactNode;
  readonly props: {
    readonly "aria-busy"?: true | undefined;
    readonly "aria-label": string;
    readonly className: string;
    readonly "data-slot"?: string;
    readonly size: "icon-sm" | "sm";
  };
}

/** Shows only the app logo while no converted amount is available. */
function getLogoVariant(locale: UiLocale): TriggerVariant {
  return {
    children: <AppLogo className="size-4" />,
    props: {
      "aria-label": translate(locale, "convertSelection"),
      className: TRIGGER_CLASS_NAME,
      size: "icon-sm",
    },
  };
}

/** Shows the flag, the converted amount, and an arrow that hints the card behind it. */
function getQuickConversionVariant(
  quickConversion: QuickConversion,
  locale: UiLocale,
): TriggerVariant {
  // A held amount belongs to the previous selection, so it is not announced as the result.
  const busyLabel = quickConversion.pending
    ? translate(locale, "loadingConversion")
    : undefined;
  return {
    children: (
      <>
        <CurrencyIcon className="size-5" currencyCode={quickConversion.currencyCode} />
        <ConvertedAmount amount={quickConversion.amount} busyLabel={busyLabel} rollIn />
        <ChevronRight
          aria-hidden="true"
          className="text-muted-foreground group-hover:text-foreground motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-safe:group-hover:translate-x-0.5"
        />
      </>
    ),
    props: {
      "aria-busy": quickConversion.pending ? true : undefined,
      "aria-label":
        busyLabel ??
        translate(locale, "quickConversion", {
          amount: quickConversion.amount.text,
          currency: getCurrencyDisplayName(quickConversion.currencyCode, locale),
        }),
      className: `group gap-1.5 text-[13px] has-[>svg]:pr-1.5 has-[>svg]:pl-2 font-semibold tabular-nums ${TRIGGER_CLASS_NAME}`,
      "data-slot": "quick-conversion",
      size: "sm",
    },
  };
}

/** Keeps the host-page selection active while the trigger is pressed. */
function preservePageSelection(event: MouseEvent<HTMLButtonElement>): void {
  event.preventDefault();
}
