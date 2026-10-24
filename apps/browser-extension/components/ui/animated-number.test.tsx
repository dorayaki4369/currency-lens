// @vitest-environment happy-dom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimatedNumber } from "@/components/ui/animated-number";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AnimatedNumber", () => {
  it("renders the initial formatted value without an entrance transition", () => {
    render(<AnimatedNumber text="1,234.50" value={1_234.5} />);

    expect(readAnimatedNumber()?.dataset["direction"]).toBeUndefined();
    expect(readLabel()).toBe("1,234.50");
    expect(readLayers("animated-number-outgoing")).toHaveLength(0);
    expect(readLayers("animated-number-incoming")).toHaveLength(0);
  });

  it("rolls changed glyphs upward when the value increases", () => {
    const { rerender } = render(<AnimatedNumber text="149.00" value={149} />);

    rerender(<AnimatedNumber text="150.25" value={150.25} />);

    expect(readAnimatedNumber()?.dataset["direction"]).toBe("up");
    expect(readLabel()).toBe("150.25");
    expect(readLayerText("animated-number-outgoing")).toEqual(["4", "9", "0", "0"]);
    expect(readLayerText("animated-number-incoming")).toEqual(["5", "0", "2", "5"]);

    fireEvent.animationEnd(readLastIncomingLayer());

    expect(readAnimatedNumber()?.dataset["direction"]).toBeUndefined();
    expect(readLayers("animated-number-outgoing")).toHaveLength(0);
  });

  it("rolls downward and retains disappearing leading columns until completion", () => {
    const { rerender } = render(<AnimatedNumber text="1,000" value={1_000} />);

    rerender(<AnimatedNumber text="999" value={999} />);

    expect(readAnimatedNumber()?.dataset["direction"]).toBe("down");
    expect(readLayers("animated-number-glyph")).toHaveLength(5);
    expect(readLayerText("animated-number-outgoing")).toEqual(["1", ",", "0", "0", "0"]);
    expect(readLayerText("animated-number-incoming")).toEqual([" ", " ", "9", "9", "9"]);

    fireEvent.animationEnd(readLastIncomingLayer());

    expect(readLayers("animated-number-glyph")).toHaveLength(3);
    expect(readLabel()).toBe("999");
  });

  it("updates without motion when formatting or an unrendered value changes alone", () => {
    const { rerender } = render(<AnimatedNumber text="1.00" value={1} />);

    rerender(<AnimatedNumber text="1.00" value={1.004} />);
    expect(readAnimatedNumber()?.dataset["direction"]).toBeUndefined();

    rerender(<AnimatedNumber text="1,00" value={1.004} />);
    expect(readAnimatedNumber()?.dataset["direction"]).toBeUndefined();
    expect(readLabel()).toBe("1,00");
  });

  it("does not let a stale transition completion cancel a newer value", () => {
    const { rerender } = render(<AnimatedNumber text="10" value={10} />);
    rerender(<AnimatedNumber text="11" value={11} />);
    const staleIncoming = readLastIncomingLayer();

    rerender(<AnimatedNumber text="9" value={9} />);
    fireEvent.animationEnd(staleIncoming);

    expect(readAnimatedNumber()?.dataset["direction"]).toBe("down");
    expect(readLabel()).toBe("9");
  });

  it("settles the new width immediately when reduced motion is requested", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
    const { rerender } = render(<AnimatedNumber text="1,000" value={1_000} />);

    rerender(<AnimatedNumber text="9" value={9} />);

    expect(readAnimatedNumber()?.dataset["direction"]).toBeUndefined();
    expect(readLayers("animated-number-glyph")).toHaveLength(1);
    expect(readLayers("animated-number-outgoing")).toHaveLength(0);
    expect(readLabel()).toBe("9");
  });
});

/** Reads the component root without coupling tests to styling utilities. */
function readAnimatedNumber(): HTMLElement | null {
  return document.querySelector('[data-slot="animated-number"]');
}

/** Reads the single semantic value exposed to assistive technology. */
function readLabel(): string | null {
  return document.querySelector('[data-slot="animated-number-label"]')?.textContent ?? null;
}

/** Reads one kind of reel layer in visual order. */
function readLayers(slot: string): readonly HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`)];
}

/** Reads rendered glyphs while preserving non-breaking placeholder columns. */
function readLayerText(slot: string): readonly string[] {
  return readLayers(slot).map((element) => element.textContent ?? "");
}

/** Returns the layer responsible for completing the current transition. */
function readLastIncomingLayer(): HTMLElement {
  const layers = readLayers("animated-number-incoming");
  const layer = layers.at(-1);
  if (layer === undefined) {
    throw new TypeError("Expected an incoming number layer");
  }
  return layer;
}
