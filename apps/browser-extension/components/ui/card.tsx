import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Every card keeps its content 8px (p-2) from all four edges. A "flush" card holds
// full-width rows that pad themselves by the same 8px (see ROW_INSET_CLASS_NAME), so hover
// fills and dividers can reach the card's edges. A "field" card is the surface of one text field,
// which fills it; the field matches the height of the row beside it and centers its text.
const CARD_SPACING = {
  default: "gap-2 p-2",
  field: "",
  flush: "",
} as const;
// A "raised" card sits on the page. An "overlay" card is itself the page of a panel that floats
// over a web page, such as the conversion card: it takes the page fill, so raised cards inside
// it read the same as in the popup, and a deeper shadow to lift it off the host page.
const CARD_LAYER = {
  overlay: "bg-background shadow-lg",
  raised: "bg-card shadow-sm",
} as const;

/** Provides the shared card surface and its inset. */
function Card({
  className,
  layer = "raised",
  spacing = "default",
  ...props
}: ComponentProps<"div"> & {
  readonly layer?: keyof typeof CARD_LAYER | undefined;
  readonly spacing?: keyof typeof CARD_SPACING | undefined;
}) {
  return (
    <div
      data-layer={layer}
      data-slot="card"
      data-spacing={spacing}
      className={cn(
        "flex min-h-0 flex-col rounded-xl text-card-foreground",
        CARD_LAYER[layer],
        CARD_SPACING[spacing],
        className,
      )}
      {...props}
    />
  );
}

export { Card };
