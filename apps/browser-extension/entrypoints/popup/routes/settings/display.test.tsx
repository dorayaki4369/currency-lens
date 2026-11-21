// @vitest-environment happy-dom

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { POPUP_PREVIEW, renderPopup, resetPopupTestEnvironment } from "@/test/popup";

afterEach(resetPopupTestEnvironment);

describe("popup display settings route", () => {
  it("updates the theme from the segmented control", async () => {
    const { container } = await renderPopup(POPUP_PREVIEW);
    await openDisplaySettings("Open settings", "Appearance");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Appearance" }),
    ).toBeDefined();
    expect(screen.queryByRole("heading", { level: 2, name: "Appearance" })).toBeNull();
    const theme = screen.getByRole("radiogroup", { name: "Theme" });
    expect(screen.getByRole("radio", { name: "Light" }).getAttribute("aria-checked")).toBe(
      "true",
    );

    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(container.querySelector("main")?.dataset["theme"]).toBe("dark");
    expect(theme.querySelector('[aria-checked="true"]')?.textContent).toBe("Dark");
    expect(screen.getByText("Choose the display theme for Currency Lens.")).toBeDefined();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Settings" }),
    ).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Appearance" }),
      ),
    );
  });

  it("renders every theme option in Japanese", async () => {
    await renderPopup({ ...POPUP_PREVIEW, locale: "ja" });
    await openDisplaySettings("設定を開く", "外観");

    expect(await screen.findByRole("heading", { level: 1, name: "外観" })).toBeDefined();
    expect(screen.getByText("Currency Lens の表示テーマを選びます。")).toBeDefined();
    expect(screen.getAllByRole("radio").map((option) => option.textContent)).toEqual([
      "システム",
      "ライト",
      "ダーク",
    ]);
  });
});

/** Opens the display route through the same two controls available to users. */
async function openDisplaySettings(openLabel: string, displayLabel: string): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: openLabel }));
  fireEvent.click(await screen.findByRole("button", { name: displayLabel }));
}
