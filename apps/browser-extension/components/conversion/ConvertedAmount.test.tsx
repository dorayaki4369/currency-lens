// @vitest-environment happy-dom

import { cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  type AmountSnapshot,
  ConvertedAmount,
  useHeldAmount,
} from "@/components/conversion/ConvertedAmount";

interface HeldAmountProps {
  readonly current: AmountSnapshot | null;
  readonly pending: boolean;
}

const AMOUNT: AmountSnapshot = { text: "6,962.40", value: 6962.4 };

afterEach(() => {
  cleanup();
});

describe("ConvertedAmount", () => {
  it("rolls a newly shown amount in when asked", () => {
    const { container } = render(<ConvertedAmount amount={AMOUNT} rollIn />);

    expect(readDirection(container)).toBe("up");
    expect(container.querySelector("strong")?.getAttribute("aria-busy")).toBeNull();
    expect(screen.getByText("6,962.40")).toBeTruthy();
  });

  it("shows an amount still unless asked to roll it in", () => {
    const { container } = render(<ConvertedAmount amount={AMOUNT} />);

    expect(readDirection(container)).toBeUndefined();
  });

  it("announces the busy label instead of a held amount and keeps it still", () => {
    const { container } = render(
      <ConvertedAmount amount={AMOUNT} busyLabel="Converting currency" rollIn />,
    );
    const amount = container.querySelector("strong")!;

    expect(amount.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Converting currency").className).toContain("sr-only");
    expect(
      container.querySelector('[data-slot="animated-number"]')?.getAttribute("aria-hidden"),
    ).toBe("true");
    expect(readDirection(container)).toBeUndefined();
  });

  it("shrinks exponent notation to fit the amount column", () => {
    const { container } = render(
      <ConvertedAmount amount={{ text: "1.53E+9", value: 1.53e9 }} />,
    );

    expect(container.querySelector("strong")?.className).toContain("text-xs");
  });
});

describe("useHeldAmount", () => {
  it("returns the current amount, then holds it only while a replacement is pending", () => {
    const initialProps: HeldAmountProps = { current: AMOUNT, pending: false };
    const { rerender, result } = renderHook(
      ({ current, pending }: HeldAmountProps) => useHeldAmount(current, pending),
      { initialProps },
    );
    expect(result.current).toEqual({ amount: AMOUNT, held: false });

    rerender({ current: null, pending: true });
    expect(result.current).toEqual({ amount: AMOUNT, held: true });

    rerender({ current: null, pending: false });
    expect(result.current).toEqual({ amount: null, held: false });
  });

  it("has nothing to hold before the first amount arrives", () => {
    const { result } = renderHook(() => useHeldAmount<AmountSnapshot>(null, true));

    expect(result.current).toEqual({ amount: null, held: false });
  });
});

/** Reads which way the amount is currently rolling. */
function readDirection(container: HTMLElement): string | undefined {
  return container.querySelector<HTMLElement>('[data-slot="animated-number"]')?.dataset[
    "direction"
  ];
}
