// @vitest-environment happy-dom

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { POPUP_PREVIEW, renderPopup, resetPopupTestEnvironment } from "@/test/popup";

afterEach(resetPopupTestEnvironment);

describe("popup settings index route", () => {
  it("lists each settings destination without converter controls", async () => {
    await renderPopup(POPUP_PREVIEW);
    const open = screen.getByRole("button", { name: "Open settings" });
    open.focus();
    fireEvent.click(open);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Settings" }),
    ).toBeDefined();
    expect(screen.getByRole("navigation", { name: "Settings" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Appearance" })).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Currency conversion settings" }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Supported currencies" })).toBeDefined();
    expect(screen.queryByRole("list", { name: "Conversion targets" })).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Back" })),
    );
  });

  it("uses the same route structure for Japanese labels", async () => {
    await renderPopup({ ...POPUP_PREVIEW, locale: "ja" });
    fireEvent.click(screen.getByRole("button", { name: "設定を開く" }));

    expect(await screen.findByRole("heading", { level: 1, name: "設定" })).toBeDefined();
    expect(screen.getByRole("button", { name: "外観" })).toBeDefined();
    expect(screen.getByRole("button", { name: "通貨変換設定" })).toBeDefined();
    expect(screen.getByRole("button", { name: "対応通貨一覧" })).toBeDefined();
  });
});
