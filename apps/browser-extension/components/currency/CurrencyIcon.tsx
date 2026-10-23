import type { CurrencyCode } from "@cl/currency";
import { getCurrencyPresentation } from "@/lib/currency-presentation";
import { cn } from "@/lib/utils";

interface CurrencyIconProps {
  readonly className?: string | undefined;
  readonly currencyCode: CurrencyCode;
}

/** Shows a regional flag for fiat and an explicit mark for non-fiat currencies. */
export function CurrencyIcon({ className, currencyCode }: CurrencyIconProps) {
  const presentation = getCurrencyPresentation(currencyCode);

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-6 shrink-0 items-center justify-center text-xs font-semibold",
        presentation.kind === "fiat" && "bg-transparent",
        presentation.kind === "cryptocurrency" &&
          presentation.iconUrl !== null &&
          "overflow-hidden rounded-full bg-transparent",
        (presentation.kind === "other" ||
          (presentation.kind === "cryptocurrency" && presentation.iconUrl === null)) &&
          "overflow-hidden rounded-full bg-muted",
        className,
      )}
      data-currency-icon={currencyCode}
      data-currency-kind={presentation.kind}
    >
      {presentation.kind === "fiat" ? (
        <img
          alt=""
          className="h-auto w-full object-cover"
          draggable={false}
          src={getFlagIconUrl(presentation.regionCode)}
        />
      ) : presentation.kind === "cryptocurrency" && presentation.iconUrl !== null ? (
        <img alt="" className="size-full" draggable={false} src={presentation.iconUrl} />
      ) : (
        presentation.mark
      )}
    </span>
  );
}

/** Resolves packaged flags in extensions and a deterministic path in browser previews. */
function getFlagIconUrl(regionCode: string): string {
  const filename: `${string}.svg` = `${regionCode.toLowerCase()}.svg`;
  return typeof browser === "undefined" || typeof browser.runtime.getURL !== "function"
    ? `/4x3/${filename}`
    : browser.runtime.getURL(`/currency-flags/${filename}`);
}
