// @vitest-environment happy-dom

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POPUP_PREVIEW, renderPopup, resetPopupTestEnvironment } from "@/test/popup";

vi.mock("virtual:third-party-licenses", () => ({
  default: [
    {
      license: "MIT",
      licenseText: "MIT License\n\n\nCopyright (c) Meta\n  Platforms\n \n",
      name: "react",
      version: "19.0.0",
    },
    { license: "MIT", licenseText: null, name: "no-text", version: "1.0.0" },
  ],
}));

afterEach(resetPopupTestEnvironment);

describe("popup open source licenses route", () => {
  it("lists shipped packages with their notices and restores focus on return", async () => {
    await renderPopup(POPUP_PREVIEW);
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    fireEvent.click(await screen.findByRole("button", { name: "About" }));
    fireEvent.click(await screen.findByRole("button", { name: "Open source licenses" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Open source licenses" }),
    ).toBeDefined();
    expect(screen.getByText("2 packages")).toBeDefined();
    const list = screen.getByRole("list", { name: "Open source licenses" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((item) => item.querySelector("summary")?.textContent)).toEqual([
      "react19.0.0MIT",
      "no-text1.0.0MIT",
    ]);
    expect(
      within(items[0] as HTMLElement).getByText("Copyright (c) Meta Platforms"),
    ).toBeDefined();
    expect(
      [...(items[0] as HTMLElement).querySelectorAll("details p")].map(
        (paragraph) => paragraph.textContent,
      ),
    ).toEqual(["MIT License", "Copyright (c) Meta Platforms"]);
    expect(
      within(items[1] as HTMLElement).getByText(
        "This package does not ship a license file. Its declared license is MIT.",
      ),
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("heading", { level: 1, name: "About" })).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Open source licenses" }),
      ),
    );
  });

  it("uses Japanese labels", async () => {
    await renderPopup({ ...POPUP_PREVIEW, locale: "ja" });
    fireEvent.click(screen.getByRole("button", { name: "設定を開く" }));
    fireEvent.click(await screen.findByRole("button", { name: "このアプリについて" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "オープンソースライセンス" }),
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "オープンソースライセンス" }),
    ).toBeDefined();
    expect(screen.getByText("2 件")).toBeDefined();
    expect(
      screen.getByText("Currency Lens は次のオープンソースソフトウェアを利用しています。"),
    ).toBeDefined();
  });
});
