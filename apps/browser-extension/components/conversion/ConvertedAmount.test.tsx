// @vitest-environment happy-dom

import { cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  type AmountSnapshot,
  type ConversionPhase,
  ConvertedAmount,
  useHeldAmount,
} from "@/components/conversion/ConvertedAmount";

interface HeldAmountProps {
  readonly current: AmountSnapshot | null;
  readonly phase: ConversionPhase;
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
  it("holds the last amount while a replacement is pending and keeps it across idle time", () => {
    const initialProps: HeldAmountProps = { current: AMOUNT, phase: "settled" };
    const { rerender, result } = renderHook(
      ({ current, phase }: HeldAmountProps) => useHeldAmount(current, phase),
      { initialProps },
    );
    expect(result.current).toEqual({ amount: AMOUNT, held: false });

    rerender({ current: null, phase: "idle" });
    expect(result.current).toEqual({ amount: null, held: false });

    rerender({ current: null, phase: "pending" });
    expect(result.current).toEqual({ amount: AMOUNT, held: true });
  });

  it("discards the held amount once a conversion settles without one", () => {
    const initialProps: HeldAmountProps = { current: AMOUNT, phase: "settled" };
    const { rerender, result } = renderHook(
      ({ current, phase }: HeldAmountProps) => useHeldAmount(current, phase),
      { initialProps },
    );

    rerender({ current: null, phase: "settled" });
    expect(result.current).toEqual({ amount: null, held: false });

    rerender({ current: null, phase: "pending" });
    expect(result.current).toEqual({ amount: null, held: false });
  });

  it("has nothing to hold before the first amount arrives", () => {
    const { result } = renderHook(() => useHeldAmount<AmountSnapshot>(null, "pending"));

    expect(result.current).toEqual({ amount: null, held: false });
  });
});

/** Reads which way the amount is currently rolling. */
function readDirection(container: HTMLElement): string | undefined {
  return container.querySelector<HTMLElement>('[data-slot="animated-number"]')?.dataset[
    "direction"
  ];
}
