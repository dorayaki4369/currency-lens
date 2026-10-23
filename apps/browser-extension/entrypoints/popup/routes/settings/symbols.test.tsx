// @vitest-environment happy-dom

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAmbiguousCurrencySymbolGroups } from "@/lib/currency";
import {
  POPUP_PREVIEW,
  readPopupMessageType,
  renderPopup,
  resetPopupTestEnvironment,
  stubPopupBrowser,
} from "@/test/popup";

afterEach(resetPopupTestEnvironment);

describe("popup symbol settings route", () => {
  it("renders ambiguous symbol choices and restores focus to its settings trigger", async () => {
    const close = vi.spyOn(window, "close").mockImplementation(() => undefined);
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) =>
      readPopupMessageType(message) === "GET_CONFIG"
        ? Promise.resolve({ data: POPUP_PREVIEW.config, success: true })
        : Promise.resolve({ data: POPUP_PREVIEW.rates, success: true }),
    );
    stubPopupBrowser(sendMessage);
    await renderPopup();
    fireEvent.click(await screen.findByRole("button", { name: "Open settings" }));
    const trigger = await screen.findByRole("button", {
      name: "Currency conversion settings",
    });
    fireEvent.click(trigger);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Currency conversion settings",
      }),
    ).toBeDefined();
    expect(
      screen.queryByRole("heading", { level: 2, name: "Currency conversion settings" }),
    ).toBeNull();
    expect(
      screen.getByRole("list", { name: "Currency conversion settings" }),
    ).toBeDefined();
    const description = screen.getByText(
      "Choose how symbols with more than one meaning should be interpreted.",
    );
    expect(description.closest('[data-slot="card"]')).toBeNull();
    expect(screen.getAllByRole("combobox")).toHaveLength(
      getAmbiguousCurrencySymbolGroups().length,
    );
    expect(
      screen.queryByText(`${getAmbiguousCurrencySymbolGroups().length} symbols`),
    ).toBeNull();
    const back = screen.getByRole("button", { name: "Back" });
    await waitFor(() => expect(document.activeElement).toBe(back));
    expect(close).not.toHaveBeenCalled();

    fireEvent.click(back);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Settings" }),
    ).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Currency conversion settings" }),
      ),
    );
  });
});
