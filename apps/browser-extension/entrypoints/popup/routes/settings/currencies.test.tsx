// @vitest-environment happy-dom

import { currencies } from "@cl/currency";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { POPUP_PREVIEW, renderPopup, resetPopupTestEnvironment } from "@/test/popup";

afterEach(resetPopupTestEnvironment);

describe("popup supported currencies route", () => {
  it("shows the read-only catalog and restores focus to its settings trigger", async () => {
    await renderPopup(POPUP_PREVIEW);
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    fireEvent.click(await screen.findByRole("button", { name: "Supported currencies" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Supported currencies" }),
    ).toBeDefined();
    expect(
      screen.queryByRole("heading", { level: 2, name: "Supported currencies" }),
    ).toBeNull();
    expect(screen.getByRole("searchbox", { name: "Search currencies" })).toBeDefined();
    const currencyList = screen.getByRole("list", { name: "Supported currencies" });
    expect(currencyList.querySelectorAll(":scope > li")).toHaveLength(currencies.length);
    expect(screen.queryByLabelText(/^Remove /u)).toBeNull();
    expect(screen.queryByLabelText("Add a target")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Supported currencies" }),
      ),
    );
  });
});
