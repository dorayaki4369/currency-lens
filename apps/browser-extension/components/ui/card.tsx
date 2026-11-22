import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Every card keeps its content one inset (8px) from all four edges. A "flush" card holds
// full-width rows that pad themselves by the same inset (see ROW_INSET_CLASS_NAME), so hover
// fills and dividers can reach the card's edges. A "field" card is the surface of one text field,
// which fills it; the field matches the height of the row beside it and centers its text.
const CARD_SPACING = {
  default: "gap-inset p-inset",
  field: "",
  flush: "",
} as const;

/** Provides the shared card surface and its inset. */
function Card({
  className,
  spacing = "default",
  ...props
}: ComponentProps<"div"> & {
  readonly spacing?: keyof typeof CARD_SPACING | undefined;
}) {
  return (
    <div
      data-slot="card"
      data-spacing={spacing}
      className={cn(
        "flex min-h-0 flex-col rounded-xl bg-card text-card-foreground shadow-sm",
        CARD_SPACING[spacing],
        className,
      )}
      {...props}
    />
  );
}

export { Card };
