import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, vi } from "vitest";
import type { PopupPreviewData } from "@/entrypoints/popup/App";
import App, { createPopupRouter } from "@/entrypoints/popup/App";

export const POPUP_PREVIEW: PopupPreviewData = {
  config: {
    favorites: ["JPY", "EUR", "GBP"],
    symbolOverrides: { $: "USD" },
    theme: "light",
  },
  locale: "en",
  rates: {
    base: "USD",
    fetchedAt: 1_753_000_000_000,
    isStale: false,
    rates: { EUR: "0.86", GBP: "0.74", JPY: "149.45", USD: "1" },
    sourceTimestamp: 1_753_000_000_000,
    warnings: [],
  },
};

export type PopupMessageSender = ReturnType<
  typeof vi.fn<(message: unknown) => Promise<unknown>>
>;

/** Restores the shared DOM and mocked browser boundaries after a popup test. */
export function resetPopupTestEnvironment(): void {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
}

/** Renders the popup after TanStack Router has resolved its initial memory route. */
export async function renderPopup(
  preview?: PopupPreviewData,
): Promise<ReturnType<typeof render>> {
  const router = createPopupRouter(preview === undefined ? {} : { preview });
  await router.load();
  return render(<App router={router} />);
}

/** Reads only the discriminant needed by browser-message test doubles. */
export function readPopupMessageType(message: unknown): unknown {
  return typeof message === "object" && message !== null
    ? Reflect.get(message, "type")
    : undefined;
}

/** Reads a message payload without widening the production message contract in tests. */
export function readPopupMessagePayload(message: unknown): unknown {
  return typeof message === "object" && message !== null
    ? Reflect.get(message, "payload")
    : undefined;
}

/** Selects configuration writes from a mixed browser-message mock. */
export function readSetConfigCalls(sendMessage: PopupMessageSender): unknown[][] {
  return sendMessage.mock.calls.filter(
    ([message]) => readPopupMessageType(message) === "SET_CONFIG",
  );
}

/** Installs the browser capabilities used by the popup boundary. */
export function stubPopupBrowser(sendMessage: PopupMessageSender): void {
  vi.stubGlobal("browser", {
    i18n: { getUILanguage: () => "en-US" },
    runtime: { sendMessage },
  });
}

/** Selects a currency through the searchable popup interaction. */
export async function choosePopupCurrency(
  controlName: string,
  currencyCode: string,
  query = currencyCode,
  expectedTriggerText = currencyCode,
): Promise<void> {
  const trigger = screen.getByRole("combobox", { name: controlName });
  fireEvent.click(trigger);
  const search = await screen.findByPlaceholderText("Code, name, or region");
  fireEvent.change(search, { target: { value: query } });
  fireEvent.click(
    await screen.findByRole("option", { name: new RegExp(`^${currencyCode}\\b`, "u") }),
  );
  await waitFor(() => expect(trigger.textContent).toContain(expectedTriggerText));
}
