import type { CurrencyCode } from "@cl/currency";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CurrencyIcon } from "@/components/currency/CurrencyIcon";

interface CurrencyIdentityProps {
  readonly badge?: ReactNode | undefined;
  readonly className?: string | undefined;
  readonly currencyCode: CurrencyCode;
  readonly description: ReactNode;
}

/** Renders the shared currency identity, ISO code, and secondary description. */
export function CurrencyIdentity({
  badge,
  className,
  currencyCode,
  description,
}: CurrencyIdentityProps) {
  return (
    <span
      className={cn("flex min-w-0 flex-1 items-center gap-3 text-left text-sm", className)}
      data-slot="currency-identity-label"
    >
      <CurrencyIcon currencyCode={currencyCode} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <strong>{currencyCode}</strong>
          {badge}
        </span>
        <small className="block truncate text-xs text-muted-foreground">
          {description}
        </small>
      </span>
    </span>
  );
}
