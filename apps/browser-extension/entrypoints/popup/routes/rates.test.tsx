// @vitest-environment happy-dom

import { RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPopupRouter, type PopupPreviewData } from "@/entrypoints/popup/App";
import {
  choosePopupCurrency,
  POPUP_HISTORY,
  POPUP_PREVIEW,
  readPopupMessageType,
  renderPopup,
  resetPopupTestEnvironment,
  stubPopupBrowser,
} from "@/test/popup";

// Daily points carry their local date, so the dates below assume a fixed time zone.
beforeEach(() => {
  vi.stubEnv("TZ", "America/New_York");
});

afterEach(() => {
  resetPopupTestEnvironment();
  vi.unstubAllEnvs();
});

const PREVIEW: PopupPreviewData = { ...POPUP_PREVIEW, history: POPUP_HISTORY };

/** Opens the rates screen from the converter through the screen switcher. */
async function openRates(preview: PopupPreviewData = PREVIEW): Promise<void> {
  await renderPopup(preview);
  fireEvent.click(screen.getByRole("button", { name: "Rates" }));
  await screen.findByRole("heading", { name: "Base" });
}

describe("popup rates route", () => {
  it("overlays every target's change against the base for the past month", async () => {
    await openRates();

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Currency Lens");
    expect(screen.getByRole("button", { name: "Rates" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("combobox", { name: "Base" }).textContent).toContain("USD");
    const currencies = screen.getByRole("group", { name: "Currency to show" });
    expect(
      within(currencies)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["ALL", "JPY", "EUR", "GBP"]);
    expect(
      within(screen.getByRole("group", { name: "Period" }))
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["1D", "5D", "1M", "6M", "YTD", "1Y"]);
    expect(screen.getByText("Change against USD (past month)")).toBeDefined();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "JPY+5.27%",
      "EUR−3.37%",
      "GBP+0.54%since 7/25",
    ]);
    expect(
      screen.getByRole("slider", { name: "Change against USD chart, past month" }),
    ).toBeDefined();
    expect(screen.getByRole("link", { name: "Open Exchange Rates" })).toBeDefined();
  });

  it("marks a target without history in the period as having no data", async () => {
    await openRates();
    fireEvent.click(screen.getByRole("button", { name: "1D" }));

    await screen.findByRole("slider", { name: "Change against USD chart, past day" });
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "JPY−1.61%",
      "EUR0.00%",
      "GBPNo data",
    ]);
  });

  it("shows one cross rate with its change and switches to hourly history", async () => {
    await openRates();
    fireEvent.click(screen.getByRole("button", { name: "JPY" }));

    const summary = document.querySelector('[data-slot="rate-summary"]');
    expect(summary?.textContent).toContain("1 USD = 149.75 JPY");
    expect(summary?.textContent).toContain("+7.50 (+5.27%) past month");
    expect(
      screen.getByRole("slider", { name: "USD to JPY chart, past month" }),
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "1D" }));
    expect(screen.getByRole("status", { name: "Loading rate history" })).toBeDefined();
    await screen.findByRole("slider", { name: "USD to JPY chart, past day" });
    expect(document.querySelector('[data-slot="rate-summary"]')?.textContent).toContain(
      "−2.40 (−1.61%) past day",
    );

    fireEvent.click(screen.getByRole("button", { name: "GBP" }));
    expect(screen.getByText(/^Rate history isn’t available yet\./u)).toBeDefined();
    expect(document.querySelector('[data-slot="rate-summary"]')).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "1M" }));
    expect(document.querySelector('[data-slot="rate-summary"]')?.textContent).toContain(
      "since 7/25",
    );
  });

  it("shares the base with the converter and drops it from the lines", async () => {
    await openRates();
    fireEvent.click(screen.getByRole("button", { name: "EUR" }));
    await choosePopupCurrency("Base", "EUR", "Euro");

    expect(
      within(screen.getByRole("group", { name: "Currency to show" }))
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["ALL", "JPY", "GBP"]);
    expect(screen.getByRole("button", { name: "ALL" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByText("Change against EUR (past month)")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Convert" }));
    expect(
      (await screen.findByRole("combobox", { name: "Currency" })).textContent,
    ).toContain("EUR");
  });

  it("explains when only the base itself is a target", async () => {
    await openRates({
      ...PREVIEW,
      config: { ...PREVIEW.config, favorites: ["USD"] },
    });

    expect(
      screen.getByText("Add a conversion target other than USD to see its rates."),
    ).toBeDefined();
    expect(screen.queryByRole("group", { name: "Period" })).toBeNull();
  });

  it.each([
    [{ kind: "empty" } as const, /^Rate history isn’t available yet\./u],
    [{ kind: "error" } as const, /^Couldn’t load the rate history\./u],
  ])(
    "explains a %o history state while keeping the period choice",
    async (history, text) => {
      await openRates({ ...PREVIEW, history });

      expect(screen.getByText(text)).toBeDefined();
      expect(screen.getByRole("group", { name: "Period" })).toBeDefined();
      expect(screen.queryByRole("slider")).toBeNull();
    },
  );

  it("requests a failed history window again from the retry button", async () => {
    let historyAttempts = 0;
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) => {
      const type = readPopupMessageType(message);
      if (type === "GET_CONFIG") {
        return Promise.resolve({ data: POPUP_PREVIEW.config, success: true });
      }
      if (type === "GET_RATES") {
        return Promise.resolve({ data: POPUP_PREVIEW.rates, success: true });
      }
      historyAttempts += 1;
      // The converter's sparklines and the rates screen each try once before the retry.
      return historyAttempts <= 2
        ? Promise.resolve({ error: "Rate history API returned HTTP 503", success: false })
        : Promise.resolve({ data: POPUP_HISTORY.daily, success: true });
    });
    stubPopupBrowser(sendMessage);
    await renderPopup();
    fireEvent.click(await screen.findByRole("button", { name: "Rates" }));

    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(3));
    expect(screen.queryByText("Couldn’t load the rate history.")).toBeNull();
    expect(historyAttempts).toBe(3);
  });

  it("keeps the chart footprint while history loads", async () => {
    await openRates({ ...PREVIEW, history: { kind: "loading" } });

    expect(screen.getByRole("status", { name: "Loading rate history" })).toBeDefined();
  });

  it("stays inside the shared error frame without configuration", async () => {
    stubPopupBrowser(
      vi.fn<(message: unknown) => Promise<unknown>>(() =>
        Promise.resolve({ error: "Configuration unavailable", success: false }),
      ),
    );
    const router = createPopupRouter();
    await router.navigate({ to: "/rates" });
    render(<RouterProvider router={router} />);

    await waitFor(() =>
      expect(screen.getAllByText("Couldn’t save your settings.")).toHaveLength(2),
    );
    expect(screen.queryByRole("heading", { name: "Base" })).toBeNull();
  });

  it("requests history in the background and works before rates arrive", async () => {
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) => {
      const type = readPopupMessageType(message);
      if (type === "GET_CONFIG") {
        return Promise.resolve({ data: POPUP_PREVIEW.config, success: true });
      }
      if (type === "GET_RATE_HISTORY") {
        return Promise.resolve({ data: POPUP_HISTORY.daily, success: true });
      }
      return Promise.resolve({
        error: "Exchange rates are not available yet.",
        success: false,
      });
    });
    stubPopupBrowser(sendMessage);
    await renderPopup();
    fireEvent.click(await screen.findByRole("button", { name: "Rates" }));

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(3));
    expect(screen.queryByRole("link", { name: "Open Exchange Rates" })).toBeNull();
    expect(sendMessage).toHaveBeenCalledWith({
      payload: { resolution: "daily", symbols: ["JPY", "EUR", "GBP"] },
      type: "GET_RATE_HISTORY",
    });
  });
});
