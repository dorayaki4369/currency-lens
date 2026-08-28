// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../lib/currency";
import { messageTypes, type Message } from "../lib/messages";

const floating = vi.hoisted(() => ({
  setFloating: vi.fn<(element: HTMLElement | null) => void>(),
  setReference: vi.fn<(reference: unknown) => void>(),
}));

vi.mock("@floating-ui/react-dom", () => ({
  autoUpdate: vi.fn<() => void>(),
  flip: vi.fn<() => { readonly name: string }>(() => ({ name: "flip" })),
  offset: vi.fn<() => { readonly name: string }>(() => ({ name: "offset" })),
  shift: vi.fn<() => { readonly name: string }>(() => ({ name: "shift" })),
  useFloating: vi.fn<() => unknown>(() => ({
    floatingStyles: { position: "fixed" },
    refs: floating,
  })),
}));

import App from "../entrypoints/content/App";

const CONFIG: Config = {
  favorites: ["JPY", "EUR"],
  showCurrencyCode: true,
  showCurrencyIcon: true,
  symbolOverrides: { $: "USD" },
  theme: "system",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
  document.documentElement.lang = "";
});

describe("content selection-to-conversion flow", () => {
  it("detects a DOM selection and sends only its parsed amount to the background", async () => {
    let currentSelection: Selection | null = null;
    vi.spyOn(window, "getSelection").mockImplementation(() => currentSelection);
    const sendMessage = vi.fn<(message: Message) => Promise<unknown>>((message) => {
      if (message.type === messageTypes.GET_CONFIG) {
        return Promise.resolve({ data: CONFIG, success: true });
      }
      if (message.type === messageTypes.CONVERT_CURRENCIES) {
        return Promise.resolve({
          data: {
            base: "USD",
            fetchedAt: 1_753_000_000_000,
            isStale: false,
            results: [
              {
                amount: 10,
                convertedAmount: "1500",
                fractionDigits: 0,
                fromCurrency: "USD",
                rate: "150",
                sourceIndex: 0,
                status: "converted",
                toCurrency: "JPY",
              },
              {
                amount: 10,
                convertedAmount: "9.20",
                fractionDigits: 2,
                fromCurrency: "USD",
                rate: "0.92",
                sourceIndex: 0,
                status: "converted",
                toCurrency: "EUR",
              },
            ],
            sourceTimestamp: 1_752_900_000_000,
            warnings: [],
          },
          success: true,
        });
      }
      return Promise.resolve({ error: "Unexpected message", success: false });
    });
    vi.stubGlobal("browser", {
      i18n: { getUILanguage: vi.fn<() => string>(() => "en-US") },
      runtime: { sendMessage },
      storage: {
        onChanged: {
          addListener: vi.fn<() => void>(),
          removeListener: vi.fn<() => void>(),
        },
      },
    });
    document.documentElement.lang = "en-US";
    render(<App />);

    currentSelection = selectionWith("The total is $10 today.", new DOMRect(4, 8, 80, 20));
    document.dispatchEvent(new Event("selectionchange"));

    const trigger = await screen.findByRole(
      "button",
      { name: "Convert selected price" },
      { timeout: 1_000 },
    );
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Currency Lens" });
    await waitFor(() => {
      expect(dialog.textContent).toContain("1,500");
      expect(dialog.textContent).toContain("9.20");
    });
    const conversionRequest = sendMessage.mock.calls.find(
      ([message]) => message.type === messageTypes.CONVERT_CURRENCIES,
    )?.[0];
    expect(conversionRequest).toEqual({
      payload: {
        amounts: [{ amount: 10, currencyCode: "USD" }],
        targetCurrencies: ["JPY", "EUR"],
      },
      type: messageTypes.CONVERT_CURRENCIES,
    });
    expect(JSON.stringify(conversionRequest)).not.toContain("The total");
  });
});

function selectionWith(text: string, rect: DOMRect): Selection {
  return {
    getRangeAt: () =>
      ({
        commonAncestorContainer: document.body,
        getBoundingClientRect: () => rect,
      }) as unknown as Range,
    isCollapsed: false,
    rangeCount: 1,
    toString: () => text,
  } as unknown as Selection;
}
