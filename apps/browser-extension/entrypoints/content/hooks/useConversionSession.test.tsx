// @vitest-environment happy-dom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useConversionSession } from "@/entrypoints/content/hooks/useConversionSession";
import type { DetectedCurrency } from "@/lib/currency-detection";

const DETECTION: DetectedCurrency = {
  amount: 12.5,
  currencyCode: "USD",
  index: 4,
  originalText: "$12.50",
};

afterEach(cleanup);

describe("useConversionSession", () => {
  it("opens, edits, and resets one conversion interaction", () => {
    const { result } = renderHook(useConversionSession);

    expect(result.current).toMatchObject({
      activeDetection: null,
      isOpen: false,
      sourceDraftIsDirty: false,
      sourceDraftIsValid: true,
    });

    act(() => {
      result.current.updateSource(DETECTION);
    });
    expect(result.current.activeDetection).toBeNull();

    act(() => {
      result.current.open(DETECTION);
    });
    expect(result.current).toMatchObject({
      activeDetection: DETECTION,
      isOpen: true,
      sourceDraftIsDirty: false,
      sourceDraftIsValid: true,
    });

    act(() => {
      result.current.updateSource(null);
    });
    expect(result.current).toMatchObject({
      activeDetection: DETECTION,
      sourceDraftIsDirty: true,
      sourceDraftIsValid: false,
    });

    const editedDetection: DetectedCurrency = {
      ...DETECTION,
      amount: 20,
      originalText: "20 USD",
    };
    act(() => {
      result.current.updateSource(editedDetection);
      result.current.reset();
    });
    expect(result.current).toMatchObject({
      activeDetection: null,
      isOpen: false,
      sourceDraftIsDirty: false,
      sourceDraftIsValid: true,
    });
  });

  it("synchronizes a clean open draft and ignores closed, equivalent, or dirty input", () => {
    const { result } = renderHook(useConversionSession);
    const synchronizedDetection = { ...DETECTION, amount: 15 };

    act(() => {
      result.current.synchronizeDetection(synchronizedDetection);
      result.current.open(DETECTION);
      result.current.synchronizeDetection({ ...DETECTION });
    });
    expect(result.current.activeDetection).toBe(DETECTION);

    act(() => {
      result.current.synchronizeDetection(synchronizedDetection);
    });
    expect(result.current.activeDetection).toBe(synchronizedDetection);

    act(() => {
      result.current.updateSource(null);
      result.current.synchronizeDetection({ ...DETECTION, amount: 30 });
    });
    expect(result.current.activeDetection).toBe(synchronizedDetection);
  });

  it.each([
    ["amount", { amount: 15 }],
    ["currency", { currencyCode: "EUR" as const }],
    ["index", { index: 8 }],
    ["original text", { originalText: "12.50 USD" }],
  ])("synchronizes when the %s changes", (_field, change) => {
    const { result } = renderHook(useConversionSession);
    const changedDetection = { ...DETECTION, ...change };

    act(() => {
      result.current.open(DETECTION);
      result.current.synchronizeDetection(changedDetection);
    });

    expect(result.current.activeDetection).toEqual(changedDetection);
  });
});
