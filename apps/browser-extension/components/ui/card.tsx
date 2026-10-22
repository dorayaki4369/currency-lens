import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const CARD_SPACING = {
  default: "[--card-padding-x:--spacing(6)] [--card-padding-y:--spacing(6)]",
  compact: "[--card-padding-x:--spacing(4)] [--card-padding-y:--spacing(4)]",
  row: "[--card-padding-x:--spacing(3)] [--card-padding-y:--spacing(2)]",
  none: "[--card-padding-x:0rem] [--card-padding-y:0rem]",
} as const;

/** Provides the shared card surface and spacing. */
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
      className={cn(
        "flex min-h-0 flex-col gap-(--card-padding-y) rounded-xl bg-card py-(--card-padding-y) text-card-foreground shadow-sm",
        CARD_SPACING[spacing],
        className,
      )}
      {...props}
    />
  );
}

/** Aligns content within the shared card surface. */
function CardContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("flex min-h-0 flex-1 flex-col px-(--card-padding-x)", className)}
      {...props}
    />
  );
}

export { Card, CardContent };
