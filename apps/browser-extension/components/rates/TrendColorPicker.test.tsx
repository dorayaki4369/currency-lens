// @vitest-environment happy-dom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrendColorPicker } from "@/components/rates/TrendColorPicker";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Renders the rise picker with the Japanese red default. */
function renderPicker(selectedHex: string | null = null) {
  const onColorChange = vi.fn<(color: string | null) => void>();
  render(
    <TrendColorPicker
      color={selectedHex ?? "var(--trend-red-line)"}
      defaultColor="var(--trend-red-line)"
      defaultHex="#ef4444"
      direction="up"
      locale="en"
      onColorChange={onColorChange}
      selectedHex={selectedHex}
    />,
  );
  return onColorChange;
}

/** Opens the picker from its card and returns the dialog. */
async function openPicker(name = "Change the Rise color"): Promise<HTMLElement> {
  fireEvent.click(screen.getByRole("button", { name }));
  return screen.findByRole("dialog", { name: /color$/u });
}

describe("TrendColorPicker", () => {
  it("shows the default as selected and offers every swatch without an eyedropper", async () => {
    renderPicker();
    const card = screen.getByRole("button", { name: "Change the Rise color" });
    expect(card.textContent).toBe("↑ Rise");
    expect(card.querySelectorAll("path")[1]?.style.stroke).toBe("var(--trend-red-line)");

    const dialog = await openPicker();
    expect(dialog.getAttribute("aria-label")).toBe("Rise color");
    expect(card.getAttribute("aria-expanded")).toBe("true");
    // Only the default button is selected, even though Red equals the default color.
    expect(within(dialog).getAllByRole("button", { pressed: false })).toHaveLength(17);
    expect(within(dialog).getAllByRole("button", { pressed: true })).toEqual([
      within(dialog).getByRole("button", { name: "Default" }),
    ]);
    expect(within(dialog).getByRole("button", { name: "Red" }).style.boxShadow).toBe("");
    expect(
      within(dialog).queryByRole("button", { name: "Pick a color with the eyedropper" }),
    ).toBeNull();
    const defaultButton = within(dialog).getByRole("button", { name: "Default" });
    expect(defaultButton.getAttribute("aria-pressed")).toBe("true");
    expect(
      defaultButton.querySelector<HTMLElement>('[data-slot="trend-color-default-dot"]')
        ?.style.backgroundColor,
    ).toBe("var(--trend-red-line)");
  });

  it("applies a swatch, closes, and returns focus to the card", async () => {
    const onColorChange = renderPicker();
    const dialog = await openPicker();

    fireEvent.click(within(dialog).getByRole("button", { name: "Yellow" }));
    expect(onColorChange).toHaveBeenCalledWith("#e3b63f");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Change the Rise color" }),
      ),
    );
  });

  it("returns to the default from its swatch or the default button", async () => {
    const onColorChange = renderPicker("#e3b63f");
    let dialog = await openPicker();
    expect(
      within(dialog).getByRole("button", { name: "Yellow" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      within(dialog).getByRole("button", { name: "Default" }).getAttribute("aria-pressed"),
    ).toBe("false");

    fireEvent.click(within(dialog).getByRole("button", { name: "Red" }));
    expect(onColorChange).toHaveBeenLastCalledWith(null);

    dialog = await openPicker();
    fireEvent.click(within(dialog).getByRole("button", { name: "Default" }));
    expect(onColorChange).toHaveBeenLastCalledWith(null);
  });

  it("closes on Escape without changing the color", async () => {
    const onColorChange = renderPicker();
    const dialog = await openPicker();

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onColorChange).not.toHaveBeenCalled();
  });

  it("samples a screen color where the browser has an eyedropper", async () => {
    const results = [
      () => Promise.resolve({ sRGBHex: "#12AB34" }),
      () => Promise.resolve({ sRGBHex: "rgb(1, 2, 3)" }),
      () => Promise.reject(new DOMException("Cancelled", "AbortError")),
    ];
    vi.stubGlobal(
      "EyeDropper",
      class {
        open() {
          return results.shift()!();
        }
      },
    );
    const onColorChange = renderPicker();

    let dialog = await openPicker();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Pick a color with the eyedropper" }),
    );
    await waitFor(() => expect(onColorChange).toHaveBeenCalledWith("#12ab34"));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    dialog = await openPicker();
    const eyedropper = within(dialog).getByRole("button", {
      name: "Pick a color with the eyedropper",
    });
    // An unusable value and a cancelled pick both leave the picker open and unchanged.
    fireEvent.click(eyedropper);
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.click(eyedropper);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(onColorChange).toHaveBeenCalledTimes(1);
  });

  it("anchors the fall picker to the card's end", async () => {
    render(
      <TrendColorPicker
        color="var(--trend-red-line)"
        defaultColor="var(--trend-red-line)"
        defaultHex="#ef4444"
        direction="down"
        locale="ja"
        onColorChange={() => undefined}
        selectedHex={null}
      />,
    );
    const card = screen.getByRole("button", { name: "下落の色を変える" });
    expect(card.textContent).toBe("↓ 下落");
    fireEvent.click(card);
    expect((await screen.findByRole("dialog", { name: "下落の色" })).dataset["align"]).toBe(
      "end",
    );
  });
});
