import { useEffect, useRef } from "react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";

export interface AmountSnapshot {
  readonly text: string;
  readonly value: number;
}

interface ConvertedAmountProps {
  readonly amount: AmountSnapshot;
  /** Announced instead of the amount while a newer conversion replaces it. */
  readonly busyLabel?: string | undefined;
  readonly className?: string | undefined;
  /** Rolls the amount in when it first appears, unless it is a held amount. */
  readonly rollIn?: boolean | undefined;
}

export interface HeldAmount<T> {
  readonly amount: T | null;
  readonly held: boolean;
}

/** Shows a converted amount that rolls between values as it changes. */
export function ConvertedAmount({
  amount,
  busyLabel,
  className,
  rollIn = false,
}: ConvertedAmountProps) {
  const busy = busyLabel !== undefined;
  return (
    <strong
      aria-busy={busy ? true : undefined}
      className={cn(
        "block max-w-full whitespace-nowrap tabular-nums",
        /E[+-]\d+$/u.test(amount.text) && "text-xs",
        className,
      )}
      data-slot="converted-amount"
    >
      <AnimatedNumber
        animateOnMount={rollIn && !busy}
        aria-hidden={busy ? true : undefined}
        text={amount.text}
        value={amount.value}
      />
      {busy ? <span className="sr-only">{busyLabel}</span> : null}
    </strong>
  );
}

/**
 * Where the conversion behind an amount stands: a replacement is on its way, it finished
 * (with or without an amount), or nothing is being converted right now.
 */
export type ConversionPhase = "idle" | "pending" | "settled";

/**
 * Keeps the last shown amount on screen while a newer conversion is pending. A conversion that
 * settles without an amount discards it, so only the amount shown just before can roll onward.
 */
export function useHeldAmount<T>(current: T | null, phase: ConversionPhase): HeldAmount<T> {
  const lastAmount = useRef(current);

  useEffect(() => {
    if (current !== null) {
      lastAmount.current = current;
    } else if (phase === "settled") {
      lastAmount.current = null;
    }
  }, [current, phase]);

  if (current !== null) {
    return { amount: current, held: false };
  }
  if (phase === "pending" && lastAmount.current !== null) {
    return { amount: lastAmount.current, held: true };
  }
  return { amount: null, held: false };
}
