// @vitest-environment happy-dom

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  POPUP_PREVIEW,
  readPopupMessageType,
  renderPopup,
  resetPopupTestEnvironment,
  stubPopupBrowser,
} from "@/test/popup";

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
    expect(
      screen.getByText("Choose the display theme and chart colors for Currency Lens."),
    ).toBeDefined();
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
    expect(
      screen.getByText("Currency Lens の表示テーマとチャートの色を選びます。"),
    ).toBeDefined();
    // Only the theme radios: the chart color cards are buttons.
    expect(screen.getAllByRole("radio").map((option) => option.textContent)).toEqual([
      "システム",
      "ライト",
      "ダーク",
    ]);
  });
});

describe("chart color settings", () => {
  it("changes each direction's color and returns it to the default", async () => {
    await renderPopup({ ...POPUP_PREVIEW, chartColors: { down: "#8b5cf6" }, locale: "ja" });
    await openDisplaySettings("設定を開く", "外観");

    expect(
      await screen.findByRole("heading", { level: 2, name: "チャートの色" }),
    ).toBeDefined();
    expect(
      screen.getByText("上昇と下落を押すと、それぞれの色を変えられます。"),
    ).toBeDefined();
    const up = screen.getByRole("button", { name: "上昇の色を変える" });
    const down = screen.getByRole("button", { name: "下落の色を変える" });
    expect(readDotColor(up)).toBe("var(--trend-green-line)");
    expect(readDotColor(down)).toBe("#8b5cf6");

    fireEvent.click(up);
    fireEvent.click(
      within(await screen.findByRole("dialog", { name: "上昇の色" })).getByRole("button", {
        name: "黄",
      }),
    );
    await waitFor(() => expect(readDotColor(up)).toBe("#e3b63f"));

    fireEvent.click(down);
    const downPicker = await screen.findByRole("dialog", { name: "下落の色" });
    expect(
      within(downPicker)
        .getByRole("button", { name: "デフォルト" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    fireEvent.click(within(downPicker).getByRole("button", { name: "デフォルト" }));
    await waitFor(() => expect(readDotColor(down)).toBe("var(--trend-red-line)"));
  });

  it("uses green for rises and red for falls in English as in Japanese", async () => {
    await renderPopup(POPUP_PREVIEW);
    await openDisplaySettings("Open settings", "Appearance");

    expect(
      readDotColor(await screen.findByRole("button", { name: "Change the Rise color" })),
    ).toBe("var(--trend-green-line)");
    expect(
      readDotColor(screen.getByRole("button", { name: "Change the Fall color" })),
    ).toBe("var(--trend-red-line)");
  });

  it("reports a failed save and shows the stored color again", async () => {
    const sendMessage = vi.fn<(message: unknown) => Promise<unknown>>((message) => {
      const type = readPopupMessageType(message);
      if (type === "GET_CONFIG") {
        return Promise.resolve({ data: POPUP_PREVIEW.config, success: true });
      }
      if (type === "GET_RATES") {
        return Promise.resolve({ data: POPUP_PREVIEW.rates, success: true });
      }
      if (type === "GET_CHART_COLORS") {
        return Promise.resolve({ data: {}, success: true });
      }
      return Promise.resolve({ error: "Quota exceeded", success: false });
    });
    stubPopupBrowser(sendMessage);
    await renderPopup();
    await openDisplaySettings("Open settings", "Appearance");

    const up = await screen.findByRole("button", { name: "Change the Rise color" });
    fireEvent.click(up);
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Violet" }),
    );
    expect(await screen.findByRole("alert")).toBeDefined();
    expect(readDotColor(up)).toBe("var(--trend-green-line)");
  });
});

/** Reads the color dot shown on a chart color card. */
function readDotColor(card: HTMLElement): string | undefined {
  return card.querySelector<HTMLElement>("span > span")?.style.backgroundColor;
}

/** Opens the display route through the same two controls available to users. */
async function openDisplaySettings(openLabel: string, displayLabel: string): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: openLabel }));
  fireEvent.click(await screen.findByRole("button", { name: displayLabel }));
}
