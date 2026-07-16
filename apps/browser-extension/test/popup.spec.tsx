// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PopupPreviewData } from "../entrypoints/popup/App";
import App from "../entrypoints/popup/App";

const PREVIEW: PopupPreviewData = {
  config: {
    favorites: ["JPY", "EUR", "GBP"],
    showCurrencyCode: true,
    showCurrencyIcon: true,
    symbolOverrides: { $: "USD" },
    theme: "light",
  },
  rates: {
    base: "USD",
    fetchedAt: 1_753_000_000_000,
    isStale: false,
    rates: { EUR: "0.86", GBP: "0.74", JPY: "149.45", USD: "1" },
    sourceTimestamp: 1_753_000_000_000,
    warnings: [],
  },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("popup settings", () => {
  it("renders rate freshness, ordered targets, and symbol overrides", () => {
    render(<App preview={PREVIEW} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Currency Lens");
    expect(screen.getByText("Rates ready")).toBeDefined();
    expect(screen.getByText("149.45")).toBeDefined();
    const symbolSelect = screen.getByLabelText("Currency represented by $");
    expect(symbolSelect).toBeInstanceOf(HTMLSelectElement);
    if (!(symbolSelect instanceof HTMLSelectElement)) {
      throw new TypeError("Expected a symbol select element");
    }
    expect(symbolSelect.value).toBe("USD");
    expect(
      screen
        .getAllByLabelText(/^Remove /u)
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Remove JPY", "Remove EUR", "Remove GBP"]);
  });

  it("adds another conversion target to the draft", () => {
    render(<App preview={PREVIEW} />);

    fireEvent.change(screen.getByLabelText("Add a target"), {
      target: { value: "CAD" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByLabelText("Remove CAD")).toBeDefined();
    expect(screen.getByText("4/5")).toBeDefined();
  });

  it("locks every draft control while a save is in flight", async () => {
    const saveResponse = Promise.withResolvers<unknown>();
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) => {
      if (typeof message !== "object" || message === null) {
        return Promise.reject(new TypeError("Expected a message object"));
      }

      const messageType = Reflect.get(message, "type");
      if (messageType === "GET_CONFIG") {
        return Promise.resolve({ data: PREVIEW.config, success: true });
      }
      if (messageType === "GET_RATES") {
        return Promise.resolve({ data: PREVIEW.rates, success: true });
      }
      if (messageType === "SET_CONFIG") {
        return saveResponse.promise;
      }
      return Promise.reject(new TypeError("Unexpected message type"));
    });
    vi.stubGlobal("browser", { runtime: { sendMessage } });
    render(<App />);

    await waitFor(() => expect(screen.getByLabelText("Remove GBP")).toBeDefined());
    fireEvent.click(screen.getByLabelText("Remove GBP"));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Saving…" })).toBeDefined(),
    );

    const removeEuro = screen.getByLabelText("Remove EUR");
    const draftControls = [
      removeEuro,
      screen.getByLabelText("Add a target"),
      screen.getByLabelText("Currency represented by $"),
      screen.getByLabelText("Theme"),
      screen.getByLabelText("Show ISO currency codes"),
    ];
    for (const control of draftControls) {
      expect(control.hasAttribute("disabled")).toBe(true);
    }
    fireEvent.click(removeEuro);

    await act(async () => {
      saveResponse.resolve({
        data: { ...PREVIEW.config, favorites: ["JPY", "EUR"] },
        success: true,
      });
      await saveResponse.promise;
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Saved" })).toBeDefined(),
    );
    expect(screen.getByLabelText("Remove EUR")).toBeDefined();
    expect(screen.queryByLabelText("Remove GBP")).toBeNull();
  });
});
