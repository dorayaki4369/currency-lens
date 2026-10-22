import type { CurrencyCode } from "@cl/currency";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Stack } from "@/components/layout/Stack";

interface CurrencyValueRowProps extends Omit<ComponentProps<"div">, "children"> {
  readonly amount: ReactNode;
  readonly identity: ReactNode;
  readonly currencyCode: CurrencyCode;
  readonly leadingAction?: ReactNode | undefined;
  readonly mode: "display" | "edit";
  readonly trailingAction?: ReactNode | undefined;
}

/** Renders editable and display currency values with optional actions inside the row. */
export function CurrencyValueRow({
  amount,
  className,
  identity,
  currencyCode,
  leadingAction,
  mode,
  trailingAction,
  ...props
}: CurrencyValueRowProps) {
  const hasLeadingAction = hasRenderableContent(leadingAction);
  const hasTrailingAction = hasRenderableContent(trailingAction);
  const hasActions = hasLeadingAction || hasTrailingAction;

  return (
    <div
      className={cn(
        "relative flex min-w-0 text-sm motion-safe:transition-[padding-left,padding-right] motion-safe:duration-300 motion-safe:ease-in-out",
        mode === "edit" ? "items-start rounded-lg bg-card" : "flex-1 items-center",
        { "pl-8": hasLeadingAction, "pr-10": hasTrailingAction },
        className,
      )}
      data-currency-code={currencyCode}
      data-has-actions={toDataPresence(hasActions)}
      data-has-leading-action={toDataPresence(hasLeadingAction)}
      data-has-trailing-action={toDataPresence(hasTrailingAction)}
      data-mode={mode}
      data-slot="currency-value-row"
      {...props}
    >
      {hasLeadingAction ? (
        <div
          className="absolute inset-y-0 left-0 z-10 flex w-6 items-center motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-in-out"
          data-slot="currency-leading-action"
        >
          {leadingAction}
        </div>
      ) : null}
      <div
        className={cn(
          "grid min-w-0 flex-1 grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-1",
          mode === "edit" ? "items-start" : "items-center",
        )}
        data-slot="currency-value-content"
      >
        <div className="min-w-0" data-slot="currency-identity">
          {identity}
        </div>
        <Stack
          className="w-full min-w-0 text-right"
          data-slot="currency-amount"
          gap={mode === "edit" ? 1.5 : 0}
        >
          {amount}
        </Stack>
      </div>
      {hasTrailingAction ? (
        <div
          className="absolute inset-y-0 right-0 z-10 flex w-8 items-center motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-in-out"
          data-slot="currency-trailing-action"
        >
          {trailingAction}
        </div>
      ) : null}
    </div>
  );
}

/** Distinguishes omitted slots from renderable React content. */
function hasRenderableContent(content: ReactNode): boolean {
  return content !== null && content !== undefined && typeof content !== "boolean";
}

/** Serializes a present state without rendering false data attributes. */
function toDataPresence(present: boolean): "true" | undefined {
  return present ? "true" : undefined;
}
