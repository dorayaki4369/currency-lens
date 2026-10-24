// @vitest-environment happy-dom

import { RouterProvider } from "@tanstack/react-router";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPopupRouter } from "@/entrypoints/popup/App";
import { usePopupApplicationContext } from "@/entrypoints/popup/PopupApplication";
import {
  choosePopupCurrency,
  POPUP_PREVIEW,
  readPopupMessageType,
  renderPopup,
  resetPopupTestEnvironment,
  stubPopupBrowser,
} from "@/test/popup";

afterEach(resetPopupTestEnvironment);

describe("popup application frame", () => {
  it("preserves initial and restored focus when Strict Mode repeats mount effects", async () => {
    const router = createPopupRouter({ preview: POPUP_PREVIEW });
    await router.load();
    render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    );

    expect(screen.getByRole("spinbutton", { name: "Amount" })).toBe(document.activeElement);

    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    await screen.findByRole("heading", { name: "Settings", level: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByRole("spinbutton", { name: "Amount" });
    expect(screen.getByRole("button", { name: "Open settings" })).toBe(
      document.activeElement,
    );
  });

  it("preserves converter state while visiting settings", async () => {
    await renderPopup(POPUP_PREVIEW);
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "2" } });
    await choosePopupCurrency("Currency", "EUR", "Euro");

    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Settings" }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect((await screen.findByLabelText<HTMLInputElement>("Amount")).value).toBe("2");
    expect(screen.getByRole("combobox", { name: "Currency" }).textContent).toContain("EUR");
    expect(screen.getByText("348.00")).toBeDefined();
  });

  it("moves through the popup route hierarchy and restores the relevant focus", async () => {
    await renderPopup(POPUP_PREVIEW);
    expect(screen.getByRole("spinbutton", { name: "Amount" })).toBe(document.activeElement);
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "2" } });

    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    await screen.findByRole("heading", { level: 1, name: "Settings" });
    expect(screen.getByRole("button", { name: "Back" })).toBe(document.activeElement);

    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    await screen.findByRole("heading", { level: 1, name: "Appearance" });
    expect(screen.getByRole("button", { name: "Back" })).toBe(document.activeElement);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByRole("heading", { level: 1, name: "Settings" });
    expect(screen.getByRole("button", { name: "Appearance" })).toBe(document.activeElement);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByRole("spinbutton", { name: "Amount" });
    expect(screen.getByRole("button", { name: "Open settings" })).toBe(
      document.activeElement,
    );
  });

  it("shows the shared error state when configuration loading fails", async () => {
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) =>
      readPopupMessageType(message) === "GET_CONFIG"
        ? Promise.resolve({ error: "Configuration unavailable", success: false })
        : Promise.resolve({ data: POPUP_PREVIEW.rates, success: true }),
    );
    stubPopupBrowser(sendMessage);
    await renderPopup();

    await waitFor(() =>
      expect(screen.getAllByText("Couldn’t save your settings.")).toHaveLength(2),
    );
  });

  it("keeps nested routes inside the shared error frame without configuration", async () => {
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) =>
      readPopupMessageType(message) === "GET_CONFIG"
        ? Promise.resolve({ error: "Configuration unavailable", success: false })
        : Promise.resolve({ data: POPUP_PREVIEW.rates, success: true }),
    );
    stubPopupBrowser(sendMessage);
    const router = createPopupRouter();
    await router.navigate({ to: "/settings/display" });
    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Appearance" }),
    ).toBeDefined();
    await waitFor(() =>
      expect(screen.getAllByText("Couldn’t save your settings.")).toHaveLength(2),
    );

    await act(async () => {
      await router.navigate({ to: "/settings/symbols" });
    });
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Currency conversion settings",
      }),
    ).toBeDefined();
    expect(screen.getAllByText("Couldn’t save your settings.")).toHaveLength(2);
  });

  it("rejects a route rendered outside its application provider", () => {
    expect(() => render(<PopupApplicationContextProbe />)).toThrow(
      "Popup route rendered outside the application provider",
    );
  });
});

/** Reads the route context without a provider to exercise its boundary error. */
function PopupApplicationContextProbe() {
  usePopupApplicationContext();
  return null;
}
