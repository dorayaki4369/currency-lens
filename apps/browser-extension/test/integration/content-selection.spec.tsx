import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { Config } from "@/lib/currency";
import { messageTypes, type Message } from "@/lib/messages";

const floating = vi.hoisted(() => ({
  setFloating: vi.fn<(element: HTMLElement | null) => void>(),
  setReference: vi.fn<(reference: unknown) => void>(),
}));
const CONTENT_FLOW_TIMEOUT_MS = 15_000;

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

import App from "@/entrypoints/content/App";

const CONFIG: Config = {
  favorites: ["JPY", "EUR"],
  symbolOverrides: { $: "USD" },
  theme: "system",
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.replaceChildren();
  document.documentElement.lang = "";
});

describe("content selection-to-conversion flow", () => {
  it(
    "detects a DOM selection and sends only its parsed amount to the background",
    async () => {
      let currentSelection: Selection | null = null;
      let currentConfig = CONFIG;
      let storageChangeListener:
        | ((changes: Record<string, unknown>, areaName: string) => void)
        | undefined;
      vi.spyOn(window, "getSelection").mockImplementation(() => currentSelection);
      const sendMessage = vi.fn<(message: Message) => Promise<unknown>>((message) => {
        if (message.type === messageTypes.GET_CONFIG) {
          return Promise.resolve({ data: currentConfig, success: true });
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
        if (message.type === messageTypes.SET_CONFIG) {
          currentConfig = structuredClone(message.payload);
          return Promise.resolve({ data: currentConfig, success: true });
        }
        return Promise.resolve({ error: "Unexpected message", success: false });
      });
      vi.stubGlobal("browser", {
        i18n: { getUILanguage: vi.fn<() => string>(() => "en-US") },
        runtime: { sendMessage },
        storage: {
          onChanged: {
            addListener: vi.fn<
              (
                listener: (changes: Record<string, unknown>, areaName: string) => void,
              ) => void
            >((listener) => {
              storageChangeListener = listener;
            }),
            removeListener:
              vi.fn<
                (
                  listener: (changes: Record<string, unknown>, areaName: string) => void,
                ) => void
              >(),
          },
        },
      });
      document.documentElement.lang = "en-US";
      render(<App />);

      currentSelection = selectionWith(
        "The total is $10 today.",
        new DOMRect(4, 8, 80, 20),
      );
      vi.useFakeTimers();
      act(() => {
        document.dispatchEvent(new Event("selectionchange"));
        vi.advanceTimersByTime(180);
      });
      vi.useRealTimers();

      const trigger = await screen.findByRole(
        "button",
        { name: "Convert selected price" },
        { timeout: 1_000 },
      );
      fireEvent.click(trigger);

      const dialog = await screen.findByRole("dialog", { name: "Conversion result" });
      await waitFor(() => {
        expect(dialog.textContent).toContain("1,500.00");
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
      expect(
        sendMessage.mock.calls.filter(
          ([message]) => message.type === messageTypes.CONVERT_CURRENCIES,
        ),
      ).toHaveLength(1);
      expect(screen.queryByRole("button", { name: /^Reorder /u })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Edit conversion targets" }));
      expect(dialog.textContent).toContain("1,500.00");
      expect(dialog.textContent).toContain("9.20");

      const jpyHandle = screen.getByRole("button", {
        name: "Reorder JPY, position 1 of 2",
      });
      const eurRow = screen
        .getByRole("button", { name: "Reorder EUR, position 2 of 2" })
        .closest("li");
      if (eurRow === null) {
        throw new TypeError("Expected a converted currency row");
      }
      const dataTransfer = new DataTransfer();
      fireEvent.dragStart(jpyHandle, { dataTransfer });
      const belowEurMidpoint = eurRow.getBoundingClientRect().bottom - 1;
      fireEvent.dragOver(eurRow, { clientY: belowEurMidpoint, dataTransfer });
      fireEvent.drop(eurRow, { clientY: belowEurMidpoint, dataTransfer });

      await waitFor(() =>
        expect(sendMessage).toHaveBeenCalledWith({
          payload: { ...CONFIG, favorites: ["EUR", "JPY"] },
          type: messageTypes.SET_CONFIG,
        }),
      );
      await waitFor(() => {
        expect(
          screen
            .getAllByRole("button", { name: /^Reorder /u })
            .map((button) => button.getAttribute("aria-label")),
        ).toEqual(["Reorder EUR, position 1 of 2", "Reorder JPY, position 2 of 2"]);
      });
      await waitFor(() =>
        expect(screen.queryByLabelText("Converting currency")).toBeNull(),
      );

      const conversionRequestCount = () =>
        sendMessage.mock.calls.filter(
          ([message]) => message.type === messageTypes.CONVERT_CURRENCIES,
        ).length;
      expect(conversionRequestCount()).toBe(1);

      fireEvent.click(screen.getByLabelText("Remove JPY"));
      finishCurrencyDeletion("JPY");
      await waitFor(() =>
        expect(sendMessage).toHaveBeenCalledWith({
          payload: { ...CONFIG, favorites: ["EUR"] },
          type: messageTypes.SET_CONFIG,
        }),
      );
      await waitFor(() => expect(screen.queryByLabelText("Remove JPY")).toBeNull());
      expect(screen.getByLabelText("Remove EUR").hasAttribute("disabled")).toBe(true);
      await waitFor(() =>
        expect(screen.queryByLabelText("Converting currency")).toBeNull(),
      );

      fireEvent.click(screen.getByRole("combobox", { name: "Add a target" }));
      const addTargetSearch = await screen.findByPlaceholderText("Code, name, or region");
      await userEvent.fill(addTargetSearch, "JPY");
      // Real layout concatenates the code and name without a word boundary.
      fireEvent.click(await screen.findByRole("option", { name: /^JPY/u }));
      await waitFor(() =>
        expect(sendMessage).toHaveBeenCalledWith({
          payload: { ...CONFIG, favorites: ["EUR", "JPY"] },
          type: messageTypes.SET_CONFIG,
        }),
      );
      await waitFor(() => expect(screen.getByLabelText("Remove JPY")).toBeDefined());
      await waitFor(() =>
        expect(screen.queryByLabelText("Converting currency")).toBeNull(),
      );

      const requestCountBeforeInvalidEdit = conversionRequestCount();
      fireEvent.change(screen.getByRole("spinbutton", { name: "Amount" }), {
        target: { value: "" },
      });
      expect(screen.getByText("Enter an amount greater than 0.")).toBeDefined();
      expect(screen.getByRole("heading", { name: "Converted" })).toBeDefined();
      expect(screen.getAllByText("-")).toHaveLength(2);
      expect(dialog.textContent).not.toContain("1,500.00");
      expect(dialog.textContent).not.toContain("9.20");
      expect(conversionRequestCount()).toBe(requestCountBeforeInvalidEdit);

      currentConfig = { ...currentConfig, symbolOverrides: { $: "CAD" } };
      if (storageChangeListener === undefined) {
        throw new Error("Storage listener was not registered");
      }
      const configRequestCountBeforeChange = sendMessage.mock.calls.filter(
        ([message]) => message.type === messageTypes.GET_CONFIG,
      ).length;
      act(() => storageChangeListener?.({ config: { newValue: currentConfig } }, "sync"));
      expect(
        sendMessage.mock.calls.filter(
          ([message]) => message.type === messageTypes.GET_CONFIG,
        ),
      ).toHaveLength(configRequestCountBeforeChange);
      expect(
        screen.getByRole<HTMLInputElement>("spinbutton", { name: "Amount" }).value,
      ).toBe("");
      expect(screen.getByRole("combobox", { name: "Currency" }).textContent).toContain(
        "USD",
      );
      expect(conversionRequestCount()).toBe(requestCountBeforeInvalidEdit);

      fireEvent.change(screen.getByRole("spinbutton", { name: "Amount" }), {
        target: { value: "25" },
      });
      await waitFor(() => {
        const requests = sendMessage.mock.calls
          .map(([message]) => message)
          .filter((message) => message.type === messageTypes.CONVERT_CURRENCIES);
        expect(requests.at(-1)).toEqual({
          payload: {
            amounts: [{ amount: 25, currencyCode: "USD" }],
            targetCurrencies: ["EUR", "JPY"],
          },
          type: messageTypes.CONVERT_CURRENCIES,
        });
      });

      fireEvent.click(screen.getByRole("combobox", { name: "Currency" }));
      currentSelection = null;
      vi.useFakeTimers();
      act(() => {
        document.dispatchEvent(new Event("selectionchange"));
        vi.advanceTimersByTime(180);
      });
      vi.useRealTimers();
      expect(screen.getByRole("dialog", { name: "Conversion result" })).toBeDefined();
      expect(screen.getByPlaceholderText("Code, name, or region")).toBeDefined();
      await userEvent.fill(
        await screen.findByPlaceholderText("Code, name, or region"),
        "EUR",
      );
      // Real layout concatenates the code and name without a word boundary.
      fireEvent.click(await screen.findByRole("option", { name: /^EUR/u }));
      await waitFor(() => {
        const requests = sendMessage.mock.calls
          .map(([message]) => message)
          .filter((message) => message.type === messageTypes.CONVERT_CURRENCIES);
        expect(requests.at(-1)).toEqual({
          payload: {
            amounts: [{ amount: 25, currencyCode: "EUR" }],
            targetCurrencies: ["EUR", "JPY"],
          },
          type: messageTypes.CONVERT_CURRENCIES,
        });
      });
    },
    CONTENT_FLOW_TIMEOUT_MS,
  );
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

/** Completes the list-owned deletion before the configuration mutation is expected. */
function finishCurrencyDeletion(currencyCode: string): void {
  const row = screen.getByLabelText(`Remove ${currencyCode}`).closest("li");
  const animatedContent = row?.querySelector('[data-slot="list-item-row"]');
  if (!(animatedContent instanceof HTMLElement)) {
    throw new TypeError(`Expected the animated ${currencyCode} row`);
  }
  const event = new Event("transitionend", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "propertyName", { value: "translate" });
  fireEvent(animatedContent, event);
}
