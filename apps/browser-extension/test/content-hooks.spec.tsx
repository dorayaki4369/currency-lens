// @vitest-environment happy-dom

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CurrencyDetectionOptions } from "../lib/currency-detection";
import { useCurrencyDetection } from "../entrypoints/content/hooks/useCurrencyDetection";

afterEach(() => {
  cleanup();
});

describe("useCurrencyDetection", () => {
  it("does not run detection for an empty selection", () => {
    const { result } = renderHook(() => useCurrencyDetection("", {}));

    expect(result.current).toEqual([]);
  });

  it("detects money using the current locale and symbol override hints", () => {
    const initialOptions: CurrencyDetectionOptions = {
      browserLocale: "en-US",
      pageLocale: "en-US",
      symbolOverrides: { $: "CAD" },
    };
    const { result, rerender } = renderHook(
      ({ options, text }: { options: CurrencyDetectionOptions; text: string }) =>
        useCurrencyDetection(text, options),
      { initialProps: { options: initialOptions, text: "$10" } },
    );

    expect(result.current).toEqual([
      { amount: 10, currencyCode: "CAD", index: 0, originalText: "$10" },
    ]);

    rerender({
      options: {
        browserLocale: "ja-JP",
        pageLocale: "ja-JP",
        symbolOverrides: { $: "USD" },
      },
      text: "¥1,000",
    });
    expect(result.current).toEqual([
      { amount: 1_000, currencyCode: "JPY", index: 0, originalText: "¥1,000" },
    ]);
  });
});
