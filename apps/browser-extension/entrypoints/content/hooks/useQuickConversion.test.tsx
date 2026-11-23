// @vitest-environment happy-dom

import type { CurrencyCode } from "@cl/currency";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DetectedCurrency } from "@/lib/currency-detection";
import { useQuickConversion } from "@/entrypoints/content/hooks/useQuickConversion";

const DETECTION: DetectedCurrency = {
  amount: 45,
  currencyCode: "USD",
  index: 0,
  originalText: "$45.00",
};

interface HookProps {
  readonly detection: DetectedCurrency | undefined;
  readonly favorites: readonly CurrencyCode[] | undefined;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useQuickConversion", () => {
  it("converts the selection into the top target only", async () => {
    const sendMessage = stubConversion();
    const { result } = renderQuickConversion({
      detection: DETECTION,
      favorites: ["JPY", "EUR"],
    });

    await waitFor(() =>
      expect(result.current).toEqual({
        amount: { text: "¥6,962", value: 6962.4 },
        currencyCode: "JPY",
        pending: false,
      }),
    );
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage.mock.calls[0]?.[0]).toEqual({
      payload: {
        amounts: [{ amount: 45, currencyCode: "USD" }],
        targetCurrencies: ["JPY"],
      },
      type: "CONVERT_CURRENCIES",
    });
  });

  it("skips a top target that matches the selected currency", async () => {
    const sendMessage = stubConversion();
    const { result } = renderQuickConversion({
      detection: { ...DETECTION, currencyCode: "JPY" },
      favorites: ["JPY", "USD"],
    });

    await waitFor(() =>
      expect(result.current).toEqual({
        amount: { text: "$0.29", value: 0.29 },
        currencyCode: "USD",
        pending: false,
      }),
    );
    expect(sendMessage.mock.calls[0]?.[0]).toMatchObject({
      payload: { targetCurrencies: ["USD"] },
    });
  });

  it.each([
    ["no other target exists", DETECTION, ["USD"]],
    ["nothing is selected", undefined, ["JPY"]],
    ["configuration is loading", DETECTION, undefined],
  ] as const)("stays empty without a request when %s", (_case, detection, favorites) => {
    const sendMessage = stubConversion();
    const { result } = renderQuickConversion({ detection, favorites });

    expect(result.current).toBeNull();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("holds the previous amount while a new selection converts, then replaces it", async () => {
    const pending = Promise.withResolvers<unknown>();
    const sendMessage = stubConversion();
    const { rerender, result } = renderQuickConversion({
      detection: DETECTION,
      favorites: ["JPY"],
    });
    await waitFor(() => expect(result.current?.pending).toBe(false));

    const convertNext = sendMessage.getMockImplementation()!;
    sendMessage.mockImplementationOnce(() => pending.promise);
    rerender({ detection: undefined, favorites: ["JPY"] });
    expect(result.current).toBeNull();
    rerender({ detection: { ...DETECTION, amount: 90 }, favorites: ["JPY"] });

    expect(result.current).toEqual({
      amount: { text: "¥6,962", value: 6962.4 },
      currencyCode: "JPY",
      pending: true,
    });
    await act(async () => {
      pending.resolve(await convertNext(sendMessage.mock.calls[1]?.[0]));
    });
    expect(result.current).toMatchObject({ amount: { text: "¥13,925" }, pending: false });
  });

  it("does not hold an amount in another currency after the target changes", async () => {
    const pending = Promise.withResolvers<unknown>();
    const sendMessage = stubConversion();
    const { rerender, result } = renderQuickConversion({
      detection: DETECTION,
      favorites: ["JPY"],
    });
    await waitFor(() => expect(result.current).not.toBeNull());

    sendMessage.mockImplementationOnce(() => pending.promise);
    rerender({
      detection: { ...DETECTION, currencyCode: "JPY" },
      favorites: ["JPY", "USD"],
    });

    expect(result.current).toBeNull();
  });

  it("drops the held amount when the new conversion fails", async () => {
    const sendMessage = stubConversion();
    const { rerender, result } = renderQuickConversion({
      detection: DETECTION,
      favorites: ["JPY"],
    });
    await waitFor(() => expect(result.current).not.toBeNull());

    sendMessage.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    rerender({ detection: { ...DETECTION, amount: 90 }, favorites: ["JPY"] });

    await waitFor(() => expect(result.current).toBeNull());
  });

  it("does not bring back an amount from before a failed conversion", async () => {
    const pending = Promise.withResolvers<unknown>();
    const sendMessage = stubConversion();
    const { rerender, result } = renderQuickConversion({
      detection: DETECTION,
      favorites: ["JPY"],
    });
    await waitFor(() => expect(result.current).not.toBeNull());

    sendMessage.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    rerender({ detection: { ...DETECTION, amount: 90 }, favorites: ["JPY"] });
    await waitFor(() => expect(result.current).toBeNull());

    sendMessage.mockImplementationOnce(() => pending.promise);
    rerender({ detection: { ...DETECTION, amount: 120 }, favorites: ["JPY"] });
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(3));

    expect(result.current).toBeNull();
  });

  it("stays empty when the target rate is unavailable", async () => {
    const sendMessage = stubConversion("unavailable");
    const { result } = renderQuickConversion({
      detection: DETECTION,
      favorites: ["JPY"],
    });

    await waitFor(() => expect(sendMessage).toHaveBeenCalledOnce());
    expect(result.current).toBeNull();
  });
});

/** Renders the hook with props that tests can replace. */
function renderQuickConversion(initialProps: HookProps) {
  return renderHook(
    ({ detection, favorites }: HookProps) =>
      useQuickConversion(
        detection,
        favorites === undefined ? null : { favorites: [...favorites] },
        "en",
      ),
    { initialProps },
  );
}

/** Answers each conversion request from a fixed USD/JPY rate. */
function stubConversion(status: "converted" | "unavailable" = "converted") {
  const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) => {
    const { amounts, targetCurrencies } = readPayload(message);
    const source = amounts[0]!;
    const target = targetCurrencies[0]!;
    const base = {
      amount: source.amount,
      fromCurrency: source.currencyCode,
      sourceIndex: 0,
      toCurrency: target,
    };
    return Promise.resolve({
      data: {
        base: "USD",
        fetchedAt: 1_753_000_000_000,
        isStale: false,
        results: [
          status === "unavailable"
            ? { ...base, reason: "RATE_UNAVAILABLE", status }
            : {
                ...base,
                convertedAmount:
                  target === "JPY"
                    ? String(source.amount * 154.72)
                    : (source.amount / 154.72).toFixed(2),
                fractionDigits: target === "JPY" ? 0 : 2,
                rate: target === "JPY" ? "154.72" : "0.0065",
                status,
              },
        ],
        sourceTimestamp: 1_753_000_000_000,
        warnings: [],
      },
      success: true,
    });
  });
  vi.stubGlobal("browser", { runtime: { sendMessage } });
  return sendMessage;
}

/** Reads the conversion payload sent by the hook under test. */
function readPayload(message: unknown): {
  readonly amounts: readonly { readonly amount: number; readonly currencyCode: string }[];
  readonly targetCurrencies: readonly string[];
} {
  return (message as { payload: ReturnType<typeof readPayload> }).payload;
}
